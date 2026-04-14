import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ReportSidebar } from '@/components/ReportSidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, Plus, Loader2, Download, ChevronDown, FileText, Palette, Share2, Check, Link, Table2, RefreshCw } from 'lucide-react';
import { GscWidget } from '@/components/GscWidget';
import { downloadPdf, getActiveTemplate } from '@/lib/downloadPdf';
import { exportReportXlsx } from '@/lib/exportXlsx';
import { ExcelExportDialog, type XlsxExportConfig } from '@/components/ExcelExportDialog';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

const ReportTabs = lazy(() => import('@/components/ReportTabs').then((m) => ({ default: m.ReportTabs })));

interface ReportPageProps {
  url: string;
  analysisId?: string | null;
  onBack: () => void;
  onReanalyze?: (url: string) => void;
}

const scoreConfig = [
  { color: '#F97316', gradient: ['#F97316', '#EF4444'] as [string, string], gId: 'g-seo' },
  { color: '#00A3FF', gradient: ['#00A3FF', '#3B82F6'] as [string, string], gId: 'g-llm' },
  { color: '#22C55E', gradient: ['#22C55E', '#10B981'] as [string, string], gId: 'g-human' },
  { color: '#A855F7', gradient: ['#A855F7', '#8B5CF6'] as [string, string], gId: 'g-sge' },
];
const scoreLabelsEN = ['SEO Health', 'LLM-Friendly', 'Human Touch', 'SGE Adapt'];
const scoreLabelsRU = ['SEO Здоровье', 'LLM-Дружелюбность', 'Человечность', 'SGE Адаптация'];

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

