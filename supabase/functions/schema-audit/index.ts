import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") || "";
const JINA_API_KEY = Deno.env.get("JINA_API_KEY") || "";

/* ─── Schema validation rules ─── */
const SCHEMA_RULES: Record<string, { required: string[]; recommended: string[]; nestedRequired?: Record<string, string[]> }> = {
  Product: {
    required: ["name", "offers"],
    recommended: ["image", "description", "aggregateRating", "brand"],
    nestedRequired: { offers: ["price", "priceCurrency", "availability"] },
  },
  Organization: { required: ["name"], recommended: ["url", "logo", "contactPoint", "address", "sameAs"] },
  Article: { required: ["headline", "author", "datePublished"], recommended: ["image", "dateModified", "publisher"] },
  BlogPosting: { required: ["headline", "author", "datePublished"], recommended: ["image", "dateModified", "publisher"] },
  FAQPage: {
    required: ["mainEntity"],
    recommended: [],
    nestedRequired: { mainEntity: ["name", "acceptedAnswer"] },
  },
  BreadcrumbList: {
    required: ["itemListElement"],
    recommended: [],
    nestedRequired: { itemListElement: ["position", "name", "item"] },
  },
  LocalBusiness: { required: ["name", "address"], recommended: ["telephone", "openingHours", "geo", "priceRange"] },
  WebSite: { required: ["name", "url"], recommended: ["potentialAction"] },
};

interface FoundSchema {
  type: string;
  format: "JSON-LD" | "Microdata" | "RDFa";
  raw: any;
  fields: { key: string; status: "ok" | "missing" | "warning"; value?: string }[];
  severity: "ok" | "warning" | "critical";
  line?: number;
}

interface Issue {
  severity: "critical" | "warning" | "info";
  schema: string;
  problem: string;
  solution: string;
  seoImpact?: string;
}

function safeJsonParse(s: string): any | null {
  try { return JSON.parse(s); } catch { return null; }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname; } catch { return url; }
}

/* ─── JSON-LD extraction ─── */
function extractJsonLd(html: string): { data: any; line: number }[] {
  const out: { data: any; line: number }[] = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const before = html.slice(0, m.index);
    const line = before.split("\n").length;
    const parsed = safeJsonParse(m[1].trim());
    if (!parsed) continue;
    if (Array.isArray(parsed)) {
      for (const it of parsed) out.push({ data: it, line });
    } else if (parsed["@graph"] && Array.isArray(parsed["@graph"])) {
      for (const it of parsed["@graph"]) out.push({ data: it, line });
    } else {
      out.push({ data: parsed, line });
    }
  }
  return out;
}

/* ─── Microdata extraction (simple regex-based) ─── */
function extractMicrodata(html: string): any[] {
  const out: any[] = [];
  const re = /<[^>]+\bitemscope\b[^>]*\bitemtype=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const typeUrl = m[1];
    const type = typeUrl.split("/").pop() || typeUrl;
    out.push({ "@type": type, _format: "Microdata" });
  }
  return out;
}

/* ─── RDFa extraction (simple regex-based) ─── */
function extractRdfa(html: string): any[] {
  const out: any[] = [];
  const re = /<[^>]+\btypeof=["']([^"']+)["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const type = m[1].replace(/^[a-z]+:/i, "");
    out.push({ "@type": type, _format: "RDFa" });
  }
  return out;
}

