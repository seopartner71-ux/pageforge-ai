import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  HelpCircle, Flame, Zap, AlertTriangle, ArrowUpRight, Sparkles,
  Shield, Brain, Rocket, TrendingUp, Compass, Users, Bot,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip, ResponsiveContainer, Legend,
} from 'recharts';

export type TrendsData = {
  scoring: {
    overall_opportunity: number;
    durability: number;
    ai_relevance: number;
    early_mover_advantage: number;
    reasoning: string;
  };
  executive_verdict: { overview: string; main_risk: string; main_opportunity: string };
  top_lists: {
    act_now_trends: string[];
    early_mover_wedges: string[];
    hype_traps: string[];
  };
  market_shifts: {
    durable_shifts: { shift: string; why_it_matters: string; seo_adaptation: string }[];
    format_trends: string[];
    audience_behavior: string[];
  };
  ai_and_trust: {
    ai_trends: { segment: string; ai_upside_score: number; ai_downside_score: number }[];
    trust_expectations: string;
  };
  roadmap: {
    first_30_days: RoadmapPhase;
    first_quarter: RoadmapPhase;
    months_6_to_12: RoadmapPhase;
    months_12_to_24: RoadmapPhase;
  };
};
export type RoadmapPhase = {
  trends_to_activate: string[];
  assets_to_build: string[];
  expected_kpi?: string;
};

const arr = (x: any): string[] => Array.isArray(x) ? x.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
const num = (x: any, def = 0): number => {
  const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def;
};
const str = (x: any) => String(x ?? '').trim();

