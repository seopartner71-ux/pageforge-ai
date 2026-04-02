import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results: { name: string; status: "ok" | "error"; message: string; time_ms: number }[] = [];

    // 1. Supabase connection
    const t1 = Date.now();
    try {
      const { count, error } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      results.push({
        name: "Database Connection",
        status: error ? "error" : "ok",
        message: error ? error.message : `Connected. ${count} profiles.`,
        time_ms: Date.now() - t1,
      });
    } catch (e: any) {
      results.push({ name: "Database Connection", status: "error", message: e.message, time_ms: Date.now() - t1 });
    }

    // 2. Fetch API keys
    const { data: settingsData } = await supabase.from("system_settings").select("key_name, key_value");
    const dbKeys: Record<string, string> = {};
    for (const s of settingsData || []) { if (s.key_value) dbKeys[s.key_name] = s.key_value; }

    // 3. Serper API check
    const t2 = Date.now();
    const SERPER_KEY = dbKeys["serper_api_key"] || Deno.env.get("SERPER_API_KEY");
    if (SERPER_KEY) {
      try {
        const res = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: { "X-API-KEY": SERPER_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ q: "test", num: 1 }),
        });
        results.push({
          name: "Serper API",
          status: res.ok ? "ok" : "error",
          message: res.ok ? `Status ${res.status}. Key valid.` : `Status ${res.status}: ${await res.text()}`,
          time_ms: Date.now() - t2,
        });
      } catch (e: any) {
        results.push({ name: "Serper API", status: "error", message: e.message, time_ms: Date.now() - t2 });
      }
    } else {
      results.push({ name: "Serper API", status: "error", message: "No API key configured", time_ms: 0 });
    }

    // 4. OpenRouter API check
    const t3 = Date.now();
    const OPENROUTER_KEY = dbKeys["openai_api_key"] || Deno.env.get("OPENROUTER_API_KEY");
    if (OPENROUTER_KEY) {
      try {
        const res = await fetch("https://openrouter.ai/api/v1/models", {
          headers: { Authorization: `Bearer ${OPENROUTER_KEY}` },
        });
        results.push({
          name: "OpenRouter API",
          status: res.ok ? "ok" : "error",
          message: res.ok ? `Status ${res.status}. Key valid.` : `Status ${res.status}`,
          time_ms: Date.now() - t3,
        });
      } catch (e: any) {
        results.push({ name: "OpenRouter API", status: "error", message: e.message, time_ms: Date.now() - t3 });
      }
    } else {
      results.push({ name: "OpenRouter API", status: "error", message: "No API key configured", time_ms: 0 });
    }

    // 5. Jina Reader check
    const t4 = Date.now();
    try {
      const res = await fetch("https://r.jina.ai/https://example.com", {
        headers: { Accept: "text/markdown", "X-Return-Format": "markdown" },
      });
      results.push({
        name: "Jina Reader",
        status: res.ok ? "ok" : "error",
        message: res.ok ? `Status ${res.status}. Working.` : `Status ${res.status}`,
        time_ms: Date.now() - t4,
      });
    } catch (e: any) {
      results.push({ name: "Jina Reader", status: "error", message: e.message, time_ms: Date.now() - t4 });
    }

    // 6. Performance stats (avg analysis time)
    const { data: recentAnalyses } = await supabase
      .from("analyses")
      .select("id, created_at, updated_at, status")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(20);

    let avgTimeMs = 0;
    let slowCount = 0;
    if (recentAnalyses && recentAnalyses.length > 0) {
      const times = recentAnalyses.map(a => {
        const diff = new Date(a.updated_at).getTime() - new Date(a.created_at).getTime();
        if (diff > 30000) slowCount++;
        return diff;
      });
      avgTimeMs = times.reduce((s, t) => s + t, 0) / times.length;
    }

    const allOk = results.every(r => r.status === "ok");

    return new Response(JSON.stringify({
      overall: allOk ? "ok" : "error",
      checks: results,
      performance: {
        avgAnalysisTime: `${(avgTimeMs / 1000).toFixed(1)}s`,
        slowAnalyses: slowCount,
        totalRecent: recentAnalyses?.length || 0,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("system-check error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
