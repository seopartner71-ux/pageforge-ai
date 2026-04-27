import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";
const SERPER_KEY_ENV = Deno.env.get("SERPER_API_KEY") ?? "";
const WORDSTAT_KEY_ENV = Deno.env.get("WORDSTAT_API_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

const AI_MODEL = "google/gemini-2.5-flash";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MAX_KEYWORDS = 5000;
const MAX_SERP_KEYWORDS = 80;

// DataForSEO region mapping (location_code) — verified codes for Russia
const DFS_REGION_CODES: Record<string, number> = {
  "Россия": 21136,
  "Москва": 21156,
  "Санкт-Петербург": 21167,
  "Екатеринбург": 21177,
  "Новосибирск": 21174,
  "Казань": 21170,
  "Нижний Новгород": 21173,
  "Челябинск": 21175,
  "Самара": 21168,
  "Уфа": 21178,
  "Ростов-на-Дону": 21166,
  "Краснодар": 21172,
  "Омск": 21176,
  "Красноярск": 21171,
  "Воронеж": 21162,
  "Пермь": 21165,
  "Волгоград": 21161,
  "Саратов": 21169,
  "Тюмень": 21179,
  "Тольятти": 21180,
  "Барнаул": 21158,
  "Иркутск": 21163,
  "Хабаровск": 21181,
  "Ярославль": 21183,
  "Владивосток": 21160,
  "Томск": 21182,
  "Оренбург": 21164,
  "Сочи": 21184,
  "Калининград": 21185,
  "Тула": 21186,
  "Брянск": 21159,
  "Курск": 21187,
  "Ижевск": 21188,
  "Мурманск": 21189,
  "Ставрополь": 21190,
  "Белгород": 21191,
  "Владимир": 21192,
  "Смоленск": 21193,
  "Архангельск": 21194,
  "Астрахань": 21195,
};
function dfsLocation(region: string): number {
  return DFS_REGION_CODES[region] ?? 21136;
}
function dfsAuth(): string {
  return "Basic " + btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`);
}
function dfsConfigured(): boolean {
  return !!(DFS_LOGIN && DFS_PASSWORD);
}

type Intent = "info" | "commercial" | "nav" | "transac";
type DataSource = "mock" | "dataforseo";

interface Kw {
  keyword: string;
  ws_frequency: number;
  exact_frequency: number;
  intent: Intent;
  score: number;
  cluster_id: number | null;
  cluster_name: string | null;
  serp_urls: string[];
  data_source: DataSource;
}

function sb() {
  return createClient(SUPABASE_URL, SERVICE_ROLE);
}

async function getSetting(key: string): Promise<string> {
  const { data } = await sb().from("system_settings").select("key_value").eq("key_name", key).maybeSingle();
  return (data?.key_value || "").trim();
}

async function updateJob(jobId: string, fields: Record<string, unknown>) {
  await sb().from("semantic_jobs").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", jobId);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// ============== STEP A: AI EXPANSION ==============
const EXPAND_SYSTEM =
  "Ты эксперт по SEO для русскоязычного рынка. Генерируй ТОЛЬКО русскоязычные поисковые запросы. ЗАПРЕЩЕНО: английские слова, транслитерация. Возвращай ТОЛЬКО валидный JSON массив строк без пояснений и без markdown.";

function expandUserPrompt(topic: string, seeds: string[], region: string) {
  return `Тема: ${topic}\nДоп. ключи: ${seeds.join(", ") || "—"}\n\nСгенерируй 150-200 поисковых запросов по категориям:\n1. Основные (20-30): прямые запросы\n2. Коммерческие (40-50): купить, цена, заказать, недорого, доставка\n3. Информационные (30-40): как выбрать, отзывы, рейтинг, сравнение\n4. Вопросные (20-30): как, что, где, почему, сколько стоит\n5. Хвостовые (30-40): с уточнениями по бренду, городу, размеру\n6. LSI и синонимы (20-30): смежные понятия\nРегион: ${region}`;
}

async function aiExpandOnce(topic: string, seeds: string[], region: string): Promise<string[]> {
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        { role: "system", content: EXPAND_SYSTEM },
        { role: "user", content: expandUserPrompt(topic, seeds, region) },
      ],
    }),
  });
  if (!resp.ok) throw new Error(`AI expand failed: ${resp.status}`);
  const data = await resp.json();
  const raw = String(data?.choices?.[0]?.message?.content || "");
  const m = raw.match(/\[[\s\S]*\]/);
  if (!m) return [];
  try {
    const arr = JSON.parse(m[0]);
    if (!Array.isArray(arr)) return [];
    return arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

function filterValidKeywords(arr: string[]): string[] {
  return arr
    .map((s) => String(s || "").trim().toLowerCase())
    .filter((s) => s.length >= 3 && !/[a-zA-Z]/.test(s));
}

// Targeted AI follow-up: ask for keywords NOT already in the corpus.
async function aiFollowupExpand(
  topic: string,
  existingKeywords: string[],
  desiredCount = 100,
): Promise<string[]> {
  const sample = existingKeywords.slice(0, 50).join(", ");
  const userPrompt =
    `Тема: ${topic}.\n` +
    `Уже собраны эти запросы (первые 50): ${sample}\n\n` +
    `Добавь ${desiredCount} запросов которых НЕТ в этом списке:\n` +
    `- Вопросные запросы (как, что, почему, где купить, сколько стоит)\n` +
    `- Редкие длинные хвосты (4-6 слов)\n` +
    `- Сезонные запросы если применимо\n\n` +
    `Только русский язык. Только JSON массив строк.`;
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { role: "system", content: EXPAND_SYSTEM },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`AI followup ${resp.status}`);
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const m = raw.match(/\[[\s\S]*\]/);
    if (!m) return [];
    const arr = JSON.parse(m[0]);
    return Array.isArray(arr) ? arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean) : [];
  } catch (e) {
    console.warn("[worker] AI followup failed", e);
    return [];
  }
}

// ============== DataForSEO sources ==============

interface DfsKwData {
  keyword: string;
  search_volume: number; // monthly
}

// Cost tracker (cumulative across the job)
class CostTracker {
  total = 0;
  add(n: number) { this.total += n; }
}

async function dfsAutocompleteSource(
  topic: string,
  seeds: string[],
  region: string,
  cost: CostTracker,
): Promise<string[]> {
  if (!dfsConfigured()) return [];
  const locationCode = dfsLocation(region);
  const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя".split("");
  console.log(`[DFS autocomplete] region: ${region} location_code: ${locationCode}`);
  // Build query list — bare topic + topic + each letter + seeds
  const queries = Array.from(new Set([
    topic,
    ...alphabet.map((l) => `${topic} ${l}`),
    ...seeds,
  ])).filter((q) => q && q.length >= 2).slice(0, 40);

  const out = new Set<string>();
  const concurrency = 10;
  let logged = 0;
  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    await Promise.allSettled(batch.map(async (q) => {
      try {
        const resp = await fetch(
          "https://api.dataforseo.com/v3/keywords_data/google/keyword_suggestions/live",
          {
            method: "POST",
            headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
            body: JSON.stringify([{
              keyword: q,
              language_name: "Russian", language_code: "ru",
              location_code: locationCode,
              limit: 50,
            }]),
          },
        );
        const text = await resp.text();
        let data: any = {};
        try { data = JSON.parse(text); } catch { /* keep empty */ }
        if (logged < 2) {
          logged++;
          console.log(`[DFS autocomplete] q="${q}" status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" body=${text.slice(0, 400)}`);
        }
        if (!resp.ok) return;
        cost.add(0.0005);
        const items = data?.tasks?.[0]?.result?.[0]?.items;
        if (Array.isArray(items)) {
          for (const it of items) {
            const kw = String(it?.keyword || "").trim().toLowerCase();
            if (kw) out.add(kw);
          }
        }
      } catch (e) {
        console.error(`[DFS autocomplete] error q="${q}":`, (e as Error).message);
      }
    }));
  }
  console.log(`[DFS autocomplete] queries=${queries.length}, unique=${out.size}, locationCode=${locationCode}`);
  return Array.from(out);
}

