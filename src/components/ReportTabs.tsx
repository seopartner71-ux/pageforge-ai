import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, RadarChart,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, PieChart, Pie,
} from 'recharts';

const tabKeys = [
  'aiReport', 'priorities', 'blueprint', 'tfidf', 'ngrams',
  'zipf', 'images', 'anchors', 'pageSpeed', 'stealth',
] as const;

type TabKey = typeof tabKeys[number];

const tabLabels: Record<string, Record<TabKey, string>> = {
  ru: {
    aiReport: 'ИИ-отчёт',
    priorities: 'Приоритеты',
    blueprint: 'Golden Blueprint',
    tfidf: 'TF-IDF',
    ngrams: 'N-граммы',
    zipf: 'Закон Ципфа',
    images: 'Изображения',
    anchors: 'Анкоры',
    pageSpeed: 'PageSpeed',
    stealth: 'Stealth Engine',
  },
  en: {
    aiReport: 'AI Report',
    priorities: 'Priorities',
    blueprint: 'Golden Blueprint',
    tfidf: 'TF-IDF',
    ngrams: 'N-grams',
    zipf: "Zipf's Law",
    images: 'Images',
    anchors: 'Anchors',
    pageSpeed: 'PageSpeed',
    stealth: 'Stealth Engine',
  },
};

/* ─────────── Tab Content Components ─────────── */

function AiReportTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold text-foreground">Сводный ИИ-отчёт</h2>
        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/20 text-accent">ИИ-анализ</span>
      </div>
      <div className="border-l-2 border-border pl-4">
        <p className="text-sm text-muted-foreground">Автоматический анализ контента, структуры и технической составляющей страницы.</p>
      </div>
      <div>
        <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2">ПОЛНЫЙ SEO-ОТЧЕТ ПО СТРАНИЦЕ</h3>
        <p className="text-sm text-foreground mb-3"><strong>Общая оценка: 48/100</strong></p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Страница представляет собой каталог услуг с хорошим потенциалом, но текущая реализация имеет ряд критических проблем. Основные точки роста: техническая оптимизация, углубление контента, усиление E-E-A-T.
        </p>
      </div>
      <div className="space-y-4">
        <h3 className="text-base font-bold text-foreground">1. ТЕХНИЧЕСКИЙ АНАЛИЗ (ON-PAGE)</h3>
        {[
          { title: 'Структура и семантика HTML', problem: 'Отсутствует тег <main>, заголовок <h1> вне <main>. DOM перегружена (1149 узлов).', fix: 'Обернуть контент в <main>, блоки с <h2> — в <section>.' },
          { title: 'Мета-теги и разметка', problem: 'Отсутствуют OpenGraph теги (og:title, og:description, og:image).', fix: 'Внедрить полный набор OG-тегов.' },
          { title: 'Медиаконтент', problem: 'У 18 изображений не указаны alt-атрибуты.', fix: 'Прописать осмысленные alt-тексты.' },
        ].map((item, i) => (
          <div key={i} className="glass-card p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">• {item.title}</h4>
            <p className="text-xs text-muted-foreground"><strong className="text-destructive">Проблема:</strong> {item.problem}</p>
            <p className="text-xs text-muted-foreground"><strong className="text-accent">Рекомендация:</strong> {item.fix}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrioritiesTab() {
  const priorities = [
    { label: 'Внедрить семантические теги <main> и <section>', impact: 'Высокий', effort: 'Низкий', score: 95 },
    { label: 'Прописать alt-тексты для 18 изображений', impact: 'Высокий', effort: 'Низкий', score: 90 },
    { label: 'Добавить OpenGraph теги', impact: 'Средний', effort: 'Низкий', score: 85 },
    { label: 'Внедрить Schema.org разметку', impact: 'Высокий', effort: 'Средний', score: 80 },
    { label: 'Переписать Title и Description с УТП', impact: 'Высокий', effort: 'Низкий', score: 78 },
    { label: 'Оптимизировать Core Web Vitals (LCP)', impact: 'Высокий', effort: 'Высокий', score: 70 },
    { label: 'Добавить FAQ-секцию с микроразметкой', impact: 'Средний', effort: 'Средний', score: 65 },
    { label: 'Увеличить объём контента до 2500+ слов', impact: 'Высокий', effort: 'Высокий', score: 60 },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Приоритеты оптимизации</h2>
      <p className="text-sm text-muted-foreground">Задачи отсортированы по соотношению влияния к трудозатратам.</p>
      <div className="space-y-3">
        {priorities.map((p, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium truncate">{p.label}</p>
              <div className="flex gap-3 mt-1">
                <span className={`text-xs ${p.impact === 'Высокий' ? 'text-accent' : 'text-muted-foreground'}`}>
                  Влияние: {p.impact}
                </span>
                <span className={`text-xs ${p.effort === 'Низкий' ? 'text-accent' : 'text-muted-foreground'}`}>
                  Трудозатраты: {p.effort}
                </span>
              </div>
            </div>
            <div className="w-24 shrink-0">
              <Progress value={p.score} className="h-2" />
              <span className="text-[10px] text-muted-foreground mt-0.5 block text-right">{p.score}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BlueprintTab() {
  const sections = [
    { tag: 'H1', text: 'Основной заголовок с ключевым словом и УТП', status: 'missing' },
    { tag: 'H2', text: 'Описание услуг / каталог категорий', status: 'partial' },
    { tag: 'H2', text: 'Преимущества компании (E-E-A-T)', status: 'missing' },
    { tag: 'H2', text: 'Отзывы клиентов', status: 'missing' },
    { tag: 'H2', text: 'FAQ — часто задаваемые вопросы', status: 'missing' },
    { tag: 'H2', text: 'Контакты и CTA', status: 'partial' },
    { tag: 'Schema', text: 'LocalBusiness + Service + FAQ', status: 'missing' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Golden Source Blueprint</h2>
      <p className="text-sm text-muted-foreground">Идеальная структура страницы на основе анализа ТОП-10 конкурентов.</p>
      <div className="space-y-2">
        {sections.map((s, i) => (
          <div key={i} className="glass-card p-4 flex items-center gap-4">
            <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-secondary text-accent shrink-0">{s.tag}</span>
            <span className="text-sm text-foreground flex-1">{s.text}</span>
            <span className={`text-xs font-medium px-2 py-1 rounded ${
              s.status === 'missing' ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent'
            }`}>
              {s.status === 'missing' ? '✕ Отсутствует' : '◐ Частично'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TfidfTab() {
  const data = [
    { word: 'строительные', yours: 0.045, median: 0.032, status: 'OK' },
    { word: 'материалы', yours: 0.038, median: 0.028, status: 'OK' },
    { word: 'купить', yours: 0.025, median: 0.018, status: 'OK' },
    { word: 'цена', yours: 0.008, median: 0.022, status: 'LOW' },
    { word: 'доставка', yours: 0.005, median: 0.019, status: 'LOW' },
    { word: 'оптом', yours: 0.042, median: 0.015, status: 'SPAM' },
    { word: 'качество', yours: 0.003, median: 0.016, status: 'LOW' },
    { word: 'каталог', yours: 0.012, median: 0.014, status: 'OK' },
  ];

  const chartData = data.map(d => ({ name: d.word, Ваша: +(d.yours * 1000).toFixed(1), Медиана: +(d.median * 1000).toFixed(1) }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">TF-IDF анализ</h2>
        <p className="text-sm text-muted-foreground mt-1">Плотность ключевых слов в сравнении с медианой конкурентов.</p>
      </div>

      <div className="glass-card p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="Ваша" fill="hsl(245,58%,58%)" radius={[4,4,0,0]} />
            <Bar dataKey="Медиана" fill="hsl(210,100%,52%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="glass-card px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-foreground font-medium">{d.word}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Ваша: {(d.yours * 100).toFixed(1)}%</span>
              <span className="text-xs text-muted-foreground">Медиана: {(d.median * 100).toFixed(1)}%</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                d.status === 'OK' ? 'bg-accent/20 text-accent' :
                d.status === 'SPAM' ? 'bg-destructive/20 text-destructive' :
                'bg-primary/20 text-primary'
              }`}>{d.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NgramsTab() {
  const bigrams = [
    { phrase: 'строительные материалы', count: 12 },
    { phrase: 'оптовые цены', count: 8 },
    { phrase: 'доставка материалов', count: 6 },
    { phrase: 'купить оптом', count: 5 },
    { phrase: 'высокое качество', count: 4 },
    { phrase: 'широкий ассортимент', count: 3 },
  ];
  const trigrams = [
    { phrase: 'строительные материалы оптом', count: 5 },
    { phrase: 'купить строительные материалы', count: 4 },
    { phrase: 'доставка по городу', count: 3 },
    { phrase: 'низкие оптовые цены', count: 2 },
  ];

  const maxCount = Math.max(...bigrams.map(b => b.count));

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">N-граммы</h2>
      <p className="text-sm text-muted-foreground">Частотный анализ биграмм и триграмм на странице.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Биграммы (2-слова)</h3>
          <div className="space-y-2">
            {bigrams.map((b, i) => (
              <div key={i} className="glass-card px-4 py-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-foreground">{b.phrase}</span>
                  <span className="text-xs text-accent font-bold">{b.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(b.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Триграммы (3-слова)</h3>
          <div className="space-y-2">
            {trigrams.map((t, i) => (
              <div key={i} className="glass-card px-4 py-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-foreground">{t.phrase}</span>
                  <span className="text-xs text-accent font-bold">{t.count}</span>
                </div>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${(t.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZipfTab() {
  const data = [
    { rank: 1, word: 'строительные', freq: 45 },
    { rank: 2, word: 'материалы', freq: 38 },
    { rank: 3, word: 'купить', freq: 25 },
    { rank: 4, word: 'оптом', freq: 22 },
    { rank: 5, word: 'цена', freq: 18 },
    { rank: 6, word: 'доставка', freq: 15 },
    { rank: 7, word: 'каталог', freq: 12 },
    { rank: 8, word: 'качество', freq: 10 },
    { rank: 9, word: 'заказ', freq: 8 },
    { rank: 10, word: 'услуги', freq: 6 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Закон Ципфа</h2>
      <p className="text-sm text-muted-foreground">Анализ частотного распределения слов. Идеальный контент следует закону Ципфа.</p>

      <div className="glass-card p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="word" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="freq" radius={[4,4,0,0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={i < 3 ? 'hsl(245,58%,58%)' : 'hsl(210,100%,52%)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="glass-card p-4">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">Коэффициент отклонения: 0.72</strong> — текст умеренно естественный. Рекомендуется разнообразить лексику в длинных текстовых блоках для приближения к идеальному значению (~1.0).
        </p>
      </div>
    </div>
  );
}

function ImagesTab() {
  const images = [
    { src: '/images/hero.jpg', alt: '', size: '2.4 MB', format: 'JPEG', width: 1920, lcp: true },
    { src: '/images/catalog-1.png', alt: '', size: '890 KB', format: 'PNG', width: 800, lcp: false },
    { src: '/images/logo.svg', alt: 'Логотип', size: '12 KB', format: 'SVG', width: 200, lcp: false },
    { src: '/images/banner.jpg', alt: '', size: '1.8 MB', format: 'JPEG', width: 1200, lcp: false },
    { src: '/images/team.jpg', alt: '', size: '640 KB', format: 'JPEG', width: 600, lcp: false },
  ];

  const withoutAlt = images.filter(i => !i.alt).length;
  const totalSize = '5.7 MB';

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ изображений</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{images.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Всего</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-destructive">{withoutAlt}</p>
          <p className="text-xs text-muted-foreground mt-1">Без alt</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{totalSize}</p>
          <p className="text-xs text-muted-foreground mt-1">Общий вес</p>
        </div>
      </div>
      <div className="space-y-2">
        {images.map((img, i) => (
          <div key={i} className="glass-card px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{img.src}</span>
              {img.lcp && <span className="px-1.5 py-0.5 rounded text-[10px] bg-destructive/20 text-destructive font-bold shrink-0">LCP</span>}
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <span className="text-xs text-muted-foreground">{img.format}</span>
              <span className="text-xs text-muted-foreground">{img.size}</span>
              <span className={`text-xs font-medium ${img.alt ? 'text-accent' : 'text-destructive'}`}>
                {img.alt ? '✓ alt' : '✕ alt'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnchorsTab() {
  const internal = [
    { text: 'Каталог', href: '/catalog', dofollow: true },
    { text: 'Услуги', href: '/services', dofollow: true },
    { text: 'Контакты', href: '/contacts', dofollow: true },
    { text: 'О компании', href: '/about', dofollow: true },
    { text: 'Подробнее', href: '/page1', dofollow: true },
    { text: 'Читать далее', href: '/blog/1', dofollow: true },
  ];
  const external = [
    { text: 'Instagram', href: 'instagram.com/...', dofollow: false },
    { text: 'VK', href: 'vk.com/...', dofollow: false },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ анкоров</h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-accent">{internal.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Внутренние ссылки</p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-2xl font-bold text-foreground">{external.length}</p>
          <p className="text-xs text-muted-foreground mt-1">Внешние ссылки</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Внутренние</h3>
        <div className="space-y-2">
          {internal.map((a, i) => (
            <div key={i} className="glass-card px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-foreground">{a.text}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">{a.href}</span>
                <span className="text-xs text-accent">dofollow</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Внешние</h3>
        <div className="space-y-2">
          {external.map((a, i) => (
            <div key={i} className="glass-card px-4 py-2.5 flex items-center justify-between">
              <span className="text-sm text-foreground">{a.text}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono">{a.href}</span>
                <span className="text-xs text-muted-foreground">nofollow</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PageSpeedTab() {
  const metrics = [
    { name: 'LCP', value: '4.2s', target: '< 2.5s', status: 'bad' },
    { name: 'FID', value: '85ms', target: '< 100ms', status: 'ok' },
    { name: 'CLS', value: '0.18', target: '< 0.1', status: 'warn' },
    { name: 'FCP', value: '2.1s', target: '< 1.8s', status: 'warn' },
    { name: 'TTFB', value: '620ms', target: '< 800ms', status: 'ok' },
    { name: 'SI', value: '3.8s', target: '< 3.4s', status: 'warn' },
  ];

  const radarData = [
    { metric: 'LCP', score: 30 },
    { metric: 'FID', score: 85 },
    { metric: 'CLS', score: 45 },
    { metric: 'FCP', score: 55 },
    { metric: 'TTFB', score: 75 },
    { metric: 'SI', score: 50 },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">PageSpeed + Core Web Vitals</h2>

      <div className="glass-card p-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(222,30%,18%)" />
            <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <PolarRadiusAxis tick={false} domain={[0, 100]} />
            <Radar dataKey="score" stroke="hsl(245,58%,58%)" fill="hsl(245,58%,58%)" fillOpacity={0.3} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-foreground">{m.name}</span>
              <span className={`w-2 h-2 rounded-full ${
                m.status === 'ok' ? 'bg-accent' : m.status === 'warn' ? 'bg-primary' : 'bg-destructive'
              }`} />
            </div>
            <p className="text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Цель: {m.target}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StealthTab() {
  const factors = [
    { name: 'Канонический URL', status: true, detail: 'Установлен корректно' },
    { name: 'Robots.txt', status: true, detail: 'Страница разрешена к индексации' },
    { name: 'Sitemap.xml', status: false, detail: 'Страница отсутствует в sitemap' },
    { name: 'Hreflang', status: false, detail: 'Не настроен (одноязычный сайт)' },
    { name: 'Redirect chains', status: true, detail: 'Цепочек редиректов не обнаружено' },
    { name: 'Дубли контента', status: false, detail: 'Обнаружено 3 страницы с совпадением >80%' },
    { name: 'Тонкий контент', status: false, detail: 'Основной текст < 500 слов (рекомендуется 1500+)' },
    { name: 'JavaScript-рендеринг', status: true, detail: 'SSR не требуется' },
    { name: 'Mobile-friendly', status: true, detail: 'Адаптивная вёрстка' },
    { name: 'HTTPS', status: true, detail: 'SSL сертификат валиден' },
  ];

  const passCount = factors.filter(f => f.status).length;

  const pieData = [
    { name: 'Pass', value: passCount, fill: 'hsl(210,100%,52%)' },
    { name: 'Fail', value: factors.length - passCount, fill: 'hsl(0,72%,51%)' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Stealth Engine</h2>
      <p className="text-sm text-muted-foreground">Скрытые факторы оптимизации и технический аудит.</p>

      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-6">
        <div className="glass-card p-4 flex flex-col items-center justify-center">
          <ResponsiveContainer width={140} height={140}>
            <PieChart>
              <Pie data={pieData} innerRadius={40} outerRadius={60} dataKey="value" startAngle={90} endAngle={-270}>
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <p className="text-sm text-foreground font-bold mt-2">{passCount}/{factors.length} пройдено</p>
        </div>
        <div className="space-y-2">
          {factors.map((f, i) => (
            <div key={i} className="glass-card px-4 py-3 flex items-center gap-3">
              <span className={`text-sm shrink-0 ${f.status ? 'text-accent' : 'text-destructive'}`}>
                {f.status ? '✓' : '✕'}
              </span>
              <div className="min-w-0">
                <p className="text-sm text-foreground font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground truncate">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Main Tabs Component ─────────── */

const tabComponents: Record<TabKey, () => JSX.Element> = {
  aiReport: AiReportTab,
  priorities: PrioritiesTab,
  blueprint: BlueprintTab,
  tfidf: TfidfTab,
  ngrams: NgramsTab,
  zipf: ZipfTab,
  images: ImagesTab,
  anchors: AnchorsTab,
  pageSpeed: PageSpeedTab,
  stealth: StealthTab,
};

export function ReportTabs() {
  const { lang } = useLang();
  const labels = tabLabels[lang] || tabLabels.en;

  return (
    <Tabs defaultValue="aiReport" className="w-full">
      <TabsList className="w-full h-auto flex flex-wrap gap-0.5 bg-secondary/50 p-1 rounded-xl">
        {tabKeys.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="px-3 py-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground text-xs font-medium transition-all"
          >
            {key === 'aiReport' && <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5 inline-block" />}
            {labels[key]}
          </TabsTrigger>
        ))}
      </TabsList>

      {tabKeys.map((key) => {
        const Component = tabComponents[key];
        return (
          <TabsContent key={key} value={key} className="mt-6">
            <Component />
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
