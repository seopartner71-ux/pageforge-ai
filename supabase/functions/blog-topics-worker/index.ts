// deploy: v12 - DFS use location_name, drop bad autocomplete endpoint, sanitize keywords
// blog-topics-worker — поиск тем для блога. Конкуренция определяется
// в первую очередь по Keyword Difficulty (KD) от DataForSEO Labs,
// SERP-проверка через Serper.dev оставлена как fallback / уточнение.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY_ENV = Deno.env.get("OPENROUTER_API_KEY") ?? "";
const SERPER_KEY_ENV = Deno.env.get("SERPER_API_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

const AI_MODEL = "google/gemini-2.5-flash";
const AI_URL = "https://openrouter.ai/api/v1/chat/completions";

// OpenRouter key resolver: env first, then system_settings.openrouter_api_key
let _aiKeyCache: { key: string; ts: number } | null = null;
const AI_KEY_TTL_MS = 5 * 60 * 1000;
async function getOpenRouterKey(): Promise<string> {
  if (OPENROUTER_API_KEY_ENV) return OPENROUTER_API_KEY_ENV;
  if (_aiKeyCache && Date.now() - _aiKeyCache.ts < AI_KEY_TTL_MS) return _aiKeyCache.key;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await sb
      .from("system_settings")
      .select("key_value")
      .eq("key_name", "openrouter_api_key")
      .maybeSingle();
    const key = String((data as any)?.key_value ?? "").trim();
    _aiKeyCache = { key, ts: Date.now() };
    return key;
  } catch (e) {
    console.warn("[OpenRouter] system_settings read failed:", (e as Error).message);
    return "";
  }
}
const OPENROUTER_HEADERS_EXTRA = {
  "HTTP-Referer": "https://seo-modul.pro",
  "X-Title": "SEO-Audit Blog Topics",
};

const MAX_TOPICS = 500;
const MAX_SERP_QUERIES = 50;
const MIN_FREQUENCY = 50;

// Google Ads / DataForSEO location codes (NOT Yandex Wordstat geo IDs).
// Russian cities aren't standalone Google Ads geo-targets, so all RU regions
// fall back to country-level RU=2643. Intl regions use real country codes.
const DFS_LOCATION_CODES: Record<string, number> = {
  "Россия": 2643,
  "Москва": 2643,
  "Санкт-Петербург": 2643,
  "Екатеринбург": 2643,
  "Новосибирск": 2643,
  "Казань": 2643,
  "Нижний Новгород": 2643,
  "Челябинск": 2643,
  "Самара": 2643,
  "Уфа": 2643,
  "Ростов-на-Дону": 2643,
  "Краснодар": 2643,
  "United States": 2840,
  "United Kingdom": 2826,
  "Germany": 2276,
  "France": 2250,
  "Spain": 2724,
};
const DFS_LANGUAGE_CODES: Record<string, string> = {
  "United States": "en",
  "United Kingdom": "en",
  "Germany": "de",
  "France": "fr",
  "Spain": "es",
};
function dfsLocation(region: string): number {
  return DFS_LOCATION_CODES[region] ?? 2643;
}
function dfsLanguage(region: string): string {
  return DFS_LANGUAGE_CODES[region] ?? "ru";
}
const DFS_LOCATION_NAMES: Record<string, string> = {
  "United States": "United States",
  "United Kingdom": "United Kingdom",
  "Germany": "Germany",
  "France": "France",
  "Spain": "Spain",
};
function dfsLocationName(region: string): string {
  return DFS_LOCATION_NAMES[region] ?? "Russia";
}

