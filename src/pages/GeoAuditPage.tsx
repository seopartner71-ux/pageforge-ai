import { useState, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import {
  Play, CheckCircle2, AlertTriangle, XCircle, Loader2, Target, Zap, Clock,
  FileDown, Sparkles,
} from 'lucide-react';
import { exportGeoAuditDocx } from '@/lib/exportGeoAuditDocx';

/* ─── Types ─── */
interface CheckItem {
  id: string;
  label: string;
  criteria: string;
  tools: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface StageResult {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  items: CheckItem[];
}

interface AuditResult {
  geoScore: number;
  stages: StageResult[];
  criticals: string[];
  strategy: string[];
}

/* ─── Score Ring ─── */
function ScoreRing({ score, size = 140, strokeWidth = 10 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color = score >= 80 ? '#34D399' : score >= 60 ? '#FBBF24' : '#EF4444';

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.2} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        className="fill-foreground rotate-90 origin-center" style={{ fontSize: size * 0.3, fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

/* ─── Status badge ─── */
function StatusBadge({ status }: { status: string }) {
  if (status === 'pass') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400">
      <CheckCircle2 className="w-3.5 h-3.5" /> OK
    </span>
  );
  if (status === 'warn') return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-yellow-400">
      <AlertTriangle className="w-3.5 h-3.5" /> Внимание
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-400">
      <XCircle className="w-3.5 h-3.5" /> Ошибка
    </span>
  );
}

/* ─── Progress steps ─── */
const PROGRESS_STEPS = [
  'Загрузка страницы...',
  'Проверка robots.txt и sitemap...',
  'Анализ структуры HTML...',
  'Проверка Schema.org разметки...',
  'Анализ контента и E-E-A-T...',
  'Формирование рекомендаций...',
];

/* ─── Main Page ─── */
export default function GeoAuditPage() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRun = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep(prev => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 3000);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('geo-audit', {
        body: { url: url.trim() },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      setResult(data as AuditResult);
    } catch (err: any) {
      const msg = err?.message || 'Ошибка при выполнении аудита';
      setError(msg);
      toast({ title: 'Ошибка GEO Audit', description: msg, variant: 'destructive' });
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  };

  const scoreColor = useMemo(() => {
    if (!result) return 'hsl(var(--primary))';
    if (result.geoScore >= 80) return '#34D399';
    if (result.geoScore >= 60) return '#FBBF24';
    return '#EF4444';
  }, [result]);

  const totalChecks = result ? result.stages.reduce((s, st) => s + st.items.length, 0) : 0;
  const passCount = result ? result.stages.flatMap(s => s.items).filter(i => i.status === 'pass').length : 0;
  const failCount = result ? result.stages.flatMap(s => s.items).filter(i => i.status === 'fail').length : 0;
  const warnCount = result ? result.stages.flatMap(s => s.items).filter(i => i.status === 'warn').length : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            GEO Audit
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Полный чек-лист готовности страницы к AI-поиску: ChatGPT, Perplexity, AI Overviews, Яндекс Нейро.
          </p>
        </div>
        <PageDescription
          items={[
            { label: 'Что это', text: 'GEO (Generative Engine Optimization) — аудит готовности страницы попадать в ответы AI-поиска: ChatGPT, Perplexity, Google AI Overviews, Яндекс Нейро, Gemini.' },
            { label: 'Что проверяем', text: '41 фактор по 5 направлениям: техническая доступность для AI-ботов (robots.txt, llms.txt, рендеринг, скорость), прямая видимость в ИИ-системах, семантическая структура (Schema.org, заголовки, FAQ), качество контента под цитирование, сигналы E-E-A-T.' },
            { label: 'Зачем', text: 'Классическое SEO больше не покрывает весь трафик: пользователи получают ответы прямо в AI-ассистентах. Аудит показывает, попадёт ли ваша страница в эти ответы и что нужно поправить, чтобы её цитировали.' },
            { label: 'Результат', text: 'GEO Score 0–100, разбивка по этапам, конкретные находки и рекомендации, выгрузка отчёта в Word.' },
          ]}
          help={{
            content: [
              'GEO (Generative Engine Optimization) — оптимизация под генеративные поисковые системы: Google AI Overviews / AI Mode, ChatGPT Search, Perplexity, Microsoft Copilot, Яндекс Нейро. Термин введён в академической работе «GEO: Generative Engine Optimization» (Princeton, Georgia Tech, IIT Delhi, 2023, arXiv:2311.09735).',
              'Ключевое отличие от классического SEO: AI-поисковики извлекают и цитируют фрагменты страниц, а не показывают список ссылок. Факторы цитирования: чёткая структура (H1–H3, списки, таблицы), наличие прямых ответов в первых абзацах, цитируемые данные и цифры, Schema.org разметка (Article, FAQ, HowTo), сигналы E-E-A-T автора и сайта.',
              'llms.txt — предложенный стандарт (llmstxt.org, сентябрь 2024) для предоставления LLM-моделям структурированного описания сайта. AI-боты также используют robots.txt с директивами для GPTBot, Google-Extended, PerplexityBot, ClaudeBot — блокировка/разрешение их доступа напрямую влияет на цитируемость.',
            ],
            sources: [
              { label: 'Google — AI Overviews and AI Mode', url: 'https://blog.google/products/search/ai-mode-general-availability/' },
              { label: 'Princeton/GeorgiaTech — GEO research paper (arXiv)', url: 'https://arxiv.org/abs/2311.09735' },
              { label: 'llms.txt — официальная спецификация', url: 'https://llmstxt.org/' },
              { label: 'Google — Google-Extended user agent', url: 'https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers#google-extended' },
              { label: 'OpenAI — GPTBot', url: 'https://platform.openai.com/docs/gptbot' },
            ],
          }}
        />

        {/* Input */}
        <Card className="p-5">
          <form
            onSubmit={(e) => { e.preventDefault(); handleRun(); }}
            className="flex flex-col sm:flex-row gap-3"
          >
            <Input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="example.com или https://example.com/page"
              className="flex-1"
              data-tour="geo-url"
            />
            <Button type="submit" disabled={running || !url.trim()} className="gap-2">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {running ? 'Анализ...' : 'Запустить GEO Audit'}
            </Button>
          </form>
        </Card>

        {/* Loading */}
        {running && (
          <div className="flex flex-col items-center gap-6 py-12">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Выполняется GEO Audit</p>
              <p className="text-xs text-muted-foreground">{PROGRESS_STEPS[progressStep]}</p>
            </div>
            <div className="w-64 space-y-2">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${i <= progressStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < progressStep ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : i === progressStep ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !running && (
          <div className="rounded-xl border border-red-500/30 bg-card p-6 text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Не удалось выполнить аудит</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !running && (
          <div className="space-y-10 animate-in fade-in duration-500">
            {/* Overall Score */}
            <div className="rounded-xl border border-border/60 bg-card p-8 flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={result.geoScore} size={140} strokeWidth={10} />
              <div className="flex-1 text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Общий GEO Score</p>
                <p className="text-3xl font-bold text-foreground">
                  {result.geoScore}<span className="text-lg text-muted-foreground font-normal"> / 100</span>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {result.geoScore >= 80 ? 'Отличная оптимизация для AI-поисковиков.' :
                   result.geoScore >= 60 ? 'Есть потенциал для улучшения.' :
                   'Требуется серьёзная доработка.'}
                </p>
                <div className="mt-3">
                  <Button
                    onClick={() => exportGeoAuditDocx({ url: url.trim(), ...result })}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <FileDown className="w-4 h-4" /> Скачать отчёт Word
                  </Button>
                </div>
                <div className="flex items-center gap-4 mt-4 justify-center md:justify-start text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />{passCount} пройдено</span>
                  <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" />{warnCount} внимание</span>
                  <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{failCount} ошибок</span>
                  <span>•</span>
                  <span>{totalChecks} проверок</span>
                </div>
                {/* Stage scores */}
                <div className="flex items-center gap-4 mt-3 justify-center md:justify-start flex-wrap">
                  {result.stages.map(s => (
                    <div key={s.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{s.score}%</span> {s.subtitle}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Main Table */}
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="w-[160px] text-xs font-semibold text-foreground">Этап</TableHead>
                      <TableHead className="w-[200px] text-xs font-semibold text-foreground">Пункт проверки</TableHead>
                      <TableHead className="text-xs font-semibold text-foreground">Что проверять / Критерии</TableHead>
                      <TableHead className="w-[100px] text-xs font-semibold text-foreground text-center">Статус</TableHead>
                      <TableHead className="w-[280px] text-xs font-semibold text-foreground">Примечание / Рекомендация</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.stages.map(stage => (
                      stage.items.map((item, idx) => (
                        <TableRow
                          key={`${stage.id}-${item.id}`}
                          className={`${
                            item.status === 'fail' ? 'bg-red-500/5' :
                            item.status === 'warn' ? 'bg-yellow-500/5' : ''
                          } hover:bg-muted/20`}
                        >
                          {/* Stage column - only show on first row of each stage */}
                          {idx === 0 ? (
                            <TableCell
                              rowSpan={stage.items.length}
                              className="align-top border-r border-border/30 font-medium text-xs"
                            >
                              <div className="space-y-1">
                                <div className="text-foreground font-semibold">{stage.title}</div>
                                <div className="text-muted-foreground">{stage.subtitle}</div>
                                <div className="mt-2">
                                  <span className={`text-lg font-bold ${
                                    stage.score >= 80 ? 'text-green-400' :
                                    stage.score >= 60 ? 'text-yellow-400' : 'text-red-400'
                                  }`}>
                                    {stage.score}%
                                  </span>
                                </div>
                              </div>
                            </TableCell>
                          ) : null}
                          <TableCell className="text-xs font-medium text-foreground">{item.label}</TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">{item.criteria}</TableCell>
                          <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground leading-relaxed">{item.detail}</TableCell>
                        </TableRow>
                      ))
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Criticals */}
            {result.criticals.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-semibold text-foreground">Критические рекомендации (ТОП-5)</h2>
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
            )}

            {/* Strategy */}
            {result.strategy.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Стратегия улучшения — 30–60 дней</h2>
                </div>
                <div className="space-y-3">
                  {result.strategy.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Clock className="w-4 h-4 text-primary/60 mt-0.5 shrink-0" />
                      <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
