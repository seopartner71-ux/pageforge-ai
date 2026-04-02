import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ReportTabs } from '@/components/ReportTabs';
import { ReportSidebar } from '@/components/ReportSidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Code, Plus, Loader2, Download } from 'lucide-react';
import { downloadPdf, getActiveTemplate } from '@/lib/downloadPdf';
import { supabase } from '@/integrations/supabase/client';

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

export default function ReportPage({ url, analysisId, onBack }: ReportPageProps) {
  const { tr, lang } = useLang();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<any>(null);

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
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Code className="w-3 h-3" />
              {lang === 'ru' ? 'Посмотреть JSON' : 'View JSON'}
            </Button>
            <Button size="sm" className="btn-gradient border-0 text-xs gap-1.5" onClick={onBack}>
              <Plus className="w-3 h-3" />
              {lang === 'ru' ? '+ Новый анализ' : '+ New Analysis'}
            </Button>
          </div>
        </div>

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
