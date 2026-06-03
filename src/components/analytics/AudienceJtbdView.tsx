import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  HelpCircle, Target, Sparkles, Shield, Bot, Rocket, Route, Layers,
  FileType, MessageSquare, Crown, AlertTriangle, Flame, Zap, EyeOff, Compass,
  Wind, Bell, Link2,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type RoadmapPhase = {
  jobs_to_target: string[];
  assets_to_build: string[];
  expected_kpi?: string;
};

export type JobItem = {
  name: string;
  type: string;
  progress_type: string;
  demand_score: number;
  conversion_fit: number;
  trust_threshold: number;
  ai_opportunity: number;
  feasibility_for_project: number;
  job_language: string;
  primary_problem: string;
  desired_outcomes: string[];
  best_page_types: string[];
  best_format: string;
  best_cta: string;
  verdict: 'pursue-now' | 'prepare' | 'monitor' | 'avoid' | string;
  comment: string;
};

export type ForceItem = { job_cluster: string; push: string; pull: string; habit: string; anxiety: string; messaging_implication: string };
export type TriggerItem = { trigger: string; who: string; search_signal: string; best_asset: string };
export type JourneyStage = { stage: string; dominant_jobs: string[]; needed_assets: string[]; business_value: string };
export type CompoundingItem = { chain: string; sequencing: string; cumulative_payoff: string };

