import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") ?? "";

async function getSetting(key: string): Promise<string> {
  const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data } = await sb.from("system_settings").select("key_value").eq("key_name", key).maybeSingle();
  return (data?.key_value || "").trim();
}

async function expandKeywords(topic: string, seeds: string[]): Promise<string[]> {
  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "You are an SEO expert. Expand the given topic into a comprehensive list of search queries in Russian. Include: main queries, long-tail variants, LSI synonyms, question-based queries (как, что, где, почему), commercial modifiers (купить, цена, заказать), informational variants. Return ONLY a JSON array of strings, no explanation.",
      },
      {
        role: "user",
        content: `Topic: ${topic}. Seed keywords: ${seeds.join(", ") || "—"}. Generate 50-100 diverse search queries.`,
      },
    ],
  };
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`AI expand failed: ${resp.status} ${t.slice(0, 200)}`);
  }
  const data = await resp.json();
  const raw = String(data?.choices?.[0]?.message?.content || "");
  const jsonMatch = raw.match(/\[[\s\S]*\]/);
  if (!jsonMatch) return [];
  try {
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) return [];
    const out = arr.map((x: any) => String(x).trim().toLowerCase()).filter(Boolean);
    return Array.from(new Set(out)).slice(0, 100);
  } catch {
    return [];
  }
}

async function nameCluster(keywords: string[]): Promise<string> {
  const sample = keywords.slice(0, 10).join(", ");
  const body = {
    model: "google/gemini-3-flash-preview",
    messages: [
      {
        role: "system",
        content:
          "You are an SEO expert. Given a cluster of semantically related search queries, generate a short descriptive cluster name in Russian (2-4 words). Return ONLY the cluster name string.",
      },
      { role: "user", content: `Queries in this cluster: ${sample}` },
    ],
  };
  try {
    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!resp.ok) return keywords[0] || "Кластер";
    const data = await resp.json();
    const txt = String(data?.choices?.[0]?.message?.content || "").trim().replace(/^["«]|["»]$/g, "");
    return txt.slice(0, 60) || keywords[0] || "Кластер";
  } catch {
    return keywords[0] || "Кластер";
  }
}

async function fetchSerpUrls(query: string, region: string, serperKey: string): Promise<string[]> {
  try {
    const resp = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: { "X-API-KEY": serperKey, "Content-Type": "application/json" },
      body: JSON.stringify({ q: query, gl: "ru", hl: "ru", location: region, num: 10 }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const organic = Array.isArray(data.organic) ? data.organic.slice(0, 10) : [];
    return organic.map((o: any) => String(o.link || "")).filter(Boolean);
  } catch {
    return [];
  }
}

function clusterByIntersection(
  items: { keyword: string; urls: string[]; score: number }[],
  threshold = 0.4,
): Map<string, string[]> {
  const sorted = [...items].sort((a, b) => b.score - a.score);
  const used = new Set<string>();
  const clusters = new Map<string, string[]>();
  let idx = 0;
  for (const head of sorted) {
    if (used.has(head.keyword)) continue;
    const id = `c${++idx}`;
    const group = [head.keyword];
    used.add(head.keyword);
    const headSet = new Set(head.urls);
    if (headSet.size > 0) {
      for (const cand of sorted) {
        if (used.has(cand.keyword)) continue;
        const inter = cand.urls.filter((u) => headSet.has(u)).length;
        const sim = inter / 10;
        if (sim > threshold) {
          group.push(cand.keyword);
          used.add(cand.keyword);
        }
      }
    }
    clusters.set(id, group);
  }
  return clusters;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    const sbUser = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sbUser.auth.getUser(token);
    if (!u?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action || "expand";

    if (action === "expand") {
      const topic = String(body.topic || "").trim();
      const seeds: string[] = Array.isArray(body.seeds) ? body.seeds.map((s: any) => String(s).trim()).filter(Boolean) : [];
      if (!topic && !seeds.length) {
        return new Response(JSON.stringify({ error: "Нет темы и сидов" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const keywords = await expandKeywords(topic, seeds);
      return new Response(JSON.stringify({ keywords }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cluster") {
      const items: { keyword: string; score: number }[] =
        Array.isArray(body.items) ? body.items.map((i: any) => ({ keyword: String(i.keyword), score: Number(i.score) || 0 })) : [];
      const region = String(body.region || "Москва");
      if (!items.length) {
        return new Response(JSON.stringify({ clusters: [], assignments: {} }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const serperKey = await getSetting("serper_api_key") || Deno.env.get("SERPER_API_KEY") || "";
      if (!serperKey) {
        return new Response(JSON.stringify({ error: "Serper API key не настроен" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Лимит: первые 40 ключевых для SERP-кластеризации (экономим запросы)
      const limited = items.slice(0, 40);
      const enriched: { keyword: string; urls: string[]; score: number }[] = [];
      // Параллельно пакетами по 5
      for (let i = 0; i < limited.length; i += 5) {
        const batch = limited.slice(i, i + 5);
        const results = await Promise.all(batch.map(async (it) => {
          const urls = await fetchSerpUrls(it.keyword, region, serperKey);
          return { keyword: it.keyword, urls, score: it.score };
        }));
        enriched.push(...results);
      }
      // Остальные кладём в одиночные кластеры
      const tail = items.slice(40).map((it) => ({ keyword: it.keyword, urls: [], score: it.score }));
      const all = [...enriched, ...tail];

      const groups = clusterByIntersection(all, 0.4);
      const clusters: { id: string; name: string; keywords: string[] }[] = [];
      const assignments: Record<string, string> = {};
      for (const [id, kws] of groups.entries()) {
        const name = kws.length > 1 ? await nameCluster(kws) : kws[0];
        clusters.push({ id, name, keywords: kws });
        for (const kw of kws) assignments[kw] = id;
      }
      return new Response(JSON.stringify({ clusters, assignments }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("semantic-core error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});