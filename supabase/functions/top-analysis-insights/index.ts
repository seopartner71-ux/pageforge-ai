import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopRow { query: string; domain: string; url: string; position: number }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { rows = [] } = (await req.json()) as { rows: TopRow[] };

    if (!Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: 'Нет данных для анализа' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const { data: keyRow } = await sb
      .from('system_settings')
      .select('key_value')
      .eq('key_name', 'OPENROUTER_API_KEY')
      .maybeSingle();
    const apiKey = keyRow?.key_value || Deno.env.get('OPENROUTER_API_KEY');

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenRouter API ключ не настроен' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Агрегация: для каждого домена — позиции по всем запросам
    const byDomain = new Map<string, { positions: number[]; queries: Set<string>; top3: number; top10: number }>();
    const queries = new Set<string>();
    for (const r of rows) {
      queries.add(r.query);
      const d = byDomain.get(r.domain) || { positions: [], queries: new Set(), top3: 0, top10: 0 };
      d.positions.push(r.position);
      d.queries.add(r.query);
      if (r.position <= 3) d.top3++;
      if (r.position <= 10) d.top10++;
      byDomain.set(r.domain, d);
    }

    const stats = [...byDomain.entries()].map(([domain, d]) => ({
      domain,
      coverage: d.queries.size,
      avgPos: +(d.positions.reduce((s, p) => s + p, 0) / d.positions.length).toFixed(1),
      top3: d.top3,
      top10: d.top10,
    }));

    const top10 = stats.sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos).slice(0, 10);

    const prompt = `Ты SEO-аналитик. Проанализируй данные присутствия доменов в топе поисковой выдачи. Дай развёрнутый отчёт на русском в формате Markdown.

Всего запросов: ${queries.size}
Всего доменов: ${stats.length}

ТОП-10 доменов по охвату запросов:
${JSON.stringify(top10, null, 2)}

Структура ответа (используй заголовки ## и списки):
## Доминирующие игроки
Кто реально доминирует в нише (охват + средняя позиция)
## Универсальные лидеры
Домены, представленные в большинстве запросов
## Узкие специалисты
Домены с малым охватом, но высокими позициями
## Слабые места рынка
Запросы со слабой конкуренцией, точки входа
## Рекомендации
Конкретные действия для конкуренции в этой нише

Будь конкретным, используй цифры из данных.`;

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const text = await aiRes.text();
      console.error('OpenRouter error:', aiRes.status, text);
      return new Response(JSON.stringify({ error: `AI сервис недоступен (${aiRes.status})` }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || 'Не удалось получить ответ от AI';

    return new Response(JSON.stringify({ markdown: content }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('top-analysis-insights error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
