// deploy: v2 - generic analytics module (13 modules) + real-data evidence (Serper SERP, DataForSEO volumes)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const SERPER_KEY = Deno.env.get("SERPER_API_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

async function getKey(): Promise<string> {
  const env = Deno.env.get("OPENROUTER_API_KEY") ?? "";
  if (env) return env;
  try {
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data } = await sb.from("system_settings").select("key_value").eq("key_name", "openrouter_api_key").maybeSingle();
    return String((data as any)?.key_value ?? "").trim();
  } catch { return ""; }
}

type Mod = {
  role: string; task: string; scores: string[]; lists: string[];
  table: { title: string; columns: string[]; rows: string };
  serp: boolean;      // нужен реальный разбор выдачи
  keywords: boolean;  // нужны реальные частоты
};

const MODULES: Record<string, Mod> = {
  "demand-commercial": {
    role: "commercial SEO strategist и аналитик поискового спроса",
    task: "Найди спрос с высокой коммерческой ценностью: транзакционные и коммерческо-исследовательские запросы, близость к покупке, ценность лида, конкуренцию за деньги.",
    scores: ["Коммерческий потенциал", "Близость к покупке", "Доступность", "Ценность лида"],
    lists: ["Самые денежные кластеры", "Быстрые коммерческие победы", "Скрытый коммерческий спрос", "Дорогие, но перегретые запросы"],
    table: { title: "Коммерческие кластеры", columns: ["Кластер", "Примеры запросов", "Интент", "Коммерч. ценность 0-100", "Конкуренция 0-100", "Тип страницы", "Комментарий"], rows: "10-14" },
    serp: true, keywords: true,
  },
  "audience-journey": {
    role: "специалист по customer journey и поисковому поведению",
    task: "Распредели поисковые запросы по этапам пути покупателя: осознание проблемы, поиск решений, сравнение, выбор, покупка, использование, повторная покупка/лояльность.",
    scores: ["Покрываемость пути", "Ценность ранних этапов", "Ценность этапа выбора", "Потенциал удержания"],
    lists: ["Запросы этапа осознания", "Запросы этапа сравнения", "Запросы этапа покупки", "Пробелы в пути"],
    table: { title: "Запросы по этапам", columns: ["Этап", "Мысли и вопросы покупателя", "Примеры запросов", "Интент", "Тип контента", "CTA", "Ценность 0-100"], rows: "7-9" },
    serp: true, keywords: true,
  },
  "audience-journey-v2": {
    role: "CX-стратег и SEO-архитектор",
    task: "Построй базовую карту пути покупателя v2.1: этапы, триггеры перехода, барьеры, точки контакта, эмоции, доказательства, которые нужны на каждом этапе, и метрики.",
    scores: ["Зрелость пути", "Сила триггеров", "Барьеры (обратная шкала)", "Готовность контента"],
    lists: ["Ключевые триггеры", "Главные барьеры", "Нужные доказательства", "Точки потерь"],
    table: { title: "Карта пути v2.1", columns: ["Этап", "Триггер перехода", "Барьер", "Точки контакта", "Эмоция", "Нужное доказательство", "Метрика"], rows: "6-8" },
    serp: true, keywords: false,
  },
  "audience-language": {
    role: "лингвист-аналитик и SEO-копирайтер",
    task: "Составь карту языка ниши: профессиональные термины против бытовых формулировок, синонимы, жаргон, ошибочные написания, региональные варианты, формулировки для заголовков и сниппетов.",
    scores: ["Разрыв эксперт/клиент", "Разнообразие формулировок", "Потенциал long-tail", "Ясность терминов"],
    lists: ["Как говорит клиент", "Как говорит эксперт", "Ошибочные и разговорные написания", "Формулировки для заголовков"],
    table: { title: "Словарь ниши", columns: ["Термин эксперта", "Как говорит клиент", "Синонимы и варианты", "Где использовать", "Ошибка, которой избегать"], rows: "14-20" },
    serp: true, keywords: true,
  },
  "audience-community": {
    role: "исследователь сообществ и voice-of-customer аналитик",
    task: "Опиши живой язык и сигналы сообщества: какие площадки (форумы, Telegram, VK, отзовики, Reddit/Pikabu, YouTube-комментарии) обсуждают нишу, повторяющиеся вопросы, жалобы, мифы, фразы, сигналы спроса.",
    scores: ["Активность сообществ", "Сила сигналов спроса", "Негатив (обратная шкала)", "Полезность для контента"],
    lists: ["Частые вопросы", "Частые жалобы", "Мифы и заблуждения", "Живые фразы для текстов"],
    table: { title: "Площадки и сигналы", columns: ["Площадка", "О чём говорят", "Типичная фраза", "Сигнал", "Как использовать"], rows: "8-12" },
    serp: true, keywords: false,
  },
  "ai-formats": {
    role: "контент-стратег и специалист по поисковым интентам",
    task: "Подбери форматы контента под спрос и интенты: какие форматы (лендинг, каталог, сравнение, гайд, калькулятор, FAQ, видео, чек-лист, кейс, обзор) выигрывают выдачу и ИИ-ответы по каждому кластеру.",
    scores: ["Соответствие форматов интентам", "Потенциал интерактива", "Потенциал видео", "Цитируемость ИИ"],
    lists: ["Обязательные форматы", "Недооценённые форматы", "Форматы для ИИ-ответов", "Форматы, которые не работают"],
    table: { title: "Формат под кластер", columns: ["Кластер / интент", "Лучший формат", "Почему", "Обязательные элементы", "Сложность 0-100", "Ценность 0-100"], rows: "10-14" },
    serp: true, keywords: true,
  },
  "serp-reality": {
    role: "аналитик конкуренции в поисковой выдаче",
    task: "Оцени реальную конкурентность выдачи: кто в ТОП (агрегаторы, маркетплейсы, бренды, медиа, малые сайты), доля SERP-фич и ИИ-ответов, реальные шансы нового сайта, где выдача слабая.",
    scores: ["Реальная доступность ТОП", "Доминирование агрегаторов (обратная)", "Слабость ТОП", "Давление ИИ-ответов (обратная)"],
    lists: ["Слабые выдачи для атаки", "Выдачи, занятые гигантами", "SERP-фичи для захвата", "Ложно-лёгкие запросы"],
    table: { title: "Кластеры и выдача", columns: ["Кластер", "Кто в ТОП-10", "SERP-фичи", "Сложность 0-100", "Шанс нового сайта 0-100", "Что нужно для входа"], rows: "10-12" },
    serp: true, keywords: true,
  },
  "ai-ecosystem": {
    role: "аналитик digital-экосистемы ниши",
    task: "Проанализируй платформы и внешнюю среду: маркетплейсы, агрегаторы, карты, каталоги, соцсети, видеоплатформы, отзовики, справочники, ИИ-ассистенты. Где аудитория, где нужно присутствие, что это даёт SEO.",
    scores: ["Зависимость от платформ", "Потенциал внешнего трафика", "Возможности присутствия", "Риск платформ"],
    lists: ["Обязательные площадки", "Недооценённые площадки", "Площадки для бренда и доверия", "Риски зависимости"],
    table: { title: "Площадки", columns: ["Площадка", "Роль в нише", "Аудитория", "Что разместить", "Влияние на SEO", "Приоритет"], rows: "10-14" },
    serp: true, keywords: false,
  },
  "linkability": {
    role: "линкбилдинг-стратег и digital PR-специалист",
    task: "Оцени потенциал естественных ссылок: какие активы (исследования, данные, калькуляторы, сервисы, кейсы, инфографика) дадут ссылки сами, какие площадки дадут их быстрее всего, что мешает.",
    scores: ["Потенциал цифрового PR", "Интерес площадок", "Цена получения ссылки", "Защищённость от копирования"],
    lists: ["Активы, дающие ссылки", "Быстрые площадки", "Данные для инфоповодов", "Что не даст ссылок"],
    table: { title: "Активы и ссылки", columns: ["Актив", "Почему даст ссылки", "Кто сошлётся", "Сложность 0-100", "Потенциал ссылок 0-100", "Как проверить"], rows: "8-12" },
    serp: true, keywords: false,
  },
  "eeat": {
    role: "аналитик качества и доверия сайтов (E-E-A-T)",
    task: "Оцени требования к доверию в нише: какие доказательства экспертизы, опыта, авторства и надёжности нужны, какие страницы и данные обязательны, что проверяют поисковики и ИИ-ответы.",
    scores: ["Порог доверия", "Ценность опыта автора", "Риск YMYL", "Готовность к проверке"],
    lists: ["Обязательные доказательства", "Страницы доверия", "Сигналы экспертизы", "Красные флаги"],
    table: { title: "Требования доверия", columns: ["Требование", "Почему важно", "Как подтвердить", "Где разместить", "Приоритет", "Риск без него"], rows: "10-14" },
    serp: true, keywords: false,
  },
  "entities": {
    role: "специалист по семантическим графам и knowledge graph",
    task: "Построй карту сущностей ниши: ключевые сущности (продукты, процессы, материалы, бренды, люди, места, стандарты), их атрибуты и связи, что обязательно раскрыть для тематической полноты.",
    scores: ["Сложность графа сущностей", "Тематическая глубина", "Потенциал Knowledge Graph", "Пробелы у конкурентов"],
    lists: ["Ядровые сущности", "Атрибуты, которые ищут", "Неочевидные связи", "Сущности для schema.org"],
    table: { title: "Сущности и связи", columns: ["Сущность", "Тип", "Ключевые атрибуты", "Связана с", "Где раскрыть", "Важность 0-100"], rows: "14-20" },
    serp: true, keywords: true,
  },
  "risks": {
    role: "аналитик регуляторных, репутационных и контентных рисков",
    task: "Определи риски ниши: законодательство РФ (реклама, ФЗ о персональных данных, медицинские/финансовые ограничения, маркировка), репутационные риски, санкции поисковиков, риски ИИ-контента, судебные претензии.",
    scores: ["Регуляторный риск", "Репутационный риск", "Риск санкций поисковиков", "Общая безопасность (обратная)"],
    lists: ["Регуляторные ограничения", "Репутационные угрозы", "Контентные риски", "Обязательные дисклеймеры"],
    table: { title: "Реестр рисков", columns: ["Риск", "Тип", "Вероятность 0-100", "Ущерб 0-100", "Как снизить", "Ответственный"], rows: "10-14" },
    serp: false, keywords: false,
  },
  "ai-search": {
    role: "специалист по GEO/AEO (оптимизация под ИИ-поиск: Google AI Overviews, Яндекс Нейро, Алиса, ChatGPT, Perplexity)",
    task: "Найди возможности в ИИ-поиске: какие запросы ниши закрываются ИИ-ответами, где можно стать цитируемым источником, какие форматы и факты ИИ берёт, где защищать клики.",
    scores: ["Доля ИИ-ответов", "Потенциал цитирования", "Риск потери кликов", "Готовность ниши к GEO"],
    lists: ["Запросы для цитирования", "Запросы с риском потери кликов", "Факты и данные, которые берёт ИИ", "Форматы для ИИ"],
    table: { title: "ИИ-возможности", columns: ["Кластер запросов", "Как отвечает ИИ", "Шанс цитирования 0-100", "Риск потери клика 0-100", "Что сделать"], rows: "10-12" },
    serp: true, keywords: true,
  },
};

