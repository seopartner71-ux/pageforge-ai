import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const body = await req.json();
    const { analysisId, sections, logoUrl, companyName, lang, template } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const { data: analysis } = await sb.from('analyses').select('*').eq('id', analysisId).single();
    const { data: results } = await sb.from('analysis_results').select('*').eq('analysis_id', analysisId).order('created_at', { ascending: false }).limit(1).single();

    if (!analysis || !results) {
      return new Response(JSON.stringify({ error: 'Analysis not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Template settings with defaults
    const theme = template?.theme || 'light';
    const primaryColor = template?.primary_color || '#7c3aed';
    const accentColor = template?.accent_color || '#3b82f6';
    const fontFamily = template?.font_family || 'Inter';
    const fontSizes = template?.font_sizes || { heading: 20, subheading: 16, body: 13 };
    const margins = template?.margins || { top: 25, bottom: 25, left: 20, right: 20 };
    const tplLogo = template?.logo_url || logoUrl;
    const tplCompany = template?.company_name || companyName || '';
    const enabledSections: string[] = template?.enabled_sections || sections || [];
    const sectionOrder: string[] = template?.section_order || enabledSections;

    const isRu = lang === 'ru';
    const scores = (results.scores as any) || {};
    const tabData = (results.tab_data as any) || {};
    const quickWins = (results.quick_wins as any) || [];

    const bgColor = theme === 'dark' ? '#1a1a2e' : '#ffffff';
    const fgColor = theme === 'dark' ? '#e2e8f0' : '#1a1a1a';
    const mutedColor = theme === 'dark' ? '#94a3b8' : '#6b7280';
    const altRowBg = theme === 'dark' ? '#1e293b' : '#f9fafb';
    const tableBorder = theme === 'dark' ? '#334155' : '#e5e7eb';

    const htmlSections: string[] = [];

    // Cover page
    htmlSections.push(`
      <div style="page-break-after:always;display:flex;flex-direction:column;justify-content:center;align-items:center;min-height:90vh;text-align:center;">
        ${tplLogo ? `<img src="${tplLogo}" style="max-width:200px;max-height:80px;margin-bottom:30px;" />` : ''}
        <h1 style="font-size:${fontSizes.heading + 12}px;margin:0 0 10px;color:${primaryColor};">${isRu ? 'SEO-Отчёт' : 'SEO Report'}</h1>
        <p style="font-size:${fontSizes.subheading}px;color:${mutedColor};margin:5px 0;">${analysis.url}</p>
        ${tplCompany ? `<p style="font-size:${fontSizes.body + 2}px;color:${mutedColor};margin:5px 0;">${tplCompany}</p>` : ''}
        <p style="font-size:${fontSizes.body}px;color:${mutedColor};margin-top:20px;">${new Date(analysis.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
    `);

    // Build sections in order
    const orderedSections = sectionOrder.filter((s: string) => enabledSections.includes(s));

    for (const sec of orderedSections) {
      switch (sec) {
        case 'scores': {
          const scoreItems = [
            { label: 'SEO Health', value: scores.seoHealth || 0 },
            { label: 'LLM-Friendly', value: scores.llmFriendly || 0 },
            { label: 'Human Touch', value: scores.humanTouch || 0 },
            { label: 'SGE Adapt', value: scores.sgeAdapt || 0 },
          ];
          htmlSections.push(`
            <div style="page-break-after:always;">
              <h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'Общие скоры' : 'Overall Scores'}</h2>
              <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:20px;">
                ${scoreItems.map(s => `
                  <div style="flex:1;min-width:120px;text-align:center;padding:20px;border:1px solid ${tableBorder};border-radius:12px;">
                    <div style="font-size:36px;font-weight:bold;color:${s.value >= 70 ? '#22c55e' : s.value >= 40 ? '#f59e0b' : '#ef4444'};">${s.value}</div>
                    <div style="font-size:${fontSizes.body - 1}px;color:${mutedColor};margin-top:8px;">${s.label}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          `);
          break;
        }
        case 'aiReport': {
          const report = tabData?.aiReport;
          htmlSections.push(`
            <div style="page-break-after:always;">
              <h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'ИИ-отчёт' : 'AI Report'}</h2>
              <div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;font-size:${fontSizes.body}px;">${report || (isRu ? 'Нет данных' : 'No data')}</div>
            </div>
          `);
          break;
        }
        case 'priorities': {
          htmlSections.push(`
            <div style="page-break-after:always;">
              <h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'Quick Wins' : 'Quick Wins'}</h2>
              ${Array.isArray(quickWins) && quickWins.length > 0 ? `<ul style="margin-top:15px;line-height:1.8;font-size:${fontSizes.body}px;">${quickWins.map((w: any) => `<li style="margin-bottom:8px;"><strong>${w.title || w}</strong>${w.description ? `<br/><span style="color:${mutedColor};font-size:${fontSizes.body - 1}px;">${w.description}</span>` : ''}</li>`).join('')}</ul>` : `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`}
            </div>
          `);
          break;
        }
        case 'tfidf': {
          const tfidf = tabData?.tfidf;
          let tfidfHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (Array.isArray(tfidf) && tfidf.length > 0) {
            tfidfHtml = `<table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:${fontSizes.body}px;">
              <tr style="background:${primaryColor};color:white;"><th style="padding:8px;text-align:left;">${isRu ? 'Ключевое слово' : 'Keyword'}</th><th style="padding:8px;text-align:right;">TF-IDF</th><th style="padding:8px;text-align:right;">${isRu ? 'Частота' : 'Frequency'}</th></tr>
              ${tfidf.slice(0, 30).map((item: any, i: number) => `<tr style="background:${i % 2 === 0 ? altRowBg : 'transparent'};color:${fgColor};"><td style="padding:8px;">${item.term || item.keyword || ''}</td><td style="padding:8px;text-align:right;">${(item.tfidf || item.score || 0).toFixed ? (item.tfidf || item.score || 0).toFixed(4) : item.tfidf || item.score || 0}</td><td style="padding:8px;text-align:right;">${item.count || item.frequency || ''}</td></tr>`).join('')}
            </table>`;
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">TF-IDF</h2>${tfidfHtml}</div>`);
          break;
        }
        case 'ngrams': {
          const ngrams = tabData?.ngrams;
          let ngramsHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (ngrams && typeof ngrams === 'object') {
            const entries = Object.entries(ngrams).slice(0, 3);
            ngramsHtml = entries.map(([key, items]: [string, any]) => {
              if (!Array.isArray(items)) return '';
              return `<h3 style="margin-top:15px;font-size:${fontSizes.subheading}px;color:${fgColor};">${key}</h3><table style="width:100%;border-collapse:collapse;font-size:${fontSizes.body}px;"><tr style="background:${primaryColor};color:white;"><th style="padding:6px;text-align:left;">${isRu ? 'Фраза' : 'Phrase'}</th><th style="padding:6px;text-align:right;">${isRu ? 'Частота' : 'Count'}</th></tr>${items.slice(0, 15).map((it: any, i: number) => `<tr style="background:${i % 2 === 0 ? altRowBg : 'transparent'};color:${fgColor};"><td style="padding:6px;">${it.gram || it.phrase || ''}</td><td style="padding:6px;text-align:right;">${it.count || it.frequency || ''}</td></tr>`).join('')}</table>`;
            }).join('');
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'N-граммы' : 'N-grams'}</h2>${ngramsHtml}</div>`);
          break;
        }
        case 'images': {
          const images = tabData?.images;
          let imagesHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (Array.isArray(images) && images.length > 0) {
            imagesHtml = `<table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:${fontSizes.body}px;">
              <tr style="background:${primaryColor};color:white;"><th style="padding:6px;text-align:left;">URL</th><th style="padding:6px;text-align:left;">Alt</th><th style="padding:6px;text-align:right;">${isRu ? 'Размер' : 'Size'}</th></tr>
              ${images.slice(0, 30).map((img: any, i: number) => `<tr style="background:${i % 2 === 0 ? altRowBg : 'transparent'};${!img.alt ? 'color:#ef4444;' : `color:${fgColor};`}"><td style="padding:6px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${img.src || img.url || ''}</td><td style="padding:6px;">${img.alt || 'Missing'}</td><td style="padding:6px;text-align:right;">${img.size || ''}</td></tr>`).join('')}
            </table>`;
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'Изображения' : 'Images'}</h2>${imagesHtml}</div>`);
          break;
        }
        case 'anchors': {
          const anchors = tabData?.anchors;
          let anchorsHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (anchors && (anchors.internal?.length || anchors.external?.length)) {
            const renderList = (items: any[], title: string) => items?.length ? `<h3 style="font-size:${fontSizes.subheading}px;color:${fgColor};">${title}</h3><table style="width:100%;border-collapse:collapse;font-size:${fontSizes.body}px;"><tr style="background:${primaryColor};color:white;"><th style="padding:6px;text-align:left;">${isRu ? 'Текст' : 'Text'}</th><th style="padding:6px;text-align:left;">URL</th></tr>${items.slice(0, 20).map((a: any, i: number) => `<tr style="background:${i % 2 === 0 ? altRowBg : 'transparent'};color:${fgColor};"><td style="padding:6px;">${a.text || ''}</td><td style="padding:6px;max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.href || ''}</td></tr>`).join('')}</table>` : '';
            anchorsHtml = renderList(anchors.internal, isRu ? 'Внутренние ссылки' : 'Internal Links') + renderList(anchors.external, isRu ? 'Внешние ссылки' : 'External Links');
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'Анкоры' : 'Anchors'}</h2>${anchorsHtml}</div>`);
          break;
        }
        case 'stealth': {
          const stealth = tabData?.stealth;
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">Stealth Engine</h2><div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;font-size:${fontSizes.body}px;color:${fgColor};">${stealth ? JSON.stringify(stealth, null, 2) : (isRu ? 'Нет данных' : 'No data')}</div></div>`);
          break;
        }
        case 'semanticMap': {
          const sm = tabData?.semanticMap;
          let smHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (sm) {
            smHtml = `<div style="margin-top:15px;color:${fgColor};">
              <div style="font-size:24px;font-weight:bold;color:${accentColor};margin-bottom:10px;">Topic Coverage: ${sm.topicCoverageScore || 0}%</div>
              ${sm.semanticMap?.length ? `<h3 style="font-size:${fontSizes.subheading}px;">${isRu ? 'Обязательные разделы' : 'Required Sections'}</h3><ul>${sm.semanticMap.map((s: any) => `<li><strong>${s.heading || s}</strong>${s.status ? ` — ${s.status}` : ''}</li>`).join('')}</ul>` : ''}
              ${sm.gaps?.length ? `<h3 style="font-size:${fontSizes.subheading}px;">${isRu ? 'Информационные дыры' : 'Information Gaps'}</h3><ul style="color:#ef4444;">${sm.gaps.map((g: string) => `<li>${g}</li>`).join('')}</ul>` : ''}
            </div>`;
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'Семантическая карта' : 'Semantic Map'}</h2>${smHtml}</div>`);
          break;
        }
        case 'blueprint': {
          const bp = tabData?.blueprint;
          let bpHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (bp) {
            bpHtml = `<div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;font-size:${fontSizes.body}px;color:${fgColor};">${typeof bp === 'string' ? bp : JSON.stringify(bp, null, 2)}</div>`;
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">Golden Blueprint</h2>${bpHtml}</div>`);
          break;
        }
        case 'implementationPlan': {
          const plan = tabData?.implementationPlan;
          let planHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (Array.isArray(plan) && plan.length > 0) {
            const groups = { P1: plan.filter((t: any) => t.priority === 'P1'), P2: plan.filter((t: any) => t.priority === 'P2'), P3: plan.filter((t: any) => t.priority === 'P3') };
            const labels = { P1: isRu ? 'P1 — Критично' : 'P1 — Critical', P2: isRu ? 'P2 — Важно' : 'P2 — Important', P3: isRu ? 'P3 — Рекомендовано' : 'P3 — Recommended' };
            planHtml = Object.entries(groups).filter(([, items]) => items.length > 0).map(([p, items]) => {
              return `<h3 style="color:${primaryColor};font-size:${fontSizes.subheading}px;margin-top:16px;">${labels[p as keyof typeof labels]}</h3><ul style="font-size:${fontSizes.body}px;color:${fgColor};line-height:1.8;">${items.map((t: any) => `<li style="margin-bottom:10px;"><strong>${t.title}</strong>${t.where ? `<br/>${isRu ? 'Где' : 'Where'}: ${t.where}` : ''}${t.action ? `<br/>${isRu ? 'Решение' : 'Action'}: ${t.action}` : ''}${t.expectedResult ? `<br/><span style="color:#22c55e;">${isRu ? 'Результат' : 'Result'}: ${t.expectedResult}</span>` : ''}</li>`).join('')}</ul>`;
            }).join('');
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">${isRu ? 'ТЗ на внедрение' : 'Implementation Plan'}</h2>${planHtml}</div>`);
          break;
        }
        case 'topicalGap': {
          const gap = tabData?.topicalGap;
          let gapHtml = `<p style="color:${mutedColor};">${isRu ? 'Нет данных' : 'No data'}</p>`;
          if (gap) {
            gapHtml = `<div style="margin-top:15px;line-height:1.7;white-space:pre-wrap;font-size:${fontSizes.body}px;color:${fgColor};">${typeof gap === 'string' ? gap : JSON.stringify(gap, null, 2)}</div>`;
          }
          htmlSections.push(`<div style="page-break-after:always;"><h2 style="color:${primaryColor};border-bottom:2px solid ${primaryColor};padding-bottom:8px;font-size:${fontSizes.heading}px;">Topical Gap</h2>${gapHtml}</div>`);
          break;
        }
      }
    }

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=${fontFamily.replace(/ /g, '+')}:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  @page { margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm; size: A4; }
  body { font-family: '${fontFamily}', sans-serif; color: ${fgColor}; background: ${bgColor}; font-size: ${fontSizes.body}px; line-height: 1.6; }
  h1, h2, h3 { margin-top: 0; }
  table { font-size: ${fontSizes.body}px; }
  th, td { border-bottom: 1px solid ${tableBorder}; }
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
