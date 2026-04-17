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

    const AGGREGATOR_KEYWORDS = [
      'wildberries', 'wb.ru', 'ozon', 'market.yandex', 'aliexpress', 'avito', 'youla',
      'sbermegamarket', 'megamarket', 'lamoda', 'detmir',
      'vseinstrumenti', 'vi.ru', 'leroymerlin', 'leroy-merlin', 'petrovich.ru',
      'castorama', 'obi.ru', 'maxidom', '220-volt', '220volt', 'vimos.ru',
      'mvideo', 'eldorado', 'dns-shop', 'citilink', 'technopark',
      'exist.ru', 'emex.ru', 'autodoc', 'kolesa-darom',
      '2gis', 'zoon.ru', 'yell.ru', 'tiu.ru', 'pulscen', 'all.biz', 'blizko', 'flagma',
      'rusprofile', 'list-org',
      'youtube', 'rutube', 'dzen', 'zen.yandex',
      'wikipedia', 'pikabu', 'otzovik', 'irecommend',
      'vk.com', 'ok.ru', 't.me', 'instagram', 'tiktok',
      'drom.ru', 'auto.ru', 'cian.ru', 'domclick',
    ];
    const isAggregator = (d: string) => {
      const x = (d || '').toLowerCase();
      return AGGREGATOR_KEYWORDS.some(k => x.includes(k));
    };

    // Передаём ВСЕХ конкурентов (не только топ-5), помечая агрегаторы
    const compact = competitors.map((c: any) => ({
      домен: c.domain,
      агрегатор: isAggregator(c.domain || ''),
      трафик: c.traffic,
      видимость: c.visibility,
      топ1: c.top1,
      топ10: c.top10,
      страниц: c.pages,
      охват: c.keysCoverage,
      бюджет_контекст: c.contextBudget,
    }));

    const real = compact.filter(c => !c.агрегатор);
    const aggr = compact.filter(c => c.агрегатор);

    const prompt = `Ты SEO-аналитик. Проанализируй данные конкурентов и дай развёрнутый аналитический отчёт на русском языке в формате Markdown.

ВАЖНО: Маркетплейсы и агрегаторы (Wildberries, Ozon, Яндекс.Маркет, Avito, YouTube, Wikipedia и т.п.) НЕ являются прямыми конкурентами для коммерческих сайтов. Упомяни их отдельным коротким блоком, но НЕ учитывай в основных рейтингах лидеров и рекомендациях. Фокус — на НАСТОЯЩИХ конкурентах.

Всего доменов: ${compact.length} (настоящих конкурентов: ${real.length}, агрегаторов: ${aggr.length})

Настоящие конкуренты (анализируй полностью):
${JSON.stringify(real, null, 2)}

Маркетплейсы/агрегаторы (для справки, НЕ как конкурентов):
${JSON.stringify(aggr, null, 2)}

Структура ответа (используй заголовки ## и списки):
## Лидеры рынка (без агрегаторов)
Кто лидер по трафику, видимости, ТОП-1 среди настоящих конкурентов и почему
## Слабые места конкурентов
По каждому ключевому домену — проблемы
## Влияние агрегаторов
Короткий блок: насколько маркетплейсы давят на нишу
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
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 4000,
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
