import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Sparkles, ArrowRight, ArrowLeft, X, Search, Globe, Link2, Target, Check,
} from 'lucide-react';

const STORAGE_KEY = 'pageforge:demoTourSeen';

type Step = {
  id: string;
  icon: any;
  title: string;
  subtitle: string;
  description: string;
  route?: string;
  exampleUrl?: string;
  highlightSelector?: string;
  ctaLabel: string;
  hint?: string;
};

const STEPS: Step[] = [
  {
    id: 'intro',
    icon: Sparkles,
    title: 'Добро пожаловать в PageForge',
    subtitle: 'Краткая экскурсия по 4 ключевым модулям',
    description:
      'За 2 минуты покажем, как платформа помогает делать SEO-аудит, проверять оптимизацию под AI-ответы, анализировать ссылки и определять интент запросов.',
    ctaLabel: 'Начать тур',
  },
  {
    id: 'seo',
    icon: Search,
    title: 'SEO-Аудит страниц',
    subtitle: 'Шаг 1 из 4 · /dashboard',
    description:
      'Полный аудит за 30 секунд: TF-IDF, N-граммы, закон Ципфа, сравнение с ТОП-10. Вставьте URL — мы спарсим страницу и конкурентов из выдачи Serper.dev.',
    route: '/dashboard',
    exampleUrl: 'https://example.com/page',
    highlightSelector: '[data-tour="seo-url"]',
    ctaLabel: 'Перейти к SEO-Аудиту',
    hint: 'URL подставлен в поле. Нажмите «Анализировать», когда будете готовы.',
  },
  {
    id: 'geo',
    icon: Globe,
    title: 'GEO Audit — оптимизация под AI',
    subtitle: 'Шаг 2 из 4 · /geo-audit',
    description:
      '41-точечный аудит готовности страницы к ответам ChatGPT, Perplexity и Google SGE: Schema, FAQ-блоки, Definition Boxes, JSON-LD, цитируемость.',
    route: '/geo-audit',
    exampleUrl: 'https://example.com/page',
    highlightSelector: '[data-tour="geo-url"]',
    ctaLabel: 'Перейти к GEO Audit',
    hint: 'URL подставлен — запустите аудит, чтобы увидеть GEO Score.',
  },
  {
    id: 'link',
    icon: Link2,
    title: 'Ссылочный аудит',
    subtitle: 'Шаг 3 из 4 · /link-audit',
    description:
      'Загрузите CSV-выгрузку из Ahrefs/GSC — система оценит качество доноров, токсичность и даст AI-рекомендации по дезавуированию.',
    route: '/link-audit',
    ctaLabel: 'Перейти к ссылочному аудиту',
    hint: 'Здесь нужен CSV-файл — пример формата найдёте в подсказке на странице.',
  },
  {
    id: 'intent',
    icon: Target,
    title: 'Проверка интента',
    subtitle: 'Шаг 4 из 4 · /intent',
    description:
      'Введите список запросов — мы определим тип сайтов в ТОП-10 (коммерция / информация / агрегаторы) и подскажем, какой контент создавать.',
    route: '/intent',
    exampleUrl: 'купить ноутбук\nкак выбрать ноутбук\nноутбуки рейтинг 2026',
    highlightSelector: '[data-tour="intent-queries"]',
    ctaLabel: 'Перейти к Интенту',
    hint: 'Пример из 3 запросов уже добавлен — запустите анализ.',
  },
  {
    id: 'done',
    icon: Check,
    title: 'Готово!',
    subtitle: 'Вы освоили основы PageForge',
    description:
      'В навигации сверху доступны ещё «Конкуренты», «Анализ топа» и «История проектов». Удачных аудитов 🚀',
    ctaLabel: 'Закрыть',
  },
];

