interface ScoreGaugeProps {
  score: number;
  label: string;
  description: string;
  color: string;
}

export function ScoreGauge({ score, label, description, color }: ScoreGaugeProps) {
  const circumference = 2 * Math.PI * 22;
  const progress = (score / 100) * circumference;

  return (
    <div className="glass-card p-5 flex items-center gap-4">
      <div className="relative w-14 h-14 shrink-0">
        <svg viewBox="0 0 48 48" className="w-14 h-14 -rotate-90">
          <circle cx="24" cy="24" r="22" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
          <circle
            cx="24" cy="24" r="22" fill="none"
            stroke={color}
            strokeWidth="3"
            strokeDasharray={`${progress} ${circumference}`}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <span
          className="absolute inset-0 flex items-center justify-center text-sm font-bold"
          style={{ color }}
        >
          {score}
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-semibold tracking-wider text-foreground uppercase">{label}</div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">{description}</div>
      </div>
    </div>
  );
}
