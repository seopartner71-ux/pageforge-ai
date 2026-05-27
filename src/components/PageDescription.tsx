import { Info, CheckSquare, Target, FileBarChart, LucideIcon } from 'lucide-react';

type Item = { label: string; text: string };

const ICONS: LucideIcon[] = [Info, CheckSquare, Target, FileBarChart];

interface PageDescriptionProps {
  items: Item[];
  className?: string;
}

/**
 * Единый блок-описание для страниц аудита.
 * 4 секции (Что это / Что проверяем / Зачем / Результат) в виде сетки
 * с иконкой и подписью.
 */
export function PageDescription({ items, className = '' }: PageDescriptionProps) {
  return (
    <section
      className={
        'rounded-xl border border-border/60 bg-card/40 backdrop-blur-[1px] ' +
        'p-5 md:p-6 ' +
        className
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
        {items.map((item, i) => {
          const Icon = ICONS[i % ICONS.length];
          return (
            <div key={i} className="flex gap-3">
              <div className="flex-shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
              </div>
              <div className="min-w-0 space-y-1">
                <div className="text-[11px] tracking-widest uppercase font-semibold text-muted-foreground">
                  {item.label}
                </div>
                <p className="text-sm text-foreground/85 leading-relaxed">
                  {item.text}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}