import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const DFS_LOGIN = Deno.env.get("DATAFORSEO_LOGIN") ?? "";
const DFS_PASSWORD = Deno.env.get("DATAFORSEO_PASSWORD") ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth — only signed-in admins should call this
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Unauthorized" });
    const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sbUser.auth.getUser(token);
    if (!u?.user) return json(401, { error: "Unauthorized" });

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRow } = await sbAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) return json(403, { error: "Admin role required" });

    if (!DFS_LOGIN || !DFS_PASSWORD) {
      return json(200, {
        configured: false,
        ok: false,
        error: "DATAFORSEO_LOGIN / DATAFORSEO_PASSWORD не заданы в Supabase Secrets",
      });
    }

    const basic = btoa(`${DFS_LOGIN}:${DFS_PASSWORD}`);
    const resp = await fetch("https://api.dataforseo.com/v3/appendix/user_data", {
      method: "GET",
      headers: { Authorization: `Basic ${basic}` },
    });
    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      return json(200, {
        configured: true,
        ok: false,
        status: resp.status,
        error: `DataForSEO ${resp.status}: ${text.slice(0, 200)}`,
      });
    }
    const data = await resp.json().catch(() => ({}));
    const u0 = data?.tasks?.[0]?.result?.[0];
    const balance = Number(u0?.money?.balance ?? 0);
    const login = String(u0?.login ?? DFS_LOGIN);
    return json(200, { configured: true, ok: true, balance, login });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json(500, { configured: true, ok: false, error: msg });
  }
});