import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateDomains, aggregateQueries } from '@/lib/topAnalysis/aggregate';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend,
} from 'recharts';

interface Props { rows: TopRow[] }

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: 8,
  fontSize: 12,
};

function avgPosColor(pos: number) {
  // Зелёный (1) → красный (20)
  if (pos <= 3) return '#16A34A';
  if (pos <= 6) return '#65A30D';
  if (pos <= 10) return '#F59E0B';
  if (pos <= 15) return '#EA580C';
  return '#DC2626';
}

export function TopAnalysisCharts({ rows }: Props) {
  const domains = useMemo(() => aggregateDomains(rows), [rows]);
  const queries = useMemo(() => aggregateQueries(rows), [rows]);

  // 1. Частота появления в топе (топ-15 по охвату)
  const frequency = useMemo(
    () => [...domains].sort((a, b) => b.coverage - a.coverage).slice(0, 15)
      .map(d => ({ domain: d.domain, count: d.coverage })),
    [domains],
  );

  // 2. Средняя позиция (топ-15)
  const avgPositions = useMemo(
    () => [...domains].sort((a, b) => b.coverage - a.coverage).slice(0, 15)
      .map(d => ({ domain: d.domain, avgPos: d.avgPos, invertedScore: +(21 - d.avgPos).toFixed(1) })),
    [domains],
  );

  // 3. Карта конкуренции по запросам
  const competitionMap = useMemo(
    () => queries.map(q => {
      const top3 = q.byDomain.filter(b => b.position <= 3).length;
      const top5 = q.byDomain.filter(b => b.position > 3 && b.position <= 5).length;
      const top10 = q.byDomain.filter(b => b.position > 5 && b.position <= 10).length;
      const short = q.query.length > 20 ? q.query.slice(0, 20) + '…' : q.query;
      return { query: short, fullQuery: q.query, top3, top5, top10 };
    }),
    [queries],
  );

  // 4. Пересечение доменов (5+ запросов)
  const intersections = useMemo(
    () => domains.filter(d => d.coverage >= 5)
      .sort((a, b) => b.coverage - a.coverage)
      .map(d => ({ domain: d.domain, count: d.coverage })),
    [domains],
  );

  if (rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Частота */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Частота появления в топе (топ-15)</h3>
        <ResponsiveContainer width="100%" height={Math.max(280, frequency.length * 26)}>
          <BarChart data={frequency} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
            <YAxis type="category" dataKey="domain" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
            <Tooltip contentStyle={tooltipStyle} />
            <Bar dataKey="count" fill="#EA580C" name="Запросов" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 2. Средняя позиция */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Средняя позиция доменов (топ-15)</h3>
        <ResponsiveContainer width="100%" height={Math.max(280, avgPositions.length * 26)}>
          <BarChart data={avgPositions} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 20]} />
            <YAxis type="category" dataKey="domain" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(_v, _n, p: any) => [p.payload.avgPos, 'Средняя позиция']}
            />
            <Bar dataKey="invertedScore" radius={[0, 4, 4, 0]} name="Инвертированно (выше = лучше)">
              {avgPositions.map((d, i) => (
                <Cell key={i} fill={avgPosColor(d.avgPos)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 3. Карта конкуренции */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Карта конкуренции по запросам</h3>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={competitionMap} margin={{ top: 5, right: 8, left: 0, bottom: 90 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="query" stroke="hsl(var(--muted-foreground))" fontSize={10} angle={-30} textAnchor="end" height={90} interval={0} tickMargin={6} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
            <Tooltip contentStyle={tooltipStyle} labelFormatter={(_l, p: any) => p?.[0]?.payload?.fullQuery || _l} />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} verticalAlign="top" align="center" />
            <Bar dataKey="top3" stackId="a" fill="#16A34A" name="Топ-3" />
            <Bar dataKey="top5" stackId="a" fill="#EA580C" name="Топ 4–5" />
            <Bar dataKey="top10" stackId="a" fill="#3B82F6" name="Топ 6–10" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* 4. Пересечение */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">
          Пересечение доменов (5+ запросов){intersections.length === 0 && <span className="ml-2 text-xs text-muted-foreground font-normal">— нет таких</span>}
        </h3>
        {intersections.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(280, intersections.length * 26)}>
            <BarChart data={intersections} layout="vertical" margin={{ top: 5, right: 16, left: 8, bottom: 5 }}>
              <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
              <YAxis type="category" dataKey="domain" stroke="hsl(var(--muted-foreground))" fontSize={11} width={140} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="count" fill="#8B5CF6" name="Запросов" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-muted-foreground py-10 text-center">Нет доменов, присутствующих в 5+ запросах</p>
        )}
      </Card>
    </div>
  );
}
