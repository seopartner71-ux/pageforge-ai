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

    const { analysisId, generateTable, currentText, stealthMode, stealthRegion } = await req.json();
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

    // ─── STEALTH MODE (Humanize) ───
    if (stealthMode && currentText) {
      const regionInstructions: Record<string, string> = {
        ru: `ЛОКАЛИЗАЦИЯ — РОССИЯ:
- Язык: литературный русский с разговорными оборотами ("Честно говоря", "По моему опыту", "Знаете что интересно").
- Используй метрическую систему (км, кг, °C). Валюта — рубли (₽).
- Формат телефонов: +7 (XXX) XXX-XX-XX. Даты: ДД.ММ.ГГГГ.
- Допускай мягкий разговорный стиль, свойственный российским блогерам и экспертам.`,

        us: `LOCALIZATION — USA:
- Language: American English with natural, conversational tone ("Honestly", "Here's the thing", "In my experience").
- Use imperial units (miles, lbs, °F). Currency — USD ($).
- Phone format: (XXX) XXX-XXXX. Dates: MM/DD/YYYY.
- Use American idioms and phrases: "bang for your buck", "bottom line", "game-changer", "no-brainer".
- Avoid British spellings (colour→color, favourite→favorite, realise→realize).`,

        uk: `LOCALIZATION — UNITED KINGDOM:
- Language: British English with understated, professional tone ("Rather interesting", "One might argue", "It's worth noting").
- Use metric system (km, kg, °C). Currency — GBP (£).
- Phone format: +44 XXXX XXXXXX. Dates: DD/MM/YYYY.
- Use British idioms: "brilliant", "spot on", "straight away", "at the end of the day".
- Use British spellings (colour, favourite, realise, organise, centre).`,

        kz: `ЛОКАЛИЗАЦИЯ — КАЗАХСТАН:
- Язык: русский с казахстанскими особенностями. Допускай казахские вкрапления для аутентичности (рахмет, қайырлы күн).
- Используй метрическую систему. Валюта — тенге (₸).
- Формат телефонов: +7 (7XX) XXX-XX-XX. Даты: ДД.ММ.ГГГГ.
- Учитывай культурные особенности: уважительный тон, упоминание местных реалий (Алматы, Астана, Шымкент).
- Избегай сугубо российских выражений и сленга. Используй нейтральный постсоветский русский.`,
      };

      const regionPrompt = regionInstructions[stealthRegion || 'ru'] || regionInstructions.ru;

      const stealthPrompt = `Ты — эксперт по обходу детекторов ИИ-контента. Перепиши текст так, чтобы он прошёл проверку на 90%+ по детекторам (GPTZero, Originality.ai, Turnitin).

${regionPrompt}

ПРАВИЛА ОЧЕЛОВЕЧИВАНИЯ (методология DrMax):
1. **Вариативный ритм**: Чередуй короткие (5-8 слов) и длинные (20-30 слов) предложения. ИИ пишет монотонно — человек нет.
2. **Человеческие вводные**: Добавляй разговорные обороты, характерные для выбранного региона — но НЕ в каждый абзац.
3. **Удали паттерны GPT**: Убери "Важно отметить", "В заключение", "Следует подчеркнуть", "It is important to note", "In conclusion". Замени на живые формулировки.
4. **Несовершенство**: Добавь 1-2 разговорных оборота, лёгкую небрежность в стиле. Человек не пишет идеально гладко.
5. **Конкретика вместо абстракций**: Замени "множество вариантов" на "7 проверенных вариантов". Замени "significantly improve" на "boost by 23%".
6. **Непредсказуемая структура**: Не начинай каждый абзац одинаково. Варьируй: вопрос, факт, цитата, действие.
7. **Сохрани ВСЕ факты, цены, названия, контакты** — меняй ТОЛЬКО стилистику.
8. **Форматы дат, телефонов, валют** — строго по правилам региона выше.

Формат ответа — JSON:
{
  "optimizedText": "<очеловеченный текст в Markdown>"
}`;

      const stealthRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: stealthPrompt },
            { role: "user", content: currentText },
          ],
          response_format: { type: "json_object" },
          temperature: 0.7,
        }),
      });

      if (!stealthRes.ok) {
        return new Response(JSON.stringify({ error: "Stealth processing failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const stealthJson = await stealthRes.json();
      const stealthContent = stealthJson.choices?.[0]?.message?.content;
      let stealthParsed: any = {};
      try { stealthParsed = JSON.parse(stealthContent); } catch { stealthParsed = { optimizedText: currentText }; }

      return new Response(JSON.stringify({
        success: true,
        optimizedText: stealthParsed.optimizedText || currentText,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── TABLE GENERATION MODE ───
    if (generateTable && currentText) {
      const tableTypeDescriptions: Record<string, string> = {
        extract: "Извлеки из текста все структурированные данные (цены, характеристики, этапы, сравнения) и оформи их в Markdown-таблицу. Используй ТОЛЬКО реальные данные из текста.",
        compare: "Создай сравнительную таблицу с конкурентами на основе темы текста. Колонки: Параметр, Наш сервис, Конкурент 1, Конкурент 2. Заполни реалистичными данными из текста.",
        pricelist: "Создай структурированный прайс-лист в виде Markdown-таблицы. Колонки: Услуга, Цена, Описание. Если в тексте есть реальные цены — используй их. Если нет — предложи логичные цены для данной ниши.",
        proscons: "Создай таблицу 'Плюсы и минусы' в Markdown. Колонки: Преимущества, Недостатки. Основывайся на реальных характеристиках из текста.",
      };

      const tablePrompt = `Ты — эксперт по SEO-контенту. Тебе дан оптимизированный текст страницы.

ЗАДАЧА: ${tableTypeDescriptions[generateTable] || tableTypeDescriptions.extract}

ПРАВИЛА:
1. Верни ВЕСЬ текст целиком с вставленной таблицей в подходящем месте (перед FAQ или после раздела "Преимущества").
2. НЕ МЕНЯЙ остальной текст — только добавь таблицу.
3. Таблица должна быть в формате Markdown (| col1 | col2 |).
4. Используй РЕАЛЬНЫЕ данные из текста, не выдумывай.

Формат ответа — JSON:
{
  "optimizedText": "<весь текст с вставленной таблицей>"
}`;

      const tableRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": Deno.env.get("SUPABASE_URL") || "",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o",
          messages: [
            { role: "system", content: tablePrompt },
            { role: "user", content: currentText },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (!tableRes.ok) {
        const errText = await tableRes.text();
        console.error("Table gen error:", tableRes.status, errText);
        return new Response(JSON.stringify({ error: "Table generation failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const tableJson = await tableRes.json();
      const tableContent = tableJson.choices?.[0]?.message?.content;
      let tableParsed: any = {};
      try { tableParsed = JSON.parse(tableContent); } catch { tableParsed = { optimizedText: currentText }; }

      return new Response(JSON.stringify({
        success: true,
        optimizedText: tableParsed.optimizedText || currentText,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Ты — Expert SEO Editor, работающий по методологии "Доказательное SEO 2026". Твоя задача — УЛУЧШИТЬ существующий текст пользователя, а НЕ писать новый с нуля.

ГЛАВНОЕ ПРАВИЛО: Ты РЕДАКТОР, а не автор. Оригинальный текст — это основа. Сохрани его суть, факты и стиль бренда.

ПРАВИЛА ДОКАЗАТЕЛЬНОГО SEO 2026 (ВЫСШИЙ ПРИОРИТЕТ):

1. **CONTENT EFFORT (Уровень усилия)**: Текст не должен быть рерайтом. Добавь блоки "Личный опыт", "Технические нюансы", оригинальные исследования, экспертные цитаты, сложные HTML-таблицы, пошаговые инструкции. Без этого Google считает контент низкоусильным.

2. **INFORMATION GAIN (Добавочная ценность)**: Внедри минимум 3 факта или подтемы, которые конкуренты упустили. Используй данные из Missing Entities и Topical Gaps. Без Information Gain оптимизация считается неуспешной.

3. **SEMANTIC CHUNKING (Архитектура)**: Один H1. Строгая иерархия H2 → H3 без пропусков. Каждый абзац под заголовком = "концентрированный ответ", пригодный для Passage Indexing и AI Overviews (SGE). ЗАПРЕЩЕНЫ длинные вступления.

4. **NAVBOOST (Поведенческие)**: Первые 200 знаков = прямой ответ на главный интент запроса. УДАЛЯЙ фразы-паразиты: "В современном мире", "Ни для кого не секрет", "Как известно", "На сегодняшний день". Заменяй на конкретные данные и выгоды.

5. **QBST — Семантическая плотность**: Используй не просто ключи, а Salient Terms (термины выраженности сущности). Пример: страница про "Солярий" ОБЯЗАНА содержать "фототип", "инсоляция", "эритемная лампа", "меланин". Без этих терминов Google сочтёт текст поверхностным.

СТРОГИЕ ОГРАНИЧЕНИЯ:
1. **Сохраняй ВСЕ бизнес-данные**: название компании, адреса, телефоны, РЕАЛЬНЫЕ ЦЕНЫ, уникальные особенности из оригинала. НИКОГДА не выдумывай новые.
2. **Контекст**: Если страница про конкретный бизнес — итоговый текст ОБЯЗАН быть про этот конкретный бизнес.
3. **Язык и тон**: Сохраняй язык и стиль оригинала.

АЛГОРИТМ ОПТИМИЗАЦИИ:
1. **Возьми оригинальный текст как базу** — перерабатывай абзац за абзацем.
2. **Lede-абзац**: Первые 200 знаков — прямой ответ на интент. Удали все фразы-паразиты.
3. **Интегрируй Missing Entities / LSI / Salient Terms** — вплетай в СУЩЕСТВУЮЩИЕ предложения.
4. **Information Gain**: Добавь 3+ уникальных факта/подтемы, которых нет у конкурентов.
5. **Content Effort**: Добавь блок экспертности — таблицу сравнения, пошаговую инструкцию или "Технические нюансы".
6. **Снизь переспам** — замени лишние повторы синонимами.
7. **Структурируй**: # H1, ## H2, ### H3. Каждый чанк = концентрированный ответ.
8. **Таблицы**: Оформи данные в Markdown-таблицы с РЕАЛЬНЫМИ данными из оригинала.
9. **FAQ**: В конце "## Часто задаваемые вопросы" (3-5 вопросов) — про КОНКРЕТНЫЙ бизнес.

ФОРМАТ ОТВЕТА — строго JSON:
{
  "optimizedText": "<полный оптимизированный текст в Markdown>",
  "changes": [
    {"type": "added", "term": "<LSI/Salient Term>", "context": "<куда добавлено>"},
    {"type": "reduced", "term": "<слово>", "from": <было>, "to": <стало>},
    {"type": "topicalGap", "phrase": "<фраза>", "context": "<куда вставлено>"},
    {"type": "informationGain", "term": "<уникальный факт>", "context": "<куда добавлено>"},
    {"type": "contentEffort", "term": "<элемент экспертности>", "context": "<таблица/инструкция/нюансы>"},
    {"type": "navboost", "term": "<удалённая фраза-паразит>", "context": "<чем заменена>"},
    {"type": "structure", "term": "<элемент>", "context": "<что сделано>"},
    {"type": "preserved", "term": "<что сохранено>", "context": "<'Цены, адрес, контакты оригинала'>"}
  ],
  "summary": "<2-3 предложения: ЧТО КОНКРЕТНО изменено>",
  "contentChecklist": {
    "hasTable": true/false,
    "hasList": true/false,
    "hasFaq": true/false,
    "lsiIntegrated": true/false,
    "headingHierarchy": true/false,
    "contentEffort": "<low|medium|high>",
    "informationGainCount": <число уникальных фактов>,
    "navboostClean": true/false,
    "salientTermsAdded": <число>
  }
}
Поле changes ОБЯЗАТЕЛЬНО должно содержать минимум 7 элементов, включая informationGain, contentEffort и preserved.`;

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
