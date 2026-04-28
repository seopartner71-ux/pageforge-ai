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

// DataForSEO does NOT support Russia/Belarus (political restriction since 2022).
// For these regions we route suggestions/competitors through Lovable AI expansion
// and rely on Wordstat (when wordstat_api_key is configured) for real frequencies.
const RU_BY_MARKERS = [
  "росси", "москв", "санкт-петер", "питер", "екатеринбург", "новосибирск",
  "казань", "нижний новгород", "челябинск", "самара", "уфа", "красноярск",
  "ростов", "пермь", "воронеж", "краснодар", "волгоград", "саратов",
  "тюмень", "тольятти", "ижевск", "барнаул", "ульяновск", "иркутск",
  "хабаровск", "омск", "ярославль", "владивосток", "махачкала", "томск",
  "оренбург", "кемерово", "новокузнецк", "рязань", "астрахань",
  "набережные челны", "пенза", "липецк", "тула", "киров", "чебоксары",
  "калининград", "брянск", "курск", "магнитогорск", "иваново", "улан-удэ",
  "сочи", "ставрополь", "белгород", "нижний тагил", "владимир",
  "архангельск", "чита", "смоленск", "калуга", "мурманск",
  "беларус", "минск", "гомель", "брест", "витебск", "гродно", "могилёв", "могилев",
];
function isRussianRegion(region: string): boolean {
  const r = (region || "").toLowerCase().trim();
  if (!r) return true; // default to RU
  return RU_BY_MARKERS.some((m) => r.includes(m));
}

// ============== YANDEX WORDSTAT API ==============
// Primary keyword source for Russian regions (DataForSEO blocks RU/BY).
// Docs: https://yandex.ru/dev/wordstat/
// Yandex Wordstat API base. The official host is api.wordstat.yandex.ru
// (the .net variant returns 403/404). Override via WORDSTAT_BASE env if needed.
const WORDSTAT_BASE = Deno.env.get("WORDSTAT_BASE") ?? "https://api.wordstat.yandex.ru/v1";

// Wordstat geo IDs (different from Yandex.Direct geo).
// 0 = all Russia. 213 = Moscow city. 2 = Saint Petersburg.
const WORDSTAT_REGION_MAP: Record<string, number> = {
  "Москва": 213,
  "Санкт-Петербург": 2,
  "Россия": 0,
};
function wordstatRegionId(region: string): number {
  if (region in WORDSTAT_REGION_MAP) return WORDSTAT_REGION_MAP[region];
  // Any other Russian city → fall back to all Russia (0).
  return 0;
}

async function getWordstatKey(): Promise<string> {
  return WORDSTAT_KEY_ENV || (await getSetting("wordstat_api_key")) || "";
}

// Wordstat suggestions: topRequests + associations for the seed phrase.
async function wordstatSuggestions(
  phrase: string,
  regionId: number,
  token: string,
): Promise<string[]> {
  try {
    const reqBody = { phrase, geo_id: [regionId] };
    const resp = await fetch(`${WORDSTAT_BASE}/topRequests`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reqBody),
    });
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    if (!resp.ok) {
      console.error(`[Wordstat suggestions] FAIL phrase="${phrase}" url=${WORDSTAT_BASE}/topRequests status=${resp.status} body=${text}`);
      return [];
    }
    const top = Array.isArray(data?.topRequests) ? data.topRequests : [];
    const assoc = Array.isArray(data?.associations) ? data.associations : [];
    const all = [...top, ...assoc]
      .map((i: any) => String(i?.phrase ?? i?.keyword ?? "").trim().toLowerCase())
      .filter(Boolean);
    console.log(`[Wordstat suggestions] phrase="${phrase}" items=${all.length} (top=${top.length}, assoc=${assoc.length})`);
    return all;
  } catch (e) {
    console.warn(`[Wordstat suggestions] phrase="${phrase}" error:`, (e as Error).message);
    return [];
  }
}

