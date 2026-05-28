// GEO Radar: scans a single keyword or prompt across 7 AI models via OpenRouter.
// Detects brand/domain mentions, sentiment, and competitor domains, then inserts
// one row per model into radar_results.
//
// Body: { keyword_id?: string, prompt_id?: string, project_id: string, run_id?: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ModelCfg { key: string; openrouter: string; }

const MODELS: ModelCfg[] = [
  { key: "gemini_flash", openrouter: "google/gemini-2.5-flash" },
  { key: "chatgpt",      openrouter: "openai/gpt-4o-mini" },
  { key: "perplexity",   openrouter: "perplexity/sonar" },
  { key: "claude",       openrouter: "anthropic/claude-3.5-haiku" },
  { key: "deepseek",     openrouter: "deepseek/deepseek-chat" },
  { key: "mistral",      openrouter: "mistralai/mistral-small-3.2-24b-instruct" },
  { key: "llama",        openrouter: "meta-llama/llama-3.3-70b-instruct" },
];

function normalizeDomain(d: string): string {
  return (d || "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").trim();
}

function isBrandedQuery(query: string, brand: string, domainBase: string): boolean {
  const q = (query || "").toLowerCase();
  const b = (brand || "").toLowerCase().trim();
  const db = (domainBase || "").toLowerCase().trim();
  if (b && b.length >= 3 && q.includes(b)) return true;
  if (db && db.length >= 3 && q.includes(db)) return true;
  return false;
}

function extractDomains(text: string): string[] {
  const re = /\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s)]*)?/gi;
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const d = m[1].toLowerCase().replace(/^www\./, "");
    if (d.length > 4 && !d.endsWith(".md") && !d.endsWith(".txt")) out.add(d);
  }
  return [...out];
}

function findSnippets(text: string, term: string, maxCount = 3, ctx = 90): string[] {
  if (!term || term.length < 2) return [];
  const lc = text.toLowerCase();
  const lt = term.toLowerCase();
  const out: string[] = [];
  let from = 0;
  while (out.length < maxCount) {
    const i = lc.indexOf(lt, from);
    if (i < 0) break;
    const s = Math.max(0, i - ctx);
    const e = Math.min(text.length, i + lt.length + ctx);
    out.push((s > 0 ? "…" : "") + text.slice(s, e).trim() + (e < text.length ? "…" : ""));
    from = i + lt.length;
  }
  return out;
}

function detectSentiment(text: string, brand: string): "positive" | "neutral" | "negative" {
  if (!brand) return "neutral";
  const lc = text.toLowerCase();
  const i = lc.indexOf(brand.toLowerCase());
  if (i < 0) return "neutral";
  const window = lc.slice(Math.max(0, i - 120), Math.min(lc.length, i + brand.length + 120));
  const pos = /(лучш|рекоменд|надежн|качествен|популярн|выбор|лидер|премиум|отличн|плюс|преимущ|recommend|best|top|leading|excellent|popular|trusted|premium|quality)/i;
  const neg = /(плох|худш|избегай|пробле[мы]|жалоб|мошенн|обман|недостат|минус|разочаров|avoid|worst|scam|complaint|issue|problem|bad|poor)/i;
  const hasPos = pos.test(window);
  const hasNeg = neg.test(window);
  if (hasPos && !hasNeg) return "positive";
  if (hasNeg && !hasPos) return "negative";
  return "neutral";
}

