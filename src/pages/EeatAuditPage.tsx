import { useState, useEffect, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card } from '@/components/ui/card';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Play, Loader2, FileDown, CheckCircle2, XCircle, MinusCircle, AlertTriangle } from 'lucide-react';
import { exportEeatAuditDocx, type EeatAuditData } from '@/lib/exportEeatAuditDocx';

interface PlanPage { label: string; url: string; title: string; h1: string; }
interface PlanResult { siteType: string; pages: PlanPage[]; missing: string[]; }
interface CollectedPage { label: string; url: string; content: string; error?: string }

type Phase = 'idle' | 'planning' | 'plan' | 'collecting' | 'collected' | 'auditing' | 'done';

function StatusIcon({ status }: { status: string }) {
  const s = (status || '').toLowerCase();
  if (s.startsWith('да')) return <CheckCircle2 className="w-4 h-4 text-green-500" />;
  if (s.startsWith('нет')) return <XCircle className="w-4 h-4 text-red-500" />;
  return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
}

export default function EeatAuditPage() {
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collected, setCollected] = useState<CollectedPage[]>([]);
  const [result, setResult] = useState<EeatAuditData | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (phase === 'done' && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [phase]);

  const isBusy = phase === 'planning' || phase === 'collecting' || phase === 'auditing';

  function invokeFn<T>(body: any): Promise<T> {
    return supabase.functions.invoke<T>('eeat-audit', { body }).then(({ data, error }) => {
      if (error) throw new Error(error.message);
      const d: any = data;
      if (d?.error) throw new Error(d.error);
      return d as T;
    });
  }

  async function startPlan() {
    if (!url.trim()) return;
    setPhase('planning'); setPlan(null); setCollected([]); setResult(null);
    try {
      const out = await invokeFn<PlanResult>({ phase: 'plan', url: url.trim() });
      setPlan(out);
      const sel: Record<string, boolean> = {};
      out.pages.forEach((p) => { sel[p.url] = true; });
      setSelected(sel);
      setPhase('plan');
    } catch (e: any) {
      toast({ title: 'Ошибка планирования', description: e?.message, variant: 'destructive' });
      setPhase('idle');
    }
  }

  async function confirmCollect() {
    if (!plan) return;
    const chosen = plan.pages.filter(p => selected[p.url]);
    if (!chosen.length) { toast({ title: 'Выберите хотя бы одну страницу', variant: 'destructive' }); return; }
    setPhase('collecting');
    try {
      const out = await invokeFn<{ pages: CollectedPage[] }>({ phase: 'collect', pages: chosen.map(p => ({ label: p.label, url: p.url })) });
      setCollected(out.pages);
      setPhase('collected');
    } catch (e: any) {
      toast({ title: 'Ошибка сбора данных', description: e?.message, variant: 'destructive' });
      setPhase('plan');
    }
  }

  async function confirmAudit() {
    if (!plan) return;
    setPhase('auditing');
    try {
      const out = await invokeFn<EeatAuditData>({
        phase: 'audit',
        url: url.trim(),
        siteType: plan.siteType,
        pagesData: collected.filter(p => p.content),
      });
      setResult(out);
      setPhase('done');
    } catch (e: any) {
      toast({ title: 'Ошибка аудита', description: e?.message, variant: 'destructive' });
      setPhase('collected');
    }
  }

  const passCount = result?.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('да')).length ?? 0;
  const failCount = result?.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('нет')).length ?? 0;
  const naCount = result?.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('неп')).length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1200px] py-10 space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Аудит E-E-A-T и Коммерческих факторов
          </h1>
        </div>
        <PageDescription
          className="max-w-4xl mx-auto"
          items={[
            { label: 'Что это', text: 'Комплексная проверка сайта по сигналам E-E-A-T (Опыт, Экспертиза, Авторитетность, Доверие) и коммерческим факторам ранжирования Яндекса и Google.' },
            { label: 'Что проверяем', text: 'Ключевые сервисные страницы (Контакты, О компании, Доставка, Оплата, Гарантии, Сертификаты, Команда, Отзывы), полноту реквизитов и контактов, 76 пунктов базового чек-листа и 5–8 нишевых факторов под тематику сайта.' },
            { label: 'Зачем', text: 'Коммерческие факторы и E-E-A-T напрямую влияют на позиции в поиске, доверие пользователей и конверсию. Аудит показывает, чего не хватает сайту, чтобы поисковики и клиенты считали бизнес надёжным.' },
            { label: 'Результат', text: 'Подробный отчёт в Word с балльной оценкой, расшифровкой по каждому пункту и приоритетными рекомендациями. 3 фазы: планирование, сбор контента, детальная оценка.' },
          ]}
        />

        {/* URL input */}
        <div className="flex gap-3 max-w-xl mx-auto">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="h-11 text-sm bg-card border-border/60"
            disabled={isBusy}
            onKeyDown={e => e.key === 'Enter' && phase === 'idle' && startPlan()}
          />
          <Button
            onClick={startPlan}
            disabled={isBusy || !url.trim()}
            className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 shrink-0"
          >
            {phase === 'planning' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {phase === 'planning' ? 'Поиск страниц...' : 'Запустить аудит'}
          </Button>
        </div>

        {/* PHASE 1: plan */}
        {plan && phase !== 'idle' && phase !== 'planning' && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Шаг 1. Согласование плана</h2>
                <p className="text-xs text-muted-foreground">Тип сайта: <span className="text-foreground font-medium">{plan.siteType}</span></p>
              </div>
              <Button
                onClick={confirmCollect}
                disabled={phase !== 'plan' || isBusy}
                size="sm"
                className="gap-2"
              >
                {phase === 'collecting' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Продолжить → собрать контент
              </Button>
            </div>

            <div className="border border-border/60 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-[180px]">Тип страницы</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>H1 / Title</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.pages.map((p) => (
                    <TableRow key={p.url}>
                      <TableCell>
                        <Checkbox
                          checked={!!selected[p.url]}
                          onCheckedChange={(v) => setSelected(s => ({ ...s, [p.url]: !!v }))}
                          disabled={phase !== 'plan'}
                        />
                      </TableCell>
                      <TableCell className="text-xs font-medium">{p.label}</TableCell>
                      <TableCell className="text-xs">
                        <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">{p.url}</a>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.h1 || p.title || <span className="italic text-yellow-500">не определено</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {plan.missing.length > 0 && (
              <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-yellow-500 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Не найдены целевые страницы:
                </div>
                <div className="text-muted-foreground">{plan.missing.join(', ')}</div>
              </div>
            )}
          </Card>
        )}

        {/* PHASE 2: collected */}
        {collected.length > 0 && (phase === 'collected' || phase === 'auditing' || phase === 'done') && (
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="text-base font-semibold text-foreground">Шаг 2. Подтверждение собранного контента</h2>
                <p className="text-xs text-muted-foreground">
                  Загружено страниц: {collected.filter(p => p.content).length} / {collected.length}.
                  Проверьте, всё ли распарсилось, прежде чем запускать аудит.
                </p>
              </div>
              <Button
                onClick={confirmAudit}
                disabled={phase !== 'collected' || isBusy}
                size="sm"
                className="gap-2"
              >
                {phase === 'auditing' ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Запустить аудит
              </Button>
            </div>

            <div className="border border-border/60 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Страница</TableHead>
                    <TableHead className="w-[100px] text-center">Размер</TableHead>
                    <TableHead>Статус</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {collected.map((p) => (
                    <TableRow key={p.url}>
                      <TableCell className="text-xs font-medium">{p.label}</TableCell>
                      <TableCell className="text-xs text-muted-foreground text-center">{p.content.length.toLocaleString('ru-RU')} симв.</TableCell>
                      <TableCell className="text-xs">
                        {p.content
                          ? <span className="text-green-500">OK</span>
                          : <span className="text-red-500">{p.error || 'Пусто'}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}

        {/* PHASE 3: result */}
        {result && phase === 'done' && (
          <Card ref={resultRef} className="p-6 space-y-6 animate-in fade-in duration-500 scroll-mt-20">
            <div className="sticky top-2 z-20 -mx-6 -mt-6 px-6 py-3 mb-2 bg-card/95 backdrop-blur border-b border-border/60 flex items-center justify-between flex-wrap gap-3 rounded-t-lg">
              <div>
                <h2 className="text-base font-semibold text-foreground">Результаты аудита</h2>
                <p className="text-xs text-muted-foreground">Ниша: {result.niche}</p>
              </div>
              <Button onClick={() => exportEeatAuditDocx(result)} size="sm" className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
                <FileDown className="w-4 h-4" /> Скачать отчёт Word
              </Button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border/60 p-3 text-center">
                <div className="text-2xl font-bold text-foreground">{result.score}</div>
                <div className="text-[11px] uppercase text-muted-foreground tracking-wider mt-1">Общий балл</div>
              </div>
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 text-center">
                <div className="text-2xl font-bold text-green-500">{passCount}</div>
                <div className="text-[11px] uppercase text-muted-foreground tracking-wider mt-1">Да</div>
              </div>
              <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-center">
                <div className="text-2xl font-bold text-red-500">{failCount}</div>
                <div className="text-[11px] uppercase text-muted-foreground tracking-wider mt-1">Нет</div>
              </div>
              <div className="rounded-lg border border-border/60 p-3 text-center">
                <div className="text-2xl font-bold text-muted-foreground">{naCount}</div>
                <div className="text-[11px] uppercase text-muted-foreground tracking-wider mt-1">Неприменимо</div>
              </div>
            </div>

            {result.summary && (
              <div className="rounded-lg border border-border/60 p-4 text-sm text-foreground leading-relaxed">
                {result.summary}
              </div>
            )}

            {result.recommendations.length > 0 && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Топ приоритетных рекомендаций</h3>
                <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside leading-relaxed">
                  {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ol>
              </div>
            )}

            {result.missingPages.length > 0 && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Обязательные страницы, отсутствующие на сайте</h3>
                <div className="text-sm text-muted-foreground">{result.missingPages.join(', ')}</div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Базовый чек-лист ({result.baseChecks.length})</h3>
              <div className="border border-border/60 rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Фактор</TableHead>
                      <TableHead className="w-[120px] text-center">Статус</TableHead>
                      <TableHead>Комментарий</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.baseChecks.map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{c.factor}</TableCell>
                        <TableCell className="text-xs text-center">
                          <span className="inline-flex items-center gap-1.5 justify-center">
                            <StatusIcon status={c.status} />{c.status}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{c.comment || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {result.nicheChecks.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Нишевые E-E-A-T факторы ({result.nicheChecks.length})</h3>
                <div className="border border-border/60 rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Фактор</TableHead>
                        <TableHead className="w-[120px] text-center">Статус</TableHead>
                        <TableHead>Комментарий</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.nicheChecks.map((c, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-xs">{c.factor}</TableCell>
                          <TableCell className="text-xs text-center">
                            <span className="inline-flex items-center gap-1.5 justify-center">
                              <StatusIcon status={c.status} />{c.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.comment || '-'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
}