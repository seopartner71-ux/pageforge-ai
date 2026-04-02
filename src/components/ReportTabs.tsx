import { useState, useMemo } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Wand2, Copy, Check, Loader2, Code, Eye, FileText, CheckCircle2, XCircle, List, Table2, HelpCircle, Tags, Heading } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
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

/* ─────────── AI Report Tab ─────────── */

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
      {report.geoScore !== undefined && (
        <div className="glass-card p-4 flex items-center gap-4">
          <span className="text-sm text-foreground font-medium">GEO Score</span>
          <Progress value={report.geoScore} className="flex-1 h-2" />
          <span className="text-sm font-bold text-accent">{report.geoScore}/100</span>
        </div>
      )}
      {report.sgeReadiness && (
        <div className="glass-card p-4">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SGE / AI Overviews Ready</span>
          <p className="text-sm text-foreground mt-1">{report.sgeReadiness}</p>
        </div>
      )}
      {report.strengths?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2">Сильные стороны</h3>
          <div className="space-y-2">
            {report.strengths.map((s: string, i: number) => (
              <div key={i} className="glass-card p-3"><p className="text-sm text-foreground">✓ {s}</p></div>
            ))}
          </div>
        </div>
      )}
      {report.weaknesses?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-destructive uppercase tracking-wider mb-2">Слабые стороны</h3>
          <div className="space-y-2">
            {report.weaknesses.map((w: string, i: number) => (
              <div key={i} className="glass-card p-3"><p className="text-sm text-foreground">✕ {w}</p></div>
            ))}
          </div>
        </div>
      )}
      {report.recommendations?.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Рекомендации</h3>
          <div className="space-y-2">
            {report.recommendations.map((r: string, i: number) => (
              <div key={i} className="glass-card p-3"><p className="text-sm text-foreground">→ {r}</p></div>
            ))}
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

/* ─────────── Blueprint Tab ─────────── */

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

/* ─────────── TF-IDF Tab (proper math) ─────────── */

function TfidfTab({ data }: TabDataProps) {
  const items = data?.tfidf;
  if (!items?.length) return <p className="text-muted-foreground text-sm">Нет данных.</p>;

  const missingItems = items.filter((d: any) => d.status === "Missing");
  const overoptItems = items.filter((d: any) => d.status === "Overoptimized");
  const okItems = items.filter((d: any) => d.status === "OK");

  // Chart: top 15 terms by TF-IDF score
  const chartItems = [...items].sort((a: any, b: any) => (b.tfidf + b.competitorMedianTfidf) - (a.tfidf + a.competitorMedianTfidf)).slice(0, 15);
  const chartData = chartItems.map((d: any) => ({
    name: d.term,
    'Ваша страница': +(d.tfidf * 1000).toFixed(2),
    'Медиана конкурентов': +(d.competitorMedianTfidf * 1000).toFixed(2),
  }));

  const statusColor = (s: string) =>
    s === 'OK' ? 'bg-accent/20 text-accent' :
    s === 'Overoptimized' ? 'bg-destructive/20 text-destructive' :
    s === 'Missing' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground';

  const statusLabel = (s: string) =>
    s === 'OK' ? 'OK' :
    s === 'Overoptimized' ? 'Переспам' :
    s === 'Missing' ? 'Missing' : s;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground">TF-IDF анализ</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Score = TF × IDF. Сравнение с медианой ТОП конкурентов.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-accent">{okItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">OK</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-primary">{missingItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Missing Entities</div>
        </div>
        <div className="glass-card p-4 text-center">
          <div className="text-2xl font-bold text-destructive">{overoptItems.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Переспам</div>
        </div>
      </div>

      {/* Bar chart */}
      <div className="glass-card p-4 h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222,30%,18%)" />
            <XAxis dataKey="name" tick={{ fill: 'hsl(215,20%,55%)', fontSize: 10 }} angle={-45} textAnchor="end" height={60} />
            <YAxis tick={{ fill: 'hsl(215,20%,55%)', fontSize: 11 }} />
            <Tooltip contentStyle={{ background: 'hsl(222,47%,9%)', border: '1px solid hsl(222,30%,18%)', borderRadius: '8px', color: '#fff' }} />
            <Legend />
            <Bar dataKey="Ваша страница" fill="hsl(245,58%,58%)" radius={[4,4,0,0]} />
            <Bar dataKey="Медиана конкурентов" fill="hsl(210,100%,52%)" radius={[4,4,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Missing entities section */}
      {missingItems.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-primary uppercase tracking-wider mb-2">Missing Entities — добавьте на страницу</h3>
          <div className="flex flex-wrap gap-2">
            {missingItems.map((d: any, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                {d.term} <span className="opacity-60">(IDF: {d.idf?.toFixed(1)})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Full table */}
      <div className="space-y-2">
        {items.map((d: any, i: number) => (
          <div key={i} className="glass-card px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-foreground font-medium">{d.term}</span>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">TF: {(d.tf * 100).toFixed(2)}%</span>
              <span className="text-xs text-muted-foreground">IDF: {d.idf?.toFixed(2)}</span>
              <span className="text-xs text-muted-foreground">Score: {(d.tfidf * 1000).toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">Конк: {(d.competitorMedianTfidf * 1000).toFixed(1)}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${statusColor(d.status)}`}>
                {statusLabel(d.status)}
              </span>
            </div>
          </div>
        ))}
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

function ImagesTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ изображений</h2>
      <p className="text-sm text-muted-foreground">Детальный анализ будет доступен после парсинга HTML.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">Ожидание модуля парсинга HTML.</div>
    </div>
  );
}

function AnchorsTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">Анализ анкоров</h2>
      <p className="text-sm text-muted-foreground">Анализ ссылок будет доступен после парсинга HTML.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">Ожидание модуля парсинга HTML.</div>
    </div>
  );
}

function PageSpeedTab() {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-foreground">PageSpeed + Core Web Vitals</h2>
      <p className="text-sm text-muted-foreground">Требуется интеграция с PageSpeed Insights API.</p>
      <div className="glass-card p-8 text-center text-muted-foreground">Подключите PageSpeed API.</div>
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

/* ─────────── AI Optimizer Component ─────────── */

function AiOptimizer({ analysisId }: { analysisId?: string | null }) {
  const { lang } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

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

  const handleCopy = () => {
    if (result?.optimizedText) {
      navigator.clipboard.writeText(result.optimizedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({ title: lang === 'ru' ? 'Текст скопирован!' : 'Text copied!' });
    }
  };

  return (
    <div className="space-y-4">
      {!result ? (
        <div className="glass-card p-6 text-center space-y-4">
          <Wand2 className="w-10 h-10 mx-auto text-primary" />
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {lang === 'ru' ? 'AI Optimizer — Автоматическая оптимизация текста' : 'AI Optimizer — Automatic Text Optimization'}
            </h3>
            <p className="text-sm text-muted-foreground mt-2">
              {lang === 'ru'
                ? 'ИИ перепишет текст вашей страницы: добавит Missing Entities, снизит переспам и закроет тематические пробелы. Результат — готовый текст для копирования.'
                : 'AI will rewrite your page text: add Missing Entities, reduce keyword spam, and close topical gaps. Result — ready-to-copy text.'}
            </p>
          </div>
          <Button
            onClick={handleOptimize}
            disabled={loading || !analysisId}
            className="btn-gradient border-0 gap-2"
            size="lg"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> {lang === 'ru' ? 'Оптимизация...' : 'Optimizing...'}</>
            ) : (
              <><Wand2 className="w-4 h-4" /> {lang === 'ru' ? 'Оптимизировать текст ИИ' : 'Optimize Text with AI'}</>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {result.summary && (
            <div className="glass-card p-4 border-l-2 border-primary">
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {lang === 'ru' ? 'Что изменено' : 'Changes Summary'}
              </span>
              <p className="text-sm text-foreground mt-1">{result.summary}</p>
            </div>
          )}

          {result.changes?.length > 0 && (
            <div className="glass-card p-4">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                {lang === 'ru' ? 'Детали изменений' : 'Change Details'}
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {result.changes.map((c: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className={`px-1.5 py-0.5 rounded font-bold ${
                      c.type === 'added' ? 'bg-accent/20 text-accent' :
                      c.type === 'reduced' ? 'bg-destructive/20 text-destructive' :
                      'bg-primary/20 text-primary'
                    }`}>
                      {c.type === 'added' ? '+' : c.type === 'reduced' ? '−' : '◆'}
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

          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                {lang === 'ru' ? 'Оптимизированный текст' : 'Optimized Text'}
              </h4>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? (lang === 'ru' ? 'Скопировано' : 'Copied') : (lang === 'ru' ? 'Копировать' : 'Copy')}
              </Button>
            </div>
            <div className="max-h-[500px] overflow-y-auto rounded-lg bg-secondary/30 p-4">
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {result.optimizedText}
              </pre>
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

  return (
    <Tabs defaultValue="optimizer" className="w-full">
      <TabsList className="w-full h-auto flex flex-wrap gap-0.5 bg-secondary/50 p-1 rounded-xl">
        {allTabKeys.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className={`px-3 py-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground text-xs font-medium transition-all ${
              key === 'optimizer' ? 'data-[state=active]:bg-primary/20 data-[state=active]:text-primary' : ''
            }`}
          >
            {key === 'optimizer' && <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 inline-block animate-pulse" />}
            {key === 'aiReport' && <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5 inline-block" />}
            {labels[key as keyof typeof labels]}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="optimizer" className="mt-6">
        <AiOptimizer analysisId={analysisId} />
      </TabsContent>

      {tabKeys.map((key) => {
        const tabComponents: Record<TabKey, () => JSX.Element> = {
          aiReport: () => <AiReportTab data={data} />,
          priorities: () => <PrioritiesTab data={data} />,
          blueprint: () => <BlueprintTab data={data} />,
          tfidf: () => <TfidfTab data={data} />,
          ngrams: () => <NgramsTab data={data} />,
          zipf: () => <ZipfTab data={data} />,
          images: () => <ImagesTab />,
          anchors: () => <AnchorsTab />,
          pageSpeed: () => <PageSpeedTab />,
          stealth: () => <StealthTab data={data} />,
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
