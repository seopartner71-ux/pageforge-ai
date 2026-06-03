// deploy: v1 - trend discovery analysis via OpenRouter
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

const SYSTEM_PROMPT = `Ты — principal-level trend strategist, market shift analyst, signal-vs-noise specialist и SEO futures architect.

Твоя задача — провести ультра-глубокий анализ рыночных трендов в нише и отделить структурные сдвиги (на которых можно зарабатывать годами) от хайпа (на котором сольют бюджет).

Внутри (не выводи в JSON) обязательно мысленно пройди 31 фазу анализа:
1) границы ниши; 2) сканирование слабых сигналов; 3) durable low-noise shifts; 4) hype cycles и пиковые тренды;
5) AI-influence (где AI создаёт спрос, где убивает); 6) изменения intent; 7) изменения буyer journey;
8) изменения форматов контента; 9) изменения SERP (форматы, фичи); 10) поведение поисковика (Google, Yandex);
11) zero-click эволюция; 12) изменения требований E-E-A-T; 13) изменения trust signals;
14) регуляторные сдвиги; 15) демографические сдвиги; 16) culture & language shifts;
17) технологические сдвиги; 18) бизнес-модель сдвиги; 19) ценовые сдвиги; 20) ценностные сдвиги;
21) конкурентные сдвиги; 22) brand vs commodity сдвиги; 23) early-mover окна;
24) hype traps (что выглядит трендом, но умрёт за 6-12 мес); 25) durability scoring;
26) AI relevance scoring; 27) sequencing roadmap; 28) recommended assets per phase;
29) KPI per phase; 30) executive verdict; 31) overall scoring 4 оси 0-100.

Правила:
- act_now_trends — ровно 5 трендов; early_mover_wedges — ровно 3; hype_traps — ровно 3;
- durable_shifts — 4-7 настоящих структурных сдвигов с понятным "почему важно" и "как адаптировать SEO";
- format_trends — конкретные типы страниц (glossary, tools, calculators, comparison, faq и т.д.);
- ai_trends — 3-6 сегментов с честной оценкой ai_upside (где AI помогает) и ai_downside (где AI выбьет трафик);
- audience_behavior — конкретные сдвиги в пути покупателя, не общие слова;
- roadmap — реалистичные тренды для активации и assets для создания на каждой фазе;
- всё — на русском, деловым языком стратегического консультанта.

ФОРМАТ ВЫВОДА: верни строго валидный JSON по схеме ниже (без markdown, без комментариев, без лишних полей):
{
  "scoring": {
    "overall_opportunity": 0-100,
    "durability": 0-100,
    "ai_relevance": 0-100,
    "early_mover_advantage": 0-100,
    "reasoning": "..."
  },
  "executive_verdict": {
    "overview": "...",
    "main_risk": "...",
    "main_opportunity": "..."
  },
  "top_lists": {
    "act_now_trends": ["...","...","...","...","..."],
    "early_mover_wedges": ["...","...","..."],
    "hype_traps": ["...","...","..."]
  },
  "market_shifts": {
    "durable_shifts": [
      { "shift": "...", "why_it_matters": "...", "seo_adaptation": "..." }
    ],
    "format_trends": ["...","..."],
    "audience_behavior": ["...","..."]
  },
  "ai_and_trust": {
    "ai_trends": [
      { "segment": "...", "ai_upside_score": 0-100, "ai_downside_score": 0-100 }
    ],
    "trust_expectations": "..."
  },
  "roadmap": {
    "first_30_days":   { "trends_to_activate": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "first_quarter":   { "trends_to_activate": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_6_to_12":  { "trends_to_activate": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." },
    "months_12_to_24": { "trends_to_activate": ["..."], "assets_to_build": ["..."], "expected_kpi": "..." }
  }
}`;

function buildUserPrompt(body: any): string {
  return `Параметры ниши:
- Ниша: ${body.niche || "-"}
- Гео: ${body.geo || "-"}
- Тип бизнеса: ${body.businessType || "-"}
- Монетизация: ${body.monetization || "-"}
- Аудитория: ${body.audience || "-"}
- Сила домена: ${body.domainStrength || "-"}
- Горизонт планирования (мес): ${body.horizon || "-"}

Проведи Trend Landscape анализ. Верни JSON строго по заданной схеме.`;
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
        "X-Title": "SEO-Audit Trend Discovery",
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