async function dfsKeywordSuggestions(
  topic: string,
  seeds: string[],
  region: string,
  cost: CostTracker,
): Promise<DfsKwData[]> {
  if (!dfsConfigured()) return [];
  const locationCode = dfsLocation(region);
  const queries = [topic, ...seeds.slice(0, 5)];
  const merged = new Map<string, DfsKwData>();
  console.log(`[DFS suggestions] region: ${region} location_code: ${locationCode}`);

  for (const q of queries) {
    try {
      const limit = q === topic ? 1000 : 200;
      const resp = await fetch(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            keyword: q,
            language_name: "Russian", language_code: "ru",
            location_code: locationCode,
            limit,
            order_by: ["keyword_info.search_volume,desc"],
            filters: [["keyword_info.search_volume", ">", 10]],
          }]),
        },
      );
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      console.log(`[DFS suggestions] q="${q}" status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" items=${data?.tasks?.[0]?.result?.[0]?.items?.length ?? 0} body=${text.slice(0, 500)}`);
      if (!resp.ok) continue;
      cost.add(0.015 * (limit / 1000));
      const items = data?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items)) {
        for (const it of items) {
          const kw = String(it?.keyword || "").trim().toLowerCase();
          const sv = Number(it?.keyword_info?.search_volume ?? 0);
          if (!kw) continue;
          const prev = merged.get(kw);
          if (!prev || sv > prev.search_volume) merged.set(kw, { keyword: kw, search_volume: sv });
        }
      }
    } catch (e) {
      console.error(`[DFS suggestions] error q="${q}":`, (e as Error).message);
    }
  }
  console.log(`[DFS suggestions] merged=${merged.size}, locationCode=${locationCode}`);
  return Array.from(merged.values());
}

function rootDomain(host: string): string {
  const h = host.replace(/^www\./, "").toLowerCase();
  const parts = h.split(".");
  if (parts.length <= 2) return h;
  return parts.slice(-2).join(".");
}

