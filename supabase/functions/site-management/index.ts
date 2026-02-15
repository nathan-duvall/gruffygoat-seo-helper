import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user-scoped client for auth verification
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

    // Service role client for encryption operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const encryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");
    if (!encryptionKey) throw new Error("Encryption key not configured");

    const { action, ...params } = await req.json();

    if (action === "create") {
      const { site_name, base_url, username, app_password, seo_plugin, strict_mode, batch_size } = params;
      if (!site_name || !base_url || !username || !app_password || !seo_plugin) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Encrypt the password
      const { data: encData, error: encError } = await supabaseAdmin.rpc("encrypt_app_password", {
        plain_password: app_password,
        encryption_key: encryptionKey,
      });
      if (encError) throw new Error(`Encryption failed: ${encError.message}`);

      const { data, error } = await supabaseAdmin.from("sites").insert({
        user_id: userId,
        site_name,
        base_url,
        username,
        app_password_encrypted: encData,
        seo_plugin,
        strict_mode: strict_mode ?? true,
        batch_size: batch_size ?? 5,
      }).select("id, site_name, base_url, username, seo_plugin, strict_mode, batch_size, created_at").single();

      if (error) throw error;
      return new Response(JSON.stringify({ success: true, site: data }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "update") {
      const { site_id, site_name, base_url, username, app_password, seo_plugin, strict_mode, batch_size } = params;
      if (!site_id) {
        return new Response(JSON.stringify({ error: "Missing site_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Verify ownership
      const { data: existing, error: fetchErr } = await supabaseAdmin.from("sites").select("id, user_id").eq("id", site_id).single();
      if (fetchErr || !existing || existing.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Site not found or access denied" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const updateData: Record<string, any> = {};
      if (site_name) updateData.site_name = site_name;
      if (base_url) updateData.base_url = base_url;
      if (username) updateData.username = username;
      if (seo_plugin) updateData.seo_plugin = seo_plugin;
      if (strict_mode !== undefined) updateData.strict_mode = strict_mode;
      if (batch_size !== undefined) updateData.batch_size = batch_size;

      if (app_password) {
        const { data: encData, error: encError } = await supabaseAdmin.rpc("encrypt_app_password", {
          plain_password: app_password,
          encryption_key: encryptionKey,
        });
        if (encError) throw new Error(`Encryption failed: ${encError.message}`);
        updateData.app_password_encrypted = encData;
      }

      const { error } = await supabaseAdmin.from("sites").update(updateData).eq("id", site_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("site-management error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