// DataForSEO rejects keywords containing characters like ?, !, *, etc.
// Allowed: letters (any unicode), digits, spaces, dash, apostrophe.
function sanitizeKeyword(kw: string): string {
  return kw
    .replace(/[?!*"'`<>+\[\]{}()|\\\/.,:;@#$%^&=~]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
function dfsAuth(): string {
  return "Basic " + btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`);
}
function dfsConfigured(): boolean {
  return !!(DFS_LOGIN && DFS_PASSWORD);
}

const INFO_MARKERS = [
  "как ", "что ", "почему", "зачем", "сколько", "когда ",
  "где ", "какой ", "какая ", "какие ", "можно ли", "нужно ли",
  "чем ", "стоит ли",
];
const COMMERCIAL_STOP = [
  "купить", "цена", "цены", "заказать", "стоимость", "недорого",
  "доставка", "магазин", "распродажа", "акция", "скидк",
];

const STRONG_DOMAINS = [
  "wikipedia.org", "dzen.ru", "rbc.ru", "ria.ru",
  "kommersant.ru", "forbes.ru", "vc.ru", "habr.com",
  "youtube.com", "vk.com", "ok.ru", "mail.ru",
  "gosuslugi.ru", "consultant.ru", "garant.ru",
  "lenta.ru", "tass.ru", "interfax.ru", "kp.ru",
];

function sb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

// =====================================================================
// PROXY RELAY — see semantic-core-worker for full contract docs.
// =====================================================================
let __proxyCfgCache: { url: string; enabled: boolean; token: string; ts: number } | null = null;
async function getProxyConfig(): Promise<{ url: string; enabled: boolean; token: string }> {
  if (__proxyCfgCache && Date.now() - __proxyCfgCache.ts < 30_000) return __proxyCfgCache;
  let url = Deno.env.get("PROXY_URL") ?? "";
  let enabled = (Deno.env.get("PROXY_ENABLED") ?? "").toLowerCase() === "true";
  let token = Deno.env.get("PROXY_TOKEN") ?? "";
  try {
    const { data } = await sb()
      .from("system_settings")
      .select("key_name,key_value")
      .in("key_name", ["proxy_url", "proxy_enabled", "proxy_token"]);
    if (data) {
      for (const row of data as Array<{ key_name: string; key_value: string }>) {
        if (row.key_name === "proxy_url" && row.key_value) url = row.key_value;
        else if (row.key_name === "proxy_enabled") enabled = String(row.key_value).toLowerCase() === "true";
        else if (row.key_name === "proxy_token" && row.key_value) token = row.key_value;
      }
    }
  } catch (_e) { /* fall back to env */ }
  __proxyCfgCache = { url, enabled, token, ts: Date.now() };
  return __proxyCfgCache;
}
async function proxyFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const cfg = await getProxyConfig();
  if (!cfg.enabled || !cfg.url) return await fetch(url, options);
  let bodyStr: string | null = null;
  if (options.body != null) bodyStr = typeof options.body === "string" ? options.body : String(options.body);
  const headersObj: Record<string, string> = {};
  if (options.headers) {
    if (options.headers instanceof Headers) options.headers.forEach((v, k) => { headersObj[k] = v; });
    else if (Array.isArray(options.headers)) for (const [k, v] of options.headers) headersObj[k] = String(v);
    else for (const [k, v] of Object.entries(options.headers as Record<string, string>)) headersObj[k] = String(v);
  }
  try {
    const relayResp = await fetch(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cfg.token ? { "x-proxy-token": cfg.token } : {}) },
      body: JSON.stringify({ url, method: (options.method || "GET").toUpperCase(), headers: headersObj, body: bodyStr }),
    });
    if (!relayResp.ok) {
      const errText = await relayResp.text().catch(() => "");
      return new Response(errText || `Proxy relay error ${relayResp.status}`, { status: relayResp.status });
    }
    const env = await relayResp.json().catch(() => null) as { status?: number; headers?: Record<string, string>; body?: string } | null;
    if (!env || typeof env.status !== "number") return new Response("Invalid proxy relay response", { status: 502 });
    return new Response(env.body ?? "", { status: env.status, headers: env.headers || {} });
  } catch (e) {
    console.error("[proxyFetch] relay failed:", (e as Error).message);
    return await fetch(url, options);
  }
}

async function getSetting(key: string): Promise<string> {
  const { data } = await sb().from("system_settings").select("key_value").eq("key_name", key).maybeSingle();
  return (data?.key_value || "").trim();
}
async function getSerperKey(): Promise<string> {
  const fromDb = await getSetting("serper_api_key");
  return fromDb || SERPER_KEY_ENV;
}
async function updateJob(jobId: string, fields: Record<string, unknown>) {
  await sb().from("blog_topics_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);
}
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
function isInfoQuery(kw: string): boolean {
  const lower = kw.toLowerCase();
  if (COMMERCIAL_STOP.some((s) => lower.includes(s))) return false;
  return INFO_MARKERS.some((m) => lower.startsWith(m) || lower.includes(" " + m));
}

// ============== STEP 1A: AI generation of info queries ==============
async function aiGenerateInfoQueries(topic: string): Promise<string[]> {
  const aiKey = await getOpenRouterKey();
  if (!aiKey) return [];
  const sys =
    "Ты эксперт по SEO для русскоязычного рынка. " +
    "Возвращай ТОЛЬКО валидный JSON массив строк без markdown.";
  const user =
    `Сгенерируй 100 информационных запросов для блога по теме '${topic}'. ` +
    `Только вопросные и информационные запросы 3-7 слов. ` +
    `Начинаются с: как, что, почему, зачем, сколько, когда, где, какой, можно ли. ` +
    `Без коммерческих слов (купить, цена, заказать). ` +
    `Формат: JSON массив строк, например ["как выбрать X", "что такое Y"].`;
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json", ...OPENROUTER_HEADERS_EXTRA },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  } catch (e) {
    console.warn("[blog-topics] ai generation failed", e);
    return [];
  }
}

// ============== STEP 1B: DataForSEO related (info filtered) ==============
// Returns both the keyword list AND a kw→KD map (KD comes from Labs API).
async function dfsRelatedKeywords(
  topic: string,
  region: string,
  kdMap: Map<string, number>,
): Promise<string[]> {
  if (!dfsConfigured()) return [];
  try {
    const resp = await proxyFetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
      {
        method: "POST",
        headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
        body: JSON.stringify([{
          keyword: sanitizeKeyword(topic),
          location_name: dfsLocationName(region),
          language_code: dfsLanguage(region),
          limit: 200,
          include_seed_keyword: true,
        }]),
      },
    );
    if (!resp.ok) {
      console.warn(`[dfsRelatedKeywords] http=${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const taskStatus = data?.tasks?.[0]?.status_code;
    const taskMsg = data?.tasks?.[0]?.status_message;
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    console.log(`[dfsRelatedKeywords] loc_name="${dfsLocationName(region)}" lang=${dfsLanguage(region)} task_status=${taskStatus} msg="${taskMsg}" items=${items.length}`);
    const out: string[] = [];
    for (const it of items) {
      const kw = String(it?.keyword || "").trim().toLowerCase();
      if (!kw) continue;
      out.push(kw);
      const kdRaw = it?.keyword_difficulty
        ?? it?.keyword_properties?.keyword_difficulty
        ?? it?.keyword_info?.keyword_difficulty
        ?? it?.keyword_info?.keyword_properties?.keyword_difficulty;
      if (kdRaw != null) {
        const kd = Math.max(0, Math.min(100, Math.round(Number(kdRaw))));
        kdMap.set(kw, kd);
      }
    }
    return out;
  } catch (e) {
    console.warn("[blog-topics] dfs related failed", e);
    return [];
  }
}

// ============== STEP 1C: DataForSEO autocomplete ==============
async function dfsAutocomplete(topic: string, region: string): Promise<string[]> {
  if (!dfsConfigured()) return [];
  try {
    // Use DataForSEO Labs Google Autocomplete (correct endpoint)
    const resp = await proxyFetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
      {
        method: "POST",
        headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
        body: JSON.stringify([{
          keywords: [sanitizeKeyword(topic)],
          location_name: dfsLocationName(region),
          language_code: dfsLanguage(region),
          limit: 200,
        }]),
      },
    );
    if (!resp.ok) {
      console.warn(`[dfsAutocomplete] http=${resp.status}`);
      return [];
    }
    const data = await resp.json();
    const taskStatus = data?.tasks?.[0]?.status_code;
    const taskMsg = data?.tasks?.[0]?.status_message;
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    console.log(`[dfsAutocomplete] loc_name="${dfsLocationName(region)}" lang=${dfsLanguage(region)} task_status=${taskStatus} msg="${taskMsg}" items=${items.length}`);
    return items.map((it: any) => sanitizeKeyword(String(it?.keyword || ""))).filter(Boolean);
  } catch (e) {
    console.warn("[blog-topics] dfs autocomplete failed", e);
    return [];
  }
}

// ============== STEP 2: search volume ==============
async function dfsSearchVolume(keywords: string[], region: string): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!dfsConfigured() || keywords.length === 0) return map;
  // DataForSEO accepts up to 1000 keywords per request
  const chunks: string[][] = [];
  for (let i = 0; i < keywords.length; i += 700) chunks.push(keywords.slice(i, i + 700));
  for (const chunk of chunks) {
    try {
      const resp = await proxyFetch(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            keywords: chunk.map(sanitizeKeyword).filter(Boolean),
            location_name: dfsLocationName(region),
            language_code: dfsLanguage(region),
          }]),
        },
      );
      if (!resp.ok) {
        console.warn(`[dfsSearchVolume] http=${resp.status}`);
        continue;
      }
      const data = await resp.json();
      const taskStatus = data?.tasks?.[0]?.status_code;
      const taskMsg = data?.tasks?.[0]?.status_message;
      const items = data?.tasks?.[0]?.result || [];
      console.log(`[dfsSearchVolume] chunk=${chunk.length} loc_name="${dfsLocationName(region)}" lang=${dfsLanguage(region)} task_status=${taskStatus} msg="${taskMsg}" items=${items.length}`);
      for (const it of items) {
        const kw = String(it?.keyword || "").trim().toLowerCase();
        const vol = Number(it?.search_volume) || 0;
        if (kw) map.set(kw, vol);
      }
    } catch (e) {
      console.warn("[blog-topics] dfs volume chunk failed", e);
    }
  }
  return map;
}

