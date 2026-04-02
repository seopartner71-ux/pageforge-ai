import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ReportTabs } from '@/components/ReportTabs';
import { ReportSidebar } from '@/components/ReportSidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, Plus, Loader2, Download, ChevronDown, FileText, Palette, Share2, Check, Link } from 'lucide-react';
import { downloadPdf, getActiveTemplate } from '@/lib/downloadPdf';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ReportPageProps {
  url: string;
  analysisId?: string | null;
  onBack: () => void;
}

const scoreColors = [
  'hsl(25, 95%, 53%)',
  'hsl(210, 100%, 52%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 67%, 55%)',
];
const scoreLabels = ['SEO HEALTH', 'LLM-FRIENDLY', 'HUMAN TOUCH', 'SGE ADAPT'];

interface PdfTpl {
  id: string;
  name: string;
  is_active: boolean;
  theme: string;
  primary_color: string;
  accent_color: string;
  font_family: string;
  font_sizes: any;
  margins: any;
  logo_url: string | null;
  company_name: string | null;
  enabled_sections: any;
  section_order: any;
}

export default function ReportPage({ url, analysisId, onBack }: ReportPageProps) {
  const { tr, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [templates, setTemplates] = useState<PdfTpl[]>([]);
  const [tplLoading, setTplLoading] = useState(true);

  // Load user templates
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setTplLoading(false); return; }
      const { data } = await supabase
        .from('pdf_templates')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (data) setTemplates(data as any);
      setTplLoading(false);
    })();
  }, []);

  const handleExportPdf = async (tpl?: PdfTpl | null) => {
    if (!analysisId) return;
    setPdfLoading(true);
    try {
      const template = tpl ? {
        theme: tpl.theme,
        primary_color: tpl.primary_color,
        accent_color: tpl.accent_color,
        font_family: tpl.font_family,
        font_sizes: tpl.font_sizes,
        margins: tpl.margins,
        logo_url: tpl.logo_url,
        company_name: tpl.company_name,
        enabled_sections: tpl.enabled_sections,
        section_order: tpl.section_order,
      } : undefined;

      await downloadPdf({ analysisId, lang, template });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  // Load existing share token
  useEffect(() => {
    if (!analysisId) return;
    supabase.from('analyses').select('share_token').eq('id', analysisId).single().then(({ data }) => {
      if (data?.share_token) setShareToken(data.share_token);
    });
  }, [analysisId]);

  const handleShare = async () => {
    if (!analysisId) return;
    if (shareToken) {
      const link = `${window.location.origin}/shared/${shareToken}`;
      await navigator.clipboard.writeText(link);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      toast.success(lang === 'ru' ? 'Ссылка скопирована!' : 'Link copied!');
      return;
    }
    setShareLoading(true);
    const token = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
    const { error } = await supabase.from('analyses').update({ share_token: token } as any).eq('id', analysisId);
    if (error) {
      toast.error(error.message);
    } else {
      setShareToken(token);
      const link = `${window.location.origin}/shared/${token}`;
      await navigator.clipboard.writeText(link);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
      toast.success(lang === 'ru' ? 'Публичная ссылка создана и скопирована!' : 'Public link created and copied!');
    }
    setShareLoading(false);
  };

  useEffect(() => {
    if (!analysisId) { setLoading(false); return; }
    const load = async () => {
      const { data } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('analysis_id', analysisId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) setResults(data);
      setLoading(false);
    };
    load();
  }, [analysisId]);

  const scores = results?.scores as any;
  const scoreCards = scores ? [
    { score: scores.seoHealth || 0, label: scoreLabels[0], description: '', color: scoreColors[0] },
    { score: scores.llmFriendly || 0, label: scoreLabels[1], description: '', color: scoreColors[1] },
    { score: scores.humanTouch || 0, label: scoreLabels[2], description: '', color: scoreColors[2] },
    { score: scores.sgeAdapt || 0, label: scoreLabels[3], description: '', color: scoreColors[3] },
  ] : scoreLabels.map((l, i) => ({ score: 0, label: l, description: '', color: scoreColors[i] }));

  const modules = (results?.modules as any[]) || [];
  const quickWins = (results?.quick_wins as any[]) || [];
  const tabData = (results?.tab_data as any) || {};

  const activeTpl = templates.find(t => t.is_active);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {lang === 'ru' ? '← Назад' : '← Back'}
        </Button>

        <div className="flex items-center justify-between glass-card px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm gradient-text">{tr.appName}</span>
            <span className="text-sm text-muted-foreground">{url}</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
              {lang === 'ru' ? 'Анализ' : 'Analysis'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {activeTpl && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Palette className="w-3 h-3" />
                {activeTpl.name}
              </span>
            )}
            {/* Share button */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={handleShare}
              disabled={shareLoading}
            >
              {shareLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : shareCopied ? <Check className="w-3 h-3 text-green-500" /> : shareToken ? <Link className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
              {shareCopied
                ? (lang === 'ru' ? 'Скопировано!' : 'Copied!')
                : shareToken
                  ? (lang === 'ru' ? 'Копировать ссылку' : 'Copy Link')
                  : (lang === 'ru' ? 'Поделиться' : 'Share')}
            </Button>

            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Code className="w-3 h-3" />
              {lang === 'ru' ? 'Посмотреть JSON' : 'View JSON'}
            </Button>

            {/* PDF Export with template selector */}
            {templates.length > 0 ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-xs gap-1.5" disabled={pdfLoading || !analysisId}>
                    {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                    {lang === 'ru' ? 'Экспорт в PDF' : 'Export PDF'}
                    <ChevronDown className="w-3 h-3 ml-0.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handleExportPdf(null)} className="gap-2 text-xs">
                    <FileText className="w-3.5 h-3.5" />
                    {lang === 'ru' ? 'По умолчанию' : 'Default'}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {templates.map(t => (
                    <DropdownMenuItem key={t.id} onClick={() => handleExportPdf(t)} className="gap-2 text-xs">
                      <Palette className="w-3.5 h-3.5" style={{ color: t.primary_color }} />
                      {t.name}
                      {t.is_active && (
                        <span className="ml-auto text-[10px] text-primary font-medium">
                          {lang === 'ru' ? 'активный' : 'active'}
                        </span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={() => handleExportPdf(null)} disabled={pdfLoading || !analysisId}>
                {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                {lang === 'ru' ? 'Экспорт в PDF' : 'Export PDF'}
              </Button>
            )}

            <Button size="sm" className="btn-gradient border-0 text-xs gap-1.5" onClick={onBack}>
              <Plus className="w-3 h-3" />
              {lang === 'ru' ? '+ Новый анализ' : '+ New Analysis'}
            </Button>
          </div>
        </div>

        {/* Hint if no templates */}
        {!tplLoading && templates.length === 0 && (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground">
              {lang === 'ru'
                ? '💡 Создайте свой фирменный стиль в PDF-Редакторе → /pdf-editor'
                : '💡 Create your branded style in PDF Editor → /pdf-editor'}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {scoreCards.map((s, i) => (
                <ScoreGauge key={i} {...s} />
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
              <div>
                <ReportTabs data={tabData} analysisId={analysisId} />
              </div>
              <div className="hidden lg:block">
                <div className="sticky top-20">
                  <ReportSidebar
                    modules={modules}
                    quickWins={quickWins}
                    modulesTitle={lang === 'ru' ? 'СТАТУС МОДУЛЕЙ' : 'MODULE STATUS'}
                    readyLabel={lang === 'ru' ? 'ГОТОВО' : 'READY'}
                    quickWinsTitle="QUICK WINS"
                    scores={scores}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}