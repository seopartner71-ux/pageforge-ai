import { supabase } from '@/integrations/supabase/client';
import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import { PdfReportDocument } from '@/components/pdf/PdfReport';

interface DownloadPdfOptions {
  analysisId: string;
  lang: string;
  template?: any;
  companyName?: string;
}

/**
 * Generates a PDF using @react-pdf/renderer and triggers download.
 */
export async function downloadPdf(opts: DownloadPdfOptions): Promise<void> {
  // Fetch analysis and results from the database
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

  const companyName = opts.template?.company_name || opts.companyName || '';

  // Generate blob
  const doc = createElement(PdfReportDocument, {
    analysis,
    results,
    template: opts.template,
    companyName,
    lang: opts.lang,
  });

  const blob = await pdf(doc as any).toBlob();

  // Trigger download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SEO-Report-${new URL(analysis.url).hostname}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates a placeholder/demo PDF when no real analysis exists.
 */
export async function downloadPlaceholderPdf(opts: { lang: string; template?: any }): Promise<void> {
  const demoAnalysis = {
    url: 'https://example.com',
    region: 'Москва',
    page_type: 'main',
    created_at: new Date().toISOString(),
  };

  const demoResults = {
    scores: { total: 72, content: 68, technical: 80, ux: 65, authority: 55 },
    quick_wins: [
      { task: opts.lang === 'ru' ? 'Добавить мета-описание' : 'Add meta description', priority: 'high' },
      { task: opts.lang === 'ru' ? 'Оптимизировать изображения' : 'Optimize images', priority: 'medium' },
      { task: opts.lang === 'ru' ? 'Добавить alt-теги' : 'Add alt tags', priority: 'medium' },
    ],
    modules: [],
    tab_data: {
      aiReport: {
        contentEffort: opts.lang === 'ru' ? 'Средний уровень усилий — контент требует доработки.' : 'Medium effort — content needs improvement.',
        informationGain: opts.lang === 'ru' ? 'Низкий Information Gain — нет уникальных данных.' : 'Low Information Gain — no unique data.',
        salientTerms: [
          { term: 'SEO', score: 0.85 },
          { term: 'оптимизация', score: 0.72 },
          { term: 'контент', score: 0.65 },
        ],
        blueprint: [
          { tag: 'h1', text: opts.lang === 'ru' ? 'Главный заголовок страницы' : 'Main Page Heading' },
          { tag: 'h2', text: opts.lang === 'ru' ? 'Раздел 1: Введение' : 'Section 1: Introduction', wordCount: 300 },
          { tag: 'h2', text: opts.lang === 'ru' ? 'Раздел 2: Основной контент' : 'Section 2: Main Content', wordCount: 500 },
        ],
        recommendations: [
          opts.lang === 'ru' ? 'Добавьте таблицу сравнения для повышения Content Effort.' : 'Add a comparison table to increase Content Effort.',
          opts.lang === 'ru' ? 'Внедрите оригинальное исследование для Information Gain.' : 'Include original research for Information Gain.',
        ],
      },
    },
  };

  const companyName = opts.template?.company_name || '';

  const doc = createElement(PdfReportDocument, {
    analysis: demoAnalysis,
    results: demoResults,
    template: opts.template,
    companyName,
    lang: opts.lang,
  });

  const blob = await pdf(doc as any).toBlob();

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `SEO-Report-DEMO-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Loads the user's active PDF template from the database.
 */
export async function getActiveTemplate() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('pdf_templates')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single();

  return data;
}
