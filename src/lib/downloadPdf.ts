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

  // Create the PDF document element
  const doc = createElement(PdfReportDocument, {
    analysis,
    results,
    template: opts.template,
    companyName,
    lang: opts.lang,
  });

  // Generate blob
  const blob = await pdf(doc).toBlob();

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
