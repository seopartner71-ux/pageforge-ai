// deploy: v1 - audience segments analysis
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY_ENV = Deno.env.get("OPENROUTER_API_KEY") ?? "";

async function getOpenRouterKey(): Promise<string> {
  if (OPENROUTER_API_KEY_ENV) return OPENROUTER_API_KEY_ENV;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await sb
      .from("system_settings")
      .select("key_value")
      .eq("key_name", "openrouter_api_key")
      .maybeSingle();
    return String((data as any)?.key_value ?? "").trim();
  } catch {
    return "";
  }
}

const SYSTEM_PROMPT = `Ты — principal SEO strategist, audience intelligence analyst, segmentation researcher, JTBD interpreter и specialist по strategic audience mapping.

Твоя задача — превратить размытое "наша ЦА" в decision-grade segmentation map: для SEO, content, architecture, conversion, positioning, monetization, trust и AI-search.

Работай поэтапно (30 фаз — мысленно, не выводи их):
1) что считать meaningful segment; 2) segmentation universe; 3) business relevance; 4) JTBD-сегменты; 5) pain intensity;
6) sophistication/awareness; 7) search behavior; 8) buyer journey; 9) trust requirements; 10) economic profile;
11) use-case; 12) role/stakeholder; 13) geo/maturity; 14) segment-specific problems; 15) language patterns;
16) demand fit; 17) page-fit; 18) conversion-fit; 19) AI-search fit; 20) underserved/overtargeted/false;
21) wedges; 22) compounding structures; 23) feasibility; 24) portfolio; 25) scoring; 26) comparative ranking;
27) sequencing; 28) strategy-model interpretation; 29) verdict; 30) recommendation.

Правила:
- не путай сегмент и persona card, demographic split и strategic segmentation;
- segments — 6-10 главных стратегических сегментов с реальным языком и scoring;
- top_segments — 10; core_targets — 5; high_conversion — 5; underserved — 5; trust_sensitive — 5; overhyped_avoid — 5; recommended_page_types — 5;
- jtbd_segments — 4-6; journey_stages — 5-7; wedges — 3-5;
- всё — на русском, деловым языком стратега.

ФОРМАТ ВЫВОДА: строго валидный JSON по схеме (без markdown, без комментариев вне JSON):
{
  "scoring": {
    "overall_segment_attractiveness": 0-100,
    "market_relevance": 0-100,
    "business_value": 0-100,
    "conversion_fit": 0-100,
    "trust_feasibility": 0-100,
    "ai_opportunity": 0-100,
    "reasoning": "..."
  },
  "executive_verdict": {
    "overview": "...",
    "diversity_level": "low|medium|high",
    "main_risk": "...",
    "main_opportunity": "...",
    "strategy_model": "segment-led|commercial-segment-first|trust-segment-first|wedge-segment-first|AI-segment-first|hybrid"
  },
  "top_lists": {
    "top_segments": ["...","...","...","...","...","...","...","...","...","..."],
    "core_targets": ["...","...","...","...","..."],
    "high_conversion": ["...","...","...","...","..."],
    "underserved": ["...","...","...","...","..."],
    "trust_sensitive": ["...","...","...","...","..."],
    "overhyped_avoid": ["...","...","...","...","..."],
    "recommended_page_types": ["...","...","...","...","..."]
  },
  "segments": [
    {
      "name": "...",
      "type": "JTBD|role|sophistication|use-case|economic|geo|stakeholder|behavior",
      "business_value": 0-100,
      "conversion_fit": 0-100,
      "trust_threshold": 0-100,
      "ai_opportunity": 0-100,
      "feasibility_for_project": 0-100,
      "sophistication": "novice|informed|advanced|expert",
      "knowledge_level": "...",
      "real_language": "...",
      "core_problems": ["...","...","..."],
      "desired_outcomes": ["...","..."],
      "best_page_types": ["...","..."],
      "best_cta": "...",
      "verdict": "pursue-now|prepare|monitor|avoid",
      "comment": "..."
    }
  ],
  "jtbd_segments": [
    { "segment": "...", "job": "...", "search_driven": "low|medium|high", "monetization": "low|medium|high", "best_asset": "..." }
  ],
  "journey_stages": [
    { "stage": "...", "active_segments": ["..."], "most_valuable": ["..."], "needed_assets": ["..."], "business_value": "low|medium|high" }
  ],
  "wedges": [
    { "wedge": "...", "segment": "...", "why_attractive": "...", "needed_assets": ["..."], "fit_for_project": "low|medium|high" }
  ],
  "roadmap": {
    "first_30_days":   { "segments_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "first_quarter":   { "segments_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_6_to_12":  { "segments_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_12_to_24": { "segments_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." }
  }
}`;

function buildUserPrompt(body: any): string {
  return `Параметры:
- Ниша: ${body.niche || "-"}
- Гео: ${body.geo || "-"}
- Язык: ${body.language || "русский"}
- Тип бизнеса: ${body.businessType || "-"}
- Монетизация: ${body.monetization || "-"}
- Продукт/услуги: ${body.product || "-"}
- Известная аудитория / гипотезы: ${body.audience || "-"}
- Приоритетная цель: ${body.goal || "-"}
- Тип сайта: ${body.siteMaturity || "-"}
- Горизонт (мес): ${body.horizon || "-"}

Построй decision-grade audience segmentation map по заданной схеме. Верни строго JSON.`;
}

function extractJson(raw: string): any | null {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sbUser.auth.getUser(token);
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    if (!body?.niche || String(body.niche).trim().length < 2) {
      return new Response(JSON.stringify({ error: "Поле niche обязательно" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const key = await getOpenRouterKey();
    if (!key) {
      return new Response(JSON.stringify({ error: "OpenRouter API key не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seo-modul.pro",
        "X-Title": "SEO-Audit Audience Segments",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        temperature: 0.6,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(body) },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `OpenRouter ${resp.status}: ${t.slice(0, 300)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const report = extractJson(raw);
    if (!report) {
      return new Response(JSON.stringify({ error: "Не удалось распарсить ответ AI", raw }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});