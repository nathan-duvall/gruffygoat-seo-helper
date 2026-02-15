import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Input Validation ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_ACTIONS = ["create", "update"];
const VALID_SEO_PLUGINS = ["yoast", "rankmath"];

function validateUUID(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const encryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");
    if (!encryptionKey) throw new Error("Encryption key not configured");

    const { action, ...params } = await req.json();

    // Validate action
    if (typeof action !== "string" || !VALID_ACTIONS.includes(action)) {
      return badRequest("Invalid action");
    }

    if (action === "create") {
      const { site_name, base_url, username, app_password, seo_plugin, strict_mode, batch_size } = params;

      // Validate all fields
      if (typeof site_name !== "string" || site_name.trim().length === 0 || site_name.length > 200) {
        return badRequest("Site name is required and must be under 200 characters.");
      }
      if (typeof base_url !== "string" || !base_url.startsWith("https://") || base_url.length > 500) {
        return badRequest("Base URL must be HTTPS and under 500 characters.");
      }
      if (typeof username !== "string" || username.trim().length === 0 || username.length > 100) {
        return badRequest("Username is required and must be under 100 characters.");
      }
      if (typeof app_password !== "string" || app_password.trim().length === 0 || app_password.length > 200) {
        return badRequest("Application password is required and must be under 200 characters.");
      }
      if (typeof seo_plugin !== "string" || !VALID_SEO_PLUGINS.includes(seo_plugin)) {
        return badRequest("SEO plugin must be 'yoast' or 'rankmath'.");
      }
      const validBatchSize = typeof batch_size === "number" && batch_size >= 1 && batch_size <= 20 ? batch_size : 5;
      const validStrictMode = typeof strict_mode === "boolean" ? strict_mode : true;

      // Encrypt the password
      const { data: encData, error: encError } = await supabaseAdmin.rpc("encrypt_app_password", {
        plain_password: app_password,
        encryption_key: encryptionKey,
      });
      if (encError) throw new Error("Failed to secure credentials");

      const { data, error } = await supabaseAdmin.from("sites").insert({
        user_id: userId,
        site_name: site_name.trim(),
        base_url: base_url.trim(),
        username: username.trim(),
        app_password_encrypted: encData,
        seo_plugin,
        strict_mode: validStrictMode,
        batch_size: validBatchSize,
      }).select("id, site_name, base_url, username, seo_plugin, strict_mode, batch_size, created_at").single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, site: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { site_id, site_name, base_url, username, app_password, seo_plugin, strict_mode, batch_size } = params;
      if (!validateUUID(site_id)) return badRequest("Invalid site_id format.");

      // Verify ownership
      const { data: existing, error: fetchErr } = await supabaseAdmin.from("sites").select("id, user_id").eq("id", site_id).single();
      if (fetchErr || !existing || existing.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Site not found or access denied" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const updateData: Record<string, any> = {};
      if (typeof site_name === "string" && site_name.trim().length > 0 && site_name.length <= 200) updateData.site_name = site_name.trim();
      if (typeof base_url === "string" && base_url.startsWith("https://") && base_url.length <= 500) updateData.base_url = base_url.trim();
      if (typeof username === "string" && username.trim().length > 0 && username.length <= 100) updateData.username = username.trim();
      if (typeof seo_plugin === "string" && VALID_SEO_PLUGINS.includes(seo_plugin)) updateData.seo_plugin = seo_plugin;
      if (typeof strict_mode === "boolean") updateData.strict_mode = strict_mode;
      if (typeof batch_size === "number" && batch_size >= 1 && batch_size <= 20) updateData.batch_size = batch_size;

      if (typeof app_password === "string" && app_password.trim().length > 0 && app_password.length <= 200) {
        const { data: encData, error: encError } = await supabaseAdmin.rpc("encrypt_app_password", {
          plain_password: app_password,
          encryption_key: encryptionKey,
        });
        if (encError) throw new Error("Failed to secure credentials");
        updateData.app_password_encrypted = encData;
      }

      if (Object.keys(updateData).length === 0) {
        return badRequest("No valid fields to update.");
      }

      const { error } = await supabaseAdmin.from("sites").update(updateData).eq("id", site_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return badRequest("Invalid action");
  } catch (e) {
    console.error("site-management error:", e);
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
