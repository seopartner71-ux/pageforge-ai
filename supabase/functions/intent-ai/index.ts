// deploy: v8 - openrouter everywhere
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    let OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!OPENROUTER_API_KEY && SERVICE_ROLE) {
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data } = await sb.from("system_settings").select("value").eq("key", "openrouter_api_key").maybeSingle();
        OPENROUTER_API_KEY = String((data as any)?.value ?? "").trim();
      } catch {/* ignore */}
    }
    if (!OPENROUTER_API_KEY) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Требуется авторизация" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { checkId, matrix, queries } = await req.json();
    if (!matrix || !queries) {
      return new Response(JSON.stringify({ error: "Нет данных для анализа" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Сжимаем матрицу для промпта
    const compact: any = {};
    for (const q of queries) {
      compact[q] = (matrix[q] || []).slice(0, 10).map((r: any) => ({
        pos: r.position, domain: r.domain, type: r.siteType, page: r.pageType,
      }));
    }

    const prompt = `Проанализируй результаты поисковой выдачи Google по запросам.
Для каждого запроса определи:
1. Тип интента (коммерческий / информационный / навигационный / смешанный)
2. Какой тип контента нужно создать для попадания в топ
3. Какие домены доминируют в нише и почему
4. Краткие рекомендации по созданию контента

Ответ строго на русском, в формате Markdown, по разделам для каждого запроса. В конце — общий вывод по нише.

Данные:
\`\`\`json
${JSON.stringify(compact, null, 2)}
\`\`\``;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seo-modul.pro",
        "X-Title": "SEO-Audit Intent AI",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ты опытный SEO-аналитик. Отвечай кратко, структурно, по делу." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return new Response(JSON.stringify({ error: `OpenRouter ${aiResp.status}: ${t}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const aiData = await aiResp.json();
    const markdown: string = aiData?.choices?.[0]?.message?.content || "";

    if (checkId && markdown) {
      await supabase.from("intent_checks").update({ ai_markdown: markdown }).eq("id", checkId);
    }

    return new Response(JSON.stringify({ markdown }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});