/* ─── Validate a JSON-LD schema ─── */
function validateSchema(data: any, line: number): FoundSchema {
  const typeRaw = data["@type"];
  const type = Array.isArray(typeRaw) ? typeRaw[0] : (typeRaw || "Unknown");
  const rules = SCHEMA_RULES[type];
  const fields: FoundSchema["fields"] = [];
  let severity: "ok" | "warning" | "critical" = "ok";

  if (!rules) {
    for (const k of Object.keys(data)) {
      if (k.startsWith("@")) continue;
      const v = data[k];
      fields.push({ key: k, status: "ok", value: typeof v === "string" ? v.slice(0, 60) : undefined });
    }
    return { type, format: "JSON-LD", raw: data, fields, severity, line };
  }

  for (const req of rules.required) {
    const present = data[req] !== undefined && data[req] !== null && data[req] !== "";
    fields.push({
      key: req,
      status: present ? "ok" : "missing",
      value: present && typeof data[req] === "string" ? data[req].slice(0, 60) : undefined,
    });
    if (!present) severity = "critical";

    if (present && rules.nestedRequired?.[req]) {
      const nested = Array.isArray(data[req]) ? data[req][0] : data[req];
      if (typeof nested === "object" && nested !== null) {
        for (const nreq of rules.nestedRequired[req]) {
          const np = nested[nreq] !== undefined && nested[nreq] !== null && nested[nreq] !== "";
          fields.push({
            key: `${req}.${nreq}`,
            status: np ? "ok" : "missing",
            value: np && typeof nested[nreq] === "string" ? String(nested[nreq]).slice(0, 60) : undefined,
          });
          if (!np) severity = "critical";
        }
      }
    }
  }
  for (const rec of rules.recommended) {
    const present = data[rec] !== undefined && data[rec] !== null && data[rec] !== "";
    fields.push({
      key: rec,
      status: present ? "ok" : "warning",
      value: present && typeof data[rec] === "string" ? data[rec].slice(0, 60) : undefined,
    });
    if (!present && severity === "ok") severity = "warning";
  }

  return { type, format: "JSON-LD", raw: data, fields, severity, line };
}

/* ─── Build issues from validated schemas ─── */
function buildIssues(schemas: FoundSchema[]): Issue[] {
  const issues: Issue[] = [];
  for (const s of schemas) {
    for (const f of s.fields) {
      if (f.status === "missing") {
        issues.push({
          severity: "critical",
          schema: s.type,
          problem: `${s.type}: отсутствует обязательное поле "${f.key}"`,
          solution: `Добавить поле "${f.key}" в схему ${s.type}.`,
          seoImpact: "Блокирует Rich Results в Google.",
        });
      } else if (f.status === "warning") {
        issues.push({
          severity: "warning",
          schema: s.type,
          problem: `${s.type}: рекомендуется добавить "${f.key}"`,
          solution: `Добавить поле "${f.key}" для лучшей индексации.`,
        });
      }
    }
  }
  return issues;
}

