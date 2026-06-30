import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ArrowDown, ArrowUp, Minus, AlertTriangle, CheckCircle2, Info, Target, Lightbulb, ListChecks, Sparkles } from 'lucide-react';
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

function enrichSeoRecoveryAI(data: any) {
  const base = data?.ai && typeof data.ai === 'object' ? { ...data.ai } : {};
  const n = (v: any) => Number.isFinite(Number(v)) ? Number(v) : 0;
  const pct = (now: number, prev: number) => prev ? Math.round(((now - prev) / prev) * 1000) / 10 : (now ? 100 : 0);
  const ptxt = (v: any) => `${n(v) > 0 ? '+' : ''}${Math.round(n(v) * 10) / 10}%`;
  const ev = (source: string, metric: string, was: any, now: any, delta: any) => ({ source, metric, was: fmt(was), now: fmt(now), delta: ptxt(delta) });
  const metrics = [
    data?.gsc ? { source: 'GSC', metric: 'клики', rawMetric: 'clicks', was: data.gsc.previous?.clicks, now: data.gsc.current?.clicks, delta: data.gsc.delta?.clicks } : null,
    data?.yandex ? { source: 'Yandex', metric: 'клики', rawMetric: 'clicks', was: data.yandex.previous?.clicks, now: data.yandex.current?.clicks, delta: data.yandex.delta?.clicks } : null,
    data?.metrika ? { source: 'Metrika', metric: 'органические визиты', rawMetric: 'organic_visits', was: data.metrika.previous?.organic_visits, now: data.metrika.current?.organic_visits, delta: data.metrika.delta?.organic_visits } : null,
  ].filter(Boolean) as any[];
  const primary = [...metrics].sort((a, b) => Math.abs(n(b.delta)) - Math.abs(n(a.delta)))[0] ?? { source: 'GSC', metric: 'клики', rawMetric: 'clicks', was: 0, now: 0, delta: 0 };
  const direction = n(primary.delta) < -5 ? 'down' : n(primary.delta) > 5 ? 'up' : 'stable';
  const d = data?.diagnostics ?? {};
  const indexing = data?.yandex?.indexing;
  const indexedRows = Array.isArray(indexing?.daily_indexed) ? indexing.daily_indexed : [];
  const indexedStart = indexedRows[0]?.count;
  const indexedEnd = indexedRows[indexedRows.length - 1]?.count;
  const indexedDelta = indexedStart ? pct(n(indexedEnd), n(indexedStart)) : 0;
  const hasIndexingRisk = (n(indexing?.excluded_count) >= 20) || indexedDelta < -5;
  const gLosses = Array.isArray(d.gsc?.lost_queries_by_clicks) ? d.gsc.lost_queries_by_clicks : [];
  const yLosses = Array.isArray(d.yandex?.lost_queries_by_clicks) ? d.yandex.lost_queries_by_clicks : [];
  const queryLosses = (gLosses.length ? gLosses : yLosses).slice(0, 10);
  const pageLosses = [
    ...(Array.isArray(d.gsc?.lost_pages) ? d.gsc.lost_pages.map((p: any) => ({ url: p.url, was: p.clicks_was, now: p.clicks_now, delta_abs: p.delta_abs, delta_pct: p.delta_pct, source: 'GSC' })) : []),
    ...(Array.isArray(d.metrika?.lost_pages) ? d.metrika.lost_pages.map((p: any) => ({ url: p.url, was: p.visits_was, now: p.visits_now, delta_abs: p.delta_abs, delta_pct: p.delta_pct, source: 'Metrika' })) : []),
    ...(Array.isArray(base.lost_pages) ? base.lost_pages.map((p: any) => ({ ...p, delta_abs: n(p.now) - n(p.was) })) : []),
  ].filter((p: any) => p.url).sort((a: any, b: any) => n(a.delta_abs) - n(b.delta_abs));
  const totalLost = Math.abs(n(data?.gsc?.previous?.clicks) - n(data?.gsc?.current?.clicks)) || Math.abs(n(data?.yandex?.previous?.clicks) - n(data?.yandex?.current?.clicks));
  const contributors = [
    ...pageLosses.slice(0, 3).map((p: any) => ({ type: 'page', name: p.url, clicks_lost: Math.abs(n(p.delta_abs)), share_of_loss_pct: totalLost ? Math.round((Math.abs(n(p.delta_abs)) / totalLost) * 1000) / 10 : 0 })),
    ...queryLosses.slice(0, 3).map((q: any) => ({ type: 'query', name: q.query, clicks_lost: Math.abs(n(q.delta_abs)), share_of_loss_pct: totalLost ? Math.round((Math.abs(n(q.delta_abs)) / totalLost) * 1000) / 10 : 0 })),
  ].filter((x: any) => x.name).sort((a, b) => b.clicks_lost - a.clicks_lost).slice(0, 5);

  const hypotheses: any[] = [];
  if (hasIndexingRisk) hypotheses.push({
    hypothesis: 'Техническая проблема индексации могла стать главным драйвером просадки',
    probability: indexedDelta < -5 ? 85 : 75,
    evidence: [...(indexedStart != null && indexedEnd != null ? [ev('Yandex', 'страниц в поиске', indexedStart, indexedEnd, indexedDelta)] : []), ev('Yandex', 'исключённые страницы', 0, indexing?.excluded_count ?? 0, indexing?.excluded_count ? 100 : 0)],
    verification_step: 'Проверить исключённые URL: robots.txt, canonical, meta noindex, HTTP-статус, sitemap и дату последнего изменения шаблона.',
  });
  if (data?.gsc && n(data.gsc.delta?.clicks) < -5) {
    const evidence = [ev('GSC', 'клики', data.gsc.previous?.clicks, data.gsc.current?.clicks, data.gsc.delta?.clicks)];
    if (n(data.gsc.delta?.impressions) < -5) evidence.push(ev('GSC', 'показы', data.gsc.previous?.impressions, data.gsc.current?.impressions, data.gsc.delta?.impressions));
    if (Math.abs(n(data.gsc.delta?.position)) > 0.3) evidence.push(ev('GSC', 'позиция', data.gsc.previous?.position, data.gsc.current?.position, data.gsc.delta?.position));
    hypotheses.push({ hypothesis: n(data.gsc.delta?.impressions) < -10 ? 'Падение видимости в Google: сайт стал реже показываться по части запросов' : 'Падение кликов в Google без сопоставимой потери показов указывает на CTR/сниппеты или SERP-факторы', probability: evidence.length >= 3 ? 85 : evidence.length === 2 ? 65 : 40, evidence, verification_step: 'Открыть топ запросов/страниц с потерей кликов, сравнить title/description, тип сниппета, SERP-фичи и изменения позиций по датам.' });
  }
  if (data?.yandex && n(data.yandex.delta?.clicks) < -5) {
    const evidence = [ev('Yandex', 'клики', data.yandex.previous?.clicks, data.yandex.current?.clicks, data.yandex.delta?.clicks)];
    if (n(data.yandex.delta?.impressions) < -5) evidence.push(ev('Yandex', 'показы', data.yandex.previous?.impressions, data.yandex.current?.impressions, data.yandex.delta?.impressions));
    hypotheses.push({ hypothesis: 'Падение поискового спроса или видимости в Яндексе по группе запросов', probability: evidence.length >= 2 ? 65 : 40, evidence, verification_step: 'Проверить запросы с максимальной потерей в Яндекс.Вебмастере и сопоставить их с изменениями индексации и позиций.' });
  }
  if (data?.metrika && n(data.metrika.delta?.organic_visits) < -5) hypotheses.push({ hypothesis: 'Просадка подтверждается фактическими органическими визитами в Метрике', probability: data.gsc || data.yandex ? 65 : 40, evidence: [ev('Metrika', 'органические визиты', data.metrika.previous?.organic_visits, data.metrika.current?.organic_visits, data.metrika.delta?.organic_visits)], verification_step: 'Сверить дневной график Метрики с датой перелома в GSC/Яндекс.Вебмастере и проверить посадочные страницы с падением визитов.' });
  if (data?.topvisor?.delta && ['top3', 'top10', 'top30'].some((k) => n(data.topvisor.delta?.[k]) < 0)) hypotheses.push({ hypothesis: 'Позиционный фактор: часть запросов вышла из важных TOP-диапазонов', probability: 65, evidence: [ev('Топвизор', 'TOP-3', data.topvisor.previous?.top3, data.topvisor.current?.top3, data.topvisor.delta?.top3), ev('Топвизор', 'TOP-10', data.topvisor.previous?.top10, data.topvisor.current?.top10, data.topvisor.delta?.top10), ev('Топвизор', 'TOP-30', data.topvisor.previous?.top30, data.topvisor.current?.top30, data.topvisor.delta?.top30)], verification_step: 'Проверить потерянные позиции в Топвизоре: какие запросы вышли из TOP-3/TOP-10 и какие URL ранжируются сейчас.' });
  if (!hypotheses.length) hypotheses.push({ hypothesis: 'Единого подтверждённого драйвера по подключённым источникам не видно — требуется ручная проверка событий и качества данных', probability: 40, evidence: [ev(primary.source, primary.metric, primary.was, primary.now, primary.delta)], verification_step: 'Проверить корректность периодов, доступы к источникам, релизы сайта, robots.txt, sitemap и серверные логи за дату перелома.' });

  if (typeof base.seo_score !== 'number') {
    const drops = metrics.map((m) => n(m.delta));
    base.seo_score = drops.some((x) => x <= -35) ? 45 : drops.filter((x) => x <= -20).length >= 2 ? 55 : direction === 'down' ? 65 : direction === 'up' ? 80 : 72;
  }
  if (!base.headline?.summary) base.headline = { direction, main_metric: primary.rawMetric, delta_pct: n(primary.delta), summary: direction === 'down' ? `Органический трафик снизился: ${primary.metric} ${ptxt(primary.delta)}` : direction === 'up' ? `Органический трафик вырос: ${primary.metric} ${ptxt(primary.delta)}` : 'Существенного изменения органического трафика не видно' };
  if (!base.score_reasoning) base.score_reasoning = `Автоматический расчёт по данным источников: ${primary.metric} ${fmt(primary.was)} → ${fmt(primary.now)} (${ptxt(primary.delta)}).`;
  if (!base.main_cause?.title) base.main_cause = { title: hypotheses[0].hypothesis, confidence: n(hypotheses[0].probability) >= 70 ? 'high' : n(hypotheses[0].probability) >= 50 ? 'medium' : 'low', evidence: hypotheses[0].evidence, conclusion: `${hypotheses[0].hypothesis}. Сначала подтвердите гипотезу через топ-потери страниц/запросов и индексацию, затем исправляйте URL с максимальным вкладом в падение.` };
  if (!base.diagnosis_pattern?.code) base.diagnosis_pattern = { code: d.gsc?.signals?.pattern ?? d.yandex?.signals?.pattern ?? (hasIndexingRisk ? 'visibility_loss' : 'mixed'), explanation: hasIndexingRisk ? 'Есть сигнал индексации Яндекса.' : 'Паттерн рассчитан по кликам, показам, CTR, позициям и органическим визитам.' };
  if (!Array.isArray(base.root_cause_hypotheses) || base.root_cause_hypotheses.length === 0) base.root_cause_hypotheses = hypotheses.slice(0, 4);
  if (!Array.isArray(base.causes) || base.causes.length === 0) base.causes = hypotheses.slice(0, 3).map((h) => ({ title: h.hypothesis, confidence: n(h.probability) >= 70 ? 'high' : n(h.probability) >= 50 ? 'medium' : 'low', evidence: h.evidence, conclusion: h.verification_step }));
  if (!base.impact_breakdown?.top_loss_contributors) base.impact_breakdown = { total_clicks_lost: totalLost, top_loss_contributors: contributors };
  if (!Array.isArray(base.lost_pages) || base.lost_pages.length === 0) base.lost_pages = pageLosses.slice(0, 10);
  if (!Array.isArray(base.lost_queries) || base.lost_queries.length === 0) base.lost_queries = queryLosses.map((q: any) => ({ query: q.query, clicks_was: q.clicks_was, clicks_now: q.clicks_now, position_was: q.pos_was, position_now: q.pos_now, diagnosis: n(q.impr_now) < n(q.impr_was) ? 'Падает видимость запроса: проверить позицию, релевантность URL и индексацию.' : 'Показы не просели пропорционально кликам: проверить CTR, сниппет и SERP-фичи.' }));
  if (!Array.isArray(base.recommendations) || base.recommendations.length === 0) base.recommendations = [
    { priority: 'p1', title: hasIndexingRisk ? 'Разобрать исключённые и выпавшие из поиска URL' : 'Разобрать топ страниц и запросов с максимальной потерей', why: contributors[0] ? `Максимальный вклад даёт ${contributors[0].type === 'page' ? 'страница' : 'запрос'} «${contributors[0].name}»: потеря ${fmt(contributors[0].clicks_lost)} кликов.` : `Главный сигнал: ${primary.metric} ${ptxt(primary.delta)}.`, action: hasIndexingRisk ? 'Проверить HTTP-статус, robots.txt, meta robots, canonical, sitemap и внутренние ссылки для исключённых URL.' : 'Проверить первые 5 URL/запросов из вкладок потерь: индексация, интент, title/description, сниппет и посадочная страница.', kpi: { metric: primary.rawMetric, target_delta: '+10–15% за 14 дней' }, ice: { impact: 9, confidence: 7, ease: 6, score: 378 } },
    { priority: 'p2', title: 'Сверить дату перелома с техническими и контентными изменениями', why: 'Нужно подтвердить алгоритмическую гипотезу журналами релизов и дневными графиками.', action: 'Сопоставить день максимальной просадки с деплоями, изменениями шаблонов, robots.txt, sitemap, canonical, редиректами и массовыми правками title/H1.', kpi: { metric: 'clicks', target_delta: 'найти 1–2 подтверждённые причины за 72 часа' }, ice: { impact: 8, confidence: 6, ease: 7, score: 336 } },
    { priority: 'p3', title: 'Собрать план восстановления по группам URL', why: 'Потери часто концентрируются в нескольких шаблонах страниц или кластерах запросов.', action: 'Сгруппировать потерянные URL по типу страницы, интенту и шаблону; для каждой группы зафиксировать baseline и повторно измерить через 2 недели.', kpi: { metric: 'position', target_delta: 'вернуть 30–50% потерянных запросов в прежний TOP-диапазон' }, ice: { impact: 7, confidence: 5, ease: 5, score: 175 } },
  ];
  if (!Array.isArray(base.next_steps) || base.next_steps.length === 0) base.next_steps = ['Проверить дату перелома на графиках и сопоставить с релизами сайта.', 'Проверить индексацию топ URL: robots.txt, canonical, noindex, HTTP-статусы, sitemap.', 'Проверить выдачу вручную по топ потерянным запросам.'];
  if (base.unavailable && (base.root_cause_hypotheses?.length || base.recommendations?.length)) base.unavailable = false;
  return base;
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
  const ai = useMemo(() => enrichSeoRecoveryAI(data), [data]);
  const m = data.metrika;
  const g = data.gsc;
  const y = data.yandex;
  const headline = ai.headline ?? {};
  const aiUnavailable = !!ai?.unavailable;

  return (
    <div className="space-y-6">
      {aiUnavailable && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5">
          <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
            AI-анализ временно недоступен, попробуйте запустить анализ ещё раз.
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Данные источников получены — графики и таблицы ниже доступны.
          </div>
        </Card>
      )}
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
      <DailyChartsTabs gsc={g} yandex={y} metrika={m} topvisor={data.topvisor} topvisorPrev={data.topvisor_prev} />

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

      {/* AI Verdict — общий вывод */}
      <AiVerdictCard ai={ai} gsc={g} yandex={y} metrika={m} period={data.period} />

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
            <HypothesisCard key={`h${i}`} index={i + 1} h={h} />
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
          {(ai.root_cause_hypotheses ?? []).length === 0 && (ai.causes ?? []).length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">
              {aiUnavailable ? "AI-анализ временно недоступен, попробуйте запустить анализ ещё раз." : "Гипотезы не сформированы."}
            </Card>
          )}
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

