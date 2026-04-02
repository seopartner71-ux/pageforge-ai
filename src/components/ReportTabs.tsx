import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wand2, Copy, Check, Loader2, Code, Eye, FileText, CheckCircle2, XCircle, List, Table2, HelpCircle, Tags, Heading, Image, Link2, ExternalLink, AlertTriangle, Plus, Sparkles, Filter, TrendingUp, Shield, Zap, Globe, BarChart2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';

const tabKeys = [
  'aiReport', 'priorities', 'implementationPlan', 'blueprint', 'semanticMap', 'tfidf', 'ngrams',
  'zipf', 'images', 'anchors', 'pageSpeed', 'stealth', 'dataSources', 'verification',
] as const;

type TabKey = typeof tabKeys[number];

const tabLabels: Record<string, Record<TabKey, string>> = {
  ru: {
    aiReport: 'ИИ-отчёт', priorities: 'Приоритеты', implementationPlan: '📋 Пошаговое ТЗ',
    blueprint: 'Golden Blueprint',
    semanticMap: '🧬 Семантическая карта',
    tfidf: 'TF-IDF', ngrams: 'N-граммы', zipf: 'Закон Ципфа',
    images: 'Изображения', anchors: 'Анкоры', pageSpeed: 'PageSpeed', stealth: 'Stealth Engine',
    dataSources: '📋 Источники', verification: '✅ До/После',
  },
  en: {
    aiReport: 'AI Report', priorities: 'Priorities', implementationPlan: '📋 Implementation Plan',
    blueprint: 'Golden Blueprint',
    semanticMap: '🧬 Semantic Map',
    tfidf: 'TF-IDF', ngrams: 'N-grams', zipf: "Zipf's Law",
    images: 'Images', anchors: 'Anchors', pageSpeed: 'PageSpeed', stealth: 'Stealth Engine',
    dataSources: '📋 Sources', verification: '✅ Before/After',
  },
};

interface TabDataProps {
  data: any;
}

/* ─────────── AI Report Tab ─────────── */

