import { useState, useEffect, useMemo, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Play, CheckCircle2, AlertTriangle, XCircle, Loader2, Code2, Copy, Download,
  FileCode, Sparkles, ChevronDown, ChevronUp,
} from 'lucide-react';

/* ─── Types ─── */
interface SchemaField { key: string; status: 'ok' | 'missing' | 'warning'; value?: string }
interface FoundSchema {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  raw: any;
  fields: SchemaField[];
  severity: 'ok' | 'warning' | 'critical';
  line?: number;
}
interface Issue {
  severity: 'critical' | 'warning' | 'info';
  schema: string;
  problem: string;
  solution: string;
  seoImpact?: string;
}
interface GeneratedBlock {
  type: string;
  label: string;
  reason: string;
  code: string;
}
interface AuditRow {
  id: string;
  url: string;
  domain: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  overall_score: number;
  found_schemas_count: number;
  errors_count: number;
  schemas_data: FoundSchema[];
  issues: Issue[];
  generated_code: GeneratedBlock[];
  ai_recommendations: any;
  page_type: string;
  error_message?: string;
}

const PROGRESS_STEPS = [
  'Загружаем страницу...',
  'Извлекаем схемы JSON-LD, Microdata, RDFa...',
  'Проверяем обязательные поля...',
  'AI генерирует рекомендации и готовый код...',
];

function scoreColor(score: number): string {
  if (score <= 40) return 'text-red-400';
  if (score <= 70) return 'text-yellow-400';
  return 'text-green-400';
}
function scoreLabel(score: number): string {
  if (score <= 40) return 'Критично';
  if (score <= 70) return 'Требует работы';
  if (score <= 85) return 'Хорошо';
  return 'Отлично';
}
function severityIcon(sev: 'ok' | 'warning' | 'critical') {
  if (sev === 'ok') return <span className="text-green-500">🟢</span>;
  if (sev === 'warning') return <span className="text-yellow-500">🟡</span>;
  return <span className="text-red-500">🔴</span>;
}

