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
    <div className="space-y-6">
      <div className="report-soft-panel p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground/60 mb-2">{modulesTitle}</div>
            <h3 className="text-sm font-bold text-foreground">Состояние анализа</h3>
          </div>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
            ✓ {readyLabel}
          </span>
        </div>
        <div className="space-y-1.5">
          {modules.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl border border-border/30 bg-background/30 px-3 py-2">
              <div className="flex items-center gap-2.5">
                <div className={`h-2 w-2 rounded-full ${m.done ? 'bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]' : 'bg-muted-foreground/40'}`} />
                <span className="text-[13px] text-foreground/90">{m.name}</span>
              </div>
              <span className="text-[11px] text-muted-foreground/60 font-medium">{m.time}</span>
            </div>
          ))}
        </div>
      </div>

      {quickWins.length > 0 && (
        <div className="report-soft-panel overflow-hidden">
          <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">{quickWinsTitle}</h3>
              </div>
              <span className="rounded-full border border-border/70 bg-background/70 px-2.5 py-1 text-xs text-muted-foreground">{checkedWins.size}/{quickWins.length}</span>
            </div>
            <p className="text-sm text-muted-foreground">Быстрые улучшения с максимальным эффектом без полной переработки страницы.</p>
          </div>
          <div className="space-y-2 p-4">
            {quickWins.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWin(i)}
                className={`w-full rounded-2xl border px-3 py-3 text-left transition-all duration-300 ${
                  checkedWins.has(i)
                    ? 'border-primary/25 bg-primary/10 opacity-70'
                    : 'border-border/60 bg-background/35 hover:border-primary/25 hover:bg-background/55'
                }`}
              >
                <div className="flex items-start gap-3">
                  {checkedWins.has(i) ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <div className={`text-sm leading-snug ${checkedWins.has(i) ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                      {w.text}
                    </div>
                    {!checkedWins.has(i) && <div className="mt-1 text-xs text-primary">Быстрый выигрыш →</div>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="report-soft-panel p-5">
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground">Прогноз на 90 дней</h3>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Если внедрить все рекомендации, метрика SEO Health будет расти более предсказуемо и стабильно.
        </p>
        <div className="h-36 rounded-2xl border border-border/60 bg-background/30 p-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={forecastData}>
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '16px',
                  color: 'hsl(var(--foreground))',
                  fontSize: 12,
                }}
                formatter={(value: number) => [`${value}`, 'SEO Score']}
              />
              <Area type="monotone" dataKey="score" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.16} strokeWidth={2.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Сейчас: <span className="font-bold text-foreground">{currentScore}</span></span>
          <span className="inline-flex items-center gap-1 font-semibold text-primary">
            {forecastData[forecastData.length - 1]?.score}
            <ArrowUpRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </div>
  );
}
