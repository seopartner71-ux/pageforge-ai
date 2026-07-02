import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Globe2, Compass, Languages, Target, Map, Shield, Sparkles,
  Building2, AlertTriangle, Bot, Layers, TrendingUp, ArrowRight, MapPin,
} from 'lucide-react';

export type GeoLocalData = any;

const LEVEL_TONE: Record<string, string> = {
  none: 'bg-muted text-muted-foreground border-border',
  low: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  moderate: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
  'very-high': 'bg-rose-600/20 text-rose-500 border-rose-600/40',
  critical: 'bg-rose-600/20 text-rose-500 border-rose-600/40',
};
const VAL_TONE: Record<string, string> = {
  High: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'Very-High': 'bg-emerald-600/20 text-emerald-500 border-emerald-600/40',
  Med: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  Low: 'bg-muted text-muted-foreground border-border',
  Critical: 'bg-rose-600/20 text-rose-500 border-rose-600/40',
};
const TIER_TONE: Record<string, string> = {
  'tier-1': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'tier-2': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'tier-3': 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};
const MODEL_TONE: Record<string, string> = {
  'local-first': 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  'national-first': 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  'international-first': 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  hybrid: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
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

export function DemandGeoLocalView({ data }: { data: GeoLocalData }) {
  const v = data?.executive_verdict || {};
  const ai = data?.ai_search_geo_implications || {};
  const arch = data?.architecture_implications || {};
  const fin = data?.final_recommendation || {};

  return (
    <div className="space-y-6">
      {/* Executive verdict */}
      <Section icon={Sparkles} title="Executive verdict">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={LEVEL_TONE[v.geo_dependency] || ''}>
            Геозависимость: {v.geo_dependency || '—'}
          </Badge>
          <Badge variant="outline" className={LEVEL_TONE[v.local_seo_importance] || ''}>
            Local SEO: {v.local_seo_importance || '—'}
          </Badge>
          <Badge variant="outline">
            Локализация: {v.localization_importance || '—'}
          </Badge>
          <Badge variant="outline" className={MODEL_TONE[v.launch_model] || ''}>
            Модель запуска: {v.launch_model || '—'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KV k="Главный барьер" v={v.main_barrier} />
          <KV k="Главная возможность" v={v.main_opportunity} />
        </div>
        {!!arr(v.top_geos).length && (
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Топ гео:</span>
            {arr(v.top_geos).map((g: string, i: number) => (
              <Badge key={i} variant="secondary" className="text-[11px]">{g}</Badge>
            ))}
          </div>
        )}
        {v.verdict_summary && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground leading-relaxed">
            {v.verdict_summary}
          </div>
        )}
      </Section>

      {/* Geo dependency map */}
      <Section icon={Compass} title="Карта геозависимости">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {arr(data?.geo_dependency_map).map((g: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-primary" /> {g.geo}
                </div>
                <Badge variant="outline" className={LEVEL_TONE[g.geo_dependency_level]}>
                  {g.geo_dependency_level}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className={VAL_TONE[g.seo_value]}>SEO: {g.seo_value}</Badge>
                <Badge variant="outline" className={VAL_TONE[g.business_value]}>Бизнес: {g.business_value}</Badge>
                <Badge variant="outline" className="text-[10px]">{g.demand_type}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Интент: <span className="text-foreground">{g.primary_intent}</span></div>
              {g.comment && <div className="text-xs text-muted-foreground leading-relaxed">{g.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Demand by geo */}
      <Section icon={TrendingUp} title="Спрос по гео">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Гео</th>
                <th className="py-2 pr-3 font-medium">Спрос</th>
                <th className="py-2 pr-3 font-medium">Коммерч.</th>
                <th className="py-2 pr-3 font-medium">Конкуренция</th>
                <th className="py-2 pr-3 font-medium">Локализация</th>
                <th className="py-2 pr-3 font-medium">Приоритет</th>
                <th className="py-2 pr-3 font-medium">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              {arr(data?.demand_by_geo).map((r: any, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground font-medium">{r.geo}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.demand_level]}>{r.demand_level}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.commercial_potential]}>{r.commercial_potential}</Badge></td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={VAL_TONE[r.competition_level]}>{r.competition_level}</Badge></td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.required_localization}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={TIER_TONE[r.priority]}>{r.priority}</Badge></td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.comment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Language / locale variations */}
      <Section icon={Languages} title="Языковые и локальные различия">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.language_locale_variations).map((l: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{l.term_or_phrase}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={VAL_TONE[l.seo_significance]}>SEO: {l.seo_significance}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {l.requires_separate_adaptation ? 'адаптация нужна' : 'без адаптации'}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Где: <span className="text-foreground">{l.used_in}</span></div>
              <div className="text-xs text-muted-foreground">Кто говорит: <span className="text-foreground">{l.who_uses_it}</span></div>
              {l.comment && <div className="text-xs text-muted-foreground leading-relaxed">{l.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Local intent map */}
      <Section icon={Target} title="Карта локального интента">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.local_intent_map).map((it: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">{it.intent_type}</div>
                <Badge variant="outline" className={VAL_TONE[it.local_trust_required]}>Trust: {it.local_trust_required}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Сильнее всего в: <span className="text-foreground">{it.strongest_in}</span></div>
              <div className="text-xs text-muted-foreground">Нужные страницы: <span className="text-foreground">{it.pages_needed}</span></div>
              {it.comment && <div className="text-xs text-muted-foreground leading-relaxed">{it.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Local SERP patterns */}
      <Section icon={Map} title="Локальные SERP-паттерны">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.local_serp_patterns).map((s: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground">{s.geo}</div>
                <Badge variant="outline" className="text-[10px]">{s.serp_archetype}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Кто доминирует: <span className="text-foreground">{s.who_dominates}</span></div>
              <div className="text-xs text-muted-foreground">Выигрывают: <span className="text-foreground">{s.winning_page_types}</span></div>
              <Badge variant="outline" className="text-[10px]">
                Открытость: {s.newcomer_openness}
              </Badge>
              {s.comment && <div className="text-xs text-muted-foreground leading-relaxed">{s.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Entry barriers by geo */}
      <Section icon={Shield} title="Барьеры входа по гео">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.entry_barriers_by_geo).map((b: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold text-foreground">{b.barrier}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={VAL_TONE[b.criticality]}>{b.criticality}</Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {b.bypassable ? 'обходимо' : 'жёсткий'}
                  </Badge>
                </div>
              </div>
              <div className="text-xs text-muted-foreground">Где мешает: <span className="text-foreground">{b.most_affected_geos}</span></div>
              <div className="text-xs text-muted-foreground">Как обойти: <span className="text-foreground">{b.how_to_bypass}</span></div>
            </div>
          ))}
        </div>
      </Section>

      {/* Geo opportunity windows */}
      <Section icon={Sparkles} title="Гео-возможности">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.geo_opportunity_windows).map((o: any, i: number) => (
            <div key={i} className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1.5">
              <div className="text-sm font-semibold text-foreground">{o.opportunity}</div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{o.horizon}</Badge>
                <Badge variant="outline" className="text-[10px]">{o.fit_for_site}</Badge>
                <Badge variant="outline" className="text-[10px]">{o.primary_outcome}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">Почему: <span className="text-foreground">{o.why_it_exists}</span></div>
              <div className="text-xs text-muted-foreground">Page type: <span className="text-foreground">{o.best_page_type}</span></div>
            </div>
          ))}
        </div>
      </Section>

      {/* Architecture implications */}
      <Section icon={Building2} title="Архитектурные последствия">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <KV k="Country pages" v={arch.when_country_pages} />
          <KV k="Regional pages" v={arch.when_regional_pages} />
          <KV k="City pages" v={arch.when_city_pages} />
          <KV k="Location pages" v={arch.when_location_pages} />
          <KV k="Language versions" v={arch.when_language_versions} />
          <KV k="Universal content" v={arch.when_universal_content} />
        </div>
        {!!arr(arch.main_architecture_risks).length && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-1.5">
            <div className="text-xs font-semibold text-rose-500">Архитектурные риски</div>
            <List items={arch.main_architecture_risks} />
          </div>
        )}
      </Section>

      {/* Localization vs translation */}
      <Section icon={Languages} title="Локализация vs перевод">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.localization_vs_translation).map((l: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground">{l.geo_or_locale}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {l.translation_enough ? 'перевод достаточен' : 'нужна локализация'}
                  </Badge>
                  {l.needs_rewrite && <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500">rewrite</Badge>}
                </div>
              </div>
              {!!arr(l.elements_to_adapt).length && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {arr(l.elements_to_adapt).map((e: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[10px] font-normal">{e}</Badge>
                  ))}
                </div>
              )}
              {l.comment && <div className="text-xs text-muted-foreground leading-relaxed">{l.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* Market prioritization */}
      <Section icon={Layers} title="Приоритизация рынков">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="py-2 pr-3 font-medium">Гео</th>
                <th className="py-2 pr-3 font-medium">Приоритет</th>
                <th className="py-2 pr-3 font-medium">Почему</th>
                <th className="py-2 pr-3 font-medium">Запускать первым</th>
                <th className="py-2 pr-3 font-medium">Отложить</th>
              </tr>
            </thead>
            <tbody>
              {arr(data?.market_prioritization).map((r: any, i: number) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="py-2 pr-3 text-foreground font-medium">{r.geo}</td>
                  <td className="py-2 pr-3"><Badge variant="outline" className={TIER_TONE[r.priority]}>{r.priority}</Badge></td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.why}</td>
                  <td className="py-2 pr-3">{r.launch_first}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{r.defer}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Local trust and conversion */}
      <Section icon={Shield} title="Local trust и конверсия">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {arr(data?.local_trust_and_conversion).map((t: any, i: number) => (
            <div key={i} className="rounded-lg border border-border bg-muted/20 p-4 space-y-1.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-semibold text-foreground">{t.geo}</div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className={VAL_TONE[t.impact_on_conversion]}>Conv: {t.impact_on_conversion}</Badge>
                  <Badge variant="outline" className={VAL_TONE[t.impact_on_ranking]}>Rank: {t.impact_on_ranking}</Badge>
                </div>
              </div>
              {!!arr(t.trust_signals_needed).length && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {arr(t.trust_signals_needed).map((s: string, j: number) => (
                    <Badge key={j} variant="secondary" className="text-[10px] font-normal">{s}</Badge>
                  ))}
                </div>
              )}
              {t.comment && <div className="text-xs text-muted-foreground leading-relaxed">{t.comment}</div>}
            </div>
          ))}
        </div>
      </Section>

      {/* AI search */}
      <Section icon={Bot} title="AI-search & modern SERP по гео">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold text-emerald-500 mb-2">Гео, где AI помогает</div>
            <List items={ai.geos_favored_by_ai} />
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="text-xs font-semibold text-rose-500 mb-2">Риски CTR</div>
            <List items={ai.ai_ctr_risks} />
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 md:col-span-2">
            <div className="text-xs font-semibold text-blue-500 mb-2">Locale-specific answer-блоки</div>
            <List items={ai.locale_specific_answer_blocks} />
          </div>
        </div>
        {ai.dual_visibility_notes && (
          <div className="text-xs text-muted-foreground leading-relaxed">{ai.dual_visibility_notes}</div>
        )}
      </Section>

      {/* Risks */}
      <Section icon={AlertTriangle} title="Риски geo-стратегии">
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

      {/* Final recommendation */}
      <Section icon={Globe2} title="Итоговая стратегия">
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={MODEL_TONE[fin.launch_model] || ''}>
            Модель запуска: {fin.launch_model || '—'}
          </Badge>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="text-xs font-semibold text-emerald-500 mb-2">Топ-5 гео-возможностей</div>
            <List items={fin.top_5_geo_opportunities} />
          </div>
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
            <div className="text-xs font-semibold text-rose-500 mb-2">Топ-5 сложных гео</div>
            <List items={fin.top_5_hardest_geos} />
          </div>
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
            <div className="text-xs font-semibold text-blue-500 mb-2">Топ-5 page types</div>
            <List items={fin.top_5_page_types} />
          </div>
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
            <div className="text-xs font-semibold text-amber-500 mb-2">Топ-5 ошибок</div>
            <List items={fin.top_5_mistakes} />
          </div>
        </div>
        {fin.phased_plan && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm text-foreground leading-relaxed">
            <div className="text-xs font-semibold text-primary mb-1">Phased plan</div>
            {fin.phased_plan}
          </div>
        )}
        {fin.kpi_3_6_12 && (
          <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed">
            <div className="text-xs font-semibold text-muted-foreground mb-1">KPI 3 / 6 / 12 мес</div>
            {fin.kpi_3_6_12}
          </div>
        )}
      </Section>
    </div>
  );
}