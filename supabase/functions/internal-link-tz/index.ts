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
      .from("internal_link_audits").select("id, results, summary, ai_report").eq("id", auditId).maybeSingle();
    if (error || !audit) return json({ error: "Аудит не найден или нет доступа" }, 404);

    let KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!KEY && SERVICE_ROLE) {
      const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
      const { data } = await sb.from("system_settings").select("key_value").eq("key_name", "openrouter_api_key").maybeSingle();
      KEY = String((data as any)?.key_value ?? "").trim();
    }
    if (!KEY) return json({ error: "Ключ OpenRouter не настроен" }, 500);

    // Большие списки лежат отдельными строками в internal_link_audit_parts — склеиваем обратно.
    const ARR = ["pages", "plan", "candidates", "cannibal", "orphans", "noText", "redirects", "broken", "conflicts"];
    let r: any = (audit as any).results ?? {};
    if (!Array.isArray(r.pages)) {
      const parts: any[] = [];
      for (let from = 0; ; from += 50) {
        const { data: rows, error: pe } = await supabase
          .from("internal_link_audit_parts").select("idx, payload").eq("audit_id", auditId)
          .range(from, from + 49).order("idx");
        if (pe) return json({ error: `Не удалось прочитать части отчёта: ${pe.message}` }, 500);
        for (const row of rows ?? []) parts.push(row.payload);
        if (!rows || rows.length < 50) break;
      }
      r = { ...r };
      for (const k of ARR) r[k] = [];
      for (const p of parts) for (const k of Object.keys(p)) if (ARR.includes(k)) r[k].push(...(p[k] ?? []));
    }

    const s = r.summary ?? {};
    const lines = (arr: any[] | undefined, n: number, f: (x: any) => string) => (arr ?? []).slice(0, n).map(f).join("\n") || "—";
    const ai = (audit as any).ai_report ?? {};

    const prompt = `Ты — SEO-специалист уровня Senior (10+ лет, внутренняя перелинковка, архитектура сайтов). Составь ТЕХНИЧЕСКОЕ ЗАДАНИЕ на исправление внутренней перелинковки сайта ${r.host ?? ""} по результатам аудита (Screaming Frog${r.hasGsc ? " + Google Search Console" : ", без GSC"}).
ТЗ отдаётся исполнителям, поэтому каждая задача должна быть выполнима без вопросов: конкретная страница, конкретное действие, конкретный анкор, место размещения, критерий приёмки. Используй ТОЛЬКО URL и цифры из данных ниже, ничего не выдумывай. Анкоры пиши естественные, по-русски, разнообразные (не повторяй один анкор на разные цели, не используй «тут», «здесь», «подробнее»).

ДВА РАЗДЕЛА:
1) content — для контент-менеджера: вставка ссылок в текст статей на услуги (из списка кандидатов), ссылки на сироты и страницы без ссылок из текста, замена конфликтных анкоров, правки по каннибализации (какая страница основная, как развести).
2) tech — для программиста: замена ссылок на редиректы прямыми URL в шаблонах/контенте, удаление/исправление битых ссылок, вывод сирот в навигацию/хлебные крошки/блоки «похожие», изменения шаблонов (блоки перелинковки, листинги), глубина вложенности.

СВОДКА: страниц ${s.pages}; сирот ${s.orphans}; без ссылок из текста ${s.noTextLinks}; целей-редиректов ${s.redirectTargets}; битых целей ${s.brokenTargets}; конфликтов анкоров ${s.anchorConflicts}; каннибализация ${s.cannibal ?? "нет данных GSC"}; кандидатов ${s.candidates}; шаблонных ссылок ${s.templateLinks}.
${ai.verdict ? `ВЫВОД АУДИТА: ${ai.verdict}` : ""}

ПО ТИПАМ:
${lines(r.byType, 20, (t) => `${t.type}: ${t.pages} стр., вх.текст ${t.inTextAvg}, без текста ${t.noText}, глубина ${t.depthAvg ?? "—"}`)}
ПЛАН СКОРИНГА:
${lines(r.plan, 30, (p) => `[${p.priority}] ${p.action} — ${p.page} (${p.reason})`)}
КАНДИДАТЫ статья → услуга (откуда | H1 откуда | куда | H1 куда | близость | предложенный анкор):
${lines(r.candidates, 60, (c) => `${c.src} | ${c.srcH1} | ${c.dst} | ${c.dstH1} | ${c.sim} | ${c.anchor}${c.duplicate ? " | возможный дубль" : ""}`)}
СИРОТЫ: ${lines(r.orphans, 30, (o) => `${o.url} (${o.type}) «${o.title}»`)}
БЕЗ ССЫЛОК ИЗ ТЕКСТА: ${lines(r.noText, 40, (o) => `${o.url} (${o.type}) «${o.title}», вх.всего ${o.in_all}`)}
РЕДИРЕКТЫ: ${lines(r.redirects, 25, (g) => `${g.dst} (${g.code}), ссылок ${g.links}, источники: ${(g.examples ?? []).slice(0, 3).join(", ")}`)}
БИТЫЕ: ${lines(r.broken, 20, (g) => `${g.dst} (${g.code}), ссылок ${g.links}, источники: ${(g.examples ?? []).slice(0, 3).join(", ")}`)}
КОНФЛИКТЫ АНКОРОВ: ${lines(r.conflicts, 15, (c) => `«${c.anchor}» → ${(c.detail ?? []).map((d: any) => `${d.url} (${d.count})`).join(" | ")}`)}
КАННИБАЛИЗАЦИЯ: ${lines(r.cannibal, 15, (c) => `«${c.query}» показы ${c.impr}: основная ${c.main} (поз. ${c.mainPos}) vs ${c.rival} (поз. ${c.rivalPos}), доля ${c.rivalShare}`)}

Верни JSON строго такого вида:
{
  "goal": "цель работ в 1–2 предложениях",
  "scope": "что входит в работы, кратко",
  "content": [{"priority": "Высокий|Средний|Низкий", "page": "URL страницы, где правим", "action": "что сделать", "anchor": "текст анкора или пусто", "target": "URL цели или пусто", "placement": "где именно в тексте (абзац/раздел по смыслу)", "check": "как проверить выполнение"}],
  "tech": [{"priority": "Высокий|Средний|Низкий", "area": "Редиректы|Битые ссылки|Шаблоны|Навигация|Структура", "task": "что сделать", "urls": ["затронутые URL"], "how": "как реализовать технически", "check": "критерий приёмки"}],
  "acceptance": ["общие критерии приёмки всего ТЗ"],
  "notes": ["ограничения и важные замечания"]
}
Раздел content: 10–40 задач (по одной на вставку ссылки; не более 3 новых ссылок в одну статью). Раздел tech: 4–15 задач, группируй однотипные URL в одну задачу. Сначала самые важные. Если раздел не нужен по данным — верни пустой массив.`;

    const callAI = (model: string) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${KEY}`, "Content-Type": "application/json",
          "HTTP-Referer": "https://seo-modul.pro", "X-Title": "SEO-Audit Internal Links TZ",
        },
        body: JSON.stringify({
          model,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "Ты Senior SEO-специалист, пишешь ТЗ для исполнителей. Отвечай только валидным JSON на русском языке." },
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
    // Сверка: каждый URL в ТЗ должен существовать в данных аудита, выдуманные задачи вырезаем.
    const norm = (u: any) => {
      let x = String(u ?? "").trim().toLowerCase();
      if (!x) return "";
      x = x.replace(/^https?:\/\/(www\.)?[^/]+/, "").split("#")[0];
      if (!x.startsWith("/")) x = "/" + x;
      return x.length > 1 ? x.replace(/\/+$/, "") : x;
    };
    const known = new Set<string>();
    const collect = (v: any, depth = 0) => {
      if (depth > 3 || v == null) return;
      if (typeof v === "string") { if (/^(https?:\/\/|\/)/i.test(v)) known.add(norm(v)); return; }
      if (Array.isArray(v)) { for (const x of v) collect(x, depth + 1); return; }
      if (typeof v === "object") for (const x of Object.values(v)) collect(x, depth + 1);
    };
    for (const k of ARR) collect(r[k]);
    const ok = (u: any) => !String(u ?? "").trim() || known.has(norm(u));
    let dropped = 0, cleaned = 0;
    const content0 = Array.isArray(report.content) ? report.content : [];
    report.content = content0.filter((t: any) => {
      const good = String(t?.page ?? "").trim() && ok(t.page) && ok(t.target);
      if (!good) dropped++;
      return good;
    });
    const tech0 = Array.isArray(report.tech) ? report.tech : [];
    report.tech = tech0.filter((t: any) => {
      const urls = Array.isArray(t?.urls) ? t.urls : [];
      const kept = urls.filter((u: any) => ok(u));
      cleaned += urls.length - kept.length;
      t.urls = kept;
      if (urls.length && !kept.length) { dropped++; return false; }
      return true;
    });
    report.validation = { checked_urls: known.size, dropped_tasks: dropped, removed_urls: cleaned };
    if (dropped || cleaned) {
      report.notes = [...(Array.isArray(report.notes) ? report.notes : []),
        `Автопроверка: удалено задач с адресами, которых нет в аудите — ${dropped}; убрано лишних адресов из тех. задач — ${cleaned}.`];
    }
    report.model = data?.model ?? null;
    report.generated_at = new Date().toISOString();

    const next = { ...(ai ?? {}), tz: report };
    await supabase.from("internal_link_audits").update({ ai_report: next }).eq("id", auditId);
    return json({ tz: report });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
