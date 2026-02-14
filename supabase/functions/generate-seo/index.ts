import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isLikelyNonEnglish(text: string): boolean {
  const nonLatinRatio = (text.match(/[^\x00-\x7F]/g) || []).length / text.length;
  return nonLatinRatio > 0.3;
}

const SEO_SYSTEM_PROMPT = `You are an expert SEO metadata generator. You produce STRICT JSON output only.

Rules:
- Generate exactly ONE result per request
- focus_keyphrase: 2-4 word phrase that captures the core topic
- seo_title: 50-60 characters (hard max 65), include focus keyphrase naturally
- meta_description: 140-160 characters (hard max 170), include focus keyphrase naturally
- Tone: clear, intent-aligned, trustworthy, mildly conversion-aware
- NEVER use hype words, exclamation points, or emojis
- NEVER provide multiple options
- If a seed keyword is provided and aligned with content, use it as the focus keyphrase
- If seed keyword is misaligned, warn and choose a better keyphrase
- If content is too short or empty, return status "INSUFFICIENT_CONTENT"

Return ONLY this JSON structure:
{
  "status": "OK" or "INSUFFICIENT_CONTENT",
  "focus_keyphrase": "...",
  "seo_title": "...",
  "meta_description": "...",
  "warnings": ["..."],
  "notes": "..."
}`;

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

    const { items, site_id, seo_plugin, existing_suggestions } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("AI API key not configured");

    const results: any[] = [];
    let totalTokensEstimate = 0;

    for (const item of items) {
      const cleanContent = stripHtml(item.content || "");
      const cleanExcerpt = stripHtml(item.excerpt || "");
      const cleanTitle = stripHtml(item.post_title || "");

      if (isLikelyNonEnglish(cleanContent)) {
        results.push({
          post_id: item.post_id,
          status: "INSUFFICIENT_CONTENT",
          warnings: ["Content appears to be non-English. Skipped."],
        });
        continue;
      }

      const contentDigest = cleanContent.substring(0, 2000);
      const seedNote = item.seed_keyword ? `\nSeed keyword provided by user: "${item.seed_keyword}"` : "";
      const existingNote = existing_suggestions?.length
        ? `\nExisting keyphrases/titles in this batch (avoid duplicates): ${JSON.stringify(existing_suggestions.map((s: any) => ({ focus: s.suggested_focus, title: s.suggested_title })))}`
        : "";

      const userPrompt = `Generate SEO metadata for this page:

Title: ${cleanTitle}
Excerpt: ${cleanExcerpt.substring(0, 300)}
Content (truncated): ${contentDigest}
${seedNote}${existingNote}

SEO Plugin: ${seo_plugin}
Generate focus_keyphrase, seo_title, and meta_description.`;

      try {
        const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SEO_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            temperature: 0.2,
          }),
        });

        if (!aiResp.ok) {
          if (aiResp.status === 429) {
            results.push({ post_id: item.post_id, status: "error", error_code: "RATE_LIMIT", error_message: "Rate limit exceeded. Try again later." });
            continue;
          }
          if (aiResp.status === 402) {
            results.push({ post_id: item.post_id, status: "error", error_code: "PAYMENT_REQUIRED", error_message: "AI usage credits exhausted." });
            continue;
          }
          const errText = await aiResp.text();
          results.push({ post_id: item.post_id, status: "error", error_code: "AI_ERROR", error_message: errText.substring(0, 300) });
          continue;
        }

        const aiData = await aiResp.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        totalTokensEstimate += (aiData.usage?.total_tokens || 500);

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ post_id: item.post_id, status: "error", error_code: "JSON_PARSE", error_message: "Could not parse AI response as JSON" });
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        results.push({
          post_id: item.post_id,
          ...parsed,
        });
      } catch (e) {
        results.push({
          post_id: item.post_id,
          status: "error",
          error_code: "AI_EXCEPTION",
          error_message: e instanceof Error ? e.message : "Unknown AI error",
        });
      }
    }

    // Track usage
    const estimatedCost = (totalTokensEstimate / 1000) * 0.0001; // rough estimate
    await supabase.from("api_usage").insert({
      user_id: userId,
      site_id,
      api_calls: items.length,
      estimated_tokens: totalTokensEstimate,
      estimated_cost: estimatedCost,
    });

    return new Response(JSON.stringify({ results, tokens_used: totalTokensEstimate, estimated_cost: estimatedCost }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-seo error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
