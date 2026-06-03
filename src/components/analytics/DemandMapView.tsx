import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import {
  Target, TrendingUp, ShieldCheck, Brain, AlertTriangle, CheckCircle2, XCircle,
  Map, Compass, Sparkles, Layers,
} from 'lucide-react';

export type BusinessValue = 'High' | 'Med' | 'Low';
export type Level = 'High' | 'Med' | 'Low';

export type JourneyStage = {
  stage: string; queries: string[];
  demand_strength_percent: number; business_value: BusinessValue;
};
export type IntentDistribution = {
  commercial: number; informational: number; local: number; support: number;
};
export type ClusterReason = { cluster: string; reason: string };
export type TrustAdjustedRow = {
  cluster: string; raw_demand: Level; ee_a_t_requirement: Level; accessibility: Level;
};
export type RoadmapPhase = { targets: string[]; page_types: string[] };

export type DemandMapData = {
  scoring: {
    overall_attractiveness: number; commercial_value: number;
    ai_resilience: number; trust_feasibility: number; scoring_reasoning: string;
  };
  executive_summary: {
    strongest_layers: string; main_risks: string;
    top_5_quick_wins: string[]; top_5_avoid_zones: string[];
  };
  buyer_journey: JourneyStage[];
  intent_distribution: IntentDistribution;
  vanity_vs_value: { high_value: ClusterReason[]; vanity_misleading: ClusterReason[] };
  barriers: {
    trust_adjusted: TrustAdjustedRow[];
    ai_and_serp: { ai_upside: number; serp_openness: number; zero_click_risk: number };
  };
  sequencing_roadmap: {
    first_30_days: RoadmapPhase; first_quarter: RoadmapPhase; months_6_to_12: RoadmapPhase;
  };
};

const arr = (x: any): string[] => Array.isArray(x) ? x.map((v) => String(v ?? '').trim()).filter(Boolean) : [];
const num = (x: any, def = 0): number => {
  const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def;
};
const lvl = (x: any): Level => {
  const s = String(x || '').toLowerCase();
  if (s.startsWith('h')) return 'High';
  if (s.startsWith('l')) return 'Low';
  return 'Med';
};
const bv = (x: any): BusinessValue => lvl(x) as BusinessValue;

export function normalizeDemandMap(raw: any): DemandMapData | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const s = raw.scoring || {};
  const es = raw.executive_summary || {};
  const ivd = raw.intent_distribution || {};
  const vv = raw.vanity_vs_value || {};
  const br = raw.barriers || {};
  const ais = br.ai_and_serp || {};
  const rm = raw.sequencing_roadmap || {};
  const phase = (p: any): RoadmapPhase => ({ targets: arr(p?.targets), page_types: arr(p?.page_types) });
  return {
    scoring: {
      overall_attractiveness: num(s.overall_attractiveness),
      commercial_value: num(s.commercial_value),
      ai_resilience: num(s.ai_resilience),
      trust_feasibility: num(s.trust_feasibility),
      scoring_reasoning: String(s.scoring_reasoning || '').trim(),
    },
    executive_summary: {
      strongest_layers: String(es.strongest_layers || '').trim(),
      main_risks: String(es.main_risks || '').trim(),
      top_5_quick_wins: arr(es.top_5_quick_wins),
      top_5_avoid_zones: arr(es.top_5_avoid_zones),
    },
    buyer_journey: Array.isArray(raw.buyer_journey) ? raw.buyer_journey.map((j: any) => ({
      stage: String(j?.stage || '').trim(),
      queries: arr(j?.queries),
      demand_strength_percent: num(j?.demand_strength_percent),
      business_value: bv(j?.business_value),
    })).filter((j: JourneyStage) => j.stage) : [],
    intent_distribution: {
      commercial: num(ivd.commercial),
      informational: num(ivd.informational),
      local: num(ivd.local),
      support: num(ivd.support),
    },
    vanity_vs_value: {
      high_value: Array.isArray(vv.high_value) ? vv.high_value.map((v: any) => ({
        cluster: String(v?.cluster || '').trim(), reason: String(v?.reason || '').trim(),
      })).filter((v: ClusterReason) => v.cluster) : [],
      vanity_misleading: Array.isArray(vv.vanity_misleading) ? vv.vanity_misleading.map((v: any) => ({
        cluster: String(v?.cluster || '').trim(), reason: String(v?.reason || '').trim(),
      })).filter((v: ClusterReason) => v.cluster) : [],
    },
    barriers: {
      trust_adjusted: Array.isArray(br.trust_adjusted) ? br.trust_adjusted.map((t: any) => ({
        cluster: String(t?.cluster || '').trim(),
        raw_demand: lvl(t?.raw_demand),
        ee_a_t_requirement: lvl(t?.ee_a_t_requirement),
        accessibility: lvl(t?.accessibility),
      })).filter((t: TrustAdjustedRow) => t.cluster) : [],
      ai_and_serp: {
        ai_upside: num(ais.ai_upside),
        serp_openness: num(ais.serp_openness),
        zero_click_risk: num(ais.zero_click_risk),
      },
    },
    sequencing_roadmap: {
      first_30_days: phase(rm.first_30_days),
      first_quarter: phase(rm.first_quarter),
      months_6_to_12: phase(rm.months_6_to_12),
    },
  };
}