export function markDemoTourSeen() {
  try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
}
export function hasDemoTourBeenSeen(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function DemoTour({ open, onClose }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stepIdx, setStepIdx] = useState(0);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  const step = STEPS[stepIdx];

  const close = useCallback(() => {
    markDemoTourSeen();
    setStepIdx(0);
    setHighlightRect(null);
    onClose();
  }, [onClose]);

  // Track highlighted element on the current page
  useEffect(() => {
    if (!open) { setHighlightRect(null); return; }
    if (!step.highlightSelector) { setHighlightRect(null); return; }
    if (step.route && location.pathname !== step.route) { setHighlightRect(null); return; }

    let raf = 0;
    const update = () => {
      const el = document.querySelector(step.highlightSelector!) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlightRect(rect);
        // try to populate the URL field
        if (step.exampleUrl) {
          const target = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA'
            ? (el as HTMLInputElement | HTMLTextAreaElement)
            : el.querySelector('input,textarea') as HTMLInputElement | HTMLTextAreaElement | null;
          if (target && !target.value) {
            const setter = Object.getOwnPropertyDescriptor(
              target.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
              'value'
            )?.set;
            setter?.call(target, step.exampleUrl);
            target.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        // retry until element appears
        raf = window.setTimeout(update, 300) as unknown as number;
      }
    };
    update();
    const onResize = () => update();
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      clearTimeout(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open, stepIdx, location.pathname, step.highlightSelector, step.route, step.exampleUrl]);

  if (!open) return null;

  const Icon = step.icon;
  const isLast = stepIdx === STEPS.length - 1;
  const isFirst = stepIdx === 0;

  const handleNext = () => {
    if (isLast) { close(); return; }
    const next = STEPS[stepIdx + 1];
    if (next.route && location.pathname !== next.route) {
      navigate(next.route);
    }
    setStepIdx(stepIdx + 1);
  };

  const handlePrev = () => {
    if (isFirst) return;
    const prev = STEPS[stepIdx - 1];
    if (prev.route && location.pathname !== prev.route) {
      navigate(prev.route);
    }
    setStepIdx(stepIdx - 1);
  };

  const showSpotlight = !!highlightRect && !!step.highlightSelector;

  return (
    <div className="fixed inset-0 z-[100] animate-fade-in" role="dialog" aria-modal="true">
      {/* Backdrop with spotlight cutout */}
      {showSpotlight ? (
        <svg className="fixed inset-0 w-full h-full pointer-events-none">
          <defs>
            <mask id="tour-mask">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={highlightRect!.x - 8}
                y={highlightRect!.y - 8}
                width={highlightRect!.width + 16}
                height={highlightRect!.height + 16}
                rx="10"
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.7)" mask="url(#tour-mask)" />
          <rect
            x={highlightRect!.x - 8}
            y={highlightRect!.y - 8}
            width={highlightRect!.width + 16}
            height={highlightRect!.height + 16}
            rx="10"
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            className="animate-pulse"
          />
        </svg>
      ) : (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={close} />
      )}

      {/* Step card */}
      <div
        className={
          showSpotlight
            ? 'fixed bottom-6 right-6 w-[420px] max-w-[calc(100vw-3rem)] animate-scale-in'
            : 'fixed inset-0 flex items-center justify-center p-4 pointer-events-none'
        }
      >
        <Card
          className={
            'pointer-events-auto border-primary/40 shadow-2xl ' +
            (showSpotlight ? 'w-full' : 'w-[520px] max-w-full animate-scale-in')
          }
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-medium">
                    {step.subtitle}
                  </div>
                  <h2 className="text-base font-semibold leading-tight">{step.title}</h2>
                </div>
              </div>
              <button
                onClick={close}
                className="text-muted-foreground hover:text-foreground p-1 rounded transition-colors"
                aria-label="Закрыть тур"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-foreground/80 leading-relaxed mb-3">{step.description}</p>

            {step.hint && (
              <div className="text-[12px] text-primary bg-primary/10 border border-primary/20 rounded-md px-3 py-2 mb-4">
                💡 {step.hint}
              </div>
            )}

            {/* Progress dots */}
            <div className="flex items-center justify-center gap-1.5 mb-4">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={
                    'h-1.5 rounded-full transition-all ' +
                    (i === stepIdx ? 'w-6 bg-primary' : i < stepIdx ? 'w-1.5 bg-primary/60' : 'w-1.5 bg-border')
                  }
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <Button variant="ghost" size="sm" onClick={handlePrev} disabled={isFirst}>
                <ArrowLeft className="w-4 h-4 mr-1" /> Назад
              </Button>
              <div className="flex items-center gap-2">
                {!isLast && (
                  <Button variant="ghost" size="sm" onClick={close} className="text-muted-foreground">
                    Пропустить
                  </Button>
                )}
                <Button size="sm" onClick={handleNext}>
                  {step.ctaLabel}
                  {!isLast && <ArrowRight className="w-4 h-4 ml-1" />}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}