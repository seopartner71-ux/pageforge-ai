import { useState } from 'react';
import { CheckCircle2, Circle, TrendingUp } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from 'recharts';

interface ModuleStatusItem {
  name: string;
  time: string;
  done: boolean;
}

interface QuickWinItem {
  text: string;
}

interface ReportSidebarProps {
  modules: ModuleStatusItem[];
  quickWins: QuickWinItem[];
  modulesTitle: string;
  readyLabel: string;
  quickWinsTitle: string;
  scores?: any;
}

export function ReportSidebar({ modules, quickWins, modulesTitle, readyLabel, quickWinsTitle, scores }: ReportSidebarProps) {
  const [checkedWins, setCheckedWins] = useState<Set<number>>(new Set());

  const toggleWin = (i: number) => {
    setCheckedWins(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  // 90-day forecast data
  const currentScore = scores?.seoHealth || 50;
  const forecastData = Array.from({ length: 7 }, (_, i) => {
    const month = i * 15;
    const growth = Math.min(currentScore + (100 - currentScore) * (1 - Math.exp(-i * 0.4)), 98);
    return {
      day: `${month}д`,
      score: Math.round(i === 0 ? currentScore : growth),
    };
  });

  return (
    <div className="space-y-4">
      {/* Module status */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs tracking-widest text-muted-foreground font-semibold">{modulesTitle}</h3>
          <span className="text-xs font-semibold text-accent">✓ {readyLabel}</span>
        </div>
        <div className="space-y-2.5">
          {modules.map((m, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${m.done ? 'bg-accent' : 'bg-muted-foreground'}`} />
                <span className="text-sm text-foreground">{m.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{m.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins Checklist */}
      {quickWins.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs tracking-widest text-muted-foreground font-semibold">{quickWinsTitle}</h3>
            <span className="text-xs text-accent font-medium">{checkedWins.size}/{quickWins.length}</span>
          </div>
          <div className="space-y-2">
            {quickWins.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWin(i)}
                className={`w-full flex items-start gap-2.5 text-left p-2 rounded-lg transition-all ${
                  checkedWins.has(i) ? 'bg-accent/5 opacity-60' : 'hover:bg-secondary/50'
                }`}
              >
                {checkedWins.has(i) ? (
                  <CheckCircle2 className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                ) : (
                  <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                )}
                <span className={`text-sm leading-snug ${checkedWins.has(i) ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                  {w.text}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 90-day Forecast */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="text-xs tracking-widest text-muted-foreground font-semibold">ПРОГНОЗ НА 90 ДНЕЙ</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Ожидаемый рост SEO Health при выполнении всех рекомендаций
        </p>
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <XAxis dataKey="day" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff', fontSize: 12 }}
                formatter={(value: number) => [`${value}`, 'SEO Score']}
              />
              <Area type="monotone" dataKey="score" stroke="hsl(142,71%,45%)" fill="hsl(142,71%,45%)" fillOpacity={0.15} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-between mt-2 text-xs">
          <span className="text-muted-foreground">Сейчас: <span className="text-foreground font-bold">{currentScore}</span></span>
          <span className="text-accent font-bold">→ {forecastData[forecastData.length - 1]?.score}</span>
        </div>
      </div>
    </div>
  );
}
