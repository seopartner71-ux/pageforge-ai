import { useState, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Globe, Play, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Bot, Search, FileCode2, BookOpen, ShieldCheck, Loader2, ArrowRight, Target, Zap, Clock,
} from 'lucide-react';

/* ─── Types ─── */
interface CheckItem {
  label: string;
  status: 'pass' | 'warn' | 'fail' | 'pending';
  detail: string;
}

interface AuditStage {
  title: string;
  icon: React.ElementType;
  color: string;
  score: number;
  items: CheckItem[];
}

/* ─── Mock data generator ─── */
function generateMockAudit(): { stages: AuditStage[]; geoScore: number; criticals: string[]; strategy: string[] } {
  const stages: AuditStage[] = [
    {
      title: 'Этап 1: Техническая доступность для ИИ',
      icon: Bot,
      color: 'hsl(var(--primary))',
      score: 72,
      items: [
        { label: 'robots.txt — блокировка GPTBot', status: 'fail', detail: 'GPTBot заблокирован в robots.txt. ИИ-поисковики не смогут проиндексировать контент.' },
        { label: 'robots.txt — Google-Extended', status: 'pass', detail: 'Google-Extended не заблокирован. AI Overview может использовать контент.' },
        { label: 'robots.txt — PerplexityBot', status: 'warn', detail: 'PerplexityBot не указан явно. Рекомендуется добавить разрешение.' },
        { label: 'robots.txt — ChatGPT-User', status: 'fail', detail: 'ChatGPT-User заблокирован. ChatGPT не сможет цитировать сайт.' },
        { label: 'XML Sitemap', status: 'pass', detail: 'Sitemap найден и валиден. 147 URL в индексе.' },
        { label: 'Индексация в GSC', status: 'pass', detail: 'Страница проиндексирована в Google Search Console.' },
        { label: 'Индексация в Bing', status: 'warn', detail: 'Страница не проверена в Bing Webmaster Tools.' },
        { label: 'Core Web Vitals', status: 'pass', detail: 'LCP: 1.8s, FID: 45ms, CLS: 0.05 — все в зелёной зоне.' },
        { label: 'TTFB', status: 'pass', detail: 'Time to First Byte: 320ms — хороший показатель.' },
        { label: 'Рендеринг JS-контента', status: 'warn', detail: 'Часть контента загружается через JavaScript. Риск неполного извлечения ИИ.' },
      ],
    },
    {
      title: 'Этап 2: Прямая проверка в ИИ',
      icon: Search,
      color: '#60A5FA',
      score: 58,
      items: [
        { label: 'Google AI Overview', status: 'warn', detail: 'Сайт упоминается в 2 из 5 тестовых AI Overviews. Низкая видимость.' },
        { label: 'ChatGPT (тестовый запрос)', status: 'fail', detail: 'ChatGPT не цитирует сайт. GPTBot заблокирован в robots.txt.' },
        { label: 'Perplexity (тестовый запрос)', status: 'warn', detail: 'Perplexity частично цитирует контент, но с ошибками в данных.' },
        { label: 'YandexGPT', status: 'pass', detail: 'YandexGPT корректно извлекает основную информацию.' },
        { label: 'Корректность цен', status: 'fail', detail: 'ИИ извлекает устаревшие цены. Schema.org Product не обновлена.' },
        { label: 'Корректность характеристик', status: 'warn', detail: 'Часть характеристик извлекается неполно из-за табличной вёрстки.' },
        { label: 'Корректность контактов', status: 'pass', detail: 'Контактные данные извлекаются корректно всеми ИИ.' },
        { label: 'Анализ "чанков" контента', status: 'warn', detail: 'Контент слабо структурирован для chunking. Рекомендуется добавить подзаголовки.' },
      ],
    },
    {
      title: 'Этап 3: Структура страниц и семантическая вёрстка',
      icon: FileCode2,
      color: '#34D399',
      score: 81,
      items: [
        { label: 'Единственный H1', status: 'pass', detail: 'На странице один H1 тег с релевантным заголовком.' },
        { label: 'Иерархия заголовков H1→H6', status: 'warn', detail: 'Пропущен уровень H3. Структура: H1→H2→H4.' },
        { label: 'Семантические теги <article>, <section>', status: 'pass', detail: 'Основной контент обёрнут в <article>, секции размечены.' },
        { label: 'Тег <nav>', status: 'pass', detail: 'Навигация корректно обёрнута в <nav>.' },
        { label: 'Тег <aside>', status: 'warn', detail: 'Боковой контент не обёрнут в <aside>.' },
        { label: 'Schema.org — основная разметка', status: 'pass', detail: 'Найдена разметка Organization и WebPage.' },
        { label: 'Schema.org — Product/Service', status: 'fail', detail: 'Отсутствует разметка Product/Service для основного контента.' },
        { label: 'Schema.org — FAQ', status: 'warn', detail: 'На странице есть FAQ-блок, но без FAQPage разметки.' },
        { label: 'Schema.org — Breadcrumbs', status: 'pass', detail: 'BreadcrumbList разметка валидна.' },
      ],
    },
    {
      title: 'Этап 4: Контент и тематический авторитет',
      icon: BookOpen,
      color: '#FBBF24',
      score: 65,
      items: [
        { label: 'Подход "Ответ-прежде-всего"', status: 'warn', detail: 'Прямой ответ на основной запрос появляется только в 3-м абзаце.' },
        { label: 'Topical Gap — покрытие темы', status: 'fail', detail: 'Обнаружены 8 подтем, которые не раскрыты у вас, но есть у конкурентов.' },
        { label: 'Topical Gap — глубина', status: 'warn', detail: 'Средняя глубина раскрытия темы: 62% от ТОП-5 конкурентов.' },
        { label: 'Мультимодальность — изображения', status: 'pass', detail: 'Релевантные изображения с alt-текстом присутствуют.' },
        { label: 'Мультимодальность — видео', status: 'fail', detail: 'Видеоконтент отсутствует. Конкуренты используют видео в 4 из 5 случаев.' },
        { label: 'Мультимодальность — таблицы/графики', status: 'warn', detail: 'Данные представлены текстом. Рекомендуется добавить таблицы сравнения.' },
        { label: 'Уникальность контента', status: 'pass', detail: 'Уникальность текста: 94%. Копипаст не обнаружен.' },
      ],
    },
    {
      title: 'Этап 5: E-E-A-T и репутация бренда',
      icon: ShieldCheck,
      color: '#A78BFA',
      score: 70,
      items: [
        { label: 'Опыт (Experience) на странице', status: 'warn', detail: 'Отсутствуют маркеры личного опыта: кейсы, отзывы, примеры использования.' },
        { label: 'Экспертиза (Expertise)', status: 'pass', detail: 'Указан автор с профессиональными регалиями. Ссылки на исследования.' },
        { label: 'Авторитетность (Authority)', status: 'warn', detail: 'Мало обратных ссылок с авторитетных доменов (DA < 30).' },
        { label: 'Доверие (Trust)', status: 'pass', detail: 'SSL сертификат, политика конфиденциальности, контакты — всё на месте.' },
        { label: 'Авторская страница', status: 'fail', detail: 'Нет отдельной страницы автора с bio и ссылками на профили.' },
        { label: 'Упоминания бренда', status: 'warn', detail: 'Бренд упоминается в 12 источниках. Среднее для ниши — 45.' },
        { label: 'Отзывы и рейтинги', status: 'warn', detail: 'Отзывы присутствуют, но не размечены AggregateRating.' },
      ],
    },
  ];

  const geoScore = Math.round(stages.reduce((s, st) => s + st.score, 0) / stages.length);

  const criticals = [
    'Разблокировать GPTBot и ChatGPT-User в robots.txt для индексации ИИ-поисковиками',
    'Добавить Schema.org Product/Service разметку для корректного извлечения цен',
    'Создать страницу автора для усиления E-E-A-T сигналов',
    'Добавить видеоконтент — конкуренты используют видео в 80% случаев',
    'Закрыть Topical Gap: раскрыть 8 недостающих подтем',
  ];

  const strategy = [
    'Неделя 1–2: Исправить robots.txt, добавить Schema.org разметку, создать авторскую страницу',
    'Неделя 3–4: Реструктурировать контент по принципу "Ответ-прежде-всего", добавить FAQ разметку',
    'Неделя 5–6: Создать видеоконтент, добавить таблицы сравнения и инфографику',
    'Неделя 7–8: Закрыть Topical Gap — написать контент по 8 недостающим подтемам',
    'Месяц 2: Наращивание E-E-A-T: публикация кейсов, получение упоминаний, линкбилдинг',
    'Месяц 2+: Мониторинг AI Overview и Perplexity, A/B тесты структуры контента',
  ];

  return { stages, geoScore, criticals, strategy };
}