/* ─── Heuristics: detect page features for missing-schema suggestions ─── */
function detectPageFeatures(html: string, content: string) {
  const lc = (content || "").toLowerCase();
  return {
    hasPrice: /\b\d{2,}[\s ]?(₽|руб|rub|usd|\$|€|eur)\b/i.test(lc) || /"price"/i.test(html),
    hasFaq: /(вопрос|часто задаваем|faq|q:|вопрос-ответ)/i.test(lc),
    hasAddress: /(г\.|город|ул\.|улица|address|адрес)/i.test(lc) && /(тел|phone|\+\d{1,3}[\s\-]?\(?\d)/i.test(lc),
    hasArticle: /<article[\s>]/i.test(html) || /<time[\s>]/i.test(html),
  };
}

/* ─── Generate JSON-LD code blocks ─── */
function buildGeneratedCode(
  url: string,
  schemas: FoundSchema[],
  features: ReturnType<typeof detectPageFeatures>,
  pageTitle: string,
  pageData?: { companyName?: string | null; phone?: string | null; email?: string | null; address?: string | null; logo?: string | null; description?: string | null; workingHours?: string | null; priceRange?: string | null },
  pageType: string = "general",
) {
  const blocks: { type: string; label: string; code: string; reason: string }[] = [];
  const origin = (() => { try { return new URL(url).origin; } catch { return url; } })();
  const companyName = (pageData?.companyName || pageTitle || domainToCompanyName(url)).trim();
  const phone = pageData?.phone || null;
  const email = pageData?.email || null;
  const address = pageData?.address || null;
  const logo = pageData?.logo || null;
  const description = pageData?.description || null;

  // WebSite always (with real name)
  if (!schemas.find(s => s.type === "WebSite")) {
    blocks.push({
      type: "WebSite",
      label: "WebSite — добавить",
      reason: "Базовая схема, рекомендуется на всех страницах • ✓ Данные взяты со страницы",
      code: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": companyName,
        "url": origin,
        "potentialAction": {
          "@type": "SearchAction",
          "target": `${origin}/?s={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      }, null, 2),
    });
  }

  // Person schema for personal brand / event host (instead of Organization)
  if (pageType === "event_host" && !schemas.find(s => s.type === "Person")) {
    const person: any = {
      "@context": "https://schema.org",
      "@type": "Person",
      "name": companyName,
      "jobTitle": "Ведущий мероприятий",
      "url": origin,
    };
    if (description) person.description = description;
    if (email) person.email = email;
    if (phone) person.telephone = phone;
    if (logo) person.image = logo;
    person.knowsAbout = ["Ведение мероприятий", "Свадьбы", "Корпоративы", "Частные события"];
    person.areaServed = "Россия";
    const dataSource = (email || phone || description) ? "✓ Данные взяты со страницы" : "⚠ Заполните контакты вручную";
    blocks.push({
      type: "Person",
      label: "Person — добавить (личный бренд)",
      reason: `Подходит для ведущих, экспертов, фрилансеров • ${dataSource}`,
      code: JSON.stringify(person, null, 2),
    });
  }

  // Organization (skip for personal brands — Person is more accurate)
  if (pageType !== "event_host" && !schemas.find(s => s.type === "Organization")) {
    const org: any = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": companyName,
      "url": origin,
    };
    if (logo) org.logo = logo;
    if (description) org.description = description;
    if (phone || email) {
      org.contactPoint = {
        "@type": "ContactPoint",
        "contactType": "customer service",
        ...(phone ? { telephone: phone } : {}),
        ...(email ? { email: email } : {}),
      };
    }
    const dataSource = (phone || email || logo || description) ? "✓ Данные взяты со страницы" : "⚠ Заполните вручную";
    blocks.push({
      type: "Organization",
      label: "Organization — добавить",
      reason: `Базовая схема компании • ${dataSource}`,
      code: JSON.stringify(org, null, 2),
    });
  }

  // BreadcrumbList from URL
  if (!schemas.find(s => s.type === "BreadcrumbList")) {
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      if (parts.length > 0) {
        const items = [{ "@type": "ListItem", position: 1, name: "Главная", item: u.origin }];
        let acc = u.origin;
        parts.forEach((p, i) => {
          acc += "/" + p;
          items.push({ "@type": "ListItem", position: i + 2, name: decodeURIComponent(p).replace(/-/g, " "), item: acc });
        });
        blocks.push({
          type: "BreadcrumbList",
          label: "BreadcrumbList — добавить (из URL)",
          reason: "Сгенерировано из структуры URL",
          code: JSON.stringify({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items }, null, 2),
        });
      }
    } catch { /* ignore */ }
  }

  // Fixed versions for schemas with criticals
  for (const s of schemas) {
    if (s.severity !== "critical") continue;
    const fixed = JSON.parse(JSON.stringify(s.raw));
    if (s.type === "Product") {
      fixed.offers = fixed.offers || {};
      const off = Array.isArray(fixed.offers) ? fixed.offers[0] : fixed.offers;
      if (!off["@type"]) off["@type"] = "Offer";
      if (!off.priceCurrency) off.priceCurrency = "RUB";
      if (!off.availability) off.availability = "https://schema.org/InStock";
      if (!off.price) off.price = "0";
      if (!fixed.aggregateRating) {
        fixed.aggregateRating = { "@type": "AggregateRating", ratingValue: "5", reviewCount: "1" };
      }
    }
    blocks.push({
      type: s.type,
      label: `${s.type} — исправленная версия`,
      reason: "Добавлены обязательные поля",
      code: JSON.stringify(fixed, null, 2),
    });
  }

  if (features.hasFaq && !schemas.find(s => s.type === "FAQPage")) {
    blocks.push({
      type: "FAQPage",
      label: "FAQPage — добавить",
      reason: "На странице найден блок вопросов",
      code: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          { "@type": "Question", name: "Ваш вопрос?", acceptedAnswer: { "@type": "Answer", text: "Ваш ответ." } },
        ],
      }, null, 2),
    });
  }

  // Service schema for service-type pages
  if ((pageType === "service" || pageType === "event_host") && !schemas.find(s => s.type === "Service")) {
    const svc: any = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": pageType === "event_host" ? "Ведение мероприятий" : (pageTitle || "Услуги"),
      "provider": {
        "@type": pageType === "event_host" ? "Person" : "Organization",
        "name": companyName,
      },
      "areaServed": "Россия",
    };
    if (description) svc.description = description;
    if (pageData?.priceRange) svc.offers = { "@type": "Offer", priceCurrency: "RUB", price: pageData.priceRange.replace(/[^\d]/g, "") || "0" };
    blocks.push({
      type: "Service",
      label: "Service — добавить",
      reason: `Описание предоставляемой услуги • ${description ? "✓ Данные взяты со страницы" : "⚠ Уточните описание"}`,
      code: JSON.stringify(svc, null, 2),
    });
  }

  // LocalBusiness — for any site with contacts OR personal brand sites
  if ((features.hasAddress || pageType === "event_host" || pageType === "local_business" || pageType === "service") && !schemas.find(s => s.type === "LocalBusiness")) {
    const lb: any = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      "name": companyName,
      "url": origin,
    };
    if (address) {
      lb.address = { "@type": "PostalAddress", streetAddress: address, addressCountry: "RU" };
    } else {
      lb.address = { "@type": "PostalAddress", streetAddress: "Укажите реальный адрес", addressCountry: "RU" };
    }
    if (phone) lb.telephone = phone;
    if (email) lb.email = email;
    if (logo) lb.image = logo;
    if (pageData?.priceRange) lb.priceRange = pageData.priceRange;
    const dataSource = (address && (phone || email)) ? "✓ Данные взяты со страницы" : "⚠ Часть данных нужно уточнить";
    blocks.push({
      type: "LocalBusiness",
      label: "LocalBusiness — добавить",
      reason: `Локальный бизнес — повышает видимость в Картах • ${dataSource}`,
      code: JSON.stringify(lb, null, 2),
    });
  }

  return blocks;
}

/* ─── Score calculation ─── */
function calculateScore(schemas: FoundSchema[], richEligibleCount: number): number {
  const total = schemas.length;
  // Hard floor: no schemas at all = essentially nothing implemented
  if (total === 0) return 10;
  const critical = schemas.filter(s => s.severity === "critical").length;
  const valid = schemas.filter(s => s.severity === "ok").length;
  const validRatio = total > 0 ? valid / total : 0;
  const quantity = Math.min(total * 8, 25);              // max 25
  const quality = validRatio * 25;                        // max 25
  const noCritical = critical === 0 ? 25 : 0;             // 25 if clean
  const richBonus = Math.min(richEligibleCount * 5, 25);  // max 25
  return Math.round(quantity + quality + noCritical + richBonus);
}

/* ─── Domain → readable company name fallback ─── */
function domainToCompanyName(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const root = host.split(".")[0] || host;
    // Capitalize first letter
    return root.charAt(0).toUpperCase() + root.slice(1);
  } catch {
    return url;
  }
}

/* ─── AI: contextual recommendations & schema generation ─── */
async function getAiRecommendations(
  url: string,
  pageType: string,
  pageData: ReturnType<typeof extractPageData>,
  schemas: FoundSchema[],
  pageContent: string,
): Promise<any> {
  if (!OPENROUTER_API_KEY) return {};
  const sys = `Ты эксперт по Schema.org микроразметке. Анализируй HTML страницы и генерируй ПОЛНЫЙ набор микроразметки Schema.org для этой страницы.
Используй РЕАЛЬНЫЕ данные из контента страницы — названия, цены, адреса, телефоны, описания.
НЕ используй placeholder данные типа "Название компании" или "ул. Примерная".
Если данных нет — поставь null или пропусти поле, но не выдумывай.
Отвечай ТОЛЬКО на русском языке. Возвращай ТОЛЬКО валидный JSON без markdown.`;

  const user = `URL: ${url}
Тип страницы: ${pageType}
Извлечённые данные страницы: ${JSON.stringify(pageData)}
Найденные схемы (${schemas.length}): ${JSON.stringify(schemas.map(s => ({ type: s.type, severity: s.severity, raw: s.raw })))}
Контент страницы (первые 5000 символов): ${(pageContent || "").slice(0, 5000)}

Верни JSON:
{
  "pageAnalysis": {
    "companyName": string|null, "phone": string|null, "email": string|null,
    "address": string|null, "priceRange": string|null, "description": string|null,
    "rating": string|null, "mainKeywords": string[]
  },
  "missingSchemas": [
    {
      "type": "Organization|WebSite|BreadcrumbList|Product|Article|LocalBusiness|FAQPage",
      "priority": "critical"|"recommended",
      "reason": "почему нужна",
      "dataSource": "page"|"estimated",
      "generatedCode": { /* полный валидный JSON-LD объект с @context и @type */ }
    }
  ],
  "issues": [
    { "severity": "critical"|"warning"|"info", "schema": string, "field": string, "problem": string, "solution": string, "seoImpact": string }
  ],
  "richResultsEligible": [{ "type": string, "eligible": boolean, "reason": string }],
  "overallScore": number
}

Обязательно сгенерируй: WebSite, Organization, BreadcrumbList. Для product добавь Product+Offer; для article — Article; для local_business — LocalBusiness; если есть FAQ — FAQPage.`;

  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: sys }, { role: "user", content: user }],
        response_format: { type: "json_object" },
      }),
    });
    const j = await r.json();
    const txt = j?.choices?.[0]?.message?.content || "{}";
    return safeJsonParse(txt) || {};
  } catch (e) {
    console.error("[AI]", e);
    return {};
  }
}

/* ─── Bot-check page detection ─── */
function isBotCheckPage(html: string, text: string): boolean {
  const sample = ((html || "") + " " + (text || "")).toLowerCase().slice(0, 8000);
  // Short content + suspicious markers = almost certainly bot wall
  const tinyResponse = sample.length < 2000;
  const signals = [
    "killbot", "ddos-guard", "ddos guard", "cloudflare", "captcha",
    "verify you are human", "checking your browser", "just a moment",
    "please wait", "enable javascript and cookies", "security check",
    "bot verification", "user verification", "attention required",
    "ray id:", "cf-chl",
  ];
  const hits = signals.filter(s => sample.includes(s)).length;
  return hits >= 1 && (tinyResponse || hits >= 2);
}

async function fetchJina(url: string, format: "text" | "html"): Promise<string> {
  const headers: Record<string, string> = {
    "X-Return-Format": format,
    "X-No-Cache": "true",
    "X-With-Generated-Alt": "true",
  };
  if (JINA_API_KEY) headers["Authorization"] = `Bearer ${JINA_API_KEY}`;
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, { headers });
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

async function fetchRaw(url: string): Promise<string> {
  try {
    const r = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "ru-RU,ru;q=0.9,en;q=0.8",
      },
      redirect: "follow",
    });
    if (!r.ok) return "";
    return await r.text();
  } catch { return ""; }
}

/* CORS proxies removed: they injected their own HTML/CSS/email into extraction.
   Fetching is now restricted to direct origin + Jina Reader (server-side, no CORS). */

function urlVariants(url: string): string[] {
  const out = new Set<string>([url]);
  try {
    const u = new URL(url);
    if (u.hostname.startsWith("www.")) {
      u.hostname = u.hostname.slice(4);
      out.add(u.toString());
    } else {
      const w = new URL(url);
      w.hostname = "www." + w.hostname;
      out.add(w.toString());
    }
  } catch { /* ignore */ }
  return [...out];
}

/* ─── Dual fetch with bot detection & fallbacks ─── */
async function fetchHtml(url: string): Promise<{ html: string; content: string; title: string; botBlocked: boolean }> {
  const variants = urlVariants(url);

  let html = "";
  let content = "";
  let usedVariant = url;

  for (const v of variants) {
    const [jinaText, raw] = await Promise.all([fetchJina(v, "text"), fetchRaw(v)]);
    let candidateHtml = raw;
    let candidateText = jinaText;
    if (!candidateHtml) candidateHtml = await fetchJina(v, "html");
    const blocked = isBotCheckPage(candidateHtml, candidateText);
    console.log("[schema-audit fetch]", { variant: v, htmlLen: candidateHtml.length, textLen: candidateText.length, blocked });
    if (!blocked && (candidateHtml || candidateText)) {
      html = candidateHtml; content = candidateText || candidateHtml; usedVariant = v;
      break;
    }
  }

  // Final fallback: Google Cache
  if (!html && !content) {
    try {
      const cacheUrl = `https://webcache.googleusercontent.com/search?q=cache:${encodeURIComponent(url)}`;
      const r = await fetch(cacheUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (r.ok) {
        const cached = await r.text();
        if (!isBotCheckPage(cached, "")) {
          html = cached; content = cached;
          console.log("[schema-audit fetch] used Google Cache");
        }
      }
    } catch { /* ignore */ }
  }

  // If still nothing usable AND we did detect a bot wall — flag it
  if (!html && !content) {
    return { html: "", content: "", title: "", botBlocked: true };
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  return { html, content: content || html, title, botBlocked: false };
}

/* ─── Detect page type from URL & content ─── */
function detectPageType(url: string, content: string): string {
  const u = url.toLowerCase();
  const c = (content || "").toLowerCase();
  let pathname = "/";
  try { pathname = new URL(url).pathname; } catch { /* ignore */ }

  // Personal brand / event host (check first — strong signal)
  if (/(ведущий|ведущая|тамада|свадьб|корпоратив|мероприят|праздник|event host|wedding host)/i.test(c)) {
    return "event_host";
  }
  if (/\/(product|tovar|item|good|catalog|shop)/i.test(u) ||
      /(в корзину|купить|add to cart|артикул|sku|каталог|доставка|оформить заказ)/i.test(c)) return "ecommerce";
  if (/\/(blog|article|news|post)/i.test(u) ||
      /(опубликован|published|posted on)/i.test(c)) return "article";
  if (/(услуг[аи]|стоимость|заказать|прайс|консультац)/i.test(c) &&
      !/(в корзину|купить)/i.test(c)) return "service";
  if (/(адрес|режим работы|время работы|opening hours)/i.test(c) &&
      /(тел\.|телефон|phone|\+\d)/i.test(c)) return "local_business";
  if (pathname === "/" || pathname === "") return "homepage";
  return "general";
}

/* ─── Extract real page data via regex heuristics ─── */
const BANNED_COMPANY_TOKENS = [
  "corsproxy", "allorigins", "codetabs", "cloudflare", "ddos-guard", "killbot",
  "google", "yandex", "nginx", "apache", "cdn", "proxy", "captcha", "akamai",
];
const BANNED_DESC_TOKENS = [
  "corsproxy", "allorigins", "codetabs", "cdn", "proxy service", "free cors",
  "bypass cors", "cloudflare ray", "ddos-guard", "is the world's leading",
];

function validatePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, "");
  // Russian: +7XXXXXXXXXX or 8XXXXXXXXXX (11 digits total)
  if (!/^(\+7|8)\d{10}$/.test(digits)) return null;
  return raw.trim();
}

function validateEmail(raw: string | null): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(e)) return null;
  // Reject CSS/JS/image asset paths
  if (/\.(css|js|mjs|png|jpe?g|svg|webp|gif|woff2?|ico|map)(\?|$)/i.test(e)) return null;
  // Reject hash-like prefixes (e.g. _@astro.fQOmH7rQ.css)
  if (/^_/.test(e) || /[A-Z]{4,}/.test(raw)) return null;
  return e;
}

function validateCompany(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.length < 2 || s.length > 100) return null;
  const lc = s.toLowerCase();
  if (BANNED_COMPANY_TOKENS.some(t => lc.includes(t))) return null;
  return s;
}

