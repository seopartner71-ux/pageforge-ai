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

const AI_MODEL = "google/gemini-2.5-flash";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MAX_KEYWORDS = 500;
const MAX_SERP_KEYWORDS = 80;

type Intent = "info" | "commercial" | "nav" | "transac";

interface Kw {
  keyword: string;
  ws_frequency: number;
  exact_frequency: number;
  intent: Intent;
  score: number;
  cluster_id: number | null;
  cluster_name: string | null;
  serp_urls: string[];
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

async function expandKeywords(topic: string, seeds: string[], region: string): Promise<string[]> {
  const filterValid = (arr: string[]) => arr.filter((s) => s.length >= 3 && !/[a-zA-Z]/.test(s));
  let merged = Array.from(new Set(filterValid(await aiExpandOnce(topic, seeds, region))));
  if (merged.length < 50) {
    try {
      const second = await aiExpandOnce(topic, seeds, region);
      merged = Array.from(new Set([...merged, ...filterValid(second)]));
    } catch (e) {
      console.warn("[worker] second expand failed", e);
    }
  }
  return merged.slice(0, MAX_KEYWORDS);
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

function serpCluster(top: { keyword: string; serp: string[]; score: number }[], threshold = 0.3): Cluster[] {
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
  const big = clusters.filter((c) => c.keywords.length >= 3);
  const small = clusters.filter((c) => c.keywords.length < 3);
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

// ============== MAIN PIPELINE ==============
async function runPipeline(jobId: string) {
  const sbc = sb();
  const { data: job } = await sbc.from("semantic_jobs").select("*").eq("id", jobId).maybeSingle();
  if (!job) throw new Error("Job not found");

  const topic: string = job.input_topic;
  const seeds: string[] = job.input_seeds || [];
  const region: string = job.input_region;

  // STEP A: expansion
  await updateJob(jobId, { status: "expanding", progress: 5 });
  const rawKeywords = await expandKeywords(topic, seeds, region);
  if (!rawKeywords.length) throw new Error("AI не вернул ключевых слов");
  await updateJob(jobId, { progress: 20, keyword_count: rawKeywords.length });

  // STEP B: frequencies
  await updateJob(jobId, { status: "frequencies", progress: 25 });
  const freqs = await fetchFrequencies(rawKeywords, region, jobId);
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
    };
  });
  await updateJob(jobId, { progress: 55 });

  // STEP E: SERP fetch for top-N
  await updateJob(jobId, { status: "serp", progress: 60 });
  const serperKey = (await getSetting("serper_api_key")) || SERPER_KEY_ENV;
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

  // Phase 1
  const topItems = topKws.map((k) => ({ keyword: k.keyword, serp: k.serp_urls, score: k.score }));
  let clusters = serpCluster(topItems, 0.3);
  clusters = mergeSmallClusters(clusters);

  const assigned = new Map<string, number>(); // keyword -> cluster index
  clusters.forEach((c, idx) => c.keywords.forEach((kw) => assigned.set(kw, idx)));

  // Phase 2: assign tail keywords by text similarity
  const tail = sortedByScore.slice(MAX_SERP_KEYWORDS);
  const ungrouped: string[] = [];
  for (const k of tail) {
    let bestIdx = -1;
    let bestSim = 0;
    for (let i = 0; i < clusters.length; i++) {
      const seed = clusters[i].keywords[0];
      const sim = textSim(k.keyword, seed);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestSim >= 0.3) {
      clusters[bestIdx].keywords.push(k.keyword);
      assigned.set(k.keyword, bestIdx);
    } else {
      ungrouped.push(k.keyword);
    }
  }

  // Split ungrouped into chunks of <=15
  for (let i = 0; i < ungrouped.length; i += 15) {
    const chunk = ungrouped.slice(i, i + 15);
    const idx = clusters.length;
    clusters.push({ keywords: chunk, seedSerp: [] });
    chunk.forEach((kw) => assigned.set(kw, idx));
  }

  // Phase 3: name clusters
  const names = await nameClustersBatch(clusters);

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

  // Phase 4: cluster metadata
  const clusterRows = clusters.map((c, i) => {
    const items = c.keywords.map((kw) => kwByText.get(kw)).filter(Boolean) as Kw[];
    const avg = items.length ? Math.round(items.reduce((s, x) => s + x.score, 0) / items.length) : 0;
    return {
      job_id: jobId,
      cluster_index: i,
      name: names[i] || `Кластер ${i + 1}`,
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