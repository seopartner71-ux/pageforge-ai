// SEO Recovery AI — fetch Metrika + GSC, compute deltas, AI causes
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_KEY_ENV = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const GSC_KEY = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY") ?? "";

async function getOpenRouterKey(sb: any): Promise<string> {
  if (OPENROUTER_KEY_ENV) return OPENROUTER_KEY_ENV;
  const { data } = await sb.from("system_settings").select("key_value").eq("key_name", "openrouter_api_key").maybeSingle();
  return String((data as any)?.key_value ?? "").trim();
}

function pct(now: number, prev: number): number {
  if (!prev) return now ? 100 : 0;
  return Math.round(((now - prev) / prev) * 1000) / 10;
}

function daysBetween(a: string, b: string) {
  return Math.max(1, Math.round((+new Date(b) - +new Date(a)) / 86400000) + 1);
}

function shiftRange(date1: string, date2: string) {
  const len = daysBetween(date1, date2);
  const prev2 = new Date(+new Date(date1) - 86400000);
  const prev1 = new Date(+prev2 - (len - 1) * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { date1: fmt(prev1), date2: fmt(prev2) };
}

// ============ Yandex Metrika ============
async function metrikaRequest(token: string, params: Record<string, string>) {
  const url = "https://api-metrika.yandex.net/stat/v1/data?" + new URLSearchParams(params).toString();
  const r = await fetch(url, { headers: { Authorization: `OAuth ${token}` } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Metrika ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function fetchMetrika(token: string, counterId: string, date1: string, date2: string) {
  const base = { ids: counterId, date1, date2, accuracy: "full" };
  const totals = await metrikaRequest(token, {
    ...base,
    metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds",
  });
  const sources = await metrikaRequest(token, {
    ...base,
    metrics: "ym:s:visits",
    dimensions: "ym:s:<lastTrafficSource>",
    limit: "20",
  });
  const engines = await metrikaRequest(token, {
    ...base,
    metrics: "ym:s:visits",
    dimensions: "ym:s:<searchEngine>",
    filters: "ym:s:lastTrafficSource=='organic'",
    limit: "20",
  });
  const pages = await metrikaRequest(token, {
    ...base,
    metrics: "ym:s:visits",
    dimensions: "ym:s:startURL",
    filters: "ym:s:lastTrafficSource=='organic'",
    limit: "50",
    sort: "-ym:s:visits",
  });
  const t = totals.totals ?? [];
  const organic = (sources.data ?? []).find((r: any) => r.dimensions[0]?.id === "organic")?.metrics?.[0] ?? 0;
  return {
    visits: t[0] ?? 0,
    users: t[1] ?? 0,
    pageviews: t[2] ?? 0,
    bounce: t[3] ?? 0,
    duration: t[4] ?? 0,
    organic_visits: organic,
    sources: (sources.data ?? []).map((r: any) => ({ name: r.dimensions[0]?.name ?? r.dimensions[0]?.id, visits: r.metrics[0] })),
    engines: (engines.data ?? []).map((r: any) => ({ name: r.dimensions[0]?.name ?? r.dimensions[0]?.id, visits: r.metrics[0] })),
    top_pages: (pages.data ?? []).map((r: any) => ({ url: r.dimensions[0]?.name, visits: r.metrics[0] })),
  };
}

// ============ Google Search Console (via connector gateway) ============
async function gscQuery(siteUrl: string, body: any) {
  const enc = encodeURIComponent(siteUrl);
  const url = `https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/${enc}/searchAnalytics/query`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GSC_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GSC ${r.status}: ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}

async function fetchGSC(siteUrl: string, date1: string, date2: string) {
  const totals = await gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: [], rowLimit: 1 });
  const pages = await gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: ["page"], rowLimit: 50 });
  const queries = await gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: ["query"], rowLimit: 50 });
  const t = totals.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: t.clicks ?? 0,
    impressions: t.impressions ?? 0,
    ctr: t.ctr ?? 0,
    position: t.position ?? 0,
    pages: (pages.rows ?? []).map((r: any) => ({ url: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    queries: (queries.rows ?? []).map((r: any) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
  };
}

// ============ AI Analysis (OpenRouter) ============
const SYSTEM_PROMPT = `Ты — senior SEO-аналитик. Твоя задача — объяснить причины изменения органического трафика сайта СТРОГО на основе предоставленных метрик.

ЖЁСТКИЕ ПРАВИЛА:
- Никаких догадок. Каждый вывод подкреплён конкретной цифрой из данных.
- Запрещено писать "Google наказал", "плохой контент", "конкуренты", если нет подтверждения в данных.
- Если данных недостаточно — пиши "Нет данных для подтверждения".
- Каждая причина = факт (метрика, было, стало, дельта) + вывод.
- Язык — русский, деловой.

ФОРМАТ ВЫВОДА — строго валидный JSON без markdown:
{
  "seo_score": 0-100,
  "score_reasoning": "...",
  "headline": {
    "direction": "up|down|stable",
    "main_metric": "organic_visits|clicks|impressions",
    "delta_pct": -100..100,
    "summary": "Краткий тезис в 1 предложение"
  },
  "main_cause": {
    "title": "...",
    "confidence": "high|medium|low",
    "evidence": [
      { "source": "Metrika|GSC", "metric": "...", "was": "...", "now": "...", "delta": "..." }
    ],
    "conclusion": "..."
  },
  "causes": [
    { "title": "...", "confidence": "high|medium|low", "evidence": [{ "source": "...", "metric": "...", "was": "...", "now": "...", "delta": "..." }], "conclusion": "..." }
  ],
  "lost_pages": [
    { "url": "...", "was": 0, "now": 0, "delta_pct": 0, "source": "Metrika|GSC" }
  ],
  "lost_queries": [
    { "query": "...", "clicks_was": 0, "clicks_now": 0, "position_was": 0, "position_now": 0 }
  ],
  "recommendations": [
    { "priority": "p1|p2|p3", "title": "...", "why": "...", "action": "..." }
  ],
  "timeline_notes": ["..."]
}`;

async function callAI(key: string, payload: any) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Данные для анализа:\n" + JSON.stringify(payload, null, 2) },
      ],
      temperature: 0.3,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  const txt = j.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

// ============ Handler ============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const sbUser = createClient(SUPABASE_URL, SERVICE_ROLE, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await sbUser.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { counter_id, gsc_site, date1, date2, mode } = body as { counter_id?: string; gsc_site?: string; date1: string; date2: string; mode?: string };

    if (!date1 || !date2) return new Response(JSON.stringify({ error: "date1/date2 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (mode === "check") {
      const { data: tok } = await sb.from("yandex_tokens").select("yandex_login,expires_at").eq("user_id", user.id).maybeSingle();
      return new Response(JSON.stringify({
        metrika_connected: !!tok,
        metrika_login: tok?.yandex_login ?? null,
        gsc_available: !!(LOVABLE_API_KEY && GSC_KEY),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prev = shiftRange(date1, date2);
    const result: any = { period: { current: { date1, date2 }, previous: prev } };
    const errors: string[] = [];

    // Metrika
    if (counter_id) {
      const { data: tok } = await sb.from("yandex_tokens").select("access_token").eq("user_id", user.id).maybeSingle();
      if (!tok?.access_token) {
        errors.push("Яндекс Метрика не подключена. Подключите в разделе Яндекс Вебмастер.");
      } else {
        try {
          const [cur, prv] = await Promise.all([
            fetchMetrika(tok.access_token, counter_id, date1, date2),
            fetchMetrika(tok.access_token, counter_id, prev.date1, prev.date2),
          ]);
          result.metrika = { current: cur, previous: prv, delta: {
            visits: pct(cur.visits, prv.visits),
            users: pct(cur.users, prv.users),
            organic_visits: pct(cur.organic_visits, prv.organic_visits),
            pageviews: pct(cur.pageviews, prv.pageviews),
          }};
        } catch (e) { errors.push("Метрика: " + (e as Error).message); }
      }
    }

    // GSC
    if (gsc_site) {
      if (!LOVABLE_API_KEY || !GSC_KEY) {
        errors.push("Google Search Console не подключен (нужен коннектор).");
      } else {
        try {
          const [cur, prv] = await Promise.all([
            fetchGSC(gsc_site, date1, date2),
            fetchGSC(gsc_site, prev.date1, prev.date2),
          ]);
          result.gsc = { current: cur, previous: prv, delta: {
            clicks: pct(cur.clicks, prv.clicks),
            impressions: pct(cur.impressions, prv.impressions),
            ctr: pct(cur.ctr, prv.ctr),
            position: Math.round((cur.position - prv.position) * 10) / 10,
          }};
        } catch (e) { errors.push("GSC: " + (e as Error).message); }
      }
    }

    if (!result.metrika && !result.gsc) {
      return new Response(JSON.stringify({ error: "Нет данных для анализа", details: errors }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // AI
    const orKey = await getOpenRouterKey(sb);
    if (!orKey) return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY не настроен" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ai = await callAI(orKey, result);
    return new Response(JSON.stringify({ ...result, ai, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});