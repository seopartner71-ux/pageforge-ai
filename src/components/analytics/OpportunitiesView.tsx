import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Sparkles, Target, ShieldCheck, Brain, Info, XCircle, Map, ArrowRight, Lightbulb, AlertTriangle } from 'lucide-react';

export type SpeedBucket = '30d' | 'q1' | 'q2' | '6-12m' | '12-24m';
export type LaunchModel = 'traffic-first' | 'commercial-first' | 'authority-first' | 'wedge-first' | 'local-first' | 'ai-first' | 'hybrid';
export type OppRecommendation = 'go' | 'selective-go' | 'phased-go' | 'cautious-go' | 'no-go';

export type TopOpportunity = {
  title: string; why: string; best_format: string; speed_to_impact: SpeedBucket;
  demand_quality: number; business_value: number; accessibility: number;
  serp_openness: number; ai_upside: number; overall_score: number;
};
export type Wedge = { title: string; asset: string; payoff: string; speed: SpeedBucket };
export type Compounding = { pair: string; sequencing: string; payoff: string };
export type Trap = { title: string; why_looks_good: string; why_risk: string };
export type Gap = { title: string; why_underserved: string; asset_needed: string };

export type OpportunitiesData = {
  summary: string;
  portfolio: {
    core_growth: string[]; quick_wins: string[]; revenue_priority: string[];
    trust_building: string[]; authority_ai_visibility: string[];
    defer: string[]; avoid: string[];
  };
  top_overall: TopOpportunity[];
  wedges: Wedge[];
  compounding: Compounding[];
  traps: Trap[];
  gaps: Gap[];
  sequencing: { '30_days': string[]; q1: string[]; q2: string[]; '6_12m': string[]; '12_24m': string[] };
  launch_model: LaunchModel;
  recommendation: OppRecommendation;
};

export const SPEED_LABELS: Record<SpeedBucket, string> = {
  '30d': '30 дней', q1: '1-й квартал', q2: '2-й квартал', '6-12m': '6–12 мес.', '12-24m': '12–24 мес.',
};
export const LAUNCH_LABELS: Record<LaunchModel, string> = {
  'traffic-first': 'Traffic-first', 'commercial-first': 'Commercial-first',
  'authority-first': 'Authority-first', 'wedge-first': 'Wedge-first',
  'local-first': 'Local-first', 'ai-first': 'AI-first', hybrid: 'Hybrid',
};
export const RECOMMENDATION_LABELS: Record<OppRecommendation, string> = {
  go: 'GO', 'selective-go': 'SELECTIVE GO', 'phased-go': 'PHASED GO',
  'cautious-go': 'CAUTIOUS GO', 'no-go': 'NO-GO',
};

function arr(x: any): string[] {
  return Array.isArray(x) ? x.map((v) => String(v || '').trim()).filter(Boolean) : [];
}
function num(x: any, def = 0): number {
  const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def;
}
function normSpeed(v: any): SpeedBucket {
  const s = String(v || '').toLowerCase().replace(/\s+/g, '');
  if (s === '30d' || s === '30days' || s === '30дней') return '30d';
  if (s === 'q1') return 'q1';
  if (s === 'q2') return 'q2';
  if (s === '6-12m' || s === '6_12m' || s === '6-12') return '6-12m';
  if (s === '12-24m' || s === '12_24m' || s === '12-24') return '12-24m';
  return 'q1';
}
function normLaunch(v: any): LaunchModel {
  const s = String(v || '').toLowerCase();
  return (Object.keys(LAUNCH_LABELS) as LaunchModel[]).find((k) => k === s) || 'hybrid';
}
function normRecommendation(v: any): OppRecommendation {
  const s = String(v || '').toLowerCase().replace(/\s+/g, '-');
  return (Object.keys(RECOMMENDATION_LABELS) as OppRecommendation[]).find((k) => k === s) || 'phased-go';
}

