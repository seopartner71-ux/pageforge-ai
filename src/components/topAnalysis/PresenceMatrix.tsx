import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateDomains, uniqueQueries } from '@/lib/topAnalysis/aggregate';

interface Props { rows: TopRow[] }

type SortKey = 'domain' | 'sum' | 'top' | string; // string = query

function cellStyle(pos: number | undefined) {
  if (!pos) return { className: 'text-muted-foreground', text: '—' };
  if (pos <= 3) return { className: 'bg-[#D1FAE5] text-[#065F46] font-bold dark:bg-emerald-500/20 dark:text-emerald-300', text: String(pos) };
  if (pos <= 10) return { className: 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/15 dark:text-amber-300', text: String(pos) };
  if (pos <= 20) return { className: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-500/15 dark:text-rose-300', text: String(pos) };
  return { className: 'text-muted-foreground', text: String(pos) };
}

export function PresenceMatrix({ rows }: Props) {
  const queries = useMemo(() => uniqueQueries(rows), [rows]);
  const domains = useMemo(() => aggregateDomains(rows), [rows]);

  const [sortKey, setSortKey] = useState<SortKey>('top');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sortedDomains = useMemo(() => {
    const arr = [...domains];
    arr.sort((a, b) => {
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'domain') { av = a.domain; bv = b.domain; }
      else if (sortKey === 'sum') { av = a.sumPos; bv = b.sumPos; }
      else if (sortKey === 'top') { av = a.coverage; bv = b.coverage; }
      else {
        // sort by position в данном запросе (нет = большое число)
        av = a.byQuery.get(sortKey) ?? 9999;
        bv = b.byQuery.get(sortKey) ?? 9999;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [domains, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      // sum — лучше asc (меньше = лучше), остальные — desc
      setSortDir(key === 'sum' || key === 'domain' ? 'asc' : 'desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <ArrowUpDown className="w-3 h-3 opacity-40 inline ml-1" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 inline ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 inline ml-1 text-primary" />;
  };

  if (rows.length === 0) return null;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Матрица присутствия в топе</h3>
        <span className="text-xs text-muted-foreground">
          {sortedDomains.length} доменов × {queries.length} запросов
        </span>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-secondary/60">
              <th
                onClick={() => toggleSort('domain')}
                className="sticky left-0 z-10 bg-secondary/60 text-left p-2 font-semibold cursor-pointer hover:text-primary border-r border-border min-w-[180px]"
              >
                Домен <SortIcon k="domain" />
              </th>
              {queries.map(q => (
                <th
                  key={q}
                  onClick={() => toggleSort(q)}
                  className="p-2 font-medium cursor-pointer hover:text-primary text-center border-r border-border min-w-[110px] max-w-[140px]"
                  title={q}
                >
                  <div className="truncate">{q}</div>
                  <SortIcon k={q} />
                </th>
              ))}
              <th
                onClick={() => toggleSort('sum')}
                className="p-2 font-semibold cursor-pointer hover:text-primary text-center border-r border-border bg-secondary"
              >
                Сумма <SortIcon k="sum" />
              </th>
              <th
                onClick={() => toggleSort('top')}
                className="p-2 font-semibold cursor-pointer hover:text-primary text-center bg-secondary"
              >
                В топах <SortIcon k="top" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains.map((d, idx) => (
              <tr key={d.domain} className={idx % 2 ? 'bg-muted/20' : ''}>
                <td className="sticky left-0 z-10 bg-card p-2 font-medium border-r border-border truncate">
                  {d.domain}
                </td>
                {queries.map(q => {
                  const pos = d.byQuery.get(q);
                  const s = cellStyle(pos);
                  return (
                    <td key={q} className={`p-2 text-center border-r border-border ${s.className}`}>
                      {s.text}
                    </td>
                  );
                })}
                <td className="p-2 text-center border-r border-border tabular-nums">{d.sumPos}</td>
                <td className="p-2 text-center font-semibold tabular-nums">{d.coverage}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#D1FAE5] dark:bg-emerald-500/20 inline-block" /> 1–3
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#FEF3C7] dark:bg-amber-500/15 inline-block" /> 4–10
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-[#FEE2E2] dark:bg-rose-500/15 inline-block" /> 11–20
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="text-muted-foreground">—</span> нет в топе
        </span>
      </div>
    </Card>
  );
}
