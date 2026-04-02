import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { analysisId, sections, logoUrl, companyName, lang } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Fetch analysis + results
    const { data: analysis } = await sb.from('analyses').select('*').eq('id', analysisId).single();
    const { data: results } = await sb.from('analysis_results').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1).single();

    if (!analysis || !results) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const isRu = lang === 'ru';
    const scores = (results.scores as any) || {};
    const tabData = (results.tab_data as any) || {};
    const modules = (results.modules as any) || {};
    const quickWins = (results.quick_wins as any) || [];

    // Build HTML sections
    const htmlSections: string[] = [];

    // Cover page
    htmlSections.push(`
      <div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:90vh;text-align:center;">
        ${logoUrl ? `<img src="${logoUrl}" style="max-width:200px;max-height:80px;margin-bottom:30px;" />` : ''}
        <h1 style="font-size:32px;margin:0 0 10px;color:#7c3aed;">${isRu ? 'SEO-Отчёт' : 'SEO Report'}</h1>
        <p style="font-size:18px;color:#666;margin:5px 0;">${analysis.url}</p>
        ${companyName ? `<p style="font-size:16px;color:#888;margin:5px 0;">${companyName}</p>` : ''}
        <p style="font-size:14px;color:#999;margin-top:20px;">${new Date(analysis.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    `);

    // Scores
    if (sections.includes('scores')) {
      const scoreItems = [
        { label: 'SEO Health', value: scores.seoHealth || 0 },
        { label: 'LLM-Friendly', value: scores.llmFriendly || 0 },
        { label: 'Human Touch', value: scores.humanTouch || 0 },
        { label: 'SGE Adapt', value: scores.sgeAdapt || 0 },
      ];
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'Общие скоры' : 'Overall Scores'}</h2>
          <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:20px;">
            ${scoreItems.map(s => `
              <div style="flex:1;min-width:120px;text-align:center;padding:20px;border:1px solid #e5e7eb;border-radius:12px;">
                <div style="font-size:36px;font-weight:bold;color:${s.value >= 70 ? '#22c55e' : s.value >= 40 ? '#f59e0b' : '#ef4444'};">${s.value}</div>
                <div style="font-size:12px;color:#666;margin-top:8px;">${s.label}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `);
    }

    // AI Report
    if (sections.includes('aiReport')) {
      const report = tabData?.aiReport;
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'ИИ-отчёт' : 'AI Report'}</h2>
          <div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;">${report || (isRu ? 'Нет данных' : 'No data')}</div>
        </div>
      `);
    }

    // Priorities / Quick Wins
    if (sections.includes('priorities')) {
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'Приоритетные рекомендации' : 'Priority Recommendations'}</h2>
          ${Array.isArray(quickWins) && quickWins.length > 0 ? `<ul style="margin-top:15px;line-height:1.8;">${quickWins.map((w: any) => `<li style="margin-bottom:8px;"><strong>${w.title || w}</strong>${w.description ? `<br/><span style="color:#666;font-size:13px;">${w.description}</span>` : ''}</li>`).join('')}</ul>` : `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`}
        </div>
      `);
    }

    // TF-IDF
    if (sections.includes('tfidf')) {
      const tfidf = tabData?.tfidf;
      let tfidfHtml = `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`;
      if (Array.isArray(tfidf) && tfidf.length > 0) {
        tfidfHtml = `<table style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr style="background:#7c3aed;color:white;"><th style="padding:8px;text-align:left;">${isRu ? 'Ключевое слово' : 'Keyword'}</th><th style="padding:8px;text-align:right;">TF-IDF</th><th style="padding:8px;text-align:right;">${isRu ? 'Частота' : 'Frequency'}</th></tr>
          ${tfidf.slice(0, 30).map((item: any, i: number) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};"><td style="padding:8px;">${item.term || item.keyword || ''}</td><td style="padding:8px;text-align:right;">${(item.tfidf || item.score || 0).toFixed ? (item.tfidf || item.score || 0).toFixed(4) : item.tfidf || item.score || 0}</td><td style="padding:8px;text-align:right;">${item.count || item.frequency || ''}</td></tr>`).join('')}
        </table>`;
      }
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">TF-IDF ${isRu ? 'Анализ' : 'Analysis'}</h2>
          ${tfidfHtml}
        </div>
      `);
    }

    // N-grams
    if (sections.includes('ngrams')) {
      const ngrams = tabData?.ngrams;
      let ngramsHtml = `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`;
      if (ngrams && typeof ngrams === 'object') {
        const entries = Object.entries(ngrams).slice(0, 3);
        ngramsHtml = entries.map(([key, items]: [string, any]) => {
          if (!Array.isArray(items)) return '';
          return `<h3 style="margin-top:15px;">${key}</h3><table style="width:100%;border-collapse:collapse;"><tr style="background:#7c3aed;color:white;"><th style="padding:6px;text-align:left;">${isRu ? 'Фраза' : 'Phrase'}</th><th style="padding:6px;text-align:right;">${isRu ? 'Частота' : 'Count'}</th></tr>${items.slice(0, 15).map((it: any, i: number) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};"><td style="padding:6px;">${it.gram || it.phrase || ''}</td><td style="padding:6px;text-align:right;">${it.count || it.frequency || ''}</td></tr>`).join('')}</table>`;
        }).join('');
      }
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'N-граммы' : 'N-grams'}</h2>
          ${ngramsHtml}
        </div>
      `);
    }

    // Images
    if (sections.includes('images')) {
      const images = tabData?.images;
      let imagesHtml = `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`;
      if (Array.isArray(images) && images.length > 0) {
        imagesHtml = `<table style="width:100%;border-collapse:collapse;margin-top:15px;">
          <tr style="background:#7c3aed;color:white;"><th style="padding:6px;text-align:left;">URL</th><th style="padding:6px;text-align:left;">Alt</th><th style="padding:6px;text-align:right;">${isRu ? 'Размер' : 'Size'}</th></tr>
          ${images.slice(0, 30).map((img: any, i: number) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};${!img.alt ? 'color:#ef4444;' : ''}"><td style="padding:6px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${img.src || img.url || ''}</td><td style="padding:6px;">${img.alt || '⚠️ Missing'}</td><td style="padding:6px;text-align:right;">${img.size || ''}</td></tr>`).join('')}
        </table>`;
      }
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'Анализ изображений' : 'Image Analysis'}</h2>
          ${imagesHtml}
        </div>
      `);
    }

    // Anchors
    if (sections.includes('anchors')) {
      const anchors = tabData?.anchors;
      let anchorsHtml = `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`;
      if (anchors && (anchors.internal?.length || anchors.external?.length)) {
        const renderList = (items: any[], title: string) => items?.length ? `<h3>${title}</h3><table style="width:100%;border-collapse:collapse;"><tr style="background:#7c3aed;color:white;"><th style="padding:6px;text-align:left;">${isRu ? 'Текст' : 'Text'}</th><th style="padding:6px;text-align:left;">URL</th></tr>${items.slice(0, 20).map((a: any, i: number) => `<tr style="background:${i % 2 === 0 ? '#f9fafb' : 'white'};"><td style="padding:6px;">${a.text || ''}</td><td style="padding:6px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.href || ''}</td></tr>`).join('')}</table>` : '';
        anchorsHtml = renderList(anchors.internal, isRu ? 'Внутренние ссылки' : 'Internal Links') + renderList(anchors.external, isRu ? 'Внешние ссылки' : 'External Links');
      }
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'Анализ анкоров' : 'Anchor Analysis'}</h2>
          ${anchorsHtml}
        </div>
      `);
    }

    // Stealth Engine
    if (sections.includes('stealth')) {
      const stealth = tabData?.stealth || modules?.stealth;
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">Stealth Engine</h2>
          <div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;">${stealth ? JSON.stringify(stealth, null, 2) : (isRu ? 'Нет данных' : 'No data')}</div>
        </div>
      `);
    }

    // Semantic Map
    if (sections.includes('semanticMap')) {
      const sm = tabData?.semanticMap;
      let smHtml = `<p style="color:#999;">${isRu ? 'Нет данных' : 'No data'}</p>`;
      if (sm) {
        smHtml = `
          <div style="margin-top:15px;">
            <div style="font-size:24px;font-weight:bold;color:#7c3aed;margin-bottom:10px;">Topic Coverage: ${sm.topicCoverageScore || 0}%</div>
            ${sm.semanticMap?.length ? `<h3>${isRu ? 'Обязательные разделы' : 'Required Sections'}</h3><ul>${sm.semanticMap.map((s: any) => `<li><strong>${s.heading || s}</strong>${s.status ? ` — ${s.status}` : ''}</li>`).join('')}</ul>` : ''}
            ${sm.gaps?.length ? `<h3>${isRu ? 'Информационные дыры' : 'Information Gaps'}</h3><ul style="color:#ef4444;">${sm.gaps.map((g: string) => `<li>${g}</li>`).join('')}</ul>` : ''}
          </div>
        `;
      }
      htmlSections.push(`
        <div style="page-break-after:always;">
          <h2 style="color:#7c3aed;border-bottom:2px solid #7c3aed;padding-bottom:8px;">${isRu ? 'Семантическая карта' : 'Semantic Map'}</h2>
          ${smHtml}
        </div>
      `);
    }

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  @page { margin: 25mm 20mm; size: A4; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 14px; line-height: 1.6; }
  h1, h2, h3 { margin-top: 0; }
  table { font-size: 13px; }
  th, td { border-bottom: 1px solid #e5e7eb; }
</style>
</head>
<body>${htmlSections.join('\n')}</body>
</html>`;

    return new Response(JSON.stringify({ html: fullHtml }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
