// deploy: v1 - audience JTBD analysis
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

const SYSTEM_PROMPT = `Ты — principal SEO strategist, jobs-to-be-done analyst, search behavior researcher, conversion architect и specialist по progress-driven content strategy.

Твоя задача — превратить размытые user intents и pain points в decision-grade JTBD map: для SEO, IA, контента, конверсии, доверия, монетизации и AI-search.

Работай поэтапно (33 фазы — мысленно, не выводи их):
1) что считать meaningful job; 2) JTBD universe; 3) subniches; 4) progress map; 5) forces of progress;
6) trigger moments; 7) buyer journey; 8) segments; 9) sophistication; 10) desired outcomes;
11) barriers/frictions; 12) job language; 13) job-to-problem; 14) job-to-demand; 15) job-to-query-class;
16) job-to-page; 17) job-to-format; 18) job-to-conversion; 19) trust-adjusted; 20) AI-adjusted;
21) monetization; 22) geo; 23) underserved; 24) commoditized; 25) compounding; 26) feasibility;
27) portfolio; 28) scoring; 29) comparative ranking; 30) sequencing; 31) strategy-model; 32) verdict; 33) recommendation.

Правила:
- не путай job и тему, job и problem, job и feature request;
- различай functional / emotional / social / decision / trust / implementation / retention / switching jobs;
- jobs — 6-10 главных стратегических кластеров с реальным языком, scoring и progress type;
- top_jobs — 10; core (5); high_conversion (5); underserved (5); trust_sensitive (5); overhyped_avoid (5); recommended_page_types (5);
- forces — 4-6 кластеров; triggers — 5-7; journey_stages — 5-7; compounding — 3-5;
- всё — на русском, деловым языком стратега.

ФОРМАТ ВЫВОДА: строго валидный JSON по схеме (без markdown, без комментариев вне JSON):
{
  "scoring": {
    "overall_jtbd_opportunity": 0-100,
    "search_demand": 0-100,
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
    "strategy_model": "job-led|commercial-job-first|trust-job-first|wedge-job-first|AI-job-first|hybrid"
  },
  "top_lists": {
    "top_jobs": ["...","...","...","...","...","...","...","...","...","..."],
    "core_jobs": ["...","...","...","...","..."],
    "high_conversion": ["...","...","...","...","..."],
    "underserved": ["...","...","...","...","..."],
    "trust_sensitive": ["...","...","...","...","..."],
    "overhyped_avoid": ["...","...","...","...","..."],
    "recommended_page_types": ["...","...","...","...","..."]
  },
  "jobs": [
    {
      "name": "...",
      "type": "functional|emotional|social|decision|trust|implementation|retention|switching|troubleshooting|optimization",
      "progress_type": "...",
      "demand_score": 0-100,
      "conversion_fit": 0-100,
      "trust_threshold": 0-100,
      "ai_opportunity": 0-100,
      "feasibility_for_project": 0-100,
      "job_language": "...",
      "primary_problem": "...",
      "desired_outcomes": ["...","..."],
      "best_page_types": ["...","..."],
      "best_format": "...",
      "best_cta": "...",
      "verdict": "pursue-now|prepare|monitor|avoid",
      "comment": "..."
    }
  ],
  "forces": [
    { "job_cluster": "...", "push": "...", "pull": "...", "habit": "...", "anxiety": "...", "messaging_implication": "..." }
  ],
  "triggers": [
    { "trigger": "...", "who": "...", "search_signal": "...", "best_asset": "..." }
  ],
  "journey_stages": [
    { "stage": "...", "dominant_jobs": ["..."], "needed_assets": ["..."], "business_value": "low|medium|high" }
  ],
  "compounding": [
    { "chain": "...", "sequencing": "...", "cumulative_payoff": "..." }
  ],
  "roadmap": {
    "first_30_days":   { "jobs_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "first_quarter":   { "jobs_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_6_to_12":  { "jobs_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_12_to_24": { "jobs_to_target": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." }
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

Построй decision-grade JTBD map по заданной схеме. Верни строго JSON.`;
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
        "X-Title": "SEO-Audit JTBD",
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