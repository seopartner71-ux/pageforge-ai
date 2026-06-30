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
const YANDEX_CLIENT_ID = Deno.env.get("YANDEX_OAUTH_CLIENT_ID") ?? "";
const YANDEX_CLIENT_SECRET = Deno.env.get("YANDEX_OAUTH_CLIENT_SECRET") ?? "";
const YANDEX_WEBMASTER_API = "https://api.webmaster.yandex.net/v4";
const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const GSC_FETCH_TIMEOUT_MS = 12_000;
const AI_FETCH_TIMEOUT_MS = 75_000;
const AI_HARD_TIMEOUT_MS = 85_000;

async function fetchWithTimeout(input: string, init: RequestInit = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, label = "request") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`${label}_timeout_${timeoutMs}ms`), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as any)?.name === "AbortError") {
      const err: any = new Error(`${label}_timeout`);
      err.status = 408;
      err.payload = { timeout_ms: timeoutMs };
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

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

async function refreshYandexAccess(sb: any, userId: string, refreshToken: string) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: YANDEX_CLIENT_ID,
    client_secret: YANDEX_CLIENT_SECRET,
  });
  const res = await fetchWithTimeout("https://oauth.yandex.ru/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  }, 8_000, "yandex_refresh");
  const tok = await res.json().catch(() => ({}));
  if (!res.ok || !tok.access_token) {
    const err: any = new Error("yandex_refresh_failed");
    err.status = res.status;
    err.payload = tok;
    throw err;
  }
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in) || 3600) * 1000).toISOString();
  await sb.from("yandex_tokens").update({
    access_token: tok.access_token,
    refresh_token: tok.refresh_token ?? refreshToken,
    expires_at: expiresAt,
  }).eq("user_id", userId);
  return tok.access_token as string;
}

