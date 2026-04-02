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

    const { analysisId, generateTable, currentText } = await req.json();
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

    // Fetch API keys from system_settings (admin panel), fallback to env vars
    const { data: settingsData } = await supabase.from("system_settings").select("key_name, key_value");
    const dbKeys: Record<string, string> = {};
    for (const s of settingsData || []) { if (s.key_value) dbKeys[s.key_name] = s.key_value; }

    const OPENROUTER_API_KEY = dbKeys["openai_api_key"] || Deno.env.get("OPENROUTER_API_KEY");
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Ты — Expert SEO Editor. Твоя задача — УЛУЧШИТЬ существующий текст пользователя, а НЕ писать новый с нуля.

ГЛАВНОЕ ПРАВИЛО: Ты РЕДАКТОР, а не автор. Оригинальный текст — это основа. Ты должен сохранить его суть, факты и стиль бренда.

СТРОГИЕ ОГРАНИЧЕНИЯ:
1. **Сохраняй ВСЕ бизнес-данные**: название компании, адреса, телефоны, РЕАЛЬНЫЕ ЦЕНЫ, уникальные особенности услуг из оригинала. НИКОГДА не выдумывай новые цены, адреса или услуги.
2. **Контекст**: Если страница про "Солярий в Туле на ул. Ленина" — итоговый текст ОБЯЗАН быть про этот конкретный солярий, а не про солярии в целом.
3. **Язык и тон**: Сохраняй язык и стиль оригинала. Не меняй тон бренда.

АЛГОРИТМ ОПТИМИЗАЦИИ:
1. **Возьми оригинальный текст как базу** — перерабатывай абзац за абзацем, НЕ удаляя важную информацию.
2. **Интегрируй Missing Entities / LSI-ключи** — вплетай их в СУЩЕСТВУЮЩИЕ предложения или добавляй рядом с релевантными разделами.
3. **Снизь переспам** — замени лишние повторы синонимами, но не убирай ключевые термины полностью.
4. **Закрой Topical Gaps** — добавь фразы конкурентов в подходящие по смыслу места.
5. **Структурируй**: используй иерархию # H1, ## H2, ### H3 (один H1).
6. **Таблицы**: Если в оригинале есть цены, характеристики, сравнения — оформи их в Markdown-таблицу, используя РЕАЛЬНЫЕ данные из оригинала.
7. **Списки**: Используй маркированные и нумерованные списки для улучшения читаемости (минимум 2).
8. **FAQ**: В конце ВСЕГДА добавляй "## Часто задаваемые вопросы" (3-5 вопросов) — вопросы должны быть про КОНКРЕТНЫЙ бизнес/услугу со страницы.
9. **Дополнение**: Если текст слишком короткий, дополни его блоками на основе Golden Blueprint, но в стиле оригинала и с данными оригинала.

ФОРМАТ ОТВЕТА — строго JSON:
{
  "optimizedText": "<полный оптимизированный текст в Markdown>",
  "changes": [
    {"type": "added", "term": "<LSI-ключ>", "context": "<в какой раздел/абзац добавлено>"},
    {"type": "reduced", "term": "<слово>", "from": <кол-во было>, "to": <кол-во стало>},
    {"type": "topicalGap", "phrase": "<фраза>", "context": "<куда вставлено>"},
    {"type": "structure", "term": "<элемент>", "context": "<конкретно: 'Добавлена таблица цен из оригинала', 'Исправлена иерархия H1-H3'>"},
    {"type": "preserved", "term": "<что сохранено>", "context": "<'Цены, адрес, контакты оригинала'>"}
  ],
  "summary": "<2-3 предложения: ЧТО КОНКРЕТНО изменено — 'Внедрено 5 LSI-ключей в раздел Описание', 'Оформлены цены оригинала в таблицу'>",
  "contentChecklist": {
    "hasTable": true/false,
    "hasList": true/false,
    "hasFaq": true/false,
    "lsiIntegrated": true/false,
    "headingHierarchy": true/false
  }
}
Поле changes ОБЯЗАТЕЛЬНО должно содержать минимум 5 элементов, включая хотя бы один "preserved".`;

    const userPrompt = `URL: ${analysis.url}

─── ОРИГИНАЛЬНЫЙ ТЕКСТ СТРАНИЦЫ (ЭТО БАЗА — РЕДАКТИРУЙ, НЕ ЗАМЕНЯЙ) ───
${pageContent}

─── ЗАДАНИЕ: Отредактируй текст выше, интегрировав следующие данные ───

Missing Entities (TF-IDF — добавь в существующий текст):
${missingTerms.join(", ") || "нет"}

Missing Entities (AI/LSI — вплети в релевантные разделы):
${missingEntities.join(", ") || "нет"}

Переспам (снизь плотность этих слов, заменяя синонимами):
${spamTerms.map((s: any) => `"${s.term}" (density: ${s.density.toFixed(2)}%)`).join(", ") || "нет"}

Topical Gaps (фразы конкурентов, которых нет — добавь по смыслу):
${[...bigramGaps, ...trigramGaps].join(", ") || "нет"}

Рекомендуемая структура (Golden Blueprint — используй как ориентир):
H1: ${blueprint.h1 || "—"}
Sections: ${blueprint.sections?.map((s: any) => `${s.tag}: ${s.text}`).join(" | ") || "—"}

НАПОМИНАНИЕ: Сохрани ВСЕ фактические данные из оригинала (цены, адреса, названия, контакты). Не выдумывай ничего нового.`;

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