function validateDescription(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (s.length < 50 || s.length > 500) return null;
  const lc = s.toLowerCase();
  if (BANNED_DESC_TOKENS.some(t => lc.includes(t))) return null;
  return s;
}

/** Pull the homepage <h1> from existing HTML if present. */
function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/i);
  if (!m) return null;
  const txt = m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return txt.length >= 2 && txt.length <= 100 ? txt : null;
}

function extractPageData(html: string, content: string) {
  const text = (content || html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ");

  const phoneMatch = text.match(/(\+?[78][\s\-(]?\d{3}[\s\-)]?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2})/);
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const addressMatch = text.match(/(?:г\.\s?[А-ЯЁ][а-яё\-]+|город\s+[А-ЯЁ][а-яё\-]+)[^.]{0,150}(?:ул\.|улица|пр\.|проспект|пер\.|шоссе|наб\.)[^.]{0,80}\d{1,4}/i);
  const priceMatch = text.match(/(?:от\s+)?(\d[\d\s]{0,9})\s?(₽|руб\.?|rub)/i);

  const ogSite = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i);
  const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const titleClean = titleTag?.[1]?.split(/[|—\-–]/)[0]?.trim() || null;
  const h1 = extractH1(html);
  // Try to grab @type/name from any inline JSON-LD as Schema.org source
  let schemaName: string | null = null;
  const ldMatch = html.match(/"name"\s*:\s*"([^"]{2,80})"/);
  if (ldMatch) schemaName = ldMatch[1];

  // Confidence-ordered candidates: og:site_name → schema name → <title> → <h1>
  const companyCandidates: Array<["high" | "low", string | null]> = [
    ["high", ogSite?.[1] || null],
    ["high", schemaName],
    ["high", titleClean],
    ["low", h1],
  ];
  let companyName: string | null = null;
  let companyConfidence: "high" | "low" | "none" = "none";
  for (const [conf, val] of companyCandidates) {
    const v = validateCompany(val);
    if (v) { companyName = v; companyConfidence = conf; break; }
  }

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i);
  const description = validateDescription(descMatch?.[1] || null);

  const logoMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  const hoursMatch = text.match(/(?:режим работы|время работы|часы работы)[:\s]*([^.]{5,80})/i);
  const ratingMatch = text.match(/(?:рейтинг|оценка)[:\s]*(\d[.,]?\d?)/i);

  const phone = validatePhone(phoneMatch?.[0] || null);
  const email = validateEmail(emailMatch?.[0] || null);

  const confidence = {
    companyName: companyConfidence,
    phone: phone ? "low" : "none",      // phone always from text → low
    email: email ? "low" : "none",
    description: description ? "high" : "none", // from meta tag → high
    address: addressMatch ? "low" : "none",
    logo: logoMatch ? "high" : "none",
  };

  return {
    companyName,
    phone,
    email,
    address: addressMatch?.[0]?.trim() || null,
    priceRange: priceMatch ? `${priceMatch[1].replace(/\s/g, "")} ${priceMatch[2]}` : null,
    description,
    logo: logoMatch?.[1] || null,
    workingHours: hoursMatch?.[1]?.trim() || null,
    rating: ratingMatch?.[1] || null,
    confidence,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const url: string = (body?.url || "").trim();
    const projectId: string | null = body?.project_id || null;
    const manualHtml: string = typeof body?.manual_html === "string" ? body.manual_html : "";
    if (!url) {
      return new Response(JSON.stringify({ error: "URL is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check & deduct credits (2)
    const { data: profile } = await adminClient.from("profiles").select("credits").eq("user_id", user.id).maybeSingle();
    const credits = profile?.credits ?? 0;
    if (credits < 2) {
      return new Response(JSON.stringify({ error: "Недостаточно кредитов (нужно 2)" }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await adminClient.from("profiles").update({ credits: credits - 2 }).eq("user_id", user.id);

    // Create audit row
    const domain = getDomain(url);
    const { data: audit, error: insErr } = await adminClient.from("schema_audits").insert({
      user_id: user.id, project_id: projectId, url, domain, status: "analyzing",
    }).select("id").single();
    if (insErr || !audit) throw new Error(insErr?.message || "insert failed");
    const auditId = audit.id;

    // Run analysis
    try {
      let html = "";
      let content = "";
      let title = "";
      let botBlocked = false;

      if (manualHtml.trim().length > 0) {
        html = manualHtml;
        content = manualHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        const t = manualHtml.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = t ? t[1].trim() : "";
      } else {
        const fetched = await fetchHtml(url);
        html = fetched.html; content = fetched.content; title = fetched.title; botBlocked = fetched.botBlocked;
      }

      if (botBlocked || (!html && !content)) {
        const msg = botBlocked
          ? `Сайт ${getDomain(url)} защищён от парсинга (DDoS-Guard / Cloudflare / KillBot). Вставьте HTML страницы вручную или попробуйте другую страницу.`
          : "Не удалось загрузить страницу";
        await adminClient.from("schema_audits").update({
          status: "error",
          error_message: msg,
          ai_recommendations: { botBlocked: !!botBlocked },
        }).eq("id", auditId);
        // refund credits
        await adminClient.from("profiles").update({ credits }).eq("user_id", user.id);
        return new Response(JSON.stringify({
          error: msg,
          code: botBlocked ? "BOT_PROTECTED" : "FETCH_FAILED",
          domain: getDomain(url),
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const jsonLdItems = extractJsonLd(html);
      const microdata = extractMicrodata(html);
      const rdfa = extractRdfa(html);

      const validated: FoundSchema[] = jsonLdItems.map(it => validateSchema(it.data, it.line));
      for (const m of microdata) {
        validated.push({ type: m["@type"], format: "Microdata", raw: m, fields: [], severity: "ok" });
      }
      for (const r of rdfa) {
        validated.push({ type: r["@type"], format: "RDFa", raw: r, fields: [], severity: "ok" });
      }

      const issues = buildIssues(validated);
      const features = detectPageFeatures(html, content);
      const pageData = extractPageData(html, content);
      const pageType = detectPageType(url, content);
      // Fallback: ensure companyName exists even if not extracted
      if (!pageData.companyName) pageData.companyName = domainToCompanyName(url);
      const generated = buildGeneratedCode(url, validated, features, title, pageData);
      // Rich Results — count BOTH validated schemas + recommended ones we can add
      const RICH_TYPES = ["Product", "Article", "BlogPosting", "FAQPage", "BreadcrumbList", "LocalBusiness"];
      const richFromValidated = validated.filter(s => s.severity === "ok" && RICH_TYPES.includes(s.type)).length;
      const richFromGenerated = generated.filter(g => RICH_TYPES.includes(g.type)).length;
      const richEligible = richFromValidated + richFromGenerated;
      const score = calculateScore(validated, richEligible);

      const aiData = await getAiRecommendations(url, pageType, pageData, validated, content);

      // Merge AI recommendations into issues if present
      const aiIssues = Array.isArray(aiData?.issues) ? aiData.issues : (Array.isArray(aiData?.recommendations) ? aiData.recommendations : []);
      if (aiIssues.length) {
        for (const r of aiIssues) {
          if (r?.problem && !issues.find(i => i.problem === r.problem)) {
            issues.push({
              severity: r.severity || "info",
              schema: r.schema || "—",
              problem: r.problem,
              solution: r.solution || "",
              seoImpact: r.seoImpact,
            });
          }
        }
      }

      // Merge AI-generated schemas into generated code blocks (with real page data)
      if (Array.isArray(aiData?.missingSchemas)) {
        for (const ms of aiData.missingSchemas) {
          if (!ms?.generatedCode || !ms?.type) continue;
          if (generated.find(g => g.type === ms.type)) continue;
          const sourceLabel = ms.dataSource === "page"
            ? "✓ Данные взяты со страницы"
            : "⚠ Заполните вручную";
          generated.push({
            type: ms.type,
            label: `${ms.type} — ${ms.priority === "critical" ? "критично" : "рекомендуется"}`,
            reason: `${ms.reason || ""} • ${sourceLabel}`,
            code: JSON.stringify(ms.generatedCode, null, 2),
          });
        }
      }

      const errorsCount = issues.filter(i => i.severity === "critical").length;
      const finalScore = typeof aiData?.overallScore === "number" ? Math.round(aiData.overallScore) : score;

      await adminClient.from("schema_audits").update({
        status: "done",
        overall_score: finalScore,
        found_schemas_count: validated.length,
        errors_count: errorsCount,
        schemas_data: validated,
        issues,
        generated_code: generated,
        ai_recommendations: { ...aiData, pageData },
        page_type: pageType,
      }).eq("id", auditId);

      return new Response(JSON.stringify({ audit_id: auditId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e: any) {
      await adminClient.from("schema_audits").update({
        status: "error", error_message: e?.message || String(e),
      }).eq("id", auditId);
      // refund
      await adminClient.from("profiles").update({ credits }).eq("user_id", user.id);
      throw e;
    }
  } catch (e: any) {
    console.error("[schema-audit]", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});