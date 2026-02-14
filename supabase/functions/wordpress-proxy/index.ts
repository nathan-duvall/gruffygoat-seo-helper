import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SiteCredentials {
  base_url: string;
  username: string;
  app_password: string;
}

async function wpFetch(creds: SiteCredentials, path: string, options: RequestInit = {}) {
  const url = `${creds.base_url.replace(/\/$/, "")}/wp-json${path}`;
  const auth = btoa(`${creds.username}:${creds.app_password}`);
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  return resp;
}

async function getSiteCredentials(supabase: any, siteId: string, userId: string): Promise<SiteCredentials & { seo_plugin: string; strict_mode: boolean; batch_size: number }> {
  const { data: site, error } = await supabase
    .from("sites")
    .select("*")
    .eq("id", siteId)
    .eq("user_id", userId)
    .single();
  if (error || !site) throw new Error("Site not found or access denied");
  return {
    base_url: site.base_url,
    username: site.username,
    app_password: site.app_password_encrypted, // stored as plain text for alpha
    seo_plugin: site.seo_plugin,
    strict_mode: site.strict_mode,
    batch_size: site.batch_size,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { action, ...params } = await req.json();

    if (action === "test-connection") {
      const { base_url, username, app_password } = params;
      if (!base_url || !username || !app_password) {
        return new Response(JSON.stringify({ error: "Missing credentials" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const creds: SiteCredentials = { base_url, username, app_password };
      try {
        // Test REST availability
        const rootResp = await wpFetch(creds, "/wp/v2");
        if (!rootResp.ok) {
          return new Response(JSON.stringify({ success: false, error: `REST API returned ${rootResp.status}. Ensure the WordPress REST API is enabled.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        // Test auth by fetching 1 post
        const postResp = await wpFetch(creds, "/wp/v2/posts?per_page=1&context=edit");
        if (postResp.status === 401 || postResp.status === 403) {
          return new Response(JSON.stringify({ success: false, error: "Authentication failed. Check your username and application password. Ensure the user has admin privileges." }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        if (!postResp.ok) {
          return new Response(JSON.stringify({ success: false, error: `Could not fetch posts: ${postResp.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        const posts = await postResp.json();
        return new Response(JSON.stringify({ success: true, message: `Connected successfully. Found ${posts.length} post(s).` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: `Connection failed: ${e instanceof Error ? e.message : "Network error"}. Ensure the URL is correct and HTTPS.` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (action === "scan") {
      const { site_id } = params;
      const site = await getSiteCredentials(supabase, site_id, userId);
      const creds: SiteCredentials = { base_url: site.base_url, username: site.username, app_password: site.app_password };

      const metaKeys = site.seo_plugin === "yoast"
        ? ["_yoast_wpseo_title", "_yoast_wpseo_metadesc", "_yoast_wpseo_focuskw"]
        : ["rank_math_title", "rank_math_description", "rank_math_focus_keyword"];

      const allItems: any[] = [];

      for (const postType of ["posts", "pages"]) {
        let page = 1;
        let hasMore = true;
        while (hasMore) {
          const resp = await wpFetch(creds, `/wp/v2/${postType}?per_page=100&page=${page}&context=edit&status=publish`);
          if (!resp.ok) break;
          const items = await resp.json();
          if (items.length === 0) break;

          for (const item of items) {
            const meta = item.meta || {};
            const missing: string[] = [];
            for (const key of metaKeys) {
              if (!meta[key] || (typeof meta[key] === "string" && meta[key].trim() === "")) {
                missing.push(key);
              }
            }
            if (missing.length > 0) {
              allItems.push({
                post_id: item.id,
                post_type: postType === "posts" ? "post" : "page",
                post_title: item.title?.rendered || "",
                post_url: item.link || "",
                content: item.content?.rendered || "",
                excerpt: item.excerpt?.rendered || "",
                missing_keys: missing,
                existing_meta: meta,
              });
            }
          }
          const totalPages = parseInt(resp.headers.get("X-WP-TotalPages") || "1");
          hasMore = page < totalPages;
          page++;
        }
      }

      return new Response(JSON.stringify({ items: allItems, total: allItems.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "apply") {
      const { site_id, suggestion_id, fields } = params;
      const site = await getSiteCredentials(supabase, site_id, userId);
      const creds: SiteCredentials = { base_url: site.base_url, username: site.username, app_password: site.app_password };

      // Get suggestion
      const { data: suggestion, error: sugError } = await supabase
        .from("suggestions")
        .select("*")
        .eq("id", suggestion_id)
        .eq("user_id", userId)
        .single();
      if (sugError || !suggestion) {
        return new Response(JSON.stringify({ error: "Suggestion not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const metaUpdate: Record<string, string> = {};
      const titleKey = site.seo_plugin === "yoast" ? "_yoast_wpseo_title" : "rank_math_title";
      const descKey = site.seo_plugin === "yoast" ? "_yoast_wpseo_metadesc" : "rank_math_description";
      const focusKey = site.seo_plugin === "yoast" ? "_yoast_wpseo_focuskw" : "rank_math_focus_keyword";

      const existingMeta = (suggestion.existing_meta as Record<string, string>) || {};

      if (suggestion.suggested_title && (!existingMeta[titleKey] || existingMeta[titleKey].trim() === "")) {
        metaUpdate[titleKey] = suggestion.suggested_title;
      }
      if (suggestion.suggested_metadesc && (!existingMeta[descKey] || existingMeta[descKey].trim() === "")) {
        metaUpdate[descKey] = suggestion.suggested_metadesc;
      }
      if (suggestion.suggested_focus && (!existingMeta[focusKey] || existingMeta[focusKey].trim() === "")) {
        metaUpdate[focusKey] = suggestion.suggested_focus;
      }

      if (Object.keys(metaUpdate).length === 0) {
        return new Response(JSON.stringify({ success: true, message: "No blank fields to update" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Apply to WordPress
      const resp = await wpFetch(creds, `/wp/v2/${suggestion.post_type === "page" ? "pages" : "posts"}/${suggestion.post_id}`, {
        method: "POST",
        body: JSON.stringify({ meta: metaUpdate }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        // Log failure
        for (const [key, val] of Object.entries(metaUpdate)) {
          await supabase.from("seo_logs").insert({
            site_id, user_id: userId, post_id: suggestion.post_id,
            field_key: key, old_value: existingMeta[key] || "", new_value: val,
            result: "failed", message: `WP write failed: ${resp.status} - ${errText.substring(0, 200)}`,
          });
        }
        await supabase.from("suggestions").update({ status: "error", error_code: "WP_WRITE_FAILED", error_message: errText.substring(0, 500) }).eq("id", suggestion_id);
        return new Response(JSON.stringify({ success: false, error: `WordPress write failed: ${resp.status}` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify
      const verifyResp = await wpFetch(creds, `/wp/v2/${suggestion.post_type === "page" ? "pages" : "posts"}/${suggestion.post_id}?context=edit`);
      if (verifyResp.ok) {
        const verified = await verifyResp.json();
        const vMeta = verified.meta || {};
        let allVerified = true;
        for (const [key, val] of Object.entries(metaUpdate)) {
          const wrote = vMeta[key] === val;
          await supabase.from("seo_logs").insert({
            site_id, user_id: userId, post_id: suggestion.post_id,
            field_key: key, old_value: existingMeta[key] || "", new_value: val,
            result: wrote ? "success" : "verification_failed",
            message: wrote ? "Verified" : `Expected "${val}", got "${vMeta[key] || ""}"`,
          });
          if (!wrote) allVerified = false;
        }
        const newStatus = allVerified ? "applied" : "verification_failed";
        await supabase.from("suggestions").update({ status: newStatus, error_code: allVerified ? null : "VERIFY_FAILED", error_message: allVerified ? null : "One or more fields did not verify" }).eq("id", suggestion_id);
        return new Response(JSON.stringify({ success: allVerified, status: newStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } else {
        await supabase.from("suggestions").update({ status: "verification_failed", error_code: "VERIFY_FAILED", error_message: "Could not re-fetch post for verification" }).eq("id", suggestion_id);
        return new Response(JSON.stringify({ success: false, error: "Verification fetch failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("wordpress-proxy error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
