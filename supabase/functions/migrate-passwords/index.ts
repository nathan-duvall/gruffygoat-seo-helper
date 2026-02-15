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
    // This is an admin-only one-time migration function
    // Verify caller has service role key
    const authHeader = req.headers.get("Authorization");
    
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const encryptionKey = Deno.env.get("WP_ENCRYPTION_KEY");
    if (!encryptionKey) throw new Error("Encryption key not configured");

    // Get ALL sites
    const { data: sites, error: fetchErr } = await supabaseAdmin
      .from("sites")
      .select("id, app_password_encrypted");

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
        const { error: updErr } = await supabaseAdmin.from("sites").update({ app_password_encrypted: encData }).eq("id", site.id);
        if (updErr) {
          console.error(`Failed to update site ${site.id}:`, updErr);
          continue;
        }
        migrated++;
      }
    }

    return new Response(JSON.stringify({ success: true, migrated, total: (sites || []).length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("migrate-passwords error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
