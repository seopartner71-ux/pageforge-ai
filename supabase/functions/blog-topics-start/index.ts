import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const MAX_ACTIVE_JOBS = 3;
const MAX_DAILY_JOBS = 30;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json(401, { error: "Unauthorized" });

    const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: u } = await sbUser.auth.getUser(token);
    if (!u?.user) return json(401, { error: "Unauthorized" });
    const userId = u.user.id;

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const topic = String((body as any).topic || "").trim();
    const region = String((body as any).region || "Москва").slice(0, 100);
    const projectId = (body as any).project_id ? String((body as any).project_id) : null;

    if (!topic) return json(400, { error: "Тематика не указана" });
    if (topic.length > 300) return json(400, { error: "Тематика слишком длинная" });

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: isAdminData } = await sbAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const isAdmin = !!isAdminData;

    if (!isAdmin) {
      const { count: ac } = await sbAdmin
        .from("blog_topics_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("status", "in", "(done,error)");
      if ((ac ?? 0) >= MAX_ACTIVE_JOBS) {
        return json(429, { error: "Слишком много активных задач. Дождитесь завершения." });
      }

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dc } = await sbAdmin
        .from("blog_topics_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      if ((dc ?? 0) >= MAX_DAILY_JOBS) {
        return json(429, { error: `Достигнут дневной лимит (${MAX_DAILY_JOBS}).` });
      }
    }

    const { data: jobRow, error: insErr } = await sbAdmin
      .from("blog_topics_jobs")
      .insert({
        user_id: userId,
        project_id: projectId,
        status: "pending",
        progress: 0,
        input_topic: topic,
        input_region: region,
      })
      .select("id")
      .single();

    if (insErr || !jobRow) {
      console.error("[blog-topics-start] insert failed", insErr);
      return json(500, { error: "Не удалось создать задачу" });
    }

    const workerUrl = `${SUPABASE_URL}/functions/v1/blog-topics-worker`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ job_id: jobRow.id }),
    }).catch((e) => console.warn("[blog-topics-start] worker dispatch failed", e));

    return json(200, { job_id: jobRow.id, status: "pending", is_admin: isAdmin });
  } catch (e) {
    console.error("[blog-topics-start] error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});