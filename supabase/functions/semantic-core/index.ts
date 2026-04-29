// deploy: v8 - openrouter everywhere
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const OPENROUTER_API_KEY_ENV = Deno.env.get("OPENROUTER_API_KEY") ?? "";

const AI_URL = "https://openrouter.ai/api/v1/chat/completions";
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
  } catch {
    return "";
  }
}
const OR_HEADERS_EXTRA = { "HTTP-Referer": "https://seo-modul.pro", "X-Title": "SEO-Audit Semantic Core" };

async function getSetting(key: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data } = await sb.from("system_settings").select("key_value").eq("key_name", key).maybeSingle();
  return (data?.key_value || "").trim();
}

const EXPAND_SYSTEM_PROMPT =
  "Ты эксперт по SEO для русскоязычного рынка. Твоя задача — расширить семантическое ядро по заданной теме. Генерируй ТОЛЬКО русскоязычные поисковые запросы, которые реальные пользователи вводят в Яндекс и Google.\nЗАПРЕЩЕНО: английские слова, транслитерация, технический жаргон.\nВозвращай ТОЛЬКО валидный JSON массив строк — никаких пояснений, никакого markdown, никаких ```json блоков.";

function buildExpandUserPrompt(topic: string, seeds: string[]): string {
  return `Тема: ${topic}\nДополнительные ключи: ${seeds.join(", ") || "—"}\n\nСгенерируй 150-200 поисковых запросов на русском языке по следующим категориям:\n1. Основные запросы (20-30 штук): прямые запросы по теме\n2. Коммерческие запросы (30-40 штук): купить, цена, стоимость, заказать, недорого, со скидкой, доставка, интернет-магазин, официальный сайт\n3. Информационные запросы (30-40 штук): как выбрать, какой лучше, отзывы, рейтинг, сравнение, характеристики, плюсы и минусы\n4. Вопросные запросы (20-30 штук): как, что, где, почему, сколько стоит, можно ли, как правильно\n5. Хвостовые запросы (30-40 штук): с уточнениями по размеру, цвету, материалу, бренду, городу (москва, спб, екатеринбург)\n6. LSI и синонимы (20-30 штук): смежные понятия, альтернативные названия\n\nВсе запросы должны быть на русском языке.`;
}

async function callExpandOnce(topic: string, seeds: string[]): Promise<string[]> {
  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      { role: "system", content: EXPAND_SYSTEM_PROMPT },
      { role: "user", content: buildExpandUserPrompt(topic, seeds) },
    ],
  };
  const resp = await fetch(AI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${await getOpenRouterKey()}`, "Content-Type": "application/json", ...OR_HEADERS_EXTRA },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI expand failed: ${resp.status} ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const raw = String(data?.choices?.[0]?.message?.content || "");
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) return [];
    return arr.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
  } catch {
    return [];
  }
}

async function expandKeywords(topic: string, seeds: string[]): Promise<string[]> {
  const first = await callExpandOnce(topic, seeds);
  const filterLatin = (arr: string[]) => {
    let dropped = 0;
    const kept = arr.filter((s) => {
      if (/[a-zA-Z]/.test(s)) { dropped++; return false; }
      return true;
    });
    return { kept, dropped };
  };
  let { kept, dropped } = filterLatin(first);
  let totalGenerated = first.length;
  let totalDropped = dropped;

  let merged = Array.from(new Set(kept));
  if (merged.length < 50) {
    try {
      const second = await callExpandOnce(topic, seeds);
      totalGenerated += second.length;
      const r2 = filterLatin(second);
      totalDropped += r2.dropped;
      merged = Array.from(new Set([...merged, ...r2.kept]));
    } catch (e) {
      console.warn("Second expand call failed", e);
    }
  }
  console.log(`[semantic-core] expand: generated=${totalGenerated}, filtered_latin=${totalDropped}, final=${merged.length}`);
  return merged.slice(0, 250);
}

async function nameCluster(keywords: string[]): Promise<string> {
  const sample = keywords.slice(0, 10).join(", ");
  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "You are an SEO expert. Given a cluster of semantically related search queries, generate a short descriptive cluster name in Russian (2-4 words). Return ONLY the cluster name string.",
      },
      { role: "user", content: `Queries in this cluster: ${sample}` },
    ],
  };
  try {
    const resp = await fetch(AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${await getOpenRouterKey()}`, "Content-Type": "application/json", ...OR_HEADERS_EXTRA },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return keywords[0] || "Кластер";
    const data = await resp.json();
    const txt = String(data?.choices?.[0]?.message?.content || "").trim().replace(/^["«]|["»]$/g, "");
    return txt.slice(0, 60) || keywords[0] || "Кластер";
  } catch {
    return keywords[0] || "Кластер";
  }
}

