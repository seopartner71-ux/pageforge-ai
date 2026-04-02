import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Russian stop-words ───
const STOP_WORDS = new Set([
  "и","в","на","с","по","не","что","это","как","а","но","для","из","к","от","до","за","о","у",
  "же","бы","то","все","его","её","их","мы","вы","они","он","она","оно","так","уже","тоже",
  "только","ещё","при","во","со","без","или","ни","да","нет","был","была","были","будет",
  "было","быть","есть","мне","мной","себя","свой","свою","своё","которые","который","которая",
  "которое","где","когда","чем","кто","чтобы","если","ли","между","через","после","перед",
  "под","над","об","этот","эта","эти","этих","тот","та","те","тех","такой","такая","такие",
  "каждый","один","два","три","более","менее","очень","также","можно","нужно","может","должен",
  "the","a","an","is","are","was","were","be","been","being","have","has","had","do","does",
  "did","will","would","could","should","may","might","shall","can","to","of","in","for",
  "on","with","at","by","from","as","into","through","during","before","after","above","below",
  "between","out","off","over","under","again","further","then","once","here","there","when",
  "where","why","how","all","each","every","both","few","more","most","other","some","such",
  "no","nor","not","only","own","same","so","than","too","very","just","because","but","or",
  "and","if","while","about","up","it","its","this","that","these","those","i","me","my","we",
  "our","you","your","he","him","his","she","her","they","them","their","what","which","who",
]);

// ─── Text utilities ───
function tokenize(text: string): string[] {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function computeTfIdf(targetWords: string[], competitorWordArrays: string[][]) {
  const targetLen = targetWords.length || 1;
  const tf: Record<string, number> = {};
  for (const w of targetWords) tf[w] = (tf[w] || 0) + 1;
  for (const w in tf) tf[w] /= targetLen;

  // Median TF across competitors
  const compTfs: Record<string, number[]> = {};
  for (const words of competitorWordArrays) {
    const len = words.length || 1;
    const ctf: Record<string, number> = {};
    for (const w of words) ctf[w] = (ctf[w] || 0) + 1;
    for (const w in ctf) {
      ctf[w] /= len;
      if (!compTfs[w]) compTfs[w] = [];
      compTfs[w].push(ctf[w]);
    }
  }
  const median = (arr: number[]) => {
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const compMedian: Record<string, number> = {};
  for (const w in compTfs) compMedian[w] = median(compTfs[w]);

  // Merge all terms, pick top-30 by target frequency
  const allTerms = new Set([...Object.keys(tf), ...Object.keys(compMedian)]);
  const results: { term: string; page: number; competitors: number; status: string }[] = [];
  for (const term of allTerms) {
    const pageTf = tf[term] || 0;
    const compMed = compMedian[term] || 0;
    let status = "OK";
    if (pageTf > 0.03 && pageTf > compMed * 1.5) status = "SPAM";
    else if (pageTf < compMed * 0.5 && compMed > 0.001) status = "LOW";
    results.push({ term, page: pageTf, competitors: compMed, status });
  }
  results.sort((a, b) => (b.page + b.competitors) - (a.page + a.competitors));
  return results.slice(0, 30);
}

function computeZipf(words: string[]) {
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);
  return sorted.slice(0, 50).map(([word, count], i) => ({
    rank: i + 1,
    word,
    frequency: count,
    idealFrequency: Math.round(sorted[0][1] / (i + 1)),
  }));
}

function computeNgrams(words: string[], n: number) {
  const grams: Record<string, number> = {};
  for (let i = 0; i <= words.length - n; i++) {
    const gram = words.slice(i, i + n).join(" ");
    grams[gram] = (grams[gram] || 0) + 1;
  }
  return Object.entries(grams)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([text, count]) => ({ text, count }));
}

function technicalAudit(markdown: string) {
  const h1Matches = markdown.match(/^# .+$/gm) || [];
  const imgMatches = markdown.match(/!\[([^\]]*)\]\([^)]+\)/g) || [];
  const imgsWithoutAlt = imgMatches.filter(m => /!\[\s*\]/.test(m));
  const hasJsonLd = /application\/ld\+json/i.test(markdown) || /schema\.org/i.test(markdown);
  const hasOg = /og:title|og:description|og:image/i.test(markdown);

  return {
    h1Count: h1Matches.length,
    h1Text: h1Matches[0]?.replace(/^# /, "") || null,
    totalImages: imgMatches.length,
    imagesWithoutAlt: imgsWithoutAlt.length,
    hasJsonLd,
    hasOpenGraph: hasOg,
    issues: [
      ...(h1Matches.length === 0 ? ["Отсутствует H1"] : []),
      ...(h1Matches.length > 1 ? [`Найдено ${h1Matches.length} тегов H1 (должен быть 1)`] : []),
      ...(imgsWithoutAlt.length > 0 ? [`${imgsWithoutAlt.length} изображений без alt-атрибута`] : []),
      ...(!hasJsonLd ? ["Отсутствует JSON-LD разметка"] : []),
      ...(!hasOg ? ["Отсутствуют OpenGraph теги"] : []),
    ],
  };
}

