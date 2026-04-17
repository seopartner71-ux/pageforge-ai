import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MapPin, Globe2, X, ChevronDown, Target, TrendingUp, TrendingDown } from 'lucide-react';
import { TopRow, normalizeDomain } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { aggregateDomains } from '@/lib/topAnalysis/aggregate';

const REGIONS = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
  'Россия', 'Беларусь', 'Казахстан', 'Украина',
];

interface Props {
  rows: TopRow[];
  region: string;
  onRegionChange: (r: string) => void;
  myDomain: string;
  onMyDomainChange: (d: string) => void;
}

export function TopAnalysisProjectBar({ rows, region, onRegionChange, myDomain, onMyDomainChange }: Props) {
  const [regionOpen, setRegionOpen] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');

  const filteredRegions = regionSearch
    ? REGIONS.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase()))
    : REGIONS;

  const myDomainNorm = normalizeDomain(myDomain);

  // Метрики моего домена
  const myStats = useMemo(() => {
    if (!myDomainNorm || rows.length === 0) return null;
    const all = aggregateDomains(rows);
    const me = all.find(d => d.domain === myDomainNorm);
    if (!me) return { found: false as const };
    const leader = [...all].sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos)[0];
    const myRank = [...all]
      .sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos)
      .findIndex(d => d.domain === myDomainNorm) + 1;
    return {
      found: true as const,
      coverage: me.coverage,
      avgPos: me.avgPos,
      top3: me.top3,
      top10: me.top10,
      rank: myRank,
      total: all.length,
      leaderAvg: leader?.avgPos ?? 0,
      gap: +(me.avgPos - (leader?.avgPos ?? 0)).toFixed(1),
    };
  }, [rows, myDomainNorm]);

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Регион */}
        <div className="relative">
          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Регион анализа
          </label>
          <div className="relative">
            <Input
              value={region}
              onChange={(e) => { onRegionChange(e.target.value); setRegionSearch(e.target.value); setRegionOpen(true); }}
              onFocus={() => setRegionOpen(true)}
              onBlur={() => setTimeout(() => setRegionOpen(false), 150)}
              placeholder="Выберите город или введите вручную"
              className="h-9 pr-8 bg-secondary border-border/50 focus:border-primary"
            />
            {region ? (
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onRegionChange(''); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            )}
            {regionOpen && filteredRegions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                {filteredRegions.map(r => (
                  <button
                    key={r}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { onRegionChange(r); setRegionOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Мой домен */}
        <div>
          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Globe2 className="w-3.5 h-3.5" /> Ваш проект (домен)
          </label>
          <div className="relative">
            <Input
              value={myDomain}
              onChange={(e) => onMyDomainChange(e.target.value)}
              placeholder="example.com"
              className="h-9 pr-8 bg-secondary border-border/50 focus:border-primary"
            />
            {myDomain && (
              <button
                type="button"
                onClick={() => onMyDomainChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Сводка по моему домену */}
      {myStats && rows.length > 0 && (
        myStats.found ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 pt-2 border-t border-border">
            <Mini label="Место в нише" value={`#${myStats.rank}`} hint={`из ${myStats.total}`} icon={Target} accent="text-primary" />
            <Mini label="Запросов в топе" value={myStats.coverage} hint="всего по CSV" icon={TrendingUp} accent="text-emerald-500" />
            <Mini label="Средняя позиция" value={myStats.avgPos} hint={`лидер: ${myStats.leaderAvg}`} icon={Target} accent="text-amber-500" />
            <Mini label="В топ-3" value={myStats.top3} hint={`топ-10: ${myStats.top10}`} icon={TrendingUp} accent="text-emerald-500" />
            <Mini
              label="Отрыв от лидера"
              value={myStats.gap > 0 ? `+${myStats.gap}` : myStats.gap}
              hint={myStats.gap > 0 ? 'позиций хуже' : 'вы лидер'}
              icon={myStats.gap > 0 ? TrendingDown : TrendingUp}
              accent={myStats.gap > 0 ? 'text-rose-500' : 'text-emerald-500'}
            />
          </div>
        ) : (
          <div className="text-xs text-muted-foreground bg-amber-500/10 border border-amber-500/30 rounded-md px-3 py-2">
            Домен <b>{myDomainNorm}</b> не найден в загруженном CSV. Проверьте написание или добавьте его в выгрузку.
          </div>
        )
      )}
    </Card>
  );
}

function Mini({
  label, value, hint, icon: Icon, accent,
}: { label: string; value: string | number; hint?: string; icon: any; accent: string }) {
  return (
    <div className="rounded-md border border-border bg-card/50 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <Icon className={`w-3 h-3 ${accent}`} /> {label}
      </div>
      <div className={`text-base font-semibold mt-1 ${accent}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
