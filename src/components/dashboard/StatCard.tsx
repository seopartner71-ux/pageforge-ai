import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string | number;
  delta?: { value: number; label?: string } | null;
  icon?: LucideIcon;
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, delta, icon: Icon, hint, className }: StatCardProps) {
  const positive = (delta?.value ?? 0) >= 0;
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        {Icon && <Icon className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-semibold text-foreground tabular-nums">{value}</span>
        {delta && (
          <span className={cn('text-xs font-medium tabular-nums', positive ? 'text-emerald-500' : 'text-rose-500')}>
            {positive ? '+' : ''}{delta.value}{delta.label ? ` ${delta.label}` : '%'}
          </span>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
