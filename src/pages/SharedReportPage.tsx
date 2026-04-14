import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ScoreGauge } from '@/components/ScoreGauge';
import { Loader2, Lock } from 'lucide-react';

const ReportTabs = lazy(() => import('@/components/ReportTabs').then((m) => ({ default: m.ReportTabs })));

const scoreColors = [
  'hsl(25, 95%, 53%)',
  'hsl(210, 100%, 52%)',
  'hsl(142, 71%, 45%)',
  'hsl(280, 67%, 55%)',
];
const scoreLabels = ['SEO Health', 'LLM-Friendly', 'Human Touch', 'SGE Adapt'];

export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<any>(null);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!token) return;
    const load = async () => {
      const { data: a } = await supabase
        .from('analyses')
        .select('id, url, page_type, region, created_at')
        .eq('share_token', token)
        .single();

      if (!a) { setError(true); setLoading(false); return; }
      setAnalysis(a);

      const { data: r } = await supabase
        .from('analysis_results')
        .select('*')
        .eq('analysis_id', a.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (r) setResults(r);
      setLoading(false);
    };
    load();
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-xl font-bold text-foreground">Отчёт не найден</h1>
          <p className="text-sm text-muted-foreground">Ссылка недействительна или отчёт был удалён.</p>
        </div>
      </div>
    );
  }

  const scores = results?.scores as any;
  const scoreCards = scores
    ? [
        { score: scores.seoHealth || 0, label: scoreLabels[0], description: '', color: scoreColors[0] },
        { score: scores.llmFriendly || 0, label: scoreLabels[1], description: '', color: scoreColors[1] },
        { score: scores.humanTouch || 0, label: scoreLabels[2], description: '', color: scoreColors[2] },
        { score: scores.sgeAdapt || 0, label: scoreLabels[3], description: '', color: scoreColors[3] },
      ]
    : scoreLabels.map((l, i) => ({ score: 0, label: l, description: '', color: scoreColors[i] }));

  const tabData = (results?.tab_data as any) || {};

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur-sm">
        <div className="container flex items-center justify-between py-3">
          <span className="font-bold text-sm gradient-text">SEO-Аудит</span>
          <span className="text-xs text-muted-foreground px-2 py-1 bg-secondary rounded">Read-Only</span>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        <div className="glass-card px-6 py-3 flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{analysis.url}</span>
          {analysis.region && (
            <span className="text-[10px] px-2 py-0.5 bg-secondary rounded text-muted-foreground">{analysis.region}</span>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {new Date(analysis.created_at).toLocaleDateString()}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scoreCards.map((s, i) => (
            <ScoreGauge key={i} {...s} />
          ))}
        </div>

        <ReportTabs data={tabData} />
      </main>

      <footer className="border-t border-border/40 py-4 text-center">
        <p className="text-xs text-muted-foreground">
          Powered by <span className="gradient-text font-semibold">SEO-Аудит</span>
        </p>
      </footer>
    </div>
  );
}
