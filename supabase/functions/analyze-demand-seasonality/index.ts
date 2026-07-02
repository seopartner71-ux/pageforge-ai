// deploy: v1 - demand seasonality analysis via OpenRouter
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
      .from("system_settings").select("key_value")
      .eq("key_name", "openrouter_api_key").maybeSingle();
    return String((data as any)?.key_value ?? "").trim();
  } catch { return ""; }
}

const SYSTEM_PROMPT = `Ты — senior SEO strategist, search demand analyst и seasonal behavior researcher.

Задача — decision-grade анализ сезонности ниши. Отдели evergreen от cyclical, cyclical от event-driven, event-driven от краткосрочных шумов. Не путай traffic seasonality и conversion seasonality. Пиши на русском, конкретно, без воды.

Внутри (не выводи) пройди 15 фаз: декомпозиция ниши по сезонным сегментам; тип сезонности каждого кластера; карта сезонности по времени (месяцы/кварталы/недели); сезонность по интентам; сезонность по аудиториям; влияние внешних факторов (праздники, погода, финансовые/учебные календари, event calendar, distribution shifts); отделение устойчивых паттернов от шума; seasonal content map по типам страниц; lead time; evergreen core vs seasonal layers; сезонность по гео; риски seasonal SEO; editorial calendar; business impact layer; final strategic recommendation.

Правила:
- различай evergreen / annual / quarterly / monthly / weekly / holiday-driven / event-driven / weather-driven / market-cycle / regulation-driven / launch-driven / news-driven / short spike / recurring spike / mixed;
- различай pre-season, growth, peak, decline, off-season, вторичный пик, long tail;
- если B2B — учитывай budget cycles, procurement, planning windows, отчётные периоды;
- если e-commerce — учитывай sales seasons, gifting, category timing, inventory, promo windows;
- если local-heavy — учитывай климат, локальные события, local pack;
- если news-sensitive — различай recurring seasonality и unpredictable spikes;
- если AI Overviews режут informational CTR — явно помечай уязвимые кластеры;
- если сезонность слабая — не преувеличивай;
- если вне сезона есть research demand — покажи это как окно раннего входа;
- lead time всегда указывай в неделях/месяцах;
- всегда различай traffic seasonality и conversion seasonality.

ФОРМАТ ВЫВОДА: строго валидный JSON, без markdown, без пояснений вне JSON:
{
  "executive_verdict": {
    "overall_seasonality": "none|low|moderate|high|very-high",
    "predictability": "low|moderate|high",
    "has_strong_peaks": true,
    "main_risk": "...",
    "main_opportunity": "...",
    "planning_model": "evergreen-first|seasonal-first|hybrid",
    "verdict_summary": "..."
  },
  "seasonality_map_by_segment": [
    { "segment": "...", "queries": ["..."], "intent": "...", "seasonality_type": "evergreen|annual|quarterly|monthly|weekly|holiday-driven|event-driven|weather-driven|market-cycle|regulation-driven|launch-driven|news-driven|short-spike|recurring-spike|mixed", "peak_periods": "...", "decline_periods": "...", "seo_value": "High|Med|Low", "business_value": "High|Med|Low", "comment": "..." }
  ],
  "time_based_map": [
    { "cluster": "...", "pre_season": "...", "growth_phase": "...", "peak": "...", "decline": "...", "off_season": "...", "secondary_peak": "...", "comment": "..." }
  ],
  "monthly_intensity": [
    { "month": "Янв", "intensity": 0-100 }, { "month": "Фев", "intensity": 0-100 }, { "month": "Мар", "intensity": 0-100 }, { "month": "Апр", "intensity": 0-100 }, { "month": "Май", "intensity": 0-100 }, { "month": "Июн", "intensity": 0-100 }, { "month": "Июл", "intensity": 0-100 }, { "month": "Авг", "intensity": 0-100 }, { "month": "Сен", "intensity": 0-100 }, { "month": "Окт", "intensity": 0-100 }, { "month": "Ноя", "intensity": 0-100 }, { "month": "Дек", "intensity": 0-100 }
  ],
  "seasonality_by_intent": [
    { "intent": "informational|commercial|transactional|local|comparison|support|urgent", "seasonality_strength": "Low|Med|High", "growth_starts": "...", "conversion_peak": "...", "best_page_type": "...", "comment": "..." }
  ],
  "external_drivers": [
    { "factor": "...", "affected_clusters": "...", "impact_strength": "Low|Med|High", "recurrence": "regular|irregular|one-off", "how_to_use": "...", "comment": "..." }
  ],
  "signal_vs_noise": [
    { "pattern": "...", "classification": "stable-recurring|likely-recurring|situational|random-spike|uncertain-trend|overrated", "action": "build-dedicated-page|refresh-existing|monitor|ignore|invest-long-term", "comment": "..." }
  ],
  "evergreen_vs_seasonal": {
    "evergreen_core": ["..."],
    "seasonal_support": ["..."],
    "event_pages": ["..."],
    "annual_refresh": ["..."],
    "opportunistic_trend": ["..."],
    "architecture_comment": "..."
  },
  "lead_time": [
    { "cluster": "...", "publish_window": "1-2 weeks|1 month|2-3 months|4-6 months|6-12 months", "update_window": "...", "internal_linking_window": "...", "cta_window": "...", "expected_effect": "...", "comment": "..." }
  ],
  "geo_differences": [
    { "geo": "...", "shift": "...", "different_topics": "...", "needs_local_adaptation": true, "comment": "..." }
  ],
  "risks": [
    { "risk": "...", "probability": "Low|Med|High", "impact": "Low|Med|High", "prevention": "...", "do_instead": "..." }
  ],
  "editorial_calendar": {
    "next_30_days": ["..."],
    "next_90_days": ["..."],
    "next_6_months": ["..."],
    "evergreen_maintain": ["..."],
    "annual_refresh": ["..."]
  },
  "business_impact": [
    { "cluster": "...", "traffic_potential": "Low|Med|High", "lead_potential": "Low|Med|High", "sales_potential": "Low|Med|High", "authority_potential": "Low|Med|High", "ai_visibility_potential": "Low|Med|High", "comment": "..." }
  ],
  "final_recommendation": {
    "planning_model": "evergreen-first|seasonal-first|hybrid",
    "top_5_seasonal_clusters": ["...","...","...","...","..."],
    "top_5_evergreen_clusters": ["...","...","...","...","..."],
    "top_5_publish_early": ["...","...","...","...","..."],
    "top_5_pages_to_refresh_yearly": ["...","...","...","...","..."],
    "top_5_mistakes": ["...","...","...","...","..."],
    "phased_plan": "...",
    "kpi_3_6_12": "..."
  }
}`;

function buildUserPrompt(b: any): string {
  return `Параметры проекта:
- Ниша: ${b.niche || "-"}
- Гео: ${b.geo || "-"}
- Язык: ${b.language || "русский"}
- Тип бизнеса: ${b.businessType || "-"}
- Тип сайта: ${b.siteMaturity || "-"}
- Целевая аудитория: ${b.audience || "-"}
- Приоритетная цель: ${b.goal || "-"}
- Горизонт планирования: ${b.horizon || "12"} мес
- Продуктовые категории / направления: ${b.categories || "-"}
- Регионы: ${b.regions || "-"}
- Важные события / праздники: ${b.events || "-"}
- Ограничения команды: ${b.constraints || "-"}

Проведи полный decision-grade seasonality анализ. Верни JSON строго по схеме.`;
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
        "X-Title": "SEO-Audit Demand Seasonality",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
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