export default function ReportPage({ url, analysisId, onBack, onReanalyze }: ReportPageProps) {
  const { tr, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [xlsxLoading, setXlsxLoading] = useState(false);
  const [xlsxDialogOpen, setXlsxDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [templates, setTemplates] = useState<PdfTpl[]>([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('optimizer');
  const [scrollToSge, setScrollToSge] = useState(false);

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
  const scoreLabels = lang === 'ru' ? scoreLabelsRU : scoreLabelsEN;
  const scoreCards = scores ? [
    { score: scores.seoHealth || 0, label: scoreLabels[0], description: '', color: scoreConfig[0].color, gradientColors: scoreConfig[0].gradient, gradientId: scoreConfig[0].gId },
    { score: scores.llmFriendly || 0, label: scoreLabels[1], description: '', color: scoreConfig[1].color, gradientColors: scoreConfig[1].gradient, gradientId: scoreConfig[1].gId },
    { score: scores.humanTouch || 0, label: scoreLabels[2], description: '', color: scoreConfig[2].color, gradientColors: scoreConfig[2].gradient, gradientId: scoreConfig[2].gId },
    { score: scores.sgeAdapt || 0, label: scoreLabels[3], description: '', color: scoreConfig[3].color, gradientColors: scoreConfig[3].gradient, gradientId: scoreConfig[3].gId },
  ] : scoreLabels.map((l, i) => ({ score: 0, label: l, description: '', color: scoreConfig[i].color, gradientColors: scoreConfig[i].gradient, gradientId: scoreConfig[i].gId }));

  const modules = (results?.modules as any[]) || [];
  const quickWins = (results?.quick_wins as any[]) || [];
  const tabData = (results?.tab_data as any) || {};
  const hasTfidf = Array.isArray(tabData?.tfidf) && tabData.tfidf.length > 0;

  const handleExportXlsx = async (config: XlsxExportConfig) => {
    if (!analysisId) return;
    setXlsxLoading(true);
    try {
      await exportReportXlsx({ analysisId, lang, config });
      toast.success(lang === 'ru' ? 'Excel-файл скачан!' : 'Excel file downloaded!');
      setXlsxDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setXlsxLoading(false);
    }
  };

  const activeTpl = templates.find(t => t.is_active);

  return (
    <div className="report-shell">
      <AppHeader />
      <main className="container max-w-[1440px] space-y-14 py-10 lg:py-14">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2 rounded-full border-border/70 bg-card/60 px-4">
            <ArrowLeft className="w-4 h-4" />
            {lang === 'ru' ? '← Назад' : '← Back'}
          </Button>
          {!tplLoading && templates.length === 0 && (
            <p className="text-xs text-muted-foreground">
              {lang === 'ru' ? 'Создайте фирменный стиль в PDF-Редакторе → /pdf-editor' : 'Create your branded style in PDF Editor → /pdf-editor'}
            </p>
          )}
        </div>

        <section className="report-hero p-7 md:p-8 lg:p-10">
          <div className="flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className="report-pill">SEO-Аудит</span>
                <span className="report-pill">{lang === 'ru' ? 'Премиальный анализ страницы' : 'Premium page analysis'}</span>
                {activeTpl && (
                  <span className="report-pill gap-1.5">
                    <Palette className="h-3 w-3" />
                    {activeTpl.name}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                  {lang === 'ru' ? 'Глубокий аудит и AI-оптимизация страницы' : 'Deep audit and AI optimization'}
                </h1>
                <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  {url}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 xl:max-w-[29rem] xl:justify-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full border-border/70 bg-card/60 text-xs gap-1.5"
                onClick={handleShare}
                disabled={shareLoading}
              >
                {shareLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : shareCopied ? <Check className="w-3 h-3 text-primary" /> : shareToken ? <Link className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                {shareCopied ? (lang === 'ru' ? 'Скопировано!' : 'Copied!') : shareToken ? (lang === 'ru' ? 'Копировать ссылку' : 'Copy Link') : (lang === 'ru' ? 'Поделиться' : 'Share')}
              </Button>

              <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/60 text-xs gap-1.5" disabled={!analysisId} onClick={() => setXlsxDialogOpen(true)}>
                <Table2 className="w-3 h-3" />
                Excel
              </Button>

              <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/60 text-xs gap-1.5">
                <Code className="w-3 h-3" />
                {lang === 'ru' ? 'Посмотреть JSON' : 'View JSON'}
              </Button>

              {templates.length > 0 ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/60 text-xs gap-1.5" disabled={pdfLoading || !analysisId}>
                      {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                      {lang === 'ru' ? 'Экспорт в PDF' : 'Export PDF'}
                      <ChevronDown className="w-3 h-3 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/70 bg-card/95 backdrop-blur-xl">
                    <DropdownMenuItem onClick={() => handleExportPdf(null)} className="gap-2 text-xs">
                      <FileText className="w-3.5 h-3.5" />
                      {lang === 'ru' ? 'По умолчанию' : 'Default'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {templates.map(t => (
                      <DropdownMenuItem key={t.id} onClick={() => handleExportPdf(t)} className="gap-2 text-xs">
                        <Palette className="w-3.5 h-3.5" style={{ color: t.primary_color }} />
                        {t.name}
                        {t.is_active && <span className="ml-auto text-[10px] text-primary font-medium">{lang === 'ru' ? 'активный' : 'active'}</span>}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button variant="outline" size="sm" className="rounded-full border-border/70 bg-card/60 text-xs gap-1.5" onClick={() => handleExportPdf(null)} disabled={pdfLoading || !analysisId}>
                  {pdfLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                  {lang === 'ru' ? 'Экспорт в PDF' : 'Export PDF'}
                </Button>
              )}

              <Button size="sm" className="btn-gradient border-0 rounded-full px-4 text-xs gap-1.5" onClick={onBack}>
                <Plus className="w-3 h-3" />
                {lang === 'ru' ? '+ Новый анализ' : '+ New Analysis'}
              </Button>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {scoreCards.map((s, i) => (
                <ScoreGauge
                  key={i}
                  {...s}
                  featured={i === 0}
                  clickable={i === 3}
                  onClick={i === 3 ? () => {
                    setActiveTab('aiReport');
                    setScrollToSge(true);
                  } : undefined}
                />
              ))}
            </section>

            <section className="grid grid-cols-1 gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="space-y-6">
                <Suspense fallback={<div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
                  <ReportTabs
                    data={tabData}
                    analysisId={analysisId}
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    scrollToSge={scrollToSge}
                    onSgeScrolled={() => setScrollToSge(false)}
                    scores={scores}
                    onReanalyze={onReanalyze ? () => onReanalyze(url) : undefined}
                  />
                </Suspense>
              </div>
              <aside className="hidden xl:block">
                <div className="sticky top-24 space-y-5">
                  <ReportSidebar
                    modules={modules}
                    quickWins={quickWins}
                    modulesTitle={lang === 'ru' ? 'СТАТУС МОДУЛЕЙ' : 'MODULE STATUS'}
                    readyLabel={lang === 'ru' ? 'ГОТОВО' : 'READY'}
                    quickWinsTitle="QUICK WINS"
                    scores={scores}
                  />
                  <div className="report-soft-panel p-4">
                    <GscWidget />
                  </div>
                </div>
              </aside>
            </section>
          </>
        )}
      </main>
      <ExcelExportDialog
        open={xlsxDialogOpen}
        onOpenChange={setXlsxDialogOpen}
        onExport={handleExportXlsx}
        loading={xlsxLoading}
        hasTfidf={hasTfidf}
      />
    </div>
  );
}