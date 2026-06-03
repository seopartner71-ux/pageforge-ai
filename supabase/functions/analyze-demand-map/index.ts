// deploy: v1 - demand map analysis via OpenRouter
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

const SYSTEM_PROMPT = `Ты — principal-level SEO strategist, search demand cartographer, intent architect, buyer journey analyst и specialist по decomposition спроса в нише.

Твоя задача — построить ультра-глубокую карту спроса (demand map): разложить нишу по слоям buyer journey, intent-распределению, vanity-vs-value кластерам, барьерам доступности и risk-adjusted sequencing.

Внутри (не выводи в JSON) обязательно мысленно пройди все фазы:
1) границы спроса (in/out/adjacent); 2) buyer journey (Problem Awareness → Solution Awareness → Vendor Research → Evaluation → Purchase → Post-Purchase / Advocacy);
3) для каждой стадии — реалистичные поисковые запросы на языке гео; 4) сила спроса на стадии (% от общего volume); 5) бизнес-ценность стадии;
6) intent distribution (commercial / informational / local / support — сумма = 100);
7) vanity vs value: какие кластеры реально приносят деньги, а какие — ложный спрос (огромный объём без конверсии);
8) trust-adjusted барьеры: где raw demand high, но E-E-A-T и accessibility low;
9) AI/SERP барьеры: AI upside, SERP openness, zero-click risk;
10) sequencing roadmap: что запускать в 30 дней, в 1 квартал, в 6–12 мес и какие page types использовать;
11) executive summary: сильнейшие слои, главные риски, top-5 quick wins, top-5 avoid zones;
12) overall scoring по 4 осям 0-100: overall_attractiveness, commercial_value, ai_resilience, trust_feasibility.

Правила:
- запросы — реальные, на языке гео, не выдуманные шаблоны;
- demand_strength_percent — реалистичное распределение, сумма по стадиям ≈ 100;
- intent_distribution — сумма строго = 100;
- vanity_misleading — обязательно конкретные кластеры с объяснением «почему ложный спрос»;
- barriers.trust_adjusted — кластеры где raw_demand=High но ee_a_t_requirement=High и accessibility=Low;
- sequencing_roadmap.page_types — конкретные типы (blog, glossary, comparison, service, local, calculator, pricing, case-study, faq и т.д.);
- всё — на русском, деловым языком стратегического консультанта.

ФОРМАТ ВЫВОДА: верни строго валидный JSON по схеме ниже (без markdown, без комментариев, без лишних полей):
{
  "scoring": {
    "overall_attractiveness": 0-100,
    "commercial_value": 0-100,
    "ai_resilience": 0-100,
    "trust_feasibility": 0-100,
    "scoring_reasoning": "..."
  },
  "executive_summary": {
    "strongest_layers": "...",
    "main_risks": "...",
    "top_5_quick_wins": ["...", "...", "...", "...", "..."],
    "top_5_avoid_zones": ["...", "...", "...", "...", "..."]
  },
  "buyer_journey": [
    { "stage": "Problem Awareness", "queries": ["...", "..."], "demand_strength_percent": 0-100, "business_value": "High|Med|Low" }
  ],
  "intent_distribution": { "commercial": 0-100, "informational": 0-100, "local": 0-100, "support": 0-100 },
  "vanity_vs_value": {
    "high_value": [{ "cluster": "...", "reason": "..." }],
    "vanity_misleading": [{ "cluster": "...", "reason": "..." }]
  },
  "barriers": {
    "trust_adjusted": [
      { "cluster": "...", "raw_demand": "High|Med|Low", "ee_a_t_requirement": "High|Med|Low", "accessibility": "High|Med|Low" }
    ],
    "ai_and_serp": { "ai_upside": 0-100, "serp_openness": 0-100, "zero_click_risk": 0-100 }
  },
  "sequencing_roadmap": {
    "first_30_days": { "targets": ["..."], "page_types": ["..."] },
    "first_quarter": { "targets": ["..."], "page_types": ["..."] },
    "months_6_to_12": { "targets": ["..."], "page_types": ["..."] }
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

Построй реалистичную карту спроса. Верни JSON строго по заданной схеме.`;
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
        "X-Title": "SEO-Audit Demand Map",
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