/* ---------------- Real data: Serper SERP ---------------- */

const AGGREGATORS = new Set([
  "avito.ru", "ozon.ru", "wildberries.ru", "market.yandex.ru", "yandex.ru", "drom.ru", "hh.ru",
  "youla.ru", "superjob.ru", "rabota.ru", "cian.ru", "etagi.com", "ngs.ru", "2gis.ru", "yell.ru",
  "orgpage.ru", "promportal.su", "flamp.ru", "tinkoff.ru", "banki.ru", "dzen.ru", "vc.ru",
  "habr.com", "youtube.com", "wikipedia.org", "reddit.com", "pikabu.ru", "otzovik.com",
  "irecommend.ru", "quora.com", "sberbank.ru", "gosuslugi.ru", "auto.ru", "domclick.ru",
  "kinopoisk.ru", "aliexpress.ru", "lamoda.ru", "citilink.ru", "mvideo.ru", "dns-shop.ru",
]);
const MEDIA = new Set(["dzen.ru", "vc.ru", "habr.com", "ria.ru", "rbc.ru", "kommersant.ru", "vedomosti.ru", "forbes.ru", "wikipedia.org", "youtube.com", "pikabu.ru", "vc.ru"]);

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
function classify(host: string): string {
  if (!host) return "unknown";
  const root = host.split(".").slice(-2).join(".");
  if (AGGREGATORS.has(root) || AGGREGATORS.has(host)) return MEDIA.has(root) ? "медиа/площадка" : "агрегатор/маркетплейс";
  if (MEDIA.has(root)) return "медиа/площадка";
  return "сайт-конкурент";
}

