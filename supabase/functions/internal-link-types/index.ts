// Автоопределение типов страниц (regex по пути URL) для аудита перелинковки через ИИ (OpenRouter).
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const URL_ = Deno.env.get("SUPABASE_URL")!;
    const sbUser = createClient(URL_, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await sbUser.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const pages: { path: string; title?: string }[] = Array.isArray(body?.pages)
      ? body.pages.filter((p: any) => typeof p?.path === "string").slice(0, 3000).map((p: any) => ({ path: String(p.path).slice(0, 300), title: typeof p.title === "string" ? p.title.slice(0, 120) : "" }))
      : [];
    if (pages.length < 2) return json({ error: "Нужен список страниц (загрузите internal_all)" }, 400);
    const host = typeof body?.host === "string" ? body.host.slice(0, 100) : "";

    let KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!KEY) {
      const sb = createClient(URL_, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
      const { data } = await sb.from("system_settings").select("key_value").eq("key_name", "openrouter_api_key").maybeSingle();
      KEY = String((data as any)?.key_value ?? "").trim();
    }
    if (!KEY) return json({ error: "Ключ OpenRouter не настроен" }, 500);

    // Сводка по первым сегментам + выборка страниц из каждой группы
    const groups = new Map<string, { path: string; title?: string }[]>();
    for (const p of pages) {
      const seg = p.path.split("/").filter(Boolean)[0] ?? "";
      const k = seg.includes(".") ? "(файлы в корне)" : `/${seg}/`;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(p);
    }
    const single: { path: string; title?: string }[] = [];
    for (const [k, arr] of [...groups.entries()]) if (arr.length === 1 && k !== "(файлы в корне)") { single.push(arr[0]); groups.delete(k); }
    if (single.length) groups.set("(файлы в корне)", [...(groups.get("(файлы в корне)") ?? []), ...single]);
    const sample = [...groups.entries()].sort((a, b) => b[1].length - a[1].length).slice(0, 60)
      .map(([k, arr]) => `${k} — ${arr.length} стр.\n` + arr.slice(0, k === "(файлы в корне)" || groups.size < 6 ? 400 : 8).map((p) => `  ${p.path}${p.title ? ` | ${p.title}` : ""}`).join("\n")).join("\n");

    const prompt = `Сайт ${host}. Ниже структура URL (группы по первому сегменту пути, число страниц и примеры «путь | title»).
Составь правила типов страниц для аудита внутренней перелинковки. Каждое правило — JavaScript RegExp, проверяется по ПУТИ URL (начинается с «/», без домена), правила применяются сверху вниз, первое совпадение побеждает. Главная определяется автоматически, не добавляй её.
Обязательно используй точные названия, если такие страницы есть:
- «Статья» — блог, статьи, новости, полезное, советы, информационные материалы;
- «Услуга» — коммерческие страницы услуг/товаров/направлений, то, что продаёт;
- «Консультация» — запись, консультация, контакты/заявка, если есть отдельный раздел.
Другие типы (Категория, Товар, Контакты, О компании, Специалисты, Отзывы, Теги, Служебные и т.п.) называй коротко по-русски. Более узкие правила ставь выше общих. Если сайт с плоскими адресами (страницы прямо в корне), перечисли нужные адреса через | в одном правиле, ориентируясь на title. Не добавляй правило-«ловушку» вроде .* — всё неподошедшее само станет «Прочее». 3–12 правил. Не придумывай разделы, которых нет в данных.

${sample}

Верни JSON: {"rules":[{"name":"Статья","regex":"^/blog/","reason":"почему"}]}`;

    const callAI = (model: string) =>
      fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", "HTTP-Referer": "https://seo-modul.pro", "X-Title": "SEO-Audit Page Types" },
        body: JSON.stringify({
          model, response_format: { type: "json_object" },
          messages: [{ role: "system", content: "Ты SEO-архитектор. Отвечай только валидным JSON на русском." }, { role: "user", content: prompt }],
        }),
      });
    let resp = await callAI("google/gemini-2.5-flash");
    if (!resp.ok && resp.status !== 402 && resp.status !== 429) resp = await callAI("google/gemini-2.0-flash-001");
    if (resp.status === 402) return json({ error: "Закончились средства на балансе OpenRouter" }, 402);
    if (resp.status === 429) return json({ error: "Слишком много запросов к ИИ, попробуйте через минуту" }, 429);
    if (!resp.ok) return json({ error: `ИИ вернул ошибку ${resp.status}` }, 502);
    const text: string = (await resp.json())?.choices?.[0]?.message?.content ?? "";
    let parsed: any;
    try { parsed = JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return json({ error: "ИИ вернул неразборчивый ответ, попробуйте ещё раз" }, 502); }

    const rules = (Array.isArray(parsed?.rules) ? parsed.rules : [])
      .filter((r: any) => typeof r?.name === "string" && typeof r?.regex === "string" && r.name.trim() && r.regex.trim())
      .map((r: any) => ({ name: r.name.trim().slice(0, 60), regex: r.regex.trim(), reason: String(r.reason ?? "").slice(0, 200) }))
      .filter((r: any) => r.regex.length <= 4000 && !/^\^?\.\*\$?$/.test(r.regex) && r.name !== "Прочее" && r.name !== "Главная")
      .filter((r: any) => { try { new RegExp(r.regex); return true; } catch { return false; } })
      .slice(0, 15);
    if (!rules.length) return json({ error: "ИИ не предложил правил, попробуйте ещё раз" }, 502);
    return json({ rules });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
