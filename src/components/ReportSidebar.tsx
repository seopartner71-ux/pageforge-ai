import { useState } from 'react';
import { CheckCircle2, Circle, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react';
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
      <div className="report-soft-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{modulesTitle}</span>
          <span className="text-[11px] font-medium text-emerald-500">
            {readyLabel}
          </span>
        </div>
        <div className="space-y-1">
          {modules.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${m.done ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-[12px] text-foreground/80">{m.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <div className="report-soft-panel overflow-hidden">
          <div className="border-b border-border/80 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{quickWinsTitle}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{checkedWins.size}/{quickWins.length}</span>
            </div>
          </div>
          <div className="space-y-1 p-3">
            {quickWins.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWin(i)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
                  checkedWins.has(i)
                    ? 'border-primary/20 bg-primary/5 opacity-60'
                    : 'border-border/60 hover:border-border hover:bg-secondary/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {checkedWins.has(i) ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={`text-[12px] leading-snug ${checkedWins.has(i) ? 'text-muted-foreground line-through' : 'text-foreground/80'}`}>
                    {w.text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 90-day forecast */}
      <div className="report-soft-panel p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-primary" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-foreground">Прогноз на 90 дней</span>
        </div>
        <div className="h-32 rounded-lg border border-border/60 bg-secondary/20 p-1.5">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }} axisLine={false} tickLine={false} width={24} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                  fontSize: 11,
                }}
                formatter={(value: number) => [`${value}`, 'Score']}
              />
              <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.1} strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 flex items-center justify-between text-[12px]">
          <span className="text-muted-foreground">Сейчас: <span className="font-semibold text-foreground">{currentScore}</span></span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-primary">
            {forecastData[forecastData.length - 1]?.score}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
