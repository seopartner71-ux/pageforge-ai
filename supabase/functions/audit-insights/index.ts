import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { job_id } = await req.json();
    if (!job_id) return json({ error: "job_id is required" }, 400);

    let OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY") ?? "";
    if (!OPENROUTER_API_KEY && SERVICE_ROLE) {
      try {
        const sb = createClient(SUPABASE_URL, SERVICE_ROLE);
        const { data } = await sb
          .from("system_settings")
          .select("key_value")
          .eq("key_name", "openrouter_api_key")
          .maybeSingle();
        OPENROUTER_API_KEY = String((data as any)?.key_value ?? "").trim();
      } catch { /* ignore */ }
    }
    if (!OPENROUTER_API_KEY) return json({ error: "OPENROUTER_API_KEY не настроен" }, 500);

    const { data: job } = await supabase
      .from("crawl_jobs").select("domain").eq("id", job_id).maybeSingle();

    const { data: stats } = await supabase
      .from("crawl_stats").select("*").eq("job_id", job_id).maybeSingle();

    const { data: issues } = await supabase
      .from("crawl_issues").select("code, severity, type").eq("job_id", job_id);

    const groups = new Map<string, { code: string; severity: string; type: string; count: number }>();
    for (const i of issues ?? []) {
      const k = `${i.severity}|${i.code}`;
      const g = groups.get(k);
      if (g) g.count += 1;
      else groups.set(k, { code: i.code, severity: i.severity, type: i.type, count: 1 });
    }
    const sevOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const grouped = Array.from(groups.values()).sort((a, b) => {
      const sa = sevOrder[a.severity] ?? 3, sb = sevOrder[b.severity] ?? 3;
      return sa !== sb ? sa - sb : b.count - a.count;
    });

    const summary = {
      site: job?.domain || "-",
      total_pages: stats?.total_pages ?? 0,
      score: stats?.score ?? 0,
      critical: stats?.critical_count ?? 0,
      warnings: stats?.warning_count ?? 0,
      info: stats?.info_count ?? 0,
      avg_ttfb_ms: stats?.avg_load_time_ms ?? 0,
      top_issues: grouped.slice(0, 30)
        .map((g) => `[${g.severity}] ${g.code} (${g.type}) - ${g.count} стр.`).join("\n"),
    };

    const prompt = `Ты - старший SEO-специалист. Проанализируй результаты технического аудита сайта и дай краткие выводы и рекомендации на русском.

Сайт: ${summary.site}
Всего страниц: ${summary.total_pages}
Оценка сайта: ${summary.score}/100
Критических ошибок: ${summary.critical}
Предупреждений: ${summary.warnings}
Информационных: ${summary.info}
Средний TTFB: ${summary.avg_ttfb_ms} мс

Топ проблем (код / тип / кол-во страниц):
${summary.top_issues || "Проблем не обнаружено"}

Верни СТРОГО валидный JSON по схеме:
{
  "verdict": "1-2 предложения общего вердикта",
  "key_findings": ["3-5 ключевых выводов"],
  "recommendations": [
    { "priority": "high" | "medium" | "low", "action": "конкретное действие", "reason": "зачем" }
  ]
}
Дай 4-6 рекомендаций, сначала критичные. Без обёрток \`\`\`json.`;

    const aiResp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://seo-modul.pro",
        "X-Title": "SEO-Audit Insights",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Ты эксперт по техническому SEO. Отвечай только валидным JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (aiResp.status === 402) return json({ error: "AI credits exhausted" }, 402);
    if (aiResp.status === 429) return json({ error: "Rate limited" }, 429);
    if (!aiResp.ok) return json({ error: "AI failed", detail: await aiResp.text() }, 500);

    const aiJson = await aiResp.json();
    let content = aiJson?.choices?.[0]?.message?.content ?? "";
    content = content.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    let parsed: any = null;
    try { parsed = JSON.parse(content); }
    catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) { try { parsed = JSON.parse(m[0]); } catch { /* ignore */ } }
    }
    if (!parsed) return json({ error: "AI returned non-JSON", raw: content }, 500);

    return json({ insights: parsed, generated_at: new Date().toISOString() }, 200);
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