// ============ Yandex Metrika ============
async function metrikaRequest(token: string, params: Record<string, string>) {
  const url = "https://api-metrika.yandex.net/stat/v1/data?" + new URLSearchParams(params).toString();
  const r = await fetchWithTimeout(url, { headers: { Authorization: `OAuth ${token}` } }, DEFAULT_FETCH_TIMEOUT_MS, "metrika_data");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err: any = new Error(`metrika_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
  return j;
}

// ============ Yandex Webmaster ==========
async function yandexWebmasterRequest(token: string, path: string) {
  const r = await fetchWithTimeout(`${YANDEX_WEBMASTER_API}${path}`, { headers: { Authorization: `OAuth ${token}` } }, 10_000, "yandex_webmaster");
  const text = await r.text();
  let payload: any;
  try { payload = JSON.parse(text); } catch { payload = text; }
  if (!r.ok) {
    const err: any = new Error(`yandex_webmaster_${r.status}`);
    err.status = r.status;
    err.payload = payload;
    throw err;
  }
  return payload;
}

function indicatorValue(row: any, names: string[]): number {
  const indicators = row?.indicators ?? row?.statistics ?? row?.data ?? {};
  for (const name of names) {
    if (row?.[name] != null) return Number(row[name]) || 0;
    if (indicators?.[name] != null) {
      const value = typeof indicators[name] === "object" ? indicators[name]?.value : indicators[name];
      return Number(value) || 0;
    }
    const found = Array.isArray(indicators)
      ? indicators.find((x: any) => x?.name === name || x?.indicator === name || x?.field === name)
      : null;
    if (found?.value != null) return Number(found.value) || 0;
  }
  return 0;
}

function queryText(row: any): string {
  return String(row?.query_text ?? row?.query ?? row?.text ?? row?.keys?.[0] ?? row?.query_id ?? "");
}

async function fetchYandexWebmaster(token: string, hostId: string, date1: string, date2: string, prevDate1?: string, prevDate2?: string) {
  const userInfo = await yandexWebmasterRequest(token, "/user/");
  const userId = userInfo?.user_id;
  if (!userId) throw new Error("yandex_user_id_not_found");
  const params = new URLSearchParams({
    order_by: "TOTAL_SHOWS",
    date_from: date1,
    date_to: date2,
    limit: "500",
  });
  params.append("query_indicator", "TOTAL_SHOWS");
  params.append("query_indicator", "TOTAL_CLICKS");
  params.append("query_indicator", "AVG_SHOW_POSITION");
  params.append("query_indicator", "AVG_CLICK_POSITION");

  const data = await yandexWebmasterRequest(
    token,
    `/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-queries/popular/?${params.toString()}`,
  );
  const rawQueries = data?.queries ?? data?.data ?? data?.rows ?? [];
  const queries = (Array.isArray(rawQueries) ? rawQueries : []).map((r: any) => {
    const clicks = indicatorValue(r, ["TOTAL_CLICKS", "clicks"]);
    const impressions = indicatorValue(r, ["TOTAL_SHOWS", "shows", "impressions"]);
    const position = indicatorValue(r, ["AVG_SHOW_POSITION", "AVG_CLICK_POSITION", "position"]);
    return { query: queryText(r), clicks, impressions, position };
  }).filter((r: any) => r.query);

  const clicks = queries.reduce((sum: number, r: any) => sum + Number(r.clicks ?? 0), 0);
  const impressions = queries.reduce((sum: number, r: any) => sum + Number(r.impressions ?? 0), 0);
  const weightedPosition = queries.reduce((sum: number, r: any) => sum + (Number(r.position ?? 0) * Math.max(1, Number(r.impressions ?? 0))), 0);
  const positionWeight = queries.reduce((sum: number, r: any) => sum + Math.max(1, Number(r.impressions ?? 0)), 0);

  // Daily history via search-queries/all-history/ — основной рабочий эндпоинт Вебмастера
  async function fetchHistory(d1: string, d2: string) {
    const p = new URLSearchParams({ date_from: d1, date_to: d2 });
    p.append("query_indicator", "TOTAL_CLICKS");
    p.append("query_indicator", "TOTAL_SHOWS");
    // В Webmaster API v4 корректные пути — через слэш, а не дефис.
    // Пробуем несколько вариантов: all/history, popular/history, history.
    const candidates = [
      `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-queries/all/history/?${p.toString()}`,
      `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-queries/popular/history/?${p.toString()}`,
      `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-queries/history/?${p.toString()}`,
    ];
    for (const url of candidates) {
      console.log("Yandex history URL:", url);
      try {
        const r = await fetchWithTimeout(url, { headers: { Authorization: `OAuth ${token}` } }, 8_000, "yandex_history");
        const text = await r.text();
        console.log("Yandex history status:", r.status);
        if (!r.ok) {
          console.log("Yandex history body:", text.slice(0, 400));
          continue;
        }
        const res = JSON.parse(text);
        const items: any[] = res?.history_items ?? res?.history ?? res?.items ?? res?.indicators ?? [];
        const rows = items.map((it: any) => {
          const date = String(it?.date ?? it?.day ?? "").slice(0, 10);
          const ind = it?.indicators ?? it;
          const clicks = Number(ind?.TOTAL_CLICKS?.value ?? ind?.TOTAL_CLICKS ?? 0) || 0;
          const impressions = Number(ind?.TOTAL_SHOWS?.value ?? ind?.TOTAL_SHOWS ?? 0) || 0;
          return { date, clicks, impressions, ctr: impressions ? clicks / impressions : 0 };
        }).filter((r: any) => r.date);
        if (rows.length > 0) return rows.sort((a: any, b: any) => a.date.localeCompare(b.date));
      } catch (e) {
        console.log("history fetch error:", (e as any)?.message);
      }
    }
    return [];
  }

  const [daily_data, daily_data_prev] = await Promise.all([
    fetchHistory(date1, date2),
    prevDate1 && prevDate2 ? fetchHistory(prevDate1, prevDate2) : Promise.resolve([] as any[]),
  ]);

  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: positionWeight ? weightedPosition / positionWeight : 0,
    queries,
    daily_data,
    daily_data_prev,
  };
}

async function fetchMetrika(token: string, counterId: string, date1: string, date2: string, opts: { withChannels?: boolean } = {}) {
  const base = { ids: counterId, date1, date2, accuracy: "full" };
  const ORGANIC_FILTER = "ym:s:lastSignTrafficSource=='organic'";
  const [totals, sources, engines, pages] = await Promise.all([
    metrikaRequest(token, { ...base, metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds", filters: ORGANIC_FILTER }).catch((e) => ({ __error: e, totals: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:<lastSignTrafficSource>", filters: ORGANIC_FILTER, limit: "20" }).catch((e) => ({ __error: e, data: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:<searchEngine>", filters: ORGANIC_FILTER, limit: "20" }).catch((e) => ({ __error: e, data: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:startURL", filters: ORGANIC_FILTER, limit: "25", sort: "-ym:s:visits" }).catch((e) => ({ __error: e, data: [] })),
  ]);
  const hardError = [totals, sources, engines, pages].find((x: any) => x?.__error?.status === 401 || x?.__error?.status === 403 || x?.__error?.status === 404)?.__error;
  if (hardError) throw hardError;
  const t = (totals as any).totals ?? [];
  // С фильтром organic — totals visits уже равны органическим визитам
  const organic = t[0] ?? 0;

  // Daily organic visits via /bytime endpoint
  let daily_data: Array<{ date: string; visits: number }> = [];
  try {
    const dailyUrl = `https://api-metrika.yandex.net/stat/v1/data/bytime?` + new URLSearchParams({
      id: counterId,
      metrics: "ym:s:visits",
      date1,
      date2,
      group: "day",
      accuracy: "full",
      filters: "ym:s:lastTrafficSource=='organic'",
    }).toString();
    console.log("Metrika bytime URL:", dailyUrl);
    const dr = await fetchWithTimeout(dailyUrl, { headers: { Authorization: `OAuth ${token}` } }, 6_000, "metrika_bytime_organic");
    const dtext = await dr.text();
    console.log("bytime status:", dr.status, "body:", dtext.slice(0, 300));
    if (dr.ok) {
      const dj = JSON.parse(dtext);
      const intervals: string[] = dj?.time_intervals?.map((i: any) => (Array.isArray(i) ? i[0] : i)) ?? [];
      const series: number[] = dj?.data?.[0]?.metrics?.[0] ?? [];
      daily_data = intervals.map((date: string, i: number) => ({
        date: String(date).slice(0, 10),
        visits: Number(series[i] ?? 0) || 0,
      }));
    }
  } catch (e) {
    console.log("Metrika bytime error:", (e as any)?.message);
  }

  // Только органический канал — отдельные запросы по каналам не нужны
  const daily_channels: Record<string, Array<{ date: string; visits: number }>> = { organic: daily_data };

  // Devices and regions — top breakdowns (только для текущего периода, withChannels=true)
  let devices: Array<{ name: string; visits: number; pct: number }> = [];
  let regions: Array<{ name: string; visits: number; pct: number }> = [];
  if (opts.withChannels) {
    try {
      const [devRes, regRes] = await Promise.all([
        metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:deviceCategory", filters: ORGANIC_FILTER, limit: "10" }).catch(() => ({ data: [] })),
        metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:regionCity", filters: ORGANIC_FILTER, limit: "10", sort: "-ym:s:visits" }).catch(() => ({ data: [] })),
      ]);
      const devTotal = ((devRes as any).data ?? []).reduce((s: number, r: any) => s + (r.metrics?.[0] ?? 0), 0) || 1;
      devices = ((devRes as any).data ?? []).map((r: any) => ({
        name: r.dimensions[0]?.name ?? r.dimensions[0]?.id ?? "—",
        visits: r.metrics[0] ?? 0,
        pct: Math.round(((r.metrics[0] ?? 0) / devTotal) * 1000) / 10,
      }));
      const regTotal = ((regRes as any).data ?? []).reduce((s: number, r: any) => s + (r.metrics?.[0] ?? 0), 0) || 1;
      regions = ((regRes as any).data ?? []).map((r: any) => ({
        name: r.dimensions[0]?.name ?? r.dimensions[0]?.id ?? "—",
        visits: r.metrics[0] ?? 0,
        pct: Math.round(((r.metrics[0] ?? 0) / regTotal) * 1000) / 10,
      }));
    } catch (e) {
      console.log("Metrika devices/regions error:", (e as any)?.message);
    }
  }

  // Совмещённый ряд: только органика (фильтр применён ко всем запросам)
  const merged_daily = daily_data.map((p) => ({ date: p.date, visits: p.visits, organic: p.visits }));

  return {
    visits: t[0] ?? 0,
    users: t[1] ?? 0,
    pageviews: t[2] ?? 0,
    bounce: t[3] ?? 0,
    duration: t[4] ?? 0,
    organic_visits: organic,
    sources: ((sources as any).data ?? []).map((r: any) => ({ name: r.dimensions[0]?.name ?? r.dimensions[0]?.id, visits: r.metrics[0] })),
    engines: ((engines as any).data ?? []).map((r: any) => ({ name: r.dimensions[0]?.name ?? r.dimensions[0]?.id, visits: r.metrics[0] })),
    top_pages: ((pages as any).data ?? []).map((r: any) => ({ url: r.dimensions[0]?.name, visits: r.metrics[0] })),
    daily_data,
    daily_channels,
    daily_combined: merged_daily,
    devices,
    regions,
  };
}