/* ─── Schema card ─── */
function SchemaCard({ schema }: { schema: FoundSchema }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {severityIcon(schema.severity)}
        <span className="font-semibold text-foreground">{schema.type}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{schema.format}</span>
        {schema.line ? (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">строка {schema.line}</span>
          </>
        ) : null}
      </div>
      {schema.fields.length > 0 && (
        <div className="space-y-1.5">
          {schema.fields.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">
                <span className="text-foreground">{f.key}</span>
                {f.value ? <span>: "{f.value}"</span> : ':'}
              </span>
              {f.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {f.status === 'missing' && (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  <XCircle className="w-3.5 h-3.5" /> ОТСУТСТВУЕТ
                </span>
              )}
              {f.status === 'warning' && (
                <span className="flex items-center gap-1 text-yellow-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> рекомендуется
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="text-xs text-primary flex items-center gap-1 hover:underline">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Скрыть код' : 'Показать полный код'}
      </button>
      {open && (
        <pre className="bg-muted/40 rounded-md p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
          {JSON.stringify(schema.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ─── Code block with copy ─── */
function CodeBlock({ block }: { block: GeneratedBlock }) {
  const [copied, setCopied] = useState(false);
  const wrapped = `<script type="application/ld+json">\n${block.code}\n</script>`;
  const onCopy = async () => {
    await navigator.clipboard.writeText(wrapped);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{block.label}</span>
          <span className="text-xs text-muted-foreground">— {block.reason}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onCopy} className="h-7 gap-1.5 text-xs">
          <Copy className="w-3 h-3" /> {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </div>
      <pre className="p-4 text-[12px] font-mono text-foreground bg-[hsl(var(--background))] overflow-x-auto leading-relaxed">
{`<script type="application/ld+json">\n${block.code}\n</script>`}
      </pre>
    </div>
  );
}

/* ─── Coverage chips ─── */
function CoverageChips({ schemas }: { schemas: FoundSchema[] }) {
  const checks = ['Organization', 'Product', 'FAQPage', 'BreadcrumbList', 'WebSite', 'LocalBusiness', 'Article'];
  const present = new Set(schemas.map(s => s.type));
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-muted-foreground">Покрытие:</span>
      {checks.map(c => (
        <span key={c} className={`flex items-center gap-1 ${present.has(c) ? 'text-green-400' : 'text-muted-foreground/60'}`}>
          {present.has(c) ? '✓' : '✗'} {c}
        </span>
      ))}
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Code2 className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Проверьте микроразметку сайта</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Найдём JSON-LD, Microdata и RDFa, проверим на ошибки и сгенерируем готовый код
      </p>
      <Button onClick={onStart} className="gap-2 mt-2">
        <Play className="w-4 h-4" /> Начать проверку
      </Button>
    </div>
  );
}

/* ─── TZ generator ─── */
function buildTzMarkdown(audit: AuditRow): string {
  const lines: string[] = [];
  lines.push(`# ТЗ: Внедрение микроразметки`);
  lines.push(`Сайт: ${audit.url} | Дата: ${new Date().toLocaleDateString('ru-RU')} | Балл: ${audit.overall_score}/100`);
  lines.push('');
  const crit = audit.issues.filter(i => i.severity === 'critical');
  const warn = audit.issues.filter(i => i.severity === 'warning');
  const info = audit.issues.filter(i => i.severity === 'info');

  if (crit.length > 0) {
    lines.push(`## 🔴 Критично (сделать первым)`);
    crit.forEach(i => {
      lines.push(`- **${i.schema}**: ${i.problem}`);
      lines.push(`  - Решение: ${i.solution}`);
      if (i.seoImpact) lines.push(`  - SEO-эффект: ${i.seoImpact}`);
    });
    lines.push('');
  }
  if (warn.length > 0) {
    lines.push(`## 🟡 Важно`);
    warn.forEach(i => {
      lines.push(`- **${i.schema}**: ${i.problem}`);
      lines.push(`  - Решение: ${i.solution}`);
    });
    lines.push('');
  }
  if (info.length > 0) {
    lines.push(`## 🔵 Рекомендации`);
    info.forEach(i => {
      lines.push(`- **${i.schema}**: ${i.problem}`);
      lines.push(`  - Решение: ${i.solution}`);
    });
    lines.push('');
  }

  if (audit.generated_code.length > 0) {
    lines.push(`## Готовый код`);
    audit.generated_code.forEach(b => {
      lines.push(`### ${b.label}`);
      lines.push('```html');
      lines.push(`<script type="application/ld+json">`);
      lines.push(b.code);
      lines.push(`</script>`);
      lines.push('```');
      lines.push('');
    });
  }

  lines.push(`## Проверка после внедрения`);
  lines.push(`- Google Rich Results Test: https://search.google.com/test/rich-results`);
  lines.push(`- Schema.org Validator: https://validator.schema.org`);
  lines.push('');
  lines.push(`## Ожидаемый результат`);
  lines.push(`Звёзды рейтинга, цена в сниппете, хлебные крошки`);
  lines.push(`Ожидаемый рост CTR: +15-30%`);
  return lines.join('\n');
}

/* ─── Main page ─── */
export default function SchemaAuditPage() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const codeSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleRun = async () => {
    const target = url.trim();
    if (!target) return;
    setRunning(true);
    setError(null);
    setAudit(null);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep(p => (p < PROGRESS_STEPS.length - 1 ? p + 1 : p));
    }, 2500);

    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Сессия истекла', description: 'Войдите снова', variant: 'destructive' });
        return;
      }

      // Get current project (latest)
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const projectId = projects?.[0]?.id || null;

      const { data, error: fnErr } = await supabase.functions.invoke('schema-audit', {
        body: { url: target, project_id: projectId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      const auditId = data?.audit_id;
      if (!auditId) throw new Error('Не получен ID анализа');

      // Poll
      const started = Date.now();
      while (Date.now() - started < 90_000) {
        const { data: row } = await supabase
          .from('schema_audits')
          .select('*')
          .eq('id', auditId)
          .maybeSingle();
        if (row && (row.status === 'done' || row.status === 'error')) {
          if (row.status === 'error') throw new Error(row.error_message || 'Ошибка анализа');
          setAudit(row as unknown as AuditRow);
          break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e: any) {
      const msg = e?.message || 'Ошибка анализа';
      setError(msg);
      toast({ title: 'Ошибка анализа', description: msg, variant: 'destructive' });
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  };

  const filteredSchemas = useMemo(() => {
    if (!audit) return [];
    if (activeTab === 'all') return audit.schemas_data;
    const map: Record<string, string> = { jsonld: 'JSON-LD', microdata: 'Microdata', rdfa: 'RDFa' };
    return audit.schemas_data.filter(s => s.format === map[activeTab]);
  }, [audit, activeTab]);

  const downloadTz = () => {
    if (!audit) return;
    const md = buildTzMarkdown(audit);
    const blob = new Blob([md], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schema-tz-${audit.domain}-${Date.now()}.md`;
    a.click();
  };

  const scrollToCode = () => codeSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1200px] py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Микроразметка</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Найдём JSON-LD, Microdata и RDFa, проверим на ошибки и сгенерируем готовый код
          </p>
        </div>

        {/* Input panel */}
        <div className="rounded-xl border border-border/60 bg-card p-6 max-w-2xl mx-auto space-y-3">
          <Input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="h-11 text-sm"
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            disabled={running}
          />
          <Button onClick={handleRun} disabled={running || !url.trim()} className="w-full h-11 gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Анализ...' : 'Проверить микроразметку'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Анализируем JSON-LD, Microdata и RDFa • Стоимость: 2 кредита
          </p>
        </div>

        {/* Loading */}
        {running && (
          <div className="flex flex-col items-center gap-6 py-8">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <div className="w-72 space-y-2">
              {PROGRESS_STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-opacity ${i <= progressStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < progressStep ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> :
                   i === progressStep ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" /> :
                   <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && !running && (
          <div className="rounded-xl border border-red-500/30 bg-card p-6 text-center max-w-2xl mx-auto">
            <XCircle className="w-7 h-7 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Не удалось выполнить анализ</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!audit && !running && !error && <EmptyState onStart={() => inputRef.current?.focus()} />}

        {/* Results */}
        {audit && !running && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Общий балл</p>
                <p className={`text-3xl font-bold ${scoreColor(audit.overall_score)}`}>
                  {audit.overall_score}<span className="text-base text-muted-foreground font-normal">/100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{scoreLabel(audit.overall_score)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Найдено схем</p>
                <p className="text-3xl font-bold text-foreground">{audit.found_schemas_count}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Ошибок</p>
                <p className={`text-3xl font-bold ${audit.errors_count > 0 ? 'text-red-400' : 'text-green-400'}`}>{audit.errors_count}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Rich Results</p>
                <p className="text-3xl font-bold text-foreground">
                  Возможно {audit.schemas_data.filter(s => s.severity === 'ok' && ['Product','Article','BlogPosting','FAQPage','BreadcrumbList','LocalBusiness'].includes(s.type)).length}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4">
              <CoverageChips schemas={audit.schemas_data} />
            </div>

            {/* Page data extracted */}
            {audit.ai_recommendations?.pageData && (
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  📊 Обнаружено на странице
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {([
                    ['Компания', audit.ai_recommendations.pageData.companyName],
                    ['Телефон', audit.ai_recommendations.pageData.phone],
                    ['Адрес', audit.ai_recommendations.pageData.address],
                    ['Email', audit.ai_recommendations.pageData.email],
                    ['Цены', audit.ai_recommendations.pageData.priceRange],
                    ['Рейтинг', audit.ai_recommendations.pageData.rating],
                    ['Часы работы', audit.ai_recommendations.pageData.workingHours],
                    ['Описание', audit.ai_recommendations.pageData.description],
                  ] as [string, string | null][]).map(([label, val]) => (
                    <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className={`text-xs truncate max-w-[60%] flex items-center gap-1.5 ${val ? 'text-foreground' : 'text-muted-foreground/50'}`}>
                        {val ? (
                          <>
                            <span className="truncate">{val}</span>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          </>
                        ) : (
                          <>
                            <span>не найдено</span>
                            <XCircle className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Schemas */}
            {audit.schemas_data.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Найденные схемы</h2>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">Все</TabsTrigger>
                    <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
                    <TabsTrigger value="microdata">Microdata</TabsTrigger>
                    <TabsTrigger value="rdfa">RDFa</TabsTrigger>
                  </TabsList>
                  <TabsContent value={activeTab} className="space-y-3 mt-4">
                    {filteredSchemas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Схем этого формата не найдено</p>
                    ) : filteredSchemas.map((s, i) => <SchemaCard key={i} schema={s} />)}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Issues */}
            {audit.issues.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Проблемы и рекомендации</h2>
                {(['critical', 'warning', 'info'] as const).map(sev => {
                  const items = audit.issues.filter(i => i.severity === sev);
                  if (items.length === 0) return null;
                  const config = {
                    critical: { icon: '🔴', title: 'КРИТИЧНО (блокирует Rich Results)', cls: 'border-red-500/20' },
                    warning: { icon: '🟡', title: 'ПРЕДУПРЕЖДЕНИЯ', cls: 'border-yellow-500/20' },
                    info: { icon: '🔵', title: 'РЕКОМЕНДАЦИИ', cls: 'border-blue-500/20' },
                  }[sev];
                  return (
                    <div key={sev} className={`rounded-xl border ${config.cls} bg-card p-5 space-y-3`}>
                      <h3 className="text-sm font-semibold text-foreground">{config.icon} {config.title}</h3>
                      <ul className="space-y-2">
                        {items.map((it, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground shrink-0 mt-0.5">{it.schema}</span>
                            <div className="flex-1">
                              <p>{it.problem}</p>
                              {it.solution && <p className="text-xs text-muted-foreground mt-0.5">{it.solution}</p>}
                              {it.seoImpact && <p className="text-xs text-muted-foreground mt-0.5 italic">Почему важно: {it.seoImpact}</p>}
                            </div>
                            {audit.generated_code.length > 0 && (
                              <button onClick={scrollToCode} className="text-xs text-primary hover:underline shrink-0">Как исправить →</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Generated code */}
            {audit.generated_code.length > 0 && (
              <div ref={codeSectionRef} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Готовый код для вставки в &lt;head&gt;</h2>
                </div>
                <div className="space-y-4">
                  {audit.generated_code.map((b, i) => <CodeBlock key={i} block={b} />)}
                </div>
              </div>
            )}

            {/* TZ download */}
            <div className="rounded-xl border border-border/60 bg-card p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">ТЗ для разработчика</h3>
                <p className="text-xs text-muted-foreground">Полный план внедрения с готовым кодом и инструкциями</p>
              </div>
              <Button onClick={downloadTz} className="gap-2">
                <Download className="w-4 h-4" /> Скачать ТЗ
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}