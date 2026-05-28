// Generates up to 10 search-query prompts for GEO Radar based on brand info.
// Body: { brand_name: string, domain: string, language?: string, description?: string, products?: string, count?: number }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { brand_name, domain, language = "ru", description = "", products = "", count = 10 } = await req.json();
    if (!brand_name || !domain) {
      return new Response(JSON.stringify({ error: "brand_name and domain required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const apiKey = Deno.env.get("OPENROUTER_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "OPENROUTER_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const n = Math.max(1, Math.min(10, Number(count) || 10));
    const langInstr = language === "en"
      ? "Respond in English."
      : "Отвечай на русском языке.";

    const sys = `Ты — SEO/GEO-стратег. На основе информации о бренде сгенерируй ${n} реалистичных поисковых запросов (промтов), которые потенциальные клиенты задают генеративным ИИ-ассистентам (ChatGPT, Gemini, Perplexity), когда ищут продукты/услуги такого типа. ${langInstr}
Требования:
- БЕЗ упоминания самого бренда (небрендовые запросы) — мы проверяем, появится ли бренд в ответе ИИ.
- Естественные формулировки на разговорном языке (как пишут люди в чат), 5–15 слов.
- Покрой разные интенты: «лучшие/топ», сравнения, «как выбрать», «для X задачи», обзоры, альтернативы.
- Без нумерации, без кавычек, без комментариев. Один промт на строку.`;

    const user = `Бренд: ${brand_name}
Домен: ${domain}
Описание компании: ${description || "(не указано)"}
Продукты/услуги: ${products || "(не указано)"}

Сгенерируй ${n} промтов, по одному на строку.`;

    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        temperature: 0.7,
      }),
    });
    if (!r.ok) {
      const t = await r.text();
      return new Response(JSON.stringify({ error: `OpenRouter ${r.status}: ${t}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content || "";
    const prompts = raw
      .split("\n")
      .map((s: string) => s.replace(/^\s*[\d]+[.)\-:]\s*/, "").replace(/^[\-*•]\s*/, "").replace(/^["'«»]+|["'«»]+$/g, "").trim())
      .filter((s: string) => s.length >= 5 && s.length <= 200)
      .slice(0, n);

    return new Response(JSON.stringify({ prompts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});