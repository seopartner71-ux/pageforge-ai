interface ScoreGaugeProps {
  score: number;
  label: string;
  description: string;
  color: string;
  onClick?: () => void;
  clickable?: boolean;
}

export function ScoreGauge({ score, label, description, color, onClick, clickable }: ScoreGaugeProps) {
  const circumference = 2 * Math.PI * 42;
  const progress = (score / 100) * circumference;

  return (
    <button
      type="button"
      className={`report-metric-card w-full p-7 text-left transition-all duration-500 ${clickable ? 'cursor-pointer hover:-translate-y-1 hover:border-primary/40 hover:shadow-[var(--shadow-glow)]' : 'cursor-default'}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0 space-y-3">
          <div className="report-pill">{label}</div>
          <div className="space-y-1">
            <div className="text-5xl font-black tracking-tight text-foreground">{score}</div>
            <div className="text-sm leading-relaxed text-muted-foreground max-w-[18rem]">{description || 'Метрика качества и зрелости страницы'}</div>
          </div>
          {clickable && <div className="text-xs font-medium text-primary">Перейти к деталям →</div>}
        </div>

        <div className="relative shrink-0">
          <div
            className="absolute inset-4 rounded-full blur-2xl opacity-70"
            style={{ background: `radial-gradient(circle, ${color}55 0%, transparent 72%)` }}
          />
          <svg viewBox="0 0 100 100" className="relative h-28 w-28 -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="7" />
            <circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke={color}
              strokeWidth="7"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 10px ${color})` }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-16 w-16 rounded-full border border-border/70 bg-background/80 backdrop-blur-md flex items-center justify-center text-lg font-bold text-foreground">
              {score}%
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
