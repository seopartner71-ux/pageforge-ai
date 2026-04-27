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
function buildGeneratedCode(url: string, schemas: FoundSchema[], features: ReturnType<typeof detectPageFeatures>, pageTitle: string) {
  const blocks: { type: string; label: string; code: string; reason: string }[] = [];
  const origin = (() => { try { return new URL(url).origin; } catch { return url; } })();

  // WebSite always
  if (!schemas.find(s => s.type === "WebSite")) {
    blocks.push({
      type: "WebSite",
      label: "WebSite — добавить",
      reason: "Базовая схема, рекомендуется на всех страницах",
      code: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        "name": pageTitle || getDomain(url),
        "url": origin,
      }, null, 2),
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

  if (features.hasAddress && !schemas.find(s => s.type === "LocalBusiness")) {
    blocks.push({
      type: "LocalBusiness",
      label: "LocalBusiness — добавить",
      reason: "На странице найден адрес и телефон",
      code: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: pageTitle || getDomain(url),
        address: { "@type": "PostalAddress", streetAddress: "ул. Примерная, 1", addressLocality: "Москва", addressCountry: "RU" },
        telephone: "+7 (000) 000-00-00",
      }, null, 2),
    });
  }

  return blocks;
}

/* ─── Score calculation ─── */
function calculateScore(schemas: FoundSchema[], richEligibleCount: number): number {
  const total = schemas.length;
  const critical = schemas.filter(s => s.severity === "critical").length;
  const valid = schemas.filter(s => s.severity === "ok").length;
  const part1 = Math.min(total * 10, 30);
  const part2 = total > 0 ? (valid / total) * 30 : 0;
  const part3 = critical === 0 ? 20 : 0;
  const part4 = Math.min(richEligibleCount * 5, 20);
  return Math.round(part1 + part2 + part3 + part4);
}

/* ─── AI recommendations ─── */
async function getAiRecommendations(url: string, schemas: FoundSchema[], pageContent: string): Promise<any> {
  if (!OPENROUTER_API_KEY) return {};
  const sys = "Ты эксперт по Schema.org и структурированным данным. Анализируй найденные схемы и содержимое страницы. Отвечай ТОЛЬКО на русском языке. Возвращай ТОЛЬКО валидный JSON без markdown.";
  const user = `Страница: ${url}
Найденные схемы: ${JSON.stringify(schemas.map(s => ({ type: s.type, format: s.format, severity: s.severity })))}
Контент страницы (первые 3000 символов): ${(pageContent || "").slice(0, 3000)}

Верни JSON:
{
  "recommendations": [{ "severity": "critical"|"warning"|"info", "schema": string, "problem": string, "solution": string, "seoImpact": string }],
  "richResultsEligibility": [{ "type": string, "eligible": boolean, "blockers": string[] }],
  "pageType": "product"|"article"|"local"|"homepage"|"other"
}`;
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

/* ─── Fetch HTML via Jina Reader (with fallback to direct fetch) ─── */
async function fetchHtml(url: string): Promise<{ html: string; content: string; title: string }> {
  // Try Jina for clean content
  let content = "";
  try {
    const jr = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "X-Return-Format": "text" },
    });
    if (jr.ok) content = await jr.text();
  } catch { /* ignore */ }

  let html = "";
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; SchemaAuditBot/1.0)" },
      redirect: "follow",
    });
    if (r.ok) html = await r.text();
  } catch { /* ignore */ }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";
  return { html, content: content || html, title };
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
      const { html, content, title } = await fetchHtml(url);
      if (!html && !content) throw new Error("Не удалось загрузить страницу");

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
      const generated = buildGeneratedCode(url, validated, features, title);
      const richEligible = validated.filter(s => s.severity === "ok" && ["Product", "Article", "BlogPosting", "FAQPage", "BreadcrumbList", "LocalBusiness"].includes(s.type)).length;
      const score = calculateScore(validated, richEligible);

      const aiData = await getAiRecommendations(url, validated, content);

      // Merge AI recommendations into issues if present
      if (Array.isArray(aiData?.recommendations)) {
        for (const r of aiData.recommendations) {
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

      const errorsCount = issues.filter(i => i.severity === "critical").length;

      await adminClient.from("schema_audits").update({
        status: "done",
        overall_score: score,
        found_schemas_count: validated.length,
        errors_count: errorsCount,
        schemas_data: validated,
        issues,
        generated_code: generated,
        ai_recommendations: aiData,
        page_type: aiData?.pageType || "other",
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