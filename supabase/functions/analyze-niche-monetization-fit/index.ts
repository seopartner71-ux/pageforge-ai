// deploy: v1 - niche monetization fit analysis via OpenRouter
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

const SYSTEM_PROMPT = `Ты — senior SEO strategist, niche economics analyst, monetization model evaluator и specialist по revenue-fit assessment.

Твоя задача — decision-grade monetization fit map ниши. Разделяй traffic potential, conversion potential и monetization fit. Не путай высокий спрос с хорошей монетизацией. Пиши на русском, конкретно, без воды.

Внутри (не выводи) пройди 19 фаз анализа: monetization scope, декомпозиция по monetization segments, monetization model fit comparison, demand-to-revenue alignment, conversion path complexity, value density, willingness-to-pay и urgency, trust-to-monetization dependency, page-type fit, business-model-specific fit, retention/repeatability, monetization wedges, low-fit zones, competitor monetization landscape, AI-search implications, resource-fit, scoring model, strategic interpretation, final recommendation.

Правила:
- различай one-time / recurring / repeat / affiliate / ad monetization;
- различай monetization fit для нового сайта и для зрелого бренда;
- если trust required for monetization is high — учитывай это как core factor;
- если ниша B2B/SaaS/e-commerce/affiliate/media/local — усиливай соответствующую логику;
- не советуй heavy traffic strategy там, где money layer узок;
- если ниша слишком широкая — разбей на подниши и оцени по каждой.

ФОРМАТ ВЫВОДА: строго валидный JSON, без markdown, без пояснений вне JSON:
{
  "executive_verdict": {
    "niche_monetizability": "weak|moderate|strong|excellent",
    "chosen_model_fit": "poor|weak|moderate|strong|excellent",
    "main_risk": "...",
    "main_opportunity": "...",
    "recommended_model": "leads|subscription|sales|affiliate|ads|demo|consultation|booking|marketplace-fee|hybrid",
    "launch_mode": "lead-gen-first|subscription-first|affiliate-first|commerce-first|hybrid|authority-first-then-monetize",
    "recommendation": "go|pivot-model|phased|selective|no-go",
    "verdict_summary": "..."
  },
  "monetization_scope": {
    "success_definition": "...",
    "revenue_logic": "one-time|recurring|repeat|blended|hybrid",
    "volume_vs_value": "high-volume-low-value|low-volume-high-value|balanced",
    "assumptions": ["...", "..."],
    "comment": "..."
  },
  "monetization_segments": [
    { "segment": "...", "queries": ["..."], "intent": "...", "seo_value": "High|Med|Low", "monetization_strength": "High|Med|Low", "conversion_proximity": "High|Med|Low", "fits_chosen_model": true, "comment": "..." }
  ],
  "model_fit_comparison": [
    { "model": "leads|subscription|sales|affiliate|ads|demo|consultation|booking|marketplace-fee|hybrid", "fit": "poor|weak|moderate|strong|excellent", "important_intents": "...", "required_page_types": "...", "pros": "...", "limits": "...", "comment": "..." }
  ],
  "demand_revenue_alignment": [
    { "segment": "...", "demand_level": "Low|Med|High", "demand_quality": "Low|Med|High", "willingness_to_pay": "Low|Med|High", "conversion_friction": "Low|Med|High", "revenue_density": "Low|Med|High", "alignment": "strong|moderate|weak|misleading|hidden-opportunity", "comment": "..." }
  ],
  "conversion_path": [
    { "segment": "...", "complexity": "simple|moderate|complex", "friction_points": "...", "key_pages": "...", "how_to_shorten": "...", "comment": "..." }
  ],
  "trust_willingness": [
    { "segment": "...", "trust_dependency": "Low|Med|High", "willingness_to_pay": "Low|Med|High", "urgency": "Low|Med|High", "required_assets": "...", "comment": "..." }
  ],
  "page_type_fit": [
    { "page_type": "...", "direct_monetization": "Low|Med|High", "indirect_support": "Low|Med|High", "intent_covered": "...", "fits_chosen_model": true, "fits_new_site": true, "comment": "..." }
  ],
  "retention_layer": [
    { "segment": "...", "has_recurring": true, "retention_strength": "Low|Med|High", "ltv_impact": "...", "needs_seo_layer": true, "comment": "..." }
  ],
  "monetization_wedges": [
    { "wedge": "...", "why_strong_fit": "...", "best_page_type": "...", "fits_new_site": true, "horizon": "30d|q1|q2|6-12m|12-24m", "monetization_type": "leads|sales|subscriptions|commission|retention", "comment": "..." }
  ],
  "low_fit_zones": [
    { "topic": "...", "why_looks_attractive": "...", "why_weak_fit": "...", "use_as_support": true, "comment": "..." }
  ],
  "competitor_landscape": [
    { "observation": "...", "strength": "...", "weakness": "...", "how_to_use": "...", "fits_new_site": true, "comment": "..." }
  ],
  "ai_search_impact": {
    "vulnerable_segments": "...",
    "resilient_segments": "...",
    "page_types_to_strengthen": "...",
    "impact_on_chosen_model": "...",
    "needs_dual_strategy": true,
    "comment": "..."
  },
  "resource_fit": {
    "feasibility": "low|moderate|high",
    "bottlenecks": ["..."],
    "simplifications": ["..."],
    "lean_version": "...",
    "comment": "..."
  },
  "scores": {
    "demand_quality": 0-100,
    "high_intent_density": 0-100,
    "willingness_to_pay": 0-100,
    "conversion_path_simplicity": 0-100,
    "trust_conversion_feasibility": 0-100,
    "value_density": 0-100,
    "repeatability_retention": 0-100,
    "business_model_fit": 0-100,
    "page_type_fit": 0-100,
    "resource_fit": 0-100,
    "ai_resilience": 0-100,
    "false_opportunity_penalty": 0-100,
    "competition_monetization_pressure": 0-100,
    "segment_wedge_opportunity": 0-100,
    "overall_niche_monetization_fit": 0-100,
    "chosen_model_fit": 0-100,
    "best_alternative_model_fit": 0-100,
    "easiest_to_monetize_segment": 0-100,
    "hardest_to_monetize_segment": 0-100,
    "traffic_to_revenue_efficiency": 0-100,
    "long_term_stability": 0-100,
    "risk_adjusted_attractiveness": 0-100,
    "reasoning": "..."
  },
  "interpretation": {
    "category": "weak|traffic-friendly-monetization-weak|viable-focused|strong-fit|strong-resource-intensive|excellent-chosen|better-alt-model",
    "meaning": "...",
    "fits_project_type": "...",
    "does_not_fit": "...",
    "optimal_strategy": "...",
    "avoid": ""
  },
  "final_recommendation": {
    "top_5_segments": ["...","...","...","...","..."],
    "top_5_page_types": ["...","...","...","...","..."],
    "top_5_wedges": ["...","...","...","...","..."],
    "top_5_low_fit": ["...","...","...","...","..."],
    "top_5_mistakes": ["...","...","...","...","..."],
    "launch_mode": "lead-gen-first|subscription-first|affiliate-first|commerce-first|hybrid|authority-first-then-monetize",
    "phased_plan": "...",
    "kpi_3_6_12_24": "..."
  }
}`;

function buildUserPrompt(b: any): string {
  return `Параметры проекта:
- Ниша: ${b.niche || "-"}
- Гео: ${b.geo || "-"}
- Язык: ${b.language || "русский"}
- Тип бизнеса: ${b.businessType || "-"}
- Рассматриваемая модель монетизации: ${b.monetizationModel || "-"}
- Альтернативные модели: ${b.alternativeModels || "-"}
- Продукт / услуги / категории: ${b.product || "-"}
- Целевая аудитория: ${b.audience || "-"}
- Приоритетная цель: ${b.goal || "-"}
- Тип сайта: ${b.siteMaturity || "-"}
- Средний чек / LTV / recurring / commission: ${b.economics || "-"}
- Точки конверсии: ${b.conversionPoints || "-"}
- Конкуренты: ${b.competitors || "-"}
- Ограничения: ${b.constraints || "-"}

Проведи полный decision-grade monetization fit анализ. Верни JSON строго по заданной схеме.`;
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
        "X-Title": "SEO-Audit Niche Monetization Fit",
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