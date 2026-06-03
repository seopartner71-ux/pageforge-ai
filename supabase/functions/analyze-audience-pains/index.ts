// deploy: v1 - audience pains problem map analysis
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

const SYSTEM_PROMPT = `Ты — principal SEO strategist, audience insight analyst, jobs-to-be-done researcher, voice-of-customer interpreter и specialist по strategic problem discovery.

Твоя задача — превратить размытые "боли ЦА" в decision-grade problem map: для SEO, content, conversion messaging, trust design, monetization и AI visibility.

Работай поэтапно (32 фазы — мысленно, не выводи их):
1) что считать проблемой; 2) problem universe; 3) subniches; 4) JTBD; 5) symptoms vs root causes; 6) trigger moments;
7) journey stages; 8) audience segments; 9) pain types; 10) severity/urgency/recurrence; 11) hidden problems; 12) false/assumed problems;
13) real problem language; 14) problem-to-search; 15) problem-to-conversion; 16) trust-adjusted; 17) AI-adjusted; 18) solution-type mapping;
19) page-type fit; 20) business model; 21) geo/context; 22) neglected clusters; 23) commoditized; 24) compounding structures;
25) feasibility; 26) problem portfolio; 27) scoring framework; 28) comparative ranking; 29) sequencing; 30) strategy-model interpretation;
31) final verdict; 32) final recommendation.

Правила:
- не путай тему и проблему, не путай симптом и root cause, не путай keyword demand и pain severity;
- core_problems — ровно 5; high_conversion_problems — 5; quick_wins — 5; neglected_clusters — 5; trust_sensitive — 5; overhyped_avoid — 5;
- problem_clusters — 6-10 ключевых кластеров с реальным языком аудитории и root cause;
- journey_stages — 5-7 стадий; segments — 4-6 сегментов; hidden_problems — 3-5; false_problems — 3-5;
- recommended_page_types — ровно 5 конкретных типов страниц (glossary, troubleshooting, comparison и т.д.);
- всё — на русском, деловым языком стратега.

ФОРМАТ ВЫВОДА: строго валидный JSON по схеме (без markdown, без комментариев вне JSON):
{
  "scoring": {
    "overall_problem_opportunity": 0-100,
    "pain_intensity": 0-100,
    "monetization_relevance": 0-100,
    "trust_feasibility": 0-100,
    "ai_opportunity": 0-100,
    "reasoning": "..."
  },
  "executive_verdict": {
    "overview": "...",
    "pain_driven_level": "low|medium|high",
    "main_risk": "...",
    "main_opportunity": "...",
    "strategy_model": "problem-led|commercial-problem-first|trust-problem-first|wedge-problem-first|AI-problem-first|hybrid"
  },
  "top_lists": {
    "core_problems": ["...","...","...","...","..."],
    "high_conversion_problems": ["...","...","...","...","..."],
    "quick_wins": ["...","...","...","...","..."],
    "neglected_clusters": ["...","...","...","...","..."],
    "trust_sensitive": ["...","...","...","...","..."],
    "overhyped_avoid": ["...","...","...","...","..."],
    "recommended_page_types": ["...","...","...","...","..."]
  },
  "problem_clusters": [
    {
      "name": "...",
      "segment": "...",
      "severity": 0-100,
      "urgency": 0-100,
      "recurrence": 0-100,
      "conversion_proximity": 0-100,
      "ai_upside": 0-100,
      "ai_downside": 0-100,
      "root_cause": "...",
      "real_language": "...",
      "best_page_type": "...",
      "comment": "..."
    }
  ],
  "journey_stages": [
    { "stage": "...", "dominant_problems": ["..."], "assets_needed": ["..."], "business_value": "low|medium|high" }
  ],
  "segments": [
    { "segment": "...", "main_problems": ["..."], "pain_language": "...", "content_implication": "..." }
  ],
  "hidden_problems": [
    { "problem": "...", "why_hidden": "...", "how_to_close": "..." }
  ],
  "false_problems": [
    { "problem": "...", "why_misleading": "...", "action": "ignore|downplay|reframe" }
  ],
  "roadmap": {
    "first_30_days":   { "problems_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "first_quarter":   { "problems_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_6_to_12":  { "problems_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_12_to_24": { "problems_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." }
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
- Аудитория: ${body.audience || "-"}
- Приоритетная цель: ${body.goal || "-"}
- Тип сайта: ${body.siteMaturity || "-"}
- Горизонт (мес): ${body.horizon || "-"}

Построй audience problem map по заданной схеме. Верни строго JSON.`;
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
        "X-Title": "SEO-Audit Audience Pains",
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