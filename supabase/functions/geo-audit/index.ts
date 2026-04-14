import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── Types ─── */
interface CheckItem {
  id: string;
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}
interface StageResult {
  id: string;
  title: string;
  score: number;
  items: CheckItem[];
}
interface AuditResult {
  geoScore: number;
  stages: StageResult[];
  criticals: string[];
  strategy: string[];
}

/* ─── Helpers ─── */
function ok(status: "pass" | "warn" | "fail") { return status; }

async function fetchWithTimeout(url: string, timeoutMs = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url, 10000);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractDomain(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/* ─── Stage 1: Technical AI Accessibility ─── */
async function stage1(url: string, html: string, origin: string): Promise<StageResult> {
  const items: CheckItem[] = [];

  // 1.1 robots.txt checks
  const robotsTxt = await fetchText(`${origin}/robots.txt`);
  const botChecks: { bot: string; label: string }[] = [
    { bot: "GPTBot", label: "robots.txt — GPTBot" },
    { bot: "Google-Extended", label: "robots.txt — Google-Extended" },
    { bot: "ChatGPT-User", label: "robots.txt — ChatGPT-User" },
    { bot: "PerplexityBot", label: "robots.txt — PerplexityBot" },
    { bot: "ClaudeBot", label: "robots.txt — ClaudeBot" },
    { bot: "Bytespider", label: "robots.txt — Bytespider (TikTok)" },
  ];

  for (const { bot, label } of botChecks) {
    if (!robotsTxt) {
      items.push({ id: `robots-${bot}`, label, status: "warn", detail: `robots.txt не найден. Невозможно проверить доступ для ${bot}.` });
    } else {
      const lines = robotsTxt.split("\n");
      let currentAgent = "";
      let blocked = false;
      for (const raw of lines) {
        const line = raw.trim().toLowerCase();
        if (line.startsWith("user-agent:")) currentAgent = line.replace("user-agent:", "").trim();
        if ((currentAgent === bot.toLowerCase() || currentAgent === "*") && line.startsWith("disallow:") && line.replace("disallow:", "").trim() === "/") {
          blocked = true;
        }
      }
      if (blocked) {
        items.push({ id: `robots-${bot}`, label, status: "fail", detail: `${bot} заблокирован в robots.txt (Disallow: /). ИИ-поисковик не сможет индексировать контент.` });
      } else {
        items.push({ id: `robots-${bot}`, label, status: "pass", detail: `${bot} не заблокирован. Бот имеет доступ к контенту.` });
      }
    }
  }

  // 1.2 XML Sitemap
  const sitemapUrl = robotsTxt?.match(/sitemap:\s*(.+)/i)?.[1]?.trim();
  const sitemapContent = sitemapUrl ? await fetchText(sitemapUrl) : await fetchText(`${origin}/sitemap.xml`);
  if (sitemapContent && sitemapContent.includes("<urlset")) {
    const urlCount = (sitemapContent.match(/<url>/gi) || []).length;
    items.push({ id: "sitemap", label: "XML Sitemap", status: "pass", detail: `Sitemap найден и валиден. ${urlCount} URL в индексе.` });
  } else if (sitemapContent && sitemapContent.includes("<sitemapindex")) {
    items.push({ id: "sitemap", label: "XML Sitemap", status: "pass", detail: "Найден Sitemap Index (несколько файлов sitemap)." });
  } else {
    items.push({ id: "sitemap", label: "XML Sitemap", status: "fail", detail: "XML Sitemap не найден или невалиден. Рекомендуется создать и отправить в GSC/Bing." });
  }

  // 1.3 GSC coverage (heuristic: canonical, indexing meta)
  const hasNoindex = /meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html);
  const hasCanonical = /<link[^>]+rel=["']canonical["']/i.test(html);
  if (hasNoindex) {
    items.push({ id: "gsc-coverage", label: "Индексация (meta robots)", status: "fail", detail: "Обнаружен noindex. Страница не будет индексирована поисковиками." });
  } else if (hasCanonical) {
    items.push({ id: "gsc-coverage", label: "Индексация (meta robots + canonical)", status: "pass", detail: "noindex не обнаружен. Canonical тег присутствует." });
  } else {
    items.push({ id: "gsc-coverage", label: "Индексация (meta robots + canonical)", status: "warn", detail: "noindex не обнаружен, но canonical тег отсутствует. Рекомендуется добавить." });
  }

  // 1.4 Bing / IndexNow
  items.push({ id: "bing-indexnow", label: "Bing Webmaster + IndexNow", status: "warn", detail: "Автоматическая проверка недоступна. Рекомендуется добавить сайт в Bing Webmaster Tools и настроить IndexNow." });

  // 1.5 Core Web Vitals (heuristic from HTML)
  const hasLazyImages = /loading=["']lazy["']/i.test(html);
  const hasLargeInlineCSS = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi) || []).some(s => s.length > 5000);
  const hasPreload = /<link[^>]+rel=["']preload["']/i.test(html);
  let cwvStatus: "pass" | "warn" | "fail" = "pass";
  const cwvDetails: string[] = [];
  if (hasLazyImages) cwvDetails.push("Lazy loading изображений ✓");
  else { cwvDetails.push("Нет lazy loading — риск высокого LCP"); cwvStatus = "warn"; }
  if (hasPreload) cwvDetails.push("Preload ресурсов ✓");
  if (hasLargeInlineCSS) { cwvDetails.push("Большой inline CSS — риск блокировки рендера"); cwvStatus = "warn"; }
  items.push({ id: "cwv", label: "Core Web Vitals (эвристика)", status: cwvStatus, detail: cwvDetails.join(". ") + "." });

  // 1.6 Mobile optimization
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(html);
  const hasMediaQueries = /@media/i.test(html);
  items.push({
    id: "mobile",
    label: "Мобильная оптимизация",
    status: hasViewport ? "pass" : "fail",
    detail: hasViewport
      ? `Viewport meta тег найден.${hasMediaQueries ? " Media queries присутствуют." : ""}`
      : "Viewport meta тег отсутствует. Страница не оптимизирована для мобильных устройств."
  });

  // 1.7 TTFB (actually measure)
  let ttfbStatus: "pass" | "warn" | "fail" = "pass";
  let ttfbMs = 0;
  try {
    const start = Date.now();
    await fetchWithTimeout(url, 10000);
    ttfbMs = Date.now() - start;
    if (ttfbMs > 1500) ttfbStatus = "fail";
    else if (ttfbMs > 800) ttfbStatus = "warn";
  } catch {
    ttfbStatus = "fail";
    ttfbMs = -1;
  }
  items.push({
    id: "ttfb",
    label: "TTFB (время ответа сервера)",
    status: ttfbStatus,
    detail: ttfbMs > 0
      ? `Time to First Byte: ${ttfbMs}ms. ${ttfbMs <= 800 ? "Хороший показатель." : ttfbMs <= 1500 ? "Приемлемо, но можно улучшить." : "Очень медленно. Требуется оптимизация сервера."}`
      : "Не удалось измерить TTFB."
  });

  // 1.8 404 handling
  const test404 = await fetchText(`${origin}/___lovable_test_404_page___`);
  const test404status = test404 !== null ? "pass" : "warn";
  items.push({
    id: "404",
    label: "Обработка 404 ошибок",
    status: test404status,
    detail: test404 !== null ? "Сервер возвращает кастомную страницу 404." : "Не удалось проверить 404 обработку."
  });

  // 1.9 JS rendering
  const hasReactRoot = /id=["'](root|app|__next)["']/i.test(html);
  const noscriptContent = html.match(/<noscript>([\s\S]*?)<\/noscript>/gi);
  const bodyTextLength = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").trim().length;
  if (hasReactRoot && bodyTextLength < 500) {
    items.push({ id: "js-render", label: "Рендеринг JS-контента", status: "fail", detail: "Обнаружен SPA-фреймворк (React/Vue/Angular). Контент минимален без JS. ИИ может не извлечь данные." });
  } else if (hasReactRoot) {
    items.push({ id: "js-render", label: "Рендеринг JS-контента", status: "warn", detail: "SPA-фреймворк обнаружен, но SSR/SSG похоже работает — контент есть в HTML." });
  } else {
    items.push({ id: "js-render", label: "Рендеринг JS-контента", status: "pass", detail: "Контент рендерится на сервере. ИИ-боты смогут извлечь данные без JS." });
  }

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage1", title: "Этап 1: Техническая доступность для ИИ", score, items };
}

/* ─── Stage 2: Direct AI Verification ─── */
async function stage2(url: string, html: string, pageTitle: string): Promise<StageResult> {
  const items: CheckItem[] = [];

  // 2.1 AI Overview / ChatGPT / Perplexity / YandexGPT test queries
  // We can't actually query these APIs, but we analyze the page for AI-readability signals
  const hasStructuredData = /<script[^>]+type=["']application\/ld\+json["']/i.test(html);
  const hasMetaDesc = /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i.test(html);
  const metaDescMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const metaDesc = metaDescMatch?.[1] || "";

  items.push({
    id: "ai-overview",
    label: "Готовность к Google AI Overview",
    status: hasStructuredData && hasMetaDesc ? "pass" : hasMetaDesc ? "warn" : "fail",
    detail: hasStructuredData && hasMetaDesc
      ? "Страница имеет meta description и структурированные данные — хорошие шансы попасть в AI Overview."
      : hasMetaDesc
        ? "Meta description есть, но структурированные данные отсутствуют. Рекомендуется добавить Schema.org."
        : "Нет meta description и структурированных данных. Низкие шансы попасть в AI Overview."
  });

  items.push({
    id: "chatgpt-ready",
    label: "Готовность к цитированию ChatGPT",
    status: hasStructuredData ? "pass" : "warn",
    detail: hasStructuredData
      ? "Структурированные данные помогут ChatGPT корректно извлечь информацию."
      : "Без структурированных данных ChatGPT может извлечь информацию некорректно."
  });

  items.push({
    id: "perplexity-ready",
    label: "Готовность к Perplexity",
    status: hasMetaDesc && pageTitle.length > 10 ? "pass" : "warn",
    detail: hasMetaDesc
      ? "Meta description и информативный title помогут Perplexity сформировать ответ."
      : "Отсутствует meta description — Perplexity будет извлекать данные из основного текста."
  });

  items.push({
    id: "yandexgpt-ready",
    label: "Готовность к YandexGPT",
    status: "warn",
    detail: "Автоматическая проверка в YandexGPT недоступна. Рекомендуется вручную протестировать запросы."
  });

  // 2.2 Data extraction accuracy
  // Check for prices
  const hasPrices = /(\d[\d\s]*[₽$€]|[₽$€]\s*\d|price|цена)/i.test(html);
  const hasPriceSchema = /"price"|"priceCurrency"|"offers"/i.test(html);
  if (hasPrices) {
    items.push({
      id: "data-prices",
      label: "Корректность извлечения цен",
      status: hasPriceSchema ? "pass" : "fail",
      detail: hasPriceSchema
        ? "Цены размечены через Schema.org (Offer/Product). ИИ извлечёт их корректно."
        : "На странице есть цены, но они не размечены через Schema.org. ИИ может извлечь устаревшие/некорректные данные."
    });
  } else {
    items.push({ id: "data-prices", label: "Корректность извлечения цен", status: "pass", detail: "Страница не содержит явных ценовых данных. Проверка не требуется." });
  }

  // Check for phone numbers
  const hasPhones = /(\+?\d[\d\s\-()]{7,})/i.test(html);
  const hasContactSchema = /"telephone"|"contactPoint"|"LocalBusiness"/i.test(html);
  items.push({
    id: "data-contacts",
    label: "Корректность извлечения контактов",
    status: hasPhones && hasContactSchema ? "pass" : hasPhones ? "warn" : "pass",
    detail: hasPhones
      ? (hasContactSchema ? "Контакты размечены через Schema.org. ИИ извлечёт их корректно." : "Телефоны найдены, но не размечены через Schema.org. Рекомендуется добавить ContactPoint.")
      : "Явных контактных данных на странице не обнаружено."
  });

  // 2.3 Google AI Studio debugging
  items.push({
    id: "ai-studio",
    label: "Отладка через Google AI Studio",
    status: "warn",
    detail: "Рекомендуется протестировать извлечение данных страницы через Google AI Studio (aistudio.google.com) для проверки интерпретации контента."
  });

  // 2.4 Content chunking analysis
  const h2Count = (html.match(/<h2[\s>]/gi) || []).length;
  const h3Count = (html.match(/<h3[\s>]/gi) || []).length;
  const paragraphCount = (html.match(/<p[\s>]/gi) || []).length;
  const totalChunks = h2Count + h3Count;

  let chunkStatus: "pass" | "warn" | "fail" = "pass";
  let chunkDetail = "";
  if (totalChunks >= 5 && paragraphCount >= 8) {
    chunkDetail = `Хорошая структура для chunking: ${h2Count} секций H2, ${h3Count} подсекций H3, ${paragraphCount} параграфов.`;
  } else if (totalChunks >= 2) {
    chunkStatus = "warn";
    chunkDetail = `Базовая структура: ${h2Count} H2, ${h3Count} H3. Рекомендуется добавить больше подзаголовков для улучшения chunking.`;
  } else {
    chunkStatus = "fail";
    chunkDetail = `Слабая структура для chunking (${h2Count} H2, ${h3Count} H3). ИИ будет сложно разделить контент на смысловые блоки.`;
  }
  items.push({ id: "chunking", label: "Анализ чанков контента", status: chunkStatus, detail: chunkDetail });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage2", title: "Этап 2: Прямая проверка в ИИ", score, items };
}

/* ─── Stage 3: Page Structure & Semantic Markup ─── */
function stage3(html: string, pageTitle: string): StageResult {
  const items: CheckItem[] = [];

  // 3.1 Single H1 + title match
  const h1Matches = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) || [];
  const h1Count = h1Matches.length;
  const h1Text = h1Matches[0]?.replace(/<[^>]+>/g, "").trim() || "";

  if (h1Count === 1) {
    const titleSimilar = pageTitle && h1Text && (pageTitle.toLowerCase().includes(h1Text.toLowerCase().slice(0, 20)) || h1Text.toLowerCase().includes(pageTitle.toLowerCase().slice(0, 20)));
    items.push({
      id: "h1",
      label: "Единственный H1 + соответствие title",
      status: titleSimilar ? "pass" : "warn",
      detail: titleSimilar
        ? `Один H1: "${h1Text.slice(0, 80)}". Соответствует title.`
        : `Один H1: "${h1Text.slice(0, 80)}". Title: "${pageTitle.slice(0, 60)}". Рекомендуется согласовать.`
    });
  } else if (h1Count === 0) {
    items.push({ id: "h1", label: "Единственный H1 + соответствие title", status: "fail", detail: "H1 тег отсутствует на странице." });
  } else {
    items.push({ id: "h1", label: "Единственный H1 + соответствие title", status: "fail", detail: `Обнаружено ${h1Count} тегов H1. Должен быть только один.` });
  }

  // 3.2 Heading hierarchy
  const headingLevels: number[] = [];
  const headingRegex = /<h([1-6])[\s>]/gi;
  let m;
  while ((m = headingRegex.exec(html)) !== null) headingLevels.push(parseInt(m[1]));
  let hierarchyOk = true;
  let skipDetails = "";
  for (let i = 1; i < headingLevels.length; i++) {
    if (headingLevels[i] > headingLevels[i - 1] + 1) {
      hierarchyOk = false;
      skipDetails = `Пропуск: H${headingLevels[i - 1]} → H${headingLevels[i]}`;
      break;
    }
  }
  items.push({
    id: "heading-hierarchy",
    label: "Иерархия заголовков (H2 → H3 без пропусков)",
    status: hierarchyOk ? "pass" : "warn",
    detail: hierarchyOk
      ? `Иерархия корректна. Уровни: ${[...new Set(headingLevels)].sort().map(l => `H${l}`).join(", ")}.`
      : `Нарушена иерархия заголовков. ${skipDetails}. Это затрудняет AI-парсинг.`
  });

  // 3.3 Semantic tags
  const semanticChecks: { tag: string; label: string }[] = [
    { tag: "main", label: "<main>" },
    { tag: "article", label: "<article>" },
    { tag: "section", label: "<section>" },
    { tag: "aside", label: "<aside>" },
    { tag: "nav", label: "<nav>" },
  ];
  const foundTags: string[] = [];
  const missingTags: string[] = [];
  for (const { tag, label } of semanticChecks) {
    const regex = new RegExp(`<${tag}[\\s>]`, "i");
    if (regex.test(html)) foundTags.push(label);
    else missingTags.push(label);
  }
  items.push({
    id: "semantic-tags",
    label: "Семантические теги (main, article, section, aside, nav)",
    status: foundTags.length >= 3 ? "pass" : foundTags.length >= 1 ? "warn" : "fail",
    detail: `Найдены: ${foundTags.join(", ") || "нет"}.${missingTags.length > 0 ? ` Отсутствуют: ${missingTags.join(", ")}.` : ""}`
  });

  // 3.4 Inline semantic elements
  const hasStrong = /<strong[\s>]/i.test(html);
  const hasEm = /<em[\s>]/i.test(html);
  const hasLists = /<(ul|ol)[\s>]/i.test(html);
  const hasTables = /<table[\s>]/i.test(html);
  const inlineCount = [hasStrong, hasEm, hasLists, hasTables].filter(Boolean).length;
  items.push({
    id: "inline-semantic",
    label: "Использование strong, em, ul/ol, table",
    status: inlineCount >= 3 ? "pass" : inlineCount >= 1 ? "warn" : "fail",
    detail: `Найдено: ${[hasStrong && "strong", hasEm && "em", hasLists && "ul/ol", hasTables && "table"].filter(Boolean).join(", ") || "ничего"}. ${inlineCount < 3 ? "Рекомендуется разнообразить семантическую разметку." : "Хорошее разнообразие."}`
  });

  // 3.5 Schema.org markup
  const jsonLdBlocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  const schemaTypes: string[] = [];
  for (const block of jsonLdBlocks) {
    const content = block.replace(/<\/?script[^>]*>/gi, "");
    try {
      const parsed = JSON.parse(content);
      const extractTypes = (obj: any): void => {
        if (obj?.["@type"]) schemaTypes.push(obj["@type"]);
        if (Array.isArray(obj?.["@graph"])) obj["@graph"].forEach(extractTypes);
      };
      extractTypes(parsed);
    } catch { /* ignore parse errors */ }
  }

  if (schemaTypes.length >= 2) {
    items.push({ id: "schema", label: "Schema.org разметка (валидность + типы)", status: "pass", detail: `Найдено ${jsonLdBlocks.length} JSON-LD блоков. Типы: ${schemaTypes.join(", ")}.` });
  } else if (schemaTypes.length === 1) {
    items.push({ id: "schema", label: "Schema.org разметка (валидность + типы)", status: "warn", detail: `Найден 1 тип Schema.org: ${schemaTypes[0]}. Рекомендуется добавить дополнительные типы.` });
  } else {
    items.push({ id: "schema", label: "Schema.org разметка (валидность + типы)", status: "fail", detail: "Schema.org разметка (JSON-LD) не найдена. Критически важно для AI-поисковиков." });
  }

  // 3.6 Entity linking via @id
  const hasAtId = /"@id"\s*:/i.test(html);
  items.push({
    id: "entity-linking",
    label: "Связывание сущностей через @id",
    status: hasAtId ? "pass" : "warn",
    detail: hasAtId
      ? "Обнаружены @id связи в JSON-LD. Сущности связаны для построения Knowledge Graph."
      : "Нет @id связей в Schema.org. Рекомендуется связать сущности (Organization, WebPage, Author) через @id."
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage3", title: "Этап 3: Структура страниц и семантическая вёрстка", score, items };
}

/* ─── Stage 4: Content & Topical Authority ─── */
function stage4(html: string): StageResult {
  const items: CheckItem[] = [];

  // Strip HTML to get clean text
  const cleanText = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const wordCount = cleanText.split(/\s+/).length;
  const sentences = cleanText.split(/[.!?]+/).filter(s => s.trim().length > 10);

  // 4.1 Answer-first approach (inverted pyramid)
  const firstParagraphs = html.match(/<p[^>]*>([\s\S]*?)<\/p>/gi)?.slice(0, 3) || [];
  const firstParaText = firstParagraphs.map(p => p.replace(/<[^>]+>/g, "").trim()).join(" ");
  const hasDirectAnswer = firstParaText.length > 100;
  items.push({
    id: "answer-first",
    label: 'Подход "Ответ-прежде-всего" (перевёрнутая пирамида)',
    status: hasDirectAnswer && firstParaText.length > 200 ? "pass" : hasDirectAnswer ? "warn" : "fail",
    detail: hasDirectAnswer
      ? `Первые параграфы содержат ${firstParaText.length} символов. ${firstParaText.length > 200 ? "Хорошая плотность информации в начале." : "Можно добавить больше конкретики в начало."}`
      : "Недостаточно контента в начале страницы. ИИ извлекает ответы из первых параграфов."
  });

  // 4.2 Topic clusters & internal linking
  const internalLinks = (html.match(/<a[^>]+href=["'][^"']*["']/gi) || []);
  const internalLinksCount = internalLinks.filter(l => !l.includes("http") || l.includes(html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/)?.[1]?.split("/")[2] || "___")).length;
  items.push({
    id: "internal-links",
    label: "Тематические кластеры и внутренняя перелинковка",
    status: internalLinksCount >= 10 ? "pass" : internalLinksCount >= 3 ? "warn" : "fail",
    detail: `Обнаружено ~${internalLinksCount} внутренних ссылок. ${internalLinksCount >= 10 ? "Хорошая перелинковка." : "Рекомендуется усилить внутреннюю перелинковку для тематических кластеров."}`
  });

  // 4.3 Content gap (heuristic: word count vs typical competitors)
  let gapStatus: "pass" | "warn" | "fail" = "pass";
  if (wordCount < 300) gapStatus = "fail";
  else if (wordCount < 800) gapStatus = "warn";
  items.push({
    id: "content-gap",
    label: "Анализ контент-гэпов vs конкурентов",
    status: gapStatus,
    detail: `Объём контента: ~${wordCount} слов. ${wordCount >= 800 ? "Достаточный объём для конкуренции в поиске." : wordCount >= 300 ? "Средний объём. Конкуренты в ТОП-10 обычно имеют 1000+ слов." : "Критически мало контента. Необходимо расширить."}`
  });

  // 4.4 Added value (facts, research, experience)
  const hasNumbers = /\d{3,}/.test(cleanText);
  const hasCitations = /(исследован|по данным|согласно|источник|study|research|according|data shows)/i.test(cleanText);
  const hasStats = /(\d+\s*%|\d+\s*из\s*\d+)/i.test(cleanText);
  const valueCount = [hasNumbers, hasCitations, hasStats].filter(Boolean).length;
  items.push({
    id: "added-value",
    label: "Добавочная ценность (факты, исследования, опыт)",
    status: valueCount >= 2 ? "pass" : valueCount >= 1 ? "warn" : "fail",
    detail: `${[hasNumbers && "числовые данные", hasCitations && "ссылки на исследования", hasStats && "статистика"].filter(Boolean).join(", ") || "Нет маркеров добавочной ценности"}. ${valueCount < 2 ? "Рекомендуется добавить факты, данные исследований и экспертный опыт." : "Хороший уровень добавочной ценности."}`
  });

  // 4.5 Multimodality
  const imgCount = (html.match(/<img[\s>]/gi) || []).length;
  const hasVideo = /<(video|iframe[^>]+(?:youtube|vimeo|rutube))/i.test(html);
  const hasTables = /<table[\s>]/i.test(html);
  const hasSvg = /<svg[\s>]/i.test(html);
  const modalityCount = [imgCount > 0, hasVideo, hasTables, hasSvg].filter(Boolean).length;
  items.push({
    id: "multimodal",
    label: "Мультимодальность (таблицы, схемы, изображения, видео)",
    status: modalityCount >= 3 ? "pass" : modalityCount >= 2 ? "warn" : "fail",
    detail: `Найдено: ${[imgCount > 0 && `${imgCount} изображений`, hasVideo && "видео", hasTables && "таблицы", hasSvg && "SVG/схемы"].filter(Boolean).join(", ") || "ничего"}. ${modalityCount < 3 ? "Рекомендуется добавить разнообразный контент." : "Хорошее мультимодальное покрытие."}`
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage4", title: "Этап 4: Контент и тематический авторитет", score, items };
}

/* ─── Stage 5: E-E-A-T & Brand Reputation ─── */
function stage5(html: string): StageResult {
  const items: CheckItem[] = [];

  const cleanText = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ");

  // 5.1 Experience & Expertise
  const hasAuthor = /(author|автор|об авторе|about the author|written by|написал)/i.test(html);
  const hasExperience = /(опыт|experience|кейс|case study|пример|example|отзыв|testimonial|review)/i.test(cleanText);
  items.push({
    id: "experience",
    label: "Доказательства опыта и экспертизы",
    status: hasAuthor && hasExperience ? "pass" : hasAuthor || hasExperience ? "warn" : "fail",
    detail: `${[hasAuthor && "упоминание автора", hasExperience && "маркеры опыта/кейсов"].filter(Boolean).join(", ") || "Нет маркеров E-E-A-T"}. ${!(hasAuthor && hasExperience) ? "Рекомендуется добавить информацию об авторе, кейсы и доказательства экспертизы." : "Хорошие сигналы экспертизы."}`
  });

  // 5.2 Authoritative external sources
  const externalLinks = (html.match(/<a[^>]+href=["']https?:\/\/[^"']+["']/gi) || []);
  const extCount = externalLinks.filter(l => !l.includes("facebook.com") && !l.includes("twitter.com") && !l.includes("instagram.com")).length;
  items.push({
    id: "external-sources",
    label: "Авторитетные внешние источники",
    status: extCount >= 3 ? "pass" : extCount >= 1 ? "warn" : "fail",
    detail: `${extCount} внешних ссылок на источники. ${extCount >= 3 ? "Хороший уровень цитирования." : "Рекомендуется добавить ссылки на авторитетные источники (исследования, отраслевые ресурсы)."}`
  });

  // 5.3 Brand mentions
  const hasOrgSchema = /"Organization"|"LocalBusiness"|"Corporation"/i.test(html);
  items.push({
    id: "brand-mentions",
    label: "Упоминания бренда в сети",
    status: hasOrgSchema ? "warn" : "fail",
    detail: hasOrgSchema
      ? "Обнаружена Schema.org разметка организации. Для полной проверки упоминаний рекомендуется использовать Brand24 или Mention."
      : "Нет разметки Organization. Рекомендуется добавить Schema.org Organization и мониторить упоминания."
  });

  // 5.4 Ratings & Q&A
  const hasFaq = /<(details|summary)|FAQPage|"question"|"acceptedAnswer"/i.test(html);
  const hasRating = /AggregateRating|"ratingValue"|"reviewCount"|Review/i.test(html);
  items.push({
    id: "ratings-qa",
    label: "Присутствие в рейтингах и Q&A",
    status: hasFaq && hasRating ? "pass" : hasFaq || hasRating ? "warn" : "fail",
    detail: `${[hasFaq && "FAQ/Q&A контент", hasRating && "рейтинги/отзывы"].filter(Boolean).join(", ") || "Нет FAQ и рейтингов"}. ${!(hasFaq && hasRating) ? "Рекомендуется добавить FAQ блок с разметкой и отзывы с AggregateRating." : "Хорошее покрытие."}`
  });

  // 5.5 Google Business Profile
  const hasGBP = /google\.com\/maps|goo\.gl\/maps|LocalBusiness|GeoCoordinates/i.test(html);
  items.push({
    id: "gbp",
    label: "Google Business Profile + Яндекс.Бизнес",
    status: hasGBP ? "pass" : "warn",
    detail: hasGBP
      ? "Обнаружены маркеры Google Maps / LocalBusiness. Рекомендуется также проверить Яндекс.Бизнес."
      : "Нет маркеров Google Business Profile. Рекомендуется зарегистрировать и связать с сайтом."
  });

  // 5.6 Knowledge Panel
  const hasKnowledgeSignals = hasOrgSchema && (/"sameAs"\s*:\s*\[/i.test(html));
  items.push({
    id: "knowledge-panel",
    label: "Панель знаний (Knowledge Panel)",
    status: hasKnowledgeSignals ? "pass" : "warn",
    detail: hasKnowledgeSignals
      ? "Organization + sameAs links обнаружены — хорошие сигналы для Knowledge Panel."
      : "Нет sameAs связей в Schema.org. Добавьте ссылки на Wikipedia, соцсети, Wikidata для Knowledge Panel."
  });

  const score = Math.round((items.filter(i => i.status === "pass").length / items.length) * 100);
  return { id: "stage5", title: "Этап 5: E-E-A-T и репутация бренда", score, items };
}

/* ─── Generate recommendations ─── */
function generateRecommendations(stages: StageResult[]): { criticals: string[]; strategy: string[] } {
  const failItems = stages.flatMap(s => s.items.filter(i => i.status === "fail").map(i => ({ stage: s.title, ...i })));
  const warnItems = stages.flatMap(s => s.items.filter(i => i.status === "warn").map(i => ({ stage: s.title, ...i })));

  const criticals = failItems.slice(0, 5).map(i => `${i.label}: ${i.detail.split(".")[0]}.`);
  if (criticals.length < 5) {
    criticals.push(...warnItems.slice(0, 5 - criticals.length).map(i => `${i.label}: ${i.detail.split(".")[0]}.`));
  }

  const strategy: string[] = [];
  const hasRobotsIssues = stages[0]?.items.some(i => i.id.startsWith("robots-") && i.status === "fail");
  const hasSchemaIssues = stages[2]?.items.some(i => i.id === "schema" && i.status !== "pass");
  const hasContentIssues = (stages[3]?.score || 0) < 70;
  const hasEeatIssues = (stages[4]?.score || 0) < 70;

  if (hasRobotsIssues) strategy.push("Неделя 1: Исправить robots.txt — разблокировать AI-ботов (GPTBot, ChatGPT-User, PerplexityBot).");
  if (hasSchemaIssues) strategy.push("Неделя 1–2: Добавить Schema.org разметку (Organization, Product/Service, FAQ, BreadcrumbList).");
  strategy.push("Неделя 2–3: Оптимизировать структуру заголовков и семантические теги.");
  if (hasContentIssues) strategy.push("Неделя 3–4: Расширить контент по принципу «Ответ-прежде-всего», закрыть контент-гэпы.");
  strategy.push("Неделя 4–5: Добавить мультимодальный контент (видео, таблицы, инфографика).");
  if (hasEeatIssues) strategy.push("Месяц 2: Усилить E-E-A-T — авторские страницы, кейсы, внешние упоминания.");
  strategy.push("Месяц 2+: Мониторинг AI-видимости, тестирование в ChatGPT/Perplexity/AI Overview.");

  return { criticals, strategy };
}

/* ─── Main handler ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "URL is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Normalize URL
    let targetUrl = url.trim();
    if (!targetUrl.startsWith("http")) targetUrl = `https://${targetUrl}`;

    const origin = extractDomain(targetUrl);

    // Fetch the page HTML
    let html: string;
    try {
      // Try Jina Reader first for better JS rendering
      const JINA_KEY = Deno.env.get("JINA_API_KEY");
      const headers: Record<string, string> = { Accept: "text/html" };
      if (JINA_KEY) headers["Authorization"] = `Bearer ${JINA_KEY}`;

      const jinaRes = await fetchWithTimeout(`https://r.jina.ai/${targetUrl}`, 15000);
      if (jinaRes.ok) {
        html = await jinaRes.text();
      } else {
        // Fallback to direct fetch
        const directRes = await fetchWithTimeout(targetUrl, 15000);
        html = await directRes.text();
      }
    } catch {
      // Last resort
      const directRes = await fetchWithTimeout(targetUrl, 15000);
      html = await directRes.text();
    }

    // Also fetch raw HTML for structural analysis
    let rawHtml: string;
    try {
      const directRes = await fetchWithTimeout(targetUrl, 10000);
      rawHtml = await directRes.text();
    } catch {
      rawHtml = html;
    }

    // Extract title
    const titleMatch = rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const pageTitle = titleMatch?.[1]?.replace(/<[^>]+>/g, "").trim() || "";

    // Run all stages
    const [s1, s2] = await Promise.all([
      stage1(targetUrl, rawHtml, origin),
      stage2(targetUrl, rawHtml, pageTitle),
    ]);
    const s3 = stage3(rawHtml, pageTitle);
    const s4 = stage4(rawHtml);
    const s5 = stage5(rawHtml);

    const stages = [s1, s2, s3, s4, s5];
    const geoScore = Math.round(stages.reduce((sum, s) => sum + s.score, 0) / stages.length);
    const { criticals, strategy } = generateRecommendations(stages);

    const result: AuditResult = { geoScore, stages, criticals, strategy };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("geo-audit error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
