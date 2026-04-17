import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { CompetitorRow, COMPETITOR_COLUMNS } from '@/lib/competitors/parseCompetitorsCsv';

interface Props { rows: CompetitorRow[] }

const fmt = (n: number) => n.toLocaleString('ru-RU');

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
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const cellBadge = (key: keyof CompetitorRow, value: number, higherIsBetter?: boolean) => {
    const mm = minMaxByCol[key as string];
    if (!mm || mm.min === mm.max) return <span>{fmt(value)}</span>;
    const isMax = value === mm.max;
    const isMin = value === mm.min;
    const isBest = higherIsBetter ? isMax : isMin;
    const isWorst = higherIsBetter ? isMin : isMax;
    if (isBest) {
      return (
        <Badge variant="secondary" className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20 font-mono">
          {fmt(value)}
        </Badge>
      );
    }
    if (isWorst) {
      return (
        <Badge variant="secondary" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/20 font-mono">
          {fmt(value)}
        </Badge>
      );
    }
    return <span className="font-mono">{fmt(value)}</span>;
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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {COMPETITOR_COLUMNS.map((c) => {
                const active = sortKey === c.key;
                const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={c.key as string}
                    onClick={() => handleSort(c.key)}
                    className="cursor-pointer whitespace-nowrap select-none hover:text-foreground"
                  >
                    <div className="inline-flex items-center gap-1">
                      {c.label}
                      <Icon className="w-3 h-3 opacity-60" />
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.domain}>
                {COMPETITOR_COLUMNS.map((c) => {
                  const v = row[c.key];
                  return (
                    <TableCell key={c.key as string} className="whitespace-nowrap">
                      {c.numeric ? cellBadge(c.key, Number(v) || 0, c.higherIsBetter) : <span className="font-medium">{String(v)}</span>}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
