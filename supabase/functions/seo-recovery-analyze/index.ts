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
  if (!r.ok) {
    const err: any = new Error(`metrika_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
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
  if (!r.ok) {
    const err: any = new Error(`gsc_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
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

// ============ Diagnostics helpers ============
function diffSeries<T extends Record<string, any>>(
  curr: T[], prev: T[], key: string, metric: string,
): Array<{ key: string; was: number; now: number; delta_abs: number; delta_pct: number }> {
  const map = new Map<string, number>();
  for (const r of prev) map.set(String(r[key] ?? ""), Number(r[metric] ?? 0));
  const out: any[] = [];
  for (const r of curr) {
    const k = String(r[key] ?? "");
    const was = map.get(k) ?? 0;
    const now = Number(r[metric] ?? 0);
    out.push({ key: k, was, now, delta_abs: now - was, delta_pct: pct(now, was) });
    map.delete(k);
  }
  // items present only in prev (fully lost)
  for (const [k, was] of map) out.push({ key: k, was, now: 0, delta_abs: -was, delta_pct: -100 });
  return out;
}

function topLosers<T extends { delta_abs: number }>(rows: T[], n = 15): T[] {
  return [...rows].filter(r => r.delta_abs < 0).sort((a, b) => a.delta_abs - b.delta_abs).slice(0, n);
}
function topGainers<T extends { delta_abs: number }>(rows: T[], n = 10): T[] {
  return [...rows].filter(r => r.delta_abs > 0).sort((a, b) => b.delta_abs - a.delta_abs).slice(0, n);
}

function detectBrand(host: string): string | null {
  if (!host) return null;
  const parts = host.replace(/^https?:\/\//, "").split("/")[0].split(".");
  if (parts.length < 2) return null;
  return parts[parts.length - 2].toLowerCase();
}

function buildDiagnostics(result: any, gscSite?: string) {
  const d: any = {};
  const g = result.gsc;
  const m = result.metrika;
  if (g) {
    const queriesDiff = diffSeries(g.current.queries, g.previous.queries, "query", "clicks");
    const impressionsDiff = diffSeries(g.current.queries, g.previous.queries, "query", "impressions");
    const pagesDiff = diffSeries(g.current.pages, g.previous.pages, "url", "clicks");
    d.gsc = {
      lost_queries_by_clicks: topLosers(queriesDiff).map(q => {
        const cq = g.current.queries.find((x: any) => x.query === q.key);
        const pq = g.previous.queries.find((x: any) => x.query === q.key);
        return {
          query: q.key, clicks_was: q.was, clicks_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct,
          impr_was: pq?.impressions ?? 0, impr_now: cq?.impressions ?? 0,
          pos_was: pq?.position ?? null, pos_now: cq?.position ?? null,
          ctr_was: pq?.ctr ?? null, ctr_now: cq?.ctr ?? null,
        };
      }),
      lost_queries_by_impr: topLosers(impressionsDiff).slice(0, 10).map(q => ({ query: q.key, impr_was: q.was, impr_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct })),
      gained_queries_by_clicks: topGainers(queriesDiff).map(q => ({ query: q.key, clicks_was: q.was, clicks_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct })),
      lost_pages: topLosers(pagesDiff).map(p => ({ url: p.key, clicks_was: p.was, clicks_now: p.now, delta_abs: p.delta_abs, delta_pct: p.delta_pct })),
    };

    // Branded vs non-branded
    const brand = detectBrand(gscSite || "");
    if (brand) {
      const split = (rows: any[]) => rows.reduce((acc, r) => {
        const isBrand = String(r.query || "").toLowerCase().includes(brand);
        acc[isBrand ? "brand" : "non_brand"].clicks += Number(r.clicks ?? 0);
        acc[isBrand ? "brand" : "non_brand"].impressions += Number(r.impressions ?? 0);
        return acc;
      }, { brand: { clicks: 0, impressions: 0 }, non_brand: { clicks: 0, impressions: 0 } });
      const sc = split(g.current.queries);
      const sp = split(g.previous.queries);
      d.gsc.brand_split = {
        brand: { clicks_was: sp.brand.clicks, clicks_now: sc.brand.clicks, delta_pct: pct(sc.brand.clicks, sp.brand.clicks),
                 impr_was: sp.brand.impressions, impr_now: sc.brand.impressions, impr_delta_pct: pct(sc.brand.impressions, sp.brand.impressions) },
        non_brand: { clicks_was: sp.non_brand.clicks, clicks_now: sc.non_brand.clicks, delta_pct: pct(sc.non_brand.clicks, sp.non_brand.clicks),
                     impr_was: sp.non_brand.impressions, impr_now: sc.non_brand.impressions, impr_delta_pct: pct(sc.non_brand.impressions, sp.non_brand.impressions) },
        brand_term: brand,
      };
    }

    // Divergence signals
    d.gsc.signals = {
      impressions_drop_pct: g.delta.impressions,
      clicks_drop_pct: g.delta.clicks,
      ctr_change_pct: g.delta.ctr,
      position_change_abs: g.delta.position,
      pattern:
        g.delta.impressions < -10 && g.delta.position > 0.3 ? "visibility_loss"
        : g.delta.position < -0.3 && g.delta.clicks < -5 ? "position_up_clicks_down_anomaly"
        : g.delta.ctr < -10 && Math.abs(g.delta.position) < 0.3 ? "ctr_decay"
        : g.delta.impressions < -10 && g.delta.clicks > -5 ? "impressions_drop_clicks_stable"
        : "mixed",
    };
  }
  if (m) {
    const pagesDiff = diffSeries(m.current.top_pages, m.previous.top_pages, "url", "visits");
    d.metrika = {
      lost_pages: topLosers(pagesDiff).map(p => ({ url: p.key, visits_was: p.was, visits_now: p.now, delta_abs: p.delta_abs, delta_pct: p.delta_pct })),
      gained_pages: topGainers(pagesDiff).slice(0, 5).map(p => ({ url: p.key, visits_was: p.was, visits_now: p.now, delta_abs: p.delta_abs })),
      engines: m.current.engines,
      sources_diff: diffSeries(m.current.sources, m.previous.sources, "name", "visits"),
    };
  }
  return d;
}

// ============ AI Analysis (OpenRouter) ============
const SYSTEM_PROMPT = `Ты — Senior SEO-аналитик (10+ лет опыта, специализация: технический SEO, аналитика, восстановление трафика).
Твой стиль: сухой, доказательный, без воды. Уровень: для in-house head of SEO / агентства уровня A.

ЗАДАЧА: дать профессиональное диагностическое заключение по динамике органического трафика на основе РЕАЛЬНЫХ метрик из Яндекс Метрики и Google Search Console. Не консультация в духе "пишите хороший контент" — а инженерный разбор.

МЕТОДОЛОГИЯ (применяй последовательно):
1. Определи паттерн изменения по signals.pattern и подтверди его цифрами:
   • visibility_loss — упали impressions + позиции (deindex / алгоритм / удаление страниц / robots / canonical).
   • ctr_decay — позиции стабильны, упал CTR (потеря featured snippet, AI Overviews, новый SERP-feature, испорченный title/description).
   • impressions_drop_clicks_stable — сжалась воронка показов, но ядро запросов выживает (сезонность / падение по long-tail).
   • position_up_clicks_down_anomaly — позиции улучшились, клики упали (CTR-аномалия, SERP-feature, brand vs non-brand смена структуры).
   • mixed — комбинированный, разбирай по сегментам.
2. Сравни brand vs non-brand (если brand_split есть): расхождение указывает на источник проблемы (репутация vs алгоритм).
3. Сегментный анализ: какие страницы и запросы дали основной отрицательный вклад (lost_queries_by_clicks, lost_pages). Считай долю потерь.
4. Проверь источники Метрики (sources_diff): просел ли именно organic, или общий трафик. Если падает только organic — это SEO, если всё — общий фактор.
5. Сезонность: учитывай дату периода, но не выдумывай — пиши только если паттерн чисто сезонный (укажи на это явно).

ЖЁСТКИЕ ПРАВИЛА:
- Каждое утверждение — со ссылкой на конкретную метрику (источник, было → стало, дельта).
- Запрещены формулировки: "возможно Google понизил", "конкуренты усилились", "контент устарел" — БЕЗ доказательств из данных.
- Если данных не хватает для гипотезы — явно: "Требуется проверка вручную: ..." и в next_steps укажи что именно проверить (логи сервера, индексация в GSC, изменения шаблона, robots.txt, sitemap, hreflang и т.д.).
- Числа округляй: проценты до 1 знака, абсолюты — без дробей.
- Тон: на "вы" не нужно, инженерный. Без эмоджи, без маркетинговой воды.

ОБЯЗАТЕЛЬНЫЕ РАЗДЕЛЫ В JSON:
- diagnosis_pattern: один из ключей паттерна выше + 1 предложение почему.
- root_cause_hypotheses: 2–4 гипотезы (от сильной к слабой) с весом probability (0–100), evidence-цифры, как опровергнуть/подтвердить (verification_step).
- impact_breakdown: топ-5 страниц/запросов с долей в общей потере кликов (share_of_loss_pct).
- recommendations: P1 (24–72ч), P2 (2 недели), P3 (стратегия). Для каждой — KPI восстановления (метрика + целевой дельта), оценка усилий (ICE: impact 1–10, confidence 1–10, ease 1–10, score=I*C*E).
- next_steps: ручные проверки за пределами данных (server logs, GSC Coverage, шаблон, индексация, AI Overviews захват и т.д.).

ФОРМАТ ВЫВОДА — СТРОГО валидный JSON без markdown:
{
  "seo_score": 0-100,
  "score_reasoning": "1–2 предложения, почему именно столько",
  "headline": {
    "direction": "up|down|stable",
    "main_metric": "organic_visits|clicks|impressions|position|ctr",
    "delta_pct": -100..100,
    "summary": "Профессиональный тезис в 1 предложение: что произошло, насколько серьёзно"
  },
  "diagnosis_pattern": { "code": "visibility_loss|ctr_decay|impressions_drop_clicks_stable|position_up_clicks_down_anomaly|seasonality|mixed", "explanation": "..." },
  "main_cause": {
    "title": "Краткая формулировка корневой причины",
    "confidence": "high|medium|low",
    "evidence": [ { "source": "Metrika|GSC", "metric": "...", "was": "...", "now": "...", "delta": "..." } ],
    "conclusion": "Развёрнутый вывод в 2–3 предложения, как senior SEO формулирует в отчёте клиенту"
  },
  "root_cause_hypotheses": [
    { "hypothesis": "...", "probability": 0-100, "evidence": [{ "source":"...","metric":"...","was":"...","now":"...","delta":"..." }], "verification_step": "Что конкретно проверить, чтобы подтвердить/опровергнуть" }
  ],
  "causes": [
    { "title": "...", "confidence": "high|medium|low", "evidence": [{ "source":"...","metric":"...","was":"...","now":"...","delta":"..." }], "conclusion": "..." }
  ],
  "impact_breakdown": {
    "total_clicks_lost": 0,
    "top_loss_contributors": [
      { "type": "page|query", "name": "...", "clicks_lost": 0, "share_of_loss_pct": 0 }
    ]
  },
  "brand_analysis": { "brand_clicks_delta_pct": 0, "non_brand_clicks_delta_pct": 0, "interpretation": "..." },
  "lost_pages": [ { "url": "...", "was": 0, "now": 0, "delta_pct": 0, "source": "Metrika|GSC" } ],
  "lost_queries": [ { "query": "...", "clicks_was": 0, "clicks_now": 0, "position_was": 0, "position_now": 0, "diagnosis": "Краткий вывод по запросу" } ],
  "recommendations": [
    {
      "priority": "p1|p2|p3",
      "title": "Конкретное действие, а не общая фраза",
      "why": "Привязка к найденной причине + цифра",
      "action": "Шаги выполнения, технически точно",
      "kpi": { "metric": "clicks|impressions|position|ctr", "target_delta": "+15% за 2 недели" },
      "ice": { "impact": 1-10, "confidence": 1-10, "ease": 1-10, "score": 0-1000 }
    }
  ],
  "next_steps": [ "Ручные проверки, которые невозможно сделать из API: ..." ],
  "timeline_notes": [ "Заметки о датах/событиях, если выявлены в данных" ]
}`;

async function callAI(key: string, payload: any) {
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-pro",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Данные для анализа (фактические выгрузки из Metrika и GSC, включая diagnostics с предрасчитанными signals и lost-листами):\n" + JSON.stringify(payload, null, 2) },
      ],
      temperature: 0.2,
    }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${JSON.stringify(j).slice(0, 400)}`);
  const txt = j.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(txt); } catch { return { raw: txt }; }
}

// ============ Friendly error formatter ============
function friendlyError(source: "Метрика" | "GSC", err: any, ctx: { counter_id?: string; gsc_site?: string }): { code: string; title: string; hint: string; raw?: string } {
  const status = err?.status;
  const payload = err?.payload;
  if (source === "Метрика") {
    if (status === 403) return {
      code: "metrika_access_denied",
      title: `Нет доступа к счётчику Яндекс Метрики${ctx.counter_id ? ` #${ctx.counter_id}` : ""}.`,
      hint: "Подключённый Яндекс-аккаунт не имеет прав на чтение этого счётчика. Откройте «Мастер» и выберите счётчик из доступных, либо попросите владельца счётчика выдать гостевой доступ (Метрика → Настройки → Доступ → Добавить пользователя).",
    };
    if (status === 404) return { code: "metrika_not_found", title: "Счётчик Метрики не найден.", hint: "Проверьте правильность ID счётчика — он должен быть числовым (например, 12345678)." };
    if (status === 401) return { code: "metrika_unauthorized", title: "Токен Яндекс Метрики истёк.", hint: "Переподключите Яндекс-аккаунт через кнопку «Подключить»." };
    return { code: "metrika_error", title: `Метрика ответила ошибкой ${status ?? ""}.`, hint: "Попробуйте позже или проверьте параметры счётчика.", raw: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200) };
  }
  // GSC
  if (status === 403) return {
    code: "gsc_access_denied",
    title: `Нет доступа к сайту в Google Search Console${ctx.gsc_site ? `: ${ctx.gsc_site}` : ""}.`,
    hint: "Подключённый Google-аккаунт не имеет прав на этот ресурс. Проверьте: (1) формат — для Domain-property используйте `sc-domain:example.com`, для URL-property — точный URL с протоколом и слэшем; (2) что аккаунт коннектора добавлен как пользователь в GSC.",
  };
  if (status === 404) return { code: "gsc_not_found", title: "Сайт не найден в Google Search Console.", hint: "Сайт должен быть верифицирован в GSC под аккаунтом, которым подключен коннектор." };
  if (status === 401) return { code: "gsc_unauthorized", title: "Сессия GSC-коннектора истекла.", hint: "Переподключите Google Search Console в настройках коннектора." };
  return { code: "gsc_error", title: `Google Search Console вернул ошибку ${status ?? ""}.`, hint: "Повторите попытку позже.", raw: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200) };
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
    const errors: any[] = [];

    // Metrika
    if (counter_id) {
      const { data: tok } = await sb.from("yandex_tokens").select("access_token").eq("user_id", user.id).maybeSingle();
      if (!tok?.access_token) {
        errors.push({ code: "metrika_not_connected", title: "Яндекс Метрика не подключена.", hint: "Нажмите «Подключить» в карточке Яндекс Метрики выше и авторизуйтесь." });
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
        } catch (e) { errors.push(friendlyError("Метрика", e, { counter_id })); }
      }
    }

    // GSC
    if (gsc_site) {
      if (!LOVABLE_API_KEY || !GSC_KEY) {
        errors.push({ code: "gsc_not_connected", title: "Google Search Console не подключён.", hint: "Подключите коннектор GSC в настройках рабочего пространства." });
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
        } catch (e) { errors.push(friendlyError("GSC", e, { gsc_site })); }
      }
    }

    if (!result.metrika && !result.gsc) {
      return new Response(JSON.stringify({ error: "Нет данных для анализа", details: errors }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pre-computed diagnostics for AI grounding
    result.diagnostics = buildDiagnostics(result, gsc_site);

    // AI
    const orKey = await getOpenRouterKey(sb);
    if (!orKey) return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY не настроен" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const ai = await callAI(orKey, result);
    return new Response(JSON.stringify({ ...result, ai, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});