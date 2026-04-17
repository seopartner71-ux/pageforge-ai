import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateQueries } from '@/lib/topAnalysis/aggregate';

interface Props { rows: TopRow[] }

function posBadgeClass(pos: number) {
  if (pos <= 3) return 'bg-[#D1FAE5] text-[#065F46] dark:bg-emerald-500/20 dark:text-emerald-300';
  if (pos <= 10) return 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/15 dark:text-amber-300';
  if (pos <= 20) return 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-500/15 dark:text-rose-300';
  return 'bg-muted text-muted-foreground';
}

function compBadge(level: string) {
  if (level === 'высокая') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  if (level === 'средняя') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
}

export function QueriesTable({ rows }: Props) {
  const queries = useMemo(() => aggregateQueries(rows), [rows]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (q: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(q)) next.delete(q); else next.add(q);
      return next;
    });
  };

  if (queries.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3">Анализ по запросам</h3>
      <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
        {queries.map((q) => {
          const open = expanded.has(q.query);
          return (
            <div key={q.query}>
              <button
                onClick={() => toggle(q.query)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 text-left"
              >
                <ChevronRight className={`w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0 ${open ? 'rotate-90' : ''}`} />
                <span className="text-sm font-medium flex-1 truncate">{q.query}</span>
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  {q.domainsCount} {q.domainsCount === 1 ? 'домен' : q.domainsCount < 5 ? 'домена' : 'доменов'}
                </Badge>
                <span className={`text-[10px] px-2 py-0.5 rounded border shrink-0 ${compBadge(q.competitionLevel)}`}>
                  Конкуренция: {q.competitionLevel}
                </span>
              </button>

              {open && (
                <div className="bg-muted/20 px-3 py-2 space-y-1">
                  {q.byDomain.map((d, i) => (
                    <div key={d.domain} className="flex items-center gap-3 text-xs py-1">
                      <span className="text-muted-foreground tabular-nums w-6 shrink-0">{i + 1}.</span>
                      <span className="font-medium truncate w-44 shrink-0" title={d.domain}>{d.domain}</span>
                      <a
                        href={d.url || `https://${d.domain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-primary truncate flex-1 inline-flex items-center gap-1 min-w-0"
                        title={d.url}
                      >
                        <span className="truncate">{(d.url || '').replace(/^https?:\/\//, '') || '—'}</span>
                        {d.url && <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-60" />}
                      </a>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium tabular-nums shrink-0 ${posBadgeClass(d.position)}`}>
                        топ-{d.position}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