function AiVerdictCard({ ai, gsc, yandex, metrika, period }: { ai: any; gsc: any; yandex: any; metrika: any; period?: any }) {
  const headline = ai?.headline ?? {};
  const conclusion = ai?.main_cause?.conclusion;
  const reasoning = ai?.score_reasoning;
  // Развёрнутый вывод — только причина + что делать, без дублирования заголовка
  const norm = (s: string) => String(s).toLowerCase().replace(/[.!?\s]+$/g, '').trim();
  const headlineNorm = headline.summary ? norm(headline.summary) : '';
  const verdictParts: string[] = [];
  if (conclusion && norm(conclusion) !== headlineNorm) verdictParts.push(String(conclusion));
  if (verdictParts.length === 0 && reasoning && norm(reasoning) !== headlineNorm) verdictParts.push(String(reasoning));
  const verdict = verdictParts.join(' ');

  const gClicksNow = gsc?.current?.clicks;
  const gClicksPrev = gsc?.previous?.clicks;
  const gClicksDelta = gsc?.delta?.clicks;
  const yClicksNow = yandex?.current?.clicks;
  const yClicksPrev = yandex?.previous?.clicks;
  const yClicksDelta = yandex?.delta?.clicks;
  const mOrgNow = metrika?.current?.organic_visits;
  const mOrgPrev = metrika?.previous?.organic_visits;
  const mOrgDelta = metrika?.delta?.organic_visits;
  const score = ai?.seo_score;

  if (!verdict && score == null) return null;

  const fmtDate = (iso: string) => {
    if (!iso) return '';
    const [y, m, d] = String(iso).split('-');
    return d && m && y ? `${d}.${m}.${y}` : String(iso);
  };

  const sources: string[] = [];
  if (gsc) sources.push('GSC');
  if (yandex) sources.push('Яндекс.Вебмастер');
  if (metrika) sources.push('Метрика');
  const sourceStr = sources.join(' + ') || '—';
  const d1 = fmtDate(period?.current?.date1);
  const d2 = fmtDate(period?.current?.date2);
  const footnote = d1 && d2 ? `Анализ основан на данных ${sourceStr} за период ${d1}–${d2}` : '';

  const pill = (label: string, now: number | undefined, prev: number | undefined, delta: number | undefined, color: string, unit?: string) => {
    const hasNow = now != null && Number.isFinite(now);
    const hasPrev = prev != null && Number.isFinite(prev) && prev > 0;
    if (!hasNow && !hasPrev) return null;
    const showDelta = hasPrev && delta != null && Number.isFinite(delta);
    const neg = showDelta && (delta as number) < 0;
    const pos = showDelta && (delta as number) > 0;
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${color}`}>
        <span className="text-xs uppercase tracking-wide opacity-80">{label}</span>
        {showDelta ? (
          <>
            <span className="font-semibold">{pos ? '+' : ''}{delta}%</span>
            {neg ? <ArrowDown className="w-3.5 h-3.5" /> : pos ? <ArrowUp className="w-3.5 h-3.5" /> : null}
          </>
        ) : (
          <>
            <span className="font-semibold">{hasNow ? Number(now).toLocaleString('ru-RU') : '—'}</span>
            {unit && <span className="text-xs opacity-80">{unit}</span>}
          </>
        )}
      </div>
    );
  };

  return (
    <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-primary" />
        </div>
        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center gap-2 text-xs uppercase text-primary font-medium tracking-wide">
            AI-вывод
          </div>
          {headline.summary && (
            <h3 className="text-xl font-semibold leading-snug">{headline.summary}</h3>
          )}
          {verdict && (
            <p className="text-sm text-muted-foreground leading-relaxed">{verdict}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {pill('Google клики', gClicksNow, gClicksPrev, gClicksDelta, 'bg-[#3B82F6]/10 border-[#3B82F6]/40 text-[#3B82F6]')}
            {pill('Яндекс клики', yClicksNow, yClicksPrev, yClicksDelta, 'bg-[#F97316]/10 border-[#F97316]/40 text-[#F97316]')}
            {pill('Орг. визиты', mOrgNow, mOrgPrev, mOrgDelta, 'bg-[#F97316]/10 border-[#F97316]/40 text-[#F97316]', 'визитов за период')}
            {typeof score === 'number' && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm ${score >= 70 ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-600' : score >= 40 ? 'bg-amber-500/10 border-amber-500/40 text-amber-600' : 'bg-rose-500/10 border-rose-500/40 text-rose-600'}`}>
                <span className="text-xs uppercase tracking-wide opacity-80">SEO Score</span>
                <span className="font-semibold">{score}</span>
              </div>
            )}
          </div>
          {footnote && (
            <div className="text-xs text-muted-foreground pt-2 border-t border-border/50 mt-1">
              {footnote}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function HypothesisCard({ index, h }: { index: number; h: any }) {
  const p: number = Number(h?.probability ?? 0);
  const pColor =
    p >= 70 ? 'bg-rose-500/15 text-rose-600 border-rose-500/40'
    : p >= 40 ? 'bg-amber-500/15 text-amber-600 border-amber-500/40'
    : 'bg-muted text-muted-foreground border-border';
  const dot =
    p >= 70 ? 'bg-rose-500'
    : p >= 40 ? 'bg-amber-500'
    : 'bg-muted-foreground/50';
  const evidence: any[] = Array.isArray(h?.evidence) ? h.evidence : [];
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-md border text-xs font-mono font-semibold ${pColor}`}>
          <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
          P = {p}%
        </span>
        <h4 className="font-semibold text-base flex-1">Гипотеза {index}: {h?.hypothesis}</h4>
      </div>

      {evidence.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-bold uppercase tracking-wide text-foreground mb-2">Доказательства:</div>
          <ul className="space-y-1.5">
            {evidence.map((e: any, i: number) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary mt-1">•</span>
                <span>
                  <span className="font-medium">{ruLabel(e.source)} {e.metric}:</span>{' '}
                  <span className="font-mono">{e.was} → {e.now}</span>{' '}
                  <span className="text-rose-500 font-medium">({e.delta})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {h?.verification_step && (
        <div className="border-l-4 border-[#3B82F6] bg-[#3B82F6]/5 rounded-r px-4 py-3">
          <div className="text-xs font-bold uppercase tracking-wide text-[#3B82F6] mb-1">Как проверить</div>
          <div className="text-sm text-foreground">{h.verification_step}</div>
        </div>
      )}
    </Card>
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

function GoogleDailyChart({ gsc }: { gsc: any }) {
  const [metric, setMetric] = useState<Metric>('clicks');
  const cur = useMemo(() => pickDaily(gsc), [gsc]);
  const prev = useMemo(() => pickDailyPrev(gsc), [gsc]);
  if (cur.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-10">Нет данных GSC по дням</div>;
  }
  const rows = buildSeries(cur, prev, metric, 'gsc');
  const ctrRows = buildSeries(cur, prev, 'ctr', 'gsc');
  const bp = findBreakpoint(rows, 'gsc');
  const yFmt = metric === 'ctr' ? (v: number) => `${v}%` : undefined;
  const tFmt = (v: any) => (metric === 'ctr' ? `${v}%` : v);
  const metrics: { key: Metric; label: string }[] = [
    { key: 'clicks', label: 'Клики' },
    { key: 'impressions', label: 'Показы' },
    { key: 'ctr', label: 'CTR' },
    { key: 'position', label: 'Позиция' },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-1 flex-wrap">
        {metrics.map((mm) => (
          <Button key={mm.key} size="sm" variant={metric === mm.key ? 'default' : 'outline'} onClick={() => setMetric(mm.key)}>{mm.label}</Button>
        ))}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={yFmt as any} reversed={metric === 'position'} />
            <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={tFmt as any} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {bp && metric !== 'position' && (
              <ReferenceLine x={bp.label} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `↓ ${bp.label}`, fill: 'hsl(var(--destructive))', fontSize: 11, position: 'insideBottomRight' }} />
            )}
            <Line type="monotone" dataKey="gsc_current" name="Текущий период" stroke="#3B82F6" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="gsc_previous" name="Предыдущий период" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground mb-2 uppercase">CTR по дням</div>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={ctrRows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={(v) => `${v}%`} />
              <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: any) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="gsc_current" name="CTR текущий" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="gsc_previous" name="CTR предыдущий" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

const CHANNEL_COLORS: Record<string, string> = {
  organic: '#F97316',
  direct: '#10B981',
  ad: '#EF4444',
  social: '#8B5CF6',
  referral: '#06B6D4',
};
const CHANNEL_LABELS: Record<string, string> = {
  organic: 'Органика',
  direct: 'Прямые',
  ad: 'Реклама',
  social: 'Соцсети',
  referral: 'Реферальный',
};

function YandexChannelsChart({ metrika, yandex }: { metrika: any; yandex: any }) {
  const daily: any[] = Array.isArray(metrika?.daily_data)
    ? metrika.daily_data
    : (Array.isArray(metrika?.current?.daily_data) ? metrika.current.daily_data : []);
  const dailyPrev: any[] = Array.isArray(metrika?.daily_data_prev)
    ? metrika.daily_data_prev
    : (Array.isArray(metrika?.previous?.daily_data) ? metrika.previous.daily_data : []);
  if (daily.length === 0 && dailyPrev.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-10">Нет данных по дням</div>;
  }
  const curSorted = [...daily].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const prevSorted = [...dailyPrev].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const len = Math.max(curSorted.length, prevSorted.length);
  const rows = Array.from({ length: len }).map((_, i) => {
    const c = curSorted[i];
    const p = prevSorted[i];
    return {
      date: c?.date ?? p?.date ?? '',
      label: formatDM(c?.date ?? p?.date ?? ''),
      organic_current: c ? Number(c.visits ?? 0) : undefined,
      organic_previous: p ? Number(p.visits ?? 0) : undefined,
    };
  });
  // breakpoint — максимальное падение current vs previous
  let bpIdx = -1, maxDrop = 0;
  rows.forEach((r, i) => {
    if (typeof r.organic_current === 'number' && typeof r.organic_previous === 'number') {
      const d = r.organic_previous - r.organic_current;
      if (d > maxDrop) { maxDrop = d; bpIdx = i; }
    }
  });
  const bpLabel = bpIdx >= 0 ? rows[bpIdx].label : null;
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-muted-foreground">Органический трафик (Яндекс Метрика)</div>
      <div className="h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {bpLabel && (
              <ReferenceLine x={bpLabel} stroke="hsl(var(--destructive))" strokeDasharray="4 4" label={{ value: `↓ ${bpLabel}`, fill: 'hsl(var(--destructive))', fontSize: 11, position: 'insideBottomRight' }} />
            )}
            <Line type="monotone" dataKey="organic_current" name="Органика — текущий период" stroke={CHANNEL_COLORS.organic} strokeWidth={2} dot={false} connectNulls />
            <Line type="monotone" dataKey="organic_previous" name="Органика — предыдущий период" stroke={CHANNEL_COLORS.organic} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BreakdownBar({ rows, color }: { rows: Array<{ name: string; visits: number; pct: number }>; color: string }) {
  if (!rows || rows.length === 0) {
    return <div className="text-sm text-muted-foreground text-center py-10">Нет данных</div>;
  }
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
          <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: any, _n: any, p: any) => [`${v} визитов (${p?.payload?.pct ?? 0}%)`, 'Метрика']} />
          <Bar dataKey="visits" fill={color} radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function YandexPanel({ metrika, yandex }: { metrika: any; yandex: any }) {
  const hasMetrika = !!metrika;
  const hasY = !!yandex;
  if (!hasMetrika && !hasY) {
    return (
      <div className="text-sm text-muted-foreground text-center py-12 px-4">
        Подключите Яндекс Метрику (counter_id) для детального анализа по каналам, устройствам и регионам.
      </div>
    );
  }
  const devices = metrika?.current?.devices ?? [];
  const regions = metrika?.current?.regions ?? [];
  const indexing = yandex?.indexing;
  const hasIndexing = !!indexing && ((indexing.daily_indexed?.length ?? 0) > 0 || (indexing.excluded_count ?? 0) > 0 || (indexing.excluded_pages?.length ?? 0) > 0);
  return (
    <Tabs defaultValue="channels">
      <TabsList>
        <TabsTrigger value="channels">Каналы</TabsTrigger>
        <TabsTrigger value="devices">Устройства</TabsTrigger>
        <TabsTrigger value="regions">Регионы</TabsTrigger>
        <TabsTrigger value="indexing">Индексация</TabsTrigger>
      </TabsList>
      <TabsContent value="channels" className="mt-4">
        <YandexChannelsChart metrika={metrika} yandex={yandex} />
      </TabsContent>
      <TabsContent value="devices" className="mt-4">
        <BreakdownBar rows={devices} color="#F97316" />
      </TabsContent>
      <TabsContent value="regions" className="mt-4">
        <BreakdownBar rows={regions} color="#F97316" />
      </TabsContent>
      <TabsContent value="indexing" className="mt-4">
        {hasIndexing ? <IndexingPanel indexing={indexing} /> : (
          <div className="text-sm text-muted-foreground text-center py-10">Яндекс.Вебмастер не вернул историю индексации за выбранный период.</div>
        )}
      </TabsContent>
    </Tabs>
  );
}

function IndexingPanel({ indexing }: { indexing: { daily_indexed: Array<{ date: string; count: number; added?: number; removed?: number }>; excluded_pages: Array<{ url: string; status: string; date?: string; last_access?: string; target_url?: string; http_status?: number }>; excluded_count: number } }) {
  const rows = (indexing.daily_indexed ?? []).map((r) => ({
    label: r.date,
    count: Number(r.count ?? 0),
    added: Number(r.added ?? 0),
    removed: Number(r.removed ?? 0),
  }));
  const first = rows[0]?.count ?? 0;
  const last = rows[rows.length - 1]?.count ?? 0;
  const delta = first ? Math.round(((last - first) / first) * 1000) / 10 : 0;
  const addedTotal = rows.reduce((s, r) => s + r.added, 0);
  const removedTotal = rows.reduce((s, r) => s + r.removed, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <div className="px-3 py-1.5 rounded-md border bg-card">
          Страниц в поиске: <span className="font-semibold text-foreground">{fmt(last)}</span>
          {first ? <span className="ml-2 text-muted-foreground">({first} → {last}, <Delta value={delta} />)</span> : null}
        </div>
        <div className="px-3 py-1.5 rounded-md border bg-card">
          Исключено страниц: <span className="font-semibold text-rose-500">{fmt(indexing.excluded_count ?? 0)}</span>
        </div>
        <div className="px-3 py-1.5 rounded-md border bg-card">
          Добавлено / удалено: <span className="font-semibold text-emerald-500">+{fmt(addedTotal)}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span className="font-semibold text-rose-500">−{fmt(removedTotal)}</span>
        </div>
      </div>
      {rows.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <defs>
                  <linearGradient id="idxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F97316" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatDM} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: any) => [`${v} стр.`, 'В поиске']} />
                <Area type="monotone" dataKey="count" name="Страниц в поиске" stroke="#F97316" strokeWidth={2} fill="url(#idxGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={formatDM} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} formatter={(v: any, n: any) => [`${v} стр.`, n === 'added' ? 'Добавлено' : 'Удалено']} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="added" name="Добавлено" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="removed" name="Удалено" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {rows.length === 0 && (
        <div className="text-sm text-muted-foreground text-center py-6 border rounded-md bg-muted/20">
          История страниц в поиске не пришла, но ниже могут быть примеры удалённых URL из событий Яндекс.Вебмастера.
        </div>
      )}
      {indexing.excluded_pages?.length > 0 && (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead className="w-[200px]">Причина исключения</TableHead>
                <TableHead className="w-[120px]">Дата</TableHead>
                <TableHead className="w-[120px]">HTTP</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {indexing.excluded_pages.slice(0, 20).map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="font-mono text-xs break-all">{p.url}</TableCell>
                  <TableCell><Badge variant="outline" className="text-rose-500 border-rose-500/40">{p.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.date ?? '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{p.http_status ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function TopvisorPanel({ tv, tvPrev }: { tv: any; tvPrev?: any }) {
  if (!tv) {
    return <div className="text-sm text-muted-foreground text-center py-12 px-4">Подключите Топвизор для динамики позиций по ключевым запросам.</div>;
  }
  const curHist: Array<{ date: string; avg_position: number }> = Array.isArray(tv?.history) ? tv.history : [];
  const prevHist: Array<{ date: string; avg_position: number }> = Array.isArray(tvPrev?.history) ? tvPrev.history : [];
  const len = Math.max(curHist.length, prevHist.length);
  const rows = Array.from({ length: len }).map((_, i) => {
    const c = curHist[i];
    const p = prevHist[i];
    return {
      label: formatDM(c?.date ?? p?.date ?? ''),
      current: c?.avg_position ?? null,
      previous: p?.avg_position ?? null,
    };
  });
  const lost: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = Array.isArray(tv?.lost_positions) ? tv.lost_positions : [];
  const gained: Array<{ query: string; pos_was: number; pos_now: number; delta: number }> = Array.isArray(tv?.gained_positions) ? tv.gained_positions : [];
  const cur = tv?.current ?? null;
  const prv = tv?.previous ?? null;
  const buckets: Array<{ key: 'top1' | 'top3' | 'top10' | 'top30'; label: string }> = [
    { key: 'top1', label: 'ТОП-1' },
    { key: 'top3', label: 'ТОП-3' },
    { key: 'top10', label: 'ТОП-10' },
    { key: 'top30', label: 'ТОП-30' },
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {buckets.map((b) => {
          const curV = cur ? Number(cur[b.key] ?? 0) : Number((tv as any)[b.key] ?? 0);
          const prvV = prv ? Number(prv[b.key] ?? 0) : null;
          const d = prvV != null ? curV - prvV : null;
          const color = d == null ? 'text-muted-foreground' : d < 0 ? 'text-rose-500' : d > 0 ? 'text-emerald-500' : 'text-muted-foreground';
          const arrow = d == null ? '' : d < 0 ? '↓' : d > 0 ? '↑' : '→';
          const sign = d != null && d > 0 ? '+' : '';
          return (
            <Card key={b.key} className="p-4">
              <div className="text-xs text-muted-foreground mb-1">{b.label}</div>
              <div className="flex items-baseline gap-2">
                {prvV != null ? (
                  <div className="text-lg font-medium tabular-nums">
                    <span className="text-muted-foreground">{fmt(prvV)}</span>
                    <span className="text-muted-foreground mx-1">→</span>
                    <span>{fmt(curV)}</span>
                  </div>
                ) : (
                  <div className="text-2xl font-semibold tabular-nums">{fmt(curV)}</div>
                )}
              </div>
              {d != null && (
                <div className={`text-xs mt-1 font-medium ${color}`}>{arrow} {sign}{d}</div>
              )}
            </Card>
          );
        })}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Средняя позиция по дням</div>
        {rows.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-10">Нет данных по дням</div>
        ) : (
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis reversed tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <RTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="current" name="Средняя позиция — текущий" stroke="#8B5CF6" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="previous" name="Средняя позиция — предыдущий" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
      <div className="space-y-2">
        <div className="text-sm font-medium text-muted-foreground">Запросы с наибольшим ухудшением позиций</div>
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Запрос</TableHead>
                <TableHead className="text-right">Было</TableHead>
                <TableHead className="text-right">Стало</TableHead>
                <TableHead className="text-right">Δ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lost.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-6">Существенных потерь по позициям не обнаружено.</TableCell></TableRow>
              ) : lost.map((q, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm">{q.query}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(q.pos_was)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmt(q.pos_now)}</TableCell>
                  <TableCell className="text-right text-rose-500 font-medium">+{fmt(q.delta)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      </div>
      {gained.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-muted-foreground">Запросы с улучшением позиций</div>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Запрос</TableHead>
                  <TableHead className="text-right">Было</TableHead>
                  <TableHead className="text-right">Стало</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gained.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm">{q.query}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(q.pos_was)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmt(q.pos_now)}</TableCell>
                    <TableCell className="text-right text-emerald-500 font-medium">{fmt(q.delta)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      )}
    </div>
  );
}

function DailyChartsTabs({ gsc, yandex, metrika, topvisor, topvisorPrev }: { gsc: any; yandex: any; metrika: any; topvisor?: any; topvisorPrev?: any }) {
  const hasGsc = !!gsc;
  const defaultTab = hasGsc ? 'google' : 'yandex';
  return (
    <Card className="p-4 space-y-3">
      <div className="text-sm font-medium">Динамика по дням</div>
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="google" className="data-[state=active]:border-b-2 data-[state=active]:border-[#3B82F6]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#3B82F6] mr-2" /> Google
          </TabsTrigger>
          <TabsTrigger value="yandex" className="data-[state=active]:border-b-2 data-[state=active]:border-[#F97316]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#F97316] mr-2" /> Яндекс
          </TabsTrigger>
          <TabsTrigger value="topvisor" className="data-[state=active]:border-b-2 data-[state=active]:border-[#8B5CF6]">
            <span className="inline-block w-2 h-2 rounded-full bg-[#8B5CF6] mr-2" /> Топвизор
          </TabsTrigger>
        </TabsList>
        <TabsContent value="google" className="mt-4">
          {hasGsc ? <GoogleDailyChart gsc={gsc} /> : <div className="text-sm text-muted-foreground text-center py-10">Подключите Google Search Console для графиков</div>}
        </TabsContent>
        <TabsContent value="yandex" className="mt-4">
          <YandexPanel metrika={metrika} yandex={yandex} />
        </TabsContent>
        <TabsContent value="topvisor" className="mt-4">
          <TopvisorPanel tv={topvisor} tvPrev={topvisorPrev} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}