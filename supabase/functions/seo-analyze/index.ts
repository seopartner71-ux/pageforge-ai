import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Russian + English stop-words ───
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

// ─── TF-IDF with proper IDF calculation ───
function calculateTFIDF(
  targetWords: string[],
  competitorWordArrays: string[][]
) {
  const totalDocs = competitorWordArrays.length; // number of competitor documents
  if (totalDocs === 0) {
    // No competitors — return simple TF
    const targetLen = targetWords.length || 1;
    const tf: Record<string, number> = {};
    for (const w of targetWords) tf[w] = (tf[w] || 0) + 1;
    return Object.entries(tf)
      .map(([term, count]) => ({
        term,
        tf: count / targetLen,
        idf: 1,
        tfidf: count / targetLen,
        competitorMedianTfidf: 0,
        status: "OK" as const,
      }))
      .sort((a, b) => b.tfidf - a.tfidf)
      .slice(0, 30);
  }

  // Step 1: Calculate TF for the target page
  const targetLen = targetWords.length || 1;
  const targetTfRaw: Record<string, number> = {};
  for (const w of targetWords) targetTfRaw[w] = (targetTfRaw[w] || 0) + 1;
  const targetTf: Record<string, number> = {};
  for (const w in targetTfRaw) targetTf[w] = targetTfRaw[w] / targetLen;

  // Step 2: Calculate TF for each competitor
  const compTfs: Record<string, number>[] = competitorWordArrays.map(words => {
    const len = words.length || 1;
    const tf: Record<string, number> = {};
    for (const w of words) tf[w] = (tf[w] || 0) + 1;
    for (const w in tf) tf[w] /= len;
    return tf;
  });

  // Step 3: Collect all unique terms from target + competitors
  const allTerms = new Set<string>();
  for (const w of Object.keys(targetTf)) allTerms.add(w);
  for (const ctf of compTfs) for (const w of Object.keys(ctf)) allTerms.add(w);

  // Step 4: Calculate IDF — log(totalDocs / docsContainingTerm)
  // Use totalDocs+1 as corpus (competitors + the target page conceptually)
  const docFrequency: Record<string, number> = {};
  for (const term of allTerms) {
    let count = 0;
    for (const ctf of compTfs) {
      if (ctf[term]) count++;
    }
    docFrequency[term] = count;
  }

  // Step 5: Compute TF-IDF scores for target and median for competitors
  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const s = arr.slice().sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  const results: {
    term: string;
    tf: number;
    idf: number;
    tfidf: number;
    competitorMedianTfidf: number;
    status: "Missing" | "OK" | "Overoptimized";
    density: number;
  }[] = [];

  for (const term of allTerms) {
    const df = docFrequency[term] || 0;
    // IDF = log(totalDocs / (df + 1)) + 1 — smoothed to avoid division by zero
    const idf = Math.log((totalDocs + 1) / (df + 1)) + 1;

    const userTf = targetTf[term] || 0;
    const userTfidf = userTf * idf;

    // Competitor TF-IDF scores
    const compScores = compTfs.map(ctf => (ctf[term] || 0) * idf);
    const compMedian = median(compScores);

    // Determine status
    let status: "Missing" | "OK" | "Overoptimized" = "OK";
    if (userTf === 0 && compMedian > 0.0005) {
      status = "Missing";
    } else if (compMedian > 0 && userTfidf > compMedian * 1.3) {
      status = "Overoptimized";
    } else if (userTf === 0 && df >= Math.floor(totalDocs * 0.5)) {
      // Term appears in majority of competitors but not on target
      status = "Missing";
    }

    // Density as percentage
    const density = userTf * 100;

    results.push({
      term,
      tf: userTf,
      idf,
      tfidf: userTfidf,
      competitorMedianTfidf: compMedian,
      status,
      density,
    });
  }

  // Sort: Missing entities first (by competitor median desc), then by combined score
  results.sort((a, b) => {
    if (a.status === "Missing" && b.status !== "Missing") return -1;
    if (b.status === "Missing" && a.status !== "Missing") return 1;
    return (b.tfidf + b.competitorMedianTfidf) - (a.tfidf + a.competitorMedianTfidf);
  });

  return results.slice(0, 40);
}

// ─── Zipf's Law with ideal curve ───
function calculateZipf(words: string[]) {
  const freq: Record<string, number> = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return [];

  const maxFreq = sorted[0][1]; // C = frequency of the most common word

  return sorted.slice(0, 50).map(([word, count], i) => {
    const rank = i + 1;
    const idealFrequency = Math.round(maxFreq / rank); // P(r) = C / r
    const deviation = idealFrequency > 0
      ? ((count - idealFrequency) / idealFrequency * 100)
      : 0;

    return {
      rank,
      word,
      frequency: count,
      idealFrequency,
      deviation: Math.round(deviation), // % deviation from ideal
      isSpam: count > idealFrequency * 1.5 && rank > 3, // spike above ideal = suspicious
    };
  });
}

// ─── N-grams with sliding window ───
function extractNgrams(words: string[], n: number) {
  const grams: Record<string, number> = {};
  for (let i = 0; i <= words.length - n; i++) {
    const window = words.slice(i, i + n);
    // Skip if any word in the gram is a stop word (already filtered, but double-check length)
    if (window.some(w => w.length <= 2)) continue;
    const gram = window.join(" ");
    grams[gram] = (grams[gram] || 0) + 1;
  }
  return Object.entries(grams)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([text, count]) => ({ text, count }));
}