// ============== STEP 3: SERP competition via Serper.dev ==============
interface CompetitionResult {
  level: "easy" | "medium" | "hard";
  strongCount: number;
  urls: string[];
}
async function serperSearch(keyword: string, apiKey: string): Promise<CompetitionResult | null> {
  try {
    const resp = await proxyFetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: keyword, gl: "ru", hl: "ru", num: 10 }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const organic = (data?.organic || []) as Array<{ link?: string }>;
    const top10 = organic.slice(0, 10);
    let strong = 0;
    const urls: string[] = [];
    for (const r of top10) {
      const link = String(r?.link || "");
      if (!link) continue;
      urls.push(link);
      const domain = extractDomain(link);
      if (STRONG_DOMAINS.some((s) => domain.includes(s))) strong++;
    }
    let level: CompetitionResult["level"];
    if (strong <= 3) level = "easy";
    else if (strong <= 6) level = "medium";
    else level = "hard";
    return { level, strongCount: strong, urls };
  } catch (e) {
    console.warn("[blog-topics] serper failed", keyword, e);
    return null;
  }
}

// ============== STEP 4: scoring ==============
// Map KD (0-100) to competition level. Lower KD = easier to rank.
function kdToLevel(kd: number | null | undefined): "easy" | "medium" | "hard" | null {
  if (kd == null) return null;
  if (kd <= 30) return "easy";
  if (kd <= 60) return "medium";
  return "hard";
}

