// proxy-test — admin-only health check для relay-прокси.
// 1) читает proxy_url/proxy_token из system_settings (или env)
// 2) делает тестовый запрос через relay к публичному IP-эху и к DataForSEO
// 3) возвращает { ok, ip, country, dfsStatus, error }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

function sb() { return createClient(SUPABASE_URL, SERVICE_ROLE); }

async function getProxyConfig() {
  let url = Deno.env.get("PROXY_URL") ?? "";
  let token = Deno.env.get("PROXY_TOKEN") ?? "";
  try {
    const { data } = await sb()
      .from("system_settings")
      .select("key_name,key_value")
      .in("key_name", ["proxy_url", "proxy_token"]);
    for (const row of (data ?? []) as Array<{ key_name: string; key_value: string }>) {
      if (row.key_name === "proxy_url" && row.key_value) url = row.key_value;
      else if (row.key_name === "proxy_token" && row.key_value) token = row.key_value;
    }
  } catch (_e) { /* noop */ }
  return { url, token };
}

async function callRelay(url: string, opts: {
  proxyUrl: string;
  token: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
}) {
  console.log("[proxy-test] relay URL:", opts.proxyUrl);
  console.log("[proxy-test] target URL:", url);
  console.log("[proxy-test] token present:", !!opts.token);
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => {
    console.error("[proxy-test] aborting after 20s timeout");
    ctrl.abort();
  }, 20_000);
  try {
    console.log("[proxy-test] fetch started");
    const r = await fetch(opts.proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(opts.token ? { "x-proxy-token": opts.token } : {}),
      },
      body: JSON.stringify({
        url,
        method: opts.method ?? "GET",
        headers: opts.headers ?? {},
        body: opts.body ?? null,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(timeoutId);
    console.log(`[proxy-test] fetch status: ${r.status} (${Date.now() - t0}ms)`);
    const txt = await r.text();
    console.log(`[proxy-test] relay body length: ${txt.length}, preview: ${txt.slice(0, 200)}`);
    let env: { status?: number; headers?: Record<string, string>; body?: string } | null = null;
    try { env = JSON.parse(txt); } catch { console.warn("[proxy-test] relay returned non-JSON"); }
    return { relayStatus: r.status, env, raw: txt };
  } catch (e) {
    clearTimeout(timeoutId);
    const msg = (e as Error).message;
    const name = (e as Error).name;
    console.error(`[proxy-test] fetch error after ${Date.now() - t0}ms: name=${name} message=${msg}`);
    throw e;
  }
}

// Безопасный парсинг inner JSON из env.body.
// Возвращает { json, text } — json есть только если body валидный JSON.
function parseInnerBody(body: unknown): { json: any | null; text: string } {
  if (body == null) return { json: null, text: "" };
  const text = typeof body === "string" ? body : JSON.stringify(body);
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cfg = await getProxyConfig();
    if (!cfg.url) {
      return new Response(JSON.stringify({
        ok: false,
        error: "PROXY_URL не задан в админке",
      }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1) Проверка через ip-эхо (api.ipify.org возвращает текстовый IP)
    let ip = "";
    let country = "";
    let ipError = "";
    try {
      const ipRes = await callRelay("https://api.ipify.org?format=json", {
        proxyUrl: cfg.url, token: cfg.token, method: "GET",
      });
      if (ipRes.relayStatus !== 200 || !ipRes.env) {
        ipError = `Relay ответил ${ipRes.relayStatus} или вернул не-JSON: ${ipRes.raw.slice(0, 300)}`;
      } else if ((ipRes.env.status ?? 0) >= 400) {
        const inner = parseInnerBody(ipRes.env.body);
        ipError = `IP-эхо ответило ${ipRes.env.status}: ${inner.text.slice(0, 200)}`;
      } else {
        const inner = parseInnerBody(ipRes.env.body);
        if (inner.json && typeof inner.json.ip === "string") {
          ip = inner.json.ip.trim();
        } else {
          ip = inner.text.trim();
        }
      }
    } catch (e) {
      ipError = (e as Error).message;
    }

    // 2) Country lookup (бесплатный ipapi.co — через тот же прокси)
    if (ip && !ipError) {
      try {
        const cRes = await callRelay(`https://ipapi.co/${ip}/json/`, {
          proxyUrl: cfg.url, token: cfg.token, method: "GET",
        });
        const inner = parseInnerBody(cRes.env?.body);
        if (inner.json) {
          country = String(inner.json.country_name || inner.json.country || "").trim();
        }
      } catch { /* country optional */ }
    }

    // 3) Проверка DataForSEO через прокси (минимальный endpoint /user)
    let dfsStatus = 0;
    let dfsError = "";
    if (DFS_LOGIN && DFS_PASSWORD) {
      try {
        const auth = "Basic " + btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`);
        const dRes = await callRelay("https://api.dataforseo.com/v3/appendix/user_data", {
          proxyUrl: cfg.url, token: cfg.token, method: "GET",
          headers: { Authorization: auth },
        });
        dfsStatus = dRes.env?.status ?? dRes.relayStatus;
        if (dfsStatus >= 400) {
          const inner = parseInnerBody(dRes.env?.body);
          dfsError = `DataForSEO ответил ${dfsStatus}: ${inner.text.slice(0, 200)}`;
        }
      } catch (e) {
        dfsError = (e as Error).message;
      }
    }

    const ok = !!ip && !ipError && (!DFS_LOGIN || dfsStatus < 400);
    return new Response(JSON.stringify({
      ok,
      ip: ip || null,
      country: country || null,
      dfsStatus,
      ipError: ipError || null,
      dfsError: dfsError || null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});