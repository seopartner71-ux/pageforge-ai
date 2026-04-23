import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type SiteType =
  | "СМИ"
  | "Блог / Инфосайт"
  | "Корп. сайт"
  | "Видео"
  | "Неизвестно"
  | "UGC"
  | "Портал"
  | "Соцсеть"
  | "Форум"
  | "Маркетплейс";

function safeUrl(u: string): { domain: string; path: string } {
  try {
    const x = new URL(u);
    return { domain: x.hostname.toLowerCase().replace(/^www\./, ""), path: x.pathname.toLowerCase() };
  } catch {
    return { domain: "", path: "" };
  }
}

function detectSiteType(url: string, _title: string, _snippet: string): SiteType {
  const { domain, path } = safeUrl(url);
  if (!domain) return "Неизвестно";

  const media = ["rbc.ru","ria.ru","tass.ru","kommersant.ru","forbes.ru","vedomosti.ru","iz.ru","mk.ru","aif.ru","gazeta.ru","meduza.io","lenta.ru","interfax.ru"];
  if (media.some((m) => domain.includes(m))) return "СМИ";

  if (domain.includes("youtube") || domain.includes("youtu.be") || domain.includes("rutube") || (domain.includes("vk.com") && path.includes("/video")) || domain.includes("dzen.ru/video")) return "Видео";

  const marketplaces = ["wildberries","ozon","avito","yandex.market","market.yandex","goods.ru","goods","megamarket","lamoda","sbermegamarket","vseinstrumenti","leroymerlin","leroy-merlin","dns-shop","citilink","eldorado","mvideo","m.video","aliexpress","joom","kazanexpress","yamaguchi"];
  if (marketplaces.some((a) => domain.includes(a))) return "Маркетплейс";

  const aggregators = ["promportal","2gis","yell","zoon","flamp","blizko","pulscen","tiu.ru","flagma","bizorg","allbiz","yandex.ru/maps","yandex.ru/uslugi","profi.ru","yclients"];
  if (aggregators.some((a) => domain.includes(a))) return "UGC";

  const social = ["vk.com","t.me","telegram.me","ok.ru","pikabu","reddit","facebook","instagram","twitter","x.com","tiktok","threads"];
  if (social.some((s) => domain.includes(s))) return "Соцсеть";

  const forums = ["forum","otvet.mail.ru","woman.ru","babyblog","9months","drom.ru/forum","forumhouse","mastergrad","stackoverflow","toster"];
  if (forums.some((f) => domain.includes(f) || path.includes(`/${f}`) || path.includes(`/${f}/`))) return "Форум";

  const portals = ["wikipedia","yandex.ru/health","yandex.ru/q","dzen.ru","mail.ru","mos.ru","gosuslugi","kp.ru","cyberleninka"];
  if (portals.some((p) => domain.includes(p) || url.toLowerCase().includes(p))) return "Портал";

  const ugc = ["otzovik","irecommend","tripadvisor","yell.ru","tutu.ru/otzyvy"];
  if (ugc.some((u) => domain.includes(u))) return "UGC";

  // Корп. сайт — по URL паттернам (проверяем ДО блога, т.к. /catalog/ важнее)
  const corpPatterns = ["/product-category/","/catalog/","/category/","/categories/","/tovar/","/tovary/","/product/","/products/","/uslugi/","/services/","/service/","/shop/","/store/","/magazin/","/market/","/price/","/prices/","/contacts/","/contact/","/about/","/o-nas/","/o-kompanii/","/cart/","/checkout/","/brands/","/proizvoditeli/","/collection/","/kollektsii/"];
  if (corpPatterns.some((p) => path.includes(p))) return "Корп. сайт";

  // Блог / Инфосайт
  const blogPatterns = ["/blog/","/blogs/","/articles/","/article/","/stati/","/statya/","/news/","/novosti/","/post/","/posts/","/poleznoe/","/info/","/journal/","/sovety/","/sovet/","/faq/","/guide/","/guides/","/wiki/","/encyclopedia/","/spravochnik/","/help/","/learn/"];
  if (blogPatterns.some((p) => path.includes(p))) return "Блог / Инфосайт";

  // Корневой URL или короткий путь без явных маркеров → скорее всего корп. сайт
  const cleanPath = path.replace(/\/+$/, "");
  if (cleanPath === "" || cleanPath === "/" || cleanPath.split("/").filter(Boolean).length <= 2) {
    // Доменные TLD коммерческого характера
    if (/\.(ru|com|net|store|shop|online|pro|biz)$/.test(domain)) return "Корп. сайт";
  }

  return "Корп. сайт";
}

