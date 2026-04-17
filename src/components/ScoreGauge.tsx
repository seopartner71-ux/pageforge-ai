import { Activity, Bot, Sparkles, Brain, type LucideIcon } from 'lucide-react';

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

// Подбираем иконку по подписи (RU/EN), чтобы не менять API
function pickIcon(label: string): LucideIcon {
  const l = label.toLowerCase();
  if (l.includes('llm')) return Bot;
  if (l.includes('human') || l.includes('человеч')) return Sparkles;
  if (l.includes('sge')) return Brain;
  return Activity;
}

// hsl/hex → rgba для мягкого фона плашки
function toSoftBg(color: string, alpha = 0.14): string {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}

export function ScoreGauge({ score, label, color, onClick, clickable, featured }: ScoreGaugeProps) {
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const Icon = pickIcon(label);
  const softBg = toSoftBg(color, 0.14);
  const softBorder = toSoftBg(color, 0.28);

  return (
    <button
      type="button"
      onClick={clickable ? onClick : undefined}
      className={`group relative w-full text-left rounded-xl border bg-card p-4 transition-all duration-300
        ${clickable ? 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40' : 'cursor-default'}
        ${featured ? 'border-primary/30 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]' : 'border-border'}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Иконка-плашка слева как в эталонном дашборде */}
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
          style={{ background: softBg, borderColor: softBorder }}
        >
          <Icon className="h-5 w-5" style={{ color }} />
        </div>

        {/* Мини-гейдж справа */}
        <div className="relative shrink-0">
          <svg viewBox="0 0 64 64" className="-rotate-90 h-11 w-11">
            <circle cx="32" cy="32" r={radius} fill="none" stroke="hsl(var(--border))" strokeWidth="4" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth="4.5"
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
        </div>
      </div>

      <div className="mt-4 space-y-1">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold tracking-tight text-foreground tabular-nums leading-none">
            {score}
          </span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      {clickable && (
        <div className="mt-2 text-[11px] font-medium text-primary opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Подробнее →
        </div>
      )}
    </button>
  );
}
