import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectContext {
  domain?: string;
  clientName?: string;
  niche?: string;
  region?: string;
  siteStatus?: string;
  horizon?: number;
  plannedWorks?: string[];
  articlesPerMonth?: number;
  competition?: string;
  currentTraffic?: string;
  baseYandex?: number;
  baseGoogle?: number;
  gscImpressions?: number;
  gscClicks?: number;
  gscCtr?: number;
  gscAvgPosition?: number;
  gscImpressionsPos23?: number;
  topvisorTotal?: number;
  topvisorTop10?: number;
  topvisorMissing?: number;
  allPositionsMissing?: boolean;
  forecastBaseYandexFinal?: number;
  forecastBaseGoogleFinal?: number;
  forecastBaseTotalFinal?: number;
  forecastGrowthMultiplier?: number;
}

function buildDataContext(ctx: ProjectContext): string {
  const lines: string[] = [
    `Домен: ${ctx.domain ?? '—'}`,
    `Тематика: ${ctx.niche ?? '—'}`,
    `Регион: ${ctx.region ?? '—'}`,
    `Статус сайта: ${ctx.siteStatus ?? '—'}`,
    `Горизонт прогноза: ${ctx.horizon ?? 3} месяцев`,
    `Планируемые работы: ${(ctx.plannedWorks ?? []).join(", ") || '—'}`,
  ];
  if (ctx.articlesPerMonth) lines.push(`Темп публикаций: ${ctx.articlesPerMonth} статей/мес.`);
  if (ctx.competition) lines.push(`Конкуренция в нише: ${ctx.competition}`);
  if (ctx.baseYandex !== undefined) {
    lines.push(`\nДАННЫЕ ЯНДЕКС.МЕТРИКИ:`);
    lines.push(`Текущий трафик Яндекс: ${ctx.baseYandex} визитов/мес.`);
    lines.push(`Текущий трафик Google: ${ctx.baseGoogle ?? 0} визитов/мес.`);
    lines.push(`Итого органика: ${(ctx.baseYandex ?? 0) + (ctx.baseGoogle ?? 0)} визитов/мес.`);
  } else if (ctx.currentTraffic) {
    lines.push(`\nТекущий органический трафик (оценка): ${ctx.currentTraffic}`);
  }
  if (ctx.gscImpressions) {
    lines.push(`\nДАННЫЕ GOOGLE SEARCH CONSOLE:`);
    lines.push(`Показов: ${ctx.gscImpressions}`);
    lines.push(`Кликов: ${ctx.gscClicks ?? 0}`);
    lines.push(`CTR: ${ctx.gscCtr ?? 0}%`);
    lines.push(`Средняя позиция: ${ctx.gscAvgPosition ?? '—'}`);
    if (ctx.gscImpressionsPos23) lines.push(`Показов на позиции 2-3: ${ctx.gscImpressionsPos23} (резерв для роста)`);
  }
  if (ctx.topvisorTotal) {
    lines.push(`\nДАННЫЕ TOPVISOR (позиции):`);
    lines.push(`Всего запросов: ${ctx.topvisorTotal}`);
    lines.push(`В топ-10: ${ctx.topvisorTop10 ?? 0}`);
    lines.push(`Вне топ-100: ${ctx.topvisorMissing ?? 0}`);
    if (ctx.allPositionsMissing) lines.push(`Статус: нулевая точка — все запросы вне топ-100`);
  }
  if (ctx.forecastBaseTotalFinal) {
    lines.push(`\nПРОГНОЗ (базовый сценарий, месяц ${ctx.horizon}):`);
    lines.push(`Яндекс: ${ctx.forecastBaseYandexFinal ?? 0} визитов/мес.`);
    lines.push(`Google: ${ctx.forecastBaseGoogleFinal ?? 0} визитов/мес.`);
    lines.push(`Итого: ${ctx.forecastBaseTotalFinal} визитов/мес.`);
    if (ctx.forecastGrowthMultiplier) lines.push(`Рост: в ${ctx.forecastGrowthMultiplier} раза к текущему уровню`);
  }
  return lines.join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const ctx: ProjectContext = await req.json();
    if (!ctx || typeof ctx !== "object") return json({ error: "Bad request" }, 400);

    let OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!OPENROUTER_API_KEY && SERVICE_ROLE) {
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data } = await sb
          .from("system_settings").select("key_value")
          .eq("key_name", "openrouter_api_key").maybeSingle();
        OPENROUTER_API_KEY = String((data as any)?.key_value ?? "").trim();
      } catch { /* ignore */ }
    }
    if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY не настроен" }, 500);

    const dataContext = buildDataContext(ctx);
    const horizon = ctx.horizon ?? 3;

    const systemPrompt = `Ты — SEO-аналитик уровня senior с 15+ годами опыта.
Специализация: российский рынок, Яндекс и Google, коммерческие ниши.
Пишешь профессионально, конкретно, без воды и общих фраз.
Каждый тезис — обоснован данными или логикой ниши.
Никогда не пиши "следует отметить", "важно понимать", "необходимо учитывать".
Пиши как будто объясняешь клиенту на встрече — прямо и по делу.
Отвечай ТОЛЬКО в формате JSON, без markdown-обёртки и пояснений вне JSON.`;

    const monthsHint = Array.from({ length: horizon }, (_, i) => `"Месяц ${i + 1}: ..."`).join(", ");
    const userPrompt = `Сгенерируй экспертный SEO-анализ для клиентского отчёта.

ДАННЫЕ ПРОЕКТА:
${dataContext}

Верни JSON строго в этом формате:
{
  "nicheAnalysis": "2-3 абзаца. Характеристика ниши: уровень конкуренции, особенности спроса, сезонность, типичные барьеры для SEO. Конкретно под нишу «${ctx.niche ?? ''}» в регионе «${ctx.region ?? ''}».",
  "startingPoint": "1-2 абзаца. Оценка текущего состояния сайта на основе данных. Что говорят цифры, что это значит для прогноза, в чём главная возможность.",
  "growthPoints": [
    "Точка роста 1 — заголовок: развёрнутое объяснение почему это приоритет и что конкретно нужно сделать",
    "Точка роста 2 — ...",
    "Точка роста 3 — ...",
    "Точка роста 4 — ...",
    "Точка роста 5 — ..."
  ],
  "monthByMonth": [ ${monthsHint} ],
  "risks": [
    "Риск 1 — конкретный для этой ниши/сайта с объяснением как снизить",
    "Риск 2 — ...",
    "Риск 3 — ...",
    "Риск 4 — ..."
  ],
  "conditions": [
    "Условие 1 — конкретное действие которое нужно выполнить",
    "Условие 2 — ...",
    "Условие 3 — ...",
    "Условие 4 — ...",
    "Условие 5 — ..."
  ],
  "summary": "2-3 абзаца. Итоговое резюме: стартовая точка → что будет через ${horizon} месяцев → почему это реалистично → главный бизнес-эффект для клиента. Заканчивай конкретной цифрой из прогноза."
}`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seo-modul.pro",
        "X-Title": "SEO Forecast AI Insights",
      },
      body: JSON.stringify({
        model: "anthropic/claude-sonnet-4",
        max_tokens: 3500,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });
    if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
    if (!aiResp.ok) return json({ error: "AI failed", detail: await aiResp.text() }, 500);

    const aiJson = await aiResp.json();
    let content = aiJson?.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!parsed) return json({ error: "AI returned non-JSON", raw: content }, 500);

    return json({ insights: parsed, generated_at: new Date().toISOString() }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}