import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateDomains, aggregateQueries } from '@/lib/topAnalysis/aggregate';
import { Search, Globe, Trophy, Target } from 'lucide-react';
import { StatCard } from '@/components/dashboard/StatCard';

interface Props { rows: TopRow[] }

export function TopAnalysisMetrics({ rows }: Props) {
  if (rows.length === 0) return null;
  const queries = new Set(rows.map(r => r.query));
  const domains = aggregateDomains(rows);
  const queriesAgg = aggregateQueries(rows);

  // Лидер топа = домен с наибольшим числом попаданий в топ-3
  const leaderTop3 = [...domains].sort((a, b) => b.top3 - a.top3 || a.avgPos - b.avgPos)[0];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard icon={Search} accent="blue"   label="Запросов в анализе" value={queries.size} hint={`${queriesAgg.length} с результатами`} />
      <StatCard icon={Globe}  accent="violet" label="Доменов в топе"     value={domains.length} hint="уникальные" />
      <StatCard icon={Trophy} accent="amber"  label="Лидер топа"         value={leaderTop3?.domain || '—'} hint={`${leaderTop3?.top3 ?? 0} в топ-3`} />
      <StatCard icon={Target} accent="green"  label="Средняя позиция лидера" value={leaderTop3 ? leaderTop3.avgPos : '—'} hint="по всем запросам" />
    </div>
  );
}