// Wordstat volumes: real shows per keyword, batched.
async function wordstatVolumes(
  keywords: string[],
  regionId: number,
  token: string,
): Promise<Map<string, { ws: number; exact: number }>> {
  const out = new Map<string, { ws: number; exact: number }>();
  if (!keywords.length) return out;
  const batchSize = 50;
  let realCount = 0;
  for (let b = 0; b < keywords.length; b += batchSize) {
    const batch = keywords.slice(b, b + batchSize);
    try {
      const resp = await fetch(`${WORDSTAT_BASE}/keywords/count`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ keywords: batch, geo_id: [regionId] }),
      });
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      if (!resp.ok) {
        console.error(`[Wordstat volumes] FAIL batch=${b} url=${WORDSTAT_BASE}/keywords/count status=${resp.status} body=${text}`);
        continue;
      }
      const items = Array.isArray(data?.items) ? data.items : [];
      for (let i = 0; i < batch.length; i++) {
        const it = items[i] || {};
        const ws = Number(it?.shows ?? it?.ws_frequency ?? 0);
        if (ws > 0) {
          out.set(batch[i], { ws, exact: Math.floor(ws * 0.3) });
          realCount++;
        }
      }
    } catch (e) {
      console.warn(`[Wordstat volumes] batch=${b} error:`, (e as Error).message);
    }
    if (b + batchSize < keywords.length) await sleep(300);
  }
  console.log(`[Wordstat volumes] real: ${realCount} / ${keywords.length}`);
  return out;
}

// High-level: collect Wordstat suggestions for topic + seeds, then enrich with real volumes.
async function wordstatSourceForRu(
  topic: string,
  seeds: string[],
  region: string,
): Promise<DfsKwData[]> {
  const token = await getWordstatKey();
  if (!token) {
    console.warn(`[Wordstat] no API key configured — skipping`);
    return [];
  }
  const regionId = wordstatRegionId(region);
  const seedPhrases = [topic, ...seeds.slice(0, 4)].filter(Boolean);
  console.log(`[Wordstat] region="${region}" regionId=${regionId} seeds=${seedPhrases.length}`);

  const merged = new Set<string>();
  for (const p of seedPhrases) {
    const arr = await wordstatSuggestions(p, regionId, token);
    for (const k of arr) merged.add(k);
  }
  const candidates = Array.from(merged).slice(0, 500);
  if (!candidates.length) return [];

  const volumes = await wordstatVolumes(candidates, regionId, token);
  const out: DfsKwData[] = [];
  for (const kw of candidates) {
    if (!isRussianKeyword(kw)) continue;
    const v = volumes.get(kw);
    out.push({
      keyword: kw,
      search_volume: v?.ws ?? 0,
      keyword_difficulty: null, // Wordstat does not provide KD
    });
  }
  console.log(`[Wordstat source] candidates=${candidates.length} withVolumes=${out.filter(x => x.search_volume > 0).length}`);
  return out;
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
  keyword_difficulty: number | null;
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

// AI-based suggestions for RU/BY (DFS Labs blocks these regions).
// Uses two parallel prompts to get broad coverage similar to DFS suggestions volume.
async function aiSuggestionsForRu(
  topic: string,
  seeds: string[],
  region: string,
): Promise<string[]> {
  const sys =
    "Ты эксперт по SEO для русскоязычного рынка (Россия и Беларусь). " +
    "Возвращай ТОЛЬКО валидный JSON массив строк (поисковых запросов). " +
    "ЗАПРЕЩЕНО: английские слова, транслитерация, украинские топонимы. " +
    "Запросы должны быть реальными — такими, как их вводят пользователи в Яндекс/Google.";
  const user1 =
    `Тема: ${topic}\nДоп. ключи: ${seeds.join(", ") || "—"}\nРегион: ${region}\n\n` +
    `Сгенерируй 200 высокочастотных и среднечастотных поисковых запросов:\n` +
    `- прямые коммерческие (купить, цена, заказать, доставка, недорого)\n` +
    `- транзакционные (оформить, оплатить, в наличии)\n` +
    `- брендовые и категорийные\n` +
    `- с гео-привязкой к региону "${region}" где уместно\n` +
    `Только JSON массив строк.`;
  const user2 =
    `Тема: ${topic}\nРегион: ${region}\n\n` +
    `Сгенерируй 200 информационных и длиннохвостых запросов:\n` +
    `- вопросные (как, что, почему, зачем, где, сколько стоит)\n` +
    `- сравнительные (vs, или, лучше, отличие)\n` +
    `- обзоры и рейтинги (топ, лучший, обзор, отзывы)\n` +
    `- инструкции (как выбрать, как пользоваться, своими руками)\n` +
    `- 4-7 слов в запросе\n` +
    `Только JSON массив строк.`;

  async function call(userPrompt: string): Promise<string[]> {
    try {
      const resp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: AI_MODEL,
          messages: [
            { role: "system", content: sys },
            { role: "user", content: userPrompt },
          ],
        }),
      });
      if (!resp.ok) {
        console.warn(`[AI suggestions RU] status=${resp.status}`);
        return [];
      }
      const data = await resp.json();
      const raw = String(data?.choices?.[0]?.message?.content || "");
      const m = raw.match(/\[[\s\S]*\]/);
      if (!m) return [];
      const arr = JSON.parse(m[0]);
      if (!Array.isArray(arr)) return [];
      return arr.map((x) => String(x).trim().toLowerCase()).filter(Boolean);
    } catch (e) {
      console.warn(`[AI suggestions RU] error`, (e as Error).message);
      return [];
    }
  }

  const [a, b] = await Promise.all([call(user1), call(user2)]);
  const merged = new Set<string>();
  for (const k of [...a, ...b]) merged.add(k);
  console.log(`[AI suggestions RU] generated=${merged.size} (${a.length}+${b.length})`);
  return Array.from(merged);
}

