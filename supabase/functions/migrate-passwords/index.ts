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

    // Get all sites for this user
    const { data: sites, error: fetchErr } = await supabaseAdmin
      .from("sites")
      .select("id, app_password_encrypted")
      .eq("user_id", userId);

    if (fetchErr) throw fetchErr;

    let migrated = 0;
    for (const site of (sites || [])) {
      // If password is short, it's likely plaintext (encrypted base64 is much longer)
      if (site.app_password_encrypted && site.app_password_encrypted.length < 80) {
        const { data: encData, error: encError } = await supabaseAdmin.rpc("encrypt_app_password", {
          plain_password: site.app_password_encrypted,
          encryption_key: encryptionKey,
        });
        if (encError) {
          console.error(`Failed to encrypt site ${site.id}:`, encError);
          continue;
        }
        await supabaseAdmin.from("sites").update({ app_password_encrypted: encData }).eq("id", site.id);
        migrated++;
      }
    }

    return new Response(JSON.stringify({ success: true, migrated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("migrate-passwords error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
