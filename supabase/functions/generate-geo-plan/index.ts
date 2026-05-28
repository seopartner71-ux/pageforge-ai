// Streams a GEO action plan based on radar analysis data via OpenRouter.
// Body: { project_id: string, radar_data: object }
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
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { project_id, radar_data } = await req.json().catch(() => ({}));
    if (!project_id) return new Response(JSON.stringify({ error: "project_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: project } = await admin
      .from("radar_projects")
      .select("id, user_id, brand_name, domain, language")
      .eq("id", project_id)
      .maybeSingle();
    if (!project) return new Response(JSON.stringify({ error: "Project not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (project.user_id !== userId) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const lang = project.language === "en" ? "en" : "ru";
    const brand = project.brand_name || "";
    const domain = project.domain || "";

    const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!openrouterKey) return new Response(JSON.stringify({ error: "OpenRouter API key not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const sys = lang === "ru"
      ? `Ты GEO-стратег (Generative Engine Optimization). На основе данных аудита AI-видимости бренда составь конкретный пошаговый план действий на 30/60/90 дней для роста видимости в LLM (ChatGPT, Gemini, Claude, Perplexity и др.).
Структура ответа в markdown:
## Краткий диагноз
## Топ-3 приоритета (что делать в первую неделю)
## План на 30 дней
## План на 60 дней
## План на 90 дней
## KPI и контрольные метрики
Будь конкретным: указывай площадки (Reddit, Habr, Wikipedia, отраслевые медиа), форматы контента, типы упоминаний. Без воды, без общих фраз. Не используй жирный шрифт (**). Не используй букву "ё" (только "е"). Заменяй длинные тире на обычный дефис (-).`
      : `You are a GEO (Generative Engine Optimization) strategist. Based on the AI-visibility audit data for the brand, produce a concrete 30/60/90-day action plan to grow visibility in LLMs (ChatGPT, Gemini, Claude, Perplexity, etc.).
Markdown structure:
## Quick diagnosis
## Top-3 priorities (first week)
## 30-day plan
## 60-day plan
## 90-day plan
## KPIs and tracking metrics
Be specific. No fluff. Do not use bold (**).`;

    const userPrompt = lang === "ru"
      ? `Бренд: ${brand}\nДомен: ${domain}\n\nДанные аудита GEO Radar (JSON):\n${JSON.stringify(radar_data, null, 2)}\n\nСоставь подробный план действий.`
      : `Brand: ${brand}\nDomain: ${domain}\n\nGEO Radar audit data (JSON):\n${JSON.stringify(radar_data, null, 2)}\n\nProduce a detailed action plan.`;

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
      return new Response(JSON.stringify({ error: `OpenRouter HTTP ${upstream.status}: ${t.slice(0, 300)}` }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
    console.error("[generate-geo-plan] fatal:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});