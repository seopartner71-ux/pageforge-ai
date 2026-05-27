// Простая проверка размещения ссылок: GET donor_url, ищем acceptor_url в HTML.
// 200 + найдено = active, 200 без вхождения = lost, иначе lost с кодом.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UA = "Mozilla/5.0 (compatible; SEOAuditLinkChecker/1.0)";

function normalizeUrl(u: string) {
  try {
    const url = new URL(u);
    return url.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return u.trim().toLowerCase().replace(/\/$/, "");
  }
}

async function checkOne(donor: string, acceptor: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const resp = await fetch(donor, {
      method: "GET",
      headers: { "User-Agent": UA, Accept: "text/html,*/*" },
      signal: ctrl.signal,
      redirect: "follow",
    });
    const code = resp.status;
    if (!resp.ok) {
      return { status: "lost", code, error: `HTTP ${code}` };
    }
    const html = await resp.text();
    const target = normalizeUrl(acceptor);
    const host = (() => { try { return new URL(acceptor).host.toLowerCase(); } catch { return ""; } })();
    const path = (() => { try { return new URL(acceptor).pathname.replace(/\/$/, "").toLowerCase(); } catch { return ""; } })();
    const haystack = html.toLowerCase();
    const found = haystack.includes(target) || (host && haystack.includes(host) && (!path || haystack.includes(path)));
    return found
      ? { status: "active" as const, code, error: null as string | null }
      : { status: "lost" as const, code, error: "Ссылка не найдена на странице" };
  } catch (e) {
    return { status: "lost" as const, code: 0, error: e instanceof Error ? e.message : "fetch error" };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = userData.user.id;
    const body = await req.json().catch(() => ({}));
    const ids: string[] | undefined = Array.isArray(body?.ids) ? body.ids : undefined;

    let q = supabase.from("link_profile").select("id, donor_url, acceptor_url").eq("user_id", userId);
    if (ids && ids.length) q = q.in("id", ids);
    const { data: rows, error } = await q;
    if (error) throw error;
    if (!rows || rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, checked: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Параллельно пачками по 5
    const results: Array<{ id: string; status: string; code: number; error: string | null }> = [];
    const batchSize = 5;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const out = await Promise.all(batch.map(async (r) => {
        const res = await checkOne(r.donor_url, r.acceptor_url);
        return { id: r.id, ...res };
      }));
      results.push(...out);
    }

    const now = new Date().toISOString();
    for (const r of results) {
      await supabase.from("link_profile").update({
        status: r.status,
        last_status_code: r.code || null,
        last_error: r.error,
        last_checked_at: now,
      }).eq("id", r.id).eq("user_id", userId);
    }

    return new Response(JSON.stringify({ ok: true, checked: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});