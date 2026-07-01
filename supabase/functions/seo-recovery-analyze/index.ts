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
const AI_FETCH_TIMEOUT_MS = 12_000;
const AI_HARD_TIMEOUT_MS = 18_000;

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

async function fetchYandexWebmaster(token: string, hostId: string, date1: string, date2: string, prevDate1?: string, prevDate2?: string, loadIndexing = true) {
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
        // Shape A: { history_items: [{ date, indicators: { TOTAL_CLICKS, TOTAL_SHOWS } }] }
        // Shape B: { indicators: { TOTAL_CLICKS: [{date,value}], TOTAL_SHOWS: [...] } }
        // Shape C: { indicators: [{ indicator, history: [{date,value}] }] }
        let rows: Array<{ date: string; clicks: number; impressions: number; ctr: number }> = [];
        const itemsRaw = res?.history_items ?? res?.history ?? res?.items;
        if (Array.isArray(itemsRaw)) {
          rows = itemsRaw.map((it: any) => {
            const date = String(it?.date ?? it?.day ?? "").slice(0, 10);
            const ind = it?.indicators ?? it;
            const clicks = Number(ind?.TOTAL_CLICKS?.value ?? ind?.TOTAL_CLICKS ?? 0) || 0;
            const impressions = Number(ind?.TOTAL_SHOWS?.value ?? ind?.TOTAL_SHOWS ?? 0) || 0;
            return { date, clicks, impressions, ctr: impressions ? clicks / impressions : 0 };
          }).filter((r: any) => r.date);
        } else {
          const ind = res?.indicators;
          const byDate = new Map<string, { clicks: number; impressions: number }>();
          const consume = (arr: any[], field: "clicks" | "impressions") => {
            for (const pt of arr ?? []) {
              const date = String(pt?.date ?? pt?.day ?? "").slice(0, 10);
              if (!date) continue;
              const val = Number(pt?.value ?? pt?.count ?? 0) || 0;
              const cur = byDate.get(date) ?? { clicks: 0, impressions: 0 };
              cur[field] = val;
              byDate.set(date, cur);
            }
          };
          if (ind && !Array.isArray(ind) && typeof ind === "object") {
            consume(ind.TOTAL_CLICKS ?? ind.total_clicks ?? [], "clicks");
            consume(ind.TOTAL_SHOWS ?? ind.total_shows ?? [], "impressions");
          } else if (Array.isArray(ind)) {
            for (const block of ind) {
              const name = String(block?.indicator ?? block?.name ?? "").toUpperCase();
              const hist = block?.history ?? block?.values ?? [];
              if (name.includes("CLICKS")) consume(hist, "clicks");
              else if (name.includes("SHOWS") || name.includes("IMPRESSIONS")) consume(hist, "impressions");
            }
          }
          rows = Array.from(byDate.entries()).map(([date, v]) => ({
            date, clicks: v.clicks, impressions: v.impressions,
            ctr: v.impressions ? v.clicks / v.impressions : 0,
          }));
        }
        if (rows.length > 0) return rows.sort((a, b) => a.date.localeCompare(b.date));
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

  // Индексация: история кол-ва страниц в поиске + события добавления/удаления URL.
  // В Webmaster API v4 корректные endpoints:
  // - /search-urls/in-search/history — количество страниц в поиске
  // - /search-urls/events/history — сколько страниц появилось/удалено
  // - /search-urls/events/samples — примеры URL, появившихся/удалённых из поиска
  async function fetchIndexing() {
    const out: { daily_indexed: Array<{ date: string; count: number; added?: number; removed?: number }>; excluded_pages: Array<{ url: string; status: string; date?: string; last_access?: string; target_url?: string; http_status?: number }>; excluded_count: number; status?: string } = {
      daily_indexed: [],
      excluded_pages: [],
      excluded_count: 0,
    };
    const day = (v: any) => String(v ?? "").slice(0, 10);
    const inRange = (d: string) => !d || (d >= date1 && d <= date2);
    const byDate = new Map<string, { date: string; count: number; added?: number; removed?: number }>();
    const ensureDay = (d: string) => {
      const date = day(d);
      if (!date) return null;
      const cur = byDate.get(date) ?? { date, count: 0, added: 0, removed: 0 };
      byDate.set(date, cur);
      return cur;
    };

    try {
      const url = `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-urls/in-search/history/?date_from=${date1}&date_to=${date2}`;
      const r = await fetchWithTimeout(url, { headers: { Authorization: `OAuth ${token}` } }, 8_000, "yandex_in_search_history");
      if (r.ok) {
        const j = await r.json();
        const items = j?.history ?? j?.history_items ?? j?.indicators?.IN_SEARCH ?? j?.indicators?.SEARCHABLE ?? [];
        if (Array.isArray(items)) {
          for (const it of items) {
            const row = ensureDay(it?.date ?? it?.day);
            if (!row) continue;
            row.count = Number(it?.value ?? it?.searchable_count ?? it?.count ?? 0) || 0;
          }
        }
      } else {
        const text = await r.text().catch(() => "");
        out.status = `in_search_history_${r.status}`;
        console.log("yandex in-search/history status:", r.status, text.slice(0, 240));
      }
    } catch (e) {
      out.status = "in_search_history_error";
      console.log("in-search history error:", (e as any)?.message);
    }

    try {
      const url = `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-urls/events/history/?date_from=${date1}&date_to=${date2}`;
      const r = await fetchWithTimeout(url, { headers: { Authorization: `OAuth ${token}` } }, 8_000, "yandex_events_history");
      if (r.ok) {
        const j = await r.json();
        const appeared = j?.indicators?.APPEARED_IN_SEARCH ?? j?.APPEARED_IN_SEARCH ?? [];
        const removed = j?.indicators?.REMOVED_FROM_SEARCH ?? j?.REMOVED_FROM_SEARCH ?? [];
        if (Array.isArray(appeared)) {
          for (const it of appeared) {
            const row = ensureDay(it?.date ?? it?.day);
            if (!row) continue;
            row.added = Number(it?.value ?? it?.count ?? 0) || 0;
          }
        }
        if (Array.isArray(removed)) {
          for (const it of removed) {
            const row = ensureDay(it?.date ?? it?.day);
            if (!row) continue;
            row.removed = Number(it?.value ?? it?.count ?? 0) || 0;
          }
        }
      } else {
        const text = await r.text().catch(() => "");
        console.log("yandex events/history status:", r.status, text.slice(0, 240));
      }
    } catch (e) { console.log("events history error:", (e as any)?.message); }

    try {
      const url = `${YANDEX_WEBMASTER_API}/user/${userId}/hosts/${encodeURIComponent(hostId)}/search-urls/events/samples/?offset=0&limit=100`;
      const r = await fetchWithTimeout(url, { headers: { Authorization: `OAuth ${token}` } }, 8_000, "yandex_events_samples");
      if (r.ok) {
        const j = await r.json();
        const urls = j?.samples ?? j?.sample ?? j?.urls ?? j?.excluded_urls ?? j?.items ?? [];
        if (Array.isArray(urls)) {
          const removed = urls.filter((u: any) => String(u?.event ?? u?.status ?? "").toUpperCase() === "REMOVED_FROM_SEARCH");
          const scoped = removed.filter((u: any) => inRange(day(u?.event_date ?? u?.date)));
          const rows = scoped.length ? scoped : removed;
          out.excluded_pages = rows.slice(0, 20).map((u: any) => ({
            url: String(u?.url ?? u?.page ?? ""),
            status: String(u?.excluded_url_status ?? u?.status ?? u?.exclude_status ?? u?.reason ?? "REMOVED_FROM_SEARCH"),
            date: day(u?.event_date ?? u?.date) || undefined,
            last_access: day(u?.last_access) || undefined,
            target_url: u?.target_url ? String(u.target_url) : undefined,
            http_status: u?.bad_http_status != null ? Number(u.bad_http_status) : undefined,
          })).filter((x: any) => x.url);
          out.excluded_count = scoped.length || removed.length || out.excluded_pages.length;
        }
      } else {
        const text = await r.text().catch(() => "");
        console.log("yandex events/samples status:", r.status, text.slice(0, 240));
      }
    } catch (e) { console.log("events samples error:", (e as any)?.message); }

    out.daily_indexed = Array.from(byDate.values())
      .filter((r) => r.date)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (!out.excluded_count) {
      out.excluded_count = out.daily_indexed.reduce((sum, r) => sum + (Number(r.removed ?? 0) || 0), 0);
    }
    return out;
  }
  const indexing = loadIndexing ? await fetchIndexing() : undefined;

  return {
    clicks,
    impressions,
    ctr: impressions ? clicks / impressions : 0,
    position: positionWeight ? weightedPosition / positionWeight : 0,
    queries,
    daily_data,
    daily_data_prev,
    indexing,
  };
}

