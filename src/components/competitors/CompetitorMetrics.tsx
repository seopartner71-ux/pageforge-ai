import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import { TrendingUp, Eye, BarChart3, Globe, Trophy } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';

interface Props { rows: CompetitorRow[] }

const fmt = (n: number) => n.toLocaleString('ru-RU');

export function CompetitorMetrics({ rows }: Props) {
  if (rows.length === 0) return null;

  const trafficLeader = [...rows].sort((a, b) => b.traffic - a.traffic)[0];
  const visLeader = [...rows].sort((a, b) => b.visibility - a.visibility)[0];
  const top1Leader = [...rows].sort((a, b) => b.top1 - a.top1)[0];
  const avgTraffic = Math.round(rows.reduce((s, r) => s + r.traffic, 0) / rows.length);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      <StatCard icon={TrendingUp} accent="green"  label="Лидер по трафику"   value={trafficLeader.domain} hint={fmt(trafficLeader.traffic)} />
      <StatCard icon={Eye}        accent="teal"   label="Лидер по видимости" value={visLeader.domain}     hint={fmt(visLeader.visibility)} />
      <StatCard icon={BarChart3}  accent="blue"   label="Средний трафик"     value={fmt(avgTraffic)}      hint="по всем доменам" />
      <StatCard icon={Globe}      accent="violet" label="Всего доменов"      value={String(rows.length)}  hint="в файле" />
      <StatCard icon={Trophy}     accent="amber"  label="Лидер по ТОП-1"     value={top1Leader.domain}    hint={`${fmt(top1Leader.top1)} запросов`} />
    </div>
  );
}
