import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

const MAX_ACTIVE_JOBS = 5;
const MAX_DAILY_JOBS = 50;

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
    const seedsRaw = (body as any).seeds;
    const seeds: string[] = Array.isArray(seedsRaw)
      ? seedsRaw.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    const region = String((body as any).region || "Москва").slice(0, 100);
    const engineRaw = String((body as any).engine || "yandex");
    const engine: "yandex" | "google" = engineRaw === "google" ? "google" : "yandex";
    const projectId = (body as any).project_id ? String((body as any).project_id) : null;
    const enabledSourcesRaw = (body as any).enabled_sources;
    const VALID_SOURCES = new Set(["autocomplete", "suggestions", "competitors", "ai"]);
    let enabledSources: string[] = Array.isArray(enabledSourcesRaw)
      ? enabledSourcesRaw.map((s) => String(s)).filter((s) => VALID_SOURCES.has(s))
      : [];
    if (!enabledSources.length) {
      enabledSources = ["autocomplete", "suggestions", "competitors", "ai"];
    }

    // Stop-words: пользовательские слова-исключения. Принимаем строку
    // через запятую/перевод строки или массив. Нормализуем к нижнему регистру,
    // обрезаем длину каждого слова и общее количество.
    const stopWordsRaw = (body as any).stop_words;
    let stopWordsInput: string[] = [];
    if (Array.isArray(stopWordsRaw)) {
      stopWordsInput = stopWordsRaw.map((s) => String(s));
    } else if (typeof stopWordsRaw === "string") {
      stopWordsInput = stopWordsRaw.split(/[,\n]/);
    }
    const stopWords: string[] = stopWordsInput
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0 && s.length <= 80)
      .slice(0, 100);

    if (!topic) return json(400, { error: "Тема не указана" });
    if (topic.length > 500) return json(400, { error: "Тема слишком длинная (макс. 500 символов)" });

    const sbAdmin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Admin role bypasses all limits
    const { data: isAdminData } = await sbAdmin.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    const isAdmin = !!isAdminData;

    let activeCount = 0;
    let dailyCount = 0;

    if (!isAdmin) {
      // Active jobs limit
      const { count: ac } = await sbAdmin
        .from("semantic_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .not("status", "in", "(done,error)");
      activeCount = ac ?? 0;

      if (activeCount >= MAX_ACTIVE_JOBS) {
        return json(429, { error: "Слишком много активных задач. Дождитесь завершения." });
      }

      // Daily limit
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: dc } = await sbAdmin
        .from("semantic_jobs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("created_at", since);
      dailyCount = dc ?? 0;

      if (dailyCount >= MAX_DAILY_JOBS) {
        return json(429, { error: `Достигнут дневной лимит (${MAX_DAILY_JOBS} анализов). Попробуйте завтра.` });
      }
    }

    // Create job
    const { data: jobRow, error: insErr } = await sbAdmin
      .from("semantic_jobs")
      .insert({
        user_id: userId,
        project_id: projectId,
        status: "pending",
        progress: 0,
        input_topic: topic,
        input_seeds: seeds,
        input_region: region,
        input_engine: engine,
        enabled_sources: enabledSources,
        input_stop_words: stopWords,
      })
      .select("id")
      .single();

    if (insErr || !jobRow) {
      console.error("[semantic-core-start] insert failed", insErr);
      return json(500, { error: "Не удалось создать задачу" });
    }

    // Fire-and-forget worker
    const workerUrl = `${SUPABASE_URL}/functions/v1/semantic-core-worker`;
    fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ job_id: jobRow.id }),
    }).catch((e) => console.warn("[semantic-core-start] worker dispatch failed", e));

    return json(200, {
      job_id: jobRow.id,
      status: "pending",
      daily_used: isAdmin ? 0 : dailyCount + 1,
      daily_limit: isAdmin ? null : MAX_DAILY_JOBS,
      is_admin: isAdmin,
    });
  } catch (e) {
    console.error("[semantic-core-start] error", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return json(500, { error: msg });
  }
});