// ─── Fetch content via Jina Reader ───
async function fetchPageContent(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/markdown", "X-Return-Format": "markdown" },
    });
    if (!res.ok) return "";
    const text = await res.text();
    return text.slice(0, 50000); // limit
  } catch {
    return "";
  }
}

// ─── Find competitors via Serper.dev ───
async function findCompetitors(keyword: string, apiKey: string): Promise<string[]> {
  try {
    const res = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: keyword, num: 10 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.organic || []).map((r: any) => r.link).filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getUser(token);
    if (claimsError || !claimsData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { url, pageType, competitors: manualCompetitors, aiContext, analysisId } = await req.json();

    if (!url || !analysisId) {
      return new Response(JSON.stringify({ error: "url and analysisId are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: Update status ──
    await supabase.from("analyses").update({ status: "running" }).eq("id", analysisId);

    const moduleStatuses: any[] = [];
    const addModule = (name: string, time: string, done: boolean) => {
      moduleStatuses.push({ name, time, done });
    };

    // ── Step 2: Fetch target page content via Jina ──
    console.log("Fetching target page:", url);
    const startJina = Date.now();
    const targetContent = await fetchPageContent(url);
    addModule("URL Parser & Content Fetch", `${((Date.now() - startJina) / 1000).toFixed(1)}s`, !!targetContent);

    if (!targetContent) {
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "Failed to fetch page content" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 3: Find / fetch competitors ──
    let competitorUrls: string[] = (manualCompetitors || []).filter((c: string) => c.trim());
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");

    if (competitorUrls.length === 0 && SERPER_API_KEY) {
      // Extract keyword from first heading or first line
      const titleMatch = targetContent.match(/^#\s+(.+)$/m);
      const keyword = titleMatch?.[1]?.slice(0, 100) || url;
      console.log("Finding competitors for keyword:", keyword);
      const startSerper = Date.now();
      competitorUrls = await findCompetitors(keyword, SERPER_API_KEY);
      // Filter out the target URL itself
      competitorUrls = competitorUrls.filter(u => !u.includes(new URL(url).hostname));
      addModule("Competitor Discovery (Serper)", `${((Date.now() - startSerper) / 1000).toFixed(1)}s`, competitorUrls.length > 0);
    } else {
      addModule("Competitor Discovery", "0.1s", competitorUrls.length > 0);
    }

    // Fetch competitor content (parallel, max 5)
    const startCompFetch = Date.now();
    const competitorContents: string[] = [];
    const fetchUrls = competitorUrls.slice(0, 5);
    console.log(`Fetching ${fetchUrls.length} competitor pages...`);
    const compResults = await Promise.allSettled(fetchUrls.map(u => fetchPageContent(u)));
    for (const r of compResults) {
      if (r.status === "fulfilled" && r.value) competitorContents.push(r.value);
    }
    addModule("Competitor Content Fetch", `${((Date.now() - startCompFetch) / 1000).toFixed(1)}s`, competitorContents.length > 0);

    // ── Step 4: Linguistic analysis ──
    const startLing = Date.now();
    const targetWords = tokenize(targetContent);
    const competitorWordArrays = competitorContents.map(c => tokenize(c));

    const tfidfResults = computeTfIdf(targetWords, competitorWordArrays);
    const zipfData = computeZipf(targetWords);
    const bigrams = computeNgrams(targetWords, 2);
    const trigrams = computeNgrams(targetWords, 3);
    const audit = technicalAudit(targetContent);
    addModule("Linguistic Analysis (TF-IDF, Zipf, N-grams)", `${((Date.now() - startLing) / 1000).toFixed(1)}s`, true);
    addModule("Technical Audit", "0.2s", true);

    // ── Step 5: AI Analysis via OpenRouter ──
    const startAi = Date.now();

    const topTerms = tfidfResults.slice(0, 15).map(t => `${t.term} (page:${(t.page*100).toFixed(1)}% comp:${(t.competitors*100).toFixed(1)}% ${t.status})`).join(", ");

    const systemPrompt = `Ты — Senior SEO & AIO Analyst. Тебе даны:
1. Markdown контент анализируемой страницы (обрезан до 15000 символов).
2. Топ-термины TF-IDF (сравнение с конкурентами).
3. Технический аудит.
4. Контекст от пользователя.

Выполни анализ и верни JSON:
{
  "scores": {
    "seoHealth": <0-100>,
    "llmFriendly": <0-100>,
    "humanTouch": <0-100>,
    "sgeAdapt": <0-100>
  },
  "quickWins": [{"text": "<конкретная рекомендация>"}],
  "aiReport": {
    "summary": "<2-3 абзаца общей оценки>",
    "strengths": ["<сила1>"],
    "weaknesses": ["<слабость1>"],
    "recommendations": ["<рек1>"],
    "missingEntities": ["<сущность, которой не хватает на странице>"],
    "geoScore": <0-100>,
    "sgeReadiness": "<оценка готовности к AI Overviews>"
  },
  "priorities": [
    {"task": "<задача>", "impact": <1-10>, "effort": <1-10>, "category": "<Technical|Content|Links>"}
  ],
  "blueprint": {
    "h1": "<рекомендуемый H1>",
    "metaTitle": "<рекомендуемый title>",
    "metaDescription": "<рекомендуемый meta description>",
    "sections": [
      {"tag": "h2", "text": "<заголовок>", "wordCount": <число>}
    ],
    "requiredBlocks": ["FAQ", "Отзывы", "Цены"]
  }
}

Будь конкретен: приводи примеры, цифры, названия сущностей. Пиши на русском.`;

    const userPrompt = `URL: ${url}
Тип страницы: ${pageType || "не указан"}
${aiContext ? `Контекст: ${aiContext}` : ""}

─── Контент страницы (первые 15000 символов) ───
${targetContent.slice(0, 15000)}

─── TF-IDF топ-термины ───
${topTerms}

─── Технический аудит ───
H1: ${audit.h1Count} шт. ${audit.h1Text ? `("${audit.h1Text}")` : ""}
Картинки: ${audit.totalImages} всего, ${audit.imagesWithoutAlt} без alt
JSON-LD: ${audit.hasJsonLd ? "Да" : "Нет"}
OpenGraph: ${audit.hasOpenGraph ? "Да" : "Нет"}
Проблемы: ${audit.issues.join("; ") || "нет"}

Конкуренты проанализировано: ${competitorContents.length}
${competitorUrls.length > 0 ? `URL конкурентов: ${competitorUrls.slice(0, 5).join(", ")}` : "Конкуренты не найдены"}`;

    console.log("Calling OpenRouter for AI analysis...");
    const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
      }),
    });

    let aiParsed: any = {};
    if (aiRes.ok) {
      const aiJson = await aiRes.json();
      const content = aiJson.choices?.[0]?.message?.content;
      if (content) {
        try { aiParsed = JSON.parse(content); } catch { console.error("Failed to parse AI JSON"); }
      }
    } else {
      console.error("OpenRouter error:", aiRes.status, await aiRes.text());
    }
    addModule("AI Analytics (GPT-4o)", `${((Date.now() - startAi) / 1000).toFixed(1)}s`, !!aiParsed.scores);

    // ── Step 6: Assemble and save results ──
    const finalResult = {
      scores: aiParsed.scores || { seoHealth: 50, llmFriendly: 50, humanTouch: 50, sgeAdapt: 50 },
      quick_wins: aiParsed.quickWins || [],
      tab_data: {
        aiReport: aiParsed.aiReport || {},
        priorities: aiParsed.priorities || [],
        blueprint: aiParsed.blueprint || {},
        tfidf: tfidfResults,
        ngrams: { bigrams, trigrams },
        zipf: zipfData,
        technicalAudit: audit,
        competitorUrls: competitorUrls.slice(0, 5),
      },
      modules: moduleStatuses,
    };

    const { error: insertError } = await supabase.from("analysis_results").insert({
      analysis_id: analysisId,
      scores: finalResult.scores,
      quick_wins: finalResult.quick_wins,
      tab_data: finalResult.tab_data,
      modules: finalResult.modules,
    });

    if (insertError) {
      console.error("Failed to save results:", insertError);
      await supabase.from("analyses").update({ status: "failed" }).eq("id", analysisId);
      return new Response(JSON.stringify({ error: "Failed to save results" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("analyses").update({ status: "completed" }).eq("id", analysisId);
    console.log("Analysis completed for:", url);

    return new Response(JSON.stringify({ success: true, data: finalResult }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-analyze error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
