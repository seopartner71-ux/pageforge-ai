import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  HelpCircle, Users, Sparkles, Shield, Bot, Rocket, Target, Route, Layers,
  FileType, MessageSquare, Crown, AlertTriangle, Flame, Zap, EyeOff, Compass,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type RoadmapPhase = {
  segments_to_target: string[];
  assets_to_build: string[];
  expected_kpi?: string;
};

export type SegmentItem = {
  name: string;
  type: string;
  business_value: number;
  conversion_fit: number;
  trust_threshold: number;
  ai_opportunity: number;
  feasibility_for_project: number;
  sophistication: string;
  knowledge_level: string;
  real_language: string;
  core_problems: string[];
  desired_outcomes: string[];
  best_page_types: string[];
  best_cta: string;
  verdict: 'pursue-now' | 'prepare' | 'monitor' | 'avoid' | string;
  comment: string;
};

export type JtbdSegment = { segment: string; job: string; search_driven: string; monetization: string; best_asset: string };
export type JourneyStage = { stage: string; active_segments: string[]; most_valuable: string[]; needed_assets: string[]; business_value: string };
export type Wedge = { wedge: string; segment: string; why_attractive: string; needed_assets: string[]; fit_for_project: string };

export type AudienceSegmentsData = {
  scoring: {
    overall_segment_attractiveness: number;
    market_relevance: number;
    business_value: number;
    conversion_fit: number;
    trust_feasibility: number;
    ai_opportunity: number;
    reasoning: string;
  };
  executive_verdict: {
    overview: string;
    diversity_level: string;
    main_risk: string;
    main_opportunity: string;
    strategy_model: string;
  };
  top_lists: {
    top_segments: string[];
    core_targets: string[];
    high_conversion: string[];
    underserved: string[];
    trust_sensitive: string[];
    overhyped_avoid: string[];
    recommended_page_types: string[];
  };
  segments: SegmentItem[];
  jtbd_segments: JtbdSegment[];
  journey_stages: JourneyStage[];
  wedges: Wedge[];
  roadmap: {
    first_30_days: RoadmapPhase;
    first_quarter: RoadmapPhase;
    months_6_to_12: RoadmapPhase;
    months_12_to_24: RoadmapPhase;
  };
};

const arr = (x: any): string[] => Array.isArray(x) ? x.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
const num = (x: any, def = 0): number => {
  const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def;
};
const str = (x: any) => String(x ?? '').trim();