function scoreColor(v: number) {
  if (v >= 70) return 'text-emerald-500';
  if (v >= 40) return 'text-amber-500';
  return 'text-rose-500';
}
function levelBadge(l: Level) {
  if (l === 'High') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (l === 'Low') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}
function levelBadgeInverse(l: Level) {
  // Для барьеров: High accessibility = хорошо, но High EEAT requirement = плохо
  if (l === 'High') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  if (l === 'Low') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}

const INTENT_COLORS: Record<keyof IntentDistribution, string> = {
  commercial: 'bg-emerald-500',
  informational: 'bg-blue-500',
  local: 'bg-violet-500',
  support: 'bg-amber-500',
};
const INTENT_LABELS: Record<keyof IntentDistribution, string> = {
  commercial: 'Коммерческий',
  informational: 'Информационный',
  local: 'Локальный',
  support: 'Поддержка',
};

const INTENT_HINTS: Record<keyof IntentDistribution, string> = {
  commercial: 'Запросы с намерением купить / выбрать поставщика. Самый ценный intent.',
  informational: 'Запросы «как / что такое / почему». Верх воронки, готовят к покупке.',
  local: 'Запросы с географической привязкой («рядом», «в Москве»). Триггер локальных карточек.',
  support: 'Запросы существующих пользователей: помощь, инструкции, FAQ.',
};

