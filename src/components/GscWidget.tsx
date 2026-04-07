import { useLang } from '@/contexts/LangContext';
import { TrendingUp, TrendingDown, Minus, Search, Link2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

const demoData = {
  queries: [
    { query: 'seo audit tool', clicks: 245, impressions: 3400, ctr: 7.2, position: 4.2, trend: 'up' as const },
    { query: 'site analysis online', clicks: 189, impressions: 2800, ctr: 6.8, position: 6.1, trend: 'up' as const },
    { query: 'website seo checker', clicks: 156, impressions: 4200, ctr: 3.7, position: 8.5, trend: 'down' as const },
    { query: 'page optimization', clicks: 98, impressions: 1900, ctr: 5.2, position: 5.8, trend: 'stable' as const },
    { query: 'content analysis', clicks: 67, impressions: 1200, ctr: 5.6, position: 7.3, trend: 'up' as const },
  ],
  totals: { clicks: 1842, impressions: 28400, avgCtr: 6.5, avgPosition: 5.8 },
};

const TrendIcon = ({ trend }: { trend: 'up' | 'down' | 'stable' }) => {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-green-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

export function GscWidget() {
  const { lang } = useLang();
  const isRu = lang === 'ru';

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center">
            <Search className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">{isRu ? 'GSC Autopilot' : 'GSC Autopilot'}</h3>
            <span className="text-[10px] text-muted-foreground">{isRu ? 'Демо-данные' : 'Demo data'}</span>
          </div>
        </div>
        <Button variant="outline" size="sm" className="text-xs gap-1.5 opacity-60 cursor-not-allowed" disabled>
          <Link2 className="w-3 h-3" />
          {isRu ? 'Подключить GSC' : 'Connect GSC'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: isRu ? 'Клики' : 'Clicks', value: demoData.totals.clicks.toLocaleString(), color: 'text-blue-400' },
          { label: isRu ? 'Показы' : 'Impressions', value: demoData.totals.impressions.toLocaleString(), color: 'text-purple-400' },
          { label: 'CTR', value: `${demoData.totals.avgCtr}%`, color: 'text-green-400' },
          { label: isRu ? 'Позиция' : 'Position', value: demoData.totals.avgPosition.toFixed(1), color: 'text-orange-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-lg bg-muted/30 p-2.5 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Queries table */}
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div className="grid grid-cols-[1fr_60px_80px_50px_50px_30px] gap-1 px-3 py-2 text-[10px] font-medium text-muted-foreground bg-muted/20 uppercase tracking-wider">
          <span>{isRu ? 'Запрос' : 'Query'}</span>
          <span className="text-right">{isRu ? 'Клики' : 'Clicks'}</span>
          <span className="text-right">{isRu ? 'Показы' : 'Impr.'}</span>
          <span className="text-right">CTR</span>
          <span className="text-right">{isRu ? 'Поз.' : 'Pos.'}</span>
          <span />
        </div>
        {demoData.queries.map((q, i) => (
          <div key={i} className="grid grid-cols-[1fr_60px_80px_50px_50px_30px] gap-1 px-3 py-2 text-xs border-t border-border/30 hover:bg-muted/20 transition-colors items-center">
            <span className="truncate font-medium">{q.query}</span>
            <span className="text-right tabular-nums">{q.clicks}</span>
            <span className="text-right tabular-nums text-muted-foreground">{q.impressions.toLocaleString()}</span>
            <span className="text-right tabular-nums">{q.ctr}%</span>
            <span className="text-right tabular-nums">{q.position}</span>
            <span className="flex justify-end"><TrendIcon trend={q.trend} /></span>
          </div>
        ))}
      </div>

      {/* Alert demo */}
      <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 flex items-start gap-2">
        <TrendingDown className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-medium text-orange-400">
            {isRu ? 'Падение позиции: "website seo checker"' : 'Position drop: "website seo checker"'}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {isRu
              ? 'Позиция упала на 3+ пунктов → рекомендуем запустить повторный Forge'
              : 'Position dropped 3+ points → recommend re-running Forge'}
          </p>
          <Button variant="outline" size="sm" className="text-[10px] h-6 mt-2 gap-1 opacity-60 cursor-not-allowed" disabled>
            <ExternalLink className="w-3 h-3" />
            {isRu ? 'Запустить Forge' : 'Run Forge'}
          </Button>
        </div>
      </div>

      <p className="text-[10px] text-center text-muted-foreground italic">
        {isRu
          ? '🔒 Полная интеграция с Google Search Console будет доступна в следующем обновлении'
          : '🔒 Full Google Search Console integration coming in the next update'}
      </p>
    </div>
  );
}