// Russian-only filter: strips Ukrainian/foreign keywords that DataForSEO
// occasionally returns when language field is omitted.
const UKRAINIAN_WORDS = [
  "квітів", "квіти", "квіток", "з мила", "з метеликів",
  "з мильних", "київ", "харків", "львів",
  "одеса", "дніпро", "з атласних", "украина", "україна",
];
const UA_CITIES = [
  "киев", "харьков", "львов", "одесса",
  "днепр", "запорожье", "николаев", "херсон",
];
function isRussianKeyword(keyword: string): boolean {
  if (!/[а-яёА-ЯЁ]/.test(keyword)) return false;
  const lower = keyword.toLowerCase();
  if (UKRAINIAN_WORDS.some((w) => lower.includes(w))) return false;
  if (UA_CITIES.some((c) => lower.includes(c))) return false;
  return true;
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
  keyword_difficulty?: number | null; // 0-100, only present for Labs sources
}

let dfsDebugReplay: string[] = [];

function logDfsResult(endpoint: "suggestions" | "competitors" | "autocomplete", response: Response, data: any) {
  const line = '[DFS result] ' + JSON.stringify({
    endpoint,
    httpStatus: response.status,
    taskStatus: data?.tasks?.[0]?.status_code,
    taskMsg: data?.tasks?.[0]?.status_message,
    resultCount: data?.tasks?.[0]?.result?.length ?? 0,
    firstItemKeys: Object.keys(data?.tasks?.[0]?.result?.[0] ?? {}),
  });
  dfsDebugReplay.push(line);
  console.log(line);
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
): Promise<DfsKwData[]> {
  if (!dfsConfigured()) return [];
  console.log(`[DFS autocomplete] region: ${region} (Keywords Data search_volume, no location)`);
  // Build candidate keyword list: seed + topic + topic + each cyrillic letter
  const alphabet = "абвгдеёжзийклмнопрстуфхцчшщъыьэюя".split("");
  const candidates = Array.from(new Set([
    topic,
    ...seeds,
    ...alphabet.map((l) => `${topic} ${l}`),
  ].map((s) => s.trim().toLowerCase()).filter((s) => s && s.length >= 2))).slice(0, 200);

  const merged = new Map<string, DfsKwData>();
  // search_volume/live accepts up to 1000 keywords per task — split safely
  const chunkSize = 100;
  let logged = 0;
  for (let i = 0; i < candidates.length; i += chunkSize) {
    const chunk = candidates.slice(i, i + chunkSize);
    try {
      const resp = await fetch(
        "https://api.dataforseo.com/v3/keywords_data/google/search_volume/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            keywords: chunk,
            language_code: "ru",
          }]),
        },
      );
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      logDfsResult("autocomplete", resp, data);
      if (logged < 1) {
        logged++;
        const sample = data?.tasks?.[0]?.result?.[0];
        console.log(`[DFS autocomplete] status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" results=${data?.tasks?.[0]?.result?.length ?? 0}`);
        console.log(`[DFS volume sample autocomplete]`, sample ? JSON.stringify(sample).slice(0, 400) : 'null');
      }
      if (!resp.ok) continue;
      cost.add(0.05 * (chunk.length / 1000));
      const results = data?.tasks?.[0]?.result;
      if (!results || !Array.isArray(results)) {
        console.log('[DFS autocomplete] no results in response');
        continue;
      }
      {
        for (const it of results) {
          const kw = String(it?.keyword || "").trim().toLowerCase();
          const sv = Number(it?.search_volume ?? 0);
          if (!kw || !sv) continue;
          const prev = merged.get(kw);
          if (!prev || sv > prev.search_volume) merged.set(kw, { keyword: kw, search_volume: sv });
        }
      }
    } catch (e) {
      console.error(`[DFS autocomplete] chunk error:`, (e as Error).message);
    }
  }
  console.log(`[DFS autocomplete] candidates=${candidates.length}, withVolumes=${merged.size}`);
  return Array.from(merged.values());
}