/* ─── Status icon helper ─── */
function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
}

/* ─── Score Ring ─── */
function ScoreRing({ score, size = 120, strokeWidth = 8, color = 'hsl(var(--primary))' }: { score: number; size?: number; strokeWidth?: number; color?: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="fill-foreground rotate-90 origin-center" style={{ fontSize: size * 0.3, fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

/* ─── Stage Card ─── */
function StageCard({ stage }: { stage: AuditStage }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = stage.icon;
  const passCount = stage.items.filter(i => i.status === 'pass').length;
  const warnCount = stage.items.filter(i => i.status === 'warn').length;
  const failCount = stage.items.filter(i => i.status === 'fail').length;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="shrink-0">
          <ScoreRing score={stage.score} size={56} strokeWidth={5} color={stage.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 shrink-0" style={{ color: stage.color }} />
            <h3 className="text-sm font-semibold text-foreground truncate">{stage.title}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />{passCount}</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" />{warnCount}</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{failCount}</span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Checklist */}
      {expanded && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {stage.items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 px-6 py-3.5 hover:bg-secondary/20 transition-colors">
              <div className="mt-0.5">
                <StatusIcon status={item.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 mt-0.5 ${
                  item.status === 'pass' ? 'border-green-500/40 text-green-500' :
                  item.status === 'warn' ? 'border-yellow-500/40 text-yellow-500' :
                  item.status === 'fail' ? 'border-red-500/40 text-red-500' :
                  'border-border text-muted-foreground'
                }`}
              >
                {item.status === 'pass' ? 'OK' : item.status === 'warn' ? 'Внимание' : item.status === 'fail' ? 'Ошибка' : 'Ожидание'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export default function GeoAuditPage() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof generateMockAudit> | null>(null);

  const handleRun = () => {
    if (!url.trim()) return;
    setRunning(true);
    setResult(null);
    setTimeout(() => {
      setResult(generateMockAudit());
      setRunning(false);
    }, 3000);
  };

  const scoreColor = useMemo(() => {
    if (!result) return 'hsl(var(--primary))';
    if (result.geoScore >= 80) return '#34D399';
    if (result.geoScore >= 60) return '#FBBF24';
    return '#EF4444';
  }, [result]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container max-w-[960px] py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Глубокий GEO Audit страницы
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Полный чек-лист AI Optimization — 5 этапов, 41 проверка. Узнайте, насколько ваша страница готова к эпохе AI-поиска.
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-3 max-w-xl mx-auto">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="h-11 text-sm bg-card border-border/60"
            onKeyDown={e => e.key === 'Enter' && handleRun()}
          />
          <Button
            onClick={handleRun}
            disabled={running || !url.trim()}
            className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 shrink-0"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Анализ...' : 'Запустить GEO Audit'}
          </Button>
        </div>

        {/* Loading */}
        {running && (
          <div className="flex flex-col items-center gap-4 py-16">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-foreground">Выполняется глубокий GEO Audit</p>
              <p className="text-xs text-muted-foreground mt-1">Проверяем 41 параметр по 5 этапам...</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !running && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Overall Score */}
            <div className="rounded-xl border border-border/60 bg-card p-8 flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={result.geoScore} size={140} strokeWidth={10} color={scoreColor} />
              <div className="flex-1 text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Общий GEO Score</p>
                <p className="text-3xl font-bold text-foreground">{result.geoScore}<span className="text-lg text-muted-foreground font-normal"> / 100</span></p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {result.geoScore >= 80 ? 'Отличная оптимизация для AI-поисковиков.' :
                   result.geoScore >= 60 ? 'Есть потенциал для улучшения. Исправьте критические проблемы.' :
                   'Требуется серьёзная доработка для AI-видимости.'}
                </p>
                <div className="flex items-center gap-4 mt-4 justify-center md:justify-start">
                  {result.stages.map((s, i) => (
                    <div key={i} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                      <span className="text-xs text-muted-foreground">{s.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stages */}
            <div className="space-y-4">
              {result.stages.map((stage, i) => (
                <StageCard key={i} stage={stage} />
              ))}
            </div>

            {/* Criticals */}
            <div className="rounded-xl border border-red-500/20 bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-red-500" />
                <h2 className="text-base font-semibold text-foreground">Критические рекомендации</h2>
              </div>
              <div className="space-y-3">
                {result.criticals.map((c, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-red-500">{i + 1}</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{c}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy */}
            <div className="rounded-xl border border-primary/20 bg-card p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                <h2 className="text-base font-semibold text-foreground">Стратегия улучшения — 30–60 дней</h2>
              </div>
              <div className="space-y-3">
                {result.strategy.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 shrink-0">
                      <Clock className="w-4 h-4 text-primary/60" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
