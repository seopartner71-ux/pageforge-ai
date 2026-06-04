import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  HelpCircle, Sparkles, Crown, Rocket, Shield, FileType, EyeOff,
  AlertTriangle, Target, Layers, Bot, MapPin, ShoppingCart, Users,
  Compass, Zap, Calendar,
} from 'lucide-react';

type LvlStr = 'low' | 'medium' | 'high' | string;
type FitStr = 'yes' | 'no' | 'partial' | string;
type Verdict = 'pursue-now' | 'prepare' | 'monitor' | 'avoid' | string;

export type SegmentRow = { segment: string; saturation: LvlStr; coverage_quality: LvlStr; white_space_likelihood: LvlStr; gap_types: string[]; comment: string };
export type TopicGap = { topic: string; why_gap: string; why_market_misses: string; intent: string; best_page_type: string; fits_new_site: FitStr; horizon: string; demand_signal: number; business_value: number; ease: number; verdict: Verdict };
export type IntentGap = { intent_missed: string; current_problem: string; better_match: string; needed_page_type: string; comment: string };
export type AudienceGap = { audience: string; why_important: string; demand_signal: string; needed_content: string; business_value: LvlStr; comment: string };
export type FunnelGap = { stage: string; coverage: LvlStr; gap: string; needed_page_types: string[]; priority: string; comment: string };
export type FormatGap = { missing_format: string; why_white_space: string; where_wins: string; fits_new_site: FitStr; comment: string };
export type DepthFreshnessGap = { type: 'depth' | 'freshness' | string; where: string; how_to_use: string; best_format: string; speed: string; comment: string };
export type GeoGap = { geo: string; gap: string; why_exists: string; best_page_type: string; potential: LvlStr; comment: string };
export type CommercialGap = { opportunity: string; scenario: string; best_page_type: string; revenue_potential: LvlStr; fits_new_site: FitStr; comment: string };
export type AiGap = { opportunity: string; why_ai_matters: string; needed_format: string; organic_upside: LvlStr; ai_upside: LvlStr; comment: string };
export type FalseGap = { fake_gap: string; why_looks_like_opp: string; why_not_worth: string; when_to_revisit: string; comment: string };
export type PrioItem = { what: string; why: string; expected_impact: string; risk: string; needs: string };

export type FreeTopicsData = {
  scoring: {
    overall_white_space: number;
    market_saturation: number;
    undercoverage: number;
    intent_mismatch: number;
    ai_answerability_gap: number;
    ease_for_new_site: number;
    reasoning: string;
  };
  executive_verdict: {
    overview: string; saturation_level: LvlStr;
    main_gap_zone: string; main_risk: string; main_opportunity: string;
    entry_model: string;
  };
  top_lists: {
    top_opportunities: string[]; for_new_site: string[]; requires_authority: string[];
    best_page_types: string[]; false_gaps_short: string[];
  };
  segments_map: SegmentRow[];
  topic_gaps: TopicGap[];
  intent_gaps: IntentGap[];
  audience_gaps: AudienceGap[];
  funnel_gaps: FunnelGap[];
  format_gaps: FormatGap[];
  depth_freshness_gaps: DepthFreshnessGap[];
  geo_gaps: GeoGap[];
  commercial_gaps: CommercialGap[];
  ai_gaps: AiGap[];
  false_gaps: FalseGap[];
  prioritization: {
    launch_now: PrioItem[]; launch_quarter: PrioItem[]; after_authority: PrioItem[];
    with_resources: PrioItem[]; deprioritize: PrioItem[];
  };
};

const arr = (x: any): string[] => Array.isArray(x) ? x.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
const num = (x: any, def = 0) => { const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def; };
const str = (x: any) => String(x ?? '').trim();
const lvl = (x: any, def: LvlStr = 'medium') => { const v = str(x).toLowerCase(); return ['low','medium','high'].includes(v) ? v : def; };
const fit = (x: any, def: FitStr = 'partial') => { const v = str(x).toLowerCase(); return ['yes','no','partial'].includes(v) ? v : def; };

