import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Coins, Gauge, Compass, Layers, Scale, TrendingUp, Route as RouteIcon,
  ShieldCheck, FileType, Repeat, Sparkles, AlertTriangle, Swords, Bot,
  Users, CheckCircle2, XCircle, ArrowRight,
} from 'lucide-react';

export type MonetizationFitData = any;

const FIT_TONE: Record<string, string> = {
  poor: 'bg-rose-600/20 text-rose-500 border-rose-600/40',
  weak: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  strong: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  excellent: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/40',
};
const MON_TONE: Record<string, string> = {
  weak: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  strong: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  excellent: 'bg-emerald-600/20 text-emerald-500 border-emerald-600/40',
};
const REC_TONE: Record<string, string> = {
  go: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  phased: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  selective: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  'pivot-model': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'no-go': 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};
const VAL_TONE: Record<string, string> = {
  High: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  Med: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  Low: 'bg-muted text-muted-foreground border-border',
};
const ALIGN_TONE: Record<string, string> = {
  strong: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  weak: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  misleading: 'bg-rose-600/20 text-rose-500 border-rose-600/40',
  'hidden-opportunity': 'bg-violet-500/15 text-violet-500 border-violet-500/30',
};
const COMPLEX_TONE: Record<string, string> = {
  simple: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  complex: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};

function scoreColor(v: number) {
  if (v >= 67) return 'text-emerald-500';
  if (v >= 34) return 'text-amber-500';
  return 'text-rose-500';
}
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
  if (!v) return null;
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k}</div>
      <div className="text-sm text-foreground mt-1">{String(v)}</div>
    </div>
  );
}