export function normalizeAudienceSegments(raw: any): AudienceSegmentsData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const ev = raw.executive_verdict || {};
  const tl = raw.top_lists || {};
  const rm = raw.roadmap || {};
  const phase = (p: any): RoadmapPhase => ({
    segments_to_target: arr(p?.segments_to_target),
    assets_to_build: arr(p?.assets_to_build),
    expected_kpi: str(p?.expected_kpi),
  });
  return {
    scoring: {
      overall_segment_attractiveness: num(s.overall_segment_attractiveness),
      market_relevance: num(s.market_relevance),
      business_value: num(s.business_value),
      conversion_fit: num(s.conversion_fit),
      trust_feasibility: num(s.trust_feasibility),
      ai_opportunity: num(s.ai_opportunity),
      reasoning: str(s.reasoning),
    },
    executive_verdict: {
      overview: str(ev.overview),
      diversity_level: (str(ev.diversity_level).toLowerCase() || 'medium'),
      main_risk: str(ev.main_risk),
      main_opportunity: str(ev.main_opportunity),
      strategy_model: str(ev.strategy_model) || 'hybrid',
    },
    top_lists: {
      top_segments: arr(tl.top_segments),
      core_targets: arr(tl.core_targets),
      high_conversion: arr(tl.high_conversion),
      underserved: arr(tl.underserved),
      trust_sensitive: arr(tl.trust_sensitive),
      overhyped_avoid: arr(tl.overhyped_avoid),
      recommended_page_types: arr(tl.recommended_page_types),
    },
    segments: Array.isArray(raw.segments) ? raw.segments.map((c: any) => ({
      name: str(c?.name),
      type: str(c?.type),
      business_value: num(c?.business_value),
      conversion_fit: num(c?.conversion_fit),
      trust_threshold: num(c?.trust_threshold),
      ai_opportunity: num(c?.ai_opportunity),
      feasibility_for_project: num(c?.feasibility_for_project),
      sophistication: (str(c?.sophistication).toLowerCase() || 'informed'),
      knowledge_level: str(c?.knowledge_level),
      real_language: str(c?.real_language),
      core_problems: arr(c?.core_problems),
      desired_outcomes: arr(c?.desired_outcomes),
      best_page_types: arr(c?.best_page_types),
      best_cta: str(c?.best_cta),
      verdict: (str(c?.verdict).toLowerCase() || 'monitor'),
      comment: str(c?.comment),
    })).filter((c: any) => c.name) : [],
    jtbd_segments: Array.isArray(raw.jtbd_segments) ? raw.jtbd_segments.map((j: any) => ({
      segment: str(j?.segment),
      job: str(j?.job),
      search_driven: (str(j?.search_driven).toLowerCase() || 'medium'),
      monetization: (str(j?.monetization).toLowerCase() || 'medium'),
      best_asset: str(j?.best_asset),
    })).filter((j: any) => j.segment) : [],
    journey_stages: Array.isArray(raw.journey_stages) ? raw.journey_stages.map((j: any) => ({
      stage: str(j?.stage),
      active_segments: arr(j?.active_segments),
      most_valuable: arr(j?.most_valuable),
      needed_assets: arr(j?.needed_assets),
      business_value: (str(j?.business_value).toLowerCase() || 'medium'),
    })).filter((j: any) => j.stage) : [],
    wedges: Array.isArray(raw.wedges) ? raw.wedges.map((w: any) => ({
      wedge: str(w?.wedge),
      segment: str(w?.segment),
      why_attractive: str(w?.why_attractive),
      needed_assets: arr(w?.needed_assets),
      fit_for_project: (str(w?.fit_for_project).toLowerCase() || 'medium'),
    })).filter((w: any) => w.wedge) : [],
    roadmap: {
      first_30_days: phase(rm.first_30_days),
      first_quarter: phase(rm.first_quarter),
      months_6_to_12: phase(rm.months_6_to_12),
      months_12_to_24: phase(rm.months_12_to_24),
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
        <div className={`absolute inset-0 flex items-center justify-center text-2xl font-bold tabular-nums ${scoreColor(value)}`}>
          {value}
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-center">
        <span className="text-[11px] uppercase tracking-wider font-medium text-muted-foreground">{label}</span>
        <Hint text={hint} />
      </div>
    </div>
  );
}

const DIV_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкое', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  medium: { label: 'Среднее', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  high: { label: 'Высокое', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
};

