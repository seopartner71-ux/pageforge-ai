import { useState, useEffect } from 'react';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface BatchItem {
  analysisId: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scores?: any;
  results?: any;
}

interface BatchReportPageProps {
  items: BatchItem[];
  onBack: () => void;
}

const SCORE_KEYS = [
  { key: 'seoHealth', labelRu: 'SEO Health', labelEn: 'SEO Health', color: 'hsl(25, 95%, 53%)' },
  { key: 'llmFriendly', labelRu: 'LLM-Дружелюбность', labelEn: 'LLM-Friendly', color: 'hsl(210, 100%, 52%)' },
  { key: 'humanTouch', labelRu: 'Человечность', labelEn: 'Human Touch', color: 'hsl(142, 71%, 45%)' },
  { key: 'sgeAdapt', labelRu: 'SGE Адаптация', labelEn: 'SGE Adapt', color: 'hsl(280, 67%, 55%)' },
];

function ScoreCell({ value, best }: { value: number; best: boolean }) {
  const color = value >= 70 ? 'text-green-400' : value >= 40 ? 'text-yellow-400' : 'text-red-400';
  return (
    <td className={`px-3 py-2 text-center tabular-nums font-semibold ${color}`}>
      {value}
      {best && <span className="ml-1 text-[10px]">👑</span>}
    </td>
  );
}

export default function BatchReportPage({ items, onBack }: BatchReportPageProps) {
  const { lang } = useLang();
  const navigate = useNavigate();
  const isRu = lang === 'ru';
  const [loaded, setLoaded] = useState<BatchItem[]>(items);

  // Poll for results
  useEffect(() => {
    const pending = loaded.filter(i => i.status !== 'completed' && i.status !== 'failed');
    if (pending.length === 0) return;

    const interval = setInterval(async () => {
      const ids = loaded.map(i => i.analysisId);
      const { data: analyses } = await supabase
        .from('analyses')
        .select('id, status')
        .in('id', ids);

      if (!analyses) return;

      const completedIds = analyses.filter(a => a.status === 'completed').map(a => a.id);
      const failedIds = analyses.filter(a => a.status === 'failed').map(a => a.id);

      if (completedIds.length === 0 && failedIds.length === 0) return;

      // Fetch results for completed
      let resultsMap: Record<string, any> = {};
      if (completedIds.length > 0) {
        const { data: results } = await supabase
          .from('analysis_results')
          .select('*')
          .in('analysis_id', completedIds);
        if (results) {
          for (const r of results) {
            resultsMap[r.analysis_id] = r;
          }
        }
      }

      setLoaded(prev => prev.map(item => {
        if (completedIds.includes(item.analysisId)) {
          const r = resultsMap[item.analysisId];
          return { ...item, status: 'completed' as const, scores: r?.scores, results: r };
        }
        if (failedIds.includes(item.analysisId)) {
          return { ...item, status: 'failed' as const };
        }
        return item;
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, [loaded]);

  const completedItems = loaded.filter(i => i.status === 'completed' && i.scores);
  const allDone = loaded.every(i => i.status === 'completed' || i.status === 'failed');

  // Find best score per metric
  const bestScores: Record<string, number> = {};
  SCORE_KEYS.forEach(sk => {
    let best = -1;
    completedItems.forEach(item => {
      const val = item.scores?.[sk.key] || 0;
      if (val > best) best = val;
    });
    bestScores[sk.key] = best;
  });

  // Average score
  const avgScore = (key: string) => {
    if (completedItems.length === 0) return 0;
    return Math.round(completedItems.reduce((sum, i) => sum + (i.scores?.[key] || 0), 0) / completedItems.length);
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {isRu ? '← Назад' : '← Back'}
        </Button>

        <div className="glass-card px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold">
                {isRu ? '📊 Сводный отчёт' : '📊 Batch Report'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isRu
                  ? `${loaded.length} страниц • ${completedItems.length} завершено`
                  : `${loaded.length} pages • ${completedItems.length} completed`
                }
              </p>
            </div>
            {!allDone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                {isRu ? 'Анализируем...' : 'Analyzing...'}
              </div>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {loaded.map((item, i) => (
            <div key={item.analysisId} className={`glass-card p-3 ${item.status === 'completed' ? 'border-green-500/20' : item.status === 'failed' ? 'border-red-500/20' : 'border-border/50'}`}>
              <div className="flex items-center gap-2 mb-1">
                {item.status === 'completed' ? (
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                ) : item.status === 'failed' ? (
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                ) : (
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                )}
                <span className="text-xs font-medium truncate">{new URL(item.url).hostname}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{item.url}</p>
              {item.scores && (
                <div className="mt-2 text-xs font-bold text-primary">
                  SEO: {item.scores.seoHealth || 0}%
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Comparison table */}
        {completedItems.length >= 2 && (
          <div className="glass-card p-5 overflow-x-auto">
            <h2 className="text-sm font-semibold mb-4">
              {isRu ? '📋 Сравнительная таблица' : '📋 Comparison Table'}
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                    {isRu ? 'Метрика' : 'Metric'}
                  </th>
                  {completedItems.map((item, i) => (
                    <th key={i} className="px-3 py-2 text-xs text-muted-foreground font-medium text-center max-w-[140px]">
                      <div className="truncate">{new URL(item.url).pathname || '/'}</div>
                      <div className="text-[10px] truncate opacity-60">{new URL(item.url).hostname}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-xs text-muted-foreground font-medium text-center">
                    {isRu ? 'Среднее' : 'Average'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {SCORE_KEYS.map(sk => (
                  <tr key={sk.key} className="border-b border-border/30 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2 text-xs font-medium" style={{ color: sk.color }}>
                      {isRu ? sk.labelRu : sk.labelEn}
                    </td>
                    {completedItems.map((item, i) => {
                      const val = item.scores?.[sk.key] || 0;
                      return <ScoreCell key={i} value={val} best={val === bestScores[sk.key] && completedItems.length > 1} />;
                    })}
                    <td className="px-3 py-2 text-center tabular-nums text-muted-foreground font-medium">
                      {avgScore(sk.key)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Quick wins comparison */}
        {completedItems.length >= 2 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {completedItems.map((item, i) => {
              const qw = (item.results?.quick_wins as any[]) || [];
              return (
                <div key={i} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold truncate flex-1">{new URL(item.url).pathname || '/'}</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 gap-1"
                      onClick={() => navigate(`/report/${item.analysisId}`)}
                    >
                      <ExternalLink className="w-3 h-3" />
                      {isRu ? 'Подробнее' : 'Details'}
                    </Button>
                  </div>
                  {qw.length > 0 ? (
                    <ul className="space-y-1.5">
                      {qw.slice(0, 5).map((w: any, j: number) => (
                        <li key={j} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${w.priority === 'high' ? 'bg-red-500' : w.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                          <span className="text-muted-foreground">{w.task}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      {isRu ? 'Нет рекомендаций' : 'No recommendations'}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Waiting state */}
        {completedItems.length < 2 && !allDone && (
          <div className="glass-card p-12 text-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">
              {isRu ? 'Ожидаем завершения анализов для построения сводного отчёта...' : 'Waiting for analyses to complete for comparison report...'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
