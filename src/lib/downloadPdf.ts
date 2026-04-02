import { supabase } from '@/integrations/supabase/client';

interface DownloadPdfOptions {
  analysisId: string;
  lang: string;
  template?: any;
  logoUrl?: string;
  companyName?: string;
  sections?: string[];
}

/**
 * Calls the generate-pdf edge function, receives HTML,
 * opens it in a new window and triggers the browser print dialog (Save as PDF).
 */
export async function downloadPdf(opts: DownloadPdfOptions): Promise<void> {
  const { data, error } = await supabase.functions.invoke('generate-pdf', {
    body: {
      analysisId: opts.analysisId,
      sections: opts.sections,
      logoUrl: opts.logoUrl,
      companyName: opts.companyName,
      lang: opts.lang,
      template: opts.template,
    },
  });

  if (error) throw new Error(error.message || 'PDF generation failed');
  if (data?.error) throw new Error(data.error);

  const html: string = data?.html;
  if (!html) throw new Error('Empty PDF response');

  // Open HTML in a new window and trigger print (Save as PDF)
  const win = window.open('', '_blank');
  if (!win) throw new Error('Popup blocked — please allow popups for this site');

  win.document.open();
  win.document.write(html);
  win.document.close();

  // Wait for fonts to load, then trigger print
  win.onload = () => {
    setTimeout(() => {
      win.print();
    }, 800);
  };

  // Fallback if onload already fired
  setTimeout(() => {
    try { win.print(); } catch {}
  }, 2000);
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
