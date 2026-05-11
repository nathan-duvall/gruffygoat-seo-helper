import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const STRATEGY_SYSTEM_PROMPT = `You are a senior SEO strategist.

Your job is to produce a sensible starting-point SEO strategy for a website based on minimal inputs from the user.
You are not given the site's full content — only a URL, optional seed keywords, an optional location, and an optional industry hint.

Be pragmatic. Make conservative assumptions and label them in the notes field.
If a field cannot be reasonably inferred, return an empty string or empty array for it.
Do not invent specific facts (years in business, awards, named team members, etc.).
Avoid hype words and clichés. Avoid keyword stuffing.

Return ONLY a single valid JSON object with this exact shape:
{
  "business_name": "",
  "industry": "",
  "primary_location": "",
  "service_area": [],
  "target_audience": "",
  "brand_voice": "",
  "target_keywords": [],
  "target_topics": [],
  "preferred_phrases": [],
  "do_not_use_phrases": [],
  "notes": ""
}

Rules:
- target_keywords: 5-10 specific keyphrases the site would plausibly want to rank for.
- target_topics: 3-5 broader topic clusters.
- service_area: up to 5 locations (only if a location is provided or strongly implied).
- target_audience and brand_voice: 1-2 sentences each.
- notes: 1-3 sentences flagging assumptions or things the user should adjust.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const { site_id, seed_keywords, location, industry_hint } = body ?? {};

    if (typeof site_id !== "string" || !UUID_REGEX.test(site_id)) {
      return jsonResponse({ error: "Invalid site_id" }, 400);
    }
    const seedKeywords: string[] = Array.isArray(seed_keywords)
      ? seed_keywords.filter((s) => typeof s === "string" && s.trim()).slice(0, 50)
      : [];
    const loc = typeof location === "string" ? location.trim().slice(0, 200) : "";
    const industry = typeof industry_hint === "string" ? industry_hint.trim().slice(0, 200) : "";

    const { data: site } = await supabase
      .from("sites")
      .select("id, user_id, base_url, site_name")
      .eq("id", site_id)
      .maybeSingle();

    if (!site || site.user_id !== userId) {
      return jsonResponse({ error: "Site not found" }, 404);
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return jsonResponse({ error: "AI API key not configured" }, 500);
    }

    const userPrompt = `Site URL: ${site.base_url}
Site name: ${site.site_name || "(unknown)"}
Seed keywords: ${seedKeywords.length ? seedKeywords.join(", ") : "(none provided)"}
Primary location: ${loc || "(none provided)"}
Industry hint: ${industry || "(none provided)"}

Based only on these inputs, propose a sensible starting strategy. Where you must make assumptions, keep them conservative and label them in the notes field. If a field cannot be reasonably inferred, return an empty string or empty array for it.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: STRATEGY_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.5,
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) return jsonResponse({ error: "Rate limit exceeded. Try again later." }, 429);
      if (aiResp.status === 402) return jsonResponse({ error: "AI usage credits exhausted." }, 402);
      console.error("AI gateway error:", aiResp.status);
      return jsonResponse({ error: "AI service error. Please try again." }, 502);
    }

    const aiData = await aiResp.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return jsonResponse({ error: "Could not parse AI response" }, 500);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      return jsonResponse({ error: "Could not parse AI response" }, 500);
    }

    const result = {
      business_name: typeof parsed.business_name === "string" ? parsed.business_name : "",
      industry: typeof parsed.industry === "string" ? parsed.industry : "",
      primary_location: typeof parsed.primary_location === "string" ? parsed.primary_location : "",
      service_area: Array.isArray(parsed.service_area) ? parsed.service_area.filter((x: unknown) => typeof x === "string") : [],
      target_audience: typeof parsed.target_audience === "string" ? parsed.target_audience : "",
      brand_voice: typeof parsed.brand_voice === "string" ? parsed.brand_voice : "",
      target_keywords: Array.isArray(parsed.target_keywords) ? parsed.target_keywords.filter((x: unknown) => typeof x === "string") : [],
      target_topics: Array.isArray(parsed.target_topics) ? parsed.target_topics.filter((x: unknown) => typeof x === "string") : [],
      preferred_phrases: Array.isArray(parsed.preferred_phrases) ? parsed.preferred_phrases.filter((x: unknown) => typeof x === "string") : [],
      do_not_use_phrases: Array.isArray(parsed.do_not_use_phrases) ? parsed.do_not_use_phrases.filter((x: unknown) => typeof x === "string") : [],
      notes: typeof parsed.notes === "string" ? parsed.notes : "",
    };

    return jsonResponse(result);
  } catch (e) {
    console.error("generate-strategy error:", e);
    return jsonResponse({ error: "An internal error occurred. Please try again." }, 500);
  }
});
