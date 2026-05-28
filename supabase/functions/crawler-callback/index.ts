import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-crawler-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Public endpoint for the external crawler worker.
 * Auth: header `x-crawler-secret: <CRAWLER_SECRET>`
 *
 * Actions:
 *  - { action: "claim_job" }
 *  - { action: "update_job", job_id, status?, progress?, started_at?, finished_at?, error_message? }
 *  - { action: "add_pages", job_id, pages: [{ url, status_code?, depth?, title?, description?, h1?, canonical?, is_indexed?, load_time_ms?, word_count? }] }
 *  - { action: "add_issues", job_id, issues: [{ page_url?, type, code, severity?, message?, details? }] }
 *  - { action: "save_stats", job_id, stats: { total_pages, total_issues, critical_count, warning_count, info_count, avg_load_time_ms, score } }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const secret = Deno.env.get("CRAWLER_SECRET");
    if (!secret) return json({ error: "CRAWLER_SECRET not configured" }, 500);
    const provided = req.headers.get("x-crawler-secret");
    if (provided !== secret) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const action = body?.action as string;
    const job_id = body?.job_id as string;
    if (!action) return json({ error: "action is required" }, 400);

    console.log(`[crawler-callback] action=${action} job_id=${job_id ?? "-"} keys=${Object.keys(body).join(",")}`);

    if (action === "claim_job") {
      const { data, error } = await supabase.rpc("claim_next_crawl_job");
      if (error) throw error;
      const job = Array.isArray(data) && data.length > 0 ? data[0] : null;
      return json({ ok: true, job });
    }

    if (!job_id) return json({ error: "job_id is required" }, 400);

    const { data: job, error: jobErr } = await supabase
      .from("crawl_jobs").select("id").eq("id", job_id).maybeSingle();
    if (jobErr) throw jobErr;
    if (!job) return json({ error: "Job not found" }, 404);

    if (action === "update_job") {
      const patch: Record<string, unknown> = {};
      for (const k of ["status", "progress", "started_at", "finished_at", "error_message"]) {
        if (body[k] !== undefined) patch[k] = body[k];
      }
      const { error } = await supabase.from("crawl_jobs").update(patch).eq("id", job_id);
      if (error) throw error;
      return json({ ok: true });
    }

    if (action === "add_pages") {
      const pages = (body.pages || []) as any[];
      if (!Array.isArray(pages) || pages.length === 0) return json({ ok: true, inserted: 0 });
      const rows = pages.map((p) => ({ ...p, job_id }));
      const { data, error } = await supabase.from("crawl_pages").insert(rows).select("id, url");
      if (error) throw error;
      return json({ ok: true, inserted: data?.length ?? 0, pages: data });
    }

    if (action === "add_issues") {
      const issues = (body.issues || []) as any[];
      if (!Array.isArray(issues) || issues.length === 0) return json({ ok: true, inserted: 0 });
      const rows = issues.map((i) => ({
        job_id,
        page_url: i.page_url ?? null,
        type: i.type,
        code: i.code,
        severity: i.severity ?? "info",
        message: i.message ?? null,
        details: i.details ?? {},
      }));
      const { error } = await supabase.from("crawl_issues").insert(rows);
      if (error) throw error;
      return json({ ok: true, inserted: rows.length });
    }

    if (action === "save_stats") {
      const s = body.stats || {};
      const row = {
        job_id,
        total_pages: s.total_pages ?? 0,
        total_issues: s.total_issues ?? 0,
        critical_count: s.critical_count ?? 0,
        warning_count: s.warning_count ?? 0,
        info_count: s.info_count ?? 0,
        avg_load_time_ms: s.avg_load_time_ms ?? 0,
        score: s.score ?? 0,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("crawl_stats").upsert(row, { onConflict: "job_id" });
      if (error) throw error;
      return json({ ok: true });
    }

    // The external crawler also sends per-page deep analysis (mixed content, SSL,
    // analytics, structured data). Our schema doesn't persist all extras yet -
    // accept the payload, store any returned issues, and ack so the crawler
    // does not error.
    if (action === "analyze_page") {
      const issues = (body.issues || []) as any[];
      if (Array.isArray(issues) && issues.length > 0) {
        const rows = issues.map((i) => ({
          job_id,
          page_url: i.page_url ?? body.url ?? null,
          type: i.type ?? "onpage",
          code: i.code ?? "analyze",
          severity: i.severity ?? "info",
          message: i.message ?? null,
          details: i.details ?? {},
        }));
        await supabase.from("crawl_issues").insert(rows);
      }
      return json({ ok: true });
    }

    // Aliases used by the legacy Python worker
    if (action === "complete_job") {
      await supabase.from("crawl_jobs").update({
        status: "completed",
        progress: 100,
        finished_at: new Date().toISOString(),
      }).eq("id", job_id);
      if (body.stats) {
        await supabase.from("crawl_stats").upsert({
          job_id,
          total_pages: body.stats.total_pages ?? 0,
          total_issues: body.stats.total_issues ?? 0,
          critical_count: body.stats.critical_count ?? 0,
          warning_count: body.stats.warning_count ?? 0,
          info_count: body.stats.info_count ?? 0,
          avg_load_time_ms: body.stats.avg_load_time_ms ?? 0,
          score: body.stats.score ?? 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: "job_id" });
      }
      return json({ ok: true });
    }

    if (action === "update_progress") {
      await supabase.from("crawl_jobs").update({
        progress: body.progress ?? 0,
        status: "running",
      }).eq("id", job_id);
      return json({ ok: true });
    }

    return json({ error: `Unknown action: ${action}` }, 400);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("crawler-callback error:", msg);
    return json({ error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}