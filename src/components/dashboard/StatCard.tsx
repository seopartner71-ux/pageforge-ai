import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type StatAccent = 'blue' | 'green' | 'orange' | 'teal' | 'violet' | 'pink' | 'amber' | 'rose';

const ACCENT: Record<StatAccent, { fg: string; bg: string; ring: string }> = {
  blue:   { fg: 'text-[#3B82F6]', bg: 'bg-[#3B82F6]/12', ring: 'ring-[#3B82F6]/25' },
  green:  { fg: 'text-[#34D399]', bg: 'bg-[#34D399]/12', ring: 'ring-[#34D399]/25' },
  orange: { fg: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/12', ring: 'ring-[#F59E0B]/25' },
  teal:   { fg: 'text-[#06B6D4]', bg: 'bg-[#06B6D4]/12', ring: 'ring-[#06B6D4]/25' },
  violet: { fg: 'text-[#A78BFA]', bg: 'bg-[#A78BFA]/12', ring: 'ring-[#A78BFA]/25' },
  pink:   { fg: 'text-[#EC4899]', bg: 'bg-[#EC4899]/12', ring: 'ring-[#EC4899]/25' },
  amber:  { fg: 'text-[#FBBF24]', bg: 'bg-[#FBBF24]/12', ring: 'ring-[#FBBF24]/25' },
  rose:   { fg: 'text-[#F43F5E]', bg: 'bg-[#F43F5E]/12', ring: 'ring-[#F43F5E]/25' },
};

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string } | null;
  icon?: LucideIcon;
  hint?: string;
  accent?: StatAccent;
  className?: string;
}

export function StatCard({ label, value, delta, icon: Icon, hint, accent = 'blue', className }: StatCardProps) {
  const positive = (delta?.value ?? 0) >= 0;
  const a = ACCENT[accent];
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 transition-colors hover:border-border/60', className)}>
      <div className="flex items-start gap-3">
        {Icon && (
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1', a.bg, a.ring)}>
            <Icon className={cn('w-4.5 h-4.5', a.fg)} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate">{label}</div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground tabular-nums leading-none truncate">{value}</span>
            {delta && (
              <span className={cn('text-xs font-medium tabular-nums', positive ? 'text-emerald-500' : 'text-rose-500')}>
                {positive ? '+' : ''}{delta.value}{delta.label ? ` ${delta.label}` : '%'}
              </span>
            )}
          </div>
          {hint && <p className="text-[11px] text-muted-foreground mt-1 truncate">{hint}</p>}
        </div>
      </div>
    </div>
  );
}
