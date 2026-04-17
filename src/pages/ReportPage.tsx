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
import { exportSeoAuditXlsx } from '@/lib/exportSeoAuditXlsx';
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

const scoreColors = ['#3B82F6', '#60A5FA', '#34D399', '#A78BFA'];
const scoreLabelsEN = ['SEO health', 'LLM-friendliness', 'Humanness', 'SGE adaptation'];
const scoreLabelsRU = ['SEO здоровье', 'LLM-дружелюбность', 'Человечность', 'SGE адаптация'];

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
  const [seoXlsxLoading, setSeoXlsxLoading] = useState(false);
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
    { score: scores.seoHealth || 0, label: scoreLabels[0], description: '', color: scoreColors[0] },
    { score: scores.llmFriendly || 0, label: scoreLabels[1], description: '', color: scoreColors[1] },
    { score: scores.humanTouch || 0, label: scoreLabels[2], description: '', color: scoreColors[2] },
    { score: scores.sgeAdapt || 0, label: scoreLabels[3], description: '', color: scoreColors[3] },
  ] : scoreLabels.map((l, i) => ({ score: 0, label: l, description: '', color: scoreColors[i] }));

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

  const handleSeoAuditXlsx = async () => {
    try {
      setSeoXlsxLoading(true);
      const tabData = (results?.tab_data as any) || {};
      const aiReport = tabData?.aiReport || {};
      await exportSeoAuditXlsx({
        url,
        scores: results?.scores || {},
        tabData,
        quickWins: (results?.quick_wins as any[]) || [],
        aiReport,
      });
      toast.success(lang === 'ru' ? 'SEO-отчёт Excel скачан!' : 'SEO report Excel downloaded!');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSeoXlsxLoading(false);
    }
  };

  const activeTpl = templates.find(t => t.is_active);

  return (
    <div className="report-shell">
      <AppHeader />
      <main className="container max-w-[1400px] space-y-10 py-8 lg:py-10">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" size="sm" onClick={onBack} className="gap-2 rounded-lg border-border/80 bg-card text-xs px-3">
            <ArrowLeft className="w-3.5 h-3.5" />
            {lang === 'ru' ? 'Назад' : 'Back'}
          </Button>
        </div>

        <section className="report-hero px-6 py-6 md:px-8 md:py-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="report-pill">SEO Audit</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {lang === 'ru' ? 'Аудит:' : 'Audit:'}
              </h1>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm text-primary hover:underline truncate max-w-xl"
                title={url}
              >
                {url}
              </a>
              <p className="text-xs text-muted-foreground">
                {lang === 'ru' ? 'Дата анализа: ' : 'Analysis date: '}
                {new Date().toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                  day: '2-digit', month: 'long', year: 'numeric',
                })}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button
                variant="outline" size="sm"
                className="rounded-lg border-border/80 bg-card text-xs gap-1.5"
                onClick={handleShare} disabled={shareLoading}
              >
                {shareLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : shareCopied ? <Check className="w-3 h-3 text-primary" /> : shareToken ? <Link className="w-3 h-3" /> : <Share2 className="w-3 h-3" />}
                {shareCopied ? (lang === 'ru' ? 'Скопировано' : 'Copied') : shareToken ? (lang === 'ru' ? 'Ссылка' : 'Link') : (lang === 'ru' ? 'Поделиться' : 'Share')}
              </Button>

              <Button
                variant="outline" size="sm"
                className="rounded-lg border-border/80 bg-card text-xs gap-1.5"
                onClick={handleSeoAuditXlsx}
                disabled={!analysisId || seoXlsxLoading}
              >
                {seoXlsxLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Table2 className="w-3 h-3" />}
                {lang === 'ru' ? 'SEO-Аудит (профи)' : 'SEO Audit (pro)'}
              </Button>

              <Button size="sm" className="btn-gradient border-0 rounded-lg px-3.5 text-xs gap-1.5" onClick={onBack}>
                <Plus className="w-3 h-3" />
                {lang === 'ru' ? 'Новый анализ' : 'New Analysis'}
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
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
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
                    modulesTitle={lang === 'ru' ? 'Статус модулей' : 'Module status'}
                    readyLabel={lang === 'ru' ? 'готово' : 'ready'}
                    quickWinsTitle={lang === 'ru' ? 'Quick wins' : 'Quick wins'}
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