export function normalizeOpportunities(o: any): OpportunitiesData | undefined {
  if (!o || typeof o !== 'object') return undefined;
  const p = o.portfolio || {};
  const seq = o.sequencing || {};
  return {
    summary: String(o.summary || '').trim(),
    portfolio: {
      core_growth: arr(p.core_growth), quick_wins: arr(p.quick_wins),
      revenue_priority: arr(p.revenue_priority), trust_building: arr(p.trust_building),
      authority_ai_visibility: arr(p.authority_ai_visibility),
      defer: arr(p.defer), avoid: arr(p.avoid),
    },
    top_overall: Array.isArray(o.top_overall) ? o.top_overall.map((t: any) => ({
      title: String(t?.title || '').trim(),
      why: String(t?.why || '').trim(),
      best_format: String(t?.best_format || '').trim(),
      speed_to_impact: normSpeed(t?.speed_to_impact),
      demand_quality: num(t?.demand_quality),
      business_value: num(t?.business_value),
      accessibility: num(t?.accessibility),
      serp_openness: num(t?.serp_openness),
      ai_upside: num(t?.ai_upside),
      overall_score: num(t?.overall_score),
    })).filter((t: TopOpportunity) => t.title) : [],
    wedges: Array.isArray(o.wedges) ? o.wedges.map((w: any) => ({
      title: String(w?.title || '').trim(), asset: String(w?.asset || '').trim(),
      payoff: String(w?.payoff || '').trim(), speed: normSpeed(w?.speed),
    })).filter((w: Wedge) => w.title) : [],
    compounding: Array.isArray(o.compounding) ? o.compounding.map((c: any) => ({
      pair: String(c?.pair || '').trim(), sequencing: String(c?.sequencing || '').trim(),
      payoff: String(c?.payoff || '').trim(),
    })).filter((c: Compounding) => c.pair) : [],
    traps: Array.isArray(o.traps) ? o.traps.map((t: any) => ({
      title: String(t?.title || '').trim(),
      why_looks_good: String(t?.why_looks_good || '').trim(),
      why_risk: String(t?.why_risk || '').trim(),
    })).filter((t: Trap) => t.title) : [],
    gaps: Array.isArray(o.gaps) ? o.gaps.map((g: any) => ({
      title: String(g?.title || '').trim(),
      why_underserved: String(g?.why_underserved || '').trim(),
      asset_needed: String(g?.asset_needed || '').trim(),
    })).filter((g: Gap) => g.title) : [],
    sequencing: {
      '30_days': arr(seq['30_days']), q1: arr(seq.q1), q2: arr(seq.q2),
      '6_12m': arr(seq['6_12m']), '12_24m': arr(seq['12_24m']),
    },
    launch_model: normLaunch(o.launch_model),
    recommendation: normRecommendation(o.recommendation),
  };
}

function speedBadgeClass(s: SpeedBucket) {
  if (s === '30d') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (s === 'q1') return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
  if (s === 'q2') return 'bg-violet-500/15 text-violet-500 border-violet-500/30';
  if (s === '6-12m') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return 'bg-muted text-muted-foreground border-border';
}
function oppRecommendationClass(r: OppRecommendation) {
  if (r === 'go') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (r === 'no-go') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  if (r === 'cautious-go') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
}
function scoreColorClass(v: number) {
  if (v >= 70) return 'text-emerald-500';
  if (v >= 40) return 'text-amber-500';
  return 'text-rose-500';
}