async function fetchSerpUrls(query: string, region: string, serperKey: string): Promise<string[]> {
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "ru", hl: "ru", location: region, num: 10 }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const organic = Array.isArray(data.organic) ? data.organic.slice(0, 10) : [];
    return organic.map((o: any) => String(o.link || "")).filter(Boolean);
  } catch {
    return [];
  }
}

function clusterByIntersection(
  items: { keyword: string; urls: string[]; score: number }[],
  threshold = 0.3,
): Map<string, string[]> {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const clusters = new Map<string, string[]>();
  let idx = 0;
  for (const head of sorted) {
    if (used.has(head.keyword)) continue;
    const id = `c${++idx}`;
    const group = [head.keyword];
    used.add(head.keyword);
    const headSet = new Set(head.urls);
    if (headSet.size > 0) {
      for (const cand of sorted) {
        if (used.has(cand.keyword)) continue;
        const inter = cand.urls.filter((u) => headSet.has(u)).length;
        const sim = inter / 10;
        if (sim >= threshold) {
          group.push(cand.keyword);
          used.add(cand.keyword);
        }
      }
    }
    clusters.set(id, group);
  }
  return clusters;
}

// ============== AI clustering fallback ==============
async function clusterWithAI(keywords: string[]): Promise<Map<string, string[]> | null> {
  const all = new Map<string, string[]>();
  const batchSize = 50;
  let idx = 0;
  for (let i = 0; i < keywords.length; i += batchSize) {
    const batch = keywords.slice(i, i + batchSize);
    const body = {
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "Ты эксперт по SEO. Сгруппируй список поисковых запросов по смысловым кластерам. Запросы об одном и том же — в одну группу. Возвращай ТОЛЬКО валидный JSON объект: { \"Название кластера\": [\"запрос1\", \"запрос2\"] }. Целевое количество кластеров: от 5 до 15. Не создавай кластер из одного запроса.",
        },
        { role: "user", content: `Сгруппируй эти запросы: ${batch.join(", ")}` },
      ],
    };
    try {
      const resp = await fetch(AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${await getOpenRouterKey()}`, "Content-Type": "application/json", ...OR_HEADERS_EXTRA },
        body: JSON.stringify(body),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      const raw = String(data?.choices?.[0]?.message?.content || "");
      const m = raw.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const obj = JSON.parse(m[0]);
      if (!obj || typeof obj !== "object") continue;
      for (const [name, kws] of Object.entries(obj)) {
        if (!Array.isArray(kws)) continue;
        const id = `c${++idx}`;
        const cleaned = (kws as any[]).map((s) => String(s).trim().toLowerCase()).filter(Boolean);
        if (cleaned.length) all.set(id, cleaned);
        // Save name in side channel
        (all as any)[`__name_${id}`] = String(name).slice(0, 60);
      }
    } catch (e) {
      console.warn("AI cluster batch failed", e);
      return null;
    }
  }
  return all.size ? all : null;
}

// ============== Keyword similarity fallback ==============
const STOP_WORDS = new Set([
  "купить", "как", "что", "где", "для", "в", "на", "по", "с", "и", "или", "не",
  "от", "до", "при", "о", "об", "из", "за", "к", "у", "это", "цена", "стоимость",
]);

function significantWords(kw: string): string[] {
  return kw
    .toLowerCase()
    .replace(/[^а-яёa-z0-9\s-]/gi, " ")
    .split(/\s+/)
    .filter((w) => w && !STOP_WORDS.has(w));
}

function clusterByKeywordSimilarity(keywords: string[]): Map<string, string[]> {
  const buckets = new Map<string, string[]>();
  for (const kw of keywords) {
    const sig = significantWords(kw).slice(0, 2);
    const key = sig.length >= 2 ? sig.sort().join("|") : (sig[0] || "__other__");
    const arr = buckets.get(key) || [];
    arr.push(kw);
    buckets.set(key, arr);
  }
  const out = new Map<string, string[]>();
  const others: string[] = [];
  let idx = 0;
  for (const [, kws] of buckets) {
    if (kws.length >= 2) out.set(`c${++idx}`, kws);
    else others.push(...kws);
  }
  if (others.length) out.set(`c${++idx}`, others);
  return out;
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
    const action: string = body.action || "expand";

    if (action === "expand") {
      const topic = String(body.topic || "").trim();
      const seeds: string[] = Array.isArray(body.seeds) ? body.seeds.map((s: any) => String(s).trim()).filter(Boolean) : [];
      if (!topic && !seeds.length) {
        return new Response(JSON.stringify({ error: "Нет темы и сидов" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const keywords = await expandKeywords(topic, seeds);
      return new Response(JSON.stringify({ keywords }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cluster") {
      const items: { keyword: string; score: number }[] =
        Array.isArray(body.items) ? body.items.map((i: any) => ({ keyword: String(i.keyword), score: Number(i.score) || 0 })) : [];
      const region = String(body.region || "Москва");
      if (!items.length) {
        return new Response(JSON.stringify({ clusters: [], assignments: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const serperKey = await getSetting("serper_api_key") || Deno.env.get("SERPER_API_KEY") || "";
      if (!serperKey) {
        return new Response(JSON.stringify({ error: "Serper API key не настроен" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Лимит: первые 40 ключевых для SERP-кластеризации (экономим запросы)
      const limited = items.slice(0, 40);
      const enriched: { keyword: string; urls: string[]; score: number }[] = [];
      // Параллельно пакетами по 5
      for (let i = 0; i < limited.length; i += 5) {
        const batch = limited.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (it) => {
          const urls = await fetchSerpUrls(it.keyword, region, serperKey);
          return { keyword: it.keyword, urls, score: it.score };
        }));
        enriched.push(...results);
      }
      // Остальные кладём в одиночные кластеры
      const tail = items.slice(40).map((it) => ({ keyword: it.keyword, urls: [], score: it.score }));
      const all = [...enriched, ...tail];

      // Step 1: SERP clustering
      const emptyCount = enriched.filter((e) => e.urls.length === 0).length;
      const serpFailureRate = enriched.length ? emptyCount / enriched.length : 1;
      let method: "serp" | "ai" | "keywords" = "serp";
      let groups: Map<string, string[]>;
      let presetNames: Record<string, string> = {};

      if (serpFailureRate > 0.5) {
        console.warn(`[semantic-core] SERP failure rate ${(serpFailureRate * 100).toFixed(0)}% — falling back to AI clustering`);
        const aiGroups = await clusterWithAI(items.map((i) => i.keyword));
        if (aiGroups && aiGroups.size > 0) {
          method = "ai";
          groups = aiGroups;
          for (const id of aiGroups.keys()) {
            const n = (aiGroups as any)[`__name_${id}`];
            if (n) presetNames[id] = n;
          }
        } else {
          console.warn("[semantic-core] AI clustering failed — falling back to keyword similarity");
          method = "keywords";
          groups = clusterByKeywordSimilarity(items.map((i) => i.keyword));
        }
      } else {
        groups = clusterByIntersection(all, 0.3);
        // If SERP produced too many singletons, also fall back
        const singletonRatio = Array.from(groups.values()).filter((g) => g.length === 1).length / Math.max(1, groups.size);
        if (groups.size / items.length > 0.5 && singletonRatio > 0.7) {
          console.warn("[semantic-core] SERP clustering produced too many singletons — trying AI");
          const aiGroups = await clusterWithAI(items.map((i) => i.keyword));
          if (aiGroups && aiGroups.size > 0 && aiGroups.size < items.length * 0.5) {
            method = "ai";
            groups = aiGroups;
            for (const id of aiGroups.keys()) {
              const n = (aiGroups as any)[`__name_${id}`];
              if (n) presetNames[id] = n;
            }
          } else {
            method = "keywords";
            groups = clusterByKeywordSimilarity(items.map((i) => i.keyword));
          }
        }
      }

      const clusters: { id: string; name: string; keywords: string[] }[] = [];
      const assignments: Record<string, string> = {};
      for (const [id, kws] of groups.entries()) {
        let name = presetNames[id];
        if (!name) name = kws.length > 1 ? await nameCluster(kws) : kws[0];
        clusters.push({ id, name, keywords: kws });
        for (const kw of kws) assignments[kw] = id;
      }
      console.log(`[semantic-core] cluster method=${method}, keywords=${items.length}, clusters=${clusters.length}`);
      return new Response(JSON.stringify({ clusters, assignments, method }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("semantic-core error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});