type SerpRow = { domain: string; kind: string; position: number };
type SerpEvidence = {
  query: string;
  rows: SerpRow[];
  paa: string[];
  related: string[];
  features: string[];
  ai_overview: boolean;
  competitors: number;
  aggregators: number;
};

type SerpResult = { ev: SerpEvidence | null; status: number; msg: string };

async function serpOne(query: string, gl: string, hl: string, location: string): Promise<SerpResult> {
  if (!SERPER_KEY) return { ev: null, status: 0, msg: "ключ не настроен" };
  const attempt = async (withLoc: boolean) => {
    const body: Record<string, unknown> = { q: query, gl, hl, num: 10 };
    if (withLoc && location) body.location = location;
    return fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
  };
  try {
    let r = await attempt(true);
    if (!r.ok && location) r = await attempt(false); // неверное название города — пробуем без него
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      return { ev: null, status: r.status, msg: t.slice(0, 160) };
    }
    const d: any = await r.json();
    const organic = Array.isArray(d?.organic) ? d.organic.slice(0, 10) : [];
    const rows: SerpRow[] = organic
      .map((it: any, i: number) => ({ domain: hostOf(String(it?.link || "")), kind: classify(hostOf(String(it?.link || ""))), position: Number(it?.position ?? i + 1) }))
      .filter((x: SerpRow) => !!x.domain);
    const paa = (Array.isArray(d?.peopleAlsoAsk) ? d.peopleAlsoAsk : [])
      .map((x: any) => String(x?.question || "").trim()).filter(Boolean).slice(0, 6);
    const related = (Array.isArray(d?.relatedSearches) ? d.relatedSearches : [])
      .map((x: any) => String(x?.query || "").trim()).filter(Boolean).slice(0, 8);
    const features: string[] = [];
    if (d?.knowledgeGraph) features.push("knowledgeGraph");
    if (d?.answerBox) features.push("answerBox");
    if (Array.isArray(d?.peopleAlsoAsk) && d.peopleAlsoAsk.length) features.push("peopleAlsoAsk");
    if (Array.isArray(d?.video) && d.video.length) features.push("video");
    if (Array.isArray(d?.shopping) && d.shopping.length) features.push("shopping");
    if (Array.isArray(d?.topStories) && d.topStories.length) features.push("topStories");
    if (Array.isArray(d?.places) && d.places.length) features.push("localPack");
    if (Array.isArray(d?.relatedSearches) && d.relatedSearches.length) features.push("relatedSearches");
    const aiOverview = !!(d?.aiOverview || d?.ai_overview || d?.generativeAi);
    const ev: SerpEvidence = {
      query, rows, paa, related, features,
      ai_overview: aiOverview,
      competitors: rows.filter((x) => x.kind === "сайт-конкурент").length,
      aggregators: rows.filter((x) => x.kind !== "сайт-конкурент").length,
    };
    return { ev, status: 200, msg: "" };
  } catch (e) {
    return { ev: null, status: -1, msg: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------------- Real data: DataForSEO volumes ---------------- */

type KwRow = { keyword: string; volume: number; competition: number | null; cpc: number | null; difficulty: number | null };

function dfsAuth(): string { return "Basic " + btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`); }

type DfsResult = { rows: KwRow[]; status: number; msg: string };

async function dfsKeywords(seed: string): Promise<DfsResult> {
  if (!DFS_LOGIN || !DFS_PASSWORD) return { rows: [], status: 0, msg: "доступа нет" };
  try {
    const r = await fetch("https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_suggestions/live", {
      method: "POST",
      headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
      body: JSON.stringify([{
        keyword: seed,
        language_code: "ru",
        limit: 40,
        order_by: ["keyword_info.search_volume,desc"],
        filters: [["keyword_info.search_volume", ">", 10]],
      }]),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await r.text();
    let d: any = {}; try { d = JSON.parse(text); } catch { /* не JSON */ }
    const msg = String(d?.tasks?.[0]?.status_message ?? text.slice(0, 160));
    if (!r.ok) return { rows: [], status: r.status, msg };
    const items = d?.tasks?.[0]?.result?.[0]?.items;
    if (!Array.isArray(items)) return { rows: [], status: r.status, msg };
    const rows = items.slice(0, 30).map((it: any) => ({
      keyword: String(it?.keyword || "").trim(),
      volume: Number(it?.keyword_info?.search_volume ?? it?.keyword_info?.monthly_searches?.[0]?.search_volume ?? 0),
      competition: it?.keyword_info?.competition == null ? null : Number(it.keyword_info.competition),
      cpc: it?.keyword_info?.cpc == null ? null : Number(it.keyword_info.cpc),
      difficulty: it?.keyword_difficulty == null ? null : Number(it.keyword_difficulty),
    })).filter((x: KwRow) => !!x.keyword);
    return { rows, status: r.status, msg };
  } catch (e) {
    return { rows: [], status: -1, msg: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------------- Real data: DataForSEO SERP (fallback when Serper is out of credits) ---------------- */

const DFS_LOCATION_NAME: Record<string, string> = { ru: "Russia", kz: "Kazakhstan", by: "Belarus", ua: "Ukraine", us: "United States", de: "Germany", tr: "Turkey" };

async function dfsSerpOne(query: string, gl: string): Promise<SerpResult> {
  if (!DFS_LOGIN || !DFS_PASSWORD) return { ev: null, status: 0, msg: "доступа нет" };

  const call = async (withLoc: boolean) => {
    const task: Record<string, unknown> = { keyword: query, language_code: "ru", depth: 10, priority: 10 };
    if (withLoc) task.location_name = DFS_LOCATION_NAME[gl] ?? "Russia";
    const r = await fetch("https://api.dataforseo.com/v3/serp/google/organic/live/advanced", {
      method: "POST",
      headers: { Authorization: dfsAuth(), "Content-Type": "application/json" },
      body: JSON.stringify([task]),
      signal: AbortSignal.timeout(25_000),
    });
    const text = await r.text();
    let d: any = {}; try { d = JSON.parse(text); } catch { /* не JSON */ }
    return {
      http: r.status,
      code: Number(d?.tasks?.[0]?.status_code ?? 0),
      msg: String(d?.tasks?.[0]?.status_message ?? text.slice(0, 120)),
      items: d?.tasks?.[0]?.result?.[0]?.items,
    };
  };

  const pick = (items: unknown): SerpEvidence | null => {
    if (!Array.isArray(items)) return null;
    const rows: SerpRow[] = items
      .filter((it: any) => it?.type === "organic" && it?.domain)
      .slice(0, 10)
      .map((it: any, i: number) => {
        const host = String(it.domain).replace(/^www\./, "").toLowerCase();
        return { domain: host, kind: classify(host), position: Number(it.position ?? i + 1) };
      });
    if (!rows.length) return null;
    const types: string[] = Array.from(new Set(items.map((it: any) => String(it?.type || "")).filter(Boolean)));
    const paa: string[] = [];
    for (const it of items) {
      if (String(it?.type || "").includes("people_also_ask")) {
        if (it?.title) paa.push(String(it.title));
        for (const sub of Array.isArray(it?.items) ? it.items : []) if (sub?.title) paa.push(String(sub.title));
      }
    }
    const related = items
      .filter((it: any) => String(it?.type || "").includes("related_searches"))
      .flatMap((it: any) => (Array.isArray(it?.items) ? it.items : []).map((s: any) => String(s?.title || "")).filter(Boolean))
      .slice(0, 8);
    return {
      query, rows, paa: paa.slice(0, 6), related,
      features: types.filter((t) => t !== "organic"),
      ai_overview: types.some((t) => t.includes("ai_") || t.includes("generative")),
      competitors: rows.filter((x) => x.kind === "сайт-конкурент").length,
      aggregators: rows.filter((x) => x.kind !== "сайт-конкурент").length,
    };
  };

  try {
    const a = await call(true);
    const evA = pick(a.items);
    if (evA) return { ev: evA, status: 200, msg: "" };
    const b = await call(false);
    const evB = pick(b.items);
    if (evB) return { ev: evB, status: 200, msg: "" };
    return { ev: null, status: b.code || b.http || a.code || a.http, msg: `с гео: ${a.code} ${a.msg}; без гео: ${b.code} ${b.msg}` };
  } catch (e) {
    return { ev: null, status: -1, msg: e instanceof Error ? e.message : String(e) };
  }
}

/* ---------------- Evidence assembly ---------------- */

type Evidence = {
  sources: string[];
  notes: string[];
  serp: SerpEvidence[];
  keywords: KwRow[];
};

function seedQueries(niche: string, product: string, own: string[]): string[] {
  const base = (product.trim().length > 2 ? product : niche).trim();
  const out: string[] = [];
  for (const q of own) if (q.trim().length > 1 && out.length < 6) out.push(q.trim().slice(0, 80));
  const gen = [base, `${base} купить`, `${base} цена`, `${base} как выбрать`, `${base} лучшие`];
  for (const q of gen) if (q.trim().length > 1 && out.length < 6) out.push(q.slice(0, 80));
  return Array.from(new Set(out)).slice(0, 6);
}

function geoParts(geo: string): { gl: string; hl: string; location: string } {
  const g = geo.toLowerCase();
  const gl = g.includes("казах") ? "kz" : g.includes("белор") ? "by" : g.includes("укра") ? "ua" : g.includes("турц") ? "tr" : g.includes("герм") ? "de" : g.includes("емб") || g.includes("eng") || g.includes("сша") ? "us" : "ru";
  const hl = gl === "ru" ? "ru" : gl === "us" || gl === "de" || gl === "tr" ? "en" : "ru";
  // Serper location: keep only the city/country words, drop noise
  const location = geo.split(/[,;]+/).map((s) => s.trim()).filter(Boolean).slice(-1)[0] ?? "";
  return { gl, hl, location };
}

async function buildEvidence(mod: Mod, niche: string, product: string, geo: string, ownQueries: string[]): Promise<Evidence> {
  const notes: string[] = [];
  const sources: string[] = [];
  const serp: SerpEvidence[] = [];
  let keywords: KwRow[] = [];

  if (mod.serp) {
    const { gl, hl, location } = geoParts(geo);
    const queries = seedQueries(niche, product, ownQueries);
    let why = "";
    if (SERPER_KEY) {
      const res = await Promise.all(queries.map((q) => serpOne(q, gl, hl, location)));
      for (const r of res) if (r.ev && r.ev.rows.length) serp.push(r.ev);
      if (serp.length) sources.push(`serper:${serp.length}`);
      else {
        const bad = res.find((r) => r.status !== 200);
        why = bad ? `Serper, код ${bad.status}${bad.msg ? ": " + bad.msg.slice(0, 120) : ""}` : "Serper не ответил";
      }
    } else why = "ключ Serper не настроен";

    if (!serp.length && DFS_LOGIN && DFS_PASSWORD) {
      const fb = await Promise.all(queries.map((q) => dfsSerpOne(q, gl)));
      for (const r of fb) if (r.ev && r.ev.rows.length) serp.push(r.ev);
      if (serp.length) {
        sources.push(`dataforseo-serp:${serp.length}`);
        notes.push(`Выдача получена из DataForSEO, потому что ${why}.`);
      } else {
        const bad = fb.find((r) => r.status !== 200);
        notes.push(`Выдачу получить не удалось (${why}; DataForSEO${bad ? `: код ${bad.status}${bad.msg ? " " + bad.msg.slice(0, 140) : ""}` : " не ответить"}) — вывод только на экспертной оценке.`);
      }
    } else if (!serp.length) {
      notes.push(`Выдачу получить не удалось (${why}) — вывод только на экспертной оценке.`);
    }
  }

  if (mod.keywords) {
    if (!DFS_LOGIN || !DFS_PASSWORD) {
      notes.push("Доступа к DataForSEO нет — реальных частот запросов нет.");
    } else {
      let d = await dfsKeywords(niche.trim());
      if (!d.rows.length && product.trim().length > 2) {
        const d2 = await dfsKeywords(product.trim());
        if (d2.rows.length) d = d2;
        else if (d2.status) d = { rows: [], status: d2.status, msg: d2.msg || d.msg };
      }
      keywords = d.rows;
      if (keywords.length) sources.push(`dataforseo:${keywords.length}`);
      else notes.push(`DataForSEO не вернул частот${d.status ? ` (код ${d.status}${d.msg ? ": " + d.msg.slice(0, 120) : ""})` : ""} — цифры частот не использовать.`);
    }
  }

  return { sources, notes, serp, keywords };
}

function evidenceBlock(ev: Evidence): string {
  const parts: string[] = [];
  if (ev.serp.length) {
    const lines = ev.serp.map((s) => {
      const domains = s.rows.map((r) => `${r.domain}(${r.position};${r.kind})`).join(", ");
      const extra = [
        s.paa.length ? `вопросы: ${s.paa.join(" | ")}` : "",
        s.related.length ? `смежные: ${s.related.join(", ")}` : "",
        s.features.length ? `фичи: ${s.features.join(", ")}` : "",
        s.ai_overview ? "есть ИИ-ответ" : "",
      ].filter(Boolean).join("; ");
      return `- «${s.query}»: ТОП-10 = ${domains || "пусто"}; конкурентов ${s.competitors}, агрегаторов/медиа ${s.aggregators}${extra ? "; " + extra : ""}`;
    });
    parts.push(`РЕАЛЬНАЯ ВЫДАЧА (Google, top-10, получено сейчас):\n${lines.join("\n")}`);
  }
  if (ev.keywords.length) {
    const lines = ev.keywords.map((k) =>
      `- ${k.keyword}: объём ${k.volume}/мес${k.difficulty != null ? `, сложность ${k.difficulty}` : ""}${k.competition != null ? `, конкуренция ${k.competition}` : ""}${k.cpc != null ? `, CPC ${Math.round(k.cpc)}$` : ""}`);
    parts.push(`РЕАЛЬНЫЕ ЧАСТОТЫ (DataForSEO):\n${lines.join("\n")}`);
  }
  if (!parts.length) return "РЕАЛЬНЫХ ДАННЫХ НЕТ. Оценивай как эксперт и прямо пиши, где не хватает данных.";
  return `${parts.join("\n\n")}

КАК ИСПОЛЬЗОВАТЬ:
- Опирайся на эти данные: оценки 0-100 и выводы обосновывай ими (кто реально в ТОП, какие объёмы, какие вопросы задают).
- Не выдумывай частоты и не меняй цифры из данных. Если нужных данных нет — так и напиши: «нет данных».
- В выводах ссылайся на факты из данных (например: «в ТОП-10 по 4 из 5 запросов — агрегаторы»).`;
}

function systemPrompt(m: Mod): string {
  return `Ты — ${m.role} уровня Senior (10+ лет практики). ${m.task}
Пиши по-русски, конкретно для заданной ниши и гео, без общих фраз.

Верни строго валидный JSON без markdown:
{
  "scores": [${m.scores.map((s) => `{"label":"${s}","value":0-100,"comment":"..."}`).join(",")}],
  "verdict": {"overview":"3-5 предложений","main_opportunity":"...","main_risk":"...","strategy":"..."},
  "top_lists": [${m.lists.map((l) => `{"title":"${l}","items":["5 пунктов"]}`).join(",")}],
  "table": {"title":"${m.table.title}","columns":${JSON.stringify(m.table.columns)},"rows":[["значения по колонкам"]]},
  "roadmap": [{"phase":"Первые 30 дней","actions":["..."]},{"phase":"Первый квартал","actions":["..."]},{"phase":"6-12 месяцев","actions":["..."]}]
}
В table.rows — ${m.table.rows} строк, каждая строка — массив строк длиной ${m.table.columns.length}. В каждом списке top_lists — ровно 5 пунктов.`;
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: u } = await sbUser.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const mod = MODULES[String(body?.module || "")];
    if (!mod) return json({ error: "Неизвестный модуль" }, 400);
    if (!body?.niche || String(body.niche).trim().length < 2) return json({ error: "Укажите нишу" }, 400);

    const key = await getKey();
    if (!key) return json({ error: "Ключ OpenRouter не настроен" }, 500);

    const niche = String(body.niche).trim();
    const product = String(body.product || "").trim();
    const geo = String(body.geo || "Россия").trim();
    const ownQueries = Array.isArray(body.queries)
      ? body.queries.map((x: unknown) => String(x)).filter(Boolean)
      : String(body.queries || "").split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean);

    const evidence = await buildEvidence(mod, niche, product, geo, ownQueries);

    const user = `Параметры:
- Ниша: ${niche}
- Сайт: ${body.site || "-"}
- Гео: ${geo || "Россия"}
- Продукт/услуги: ${product || "-"}
- Аудитория: ${body.audience || "-"}
- Тип бизнеса: ${body.businessType || "-"}
- Доп. контекст: ${body.extra || "-"}

${evidenceBlock(evidence)}

Верни строго JSON по схеме.`;

    let lastErr = "";
    for (const model of ["google/gemini-2.5-flash", "openai/gpt-4o-mini"]) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 110_000);
      try {
        const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST", signal: ctrl.signal,
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "HTTP-Referer": "https://seo-modul.pro", "X-Title": "SEO-Audit Analytics" },
          body: JSON.stringify({ model, response_format: { type: "json_object" }, temperature: 0.5, messages: [{ role: "system", content: systemPrompt(mod) }, { role: "user", content: user }] }),
        });
        clearTimeout(timer);
        if (!r.ok) { lastErr = `OpenRouter ${r.status}`; continue; }
        const d = await r.json();
        const raw = String(d?.choices?.[0]?.message?.content || "");
        const m = raw.match(/\{[\s\S]*\}/);
        if (!m) { lastErr = "Пустой ответ ИИ"; continue; }
        const report = JSON.parse(m[0]);
        return json({
          report,
          evidence: {
            sources: evidence.sources,
            notes: evidence.notes,
            serp_queries: evidence.serp.length,
            serp_top: evidence.serp.map((s) => ({ query: s.query, competitors: s.competitors, aggregators: s.aggregators, ai_overview: s.ai_overview })),
            keywords: evidence.keywords.length,
          },
        });
      } catch (e) {
        clearTimeout(timer);
        lastErr = e instanceof Error ? e.message : String(e);
      }
    }
    return json({ error: `ИИ не ответил: ${lastErr}` }, 502);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
