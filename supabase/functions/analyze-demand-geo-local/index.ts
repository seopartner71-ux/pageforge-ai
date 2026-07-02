// deploy: v1 - geo & local opportunities analysis via OpenRouter
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

const SYSTEM_PROMPT = `Ты — senior SEO strategist, international SEO analyst, local search researcher и specialist по geo-intent mapping.

Задача — decision-grade анализ географических и локальных SEO-возможностей ниши. Отдели country/region/city/locale-level возможности. Различай перевод и локализацию, local intent и national intent, спрос и конверсию. Пиши на русском, конкретно, без воды.

Внутри (не выводи) пройди 15 фаз: уровень геозависимости; декомпозиция по гео-сегментам; сравнение спроса по странам/регионам/городам; локальные различия в языке и терминологии; локальный поисковый интент; локальная SERP-среда; локальные барьеры входа; geo-specific возможности; архитектурные последствия; локализация vs перевод; приоритизация рынков; local trust и конверсия; AI-search в локальном контексте; риски geo-стратегии; финальная стратегия.

Правила:
- различай country / region / city / locale;
- различай перевод и полноценную локализацию (примеры, валюта, юридика, CTA);
- различай implicit local intent (без модификатора) и explicit local queries;
- учитывай local pack, directories, marketplaces, government домены;
- если ниша remote-friendly — не преувеличивай local factor;
- если ниша local-heavy — усиль анализ location pages, reviews, NAP, citations;
- если multilingual — раздели country strategy, language strategy и locale strategy;
- если e-commerce — учти доставку, availability, pricing, регуляторику;
- если B2B — определи где local trust реально важен, а где спрос national/global;
- если regulation / licensing критично — явно помечай;
- не предлагай thin city pages без реальной ценности;
- различай traffic potential и conversion potential.

ФОРМАТ ВЫВОДА: строго валидный JSON, без markdown, без пояснений вне JSON:
{
  "executive_verdict": {
    "geo_dependency": "none|low|moderate|high|very-high",
    "local_seo_importance": "low|moderate|high|critical",
    "localization_importance": "translation-only|light-localization|deep-localization|full-market-adaptation",
    "top_geos": ["..."],
    "main_barrier": "...",
    "main_opportunity": "...",
    "launch_model": "local-first|national-first|international-first|hybrid",
    "verdict_summary": "..."
  },
  "geo_dependency_map": [
    { "geo": "...", "demand_type": "informational|commercial|transactional|mixed|local", "primary_intent": "...", "geo_dependency_level": "none|low|moderate|high|very-high", "seo_value": "High|Med|Low", "business_value": "High|Med|Low", "comment": "..." }
  ],
  "demand_by_geo": [
    { "geo": "...", "demand_level": "Low|Med|High|Very-High", "commercial_potential": "Low|Med|High", "competition_level": "Low|Med|High|Very-High", "required_localization": "none|light|deep|full", "priority": "tier-1|tier-2|tier-3|low", "comment": "..." }
  ],
  "language_locale_variations": [
    { "term_or_phrase": "...", "used_in": "...", "who_uses_it": "...", "seo_significance": "Low|Med|High", "requires_separate_adaptation": true, "comment": "..." }
  ],
  "local_intent_map": [
    { "intent_type": "informational-local|commercial-local|transactional-local|near-me|city-modified|region-modified|country-modified|implicit-local|remote-friendly|hybrid", "strongest_in": "...", "pages_needed": "...", "local_trust_required": "Low|Med|High", "comment": "..." }
  ],
  "local_serp_patterns": [
    { "geo": "...", "serp_archetype": "local-pack-dominant|directory-dominant|marketplace-dominant|national-brand-dominant|community-dominant|government-dominant|mixed|open", "who_dominates": "...", "winning_page_types": "...", "newcomer_openness": "closed|hard|moderate|open", "comment": "..." }
  ],
  "entry_barriers_by_geo": [
    { "barrier": "...", "most_affected_geos": "...", "criticality": "Low|Med|High|Critical", "bypassable": true, "how_to_bypass": "..." }
  ],
  "geo_opportunity_windows": [
    { "opportunity": "...", "why_it_exists": "...", "best_page_type": "...", "fit_for_site": "new|weak|mid|strong|any", "horizon": "short|mid|long", "primary_outcome": "traffic|leads|sales|authority|ai-visibility" }
  ],
  "architecture_implications": {
    "when_country_pages": "...",
    "when_regional_pages": "...",
    "when_city_pages": "...",
    "when_location_pages": "...",
    "when_language_versions": "...",
    "when_universal_content": "...",
    "main_architecture_risks": ["..."]
  },
  "localization_vs_translation": [
    { "geo_or_locale": "...", "translation_enough": true, "needs_rewrite": true, "elements_to_adapt": ["examples","cases","currency","units","legal","cta","social-proof","delivery","availability","titles","urls","faq","schema","anchors"], "comment": "..." }
  ],
  "market_prioritization": [
    { "geo": "...", "priority": "tier-1|tier-2|tier-3|low", "why": "...", "launch_first": "...", "defer": "..." }
  ],
  "local_trust_and_conversion": [
    { "geo": "...", "trust_signals_needed": ["reviews","address","license","cases","photos","local-experts","local-prices","local-availability"], "impact_on_conversion": "Low|Med|High", "impact_on_ranking": "Low|Med|High", "comment": "..." }
  ],
  "ai_search_geo_implications": {
    "geos_favored_by_ai": ["..."],
    "ai_ctr_risks": ["..."],
    "locale_specific_answer_blocks": ["..."],
    "dual_visibility_notes": "..."
  },
  "risks": [
    { "risk": "...", "probability": "Low|Med|High", "impact": "Low|Med|High", "prevention": "...", "do_instead": "..." }
  ],
  "final_recommendation": {
    "launch_model": "local-first|national-first|international-first|hybrid",
    "top_5_geo_opportunities": ["...","...","...","...","..."],
    "top_5_hardest_geos": ["...","...","...","...","..."],
    "top_5_page_types": ["...","...","...","...","..."],
    "top_5_mistakes": ["...","...","...","...","..."],
    "phased_plan": "...",
    "kpi_3_6_12": "..."
  }
}`;

function buildUserPrompt(b: any): string {
  return `Параметры проекта:
- Ниша: ${b.niche || "-"}
- Основное гео: ${b.geo || "-"}
- Дополнительные гео: ${b.additionalGeos || "-"}
- Язык: ${b.language || "русский"}
- Локали: ${b.locales || "-"}
- Тип бизнеса: ${b.businessType || "-"}
- Модель работы: ${b.workModel || "-"}
- Целевая аудитория: ${b.audience || "-"}
- Приоритетная цель: ${b.goal || "-"}
- Продуктовые категории / услуги: ${b.categories || "-"}
- Регионы присутствия: ${b.presence || "-"}
- Ограничения: ${b.constraints || "-"}

Проведи полный decision-grade geo & local opportunity анализ. Верни JSON строго по схеме.`;
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
        "X-Title": "SEO-Audit Geo Local Opportunities",
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