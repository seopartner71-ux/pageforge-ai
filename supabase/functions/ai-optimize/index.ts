import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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
    const { data: ud, error: ue } = await supabase.auth.getUser(token);
    if (ue || !ud?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { analysisId } = await req.json();
    if (!analysisId) {
      return new Response(JSON.stringify({ error: "analysisId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: analysis } = await supabase
      .from("analyses")
      .select("id, url, user_id")
      .eq("id", analysisId)
      .single();

    if (!analysis || analysis.user_id !== ud.user.id) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get analysis results
    const { data: result } = await supabase
      .from("analysis_results")
      .select("tab_data, scores")
      .eq("analysis_id", analysisId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!result) {
      return new Response(JSON.stringify({ error: "No analysis results found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tabData = result.tab_data as any;
    const tfidf = tabData?.tfidf || [];
    const ngrams = tabData?.ngrams || {};
    const blueprint = tabData?.blueprint || {};
    const aiReport = tabData?.aiReport || {};

    // Extract missing and spam terms
    const missingTerms = tfidf
      .filter((t: any) => t.status === "Missing")
      .map((t: any) => t.term);
    const spamTerms = tfidf
      .filter((t: any) => t.status === "Spam" || t.status === "Overoptimized")
      .map((t: any) => ({ term: t.term, density: t.density }));
    const missingEntities = aiReport?.missingEntities || [];
    const bigramGaps = ngrams?.bigramGaps?.map((g: any) => g.text) || [];
    const trigramGaps = ngrams?.trigramGaps?.map((g: any) => g.text) || [];

    // Fetch current page content via Jina — extract only meaningful body text
    let pageContent = "";
    try {
      const jinaRes = await fetch(`https://r.jina.ai/${analysis.url}`, {
        headers: { Accept: "text/markdown", "X-Return-Format": "markdown" },
      });
      if (jinaRes.ok) {
        let raw = (await jinaRes.text()).slice(0, 20000);
        // Strip navigation links, menus, and markdown link clutter
        raw = raw.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // [text](url) → text
        raw = raw.replace(/!\[[^\]]*\]\([^)]+\)/g, ''); // remove images
        raw = raw.replace(/^[\s*\-•]+\s*(Главная|Меню|Навигация|О нас|Контакты|Услуги|Новости).*/gmi, ''); // nav items
        pageContent = raw.trim();
      }
    } catch {}

    if (!pageContent) {
      return new Response(JSON.stringify({ error: "Failed to fetch page content" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Ты — SEO-оптимизатор текстов. Твоя задача — переписать ТОЛЬКО основной контент страницы (без навигации, ссылок, меню).

Правила:
1. **Добавь Missing Entities** — органично вплети слова, которых не хватает.
2. **Снизь переспам** — замени лишние повторы синонимами.
3. **Закрой Topical Gaps** — включи фразы конкурентов, которых нет у пользователя.
4. **Сохрани структуру** — заголовки H1-H3, параграфы, списки. Только улучши текст.
5. **Пиши на том же языке**, что и оригинал.

ОБЯЗАТЕЛЬНО верни JSON с тремя полями:
{
  "optimizedText": "<чистый оптимизированный текст в Markdown, без навигационных элементов, только полезный контент>",
  "changes": [
    {"type": "added", "term": "<слово>", "context": "<краткое где добавлено>"},
    {"type": "reduced", "term": "<слово>", "from": <было>, "to": <стало>},
    {"type": "topicalGap", "phrase": "<фраза>", "context": "<где добавлено>"}
  ],
  "summary": "<2-3 предложения: что именно изменено и почему>"
}
Поле changes ОБЯЗАТЕЛЬНО должно содержать минимум 3 элемента.`;

    const userPrompt = `URL: ${analysis.url}

─── Текущий текст страницы ───
${pageContent}

─── Missing Entities (TF-IDF) ───
${missingTerms.join(", ") || "нет"}

─── Missing Entities (AI/LSI) ───
${missingEntities.join(", ") || "нет"}

─── Переспам (снизить плотность) ───
${spamTerms.map((s: any) => `"${s.term}" (density: ${s.density.toFixed(2)}%)`).join(", ") || "нет"}

─── Topical Gaps (биграммы/триграммы конкурентов, отсутствующие у вас) ───
${[...bigramGaps, ...trigramGaps].join(", ") || "нет"}

─── Рекомендуемая структура (Blueprint) ───
H1: ${blueprint.h1 || "—"}
Sections: ${blueprint.sections?.map((s: any) => `${s.tag}: ${s.text}`).join(" | ") || "—"}`;

    console.log("AI Optimize: calling OpenRouter...");
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
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("OpenRouter error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI optimization failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content;
    let parsed: any = {};
    if (content) {
      try { parsed = JSON.parse(content); } catch { parsed = { optimizedText: content, changes: [], summary: "" }; }
    }

    console.log("AI Optimize: done, changes:", parsed.changes?.length || 0);

    return new Response(JSON.stringify({
      success: true,
      optimizedText: parsed.optimizedText || "",
      changes: parsed.changes || [],
      summary: parsed.summary || "",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-optimize error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
