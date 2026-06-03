import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  HelpCircle, AlertCircle, Flame, Zap, Sparkles, Shield, Bot, Rocket,
  EyeOff, AlertTriangle, Users, Route, Layers, FileType, MessageSquare, Heart,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type RoadmapPhase = {
  problems_to_target: string[];
  assets_to_build: string[];
  expected_kpi?: string;
};

export type ProblemCluster = {
  name: string;
  segment: string;
  severity: number;
  urgency: number;
  recurrence: number;
  conversion_proximity: number;
  ai_upside: number;
  ai_downside: number;
  root_cause: string;
  real_language: string;
  best_page_type: string;
  comment: string;
};

export type JourneyStage = {
  stage: string;
  dominant_problems: string[];
  assets_needed: string[];
  business_value: 'low' | 'medium' | 'high' | string;
};

export type AudiencePainsData = {
  scoring: {
    overall_problem_opportunity: number;
    pain_intensity: number;
    monetization_relevance: number;
    trust_feasibility: number;
    ai_opportunity: number;
    reasoning: string;
  };
  executive_verdict: {
    overview: string;
    pain_driven_level: 'low' | 'medium' | 'high' | string;
    main_risk: string;
    main_opportunity: string;
    strategy_model: string;
  };
  top_lists: {
    core_problems: string[];
    high_conversion_problems: string[];
    quick_wins: string[];
    neglected_clusters: string[];
    trust_sensitive: string[];
    overhyped_avoid: string[];
    recommended_page_types: string[];
  };
  problem_clusters: ProblemCluster[];
  journey_stages: JourneyStage[];
  segments: { segment: string; main_problems: string[]; pain_language: string; content_implication: string }[];
  hidden_problems: { problem: string; why_hidden: string; how_to_close: string }[];
  false_problems: { problem: string; why_misleading: string; action: string }[];
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

export function normalizeAudiencePains(raw: any): AudiencePainsData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const ev = raw.executive_verdict || {};
  const tl = raw.top_lists || {};
  const rm = raw.roadmap || {};
  const phase = (p: any): RoadmapPhase => ({
    problems_to_target: arr(p?.problems_to_target),
    assets_to_build: arr(p?.assets_to_build),
    expected_kpi: str(p?.expected_kpi),
  });
  return {
    scoring: {
      overall_problem_opportunity: num(s.overall_problem_opportunity),
      pain_intensity: num(s.pain_intensity),
      monetization_relevance: num(s.monetization_relevance),
      trust_feasibility: num(s.trust_feasibility),
      ai_opportunity: num(s.ai_opportunity),
      reasoning: str(s.reasoning),
    },
    executive_verdict: {
      overview: str(ev.overview),
      pain_driven_level: (str(ev.pain_driven_level).toLowerCase() || 'medium'),
      main_risk: str(ev.main_risk),
      main_opportunity: str(ev.main_opportunity),
      strategy_model: str(ev.strategy_model) || 'hybrid',
    },
    top_lists: {
      core_problems: arr(tl.core_problems),
      high_conversion_problems: arr(tl.high_conversion_problems),
      quick_wins: arr(tl.quick_wins),
      neglected_clusters: arr(tl.neglected_clusters),
      trust_sensitive: arr(tl.trust_sensitive),
      overhyped_avoid: arr(tl.overhyped_avoid),
      recommended_page_types: arr(tl.recommended_page_types),
    },
    problem_clusters: Array.isArray(raw.problem_clusters) ? raw.problem_clusters.map((c: any) => ({
      name: str(c?.name),
      segment: str(c?.segment),
      severity: num(c?.severity),
      urgency: num(c?.urgency),
      recurrence: num(c?.recurrence),
      conversion_proximity: num(c?.conversion_proximity),
      ai_upside: num(c?.ai_upside),
      ai_downside: num(c?.ai_downside),
      root_cause: str(c?.root_cause),
      real_language: str(c?.real_language),
      best_page_type: str(c?.best_page_type),
      comment: str(c?.comment),
    })).filter((c: any) => c.name) : [],
    journey_stages: Array.isArray(raw.journey_stages) ? raw.journey_stages.map((j: any) => ({
      stage: str(j?.stage),
      dominant_problems: arr(j?.dominant_problems),
      assets_needed: arr(j?.assets_needed),
      business_value: (str(j?.business_value).toLowerCase() || 'medium'),
    })).filter((j: any) => j.stage) : [],
    segments: Array.isArray(raw.segments) ? raw.segments.map((sg: any) => ({
      segment: str(sg?.segment),
      main_problems: arr(sg?.main_problems),
      pain_language: str(sg?.pain_language),
      content_implication: str(sg?.content_implication),
    })).filter((sg: any) => sg.segment) : [],
    hidden_problems: Array.isArray(raw.hidden_problems) ? raw.hidden_problems.map((h: any) => ({
      problem: str(h?.problem),
      why_hidden: str(h?.why_hidden),
      how_to_close: str(h?.how_to_close),
    })).filter((h: any) => h.problem) : [],
    false_problems: Array.isArray(raw.false_problems) ? raw.false_problems.map((f: any) => ({
      problem: str(f?.problem),
      why_misleading: str(f?.why_misleading),
      action: (str(f?.action).toLowerCase() || 'reframe'),
    })).filter((f: any) => f.problem) : [],
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

const PAIN_DRIVEN_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкий', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  medium: { label: 'Средний', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  high: { label: 'Высокий', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
};

const BIZ_VAL_RU: Record<string, { label: string; cls: string }> = {
  low: { label: 'Низкая', cls: 'bg-muted text-muted-foreground' },
  medium: { label: 'Средняя', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  high: { label: 'Высокая', cls: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30' },
};

const ACTION_RU: Record<string, { label: string; cls: string }> = {
  ignore: { label: 'Игнорировать', cls: 'bg-rose-500/15 text-rose-500 border-rose-500/30' },
  downplay: { label: 'Снизить приоритет', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/30' },
  reframe: { label: 'Переформулировать', cls: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
};

export function AudiencePainsView({ data }: { data: AudiencePainsData }) {
  const chart = data.problem_clusters.slice(0, 8).map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + '…' : c.name,
    fullName: c.name,
    Severity: c.severity,
    Urgency: c.urgency,
    Conversion: c.conversion_proximity,
  }));

  return (
    <Tabs defaultValue="exec" className="space-y-5">
      <TabsList className="grid grid-cols-5 w-full max-w-3xl">
        <TabsTrigger value="exec">Главное</TabsTrigger>
        <TabsTrigger value="clusters">Кластеры</TabsTrigger>
        <TabsTrigger value="audience">Аудитория</TabsTrigger>
        <TabsTrigger value="hidden">Скрытые/Ложные</TabsTrigger>
        <TabsTrigger value="roadmap">Roadmap</TabsTrigger>
      </TabsList>

      {/* === EXEC === */}
      <TabsContent value="exec" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Problem Map</div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Scoring framework
                <Hint text="Оценка реальной ценности проблемного поля ниши с поправкой на trust, конверсию и AI-выдачу." />
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <ScoreRing value={data.scoring.overall_problem_opportunity} label="Overall Opportunity" color="hsl(217 91% 60%)" hint="Совокупная привлекательность problem-led стратегии в нише." />
            <ScoreRing value={data.scoring.pain_intensity} label="Pain Intensity" color="hsl(0 84% 60%)" hint="Сила реальной боли аудитории, а не объёма запросов." />
            <ScoreRing value={data.scoring.monetization_relevance} label="Monetization" color="hsl(142 76% 45%)" hint="Насколько проблемы конвертируются в деньги, а не только в трафик." />
            <ScoreRing value={data.scoring.trust_feasibility} label="Trust Feasibility" color="hsl(262 83% 65%)" hint="Реализуемость доверия: можно ли закрывать проблемы без сильной экспертной базы." />
            <ScoreRing value={data.scoring.ai_opportunity} label="AI Opportunity" color="hsl(173 80% 40%)" hint="Возможность взять цитирование в AI-выдаче и удержать клик при ответах на проблемы." />
          </div>
          {data.scoring.reasoning && <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.reasoning}</p>}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Executive verdict
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={PAIN_DRIVEN_RU[data.executive_verdict.pain_driven_level]?.cls || ''}>
              Уровень pain-driven: {PAIN_DRIVEN_RU[data.executive_verdict.pain_driven_level]?.label || data.executive_verdict.pain_driven_level}
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Модель: {data.executive_verdict.strategy_model}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Картина болей</div>
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
              <Flame className="w-4 h-4 text-rose-500" /> Core проблемы
              <Hint text="Главные проблемы, формирующие реальный спрос в нише." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.core_problems.map((t, i) => (
                <Badge key={i} className="bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.core_problems.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" /> Высокая конверсия
              <Hint text="Проблемы, ближе всего стоящие к деньгам и готовности купить." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.high_conversion_problems.map((t, i) => (
                <Badge key={i} className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.high_conversion_problems.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Rocket className="w-4 h-4 text-blue-500" /> Быстрые победы
              <Hint text="Проблемы, которые можно закрыть быстро и получить ранний результат." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.quick_wins.map((t, i) => (
                <Badge key={i} className="bg-blue-500/15 text-blue-500 border-blue-500/30 hover:bg-blue-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.quick_wins.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <EyeOff className="w-4 h-4 text-violet-500" /> Недоработанные кластеры
              <Hint text="Сильный спрос или боль, но плохое покрытие в выдаче. Окно для входа." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.neglected_clusters.map((t, i) => (
                <Badge key={i} className="bg-violet-500/15 text-violet-500 border-violet-500/30 hover:bg-violet-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.neglected_clusters.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-amber-500" /> Trust-sensitive
              <Hint text="Проблемы, которые нельзя закрывать без сильного доказательного слоя и экспертизы." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.trust_sensitive.map((t, i) => (
                <Badge key={i} className="bg-amber-500/15 text-amber-500 border-amber-500/30 hover:bg-amber-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.trust_sensitive.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> Переоценённые (избегать)
              <Hint text="Боли, которые рынок считает важными, но реальной ценности под ними нет." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.overhyped_avoid.map((t, i) => (
                <Badge key={i} className="bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.overhyped_avoid.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
        </div>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileType className="w-4 h-4 text-primary" /> Типы страниц для запуска
            <Hint text="Какие форматы страниц закрывают проблемное поле эффективнее всего." />
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.top_lists.recommended_page_types.map((t, i) => (
              <Badge key={i} variant="outline" className="border-primary/30 text-primary">{t}</Badge>
            ))}
            {data.top_lists.recommended_page_types.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </Card>
      </TabsContent>

      {/* === CLUSTERS === */}
      <TabsContent value="clusters" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Severity × Urgency × Conversion
            <Hint text="Сравнение силы боли, срочности и близости к деньгам по ключевым кластерам." />
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
                <Bar dataKey="Severity" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Urgency" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Conversion" fill="hsl(142 76% 45%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.problem_clusters.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Нет кластеров</p>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Кластеры проблем: root cause и язык аудитории
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Кластер</TableHead>
                <TableHead className="w-[14%]">Сегмент</TableHead>
                <TableHead className="w-[26%]">Root cause</TableHead>
                <TableHead className="w-[24%]">Реальный язык</TableHead>
                <TableHead>Тип страницы</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.problem_clusters.map((c, i) => (
                <TableRow key={i}>
                  <TableCell className="align-top">
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Sev <span className={scoreColor(c.severity)}>{c.severity}</span> · Urg <span className={scoreColor(c.urgency)}>{c.urgency}</span> · Conv <span className={scoreColor(c.conversion_proximity)}>{c.conversion_proximity}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{c.segment || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{c.root_cause || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top italic">«{c.real_language || '—'}»</TableCell>
                  <TableCell className="text-sm align-top">
                    {c.best_page_type ? <Badge variant="outline" className="border-primary/30 text-primary">{c.best_page_type}</Badge> : '—'}
                  </TableCell>
                </TableRow>
              ))}
              {data.problem_clusters.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* === AUDIENCE === */}
      <TabsContent value="audience" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" /> Проблемы по этапам пути клиента
            <Hint text="Какие боли доминируют на каждой стадии и какие assets их закрывают." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[18%]">Стадия</TableHead>
                <TableHead className="w-[34%]">Главные проблемы</TableHead>
                <TableHead className="w-[34%]">Нужные assets</TableHead>
                <TableHead>Бизнес-ценность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.journey_stages.map((j, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{j.stage}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {j.dominant_problems.map((p, pi) => <Badge key={pi} variant="secondary" className="text-[11px] font-normal">{p}</Badge>)}
                      {j.dominant_problems.length === 0 && '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {j.assets_needed.map((a, ai) => <Badge key={ai} variant="outline" className="text-[11px] font-normal border-border">{a}</Badge>)}
                      {j.assets_needed.length === 0 && '—'}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={BIZ_VAL_RU[j.business_value]?.cls || ''}>
                      {BIZ_VAL_RU[j.business_value]?.label || j.business_value}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.journey_stages.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Сегменты аудитории
            <Hint text="Разные сегменты страдают от разных проблем и описывают их по-разному." />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.segments.map((sg, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-primary" />
                  <h4 className="text-sm font-semibold text-foreground">{sg.segment}</h4>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {sg.main_problems.map((p, pi) => <Badge key={pi} variant="secondary" className="text-[11px] font-normal">{p}</Badge>)}
                </div>
                {sg.pain_language && (
                  <p className="text-xs text-foreground/80 italic leading-relaxed">«{sg.pain_language}»</p>
                )}
                {sg.content_implication && (
                  <p className="text-xs text-muted-foreground leading-relaxed">{sg.content_implication}</p>
                )}
              </div>
            ))}
            {data.segments.length === 0 && <p className="text-sm text-muted-foreground">Данных нет</p>}
          </div>
        </Card>
      </TabsContent>

      {/* === HIDDEN / FALSE === */}
      <TabsContent value="hidden" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-violet-500" /> Скрытые проблемы
            <Hint text="Боли, о которых люди не говорят прямо: страх, стыд, fear-of-wrong-choice, hidden complexity." />
          </h3>
          <div className="space-y-2">
            {data.hidden_problems.map((h, i) => (
              <Alert key={i} className="py-3 border-violet-500/30 bg-violet-500/5">
                <AlertDescription className="text-sm text-foreground/90 space-y-1">
                  <div className="font-medium text-foreground">{h.problem}</div>
                  <div className="text-xs text-muted-foreground">Почему скрыт: {h.why_hidden}</div>
                  <div className="text-xs text-foreground/80">Как закрывать: {h.how_to_close}</div>
                </AlertDescription>
              </Alert>
            ))}
            {data.hidden_problems.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Ложные / переоценённые проблемы
            <Hint text="Боли, которые рынок ошибочно считает ключевыми. Не путать с настоящим спросом." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30%]">Проблема</TableHead>
                <TableHead>Почему переоценена</TableHead>
                <TableHead className="w-[22%]">Действие</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.false_problems.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{f.problem}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{f.why_misleading}</TableCell>
                  <TableCell className="align-top">
                    <Badge variant="outline" className={ACTION_RU[f.action]?.cls || ''}>
                      {ACTION_RU[f.action]?.label || f.action}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {data.false_problems.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* === ROADMAP === */}
      <TabsContent value="roadmap" className="space-y-5 mt-5">
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Phased problem roadmap
            <Hint text="Какие проблемы закрывать сейчас, какие — позже, и какие assets под них нужны." />
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
                        <AlertCircle className="w-3 h-3" /> Проблемы таргетировать
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.problems_to_target.map((t, ti) => (
                          <Badge key={ti} variant="secondary" className="text-[11px] font-normal">{t}</Badge>
                        ))}
                        {phase.problems_to_target.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
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