export function normalizeFreeTopics(raw: any): FreeTopicsData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const ev = raw.executive_verdict || {};
  const tl = raw.top_lists || {};
  const prio = raw.prioritization || {};
  const pmap = (x: any): PrioItem[] => Array.isArray(x) ? x.map((c: any) => ({
    what: str(c?.what), why: str(c?.why), expected_impact: str(c?.expected_impact),
    risk: str(c?.risk), needs: str(c?.needs),
  })).filter((c) => c.what) : [];

  return {
    scoring: {
      overall_white_space: num(s.overall_white_space),
      market_saturation: num(s.market_saturation),
      undercoverage: num(s.undercoverage),
      intent_mismatch: num(s.intent_mismatch),
      ai_answerability_gap: num(s.ai_answerability_gap),
      ease_for_new_site: num(s.ease_for_new_site),
      reasoning: str(s.reasoning),
    },
    executive_verdict: {
      overview: str(ev.overview),
      saturation_level: lvl(ev.saturation_level),
      main_gap_zone: str(ev.main_gap_zone),
      main_risk: str(ev.main_risk),
      main_opportunity: str(ev.main_opportunity),
      entry_model: str(ev.entry_model) || 'hybrid',
    },
    top_lists: {
      top_opportunities: arr(tl.top_opportunities),
      for_new_site: arr(tl.for_new_site),
      requires_authority: arr(tl.requires_authority),
      best_page_types: arr(tl.best_page_types),
      false_gaps_short: arr(tl.false_gaps_short),
    },
    segments_map: Array.isArray(raw.segments_map) ? raw.segments_map.map((c: any) => ({
      segment: str(c?.segment), saturation: lvl(c?.saturation), coverage_quality: lvl(c?.coverage_quality),
      white_space_likelihood: lvl(c?.white_space_likelihood), gap_types: arr(c?.gap_types), comment: str(c?.comment),
    })).filter((c: any) => c.segment) : [],
    topic_gaps: Array.isArray(raw.topic_gaps) ? raw.topic_gaps.map((c: any) => ({
      topic: str(c?.topic), why_gap: str(c?.why_gap), why_market_misses: str(c?.why_market_misses),
      intent: str(c?.intent), best_page_type: str(c?.best_page_type), fits_new_site: fit(c?.fits_new_site),
      horizon: str(c?.horizon), demand_signal: num(c?.demand_signal), business_value: num(c?.business_value),
      ease: num(c?.ease), verdict: (str(c?.verdict).toLowerCase() || 'monitor'),
    })).filter((c: any) => c.topic) : [],
    intent_gaps: Array.isArray(raw.intent_gaps) ? raw.intent_gaps.map((c: any) => ({
      intent_missed: str(c?.intent_missed), current_problem: str(c?.current_problem),
      better_match: str(c?.better_match), needed_page_type: str(c?.needed_page_type), comment: str(c?.comment),
    })).filter((c: any) => c.intent_missed) : [],
    audience_gaps: Array.isArray(raw.audience_gaps) ? raw.audience_gaps.map((c: any) => ({
      audience: str(c?.audience), why_important: str(c?.why_important), demand_signal: str(c?.demand_signal),
      needed_content: str(c?.needed_content), business_value: lvl(c?.business_value), comment: str(c?.comment),
    })).filter((c: any) => c.audience) : [],
    funnel_gaps: Array.isArray(raw.funnel_gaps) ? raw.funnel_gaps.map((c: any) => ({
      stage: str(c?.stage), coverage: lvl(c?.coverage), gap: str(c?.gap),
      needed_page_types: arr(c?.needed_page_types), priority: str(c?.priority).toLowerCase() || 'p2', comment: str(c?.comment),
    })).filter((c: any) => c.stage) : [],
    format_gaps: Array.isArray(raw.format_gaps) ? raw.format_gaps.map((c: any) => ({
      missing_format: str(c?.missing_format), why_white_space: str(c?.why_white_space),
      where_wins: str(c?.where_wins), fits_new_site: fit(c?.fits_new_site), comment: str(c?.comment),
    })).filter((c: any) => c.missing_format) : [],
    depth_freshness_gaps: Array.isArray(raw.depth_freshness_gaps) ? raw.depth_freshness_gaps.map((c: any) => ({
      type: (str(c?.type).toLowerCase() === 'freshness' ? 'freshness' : 'depth'),
      where: str(c?.where), how_to_use: str(c?.how_to_use), best_format: str(c?.best_format),
      speed: str(c?.speed), comment: str(c?.comment),
    })).filter((c: any) => c.where) : [],
    geo_gaps: Array.isArray(raw.geo_gaps) ? raw.geo_gaps.map((c: any) => ({
      geo: str(c?.geo), gap: str(c?.gap), why_exists: str(c?.why_exists),
      best_page_type: str(c?.best_page_type), potential: lvl(c?.potential), comment: str(c?.comment),
    })).filter((c: any) => c.geo) : [],
    commercial_gaps: Array.isArray(raw.commercial_gaps) ? raw.commercial_gaps.map((c: any) => ({
      opportunity: str(c?.opportunity), scenario: str(c?.scenario), best_page_type: str(c?.best_page_type),
      revenue_potential: lvl(c?.revenue_potential), fits_new_site: fit(c?.fits_new_site), comment: str(c?.comment),
    })).filter((c: any) => c.opportunity) : [],
    ai_gaps: Array.isArray(raw.ai_gaps) ? raw.ai_gaps.map((c: any) => ({
      opportunity: str(c?.opportunity), why_ai_matters: str(c?.why_ai_matters),
      needed_format: str(c?.needed_format), organic_upside: lvl(c?.organic_upside),
      ai_upside: lvl(c?.ai_upside), comment: str(c?.comment),
    })).filter((c: any) => c.opportunity) : [],
    false_gaps: Array.isArray(raw.false_gaps) ? raw.false_gaps.map((c: any) => ({
      fake_gap: str(c?.fake_gap), why_looks_like_opp: str(c?.why_looks_like_opp),
      why_not_worth: str(c?.why_not_worth), when_to_revisit: str(c?.when_to_revisit), comment: str(c?.comment),
    })).filter((c: any) => c.fake_gap) : [],
    prioritization: {
      launch_now: pmap(prio.launch_now),
      launch_quarter: pmap(prio.launch_quarter),
      after_authority: pmap(prio.after_authority),
      with_resources: pmap(prio.with_resources),
      deprioritize: pmap(prio.deprioritize),
    },
  };
}

