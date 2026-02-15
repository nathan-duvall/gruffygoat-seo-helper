import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// --- Input Validation ---
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_SEO_PLUGINS = ["yoast", "rankmath"];
const MAX_ITEMS = 50;

function validateUUID(id: unknown): id is string {
  return typeof id === "string" && UUID_REGEX.test(id);
}

function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

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

const SEO_SYSTEM_PROMPT = `You are a senior SEO strategist and technical QA lead.

You generate metadata with the rigor of an experienced agency reviewer.

Your recommendations must align with Google's documented guidance and modern search realities, including:
- Search intent alignment
- On-page optimization best practices
- Entity clarity and topic focus
- Local SEO signals when applicable
- E-E-A-T considerations
- CTR optimization without clickbait
- Risk-aware, non-spammy language

When evaluating content:
1. Identify the true primary search intent.
2. Determine the most valuable focus keyphrase based on:
   - Topic prominence
   - Geo signals (if present)
   - Recurring content patterns (e.g., police blotter, roundup, weekly recap)
3. Avoid vague filler phrases like:
   - "recent incidents"
   - "latest updates"
   - "local events"
4. Prefer specificity and distinctive hooks when appropriate.
5. Preserve strong editorial headlines unless misaligned with search intent.
6. Never keyword-stuff.

Content type detection:
- If the content is a recurring news or roundup format, optimize for CTR in news results.
- If it is a local service page, prioritize geo-modified intent terms.
- If it is evergreen informational content, prioritize clarity and entity alignment.
- If it is product or transactional content, prioritize conversion-aligned phrasing.

Focus keyphrase requirements:
- 2–4 words
- Clear intent
- Not overly broad
- Not overly long
- Avoid redundant modifiers

SEO title requirements:
- 50–60 characters (hard max 65)
- Include focus keyphrase naturally
- Front-load geo + primary term when appropriate
- Avoid generic language
- Preserve editorial tone

Meta description requirements:
- 140–160 characters (hard max 170)
- Reflect true content
- Improve clarity and click-through
- Avoid hype or exaggerated claims
- Avoid vague generalizations

If content quality is insufficient for confident metadata generation, return:
{
  "status": "INSUFFICIENT_CONTENT",
  "focus_keyphrase": "",
  "seo_title": "",
  "meta_description": "",
  "warnings": ["Content insufficient for confident optimization"],
  "notes": ""
}

Otherwise return ONLY valid JSON in this structure:
{
  "status": "OK",
  "focus_keyphrase": "...",
  "seo_title": "...",
  "meta_description": "...",
  "warnings": [],
  "notes": ""
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

    // --- Validate inputs ---
    if (!validateUUID(site_id)) return badRequest("Invalid site_id format.");
    if (typeof seo_plugin !== "string" || !VALID_SEO_PLUGINS.includes(seo_plugin)) {
      return badRequest("Invalid seo_plugin. Must be 'yoast' or 'rankmath'.");
    }
    if (!Array.isArray(items) || items.length === 0) {
      return badRequest("Items must be a non-empty array.");
    }
    if (items.length > MAX_ITEMS) {
      return badRequest(`Too many items. Maximum is ${MAX_ITEMS}.`);
    }
    // Validate each item has required fields
    for (const item of items) {
      if (typeof item.post_id !== "number" || item.post_id <= 0) {
        return badRequest("Each item must have a valid numeric post_id.");
      }
    }
    if (existing_suggestions !== undefined && !Array.isArray(existing_suggestions)) {
      return badRequest("existing_suggestions must be an array.");
    }

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
      const seedNote = item.seed_keyword ? `\nSeed keyword provided by user: "${String(item.seed_keyword).substring(0, 100)}"` : "";
      const existingNote = existing_suggestions?.length
        ? `\nExisting keyphrases/titles in this batch (avoid duplicates): ${JSON.stringify(existing_suggestions.slice(0, 100).map((s: any) => ({ focus: s.suggested_focus, title: s.suggested_title })))}`
        : "";

      const userPrompt = `Analyze the following content and internally determine:
- Primary search intent
- Content type (news, roundup, service page, evergreen guide, product, blog commentary)

Then generate metadata accordingly.

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
            temperature: 0.4,
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
          console.error(`AI API error for post ${item.post_id}: status ${aiResp.status}`);
          results.push({ post_id: item.post_id, status: "error", error_code: "AI_ERROR", error_message: "AI service error. Please try again." });
          continue;
        }

        const aiData = await aiResp.json();
        const content = aiData.choices?.[0]?.message?.content || "";
        totalTokensEstimate += (aiData.usage?.total_tokens || 500);

        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          results.push({ post_id: item.post_id, status: "error", error_code: "JSON_PARSE", error_message: "Could not parse AI response" });
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);
        results.push({
          post_id: item.post_id,
          ...parsed,
        });
      } catch (e) {
        console.error(`AI exception for post ${item.post_id}:`, e);
        results.push({
          post_id: item.post_id,
          status: "error",
          error_code: "AI_EXCEPTION",
          error_message: "AI processing failed. Please try again.",
        });
      }
    }

    const estimatedCost = (totalTokensEstimate / 1000) * 0.0001;
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
    return new Response(JSON.stringify({ error: "An internal error occurred. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
