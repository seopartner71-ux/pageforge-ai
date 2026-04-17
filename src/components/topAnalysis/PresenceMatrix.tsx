import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { ArrowUpDown, ArrowUp, ArrowDown, Star } from 'lucide-react';
import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateDomains, uniqueQueries } from '@/lib/topAnalysis/aggregate';
import { isAggregator } from '@/lib/topAnalysis/aggregators';

interface Props { rows: TopRow[]; myDomain?: string }

type SortKey = 'domain' | 'sum' | 'top' | string;

function cellStyle(pos: number | undefined) {
  if (!pos) return { className: 'text-muted-foreground', text: '—' };
  if (pos <= 3) return { className: 'bg-[#D1FAE5] text-[#065F46] font-bold dark:bg-emerald-500/20 dark:text-emerald-300', text: String(pos) };
  if (pos <= 10) return { className: 'bg-[#FEF3C7] text-[#92400E] dark:bg-amber-500/15 dark:text-amber-300', text: String(pos) };
  if (pos <= 20) return { className: 'bg-[#FEE2E2] text-[#991B1B] dark:bg-rose-500/15 dark:text-rose-300', text: String(pos) };
  return { className: 'text-muted-foreground', text: String(pos) };
}

export function PresenceMatrix({ rows, myDomain }: Props) {
  const queries = useMemo(() => uniqueQueries(rows), [rows]);
  const domains = useMemo(() => aggregateDomains(rows), [rows]);

  const [sortKey, setSortKey] = useState<SortKey>('top');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const myDomainNorm = (myDomain || '').toLowerCase().trim();

  const sortedDomains = useMemo(() => {
    const arr = [...domains];
    arr.sort((a, b) => {
      // мой домен всегда наверху
      if (myDomainNorm) {
        if (a.domain === myDomainNorm && b.domain !== myDomainNorm) return -1;
        if (b.domain === myDomainNorm && a.domain !== myDomainNorm) return 1;
      }
      let av: number | string = 0;
      let bv: number | string = 0;
      if (sortKey === 'domain') { av = a.domain; bv = b.domain; }
      else if (sortKey === 'sum') { av = a.sumPos; bv = b.sumPos; }
      else if (sortKey === 'top') { av = a.coverage; bv = b.coverage; }
      else {
        av = a.byQuery.get(sortKey) ?? 9999;
        bv = b.byQuery.get(sortKey) ?? 9999;
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [domains, sortKey, sortDir, myDomainNorm]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
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

  // Адаптивная ширина колонки запроса в зависимости от их количества
  const qCount = queries.length;
  const cellW = qCount <= 8 ? 'min-w-[80px]' : qCount <= 14 ? 'min-w-[60px]' : 'min-w-[44px]';
  const cellPad = qCount <= 14 ? 'p-1.5' : 'p-1';
  const fontSize = qCount <= 14 ? 'text-[11px]' : 'text-[10px]';

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Матрица присутствия в топе</h3>
        <span className="text-xs text-muted-foreground">
          {sortedDomains.length} доменов × {queries.length} запросов
        </span>
      </div>

      <div className="rounded-md border border-border w-full">
        <table className={`w-full ${fontSize} border-collapse table-fixed`}>
          <colgroup>
            <col style={{ width: qCount <= 8 ? '180px' : qCount <= 14 ? '150px' : '130px' }} />
            {queries.map((q) => <col key={q} />)}
            <col style={{ width: '60px' }} />
            <col style={{ width: '60px' }} />
          </colgroup>
          <thead>
            <tr className="bg-secondary/60">
              <th
                onClick={() => toggleSort('domain')}
                className={`text-left ${cellPad} font-semibold cursor-pointer hover:text-primary border-r border-border align-bottom`}
              >
                Домен <SortIcon k="domain" />
              </th>
              {queries.map(q => (
                <th
                  key={q}
                  onClick={() => toggleSort(q)}
                  className={`${cellPad} font-medium cursor-pointer hover:text-primary text-center border-r border-border ${cellW} align-bottom`}
                  title={q}
                >
                  <div className="break-words leading-tight" style={{ wordBreak: 'break-word', hyphens: 'auto' }}>
                    {q}
                  </div>
                  <SortIcon k={q} />
                </th>
              ))}
              <th
                onClick={() => toggleSort('sum')}
                title="Сумма позиций — суммарное место домена по всем запросам (меньше = лучше)"
                className={`${cellPad} font-semibold cursor-pointer hover:text-primary text-center border-r border-border bg-secondary align-bottom`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Сум</span>
                  <SortIcon k="sum" />
                </span>
              </th>
              <th
                onClick={() => toggleSort('top')}
                title="Охват — в скольких запросах домен присутствует в топе (больше = лучше)"
                className={`${cellPad} font-semibold cursor-pointer hover:text-primary text-center bg-secondary align-bottom`}
              >
                <span className="inline-flex items-center gap-1">
                  <span className="text-muted-foreground text-[10px] uppercase tracking-wide">Охв</span>
                  <SortIcon k="top" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedDomains.map((d, idx) => {
              const isMine = myDomainNorm && d.domain === myDomainNorm;
              const aggr = !isMine && isAggregator(d.domain);
              return (
                <tr
                  key={d.domain}
                  className={
                    isMine
                      ? 'bg-primary/10 ring-1 ring-primary/40'
                      : aggr
                        ? 'bg-rose-500/5'
                        : idx % 2 ? 'bg-muted/20' : ''
                  }
                  title={aggr ? 'Маркетплейс / агрегатор — не учитывается в основном анализе' : undefined}
                >
                  <td className={`${cellPad} font-medium border-r border-border break-all`}>
                    <div className="flex items-center gap-1.5">
                      {isMine && <Star className="w-3 h-3 text-primary fill-primary shrink-0" />}
                      <span className={
                        isMine ? 'text-primary font-semibold'
                        : aggr ? 'text-rose-500 dark:text-rose-400'
                        : ''
                      }>{d.domain}</span>
                      {aggr && <span className="text-[9px] uppercase tracking-wide px-1 rounded bg-rose-500/15 text-rose-500 dark:text-rose-400 shrink-0">агрегатор</span>}
                    </div>
                  </td>
                  {queries.map(q => {
                    const pos = d.byQuery.get(q);
                    const s = cellStyle(pos);
                    return (
                      <td key={q} className={`${cellPad} text-center border-r border-border ${s.className}`}>
                        {s.text}
                      </td>
                    );
                  })}
                  <td className={`${cellPad} text-center border-r border-border tabular-nums`}>{d.sumPos}</td>
                  <td className={`${cellPad} text-center font-semibold tabular-nums`}>{d.coverage}</td>
                </tr>
              );
            })}
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
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-rose-500/20 inline-block" />
          <span className="text-rose-500 dark:text-rose-400">маркетплейс/агрегатор</span> (исключён из AI-анализа)
        </span>
        <span className="ml-auto">Σ — сумма позиций · ✓ — кол-во запросов с присутствием</span>
      </div>
    </Card>
  );
}
