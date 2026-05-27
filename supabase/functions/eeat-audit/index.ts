const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const MODEL = "google/gemini-2.5-flash";

/* ───────── Helpers ───────── */
async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "User-Agent": "Mozilla/5.0 SEO-Audit-Bot" } }); }
  finally { clearTimeout(t); }
}

async function jinaFetch(url: string): Promise<string> {
  try {
    const r = await fetchWithTimeout(`https://r.jina.ai/${url}`, 20000);
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

async function rawFetch(url: string): Promise<string> {
  try {
    const r = await fetchWithTimeout(url, 15000);
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

function originOf(url: string): string { try { return new URL(url).origin; } catch { return url; } }

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, " ").trim().slice(0, 200) : "";
}
function extractH1(html: string): string {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return "";
  return m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 200);
}
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeJson<T>(s: string): T | null {
  try { return JSON.parse(s) as T; } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]) as T; } catch {} }
    return null;
  }
}

async function ai(system: string, user: string): Promise<any> {
  if (!OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY не настроен");
  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });
  if (!r.ok) throw new Error(`OpenRouter ${r.status}`);
  const j = await r.json();
  return safeJson(j?.choices?.[0]?.message?.content || "{}") || {};
}

/* ───────── Sitemap parsing ───────── */
async function getSitemapUrls(origin: string): Promise<string[]> {
  const out = new Set<string>();
  const candidates = [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  for (const sm of candidates) {
    const txt = await rawFetch(sm);
    if (!txt) continue;
    const subSitemaps = [...txt.matchAll(/<loc>([^<]+\.xml)<\/loc>/gi)].map(m => m[1]);
    if (subSitemaps.length) {
      for (const s of subSitemaps.slice(0, 5)) {
        const sub = await rawFetch(s);
        [...sub.matchAll(/<loc>([^<]+)<\/loc>/gi)].forEach(m => out.add(m[1]));
      }
    } else {
      [...txt.matchAll(/<loc>([^<]+)<\/loc>/gi)].forEach(m => out.add(m[1]));
    }
    if (out.size > 0) break;
  }
  return [...out].slice(0, 500);
}

function extractInternalLinks(html: string, origin: string): string[] {
  const links = new Set<string>();
  const re = /<a\s[^>]*href=["']([^"'#]+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let href = m[1].trim();
    if (!href) continue;
    if (href.startsWith("/")) href = origin + href;
    if (!href.startsWith("http")) continue;
    try {
      const u = new URL(href);
      if (u.origin === origin) links.add(u.origin + u.pathname);
    } catch {}
  }
  return [...links].slice(0, 300);
}

/* ───────── PHASE 1: Plan ───────── */
const PLAN_TARGETS = [
  "Контакты", "Доставка", "Оплата",
  "О компании", "Команда", "Сертификаты / Лицензии", "Отзывы", "Гарантии / Возврат",
  "Портфолио / Кейсы", "Вакансии", "Новости / Блог", "Акции / Скидки",
  "Каталог товаров", "Корзина", "Личный кабинет", "Сравнение товаров", "Избранное",
];

async function runPlan(siteUrl: string) {
  const origin = originOf(siteUrl);
  const homeHtml = await rawFetch(siteUrl);
  if (!homeHtml) throw new Error("Не удалось загрузить главную страницу сайта.");

  const homeTitle = extractTitle(homeHtml);
  const homeH1 = extractH1(homeHtml);
  const internalLinks = extractInternalLinks(homeHtml, origin);
  const sitemapLinks = await getSitemapUrls(origin);
  const allLinks = [...new Set([...internalLinks, ...sitemapLinks])].slice(0, 400);

  // Ask AI to detect site type + map target pages → URLs
  const sys = `Ты — SEO-аудитор. Анализируй и возвращай только JSON.`;
  const user = `Главная: ${siteUrl}
Title: ${homeTitle}
H1: ${homeH1}

Список всех найденных внутренних URL (с homepage + sitemap):
${allLinks.join("\n")}

Целевые типы страниц для поиска:
${PLAN_TARGETS.map(t => `- ${t}`).join("\n")}

Задачи:
1. Определи siteType: "Интернет-магазин" или "Сайт услуг / Корпоративный сайт".
2. Для каждого целевого типа выбери НАИБОЛЕЕ подходящий URL из списка (если есть). Не выдумывай URL — только из списка.
3. Пропускай страницы, нерелевантные типу сайта (корзина/каталог если это не магазин).
4. Дополнительно отметь missing — целевые страницы, для которых URL НЕ найден (но они должны быть на сайте).
5. КРИТИЧНО: НИКОГДА не подставляй URL главной страницы (${siteUrl}) под другими ярлыками. Если для типа страницы нет отдельного URL — добавь его в missing, а в pages не включай.
6. Если на сайте всего одна страница (lend/одностраничник) — верни пустой массив pages, а все стандартные типы (Контакты, О компании и т.д.) перечисли в missing.
7. Один URL может встречаться в pages только один раз (без дублей под разными ярлыками).

Верни JSON:
{
  "siteType": "...",
  "pages": [{ "label": "Контакты", "url": "https://..." }, ...],
  "missing": ["Гарантии / Возврат", ...]
}`;
  const res = await ai(sys, user);

  // Verify each URL by fetching title+h1; drop duplicates and any that point to homepage
  const homeUrlNorm = siteUrl.replace(/\/+$/, "");
  const seen = new Set<string>([homeUrlNorm]);
  const extraMissing: string[] = [];
  const pages: Array<{ label: string; url: string; title: string; h1: string }> = [];
  for (const p of (res.pages || []).slice(0, 25)) {
    const u = String(p.url || "").trim().replace(/\/+$/, "");
    if (!u) continue;
    if (seen.has(u)) {
      extraMissing.push(String(p.label));
      continue;
    }
    seen.add(u);
    try {
      const h = await rawFetch(u);
      pages.push({
        label: String(p.label),
        url: u,
        title: extractTitle(h),
        h1: extractH1(h),
      });
    } catch {
      pages.push({ label: String(p.label), url: u, title: "", h1: "" });
    }
  }
  // Always include homepage
  pages.unshift({ label: "Главная", url: siteUrl, title: homeTitle, h1: homeH1 });

  const missing = Array.isArray(res.missing) ? res.missing : [];
  const mergedMissing = [...new Set([...missing, ...extraMissing])];

  return {
    siteType: res.siteType || "Сайт услуг / Корпоративный сайт",
    pages,
    missing: mergedMissing,
  };
}

/* ───────── PHASE 2: Collect ───────── */
async function runCollect(pages: Array<{ label: string; url: string }>) {
  const out: Array<{ label: string; url: string; content: string; error?: string }> = [];
  // Parallel batches of 4
  for (let i = 0; i < pages.length; i += 4) {
    const batch = pages.slice(i, i + 4);
    const results = await Promise.all(batch.map(async (p) => {
      const md = await jinaFetch(p.url);
      if (md && md.length > 200) {
        return { label: p.label, url: p.url, content: md.slice(0, 12000) };
      }
      const html = await rawFetch(p.url);
      if (!html) return { label: p.label, url: p.url, content: "", error: "Не удалось загрузить страницу" };
      const text = htmlToText(html);
      if (text.length < 300) {
        return { label: p.label, url: p.url, content: "", error: `Слишком мало контента (${text.length} симв.) - вероятно страница пустая, 404 или защищена от ботов` };
      }
      return { label: p.label, url: p.url, content: text.slice(0, 12000) };
    }));
    out.push(...results);
  }
  return { pages: out };
}

/* ───────── PHASE 3: Audit ───────── */
const BASE_CHECKLIST = [
  "Сквозной адрес в шапке или футере",
  "Ссылки на мессенджеры (шапка/футер/контакты)",
  "Городской телефон или 8(800) (шапка/футер/контакты)",
  "На все коммерческие страницы есть ссылки из меню",
  "Кнопка 'Обратный звонок' в шапке/футере/контактах",
  "Функционал поиска по сайту",
  "Онлайн-консультант (чат)",
  "Калькуляторы (если применимо)",
  "Более 1 адреса (если применимо)",
  "Цены с валютой (если применимо)",
  "Прайс-листы для скачивания",
  "Наличие персоналий (руководство, сотрудники)",
  "Кредит или рассрочка (если применимо)",
  "Раздел 'Акции'",
  "Раздел 'Новости'",
  "Раздел 'Наши клиенты' (если применимо)",
  "Раздел 'Портфолио' (если применимо)",
  "Отзывы с возможностью оставить отзыв",
  "Страница 'Доставка' (если применимо)",
  "Страница 'Оплата' (если применимо)",
  "Страница 'Гарантии'",
  "Страница 'Способы возврата' (если применимо)",
  "Страница 'Сертификаты' (если применимо)",
  "Страница 'Вакансии'",
  "Ссылки на основные категории с главной",
  "Блок популярных товаров (если применимо)",
  "Блок новинок (если применимо)",
  "Блок акций (если применимо)",
  "Лента акций (если применимо)",
  "Лента новостей",
  "Страница 'О компании' создана",
  "История компании (на 'О компании')",
  "Миссия компании (на 'О компании')",
  "Преимущества компании (на 'О компании')",
  "Заслуги / награды (на 'О компании')",
  "Сертификаты и свидетельства (на 'О компании')",
  "Руководство компании (на 'О компании')",
  "Коллектив и офис (фото) (на 'О компании')",
  "Полный адрес: индекс, город, улица, дом (Контакты)",
  "Городской телефон, кликабельный (Контакты)",
  "Номер 8(800) при работе на несколько регионов (Контакты)",
  "Email для связи (Контакты)",
  "Карта вставлена кодом (Яндекс/Google) (Контакты)",
  "Схема проезда (Контакты)",
  "Текст 'Как пройти и проехать' (Контакты)",
  "Полные реквизиты компании (Контакты)",
  "Форма обратного звонка (Контакты)",
  "Время работы (Контакты)",
  "Информация о всех адресах (Контакты)",
  "Соцсети (Контакты)",
  "Мессенджеры (Контакты)",
  // Карточки товаров
  "Кнопки действий в листинге и карточках (если магазин)",
  "Кнопки 'Купить'/'Корзина' — текст/кнопка, не картинка (если магазин)",
  "Валюта с пробелом возле цены (если магазин)",
  "Статус товара ('в наличии', 'нет', 'под заказ') (если магазин)",
  "Несколько фото товара + детальный просмотр (если магазин)",
  "Видео к популярным товарам (если магазин)",
  ">3 отзывов на популярных товарах (если магазин)",
  "Сравнение товаров (если магазин)",
  "Похожие товары (если магазин)",
  "Бейдж 'Скидка'/'Акция', зачёркнутая цена (если магазин)",
  "Обзоры на товары (если магазин)",
  "Расчёт стоимости доставки в карточке (если магазин)",
  "Гарантии в карточке товара (если магазин)",
  "Информация об оплате в карточке (если магазин)",
  "Категория 'Товары по скидке' (если магазин)",
  "Наличие корзины (если магазин)",
  "Категория 'Новинки' (если магазин)",
  "Пункты самовывоза с информацией (если магазин)",
  "Сортировка товаров в категориях (если магазин)",
  "Широкий ассортимент (если магазин)",
  "Аксессуары к товарам (если магазин)",
  "Разнообразие брендов (если магазин)",
  "Видео про компанию/услуги/видеоотзывы (если услуги)",
  "Онлайн-запись или онлайн-заказ услуги (если услуги)",
  "Подробные прайс-листы / калькуляторы (если услуги)",
];

async function runAudit(siteUrl: string, siteType: string, pagesData: Array<{ label: string; url: string; content: string }>) {
  // Prepare condensed snapshot for AI (label + url + first ~3000 chars)
  const snapshot = pagesData.map(p =>
    `=== ${p.label} (${p.url}) ===\n${(p.content || "").slice(0, 3500)}`
  ).join("\n\n");

  const sys = `Ты — скрупулёзный AI-аудитор SEO и E-E-A-T. Возвращай ТОЛЬКО валидный JSON.
Правила:
- Делай выводы строго на основе предоставленного контента. Если фактор не виден в контенте — отмечай "Нет" или "Неприменимо" с пояснением.
- Не выдумывай факты. Любая фраза в "evidence" должна реально присутствовать в контенте.
- "Неприменимо" — для пунктов, не относящихся к типу сайта (магазин/услуги).`;

  const user = `САЙТ: ${siteUrl}
ТИП САЙТА: ${siteType}

КОНТЕНТ СТРАНИЦ:
${snapshot.slice(0, 90000)}

ЗАДАЧИ:
1. Определи нишу сайта (1 предложение).
2. Сформируй 5–8 нишевых E-E-A-T факторов специально для этой ниши (лицензии, ассоциации, награды и т.п.).
3. Пройдись по БАЗОВОМУ чек-листу и по нишевым факторам, оцени каждый.
4. Выяви страницы, которые ОБЯЗАТЕЛЬНО должны быть, но отсутствуют.

БАЗОВЫЙ ЧЕК-ЛИСТ:
${BASE_CHECKLIST.map((c, i) => `${i + 1}. ${c}`).join("\n")}

ВЕРНИ JSON СТРОГО ТАКОГО ФОРМАТА:
{
  "niche": "...",
  "summary": "1–2 предложения общего вывода",
  "score": 0-100,
  "baseChecks": [
    { "factor": "Сквозной адрес в шапке/футере", "status": "Да|Нет|Неприменимо", "comment": "краткая оценка состояния или причина", "evidence": "цитата или ссылка на страницу" }
  ],
  "nicheChecks": [
    { "factor": "...", "status": "Да|Нет|Неприменимо", "comment": "...", "evidence": "..." }
  ],
  "missingPages": ["Гарантии", "Сертификаты", ...],
  "recommendations": ["Топ-5 приоритетных действий"]
}

Все 76 пунктов базового чек-листа должны быть в baseChecks.`;

  const res = await ai(sys, user);
  return {
    siteUrl,
    siteType,
    niche: res.niche || "",
    summary: res.summary || "",
    score: typeof res.score === "number" ? res.score : 0,
    baseChecks: Array.isArray(res.baseChecks) ? res.baseChecks : [],
    nicheChecks: Array.isArray(res.nicheChecks) ? res.nicheChecks : [],
    missingPages: Array.isArray(res.missingPages) ? res.missingPages : [],
    recommendations: Array.isArray(res.recommendations) ? res.recommendations : [],
  };
}

/* ───────── HTTP entrypoint ───────── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const phase = String(body.phase || "");

    if (phase === "plan") {
      const url = String(body.url || "").trim();
      if (!url) throw new Error("URL обязателен");
      const out = await runPlan(url);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (phase === "collect") {
      const pages = Array.isArray(body.pages) ? body.pages : [];
      if (!pages.length) throw new Error("Список страниц пуст");
      const out = await runCollect(pages);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (phase === "audit") {
      const url = String(body.url || "");
      const siteType = String(body.siteType || "");
      const pagesData = Array.isArray(body.pagesData) ? body.pagesData : [];
      if (!url || !pagesData.length) throw new Error("Недостаточно данных для аудита");
      const out = await runAudit(url, siteType, pagesData);
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    throw new Error(`Неизвестная фаза: ${phase}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});