const VAL_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкая', cls: 'bg-muted text-muted-foreground' },
  medium: { label: 'Средняя', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  high: { label: 'Высокая', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
};

const VERDICT_RU: Record<string, { label: string; cls: string }> = {
  'pursue-now': { label: 'Брать сейчас', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
  'prepare': { label: 'Готовить', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  'monitor': { label: 'Мониторить', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  'avoid': { label: 'Избегать', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
};

const SOPH_RU: Record<string, string> = {
  novice: 'Новичок',
  informed: 'Информированный',
  advanced: 'Продвинутый',
  expert: 'Эксперт',
};

export function AudienceSegmentsView({ data }: { data: AudienceSegmentsData }) {
  const chart = data.segments.slice(0, 8).map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + '…' : c.name,
    fullName: c.name,
    Бизнес: c.business_value,
    Конверсия: c.conversion_fit,
    AI: c.ai_opportunity,
  }));

  return (
    <Tabs defaultValue="exec" className="space-y-5">
      <TabsList className="grid grid-cols-5 w-full max-w-3xl">
        <TabsTrigger value="exec">Главное</TabsTrigger>
        <TabsTrigger value="segments">Сегменты</TabsTrigger>
        <TabsTrigger value="journey">Путь и JTBD</TabsTrigger>
        <TabsTrigger value="wedges">Wedges</TabsTrigger>
        <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
      </TabsList>

      {/* === EXEC === */}
      <TabsContent value="exec" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Segmentation Map</div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Scoring framework
                <Hint text="Оценка привлекательности сегментной структуры ниши и её соответствия бизнес-целям." />
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <ScoreRing value={data.scoring.overall_segment_attractiveness} label="Overall" color="hsl(217 91% 60%)" hint="Совокупная привлекательность segment-led стратегии." />
            <ScoreRing value={data.scoring.market_relevance} label="Market" color="hsl(199 89% 48%)" hint="Релевантность сегментов реальному рынку." />
            <ScoreRing value={data.scoring.business_value} label="Business" color="hsl(142 76% 45%)" hint="Бизнес-ценность найденных сегментов." />
            <ScoreRing value={data.scoring.conversion_fit} label="Conversion" color="hsl(38 92% 50%)" hint="Близость сегментов к деньгам и готовности купить." />
            <ScoreRing value={data.scoring.trust_feasibility} label="Trust" color="hsl(262 83% 65%)" hint="Реализуемость доверия для сегментов на текущем сайте." />
            <ScoreRing value={data.scoring.ai_opportunity} label="AI" color="hsl(173 80% 40%)" hint="Возможность брать AI-выдачу через сегментные ответы." />
          </div>
          {data.scoring.reasoning && <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.reasoning}</p>}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Executive verdict
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={DIV_RU[data.executive_verdict.diversity_level]?.cls || ''}>
              Сегментное разнообразие: {DIV_RU[data.executive_verdict.diversity_level]?.label || data.executive_verdict.diversity_level}
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Модель: {data.executive_verdict.strategy_model}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Картина сегментов</div>
              <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_verdict.overview || '—'}</p>
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
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Crown className="w-4 h-4 text-primary" /> Топ-10 сегментов
              <Hint text="10 сильнейших сегментов по совокупной привлекательности." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.top_segments.map((t, i) => (
                <Badge key={i} variant="outline" className="border-primary/30 text-primary">{t}</Badge>
              ))}
              {data.top_lists.top_segments.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" /> Core targets (приоритет 1)
              <Hint text="Сегменты, с которых начинать в первую очередь." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.core_targets.map((t, i) => (
                <Badge key={i} className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.core_targets.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" /> Высокая конверсия
              <Hint text="Сегменты ближе всего к деньгам и готовности купить." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.high_conversion.map((t, i) => (
                <Badge key={i} className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.high_conversion.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-violet-500" /> Underserved сегменты
              <Hint text="Сильные сегменты, которые рынок плохо обслуживает. Окно для входа." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.underserved.map((t, i) => (
                <Badge key={i} className="bg-violet-500/15 text-violet-500 border-violet-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.underserved.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" /> Trust-sensitive сегменты
              <Hint text="Сегменты с высоким порогом доверия. Нужны экспертиза и доказательства." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.trust_sensitive.map((t, i) => (
                <Badge key={i} className="bg-amber-500/15 text-amber-500 border-amber-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.trust_sensitive.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> Переоценённые (избегать)
              <Hint text="Сегменты, которые рынок считает важными, но реальной ценности под ними нет." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.overhyped_avoid.map((t, i) => (
                <Badge key={i} className="bg-rose-500/15 text-rose-500 border-rose-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.overhyped_avoid.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileType className="w-4 h-4 text-primary" /> Типы страниц для запуска
            <Hint text="Какие форматы страниц закрывают сегментную структуру эффективнее всего." />
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.top_lists.recommended_page_types.map((t, i) => (
              <Badge key={i} variant="outline" className="border-primary/30 text-primary">{t}</Badge>
            ))}
            {data.top_lists.recommended_page_types.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </Card>
      </TabsContent>

      {/* === SEGMENTS === */}
      <TabsContent value="segments" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Бизнес × Конверсия × AI по сегментам
            <Hint text="Сравнение бизнес-ценности, близости к конверсии и AI-возможности." />
          </h3>
          <div className="w-full h-[360px]">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <ReTooltip
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(_, p) => (p && p[0] ? (p[0].payload as any).fullName : '')}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Бизнес" fill="hsl(142 76% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Конверсия" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="AI" fill="hsl(173 80% 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.segments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Нет сегментов</p>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.segments.map((sg, i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{sg.type}</div>
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" /> {sg.name}
                  </h4>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    Зрелость: {SOPH_RU[sg.sophistication] || sg.sophistication}{sg.knowledge_level ? ` · ${sg.knowledge_level}` : ''}
                  </div>
                </div>
                <Badge variant="outline" className={VERDICT_RU[sg.verdict]?.cls || ''}>
                  {VERDICT_RU[sg.verdict]?.label || sg.verdict}
                </Badge>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  ['Бизнес', sg.business_value],
                  ['Конв', sg.conversion_fit],
                  ['Trust', sg.trust_threshold],
                  ['AI', sg.ai_opportunity],
                  ['Fit', sg.feasibility_for_project],
                ].map(([l, v], k) => (
                  <div key={k} className="rounded-md border border-border p-1.5">
                    <div className={`text-sm font-bold tabular-nums ${scoreColor(v as number)}`}>{v}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              {sg.real_language && (
                <p className="text-xs italic text-foreground/80 leading-relaxed">«{sg.real_language}»</p>
              )}
              {sg.core_problems.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Flame className="w-3 h-3" /> Core проблемы
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sg.core_problems.map((p, pi) => <Badge key={pi} variant="secondary" className="text-[11px] font-normal">{p}</Badge>)}
                  </div>
                </div>
              )}
              {sg.desired_outcomes.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Желаемые результаты
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sg.desired_outcomes.map((o, oi) => <Badge key={oi} variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-500">{o}</Badge>)}
                  </div>
                </div>
              )}
              {sg.best_page_types.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <FileType className="w-3 h-3" /> Типы страниц
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sg.best_page_types.map((p, pi) => <Badge key={pi} variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">{p}</Badge>)}
                  </div>
                </div>
              )}
              {sg.best_cta && (
                <div className="text-xs">
                  <span className="text-muted-foreground">CTA: </span>
                  <span className="text-foreground/90 font-medium">{sg.best_cta}</span>
                </div>
              )}
              {sg.comment && <p className="text-xs text-muted-foreground leading-relaxed">{sg.comment}</p>}
            </Card>
          ))}
          {data.segments.length === 0 && <p className="text-sm text-muted-foreground">Данных нет</p>}
        </div>
      </TabsContent>

      {/* === JOURNEY + JTBD === */}
      <TabsContent value="journey" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" /> Сегменты по этапам пути клиента
            <Hint text="Какие сегменты доминируют на каждой стадии и какие assets их закрывают." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Стадия</TableHead>
                <TableHead className="w-[28%]">Активные сегменты</TableHead>
                <TableHead className="w-[22%]">Самые ценные</TableHead>
                <TableHead className="w-[22%]">Нужные assets</TableHead>
                <TableHead>Ценность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.journey_stages.map((j, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{j.stage}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {j.active_segments.map((p, pi) => <Badge key={pi} variant="secondary" className="text-[11px] font-normal">{p}</Badge>)}
                      {j.active_segments.length === 0 && '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {j.most_valuable.map((p, pi) => <Badge key={pi} variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-500">{p}</Badge>)}
                      {j.most_valuable.length === 0 && '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {j.needed_assets.map((a, ai) => <Badge key={ai} variant="outline" className="text-[11px] font-normal border-border">{a}</Badge>)}
                      {j.needed_assets.length === 0 && '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={VAL_RU[j.business_value]?.cls || ''}>
                      {VAL_RU[j.business_value]?.label || j.business_value}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.journey_stages.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> JTBD-сегменты
            <Hint text="Сегменты, сформированные не по профилю, а по реальной работе, которую они «нанимают» делать." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Сегмент</TableHead>
                <TableHead className="w-[38%]">Job (что нужно сделать)</TableHead>
                <TableHead>Search-driven</TableHead>
                <TableHead>Монетизация</TableHead>
                <TableHead>Best asset</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.jtbd_segments.map((j, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{j.segment}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{j.job || '—'}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={VAL_RU[j.search_driven]?.cls || ''}>{VAL_RU[j.search_driven]?.label || j.search_driven}</Badge>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={VAL_RU[j.monetization]?.cls || ''}>{VAL_RU[j.monetization]?.label || j.monetization}</Badge>
                  </TableCell>
                  <TableCell className="text-sm align-top">{j.best_asset || '—'}</TableCell>
                </TableRow>
              ))}
              {data.jtbd_segments.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* === WEDGES === */}
      <TabsContent value="wedges" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" /> Сегментные wedges (точки входа)
            <Hint text="Узкие сегменты, через которые можно зайти на рынок, минуя сильных конкурентов." />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.wedges.map((w, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{w.wedge}</h4>
                  <Badge variant="outline" className={VAL_RU[w.fit_for_project]?.cls || ''}>
                    Fit: {VAL_RU[w.fit_for_project]?.label || w.fit_for_project}
                  </Badge>
                </div>
                {w.segment && (
                  <div className="text-xs text-muted-foreground">Сегмент: <span className="text-foreground/90">{w.segment}</span></div>
                )}
                {w.why_attractive && (
                  <p className="text-sm text-foreground/90 leading-relaxed">{w.why_attractive}</p>
                )}
                {w.needed_assets.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {w.needed_assets.map((a, ai) => <Badge key={ai} variant="outline" className="text-[11px] font-normal border-border">{a}</Badge>)}
                  </div>
                )}
              </div>
            ))}
            {data.wedges.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </Card>
      </TabsContent>

      {/* === ROADMAP === */}
      <TabsContent value="roadmap" className="space-y-5 mt-5">
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Phased segment roadmap
            <Hint text="Какие сегменты таргетировать сейчас, какие — позже, и какие assets под них нужны." />
          </h3>
          <div className="space-y-3">
            {(
              [
                ['Первые 30 дней', data.roadmap.first_30_days, 'bg-emerald-500'],
                ['Первый квартал', data.roadmap.first_quarter, 'bg-blue-500'],
                ['6-12 месяцев', data.roadmap.months_6_to_12, 'bg-violet-500'],
                ['12-24 месяца', data.roadmap.months_12_to_24, 'bg-amber-500'],
              ] as [string, RoadmapPhase, string][]
            ).map(([label, phase, color], i) => (
              <div key={i} className="relative pl-6">
                <div className={`absolute left-0 top-1.5 w-3 h-3 rounded-full ${color} ring-4 ring-background`} />
                {i < 3 && <div className="absolute left-1.5 top-5 bottom-[-12px] w-px bg-border" />}
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                    {phase.expected_kpi && (
                      <Badge variant="outline" className="border-primary/30 text-primary">KPI: {phase.expected_kpi}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" /> Сегменты таргетировать
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.segments_to_target.map((t, ti) => (
                          <Badge key={ti} variant="secondary" className="text-[11px] font-normal">{t}</Badge>
                        ))}
                        {phase.segments_to_target.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                        <Bot className="w-3 h-3" /> Assets строить
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.assets_to_build.map((a, ai) => (
                          <Badge key={ai} variant="outline" className="text-[11px] font-normal border-border">{a}</Badge>
                        ))}
                        {phase.assets_to_build.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </TabsContent>
    </Tabs>
  );
}