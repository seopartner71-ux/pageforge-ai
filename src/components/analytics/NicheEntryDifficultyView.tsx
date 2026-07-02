import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Lock, Target, Layers, Swords, ShieldCheck, ShoppingCart, Globe2, Users,
  Sparkles, Rocket, Gauge, Compass, AlertTriangle, CheckCircle2, ArrowRight,
} from 'lucide-react';

export type EntryDifficultyData = any;

const DIFF_TONE: Record<string, string> = {
  low: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  high: 'bg-orange-500/15 text-orange-500 border-orange-500/30',
  'very-high': 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  prohibitive: 'bg-rose-600/20 text-rose-500 border-rose-600/40',
};
const REC_TONE: Record<string, string> = {
  go: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'cautious-go': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  'phased-go': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'selective-go': 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  'no-go': 'bg-rose-500/15 text-rose-500 border-rose-500/30',
};
const VAL_TONE: Record<string, string> = {
  High: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  Med: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  Low: 'bg-muted text-muted-foreground border-border',
};

function scoreColor(v: number) {
  if (v <= 33) return 'text-emerald-500';
  if (v <= 66) return 'text-amber-500';
  return 'text-rose-500';
}
function speedLabel(s?: string) {
  const m: Record<string, string> = { '30d': '30 дней', q1: '1 квартал', q2: '2 квартал', '6-12m': '6–12 мес.', '12-24m': '12–24 мес.' };
  return s ? (m[s] || s) : '—';
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

export function NicheEntryDifficultyView({ data }: { data: EntryDifficultyData }) {
  const v = data?.executive_verdict || {};
  const s = data?.scores || {};
  const fin = data?.final_recommendation || {};
  const interp = data?.interpretation || {};

  return (
    <div className="space-y-5">
      {/* Executive verdict */}
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Оценка входа в нишу</div>
              <h3 className="text-base font-semibold text-foreground leading-snug">Decision-grade niche entry difficulty</h3>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={DIFF_TONE[v.niche_difficulty] || 'border-border'}>
              Ниша: {v.niche_difficulty || '—'}
            </Badge>
            <Badge variant="outline" className={DIFF_TONE[v.site_specific_difficulty] || 'border-border'}>
              Сайт: {v.site_specific_difficulty || '—'}
            </Badge>
            <Badge variant="outline" className={REC_TONE[v.recommendation] || 'border-border'}>
              {(v.recommendation || 'phased-go').toUpperCase()}
            </Badge>
          </div>
        </div>
        {v.verdict_summary && <p className="text-sm text-foreground/90 leading-relaxed">{v.verdict_summary}</p>}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            ['Реалистичность входа', v.realistic_entry],
            ['Главный барьер', v.main_barrier],
            ['Главная возможность', v.main_opportunity],
            ['Рекомендуемая модель входа', v.entry_model],
          ].map(([k, val]) => val ? (
            <div key={k as string} className="rounded-lg border border-border bg-muted/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{k as string}</div>
              <div className="text-sm text-foreground mt-1">{val as string}</div>
            </div>
          ) : null)}
        </div>
      </Card>

      {/* Scoring */}
      <Section icon={Gauge} title="Scoring model" subtitle="0 = легко, 100 = очень сложно (для offset/payoff — наоборот)">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {[
            ['Overall niche', s.overall_niche_difficulty],
            ['Site-specific', s.site_specific_entry_difficulty],
            ['Easiest segment', s.easiest_segment_score],
            ['Hardest segment', s.hardest_segment_score],
            ['Quick-win feasibility', s.quick_win_feasibility],
            ['Long-term payoff', s.long_term_payoff],
            ['Risk-adj. attractiveness', s.risk_adjusted_attractiveness],
            ['SERP competition', s.serp_competition],
            ['Incumbent moat', s.incumbent_moat],
            ['Trust / E-E-A-T', s.trust_eeat],
            ['Content depth', s.content_depth],
            ['Link authority', s.link_authority],
            ['Commercial page', s.commercial_page],
            ['Geo / locale', s.geo_locale],
            ['Platform ecosystem', s.platform_ecosystem],
            ['Resource mismatch', s.resource_mismatch_penalty],
            ['Speed-to-impact', s.speed_to_impact_difficulty],
            ['Wedge offset', s.wedge_availability_offset],
          ].filter(([, n]) => typeof n === 'number').map(([label, n]) => (
            <div key={label as string} className="rounded-lg border border-border p-3 text-center space-y-1">
              <div className={`text-2xl font-bold tabular-nums ${scoreColor(n as number)}`}>{n as number}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label as string}</div>
            </div>
          ))}
        </div>
        {s.reasoning && <p className="text-xs text-muted-foreground leading-relaxed">{s.reasoning}</p>}
      </Section>

      {/* Entry scope */}
      {data?.entry_scope && (
        <Section icon={Compass} title="Scope входа">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Что считать успешным входом', data.entry_scope.success_definition],
              ['Режим входа', data.entry_scope.scope_mode],
              ['Горизонт', data.entry_scope.horizon],
            ].map(([k, val]) => val ? (
              <div key={k as string} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k as string}</div>
                <div className="text-sm text-foreground mt-1">{val as string}</div>
              </div>
            ) : null)}
          </div>
          {arr(data.entry_scope.assumptions).length > 0 && (
            <div className="rounded-lg border border-border p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Ключевые допущения</div>
              <ul className="space-y-1">
                {arr<string>(data.entry_scope.assumptions).map((a, i) => (
                  <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50">▸</span><span>{a}</span></li>
                ))}
              </ul>
            </div>
          )}
          {data.entry_scope.comment && <p className="text-xs text-muted-foreground leading-relaxed">{data.entry_scope.comment}</p>}
        </Section>
      )}

      {/* Segments */}
      {arr(data?.segments).length > 0 && (
        <Section icon={Layers} title="Сегменты ниши по сложности">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.segments).map((seg, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{seg.segment}</h4>
                  <Badge variant="outline" className={DIFF_TONE[seg.difficulty] || 'border-border'}>{seg.difficulty}</Badge>
                </div>
                {seg.intent && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Интент:</span> {seg.intent}</div>}
                <div className="flex flex-wrap gap-1.5">
                  {seg.seo_value && <Badge variant="outline" className={VAL_TONE[seg.seo_value] || 'border-border'}>SEO: {seg.seo_value}</Badge>}
                  {seg.business_value && <Badge variant="outline" className={VAL_TONE[seg.business_value] || 'border-border'}>Бизнес: {seg.business_value}</Badge>}
                  {typeof seg.fits_new_site === 'boolean' && (
                    <Badge variant="outline" className={seg.fits_new_site ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                      {seg.fits_new_site ? 'Подходит новому сайту' : 'Только зрелому'}
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

      {/* SERP barriers */}
      {arr(data?.serp_barriers).length > 0 && (
        <Section icon={Swords} title="SERP-барьеры">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.serp_barriers).map((b, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{b.segment}</h4>
                  <Badge variant="outline" className={DIFF_TONE[b.displacement_difficulty] || 'border-border'}>{b.displacement_difficulty}</Badge>
                </div>
                {b.openness && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">SERP openness:</span> {b.openness}</div>}
                {b.dominators && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Доминируют:</span> {b.dominators}</div>}
                {b.required_page_type && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Нужен page type:</span> {b.required_page_type}</div>}
                {b.comment && <p className="text-xs text-muted-foreground leading-relaxed">{b.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Incumbent moats */}
      {arr(data?.incumbent_moats).length > 0 && (
        <Section icon={ShieldCheck} title="Moat лидеров рынка">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.incumbent_moats).map((m, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{m.leader_type}</h4>
                  <Badge variant="outline" className={DIFF_TONE[m.hard_to_replicate] || 'border-border'}>{m.hard_to_replicate}</Badge>
                </div>
                {m.moat && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Moat:</span> {m.moat}</div>}
                {m.wedge_bypass && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Обход через wedge:</span> {m.wedge_bypass}</div>}
                {m.comment && <p className="text-xs text-muted-foreground leading-relaxed">{m.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Trust / content / authority barriers */}
      {arr(data?.trust_content_authority).length > 0 && (
        <Section icon={ShieldCheck} title="Trust, content и authority барьеры">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {arr<any>(data.trust_content_authority).map((b, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{b.barrier}</h4>
                  <Badge variant="outline" className={DIFF_TONE[b.level] || 'border-border'}>{b.level}</Badge>
                </div>
                {b.why && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему важен:</span> {b.why}</div>}
                {b.how_to_cross && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Как преодолеть:</span> {b.how_to_cross}</div>}
                {b.comment && <p className="text-xs text-muted-foreground leading-relaxed">{b.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Commercial layers */}
      {arr(data?.commercial_layers).length > 0 && (
        <Section icon={ShoppingCart} title="Сложность коммерческого слоя">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.commercial_layers).map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{c.layer}</h4>
                  <Badge variant="outline" className={DIFF_TONE[c.difficulty] || 'border-border'}>{c.difficulty}</Badge>
                </div>
                {c.why_hard && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Что делает трудным:</span> {c.why_hard}</div>}
                {c.defer_option && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Можно позже:</span> {c.defer_option}</div>}
                {c.comment && <p className="text-xs text-muted-foreground leading-relaxed">{c.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Geo / platform effects */}
      {arr(data?.geo_platform_effects).length > 0 && (
        <Section icon={Globe2} title="Гео и платформенные эффекты">
          <div className="space-y-2">
            {arr<any>(data.geo_platform_effects).map((g, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-foreground">{g.factor}</div>
                  <Badge variant="outline" className={g.direction === 'increase' ? 'bg-rose-500/10 text-rose-500 border-rose-500/30' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30'}>
                    {g.direction === 'increase' ? '↑ повышает сложность' : '↓ снижает сложность'}
                  </Badge>
                </div>
                {g.effect && <div className="text-xs text-muted-foreground">{g.effect}</div>}
                {g.action && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Действие:</span> {g.action}</div>}
                {g.comment && <p className="text-xs text-muted-foreground leading-relaxed">{g.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Resource fit */}
      {data?.resource_fit && (
        <Section icon={Users} title="Соответствие ресурсов задаче">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              ['Покрыто ресурсами', data.resource_fit.covered, 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5'],
              ['Дефициты', data.resource_fit.gaps, 'text-amber-500 border-amber-500/30 bg-amber-500/5'],
              ['Критические дефициты', data.resource_fit.critical_deficits, 'text-rose-500 border-rose-500/30 bg-rose-500/5'],
            ].map(([title, list, tone]) => arr<string>(list as any).length > 0 && (
              <div key={title as string} className={`rounded-lg border p-3 space-y-2 ${tone}`}>
                <div className="text-xs font-semibold uppercase tracking-wider">{title as string}</div>
                <ul className="space-y-1">
                  {arr<string>(list as any).map((it, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50">▸</span><span>{it}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {data.resource_fit.how_to_narrow_scope && (
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground/80">Как сузить scope:</span> {data.resource_fit.how_to_narrow_scope}
            </div>
          )}
        </Section>
      )}

      {/* Entry wedges */}
      {arr(data?.entry_wedges).length > 0 && (
        <Section icon={Sparkles} title="Entry wedges — куда заходить">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {arr<any>(data.entry_wedges).map((w, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{w.wedge}</h4>
                  <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">{speedLabel(w.time_to_signal)}</Badge>
                </div>
                {w.best_page_type && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Page type:</span> {w.best_page_type}</div>}
                {w.why_lowers_difficulty && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему легче:</span> {w.why_lowers_difficulty}</div>}
                {typeof w.fits_new_site === 'boolean' && (
                  <Badge variant="outline" className={w.fits_new_site ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-muted text-muted-foreground border-border'}>
                    {w.fits_new_site ? 'Подходит новому сайту' : 'Нужен зрелый сайт'}
                  </Badge>
                )}
                {w.comment && <p className="text-xs text-muted-foreground leading-relaxed">{w.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Quick vs long */}
      {arr(data?.quick_vs_long).length > 0 && (
        <Section icon={Rocket} title="Quick wins vs long game">
          <div className="space-y-2">
            {arr<any>(data.quick_vs_long).map((q, i) => (
              <div key={i} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="text-sm font-medium text-foreground">{q.opportunity}</div>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge variant="outline" className={q.type === 'quick-win' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-violet-500/10 text-violet-500 border-violet-500/30'}>
                      {q.type}
                    </Badge>
                    <Badge variant="outline" className="border-border">first-signal: {speedLabel(q.time_to_signal)}</Badge>
                    <Badge variant="outline" className="border-border">traction: {speedLabel(q.time_to_traction)}</Badge>
                    {q.business_relevance && <Badge variant="outline" className={VAL_TONE[q.business_relevance] || 'border-border'}>value: {q.business_relevance}</Badge>}
                  </div>
                </div>
                {q.comment && <p className="text-xs text-muted-foreground leading-relaxed">{q.comment}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Interpretation */}
      {interp && (interp.meaning || interp.optimal_strategy) && (
        <Section icon={Target} title="Стратегическая интерпретация">
          {interp.category && (
            <Badge variant="outline" className={DIFF_TONE[interp.category] || 'border-border'}>{interp.category}</Badge>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Что это значит', interp.meaning],
              ['Для какого сайта подходит', interp.fits_site_type],
              ['Для какого не подходит', interp.does_not_fit],
              ['Оптимальная стратегия', interp.optimal_strategy],
              ['Чего избегать', interp.avoid],
            ].map(([k, val]) => val ? (
              <div key={k as string} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{k as string}</div>
                <div className="text-sm text-foreground mt-1">{val as string}</div>
              </div>
            ) : null)}
          </div>
        </Section>
      )}

      {/* Final recommendation */}
      {fin && (
        <Section icon={ArrowRight} title="Final recommendation">
          <div className="flex flex-wrap gap-2">
            {fin.entry_model && <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10">Model: {fin.entry_model}</Badge>}
            {fin.decision && <Badge variant="outline" className={REC_TONE[fin.decision] || 'border-border'}>{fin.decision.toUpperCase()}</Badge>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ['Top-5 барьеров входа', fin.top_5_barriers, AlertTriangle, 'text-rose-500'],
              ['Top-5 wedges', fin.top_5_wedges, Sparkles, 'text-emerald-500'],
              ['Top-5 page types', fin.top_5_page_types, Layers, 'text-blue-500'],
              ['Top-5 ошибок', fin.top_5_mistakes, AlertTriangle, 'text-amber-500'],
            ].map(([title, list, Icon, tone]) => arr<string>(list as any).length > 0 && (
              <div key={title as string} className="rounded-lg border border-border p-3 space-y-2">
                <div className={`text-xs font-semibold flex items-center gap-2 ${tone as string}`}>
                  {(() => { const I = Icon as any; return <I className="w-3.5 h-3.5" />; })()}
                  {title as string}
                </div>
                <ul className="space-y-1">
                  {arr<string>(list as any).map((it, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50 shrink-0">▸</span><span>{it}</span></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          {fin.phased_plan && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-1">
              <div className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> Phased entry plan
              </div>
              <p className="text-sm text-foreground leading-relaxed">{fin.phased_plan}</p>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}