async function dfsKeywordsForSite(
  topic: string,
  region: string,
  serperKey: string,
  cost: CostTracker,
): Promise<DfsKwData[]> {
  if (!dfsConfigured()) return [];
  if (!serperKey) return [];
  // Step 1: get top-3 organic domains for the topic
  let domains: string[] = [];
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: topic, gl: "ru", hl: "ru", num: 10,
        location: region === "Москва" ? "Moscow,Russia" : "Russia",
      }),
    });
    if (resp.ok) {
      const data = await resp.json();
      const organic = Array.isArray(data.organic) ? data.organic.slice(0, 10) : [];
      const seen = new Set<string>();
      for (const o of organic) {
        try {
          const u = new URL(String(o.link || ""));
          const d = rootDomain(u.hostname);
          if (d && !seen.has(d)) { seen.add(d); domains.push(d); }
          if (domains.length >= 3) break;
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    console.warn("[dfs-kfs] serper lookup failed", e);
  }
  if (!domains.length) return [];

  const locationCode = dfsLocation(region);
  const merged = new Map<string, DfsKwData>();
  console.log(`[DFS competitors] region: ${region} location_code: ${locationCode}`);
  await Promise.allSettled(domains.map(async (target) => {
    try {
      const resp = await fetch(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            target,
            language_name: "Russian", language_code: "ru",
            location_code: locationCode,
            limit: 500,
            filters: [["keyword_info.search_volume", ">", 10]],
          }]),
        },
      );
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      console.log(`[DFS competitors] target=${target} status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" items=${data?.tasks?.[0]?.result?.[0]?.items?.length ?? 0} body=${text.slice(0, 500)}`);
      if (!resp.ok) return;
      cost.add(0.015 * 0.5);
      const items = data?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items)) {
        for (const it of items) {
          const kw = String(it?.keyword || "").trim().toLowerCase();
          const sv = Number(it?.keyword_info?.search_volume ?? 0);
          if (!kw) continue;
          const prev = merged.get(kw);
          if (!prev || sv > prev.search_volume) merged.set(kw, { keyword: kw, search_volume: sv });
        }
      }
    } catch (e) {
      console.error(`[DFS competitors] error target=${target}:`, (e as Error).message);
    }
  }));
  console.log(`[DFS competitors] domains=${domains.join(',')} merged=${merged.size}, locationCode=${locationCode}`);
  return Array.from(merged.values());
}

// ============== STEP B: WORDSTAT (mock) ==============
function mockFreq(keyword: string): { ws: number; exact: number } {
  const seed = keyword.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rng = ((seed * 9301 + 49297) % 233280) / 233280;
  const ws = Math.floor(Math.pow(rng, 2) * 45000) + 200;
  const exact = Math.floor(ws * (0.1 + rng * 0.5));
  return { ws, exact };
}