async function fetchMetrika(token: string, counterId: string, date1: string, date2: string, opts: { withChannels?: boolean } = {}) {
  const base = { ids: counterId, date1, date2, accuracy: "full" };
  const ORGANIC_FILTER = "ym:s:lastSignTrafficSource=='organic'";
  const [totals, sources, engines, pages, searchEngines, searchPhrases, organicPages] = await Promise.all([
    metrikaRequest(token, { ...base, metrics: "ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds", filters: ORGANIC_FILTER }).catch((e) => ({ __error: e, totals: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:lastSignTrafficSource", filters: ORGANIC_FILTER, limit: "20" }).catch((e) => ({ __error: e, data: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:searchEngineRoot", filters: ORGANIC_FILTER, limit: "20" }).catch((e) => ({ __error: e, data: [] })),
    metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:startURL", filters: ORGANIC_FILTER, limit: "25", sort: "-ym:s:visits" }).catch((e) => ({ __error: e, data: [] })),
    // Search engines breakdown (organic only) — per ПС: visits, users, bounce, depth, duration
    metrikaRequest(token, {
      ...base,
      metrics: "ym:s:visits,ym:s:users,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds",
      dimensions: "ym:s:searchEngine",
      filters: ORGANIC_FILTER,
      limit: "20",
      sort: "-ym:s:visits",
    }).catch((e) => ({ __error: e, data: [] })),
    // Top search phrases (organic)
    metrikaRequest(token, {
      ...base,
      metrics: "ym:s:visits,ym:s:bounceRate",
      dimensions: "ym:s:searchPhrase",
      filters: ORGANIC_FILTER,
      limit: "50",
      sort: "-ym:s:visits",
    }).catch((e) => ({ __error: e, data: [] })),
    // Top organic landing pages
    metrikaRequest(token, {
      ...base,
      metrics: "ym:s:visits,ym:s:bounceRate,ym:s:pageDepth,ym:s:avgVisitDurationSeconds",
      dimensions: "ym:s:startURL",
      filters: ORGANIC_FILTER,
      limit: "30",
      sort: "-ym:s:visits",
    }).catch((e) => ({ __error: e, data: [] })),
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
      filters: ORGANIC_FILTER,
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
      // Without organic filter — show overall device/region distribution so the panel
      // is informative even when current-period organic visits are 0.
      const [devRes, regRes] = await Promise.all([
        metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:deviceCategory", limit: "10" }).catch(() => ({ data: [] })),
        metrikaRequest(token, { ...base, metrics: "ym:s:visits", dimensions: "ym:s:regionCity", limit: "10", sort: "-ym:s:visits" }).catch(() => ({ data: [] })),
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
    search_engines: ((searchEngines as any).data ?? []).map((r: any) => ({
      name: r.dimensions[0]?.name ?? r.dimensions[0]?.id ?? "—",
      visits: Number(r.metrics?.[0] ?? 0),
      users: Number(r.metrics?.[1] ?? 0),
      bounce_rate: Math.round(Number(r.metrics?.[2] ?? 0) * 10) / 10,
      depth: Math.round(Number(r.metrics?.[3] ?? 0) * 100) / 100,
      duration: Math.round(Number(r.metrics?.[4] ?? 0)),
    })),
    search_phrases: ((searchPhrases as any).data ?? []).map((r: any) => ({
      phrase: r.dimensions[0]?.name ?? r.dimensions[0]?.id ?? "—",
      visits: Number(r.metrics?.[0] ?? 0),
      bounce_rate: Math.round(Number(r.metrics?.[1] ?? 0) * 10) / 10,
    })),
    organic_pages: ((organicPages as any).data ?? []).map((r: any) => ({
      url: r.dimensions[0]?.name ?? r.dimensions[0]?.id ?? "—",
      visits: Number(r.metrics?.[0] ?? 0),
      bounce_rate: Math.round(Number(r.metrics?.[1] ?? 0) * 10) / 10,
      depth: Math.round(Number(r.metrics?.[2] ?? 0) * 100) / 100,
      duration: Math.round(Number(r.metrics?.[3] ?? 0)),
    })),
    daily_data,
    daily_channels,
    daily_combined: merged_daily,
    devices,
    regions,
  };
}

// ============ Google Search Console (via connector gateway) ============
// ============ Topvisor ============
async function tvRequest(apiKey: string, userId: string, path: string, body: any, timeoutMs = 12_000) {
  const r = await fetchWithTimeout(`https://api.topvisor.com/v2/json/${path}`, {
    method: "POST",
    headers: {
      "User-Id": String(userId),
      "Authorization": `bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }, timeoutMs, "topvisor");
  const j: any = await r.json().catch(() => ({}));
  if (!r.ok || j?.errors) {
    const err: any = new Error(`topvisor_${r.status}`);
    err.status = r.status;
    err.payload = j;
    throw err;
  }
  return j;
}

async function resolveRegionIndexes(apiKey: string, userId: string, projectId: string): Promise<string[]> {
  const pid = Number(projectId) || projectId;
  const j = await tvRequest(apiKey, userId, "get/projects_2/projects", {
    show_searchers_and_regions: "1",
    filters: [{ name: "id", operator: "EQUALS", values: [pid] }],
  });
  const projects: any[] = j?.result ?? j?.projects ?? [];
  const project = projects.find((p) => String(p?.id) === String(pid)) ?? projects[0];
  const sr: any[] = project?.searchers_and_regions ?? project?.searchers ?? [];
  const indexes: string[] = [];
  for (const s of sr) {
    const regions: any[] = s?.regions ?? [];
    for (const reg of regions) {
      const idx = reg?.index ?? reg?.region_index ?? reg?.id;
      if (idx != null) indexes.push(String(idx));
    }
  }
  return indexes;
}

async function fetchTopvisor(apiKey: string, userId: string, projectId: string, date1: string, date2: string) {
  const regionIndexes = await resolveRegionIndexes(apiKey, userId, projectId);
  if (!regionIndexes.length) {
    const err: any = new Error("topvisor_no_regions");
    err.status = 400;
    err.payload = { message: "No regions configured for project" };
    throw err;
  }
  const body = {
    project_id: Number(projectId) || projectId,
    regions_indexes: regionIndexes,
    date1,
    date2,
    show_headers: 1,
    positions_fields: ["position"],
  };
  const j = await tvRequest(apiKey, userId, "get/positions_2/history", body);

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
  let top1 = 0, top3 = 0, top10 = 0, top30 = 0, outside = 0;
  const lostList: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = [];
  const positions: Record<string, number> = {};
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
      positions[name] = last;
      if (last === 1) top1++;
      if (last <= 3) top3++;
      if (last <= 10) top10++;
      if (last <= 30) top30++;
      if (last > 30) outside++;
    } else {
      outside++;
    }
    if (last != null && first != null && last > first) {
      lostList.push({ query: name, pos_was: first, pos_now: last, delta: Math.round((last - first) * 10) / 10 });
    }
  }
  lostList.sort((a, b) => b.delta - a.delta);

  return {
    top1,
    top3,
    top10,
    top30,
    outside,
    keywords_total: keywords.length,
    distribution: { top1, top3, top10, top30, outside, total_keywords: keywords.length },
    positions,
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
7. ЗАПРЕЩЕНО использовать в гипотезах и evidence метрики с delta = -100% или value = 0, если по другим источникам эта же метрика > 0 — это признак пустой выгрузки (не подключён источник), а не реальная просадка. Такие цифры игнорируются, а факт отсутствия данных фиксируется в data_completeness.
8. Если подключён только 1 источник данных из 4 (GSC / Яндекс.Вебмастер / Метрика / Топвизор) — в headline.summary ПЕРВОЙ фразой обязательно предупредить: "Анализ ограничен: подключён только <источник>. Для полной диагностики подключите: <перечислить недостающие>". Дублировать это в data_completeness.warning.

АЛГОРИТМ АНАЛИЗА:
1. Определи паттерн по signals.pattern
2. Найди топ-3 URL с максимальными потерями кликов — они дают X% от общего падения
3. Найди топ-3 запроса с максимальными потерями — вычисли их долю
4. Сравни impressions vs clicks delta — если impressions упали меньше чем clicks — проблема в CTR
5. Сравни позиции — если позиции улучшились а клики упали — проблема в сниппете или SERP-фичах
6. Brand vs non-brand — расхождение указывает на источник проблемы
7. Если в yandex.indexing присутствуют данные: рост excluded_count или падение последнего значения daily_indexed[].count относительно начала периода — это сильное доказательство ТЕХНИЧЕСКОЙ причины (deindexation), а не алгоритмического понижения. Такая гипотеза должна получить probability ≥ 75 и приоритет P1 с рекомендацией проверить robots/canonical/мета-noindex/server-status исключённых URL.
8. Если присутствует metrika.search_engines_delta — ОБЯЗАТЕЛЬНО сравнить дельту по каждой поисковой системе (Яндекс, Google, Bing, Mail.ru, DuckDuckGo и т.д.). Если падение в одной ПС сильно больше, чем в другой (например, Яндекс −50%, Google −5%) — фиксируй это как гипотезу "проблема специфична для ПС X" с probability ≥ 75 и рекомендациями конкретно под эту ПС (для Яндекса — Вебмастер/фильтры/переоптимизация; для Google — Search Console/Core Update/технические сигналы). Если падение равномерное по всем ПС — это, наоборот, аргумент против "алгоритмической" гипотезы и повод искать техническую причину (индексация, доступность, редиректы, аналитика).

ФОРМАТ ГИПОТЕЗ (минимум 3, максимум 5, от сильной к слабой):
Каждая гипотеза ОБЯЗАНА содержать:
- hypothesis: конкретная формулировка ("Просадка Яндекса из-за деиндексации 47 URL", а не "проблема с индексацией")
- probability: 0–100, рассчитан по правилу №6
- evidence: массив из МИНИМУМ 2 объектов {source, metric, was, now, delta} — реальные цифры из данных
- contradicts: 1 предложение, какие данные ПРОТИВОРЕЧАТ этой гипотезе (или "нет противоречий: <почему>")
- verification_step: КОНКРЕТНЫЙ шаг (инструмент + путь + фильтр + что смотреть). Пример: "GSC → Pages → Indexing → фильтр 'Crawled - currently not indexed' → выгрузить список, проверить по 5 URL: canonical, robots.txt, meta robots, HTTP-статус"

ФОРМАТ РЕКОМЕНДАЦИЙ (P1/P2/P3, минимум 5 пунктов если данных достаточно):
Каждый пункт ОБЯЗАН содержать:
- title: конкретное действие ("Вернуть в индекс 12 страниц категорий /catalog/*"), НЕ общее ("Проверить индексацию")
- target: конкретный URL или запрос ИЗ ДАННЫХ (lost_pages / lost_queries). Если рекомендация не привязана к URL/запросу — не включать её
- why: 1 предложение с цифрой из evidence
- action: пошаговая инструкция (2–4 шага) — инструмент → путь → фильтр → что делать. НЕ "проверить", а "открыть X → зайти в Y → отфильтровать по Z → выполнить W"
- owner: "SEO" | "Dev" | "Content" | "PM"
- deadline_days: число дней (P1: 1–3, P2: 7–14, P3: 30+)
- kpi: { metric, target_delta ("+15%" или "≥50 переходов/нед"), measure_after_days }
- ice: {impact 1–10, confidence 1–10, ease 1–10, score = I*C*E}. Если данных мало — confidence=3

Не пиши воду. Только цифры и выводы из них.

ОБЯЗАТЕЛЬНЫЕ РАЗДЕЛЫ В JSON:
- data_completeness: объект { sources_connected: [], sources_missing: [], warning: "…" | null, limitations: [] }. warning заполняется если подключено < 2 источников.
- executive_summary: { one_line, verdict_type ("алгоритм" | "техника" | "сезонность" | "контент" | "смешанное"), verdict_reasoning }
- diagnosis_pattern: один из ключей паттерна выше + 1 предложение почему.
- root_cause_hypotheses: 3–5 гипотез по формату выше.
- impact_breakdown: топ-5 страниц/запросов с долей в общей потере кликов (share_of_loss_pct).
- recommendations: минимум 5 пунктов (если хватает данных): P1 (1–3 дня), P2 (7–14 дней), P3 (30+ дней) по формату выше.
- next_steps: ручные проверки за пределами данных (server logs, GSC Coverage, шаблон, индексация, AI Overviews захват и т.д.).

ФОРМАТ ВЫВОДА — СТРОГО валидный JSON без markdown:
{
  "seo_score": 0-100,
  "score_reasoning": "1–2 предложения, почему именно столько. ПРАВИЛА расчёта (строго): если клики упали >20% в обеих системах (GSC и Яндекс/Метрика) — seo_score не выше 55. Если >20% только в одной системе — не выше 65. Если падение >35% хотя бы в одной — не выше 45. Стабильно (±5%) — 70–80. Рост >10% — 80+.",
  "data_completeness": { "sources_connected": ["GSC"], "sources_missing": ["Яндекс.Вебмастер","Яндекс.Метрика","Топвизор"], "warning": "Анализ ограничен — подключите …", "limitations": ["Без Метрики нельзя оценить поведенческие","Без Топвизора нет позиций по регионам"] },
  "executive_summary": { "one_line": "Что случилось, где, насколько серьёзно — одной фразой с цифрой", "verdict_type": "техника|алгоритм|сезонность|контент|смешанное", "verdict_reasoning": "1–2 предложения с цифрами почему именно этот вердикт" },
  "headline": {
    "direction": "up|down|stable",
    "main_metric": "organic_visits|clicks|impressions|position|ctr",
    "delta_pct": -100..100,
    "summary": "ТОЛЬКО краткий тезис в одно предложение: что произошло. Без деталей, без причин, без рекомендаций. Если подключён 1 источник — начни с предупреждения об ограниченности анализа."
  },
  "diagnosis_pattern": { "code": "visibility_loss|ctr_decay|impressions_drop_clicks_stable|position_up_clicks_down_anomaly|seasonality|mixed", "explanation": "..." },
  "main_cause": {
    "title": "Краткая формулировка корневой причины",
    "confidence": "high|medium|low",
    "evidence": [ { "source": "Yandex|Metrika|GSC", "metric": "...", "was": "...", "now": "...", "delta": "..." } ],
    "conclusion": "Развёрнутый вывод в 3–4 предложения с цифрами и контекстом. НЕ ПОВТОРЯЙ дословно headline.summary — это должен быть другой текст, раскрывающий тезис глубже: причины, механика, последствия."
  },
  "root_cause_hypotheses": [
    { "hypothesis": "...", "probability": 0-100, "evidence": [{ "source":"...","metric":"...","was":"...","now":"...","delta":"..." }], "contradicts": "...", "verification_step": "Инструмент → путь → фильтр → что смотреть" }
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
      "target": "URL или запрос из данных",
      "why": "Привязка к найденной причине + цифра из evidence",
      "action": "Пошагово: инструмент → путь → фильтр → что делать. 2–4 шага.",
      "owner": "SEO|Dev|Content|PM",
      "deadline_days": 3,
      "kpi": { "metric": "clicks|impressions|position|ctr|indexed_pages", "target_delta": "+15%", "measure_after_days": 14 },
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

async function callAIOnce(key: string, payload: any, strictJson = false, timeoutMs = 55_000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(`ai_timeout_${timeoutMs}ms`), timeoutMs);
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
        model: "google/gemini-2.5-flash",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.2,
        max_tokens: 5000,
      }),
    });
    console.log("OpenRouter response status:", r.status);
    const raw = await r.text();
    if (!r.ok) throw new Error(`OpenRouter ${r.status}: ${raw.slice(0, 400)}`);
    let j: any;
    try { j = JSON.parse(raw); } catch { throw new Error("openrouter_envelope_parse_failed"); }
    const txt = j.choices?.[0]?.message?.content ?? "";
    console.log("Finish reason:", j.choices?.[0]?.finish_reason ?? "unknown");
    console.log("Content length:", String(txt).length);
    if (!txt) throw new Error("ai_empty_response");
    return extractJson(txt);
  } catch (e) {
    if (controller.signal.aborted) throw new Error(`ai_timeout_${timeoutMs}ms`);
    if (typeof e === "string") throw new Error(e);
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

async function callAI(key: string, payload: any) {
  const size = JSON.stringify(payload).length;
  console.log("AI payload size:", size);
  try {
    if (size > 18_000) throw new Error("ai_skipped_large_payload");
    return await callAIOnce(key, payload, false, AI_FETCH_TIMEOUT_MS);
  } catch (e1) {
    console.log("AI attempt 1 failed:", (e1 as any)?.message);
    const message = String((e1 as any)?.message ?? "");
    if (message.includes("aborted") || message.includes("timeout") || message.includes("skipped_large_payload")) {
      const err = new Error("ai_unavailable");
      (err as any).cause = message || "ai_timeout";
      throw err;
    }
    try {
      return await callAIOnce(key, payload, true, Math.min(8_000, AI_HARD_TIMEOUT_MS - AI_FETCH_TIMEOUT_MS));
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
    sources_used: result.sources_used,
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
    indexing: result.yandex.indexing ? {
      daily_indexed: take(result.yandex.indexing.daily_indexed, 30),
      excluded_pages: take(result.yandex.indexing.excluded_pages, 10),
      excluded_count: result.yandex.indexing.excluded_count,
    } : undefined,
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
      search_engines: take(result.metrika.current.search_engines, 10),
      search_phrases: take(result.metrika.current.search_phrases, 20),
      organic_pages: take(result.metrika.current.organic_pages, 15),
    },
    previous: { visits: result.metrika.previous.visits, users: result.metrika.previous.users, organic_visits: result.metrika.previous.organic_visits, pageviews: result.metrika.previous.pageviews, sources: result.metrika.previous.sources },
    delta: result.metrika.delta,
    search_engines_delta: take(result.metrika.search_engines_delta, 10),
  };
  return compact;
}

function fallbackAI(result: any, reason = "ai_unavailable") {
  const num = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const fmt = (v: any, suffix = "") => `${Math.round(num(v) * 100) / 100}${suffix}`;
  const pctText = (v: any) => `${num(v) > 0 ? "+" : ""}${fmt(v)}%`;
  const sourceRu = (s: string) => s === "GSC" ? "Google Search Console" : s === "Yandex" ? "Яндекс.Вебмастер" : s;
  const metricRu: Record<string, string> = {
    clicks: "клики",
    impressions: "показы",
    ctr: "CTR",
    position: "средняя позиция",
    organic_visits: "органические визиты",
  };
  const evidence = (source: string, metric: string, was: any, now: any, delta: any) => ({
    source,
    metric: metricRu[metric] ?? metric,
    was: fmt(was),
    now: fmt(now),
    delta: pctText(delta),
  });
  const metrics = [
    result.gsc ? { source: "GSC", metric: "clicks", now: result.gsc.current?.clicks, was: result.gsc.previous?.clicks, delta: result.gsc.delta?.clicks } : null,
    result.yandex ? { source: "Yandex", metric: "clicks", now: result.yandex.current?.clicks, was: result.yandex.previous?.clicks, delta: result.yandex.delta?.clicks } : null,
    result.metrika ? { source: "Metrika", metric: "organic_visits", now: result.metrika.current?.organic_visits, was: result.metrika.previous?.organic_visits, delta: result.metrika.delta?.organic_visits } : null,
    result.topvisor?.delta ? { source: "Топвизор", metric: "top10", now: result.topvisor.current?.top10, was: result.topvisor.previous?.top10, delta: result.topvisor.delta?.top10 } : null,
  ].filter(Boolean) as Array<{ source: string; metric: string; now: number; was: number; delta: number }>;
  const primary = [...metrics].sort((a, b) => Math.abs(num(b.delta)) - Math.abs(num(a.delta)))[0]
    ?? { source: "GSC", metric: "clicks", now: 0, was: 0, delta: 0 };
  const direction = num(primary.delta) < -5 ? "down" : num(primary.delta) > 5 ? "up" : "stable";

  const dropDeltas = metrics.filter(m => ["GSC", "Yandex", "Metrika"].includes(m.source)).map(m => num(m.delta));
  const majorDrops = dropDeltas.filter(d => d <= -20).length;
  const severeDrop = dropDeltas.some(d => d <= -35);
  let score = 72;
  if (direction === "up") score = 80;
  if (direction === "down") score = Math.max(35, 70 + Math.round(num(primary.delta) / 2));
  if (majorDrops >= 2) score = Math.min(score, 55);
  if (majorDrops === 1) score = Math.min(score, 65);
  if (severeDrop) score = Math.min(score, 45);

  const gscDiag = result.diagnostics?.gsc ?? {};
  const yaDiag = result.diagnostics?.yandex ?? {};
  const metrikaDiag = result.diagnostics?.metrika ?? {};
  const topvisor = result.topvisor;
  const indexing = result.yandex?.indexing;
  const indexedStart = indexing?.daily_indexed?.[0]?.count;
  const indexedEnd = indexing?.daily_indexed?.[indexing.daily_indexed.length - 1]?.count;
  const indexedDelta = indexedStart ? pct(indexedEnd ?? 0, indexedStart) : 0;
  const hasIndexingRisk = (num(indexing?.excluded_count) > 0 && num(indexing?.excluded_count) >= 20) || indexedDelta < -5;
  const gscLosses = (gscDiag.lost_queries_by_clicks ?? []).slice(0, 10);
  const yLosses = (yaDiag.lost_queries_by_clicks ?? []).slice(0, 10);
  const queryLosses = gscLosses.length ? gscLosses : yLosses;
  const pageLosses = [
    ...(gscDiag.lost_pages ?? []).map((p: any) => ({ url: p.url, was: p.clicks_was, now: p.clicks_now, delta_abs: p.delta_abs, delta_pct: p.delta_pct, source: "GSC" })),
    ...(metrikaDiag.lost_pages ?? []).map((p: any) => ({ url: p.url, was: p.visits_was, now: p.visits_now, delta_abs: p.delta_abs, delta_pct: p.delta_pct, source: "Metrika" })),
  ].sort((a: any, b: any) => num(a.delta_abs) - num(b.delta_abs));
  const totalClicksLost = Math.abs(num(result.gsc?.current?.clicks) - num(result.gsc?.previous?.clicks)) || Math.abs(num(result.yandex?.current?.clicks) - num(result.yandex?.previous?.clicks)) || 0;
  const contributors = [
    ...pageLosses.slice(0, 3).map((p: any) => ({ type: "page", name: p.url, clicks_lost: Math.abs(num(p.delta_abs)), share_of_loss_pct: totalClicksLost ? Math.round((Math.abs(num(p.delta_abs)) / totalClicksLost) * 1000) / 10 : 0 })),
    ...queryLosses.slice(0, 3).map((q: any) => ({ type: "query", name: q.query, clicks_lost: Math.abs(num(q.delta_abs)), share_of_loss_pct: totalClicksLost ? Math.round((Math.abs(num(q.delta_abs)) / totalClicksLost) * 1000) / 10 : 0 })),
  ].sort((a, b) => b.clicks_lost - a.clicks_lost).slice(0, 5);

  const hypotheses: any[] = [];
  if (hasIndexingRisk) {
    hypotheses.push({
      hypothesis: "Техническая проблема индексации могла стать главным драйвером просадки",
      probability: indexedDelta < -5 ? 85 : 75,
      evidence: [
        ...(indexedStart != null && indexedEnd != null ? [evidence("Yandex", "страниц в поиске", indexedStart, indexedEnd, indexedDelta)] : []),
        evidence("Yandex", "исключённые страницы", 0, indexing?.excluded_count ?? 0, indexing?.excluded_count ? 100 : 0),
      ],
      verification_step: "Проверить первые 20 исключённых URL: robots.txt, canonical, meta noindex, HTTP-статус, sitemap и дату последнего изменения шаблона.",
    });
  }
  if (result.gsc && num(result.gsc.delta?.clicks) < -5) {
    const ev = [evidence("GSC", "clicks", result.gsc.previous?.clicks, result.gsc.current?.clicks, result.gsc.delta?.clicks)];
    if (num(result.gsc.delta?.impressions) < -5) ev.push(evidence("GSC", "impressions", result.gsc.previous?.impressions, result.gsc.current?.impressions, result.gsc.delta?.impressions));
    if (Math.abs(num(result.gsc.delta?.position)) > 0.3) ev.push(evidence("GSC", "position", result.gsc.previous?.position, result.gsc.current?.position, result.gsc.delta?.position));
    hypotheses.push({
      hypothesis: num(result.gsc.delta?.impressions) < -10 ? "Падение видимости в Google: сайт стал реже показываться по части запросов" : "Падение кликов в Google без сопоставимой потери показов указывает на CTR/сниппеты или SERP-факторы",
      probability: ev.length >= 3 ? 85 : ev.length === 2 ? 65 : 40,
      evidence: ev,
      verification_step: "Открыть топ запросов/страниц с потерей кликов, сравнить title/description, тип сниппета, наличие спецэлементов выдачи и изменения позиций по датам.",
    });
  }
  if (result.metrika && num(result.metrika.delta?.organic_visits) < -5) {
    hypotheses.push({
      hypothesis: "Просадка подтверждается фактическими органическими визитами в Метрике, значит это не только изменение отчёта поисковой консоли",
      probability: result.gsc || result.yandex ? 65 : 40,
      evidence: [evidence("Metrika", "organic_visits", result.metrika.previous?.organic_visits, result.metrika.current?.organic_visits, result.metrika.delta?.organic_visits)],
      verification_step: "Сверить дневной график Метрики с датой перелома в GSC/Яндекс.Вебмастере и проверить, нет ли параллельного падения только на отдельных посадочных страницах.",
    });
  }
  if (topvisor?.delta && ["top3", "top10", "top30"].some(k => num(topvisor.delta?.[k]) < 0)) {
    hypotheses.push({
      hypothesis: "Позиционный фактор: часть запросов вышла из важных TOP-диапазонов",
      probability: [topvisor.delta.top3, topvisor.delta.top10, topvisor.delta.top30].filter((d: any) => num(d) < 0).length >= 2 ? 65 : 40,
      evidence: [
        evidence("Топвизор", "TOP-3", topvisor.previous?.top3, topvisor.current?.top3, topvisor.delta?.top3),
        evidence("Топвизор", "TOP-10", topvisor.previous?.top10, topvisor.current?.top10, topvisor.delta?.top10),
        evidence("Топвизор", "TOP-30", topvisor.previous?.top30, topvisor.current?.top30, topvisor.delta?.top30),
      ],
      verification_step: "Проверить таблицу потерянных позиций в Топвизоре: какие запросы вышли из TOP-3/TOP-10 и какие URL ранжируются сейчас.",
    });
  }
  if (hypotheses.length === 0) {
    hypotheses.push({
      hypothesis: "Сильного единого драйвера по подключённым источникам не видно — требуется ручная проверка событий и качества данных",
      probability: 40,
      evidence: [evidence(primary.source, primary.metric, primary.was, primary.now, primary.delta)],
      verification_step: "Проверить корректность выбранных периодов, доступы к источникам, релизы на сайте, robots.txt, sitemap и серверные логи за дату перелома.",
    });
  }

  const mainHypothesis = hypotheses[0];
  const recommendations = [
    {
      priority: "p1",
      title: hasIndexingRisk ? "Разобрать исключённые и выпавшие из поиска URL" : "Разобрать топ страниц и запросов с максимальной потерей",
      why: contributors[0]
        ? `Крупнейший вклад в падение даёт ${contributors[0].type === "page" ? "страница" : "запрос"} «${contributors[0].name}»: потеря ${fmt(contributors[0].clicks_lost)} кликов, доля ${fmt(contributors[0].share_of_loss_pct)}%.`
        : `Главная метрика изменилась: ${sourceRu(primary.source)} ${metricRu[primary.metric] ?? primary.metric}: ${fmt(primary.was)} → ${fmt(primary.now)} (${pctText(primary.delta)}).`,
      action: hasIndexingRisk
        ? "Для исключённых URL проверить HTTP-статус, robots.txt, meta robots, canonical, sitemap, внутренние ссылки и дату попадания в исключения; сначала исправить страницы с трафиком/позициями."
        : "Взять первые 5 URL/запросов из вкладок потерь, проверить индексацию, релевантность интента, title/description, сниппет и фактическую посадочную страницу в выдаче.",
      kpi: { metric: primary.metric === "organic_visits" ? "organic_visits" : "clicks", target_delta: "+10–15% за 14 дней" },
      ice: { impact: 9, confidence: 7, ease: 6, score: 378 },
    },
    {
      priority: "p2",
      title: "Сверить дату перелома с техническими и контентными изменениями",
      why: "Без внешнего AI-ответа причина рассчитана алгоритмически, поэтому нужно подтвердить её журналами релизов и дневными графиками.",
      action: "Сопоставить день максимальной просадки на графиках с деплоями, изменениями шаблонов, robots.txt, sitemap, canonical, редиректами и массовыми правками title/H1.",
      kpi: { metric: "clicks", target_delta: "локализовать 1–2 подтверждённые причины за 72 часа" },
      ice: { impact: 8, confidence: 6, ease: 7, score: 336 },
    },
    {
      priority: "p3",
      title: "Собрать контрольный список восстановления по группам URL",
      why: "Потери обычно концентрируются в нескольких шаблонах страниц или кластерах запросов; исправления нужно раскатывать не точечно, а группами.",
      action: "Сгруппировать потерянные URL по типу страницы, интенту и шаблону; для каждой группы зафиксировать baseline кликов/позиций и повторно измерить через 2 недели.",
      kpi: { metric: "position", target_delta: "вернуть 30–50% потерянных запросов в прежний TOP-диапазон" },
      ice: { impact: 7, confidence: 5, ease: 5, score: 175 },
    },
  ];

  const brand = gscDiag.brand_split;
  const brandAnalysis = brand ? {
    brand_clicks_delta_pct: brand.brand?.delta_pct ?? 0,
    non_brand_clicks_delta_pct: brand.non_brand?.delta_pct ?? 0,
    interpretation: `Бренд: ${fmt(brand.brand?.clicks_was)} → ${fmt(brand.brand?.clicks_now)} (${pctText(brand.brand?.delta_pct)}), небренд: ${fmt(brand.non_brand?.clicks_was)} → ${fmt(brand.non_brand?.clicks_now)} (${pctText(brand.non_brand?.delta_pct)}).`,
  } : null;

  return {
    seo_score: score,
    score_reasoning: `Резервный расчёт без внешнего AI: ${sourceRu(primary.source)} ${metricRu[primary.metric] ?? primary.metric}: ${fmt(primary.was)} → ${fmt(primary.now)} (${pctText(primary.delta)}). Строгий лимит score применён по величине падения в подключённых источниках.`,
    headline: {
      direction,
      main_metric: primary.metric,
      delta_pct: num(primary.delta),
      summary: direction === "down"
        ? `Органический трафик снизился: главный сигнал — ${sourceRu(primary.source)} ${metricRu[primary.metric] ?? primary.metric} ${pctText(primary.delta)}`
        : direction === "up"
          ? `Органический трафик вырос: главный сигнал — ${sourceRu(primary.source)} ${metricRu[primary.metric] ?? primary.metric} ${pctText(primary.delta)}`
          : "Существенного изменения органического трафика по подключённым источникам не видно",
    },
    diagnosis_pattern: {
      code: result.diagnostics?.gsc?.signals?.pattern ?? result.diagnostics?.yandex?.signals?.pattern ?? (hasIndexingRisk ? "visibility_loss" : "mixed"),
      explanation: hasIndexingRisk ? "Есть сигнал индексации Яндекса: исключённые URL или снижение страниц в поиске." : "Паттерн рассчитан автоматически по кликам, показам, CTR, позициям и органическим визитам.",
    },
    main_cause: {
      title: mainHypothesis.hypothesis,
      confidence: num(mainHypothesis.probability) >= 70 ? "high" : num(mainHypothesis.probability) >= 50 ? "medium" : "low",
      evidence: mainHypothesis.evidence,
      conclusion: `${mainHypothesis.hypothesis}. Ключевой факт: ${sourceRu(primary.source)} ${metricRu[primary.metric] ?? primary.metric}: ${fmt(primary.was)} → ${fmt(primary.now)} (${pctText(primary.delta)}). Сначала нужно подтвердить гипотезу через проверку топ-потерь и индексации, затем исправлять наиболее вкладовые URL/запросы.`,
    },
    root_cause_hypotheses: hypotheses.slice(0, 4),
    causes: hypotheses.slice(0, 3).map((h) => ({
      title: h.hypothesis,
      confidence: num(h.probability) >= 70 ? "high" : num(h.probability) >= 50 ? "medium" : "low",
      evidence: h.evidence,
      conclusion: h.verification_step,
    })),
    impact_breakdown: { total_clicks_lost: totalClicksLost, top_loss_contributors: contributors },
    brand_analysis: brandAnalysis,
    lost_pages: pageLosses.slice(0, 10).map((p: any) => ({ url: p.url, was: p.was, now: p.now, delta_pct: p.delta_pct, source: p.source })),
    lost_queries: queryLosses.slice(0, 10).map((q: any) => ({
      query: q.query,
      clicks_was: q.clicks_was,
      clicks_now: q.clicks_now,
      position_was: q.pos_was,
      position_now: q.pos_now,
      diagnosis: num(q.impr_now) < num(q.impr_was) ? "Падает видимость запроса: проверить позицию, релевантность URL и индексацию." : "Показы не просели пропорционально кликам: проверить CTR, сниппет и SERP-фичи.",
    })),
    recommendations,
    next_steps: [
      "Проверить дату перелома на графиках Google/Яндекс/Метрика и сопоставить с релизами сайта.",
      "Проверить индексацию топ URL: robots.txt, canonical, noindex, HTTP-статусы, sitemap и внутренние ссылки.",
      "Проверить выдачу вручную по топ потерянным запросам: какой URL ранжируется, изменился ли сниппет и появились ли SERP-фичи.",
      ...(Array.isArray(result.errors) && result.errors.length ? ["Устранить ошибки источников данных, чтобы следующий анализ получил полную доказательную базу."] : []),
    ],
    timeline_notes: [`Резервный вывод сформирован автоматически: внешний AI-ответ не был использован (${reason}).`],
  };
}

function normalizeAI(ai: any, result: any, reason = "ai_incomplete") {
  const fallback = fallbackAI(result, reason);
  const out: any = ai && typeof ai === "object" && !Array.isArray(ai) ? { ...ai } : {};

  if (typeof out.seo_score !== "number") out.seo_score = fallback.seo_score;
  if (!out.score_reasoning) out.score_reasoning = fallback.score_reasoning;
  if (!out.headline?.summary) out.headline = fallback.headline;
  if (!out.diagnosis_pattern?.code) out.diagnosis_pattern = fallback.diagnosis_pattern;
  if (!out.main_cause?.title || !Array.isArray(out.main_cause?.evidence) || out.main_cause.evidence.length === 0) {
    out.main_cause = fallback.main_cause;
  }

  if (!Array.isArray(out.root_cause_hypotheses) || out.root_cause_hypotheses.length === 0) {
    out.root_cause_hypotheses = fallback.root_cause_hypotheses;
  }
  if (!Array.isArray(out.causes) || out.causes.length === 0) {
    out.causes = fallback.causes;
  }
  if (!out.impact_breakdown || !Array.isArray(out.impact_breakdown.top_loss_contributors)) {
    out.impact_breakdown = fallback.impact_breakdown;
  }
  if (!Array.isArray(out.lost_pages) || out.lost_pages.length === 0) {
    out.lost_pages = fallback.lost_pages;
  }
  if (!Array.isArray(out.lost_queries) || out.lost_queries.length === 0) {
    out.lost_queries = fallback.lost_queries;
  }
  if (!Array.isArray(out.recommendations) || out.recommendations.length === 0) {
    out.recommendations = fallback.recommendations;
  }
  if (!Array.isArray(out.next_steps) || out.next_steps.length === 0) {
    out.next_steps = fallback.next_steps;
  }
  if (!Array.isArray(out.timeline_notes)) out.timeline_notes = [];
  if (out.brand_analysis == null && fallback.brand_analysis) out.brand_analysis = fallback.brand_analysis;
  out.autofilled = true;
  out.autofill_reason = reason;
  return out;
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
          // Per-search-engine delta (visits)
          const prevByEngine = new Map<string, number>();
          (prv.search_engines ?? []).forEach((r: any) => prevByEngine.set(String(r.name).toLowerCase(), Number(r.visits ?? 0)));
          const search_engines_delta = (cur.search_engines ?? []).map((r: any) => {
            const was = prevByEngine.get(String(r.name).toLowerCase()) ?? 0;
            const now = Number(r.visits ?? 0);
            const dPct = was ? Math.round(((now - was) / was) * 1000) / 10 : (now ? 100 : 0);
            return { name: r.name, was, now, delta_abs: now - was, delta_pct: dPct, bounce_rate: r.bounce_rate, depth: r.depth };
          });
          // Include engines that existed before but disappeared now
          const curNames = new Set((cur.search_engines ?? []).map((r: any) => String(r.name).toLowerCase()));
          (prv.search_engines ?? []).forEach((r: any) => {
            if (!curNames.has(String(r.name).toLowerCase()) && Number(r.visits ?? 0) > 0) {
              search_engines_delta.push({ name: r.name, was: Number(r.visits ?? 0), now: 0, delta_abs: -Number(r.visits ?? 0), delta_pct: -100, bounce_rate: r.bounce_rate, depth: r.depth });
            }
          });
          search_engines_delta.sort((a: any, b: any) => (b.was + b.now) - (a.was + a.now));
          result.metrika = { current: cur, previous: prv, search_engines_delta, delta: {
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
            fetchYandexWebmaster(accessToken, yandex_host, prev.date1, prev.date2, undefined, undefined, false),
          ]);
          result.yandex = { current: cur, previous: prv, delta: {
            clicks: pct(cur.clicks, prv.clicks),
            impressions: pct(cur.impressions, prv.impressions),
            ctr: pct(cur.ctr, prv.ctr),
            position: Math.round((cur.position - prv.position) * 10) / 10,
          }, daily_data: cur.daily_data, daily_data_prev: prv.daily_data, indexing: cur.indexing };
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
        const cur = await fetchTopvisor(topvisor_key, topvisor_user_id, topvisor_project_id, date1, date2);
        let prv: any = null;
        try {
          prv = await fetchTopvisor(topvisor_key, topvisor_user_id, topvisor_project_id, prev.date1, prev.date2);
        } catch (_e) { /* предыдущий период необязателен */ }

        const curDist = cur.distribution;
        const prvDist = prv?.distribution ?? null;
        const delta = prvDist ? {
          top1: curDist.top1 - prvDist.top1,
          top3: curDist.top3 - prvDist.top3,
          top10: curDist.top10 - prvDist.top10,
          top30: curDist.top30 - prvDist.top30,
          outside: curDist.outside - prvDist.outside,
        } : null;

        // per-keyword movement (only if both periods have data)
        const lost_positions: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = [];
        const gained_positions: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = [];
        if (prv?.positions) {
          for (const [name, posNow] of Object.entries(cur.positions as Record<string, number>)) {
            const posWas = (prv.positions as Record<string, number>)[name];
            if (posWas == null || !Number.isFinite(posWas)) continue;
            const d = Math.round((posNow - posWas) * 10) / 10;
            if (d > 0.5) lost_positions.push({ query: name, pos_was: posWas, pos_now: posNow, delta: d });
            else if (d < -0.5) gained_positions.push({ query: name, pos_was: posWas, pos_now: posNow, delta: d });
          }
          lost_positions.sort((a, b) => b.delta - a.delta);
          gained_positions.sort((a, b) => a.delta - b.delta);
        }

        result.topvisor = {
          // backward-compat surface
          top1: cur.top1, top3: cur.top3, top10: cur.top10, top30: cur.top30,
          keywords_total: cur.keywords_total,
          history: cur.history,
          // new comparison surface
          current: curDist,
          previous: prvDist,
          delta,
          lost_positions: lost_positions.length ? lost_positions.slice(0, 15) : cur.lost_positions,
          gained_positions: gained_positions.slice(0, 15),
        };
        if (prv) {
          result.topvisor_prev = { history: prv.history, top1: prv.top1, top3: prv.top3, top10: prv.top10, top30: prv.top30, keywords_total: prv.keywords_total };
        }
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

    // Sources used — for AI grounding and DOCX header
    {
      const connected: string[] = [];
      const missing: string[] = [];
      if (result.gsc) connected.push("Google Search Console" + (gsc_site ? ` (${gsc_site})` : ""));
      else missing.push("Google Search Console");
      if (result.yandex) connected.push("Яндекс.Вебмастер" + (yandex_host ? ` (${yandex_host})` : ""));
      else missing.push("Яндекс.Вебмастер");
      if (result.metrika) connected.push("Яндекс.Метрика" + (counter_id ? ` (ID ${counter_id})` : ""));
      else missing.push("Яндекс.Метрика");
      if (result.topvisor) connected.push("Топвизор" + (topvisor_project_id ? ` (проект ${topvisor_project_id})` : ""));
      else missing.push("Топвизор");
      result.sources_used = {
        connected,
        missing,
        connected_count: connected.length,
        warning: connected.length < 2 ? `Анализ ограничен: подключено ${connected.length} из 4 источников. Подключите: ${missing.join(", ")}.` : null,
      };
    }

    // AI
    const orKey = await getOpenRouterKey(sb);
    let ai: any;
    if (!orKey) {
      console.log("AI fallback used: openrouter_key_missing");
      ai = fallbackAI(result, "openrouter_key_missing");
      ai.fallback = true;
      ai.reason = "openrouter_key_missing";
    } else {
      try {
        ai = normalizeAI(await callAI(orKey, compactForAI(result)), result, "ai_incomplete_sections");
      } catch (e) {
        console.log("AI fallback used:", (e as any)?.message);
        ai = fallbackAI(result, (e as any)?.cause ?? (e as any)?.message ?? "ai_error");
        ai.fallback = true;
        ai.reason = (e as any)?.cause ?? (e as any)?.message ?? "ai_error";
      }
    }
    return new Response(JSON.stringify({ ...result, ai, errors }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});