function Hint({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex items-center text-muted-foreground/70 hover:text-foreground transition-colors">
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function ScoreCard({ label, value, icon: Icon, hint }: { label: string; value: number; icon: any; hint?: string }) {
  return (
    <div className="rounded-lg border border-border p-4 space-y-2">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
        {hint && <Hint text={hint} />}
      </div>
      <div className={`text-3xl font-bold tabular-nums ${scoreColor(value)}`}>{value}</div>
      <Progress value={value} className="h-1.5" />
    </div>
  );
}

export function DemandMapView({ data }: { data: DemandMapData }) {
  const intentSum = data.intent_distribution.commercial + data.intent_distribution.informational
    + data.intent_distribution.local + data.intent_distribution.support || 1;

  return (
    <div className="space-y-5">
      {/* Scoring */}
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Target className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Карта спроса</div>
            <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
              Оценка ниши с поправкой на риски
              <Hint text="Четыре оси оценки 0–100. Учитывают не только объём спроса, но и реальную выручку, барьеры E-E-A-T и риски AI-выдачи." />
            </h3>
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <ScoreCard
            label="Привлекательность ниши"
            value={data.scoring.overall_attractiveness}
            icon={Sparkles}
            hint="Итоговая оценка: насколько ниша интересна для входа с учётом спроса, маржи, барьеров и AI-рисков."
          />
          <ScoreCard
            label="Коммерческая ценность"
            value={data.scoring.commercial_value}
            icon={TrendingUp}
            hint="Сколько реальных денег в нише: доля коммерческого intent, средний чек, конверсионный потенциал."
          />
          <ScoreCard
            label="Устойчивость к AI"
            value={data.scoring.ai_resilience}
            icon={Brain}
            hint="Насколько ниша защищена от вытеснения AI-ответами (ChatGPT, Google AI Overviews, Яндекс Нейро). Чем выше — тем меньше потеряете трафика."
          />
          <ScoreCard
            label="Реализуемость доверия"
            value={data.scoring.trust_feasibility}
            icon={ShieldCheck}
            hint="Насколько реально набрать нужный уровень E-E-A-T (опыт, экспертиза, авторитетность, доверие). Низкий балл = YMYL-тематика, где новичку не пробиться."
          />
        </div>
        {data.scoring.scoring_reasoning && (
          <p className="text-sm text-foreground/90 leading-relaxed">{data.scoring.scoring_reasoning}</p>
        )}
      </Card>

      {/* Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-4 h-4 text-primary" /> Сильнейшие слои
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_summary.strongest_layers || '—'}</p>
        </Card>
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Главные риски
          </h3>
          <p className="text-sm text-foreground/90 leading-relaxed">{data.executive_summary.main_risks || '—'}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Топ-5 быстрых побед
            <Hint text="Что можно запустить быстро и получить результат за 30–90 дней без больших инвестиций в авторитет." />
          </h3>
          <ul className="space-y-1.5">
            {data.executive_summary.top_5_quick_wins.map((w, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-emerald-500 shrink-0 font-semibold tabular-nums">{i + 1}.</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <XCircle className="w-4 h-4 text-rose-500" /> Топ-5 зон, куда не идти
            <Hint text="Кластеры и направления, в которые лучше не вкладывать ресурсы: ложный спрос, нереальный E-E-A-T-барьер или 100% AI-каннибализация." />
          </h3>
          <ul className="space-y-1.5">
            {data.executive_summary.top_5_avoid_zones.map((w, i) => (
              <li key={i} className="text-sm text-foreground flex gap-2">
                <span className="text-rose-500 shrink-0 font-semibold tabular-nums">{i + 1}.</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Buyer Journey */}
      {data.buyer_journey.length > 0 && (
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Compass className="w-4 h-4 text-primary" /> Путь покупателя: сила спроса по стадиям
            <Hint text="Декомпозиция спроса по этапам принятия решения: от осознания проблемы до выбора поставщика и удержания. Показывает, на каких стадиях больше всего запросов и где они стоят дороже всего." />
          </h3>
          <div className="space-y-3">
            {data.buyer_journey.map((j, i) => (
              <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] tabular-nums text-muted-foreground font-medium">#{i + 1}</span>
                    <h4 className="text-sm font-semibold text-foreground">{j.stage}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={levelBadge(j.business_value as Level)}>
                      Ценность: {j.business_value === 'High' ? 'Высокая' : j.business_value === 'Low' ? 'Низкая' : 'Средняя'}
                    </Badge>
                    <Badge variant="outline" className="border-border tabular-nums">
                      {j.demand_strength_percent}%
                    </Badge>
                  </div>
                </div>
                <Progress value={j.demand_strength_percent} className="h-1.5" />
                {j.queries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {j.queries.map((q, qi) => (
                      <Badge key={qi} variant="secondary" className="text-[11px] font-normal">{q}</Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Intent distribution */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Распределение намерений пользователей
          <Hint text="Какую долю спроса занимает каждый тип намерения. Помогает решить, какие типы страниц делать в первую очередь: коммерческие, информационные, локальные или поддержки." />
        </h3>
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-muted">
          {(Object.keys(data.intent_distribution) as (keyof IntentDistribution)[]).map((k) => {
            const v = data.intent_distribution[k];
            const w = (v / intentSum) * 100;
            if (w <= 0) return null;
            return <div key={k} className={INTENT_COLORS[k]} style={{ width: `${w}%` }} title={`${INTENT_LABELS[k]}: ${v}%`} />;
          })}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {(Object.keys(data.intent_distribution) as (keyof IntentDistribution)[]).map((k) => (
            <div key={k} className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-sm ${INTENT_COLORS[k]}`} />
              <div className="text-xs text-foreground">
                <span className="font-medium">{INTENT_LABELS[k]}</span>
                <span className="text-muted-foreground ml-1.5 tabular-nums">{data.intent_distribution[k]}%</span>
              </div>
              <Hint text={INTENT_HINTS[k]} />
            </div>
          ))}
        </div>
      </Card>

      {/* Vanity vs value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Денежные кластеры
            <Hint text="Кластеры, которые реально приносят деньги: высокая конверсия, чёткий коммерческий intent, посильный E-E-A-T-барьер." />
          </h3>
          <ul className="space-y-2.5">
            {data.vanity_vs_value.high_value.map((v, i) => (
              <li key={i} className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="text-sm font-medium text-foreground">{v.cluster}</div>
                {v.reason && <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{v.reason}</div>}
              </li>
            ))}
            {data.vanity_vs_value.high_value.length === 0 && (
              <li className="text-xs text-muted-foreground">—</li>
            )}
          </ul>
        </Card>
        <Card className="p-6 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-500" /> Ложные кластеры (vanity)
            <Hint text="Кластеры с огромным объёмом, но без денег: размытый intent, zero-click, аудитория без бюджета или нерелевантна продукту. Туда легко слить ресурсы впустую." />
          </h3>
          <ul className="space-y-2.5">
            {data.vanity_vs_value.vanity_misleading.map((v, i) => (
              <li key={i} className="rounded-md border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="text-sm font-medium text-foreground">{v.cluster}</div>
                {v.reason && <div className="text-xs text-rose-500/90 mt-1 leading-relaxed">{v.reason}</div>}
              </li>
            ))}
            {data.vanity_vs_value.vanity_misleading.length === 0 && (
              <li className="text-xs text-muted-foreground">—</li>
            )}
          </ul>
        </Card>
      </div>

      {/* Barriers */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-primary" /> Барьеры доверия и доступности
          <Hint text="Сопоставление: где спрос высокий, но требования к E-E-A-T (опыт, экспертиза, авторитетность) высокие, а доступность входа — низкая. Это зоны, куда новичку лучше не идти без авторитета." />
        </h3>
        {data.barriers.trust_adjusted.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                  <th className="text-left py-2 pr-4 font-medium">Кластер</th>
                  <th className="text-left py-2 px-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      Сырой спрос <Hint text="Объём поискового спроса без учёта барьеров. High = много трафика, Low = мало." />
                    </span>
                  </th>
                  <th className="text-left py-2 px-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      Требование к E-E-A-T <Hint text="Насколько Google требует доказанной экспертизы. High = YMYL (медицина, финансы, право) — нужны авторы-эксперты, сертификаты, ссылки." />
                    </span>
                  </th>
                  <th className="text-left py-2 px-3 font-medium">
                    <span className="inline-flex items-center gap-1.5">
                      Доступность входа <Hint text="Насколько легко новому домену пробиться в ТОП. High = выдача открыта, Low = доминируют маркетплейсы и старые бренды." />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.barriers.trust_adjusted.map((t, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground">{t.cluster}</td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={levelBadge(t.raw_demand)}>{lvlRu(t.raw_demand)}</Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={levelBadgeInverse(t.ee_a_t_requirement)}>{lvlRu(t.ee_a_t_requirement)}</Badge>
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="outline" className={levelBadge(t.accessibility)}>{lvlRu(t.accessibility)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground">—</div>
        )}
        <div className="grid grid-cols-3 gap-3 pt-3 border-t border-border">
          <ScoreCard
            label="Потенциал в AI-выдаче"
            value={data.barriers.ai_and_serp.ai_upside}
            icon={Brain}
            hint="Шанс попасть в цитирования ChatGPT, Perplexity, Google AI Overviews и Яндекс Нейро. Высокий балл = ниша любит структурированный контент и прямые ответы."
          />
          <ScoreCard
            label="Открытость выдачи"
            value={data.barriers.ai_and_serp.serp_openness}
            icon={Target}
            hint="Насколько SERP свободен для нового домена. Низкий балл = доминируют маркетплейсы, агрегаторы и крупные бренды."
          />
          <ScoreCard
            label="Риск zero-click"
            value={data.barriers.ai_and_serp.zero_click_risk}
            icon={AlertTriangle}
            hint="Доля запросов, на которые ответ выдаётся прямо в поиске (featured snippet, AI Overview, карточка) — без клика на сайт. Высокий балл = трафика будет мало даже из ТОП-1."
          />
        </div>
      </Card>

      {/* Sequencing roadmap */}
      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Map className="w-4 h-4 text-primary" /> Дорожная карта запуска
          <Hint text="Что запускать в каком порядке: быстрые победы в первые 30 дней, наращивание трафика за квартал, и борьба за авторитет и money-страницы на горизонте 6–12 месяцев." />
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {([
            ['first_30_days', '30 дней', 'border-emerald-500/30 bg-emerald-500/5'],
            ['first_quarter', '1-й квартал', 'border-blue-500/30 bg-blue-500/5'],
            ['months_6_to_12', '6–12 мес.', 'border-violet-500/30 bg-violet-500/5'],
          ] as [keyof DemandMapData['sequencing_roadmap'], string, string][]).map(([k, label, tone]) => {
            const phase = data.sequencing_roadmap[k];
            return (
              <div key={k} className={`rounded-lg border p-4 space-y-3 ${tone}`}>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Цели этапа</div>
                  {phase.targets.length > 0 ? (
                    <ul className="space-y-1">
                      {phase.targets.map((t, i) => (
                        <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-primary shrink-0">▸</span>{t}</li>
                      ))}
                    </ul>
                  ) : <div className="text-xs text-muted-foreground">—</div>}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">Типы страниц</div>
                  <div className="flex flex-wrap gap-1.5">
                    {phase.page_types.length > 0 ? phase.page_types.map((p, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{p}</Badge>
                    )) : <span className="text-xs text-muted-foreground">—</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}