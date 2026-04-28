// blog-topics-worker — поиск тем для блога с анализом конкуренции через SERP
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
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

const AI_MODEL = "google/gemini-2.5-flash";
const AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

const MAX_TOPICS = 500;
const MAX_SERP_QUERIES = 50;
const MIN_FREQUENCY = 300;

const DFS_REGION_CODES: Record<string, number> = {
  "Россия": 21136, "Москва": 21156, "Санкт-Петербург": 21167,
  "Екатеринбург": 21177, "Новосибирск": 21174, "Казань": 21170,
  "Нижний Новгород": 21173, "Челябинск": 21175, "Самара": 21168,
  "Уфа": 21178, "Ростов-на-Дону": 21166, "Краснодар": 21172,
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
  if (!LOVABLE_API_KEY) return [];
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
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
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
async function dfsRelatedKeywords(topic: string, region: string): Promise<string[]> {
  if (!dfsConfigured()) return [];
  try {
    const resp = await fetch(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live",
      {
        method: "POST",
        headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
        body: JSON.stringify([{
          keyword: topic,
          location_code: dfsLocation(region),
          language_code: "ru",
          limit: 200,
          include_seed_keyword: true,
        }]),
      },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.tasks?.[0]?.result?.[0]?.items || [];
    return items.map((it: any) => String(it?.keyword || "").trim().toLowerCase()).filter(Boolean);
  } catch (e) {
    console.warn("[blog-topics] dfs related failed", e);
    return [];
  }
}

// ============== STEP 1C: DataForSEO autocomplete ==============
async function dfsAutocomplete(topic: string, region: string): Promise<string[]> {
  if (!dfsConfigured()) return [];
  try {
    const resp = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google/keyword_suggestions/live",
      {
        method: "POST",
        headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
        body: JSON.stringify([{
          keyword: topic,
          location_code: dfsLocation(region),
          language_code: "ru",
        }]),
      },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data?.tasks?.[0]?.result || [];
    return items.map((it: any) => String(it?.keyword || "").trim().toLowerCase()).filter(Boolean);
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
      const resp = await fetch(
        "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            keywords: chunk,
            location_code: dfsLocation(region),
            language_code: "ru",
          }]),
        },
      );
      if (!resp.ok) continue;
      const data = await resp.json();
      const items = data?.tasks?.[0]?.result || [];
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
    const resp = await fetch("https://google.serper.dev/search", {
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
  if (!job) return;
  const topic = job.input_topic as string;
  const region = job.input_region as string;

  try {
    // ==== STEP 1: collect candidate keywords ====
    await updateJob(jobId, { status: "expanding", progress: 5 });
    const [aiList, dfsRel, dfsAuto] = await Promise.all([
      aiGenerateInfoQueries(topic),
      dfsRelatedKeywords(topic, region),
      dfsAutocomplete(topic, region),
    ]);
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
    await updateJob(jobId, { progress: 20 });

    // ==== STEP 2: frequencies ====
    await updateJob(jobId, { status: "frequencies", progress: 30 });
    const volumes = await dfsSearchVolume(infoOnly, region);

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

    await updateJob(jobId, { progress: 45, topic_count: candidates.length });

    // ==== STEP 3: SERP competition for top-50 ====
    const serperKey = await getSerperKey();
    const toCheck = candidates.slice(0, MAX_SERP_QUERIES);
    await updateJob(jobId, { status: "serp", serp_total: toCheck.length, serp_checked: 0 });

    const compResults = new Map<string, CompetitionResult>();
    if (serperKey) {
      // батчи по 5 параллельно, между батчами 200мс
      for (let i = 0; i < toCheck.length; i += 5) {
        const batch = toCheck.slice(i, i + 5);
        const res = await Promise.all(batch.map((c) => serperSearch(c.keyword, serperKey)));
        for (let j = 0; j < batch.length; j++) {
          const r = res[j];
          if (r) compResults.set(batch[j].keyword, r);
        }
        const checked = Math.min(i + 5, toCheck.length);
        const prog = 45 + Math.round((checked / Math.max(toCheck.length, 1)) * 45);
        await updateJob(jobId, { serp_checked: checked, progress: prog });
        await sleep(200);
      }
    }

    // ==== STEP 4: build final topics ====
    await updateJob(jobId, { status: "saving", progress: 92 });
    const rows = candidates.map((c) => {
      const comp = compResults.get(c.keyword) || null;
      const score = calcBlogScore({
        frequency: c.freq,
        isInfo: c.isInfo,
        wordCount: c.wordCount,
        competitionLevel: comp?.level ?? null,
      });
      const traffic = Math.round(c.freq * 0.11);
      return {
        job_id: jobId,
        keyword: c.keyword,
        ws_frequency: c.freq,
        word_count: c.wordCount,
        intent: "info",
        competition_level: comp?.level ?? null,
        strong_count: comp?.strongCount ?? null,
        serp_urls: comp?.urls ?? [],
        blog_score: score,
        traffic_potential: traffic,
        data_source: dfsConfigured() ? "dataforseo" : "ai",
        serp_checked: !!comp,
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