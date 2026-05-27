import { useState, type ReactNode } from 'react';
import {
  Info, CheckSquare, Target, FileBarChart, LucideIcon,
  BookOpen, ChevronDown, ExternalLink,
} from 'lucide-react';

type Item = { label: string; text: string };
type Source = { label: string; url: string };

const ICONS: LucideIcon[] = [Info, CheckSquare, Target, FileBarChart];

interface PageDescriptionProps {
  items: Item[];
  /** Развёрнутая справка с описанием методологии. */
  help?: {
    title?: string;
    /** Текст или JSX. Для простых случаев — массив абзацев. */
    content: ReactNode | string[];
    /** Ссылки на официальные источники (Google / Yandex / W3C / schema.org и т.д.). */
    sources?: Source[];
  };
  className?: string;
}

/**
 * Единый блок-описание для страниц аудита.
 * 4 секции (Что это / Что проверяем / Зачем / Результат) в виде сетки
 * с иконкой и подписью.
 */
export function PageDescription({ items, help, className = '' }: PageDescriptionProps) {
  const [open, setOpen] = useState(false);
  const paragraphs = Array.isArray(help?.content) ? help?.content : null;

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

      {help && (
        <div className="mt-5 pt-5 border-t border-border/60">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors"
            aria-expanded={open}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{help.title ?? 'Подробнее о проверке'}</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            />
          </button>

          {open && (
            <div className="mt-4 space-y-3 animate-fade-in">
              {paragraphs ? (
                paragraphs.map((p, i) => (
                  <p key={i} className="text-sm text-foreground/80 leading-relaxed">
                    {p}
                  </p>
                ))
              ) : (
                <div className="text-sm text-foreground/80 leading-relaxed space-y-3">
                  {help.content}
                </div>
              )}

              {help.sources && help.sources.length > 0 && (
                <div className="pt-2">
                  <div className="text-[11px] uppercase tracking-widest font-semibold text-muted-foreground mb-2">
                    Источники
                  </div>
                  <ul className="space-y-1.5">
                    {help.sources.map((s, i) => (
                      <li key={i}>
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {s.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}