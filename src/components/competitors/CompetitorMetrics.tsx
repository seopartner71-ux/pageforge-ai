import { Card } from '@/components/ui/card';
import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import { TrendingUp, Eye, BarChart3, Globe, Trophy } from 'lucide-react';

interface Props { rows: CompetitorRow[] }

const fmt = (n: number) => n.toLocaleString('ru-RU');

export function CompetitorMetrics({ rows }: Props) {
  if (rows.length === 0) return null;

  const trafficLeader = [...rows].sort((a, b) => b.traffic - a.traffic)[0];
  const visLeader = [...rows].sort((a, b) => b.visibility - a.visibility)[0];
  const top1Leader = [...rows].sort((a, b) => b.top1 - a.top1)[0];
  const avgTraffic = Math.round(rows.reduce((s, r) => s + r.traffic, 0) / rows.length);

  const cards = [
    { icon: TrendingUp, label: 'Лидер по трафику', value: trafficLeader.domain, sub: fmt(trafficLeader.traffic) },
    { icon: Eye, label: 'Лидер по видимости', value: visLeader.domain, sub: fmt(visLeader.visibility) },
    { icon: BarChart3, label: 'Средний трафик', value: fmt(avgTraffic), sub: 'по всем доменам' },
    { icon: Globe, label: 'Всего доменов', value: String(rows.length), sub: 'в файле' },
    { icon: Trophy, label: 'Лидер по ТОП-1', value: top1Leader.domain, sub: `${fmt(top1Leader.top1)} запросов` },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="p-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <Icon className="w-3.5 h-3.5" />
              {c.label}
            </div>
            <div className="font-semibold text-sm truncate" title={c.value}>{c.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5 truncate">{c.sub}</div>
          </Card>
        );
      })}
    </div>
  );
}
