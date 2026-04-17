import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SitePayload {
  name: string;
  totalLinks: number;
  uniqueDomains: number;
  avgDR: number;
  followPct: number;
  textPct: number;
}
interface SummaryPayload {
  domain: string;
  dr: number;
  top10: number;
  top50: number;
  traffic: number;
  backlinks: number;
  refDomains: number;
}
interface Insight {
  priority: 'critical' | 'warning' | 'good';
  metric: string;
  fact: string;
  recommendation: string;
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function buildLocalInsights(sites: SitePayload[], summary: SummaryPayload[]): Insight[] {
  const out: Insight[] = [];
  if (sites.length >= 2) {
    const me = sites[0];
    const comps = sites.slice(1);
    const avgDR = avg(comps.map((c) => c.avgDR));
    const leaderDR = Math.max(...comps.map((c) => c.avgDR));
    const leaderName = comps.find((c) => c.avgDR === leaderDR)?.name || 'лидер';

    if (me.avgDR < avgDR - 5) {
      out.push({
        priority: 'critical',
        metric: 'Доменный рейтинг',
        fact: `DR вашего сайта ${me.avgDR} ниже среднего по конкурентам ${avgDR.toFixed(1)}`,
        recommendation: 'Необходимо наращивать качественную ссылочную массу с тематических ресурсов с высоким DR.',
      });
    } else if (me.avgDR > avgDR) {
      out.push({
        priority: 'good',
        metric: 'Доменный рейтинг',
        fact: `DR вашего сайта ${me.avgDR} выше среднего по конкурентам ${avgDR.toFixed(1)}`,
        recommendation: 'Ссылочный профиль конкурентоспособен — поддерживайте текущий темп прироста.',
      });
    } else {
      out.push({
        priority: 'warning',
        metric: 'Доменный рейтинг',
        fact: `DR ${me.avgDR} близок к среднему по конкурентам ${avgDR.toFixed(1)}`,
        recommendation: 'Есть потенциал для роста — отрыв от лидера составляет ' + (leaderDR - me.avgDR).toFixed(1),
      });
    }

    const leaderDomains = Math.max(...comps.map((c) => c.uniqueDomains));
    const leaderDomName = comps.find((c) => c.uniqueDomains === leaderDomains)?.name || leaderName;
    if (me.uniqueDomains < leaderDomains * 0.7) {
      const need = leaderDomains - me.uniqueDomains;
      out.push({
        priority: 'critical',
        metric: 'Ссылающиеся домены',
        fact: `${me.uniqueDomains} доменов vs ${leaderDomains} у «${leaderDomName}»`,
        recommendation: `Рекомендуется размещение минимум на ${need} новых донорских площадках.`,
      });
    }

    if (me.followPct < 50) {
      out.push({
        priority: 'critical',
        metric: 'Follow-ссылки',
        fact: `Доля follow ${me.followPct}% — критически низкая`,
        recommendation: 'Большинство ссылок не передают вес. Приоритет — получение follow-ссылок с тематических ресурсов.',
      });
    } else if (me.followPct < 70) {
      out.push({
        priority: 'warning',
        metric: 'Follow-ссылки',
        fact: `Доля follow ${me.followPct}% — в норме`,
        recommendation: 'Есть потенциал для роста до 70%+.',
      });
    } else {
      out.push({
        priority: 'good',
        metric: 'Follow-ссылки',
        fact: `Доля follow ${me.followPct}% — отличный показатель`,
        recommendation: 'Качественный ссылочный профиль.',
      });
    }

    if (me.textPct < 60) {
      out.push({
        priority: 'warning',
        metric: 'Текстовые ссылки',
        fact: `${me.textPct}% текстовых ссылок — мало анкорной массы`,
        recommendation: 'Увеличьте долю анкорных ссылок для передачи релевантности.',
      });
    }
  }

  if (summary.length >= 2) {
    const me = summary[0];
    const comps = summary.slice(1);
    const avgTraffic = avg(comps.map((c) => c.traffic));
    if (me.traffic < avgTraffic) {
      const growth = avgTraffic > 0 ? Math.round(((avgTraffic - me.traffic) / Math.max(me.traffic, 1)) * 100) : 0;
      out.push({
        priority: 'warning',
        metric: 'Органический трафик',
        fact: `Трафик ${me.traffic} ниже среднего по конкурентам ${Math.round(avgTraffic)}`,
        recommendation: `При улучшении ссылочного профиля ожидается рост на ~${growth}%.`,
      });
    }
    const leaderTop10 = Math.max(...comps.map((c) => c.top10));
    const leaderName = comps.find((c) => c.top10 === leaderTop10)?.domain || 'лидер';
    if (me.top10 < leaderTop10) {
      out.push({
        priority: 'warning',
        metric: 'Видимость в ТОП-10',
        fact: `${me.top10} запросов в ТОП-10 vs ${leaderTop10} у «${leaderName}»`,
        recommendation: `Разрыв в ${leaderTop10 - me.top10} запросов требует комплексной работы со ссылками и контентом.`,
      });
    }
  }

  const order = { critical: 0, warning: 1, good: 2 };
  return out.sort((a, b) => order[a.priority] - order[b.priority]);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { sites = [], summary = [] } = (await req.json()) as {
      sites: SitePayload[]; summary: SummaryPayload[];
    };

    const local = buildLocalInsights(sites, summary);

    // Try AI augmentation via OpenRouter (key from system_settings or env)
    let aiInsights: Insight[] = [];
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const sb = createClient(supabaseUrl, serviceKey);
      const { data: keyRow } = await sb
        .from('system_settings')
        .select('key_value')
        .eq('key_name', 'OPENROUTER_API_KEY')
        .maybeSingle();
      const apiKey = keyRow?.key_value || Deno.env.get('OPENROUTER_API_KEY');

      if (apiKey) {
        const prompt = `Ты SEO-эксперт. Проанализируй данные ссылочного аудита и дай 2-3 ДОПОЛНИТЕЛЬНЫХ конкретных вывода на русском языке (не повторяй уже найденные).

Уже найдено:
${local.map((i) => `- [${i.priority}] ${i.metric}: ${i.fact}`).join('\n')}

Данные сайтов (первый = аудируемый):
${JSON.stringify({ sites, summary }, null, 2)}

Верни ТОЛЬКО JSON-массив без markdown:
[{"priority":"critical|warning|good","metric":"короткий показатель","fact":"факт с цифрами","recommendation":"конкретная рекомендация"}]`;

        const aiRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'openai/gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || '';
          const match = content.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed)) {
              aiInsights = parsed.filter(
                (x: any) => x?.priority && x?.metric && x?.fact && x?.recommendation
              );
            }
          }
        } else {
          console.log('OpenRouter error:', aiRes.status, await aiRes.text());
        }
      }
    } catch (e) {
      console.log('AI augmentation failed:', e);
    }

    const order = { critical: 0, warning: 1, good: 2 } as const;
    const all = [...local, ...aiInsights].sort(
      (a, b) => order[a.priority] - order[b.priority]
    );

    return new Response(JSON.stringify({ insights: all }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('insights error:', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
