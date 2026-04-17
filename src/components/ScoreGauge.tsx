interface ScoreGaugeProps {
  score: number;
  label: string;
  description?: string;
  color: string;
  gradientId?: string;
  gradientColors?: [string, string];
  onClick?: () => void;
  clickable?: boolean;
  featured?: boolean;
}

export function ScoreGauge({ score, label, color, onClick, clickable, featured }: ScoreGaugeProps) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;

  return (
    <button
      type="button"
      className={`group relative w-full text-left bg-transparent border-0 shadow-none p-0 transition-all duration-300
        ${clickable ? 'cursor-pointer hover:-translate-y-0.5' : 'cursor-default'}`}
      onClick={clickable ? onClick : undefined}
    >
      <div className="relative flex flex-col items-center gap-3 p-4">
        {/* Gauge */}
        <div className="relative">
          <svg viewBox="0 0 100 100" className={`relative -rotate-90 ${featured ? 'h-32 w-32' : 'h-28 w-28'}`}>
            <circle cx="50" cy="50" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
            <circle
              cx="50" cy="50" r={radius}
              fill="none"
              stroke={color}
              strokeWidth="4.5"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={featured ? { filter: `drop-shadow(0 0 6px ${color})` } : undefined}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center">
              <span className={`font-extrabold tracking-tight leading-none text-foreground ${featured ? 'text-3xl' : 'text-2xl'}`}>
                {score}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground mt-0.5">/ 100</span>
            </div>
          </div>
        </div>

        {/* Label — без капслока */}
        <div className="text-center">
          <div className="text-sm font-medium text-foreground">{label}</div>
        </div>

        {clickable && (
          <div className="text-[11px] font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            Подробнее →
          </div>
        )}
      </div>
    </button>
  );
}
