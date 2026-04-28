import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

interface PositionItem { position: number; domain: string; url: string; title: string }
interface Snapshot { date: string; items: PositionItem[] }

async function fetchDataForSEOHistory(keyword: string, engine: "yandex" | "google", depth: number): Promise<Snapshot[]> {
  if (!DFS_LOGIN || !DFS_PASSWORD) return [];
  // NOTE: yandex history endpoint doesn't exist on DFS — only google has /history.
  // For yandex we return [] and rely on accumulated own snapshots + current SERP.
  if (engine === "yandex") {
    console.log("[DFS] yandex history endpoint not available, skipping");
    return [];
  }
  const path = "https://api.dataforseo.com/v3/serp/google/organic/history/live/advanced";
  const auth = btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`);
  const today = new Date();
  const from = new Date(today.getFullYear() - 2, today.getMonth(), 1);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const body = [{
    keyword,
    location_name: "Russia",
    language_code: "ru",
    date_from: fmt(from),
    date_to: fmt(today),
    depth,
  }];
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log("[DFS] status:", res.status);
    if (!res.ok) {
      const txt = await res.text();
      console.log("[DFS] non-ok body:", txt.slice(0, 500));
      return [];
    }
    const data = await res.json();
    console.log("[DFS] task status:", data?.tasks?.[0]?.status_code, "msg:", data?.tasks?.[0]?.status_message);
    console.log("[DFS] result items count:", data?.tasks?.[0]?.result?.[0]?.items?.length);
    const items = data?.tasks?.[0]?.result?.[0]?.items ?? [];
    const snaps: Snapshot[] = [];
    for (const snap of items) {
      const date = snap?.date || snap?.check_url_date || snap?.datetime;
      const arr = snap?.items ?? [];
      const positions: PositionItem[] = [];
      for (const it of arr) {
        if (it?.type !== "organic" && it?.type !== undefined) continue;
        const rank = it?.rank_absolute ?? it?.rank_group;
        if (!rank || rank > depth) continue;
        positions.push({
          position: rank,
          domain: it?.domain || getDomain(it?.url || ""),
          url: it?.url || "",
          title: it?.title || "",
        });
      }
      if (positions.length && date) {
        snaps.push({ date: String(date).slice(0, 10), items: positions });
      }
    }
    return snaps;
  } catch (e) {
    console.error("[DFS] error", e);
    return [];
  }
}

type SerperResult = { items: PositionItem[]; error?: "no_credits" | "no_key" | "api_error"; message?: string };

async function fetchCurrentSerper(keyword: string, engine: "yandex" | "google", depth: number, region: string): Promise<SerperResult> {
  console.log("[Serper] key configured:", !!SERPER_API_KEY);
  if (!SERPER_API_KEY) {
    console.error("[Serper] SERPER_API_KEY missing in edge function secrets");
    return { items: [], error: "no_key", message: "SERPER_API_KEY not configured" };
  }
  try {
    const url = "https://google.serper.dev/search";
    const payload = {
      q: keyword,
      gl: "ru",
      hl: "ru",
      location: region || "Moscow,Russia",
      num: Math.max(depth, 10),
    };
    console.log("[Serper] requesting:", keyword, "region:", region, "depth:", depth);
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    console.log("[Serper] status:", res.status);
    if (!res.ok) {
      const errTxt = await res.text();
      console.error("[Serper] non-ok body:", errTxt.slice(0, 500));
      const isNoCredits = res.status === 400 && /not enough credits/i.test(errTxt);
      return {
        items: [],
        error: isNoCredits ? "no_credits" : "api_error",
        message: isNoCredits ? "Закончились кредиты Serper.dev" : `Serper API ${res.status}`,
      };
    }
    const data = await res.json();
    console.log("[Serper] organic count:", data?.organic?.length, "error:", data?.error);
    const organic = data?.organic ?? [];
    const out = organic.slice(0, depth).map((it: any, i: number): PositionItem => ({
      position: it?.position || i + 1,
      domain: getDomain(it?.link || ""),
      url: it?.link || "",
      title: it?.title || "",
    }));
    console.log("[Serper] mapped items:", out.length);
    return { items: out };
  } catch (e) {
    console.error("[Serper] error", e);
    return { items: [], error: "api_error", message: String(e) };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const reqUrl = new URL(req.url);
    if (reqUrl.searchParams.get("action") === "health") {
      if (!SERPER_API_KEY) return json({ serper: "no_key" });
      const probe = await fetch("https://google.serper.dev/search", {
        method: "POST",
        headers: { "X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ q: "test", gl: "ru", hl: "ru", num: 1 }),
      });
      const txt = await probe.text();
      if (probe.ok) return json({ serper: "ok" });
      if (probe.status === 400 && /not enough credits/i.test(txt)) return json({ serper: "no_credits", message: "Закончились кредиты Serper.dev" });
      return json({ serper: "api_error", status: probe.status, message: txt.slice(0, 200) });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const token = authHeader.replace("Bearer ", "");
    const { data: cd, error: ce } = await supabase.auth.getUser(token);
    if (ce || !cd?.user) return json({ error: "Unauthorized" }, 401);

    const { data: profile } = await supabase
      .from("profiles")
      .select("credits, is_approved")
      .eq("user_id", cd.user.id)
      .single();
    if (!profile || !profile.is_approved) return json({ error: "Account not approved" }, 403);

    const isAdmin = !!(await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", cd.user.id)
      .eq("role", "admin")
      .maybeSingle()).data;

    const COST = 3;
    if (!isAdmin && profile.credits < COST) return json({ error: "Insufficient credits" }, 403);

    const body = await req.json().catch(() => ({}));
    const keyword = String(body?.keyword || "").trim();
    const region = String(body?.region || "Россия").trim();
    const engine = (body?.engine === "google" ? "google" : "yandex") as "yandex" | "google";
    const depth = Math.max(5, Math.min(50, Number(body?.depth) || 10));
    const projectId = body?.project_id || null;
    if (!keyword) return json({ error: "keyword required" }, 400);

    // 1. Try DataForSEO history
    let history = await fetchDataForSEOHistory(keyword, engine, depth);
    let usedFallback = false;

    // 2. Always also fetch current via Serper (or DFS empty)
    const serperResult = await fetchCurrentSerper(keyword, engine, depth, region);
    const current = serperResult.items;
    console.log("[serp-history] DFS history snapshots:", history.length, "current items:", current.length);

    // 3. Save current snapshot
    if (current.length) {
      console.log("[Snapshot] saving:", { keyword, region, engine, results_count: current.length });
      await supabase.from("serp_snapshots").insert({
        user_id: cd.user.id,
        project_id: projectId,
        keyword,
        region,
        engine,
        snapshot_date: new Date().toISOString().slice(0, 10),
        depth,
        results: current,
      });
    }

    // 4. Load own historical snapshots
    const { data: ownSnaps } = await supabase
      .from("serp_snapshots")
      .select("snapshot_date, results")
      .eq("user_id", cd.user.id)
      .eq("keyword", keyword)
      .eq("region", region)
      .eq("engine", engine)
      .order("snapshot_date", { ascending: true });

    const ownAsSnaps: Snapshot[] = (ownSnaps || []).map((s: any) => ({
      date: String(s.snapshot_date),
      items: (s.results as PositionItem[]) || [],
    }));

    // 5. Merge & dedupe by date (DFS wins, fallback to own)
    const byDate = new Map<string, Snapshot>();
    for (const s of history) byDate.set(s.date, s);
    for (const s of ownAsSnaps) if (!byDate.has(s.date)) byDate.set(s.date, s);

    if (byDate.size === 0 && current.length) {
      usedFallback = true;
      const today = new Date().toISOString().slice(0, 10);
      byDate.set(today, { date: today, items: current });
    }

    const merged = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));

    // Deduct credits (skip for admin, skip if Serper out of credits AND no history loaded)
    const noUsefulData = current.length === 0 && history.length === 0 && ownAsSnaps.length === 0;
    if (!isAdmin && !noUsefulData) {
      await supabase
        .from("profiles")
        .update({ credits: Math.max(0, profile.credits - COST) })
        .eq("user_id", cd.user.id);
    }

    return json({
      keyword,
      region,
      engine,
      depth,
      snapshots: merged,
      current,
      fallback: usedFallback,
      serper_error: serperResult.error || null,
      serper_message: serperResult.message || null,
      message: usedFallback
        ? "Исторические данные недоступны. Показываем текущую выдачу. История накапливается с первого запроса."
        : null,
    });
  } catch (e: any) {
    console.error("[serp-history] fatal", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});