function calcBlogScore(opts: {
  frequency: number;
  isInfo: boolean;
  wordCount: number;
  competitionLevel: "easy" | "medium" | "hard" | null;
}): number {
  let score = 0;
  score += Math.min((opts.frequency / 1000) * 20, 20);
  if (opts.isInfo) score += 30;
  if (opts.wordCount >= 3) score += 15;
  if (opts.competitionLevel === "easy") score += 35;
  else if (opts.competitionLevel === "medium") score += 20;
  else if (opts.competitionLevel === "hard") score += 5;
  return Math.round(score);
}

// ============== MAIN PIPELINE ==============
async function runJob(jobId: string) {
  const { data: job } = await sb().from("blog_topics_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) {
    console.warn("[runJob] job not found:", jobId);
    return;
  }
  const topic = job.input_topic as string;
  const region = job.input_region as string;
  console.log(`[runJob] start jobId=${jobId} topic="${topic}" region="${region}"`);

  try {
    // ==== STEP 1: collect candidate keywords ====
    await updateJob(jobId, { status: "expanding", progress: 5 });
    // KD map populated by Labs API (Russia is restricted on DFS, but the
    // call is routed through the proxy; if relay fails KD will be empty).
    const kdMap = new Map<string, number>();
    const [aiList, dfsRel, dfsAuto] = await Promise.all([
      aiGenerateInfoQueries(topic),
      dfsRelatedKeywords(topic, region, kdMap),
      dfsAutocomplete(topic, region),
    ]);
    console.log(`[runJob] sources: ai=${aiList.length} dfsRel=${dfsRel.length} dfsAuto=${dfsAuto.length} kdMap=${kdMap.size}`);
    const merged = new Set<string>();
    for (const arr of [aiList, dfsRel, dfsAuto]) {
      for (const k of arr) {
        if (!k) continue;
        const trimmed = k.trim();
        if (trimmed.length < 5 || trimmed.length > 120) continue;
        if (/[a-zA-Z]/.test(trimmed)) continue; // только кириллица
        const wc = trimmed.split(/\s+/).filter(Boolean).length;
        if (wc < 2 || wc > 8) continue;
        merged.add(trimmed);
        if (merged.size >= MAX_TOPICS) break;
      }
    }
    // оставляем только информационные
    const infoOnly = Array.from(merged).filter(isInfoQuery);
    console.log(`[runJob] merged=${merged.size} infoOnly=${infoOnly.length}`);
    await updateJob(jobId, { progress: 20 });

    // ==== STEP 2: frequencies ====
    await updateJob(jobId, { status: "frequencies", progress: 30 });
    const volumes = await dfsSearchVolume(infoOnly, region);
    console.log(`[runJob] volumes returned=${volumes.size}`);

    // фильтр >= MIN_FREQUENCY
    type Cand = { keyword: string; freq: number; wordCount: number; isInfo: boolean };
    const candidates: Cand[] = [];
    for (const kw of infoOnly) {
      const freq = volumes.get(kw) || 0;
      if (freq < MIN_FREQUENCY) continue;
      candidates.push({
        keyword: kw,
        freq,
        wordCount: kw.split(/\s+/).filter(Boolean).length,
        isInfo: true,
      });
    }
    candidates.sort((a, b) => b.freq - a.freq);
    console.log(`[runJob] candidates after MIN_FREQUENCY(${MIN_FREQUENCY})=${candidates.length}`);

    await updateJob(jobId, { progress: 45, topic_count: candidates.length });

    // ==== STEP 3: SERP competition for top-50 ====
    const serperKey = await getSerperKey();
    const toCheck = candidates.slice(0, MAX_SERP_QUERIES);
    await updateJob(jobId, { status: "serp", serp_total: toCheck.length, serp_checked: 0 });

    const compResults = new Map<string, CompetitionResult>();
    // Skip SERP entirely for keywords where KD already gave us a level —
    // saves Serper credits and is the new primary signal.
    const needSerp = toCheck.filter((c) => kdMap.get(c.keyword) == null);
    if (serperKey && needSerp.length) {
      // батчи по 5 параллельно, между батчами 200мс
      for (let i = 0; i < needSerp.length; i += 5) {
        const batch = needSerp.slice(i, i + 5);
        const res = await Promise.all(batch.map((c) => serperSearch(c.keyword, serperKey)));
        for (let j = 0; j < batch.length; j++) {
          const r = res[j];
          if (r) compResults.set(batch[j].keyword, r);
        }
        const checked = Math.min(i + 5, needSerp.length);
        const prog = 45 + Math.round((checked / Math.max(needSerp.length, 1)) * 45);
        await updateJob(jobId, { serp_checked: checked, progress: prog });
        await sleep(200);
      }
    } else {
      // Mark SERP as fully "checked" so UI shows progress completion.
      await updateJob(jobId, { serp_checked: toCheck.length, progress: 90 });
    }

    // ==== STEP 4: build final topics ====
    await updateJob(jobId, { status: "saving", progress: 92 });
    const rows = candidates.map((c) => {
      const kd = kdMap.get(c.keyword) ?? null;
      const kdLevel = kdToLevel(kd);
      const serpComp = compResults.get(c.keyword) || null;
      // KD-based level wins; fall back to SERP-derived level
      const level = kdLevel ?? (serpComp?.level ?? null);
      const score = calcBlogScore({
        frequency: c.freq,
        isInfo: c.isInfo,
        wordCount: c.wordCount,
        competitionLevel: level,
      });
      const traffic = Math.round(c.freq * 0.11);
      return {
        job_id: jobId,
        keyword: c.keyword,
        ws_frequency: c.freq,
        word_count: c.wordCount,
        intent: "info",
        competition_level: level,
        strong_count: serpComp?.strongCount ?? null,
        serp_urls: serpComp?.urls ?? [],
        keyword_difficulty: kd,
        blog_score: score,
        traffic_potential: traffic,
        data_source: dfsConfigured() ? "dataforseo" : "ai",
        serp_checked: !!serpComp || kd != null,
      };
    });

    // batch insert
    if (rows.length) {
      for (let i = 0; i < rows.length; i += 200) {
        const chunk = rows.slice(i, i + 200);
        const { error } = await sb().from("blog_topics").insert(chunk);
        if (error) console.warn("[blog-topics] insert chunk failed", error);
      }
    }

    await updateJob(jobId, {
      status: "done",
      progress: 100,
      topic_count: rows.length,
      completed_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[blog-topics-worker] failed", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    await updateJob(jobId, { status: "error", error_message: msg.slice(0, 1000) });
  }
}

// ============== HTTP entry ==============
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log("[blog-topics-worker] started");
  // Clone to read body twice (log + parse)
  let rawBody = "";
  try { rawBody = await req.clone().text(); } catch {}
  console.log("[blog-topics-worker] request body:", rawBody);

  try {
    const body = await req.json().catch(() => ({}));
    const action = String((body as any).action || "");

    // Per-topic SERP recheck
    if (action === "recheck") {
      const topicId = String((body as any).topic_id || "");
      if (!topicId) {
        return new Response(JSON.stringify({ error: "topic_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: topic } = await sb().from("blog_topics").select("*").eq("id", topicId).maybeSingle();
      if (!topic) {
        return new Response(JSON.stringify({ error: "topic not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const apiKey = await getSerperKey();
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "Serper не настроен" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const comp = await serperSearch(String(topic.keyword), apiKey);
      if (!comp) {
        return new Response(JSON.stringify({ error: "SERP не получен" }), {
          status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const score = calcBlogScore({
        frequency: Number(topic.ws_frequency) || 0,
        isInfo: true,
        wordCount: Number(topic.word_count) || 0,
        competitionLevel: comp.level,
      });
      await sb().from("blog_topics").update({
        competition_level: comp.level,
        strong_count: comp.strongCount,
        serp_urls: comp.urls,
        blog_score: score,
        serp_checked: true,
      }).eq("id", topicId);
      return new Response(JSON.stringify({ ok: true, competition: comp, blog_score: score }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const jobId = String((body as any).job_id || "");
    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // fire-and-forget
    runJob(jobId).catch((e) => console.error("[blog-topics-worker] runJob err", e));
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[blog-topics-worker] http err", e);
    return new Response(JSON.stringify({ error: "internal" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});