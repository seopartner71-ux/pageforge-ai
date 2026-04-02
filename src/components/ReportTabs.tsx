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
    aiReport: 'ИИ-отчёт', priorities: 'Приоритеты', blueprint: 'Golden Blueprint',
    tfidf: 'TF-IDF', ngrams: 'N-граммы', zipf: 'Закон Ципфа',
    images: 'Изображения', anchors: 'Анкоры', pageSpeed: 'PageSpeed', stealth: 'Stealth Engine',
  },
  en: {
    aiReport: 'AI Report', priorities: 'Priorities', blueprint: 'Golden Blueprint',
    tfidf: 'TF-IDF', ngrams: 'N-grams', zipf: "Zipf's Law",
    images: 'Images', anchors: 'Anchors', pageSpeed: 'PageSpeed', stealth: 'Stealth Engine',
  },
};

interface TabDataProps {
  data: any;
}

/* ─────────── Tab Content Components ─────────── */

function AiReportTab({ data }: TabDataProps) {
  const report = data?.aiReport;
  if (!report) return <p className="text-muted-foreground text-sm">Нет данных для отображения.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold text-foreground">Сводный ИИ-отчёт</h2>
        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/20 text-accent">ИИ-анализ</span>
      </div>
      {report.summary && (
        <div className="border-l-2 border-border pl-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{report.summary}</p>
        </div>
      )}
      {report.strengths?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2">Сильные стороны</h3>
          <div className="space-y-2">
            {report.strengths.map((s: string, i: number) => (
              <div key={i} className="glass-card p-3">
                <p className="text-sm text-foreground">✓ {s}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.weaknesses?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-2">Слабые стороны</h3>
          <div className="space-y-2">
            {report.weaknesses.map((w: string, i: number) => (
              <div key={i} className="glass-card p-3">
                <p className="text-sm text-foreground">✕ {w}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {report.recommendations?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Рекомендации</h3>
          <div className="space-y-2">
            {report.recommendations.map((r: string, i: number) => (
              <div key={i} className="glass-card p-3">
                <p className="text-sm text-foreground">→ {r}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PrioritiesTab({ data }: TabDataProps) {
  const priorities = data?.priorities;
  if (!priorities?.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Приоритеты оптимизации</h2>
      <p className="text-sm text-muted-foreground">Задачи отсортированы по соотношению влияния к трудозатратам.</p>
      <div className="space-y-3">
        {priorities.map((p: any, i: number) => {
          const impactScore = typeof p.impact === 'number' ? p.impact * 10 : 50;
          return (
            <div key={i} className="glass-card p-4 flex items-center gap-4">
              <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">
                {i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">{p.task}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-accent">Влияние: {p.impact}/10</span>
                  <span className="text-xs text-muted-foreground">Трудозатраты: {p.effort}/10</span>
                  {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                </div>
              </div>
              <div className="w-24 shrink-0">
                <Progress value={impactScore} className="h-2" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BlueprintTab({ data }: TabDataProps) {
  const bp = data?.blueprint;
  if (!bp) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Golden Source Blueprint</h2>
      <p className="text-sm text-muted-foreground">Идеальная структура страницы на основе AI-анализа.</p>

      {bp.metaTitle && (
        <div className="glass-card p-4 space-y-2">
          <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-secondary text-accent">TITLE</span>
          <p className="text-sm text-foreground">{bp.metaTitle}</p>
        </div>
      )}
      {bp.metaDescription && (
        <div className="glass-card p-4 space-y-2">
          <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-secondary text-accent">META DESC</span>
          <p className="text-sm text-foreground">{bp.metaDescription}</p>
        </div>
      )}
      {bp.h1 && (
        <div className="glass-card p-4 space-y-2">
          <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-secondary text-accent">H1</span>
          <p className="text-sm text-foreground">{bp.h1}</p>
        </div>
      )}
      {bp.sections?.map((s: any, i: number) => (
        <div key={i} className="glass-card p-4 flex items-center gap-4">
          <span className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-secondary text-accent shrink-0">{s.tag?.toUpperCase() || 'H2'}</span>
          <span className="text-sm text-foreground flex-1">{s.text}</span>
          {s.wordCount && <span className="text-xs text-muted-foreground shrink-0">~{s.wordCount} слов</span>}
        </div>
      ))}
    </div>
  );
}

function TfidfTab({ data }: TabDataProps) {
  const items = data?.tfidf;
  if (!items?.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const chartData = items.map((d: any) => ({
    name: d.term,
    Страница: typeof d.page === 'number' ? +(d.page * 1000).toFixed(1) : d.page,
    Конкуренты: typeof d.competitors === 'number' ? +(d.competitors * 1000).toFixed(1) : d.competitors,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">TF-IDF анализ</h2>
        <p className="text-sm text-muted-foreground mt-1">Плотность ключевых слов в сравнении с конкурентами.</p>
      </div>

      <div className="glass-card p-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }} />
            <Bar dataKey="Страница" fill="hsl(245,58%,58%)" radius={[4,4,0,0]} />
            <Bar dataKey="Конкуренты" fill="hsl(210,100%,52%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2">
        {items.map((d: any, i: number) => (
          <div key={i} className="glass-card px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-foreground font-medium">{d.term}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Стр: {typeof d.page === 'number' ? (d.page * 100).toFixed(1) + '%' : d.page}</span>
              <span className="text-xs text-muted-foreground">Конк: {typeof d.competitors === 'number' ? (d.competitors * 100).toFixed(1) + '%' : d.competitors}</span>
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

function NgramsTab({ data }: TabDataProps) {
  const ngrams = data?.ngrams;
  const bigrams = ngrams?.bigrams || [];
  const trigrams = ngrams?.trigrams || [];
  if (!bigrams.length && !trigrams.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const maxCount = Math.max(...bigrams.map((b: any) => b.count), ...trigrams.map((t: any) => t.count), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">N-граммы</h2>
      <p className="text-sm text-muted-foreground">Частотный анализ биграмм и триграмм на странице.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Биграммы (2-слова)</h3>
          <div className="space-y-2">
            {bigrams.map((b: any, i: number) => (
              <div key={i} className="glass-card px-4 py-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-foreground">{b.text}</span>
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
            {trigrams.map((t: any, i: number) => (
              <div key={i} className="glass-card px-4 py-3">
                <div className="flex justify-between mb-1.5">
                  <span className="text-sm text-foreground">{t.text}</span>
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
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Закон Ципфа</h2>
      <p className="text-sm text-muted-foreground">Анализ частотного распределения будет доступен после полного парсинга контента страницы.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Данные появятся после добавления модуля парсинга контента.
      </div>
    </div>
  );
}

function ImagesTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ изображений</h2>
      <p className="text-sm text-muted-foreground">Детальный анализ изображений будет доступен после парсинга HTML страницы.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Данные появятся после добавления модуля парсинга HTML.
      </div>
    </div>
  );
}

function AnchorsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ анкоров</h2>
      <p className="text-sm text-muted-foreground">Анализ внутренних и внешних ссылок будет доступен после парсинга HTML.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Данные появятся после добавления модуля парсинга HTML.
      </div>
    </div>
  );
}

function PageSpeedTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">PageSpeed + Core Web Vitals</h2>
      <p className="text-sm text-muted-foreground">Данные PageSpeed будут доступны после подключения Google PageSpeed API.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Требуется интеграция с PageSpeed Insights API.
      </div>
    </div>
  );
}

function StealthTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Stealth Engine</h2>
      <p className="text-sm text-muted-foreground">Технический аудит будет доступен после парсинга HTML и проверки серверных заголовков.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">
        Данные появятся после добавления модуля технического аудита.
      </div>
    </div>
  );
}

/* ─────────── Main Tabs Component ─────────── */

interface ReportTabsProps {
  data?: any;
}

export function ReportTabs({ data = {} }: ReportTabsProps) {
  const { lang } = useLang();
  const labels = tabLabels[lang] || tabLabels.en;

  const tabComponents: Record<TabKey, () => JSX.Element> = {
    aiReport: () => <AiReportTab data={data} />,
    priorities: () => <PrioritiesTab data={data} />,
    blueprint: () => <BlueprintTab data={data} />,
    tfidf: () => <TfidfTab data={data} />,
    ngrams: () => <NgramsTab data={data} />,
    zipf: () => <ZipfTab />,
    images: () => <ImagesTab />,
    anchors: () => <AnchorsTab />,
    pageSpeed: () => <PageSpeedTab />,
    stealth: () => <StealthTab />,
  };

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