function AiReportTab({ data }: TabDataProps) {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const report = data?.aiReport;
  const audit = data?.technicalAudit;
  const bp = data?.blueprint;
  if (!report) return <p className="text-muted-foreground text-sm">Нет данных для отображения.</p>;

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Generate JSON-LD from blueprint data
  const jsonLd = bp ? JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    "name": bp.metaTitle || bp.h1 || "",
    "description": bp.metaDescription || "",
    "mainEntity": {
      "@type": "Article",
      "headline": bp.h1 || "",
      "description": bp.metaDescription || "",
    }
  }, null, 2) : '';

  const ogTags = bp ? `<meta property="og:title" content="${bp.metaTitle || ''}" />\n<meta property="og:description" content="${bp.metaDescription || ''}" />\n<meta property="og:type" content="website" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:title" content="${bp.metaTitle || ''}" />\n<meta name="twitter:description" content="${bp.metaDescription || ''}" />` : '';

  const semanticHtml = bp?.sections ? `<main>\n  <article>\n    <h1>${bp.h1 || 'Заголовок'}</h1>\n${bp.sections.map((s: any) => `    <section>\n      <${s.tag || 'h2'}>${s.text}</${s.tag || 'h2'}>\n      <p><!-- ${s.wordCount || 200} слов --></p>\n    </section>`).join('\n')}\n  </article>\n</main>` : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <h2 className="text-lg font-bold text-foreground">Глубокий SEO-аудит</h2>
        <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/20 text-accent">ИИ-анализ</span>
      </div>

      {/* Summary */}
      {report.summary && (
        <div className="border-l-2 border-border pl-4">
          <p className="text-sm text-muted-foreground whitespace-pre-line">{report.summary}</p>
        </div>
      )}

      {/* Technical Analysis Block */}
      {audit && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Технический анализ
          </h3>
          <div className="space-y-3">
            {[
              { issue: `H1 тегов: ${audit.h1Count}`, impact: audit.h1Count !== 1 ? 'Высокое' : 'Нет', rec: audit.h1Count !== 1 ? 'Убедитесь, что на странице ровно 1 тег H1' : 'OK — ровно 1 H1', ok: audit.h1Count === 1 },
              { issue: `Изображений без alt: ${audit.imagesWithoutAlt}`, impact: audit.imagesWithoutAlt > 0 ? 'Среднее' : 'Нет', rec: audit.imagesWithoutAlt > 0 ? 'Добавьте описательные alt-атрибуты' : 'OK — все с alt', ok: audit.imagesWithoutAlt === 0 },
              { issue: `JSON-LD: ${audit.hasJsonLd ? 'Есть' : 'Нет'}`, impact: !audit.hasJsonLd ? 'Высокое' : 'Нет', rec: !audit.hasJsonLd ? 'Добавьте структурированную разметку Schema.org' : 'OK', ok: audit.hasJsonLd },
              { issue: `OpenGraph: ${audit.hasOpenGraph ? 'Есть' : 'Нет'}`, impact: !audit.hasOpenGraph ? 'Среднее' : 'Нет', rec: !audit.hasOpenGraph ? 'Добавьте OG-теги для соцсетей' : 'OK', ok: audit.hasOpenGraph },
            ].map((row, i) => (
              <div key={i} className={`flex items-start gap-4 p-3 rounded-lg ${row.ok ? 'bg-accent/5' : 'bg-destructive/5 border-l-2 border-destructive'}`}>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{row.issue}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Рекомендация: {row.rec}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded shrink-0 ${row.ok ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>
                  {row.impact}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* E-E-A-T & Content */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Контент и E-E-A-T
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {report.strengths?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-accent uppercase">Сильные стороны</span>
              {report.strengths.map((s: string, i: number) => (
                <div key={i} className="p-2 rounded bg-accent/5 text-sm text-foreground">✓ {s}</div>
              ))}
            </div>
          )}
          {report.weaknesses?.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-destructive uppercase">Слабые стороны</span>
              {report.weaknesses.map((w: string, i: number) => (
                <div key={i} className="p-2 rounded bg-destructive/5 text-sm text-foreground">✕ {w}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SGE / BERT Adaptation */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" /> Адаптация под SGE и AI Overviews
        </h3>
        {report.geoScore !== undefined && (
          <div className="flex items-center gap-4 mb-4">
            <span className="text-sm text-foreground font-medium">GEO Score</span>
            <Progress value={report.geoScore} className="flex-1 h-2" />
            <span className="text-sm font-bold text-accent">{report.geoScore}/100</span>
          </div>
        )}
        {report.sgeReadiness && <p className="text-sm text-foreground">{report.sgeReadiness}</p>}
        {report.recommendations?.length > 0 && (
          <div className="mt-3 space-y-2">
            {report.recommendations.map((r: string, i: number) => (
              <div key={i} className="p-2 rounded bg-primary/5 text-sm text-foreground">→ {r}</div>
            ))}
          </div>
        )}
      </div>

      {/* Missing Entities */}
      {report.missingEntities?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Missing Entities (Topical Gap)</h3>
          <div className="flex flex-wrap gap-2">
            {report.missingEntities.map((e: string, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">{e}</span>
            ))}
          </div>
        </div>
      )}

      {/* Code Generator: Техзадание */}
      {bp && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
            <Code className="w-4 h-4 text-primary" /> Техзадание (Code Generator)
          </h3>
          <div className="space-y-4">
            {/* Semantic HTML */}
            {semanticHtml && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">Семантическая структура</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyCode(semanticHtml, 'semantic')}>
                    {copiedCode === 'semantic' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'semantic' ? 'Скопировано' : 'Копировать'}
                  </Button>
                </div>
                <pre className="text-xs font-mono text-foreground/70 bg-secondary/30 p-3 rounded-md overflow-x-auto whitespace-pre max-h-48">{semanticHtml}</pre>
              </div>
            )}
            {/* JSON-LD */}
            {jsonLd && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">JSON-LD Микроразметка</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyCode(`<script type="application/ld+json">\n${jsonLd}\n</script>`, 'jsonld')}>
                    {copiedCode === 'jsonld' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'jsonld' ? 'Скопировано' : 'Копировать'}
                  </Button>
                </div>
                <pre className="text-xs font-mono text-foreground/70 bg-secondary/30 p-3 rounded-md overflow-x-auto whitespace-pre max-h-48">{`<script type="application/ld+json">\n${jsonLd}\n</script>`}</pre>
              </div>
            )}
            {/* OG Tags */}
            {ogTags && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase">OpenGraph & Twitter Cards</span>
                  <Button variant="ghost" size="sm" className="h-6 text-xs gap-1" onClick={() => copyCode(ogTags, 'og')}>
                    {copiedCode === 'og' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    {copiedCode === 'og' ? 'Скопировано' : 'Копировать'}
                  </Button>
                </div>
                <pre className="text-xs font-mono text-foreground/70 bg-secondary/30 p-3 rounded-md overflow-x-auto whitespace-pre">{ogTags}</pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Priorities Tab ─────────── */

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
              <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold text-foreground shrink-0">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground font-medium">{p.task}</p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-accent">Влияние: {p.impact}/10</span>
                  <span className="text-xs text-muted-foreground">Трудозатраты: {p.effort}/10</span>
                  {p.category && <span className="text-xs text-muted-foreground">{p.category}</span>}
                </div>
              </div>
              <div className="w-24 shrink-0"><Progress value={impactScore} className="h-2" /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────── Blueprint Tab (Enhanced with hierarchy) ─────────── */

function BlueprintTab({ data }: TabDataProps) {
  const bp = data?.blueprint;
  if (!bp) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const blocks = [
    { icon: '🏗️', title: 'Основной блок', desc: 'Hero + H1 + ключевое УТП', sections: bp.sections?.filter((s: any) => s.tag === 'h2')?.slice(0, 3) },
    { icon: '🏆', title: 'Блок авторитетности', desc: 'E-E-A-T: Отзывы, сертификаты, экспертиза', sections: bp.requiredBlocks?.filter((b: string) => /отзыв|серт|экспер|автор/i.test(b)) },
    { icon: '❓', title: 'FAQ (6+ вопросов)', desc: 'Блок вопросов для SGE и PAA', sections: bp.requiredBlocks?.filter((b: string) => /FAQ|вопрос/i.test(b)) },
    { icon: '💡', title: 'Идеи для новых страниц', desc: 'Расширение семантического ядра', sections: bp.sections?.filter((s: any) => s.tag === 'h3')?.slice(0, 5) },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">Golden Source Blueprint</h2>
      <p className="text-sm text-muted-foreground">Визуальная иерархия идеальной структуры страницы.</p>

      {/* Meta tags */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {bp.metaTitle && (
          <div className="glass-card p-4 space-y-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-accent">TITLE ({bp.metaTitle.length} зн.)</span>
            <p className="text-sm text-foreground">{bp.metaTitle}</p>
          </div>
        )}
        {bp.metaDescription && (
          <div className="glass-card p-4 space-y-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-accent">DESC ({bp.metaDescription.length} зн.)</span>
            <p className="text-sm text-foreground">{bp.metaDescription}</p>
          </div>
        )}
        {bp.h1 && (
          <div className="glass-card p-4 space-y-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-secondary text-accent">H1</span>
            <p className="text-sm text-foreground">{bp.h1}</p>
          </div>
        )}
      </div>

      {/* Visual hierarchy blocks */}
      <div className="space-y-3">
        {blocks.map((block, i) => (
          <div key={i} className="glass-card p-4 border-l-2 border-primary/40">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xl">{block.icon}</span>
              <div>
                <p className="text-sm font-bold text-foreground">{block.title}</p>
                <p className="text-xs text-muted-foreground">{block.desc}</p>
              </div>
            </div>
            {block.sections?.length > 0 && (
              <div className="ml-8 space-y-1 mt-2">
                {block.sections.map((s: any, j: number) => (
                  <div key={j} className="flex items-center gap-2 text-xs text-foreground/80 hover:text-primary cursor-pointer transition-colors">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                    {typeof s === 'string' ? s : s.text}
                    {s.wordCount && <span className="text-muted-foreground ml-auto">~{s.wordCount} сл.</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Full sections list */}
      {bp.sections?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3 mt-4">Полная структура контента</h3>
          {bp.sections.map((s: any, i: number) => (
            <div key={i} className="glass-card p-3 mb-1.5 flex items-center gap-3">
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${s.tag === 'h2' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'}`}>
                {s.tag?.toUpperCase() || 'H2'}
              </span>
              <span className="text-sm text-foreground flex-1">{s.text}</span>
              {s.wordCount && <span className="text-xs text-muted-foreground shrink-0">~{s.wordCount} сл.</span>}
            </div>
          ))}
        </div>
      )}

      {bp.requiredBlocks?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2 mt-4">Обязательные блоки</h3>
          <div className="flex flex-wrap gap-2">
            {bp.requiredBlocks.map((b: string, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20">{b}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── TF-IDF Tab (Interactive Table with Filters) ─────────── */

function TfidfTab({ data }: TabDataProps) {
  const [filter, setFilter] = useState<'all' | 'OK' | 'Spam' | 'Missing'>('all');
  const items = data?.tfidf || [];
  const anchorsData = data?.anchorsData || [];

  // Count anchor occurrences for each term
  const anchorTermCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of anchorsData) {
      const words = (a.text || '').toLowerCase().split(/\s+/);
      for (const w of words) if (w.length > 2) counts[w] = (counts[w] || 0) + 1;
    }
    return counts;
  }, [anchorsData]);

  if (!items.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const missingItems = items.filter((d: any) => d.status === "Missing");
  const spamItems = items.filter((d: any) => d.status === "Spam" || d.status === "Overoptimized");
  const okItems = items.filter((d: any) => d.status === "OK");

  const filtered = filter === 'all' ? items :
    filter === 'Missing' ? missingItems :
    filter === 'Spam' ? spamItems : okItems;

  const maxScore = Math.max(...items.map((d: any) => Math.max(d.tfidf || 0, d.competitorMedianTfidf || 0)), 0.001);

  // Chart data
  const chartItems = [...items].sort((a: any, b: any) => (b.tfidf + b.competitorMedianTfidf) - (a.tfidf + a.competitorMedianTfidf)).slice(0, 15);
  const chartData = chartItems.map((d: any) => ({
    name: d.term,
    'Ваша страница': +(d.tfidf * 1000).toFixed(2),
    'Медиана ТОП-10': +(d.competitorMedianTfidf * 1000).toFixed(2),
  }));

  const statusColor = (s: string) =>
    s === 'OK' ? 'bg-accent/20 text-accent' :
    s === 'Spam' || s === 'Overoptimized' ? 'bg-destructive/20 text-destructive' :
    s === 'Missing' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground';

  const statusLabel = (s: string) =>
    s === 'OK' ? 'OK' : s === 'Spam' || s === 'Overoptimized' ? 'Spam' : s === 'Missing' ? 'Missing' : s;

  const filters: { key: 'all' | 'OK' | 'Spam' | 'Missing'; label: string; count: number; color: string }[] = [
    { key: 'all', label: 'Все', count: items.length, color: 'bg-secondary text-foreground' },
    { key: 'OK', label: 'OK', count: okItems.length, color: 'bg-accent/20 text-accent' },
    { key: 'Missing', label: 'Missing', count: missingItems.length, color: 'bg-primary/20 text-primary' },
    { key: 'Spam', label: 'Переспам', count: spamItems.length, color: 'bg-destructive/20 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">TF-IDF анализ</h2>
        <p className="text-sm text-muted-foreground mt-1">Score = TF × IDF. Интерактивное сравнение с медианой ТОП-10.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{okItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">OK</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{missingItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Missing</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{spamItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Переспам</div>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-card p-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Ваша страница" fill="hsl(245,58%,58%)" radius={[4,4,0,0]} />
            <Bar dataKey="Медиана ТОП-10" fill="hsl(210,100%,52%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              filter === f.key ? `${f.color} border-current` : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'
            }`}
          >
            {f.label} ({f.count})
          </button>
        ))}
      </div>

      {/* Interactive table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Термин</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-muted-foreground uppercase w-40">TF×IDF</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Вы</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">ТОП-10</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">В анкорах</th>
              <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground uppercase">Статус</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d: any, i: number) => {
              const userScore = d.tfidf || 0;
              const compScore = d.competitorMedianTfidf || 0;
              const barWidth = Math.min((userScore / maxScore) * 100, 100);
              const compBarWidth = Math.min((compScore / maxScore) * 100, 100);
              const anchorCount = anchorTermCounts[d.term] || 0;
              const userCount = Math.round((d.tf || 0) * (data?.pageStats?.target?.wordCount || 1000));

              return (
                <tr key={i} className="border-b border-border/30 hover:bg-secondary/20">
                  <td className="py-2.5 px-3 font-medium text-foreground">{d.term}</td>
                  <td className="py-2.5 px-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                        </div>
                        <span className="text-[10px] text-primary font-mono w-10 text-right">{(userScore * 1000).toFixed(1)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                          <div className="h-full bg-accent/60 rounded-full transition-all" style={{ width: `${compBarWidth}%` }} />
                        </div>
                        <span className="text-[10px] text-accent font-mono w-10 text-right">{(compScore * 1000).toFixed(1)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-center font-mono text-foreground">{userCount}</td>
                  <td className="py-2.5 px-3 text-center font-mono text-muted-foreground">{(compScore * 1000).toFixed(1)}</td>
                  <td className="py-2.5 px-3 text-center">
                    {anchorCount > 0 ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-accent/20 text-accent">{anchorCount}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor(d.status)}`}>
                      {statusLabel(d.status)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ─────────── N-grams Tab (with Topical Gaps) ─────────── */

function NgramsTab({ data }: TabDataProps) {
  const ngrams = data?.ngrams;
  const bigrams = ngrams?.bigrams || [];
  const trigrams = ngrams?.trigrams || [];
  const bigramGaps = ngrams?.bigramGaps || [];
  const trigramGaps = ngrams?.trigramGaps || [];

  if (!bigrams.length && !trigrams.length && !bigramGaps.length && !trigramGaps.length)
    return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const maxCount = Math.max(...bigrams.map((b: any) => b.count), ...trigrams.map((t: any) => t.count), 1);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">N-граммы</h2>
      <p className="text-sm text-muted-foreground">Частотный анализ биграмм и триграмм. Тематические пробелы vs конкуренты.</p>

      {/* Topical gaps */}
      {(bigramGaps.length > 0 || trigramGaps.length > 0) && (
        <div className="glass-card p-5">
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">🔍 Тематические пробелы (есть у конкурентов, нет у вас)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {bigramGaps.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">Биграммы</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {bigramGaps.map((g: any, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded text-xs bg-primary/10 text-primary border border-primary/20">
                      {g.text} <span className="opacity-60">({g.competitorCount} конк.)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            {trigramGaps.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground font-medium">Триграммы</span>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {trigramGaps.map((g: any, i: number) => (
                    <span key={i} className="px-2.5 py-1 rounded text-xs bg-accent/10 text-accent border border-accent/20">
                      {g.text} <span className="opacity-60">({g.competitorCount} конк.)</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Frequency lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Биграммы (2 слова)</h3>
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
          <h3 className="text-sm font-semibold text-foreground mb-3">Триграммы (3 слова)</h3>
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

/* ─────────── Zipf's Law Tab (AreaChart + ideal curve) ─────────── */

function ZipfTab({ data }: TabDataProps) {
  const zipf = data?.zipf;
  if (!zipf?.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const spamWords = zipf.filter((z: any) => z.isSpam);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Закон Ципфа</h2>
        <p className="text-sm text-muted-foreground">
          Частота ∝ 1/Ранг. Отклонение реальной кривой от идеальной указывает на переспам ключевых слов.
        </p>
      </div>

      {spamWords.length > 0 && (
        <div className="glass-card p-4 border-l-2 border-destructive">
          <h3 className="text-sm font-bold text-destructive mb-2">⚠ Подозрение на переспам</h3>
          <div className="flex flex-wrap gap-2">
            {spamWords.map((z: any, i: number) => (
              <span key={i} className="px-2.5 py-1 rounded text-xs bg-destructive/10 text-destructive border border-destructive/20">
                «{z.word}» — +{z.deviation}% от нормы
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AreaChart: Real vs Ideal */}
      <div className="glass-card p-4 h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={zipf.slice(0, 40)}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="rank" label={{ value: 'Ранг', position: 'insideBottom', offset: -5, fill: 'hsl(215,20%,55%)', fontSize: 11 }} tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <YAxis label={{ value: 'Частота', angle: -90, position: 'insideLeft', fill: 'hsl(215,20%,55%)', fontSize: 11 }} tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip
              contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }}
              formatter={(value: number, name: string) => [value, name]}
              labelFormatter={(label) => {
                const item = zipf.find((z: any) => z.rank === label);
                return item ? `#${label}: «${item.word}»` : `Ранг ${label}`;
              }}
            />
            <Legend />
            <Area type="monotone" dataKey="frequency" name="Реальная частота" stroke="hsl(245,58%,58%)" fill="hsl(245,58%,58%)" fillOpacity={0.3} strokeWidth={2} />
            <Area type="monotone" dataKey="idealFrequency" name="Идеал (Ципф)" stroke="hsl(210,100%,52%)" fill="hsl(210,100%,52%)" fillOpacity={0.1} strokeWidth={2} strokeDasharray="6 3" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="space-y-2">
        {zipf.slice(0, 25).map((z: any, i: number) => (
          <div key={i} className={`glass-card px-4 py-2 flex items-center justify-between ${z.isSpam ? 'border-l-2 border-destructive' : ''}`}>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-6">#{z.rank}</span>
              <span className="text-sm text-foreground font-medium">{z.word}</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-xs text-accent">Факт: {z.frequency}</span>
              <span className="text-xs text-muted-foreground">Ципф: {z.idealFrequency}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                z.isSpam ? 'bg-destructive/20 text-destructive' :
                Math.abs(z.deviation) < 30 ? 'bg-accent/20 text-accent' :
                'bg-primary/20 text-primary'
              }`}>
                {z.deviation > 0 ? '+' : ''}{z.deviation}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Placeholder tabs ─────────── */

function ImagesTab({ data }: TabDataProps) {
  const images = data?.imagesData;
  if (!images?.length) return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ изображений</h2>
      <p className="text-sm text-muted-foreground">Изображения не найдены на странице.</p>
    </div>
  );

  const withAlt = images.filter((img: any) => img.hasAlt);
  const withoutAlt = images.filter((img: any) => !img.hasAlt);
  const withLazy = images.filter((img: any) => img.hasLazy);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ изображений</h2>
      <p className="text-sm text-muted-foreground">Найдено {images.length} изображений на странице.</p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{withAlt.length}</div>
          <div className="text-xs text-muted-foreground mt-1">С alt-текстом</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{withoutAlt.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Без alt (ошибка)</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{withLazy.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Lazy loading</div>
        </div>
      </div>

      {/* Image table */}
      <div className="space-y-2">
        {images.map((img: any, i: number) => (
          <div key={i} className={`glass-card px-4 py-3 flex items-start gap-3 ${img.critical ? 'border-l-2 border-destructive' : ''}`}>
            <div className="shrink-0 mt-0.5">
              {img.critical ? (
                <AlertTriangle className="w-4 h-4 text-destructive" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-accent" />
              )}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground truncate" title={img.src}>{img.src}</p>
              <div className="flex flex-wrap gap-2">
                <span className={`text-xs px-2 py-0.5 rounded ${img.hasAlt ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>
                  alt: {img.hasAlt ? `"${img.alt?.slice(0, 50)}"` : 'ОТСУТСТВУЕТ'}
                </span>
                {img.title && <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">title: "{img.title.slice(0, 40)}"</span>}
                <span className={`text-xs px-2 py-0.5 rounded ${img.hasLazy ? 'bg-accent/20 text-accent' : 'bg-secondary text-muted-foreground'}`}>
                  {img.hasLazy ? 'lazy ✓' : 'no lazy'}
                </span>
              </div>
            </div>
            <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded ${img.critical ? 'bg-destructive/20 text-destructive' : 'bg-accent/20 text-accent'}`}>
              {img.critical ? 'Ошибка' : 'OK'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnchorsTab({ data }: TabDataProps) {
  const anchors = data?.anchorsData;
  if (!anchors?.length) return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ анкоров</h2>
      <p className="text-sm text-muted-foreground">Ссылки не найдены на странице.</p>
    </div>
  );

  const internal = anchors.filter((a: any) => a.type === 'internal');
  const external = anchors.filter((a: any) => a.type === 'external');

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ анкоров</h2>
      <p className="text-sm text-muted-foreground">Найдено {anchors.length} ссылок: {internal.length} внутренних, {external.length} внешних.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Internal links */}
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Внутренние ссылки ({internal.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {internal.map((a: any, i: number) => (
              <div key={i} className="glass-card px-4 py-3">
                <p className="text-sm text-foreground font-medium">{a.text}</p>
                <p className="text-xs text-muted-foreground truncate mt-1" title={a.href}>{a.href}</p>
              </div>
            ))}
            {internal.length === 0 && <p className="text-xs text-muted-foreground">Не найдено</p>}
          </div>
        </div>

        {/* External links */}
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3 flex items-center gap-2">
            <ExternalLink className="w-4 h-4" /> Внешние ссылки ({external.length})
          </h3>
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {external.map((a: any, i: number) => (
              <div key={i} className="glass-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-foreground font-medium flex-1">{a.text}</p>
                  <div className="flex gap-1 shrink-0">
                    {a.hasNofollow && <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary">nofollow</span>}
                    {a.hasBlank && <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">_blank</span>}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-1" title={a.href}>{a.href}</p>
              </div>
            ))}
            {external.length === 0 && <p className="text-xs text-muted-foreground">Не найдено</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Semantic Map Tab (Cluster Analysis) ─────────── */

function SemanticMapTab({ data }: TabDataProps) {
  const cluster = data?.clusterData;
  const analysis = cluster?.clusterAnalysis;

  if (!cluster) return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Семантическая карта</h2>
      <p className="text-sm text-muted-foreground">Включите тумблер «Кластерный анализ» перед запуском, чтобы получить семантическую карту.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">Кластерный анализ не был включён для этого отчёта.</div>
    </div>
  );

  const coverageScore = analysis?.topicCoverageScore ?? 0;
  const semanticMap = analysis?.semanticMap || [];
  const gaps = analysis?.informationGaps || [];
  const covered = analysis?.coveredTopics || [];
  const faqQuestions = analysis?.suggestedFaqQuestions || cluster.peopleAlsoAsk || [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">🧬 Семантическая карта кластера</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Анализ полноты раскрытия темы на основе семантического кластера ({cluster.semanticCluster?.length || 0} фраз).
        </p>
      </div>

      {/* Topic Coverage Score */}
      <div className="glass-card p-6 flex items-center gap-6">
        <div className="text-center">
          <div className={`text-4xl font-bold ${coverageScore >= 70 ? 'text-accent' : coverageScore >= 40 ? 'text-primary' : 'text-destructive'}`}>
            {coverageScore}%
          </div>
          <div className="text-xs text-muted-foreground mt-1">Topic Coverage</div>
        </div>
        <div className="flex-1">
          <Progress value={coverageScore} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>Слабое покрытие</span>
            <span>Экспертный уровень (E-E-A-T)</span>
          </div>
        </div>
      </div>

      {/* Semantic Map — required sections */}
      {semanticMap.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">Обязательные разделы (Semantic Map)</h3>
          <div className="space-y-2">
            {semanticMap.map((section: any, i: number) => (
              <div key={i} className={`glass-card p-4 flex items-center gap-3 ${section.present ? '' : 'border-l-2 border-destructive'}`}>
                <span className={`shrink-0 ${section.present ? 'text-accent' : 'text-destructive'}`}>
                  {section.present ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{section.heading}</p>
                  {section.description && <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded ${section.present ? 'bg-accent/20 text-accent' : 'bg-destructive/20 text-destructive'}`}>
                  {section.present ? 'Есть' : 'Отсутствует'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Information Gaps + Covered */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gaps.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-3">❌ Информационные дыры</h3>
            <div className="space-y-2">
              {gaps.map((gap: string, i: number) => (
                <div key={i} className="glass-card px-4 py-3 border-l-2 border-destructive">
                  <p className="text-sm text-foreground">{gap}</p>
                </div>
              ))}
            </div>
          </div>
        )}
        {covered.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-3">✅ Раскрытые подтемы</h3>
            <div className="space-y-2">
              {covered.map((topic: string, i: number) => (
                <div key={i} className="glass-card px-4 py-3">
                  <p className="text-sm text-foreground">✓ {topic}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Semantic Cluster phrases */}
      {cluster.semanticCluster?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground uppercase tracking-wider mb-3">
            Фразы кластера ({cluster.semanticCluster.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {cluster.semanticCluster.map((phrase: string, i: number) => {
              const contentLower = ''; // We don't have raw content here, so rely on AI analysis
              return (
                <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-foreground border border-border/30">
                  {phrase}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggested FAQ Questions */}
      {faqQuestions.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">❓ Рекомендованные вопросы для FAQ</h3>
          <div className="space-y-2">
            {faqQuestions.map((q: string, i: number) => (
              <div key={i} className="glass-card px-4 py-3 flex items-center gap-3">
                <span className="text-primary text-sm font-bold shrink-0">Q{i + 1}.</span>
                <p className="text-sm text-foreground">{q}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Headings */}
      {cluster.competitorHeadings?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">📊 Популярные заголовки у конкурентов</h3>
          <div className="flex flex-wrap gap-2">
            {cluster.competitorHeadings.map((h: string, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                {h}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PageSpeedTab() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [urlInput, setUrlInput] = useState('');

  const fetchPageSpeed = async () => {
    if (!urlInput) return;
    setLoading(true);
    try {
      const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(urlInput)}&strategy=mobile&category=PERFORMANCE`;
      const res = await fetch(apiUrl);
      if (!res.ok) throw new Error('API error');
      const json = await res.json();

      const lhr = json.lighthouseResult;
      const audits = lhr?.audits || {};
      const categories = lhr?.categories || {};

      setData({
        mobile: {
          score: Math.round((categories.performance?.score || 0) * 100),
          lcp: audits['largest-contentful-paint']?.displayValue || '—',
          lcpScore: audits['largest-contentful-paint']?.score || 0,
          cls: audits['cumulative-layout-shift']?.displayValue || '—',
          clsScore: audits['cumulative-layout-shift']?.score || 0,
          fcp: audits['first-contentful-paint']?.displayValue || '—',
          fcpScore: audits['first-contentful-paint']?.score || 0,
          si: audits['speed-index']?.displayValue || '—',
          siScore: audits['speed-index']?.score || 0,
          tbt: audits['total-blocking-time']?.displayValue || '—',
          tbtScore: audits['total-blocking-time']?.score || 0,
        },
      });
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const scoreColor = (score: number) =>
    score >= 0.9 ? 'text-green-500' : score >= 0.5 ? 'text-yellow-500' : 'text-red-500';
  const scoreBg = (score: number) =>
    score >= 0.9 ? 'bg-green-500' : score >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">PageSpeed + Core Web Vitals</h2>
      <p className="text-sm text-muted-foreground">Проверьте реальные показатели производительности через Google PageSpeed API.</p>

      <div className="flex gap-2">
        <input
          className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="https://example.com"
          value={urlInput}
          onChange={e => setUrlInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchPageSpeed()}
        />
        <Button onClick={fetchPageSpeed} disabled={loading || !urlInput} className="btn-gradient border-0 gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          Проверить
        </Button>
      </div>

      {data && (
        <div className="space-y-4">
          {/* Score circle */}
          <div className="glass-card p-6 flex items-center gap-6">
            <div className="relative w-24 h-24">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(222,30%,18%)" strokeWidth="8" />
                <circle
                  cx="50" cy="50" r="42" fill="none"
                  stroke={data.mobile.score >= 90 ? '#22c55e' : data.mobile.score >= 50 ? '#eab308' : '#ef4444'}
                  strokeWidth="8" strokeLinecap="round"
                  strokeDasharray={`${data.mobile.score * 2.64} 264`}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${data.mobile.score >= 90 ? 'text-green-500' : data.mobile.score >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {data.mobile.score}
                </span>
              </div>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">Mobile Performance</p>
              <p className="text-xs text-muted-foreground">Google PageSpeed Insights</p>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'LCP', value: data.mobile.lcp, score: data.mobile.lcpScore, desc: 'Largest Contentful Paint' },
              { label: 'CLS', value: data.mobile.cls, score: data.mobile.clsScore, desc: 'Cumulative Layout Shift' },
              { label: 'FCP', value: data.mobile.fcp, score: data.mobile.fcpScore, desc: 'First Contentful Paint' },
              { label: 'TBT', value: data.mobile.tbt, score: data.mobile.tbtScore, desc: 'Total Blocking Time' },
              { label: 'SI', value: data.mobile.si, score: data.mobile.siScore, desc: 'Speed Index' },
            ].map((m, i) => (
              <div key={i} className="glass-card p-4 text-center">
                <div className={`text-lg font-bold ${scoreColor(m.score)}`}>{m.value}</div>
                <div className="text-xs font-bold text-foreground mt-1">{m.label}</div>
                <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${scoreBg(m.score)}`} style={{ width: `${m.score * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Stealth Engine (Tech Audit) ─────────── */

function StealthTab({ data }: TabDataProps) {
  const audit = data?.technicalAudit;
  if (!audit) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const checks = [
    { label: "H1 тегов", value: `${audit.h1Count}`, ok: audit.h1Count === 1 },
    { label: "H1 текст", value: audit.h1Text || "—", ok: !!audit.h1Text },
    { label: "Изображений всего", value: `${audit.totalImages}`, ok: true },
    { label: "Без alt-атрибута", value: `${audit.imagesWithoutAlt}`, ok: audit.imagesWithoutAlt === 0 },
    { label: "JSON-LD разметка", value: audit.hasJsonLd ? "Да" : "Нет", ok: audit.hasJsonLd },
    { label: "OpenGraph теги", value: audit.hasOpenGraph ? "Да" : "Нет", ok: audit.hasOpenGraph },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Stealth Engine — Технический аудит</h2>
      <p className="text-sm text-muted-foreground">Проверка технических SEO-элементов.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {checks.map((c, i) => (
          <div key={i} className="glass-card p-4 flex items-center justify-between">
            <span className="text-sm text-foreground">{c.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">{c.value}</span>
              <span className={`w-2 h-2 rounded-full shrink-0 ${c.ok ? 'bg-accent' : 'bg-destructive'}`} />
            </div>
          </div>
        ))}
      </div>

      {audit.issues?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-2">Проблемы</h3>
          <div className="space-y-2">
            {audit.issues.map((issue: string, i: number) => (
              <div key={i} className="glass-card p-3"><p className="text-sm text-foreground">⚠ {issue}</p></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─────────── Markdown to HTML converter ─────────── */

function markdownToHtml(md: string): string {
  let html = md;
  // Headers
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Tables (basic)
  const lines = html.split('\n');
  const out: string[] = [];
  let inTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) { out.push('<table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%">'); inTable = true; }
      if (/^\|[\s\-:|]+\|$/.test(line)) continue; // separator row
      const cells = line.split('|').filter(c => c.trim() !== '');
      const isHeader = i + 1 < lines.length && /^\|[\s\-:|]+\|$/.test(lines[i + 1].trim());
      const tag = isHeader ? 'th' : 'td';
      out.push('<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>');
    } else {
      if (inTable) { out.push('</table>'); inTable = false; }
      // Lists
      if (/^- (.+)/.test(line)) {
        out.push(`<li>${line.slice(2)}</li>`);
      } else if (/^\d+\. (.+)/.test(line)) {
        out.push(`<li>${line.replace(/^\d+\.\s*/, '')}</li>`);
      } else if (line) {
        out.push(`<p>${line}</p>`);
      }
    }
  }
  if (inTable) out.push('</table>');
  return out.join('\n');
}

/* ─────────── Content Checklist Badges ─────────── */

function ContentChecklist({ text, checklist, onGenerateTable }: { text: string; checklist?: any; onGenerateTable?: () => void }) {
  const checks = useMemo(() => {
    const t = text || '';
    return {
      hasTable: checklist?.hasTable ?? /\|.+\|/.test(t),
      hasList: checklist?.hasList ?? /^[\-\d]+[\.\)]\s/m.test(t),
      hasFaq: checklist?.hasFaq ?? /FAQ|часто задаваемые|frequently asked/i.test(t),
      lsiIntegrated: checklist?.lsiIntegrated ?? true,
      headingHierarchy: checklist?.headingHierarchy ?? /^#{1,3}\s/m.test(t),
    };
  }, [text, checklist]);

  const items = [
    { key: 'headingHierarchy', icon: Heading, label: 'H1-H3', ok: checks.headingHierarchy },
    { key: 'hasTable', icon: Table2, label: 'Таблицы', ok: checks.hasTable },
    { key: 'hasList', icon: List, label: 'Списки', ok: checks.hasList },
    { key: 'hasFaq', icon: HelpCircle, label: 'FAQ', ok: checks.hasFaq },
    { key: 'lsiIntegrated', icon: Tags, label: 'LSI-ключи', ok: checks.lsiIntegrated },
  ];

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {items.map(({ key, icon: Icon, label, ok }) => (
          <div
            key={key}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
              ok
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'bg-destructive/10 text-destructive border-destructive/20'
            }`}
          >
            {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
            <Icon className="w-3.5 h-3.5" />
            {label}
            {key === 'hasTable' && !ok && onGenerateTable && (
              <button
                onClick={(e) => { e.stopPropagation(); onGenerateTable(); }}
                className="ml-1 px-1.5 py-0.5 rounded bg-primary/20 text-primary hover:bg-primary/30 transition-colors text-[10px] font-bold"
              >
                + Добавить
              </button>
            )}
          </div>
        ))}
      </div>
      {!checks.hasTable && (
        <p className="text-xs text-muted-foreground italic">
          💡 Таблицы повышают шанс попадания в Google SGE на 40%. Рекомендуем добавить прайс-лист или характеристики.
        </p>
      )}
    </div>
  );
}

/* ─────────── Rich Markdown Renderer ─────────── */

function RichMarkdownPreview({ content }: { content: string }) {
  return (
    <div className="prose prose-invert prose-sm max-w-none
      prose-headings:text-foreground prose-headings:font-bold
      prose-h1:text-2xl prose-h1:mb-4 prose-h1:mt-6
      prose-h2:text-xl prose-h2:mb-3 prose-h2:mt-5
      prose-h3:text-lg prose-h3:mb-2 prose-h3:mt-4
      prose-p:text-foreground/90 prose-p:leading-relaxed prose-p:mb-3
      prose-li:text-foreground/90
      prose-strong:text-foreground
      prose-table:border-collapse
      prose-th:bg-secondary prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:text-foreground prose-th:font-semibold prose-th:border prose-th:border-border
      prose-td:px-4 prose-td:py-2 prose-td:border prose-td:border-border prose-td:text-foreground/80
      [&_tr:nth-child(even)_td]:bg-secondary/30
    ">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/* ─────────── Table Type Modal ─────────── */

const TABLE_TYPES = [
  { id: 'extract', icon: '📊', label: 'Извлечь данные из текста', desc: 'Цены, характеристики, этапы из вашего контента' },
  { id: 'compare', icon: '⚔️', label: 'Сравнение с конкурентами', desc: 'На основе данных ТОП-10 конкурентов' },
  { id: 'pricelist', icon: '💰', label: 'Шаблон: Прайс-лист', desc: 'Структурированная таблица цен на услуги' },
  { id: 'proscons', icon: '⚖️', label: 'Шаблон: Плюсы и минусы', desc: 'Сравнительная таблица преимуществ и недостатков' },
] as const;

function TableTypeModal({ open, onClose, onSelect, loading }: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="w-5 h-5 text-primary" />
            Сгенерировать таблицу
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Выберите тип таблицы для добавления в текст:</p>
        <div className="space-y-2 mt-2">
          {TABLE_TYPES.map((t) => (
            <button
              key={t.id}
              disabled={loading}
              onClick={() => onSelect(t.id)}
              className="w-full text-left glass-card p-4 hover:bg-secondary/50 transition-all rounded-lg flex items-start gap-3 disabled:opacity-50"
            >
              <span className="text-xl shrink-0">{t.icon}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
              </div>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0 mt-1" />}
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── AI Optimizer Component ─────────── */

function AiOptimizer({ analysisId }: { analysisId?: string | null }) {
  const { lang } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'html'>('preview');
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const handleOptimize = async () => {
    if (!analysisId) return;
    setLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ analysisId }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      toast({ title: e.message || 'Optimization failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateTable = useCallback(async (tableType: string) => {
    if (!analysisId || !result?.optimizedText) return;
    setTableLoading(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-optimize`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ analysisId, generateTable: tableType, currentText: result.optimizedText }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      if (data.optimizedText) {
        setResult((prev: any) => ({
          ...prev,
          optimizedText: data.optimizedText,
          contentChecklist: { ...prev?.contentChecklist, hasTable: true },
        }));
        toast({ title: 'Таблица добавлена в текст!' });
      }
      setTableModalOpen(false);
    } catch (e: any) {
      toast({ title: e.message || 'Table generation failed', variant: 'destructive' });
    } finally {
      setTableLoading(false);
    }
  }, [analysisId, result?.optimizedText, toast]);

  const htmlContent = useMemo(() => {
    if (!result?.optimizedText) return '';
    return markdownToHtml(result.optimizedText);
  }, [result?.optimizedText]);

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(htmlContent);
    setCopiedType('html');
    setTimeout(() => setCopiedType(null), 2000);
    toast({ title: 'HTML скопирован!' });
  };

  const handleCopyRich = async () => {
    try {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const textBlob = new Blob([result?.optimizedText || ''], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);
      setCopiedType('rich');
      setTimeout(() => setCopiedType(null), 2000);
      toast({ title: 'Rich Text скопирован!' });
    } catch {
      navigator.clipboard.writeText(result?.optimizedText || '');
      setCopiedType('rich');
      setTimeout(() => setCopiedType(null), 2000);
      toast({ title: 'Текст скопирован!' });
    }
  };

  return (
    <div className="space-y-4">
      <TableTypeModal
        open={tableModalOpen}
        onClose={() => setTableModalOpen(false)}
        onSelect={handleGenerateTable}
        loading={tableLoading}
      />

      {!result ? (
        <div className="glass-card p-8 text-center space-y-5">
          <Wand2 className="w-12 h-12 mx-auto text-primary" />
          <div>
            <h3 className="text-xl font-bold text-foreground">
              {lang === 'ru' ? 'AI Forge — Генератор готового контента' : 'AI Forge — Ready Content Generator'}
            </h3>
            <p className="text-sm text-muted-foreground mt-3 max-w-lg mx-auto leading-relaxed">
              {lang === 'ru'
                ? 'ИИ создаст готовый к публикации текст с правильной структурой (H1-H3), таблицами, списками и блоком FAQ. Просто скопируйте и вставьте на сайт.'
                : 'AI will create publish-ready text with proper structure (H1-H3), tables, lists, and FAQ block. Just copy and paste to your site.'}
            </p>
          </div>
          <Button
            onClick={handleOptimize}
            disabled={loading || !analysisId}
            className="btn-gradient border-0 gap-2"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {lang === 'ru' ? 'Генерация контента...' : 'Generating...'}</>
            ) : (
              <><Wand2 className="w-4 h-4" /> {lang === 'ru' ? 'Сгенерировать контент' : 'Generate Content'}</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          {result.summary && (
            <div className="glass-card p-4 border-l-2 border-primary">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {lang === 'ru' ? 'Что изменено' : 'Changes Summary'}
              </span>
              <p className="text-sm text-foreground mt-1">{result.summary}</p>
            </div>
          )}

          {/* Checklist badges */}
          <ContentChecklist
            text={result.optimizedText}
            checklist={result.contentChecklist}
            onGenerateTable={() => setTableModalOpen(true)}
          />

          {/* Changes detail */}
          {result.changes?.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                {lang === 'ru' ? 'Детали изменений' : 'Change Details'} ({result.changes.length})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.changes.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      c.type === 'added' ? 'bg-accent/20 text-accent' :
                      c.type === 'reduced' ? 'bg-destructive/20 text-destructive' :
                      c.type === 'structure' ? 'bg-secondary text-foreground' :
                      'bg-primary/20 text-primary'
                    }`}>
                      {c.type === 'added' ? '+' : c.type === 'reduced' ? '−' : c.type === 'structure' ? '▣' : '◆'}
                    </span>
                    <span className="text-foreground font-medium">{c.term || c.phrase}</span>
                    <span className="text-muted-foreground">
                      {c.context || (c.from !== undefined ? `${c.from} → ${c.to}` : '')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content viewer with tabs */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-4">
              {/* View mode toggle */}
              <div className="flex bg-secondary rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'preview' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" /> Предпросмотр
                </button>
                <button
                  onClick={() => setViewMode('html')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    viewMode === 'html' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" /> Код (HTML)
                </button>
              </div>

              {/* Copy buttons */}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyHtml}>
                  {copiedType === 'html' ? <Check className="w-3.5 h-3.5" /> : <Code className="w-3.5 h-3.5" />}
                  {copiedType === 'html' ? 'Скопировано' : 'Copy HTML'}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopyRich}>
                  {copiedType === 'rich' ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                  {copiedType === 'rich' ? 'Скопировано' : 'Copy Rich Text'}
                </Button>
              </div>
            </div>

            {/* Content area */}
            <div className="max-h-[600px] overflow-y-auto rounded-lg bg-secondary/20 p-6">
              {viewMode === 'preview' ? (
                <RichMarkdownPreview content={result.optimizedText} />
              ) : (
                <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed select-all">
                  {htmlContent}
                </pre>
              )}
            </div>
          </div>

          <Button variant="outline" onClick={() => setResult(null)} className="gap-1.5">
            <Wand2 className="w-3.5 h-3.5" />
            {lang === 'ru' ? 'Запустить заново' : 'Run Again'}
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─────────── Data Sources Tab ─────────── */

function DataSourcesTab({ data }: TabDataProps) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const sources = data?.sourcesData;
  const competitorUrls = data?.competitorUrls || [];

  if (!sources?.length && !competitorUrls?.length) {
    return <p className="text-muted-foreground text-sm">Нет данных об источниках.</p>;
  }

  const items = sources?.length ? sources : competitorUrls.map((u: string) => ({ url: u, fetched: true, contentPreview: '', rawContent: '', wordCount: 0 }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Источники данных</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Список проанализированных конкурентов. Все рекомендации основаны на реальных данных этих страниц.
        </p>
      </div>
      <div className="space-y-2">
        {items.map((s: any, i: number) => (
          <div key={i} className="glass-card p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={`w-2 h-2 rounded-full shrink-0 ${s.fetched ? 'bg-green-500' : 'bg-red-500'}`} />
                <div className="min-w-0">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline truncate block">{s.url}</a>
                  {s.wordCount > 0 && <p className="text-xs text-muted-foreground">{s.wordCount} слов</p>}
                </div>
              </div>
              {s.rawContent && (
                <Button variant="outline" size="sm" className="text-xs gap-1.5 shrink-0" onClick={() => setOpenIdx(openIdx === i ? null : i)}>
                  <Eye className="w-3.5 h-3.5" />
                  {openIdx === i ? 'Скрыть' : 'Сырой текст'}
                </Button>
              )}
            </div>
            {openIdx === i && s.rawContent && (
              <Dialog open onOpenChange={() => setOpenIdx(null)}>
                <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
                  <DialogHeader>
                    <DialogTitle className="text-sm truncate">{s.url}</DialogTitle>
                  </DialogHeader>
                  <div className="flex-1 overflow-auto text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-4 rounded-md">
                    {s.rawContent}
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Verification (Before/After) Tab ─────────── */

function VerificationTab({ data }: TabDataProps) {
  const pageStats = data?.pageStats;
  const tfidf = data?.tfidf;

  // Count proof-linked terms (found in competitors but missing from target)
  const missingTerms = tfidf?.filter((t: any) => t.status === 'Missing') || [];

  const metrics = pageStats ? [
    { label: 'Количество слов', before: pageStats.target?.wordCount || 0, median: pageStats.competitorMedian?.wordCount || 0 },
    { label: 'Заголовки H2', before: pageStats.target?.h2Count || 0, median: pageStats.competitorMedian?.h2Count || 0 },
    { label: 'Заголовки H3', before: pageStats.target?.h3Count || 0, median: '-' },
    { label: 'Изображения', before: pageStats.target?.imgCount || 0, median: '-' },
    { label: 'Ссылки', before: pageStats.target?.linkCount || 0, median: '-' },
  ] : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">Сверка: До и После</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Сравнение вашей страницы с медианой ТОП-10 конкурентов. Данные получены из реального парсинга.
        </p>
      </div>

      {metrics.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Метрика</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ваша страница</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Медиана ТОП-10</th>
                <th className="text-center py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Статус</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m, i) => {
                const diff = typeof m.median === 'number' && m.median > 0 ? m.before / m.median : null;
                const statusColor = diff === null ? 'text-muted-foreground' : diff >= 0.8 ? 'text-green-500' : diff >= 0.5 ? 'text-yellow-500' : 'text-red-500';
                const statusText = diff === null ? '—' : diff >= 0.8 ? '✓ OK' : diff >= 0.5 ? '⚠ Ниже' : '✕ Критично';
                return (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 px-4 text-foreground font-medium">{m.label}</td>
                    <td className="py-3 px-4 text-center font-mono text-foreground">{m.before}</td>
                    <td className="py-3 px-4 text-center font-mono text-muted-foreground">{m.median}</td>
                    <td className={`py-3 px-4 text-center font-medium ${statusColor}`}>{statusText}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {missingTerms.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-3">
            Подтверждённые пробелы (Proof-linked Gaps)
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Каждый термин реально найден у конкурентов через TF-IDF анализ, а не сгенерирован ИИ.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {missingTerms.slice(0, 20).map((t: any, i: number) => (
              <div key={i} className="glass-card p-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{t.term}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Медиана: {(t.competitorMedianTfidf * 1000).toFixed(1)}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/20 text-primary">GAP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!pageStats && !missingTerms.length && (
        <p className="text-muted-foreground text-sm">Нет данных для верификации. Запустите анализ с конкурентами.</p>
      )}
    </div>
  );
}

/* ─────────── Implementation Plan Tab ─────────── */

function ImplementationPlanTab({ data }: TabDataProps) {
  const plan: any[] = data?.implementationPlan || [];
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setChecked(prev => ({ ...prev, [i]: !prev[i] }));

  const p1 = plan.filter(t => t.priority === 'P1');
  const p2 = plan.filter(t => t.priority === 'P2');
  const p3 = plan.filter(t => t.priority === 'P3');

  const totalWeight = plan.reduce((s, t) => s + (t.weight || 1), 0) || 1;
  const doneWeight = plan.reduce((s, t, i) => s + (checked[i] ? (t.weight || 1) : 0), 0);
  const progress = Math.round((doneWeight / totalWeight) * 100);

  const stripEmojis = (text: string) =>
    text.replace(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]|[\u{FE00}-\u{FEFF}]|[\u{1F900}-\u{1F9FF}]|[\u{1FA00}-\u{1FA6F}]|[\u{1FA70}-\u{1FAFF}]|[\u{2702}-\u{27B0}]|[\u{23E9}-\u{23FA}]|[\u{200D}]|[\u{20E3}]|[\u{FE0F}]|[\u{E0020}-\u{E007F}]|[🔴🟡🟢📍🔧📈📋🧬✅⬜🎯⚡💡🚀]/gu, '').trim();

  const copyForGoogleDocs = async () => {
    const url = data?.url || '';
    const sections = [
      { label: 'Приоритет P1 — Критические задачи', items: p1 },
      { label: 'Приоритет P2 — Важные задачи', items: p2 },
      { label: 'Приоритет P3 — Рекомендованные задачи', items: p3 },
    ];

    let html = `<h1 style="font-family:Arial,sans-serif;font-size:20px;">Техническое задание на SEO-оптимизацию страницы ${stripEmojis(url)}</h1>`;
    html += `<p style="font-family:Arial,sans-serif;font-size:13px;color:#555;">Текущий прогресс: ${progress}% | Всего задач: ${plan.length}</p>`;
    html += `<hr style="border:1px solid #ddd;margin:16px 0;">`;

    for (const sec of sections) {
      if (!sec.items.length) continue;
      html += `<h2 style="font-family:Arial,sans-serif;font-size:16px;margin-top:20px;">${sec.label}</h2>`;
      html += `<ul style="font-family:Arial,sans-serif;font-size:13px;line-height:1.8;">`;
      for (const item of sec.items) {
        html += `<li style="margin-bottom:12px;">`;
        html += `<b>${stripEmojis(item.title || '')}</b>`;
        if (item.where) html += `<br/>Расположение: ${stripEmojis(item.where)}`;
        if (item.action) html += `<br/>Решение: ${stripEmojis(item.action)}`;
        if (item.expectedResult) html += `<br/>Влияние: ${stripEmojis(item.expectedResult)}`;
        html += `</li>`;
      }
      html += `</ul>`;
    }

    const plainText = sections
      .filter(s => s.items.length)
      .map(s => `${s.label}\n` + s.items.map(i =>
        `- ${stripEmojis(i.title || '')}${i.where ? `\n  Расположение: ${stripEmojis(i.where)}` : ''}${i.action ? `\n  Решение: ${stripEmojis(i.action)}` : ''}${i.expectedResult ? `\n  Влияние: ${stripEmojis(i.expectedResult)}` : ''}`
      ).join('\n')).join('\n\n');

    try {
      const blob = new Blob([html], { type: 'text/html' });
      const textBlob = new Blob([plainText], { type: 'text/plain' });
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': blob,
          'text/plain': textBlob,
        }),
      ]);
      toast.success('ТЗ скопировано в формате Rich Text. Теперь вставьте его в Google Документы (Ctrl+V)');
    } catch {
      navigator.clipboard.writeText(plainText);
      toast.success('ТЗ скопировано как текст');
    }
  };

  if (!plan.length) return <p className="text-muted-foreground text-sm">Нет данных. Запустите анализ для генерации плана.</p>;

  const priorityConfig = {
    P1: { label: 'P1 — Критично', color: 'bg-destructive/20 text-destructive', icon: '🔴', border: 'border-l-destructive' },
    P2: { label: 'P2 — Важно', color: 'bg-amber-500/20 text-amber-400', icon: '🟡', border: 'border-l-amber-500' },
    P3: { label: 'P3 — Рекомендовано', color: 'bg-emerald-500/20 text-emerald-400', icon: '🟢', border: 'border-l-emerald-500' },
  };

  const renderGroup = (items: any[], priority: 'P1' | 'P2' | 'P3') => {
    if (!items.length) return null;
    const cfg = priorityConfig[priority];
    return (
      <div className="space-y-2" key={priority}>
        <div className="flex items-center gap-2 mb-3">
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
          <span className="text-xs text-muted-foreground">({items.length} задач)</span>
        </div>
        {items.map((item: any) => {
          const globalIdx = plan.indexOf(item);
          const isDone = checked[globalIdx];
          return (
            <div
              key={globalIdx}
              className={`glass-card p-4 border-l-4 ${cfg.border} transition-all ${isDone ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start gap-3">
                <button
                  onClick={() => toggle(globalIdx)}
                  className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isDone ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'
                  }`}
                >
                  {isDone && <Check className="w-3 h-3" />}
                </button>
                <div className="flex-1 space-y-1.5">
                  <p className={`font-semibold text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                    {item.title}
                  </p>
                  {item.where && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <span className="text-accent">📍</span> {item.where}
                    </p>
                  )}
                  {item.action && (
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <span className="text-accent shrink-0">🔧</span> {item.action}
                    </p>
                  )}
                  {item.expectedResult && (
                    <p className="text-xs text-emerald-400/80 flex items-start gap-1.5">
                      <TrendingUp className="w-3 h-3 mt-0.5 shrink-0" /> {item.expectedResult}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary" />
            Готовность страницы к ТОП-1
          </h2>
          <span className="text-2xl font-bold gradient-text">{progress}%</span>
        </div>
        <Progress value={progress} className="h-3" />
        <p className="text-xs text-muted-foreground mt-2">
          Выполнено {Object.values(checked).filter(Boolean).length} из {plan.length} задач
        </p>
      </div>

      {/* Copy button */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={copyAsMarkdown}>
          <Copy className="w-3 h-3" /> Скопировать как ТЗ (Markdown)
        </Button>
      </div>

      {/* Task groups */}
      {renderGroup(p1, 'P1')}
      {renderGroup(p2, 'P2')}
      {renderGroup(p3, 'P3')}
    </div>
  );
}

/* ─────────── Main Tabs Component ─────────── */

interface ReportTabsProps {
  data?: any;
  analysisId?: string | null;
}

export function ReportTabs({ data = {}, analysisId }: ReportTabsProps) {
  const { lang } = useLang();
  const labels = {
    ...(tabLabels[lang] || tabLabels.en),
    optimizer: '🔮 AI Forge',
  };

  const allTabKeys = ['optimizer', ...tabKeys] as const;

  // Split tabs into two rows matching the screenshot layout
  const row1Keys = ['optimizer', 'aiReport', 'priorities', 'blueprint', 'semanticMap', 'tfidf', 'ngrams', 'implementationPlan'] as const;
  const row2Keys = ['zipf', 'images', 'anchors', 'pageSpeed', 'stealth', 'dataSources', 'verification'] as const;

  const renderTrigger = (key: string) => (
    <TabsTrigger
      key={key}
      value={key}
      className={`px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors
        text-muted-foreground hover:text-foreground
        data-[state=active]:text-primary data-[state=active]:bg-transparent
        data-[state=active]:shadow-none
        rounded-none border-b-2 border-transparent data-[state=active]:border-primary`}
    >
      {key === 'optimizer' && <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 inline-block animate-pulse" />}
      {key === 'aiReport' && <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5 inline-block" />}
      {labels[key as keyof typeof labels]}
    </TabsTrigger>
  );

  return (
    <Tabs defaultValue="optimizer" className="w-full">
      <div className="bg-card/60 border border-border/50 rounded-lg overflow-hidden">
        <TabsList className="w-full h-auto flex flex-nowrap justify-start gap-0 bg-transparent p-0 rounded-none border-b border-border/30">
          {row1Keys.map(renderTrigger)}
        </TabsList>
        <TabsList className="w-full h-auto flex flex-nowrap justify-start gap-0 bg-transparent p-0 rounded-none">
          {row2Keys.map(renderTrigger)}
        </TabsList>
      </div>

      <TabsContent value="optimizer" className="mt-6">
        <AiOptimizer analysisId={analysisId} />
      </TabsContent>

      {tabKeys.map((key) => {
        const tabComponents: Record<TabKey, () => JSX.Element> = {
          aiReport: () => <AiReportTab data={data} />,
          priorities: () => <PrioritiesTab data={data} />,
          implementationPlan: () => <ImplementationPlanTab data={data} />,
          blueprint: () => <BlueprintTab data={data} />,
          semanticMap: () => <SemanticMapTab data={data} />,
          tfidf: () => <TfidfTab data={data} />,
          ngrams: () => <NgramsTab data={data} />,
          zipf: () => <ZipfTab data={data} />,
          images: () => <ImagesTab data={data} />,
          anchors: () => <AnchorsTab data={data} />,
          pageSpeed: () => <PageSpeedTab />,
          stealth: () => <StealthTab data={data} />,
          dataSources: () => <DataSourcesTab data={data} />,
          verification: () => <VerificationTab data={data} />,
        };
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
