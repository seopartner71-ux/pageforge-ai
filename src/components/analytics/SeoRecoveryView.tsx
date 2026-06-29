import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDown, ArrowUp, Minus, AlertTriangle, CheckCircle2, Info, Target, Lightbulb, ListChecks } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, ReferenceLine, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';

type Props = { data: any };

function fmt(n: any): string {
  if (n == null) return '—';
  if (typeof n === 'number') return n.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return String(n);
}

function Delta({ value, suffix = '%' }: { value: number; suffix?: string }) {
  if (value === 0 || value == null) return <span className="text-muted-foreground inline-flex items-center gap-1"><Minus className="w-3 h-3" />0{suffix}</span>;
  const positive = value > 0;
  const Icon = positive ? ArrowUp : ArrowDown;
  const color = positive ? 'text-emerald-500' : 'text-rose-500';
  return <span className={`inline-flex items-center gap-1 font-medium ${color}`}><Icon className="w-3 h-3" />{value > 0 ? '+' : ''}{value}{suffix}</span>;
}

function ruLabel(val: string): string {
  const map: Record<string, string> = {
    Yandex: 'Яндекс',
    GSC: 'Google',
    Metrika: 'Метрика',
    query: 'запрос',
    page: 'страница',
  };
  return map[val] ?? val;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 70 ? 'text-emerald-500' : score >= 40 ? 'text-amber-500' : 'text-rose-500';
  const ring = score >= 70 ? 'stroke-emerald-500' : score >= 40 ? 'stroke-amber-500' : 'stroke-rose-500';
  const c = 2 * Math.PI * 42;
  return (
    <div className="relative w-32 h-32 shrink-0">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="42" className="stroke-muted" strokeWidth="8" fill="none" />
        <circle cx="50" cy="50" r="42" className={ring} strokeWidth="8" fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * score) / 100} />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center ${color}`}>
        <div className="text-3xl font-bold">{score}</div>
        <div className="text-[10px] text-muted-foreground uppercase">SEO Score</div>
      </div>
    </div>
  );
}

const confidenceBadge: Record<string, string> = {
  high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  low: 'bg-muted text-muted-foreground',
};

export function SeoRecoveryView({ data }: Props) {
  const ai = data.ai ?? {};
  const m = data.metrika;
  const g = data.gsc;
  const y = data.yandex;
  const headline = ai.headline ?? {};

  return (
    <div className="space-y-6">
      {/* TOP: Score + Headline */}
      <Card className="p-6">
        <div className="flex items-center gap-6 flex-wrap">
          <ScoreRing score={ai.seo_score ?? 50} />
          <div className="flex-1 min-w-[280px] space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase">
              <span>Период:</span>
              <span className="text-foreground">{data.period?.current?.date1} → {data.period?.current?.date2}</span>
              <span>vs</span>
              <span>{data.period?.previous?.date1} → {data.period?.previous?.date2}</span>
            </div>
            <h2 className="text-2xl font-semibold leading-tight" title="Главный тезис на основе данных">
              {headline.summary ?? 'Анализ завершён'}
            </h2>
            <div className="flex items-center gap-3 flex-wrap text-sm">
              {typeof headline.delta_pct === 'number' && <Delta value={headline.delta_pct} />}
              {headline.main_metric && <Badge variant="outline">{headline.main_metric}</Badge>}
              {ai.score_reasoning && <span className="text-muted-foreground">{ai.score_reasoning}</span>}
            </div>
          </div>
        </div>
      </Card>

      {/* Errors */}
      {Array.isArray(data.errors) && data.errors.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <Accordion type="single" collapsible>
            <AccordionItem value="errors" className="border-0">
              <AccordionTrigger className="px-4 py-3 hover:no-underline">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  <span className="font-medium">Ошибка источника данных</span>
                  <Badge variant="outline" className="ml-1 text-[10px]">{data.errors.length}</Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4">
                <div className="space-y-3">
                  {data.errors.map((e: any, i: number) => {
                    const isObj = e && typeof e === 'object';
                    const title = isObj ? (e.title || e.code || 'Ошибка источника данных') : String(e);
                    const hint = isObj ? e.hint : null;
                    const raw = isObj ? e.raw : null;
                    return (
                      <div key={i} className="text-sm space-y-1 border-l-2 border-amber-500/40 pl-3">
                        <div className="font-medium">{title}</div>
                        {hint && <div className="text-muted-foreground">{hint}</div>}
                        {raw && <details className="text-xs text-muted-foreground/70"><summary className="cursor-pointer">Технические детали</summary><pre className="mt-1 whitespace-pre-wrap break-all">{raw}</pre></details>}
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </Card>
      )}

      {/* Metric cards — Google vs Яндекс */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card className="p-4 border-l-4 border-l-[#3B82F6]">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#3B82F6]" /> Google Search Console
          </div>
          {g ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard title="Клики" tooltip="Источник: GSC. Клики из поиска Google." now={g.current.clicks} was={g.previous.clicks} delta={g.delta.clicks} />
              <MetricCard title="Показы" tooltip="Источник: GSC. Показы сайта в выдаче." now={g.current.impressions} was={g.previous.impressions} delta={g.delta.impressions} />
              <MetricCard title="CTR" tooltip="Источник: GSC. Кликабельность." now={typeof g.current.ctr === 'number' ? (g.current.ctr * 100).toFixed(2) : g.current.ctr} was={typeof g.previous.ctr === 'number' ? (g.previous.ctr * 100).toFixed(2) : g.previous.ctr} delta={g.delta.ctr} suffix="%" />
              <MetricCard title="Позиция" tooltip="Источник: GSC. Средняя позиция в выдаче." now={g.current.position?.toFixed?.(1)} was={g.previous.position?.toFixed?.(1)} delta={g.delta.position} suffix="" />
            </div>
          ) : <div className="text-sm text-muted-foreground py-4">Подключите Google Search Console</div>}
        </Card>
        <Card className="p-4 border-l-4 border-l-[#F97316]">
          <div className="text-xs uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-[#F97316]" /> Яндекс (Вебмастер + Метрика)
          </div>
          {(y || m) ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {y && <MetricCard title="Клики" tooltip="Источник: Яндекс.Вебмастер. Клики из поиска Яндекса." now={y.current.clicks} was={y.previous.clicks} delta={y.delta.clicks} />}
              {y && <MetricCard title="Показы" tooltip="Источник: Яндекс.Вебмастер." now={y.current.impressions} was={y.previous.impressions} delta={y.delta.impressions} />}
              {y && <MetricCard title="Позиция" tooltip="Источник: Яндекс.Вебмастер. Средняя позиция." now={y.current.position?.toFixed?.(1)} was={y.previous.position?.toFixed?.(1)} delta={y.delta.position} suffix="" />}
              {m && <MetricCard title="Орг. визиты" tooltip="Источник: Яндекс Метрика. Визиты из поиска." now={m.current.organic_visits} was={m.previous.organic_visits} delta={m.delta.organic_visits} />}
            </div>
          ) : <div className="text-sm text-muted-foreground py-4">Подключите Яндекс.Вебмастер или Метрику</div>}
        </Card>
      </div>

      {/* Daily charts — Google / Яндекс tabs */}
      <DailyChartsTabs gsc={g} yandex={y} metrika={m} />

      {/* Main cause */}
      {ai.main_cause && (
        <Card className="p-6 border-primary/40 bg-primary/5">
          <div className="flex items-center gap-2 mb-3 text-xs uppercase text-primary font-medium">
            <Info className="w-4 h-4" /> Главная причина изменения
          </div>
          <h3 className="text-lg font-semibold mb-2">{ai.main_cause.title}</h3>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <Badge className={confidenceBadge[ai.main_cause.confidence] ?? ''} variant="outline">
              Уверенность: {ai.main_cause.confidence === 'high' ? 'высокая' : ai.main_cause.confidence === 'medium' ? 'средняя' : 'низкая'}
            </Badge>
            {ai.diagnosis_pattern?.code && (
              <Badge variant="outline" className="bg-background">Паттерн: {ai.diagnosis_pattern.code}</Badge>
            )}
          </div>
          {ai.diagnosis_pattern?.explanation && (
            <div className="text-xs text-muted-foreground mb-3 italic">{ai.diagnosis_pattern.explanation}</div>
          )}
          <EvidenceList items={ai.main_cause.evidence ?? []} />
          <div className="text-sm mt-3 text-muted-foreground">{ai.main_cause.conclusion}</div>
        </Card>
      )}

      <Tabs defaultValue="causes">
        <TabsList>
          <TabsTrigger value="causes">Гипотезы</TabsTrigger>
          <TabsTrigger value="impact">Impact</TabsTrigger>
          <TabsTrigger value="pages">Потерянные страницы</TabsTrigger>
          <TabsTrigger value="queries">Запросы</TabsTrigger>
          <TabsTrigger value="recs">План действий</TabsTrigger>
          <TabsTrigger value="next">Ручные проверки</TabsTrigger>
          <TabsTrigger value="raw">Данные</TabsTrigger>
        </TabsList>

        <TabsContent value="causes" className="space-y-3 mt-4">
          {(ai.root_cause_hypotheses ?? []).map((h: any, i: number) => (
            <Card key={`h${i}`} className="p-4">
              <div className="flex items-center justify-between mb-2 gap-3">
                <h4 className="font-medium flex items-center gap-2"><Lightbulb className="w-4 h-4 text-amber-500" />{h.hypothesis}</h4>
                <Badge variant="outline" className="font-mono">P = {h.probability}%</Badge>
              </div>
              <EvidenceList items={h.evidence ?? []} />
              {h.verification_step && (
                <div className="text-sm mt-2 p-2 rounded bg-muted/40 border-l-2 border-primary/60">
                  <span className="text-xs uppercase text-muted-foreground mr-2">Как проверить:</span>{h.verification_step}
                </div>
              )}
            </Card>
          ))}
          {(ai.causes ?? []).map((c: any, i: number) => (
            <Card key={i} className="p-4">
              <div className="flex items-center justify-between mb-2 gap-3">
                <h4 className="font-medium">{c.title}</h4>
                <Badge variant="outline" className={confidenceBadge[c.confidence] ?? ''}>
                  {c.confidence === 'high' ? 'высокая' : c.confidence === 'medium' ? 'средняя' : 'низкая'}
                </Badge>
              </div>
              <EvidenceList items={c.evidence ?? []} />
              <div className="text-sm mt-2 text-muted-foreground">{c.conclusion}</div>
            </Card>
          ))}
          {(ai.root_cause_hypotheses ?? []).length === 0 && (ai.causes ?? []).length === 0 && <Card className="p-6 text-sm text-muted-foreground">Гипотезы не сформированы.</Card>}
        </TabsContent>

        <TabsContent value="impact" className="mt-4 space-y-3">
          {ai.impact_breakdown ? (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-primary" />
                <div className="text-sm">Всего потеряно кликов: <b>{fmt(ai.impact_breakdown.total_clicks_lost)}</b></div>
              </div>
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Тип</TableHead><TableHead>Объект</TableHead><TableHead className="text-right">Потеря кликов</TableHead><TableHead className="text-right">Доля</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {(ai.impact_breakdown.top_loss_contributors ?? []).map((c: any, i: number) => (
                    <TableRow key={i}>
                      <TableCell><Badge variant="outline">{ruLabel(c.type)}</Badge></TableCell>
                      <TableCell className="font-mono text-xs max-w-[420px] truncate">{c.name}</TableCell>
                      <TableCell className="text-right text-rose-500">−{fmt(c.clicks_lost)}</TableCell>
                      <TableCell className="text-right font-medium">{c.share_of_loss_pct}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          ) : <Card className="p-6 text-sm text-muted-foreground">Декомпозиция потерь недоступна.</Card>}
          {ai.brand_analysis && (
            <Card className="p-4">
              <div className="text-xs uppercase text-muted-foreground mb-2">Бренд vs небренд</div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded bg-muted/40"><div className="text-xs text-muted-foreground">Brand-клики</div><Delta value={ai.brand_analysis.brand_clicks_delta_pct ?? 0} /></div>
                <div className="p-3 rounded bg-muted/40"><div className="text-xs text-muted-foreground">Non-brand-клики</div><Delta value={ai.brand_analysis.non_brand_clicks_delta_pct ?? 0} /></div>
              </div>
              {ai.brand_analysis.interpretation && <div className="text-sm text-muted-foreground mt-3">{ai.brand_analysis.interpretation}</div>}
            </Card>
          )}
        </TabsContent>

        <TabsContent value="pages" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>URL</TableHead>
                  <TableHead className="text-right">Было</TableHead>
                  <TableHead className="text-right">Стало</TableHead>
                  <TableHead className="text-right">Изменение</TableHead>
                  <TableHead>Источник</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ai.lost_pages ?? []).map((p: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs max-w-[400px] truncate">{p.url}</TableCell>
                    <TableCell className="text-right">{fmt(p.was)}</TableCell>
                    <TableCell className="text-right">{fmt(p.now)}</TableCell>
                    <TableCell className="text-right"><Delta value={p.delta_pct} /></TableCell>
                    <TableCell><Badge variant="outline">{ruLabel(p.source)}</Badge></TableCell>
                  </TableRow>
                ))}
                {(ai.lost_pages ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">Существенных потерь по страницам не обнаружено.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="queries" className="mt-4">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Запрос</TableHead>
                  <TableHead className="text-right">Клики (было/стало)</TableHead>
                  <TableHead className="text-right">Позиция (было/стало)</TableHead>
                  <TableHead>Диагноз</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(ai.lost_queries ?? []).map((q: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>{q.query}</TableCell>
                    <TableCell className="text-right">{fmt(q.clicks_was)} → {fmt(q.clicks_now)}</TableCell>
                    <TableCell className="text-right">{fmt(q.position_was)} → {fmt(q.position_now)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[300px]">{q.diagnosis}</TableCell>
                  </TableRow>
                ))}
                {(ai.lost_queries ?? []).length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Данных по запросам нет.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="recs" className="space-y-3 mt-4">
          {(ai.recommendations ?? []).map((r: any, i: number) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <Badge variant={r.priority === 'p1' ? 'destructive' : 'outline'}>{r.priority?.toUpperCase()}</Badge>
                <h4 className="font-medium flex-1">{r.title}</h4>
                {r.ice?.score != null && (
                  <Badge variant="outline" className="font-mono" title={`Impact ${r.ice.impact} · Confidence ${r.ice.confidence} · Ease ${r.ice.ease}`}>
                    ICE: {r.ice.score}
                  </Badge>
                )}
              </div>
              <div className="text-sm text-muted-foreground mb-1"><b className="text-foreground">Почему:</b> {r.why}</div>
              <div className="text-sm mb-2"><b>Действие:</b> {r.action}</div>
              {r.kpi && (
                <div className="text-xs flex items-center gap-2 mt-2 p-2 rounded bg-primary/5 border border-primary/20">
                  <Target className="w-3.5 h-3.5 text-primary" />
                  <span className="uppercase text-muted-foreground">KPI:</span>
                  <span className="font-mono">{r.kpi.metric}</span>
                  <span className="text-foreground font-medium">{r.kpi.target_delta}</span>
                </div>
              )}
            </Card>
          ))}
          {(ai.recommendations ?? []).length === 0 && <Card className="p-6 text-sm text-muted-foreground">Рекомендации не сформированы.</Card>}
        </TabsContent>

        <TabsContent value="next" className="mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium"><ListChecks className="w-4 h-4 text-primary" />Что проверить вручную</div>
            {Array.isArray(ai.next_steps) && ai.next_steps.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {ai.next_steps.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 p-2 rounded bg-muted/40">
                    <span className="text-primary mt-0.5">→</span><span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : <div className="text-sm text-muted-foreground">Дополнительных ручных проверок не требуется.</div>}
          </Card>
        </TabsContent>

        <TabsContent value="raw" className="mt-4">
          <Card className="p-4">
            <pre className="text-xs overflow-auto max-h-[500px]">{JSON.stringify({ metrika: m, gsc: g, diagnostics: data.diagnostics }, null, 2)}</pre>
          </Card>
        </TabsContent>
      </Tabs>

      {Array.isArray(ai.timeline_notes) && ai.timeline_notes.length > 0 && (
        <Card className="p-4">
          <div className="text-xs uppercase text-muted-foreground mb-2">Заметки по timeline</div>
          <ul className="space-y-1 text-sm">{ai.timeline_notes.map((n: string, i: number) => <li key={i}>• {n}</li>)}</ul>
        </Card>
      )}
    </div>
  );
}

function MetricCard({ title, tooltip, now, was, delta, suffix }: { title: string; tooltip: string; now: any; was: any; delta: number; suffix?: string }) {
  const wasNum = typeof was === 'number' ? was : Number(was);
  const noPrev = !Number.isFinite(wasNum) || wasNum === 0;
  return (
    <Card className="p-4" title={tooltip}>
      <div className="text-xs text-muted-foreground mb-1">{title}</div>
      <div className="text-xl font-semibold">{fmt(now)}</div>
      {noPrev ? (
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
          <span>—</span>
          <span className="italic">нет данных за прошлый период</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1 text-xs">
          <span className="text-muted-foreground">было {fmt(was)}</span>
          <Delta value={delta} suffix={suffix ?? '%'} />
        </div>
      )}
    </Card>
  );
}

function EvidenceList({ items }: { items: any[] }) {
  if (!items.length) return null;
  return (
    <div className="space-y-1 text-sm">
      {items.map((e, i) => (
        <div key={i} className="flex items-start gap-2 p-2 rounded bg-muted/40">
          <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <div>
            <Badge variant="outline" className="mr-2 text-[10px]">{ruLabel(e.source)}</Badge>
            <span className="font-medium">{e.metric}:</span>{' '}
            <span className="text-muted-foreground">{e.was} → {e.now}</span>{' '}
            <span className="text-foreground">({e.delta})</span>
          </div>
        </div>
      ))}
    </div>
  );
}

type Metric = 'clicks' | 'impressions' | 'ctr' | 'position';

function formatDM(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = String(iso).split('-');
  if (!d) return String(iso);
  return `${d}.${m}`;
}

function pickDaily(src: any): Array<{ date: string; clicks?: number; impressions?: number; position?: number }> {
  if (!src) return [];
  const arr = src.daily_data ?? src.daily ?? src.current?.daily_data ?? src.current?.daily ?? src.by_date ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((r: any) => ({
    date: r.date ?? r.day ?? r.dt ?? r.d,
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? r.shows ?? 0),
    position: r.position != null ? Number(r.position) : undefined,
  })).filter((r: any) => r.date);
}

function pickDailyPrev(src: any): Array<{ date: string; clicks?: number; impressions?: number; position?: number }> {
  if (!src) return [];
  const arr = src.previous_daily_data ?? src.previous_daily ?? src.previous?.daily_data ?? src.previous?.daily ?? src.by_date_previous ?? [];
  if (!Array.isArray(arr)) return [];
  return arr.map((r: any) => ({
    date: r.date ?? r.day ?? r.dt ?? r.d,
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? r.shows ?? 0),
    position: r.position != null ? Number(r.position) : undefined,
  })).filter((r: any) => r.date);
}

function valueByMetric(row: any, metric: Metric): number | null {
  if (!row) return null;
  if (metric === 'clicks') return row.clicks ?? 0;
  if (metric === 'impressions') return row.impressions ?? 0;
  if (metric === 'ctr') {
    const i = row.impressions ?? 0;
    return i > 0 ? Math.round(((row.clicks ?? 0) / i) * 10000) / 100 : 0;
  }
  if (metric === 'position') return row.position ?? null;
  return null;
}

function buildSeries(currentRows: any[], previousRows: any[], metric: Metric, prefix: string) {
  // Align by index of day in the period (1..N) so two periods overlay on same X axis using current dates as labels.
  const len = Math.max(currentRows.length, previousRows.length);
  const out: any[] = [];
  for (let i = 0; i < len; i++) {
    const cur = currentRows[i];
    const prev = previousRows[i];
    out.push({
      idx: i,
      label: cur ? formatDM(cur.date) : prev ? formatDM(prev.date) : '',
      currentDate: cur?.date,
      previousDate: prev?.date,
      [`${prefix}_current`]: valueByMetric(cur, metric),
      [`${prefix}_previous`]: valueByMetric(prev, metric),
    });
  }
  return out;
}

function findBreakpoint(rows: any[], prefix: string): { idx: number; label: string } | null {
  let maxDrop = 0;
  let idx = -1;
  for (let i = 0; i < rows.length; i++) {
    const c = rows[i][`${prefix}_current`];
    const p = rows[i][`${prefix}_previous`];
    if (typeof c === 'number' && typeof p === 'number') {
      const drop = p - c;
      if (drop > maxDrop) { maxDrop = drop; idx = i; }
    }
  }
  if (idx < 0) return null;
  return { idx, label: rows[idx]?.label };
}

function DailyCharts({ gsc, yandex }: { gsc: any; yandex: any }) {
  const [metric, setMetric] = useState<Metric>('clicks');

  const gscCur = useMemo(() => pickDaily(gsc), [gsc]);
  const gscPrev = useMemo(() => pickDailyPrev(gsc), [gsc]);
  const yCur = useMemo(() => pickDaily(yandex), [yandex]);
  const yPrev = useMemo(() => pickDailyPrev(yandex), [yandex]);

  const hasGsc = gscCur.length > 0;
  const hasY = yCur.length > 0;

  if (!hasGsc && !hasY) {
    return (
      <Card className="p-6 text-sm text-muted-foreground text-center">
        Детальные данные по дням недоступны
      </Card>
    );
  }

  // Merge by index — use whichever source has more points as the baseline length
  const len = Math.max(gscCur.length, gscPrev.length, yCur.length, yPrev.length);
  const merged: any[] = [];
  for (let i = 0; i < len; i++) {
    const gc = gscCur[i], gp = gscPrev[i], yc = yCur[i], yp = yPrev[i];
    merged.push({
      idx: i,
      label: formatDM(gc?.date || yc?.date || gp?.date || yp?.date || ''),
      gsc_current: hasGsc ? valueByMetric(gc, metric) : null,
      gsc_previous: hasGsc ? valueByMetric(gp, metric) : null,
      yandex_current: hasY ? valueByMetric(yc, metric) : null,
      yandex_previous: hasY ? valueByMetric(yp, metric) : null,
    });
  }

  // CTR series for separate chart (always shown when impressions available)
  const ctrMerged: any[] = [];
  for (let i = 0; i < len; i++) {
    const gc = gscCur[i], gp = gscPrev[i], yc = yCur[i], yp = yPrev[i];
    ctrMerged.push({
      idx: i,
      label: formatDM(gc?.date || yc?.date || gp?.date || yp?.date || ''),
      gsc_current: hasGsc ? valueByMetric(gc, 'ctr') : null,
      gsc_previous: hasGsc ? valueByMetric(gp, 'ctr') : null,
      yandex_current: hasY ? valueByMetric(yc, 'ctr') : null,
      yandex_previous: hasY ? valueByMetric(yp, 'ctr') : null,
    });
  }

  // Breakpoint based on primary source (gsc preferred)
  const breakSrc = hasGsc ? 'gsc' : 'yandex';
  const breakpoint = findBreakpoint(merged, breakSrc);

  const yAxisFormatter = metric === 'ctr' ? (v: number) => `${v}%` : undefined;
  const tooltipFormatter = (v: any) => (metric === 'ctr' ? `${v}%` : v);

  const metrics: { key: Metric; label: string }[] = [
    { key: 'clicks', label: 'Клики' },
    { key: 'impressions', label: 'Показы' },
    { key: 'ctr', label: 'CTR' },
    { key: 'position', label: 'Позиция' },
  ];

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="text-sm font-medium">Динамика по дням</div>
        <div className="flex items-center gap-1">
          {metrics.map((mm) => (
            <Button key={mm.key} size="sm" variant={metric === mm.key ? 'default' : 'outline'} onClick={() => setMetric(mm.key)}>
              {mm.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={yAxisFormatter as any} reversed={metric === 'position'} />
            <RTooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
              formatter={tooltipFormatter as any}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {breakpoint && metric !== 'position' && (
              <ReferenceLine x={breakpoint.label} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `↓ ${breakpoint.label}`, fill: 'hsl(var(--destructive))', fontSize: 11, position: 'insideBottomRight' }} />
            )}
            {hasGsc && <Line type="monotone" dataKey="gsc_current" name="Google текущий период" stroke="#3B82F6" strokeWidth={2} dot={false} />}
            {hasGsc && <Line type="monotone" dataKey="gsc_previous" name="Google предыдущий период" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
            {hasY && <Line type="monotone" dataKey="yandex_current" name="Яндекс · текущий" stroke="#EF4444" strokeWidth={2} dot={false} />}
            {hasY && <Line type="monotone" dataKey="yandex_previous" name="Яндекс · предыдущий" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="pt-2 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2 uppercase">CTR по дням</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ctrMerged} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}%`} />
              <RTooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                formatter={(v: any) => `${v}%`}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {hasGsc && <Line type="monotone" dataKey="gsc_current" name="CTR текущий период" stroke="#3B82F6" strokeWidth={2} dot={false} />}
              {hasGsc && <Line type="monotone" dataKey="gsc_previous" name="CTR предыдущий период" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
              {hasY && <Line type="monotone" dataKey="yandex_current" name="Яндекс CTR · текущий" stroke="#EF4444" strokeWidth={2} dot={false} />}
              {hasY && <Line type="monotone" dataKey="yandex_previous" name="Яндекс CTR · предыдущий" stroke="#CBD5E1" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}