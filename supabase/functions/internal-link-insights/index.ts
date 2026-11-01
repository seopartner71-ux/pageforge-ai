import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const auditId = typeof body?.audit_id === "string" ? body.audit_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(auditId)) return json({ error: "audit_id обязателен" }, 400);

    // RLS: прочитает только аудит своего проекта (или админ)
    const { data: audit, error } = await supabase
      .from("internal_link_audits").select("id, results, summary").eq("id", auditId).maybeSingle();
    if (error || !audit) return json({ error: "Аудит не найден или нет доступа" }, 404);

    let KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!KEY && SERVICE_ROLE) {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data } = await sb.from("system_settings").select("key_value").eq("key_name", "openrouter_api_key").maybeSingle();
      KEY = String((data as any)?.key_value ?? "").trim();
    }
    if (!KEY) return json({ error: "Ключ OpenRouter не настроен" }, 500);

    const r = (audit as any).results ?? {};
    const s = r.summary ?? {};
    const lines = (arr: any[] | undefined, n: number, f: (x: any) => string) => (arr ?? []).slice(0, n).map(f).join("\n") || "—";

    const prompt = `Ты — старший SEO-специалист по внутренней перелинковке. Ниже результаты автоматического аудита сайта ${r.host ?? ""} (данные Screaming Frog${r.hasGsc ? " + Google Search Console" : ", без данных GSC"}).
Сделай экспертный вывод для отчёта клиенту и конкретные рекомендации. Опирайся ТОЛЬКО на эти цифры, ничего не выдумывай. URL пиши как есть.

СВОДКА:
- Страниц (200, HTML): ${s.pages}
- Сироты (нет входящих): ${s.orphans}
- Без ссылок из текста: ${s.noTextLinks}
- Целей-редиректов, на которые ссылаются: ${s.redirectTargets}
- Битых целей: ${s.brokenTargets}
- Конфликтов анкоров: ${s.anchorConflicts}
- Пар каннибализации: ${s.cannibal ?? "нет данных GSC"}
- Кандидатов «статья → услуга»: ${s.candidates}
- Шаблонных ссылок исключено из «текста»: ${s.templateLinks}

ПО ТИПАМ (тип: страниц, ср. PageRank, ср. входящих из текста, без ссылок из текста, ср. глубина):
${lines(r.byType, 20, (t) => `${t.type}: ${t.pages}, PR ${t.prAvg}, вх.текст ${t.inTextAvg}, без текста ${t.noText}, глубина ${t.depthAvg ?? "—"}`)}

ПЛАН (автоматический скоринг):
${lines(r.plan, 25, (p) => `[${p.priority}] ${p.action} — ${p.page} (${p.reason})`)}

БИТЫЕ: ${lines(r.broken, 10, (b) => `${b.dst} (${b.code}), ссылок ${b.links}`)}
РЕДИРЕКТЫ (топ): ${lines(r.redirects, 10, (b) => `${b.dst} (${b.code}), ссылок ${b.links}`)}
КОНФЛИКТЫ АНКОРОВ: ${lines(r.conflicts, 10, (c) => `«${c.anchor}» → ${c.targets} страниц`)}
КАННИБАЛИЗАЦИЯ: ${lines(r.cannibal, 10, (c) => `«${c.query}»: ${c.main} vs ${c.rival}, доля ${c.rivalShare}`)}
КАНДИДАТЫ (топ): ${lines(r.candidates, 15, (c) => `${c.src} → ${c.dst} (близость ${c.sim}${c.duplicate ? ", возможный дубль" : ""})`)}
СТРАНИЦЫ С МАКС. PageRank: ${lines([...(r.pages ?? [])].sort((a: any, b: any) => b.pr_all - a.pr_all), 8, (p) => `${p.url} (${p.type}) PR ${Number(p.pr_all).toFixed(2)}, вх.текст ${p.in_text}`)}

Верни JSON строго такого вида:
{
  "verdict": "общая оценка перелинковки в 2–4 предложениях",
  "score": число 0-100 (оценка качества перелинковки),
  "findings": [{"title": "краткий вывод", "details": "что видно в данных и почему это важно для SEO", "severity": "critical|warning|info"}],
  "recommendations": [{"priority": "Высокий|Средний|Низкий", "title": "что сделать", "details": "как именно, с конкретными URL из данных", "effect": "ожидаемый эффект"}],
  "quick_wins": ["конкретное быстрое действие"]
}
4–7 выводов, 5–10 рекомендаций, сначала самые важные. Не ставь «Высокий» всем подряд. Если данных GSC нет — отметь, что приоритеты по трафику не подтверждены.`;

    const callAI = (model: string) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://seo-modul.pro", "X-Title": "SEO-Audit Internal Links",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Ты эксперт по SEO и внутренней перелинковке. Отвечай только валидным JSON на русском языке." },
            { role: "user", content: prompt },
          ],
        }),
      });

    let resp = await callAI("google/gemini-2.5-pro");
    if (!resp.ok && resp.status !== 402 && resp.status !== 429) resp = await callAI("google/gemini-2.5-flash");
    if (resp.status === 402) return json({ error: "Закончились средства на балансе OpenRouter" }, 402);
    if (resp.status === 429) return json({ error: "Слишком много запросов к ИИ, попробуйте через минуту" }, 429);
    if (!resp.ok) return json({ error: `ИИ вернул ошибку ${resp.status}: ${(await resp.text()).slice(0, 300)}` }, 502);

    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    let report: any;
    try {
      report = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, ""));
    } catch {
      return json({ error: "ИИ вернул неразборчивый ответ, попробуйте ещё раз" }, 502);
    }
    report.model = data?.model ?? null;
    report.generated_at = new Date().toISOString();

    await supabase.from("internal_link_audits").update({ ai_report: report }).eq("id", auditId);
    return json({ report });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
