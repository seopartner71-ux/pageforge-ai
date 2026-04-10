import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

import type { XlsxExportConfig } from '@/components/ExcelExportDialog';

interface ExportXlsxOptions {
  analysisId: string;
  lang: string;
  config?: XlsxExportConfig;
}

export async function exportReportXlsx(opts: ExportXlsxOptions): Promise<void> {
  const isRu = opts.lang === 'ru';

  const { data: analysis } = await supabase
    .from('analyses')
    .select('*')
    .eq('id', opts.analysisId)
    .single();

  if (!analysis) throw new Error('Analysis not found');

  const { data: results } = await supabase
    .from('analysis_results')
    .select('*')
    .eq('analysis_id', opts.analysisId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!results) throw new Error('No results found');

  const scores = results.scores as any || {};
  const tabData = results.tab_data as any || {};
  const quickWins = (results.quick_wins as any[]) || [];
  const audit = tabData?.technicalAudit || {};
  const tfidf = tabData?.tfidf || [];
  const aiReport = tabData?.aiReport || {};

  const wb = XLSX.utils.book_new();

  // === Sheet 1: SEO Scores ===
  const scoresData = [
    [isRu ? 'SEO АУДИТ — СВОДКА МЕТРИК' : 'SEO AUDIT — METRICS SUMMARY'],
    [],
    [isRu ? 'URL страницы' : 'Page URL', analysis.url],
    [isRu ? 'Регион' : 'Region', analysis.region || '—'],
    [isRu ? 'Тип страницы' : 'Page Type', analysis.page_type || '—'],
    [isRu ? 'Дата анализа' : 'Analysis Date', new Date(analysis.created_at).toLocaleDateString()],
    [],
    [isRu ? 'МЕТРИКА' : 'METRIC', isRu ? 'ЗНАЧЕНИЕ' : 'VALUE', isRu ? 'СТАТУС' : 'STATUS'],
    ['SEO Health', `${scores.seoHealth || 0}%`, statusLabel(scores.seoHealth, isRu)],
    [isRu ? 'LLM-Дружелюбность' : 'LLM-Friendly', `${scores.llmFriendly || 0}%`, statusLabel(scores.llmFriendly, isRu)],
    [isRu ? 'Человечность' : 'Human Touch', `${scores.humanTouch || 0}%`, statusLabel(scores.humanTouch, isRu)],
    [isRu ? 'SGE Адаптация' : 'SGE Adapt', `${scores.sgeAdapt || 0}%`, statusLabel(scores.sgeAdapt, isRu)],
    [],
    [isRu ? 'ТЕХНИЧЕСКИЙ АУДИТ' : 'TECHNICAL AUDIT'],
    ['H1', audit.h1Text || '—'],
    ['Title', audit.title || '—'],
    ['Meta Description', audit.metaDescription || '—'],
    ['JSON-LD', audit.hasJsonLd ? '✅' : '❌'],
    ['OpenGraph', audit.hasOg ? '✅' : '❌'],
    [isRu ? 'Кол-во изображений' : 'Image Count', audit.imageCount ?? '—'],
    [isRu ? 'Изображений без alt' : 'Images without alt', audit.imagesWithoutAlt ?? '—'],
    [isRu ? 'Кол-во слов' : 'Word Count', tabData?.pageStats?.wordCount ?? '—'],
  ];

  const wsScores = XLSX.utils.aoa_to_sheet(scoresData);
  wsScores['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, wsScores, isRu ? 'Метрики' : 'Metrics');

  // === Sheet 2: Quick Wins / Recommendations ===
  const qwHeader = [
    isRu ? 'ПРИОРИТЕТНЫЕ ЗАДАЧИ (QUICK WINS)' : 'PRIORITY TASKS (QUICK WINS)',
  ];
  const qwRows: any[][] = [
    qwHeader,
    [],
    ['#', isRu ? 'Задача' : 'Task', isRu ? 'Приоритет' : 'Priority'],
  ];
  quickWins.forEach((qw: any, i: number) => {
    qwRows.push([
      i + 1,
      qw.task || qw.title || '—',
      (qw.priority || 'medium').toUpperCase(),
    ]);
  });

  // AI recommendations
  const recs = aiReport.recommendations || [];
  if (recs.length > 0) {
    qwRows.push([], [isRu ? 'AI РЕКОМЕНДАЦИИ' : 'AI RECOMMENDATIONS']);
    recs.forEach((r: string, i: number) => {
      qwRows.push([i + 1, r]);
    });
  }

  const wsQw = XLSX.utils.aoa_to_sheet(qwRows);
  wsQw['!cols'] = [{ wch: 5 }, { wch: 70 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsQw, isRu ? 'Задачи' : 'Tasks');

  // === Sheet 3: TF-IDF Keywords ===
  if (tfidf.length > 0) {
    const tfidfRows: any[][] = [
      [isRu ? 'АНАЛИЗ КЛЮЧЕВЫХ СЛОВ (TF-IDF)' : 'KEYWORD ANALYSIS (TF-IDF)'],
      [],
      [
        isRu ? 'Слово' : 'Term',
        isRu ? 'Ваш TF-IDF' : 'Your TF-IDF',
        isRu ? 'Медиана конкур.' : 'Competitor Median',
        isRu ? 'Статус' : 'Status',
      ],
    ];
    tfidf.slice(0, 50).forEach((t: any) => {
      tfidfRows.push([
        t.term,
        typeof t.tfidf === 'number' ? t.tfidf.toFixed(4) : t.tfidf,
        typeof t.competitorMedian === 'number' ? t.competitorMedian.toFixed(4) : (t.competitorMedian || '—'),
        t.status || '—',
      ]);
    });
    const wsTfidf = XLSX.utils.aoa_to_sheet(tfidfRows);
    wsTfidf['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsTfidf, 'TF-IDF');
  }

  // Generate and download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const hostname = new URL(analysis.url).hostname;
  a.download = `SEO-Report-${hostname}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function statusLabel(score: number | undefined, isRu: boolean): string {
  if (score === undefined || score === null) return '—';
  if (score >= 70) return isRu ? '✅ Хорошо' : '✅ Good';
  if (score >= 40) return isRu ? '⚠️ Средне' : '⚠️ Average';
  return isRu ? '❌ Плохо' : '❌ Poor';
}