// ============ Google Search Console (via connector gateway) ============
// ============ Topvisor ============
async function fetchTopvisor(apiKey: string, userId: string, projectId: string, date1: string, date2: string) {
  const url = "https://api.topvisor.com/v2/json/get/positions_2/history";
  const body = {
    project_id: Number(projectId) || projectId,
    date1,
    date2,
    show_headers: 1,
    positions_fields: ["position"],
  };
  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "User-Id": String(userId),
      "Authorization": `bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, 12_000, "topvisor");
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.errors) {
    const err: any = new Error(`topvisor_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }

  // Parse Topvisor response
  // headers.dates: ["2026-06-01", ...]
  // keywords: [{ id, name, positionsData: { "YYYY-MM-DD:<region>:<group>": { position: "5" } } }]
  const dates: string[] = j?.result?.headers?.dates ?? j?.headers?.dates ?? [];
  const keywords: any[] = j?.result?.keywords ?? j?.keywords ?? [];

  // history: average position per date
  const history: Array<{ date: string; avg_position: number }> = dates.map((d) => {
    let sum = 0, cnt = 0;
    for (const kw of keywords) {
      const pd = kw?.positionsData ?? {};
      for (const k of Object.keys(pd)) {
        if (k.startsWith(d)) {
          const p = Number(pd[k]?.position);
          if (Number.isFinite(p) && p > 0 && p <= 200) { sum += p; cnt++; }
          break;
        }
      }
    }
    return { date: d, avg_position: cnt ? Math.round((sum / cnt) * 10) / 10 : 0 };
  });

  // top3 / top10 / top30 — count at LAST date
  const lastDate = dates[dates.length - 1];
  const firstDate = dates[0];
  let top3 = 0, top10 = 0, top30 = 0;
  const lostList: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = [];
  for (const kw of keywords) {
    const name = String(kw?.name ?? kw?.keyword ?? kw?.id ?? "");
    const pd = kw?.positionsData ?? {};
    let last: number | null = null;
    let first: number | null = null;
    for (const k of Object.keys(pd)) {
      const p = Number(pd[k]?.position);
      if (!Number.isFinite(p) || p <= 0) continue;
      if (lastDate && k.startsWith(lastDate)) last = p;
      if (firstDate && k.startsWith(firstDate)) first = p;
    }
    if (last != null) {
      if (last <= 3) top3++;
      if (last <= 10) top10++;
      if (last <= 30) top30++;
    }
    if (last != null && first != null && last > first) {
      lostList.push({ query: name, pos_was: first, pos_now: last, delta: Math.round((last - first) * 10) / 10 });
    }
  }
  lostList.sort((a, b) => b.delta - a.delta);

  return {
    top3,
    top10,
    top30,
    keywords_total: keywords.length,
    history,
    lost_positions: lostList.slice(0, 10),
  };
}

