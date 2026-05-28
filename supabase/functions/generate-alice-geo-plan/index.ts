// Streams a GEO action plan based on Alice (Yandex) visibility audit data via OpenRouter.
// Body: { brand: string, domain: string, language?: 'ru'|'en', data: object }
// Returns SSE stream (OpenAI-compatible deltas).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const brand = (body.brand || "").toString();
    const domain = (body.domain || "").toString();
    const lang = body.language === "en" ? "en" : "ru";
    const data = body.data ?? {};
    if (!brand || !domain) {
      return new Response(JSON.stringify({ error: "brand and domain are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) {
      return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sys = lang === "ru"
      ? `Ты GEO-стратег по видимости в Яндекс Алисе и AI-поиске Яндекса (YandexGPT, Нейро). На основе данных аудита составь конкретный план роста видимости бренда в ответах Алисы на 30/60/90 дней.
Структура ответа в markdown:
## Краткий диагноз
## Топ-3 приоритета (первая неделя)
## План на 30 дней
## План на 60 дней
## План на 90 дней
## KPI и контрольные метрики
Будь предельно конкретным: указывай площадки (Яндекс.Маркет, Otzovik, IRecommend, Дзен, VC.ru, Habr, Wikipedia, отраслевые медиа), форматы контента, типы упоминаний и якорные запросы. Опирайся на загруженные данные: какие запросы не приводят к упоминанию бренда, какие домены цитируются вместо вас, какие типы источников доминируют. Без воды. Не используй жирный шрифт (**). Не используй букву "ё" (только "е"). Заменяй длинные тире на обычный дефис (-).`
      : `You are a GEO strategist for Yandex Alice / YandexGPT visibility. Based on the audit data, produce a concrete 30/60/90-day plan to grow the brand's visibility in Alice answers.
Markdown structure:
## Quick diagnosis
## Top-3 priorities (first week)
## 30-day plan
## 60-day plan
## 90-day plan
## KPIs and tracking metrics
Be specific: name platforms (Yandex.Market, Otzovik, IRecommend, Dzen, VC.ru, Habr, Wikipedia, industry media), content formats, anchor queries. Use the supplied data. No fluff. Do not use bold (**).`;

    const userPrompt = lang === "ru"
      ? `Бренд: ${brand}\nДомен: ${domain}\n\nДанные аудита видимости в Алисе (JSON):\n${JSON.stringify(data, null, 2)}\n\nСоставь подробный план действий.`
      : `Brand: ${brand}\nDomain: ${domain}\n\nAlice visibility audit data (JSON):\n${JSON.stringify(data, null, 2)}\n\nProduce a detailed action plan.`;

    const upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        stream: true,
        temperature: 0.6,
        max_tokens: 3000,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const t = await upstream.text().catch(() => "");
      return new Response(JSON.stringify({ error: `OpenRouter HTTP ${upstream.status}: ${t.slice(0, 300)}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(upstream.body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    console.error("[generate-alice-geo-plan] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});