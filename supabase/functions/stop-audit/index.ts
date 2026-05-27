import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);

    const { job_id } = await req.json();
    if (!job_id) return json({ error: "job_id required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: job } = await admin
      .from("crawl_jobs").select("id, user_id").eq("id", job_id).maybeSingle();
    if (!job || job.user_id !== userData.user.id) return json({ error: "Job not found" }, 404);

    // Best-effort stop call to external crawler
    const base = Deno.env.get("CRAWLER_BASE_URL");
    const secret = Deno.env.get("CRAWLER_SECRET");
    let crawlerOk = false;
    if (base && secret) {
      try {
        const res = await fetch(
          `${base.replace(/\/$/, "")}/stop/${encodeURIComponent(job_id)}?secret=${encodeURIComponent(secret)}`,
          { method: "POST" },
        );
        crawlerOk = res.ok;
      } catch { /* ignore */ }
    }

    await admin
      .from("crawl_jobs")
      .update({
        status: "error",
        error_message: "Остановлено пользователем",
        finished_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    return json({ ok: true, crawler_ok: crawlerOk }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}