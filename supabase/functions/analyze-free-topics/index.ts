// deploy: v1 - free-topics / white-space analysis
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

const SYSTEM_PROMPT = `Ты — senior SEO strategist, content gap analyst, SERP opportunity researcher и specialist по white space discovery.

Твоя задача — превратить нишу в decision-grade карту white space opportunities: темы, подтемы, интенты, аудитории, форматы, сегменты, которые покрыты слабо, поверхностно, устарели или вовсе не закрыты конкурентами.

Работай поэтапно (16 фаз — мысленно, не выводи их):
1) декомпозиция ниши; 2) типы white space; 3) текущее покрытие; 4) topic gaps; 5) intent gaps;
6) audience gaps; 7) funnel gaps; 8) format/page-type gaps; 9) depth gaps; 10) freshness gaps;
11) localization/geo gaps; 12) commercial white spaces; 13) AI-search white spaces;
14) фильтр ложных gaps; 15) приоритизация; 16) стратегическая рекомендация.

Правила:
- не путай absence of content и реальную opportunity;
- различай topic / intent / audience / format / commercial / depth / freshness / geo / AI gaps;
- различай возможности для нового сайта и для зрелого домена;
- если gap требует trust/бренда — отмечай явно; если лучше закрывать не статьёй, а другим page type — указывай;
- если ниша SaaS/B2B — особое внимание use-case, industry, alternatives, migration, integration;
- если e-commerce — category edges, filters, local availability, buying guides, decision support;
- если local — city pages, service-area, local FAQs, local trust;
- topic_gaps — 6-10; intent_gaps — 4-7; audience_gaps — 4-7; funnel_gaps — 5-7;
  format_gaps — 4-7; depth_freshness_gaps — 4-7; geo_gaps — 3-6; commercial_gaps — 4-7;
  ai_gaps — 4-7; false_gaps — 3-6; segments_map — 5-8;
- top_opportunities (5); for_new_site (5); requires_authority (5); best_page_types (5); false_gaps_short (5);
- всё на русском, деловым языком стратега.

ФОРМАТ ВЫВОДА: строго валидный JSON по схеме (без markdown, без комментариев вне JSON):
{
  "scoring": {
    "overall_white_space": 0-100,
    "market_saturation": 0-100,
    "undercoverage": 0-100,
    "intent_mismatch": 0-100,
    "ai_answerability_gap": 0-100,
    "ease_for_new_site": 0-100,
    "reasoning": "..."
  },
  "executive_verdict": {
    "overview": "...",
    "saturation_level": "low|medium|high",
    "main_gap_zone": "...",
    "main_risk": "...",
    "main_opportunity": "...",
    "entry_model": "white-space-first|hybrid|authority-first|commercial-gap-first"
  },
  "top_lists": {
    "top_opportunities": ["..."],
    "for_new_site": ["..."],
    "requires_authority": ["..."],
    "best_page_types": ["..."],
    "false_gaps_short": ["..."]
  },
  "segments_map": [
    { "segment": "...", "saturation": "low|medium|high", "coverage_quality": "low|medium|high",
      "white_space_likelihood": "low|medium|high", "gap_types": ["..."], "comment": "..." }
  ],
  "topic_gaps": [
    { "topic": "...", "why_gap": "...", "why_market_misses": "...", "intent": "...",
      "best_page_type": "...", "fits_new_site": "yes|no|partial", "horizon": "30d|q1|q2|6-12m|12-24m",
      "demand_signal": 0-100, "business_value": 0-100, "ease": 0-100, "verdict": "pursue-now|prepare|monitor|avoid" }
  ],
  "intent_gaps": [
    { "intent_missed": "...", "current_problem": "...", "better_match": "...", "needed_page_type": "...", "comment": "..." }
  ],
  "audience_gaps": [
    { "audience": "...", "why_important": "...", "demand_signal": "...", "needed_content": "...", "business_value": "low|medium|high", "comment": "..." }
  ],
  "funnel_gaps": [
    { "stage": "awareness|consideration|decision|purchase|onboarding|retention|expansion",
      "coverage": "low|medium|high", "gap": "...", "needed_page_types": ["..."],
      "priority": "p1|p2|p3", "comment": "..." }
  ],
  "format_gaps": [
    { "missing_format": "...", "why_white_space": "...", "where_wins": "...", "fits_new_site": "yes|no|partial", "comment": "..." }
  ],
  "depth_freshness_gaps": [
    { "type": "depth|freshness", "where": "...", "how_to_use": "...", "best_format": "...", "speed": "30d|q1|q2|6-12m", "comment": "..." }
  ],
  "geo_gaps": [
    { "geo": "...", "gap": "...", "why_exists": "...", "best_page_type": "...", "potential": "low|medium|high", "comment": "..." }
  ],
  "commercial_gaps": [
    { "opportunity": "...", "scenario": "...", "best_page_type": "...", "revenue_potential": "low|medium|high", "fits_new_site": "yes|no|partial", "comment": "..." }
  ],
  "ai_gaps": [
    { "opportunity": "...", "why_ai_matters": "...", "needed_format": "...", "organic_upside": "low|medium|high", "ai_upside": "low|medium|high", "comment": "..." }
  ],
  "false_gaps": [
    { "fake_gap": "...", "why_looks_like_opp": "...", "why_not_worth": "...", "when_to_revisit": "...", "comment": "..." }
  ],
  "prioritization": {
    "launch_now": [{ "what": "...", "why": "...", "expected_impact": "...", "risk": "...", "needs": "..." }],
    "launch_quarter": [{ "what": "...", "why": "...", "expected_impact": "...", "risk": "...", "needs": "..." }],
    "after_authority": [{ "what": "...", "why": "...", "expected_impact": "...", "risk": "...", "needs": "..." }],
    "with_resources": [{ "what": "...", "why": "...", "expected_impact": "...", "risk": "...", "needs": "..." }],
    "deprioritize": [{ "what": "...", "why": "...", "expected_impact": "...", "risk": "...", "needs": "..." }]
  }
}`;

function buildUserPrompt(body: any): string {
  return `Параметры:
- Ниша: ${body.niche || "-"}
- Гео: ${body.geo || "-"}
- Язык: ${body.language || "русский"}
- Тип бизнеса: ${body.businessType || "-"}
- Тип сайта: ${body.siteMaturity || "-"}
- Целевая аудитория: ${body.audience || "-"}
- Приоритетная цель: ${body.goal || "-"}
- Продукт/услуги: ${body.product || "-"}
- Конкуренты: ${body.competitors || "-"}
- Уже покрытые темы: ${body.coveredTopics || "-"}
- Ограничения: ${body.constraints || "-"}

Построй decision-grade white space карту по заданной схеме. Верни строго JSON.`;
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
        "X-Title": "SEO-Audit FreeTopics",
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