export function normalizeTrends(raw: any): TrendsData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const ev = raw.executive_verdict || {};
  const tl = raw.top_lists || {};
  const ms = raw.market_shifts || {};
  const at = raw.ai_and_trust || {};
  const rm = raw.roadmap || {};
  const phase = (p: any): RoadmapPhase => ({
    trends_to_activate: arr(p?.trends_to_activate),
    assets_to_build: arr(p?.assets_to_build),
    expected_kpi: str(p?.expected_kpi),
  });
  return {
    scoring: {
      overall_opportunity: num(s.overall_opportunity),
      durability: num(s.durability),
      ai_relevance: num(s.ai_relevance),
      early_mover_advantage: num(s.early_mover_advantage),
      reasoning: str(s.reasoning),
    },
    executive_verdict: {
      overview: str(ev.overview),
      main_risk: str(ev.main_risk),
      main_opportunity: str(ev.main_opportunity),
    },
    top_lists: {
      act_now_trends: arr(tl.act_now_trends),
      early_mover_wedges: arr(tl.early_mover_wedges),
      hype_traps: arr(tl.hype_traps),
    },
    market_shifts: {
      durable_shifts: Array.isArray(ms.durable_shifts) ? ms.durable_shifts.map((d: any) => ({
        shift: str(d?.shift),
        why_it_matters: str(d?.why_it_matters),
        seo_adaptation: str(d?.seo_adaptation),
      })).filter((d: any) => d.shift) : [],
      format_trends: arr(ms.format_trends),
      audience_behavior: arr(ms.audience_behavior),
    },
    ai_and_trust: {
      ai_trends: Array.isArray(at.ai_trends) ? at.ai_trends.map((a: any) => ({
        segment: str(a?.segment),
        ai_upside_score: num(a?.ai_upside_score),
        ai_downside_score: num(a?.ai_downside_score),
      })).filter((a: any) => a.segment) : [],
      trust_expectations: str(at.trust_expectations),
    },
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
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="rounded-lg border border-border p-4 flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
          <circle cx="50" cy="50" r={r} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" />
          <circle
            cx="50" cy="50" r={r}
            stroke={color} strokeWidth="8" fill="none"
            strokeDasharray={c} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 800ms ease' }}
          />
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

export function TrendsView({ data }: { data: TrendsData }) {
  const aiChart = data.ai_and_trust.ai_trends.map((a) => ({
    name: a.segment.length > 18 ? a.segment.slice(0, 16) + '…' : a.segment,
    fullName: a.segment,
    Upside: a.ai_upside_score,
    Downside: a.ai_downside_score,
  }));

  return (
    <Tabs defaultValue="exec" className="space-y-5">
      <TabsList className="grid grid-cols-4 w-full max-w-3xl">
        <TabsTrigger value="exec">Главное</TabsTrigger>
        <TabsTrigger value="shifts">Сдвиги и сигналы</TabsTrigger>
        <TabsTrigger value="ai">AI и Trust</TabsTrigger>
        <TabsTrigger value="roadmap">Дорожная карта</TabsTrigger>
      </TabsList>

      {/* === EXEC === */}
      <TabsContent value="exec" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Trend Landscape</div>
              <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                Scoring framework
                <Hint text="Четыре оси 0-100. Не объём хайпа, а оценка реальной долговечности тренда и окна возможностей." />
              </h3>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreRing value={data.scoring.overall_opportunity} label="Overall Opportunity" color="hsl(142 76% 45%)" hint="Совокупная привлекательность трендов в нише с поправкой на долговечность, AI и окно входа." />
            <ScoreRing value={data.scoring.durability} label="Durability" color="hsl(217 91% 60%)" hint="Долговечность: насколько эти тренды структурные, а не хайповые. 90+ = надолго." />
            <ScoreRing value={data.scoring.ai_relevance} label="AI Relevance" color="hsl(262 83% 65%)" hint="Насколько ниша смещается в сторону AI-выдачи и AI-помощников." />
            <ScoreRing value={data.scoring.early_mover_advantage} label="Early-Mover Advantage" color="hsl(160 84% 45%)" hint="Размер форы для тех, кто войдёт первым. 80+ = окно открыто, бежать сейчас." />
          </div>
          {data.scoring.reasoning && (
            <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.reasoning}</p>
          )}
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> Executive verdict
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-4 space-y-2">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Картина трендов</div>
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
              <Flame className="w-4 h-4 text-emerald-500" /> Act-Now тренды
              <Hint text="Тренды, на которые имеет смысл реагировать сейчас: уже есть спрос, ещё нет переполненной выдачи." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.act_now_trends.map((t, i) => (
                <Badge key={i} className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.act_now_trends.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-500" /> Early-Mover wedges
              <Hint text="Узкие точки входа, через которые можно занять нишу до конкурентов." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.early_mover_wedges.map((t, i) => (
                <Badge key={i} className="bg-blue-500/15 text-blue-500 border-blue-500/30 hover:bg-blue-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.early_mover_wedges.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" /> Hype traps (избегать)
              <Hint text="Тренды, которые выглядят громко, но умрут за 6-12 месяцев. Не сливайте бюджет." />
            </h3>
            <div className="flex flex-wrap gap-2">
              {data.top_lists.hype_traps.map((t, i) => (
                <Badge key={i} className="bg-rose-500/15 text-rose-500 border-rose-500/30 hover:bg-rose-500/20" variant="outline">{t}</Badge>
              ))}
              {data.top_lists.hype_traps.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* === SHIFTS === */}
      <TabsContent value="shifts" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" /> Durable low-noise shifts
            <Hint text="Долгосрочные тихие сдвиги без хайпа. Именно они приносят деньги годами." />
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">Тренд</TableHead>
                <TableHead className="w-[36%]">Почему это важно</TableHead>
                <TableHead>Как адаптировать SEO</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.market_shifts.durable_shifts.map((d, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium text-foreground align-top">{d.shift}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{d.why_it_matters || '—'}</TableCell>
                  <TableCell className="text-sm text-foreground/90 align-top">{d.seo_adaptation || '—'}</TableCell>
                </TableRow>
              ))}
              {data.market_shifts.durable_shifts.length === 0 && (
                <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Данных нет</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-500" /> Растущие форматы контента
              <Hint text="Типы страниц, доля которых будет расти в нише ближайшие 12-24 месяца." />
            </h3>
            <ul className="space-y-2">
              {data.market_shifts.format_trends.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
              {data.market_shifts.format_trends.length === 0 && <li className="text-sm text-muted-foreground">—</li>}
            </ul>
          </Card>
          <Card className="p-6 space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Поведение аудитории
              <Hint text="Конкретные сдвиги в пути покупателя: где принимают решение, чему доверяют, что игнорируют." />
            </h3>
            <div className="space-y-2">
              {data.market_shifts.audience_behavior.map((b, i) => (
                <Alert key={i} className="py-2.5 border-border">
                  <AlertDescription className="text-sm text-foreground/90">{b}</AlertDescription>
                </Alert>
              ))}
              {data.market_shifts.audience_behavior.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
            </div>
          </Card>
        </div>
      </TabsContent>

      {/* === AI === */}
      <TabsContent value="ai" className="space-y-5 mt-5">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Bot className="w-4 h-4 text-primary" /> Влияние AI на сегменты ниши
            <Hint text="Upside — где AI помогает (рекомендации, генерация, ассистенты). Downside — где AI выбивает трафик и продукты (zero-click, AI Overviews, чат-ответы)." />
          </h3>
          <div className="w-full h-[360px]">
            <ResponsiveContainer>
              <BarChart data={aiChart} margin={{ top: 16, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <ReTooltip
                  contentStyle={{ background: 'hsl(var(--background))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  labelFormatter={(_, p) => (p && p[0] ? (p[0].payload as any).fullName : '')}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Upside" fill="hsl(142 76% 45%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Downside" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {data.ai_and_trust.ai_trends.length === 0 && (
            <p className="text-sm text-muted-foreground text-center">Данных по AI-сегментам нет</p>
          )}
        </Card>

        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Trust & expectations
            <Hint text="Как меняются требования к E-E-A-T, экспертности и доказательной базе в ближайшие 12-24 месяца." />
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line">
            {data.ai_and_trust.trust_expectations || '—'}
          </p>
        </Card>
      </TabsContent>

      {/* === ROADMAP === */}
      <TabsContent value="roadmap" className="space-y-5 mt-5">
        <Card className="p-6 space-y-5">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Rocket className="w-4 h-4 text-primary" /> Phased roadmap
            <Hint text="Что активировать и что строить на каждом горизонте. Не план задач, а карта окон возможностей." />
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
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                    {phase.expected_kpi && (
                      <Badge variant="outline" className="border-primary/30 text-primary">KPI: {phase.expected_kpi}</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                        <Flame className="w-3 h-3" /> Тренды активировать
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {phase.trends_to_activate.map((t, ti) => (
                          <Badge key={ti} variant="secondary" className="text-[11px] font-normal">{t}</Badge>
                        ))}
                        {phase.trends_to_activate.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1">
                        <Brain className="w-3 h-3" /> Assets строить
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