async function fetchFrequencies(
  keywords: string[],
  region: string,
  jobId: string,
): Promise<{ ws: number; exact: number }[]> {
  const wordstatKey = WORDSTAT_KEY_ENV || (await getSetting("wordstat_api_key"));
  const out: { ws: number; exact: number }[] = new Array(keywords.length);
  if (!wordstatKey) {
    await sleep(1000); // simulate
    for (let i = 0; i < keywords.length; i++) out[i] = mockFreq(keywords[i]);
    return out;
  }
  // Real Wordstat — batched (best-effort; falls back to mock per-batch on error)
  const regionMap: Record<string, number> = { "Москва": 1, "Санкт-Петербург": 2, "Россия": 0 };
  const regionId = regionMap[region] ?? 0;
  const batchSize = 50;
  const totalBatches = Math.ceil(keywords.length / batchSize);
  for (let b = 0; b < totalBatches; b++) {
    const start = b * batchSize;
    const batch = keywords.slice(start, start + batchSize);
    try {
      const resp = await fetch("https://api.wordstat.yandex.ru/v1/keywords/count", {
        method: "POST",
        headers: { Authorization: `Bearer ${wordstatKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: batch, region_id: regionId }),
      });
      if (!resp.ok) throw new Error(`wordstat ${resp.status}`);
      const data = await resp.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      for (let i = 0; i < batch.length; i++) {
        const it = items[i] || {};
        const ws = Number(it.shows ?? it.ws_frequency ?? 0);
        const exact = Number(it.exact ?? it.exact_frequency ?? Math.floor(ws * 0.3));
        out[start + i] = { ws: ws || mockFreq(batch[i]).ws, exact: exact || 0 };
      }
    } catch (e) {
      console.warn(`[worker] wordstat batch ${b} failed, using mock`, e);
      for (let i = 0; i < batch.length; i++) out[start + i] = mockFreq(batch[i]);
    }
    const progress = 25 + Math.floor(((b + 1) / totalBatches) * 25);
    await updateJob(jobId, { progress });
    if (b < totalBatches - 1) await sleep(500);
  }
  return out;
}

// ============== STEP C: INTENT ==============
const COMMERCIAL = [
  "купить", "заказать", "цена", "стоимость", "недорого", "скидка", "доставка",
  "магазин", "интернет-магазин", "официальный", "прайс", "оптом", "розница", "акция", "распродажа",
];
const INFO = [
  "как", "что", "почему", "зачем", "когда", "можно", "нельзя", "советы",
  "руководство", "инструкция", "обзор", "отзывы", "рейтинг", "сравнение",
  "лучший", "топ", "выбрать", "разница", "виды", "что такое",
];
const NAV = [
  "официальный сайт", "личный кабинет", "войти", "вход",
  "зарегистрироваться", "скачать", "адрес", "телефон", "контакты",
];

function classifyIntent(kw: string): Intent {
  const k = kw.toLowerCase();
  if (NAV.some((w) => k.includes(w))) return "nav";
  if (COMMERCIAL.some((w) => k.includes(w))) return "commercial";
  if (INFO.some((w) => k.includes(w))) return "info";
  return "transac";
}

// ============== STEP D: SCORING ==============
const INTENT_WEIGHT: Record<Intent, number> = { commercial: 1.0, transac: 0.9, info: 0.6, nav: 0.4 };

function scoreKw(ws: number, exact: number, intent: Intent, maxFreq: number): number {
  const freq = (Math.log(ws + 1) / Math.log(maxFreq + 1)) * 60;
  const intentScore = INTENT_WEIGHT[intent] * 25;
  const spec = ws > 0 ? (exact / ws) * 15 : 0;
  return Math.max(0, Math.min(100, Math.round(freq + intentScore + spec)));
}

// ============== STEP E: SERP ==============
function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    return (url.origin + url.pathname).replace(/\/$/, "");
  } catch {
    return u;
  }
}

async function fetchSerp(query: string, region: string, key: string): Promise<string[]> {
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({
        q: query,
        gl: "ru",
        hl: "ru",
        num: 10,
        location: region === "Москва" ? "Moscow,Russia" : "Russia",
      }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const organic = Array.isArray(data.organic) ? data.organic.slice(0, 10) : [];
    return organic.map((o: any) => normalizeUrl(String(o.link || ""))).filter(Boolean);
  } catch {
    return [];
  }
}

// ============== STEP F: CLUSTERING ==============
const STOP = new Set(["в", "на", "по", "с", "и", "или", "не", "для", "к", "о", "об", "у", "из", "за", "до", "от"]);

function tokens(kw: string): string[] {
  return kw
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w));
}

function textSim(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

interface Cluster {
  keywords: string[];
  seedSerp: string[];
}

const MIN_CLUSTER_SIZE = 8;
const MAX_CLUSTERS = 25;

function serpCluster(top: { keyword: string; serp: string[]; score: number }[], threshold = 0.5): Cluster[] {
  const sorted = [...top].sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const clusters: Cluster[] = [];
  for (const head of sorted) {
    if (used.has(head.keyword)) continue;
    const seedSet = new Set(head.serp);
    const group = [head.keyword];
    used.add(head.keyword);
    if (seedSet.size > 0) {
      for (const cand of sorted) {
        if (used.has(cand.keyword)) continue;
        const inter = cand.serp.filter((u) => seedSet.has(u)).length;
        if (inter / 10 >= threshold) {
          group.push(cand.keyword);
          used.add(cand.keyword);
        }
      }
    }
    clusters.push({ keywords: group, seedSerp: head.serp });
  }
  return clusters;
}

function mergeSmallClusters(clusters: Cluster[]): Cluster[] {
  const big = clusters.filter((c) => c.keywords.length >= MIN_CLUSTER_SIZE);
  const small = clusters.filter((c) => c.keywords.length < MIN_CLUSTER_SIZE);
  if (!big.length) return clusters;
  for (const s of small) {
    let bestIdx = 0;
    let bestSim = -1;
    const sSet = new Set(s.seedSerp);
    for (let i = 0; i < big.length; i++) {
      const inter = big[i].seedSerp.filter((u) => sSet.has(u)).length;
      const sim = inter / 10;
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    big[bestIdx].keywords.push(...s.keywords);
  }
  return big;
}

async function nameClustersBatch(
  clusters: { keywords: string[] }[],
  intentGroup: "commercial" | "informational" | "mixed" = "mixed",
): Promise<string[]> {
  if (!clusters.length) return [];
  const prompt = clusters
    .map((c, i) => `${i}: ${c.keywords.slice(0, 5).join(", ")}`)
    .join("\n");
  const intentHint =
    intentGroup === "commercial"
      ? "Это КОММЕРЧЕСКИЕ запросы — название должно отражать коммерческое намерение (например: \"Купить цветы с доставкой\", \"Заказать торт онлайн\", \"Цена на ремонт квартиры\")."
      : intentGroup === "informational"
      ? "Это ИНФОРМАЦИОННЫЕ запросы — название должно отражать тему статьи или гайда (например: \"Уход за орхидеями\", \"Как выбрать ноутбук\", \"Что такое SEO\")."
      : "Дай нейтральное тематическое название.";
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "Ты эксперт по SEO для русскоязычного рынка. Для каждого кластера поисковых запросов придумай короткое название на русском (3-6 слов). " +
              intentHint +
              " Возвращай ТОЛЬКО валидный JSON: { \"0\": \"Название\", \"1\": \"Название\", ... }",
          },
          { role: "user", content: `Назови кластеры:\n${prompt}` },
        ],
      }),
    });
    if (!resp.ok) throw new Error(`name ${resp.status}`);
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || "");
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("no json");
    const obj = JSON.parse(m[0]) as Record<string, string>;
    return clusters.map((_, i) => String(obj[String(i)] || `Кластер ${i + 1}`).slice(0, 60));
  } catch (e) {
    console.warn("[worker] name clusters failed", e);
    return clusters.map((_, i) => `Кластер ${i + 1}`);
  }
}

function clusterType(intents: Intent[]): "informational" | "commercial" | "mixed" {
  if (!intents.length) return "mixed";
  const com = intents.filter((i) => i === "commercial" || i === "transac").length;
  const ratio = com / intents.length;
  return ratio > 0.6 ? "commercial" : ratio < 0.4 ? "informational" : "mixed";
}

function normalizeName(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP.has(w))
    .sort()
    .join(" ")
    .trim();
}

// ============== MAIN PIPELINE ==============
async function runPipeline(jobId: string) {
  const sbc = sb();
  const { data: job } = await sbc.from("semantic_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) throw new Error("Job not found");

  const topic: string = job.input_topic;
  const seeds: string[] = job.input_seeds || [];
  const region: string = job.input_region;
  const enabledSources: string[] = Array.isArray(job.enabled_sources) && job.enabled_sources.length
    ? job.enabled_sources
    : ["autocomplete", "suggestions", "competitors", "ai"];
  const useAutocomplete = enabledSources.includes("autocomplete");
  const useSuggestions = enabledSources.includes("suggestions");
  const useCompetitors = enabledSources.includes("competitors");
  const useAi = enabledSources.includes("ai");

  // STEP A: multi-source expansion
  await updateJob(jobId, { status: "expanding", progress: 5 });
  const cost = new CostTracker();
  const serperKey = (await getSetting("serper_api_key")) || SERPER_KEY_ENV;
  const dfsAvailable = dfsConfigured();
  console.log('[DataForSEO] Login configured:', !!Deno.env.get('DATAFORSEO_LOGIN'));
  console.log('[DataForSEO] Password configured:', !!Deno.env.get('DATAFORSEO_PASSWORD'));
  console.log('[DataForSEO] dfsAvailable:', dfsAvailable, '| enabledSources:', enabledSources);
  if (!dfsAvailable) {
    console.warn("[DataForSEO] Credentials missing or invalid — falling back to AI-only expansion");
  }

  // Per-source storage with frequency map (only DFS sources have real volumes)
  const dfsVolumes = new Map<string, number>(); // keyword -> max DFS search_volume
  const breakdown: Record<string, number> = {
    autocomplete: 0, suggestions: 0, competitors: 0, ai: 0,
  };

  type SourcePromiseResult = { source: string; keywords: string[]; withVolumes?: DfsKwData[] };
  const sourcePromises: Promise<SourcePromiseResult>[] = [];

  if (useAutocomplete && dfsAvailable) {
    sourcePromises.push(
      dfsAutocompleteSource(topic, seeds, region, cost)
        .then((kws) => ({ source: "autocomplete", keywords: kws })),
    );
  }
  if (useSuggestions && dfsAvailable) {
    sourcePromises.push(
      dfsKeywordSuggestions(topic, seeds, region, cost)
        .then((arr) => ({ source: "suggestions", keywords: arr.map((x) => x.keyword), withVolumes: arr })),
    );
  }
  if (useCompetitors && dfsAvailable) {
    sourcePromises.push(
      dfsKeywordsForSite(topic, region, serperKey, cost)
        .then((arr) => ({ source: "competitors", keywords: arr.map((x) => x.keyword), withVolumes: arr })),
    );
  }
  if (useAi || !dfsAvailable) {
    // AI source — when DFS unavailable we still rely on AI for the bulk
    sourcePromises.push(
      aiExpandOnce(topic, seeds, region)
        .then((kws) => ({ source: "ai", keywords: kws }))
        .catch((e) => { console.warn("[ai-source] failed", e); return { source: "ai", keywords: [] }; }),
    );
  }

  // Run all sources in parallel and collect partial progress
  const totalSources = sourcePromises.length || 1;
  let doneSources = 0;
  const settled = await Promise.allSettled(sourcePromises.map((p) =>
    p.then(async (r) => {
      doneSources++;
      const prog = 5 + Math.floor((doneSources / totalSources) * 25);
      await updateJob(jobId, { progress: prog });
      return r;
    }),
  ));

  const allFromSources = new Set<string>();
  for (const s of settled) {
    if (s.status !== "fulfilled") continue;
    const r = s.value;
    const filtered = filterValidKeywords(r.keywords);
    breakdown[r.source] = filtered.length;
    console.log(`[Source ${r.source}] raw=${r.keywords.length}, filtered=${filtered.length}, withVolumes=${r.withVolumes?.length ?? 0}`);
    if (r.withVolumes) {
      for (const v of r.withVolumes) {
        const kw = v.keyword.toLowerCase();
        if (!filterValidKeywords([kw]).length) continue;
        const prev = dfsVolumes.get(kw) || 0;
        if (v.search_volume > prev) dfsVolumes.set(kw, v.search_volume);
      }
    }
    for (const kw of filtered) allFromSources.add(kw);
  }
  for (const s of settled) {
    if (s.status === 'rejected') console.error('[Source REJECTED]', s.reason);
  }

  let rawKeywords = Array.from(allFromSources);
  console.log(`[Total after dedup]: ${rawKeywords.length} keywords | breakdown=${JSON.stringify(breakdown)} | dfsVolumes=${dfsVolumes.size}`);

  // Followup AI enrichment if DFS is available and AI source is enabled,
  // OR fallback if total too small.
  if (dfsAvailable && useAi && rawKeywords.length > 0) {
    const extra = await aiFollowupExpand(topic, rawKeywords, 100);
    const filteredExtra = filterValidKeywords(extra);
    const before = rawKeywords.length;
    rawKeywords = Array.from(new Set([...rawKeywords, ...filteredExtra]));
    breakdown.ai += rawKeywords.length - before;
  }
  if (rawKeywords.length < 100) {
    const fallback = await aiFollowupExpand(topic, rawKeywords, 300);
    const filteredFb = filterValidKeywords(fallback);
    const before = rawKeywords.length;
    rawKeywords = Array.from(new Set([...rawKeywords, ...filteredFb]));
    breakdown.ai += rawKeywords.length - before;
  }

  if (rawKeywords.length > MAX_KEYWORDS) rawKeywords = rawKeywords.slice(0, MAX_KEYWORDS);
  if (!rawKeywords.length) throw new Error("Не удалось собрать ключевых слов из источников");

  await updateJob(jobId, {
    progress: 35,
    keyword_count: rawKeywords.length,
    source_breakdown: breakdown,
    dataforseo_cost: Number(cost.total.toFixed(4)),
  });

  // STEP B: frequencies — prefer DataForSEO real volumes, fall back to wordstat/mock
  await updateJob(jobId, { status: "frequencies", progress: 40 });
  const dataSources: DataSource[] = new Array(rawKeywords.length);
  const needFreq: { idx: number; keyword: string }[] = [];
  const freqs: { ws: number; exact: number }[] = new Array(rawKeywords.length);
  for (let i = 0; i < rawKeywords.length; i++) {
    const kw = rawKeywords[i];
    const dfsVol = dfsVolumes.get(kw);
    if (dfsVol && dfsVol > 0) {
      freqs[i] = { ws: dfsVol, exact: Math.floor(dfsVol * 0.3) };
      dataSources[i] = "dataforseo";
    } else {
      needFreq.push({ idx: i, keyword: kw });
      dataSources[i] = "mock";
    }
  }
  if (needFreq.length) {
    const freqInput = needFreq.map((n) => n.keyword);
    const fetched = await fetchFrequencies(freqInput, region, jobId);
    for (let j = 0; j < needFreq.length; j++) freqs[needFreq[j].idx] = fetched[j];
  }
  await updateJob(jobId, { progress: 50 });

  // STEP C + D: intent + scoring
  await updateJob(jobId, { progress: 52 });
  const maxFreq = Math.max(1, ...freqs.map((f) => f.ws));
  const kws: Kw[] = rawKeywords.map((kw, i) => {
    const intent = classifyIntent(kw);
    return {
      keyword: kw,
      ws_frequency: freqs[i].ws,
      exact_frequency: freqs[i].exact,
      intent,
      score: scoreKw(freqs[i].ws, freqs[i].exact, intent, maxFreq),
      cluster_id: null,
      cluster_name: null,
      serp_urls: [],
      data_source: dataSources[i],
    };
  });
  await updateJob(jobId, { progress: 55 });

  // STEP E: SERP fetch for top-N
  await updateJob(jobId, { status: "serp", progress: 60 });
  if (!serperKey) throw new Error("Serper API ключ не настроен");

  const sortedByScore = [...kws].sort((a, b) => b.score - a.score);
  const topKws = sortedByScore.slice(0, MAX_SERP_KEYWORDS);
  const batchSize = 10;
  const totalBatches = Math.ceil(topKws.length / batchSize);
  for (let b = 0; b < totalBatches; b++) {
    const batch = topKws.slice(b * batchSize, b * batchSize + batchSize);
    await Promise.all(batch.map(async (k) => {
      k.serp_urls = await fetchSerp(k.keyword, region, serperKey);
    }));
    const progress = 60 + Math.floor(((b + 1) / totalBatches) * 20);
    await updateJob(jobId, { progress });
    if (b < totalBatches - 1) await sleep(200);
  }

  // STEP F: clustering
  await updateJob(jobId, { status: "clustering", progress: 82 });

  // Split keywords into intent groups — clustering runs SEPARATELY within each group
  // so commercial/transactional keywords are never mixed with informational ones.
  const isCommercial = (it: Intent) => it === "commercial" || it === "transac";
  const isInformational = (it: Intent) => it === "info" || it === "nav";

  const intentGroups: { name: "commercial" | "informational"; predicate: (i: Intent) => boolean }[] = [
    { name: "commercial", predicate: isCommercial },
    { name: "informational", predicate: isInformational },
  ];

  const clusters: Cluster[] = [];
  const clusterIntent: ("commercial" | "informational")[] = [];
  const names: string[] = [];

  for (const grp of intentGroups) {
    const grpTop = topKws.filter((k) => grp.predicate(k.intent));
    const grpTail = sortedByScore.slice(MAX_SERP_KEYWORDS).filter((k) => grp.predicate(k.intent));
    if (!grpTop.length && !grpTail.length) continue;

    // Phase 1: SERP clustering on top items within this intent group
    const topItems = grpTop.map((k) => ({ keyword: k.keyword, serp: k.serp_urls, score: k.score }));
    let grpClusters = serpCluster(topItems, 0.3);
    grpClusters = mergeSmallClusters(grpClusters);

    // Phase 2: assign tail keywords by text similarity (within same intent group)
    const ungrouped: string[] = [];
    for (const k of grpTail) {
      let bestIdx = -1;
      let bestSim = 0;
      for (let i = 0; i < grpClusters.length; i++) {
        const seed = grpClusters[i].keywords[0];
        const sim = textSim(k.keyword, seed);
        if (sim > bestSim) {
          bestSim = sim;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestSim >= 0.3) {
        grpClusters[bestIdx].keywords.push(k.keyword);
      } else {
        ungrouped.push(k.keyword);
      }
    }

    // Split ungrouped into chunks of <=15 (still within this intent group)
    for (let i = 0; i < ungrouped.length; i += 15) {
      const chunk = ungrouped.slice(i, i + 15);
      grpClusters.push({ keywords: chunk, seedSerp: [] });
    }

    // Phase 3: name clusters with intent-aware prompt
    const grpNames = await nameClustersBatch(grpClusters, grp.name);

    for (let i = 0; i < grpClusters.length; i++) {
      clusters.push(grpClusters[i]);
      clusterIntent.push(grp.name);
      names.push(grpNames[i]);
    }
  }

  // Apply assignments back to kws
  const kwByText = new Map(kws.map((k) => [k.keyword, k]));
  for (let i = 0; i < clusters.length; i++) {
    for (const kwText of clusters[i].keywords) {
      const k = kwByText.get(kwText);
      if (k) {
        k.cluster_id = i;
        k.cluster_name = names[i];
      }
    }
  }

  // Phase 3.5: CLEANUP — merge duplicate-named clusters & redistribute mismatched-intent keywords
  const isCommercialIntent = (it: Intent) => it === "commercial" || it === "transac";
  const isInfoIntent = (it: Intent) => it === "info" || it === "nav";

  // Build mutable cluster state
  type CState = {
    keywords: string[];
    name: string;
    intentGroup: "commercial" | "informational";
    deleted: boolean;
  };
  const cstates: CState[] = clusters.map((c, i) => ({
    keywords: [...c.keywords],
    name: names[i] || `Кластер ${i + 1}`,
    intentGroup: clusterIntent[i],
    deleted: false,
  }));

  // (1) Merge duplicates by normalized name (only within same intent group)
  const byKey = new Map<string, number>();
  for (let i = 0; i < cstates.length; i++) {
    const s = cstates[i];
    if (s.deleted) continue;
    const key = `${s.intentGroup}::${normalizeName(s.name)}`;
    if (!key.endsWith("::")) {
      const existing = byKey.get(key);
      if (existing !== undefined) {
        // pick base = higher avg score
        const avg = (idx: number) =>
          cstates[idx].keywords.length
            ? cstates[idx].keywords.reduce((sum, kw) => sum + (kwByText.get(kw)?.score || 0), 0) /
              cstates[idx].keywords.length
            : 0;
        const baseIdx = avg(existing) >= avg(i) ? existing : i;
        const dropIdx = baseIdx === existing ? i : existing;
        cstates[baseIdx].keywords.push(...cstates[dropIdx].keywords);
        cstates[dropIdx].keywords = [];
        cstates[dropIdx].deleted = true;
        byKey.set(key, baseIdx);
      } else {
        byKey.set(key, i);
      }
    }
  }

  // (2) Intent-based validation: extract mismatched keywords to nearest correct cluster
  const findNearestCluster = (
    kwText: string,
    targetGroup: "commercial" | "informational",
    excludeIdx: number,
  ): number => {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < cstates.length; i++) {
      if (i === excludeIdx) continue;
      if (cstates[i].deleted) continue;
      if (cstates[i].intentGroup !== targetGroup) continue;
      const seed = cstates[i].keywords[0];
      if (!seed) continue;
      const sim = textSim(kwText, seed);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    return bestSim >= 0.2 ? bestIdx : -1;
  };

  for (let i = 0; i < cstates.length; i++) {
    const s = cstates[i];
    if (s.deleted || s.keywords.length === 0) continue;
    const items = s.keywords.map((kw) => kwByText.get(kw)).filter(Boolean) as Kw[];
    const total = items.length;
    if (total === 0) continue;
    const com = items.filter((it) => isCommercialIntent(it.intent)).length;
    const inf = items.filter((it) => isInfoIntent(it.intent)).length;

    if (s.intentGroup === "commercial" && inf / total > 0.3) {
      // extract info keywords
      const stay: string[] = [];
      const move: string[] = [];
      for (const it of items) {
        if (isInfoIntent(it.intent)) move.push(it.keyword);
        else stay.push(it.keyword);
      }
      s.keywords = stay;
      // try assign each to nearest informational cluster, else create new
      const orphans: string[] = [];
      for (const kw of move) {
        const target = findNearestCluster(kw, "informational", i);
        if (target >= 0) cstates[target].keywords.push(kw);
        else orphans.push(kw);
      }
      if (orphans.length) {
        cstates.push({
          keywords: orphans,
          name: `Информационные: ${s.name}`.slice(0, 60),
          intentGroup: "informational",
          deleted: false,
        });
      }
    } else if (s.intentGroup === "informational" && com / total > 0.3) {
      const stay: string[] = [];
      const move: string[] = [];
      for (const it of items) {
        if (isCommercialIntent(it.intent)) move.push(it.keyword);
        else stay.push(it.keyword);
      }
      s.keywords = stay;
      const orphans: string[] = [];
      for (const kw of move) {
        const target = findNearestCluster(kw, "commercial", i);
        if (target >= 0) cstates[target].keywords.push(kw);
        else orphans.push(kw);
      }
      if (orphans.length) {
        cstates.push({
          keywords: orphans,
          name: `Коммерческие: ${s.name}`.slice(0, 60),
          intentGroup: "commercial",
          deleted: false,
        });
      }
    }
  }

  // Drop empty / deleted, then re-index
  const finalStates = cstates.filter((s) => !s.deleted && s.keywords.length > 0);

  // Reset & re-apply cluster assignments based on finalStates
  for (const k of kws) { k.cluster_id = null; k.cluster_name = null; }
  for (let i = 0; i < finalStates.length; i++) {
    for (const kwText of finalStates[i].keywords) {
      const k = kwByText.get(kwText);
      if (k) {
        k.cluster_id = i;
        k.cluster_name = finalStates[i].name;
      }
    }
  }

  // Phase 4: cluster metadata
  const clusterRows = finalStates.map((c, i) => {
    const items = c.keywords.map((kw) => kwByText.get(kw)).filter(Boolean) as Kw[];
    const avg = items.length ? Math.round(items.reduce((s, x) => s + x.score, 0) / items.length) : 0;
    return {
      job_id: jobId,
      cluster_index: i,
      name: c.name || `Кластер ${i + 1}`,
      type: clusterType(items.map((it) => it.intent)),
      keyword_count: items.length,
      avg_score: avg,
    };
  });

  await updateJob(jobId, { progress: 95 });

  // STEP G: persist
  // Bulk insert keywords (in chunks of 200 for safety)
  const keywordRows = kws.map((k) => ({ job_id: jobId, ...k }));
  for (let i = 0; i < keywordRows.length; i += 200) {
    const slice = keywordRows.slice(i, i + 200);
    const { error } = await sbc.from("semantic_keywords").insert(slice);
    if (error) throw new Error(`keywords insert: ${error.message}`);
  }
  if (clusterRows.length) {
    const { error } = await sbc.from("semantic_clusters").insert(clusterRows);
    if (error) throw new Error(`clusters insert: ${error.message}`);
  }

  await updateJob(jobId, {
    status: "done",
    progress: 100,
    keyword_count: kws.length,
    cluster_count: clusterRows.length,
    completed_at: new Date().toISOString(),
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let jobId = "";
  try {
    const body = await req.json().catch(() => ({} as any));
    jobId = String(body?.job_id || "");
    if (!jobId) {
      return new Response(JSON.stringify({ error: "job_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Run async; respond immediately so caller doesn't wait
    EdgeRuntime.waitUntil(
      runPipeline(jobId).catch(async (err) => {
        console.error("[worker] pipeline failed", err);
        const msg = err instanceof Error ? err.message : String(err);
        try {
          await updateJob(jobId, { status: "error", error_message: msg.slice(0, 500) });
        } catch (e) {
          console.error("[worker] failed to mark job error", e);
        }
      }),
    );

    return new Response(JSON.stringify({ ok: true, job_id: jobId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[worker] handler error", e);
    if (jobId) {
      try {
        await updateJob(jobId, { status: "error", error_message: String(e).slice(0, 500) });
      } catch {}
    }
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// EdgeRuntime is provided by Supabase Edge Runtime
// deno-lint-ignore no-explicit-any
declare const EdgeRuntime: { waitUntil: (p: Promise<any>) => void };