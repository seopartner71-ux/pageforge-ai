import { useState, useMemo, useCallback } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wand2, Copy, Check, Loader2, Code, Eye, FileText, CheckCircle2, XCircle, List, Table2, HelpCircle, Tags, Heading, Image, Link2, ExternalLink, AlertTriangle, Plus, Sparkles } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, Legend,
} from 'recharts';

const tabKeys = [
  'aiReport', 'priorities', 'blueprint', 'semanticMap', 'tfidf', 'ngrams',
  'zipf', 'images', 'anchors', 'pageSpeed', 'stealth', 'dataSources', 'verification',
] as const;

type TabKey = typeof tabKeys[number];

const tabLabels: Record<string, Record<TabKey, string>> = {
  ru: {
    aiReport: 'ИИ-отчёт', priorities: 'Приоритеты', blueprint: 'Golden Blueprint',
    semanticMap: '🧬 Семантическая карта',
    tfidf: 'TF-IDF', ngrams: 'N-граммы', zipf: 'Закон Ципфа',
    images: 'Изображения', anchors: 'Анкоры', pageSpeed: 'PageSpeed', stealth: 'Stealth Engine',
    dataSources: '📋 Источники', verification: '✅ До/После',
  },
  en: {
    aiReport: 'AI Report', priorities: 'Priorities', blueprint: 'Golden Blueprint',
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
