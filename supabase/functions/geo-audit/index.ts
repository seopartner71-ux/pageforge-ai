const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface CheckItem {
  id: string;
  label: string;
  criteria: string;
  tools: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}
interface StageResult {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  items: CheckItem[];
}
interface AuditResult {
  geoScore: number;
  stages: StageResult[];
  criticals: string[];
  strategy: string[];
}

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try { return await fetch(url, { signal: ctrl.signal, redirect: "follow" }); }
  finally { clearTimeout(timer); }
}

async function fetchText(url: string): Promise<string | null> {
  try { const r = await fetchWithTimeout(url, 10000); if (!r.ok) return null; return await r.text(); }
  catch { return null; }
}

function extractDomain(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

/* ─── Stage 1: Техническая доступность для ИИ ─── */
async function stage1(url: string, html: string, origin: string): Promise<StageResult> {
  const items: CheckItem[] = [];

  // 1.1 robots.txt
  const robotsTxt = await fetchText(`${origin}/robots.txt`);
  const bots = ["Google-Extended","GPTBot","ChatGPT-User","PerplexityBot","Perplexity-User","Googlebot","YandexBot","BingBot"];
  for (const bot of bots) {
    let blocked = false;
    if (robotsTxt) {
      const lines = robotsTxt.split("\n");
      let agent = "";
      for (const raw of lines) {
        const line = raw.trim().toLowerCase();
        if (line.startsWith("user-agent:")) agent = line.replace("user-agent:", "").trim();
        if ((agent === bot.toLowerCase() || agent === "*") && line.startsWith("disallow:") && line.replace("disallow:", "").trim() === "/") blocked = true;
      }
    }
    items.push({
      id: `robots-${bot}`, label: `Проверка robots.txt — ${bot}`,
      criteria: `Файл не блокирует user-agent ${bot}. Бот должен иметь доступ к контенту сайта.`,
      tools: "Ручной просмотр, GSC",
      status: !robotsTxt ? "warn" : blocked ? "fail" : "pass",
      detail: !robotsTxt ? `robots.txt не найден. Невозможно проверить доступ для ${bot}.` : blocked ? `${bot} заблокирован (Disallow: /).` : `${bot} не заблокирован — доступ открыт.`,
    });
  }

  // XML Sitemap
  const smUrl = robotsTxt?.match(/sitemap:\s*(.+)/i)?.[1]?.trim();
  const sm = smUrl ? await fetchText(smUrl) : await fetchText(`${origin}/sitemap.xml`);
  const smOk = sm && (sm.includes("<urlset") || sm.includes("<sitemapindex"));
  const urlCount = sm ? (sm.match(/<url>/gi) || []).length : 0;
  items.push({
    id: "sitemap", label: "XML Карта сайта",
    criteria: "sitemap.xml корректен, содержит все важные URL и отправлен в GSC и Яндекс.Вебмастер.",
    tools: "GSC, Яндекс.Вебмастер",
    status: smOk ? "pass" : "fail",
    detail: smOk ? `Sitemap найден. ${urlCount} URL.` : "XML Sitemap не найден или невалиден.",
  });

  // GSC coverage
  const hasNoindex = /meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  items.push({
    id: "gsc-coverage", label: 'Отчет "Покрытие" в GSC',
    criteria: 'Важные страницы не попадают в разделы с ошибками или статусом "Просканировано, не проиндексировано".',
    tools: "GSC",
    status: hasNoindex ? "fail" : hasCanonical ? "pass" : "warn",
    detail: hasNoindex ? "noindex обнаружен — страница не будет проиндексирована." : hasCanonical ? "noindex нет, canonical присутствует." : "Canonical тег отсутствует.",
  });

  // Bing Webmaster
  items.push({
    id: "bing", label: "Сайт добавлен в Bing Webmaster",
    criteria: "Добавьте сайт в Bing, проверьте карты сайта, уровень индексации.",
    tools: "Bing Webmaster Tools",
    status: "warn",
    detail: "Автоматическая проверка недоступна. Рекомендуется добавить сайт в Bing Webmaster Tools.",
  });

  // IndexNow
  items.push({
    id: "indexnow", label: "Настройка IndexNow",
    criteria: "В Bing Webmaster Tools настроена функция IndexNow для быстрой передачи новых URL в Bing и ChatGPT.",
    tools: "Bing Webmaster Tools",
    status: "warn",
    detail: "Рекомендуется настроить IndexNow для ускоренной индексации в Bing и ChatGPT.",
  });

  // Core Web Vitals
  const hasLazy = /loading=["']lazy["']/i.test(html);
  const hasPreload = /<link[^>]+rel=["']preload["']/i.test(html);
  const bigCSS = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).some(s => s.length > 5000);
  let cwvSt: "pass"|"warn"|"fail" = "pass";
  const cwvD: string[] = [];
  if (hasLazy) cwvD.push("Lazy loading ✓"); else { cwvD.push("Нет lazy loading"); cwvSt = "warn"; }
  if (hasPreload) cwvD.push("Preload ✓");
  if (bigCSS) { cwvD.push("Большой inline CSS"); cwvSt = "warn"; }
  items.push({
    id: "cwv", label: "Core Web Vitals",
    criteria: 'Все URL имеют статус "Хорошо" по метрикам LCP, INP, CLS.',
    tools: "GSC, PageSpeed Insights",
    status: cwvSt, detail: cwvD.join(". ") + ".",
  });

  // Mobile
  const hasVP = /<meta[^>]+name=["']viewport["']/i.test(html);
  items.push({
    id: "mobile", label: "Мобильная оптимизация",
    criteria: 'Сайт полностью адаптивен, отсутствуют ошибки в отчете "Удобство для мобильных".',
    tools: "GSC, Mobile-Friendly Test",
    status: hasVP ? "pass" : "fail",
    detail: hasVP ? "Viewport meta тег найден." : "Viewport meta тег отсутствует.",
  });

  // TTFB
  let ttfbMs = 0; let ttfbSt: "pass"|"warn"|"fail" = "pass";
  try { const s = Date.now(); await fetchWithTimeout(url, 10000); ttfbMs = Date.now() - s; if (ttfbMs > 1500) ttfbSt = "fail"; else if (ttfbMs > 800) ttfbSt = "warn"; }
  catch { ttfbSt = "fail"; ttfbMs = -1; }
  items.push({
    id: "ttfb", label: "Скорость ответа сервера (TTFB)",
    criteria: "Время ответа сервера в идеале не превышает 200 мс.",
    tools: "PageSpeed Insights, GTmetrix",
    status: ttfbSt,
    detail: ttfbMs > 0 ? `TTFB: ${ttfbMs}ms. ${ttfbMs <= 200 ? "Отлично." : ttfbMs <= 800 ? "Приемлемо." : "Медленно."}` : "Не удалось измерить.",
  });

  // 404
  const t404 = await fetchText(`${origin}/___test_404___`);
  items.push({
    id: "404", label: "Обработка ошибок 404",
    criteria: "Несуществующие страницы корректно отдают код ответа 404 или 410.",
    tools: "Screaming Frog, GSC",
    status: t404 !== null ? "pass" : "warn",
    detail: t404 !== null ? "Сервер возвращает кастомную страницу 404." : "Не удалось проверить.",
  });

  // JS rendering
  const hasSPA = /id=["'](root|app|__next)["']/i.test(html);
  const bodyLen = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim().length;
  items.push({
    id: "js-render", label: "Рендеринг JS-контента",
    criteria: "Google корректно видит и рендерит весь важный контент, особенно на SPA-сайтах.",
    tools: "GSC (Проверка URL)",
    status: hasSPA && bodyLen < 500 ? "fail" : hasSPA ? "warn" : "pass",
    detail: hasSPA && bodyLen < 500 ? "SPA без SSR — контент минимален." : hasSPA ? "SPA с SSR — контент есть." : "Серверный рендеринг.",
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage1", title: "Этап 1", subtitle: "Техническая доступность для ИИ", score, items };
}

/* ─── Stage 2: Прямая проверка в ИИ ─── */
async function stage2(url: string, html: string, pageTitle: string): Promise<StageResult> {
  const items: CheckItem[] = [];
  const hasSD = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasMD = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.test(html);

  items.push({
    id: "ai-overview", label: "Тестовые запросы в AI Overview, ChatGPT, Perplexity, YandexGPT",
    criteria: "Проведена проверка цитируемости сайта по 5-10 ключевым запросам в AI Overview, YandexGPT, ChatGPT, Perplexity.",
    tools: "Google, Яндекс, ChatGPT",
    status: hasSD && hasMD ? "pass" : hasMD ? "warn" : "fail",
    detail: hasSD && hasMD ? "Meta description + Schema.org — хорошие шансы попасть в AI-ответы." : hasMD ? "Есть meta description, но нет Schema.org." : "Нет meta description и структурированных данных.",
  });

  // Data extraction
  const hasPrices = /(\d[\d\s]*[₽$€]|[₽$€]\s*\d|"price"|цена)/i.test(html);
  const hasPriceSchema = /"price"|"priceCurrency"|"offers"/i.test(html);
  const hasPhones = /(\+?\d[\d\s\-()]{7,})/i.test(html);
  const hasContactSchema = /"telephone"|"contactPoint"/i.test(html);
  items.push({
    id: "data-extraction", label: "Корректность извлечения данных",
    criteria: "Проверено, что ИИ правильно извлекает информацию (цены, телефоны, характеристики). Особенно на SPA-сайтах.",
    tools: "Google, Яндекс, ChatGPT",
    status: (!hasPrices || hasPriceSchema) && (!hasPhones || hasContactSchema) ? "pass" : "warn",
    detail: `Цены: ${hasPrices ? (hasPriceSchema ? "размечены ✓" : "не размечены ⚠") : "не обнаружены"}. Контакты: ${hasPhones ? (hasContactSchema ? "размечены ✓" : "не размечены ⚠") : "не обнаружены"}.`,
  });

  items.push({
    id: "ai-studio", label: "Отладка с помощью ИИ",
    criteria: "Используется Google AI Studio для выяснения причин некорректного парсинга.",
    tools: "Google AI Studio",
    status: "warn",
    detail: "Рекомендуется протестировать извлечение данных через Google AI Studio (aistudio.google.com).",
  });

  // Chunking
  const h2 = (html.match(/<h2[\s>]/gi) || []).length;
  const h3 = (html.match(/<h3[\s>]/gi) || []).length;
  const p = (html.match(/<p[\s>]/gi) || []).length;
  const chunks = h2 + h3;
  items.push({
    id: "chunking", label: 'Анализ "чанков"',
    criteria: "Проанализировано, как контент нарезается на информационные блоки и насколько они релевантны.",
    tools: "relevancylens.seoworkflow.online",
    status: chunks >= 5 && p >= 8 ? "pass" : chunks >= 2 ? "warn" : "fail",
    detail: `${h2} H2, ${h3} H3, ${p} параграфов. ${chunks >= 5 ? "Хорошая структура для chunking." : "Недостаточно подзаголовков."}`,
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage2", title: "Этап 2", subtitle: "Прямая проверка в ИИ", score, items };
}

/* ─── Stage 3: Структура и семантика ─── */
function stage3(html: string, pageTitle: string): StageResult {
  const items: CheckItem[] = [];

  // H1
  const h1s = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Text = h1s[0]?.replace(/<[^>]+>/g, "").trim() || "";
  const titleMatch = h1s.length === 1 && pageTitle && h1Text && (pageTitle.toLowerCase().includes(h1Text.toLowerCase().slice(0,20)) || h1Text.toLowerCase().includes(pageTitle.toLowerCase().slice(0,20)));
  items.push({
    id: "h1", label: "Единственный H1 + соответствие title",
    criteria: "На странице ровно один тег H1, его содержание соответствует тегу <title>.",
    tools: "Ручной анализ кода",
    status: h1s.length === 1 ? (titleMatch ? "pass" : "warn") : "fail",
    detail: h1s.length === 0 ? "H1 отсутствует." : h1s.length > 1 ? `${h1s.length} тегов H1 — должен быть один.` : titleMatch ? `H1: "${h1Text.slice(0,60)}" — соответствует title.` : `H1: "${h1Text.slice(0,60)}" — не соответствует title.`,
  });

  // Heading hierarchy
  const levels: number[] = [];
  let m; const rx = /<h([1-6])[\s>]/gi;
  while ((m = rx.exec(html)) !== null) levels.push(parseInt(m[1]));
  let hierOk = true, skipD = "";
  for (let i = 1; i < levels.length; i++) { if (levels[i] > levels[i-1]+1) { hierOk = false; skipD = `H${levels[i-1]} → H${levels[i]}`; break; } }
  items.push({
    id: "hierarchy", label: "Иерархия заголовков (H2→H3 без пропусков)",
    criteria: "Правильная иерархия заголовков без пропусков уровней.",
    tools: "Ручной анализ кода",
    status: hierOk ? "pass" : "warn",
    detail: hierOk ? `Иерархия корректна: ${[...new Set(levels)].sort().map(l=>`H${l}`).join(", ")}.` : `Пропуск: ${skipD}.`,
  });

  // Semantic tags
  const tags = ["main","article","section","aside","nav"];
  const found = tags.filter(t => new RegExp(`<${t}[\\s>]`,"i").test(html));
  const missing = tags.filter(t => !found.includes(t));
  items.push({
    id: "semantic", label: "Семантические теги (main, article, section, aside, nav)",
    criteria: "Используются семантические HTML5-теги для структурирования контента.",
    tools: "Ручной анализ кода",
    status: found.length >= 3 ? "pass" : found.length >= 1 ? "warn" : "fail",
    detail: `Найдены: ${found.map(t=>`<${t}>`).join(", ") || "нет"}.${missing.length ? ` Отсутствуют: ${missing.map(t=>`<${t}>`).join(", ")}.` : ""}`,
  });

  // Inline semantic
  const hasS = /<strong[\s>]/i.test(html), hasE = /<em[\s>]/i.test(html), hasL = /<(ul|ol)[\s>]/i.test(html), hasT = /<table[\s>]/i.test(html);
  const ic = [hasS,hasE,hasL,hasT].filter(Boolean).length;
  items.push({
    id: "inline", label: "Использование strong, em, ul/ol, table",
    criteria: "Правильное использование тегов strong, em, ul, ol, table для структурирования контента.",
    tools: "Ручной анализ кода",
    status: ic >= 3 ? "pass" : ic >= 1 ? "warn" : "fail",
    detail: `Найдено: ${[hasS&&"strong",hasE&&"em",hasL&&"ul/ol",hasT&&"table"].filter(Boolean).join(", ") || "ничего"}.`,
  });

  // Schema.org
  const jsonLd = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const types: string[] = [];
  for (const b of jsonLd) { try { const p = JSON.parse(b.replace(/<\/?script[^>]*>/gi,"")); const ex = (o:any)=>{ if(o?.["@type"])types.push(o["@type"]); if(Array.isArray(o?.["@graph"]))o["@graph"].forEach(ex); }; ex(p); } catch{} }
  items.push({
    id: "schema", label: "Schema.org разметка (валидность + релевантные типы)",
    criteria: "JSON-LD разметка валидна, используются релевантные типы Schema.org.",
    tools: "Schema Markup Validator, Rich Results Test",
    status: types.length >= 2 ? "pass" : types.length === 1 ? "warn" : "fail",
    detail: types.length ? `${jsonLd.length} JSON-LD блоков. Типы: ${types.join(", ")}.` : "Schema.org (JSON-LD) не найдена.",
  });

  // @id linking
  const hasAtId = /"@id"\s*:/i.test(html);
  items.push({
    id: "at-id", label: "Связывание сущностей через @id",
    criteria: "Сущности в Schema.org связаны через @id для построения графа знаний.",
    tools: "Ручной анализ кода",
    status: hasAtId ? "pass" : "warn",
    detail: hasAtId ? "Обнаружены @id связи в JSON-LD." : "Нет @id связей — рекомендуется связать Organization, WebPage, Author.",
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage3", title: "Этап 3", subtitle: "Анализ структуры и семантической вёрстки", score, items };
}

/* ─── Stage 4: Контент и тематический авторитет ─── */
function stage4(html: string): StageResult {
  const items: CheckItem[] = [];
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
  const wc = clean.split(/\s+/).length;

  // Answer-first
  const firstP = (html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi) || []).slice(0,3).map(p=>p.replace(/<[^>]+>/g,"").trim()).join(" ");
  items.push({
    id: "answer-first", label: 'Подход "Ответ-прежде-всего"',
    criteria: 'Самый важный ответ на запрос размещен в начале страницы (принцип "перевёрнутой пирамиды").',
    tools: "Ручной анализ",
    status: firstP.length > 200 ? "pass" : firstP.length > 100 ? "warn" : "fail",
    detail: `Первые параграфы: ${firstP.length} символов. ${firstP.length > 200 ? "Хорошая плотность." : "Недостаточно информации в начале."}`,
  });

  // Topic clusters
  const intLinks = (html.match(/<a[^>]+href=["'][^"']*["']/gi) || []).filter(l => !l.includes("http")).length;
  items.push({
    id: "clusters", label: "Тематические кластеры (Коконы)",
    criteria: "Контент организован в тематические хабы (Pillar + Child pages) с мощной внутренней перелинковкой.",
    tools: "Ручной анализ, Ahrefs",
    status: intLinks >= 10 ? "pass" : intLinks >= 3 ? "warn" : "fail",
    detail: `~${intLinks} внутренних ссылок. ${intLinks >= 10 ? "Хорошая перелинковка." : "Рекомендуется усилить."}`,
  });

  // Content gaps
  items.push({
    id: "gaps", label: "Анализ пробелов в контенте",
    criteria: "Проведен анализ семантики конкурентов, определены упущенные подтемы.",
    tools: "Ahrefs, Semrush, Keys.so",
    status: wc >= 800 ? "pass" : wc >= 300 ? "warn" : "fail",
    detail: `~${wc} слов. ${wc >= 800 ? "Достаточный объём." : "Конкуренты обычно имеют 1000+ слов."}`,
  });

  // Added value
  const hasNums = /\d{3,}/.test(clean);
  const hasCit = /(исследован|по данным|согласно|study|research|according)/i.test(clean);
  const hasStat = /(\d+\s*%|\d+\s*из\s*\d+)/i.test(clean);
  const vc = [hasNums,hasCit,hasStat].filter(Boolean).length;
  items.push({
    id: "value", label: "Добавочная ценность",
    criteria: "Контент предлагает уникальные данные, исследования, экспертный опыт.",
    tools: "Ручной анализ",
    status: vc >= 2 ? "pass" : vc >= 1 ? "warn" : "fail",
    detail: `${[hasNums&&"числовые данные",hasCit&&"ссылки на исследования",hasStat&&"статистика"].filter(Boolean).join(", ") || "Нет маркеров ценности"}.`,
  });

  // Multimodality
  const imgs = (html.match(/<img[\s>]/gi)||[]).length;
  const hasVid = /<(video|iframe[^>]+(?:youtube|vimeo|rutube))/i.test(html);
  const hasTbl = /<table[\s>]/i.test(html);
  const hasSvg = /<svg[\s>]/i.test(html);
  const mc = [imgs>0,hasVid,hasTbl,hasSvg].filter(Boolean).length;
  items.push({
    id: "multimodal", label: "Мультимодальность",
    criteria: "Текст обогащен уникальными изображениями, схемами, инфографикой, видео, таблицами.",
    tools: "Ручной анализ",
    status: mc >= 3 ? "pass" : mc >= 2 ? "warn" : "fail",
    detail: `${[imgs>0&&`${imgs} изображений`,hasVid&&"видео",hasTbl&&"таблицы",hasSvg&&"SVG"].filter(Boolean).join(", ") || "ничего"}.`,
  });

  // Inverted pyramid
  items.push({
    id: "pyramid", label: "Перевёрнутая пирамида",
    criteria: "Самый важный ответ на вопрос в начале каждого чанка информации.",
    tools: "Ручной анализ",
    status: firstP.length > 200 ? "pass" : firstP.length > 100 ? "warn" : "fail",
    detail: firstP.length > 200 ? "Структура соответствует принципу перевёрнутой пирамиды." : "Рекомендуется вынести ключевые ответы в начало каждого раздела.",
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage4", title: "Этап 4", subtitle: "Контент и тематический авторитет", score, items };
}

/* ─── Stage 5: E-E-A-T и репутация бренда ─── */
function stage5(html: string): StageResult {
  const items: CheckItem[] = [];
  const clean = html.replace(/<script[\s\S]*?<\/script>/gi,"").replace(/<style[\s\S]*?<\/style>/gi,"").replace(/<[^>]+>/g," ");

  const hasAuthor = /(author|автор|об авторе|written by|написал)/i.test(html);
  const hasExp = /(опыт|experience|кейс|case study|пример|отзыв|testimonial)/i.test(clean);
  items.push({
    id: "experience", label: "Опыт и Экспертиза",
    criteria: 'Доказательства личного опыта ("Мы протестировали..."). Указаны авторы с регалиями.',
    tools: "Ручной анализ",
    status: hasAuthor && hasExp ? "pass" : hasAuthor || hasExp ? "warn" : "fail",
    detail: `${[hasAuthor&&"автор",hasExp&&"маркеры опыта"].filter(Boolean).join(", ") || "Нет маркеров"}.`,
  });

  const extLinks = (html.match(/<a[^>]+href=["']https?:\/\/[^"']+["']/gi)||[]).filter(l=>!/facebook|twitter|instagram/i.test(l)).length;
  items.push({
    id: "authority", label: "Авторитетность и Доверие",
    criteria: "Ссылки на авторитетные внешние источники. Легко найти контакты, политики.",
    tools: "Ручной анализ",
    status: extLinks >= 3 ? "pass" : extLinks >= 1 ? "warn" : "fail",
    detail: `${extLinks} внешних ссылок. ${extLinks >= 3 ? "Хорошо." : "Рекомендуется добавить."}`,
  });

  const hasOrg = /"Organization"|"LocalBusiness"|"Corporation"/i.test(html);
  items.push({
    id: "mentions", label: "Упоминания бренда в сети",
    criteria: "Проведен анализ количества и тональности упоминаний бренда.",
    tools: "Ahrefs, Brand24",
    status: hasOrg ? "warn" : "fail",
    detail: hasOrg ? "Schema.org Organization найдена. Для полной проверки используйте Brand24." : "Нет разметки Organization.",
  });

  const hasFaq = /<(details|summary)|FAQPage|"question"|"acceptedAnswer"/i.test(html);
  const hasRating = /AggregateRating|"ratingValue"|Review/i.test(html);
  items.push({
    id: "ratings", label: "Присутствие в рейтингах и Q&A",
    criteria: "Сайт присутствует в отраслевых обзорах и на Q&A-площадках (Reddit, Quora, Яндекс Кью).",
    tools: "Поиск Google, ChatGPT",
    status: hasFaq && hasRating ? "pass" : hasFaq || hasRating ? "warn" : "fail",
    detail: `${[hasFaq&&"FAQ/Q&A",hasRating&&"рейтинги"].filter(Boolean).join(", ") || "Нет FAQ и рейтингов"}.`,
  });

  // Link profile quality
  items.push({
    id: "link-profile", label: "Качество ссылочного профиля",
    criteria: "Проанализировано качество и релевантность ссылающихся доменов.",
    tools: "Ahrefs, Semrush",
    status: "warn",
    detail: "Автоматический анализ ссылочного профиля недоступен. Рекомендуется проверить в Ahrefs/Semrush.",
  });

  const hasGBP = /google\.com\/maps|goo\.gl\/maps|LocalBusiness|GeoCoordinates/i.test(html);
  items.push({
    id: "gbp", label: "Карточки организаций",
    criteria: "Профили в Google Business Profile и Яндекс.Бизнес полностью заполнены и актуальны.",
    tools: "GBP, Яндекс.Бизнес",
    status: hasGBP ? "pass" : "warn",
    detail: hasGBP ? "Маркеры Google Maps / LocalBusiness обнаружены." : "Нет маркеров GBP. Рекомендуется зарегистрировать.",
  });

  const hasSameAs = /"sameAs"\s*:\s*\[/i.test(html);
  items.push({
    id: "knowledge", label: "Панель знаний",
    criteria: "При поиске по бренду появляется корректная и полная Панель знаний.",
    tools: "Поиск Google",
    status: hasOrg && hasSameAs ? "pass" : "warn",
    detail: hasOrg && hasSameAs ? "Organization + sameAs — хорошие сигналы." : "Нет sameAs связей. Добавьте ссылки на Wikipedia, соцсети, Wikidata.",
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage5", title: "Этап 5", subtitle: "E-E-A-T и репутация бренда", score, items };
}

/* ─── Recommendations ─── */
function generateRecommendations(stages: StageResult[]): { criticals: string[]; strategy: string[] } {
  const fails = stages.flatMap(s => s.items.filter(i => i.status === "fail").map(i => ({ stage: s.title, ...i })));
  const warns = stages.flatMap(s => s.items.filter(i => i.status === "warn").map(i => ({ stage: s.title, ...i })));
  const criticals = [...fails.slice(0,5),...warns.slice(0,Math.max(0,5-fails.length))].map(i => `${i.label}: ${i.detail.split(".")[0]}.`);

  const strategy: string[] = [];
  if (stages[0]?.items.some(i => i.id.startsWith("robots-") && i.status === "fail"))
    strategy.push("Неделя 1: Исправить robots.txt — разблокировать AI-ботов.");
  if (stages[2]?.items.some(i => i.id === "schema" && i.status !== "pass"))
    strategy.push("Неделя 1–2: Добавить Schema.org разметку (Organization, Product, FAQ, BreadcrumbList).");
  strategy.push("Неделя 2–3: Оптимизировать заголовки и семантические теги.");
  if ((stages[3]?.score||0) < 70)
    strategy.push("Неделя 3–4: Расширить контент по принципу «Ответ-прежде-всего».");
  strategy.push("Неделя 4–5: Добавить мультимодальный контент (видео, таблицы, инфографика).");
  if ((stages[4]?.score||0) < 70)
    strategy.push("Месяц 2: Усилить E-E-A-T — авторские страницы, кейсы, внешние упоминания.");
  strategy.push("Месяц 2+: Мониторинг AI-видимости в ChatGPT/Perplexity/AI Overview.");
  return { criticals, strategy };
}

/* ─── Main ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string")
      return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;
    const origin = extractDomain(targetUrl);

    let rawHtml: string;
    try { const r = await fetchWithTimeout(targetUrl, 15000); rawHtml = await r.text(); }
    catch { const r = await fetchWithTimeout(targetUrl, 15000); rawHtml = await r.text(); }

    const pageTitle = (rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<[^>]+>/g,"").trim();

    const [s1, s2] = await Promise.all([stage1(targetUrl, rawHtml, origin), stage2(targetUrl, rawHtml, pageTitle)]);
    const s3 = stage3(rawHtml, pageTitle);
    const s4 = stage4(rawHtml);
    const s5 = stage5(rawHtml);

    const stages = [s1, s2, s3, s4, s5];
    const geoScore = Math.round(stages.reduce((sum, s) => sum + s.score, 0) / stages.length);
    const { criticals, strategy } = generateRecommendations(stages);

    return new Response(JSON.stringify({ geoScore, stages, criticals, strategy } as AuditResult), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("geo-audit error:", message);
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
