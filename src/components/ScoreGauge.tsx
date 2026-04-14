import { useMemo } from 'react';

interface ScoreGaugeProps {
  score: number;
  label: string;
  description: string;
  color: string;
  gradientId?: string;
  gradientColors?: [string, string];
  onClick?: () => void;
  clickable?: boolean;
  featured?: boolean;
}

export function ScoreGauge({ score, label, description, color, gradientId, gradientColors, onClick, clickable, featured }: ScoreGaugeProps) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const gId = gradientId || 'g-default';

  return (
    <button
      type="button"
      className={`group relative w-full text-left transition-all duration-500 ease-out
        ${featured ? 'score-gauge-featured' : 'score-gauge-card'}
        ${clickable ? 'cursor-pointer hover:-translate-y-1.5' : 'cursor-default'}`}
      onClick={clickable ? onClick : undefined}
    >
      {/* top accent line */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* ambient glow behind gauge */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-40 w-40 rounded-full opacity-40 blur-3xl transition-opacity duration-700 group-hover:opacity-60"
        style={{ background: `radial-gradient(circle, ${gradientColors?.[0] || color}44 0%, transparent 70%)` }}
      />

      <div className="relative flex flex-col items-center gap-6 p-8 sm:p-10">
        {/* Gauge */}
        <div className="relative">
          <svg viewBox="0 0 108 108" className={`relative -rotate-90 ${featured ? 'h-36 w-36' : 'h-32 w-32'}`}>
            <defs>
              {gradientColors && (
                <linearGradient id={gId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={gradientColors[0]} />
                  <stop offset="100%" stopColor={gradientColors[1]} />
                </linearGradient>
              )}
            </defs>
            {/* background track */}
            <circle cx="54" cy="54" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="5" strokeOpacity="0.5" />
            {/* progress arc */}
            <circle
              cx="54" cy="54" r={radius}
              fill="none"
              stroke={gradientColors ? `url(#${gId})` : color}
              strokeWidth="6"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
              style={{ filter: `drop-shadow(0 0 14px ${gradientColors?.[0] || color})` }}
            />
          </svg>
          {/* center number */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`flex flex-col items-center justify-center rounded-full border border-border/50 bg-background/90 backdrop-blur-xl
              ${featured ? 'h-24 w-24' : 'h-20 w-20'}`}>
              <span className={`font-black tracking-tight leading-none text-foreground ${featured ? 'text-3xl' : 'text-2xl'}`}>
                {score}
              </span>
              <span className="text-[10px] font-medium text-muted-foreground mt-0.5">/ 100</span>
            </div>
          </div>
        </div>

        {/* Label & description */}
        <div className="text-center space-y-1.5">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
          {description && (
            <div className="text-xs leading-relaxed text-muted-foreground/70 max-w-[14rem] mx-auto">{description}</div>
          )}
        </div>

        {clickable && (
          <div className="text-[11px] font-semibold text-primary tracking-wide opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Перейти к деталям →
          </div>
        )}
      </div>
    </button>
  );
}
