import { Card } from '@/components/ui/card';
import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Cell,
} from 'recharts';

interface Props { rows: CompetitorRow[] }

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16'];

const fmtTooltip = (v: any) => Number(v).toLocaleString('ru-RU');

function shortDomain(d: string) {
  return d.length > 22 ? d.slice(0, 20) + '…' : d;
}

function trafficColor(value: number, max: number) {
  if (max === 0) return '#6B7280';
  const ratio = value / max;
  if (ratio >= 0.66) return '#10B981';
  if (ratio >= 0.33) return '#F59E0B';
  return '#EF4444';
}

export function CompetitorCharts({ rows }: Props) {
  if (rows.length === 0) return null;

  const trafficData = [...rows].sort((a, b) => b.traffic - a.traffic).map((r) => ({ domain: shortDomain(r.domain), value: r.traffic }));
  const maxTraffic = Math.max(...trafficData.map((d) => d.value), 1);

  const visData = [...rows].sort((a, b) => b.visibility - a.visibility).map((r) => ({ domain: shortDomain(r.domain), value: r.visibility }));

  const positions = rows.map((r) => ({
    domain: shortDomain(r.domain),
    'ТОП-1': r.top1,
    'ТОП-3': r.top3,
    'ТОП-10': r.top10,
  }));

  // Radar — нормализация: каждое значение / max по столбцу
  const radarKeys: { key: keyof CompetitorRow; label: string }[] = [
    { key: 'traffic', label: 'Трафик' },
    { key: 'visibility', label: 'Видимость' },
    { key: 'pages', label: 'Страниц' },
    { key: 'top1', label: 'Запросов в ТОП-1' },
    { key: 'keysCoverage', label: 'Охват ключей' },
  ];
  const maxByKey: Record<string, number> = {};
  for (const { key } of radarKeys) {
    maxByKey[key] = Math.max(...rows.map((r) => Number(r[key]) || 0), 1);
  }
  const radarData = radarKeys.map(({ key, label }) => {
    const item: any = { metric: label };
    rows.forEach((r) => {
      item[r.domain] = Math.round(((Number(r[key]) || 0) / maxByKey[key]) * 100);
    });
    return item;
  });

  const budgetData = [...rows].sort((a, b) => b.contextBudget - a.contextBudget).map((r) => ({ domain: shortDomain(r.domain), value: r.contextBudget }));

  const tooltipStyle = {
    background: 'hsl(var(--card))',
    border: '1px solid hsl(var(--border))',
    borderRadius: 6,
    fontSize: 12,
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Органический трафик по доменам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={trafficData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtTooltip} />
              <YAxis dataKey="domain" type="category" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
              <Bar dataKey="value" name="Трафик">
                {trafficData.map((d, i) => <Cell key={i} fill={trafficColor(d.value, maxTraffic)} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Видимость по доменам</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={visData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtTooltip} />
              <YAxis dataKey="domain" type="category" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
              <Bar dataKey="value" name="Видимость" fill="#8B5CF6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Позиции в ТОПе по доменам</h3>
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={positions} margin={{ bottom: 90, top: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="domain" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtTooltip} />
              <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
              <Legend verticalAlign="top" wrapperStyle={{ fontSize: 11, paddingBottom: 8 }} />
              <Bar dataKey="ТОП-1" fill="#10B981" />
              <Bar dataKey="ТОП-3" fill="#3B82F6" />
              <Bar dataKey="ТОП-10" fill="#F59E0B" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-medium mb-3">Сравнение метрик (нормализовано, %)</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <PolarRadiusAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
              {rows.map((r, i) => (
                <Radar
                  key={r.domain}
                  name={shortDomain(r.domain)}
                  dataKey={r.domain}
                  stroke={COLORS[i % COLORS.length]}
                  fill={COLORS[i % COLORS.length]}
                  fillOpacity={0.15}
                />
              ))}
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => `${v}%`} />
            </RadarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-medium mb-3">Рекламный бюджет в контексте</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={budgetData} margin={{ bottom: 90 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="domain" angle={-30} textAnchor="end" interval={0} height={70} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={fmtTooltip} />
            <Tooltip contentStyle={tooltipStyle} formatter={fmtTooltip} />
            <Bar dataKey="value" name="Бюджет" fill="#EF4444" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