async function dfsKeywordSuggestions(
  topic: string,
  seeds: string[],
  region: string,
  cost: CostTracker,
): Promise<DfsKwData[]> {
  if (!dfsConfigured()) return [];
  const merged = new Map<string, DfsKwData>();
  const keywordsList = [topic, ...seeds.slice(0, 19)].filter(Boolean);
  console.log(`[DFS suggestions] region: ${region} → using keywords_for_keywords (location_code=2643), ${keywordsList.length} seeds`);

  // Primary: Keywords Data → Google Ads → keywords_for_keywords (accepts location_code on this plan)
  try {
    const resp = await fetch(
      "https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live",
      {
        method: "POST",
        headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
        body: JSON.stringify([{
          keywords: keywordsList.slice(0, 20),
          location_code: 2643,
          language_code: "ru",
          date_from: "2025-01-01",
          date_to: "2025-12-31",
        }]),
      },
    );
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch {}
    logDfsResult("suggestions", resp, data);
    const taskStatus = data?.tasks?.[0]?.status_code;
    const taskMsg = data?.tasks?.[0]?.status_message;
    const items = data?.tasks?.[0]?.result;
    console.log(`[DFS suggestions/keywords_for_keywords] status=${resp.status} task_status=${taskStatus} task_msg="${taskMsg ?? ''}" items=${Array.isArray(items) ? items.length : 0}`);
    if (resp.ok && taskStatus === 20000 && Array.isArray(items)) {
      cost.add(0.05);
      if (items.length) {
        console.log(`[DFS volume sample suggestions/kfk]`, JSON.stringify(items[0]).slice(0, 400));
      }
      for (const it of items) {
        const kw = String(it?.keyword || "").trim().toLowerCase();
        const sv = Number(it?.search_volume ?? 0);
        if (!kw) continue;
        if (!isRussianKeyword(kw)) continue;
        const prev = merged.get(kw);
        if (!prev || sv > prev.search_volume) {
          merged.set(kw, { keyword: kw, search_volume: sv, keyword_difficulty: prev?.keyword_difficulty ?? null });
        }
      }
      console.log(`[DFS suggestions] merged=${merged.size} (via keywords_for_keywords)`);
      return Array.from(merged.values());
    }
    console.warn(`[DFS suggestions/keywords_for_keywords] failed, falling back to Labs endpoint`);
  } catch (e) {
    console.error(`[DFS suggestions/keywords_for_keywords] error:`, (e as Error).message);
  }

  // Fallback: Labs keyword_suggestions (no location_code — was rejecting on this plan)
  const queries = [topic, ...seeds.slice(0, 5)];
  console.log(`[DFS suggestions] FALLBACK to Labs API (no location)`);

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
            language_code: "ru",
            limit,
            order_by: ["keyword_info.search_volume,desc"],
            filters: [["keyword_info.search_volume", ">", 10]],
          }]),
        },
      );
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      logDfsResult("suggestions", resp, data);
      console.log(`[DFS suggestions] q="${q}" status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" items=${data?.tasks?.[0]?.result?.[0]?.items?.length ?? 0}`);
      if (!resp.ok) continue;
      cost.add(0.015 * (limit / 1000));
      const items = data?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items)) {
        let __kdDbgIdx = 0;
        if (items.length && merged.size === 0) {
          console.log(`[DFS volume sample suggestions]`, JSON.stringify(items[0]).slice(0, 400));
            console.log('[FULL ITEM suggestions]',
              JSON.stringify(data?.tasks?.[0]?.result?.[0], null, 2).slice(0, 2000));
            const it0 = items[0];
            console.log('[Volume check suggestions]', JSON.stringify({
              keyword: it0?.keyword,
              search_volume: it0?.search_volume,
              keyword_info_sv: it0?.keyword_info?.search_volume,
              monthly_searches_first: it0?.keyword_info?.monthly_searches?.[0]?.search_volume,
              kd: it0?.keyword_difficulty,
              kd2: it0?.keyword_info?.keyword_difficulty,
              kd3: it0?.keyword_info?.keyword_properties?.keyword_difficulty,
              kd4: it0?.keyword_properties?.keyword_difficulty,
            }));
            const dbg = items[0];
            console.log('[KD debug suggestions]', JSON.stringify({
              kd1: dbg?.keyword_difficulty,
              kd2: dbg?.keyword_info?.keyword_difficulty,
              kd3: dbg?.keyword_info?.keyword_properties?.keyword_difficulty,
              kd4: dbg?.keyword_properties?.keyword_difficulty,
              info_keys: Object.keys(dbg?.keyword_info || {}),
              props_keys: Object.keys(dbg?.keyword_properties || {}),
              top_keys: Object.keys(dbg || {}),
            }));
        }
        for (const it of items) {
          const kw = String(it?.keyword || "").trim().toLowerCase();
          const sv = Number(it?.keyword_info?.search_volume ?? 0);
          if (!kw) continue;
            // Post-filter: Russian-only (no language field allowed in request)
            if (!isRussianKeyword(kw)) continue;
            const kdRaw = it?.keyword_difficulty
              ?? it?.keyword_properties?.keyword_difficulty
              ?? it?.keyword_info?.keyword_difficulty
              ?? it?.keyword_info?.keyword_properties?.keyword_difficulty;
          if (__kdDbgIdx < 3) {
            __kdDbgIdx++;
            console.log('[KD RAW DEBUG]', JSON.stringify({
              keyword: it?.keyword,
              kd_raw: kdRaw,
              all_keys: Object.keys(it || {}),
              keyword_info_keys: Object.keys(it?.keyword_info || {}),
              keyword_properties: it?.keyword_properties,
            }));
          }
          const kd = (kdRaw === null || kdRaw === undefined) ? null : Math.max(0, Math.min(100, Math.round(Number(kdRaw))));
          const prev = merged.get(kw);
          if (!prev || sv > prev.search_volume) {
            // Preserve previously-seen KD if the new item lacks one
            const mergedKd = kd != null ? kd : (prev?.keyword_difficulty ?? null);
            merged.set(kw, { keyword: kw, search_volume: sv, keyword_difficulty: mergedKd });
          } else if (prev && kd != null && prev.keyword_difficulty == null) {
            prev.keyword_difficulty = kd;
          }
        }
      }
    } catch (e) {
      console.error(`[DFS suggestions] error q="${q}":`, (e as Error).message);
    }
  }
  console.log(`[DFS suggestions] merged=${merged.size}`);
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

  const merged = new Map<string, DfsKwData>();
  console.log(`[DFS competitors] region: ${region} (Labs API, no location)`);
  await Promise.allSettled(domains.map(async (target) => {
    try {
      const resp = await fetch(
        "https://api.dataforseo.com/v3/dataforseo_labs/google/keywords_for_site/live",
        {
          method: "POST",
          headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
          body: JSON.stringify([{
            target,
            location_code: 2643,
            language_code: "ru",
            limit: 500,
            filters: [["keyword_info.search_volume", ">", 10]],
          }]),
        },
      );
      const text = await resp.text();
      let data: any = {};
      try { data = JSON.parse(text); } catch {}
      logDfsResult("competitors", resp, data);
      console.log(`[DFS competitors] target=${target} status=${resp.status} task_status=${data?.tasks?.[0]?.status_code} task_msg="${data?.tasks?.[0]?.status_message ?? ''}" items=${data?.tasks?.[0]?.result?.[0]?.items?.length ?? 0}`);
      if (!resp.ok) return;
      cost.add(0.015 * 0.5);
      const items = data?.tasks?.[0]?.result?.[0]?.items;
      if (Array.isArray(items)) {
        if (items.length && merged.size === 0) {
          console.log(`[DFS volume sample competitors]`, JSON.stringify(items[0]).slice(0, 400));
          const dbg = items[0];
          console.log('[KD debug competitors]', JSON.stringify({
            kd1: dbg?.keyword_difficulty,
            kd2: dbg?.keyword_info?.keyword_difficulty,
            kd3: dbg?.keyword_info?.keyword_properties?.keyword_difficulty,
            kd4: dbg?.keyword_properties?.keyword_difficulty,
            info_keys: Object.keys(dbg?.keyword_info || {}),
            props_keys: Object.keys(dbg?.keyword_properties || {}),
            top_keys: Object.keys(dbg || {}),
          }));
        }
        for (const it of items) {
          const kw = String(it?.keyword || "").trim().toLowerCase();
          const sv = Number(it?.keyword_info?.search_volume ?? 0);
          if (!kw) continue;
          // Post-filter: Russian-only
          if (!isRussianKeyword(kw)) continue;
          const kdRaw = it?.keyword_difficulty
            ?? it?.keyword_properties?.keyword_difficulty
            ?? it?.keyword_info?.keyword_difficulty
            ?? it?.keyword_info?.keyword_properties?.keyword_difficulty;
          const kd = (kdRaw === null || kdRaw === undefined) ? null : Math.max(0, Math.min(100, Math.round(Number(kdRaw))));
          const prev = merged.get(kw);
          if (!prev || sv > prev.search_volume) {
            const mergedKd = kd != null ? kd : (prev?.keyword_difficulty ?? null);
            merged.set(kw, { keyword: kw, search_volume: sv, keyword_difficulty: mergedKd });
          } else if (prev && kd != null && prev.keyword_difficulty == null) {
            prev.keyword_difficulty = kd;
          }
        }
      }
    } catch (e) {
      console.error(`[DFS competitors] error target=${target}:`, (e as Error).message);
    }
  }));
  console.log(`[DFS competitors] domains=${domains.join(',')} merged=${merged.size}`);
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
  const wordstatKey = await getWordstatKey();
  const out: { ws: number; exact: number }[] = new Array(keywords.length);
  if (!wordstatKey) {
    await sleep(1000); // simulate
    for (let i = 0; i < keywords.length; i++) out[i] = mockFreq(keywords[i]);
    return out;
  }
  // Real Wordstat — batched (best-effort; falls back to mock per-batch on error)
  const regionId = wordstatRegionId(region);
  const batchSize = 50;
  const totalBatches = Math.ceil(keywords.length / batchSize);
  for (let b = 0; b < totalBatches; b++) {
    const start = b * batchSize;
    const batch = keywords.slice(start, start + batchSize);
    try {
      const resp = await fetch(`${WORDSTAT_BASE}/keywords/count`, {
        method: "POST",
        headers: { Authorization: `Bearer ${wordstatKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ keywords: batch, geo_id: [regionId] }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error(`[fetchFrequencies] wordstat FAIL url=${WORDSTAT_BASE}/keywords/count status=${resp.status} body=${t}`);
        throw new Error(`wordstat ${resp.status}: ${t.slice(0, 300)}`);
      }
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
              "Ты эксперт по SEO для русскоязычного рынка. Сгруппируй запросы в 10-20 кластеров максимум. " +
              "Каждый кластер должен содержать минимум 8 запросов. Объединяй близкие темы в один кластер. " +
              "Для каждого кластера поисковых запросов придумай короткое название на русском (3-6 слов). " +
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

// Retry naming for a single cluster with a simpler prompt — used as fallback
// when the batch call returned the default "Кластер N" placeholder.
async function nameClusterSingle(keywords: string[]): Promise<string | null> {
  if (!keywords.length || !LOVABLE_API_KEY) return null;
  const top5 = keywords.slice(0, 5).join(", ");
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: `Дай короткое название (2-3 слова) этой группе запросов: ${top5}. Только название, без пояснений.`,
          },
        ],
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = String(data?.choices?.[0]?.message?.content || "").trim();
    // Strip quotes / leading "название:" etc., take first line
    const cleaned = raw.split("\n")[0].replace(/^["«»'`]+|["«»'`]+$/g, "").replace(/^[Нн]азвание[:\s]*/, "").trim();
    if (!cleaned || cleaned.length > 60) return cleaned ? cleaned.slice(0, 60) : null;
    return cleaned;
  } catch (e) {
    console.warn("[worker] single cluster naming failed", e);
    return null;
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
  dfsDebugReplay = [];
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

  // NOTE: Wordstat API is unreachable from Supabase Edge runtime (DNS blocked).
  // For RU/BY we fall back to DataForSEO suggestions without location_code
  // (returns Ukrainian-market data but with valid KD), plus AI expansion.
  const isRu = isRussianRegion(region);
  console.log(`[Region routing] region="${region}" isRussian=${isRu} → DataForSEO (Wordstat disabled)`);

  // Per-source storage with frequency map (only DFS sources have real volumes)
  const dfsVolumes = new Map<string, number>(); // keyword -> max DFS search_volume
  const dfsKd = new Map<string, number>();      // keyword -> keyword_difficulty (Labs sources)
  const breakdown: Record<string, number> = {
    autocomplete: 0, suggestions: 0, competitors: 0, ai: 0,
  };

  type SourcePromiseResult = { source: string; keywords: string[]; withVolumes?: DfsKwData[] };
  const sourcePromises: Promise<SourcePromiseResult>[] = [];

  if (useAutocomplete && dfsAvailable) {
    sourcePromises.push(
      dfsAutocompleteSource(topic, seeds, region, cost)
        .then((arr) => ({ source: "autocomplete", keywords: arr.map((x) => x.keyword), withVolumes: arr })),
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

  // RU/BY long-tail boost via AI (Wordstat is disabled — DNS blocked from edge).
  if (isRu && (useSuggestions || useCompetitors)) {
    sourcePromises.push(
      aiSuggestionsForRu(topic, seeds, region)
        .then((kws) => ({ source: "ai", keywords: kws }))
        .catch((e) => { console.warn("[ai-suggestions-ru] failed", e); return { source: "ai", keywords: [] }; }),
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
  for (const line of dfsDebugReplay) console.log(line);

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
        if (v.keyword_difficulty != null) {
          const prevKd = dfsKd.get(kw);
          // Prefer the highest reported KD across sources (more conservative)
          if (prevKd === undefined || v.keyword_difficulty > prevKd) {
            dfsKd.set(kw, v.keyword_difficulty);
          }
        }
      }
    }
    for (const kw of filtered) allFromSources.add(kw);
  }
  for (const s of settled) {
    if (s.status === 'rejected') console.error('[Source REJECTED]', s.reason);
  }

  let rawKeywords = Array.from(allFromSources);
  console.log(`[Total after dedup]: ${rawKeywords.length} keywords | breakdown=${JSON.stringify(breakdown)} | dfsVolumes=${dfsVolumes.size}`);

  // Global post-processing: drop non-Russian / Ukrainian-leaking keywords
  const beforeRu = rawKeywords.length;
  rawKeywords = rawKeywords.filter(isRussianKeyword);
  const droppedRu = beforeRu - rawKeywords.length;
  if (droppedRu > 0) console.log(`[Russian filter] dropped ${droppedRu} non-Russian keywords (${beforeRu} -> ${rawKeywords.length})`);

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
  let realCount = 0;
  let mockCount = 0;
  const mockFallbackKeywords: string[] = [];
  const needFreq: { idx: number; keyword: string }[] = [];
  const freqs: { ws: number; exact: number }[] = new Array(rawKeywords.length);
  for (let i = 0; i < rawKeywords.length; i++) {
    const kw = rawKeywords[i];
    const dfsVol = dfsVolumes.get(kw);
    if (dfsVol && dfsVol > 0) {
      freqs[i] = { ws: dfsVol, exact: Math.floor(dfsVol * 0.3) };
      dataSources[i] = "dataforseo";
      realCount++;
    } else {
      needFreq.push({ idx: i, keyword: kw });
      dataSources[i] = "mock";
      mockCount++;
      mockFallbackKeywords.push(kw);
    }
  }
  if (mockFallbackKeywords.length) {
    console.log('[Mock fallback]', JSON.stringify({
      reason: 'DFS returned 0 results',
      count: mockFallbackKeywords.length,
      keywords: mockFallbackKeywords,
    }));
  }
  console.log(`[Volumes] real: ${realCount}, mock: ${mockCount}, dfsVolumesMapSize: ${dfsVolumes.size}`);
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
      keyword_difficulty: dfsKd.has(kw) ? (dfsKd.get(kw) as number) : null,
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
    let grpClusters = serpCluster(topItems, 0.5);
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
  let finalStates = cstates.filter((s) => !s.deleted && s.keywords.length > 0);

  // Enforce minimum cluster size: merge clusters with < MIN_CLUSTER_SIZE keywords
  // into the nearest larger cluster (same intent group) by text similarity.
  {
    const tooSmall = finalStates.filter((s) => s.keywords.length < MIN_CLUSTER_SIZE);
    const bigEnough = finalStates.filter((s) => s.keywords.length >= MIN_CLUSTER_SIZE);
    if (bigEnough.length > 0) {
      for (const s of tooSmall) {
        const sameIntent = bigEnough.filter((b) => b.intentGroup === s.intentGroup);
        const pool = sameIntent.length ? sameIntent : bigEnough;
        let bestIdx = 0;
        let bestSim = -1;
        const sample = s.keywords[0] || "";
        for (let i = 0; i < pool.length; i++) {
          const sim = textSim(sample, pool[i].keywords[0] || "");
          if (sim > bestSim) { bestSim = sim; bestIdx = i; }
        }
        pool[bestIdx].keywords.push(...s.keywords);
      }
      finalStates = bigEnough;
    }
  }

  // Cap at MAX_CLUSTERS — merge smallest clusters into nearest larger one
  while (finalStates.length > MAX_CLUSTERS) {
    finalStates.sort((a, b) => a.keywords.length - b.keywords.length);
    const smallest = finalStates.shift()!;
    const sameIntent = finalStates.filter((b) => b.intentGroup === smallest.intentGroup);
    const pool = sameIntent.length ? sameIntent : finalStates;
    let bestIdx = 0;
    let bestSim = -1;
    const sample = smallest.keywords[0] || "";
    for (let i = 0; i < pool.length; i++) {
      const sim = textSim(sample, pool[i].keywords[0] || "");
      if (sim > bestSim) { bestSim = sim; bestIdx = i; }
    }
    pool[bestIdx].keywords.push(...smallest.keywords);
  }

  // Retry naming for clusters that ended up with the default "Кластер N" placeholder.
  // This catches both AI failures and merges that pulled in unnamed orphan clusters.
  const placeholderRe = /^Кластер \d+$/;
  const unnamedIdx: number[] = [];
  for (let i = 0; i < finalStates.length; i++) {
    const nm = (finalStates[i].name || "").trim();
    if (!nm || placeholderRe.test(nm)) unnamedIdx.push(i);
  }
  if (unnamedIdx.length) {
    console.log(`[naming] retrying ${unnamedIdx.length} unnamed clusters via single-prompt fallback`);
    const retried = await Promise.all(
      unnamedIdx.map((i) => nameClusterSingle(finalStates[i].keywords)),
    );
    let fixed = 0;
    for (let j = 0; j < unnamedIdx.length; j++) {
      const newName = retried[j];
      if (newName) {
        finalStates[unnamedIdx[j]].name = newName;
        fixed++;
      }
    }
    console.log(`[naming] retry fixed ${fixed}/${unnamedIdx.length} clusters`);
  }

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

  // Final diagnostics: real (DataForSEO) vs mock frequencies
  {
    const realKws = kws.filter((k) => k.ws_frequency > 0 && k.data_source === "dataforseo");
    const mockKws = kws.filter((k) => k.data_source === "mock");
    console.log(`[Final] keywords with real DFS volume: ${realKws.length}`);
    console.log(`[Final] keywords with mock volume: ${mockKws.length}`);
    console.log(
      `[Final] sample real volumes:`,
      realKws.slice(0, 5).map((k) => `${k.keyword}: ${k.ws_frequency}`).join(" | "),
    );
  }

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