const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Health-check for the external crawler worker.
 * Returns { online: boolean, latency_ms, status? } based on CRAWLER_BASE_URL.
 * If CRAWLER_BASE_URL is not configured, returns { online: false, error: "not_configured" }.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const base = Deno.env.get("CRAWLER_BASE_URL") || "http://155.212.221.64:8000";

  const started = Date.now();
  const paths = ["/health", "/", "/docs"];
  let lastErr: unknown = null;
  for (const path of paths) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${base.replace(/\/$/, "")}${path}`, { signal: controller.signal });
      clearTimeout(timeout);
      return json({ online: true, status: res.status, path, latency_ms: Date.now() - started });
    } catch (e) {
      lastErr = e;
    }
  }
  return json({
    online: false,
    error: lastErr instanceof Error ? lastErr.message : String(lastErr),
    latency_ms: Date.now() - started,
  });
});

function json(data: unknown) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}