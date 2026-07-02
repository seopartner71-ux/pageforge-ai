import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CalendarRange, Compass, Layers, Clock, Globe2, AlertTriangle,
  CalendarDays, TrendingUp, Sparkles, ArrowRight, Target, Bot,
} from 'lucide-react';

export type SeasonalityData = any;

const LEVEL_TONE: Record<string, string> = {
  none: 'bg-muted text-muted-foreground border-border',
  low: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  'very-high': 'bg-rose-600/20 text-rose-500 border-rose-600/40',
};
const VAL_TONE: Record<string, string> = {
  High: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  Med: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  Low: 'bg-muted text-muted-foreground border-border',
};
const MODEL_TONE: Record<string, string> = {
  'evergreen-first': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'seasonal-first': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  hybrid: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
};

function arr<T = any>(x: any): T[] { return Array.isArray(x) ? x : []; }

function Section({ icon: Icon, title, children, subtitle }: any) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Icon className="w-4 h-4 text-primary" /> {title}
        </h3>
        {subtitle && <span className="text-[11px] text-muted-foreground">{subtitle}</span>}
      </div>
      {children}
    </Card>
  );
}

function KV({ k, v }: { k: string; v: any }) {
  if (v === null || v === undefined || v === '') return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k}</div>
      <div className="text-sm text-foreground mt-1">{String(v)}</div>
    </div>
  );
}

function List({ items }: { items: any[] }) {
  const xs = arr(items).filter(Boolean);
  if (!xs.length) return <div className="text-xs text-muted-foreground">—</div>;
  return (
    <ul className="space-y-1.5">
      {xs.map((it, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-foreground">
          <ArrowRight className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
          <span>{String(it)}</span>
        </li>
      ))}
    </ul>
  );
}

function MonthlyChart({ data }: { data: any[] }) {
  const items = arr(data);
  if (!items.length) return null;
  const max = Math.max(...items.map((x) => Number(x?.intensity) || 0), 1);
  return (
    <div className="flex items-end gap-2 h-40">
      {items.map((x, i) => {
        const v = Number(x?.intensity) || 0;
        const h = Math.max(4, (v / max) * 100);
        const tone = v >= 75 ? 'bg-rose-500' : v >= 50 ? 'bg-amber-500' : v >= 25 ? 'bg-blue-500' : 'bg-muted-foreground/40';
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted-foreground">{v}</div>
            <div className={`w-full rounded-t ${tone} transition-all`} style={{ height: `${h}%` }} />
            <div className="text-[10px] text-muted-foreground">{x?.month || ''}</div>
          </div>
        );
      })}
    </div>
  );
}

