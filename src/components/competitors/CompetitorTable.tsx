import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CompetitorRow, COMPETITOR_COLUMNS } from '@/lib/competitors/parseCompetitorsCsv';
import { cn } from '@/lib/utils';

interface Props { rows: CompetitorRow[] }

// Компактные заголовки — чтобы умещалось без горизонтального скролла
const SHORT_LABELS: Record<string, string> = {
  domain: 'Домен',
  top1: 'ТОП-1',
  top3: 'ТОП-3',
  top5: 'ТОП-5',
  top10: 'ТОП-10',
  top50: 'ТОП-50',
  aliceMentions: 'Алиса',
  pages: 'Страниц',
  byVisibility: 'По вид.',
  keysCoverage: 'Охват',
  reqPerPage: 'Зап./стр.',
  effectiveness: 'Резул.',
  visibility: 'Видимость',
  traffic: 'Трафик',
  ads: 'Объявл.',
  contextRequests: 'Зап. контекст',
  reqPerAd: 'Зап./объявл.',
  contextTraffic: 'Траф. контекст',
  contextBudget: 'Бюджет',
};

function fmtCompact(n: number): string {
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1).replace('.', ',') + ' млн';
  if (abs >= 10_000) return Math.round(n / 1_000) + ' тыс';
  return n.toLocaleString('ru-RU');
}

const fmtFull = (n: number) => n.toLocaleString('ru-RU');

export function CompetitorTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<keyof CompetitorRow>('traffic');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const minMaxByCol = useMemo(() => {
    const map: Record<string, { min: number; max: number }> = {};
    for (const c of COMPETITOR_COLUMNS) {
      if (!c.numeric) continue;
      const vals = rows.map((r) => Number(r[c.key]) || 0);
      map[c.key] = { min: Math.min(...vals), max: Math.max(...vals) };
    }
    return map;
  }, [rows]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va).localeCompare(String(vb))
        : String(vb).localeCompare(String(va));
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const handleSort = (key: keyof CompetitorRow) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const cellClass = (key: keyof CompetitorRow, value: number, higherIsBetter?: boolean) => {
    const mm = minMaxByCol[key as string];
    if (!mm || mm.min === mm.max) return '';
    const isMax = value === mm.max;
    const isMin = value === mm.min;
    const isBest = higherIsBetter ? isMax : isMin;
    const isWorst = higherIsBetter ? isMin : isMax;
    if (isBest) return 'text-green-600 dark:text-green-400 font-semibold';
    if (isWorst) return 'text-red-600 dark:text-red-400 font-semibold';
    return '';
  };

  if (rows.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border">
        <h3 className="text-sm font-medium">Сравнительная таблица доменов</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Зелёный — лучшее значение в столбце, красный — худшее. Клик по заголовку — сортировка.
        </p>
      </div>
      <div className="w-full">
        <table className="w-full text-[11px] border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            {COMPETITOR_COLUMNS.map((c) => (
              <col key={c.key as string} style={c.key === 'domain' ? { width: '140px' } : undefined} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-muted/30">
              {COMPETITOR_COLUMNS.map((c) => {
                const active = sortKey === c.key;
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <th
                    key={c.key as string}
                    onClick={() => handleSort(c.key)}
                    className={cn(
                      'px-1.5 py-2 cursor-pointer select-none text-muted-foreground font-medium hover:text-foreground transition-colors',
                      c.key === 'domain' ? 'text-left' : 'text-right',
                    )}
                    title={c.label}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      <span className="truncate">{SHORT_LABELS[c.key as string] || c.label}</span>
                      <Icon className="w-2.5 h-2.5 opacity-60 shrink-0" />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={row.domain} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                {COMPETITOR_COLUMNS.map((c) => {
                  const v = row[c.key];
                  if (!c.numeric) {
                    return (
                      <td key={c.key as string} className="px-1.5 py-1.5 font-medium text-foreground truncate" title={String(v)}>
                        {String(v)}
                      </td>
                    );
                  }
                  const num = Number(v) || 0;
                  return (
                    <td
                      key={c.key as string}
                      className={cn('px-1.5 py-1.5 text-right font-mono tabular-nums', cellClass(c.key, num, c.higherIsBetter))}
                      title={fmtFull(num)}
                    >
                      {fmtCompact(num)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