async function queryOpenRouter(apiKey: string, model: string, prompt: string, lang: string, timeoutMs = 45_000): Promise<string> {
  const sys = lang === "ru"
    ? "Ты эксперт-консультант. Дай развёрнутый, полезный ответ на запрос пользователя. Если уместно — назови конкретные бренды, компании и сайты с доменами."
    : "You are an expert consultant. Give a thorough, useful answer to the user's query. When relevant, name specific brands, companies and websites with their domains.";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 900,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) {
      const txt = await r.text().catch(() => "");
      throw new Error(`OpenRouter ${model} HTTP ${r.status}: ${txt.slice(0, 200)}`);
    }
    const j = await r.json();
    return (j?.choices?.[0]?.message?.content as string) || "";
  } finally {
    clearTimeout(t);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const json = (b: unknown, status = 200) =>
    new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) return json({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const { keyword_id, prompt_id, project_id, run_id } = body as {
      keyword_id?: string; prompt_id?: string; project_id?: string; run_id?: string;
    };
    if (!project_id) return json({ error: "project_id required" }, 400);
    if (!keyword_id && !prompt_id) return json({ error: "keyword_id or prompt_id required" }, 400);

    const { data: project } = await admin
      .from("radar_projects")
      .select("id, user_id, brand_name, domain, language")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return json({ error: "Project not found" }, 404);
    if (project.user_id !== userId) return json({ error: "Forbidden" }, 403);

    const brand: string = (project.brand_name || "").trim();
    const domain: string = normalizeDomain(project.domain || "");
    const domainBase = domain.replace(/\.[a-z]{2,}$/, "");
    const lang: string = project.language === "en" ? "en" : "ru";

    let queryText = "";
    let originalKeyword = "";
    if (keyword_id) {
      const { data: kw } = await admin
        .from("radar_keywords").select("keyword, project_id")
        .eq("id", keyword_id).maybeSingle();
      if (!kw || kw.project_id !== project_id) return json({ error: "Keyword not found" }, 404);
      originalKeyword = kw.keyword || "";
      queryText = lang === "ru"
        ? `Назови лучшие компании и сервисы по запросу: ${kw.keyword}. Перечисли названия и сайты.`
        : `Name the best companies and services for query: ${kw.keyword}. List names and websites.`;
    } else if (prompt_id) {
      const { data: pr } = await admin
        .from("radar_prompts").select("text, project_id")
        .eq("id", prompt_id).maybeSingle();
      if (!pr || pr.project_id !== project_id) return json({ error: "Prompt not found" }, 404);
      queryText = pr.text || "";
      originalKeyword = queryText;
    }
    if (!queryText) return json({ error: "Empty prompt" }, 400);

    const branded = isBrandedQuery(originalKeyword, brand, domainBase);

    // Resolve OpenRouter key (system_settings first, env fallback)
    let openrouterKey: string | null = null;
    try {
      const { data: kRow } = await admin
        .from("system_settings").select("key_value")
        .eq("key_name", "OPENROUTER_API_KEY").maybeSingle();
      openrouterKey = kRow?.key_value ?? null;
    } catch { /* ignore */ }
    openrouterKey = openrouterKey || Deno.env.get("OPENROUTER_API_KEY") || null;
    if (!openrouterKey) return json({ error: "OpenRouter API key not configured" }, 500);

    const tasks = MODELS.map(async (m) => {
      const baseRow: Record<string, unknown> = {
        user_id: userId,
        model: m.key,
        run_id: run_id ?? null,
        checked_at: new Date().toISOString(),
        is_branded_query: branded,
      };
      if (keyword_id) baseRow.keyword_id = keyword_id;
      if (prompt_id) baseRow.prompt_id = prompt_id;

      try {
        const perModelTimeout = m.key === "llama" ? 90_000 : 45_000;
        const text = await queryOpenRouter(openrouterKey!, m.openrouter, queryText, lang, perModelTimeout);
        const lc = text.toLowerCase();
        const brandFound = !!brand && lc.includes(brand.toLowerCase());
        const domainFound = !!domain && (lc.includes(domain) || (domainBase.length >= 3 && lc.includes(domainBase)));
        const allDomains = extractDomains(text);
        const competitors = allDomains.filter((d) => d !== domain && !d.endsWith("." + domain));
        const snippets = [
          ...findSnippets(text, brand, 2),
          ...findSnippets(text, domain, 2),
        ].slice(0, 3);
        const sentiment = detectSentiment(text, brand);
        const isVisible = branded ? domainFound : brandFound;

        return {
          ...baseRow,
          status: isVisible ? "captured" : "displaced",
          ai_response_text: text.slice(0, 8000),
          brand_mentioned: brandFound,
          is_brand_found: brandFound,
          domain_linked: domainFound,
          competitor_domains: competitors.slice(0, 20),
          matched_snippets: snippets,
          sentiment,
          sources: [],
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[radar-check] ${m.key} failed:`, msg);
        return {
          ...baseRow,
          status: "displaced",
          ai_response_text: `Error: ${msg.slice(0, 500)}`,
          brand_mentioned: false,
          is_brand_found: false,
          domain_linked: false,
          competitor_domains: [],
          matched_snippets: [],
          sentiment: "neutral",
          sources: [],
        };
      }
    });

    const rows = await Promise.all(tasks);
    const { error: insErr } = await admin.from("radar_results").insert(rows as any);
    if (insErr) {
      console.error("[radar-check] insert error:", insErr);
      return json({ error: `Insert failed: ${insErr.message}` }, 500);
    }

    if (keyword_id) {
      await admin.from("radar_keywords")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", keyword_id);
    }

    if (run_id) {
      const { data: runRow } = await admin
        .from("radar_analysis_runs").select("completed_prompts").eq("id", run_id).maybeSingle();
      const done = (runRow?.completed_prompts ?? 0) + MODELS.length;
      await admin.from("radar_analysis_runs")
        .update({ completed_prompts: done, current_prompt_text: queryText.slice(0, 200) })
        .eq("id", run_id);
    }

    return json({
      ok: true,
      inserted: rows.length,
      brand_mentioned_count: rows.filter((r: any) => r.brand_mentioned).length,
    });
  } catch (e) {
    console.error("[radar-check] fatal:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});