const PORTFOLIO_GROUPS: { key: keyof OpportunitiesData['portfolio']; title: string; tone: string; icon: any }[] = [
  { key: 'core_growth', title: 'Core growth', tone: 'text-primary border-primary/30 bg-primary/5', icon: TrendingUp },
  { key: 'quick_wins', title: 'Quick wins', tone: 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5', icon: Sparkles },
  { key: 'revenue_priority', title: 'Revenue priority', tone: 'text-blue-500 border-blue-500/30 bg-blue-500/5', icon: Target },
  { key: 'trust_building', title: 'Trust building', tone: 'text-violet-500 border-violet-500/30 bg-violet-500/5', icon: ShieldCheck },
  { key: 'authority_ai_visibility', title: 'Authority / AI visibility', tone: 'text-indigo-500 border-indigo-500/30 bg-indigo-500/5', icon: Brain },
  { key: 'defer', title: 'Defer for later', tone: 'text-muted-foreground border-border bg-muted/30', icon: Info },
  { key: 'avoid', title: 'Avoid', tone: 'text-rose-500 border-rose-500/30 bg-rose-500/5', icon: XCircle },
];

export function OpportunitiesView({ data }: { data: OpportunitiesData }) {
  return (
    <div className="space-y-5">
      <Card className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Target className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Карта рыночных возможностей
              </div>
              <h3 className="text-base font-semibold text-foreground leading-snug">
                Decision-grade opportunity portfolio
              </h3>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="border-border">
              Launch model: <span className="ml-1 font-semibold text-foreground">{LAUNCH_LABELS[data.launch_model]}</span>
            </Badge>
            <Badge variant="outline" className={oppRecommendationClass(data.recommendation)}>
              {RECOMMENDATION_LABELS[data.recommendation]}
            </Badge>
          </div>
        </div>
        {data.summary && <p className="text-sm text-foreground/90 leading-relaxed">{data.summary}</p>}
      </Card>

      {data.top_overall.length > 0 && (
        <Card className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Топ возможностей (risk-adjusted)
            </h3>
            <span className="text-[11px] text-muted-foreground">Скоринг по 5 факторам · overall ≤ 100</span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {data.top_overall.map((t, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">#{i + 1}</div>
                    <h4 className="text-sm font-semibold text-foreground leading-snug">{t.title}</h4>
                  </div>
                  <div className={`text-2xl font-bold tabular-nums shrink-0 ${scoreColorClass(t.overall_score)}`}>
                    {t.overall_score}
                  </div>
                </div>
                {t.why && <p className="text-xs text-muted-foreground leading-relaxed">{t.why}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {t.best_format && <Badge variant="secondary" className="text-[10px]">{t.best_format}</Badge>}
                  <Badge variant="outline" className={`text-[10px] ${speedBadgeClass(t.speed_to_impact)}`}>
                    {SPEED_LABELS[t.speed_to_impact]}
                  </Badge>
                </div>
                <div className="grid grid-cols-5 gap-2 pt-1">
                  {([
                    ['Demand', t.demand_quality], ['Business', t.business_value], ['Access', t.accessibility],
                    ['SERP', t.serp_openness], ['AI', t.ai_upside],
                  ] as [string, number][]).map(([k, v]) => (
                    <div key={k} className="text-center space-y-1">
                      <div className={`text-xs font-semibold tabular-nums ${scoreColorClass(v)}`}>{v}</div>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{k}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" /> Opportunity portfolio
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {PORTFOLIO_GROUPS.map((g) => {
            const items = data.portfolio[g.key];
            if (!items || items.length === 0) return null;
            const Icon = g.icon;
            return (
              <div key={g.key} className={`rounded-lg border p-4 space-y-2 ${g.tone}`}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">{g.title}</span>
                  <span className="ml-auto text-[10px] opacity-70">{items.length}</span>
                </div>
                <ul className="space-y-1.5">
                  {items.map((it, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="opacity-50 shrink-0">▸</span><span>{it}</span></li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Card>

      {data.wedges.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Opportunity wedges
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.wedges.map((w, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{w.title}</h4>
                  <Badge variant="outline" className={speedBadgeClass(w.speed)}>{SPEED_LABELS[w.speed]}</Badge>
                </div>
                {w.asset && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Asset:</span> {w.asset}</div>}
                {w.payoff && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Payoff:</span> {w.payoff}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(data.compounding.length > 0 || data.gaps.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {data.compounding.length > 0 && (
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <ArrowRight className="w-4 h-4 text-primary" /> Compounding opportunities
              </h3>
              <ul className="space-y-3">
                {data.compounding.map((c, i) => (
                  <li key={i} className="rounded-md border border-border p-3 space-y-1">
                    <div className="text-sm font-medium text-foreground">{c.pair}</div>
                    {c.sequencing && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Порядок:</span> {c.sequencing}</div>}
                    {c.payoff && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Эффект:</span> {c.payoff}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {data.gaps.length > 0 && (
            <Card className="p-6 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-amber-500" /> Underexploited gaps
              </h3>
              <ul className="space-y-3">
                {data.gaps.map((g, i) => (
                  <li key={i} className="rounded-md border border-border p-3 space-y-1">
                    <div className="text-sm font-medium text-foreground">{g.title}</div>
                    {g.why_underserved && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Почему gap:</span> {g.why_underserved}</div>}
                    {g.asset_needed && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Нужен asset:</span> {g.asset_needed}</div>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {data.traps.length > 0 && (
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> False opportunities / traps
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.traps.map((t, i) => (
              <div key={i} className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">{t.title}</h4>
                {t.why_looks_good && <div className="text-xs text-muted-foreground"><span className="font-medium text-foreground/80">Выглядит привлекательно:</span> {t.why_looks_good}</div>}
                {t.why_risk && <div className="text-xs text-rose-500/90"><span className="font-medium">Почему ловушка:</span> {t.why_risk}</div>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" /> Strategic sequencing
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {([
            ['30_days', '30 дней'], ['q1', '1 квартал'], ['q2', '2 квартал'], ['6_12m', '6–12 мес.'], ['12_24m', '12–24 мес.'],
          ] as [keyof OpportunitiesData['sequencing'], string][]).map(([k, label]) => {
            const items = data.sequencing[k];
            return (
              <div key={k} className="rounded-lg border border-border p-3 space-y-2">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
                {items && items.length > 0 ? (
                  <ul className="space-y-1">
                    {items.map((it, i) => (
                      <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-primary shrink-0">▸</span>{it}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-muted-foreground">—</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