function scoreColor(v: number) {
  if (v >= 70) return 'text-emerald-500';
  if (v >= 40) return 'text-amber-500';
  return 'text-rose-500';
}

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">{text}</TooltipContent>
    </Tooltip>
  );
}

function ScoreRing({ value, label, color, hint }: { value: number; label: string; color: string; hint: string }) {
  const r = 36; const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="rounded-lg border border-border p-4 flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
          <circle cx="50" cy="50" r={r} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
          <circle cx="50" cy="50" r={r} stroke={color} strokeWidth="8" fill="none"
            strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 800ms ease' }} />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums ${scoreColor(value)}`}>{value}</div>
      </div>
      <div className="flex items-center gap-1.5 text-center">
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        <Hint text={hint} />
      </div>
    </div>
  );
}

const LVL_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкая', cls: 'bg-muted text-muted-foreground border-border' },
  medium: { label: 'Средняя', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  high: { label: 'Высокая', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
};
const SAT_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкое', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  medium: { label: 'Среднее', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  high: { label: 'Высокое', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
};
const FIT_RU: Record<string, { label: string; cls: string }> = {
  yes: { label: 'Подходит', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  partial: { label: 'Частично', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  no: { label: 'Не подходит', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
};
const VERDICT_RU: Record<string, { label: string; cls: string }> = {
  'pursue-now': { label: 'Брать сейчас', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  'prepare': { label: 'Готовить', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  'monitor': { label: 'Мониторить', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  'avoid': { label: 'Избегать', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
};
const STAGE_RU: Record<string, string> = {
  awareness: 'Осознание', consideration: 'Выбор', decision: 'Решение',
  purchase: 'Покупка', onboarding: 'Внедрение', retention: 'Удержание', expansion: 'Расширение',
};
const PRIO_RU: Record<string, { label: string; cls: string }> = {
  p1: { label: 'P1', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
  p2: { label: 'P2', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  p3: { label: 'P3', cls: 'bg-muted text-muted-foreground' },
};

function badgeFor(map: Record<string, { label: string; cls: string }>, key: string) {
  const m = map[key]; return m ? <Badge variant="outline" className={m.cls}>{m.label}</Badge> : <span className="text-xs">{key}</span>;
}

function ListCard({ icon: Icon, title, hint, items, color }: { icon: any; title: string; hint: string; items: string[]; color: string }) {
  return (
    <Card className="p-6 space-y-3">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Icon className={`w-4 h-4 ${color}`} /> {title}
        <Hint text={hint} />
      </h3>
      <div className="flex flex-wrap gap-2">
        {items.map((t, i) => (<Badge key={i} variant="outline" className="border-primary/30 text-foreground">{t}</Badge>))}
        {items.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
      </div>
    </Card>
  );
}

function PrioCol({ title, items, color, hint }: { title: string; items: PrioItem[]; color: string; hint: string }) {
  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Hint text={hint} />
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
        {items.map((c, i) => (
          <div key={i} className="rounded-md border border-border p-3 space-y-1.5">
            <div className="text-sm font-medium text-foreground">{c.what}</div>
            {c.why && <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Почему:</b> {c.why}</div>}
            {c.expected_impact && <div className="text-xs text-emerald-600 dark:text-emerald-400"><b>Эффект:</b> {c.expected_impact}</div>}
            {c.risk && <div className="text-xs text-rose-500"><b>Риск:</b> {c.risk}</div>}
            {c.needs && <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Нужно:</b> {c.needs}</div>}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function FreeTopicsView({ data }: { data: FreeTopicsData }) {
  return (
    <Tabs defaultValue="exec" className="space-y-5">
      <TabsList className="grid grid-cols-5 w-full max-w-3xl">
        <TabsTrigger value="exec">Главное</TabsTrigger>
        <TabsTrigger value="segments">Карта сегментов</TabsTrigger>
        <TabsTrigger value="gaps">Виды разрывов</TabsTrigger>
        <TabsTrigger value="opps">Возможности</TabsTrigger>
        <TabsTrigger value="plan">План</TabsTrigger>
      </TabsList>

      {/* === EXEC === */}
      <TabsContent value="exec" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">White Space карта</div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Оценка свободных тем в нише
                <Hint text="Совокупная оценка незакрытых тем, интентов, форматов и сегментов, доступных для входа." />
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <ScoreRing value={data.scoring.overall_white_space} label="Итог" color="hsl(217 91% 60%)" hint="Совокупная привлекательность white-space стратегии." />
            <ScoreRing value={data.scoring.market_saturation} label="Насыщ." color="hsl(0 84% 60%)" hint="Насыщенность рынка контентом (чем меньше — тем лучше для входа). Это «обратный» индикатор." />
            <ScoreRing value={data.scoring.undercoverage} label="Недокрытие" color="hsl(199 89% 48%)" hint="Доля важных тем, покрытых слабо или поверхностно." />
            <ScoreRing value={data.scoring.intent_mismatch} label="Интент-разрыв" color="hsl(38 92% 50%)" hint="Где SERP не соответствует реальному интенту пользователя." />
            <ScoreRing value={data.scoring.ai_answerability_gap} label="ИИ-разрыв" color="hsl(173 80% 40%)" hint="Где конкуренты не подготовили retrieval-friendly ответы — окно для ИИ-видимости." />
            <ScoreRing value={data.scoring.ease_for_new_site} label="Новый сайт" color="hsl(142 76% 45%)" hint="Реалистичность входа для нового/слабого домена." />
          </div>
          {data.scoring.reasoning && <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.reasoning}</p>}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" /> Сводный вердикт
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={SAT_RU[data.executive_verdict.saturation_level]?.cls || ''}>
              Насыщенность ниши: {SAT_RU[data.executive_verdict.saturation_level]?.label || data.executive_verdict.saturation_level}
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Модель входа: {data.executive_verdict.entry_model}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Общая картина</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_verdict.overview || '—'}</p>
            </div>
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-primary font-medium">Основная зона разрывов</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_verdict.main_gap_zone || '—'}</p>
            </div>
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-rose-500 font-medium">Главный риск</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_verdict.main_risk || '—'}</p>
            </div>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-emerald-500 font-medium">Главная возможность</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_verdict.main_opportunity || '—'}</p>
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ListCard icon={Crown} title="Топ возможностей" hint="5 сильнейших white-space ставок." items={data.top_lists.top_opportunities} color="text-primary" />
          <ListCard icon={Rocket} title="Для нового сайта" hint="White spaces, реалистичные для нового/слабого домена." items={data.top_lists.for_new_site} color="text-emerald-500" />
          <ListCard icon={Shield} title="Требуют авторитета" hint="Возможности, для которых нужен зрелый домен / бренд / trust." items={data.top_lists.requires_authority} color="text-violet-500" />
          <ListCard icon={FileType} title="Лучшие типы страниц" hint="Page types, через которые быстрее закрывать gaps." items={data.top_lists.best_page_types} color="text-blue-500" />
          <ListCard icon={EyeOff} title="Ложные возможности" hint="Выглядят как white space, но реально слабые ставки." items={data.top_lists.false_gaps_short} color="text-rose-500" />
        </div>
      </TabsContent>

      {/* === SEGMENTS === */}
      <TabsContent value="segments" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Карта сегментов ниши
            <Hint text="Текущее покрытие по сегментам и вероятность white space в каждом." />
          </h3>
          {data.segments_map.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сегмент</TableHead>
                  <TableHead>Насыщенность</TableHead>
                  <TableHead>Качество покрытия</TableHead>
                  <TableHead>Вероятность white space</TableHead>
                  <TableHead>Типы разрывов</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.segments_map.map((s, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium align-top">
                      <div>{s.segment}</div>
                      {s.comment && <div className="text-xs text-muted-foreground mt-1">{s.comment}</div>}
                    </TableCell>
                    <TableCell className="align-top">{badgeFor(SAT_RU, s.saturation)}</TableCell>
                    <TableCell className="align-top">{badgeFor(LVL_RU, s.coverage_quality)}</TableCell>
                    <TableCell className="align-top">{badgeFor(LVL_RU, s.white_space_likelihood)}</TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-wrap gap-1">
                        {s.gap_types.map((g, j) => (<Badge key={j} variant="outline" className="text-[10px]">{g}</Badge>))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </TabsContent>

      {/* === GAPS === */}
      <TabsContent value="gaps" className="space-y-5 mt-5">
        {/* Intent */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Intent gaps
            <Hint text="Где SERP не закрывает реальный интент пользователя." />
          </h3>
          {data.intent_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.intent_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="text-sm font-medium text-foreground">{c.intent_missed}</div>
                  <div className="text-xs text-rose-500"><b>Проблема:</b> {c.current_problem}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400"><b>Лучший match:</b> {c.better_match}</div>
                  <div className="text-xs text-primary"><b>Тип страницы:</b> {c.needed_page_type}</div>
                  {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Audience */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" /> Audience gaps
            <Hint text="Сегменты аудитории, которые рынок недопокрывает." />
          </h3>
          {data.audience_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Аудитория</TableHead>
                  <TableHead>Почему важно</TableHead>
                  <TableHead>Нужный контент</TableHead>
                  <TableHead>Бизнес-ценность</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.audience_gaps.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium align-top">
                      <div>{c.audience}</div>
                      {c.demand_signal && <div className="text-xs text-muted-foreground mt-1">Сигнал: {c.demand_signal}</div>}
                    </TableCell>
                    <TableCell className="text-xs align-top">{c.why_important}</TableCell>
                    <TableCell className="text-xs align-top">{c.needed_content}</TableCell>
                    <TableCell className="align-top">{badgeFor(LVL_RU, c.business_value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Funnel */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-500" /> Funnel gaps
            <Hint text="Где воронка слабо покрыта контентом." />
          </h3>
          {data.funnel_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Этап</TableHead>
                  <TableHead>Покрытие</TableHead>
                  <TableHead>Что не закрыто</TableHead>
                  <TableHead>Типы страниц</TableHead>
                  <TableHead>Приоритет</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.funnel_gaps.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium align-top">{STAGE_RU[c.stage] || c.stage}</TableCell>
                    <TableCell className="align-top">{badgeFor(LVL_RU, c.coverage)}</TableCell>
                    <TableCell className="text-xs align-top">{c.gap}{c.comment && <div className="text-muted-foreground mt-1">{c.comment}</div>}</TableCell>
                    <TableCell className="text-xs align-top">{c.needed_page_types.join(' · ')}</TableCell>
                    <TableCell className="align-top">{badgeFor(PRIO_RU, c.priority)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Format */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileType className="w-4 h-4 text-blue-500" /> Format & page-type gaps
            <Hint text="Форматы и типы страниц, которых нет в нише." />
          </h3>
          {data.format_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.format_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="text-sm font-medium text-foreground flex items-center justify-between gap-2">
                    <span>{c.missing_format}</span>
                    {badgeFor(FIT_RU, c.fits_new_site)}
                  </div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Почему gap:</b> {c.why_white_space}</div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400"><b>Где побеждает:</b> {c.where_wins}</div>
                  {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Depth/Freshness */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Calendar className="w-4 h-4 text-violet-500" /> Depth & freshness gaps
            <Hint text="Где конкуренты пишут поверхностно или устарели." />
          </h3>
          {data.depth_freshness_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Тип</TableHead>
                  <TableHead>Где проблема</TableHead>
                  <TableHead>Как использовать</TableHead>
                  <TableHead>Лучший формат</TableHead>
                  <TableHead>Скорость</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.depth_freshness_gaps.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="align-top">
                      <Badge variant="outline" className={c.type === 'freshness' ? 'bg-amber-500/15 text-amber-500 border-amber-500/30' : 'bg-violet-500/15 text-violet-500 border-violet-500/30'}>
                        {c.type === 'freshness' ? 'Свежесть' : 'Глубина'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs align-top">{c.where}{c.comment && <div className="text-muted-foreground mt-1">{c.comment}</div>}</TableCell>
                    <TableCell className="text-xs align-top">{c.how_to_use}</TableCell>
                    <TableCell className="text-xs align-top">{c.best_format}</TableCell>
                    <TableCell className="text-xs align-top">{c.speed}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* Geo */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-500" /> Geo & localization gaps
            <Hint text="Региональные и языковые белые пятна." />
          </h3>
          {data.geo_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.geo_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="text-sm font-medium text-foreground flex items-center justify-between gap-2">
                    <span>{c.geo}</span>
                    {badgeFor(LVL_RU, c.potential)}
                  </div>
                  <div className="text-xs"><b className="text-foreground/70">Gap:</b> {c.gap}</div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Почему существует:</b> {c.why_exists}</div>
                  <div className="text-xs text-primary"><b>Page type:</b> {c.best_page_type}</div>
                  {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      {/* === OPPS === */}
      <TabsContent value="opps" className="space-y-5 mt-5">
        {/* Topic gaps */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Topic gaps · карточки тем
            <Hint text="Темы и подтемы, выпадающие из поля зрения рынка." />
          </h3>
          {data.topic_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {data.topic_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">{c.topic}</div>
                    {badgeFor(VERDICT_RU, c.verdict)}
                  </div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Почему gap:</b> {c.why_gap}</div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Рынок упускает:</b> {c.why_market_misses}</div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">Интент: {c.intent || '—'}</Badge>
                    <Badge variant="outline" className="text-primary border-primary/30">Page: {c.best_page_type || '—'}</Badge>
                    {badgeFor(FIT_RU, c.fits_new_site)}
                    <Badge variant="outline">Горизонт: {c.horizon || '—'}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="text-[11px] text-muted-foreground">Спрос<div className={`text-sm font-semibold ${scoreColor(c.demand_signal)}`}>{c.demand_signal}</div></div>
                    <div className="text-[11px] text-muted-foreground">Бизнес<div className={`text-sm font-semibold ${scoreColor(c.business_value)}`}>{c.business_value}</div></div>
                    <div className="text-[11px] text-muted-foreground">Лёгкость<div className={`text-sm font-semibold ${scoreColor(c.ease)}`}>{c.ease}</div></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Commercial */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-500" /> Commercial white spaces
            <Hint text="Коммерческие страницы и сценарии, которые рынок недорабатывает." />
          </h3>
          {data.commercial_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Возможность</TableHead>
                  <TableHead>Сценарий</TableHead>
                  <TableHead>Page type</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Новый сайт</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.commercial_gaps.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium align-top">{c.opportunity}{c.comment && <div className="text-xs text-muted-foreground mt-1">{c.comment}</div>}</TableCell>
                    <TableCell className="text-xs align-top">{c.scenario}</TableCell>
                    <TableCell className="text-xs align-top">{c.best_page_type}</TableCell>
                    <TableCell className="align-top">{badgeFor(LVL_RU, c.revenue_potential)}</TableCell>
                    <TableCell className="align-top">{badgeFor(FIT_RU, c.fits_new_site)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>

        {/* AI */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bot className="w-4 h-4 text-teal-500" /> AI-search white spaces
            <Hint text="Где можно выиграть через retrieval-friendly и answer-first форматы." />
          </h3>
          {data.ai_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.ai_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="text-sm font-medium text-foreground">{c.opportunity}</div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Почему важно:</b> {c.why_ai_matters}</div>
                  <div className="text-xs text-primary"><b>Формат:</b> {c.needed_format}</div>
                  <div className="flex gap-2 pt-1">
                    <Badge variant="outline" className={LVL_RU[c.organic_upside]?.cls}>Organic: {LVL_RU[c.organic_upside]?.label}</Badge>
                    <Badge variant="outline" className={LVL_RU[c.ai_upside]?.cls}>AI: {LVL_RU[c.ai_upside]?.label}</Badge>
                  </div>
                  {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* False gaps */}
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Ложные white spaces
            <Hint text="Выглядят как возможность, но реально слабые ставки." />
          </h3>
          {data.false_gaps.length === 0 ? <p className="text-sm text-muted-foreground">—</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.false_gaps.map((c, i) => (
                <div key={i} className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 space-y-2">
                  <div className="text-sm font-semibold text-foreground">{c.fake_gap}</div>
                  <div className="text-xs text-muted-foreground"><b className="text-foreground/70">Выглядит как возможность:</b> {c.why_looks_like_opp}</div>
                  <div className="text-xs text-rose-500"><b>Почему слабая ставка:</b> {c.why_not_worth}</div>
                  {c.when_to_revisit && <div className="text-xs text-emerald-600 dark:text-emerald-400"><b>Когда вернуться:</b> {c.when_to_revisit}</div>}
                  {c.comment && <div className="text-xs text-muted-foreground">{c.comment}</div>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </TabsContent>

      {/* === PLAN === */}
      <TabsContent value="plan" className="space-y-5 mt-5">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          <PrioCol title="Запускать сейчас" items={data.prioritization.launch_now} color="bg-emerald-500" hint="Quick wins и активы, которые можно запускать в течение 30 дней." />
          <PrioCol title="В ближайший квартал" items={data.prioritization.launch_quarter} color="bg-blue-500" hint="Core активы под подготовленные ресурсы." />
          <PrioCol title="После роста авторитета" items={data.prioritization.after_authority} color="bg-violet-500" hint="Возможности, которые требуют trust/бренда." />
          <PrioCol title="При наличии ресурсов" items={data.prioritization.with_resources} color="bg-amber-500" hint="Big bets, требующие отдельных ресурсов или команд." />
          <PrioCol title="Не приоритет" items={data.prioritization.deprioritize} color="bg-rose-500" hint="Не вкладывать в ближайший цикл." />
        </div>
      </TabsContent>
    </Tabs>
  );
}