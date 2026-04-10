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

  const cfg = opts.config;
  const sheets = cfg?.sheets ?? { metrics: true, tasks: true, tfidf: true };
  const cols = cfg?.columns ?? {
    url: true, region: true, pageType: true, date: true,
    seoHealth: true, llmFriendly: true, humanTouch: true, sgeAdapt: true,
    h1: true, title: true, metaDescription: true, jsonLd: true, openGraph: true,
    imageCount: true, imagesWithoutAlt: true, wordCount: true,
    priority: true, aiRecommendations: true,
    competitorMedian: true, status: true,
  };

  const wb = XLSX.utils.book_new();

  if (sheets.metrics) {
    const scoresData: any[][] = [
      [isRu ? 'SEO АУДИТ — СВОДКА МЕТРИК' : 'SEO AUDIT — METRICS SUMMARY'],
      [],
    ];
    if (cols.url) scoresData.push([isRu ? 'URL страницы' : 'Page URL', analysis.url]);
    if (cols.region) scoresData.push([isRu ? 'Регион' : 'Region', analysis.region || '—']);
    if (cols.pageType) scoresData.push([isRu ? 'Тип страницы' : 'Page Type', analysis.page_type || '—']);
    if (cols.date) scoresData.push([isRu ? 'Дата анализа' : 'Analysis Date', new Date(analysis.created_at).toLocaleDateString()]);
    scoresData.push([], [isRu ? 'МЕТРИКА' : 'METRIC', isRu ? 'ЗНАЧЕНИЕ' : 'VALUE', isRu ? 'СТАТУС' : 'STATUS']);
    if (cols.seoHealth) scoresData.push(['SEO Health', `${scores.seoHealth || 0}%`, statusLabel(scores.seoHealth, isRu)]);
    if (cols.llmFriendly) scoresData.push([isRu ? 'LLM-Дружелюбность' : 'LLM-Friendly', `${scores.llmFriendly || 0}%`, statusLabel(scores.llmFriendly, isRu)]);
    if (cols.humanTouch) scoresData.push([isRu ? 'Человечность' : 'Human Touch', `${scores.humanTouch || 0}%`, statusLabel(scores.humanTouch, isRu)]);
    if (cols.sgeAdapt) scoresData.push([isRu ? 'SGE Адаптация' : 'SGE Adapt', `${scores.sgeAdapt || 0}%`, statusLabel(scores.sgeAdapt, isRu)]);
    scoresData.push([], [isRu ? 'ТЕХНИЧЕСКИЙ АУДИТ' : 'TECHNICAL AUDIT']);
    if (cols.h1) scoresData.push(['H1', audit.h1Text || '—']);
    if (cols.title) scoresData.push(['Title', audit.title || '—']);
    if (cols.metaDescription) scoresData.push(['Meta Description', audit.metaDescription || '—']);
    if (cols.jsonLd) scoresData.push(['JSON-LD', audit.hasJsonLd ? '✅' : '❌']);
    if (cols.openGraph) scoresData.push(['OpenGraph', audit.hasOg ? '✅' : '❌']);
    if (cols.imageCount) scoresData.push([isRu ? 'Кол-во изображений' : 'Image Count', audit.imageCount ?? '—']);
    if (cols.imagesWithoutAlt) scoresData.push([isRu ? 'Изображений без alt' : 'Images without alt', audit.imagesWithoutAlt ?? '—']);
    if (cols.wordCount) scoresData.push([isRu ? 'Кол-во слов' : 'Word Count', tabData?.pageStats?.wordCount ?? '—']);

    const wsScores = XLSX.utils.aoa_to_sheet(scoresData);
    wsScores['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsScores, isRu ? 'Метрики' : 'Metrics');
  }

  if (sheets.tasks) {
    const qwRows: any[][] = [
      [isRu ? 'ПРИОРИТЕТНЫЕ ЗАДАЧИ (QUICK WINS)' : 'PRIORITY TASKS (QUICK WINS)'],
      [],
    ];
    const header: any[] = ['#', isRu ? 'Задача' : 'Task'];
    if (cols.priority) header.push(isRu ? 'Приоритет' : 'Priority');
    qwRows.push(header);
    quickWins.forEach((qw: any, i: number) => {
      const row: any[] = [i + 1, qw.task || qw.title || '—'];
      if (cols.priority) row.push((qw.priority || 'medium').toUpperCase());
      qwRows.push(row);
    });

    if (cols.aiRecommendations) {
      const recs = aiReport.recommendations || [];
      if (recs.length > 0) {
        qwRows.push([], [isRu ? 'AI РЕКОМЕНДАЦИИ' : 'AI RECOMMENDATIONS']);
        recs.forEach((r: string, i: number) => {
          qwRows.push([i + 1, r]);
        });
      }
    }

    const wsQw = XLSX.utils.aoa_to_sheet(qwRows);
    wsQw['!cols'] = [{ wch: 5 }, { wch: 70 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsQw, isRu ? 'Задачи' : 'Tasks');
  }

  if (sheets.tfidf && tfidf.length > 0) {
    const tfidfHeader: any[] = [isRu ? 'Слово' : 'Term', isRu ? 'Ваш TF-IDF' : 'Your TF-IDF'];
    if (cols.competitorMedian) tfidfHeader.push(isRu ? 'Медиана конкур.' : 'Competitor Median');
    if (cols.status) tfidfHeader.push(isRu ? 'Статус' : 'Status');
    const tfidfRows: any[][] = [
      [isRu ? 'АНАЛИЗ КЛЮЧЕВЫХ СЛОВ (TF-IDF)' : 'KEYWORD ANALYSIS (TF-IDF)'],
      [],
      tfidfHeader,
    ];
    tfidf.slice(0, 50).forEach((t: any) => {
      const row: any[] = [t.term, typeof t.tfidf === 'number' ? t.tfidf.toFixed(4) : t.tfidf];
      if (cols.competitorMedian) row.push(typeof t.competitorMedian === 'number' ? t.competitorMedian.toFixed(4) : (t.competitorMedian || '—'));
      if (cols.status) row.push(t.status || '—');
      tfidfRows.push(row);
    });
    const wsTfidf = XLSX.utils.aoa_to_sheet(tfidfRows);
    wsTfidf['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(wb, wsTfidf, 'TF-IDF');
  }

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
