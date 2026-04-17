import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { competitors = [] } = (await req.json()) as { competitors: any[] };

    if (!Array.isArray(competitors) || competitors.length === 0) {
      return new Response(JSON.stringify({ error: 'Нет данных конкурентов' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);
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

    // Берём топ-5 ключевых метрик каждого домена
    const compact = competitors.map((c: any) => ({
      domен: c.domain,
      трафик: c.traffic,
      видимость: c.visibility,
      топ1: c.top1,
      топ10: c.top10,
      страниц: c.pages,
      охват: c.keysCoverage,
      бюджет_контекст: c.contextBudget,
    }));

    const prompt = `Ты SEO-аналитик. Проанализируй данные конкурентов и дай развёрнутый аналитический отчёт на русском языке в формате Markdown.

Данные:
${JSON.stringify(compact, null, 2)}

Структура ответа (используй заголовки ## и списки):
## Лидеры рынка
Кто лидер по трафику, видимости, ТОП-1 и почему
## Слабые места конкурентов
По каждому домену — ключевые проблемы
## Рекомендации
Конкретные действия, на чьём опыте можно учиться

Будь конкретным, используй цифры из данных.`;

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
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
    console.error('competitors-insights error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
