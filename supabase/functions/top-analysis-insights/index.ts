import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TopRow { query: string; domain: string; url: string; position: number }

const AGGREGATOR_KEYWORDS = [
  'wildberries', 'wb.ru', 'ozon', 'market.yandex', 'aliexpress', 'avito', 'youla',
  'sbermegamarket', 'megamarket', 'lamoda', 'detmir', 'kazanexpress',
  '2gis', 'zoon.ru', 'yell.ru', 'tiu.ru', 'pulscen', 'satom', 'all.biz',
  'youtube', 'youtu.be', 'rutube', 'dzen', 'zen.yandex',
  'wikipedia', 'pikabu', 'otzovik', 'irecommend', 'flamp',
  'vk.com', 'vk.ru', 'ok.ru', 't.me', 'telegram.org', 'instagram', 'tiktok',
  'drom.ru', 'auto.ru', 'cian.ru', 'domclick',
  'otvet.mail.ru', 'thequestion',
  'rbc.ru', 'lenta.ru', 'kommersant',
];
function isAggregator(d: string): boolean {
  const x = (d || '').toLowerCase().trim();
  return AGGREGATOR_KEYWORDS.some(k => x.includes(k));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { rows = [], region = '', myDomain = '' } = (await req.json()) as { rows: TopRow[]; region?: string; myDomain?: string };

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
      isAggregator: isAggregator(domain),
    }));

    const sortFn = (a: typeof stats[0], b: typeof stats[0]) => b.coverage - a.coverage || a.avgPos - b.avgPos;

    // ВСЕ настоящие конкуренты (без агрегаторов) — отдаём целиком
    const realCompetitors = stats.filter(s => !s.isAggregator).sort(sortFn);
    const aggregators = stats.filter(s => s.isAggregator).sort(sortFn);

    const myDomainNorm = (myDomain || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
    const myStats = myDomainNorm ? stats.find(s => s.domain === myDomainNorm) : null;
    const myRank = myStats
      ? realCompetitors.findIndex(s => s.domain === myDomainNorm) + 1
      : 0;

    const regionLine = region ? `Регион выдачи: ${region}` : 'Регион не указан';
    const myBlock = myStats
      ? `\n\nЗАКАЗЧИК (анализируемый проект): ${myDomainNorm}\n- Место среди настоящих конкурентов: #${myRank} из ${realCompetitors.length}\n- Запросов в топе: ${myStats.coverage} из ${queries.size}\n- Средняя позиция: ${myStats.avgPos}\n- В топ-3: ${myStats.top3}, в топ-10: ${myStats.top10}\n`
      : myDomainNorm
        ? `\n\nЗАКАЗЧИК: ${myDomainNorm} — НЕ НАЙДЕН в загруженных данных по этим запросам.`
        : '';

    const prompt = `Ты SEO-аналитик. Проанализируй данные присутствия доменов в топе поисковой выдачи. Дай развёрнутый отчёт на русском в формате Markdown.

ВАЖНО: Маркетплейсы и агрегаторы (Wildberries, Ozon, Яндекс.Маркет, Avito, YouTube, Wikipedia, 2GIS, Дзен и т.п.) НЕ являются прямыми конкурентами для коммерческих сайтов — упомяни их отдельным коротким блоком, но НЕ учитывай в основных рекомендациях, рейтингах лидеров и точках роста. Фокусируйся на НАСТОЯЩИХ конкурентах.

${regionLine}
Всего запросов: ${queries.size}
Всего доменов: ${stats.length} (из них настоящих конкурентов: ${realCompetitors.length}, агрегаторов: ${aggregators.length})
${myBlock}

ВСЕ настоящие конкуренты (отсортировано по охвату):
${JSON.stringify(realCompetitors, null, 2)}

Маркетплейсы / агрегаторы (для справки, НЕ анализировать как конкурентов):
${JSON.stringify(aggregators, null, 2)}

Структура ответа (используй заголовки ## и списки):
## Доминирующие игроки (без агрегаторов)
Кто реально доминирует в нише среди настоящих конкурентов${region ? `, с учётом региона «${region}»` : ''}
## Универсальные лидеры
Настоящие конкуренты, представленные в большинстве запросов
## Узкие специалисты
Конкуренты с малым охватом, но высокими позициями
## Влияние агрегаторов
Короткий блок: какие маркетплейсы/агрегаторы занимают топ и сколько мест «съедают»
## Слабые места рынка
Запросы со слабой конкуренцией среди настоящих игроков, точки входа${myStats ? `\n## Позиция вашего проекта (${myDomainNorm})\nГде вы сильны, где отстаёте от настоящих конкурентов (агрегаторы не учитываем), конкретные точки роста` : ''}
## Рекомендации
Конкретные действия для конкуренции в этой нише${myStats ? ` — с акцентом на проект ${myDomainNorm}` : ''}

Будь конкретным, используй цифры из данных.`;

    const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
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
    console.error('top-analysis-insights error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
