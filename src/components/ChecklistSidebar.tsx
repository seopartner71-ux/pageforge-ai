import { useLang } from '@/contexts/LangContext';
import {
  BarChart3, TrendingDown, Hash, Image, Link2, CircleDot,
  Globe, Map, Gauge, Search,
} from 'lucide-react';

const checkIcons = [
  BarChart3, TrendingDown, Hash, Image, Link2,
  CircleDot, Globe, Map, Gauge, Search,
];

export function ChecklistSidebar() {
  const { tr } = useLang();

  return (
    <div className="space-y-6">
      {/* What will be checked */}
      <div className="glass-card p-6">
        <h3 className="text-xs tracking-widest text-muted-foreground font-semibold mb-5">{tr.whatWillBeChecked}</h3>
        <div className="space-y-3.5">
          {tr.checks.map((check, i) => {
            const Icon = checkIcons[i] || BarChart3;
            return (
              <div key={i} className="flex items-start gap-3">
                <Icon className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                <span className="text-sm text-foreground leading-snug">{check}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent analyses */}
      <div className="glass-card p-6">
        <h3 className="text-xs tracking-widest text-muted-foreground font-semibold mb-4">{tr.recentAnalyses}</h3>
        <p className="text-sm text-muted-foreground italic">{tr.noAnalyses}</p>
      </div>
    </div>
  );
}