// ─── N-gram comparison with competitors (Topical Gap) ───
function compareNgrams(
  targetWords: string[],
  competitorWordArrays: string[][],
  n: number
) {
  // Get target n-grams
  const targetGrams: Record<string, number> = {};
  for (let i = 0; i <= targetWords.length - n; i++) {
    const gram = targetWords.slice(i, i + n).join(" ");
    targetGrams[gram] = (targetGrams[gram] || 0) + 1;
  }

  // Get competitor n-grams and count how many competitors have each
  const compGramCounts: Record<string, number> = {};
  const compGramFreqs: Record<string, number[]> = {};
  for (const words of competitorWordArrays) {
    const seen = new Set<string>();
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(" ");
      if (!seen.has(gram)) {
        compGramCounts[gram] = (compGramCounts[gram] || 0) + 1;
        seen.add(gram);
      }
      if (!compGramFreqs[gram]) compGramFreqs[gram] = [];
    }
    // Count frequencies per competitor
    const freqMap: Record<string, number> = {};
    for (let i = 0; i <= words.length - n; i++) {
      const gram = words.slice(i, i + n).join(" ");
      freqMap[gram] = (freqMap[gram] || 0) + 1;
    }
    for (const [gram, freq] of Object.entries(freqMap)) {
      if (!compGramFreqs[gram]) compGramFreqs[gram] = [];
      compGramFreqs[gram].push(freq);
    }
  }

  // Find topical gaps: n-grams common in competitors but missing from target
  const gaps: { text: string; competitorCount: number; avgFreq: number }[] = [];
  for (const [gram, count] of Object.entries(compGramCounts)) {
    if (count >= 2 && !targetGrams[gram]) {
      const freqs = compGramFreqs[gram] || [];
      const avg = freqs.reduce((s, v) => s + v, 0) / (freqs.length || 1);
      gaps.push({ text: gram, competitorCount: count, avgFreq: Math.round(avg * 10) / 10 });
    }
  }
  gaps.sort((a, b) => b.competitorCount - a.competitorCount || b.avgFreq - a.avgFreq);

  return gaps.slice(0, 15);
}

// ─── Technical Audit ───
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
    return text.slice(0, 50000);
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
      const titleMatch = targetContent.match(/^#\s+(.+)$/m);
      const keyword = titleMatch?.[1]?.slice(0, 100) || url;
      console.log("Finding competitors for keyword:", keyword);
      const startSerper = Date.now();
      competitorUrls = await findCompetitors(keyword, SERPER_API_KEY);
      competitorUrls = competitorUrls.filter(u => {
        try { return !u.includes(new URL(url).hostname); } catch { return true; }
      });
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

    // TF-IDF with proper IDF
    const tfidfResults = calculateTFIDF(targetWords, competitorWordArrays);

    // Zipf's Law with ideal curve
    const zipfData = calculateZipf(targetWords);

    // N-grams with sliding window
    const bigrams = extractNgrams(targetWords, 2);
    const trigrams = extractNgrams(targetWords, 3);

    // Topical gaps from n-gram comparison
    const bigramGaps = compareNgrams(targetWords, competitorWordArrays, 2);
    const trigramGaps = compareNgrams(targetWords, competitorWordArrays, 3);

    // Technical audit
    const audit = technicalAudit(targetContent);

    addModule("TF-IDF Analysis", `${((Date.now() - startLing) / 1000).toFixed(1)}s`, true);
    addModule("Zipf's Law", "0.1s", true);
    addModule("N-gram Extraction", "0.1s", true);
    addModule("Technical Audit", "0.1s", true);

    // ── Step 5: AI Analysis via OpenRouter ──
    const startAi = Date.now();

    const missingTerms = tfidfResults
      .filter(t => t.status === "Missing")
      .slice(0, 15)
      .map(t => `${t.term} (IDF:${t.idf.toFixed(2)}, comp_median:${(t.competitorMedianTfidf * 1000).toFixed(1)})`)
      .join(", ");

    const overoptTerms = tfidfResults
      .filter(t => t.status === "Overoptimized")
      .slice(0, 10)
      .map(t => `${t.term} (density:${t.density.toFixed(2)}%, comp:${(t.competitorMedianTfidf * 1000).toFixed(1)})`)
      .join(", ");

    const topTerms = tfidfResults
      .filter(t => t.status === "OK")
      .slice(0, 10)
      .map(t => `${t.term} (${t.density.toFixed(2)}%)`)
      .join(", ");

    const systemPrompt = `Ты — Senior SEO & AIO Analyst. Тебе даны:
1. Markdown контент анализируемой страницы.
2. Результаты TF-IDF анализа (Missing entities, Overoptimized, OK terms).
3. Тематические пробелы (N-gram gaps vs конкуренты).
4. Технический аудит.

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

─── TF-IDF: Missing Entities (отсутствуют на странице, есть у конкурентов) ───
${missingTerms || "нет"}

─── TF-IDF: Overoptimized (переспам) ───
${overoptTerms || "нет"}

─── TF-IDF: OK Terms ───
${topTerms || "нет"}

─── Тематические пробелы (N-gram gaps vs конкуренты) ───
Биграммы: ${bigramGaps.slice(0, 10).map(g => `"${g.text}" (у ${g.competitorCount} конк.)`).join(", ") || "нет"}
Триграммы: ${trigramGaps.slice(0, 10).map(g => `"${g.text}" (у ${g.competitorCount} конк.)`).join(", ") || "нет"}

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
        ngrams: {
          bigrams,
          trigrams,
          bigramGaps,
          trigramGaps,
        },
        zipf: zipfData,
        technicalAudit: audit,
        competitorUrls: competitorUrls.slice(0, 5),
        competitorCount: competitorContents.length,
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
