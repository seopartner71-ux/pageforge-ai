import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { AlertTriangle, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export interface Insight {
  priority: 'critical' | 'warning' | 'good';
  metric: string;
  fact: string;
  recommendation: string;
}

interface Props {
  sites: Array<{
    name: string; totalLinks: number; uniqueDomains: number;
    avgDR: number; followPct: number; textPct: number;
  }>;
  summary: Array<{
    domain: string; dr: number; top10: number; top50: number;
    traffic: number; backlinks: number; refDomains: number;
  }>;
  onLoaded?: (insights: Insight[]) => void;
}

const STYLES = {
  critical: {
    bg: 'bg-destructive/10 border-destructive/30',
    text: 'text-destructive',
    icon: AlertCircle,
    label: 'Критично',
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    icon: AlertTriangle,
    label: 'Важно',
  },
  good: {
    bg: 'bg-emerald-500/10 border-emerald-500/30',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: CheckCircle2,
    label: 'Хорошо',
  },
} as const;

export function InsightsBlock({ sites, summary, onLoaded }: Props) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchInsights = async () => {
      if (!sites.length && !summary.length) return;
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('link-audit-insights', {
          body: { sites, summary },
        });
        if (cancelled) return;
        if (error) throw error;
        const list: Insight[] = data?.insights || [];
        setInsights(list);
        onLoaded?.(list);
      } catch (e) {
        console.error('insights fetch failed:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchInsights();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(sites), JSON.stringify(summary)]);

  if (!loading && !insights.length) return null;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Выводы и рекомендации</h2>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {insights.map((ins, i) => {
          const s = STYLES[ins.priority];
          const Icon = s.icon;
          return (
            <div key={i} className={`rounded-md border p-3 ${s.bg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                <Icon className={`w-4 h-4 ${s.text}`} />
                <span className={`text-[11px] font-semibold uppercase tracking-wide ${s.text}`}>
                  {s.label}
                </span>
                <span className="text-[11px] text-muted-foreground">· {ins.metric}</span>
              </div>
              <p className="text-sm font-medium mb-1">{ins.fact}</p>
              <p className="text-xs text-muted-foreground">{ins.recommendation}</p>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