export function DemandSeasonalityView({ data }: { data: SeasonalityData }) {
  const v = data?.executive_verdict || {};
  return (
    <div className="space-y-6">
      {/* Executive verdict */}
      <Section icon={Sparkles} title="Executive verdict">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={LEVEL_TONE[v.overall_seasonality] || ''}>
            Сезонность: {v.overall_seasonality || '—'}
          </Badge>
          <Badge variant="outline">Предсказуемость: {v.predictability || '—'}</Badge>
          <Badge variant="outline">
            Сильные пики: {v.has_strong_peaks ? 'да' : 'нет'}
          </Badge>
          <Badge variant="outline" className={MODEL_TONE[v.planning_model] || ''}>
            Модель: {v.planning_model || '—'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KV k="Основной риск" v={v.main_risk} />
          <KV k="Главная возможность" v={v.main_opportunity} />
        </div>
        {v.verdict_summary && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground leading-relaxed">
            {v.verdict_summary}
          </div>
        )}
      </Section>

      {/* Monthly intensity */}
      <Section icon={CalendarDays} title="Интенсивность спроса по месяцам" subtitle="0–100">
        <MonthlyChart data={data?.monthly_intensity} />
      </Section>

      {/* Segments */}
      <Section icon={Compass} title="Карта сезонности по сегментам">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {arr(data?.seasonality_map_by_segment).map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground">{s.segment}</div>
                <Badge variant="outline" className="text-[10px]">{s.seasonality_type}</Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={VAL_TONE[s.seo_value]}>SEO: {s.seo_value}</Badge>
                <Badge variant="outline" className={VAL_TONE[s.business_value]}>Бизнес: {s.business_value}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Интент: <span className="text-foreground">{s.intent}</span></div>
              <div className="text-xs text-muted-foreground">Пики: <span className="text-foreground">{s.peak_periods}</span></div>
              <div className="text-xs text-muted-foreground">Спад: <span className="text-foreground">{s.decline_periods}</span></div>
              {!!arr(s.queries).length && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {arr(s.queries).slice(0, 6).map((q: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[10px] font-normal">{q}</Badge>
                  ))}
                </div>
              )}
              {s.comment && <div className="text-xs text-muted-foreground leading-relaxed pt-1">{s.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Time-based map */}
      <Section icon={Clock} title="Временная карта: pre-season → peak → off-season">
        <div className="space-y-3">
          {arr(data?.time_based_map).map((t: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="text-sm font-semibold text-foreground">{t.cluster}</div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <KV k="Pre-season" v={t.pre_season} />
                <KV k="Growth" v={t.growth_phase} />
                <KV k="Peak" v={t.peak} />
                <KV k="Decline" v={t.decline} />
                <KV k="Off-season" v={t.off_season} />
              </div>
              {t.secondary_peak && <div className="text-xs text-muted-foreground">Вторичный пик: <span className="text-foreground">{t.secondary_peak}</span></div>}
              {t.comment && <div className="text-xs text-muted-foreground leading-relaxed">{t.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Intent */}
      <Section icon={Target} title="Сезонность по интентам">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.seasonality_by_intent).map((it: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{it.intent}</div>
                <Badge variant="outline" className={VAL_TONE[it.seasonality_strength]}>{it.seasonality_strength}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Рост: <span className="text-foreground">{it.growth_starts}</span></div>
              <div className="text-xs text-muted-foreground">Пик конверсии: <span className="text-foreground">{it.conversion_peak}</span></div>
              <div className="text-xs text-muted-foreground">Лучший тип страниц: <span className="text-foreground">{it.best_page_type}</span></div>
              {it.comment && <div className="text-xs text-muted-foreground leading-relaxed">{it.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* External drivers */}
      <Section icon={TrendingUp} title="Внешние факторы">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.external_drivers).map((d: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground">{d.factor}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={VAL_TONE[d.impact_strength]}>{d.impact_strength}</Badge>
                  <Badge variant="outline" className="text-[10px]">{d.recurrence}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Кластеры: <span className="text-foreground">{d.affected_clusters}</span></div>
              <div className="text-xs text-muted-foreground">Как использовать: <span className="text-foreground">{d.how_to_use}</span></div>
              {d.comment && <div className="text-xs text-muted-foreground leading-relaxed">{d.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Signal vs noise */}
      <Section icon={AlertTriangle} title="Сигнал vs шум">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.signal_vs_noise).map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="text-sm font-semibold text-foreground">{s.pattern}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{s.classification}</Badge>
                <Badge variant="outline" className="text-[10px]">{s.action}</Badge>
              </div>
              {s.comment && <div className="text-xs text-muted-foreground leading-relaxed">{s.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Evergreen vs seasonal */}
      <Section icon={Layers} title="Evergreen core vs Seasonal layers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold text-emerald-500 mb-2">Evergreen core</div>
            <List items={data?.evergreen_vs_seasonal?.evergreen_core} />
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="text-xs font-semibold text-amber-500 mb-2">Seasonal support</div>
            <List items={data?.evergreen_vs_seasonal?.seasonal_support} />
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="text-xs font-semibold text-blue-500 mb-2">Event pages</div>
            <List items={data?.evergreen_vs_seasonal?.event_pages} />
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="text-xs font-semibold text-violet-500 mb-2">Annual refresh</div>
            <List items={data?.evergreen_vs_seasonal?.annual_refresh} />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-foreground mb-2">Opportunistic trend pages</div>
            <List items={data?.evergreen_vs_seasonal?.opportunistic_trend} />
          </div>
        </div>
        {data?.evergreen_vs_seasonal?.architecture_comment && (
          <div className="text-xs text-muted-foreground leading-relaxed">{data.evergreen_vs_seasonal.architecture_comment}</div>
        )}
      </Section>

      {/* Lead time */}
      <Section icon={Clock} title="Lead time рекомендации">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Кластер</th>
                <th className="py-2 pr-3 font-medium">Публиковать</th>
                <th className="py-2 pr-3 font-medium">Обновлять</th>
                <th className="py-2 pr-3 font-medium">Internal linking</th>
                <th className="py-2 pr-3 font-medium">CTA</th>
                <th className="py-2 pr-3 font-medium">Ожидаемый эффект</th>
              </tr>
            </thead>
            <tbody>
              {arr(data?.lead_time).map((r: any, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground font-medium">{r.cluster}</td>
                  <td className="py-2 pr-3">{r.publish_window}</td>
                  <td className="py-2 pr-3">{r.update_window}</td>
                  <td className="py-2 pr-3">{r.internal_linking_window}</td>
                  <td className="py-2 pr-3">{r.cta_window}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.expected_effect}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Geo */}
      {!!arr(data?.geo_differences).length && (
        <Section icon={Globe2} title="Различия по гео">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr(data?.geo_differences).map((g: any, i: number) => (
              <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-foreground">{g.geo}</div>
                  <Badge variant="outline" className="text-[10px]">
                    {g.needs_local_adaptation ? 'локализация нужна' : 'без адаптации'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">Сдвиг: <span className="text-foreground">{g.shift}</span></div>
                <div className="text-xs text-muted-foreground">Отличающиеся темы: <span className="text-foreground">{g.different_topics}</span></div>
                {g.comment && <div className="text-xs text-muted-foreground leading-relaxed">{g.comment}</div>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Risks */}
      <Section icon={AlertTriangle} title="Риски seasonal SEO">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.risks).map((r: any, i: number) => (
            <div key={i} className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{r.risk}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={VAL_TONE[r.probability]}>P: {r.probability}</Badge>
                  <Badge variant="outline" className={VAL_TONE[r.impact]}>I: {r.impact}</Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Предотвращение: <span className="text-foreground">{r.prevention}</span></div>
              <div className="text-xs text-muted-foreground">Что делать вместо: <span className="text-foreground">{r.do_instead}</span></div>
            </div>
          ))}
        </div>
      </Section>

      {/* Editorial calendar */}
      <Section icon={CalendarRange} title="Editorial calendar">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-xs font-semibold text-foreground mb-2">Ближайшие 30 дней</div>
            <List items={data?.editorial_calendar?.next_30_days} />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-xs font-semibold text-foreground mb-2">Ближайшие 90 дней</div>
            <List items={data?.editorial_calendar?.next_90_days} />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-xs font-semibold text-foreground mb-2">6 месяцев вперёд</div>
            <List items={data?.editorial_calendar?.next_6_months} />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-xs font-semibold text-foreground mb-2">Evergreen поддержка</div>
            <List items={data?.editorial_calendar?.evergreen_maintain} />
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-foreground mb-2">Ежегодный refresh</div>
            <List items={data?.editorial_calendar?.annual_refresh} />
          </div>
        </div>
      </Section>

      {/* Business impact */}
      <Section icon={Bot} title="Business impact по кластерам">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Кластер</th>
                <th className="py-2 pr-3 font-medium">Traffic</th>
                <th className="py-2 pr-3 font-medium">Leads</th>
                <th className="py-2 pr-3 font-medium">Sales</th>
                <th className="py-2 pr-3 font-medium">Authority</th>
                <th className="py-2 pr-3 font-medium">AI vis.</th>
                <th className="py-2 pr-3 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {arr(data?.business_impact).map((r: any, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground font-medium">{r.cluster}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.traffic_potential]}>{r.traffic_potential}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.lead_potential]}>{r.lead_potential}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.sales_potential]}>{r.sales_potential}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.authority_potential]}>{r.authority_potential}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.ai_visibility_potential]}>{r.ai_visibility_potential}</Badge></td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Final recommendation */}
      <Section icon={Sparkles} title="Финальная стратегия">
        <div className="flex flex-wrap gap-2 mb-2">
          <Badge variant="outline" className={MODEL_TONE[data?.final_recommendation?.planning_model] || ''}>
            Модель: {data?.final_recommendation?.planning_model || '—'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="text-xs font-semibold text-rose-500 mb-2">Top-5 seasonal кластеров</div>
            <List items={data?.final_recommendation?.top_5_seasonal_clusters} />
          </div>
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold text-emerald-500 mb-2">Top-5 evergreen кластеров</div>
            <List items={data?.final_recommendation?.top_5_evergreen_clusters} />
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="text-xs font-semibold text-blue-500 mb-2">Публиковать заранее</div>
            <List items={data?.final_recommendation?.top_5_publish_early} />
          </div>
          <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-4">
            <div className="text-xs font-semibold text-violet-500 mb-2">Обновлять ежегодно</div>
            <List items={data?.final_recommendation?.top_5_pages_to_refresh_yearly} />
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-amber-500 mb-2">Топ-5 ошибок seasonal SEO</div>
            <List items={data?.final_recommendation?.top_5_mistakes} />
          </div>
        </div>
        {data?.final_recommendation?.phased_plan && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
            <div className="text-xs font-semibold text-primary mb-1">Phased план</div>
            <div className="text-sm text-foreground leading-relaxed">{data.final_recommendation.phased_plan}</div>
          </div>
        )}
        {data?.final_recommendation?.kpi_3_6_12 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="text-xs font-semibold text-foreground mb-1">KPI 3 / 6 / 12 мес</div>
            <div className="text-sm text-foreground leading-relaxed">{data.final_recommendation.kpi_3_6_12}</div>
          </div>
        )}
      </Section>
    </div>
  );
}