function detectPageType(url: string, title: string): string {
  const { path } = safeUrl(url);
  const cleanPath = path.replace(/\/+$/, "");
  if (cleanPath === "" || cleanPath === "/") return "главная";
  if (/\/search\//.test(path) || /\?(s|q|query)=/.test(url)) return "поиск";
  if (path.includes("/video") || /youtube|rutube/.test(url)) return "видео";
  if (/(\/product\/|\/tovar\/|\/item\/|\/p\/)/.test(path)) return "товар";
  if (/(\/uslugi\/|\/services\/|\/service\/)/.test(path)) return "услуга";
  if (/(\/product-category\/|\/catalog\/|\/category\/|\/categories\/|\/c\/|\/collection\/)/.test(path)) return "категория";
  if (/(\/blog\/|\/articles?\/|\/stati\/|\/news\/|\/novosti\/|\/post\/|\/journal\/|\/poleznoe\/|\/sovety\/)/.test(path)) return "статья";
  if (/(\/about\/|\/o-nas\/|\/o-kompanii\/|\/contacts?\/)/.test(path)) return "инфо";
  if (/как |что такое|почему |зачем /i.test(title)) return "статья";
  return "страница";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY");
    if (!SERPER_API_KEY) {
      return new Response(JSON.stringify({ error: "SERPER_API_KEY не настроен" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Требуется авторизация" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const queriesRaw: string[] = Array.isArray(body.queries) ? body.queries : [];
    const queries = queriesRaw.map((q: string) => String(q || "").trim()).filter(Boolean).slice(0, 30);
    const searchEngine: string = ["google","yandex","both"].includes(body.searchEngine) ? body.searchEngine : "google";
    const city: string = String(body.city || "Москва").slice(0, 80);
    const depth: number = [10,20,30].includes(Number(body.depth)) ? Number(body.depth) : 10;
    const projectId: string | null = body.projectId || null;

    if (!queries.length) {
      return new Response(JSON.stringify({ error: "Нет запросов" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matrix: Record<string, { engine: string; position: number; url: string; domain: string; title: string; snippet: string; siteType: SiteType; pageType: string }[]> = {};

    for (const q of queries) {
      matrix[q] = [];
      // Google через Serper.dev (Yandex в первой версии не поддерживаем)
      const resp = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q, gl: "ru", hl: "ru", location: city, num: depth }),
      });
      if (!resp.ok) {
        const t = await resp.text();
        console.error(`Serper error for "${q}":`, resp.status, t);
        continue;
      }
      const data = await resp.json();
      const organic = Array.isArray(data.organic) ? data.organic.slice(0, depth) : [];
      organic.forEach((item: any, i: number) => {
        const url = String(item.link || "");
        const { domain } = safeUrl(url);
        const title = String(item.title || "");
        const snippet = String(item.snippet || "");
        matrix[q].push({
          engine: "google",
          position: i + 1,
          url, domain, title, snippet,
          siteType: detectSiteType(url, title, snippet),
          pageType: detectPageType(url, title),
        });
      });
    }

    // Сохраняем чек
    const { data: check, error: insErr } = await supabase
      .from("intent_checks")
      .insert({
        user_id: userId,
        project_id: projectId,
        queries, search_engine: searchEngine, city, depth,
        results: matrix,
      })
      .select("id")
      .single();
    if (insErr) console.error("intent_checks insert error", insErr);

    if (check?.id) {
      const rows: any[] = [];
      for (const q of queries) {
        for (const r of matrix[q] || []) {
          rows.push({
            check_id: check.id,
            query: q, position: r.position,
            url: r.url, domain: r.domain, title: r.title, snippet: r.snippet,
            site_type: r.siteType, page_type: r.pageType, engine: r.engine,
          });
        }
      }
      if (rows.length) {
        const { error: rErr } = await supabase.from("intent_results").insert(rows);
        if (rErr) console.error("intent_results insert error", rErr);
      }
    }

    return new Response(JSON.stringify({ checkId: check?.id || null, matrix, queries, searchEngine, city, depth }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("check-intent error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});