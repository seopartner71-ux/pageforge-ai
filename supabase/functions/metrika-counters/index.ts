// Metrika Management API: list counters available to the user and verify access to a given counter.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

function j(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

async function ya(token: string, path: string) {
  const r = await fetch(`https://api-metrika.yandex.net${path}`, { headers: { Authorization: `OAuth ${token}` } });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return j({ error: "unauthorized" }, 401);
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: { user } } = await sb.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
    if (!user) return j({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "list");

    const { data: tok } = await sb.from("yandex_tokens").select("access_token, yandex_login").eq("user_id", user.id).maybeSingle();
    if (!tok?.access_token) return j({ error: "not_connected", message: "Яндекс-аккаунт не подключён" }, 200);

    if (action === "list") {
      // per_page max 1000, return owner + accessible counters
      const res = await ya(tok.access_token, "/management/v1/counters?per_page=200&field=permission,site,name,status,owner_login");
      if (!res.ok) return j({ error: "metrika_error", status: res.status, details: res.data, yandex_login: tok.yandex_login }, 200);
      const counters = (res.data?.counters ?? []).map((c: any) => ({
        id: c.id,
        name: c.name,
        site: c.site,
        status: c.status,
        permission: c.permission, // own | edit | view | public_stats
        owner_login: c.owner_login,
      }));
      return j({ ok: true, yandex_login: tok.yandex_login, counters });
    }

    if (action === "check") {
      const counterId = String(body.counter_id || "").trim();
      if (!counterId) return j({ error: "counter_id_required" }, 400);
      const res = await ya(tok.access_token, `/management/v1/counter/${counterId}?field=permission,site,name,owner_login,status`);
      if (res.status === 403) {
        return j({ ok: false, access: "denied", yandex_login: tok.yandex_login, message: "Нет доступа к счётчику. Владелец должен предоставить доступ." }, 200);
      }
      if (res.status === 404) {
        return j({ ok: false, access: "not_found", message: "Счётчик не найден. Проверьте ID." }, 200);
      }
      if (!res.ok) {
        return j({ ok: false, access: "error", status: res.status, details: res.data }, 200);
      }
      const c = res.data?.counter;
      // Validate read access by issuing a tiny stat request
      const today = new Date().toISOString().slice(0, 10);
      const probe = await fetch(
        `https://api-metrika.yandex.net/stat/v1/data?ids=${counterId}&metrics=ym:s:visits&date1=${today}&date2=${today}`,
        { headers: { Authorization: `OAuth ${tok.access_token}` } },
      );
      const probeData = await probe.json().catch(() => ({}));
      const canRead = probe.ok;
      return j({
        ok: true,
        access: canRead ? "granted" : "denied",
        permission: c?.permission ?? null,
        counter: { id: c?.id, name: c?.name, site: c?.site, owner_login: c?.owner_login, status: c?.status },
        yandex_login: tok.yandex_login,
        probe_error: canRead ? null : probeData,
      });
    }

    return j({ error: "unknown_action" }, 400);
  } catch (e) {
    return j({ error: (e as Error).message }, 500);
  }
});