async function gscQuery(siteUrl: string, body: any) {
  const enc = encodeURIComponent(siteUrl);
  const url = `https://connector-gateway.lovable.dev/google_search_console/webmasters/v3/sites/${enc}/searchAnalytics/query`;
  const r = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": GSC_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, GSC_FETCH_TIMEOUT_MS, "gsc_query");
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err: any = new Error(`gsc_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
  return j;
}

async function fetchGSC(siteUrl: string, date1: string, date2: string, prevDate1?: string, prevDate2?: string) {
  const [totals, pages, queries, daily, daily_prev] = await Promise.all([
    gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: [], rowLimit: 1, searchType: "web" }),
    gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: ["page"], rowLimit: 50, searchType: "web" }),
    gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: ["query"], rowLimit: 50, searchType: "web" }),
    gscQuery(siteUrl, { startDate: date1, endDate: date2, dimensions: ["date"], rowLimit: 90, searchType: "web" }),
    prevDate1 && prevDate2
      ? gscQuery(siteUrl, { startDate: prevDate1, endDate: prevDate2, dimensions: ["date"], rowLimit: 90, searchType: "web" })
      : Promise.resolve({ rows: [] }),
  ]);
  const t = totals.rows?.[0] ?? { clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return {
    clicks: t.clicks ?? 0,
    impressions: t.impressions ?? 0,
    ctr: t.ctr ?? 0,
    position: t.position ?? 0,
    pages: (pages.rows ?? []).map((r: any) => ({ url: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    queries: (queries.rows ?? []).map((r: any) => ({ query: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    daily_data: (daily.rows ?? []).map((r: any) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
    daily_data_prev: (daily_prev.rows ?? []).map((r: any) => ({ date: r.keys[0], clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position })),
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
  const cleanHost = host.replace(/^sc-domain:/i, "").replace(/^https?:\/\//, "").split("/")[0];
  const parts = cleanHost.split(".");
  if (parts.length < 2) return null;
  const sld = parts[parts.length - 2].toLowerCase();
  // Для составных доменов вида "kupit-minitraktor" берём последнюю часть после дефиса,
  // так как первая часть обычно — это коммерческий префикс (kupit/buy/shop/online…), а не бренд.
  if (sld.includes("-")) {
    const tokens = sld.split("-").filter(Boolean);
    const last = tokens[tokens.length - 1];
    if (last && last.length >= 3) return last;
  }
  return sld;
}

// Транслитерация latin → cyrillic для поиска бренда в русскоязычных запросах.
const LAT_TO_CYR: Record<string, string> = {
  shch: "щ", sch: "щ", zh: "ж", ch: "ч", sh: "ш", yo: "ё", yu: "ю", ya: "я",
  kh: "х", ts: "ц", iy: "ий", ay: "ай", ey: "ей", oy: "ой",
  a: "а", b: "б", v: "в", g: "г", d: "д", e: "е", z: "з", i: "и", j: "й",
  k: "к", l: "л", m: "м", n: "н", o: "о", p: "п", r: "р", s: "с", t: "т",
  u: "у", f: "ф", h: "х", c: "к", y: "ы", w: "в", x: "кс", q: "к",
};
function translitToCyr(input: string): string {
  const s = input.toLowerCase();
  let out = "";
  let i = 0;
  while (i < s.length) {
    let matched = false;
    for (const len of [4, 3, 2]) {
      const chunk = s.slice(i, i + len);
      if (chunk.length === len && LAT_TO_CYR[chunk]) {
        out += LAT_TO_CYR[chunk];
        i += len;
        matched = true;
        break;
      }
    }
    if (!matched) {
      const ch = s[i];
      out += LAT_TO_CYR[ch] ?? ch;
      i++;
    }
  }
  return out;
}
function brandTerms(brand: string | null): string[] {
  if (!brand) return [];
  const terms = new Set<string>();
  terms.add(brand.toLowerCase());
  const cyr = translitToCyr(brand);
  if (cyr && cyr !== brand.toLowerCase()) terms.add(cyr);
  return Array.from(terms).filter(t => t.length >= 3);
}

function buildDiagnostics(result: any, gscSite?: string, errors?: any[]) {
  const d: any = {};
  const g = result.gsc;
  const y = result.yandex;
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
    const terms = brandTerms(brand);
    if (brand && terms.length) {
      const split = (rows: any[]) => rows.reduce((acc, r) => {
        const q = String(r.query || "").toLowerCase();
        const isBrand = terms.some(t => q.includes(t));
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
        brand_terms: terms,
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
  if (y) {
    const prevQueries = Array.isArray(y.previous?.queries) ? y.previous.queries : [];
    const hasPrev = prevQueries.length > 0;
    const queriesDiff = hasPrev ? diffSeries(y.current.queries, prevQueries, "query", "clicks") : [];
    const impressionsDiff = hasPrev ? diffSeries(y.current.queries, prevQueries, "query", "impressions") : [];
    if (!hasPrev && errors) {
      errors.push({
        source: "Yandex",
        type: "no_previous_data",
        message: "Яндекс.Вебмастер не вернул данные за предыдущий период — сравнение по запросам недоступно (часто бывает при YoY: API хранит детальную историю запросов ограниченное время).",
      });
    }
    d.yandex = {
      previous_data_available: hasPrev,
      lost_queries_by_clicks: hasPrev ? topLosers(queriesDiff).map(q => {
        const cq = y.current.queries.find((x: any) => x.query === q.key);
        const pq = prevQueries.find((x: any) => x.query === q.key);
        return {
          query: q.key, clicks_was: q.was, clicks_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct,
          impr_was: pq?.impressions ?? 0, impr_now: cq?.impressions ?? 0,
          pos_was: pq?.position ?? null, pos_now: cq?.position ?? null,
        };
      }) : [],
      lost_queries_by_impr: hasPrev ? topLosers(impressionsDiff).slice(0, 10).map(q => ({ query: q.key, impr_was: q.was, impr_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct })) : [],
      gained_queries_by_clicks: hasPrev ? topGainers(queriesDiff).map(q => ({ query: q.key, clicks_was: q.was, clicks_now: q.now, delta_abs: q.delta_abs, delta_pct: q.delta_pct })) : [],
      signals: {
        impressions_drop_pct: y.delta.impressions,
        clicks_drop_pct: y.delta.clicks,
        ctr_change_pct: y.delta.ctr,
        position_change_abs: y.delta.position,
        pattern:
          y.delta.impressions < -10 && y.delta.position > 0.3 ? "visibility_loss"
          : y.delta.position < -0.3 && y.delta.clicks < -5 ? "position_up_clicks_down_anomaly"
          : y.delta.ctr < -10 && Math.abs(y.delta.position) < 0.3 ? "ctr_decay"
          : y.delta.impressions < -10 && y.delta.clicks > -5 ? "impressions_drop_clicks_stable"
          : "mixed",
      },
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
const SYSTEM_PROMPT = `Ты — Senior SEO-аналитик. Твоя задача — дать машинный анализ на основе ТОЛЬКО предоставленных цифр.

ЖЁСТКИЕ ПРАВИЛА:
1. Каждое утверждение ОБЯЗАНО содержать конкретную цифру из данных. Формат: "метрика: было X → стало Y (дельта Z%)"
2. ЗАПРЕЩЕНО писать "возможно", "вероятно", "скорее всего" без цифрового доказательства
3. ЗАПРЕЩЕНО упоминать конкурентов, алгоритмы, контент без данных подтверждающих это
4. Гипотеза считается валидной ТОЛЬКО если подтверждается минимум двумя независимыми метриками
5. Если данных недостаточно — писать "Недостаточно данных. Требуется проверка: [что именно]"
6. Probability гипотезы считать математически: если одна метрика подтверждает — 40%, две — 65%, три — 85%

АЛГОРИТМ АНАЛИЗА:
1. Определи паттерн по signals.pattern
2. Найди топ-3 URL с максимальными потерями кликов — они дают X% от общего падения
3. Найди топ-3 запроса с максимальными потерями — вычисли их долю
4. Сравни impressions vs clicks delta — если impressions упали меньше чем clicks — проблема в CTR
5. Сравни позиции — если позиции улучшились а клики упали — проблема в сниппете или SERP-фичах
6. Brand vs non-brand — расхождение указывает на источник проблемы

ФОРМАТ ГИПОТЕЗ:
Каждая гипотеза должна содержать:
- Наблюдение: конкретные цифры
- Математическое обоснование: почему именно эта причина
- Как опровергнуть: что проверить чтобы исключить гипотезу
- Как подтвердить: какие дополнительные данные нужны

ФОРМАТ РЕКОМЕНДАЦИЙ:
- Только действия которые напрямую вытекают из найденных проблем
- Каждая рекомендация привязана к конкретному URL или запросу из данных
- KPI: конкретная метрика + целевое значение + срок
- ICE считать честно: если нет данных для оценки — ставить confidence=3

Не пиши воду. Только цифры и выводы из них.

ОБЯЗАТЕЛЬНЫЕ РАЗДЕЛЫ В JSON:
- diagnosis_pattern: один из ключей паттерна выше + 1 предложение почему.
- root_cause_hypotheses: 2–4 гипотезы (от сильной к слабой) с весом probability (0–100), evidence-цифры, как опровергнуть/подтвердить (verification_step).
- impact_breakdown: топ-5 страниц/запросов с долей в общей потере кликов (share_of_loss_pct).
- recommendations: P1 (24–72ч), P2 (2 недели), P3 (стратегия). Для каждой — KPI восстановления (метрика + целевой дельта), оценка усилий (ICE: impact 1–10, confidence 1–10, ease 1–10, score=I*C*E).
- next_steps: ручные проверки за пределами данных (server logs, GSC Coverage, шаблон, индексация, AI Overviews захват и т.д.).

ФОРМАТ ВЫВОДА — СТРОГО валидный JSON без markdown:
{
  "seo_score": 0-100,
  "score_reasoning": "1–2 предложения, почему именно столько. ПРАВИЛА расчёта (строго): если клики упали >20% в обеих системах (GSC и Яндекс/Метрика) — seo_score не выше 55. Если >20% только в одной системе — не выше 65. Если падение >35% хотя бы в одной — не выше 45. Стабильно (±5%) — 70–80. Рост >10% — 80+.",
  "headline": {
    "direction": "up|down|stable",
    "main_metric": "organic_visits|clicks|impressions|position|ctr",
    "delta_pct": -100..100,
    "summary": "ТОЛЬКО краткий тезис в одно предложение: что произошло. Без деталей, без причин, без рекомендаций."
  },
  "diagnosis_pattern": { "code": "visibility_loss|ctr_decay|impressions_drop_clicks_stable|position_up_clicks_down_anomaly|seasonality|mixed", "explanation": "..." },
  "main_cause": {
    "title": "Краткая формулировка корневой причины",
    "confidence": "high|medium|low",
    "evidence": [ { "source": "Yandex|Metrika|GSC", "metric": "...", "was": "...", "now": "...", "delta": "..." } ],
    "conclusion": "Развёрнутый вывод в 3–4 предложения с цифрами и контекстом. НЕ ПОВТОРЯЙ дословно headline.summary — это должен быть другой текст, раскрывающий тезис глубже: причины, механика, последствия."
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

function extractJson(text: string): any {
  let cleaned = String(text || "").replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const start = cleaned.search(/[\{\[]/);
  if (start === -1) throw new Error("no_json_found");
  const openChar = cleaned[start];
  const closeChar = openChar === "[" ? "]" : "}";
  const end = cleaned.lastIndexOf(closeChar);
  if (end === -1 || end < start) throw new Error("no_json_close");
  cleaned = cleaned.substring(start, end + 1);
  try { return JSON.parse(cleaned); } catch {
    const repaired = cleaned.replace(/,\s*}/g, "}").replace(/,\s*]/g, "]").replace(/[\x00-\x1F\x7F]/g, "");
    return JSON.parse(repaired);
  }
}

async function callAIOnce(key: string, payload: any, strictJson = false): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const userContent =
    (strictJson
      ? "ВЕРНИ ТОЛЬКО валидный JSON-объект без markdown-разметки, без ```json и без пояснений. Строго одна JSON-структура по схеме ответа.\n\n"
      : "") +
    "Данные для анализа (фактические выгрузки из Яндекс.Вебмастера/Метрики и GSC, включая diagnostics с предрасчитанными signals и lost-листами):\n" +
    JSON.stringify(payload);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });
    const raw = await r.text();
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${raw.slice(0, 400)}`);
    let j: any;
    try { j = JSON.parse(raw); } catch { throw new Error("openrouter_envelope_parse_failed"); }
    const txt = j.choices?.[0]?.message?.content ?? "";
    if (!txt) throw new Error("ai_empty_response");
    return extractJson(txt);
  } finally {
    clearTimeout(timer);
  }
}

async function callAI(key: string, payload: any) {
  const size = JSON.stringify(payload).length;
  console.log("AI payload size:", size);
  try {
    return await callAIOnce(key, payload, false);
  } catch (e1) {
    console.log("AI attempt 1 failed:", (e1 as any)?.message);
    try {
      return await callAIOnce(key, payload, true);
    } catch (e2) {
      console.log("AI attempt 2 failed:", (e2 as any)?.message);
      const err = new Error("ai_unavailable");
      (err as any).cause = (e2 as any)?.message ?? (e1 as any)?.message;
      throw err;
    }
  }
}

function compactForAI(result: any) {
  const take = (arr: any[], n: number) => Array.isArray(arr) ? arr.slice(0, n) : [];
  const TOP = 15;
  const trimDiag = (src: any) => {
    if (!src || typeof src !== "object") return src;
    const out: any = {};
    for (const k of Object.keys(src)) {
      const v = (src as any)[k];
      if (Array.isArray(v)) out[k] = v.slice(0, TOP);
      else out[k] = v;
    }
    return out;
  };
  const diag = result.diagnostics ? {
    gsc: result.diagnostics.gsc ? trimDiag(result.diagnostics.gsc) : undefined,
    yandex: result.diagnostics.yandex ? trimDiag(result.diagnostics.yandex) : undefined,
    metrika: result.diagnostics.metrika ? trimDiag(result.diagnostics.metrika) : undefined,
    topvisor: result.diagnostics.topvisor ? trimDiag(result.diagnostics.topvisor) : undefined,
  } : undefined;
  const compact: any = {
    period: result.period,
    diagnostics: diag,
  };
  if (result.gsc) compact.gsc = {
    current: { clicks: result.gsc.current.clicks, impressions: result.gsc.current.impressions, ctr: result.gsc.current.ctr, position: result.gsc.current.position },
    previous: { clicks: result.gsc.previous.clicks, impressions: result.gsc.previous.impressions, ctr: result.gsc.previous.ctr, position: result.gsc.previous.position },
    delta: result.gsc.delta,
    daily_data: take(result.gsc.current.daily_data, 30),
    daily_data_prev: take(result.gsc.previous.daily_data, 30),
  };
  if (result.yandex) compact.yandex = {
    current: { clicks: result.yandex.current.clicks, impressions: result.yandex.current.impressions, ctr: result.yandex.current.ctr, position: result.yandex.current.position },
    previous: { clicks: result.yandex.previous.clicks, impressions: result.yandex.previous.impressions, ctr: result.yandex.previous.ctr, position: result.yandex.previous.position },
    delta: result.yandex.delta,
    daily_data: take(result.yandex.current.daily_data, 30),
    daily_data_prev: take(result.yandex.previous.daily_data, 30),
  };
  if (result.metrika) compact.metrika = {
    current: {
      visits: result.metrika.current.visits,
      users: result.metrika.current.users,
      organic_visits: result.metrika.current.organic_visits,
      pageviews: result.metrika.current.pageviews,
      sources: take(result.metrika.current.sources, 10),
      engines: take(result.metrika.current.engines, 10),
      devices: take(result.metrika.current.devices, 10),
      regions: take(result.metrika.current.regions, 10),
      daily_combined: take(result.metrika.current.daily_combined, 30),
    },
    previous: { visits: result.metrika.previous.visits, users: result.metrika.previous.users, organic_visits: result.metrika.previous.organic_visits, pageviews: result.metrika.previous.pageviews, sources: result.metrika.previous.sources },
    delta: result.metrika.delta,
  };
  return compact;
}

function fallbackAI(result: any, reason = "ai_unavailable") {
  const primary = result.metrika?.delta?.organic_visits != null
    ? { metric: "organic_visits", delta: result.metrika.delta.organic_visits, source: "Метрика" }
    : result.gsc?.delta?.clicks != null
      ? { metric: "clicks", delta: result.gsc.delta.clicks, source: "GSC" }
      : result.yandex?.delta?.clicks != null
        ? { metric: "clicks", delta: result.yandex.delta.clicks, source: "Yandex" }
        : { metric: "clicks", delta: 0, source: "GSC" };
  const direction = primary.delta < -5 ? "down" : primary.delta > 5 ? "up" : "stable";
  const score = direction === "down" ? Math.max(35, 70 + Math.round(primary.delta / 2)) : direction === "up" ? 78 : 65;
  return {
    seo_score: score,
    score_reasoning: "Автоматическое заключение построено по метрикам без расширенного AI-вывода: внешний AI-ответ не успел завершиться в безопасный лимит.",
    headline: {
      direction,
      main_metric: primary.metric,
      delta_pct: primary.delta,
      summary: direction === "down" ? `Зафиксировано снижение по ключевой метрике ${primary.metric}: ${primary.delta}%` : direction === "up" ? `Зафиксирован рост по ключевой метрике ${primary.metric}: +${primary.delta}%` : "Существенного изменения органического трафика не зафиксировано",
    },
    diagnosis_pattern: { code: result.diagnostics?.gsc?.signals?.pattern ?? result.diagnostics?.yandex?.signals?.pattern ?? "mixed", explanation: "Паттерн рассчитан автоматически по кликам, показам, CTR и позиции." },
    main_cause: {
      title: "Требуется ручная верификация причины изменения",
      confidence: "low",
      evidence: [{ source: primary.source, metric: primary.metric, was: "предыдущий период", now: "текущий период", delta: `${primary.delta}%` }],
      conclusion: `Данные источников получены, но расширенный AI-анализ был ограничен по времени (${reason}). Используйте вкладки графиков, потерянных страниц и запросов для первичной диагностики.`,
    },
    root_cause_hypotheses: [],
    causes: [],
    impact_breakdown: { total_clicks_lost: 0, top_loss_contributors: [] },
    brand_analysis: null,
    lost_pages: [
      ...(result.diagnostics?.gsc?.lost_pages ?? []).slice(0, 5).map((p: any) => ({ url: p.url, was: p.clicks_was, now: p.clicks_now, delta_pct: p.delta_pct, source: "GSC" })),
      ...(result.diagnostics?.metrika?.lost_pages ?? []).slice(0, 5).map((p: any) => ({ url: p.url, was: p.visits_was, now: p.visits_now, delta_pct: p.delta_pct, source: "Metrika" })),
    ],
    lost_queries: (result.diagnostics?.gsc?.lost_queries_by_clicks ?? result.diagnostics?.yandex?.lost_queries_by_clicks ?? []).slice(0, 10).map((q: any) => ({ query: q.query, clicks_was: q.clicks_was, clicks_now: q.clicks_now, position_was: q.pos_was, position_now: q.pos_now, diagnosis: "Падение кликов требует проверки сниппета, позиции и индексации страницы." })),
    recommendations: [
      { priority: "p1", title: "Проверить страницы и запросы с максимальной потерей", why: "Это самый быстрый способ локализовать вклад в падение.", action: "Откройте вкладки «Потерянные страницы» и «Запросы», проверьте индексацию, canonical, robots, title/description и изменения шаблона для топ-потерь.", kpi: { metric: primary.metric, target_delta: "+10–15% за 2 недели" }, ice: { impact: 8, confidence: 6, ease: 7, score: 336 } },
    ],
    next_steps: ["Проверить Coverage/Индексирование в GSC и Яндекс.Вебмастере", "Сверить даты падения с релизами, изменениями шаблонов, robots.txt, sitemap и логами сервера"],
    timeline_notes: [],
  };
}

// ============ Friendly error formatter ============
function friendlyError(source: "Метрика" | "Яндекс" | "GSC", err: any, ctx: { counter_id?: string; yandex_host?: string; gsc_site?: string }): { code: string; title: string; hint: string; raw?: string } {
  const status = err?.status;
  const payload = err?.payload;
  if (source === "Метрика") {
    if (status === 403) return {
      code: "metrika_access_denied",
      title: `Нет доступа к счётчику Яндекс Метрики${ctx.counter_id ? ` #${ctx.counter_id}` : ""}.`,
      hint: "Подключённый Яндекс-аккаунт не имеет прав на чтение этого счётчика. Переподключите Яндекс так же, как на странице «Проекты», либо попросите владельца счётчика выдать гостевой доступ (Метрика → Настройки → Доступ → Добавить пользователя).",
    };
    if (status === 404) return { code: "metrika_not_found", title: "Счётчик Метрики не найден.", hint: "Проверьте правильность ID счётчика — он должен быть числовым (например, 12345678)." };
    if (status === 401) return { code: "metrika_unauthorized", title: "Токен Яндекс Метрики истёк.", hint: "Переподключите Яндекс-аккаунт через кнопку «Подключить»." };
    return { code: "metrika_error", title: `Метрика ответила ошибкой ${status ?? ""}.`, hint: "Попробуйте позже или проверьте параметры счётчика.", raw: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200) };
  }
  if (source === "Яндекс") {
    if (status === 403) return {
      code: "yandex_webmaster_access_denied",
      title: `Нет доступа к сайту в Яндекс.Вебмастере${ctx.yandex_host ? `: ${ctx.yandex_host}` : ""}.`,
      hint: "Используйте тот же сайт, который выбран и подтверждён на странице «Проекты». Если сайт чужой — владелец должен выдать доступ к нему в Яндекс.Вебмастере.",
      raw: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200),
    };
    if (status === 404) return { code: "yandex_webmaster_not_found", title: "Сайт Яндекса не найден.", hint: "Откройте «Выбрать» и выберите сайт из списка доступных в подключённом Яндекс-аккаунте." };
    if (status === 401) return { code: "yandex_unauthorized", title: "Токен Яндекса истёк.", hint: "Переподключите Яндекс так же, как на странице «Проекты»." };
    return { code: "yandex_webmaster_error", title: `Яндекс.Вебмастер ответил ошибкой ${status ?? ""}.`, hint: "Попробуйте позже или выберите другой сайт из списка проектов.", raw: typeof payload === "object" ? JSON.stringify(payload).slice(0, 200) : String(payload).slice(0, 200) };
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

async function getFreshYandexAccess(sb: any, userId: string) {
  const { data: tok } = await sb.from("yandex_tokens").select("access_token, refresh_token, expires_at").eq("user_id", userId).maybeSingle();
  if (!tok?.access_token) return null;
  if (tok.expires_at && new Date(tok.expires_at).getTime() < Date.now() + 60_000 && tok.refresh_token) {
    return await refreshYandexAccess(sb, userId, tok.refresh_token);
  }
  return tok.access_token as string;
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
    const { counter_id, yandex_host, gsc_site, date1, date2, mode, comparison1, comparison2, topvisor_key, topvisor_user_id, topvisor_project_id } = body as { counter_id?: string; yandex_host?: string; gsc_site?: string; date1: string; date2: string; mode?: string; comparison1?: string; comparison2?: string; topvisor_key?: string; topvisor_user_id?: string; topvisor_project_id?: string };

    if (!date1 || !date2) return new Response(JSON.stringify({ error: "date1/date2 required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (mode === "check") {
      const { data: tok } = await sb.from("yandex_tokens").select("yandex_login,expires_at").eq("user_id", user.id).maybeSingle();
      return new Response(JSON.stringify({
        yandex_connected: !!tok,
        yandex_login: tok?.yandex_login ?? null,
        metrika_connected: !!tok,
        metrika_login: tok?.yandex_login ?? null,
        gsc_available: !!(LOVABLE_API_KEY && GSC_KEY),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const prev = comparison1 && comparison2 ? { date1: comparison1, date2: comparison2 } : shiftRange(date1, date2);
    const result: any = { period: { current: { date1, date2 }, previous: prev } };
    const errors: any[] = [];

    const yandexAccessPromise = counter_id || yandex_host
      ? getFreshYandexAccess(sb, user.id)
      : Promise.resolve(null);
    const sourceJobs: Promise<void>[] = [];

    // Metrika
    if (counter_id) {
      sourceJobs.push((async () => {
        try {
          const accessToken = await yandexAccessPromise;
          if (!accessToken) {
            errors.push({ code: "metrika_not_connected", title: "Яндекс Метрика не подключена.", hint: "Подключите Яндекс так же, как на странице «Проекты», затем укажите ID счётчика." });
            return;
          }
          const [cur, prv] = await Promise.all([
            fetchMetrika(accessToken, counter_id, date1, date2, { withChannels: true }),
            fetchMetrika(accessToken, counter_id, prev.date1, prev.date2),
          ]);
          result.metrika = { current: cur, previous: prv, delta: {
            visits: pct(cur.visits, prv.visits),
            users: pct(cur.users, prv.users),
            organic_visits: pct(cur.organic_visits, prv.organic_visits),
            pageviews: pct(cur.pageviews, prv.pageviews),
          }, daily_data: cur.daily_data, daily_data_prev: prv.daily_data };
        } catch (e: any) {
          if (e?.status === 403) {
            const { data: tokDbg } = await sb.from("yandex_tokens").select("yandex_login").eq("user_id", user.id).maybeSingle();
            console.log("Metrika 403 error:", JSON.stringify({
              counter_id,
              user_id: user.id,
              token_login: tokDbg?.yandex_login ?? null,
              error_payload: JSON.stringify(e?.payload ?? {}).slice(0, 300),
            }));
          }
          errors.push(friendlyError("Метрика", e, { counter_id }));
        }
      })());
    }

    // Yandex Webmaster — same project connection as /projects
    if (yandex_host) {
      sourceJobs.push((async () => {
        try {
          const accessToken = await yandexAccessPromise;
          if (!accessToken) {
            errors.push({ code: "yandex_not_connected", title: "Яндекс не подключён.", hint: "Подключите Яндекс так же, как на странице «Проекты», затем выберите сайт из списка." });
            return;
          }
          const [cur, prv] = await Promise.all([
            fetchYandexWebmaster(accessToken, yandex_host, date1, date2),
            fetchYandexWebmaster(accessToken, yandex_host, prev.date1, prev.date2),
          ]);
          result.yandex = { current: cur, previous: prv, delta: {
            clicks: pct(cur.clicks, prv.clicks),
            impressions: pct(cur.impressions, prv.impressions),
            ctr: pct(cur.ctr, prv.ctr),
            position: Math.round((cur.position - prv.position) * 10) / 10,
          }, daily_data: cur.daily_data, daily_data_prev: prv.daily_data };
        } catch (e) { errors.push(friendlyError("Яндекс", e, { yandex_host })); }
      })());
    }

    // GSC
    if (gsc_site) {
      sourceJobs.push((async () => {
        if (!LOVABLE_API_KEY || !GSC_KEY) {
          errors.push({ code: "gsc_not_connected", title: "Google Search Console не подключён.", hint: "Подключите коннектор GSC в настройках рабочего пространства." });
          return;
        }
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
          }, daily_data: cur.daily_data, daily_data_prev: prv.daily_data };
        } catch (e) { errors.push(friendlyError("GSC", e, { gsc_site })); }
      })());
    }

    await Promise.all(sourceJobs);

    // Topvisor (independent, runs alongside)
    if (topvisor_key && topvisor_project_id && topvisor_user_id) {
      try {
        result.topvisor = await fetchTopvisor(topvisor_key, topvisor_user_id, topvisor_project_id, date1, date2);
        try {
          result.topvisor_prev = await fetchTopvisor(topvisor_key, topvisor_user_id, topvisor_project_id, prev.date1, prev.date2);
        } catch (_e) { /* предыдущий период необязателен */ }
      } catch (e: any) {
        errors.push({
          code: "topvisor_error",
          title: `Топвизор ответил ошибкой${e?.status ? ` ${e.status}` : ""}.`,
          hint: "Проверьте API-ключ, User ID и Project ID. Убедитесь, что проект содержит ключевые запросы и собранные позиции за выбранный период.",
          raw: typeof e?.payload === "object" ? JSON.stringify(e.payload).slice(0, 240) : undefined,
        });
      }
    }

    if (!result.metrika && !result.yandex && !result.gsc && !result.topvisor) {
      return new Response(JSON.stringify({ error: "Нет данных для анализа", details: errors }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Pre-computed diagnostics for AI grounding
    result.diagnostics = buildDiagnostics(result, gsc_site, errors);

    // AI
    const orKey = await getOpenRouterKey(sb);
    if (!orKey) return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY не настроен" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let ai: any;
    try {
      ai = await callAI(orKey, compactForAI(result));
    } catch (e) {
      console.log("AI fallback used:", (e as any)?.message);
      errors.push({
        code: "ai_unavailable",
        title: "AI-анализ временно недоступен, попробуйте запустить анализ ещё раз.",
        hint: "Данные источников получены и доступны во вкладках графиков и таблиц. Повторный запуск обычно помогает.",
      });
      ai = { unavailable: true, reason: (e as any)?.cause ?? (e as any)?.message ?? "ai_error" };
    }
    return new Response(JSON.stringify({ ...result, ai, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});