export function NicheMonetizationFitView({ data }: { data: MonetizationFitData }) {
  const v = data?.executive_verdict || {};
  const s = data?.scores || {};
  const fin = data?.final_recommendation || {};
  const interp = data?.interpretation || {};
  const ai = data?.ai_search_impact || {};
  const rf = data?.resource_fit || {};

  return (
    <div className="space-y-5">
      {/* Executive verdict */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Monetization fit</div>
              <h3 className="text-base font-semibold text-foreground leading-snug">Decision-grade оценка монетизации ниши</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={MON_TONE[v.niche_monetizability] || 'border-border'}>
              Ниша: {v.niche_monetizability || '—'}
            </Badge>
            <Badge variant="outline" className={FIT_TONE[v.chosen_model_fit] || 'border-border'}>
              Модель: {v.chosen_model_fit || '—'}
            </Badge>
            <Badge variant="outline" className={REC_TONE[v.recommendation] || 'border-border'}>
              {(v.recommendation || 'phased').toUpperCase()}
            </Badge>
          </div>
        </div>
        {v.verdict_summary && <p className="text-sm text-foreground/90 leading-relaxed">{v.verdict_summary}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <KV k="Главный риск" v={v.main_risk} />
          <KV k="Главная возможность" v={v.main_opportunity} />
          <KV k="Рекомендуемая модель" v={v.recommended_model} />
          <KV k="Режим запуска" v={v.launch_mode} />
        </div>
      </Card>

      {/* Scoring */}
      <Section icon={Gauge} title="Scoring model" subtitle="0 = плохо, 100 = отлично (для penalty/pressure — наоборот)">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            ['Overall fit', s.overall_niche_monetization_fit],
            ['Chosen model', s.chosen_model_fit],
            ['Best alt model', s.best_alternative_model_fit],
            ['Easiest segment', s.easiest_to_monetize_segment],
            ['Hardest segment', s.hardest_to_monetize_segment],
            ['Traffic→revenue', s.traffic_to_revenue_efficiency],
            ['Long-term stability', s.long_term_stability],
            ['Risk-adj. attractiveness', s.risk_adjusted_attractiveness],
            ['Demand quality', s.demand_quality],
            ['High-intent density', s.high_intent_density],
            ['Willingness to pay', s.willingness_to_pay],
            ['Path simplicity', s.conversion_path_simplicity],
            ['Trust feasibility', s.trust_conversion_feasibility],
            ['Value density', s.value_density],
            ['Repeatability', s.repeatability_retention],
            ['Business-model fit', s.business_model_fit],
            ['Page-type fit', s.page_type_fit],
            ['Resource fit', s.resource_fit],
            ['AI resilience', s.ai_resilience],
            ['False-opp penalty', s.false_opportunity_penalty],
            ['Competition pressure', s.competition_monetization_pressure],
            ['Wedge opportunity', s.segment_wedge_opportunity],
          ].filter(([, n]) => typeof n === 'number').map(([label, n]) => (
            <div key={label as string} className="rounded-lg border border-border p-3 text-center space-y-1">
              <div className={`text-2xl font-bold tabular-nums ${scoreColor(n as number)}`}>{n as number}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</div>
            </div>
          ))}
        </div>
        {s.reasoning && <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>}
      </Section>

      {/* Scope */}
      {data?.monetization_scope && (
        <Section icon={Compass} title="Monetization scope">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KV k="Что считать успехом" v={data.monetization_scope.success_definition} />
            <KV k="Revenue logic" v={data.monetization_scope.revenue_logic} />
            <KV k="Volume vs Value" v={data.monetization_scope.volume_vs_value} />
          </div>
          {arr(data.monetization_scope.assumptions).length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ключевые допущения</div>
              <ul className="space-y-1">
                {arr<string>(data.monetization_scope.assumptions).map((a, i) => (
                  <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50">▸</span><span>{a}</span></li>
                ))}
              </ul>
            </div>
          )}
          {data.monetization_scope.comment && <p className="text-xs text-muted-foreground leading-relaxed">{data.monetization_scope.comment}</p>}
        </Section>
      )}

      {/* Segments */}
      {arr(data?.monetization_segments).length > 0 && (
        <Section icon={Layers} title="Сегменты монетизации">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.monetization_segments).map((seg, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{seg.segment}</h4>
                  <Badge variant="outline" className={VAL_TONE[seg.monetization_strength] || 'border-border'}>
                    Money: {seg.monetization_strength}
                  </Badge>
                </div>
                {seg.intent && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Интент:</span> {seg.intent}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {seg.seo_value && <Badge variant="outline" className={VAL_TONE[seg.seo_value] || 'border-border'}>SEO: {seg.seo_value}</Badge>}
                  {seg.conversion_proximity && <Badge variant="outline" className={VAL_TONE[seg.conversion_proximity] || 'border-border'}>Близость к конверсии: {seg.conversion_proximity}</Badge>}
                  {typeof seg.fits_chosen_model === 'boolean' && (
                    <Badge variant="outline" className={seg.fits_chosen_model ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {seg.fits_chosen_model ? 'Fits chosen model' : 'Не под выбранную модель'}
                    </Badge>
                  )}
                </div>
                {arr<string>(seg.queries).length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {arr<string>(seg.queries).slice(0, 6).map((q, j) => (
                      <Badge key={j} variant="secondary" className="text-[10px] font-normal">{q}</Badge>
                    ))}
                  </div>
                )}
                {seg.comment && <p className="text-xs text-muted-foreground leading-relaxed">{seg.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Model fit comparison */}
      {arr(data?.model_fit_comparison).length > 0 && (
        <Section icon={Scale} title="Сравнение моделей монетизации">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.model_fit_comparison).map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{m.model}</h4>
                  <Badge variant="outline" className={FIT_TONE[m.fit] || 'border-border'}>{m.fit}</Badge>
                </div>
                {m.important_intents && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Ключевые интенты:</span> {m.important_intents}</div>}
                {m.required_page_types && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Нужные типы страниц:</span> {m.required_page_types}</div>}
                {m.pros && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Плюсы:</span> {m.pros}</div>}
                {m.limits && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Ограничения:</span> {m.limits}</div>}
                {m.comment && <p className="text-xs text-muted-foreground leading-relaxed">{m.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Demand-revenue alignment */}
      {arr(data?.demand_revenue_alignment).length > 0 && (
        <Section icon={TrendingUp} title="Demand-to-revenue alignment">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.demand_revenue_alignment).map((d, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{d.segment}</h4>
                  <Badge variant="outline" className={ALIGN_TONE[d.alignment] || 'border-border'}>{d.alignment}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {d.demand_level && <Badge variant="outline" className={VAL_TONE[d.demand_level] || 'border-border'}>Спрос: {d.demand_level}</Badge>}
                  {d.demand_quality && <Badge variant="outline" className={VAL_TONE[d.demand_quality] || 'border-border'}>Качество: {d.demand_quality}</Badge>}
                  {d.willingness_to_pay && <Badge variant="outline" className={VAL_TONE[d.willingness_to_pay] || 'border-border'}>WTP: {d.willingness_to_pay}</Badge>}
                  {d.revenue_density && <Badge variant="outline" className={VAL_TONE[d.revenue_density] || 'border-border'}>$ density: {d.revenue_density}</Badge>}
                </div>
                {d.comment && <p className="text-xs text-muted-foreground leading-relaxed">{d.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Conversion path */}
      {arr(data?.conversion_path).length > 0 && (
        <Section icon={RouteIcon} title="Сложность пути к конверсии">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.conversion_path).map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{c.segment}</h4>
                  <Badge variant="outline" className={COMPLEX_TONE[c.complexity] || 'border-border'}>{c.complexity}</Badge>
                </div>
                {c.friction_points && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Friction:</span> {c.friction_points}</div>}
                {c.key_pages && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Ключевые страницы:</span> {c.key_pages}</div>}
                {c.how_to_shorten && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Как сократить путь:</span> {c.how_to_shorten}</div>}
                {c.comment && <p className="text-xs text-muted-foreground leading-relaxed">{c.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Trust and willingness */}
      {arr(data?.trust_willingness).length > 0 && (
        <Section icon={ShieldCheck} title="Trust, WTP и urgency">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.trust_willingness).map((t, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.segment}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {t.trust_dependency && <Badge variant="outline" className={VAL_TONE[t.trust_dependency] || 'border-border'}>Trust: {t.trust_dependency}</Badge>}
                  {t.willingness_to_pay && <Badge variant="outline" className={VAL_TONE[t.willingness_to_pay] || 'border-border'}>WTP: {t.willingness_to_pay}</Badge>}
                  {t.urgency && <Badge variant="outline" className={VAL_TONE[t.urgency] || 'border-border'}>Urgency: {t.urgency}</Badge>}
                </div>
                {t.required_assets && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Нужно для монетизации:</span> {t.required_assets}</div>}
                {t.comment && <p className="text-xs text-muted-foreground leading-relaxed">{t.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Page type fit */}
      {arr(data?.page_type_fit).length > 0 && (
        <Section icon={FileType} title="Page-type monetization fit">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.page_type_fit).map((p, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{p.page_type}</h4>
                  <Badge variant="outline" className={VAL_TONE[p.direct_monetization] || 'border-border'}>Direct: {p.direct_monetization}</Badge>
                </div>
                {p.intent_covered && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Интент:</span> {p.intent_covered}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {p.indirect_support && <Badge variant="outline" className={VAL_TONE[p.indirect_support] || 'border-border'}>Indirect: {p.indirect_support}</Badge>}
                  {typeof p.fits_chosen_model === 'boolean' && (
                    <Badge variant="outline" className={p.fits_chosen_model ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {p.fits_chosen_model ? 'Под chosen model' : 'Не под chosen model'}
                    </Badge>
                  )}
                  {typeof p.fits_new_site === 'boolean' && (
                    <Badge variant="outline" className={p.fits_new_site ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {p.fits_new_site ? 'Новому сайту' : 'Только зрелому'}
                    </Badge>
                  )}
                </div>
                {p.comment && <p className="text-xs text-muted-foreground leading-relaxed">{p.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Retention */}
      {arr(data?.retention_layer).length > 0 && (
        <Section icon={Repeat} title="Retention и repeatability">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.retention_layer).map((r, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{r.segment}</h4>
                  <Badge variant="outline" className={VAL_TONE[r.retention_strength] || 'border-border'}>Retention: {r.retention_strength}</Badge>
                </div>
                {r.ltv_impact && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">LTV:</span> {r.ltv_impact}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {typeof r.has_recurring === 'boolean' && (
                    <Badge variant="outline" className={r.has_recurring ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {r.has_recurring ? 'Есть recurring layer' : 'Нет recurring layer'}
                    </Badge>
                  )}
                  {typeof r.needs_seo_layer === 'boolean' && (
                    <Badge variant="outline" className={r.needs_seo_layer ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {r.needs_seo_layer ? 'Нужен SEO-layer' : 'SEO-layer не требуется'}
                    </Badge>
                  )}
                </div>
                {r.comment && <p className="text-xs text-muted-foreground leading-relaxed">{r.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Wedges */}
      {arr(data?.monetization_wedges).length > 0 && (
        <Section icon={Sparkles} title="Monetization wedges">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.monetization_wedges).map((w, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5 text-primary" /> {w.wedge}
                </h4>
                {w.why_strong_fit && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему fit сильный:</span> {w.why_strong_fit}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {w.best_page_type && <Badge variant="outline">{w.best_page_type}</Badge>}
                  {w.monetization_type && <Badge variant="outline" className="bg-primary/5">{w.monetization_type}</Badge>}
                  {w.horizon && <Badge variant="secondary">{w.horizon}</Badge>}
                  {typeof w.fits_new_site === 'boolean' && (
                    <Badge variant="outline" className={w.fits_new_site ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {w.fits_new_site ? 'Подходит новому сайту' : 'Только зрелому'}
                    </Badge>
                  )}
                </div>
                {w.comment && <p className="text-xs text-muted-foreground leading-relaxed">{w.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Low-fit zones */}
      {arr(data?.low_fit_zones).length > 0 && (
        <Section icon={AlertTriangle} title="Low-fit зоны и ложные возможности">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.low_fit_zones).map((z, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2 bg-rose-500/5">
                <h4 className="text-sm font-semibold text-foreground">{z.topic}</h4>
                {z.why_looks_attractive && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему кажется привлекательным:</span> {z.why_looks_attractive}</div>}
                {z.why_weak_fit && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему слабый fit:</span> {z.why_weak_fit}</div>}
                {typeof z.use_as_support === 'boolean' && (
                  <Badge variant="outline" className={z.use_as_support ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-muted text-muted-foreground border-border'}>
                    {z.use_as_support ? 'Можно как support' : 'Не переоценивать'}
                  </Badge>
                )}
                {z.comment && <p className="text-xs text-muted-foreground leading-relaxed">{z.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Competitor landscape */}
      {arr(data?.competitor_landscape).length > 0 && (
        <Section icon={Swords} title="Конкурентный monetization landscape">
          <div className="space-y-2">
            {arr<any>(data.competitor_landscape).map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                <div className="text-sm font-medium text-foreground">{c.observation}</div>
                {c.strength && <div className="text-xs text-emerald-500"><span className="opacity-80">Сила:</span> {c.strength}</div>}
                {c.weakness && <div className="text-xs text-rose-500"><span className="opacity-80">Слабость:</span> {c.weakness}</div>}
                {c.how_to_use && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Как использовать:</span> {c.how_to_use}</div>}
                {c.comment && <p className="text-xs text-muted-foreground leading-relaxed">{c.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* AI search */}
      {(ai.vulnerable_segments || ai.resilient_segments) && (
        <Section icon={Bot} title="AI-search implications">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KV k="Уязвимые сегменты" v={ai.vulnerable_segments} />
            <KV k="Устойчивые сегменты" v={ai.resilient_segments} />
            <KV k="Что усилить" v={ai.page_types_to_strengthen} />
            <KV k="Влияние на chosen model" v={ai.impact_on_chosen_model} />
          </div>
          {typeof ai.needs_dual_strategy === 'boolean' && (
            <Badge variant="outline" className={ai.needs_dual_strategy ? 'bg-blue-500/10 text-blue-500 border-blue-500/30' : 'bg-muted text-muted-foreground border-border'}>
              {ai.needs_dual_strategy ? 'Нужна dual strategy' : 'Достаточно одной стратегии'}
            </Badge>
          )}
          {ai.comment && <p className="text-xs text-muted-foreground leading-relaxed">{ai.comment}</p>}
        </Section>
      )}

      {/* Resource fit */}
      {rf && (rf.bottlenecks || rf.simplifications || rf.feasibility) && (
        <Section icon={Users} title="Resource-fit assessment">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Feasibility:</span>
            <Badge variant="outline" className={MON_TONE[rf.feasibility] || 'border-border'}>{rf.feasibility || '—'}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<string>(rf.bottlenecks).length > 0 && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 space-y-1">
                <div className="text-xs font-semibold text-rose-500 uppercase tracking-wider">Bottlenecks</div>
                <ul className="space-y-1">
                  {arr<string>(rf.bottlenecks).map((x, i) => <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50">▸</span><span>{x}</span></li>)}
                </ul>
              </div>
            )}
            {arr<string>(rf.simplifications).length > 0 && (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1">
                <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Что упростить</div>
                <ul className="space-y-1">
                  {arr<string>(rf.simplifications).map((x, i) => <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50">▸</span><span>{x}</span></li>)}
                </ul>
              </div>
            )}
          </div>
          {rf.lean_version && <KV k="Lean-версия" v={rf.lean_version} />}
          {rf.comment && <p className="text-xs text-muted-foreground leading-relaxed">{rf.comment}</p>}
        </Section>
      )}

      {/* Interpretation */}
      {interp && (interp.meaning || interp.optimal_strategy) && (
        <Section icon={Compass} title="Strategic interpretation">
          <Badge variant="outline" className="bg-primary/5">{interp.category || '—'}</Badge>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KV k="Что это значит" v={interp.meaning} />
            <KV k="Кому подходит" v={interp.fits_project_type} />
            <KV k="Кому НЕ подходит" v={interp.does_not_fit} />
            <KV k="Оптимальная стратегия" v={interp.optimal_strategy} />
            <KV k="Чего избегать" v={interp.avoid} />
          </div>
        </Section>
      )}

      {/* Final recommendation */}
      {fin && (
        <Section icon={CheckCircle2} title="Final recommendation">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Top-5 сегментов', fin.top_5_segments, 'text-emerald-500'],
              ['Top-5 page types', fin.top_5_page_types, 'text-blue-500'],
              ['Top-5 wedges', fin.top_5_wedges, 'text-violet-500'],
              ['Top-5 low-fit зон', fin.top_5_low_fit, 'text-amber-500'],
              ['Top-5 ошибок', fin.top_5_mistakes, 'text-rose-500'],
            ].map(([title, list, tone]) => arr<string>(list as any).length > 0 && (
              <div key={title as string} className="rounded-lg border border-border p-3 space-y-1">
                <div className={`text-xs font-semibold uppercase tracking-wider ${tone as string}`}>{title as string}</div>
                <ol className="space-y-1 list-decimal list-inside">
                  {arr<string>(list as any).map((x, i) => (
                    <li key={i} className="text-xs text-foreground">{x}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <KV k="Launch mode" v={fin.launch_mode} />
            <KV k="Phased plan" v={fin.phased_plan} />
            <KV k="KPI 3 / 6 / 12 / 24 мес." v={fin.kpi_3_6_12_24} />
          </div>
        </Section>
      )}
    </div>
  );
}