export type AudienceJtbdData = {
  scoring: {
    overall_jtbd_opportunity: number;
    search_demand: number;
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
    top_jobs: string[];
    core_jobs: string[];
    high_conversion: string[];
    underserved: string[];
    trust_sensitive: string[];
    overhyped_avoid: string[];
    recommended_page_types: string[];
  };
  jobs: JobItem[];
  forces: ForceItem[];
  triggers: TriggerItem[];
  journey_stages: JourneyStage[];
  compounding: CompoundingItem[];
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

export function normalizeAudienceJtbd(raw: any): AudienceJtbdData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const ev = raw.executive_verdict || {};
  const tl = raw.top_lists || {};
  const rm = raw.roadmap || {};
  const phase = (p: any): RoadmapPhase => ({
    jobs_to_target: arr(p?.jobs_to_target),
    assets_to_build: arr(p?.assets_to_build),
    expected_kpi: str(p?.expected_kpi),
  });
  return {
    scoring: {
      overall_jtbd_opportunity: num(s.overall_jtbd_opportunity),
      search_demand: num(s.search_demand),
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
      top_jobs: arr(tl.top_jobs),
      core_jobs: arr(tl.core_jobs),
      high_conversion: arr(tl.high_conversion),
      underserved: arr(tl.underserved),
      trust_sensitive: arr(tl.trust_sensitive),
      overhyped_avoid: arr(tl.overhyped_avoid),
      recommended_page_types: arr(tl.recommended_page_types),
    },
    jobs: Array.isArray(raw.jobs) ? raw.jobs.map((c: any) => ({
      name: str(c?.name),
      type: str(c?.type),
      progress_type: str(c?.progress_type),
      demand_score: num(c?.demand_score),
      conversion_fit: num(c?.conversion_fit),
      trust_threshold: num(c?.trust_threshold),
      ai_opportunity: num(c?.ai_opportunity),
      feasibility_for_project: num(c?.feasibility_for_project),
      job_language: str(c?.job_language),
      primary_problem: str(c?.primary_problem),
      desired_outcomes: arr(c?.desired_outcomes),
      best_page_types: arr(c?.best_page_types),
      best_format: str(c?.best_format),
      best_cta: str(c?.best_cta),
      verdict: (str(c?.verdict).toLowerCase() || 'monitor'),
      comment: str(c?.comment),
    })).filter((c: any) => c.name) : [],
    forces: Array.isArray(raw.forces) ? raw.forces.map((f: any) => ({
      job_cluster: str(f?.job_cluster),
      push: str(f?.push),
      pull: str(f?.pull),
      habit: str(f?.habit),
      anxiety: str(f?.anxiety),
      messaging_implication: str(f?.messaging_implication),
    })).filter((f: any) => f.job_cluster) : [],
    triggers: Array.isArray(raw.triggers) ? raw.triggers.map((t: any) => ({
      trigger: str(t?.trigger),
      who: str(t?.who),
      search_signal: str(t?.search_signal),
      best_asset: str(t?.best_asset),
    })).filter((t: any) => t.trigger) : [],
    journey_stages: Array.isArray(raw.journey_stages) ? raw.journey_stages.map((j: any) => ({
      stage: str(j?.stage),
      dominant_jobs: arr(j?.dominant_jobs),
      needed_assets: arr(j?.needed_assets),
      business_value: (str(j?.business_value).toLowerCase() || 'medium'),
    })).filter((j: any) => j.stage) : [],
    compounding: Array.isArray(raw.compounding) ? raw.compounding.map((c: any) => ({
      chain: str(c?.chain),
      sequencing: str(c?.sequencing),
      cumulative_payoff: str(c?.cumulative_payoff),
    })).filter((c: any) => c.chain) : [],
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

const TYPE_RU: Record<string, string> = {
  functional: 'Функциональная',
  emotional: 'Эмоциональная',
  social: 'Социальная',
  decision: 'Выбор / решение',
  trust: 'Доверие',
  implementation: 'Внедрение',
  retention: 'Удержание',
  switching: 'Смена',
  troubleshooting: 'Решение проблем',
  optimization: 'Оптимизация',
};

export function AudienceJtbdView({ data }: { data: AudienceJtbdData }) {
  const chart = data.jobs.slice(0, 8).map((c) => ({
    name: c.name.length > 18 ? c.name.slice(0, 16) + '…' : c.name,
    fullName: c.name,
    Спрос: c.demand_score,
    Конверсия: c.conversion_fit,
    ИИ: c.ai_opportunity,
  }));

  return (
    <Tabs defaultValue="exec" className="space-y-5">
      <TabsList className="grid grid-cols-5 w-full max-w-3xl">
        <TabsTrigger value="exec">Главное</TabsTrigger>
        <TabsTrigger value="jobs">Задачи</TabsTrigger>
        <TabsTrigger value="forces">Силы и триггеры</TabsTrigger>
        <TabsTrigger value="journey">Путь и связки</TabsTrigger>
        <TabsTrigger value="roadmap">План</TabsTrigger>
      </TabsList>

      {/* === EXEC === */}
      <TabsContent value="exec" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Карта задач клиента</div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Оценка JTBD-ландшафта
                <Hint text="Оценка реальных задач, которые «нанимают» решать пользователи в нише, и их пригодности для бизнес-целей." />
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <ScoreRing value={data.scoring.overall_jtbd_opportunity} label="Итог" color="hsl(217 91% 60%)" hint="Совокупная привлекательность стратегии, построенной на задачах клиента." />
            <ScoreRing value={data.scoring.search_demand} label="Спрос" color="hsl(199 89% 48%)" hint="Поисковая видимость и объём запросов под эти задачи." />
            <ScoreRing value={data.scoring.business_value} label="Бизнес" color="hsl(142 76% 45%)" hint="Бизнес-ценность найденных задач." />
            <ScoreRing value={data.scoring.conversion_fit} label="Конверсия" color="hsl(38 92% 50%)" hint="Близость задач к деньгам и готовности купить." />
            <ScoreRing value={data.scoring.trust_feasibility} label="Доверие" color="hsl(262 83% 65%)" hint="Реализуемость доверия под эти задачи на текущем сайте." />
            <ScoreRing value={data.scoring.ai_opportunity} label="ИИ" color="hsl(173 80% 40%)" hint="Возможность забирать ИИ-выдачу через ответы на задачи." />
          </div>
          {data.scoring.reasoning && <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.reasoning}</p>}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Сводный вердикт
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={DIV_RU[data.executive_verdict.diversity_level]?.cls || ''}>
              Разнообразие задач: {DIV_RU[data.executive_verdict.diversity_level]?.label || data.executive_verdict.diversity_level}
            </Badge>
            <Badge variant="outline" className="border-primary/30 text-primary">
              Модель: {data.executive_verdict.strategy_model}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Картина задач</div>
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
              <Crown className="w-4 h-4 text-primary" /> Топ-10 задач
              <Hint text="10 сильнейших задач по совокупной привлекательности." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.top_jobs.map((t, i) => (
                <Badge key={i} variant="outline" className="border-primary/30 text-primary">{t}</Badge>
              ))}
              {data.top_lists.top_jobs.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Target className="w-4 h-4 text-emerald-500" /> Ключевые задачи (приоритет 1)
              <Hint text="Задачи, с которых начинать в первую очередь." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.core_jobs.map((t, i) => (
                <Badge key={i} className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.core_jobs.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" /> Высокая конверсия
              <Hint text="Задачи ближе всего к деньгам и готовности купить." />
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
              <EyeOff className="w-4 h-4 text-violet-500" /> Недообслуженные задачи
              <Hint text="Сильные задачи, которые рынок плохо закрывает. Окно для входа." />
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
              <Shield className="w-4 h-4 text-amber-500" /> Чувствительные к доверию
              <Hint text="Задачи с высоким порогом доверия. Нужны экспертиза и доказательства." />
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
              <Hint text="Задачи, которые рынок считает важными, но реальной ценности под ними нет." />
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
            <Hint text="Какие форматы страниц закрывают задачи эффективнее всего." />
          </h3>
          <div className="flex flex-wrap gap-2">
            {data.top_lists.recommended_page_types.map((t, i) => (
              <Badge key={i} variant="outline" className="border-primary/30 text-primary">{t}</Badge>
            ))}
            {data.top_lists.recommended_page_types.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          </div>
        </Card>
      </TabsContent>

      {/* === JOBS === */}
      <TabsContent value="jobs" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Спрос × Конверсия × ИИ по задачам
            <Hint text="Сравнение поискового спроса, близости к конверсии и ИИ-возможности." />
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
                <Bar dataKey="Спрос" fill="hsl(199 89% 48%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Конверсия" fill="hsl(38 92% 50%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ИИ" fill="hsl(173 80% 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.jobs.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Нет задач</p>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.jobs.map((jb, i) => (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    {TYPE_RU[jb.type] || jb.type}
                  </div>
                  <h4 className="text-base font-semibold text-foreground flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" /> {jb.name}
                  </h4>
                  {jb.progress_type && (
                    <div className="text-xs text-muted-foreground mt-0.5">Прогресс: {jb.progress_type}</div>
                  )}
                </div>
                <Badge variant="outline" className={VERDICT_RU[jb.verdict]?.cls || ''}>
                  {VERDICT_RU[jb.verdict]?.label || jb.verdict}
                </Badge>
              </div>
              <div className="grid grid-cols-5 gap-1.5 text-center">
                {[
                  ['Спрос', jb.demand_score],
                  ['Конв', jb.conversion_fit],
                  ['Доверие', jb.trust_threshold],
                  ['ИИ', jb.ai_opportunity],
                  ['Подход', jb.feasibility_for_project],
                ].map(([l, v], k) => (
                  <div key={k} className="rounded-md border border-border p-1.5">
                    <div className={`text-sm font-bold tabular-nums ${scoreColor(v as number)}`}>{v}</div>
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</div>
                  </div>
                ))}
              </div>
              {jb.job_language && (
                <p className="text-xs italic text-foreground/80 leading-relaxed">«{jb.job_language}»</p>
              )}
              {jb.primary_problem && (
                <div className="rounded-md border border-rose-500/20 bg-rose-500/5 px-3 py-2 text-xs text-foreground/90">
                  <span className="font-medium text-rose-500">Проблема: </span>{jb.primary_problem}
                </div>
              )}
              {jb.desired_outcomes.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Желаемые результаты
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {jb.desired_outcomes.map((o, oi) => <Badge key={oi} variant="outline" className="text-[11px] font-normal border-emerald-500/30 text-emerald-500">{o}</Badge>)}
                  </div>
                </div>
              )}
              {jb.best_page_types.length > 0 && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 flex items-center gap-1">
                    <FileType className="w-3 h-3" /> Типы страниц
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {jb.best_page_types.map((p, pi) => <Badge key={pi} variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">{p}</Badge>)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                {jb.best_format && (
                  <div><span className="text-muted-foreground">Формат: </span><span className="text-foreground/90 font-medium">{jb.best_format}</span></div>
                )}
                {jb.best_cta && (
                  <div><span className="text-muted-foreground">CTA: </span><span className="text-foreground/90 font-medium">{jb.best_cta}</span></div>
                )}
              </div>
              {jb.comment && <p className="text-xs text-muted-foreground leading-relaxed">{jb.comment}</p>}
            </Card>
          ))}
          {data.jobs.length === 0 && <p className="text-sm text-muted-foreground">Данных нет</p>}
        </div>
      </TabsContent>

      {/* === FORCES + TRIGGERS === */}
      <TabsContent value="forces" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wind className="w-4 h-4 text-primary" /> Силы прогресса
            <Hint text="Что толкает пользователя к новому решению, а что удерживает на старом. Используется в messaging и дизайне страниц." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Кластер задач</TableHead>
                <TableHead className="w-[18%]">Толкает (Push)</TableHead>
                <TableHead className="w-[18%]">Тянет (Pull)</TableHead>
                <TableHead className="w-[16%]">Привычка</TableHead>
                <TableHead className="w-[16%]">Тревога</TableHead>
                <TableHead>Что показать в copy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.forces.map((f, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{f.job_cluster}</TableCell>
                  <TableCell className="text-sm align-top">{f.push || '—'}</TableCell>
                  <TableCell className="text-sm align-top">{f.pull || '—'}</TableCell>
                  <TableCell className="text-sm align-top text-muted-foreground">{f.habit || '—'}</TableCell>
                  <TableCell className="text-sm align-top text-muted-foreground">{f.anxiety || '—'}</TableCell>
                  <TableCell className="text-sm align-top">{f.messaging_implication || '—'}</TableCell>
                </TableRow>
              ))}
              {data.forces.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" /> Триггеры активации задач
            <Hint text="Моменты, когда задача становится острой и пользователь начинает искать решение." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[26%]">Триггер</TableHead>
                <TableHead className="w-[22%]">Кто ощущает</TableHead>
                <TableHead className="w-[26%]">Поисковый сигнал</TableHead>
                <TableHead>Лучший материал</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.triggers.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{t.trigger}</TableCell>
                  <TableCell className="text-sm align-top">{t.who || '—'}</TableCell>
                  <TableCell className="text-sm align-top italic text-foreground/80">{t.search_signal || '—'}</TableCell>
                  <TableCell className="text-sm align-top">{t.best_asset || '—'}</TableCell>
                </TableRow>
              ))}
              {data.triggers.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </TabsContent>

      {/* === JOURNEY + COMPOUNDING === */}
      <TabsContent value="journey" className="space-y-5 mt-5">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="w-4 h-4 text-primary" /> Задачи по этапам пути клиента
            <Hint text="Какие задачи доминируют на каждой стадии и какие материалы их закрывают." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">Стадия</TableHead>
                <TableHead className="w-[34%]">Доминирующие задачи</TableHead>
                <TableHead className="w-[28%]">Нужные материалы</TableHead>
                <TableHead>Ценность</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.journey_stages.map((j, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{j.stage}</TableCell>
                  <TableCell className="align-top">
                    <div className="flex flex-wrap gap-1">
                      {j.dominant_jobs.map((p, pi) => <Badge key={pi} variant="secondary" className="text-[11px] font-normal">{p}</Badge>)}
                      {j.dominant_jobs.length === 0 && '—'}
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
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" /> Усиливающие связки задач
            <Hint text="Цепочки задач, которые работают сильнее вместе, чем по отдельности (диагностика → выбор → внедрение)." />
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.compounding.map((c, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" /> {c.chain}
                </h4>
                {c.sequencing && (
                  <div className="text-xs text-muted-foreground">
                    <span className="text-foreground/80 font-medium">Порядок: </span>{c.sequencing}
                  </div>
                )}
                {c.cumulative_payoff && (
                  <div className="text-xs text-emerald-500/90">
                    <Flame className="w-3 h-3 inline mr-1" />
                    {c.cumulative_payoff}
                  </div>
                )}
              </div>
            ))}
            {data.compounding.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
          </div>
        </Card>
      </TabsContent>

      {/* === ROADMAP === */}
      <TabsContent value="roadmap" className="space-y-5 mt-5">
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Поэтапный план по задачам
            <Hint text="Какие задачи закрывать сейчас, какие — позже, и какие материалы под них нужны." />
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
                        <Target className="w-3 h-3" /> Задачи закрывать
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.jobs_to_target.map((t, ti) => (
                          <Badge key={ti} variant="secondary" className="text-[11px] font-normal">{t}</Badge>
                        ))}
                        {phase.jobs_to_target.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                        <FileType className="w-3 h-3" /> Материалы создавать
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.assets_to_build.map((t, ti) => (
                          <Badge key={ti} variant="outline" className="text-[11px] font-normal border-primary/30 text-primary">{t}</Badge>
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