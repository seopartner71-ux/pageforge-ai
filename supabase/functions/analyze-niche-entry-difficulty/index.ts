// deploy: v1 - niche entry difficulty analysis via OpenRouter
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

const SYSTEM_PROMPT = `Ты — senior SEO strategist, competitive landscape analyst и specialist по niche entry feasibility.

Твоя задача — провести decision-grade оценку сложности входа в нишу через SEO. Разделяй общую сложность ниши и сложность именно для данного сайта. Ищи structural barriers и реальные entry wedges. Пиши на русском, конкретно, без воды.

Внутри (не выводи) обязательно мысленно пройди 18 фаз анализа: scope входа, декомпозиция ниши на сегменты, demand-to-difficulty ratio, SERP barrier, incumbent moats, content/entity depth, trust/E-E-A-T, link/authority, commercial page barrier, geo/locale, platform/ecosystem, business-model fit, resource-fit, entry wedges, quick wins vs long game, scoring model, strategic interpretation, final recommendation.

Правила:
- не путай keyword difficulty и entry difficulty;
- ниша не однородна — оцени сегменты отдельно;
- различай общую сложность ниши и сложность для данного сайта;
- если SERP занят marketplaces/directories/UGC/local pack/AI Overviews — считай это structural barrier;
- если ниша YMYL — усиливай вес trust и review barriers;
- если ресурсов недостаточно — говори прямо и предлагай сузить scope;
- всегда предлагай entry path и wedges, а не только verdict.

ФОРМАТ ВЫВОДА: верни строго валидный JSON, без markdown, без пояснений вне JSON:
{
  "executive_verdict": {
    "niche_difficulty": "low|moderate|high|very-high|prohibitive",
    "site_specific_difficulty": "low|moderate|high|very-high|prohibitive",
    "realistic_entry": "...",
    "main_barrier": "...",
    "main_opportunity": "...",
    "entry_model": "broad-first|wedge-first|geo-first|authority-first|commercial-first|hybrid",
    "recommendation": "go|cautious-go|phased-go|selective-go|no-go",
    "verdict_summary": "..."
  },
  "entry_scope": {
    "success_definition": "...",
    "scope_mode": "broad|wedge|mixed",
    "horizon": "...",
    "assumptions": ["...", "..."],
    "comment": "..."
  },
  "segments": [
    { "segment": "...", "queries": ["..."], "intent": "...", "seo_value": "High|Med|Low", "business_value": "High|Med|Low", "difficulty": "low|moderate|high|very-high", "fits_new_site": true, "comment": "..." }
  ],
  "serp_barriers": [
    { "segment": "...", "openness": "open|mixed|closed", "dominators": "...", "displacement_difficulty": "low|moderate|high|very-high", "required_page_type": "...", "comment": "..." }
  ],
  "incumbent_moats": [
    { "leader_type": "...", "moat": "...", "hard_to_replicate": "low|moderate|high|very-high", "wedge_bypass": "...", "comment": "..." }
  ],
  "trust_content_authority": [
    { "barrier": "trust|content-depth|entity|links|E-E-A-T|reviews|compliance", "level": "low|moderate|high|very-high", "why": "...", "how_to_cross": "...", "comment": "..." }
  ],
  "commercial_layers": [
    { "layer": "category|service|product|local|pricing|comparison|alternatives|lead-gen", "difficulty": "low|moderate|high|very-high", "why_hard": "...", "defer_option": "...", "comment": "..." }
  ],
  "geo_platform_effects": [
    { "factor": "...", "effect": "...", "direction": "increase|decrease", "action": "...", "comment": "..." }
  ],
  "resource_fit": {
    "covered": ["..."],
    "gaps": ["..."],
    "critical_deficits": ["..."],
    "how_to_narrow_scope": "...",
    "comment": "..."
  },
  "entry_wedges": [
    { "wedge": "...", "why_lowers_difficulty": "...", "best_page_type": "...", "fits_new_site": true, "time_to_signal": "30d|q1|q2|6-12m|12-24m", "comment": "..." }
  ],
  "quick_vs_long": [
    { "opportunity": "...", "type": "quick-win|long-game", "time_to_signal": "30d|q1|q2|6-12m|12-24m", "time_to_traction": "30d|q1|q2|6-12m|12-24m", "business_relevance": "High|Med|Low", "comment": "..." }
  ],
  "scores": {
    "serp_competition": 0-100,
    "incumbent_moat": 0-100,
    "trust_eeat": 0-100,
    "content_depth": 0-100,
    "link_authority": 0-100,
    "commercial_page": 0-100,
    "geo_locale": 0-100,
    "platform_ecosystem": 0-100,
    "resource_mismatch_penalty": 0-100,
    "speed_to_impact_difficulty": 0-100,
    "wedge_availability_offset": 0-100,
    "site_fit_adjustment": 0-100,
    "overall_niche_difficulty": 0-100,
    "site_specific_entry_difficulty": 0-100,
    "easiest_segment_score": 0-100,
    "hardest_segment_score": 0-100,
    "quick_win_feasibility": 0-100,
    "long_term_payoff": 0-100,
    "risk_adjusted_attractiveness": 0-100,
    "reasoning": "..."
  },
  "interpretation": {
    "category": "very-easy|manageable|moderate|difficult|very-difficult|prohibitive",
    "meaning": "...",
    "fits_site_type": "...",
    "does_not_fit": "...",
    "optimal_strategy": "...",
    "avoid": "..."
  },
  "final_recommendation": {
    "top_5_barriers": ["...","...","...","...","..."],
    "top_5_wedges": ["...","...","...","...","..."],
    "top_5_page_types": ["...","...","...","...","..."],
    "top_5_mistakes": ["...","...","...","...","..."],
    "entry_model": "broad-first|wedge-first|geo-first|authority-first|commercial-first|hybrid",
    "decision": "go|cautious-go|phased-go|no-go",
    "phased_plan": "..."
  }
}`;

function buildUserPrompt(b: any): string {
  return `Параметры проекта:
- Ниша: ${b.niche || "-"}
- Гео: ${b.geo || "-"}
- Язык: ${b.language || "русский"}
- Тип бизнеса: ${b.businessType || "-"}
- Тип сайта: ${b.siteMaturity || "-"}
- Сила домена: ${b.domainStrength || "-"}
- Целевая аудитория: ${b.audience || "-"}
- Приоритетная цель: ${b.goal || "-"}
- Основной продукт / категории: ${b.product || "-"}
- Конкуренты: ${b.competitors || "-"}
- Ресурсы команды: ${b.resources || "-"}
- Ограничения: ${b.constraints || "-"}
- Горизонт ожиданий: ${b.horizon || "-"} мес.

Проведи полный decision-grade анализ сложности входа в нишу. Верни JSON строго по заданной схеме.`;
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
        "X-Title": "SEO-Audit Niche Entry Difficulty",
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