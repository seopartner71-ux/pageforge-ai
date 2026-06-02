import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Compass, Sparkles, Target, TrendingUp, ShieldAlert, Map, CheckCircle2, AlertTriangle, Info, FileDown, Database, Brain, FileText, Lightbulb, ArrowRight, ShieldCheck, XCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid,
} from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { exportNicheOverviewDocx } from '@/lib/analytics/exportNicheOverviewDocx';

const FIELD_HINTS: Record<string, string> = {
  niche: 'Опишите тематику бизнеса так, как её ищут клиенты. Чем точнее формулировка — тем релевантнее анализ. Пример: «онлайн-курсы по Python для джунов».',
  geo: 'Регион, для которого AI оценит спрос, SERP и конкуренцию. Локальный рынок и глобальный дают разные результаты по сложности входа.',
  businessType: 'B2B и B2C по-разному оцениваются по циклу сделки, E-E-A-T и стоимости лида. От этого зависит выбор стратегии.',
  monetization: 'Модель монетизации влияет на оценку коммерческого потенциала и приоритеты в воронке (подписка ≠ разовая покупка).',
  audience: 'Краткое описание сегмента (роль, боль, возраст). Помогает AI точнее найти подниши и JTBD-возможности.',
  domainStrength: 'Возраст и авторитет вашего домена. Новому сайту нужна более длинная дорожная карта по E-E-A-T.',
  horizon: 'На какой срок строим план. От него зависит детализация roadmap и баланс «быстрые победы / стратегические инвестиции».',
};

const SCORE_HINTS: Record<string, string> = {
  searchOpp:
    'Search Opportunity — потенциал захвата органического трафика. Учитывает объём спроса, конкуренцию в SERP и долю информационных запросов.',
  commercial:
    'Commercial — оценка денежного потенциала ниши: коммерческие интенты, средний чек, готовность платить, наличие моделей подписки.',
  trust:
    'Trust (E-E-A-T) — насколько критично доверие в нише. Высокое значение = нужны эксперты, кейсы, ссылки, прозрачные данные.',
  aiRisk:
    'AI Risk — риск вытеснения вашего трафика AI-ответами (AI Overviews, Алиса, ChatGPT). Чем выше, тем больше нужно ставки на YMYL/экспертность.',
};

function HintLabel({ children, hint }: { children: React.ReactNode; hint: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span>{children}</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" tabIndex={-1} className="text-muted-foreground hover:text-foreground transition-colors">
            <Info className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {hint}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

type FormData = {
  niche: string;
  geo: string;
  businessType: string;
  monetization: string;
  audience: string;
  domainStrength: string;
  horizon: string;
};

type VerdictPosition = 'GO' | 'CAUTION' | 'NO-GO';
type VerdictConfidence = 'high' | 'medium' | 'low';

type StructuredVerdict = {
  position: VerdictPosition;
  confidence: VerdictConfidence;
  headline: string;
  summary: string;
  key_drivers: string[];
  key_risks: string[];
  recommendation: string;
};

type ReportData = {
  scoring: { searchOpp: number; commercial: number; trust: number; aiRisk: number };
  executive_summary: {
    verdict: StructuredVerdict;
    top_subniches: string[];
    roadmap: { '3_months': string; '6_months': string; '12_months': string };
  };
  market: {
    size_estimate: string;
    growth_rate: string;
    key_players: { name: string; share: number }[];
    white_spaces: string[];
  };
  barriers: {
    eeat: { name: string; level: 'low' | 'mid' | 'high'; note: string }[];
    capital: string;
    regulation: string;
  };
  strategy: {
    wedges: { title: string; description: string; effort: string; impact: string }[];
    risks: string[];
  };
  assumptions?: Assumption[];
  opportunities?: OpportunitiesData;
};

type Assumption = {
  field: string;
  assumption: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
};

type SpeedBucket = '30d' | 'q1' | 'q2' | '6-12m' | '12-24m';
type LaunchModel = 'traffic-first' | 'commercial-first' | 'authority-first' | 'wedge-first' | 'local-first' | 'ai-first' | 'hybrid';
type OppRecommendation = 'go' | 'selective-go' | 'phased-go' | 'cautious-go' | 'no-go';

type TopOpportunity = {
  title: string; why: string; best_format: string; speed_to_impact: SpeedBucket;
  demand_quality: number; business_value: number; accessibility: number;
  serp_openness: number; ai_upside: number; overall_score: number;
};
type Wedge = { title: string; asset: string; payoff: string; speed: SpeedBucket };
type Compounding = { pair: string; sequencing: string; payoff: string };
type Trap = { title: string; why_looks_good: string; why_risk: string };
type Gap = { title: string; why_underserved: string; asset_needed: string };

type OpportunitiesData = {
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

const SPEED_LABELS: Record<SpeedBucket, string> = {
  '30d': '30 дней', q1: '1-й квартал', q2: '2-й квартал', '6-12m': '6–12 мес.', '12-24m': '12–24 мес.',
};
const LAUNCH_LABELS: Record<LaunchModel, string> = {
  'traffic-first': 'Traffic-first', 'commercial-first': 'Commercial-first',
  'authority-first': 'Authority-first', 'wedge-first': 'Wedge-first',
  'local-first': 'Local-first', 'ai-first': 'AI-first', hybrid: 'Hybrid',
};
const RECOMMENDATION_LABELS: Record<OppRecommendation, string> = {
  go: 'GO', 'selective-go': 'SELECTIVE GO', 'phased-go': 'PHASED GO',
  'cautious-go': 'CAUTIOUS GO', 'no-go': 'NO-GO',
};

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
function arr(x: any): string[] {
  return Array.isArray(x) ? x.map((v) => String(v || '').trim()).filter(Boolean) : [];
}
function num(x: any, def = 0): number {
  const n = Number(x); return Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : def;
}
function normalizeOpportunities(o: any): OpportunitiesData | undefined {
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

function normalizeAssumptions(arr: any): Assumption[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((a) => {
      const conf = String(a?.confidence || 'medium').toLowerCase();
      return {
        field: String(a?.field || '').trim() || 'Общие данные',
        assumption: String(a?.assumption || '').trim(),
        impact: String(a?.impact || '').trim(),
        confidence: (conf === 'high' || conf === 'low' ? conf : 'medium') as Assumption['confidence'],
      };
    })
    .filter((a) => a.assumption.length > 0);
}

function normalizeVerdict(v: any, scoring: ReportData['scoring']): StructuredVerdict {
  // Back-compat: старые ответы возвращали verdict как строку
  if (typeof v === 'string') {
    const avg = (scoring.searchOpp + scoring.commercial + scoring.trust + (100 - scoring.aiRisk)) / 4;
    const position: VerdictPosition = avg >= 65 ? 'GO' : avg >= 45 ? 'CAUTION' : 'NO-GO';
    return {
      position,
      confidence: 'medium',
      headline: v.slice(0, 110),
      summary: v,
      key_drivers: [],
      key_risks: [],
      recommendation: '',
    };
  }
  const pos = String(v?.position || '').toUpperCase();
  const position: VerdictPosition =
    pos === 'GO' || pos === 'NO-GO' || pos === 'NOGO' ? (pos === 'NOGO' ? 'NO-GO' : (pos as VerdictPosition)) :
    pos === 'CAUTION' ? 'CAUTION' : 'CAUTION';
  const conf = String(v?.confidence || 'medium').toLowerCase();
  const confidence: VerdictConfidence =
    conf === 'high' || conf === 'low' ? (conf as VerdictConfidence) : 'medium';
  return {
    position,
    confidence,
    headline: String(v?.headline || '').trim() || 'Стратегический вердикт по нише',
    summary: String(v?.summary || '').trim(),
    key_drivers: Array.isArray(v?.key_drivers) ? v.key_drivers.filter(Boolean) : [],
    key_risks: Array.isArray(v?.key_risks) ? v.key_risks.filter(Boolean) : [],
    recommendation: String(v?.recommendation || '').trim(),
  };
}

const LOADING_STAGES = [
  'Сканируем поисковую выдачу и SERP...',
  'Анализируем барьеры E-E-A-T...',
  'Ищем свободные зоны (White Spaces)...',
  'Строим стратегию входа (Wedges)...',
  'Генерируем финальный JSON-отчёт...',
];

const MOCK_REPORT: ReportData = {
  scoring: { searchOpp: 85, commercial: 70, trust: 90, aiRisk: 40 },
  executive_summary: {
    verdict: {
      position: 'CAUTION',
      confidence: 'medium',
      headline: 'Ниша зрелая: входить точечно через вертикальный B2B-SaaS-клин.',
      summary:
        'Рынок стабилен и платёжеспособен, но насыщен крупными горизонтальными игроками. Ключевая возможность — узкие вертикали и локальный B2B в городах второго эшелона. E-E-A-T требования высокие, поэтому без экспертного контента и кейсов выйти в ТОП не получится. AI-риск умеренный: коммерческие интенты слабо вытесняются AI Overviews, но информационный трафик будет постепенно сжиматься.',
      key_drivers: [
        'Платёжеспособный B2B-спрос — высокий чек и LTV в подписочной модели',
        'Свободные микро-сегменты соло-предпринимателей и локального B2B',
        'Возможность дифференциации через интеграции с маркетплейсами и кассами',
      ],
      key_risks: [
        'Высокая стоимость экспертного контента и удержания авторов',
        'Консолидация рынка вокруг 2–3 лидеров с сильным брендом',
        'AI Overviews снижают CTR на информационные кластеры',
      ],
      recommendation:
        'Старт с одной узкой вертикали и опорного контент-хаба на 25 материалов за 3 месяца, параллельно — наращивание E-E-A-T (кейсы, авторы, внешние публикации) и подготовка партнёрской программы на горизонте 6+ месяцев.',
    },
    top_subniches: ['B2B SaaS для логистики', 'Локальный CRM для салонов', 'AI-ассистент для бухгалтерии'],
    roadmap: {
      '3_months': 'Базовый контент-хаб: 25 опорных статей, технический аудит, локальная оптимизация.',
      '6_months': 'Усиление E-E-A-T: кейсы, авторы-эксперты, внешние публикации, видео-обзоры.',
      '12_months': 'Выход в смежные сегменты, партнёрские интеграции, программа адвокатов бренда.',
    },
  },
  market: {
    size_estimate: '≈ 1.2 млрд ₽/год',
    growth_rate: '+18% YoY',
    key_players: [
      { name: 'Лидер A', share: 32 },
      { name: 'Игрок B', share: 21 },
      { name: 'Игрок C', share: 14 },
      { name: 'Игрок D', share: 9 },
      { name: 'Остальные', share: 24 },
    ],
    white_spaces: [
      'Микро-сегмент «соло-предприниматели» без вертикального решения',
      'Локальный B2B в городах 100–500 тыс. населения',
      'Интеграции с маркетплейсами и кассовыми системами',
    ],
  },
  barriers: {
    eeat: [
      { name: 'Экспертиза авторов', level: 'high', note: 'Требуется команда практиков с публичным треком.' },
      { name: 'Опыт (Experience)', level: 'mid', note: 'Нужны реальные кейсы и доказательства внедрений.' },
      { name: 'Авторитетность бренда', level: 'high', note: 'Цитируемость в отраслевых СМИ обязательна.' },
      { name: 'Доверие (Trust)', level: 'mid', note: 'Отзывы, прозрачные цены, юридические гарантии.' },
    ],
    capital: 'Средний порог входа: 1.5–3 млн ₽ на первые 6 месяцев (команда + контент + продукт).',
    regulation: 'Регуляторных барьеров нет, но обязательны 152-ФЗ и оферта.',
  },
  strategy: {
    wedges: [
      { title: 'Vertical SaaS Wedge', description: 'Узкий продукт под одну вертикаль, затем расширение.', effort: 'High', impact: 'High' },
      { title: 'Content-Led Growth', description: 'Опорные гайды + калькуляторы для захвата SEO-спроса.', effort: 'Mid', impact: 'High' },
      { title: 'Local Partnership', description: 'Партнёрства с локальными интеграторами и агентствами.', effort: 'Low', impact: 'Mid' },
    ],
    risks: [
      'Высокая стоимость экспертного контента',
      'Появление AI-Overviews снижает CTR на информационные запросы',
      'Консолидация рынка крупными игроками',
    ],
  },
  assumptions: [
    { field: 'Размер рынка', assumption: 'Оценка ≈ 1.2 млрд ₽/год построена по аналогам без локальных отраслевых отчётов.', impact: 'Перепроверить блок «Рынок» при наличии данных Росстата или отраслевых обзоров.', confidence: 'medium' },
    { field: 'Доли игроков', assumption: 'Доли лидеров оценены по узнаваемости бренда и SERP, без точной выручки.', impact: 'Распределение долей может смещаться на ±10 п.п.', confidence: 'low' },
    { field: 'Сила домена', assumption: 'Считаем домен новым — стратегия делает упор на длинный E-E-A-T-цикл.', impact: 'Для зрелого домена приоритеты в roadmap нужно ускорить на 2–3 месяца.', confidence: 'high' },
  ],
  opportunities: {
    summary: 'Ниша opportunity-rich, но «тяжёлый верх» закрыт лидерами. Реальные возможности — в узких вертикалях, локальном B2B и канонических сравнительных активах. Информационный слой страдает от AI-сжатия — приоритет на коммерческие и trust-возможности с быстрой бизнес-конверсией.',
    portfolio: {
      core_growth: ['Хаб «Сравнения и альтернативы» под вертикали', 'Use-case кластеры для логистики и салонов', 'Канонический глоссарий категории'],
      quick_wins: ['10 long-tail сравнений «X vs Y для [вертикали]»', 'Локальные посадочные для 5 городов 100–500 тыс.', 'Калькулятор ROI / окупаемости'],
      revenue_priority: ['Pricing-страницы по сегментам', 'Use-case → демо-форма', 'Кейс-стади с ROI и цифрами'],
      trust_building: ['Авторы-эксперты с публичным треком', 'Прозрачная методология ревью', 'Сертификации и compliance-страницы'],
      authority_ai_visibility: ['Цитируемые стат-страницы (industry benchmarks)', 'FAQ-хабы под answer-форматы', 'Канонические definition-страницы'],
      defer: ['Broad head-термины уровня категории', 'Тяжёлые медиа-форматы без распределения'],
      avoid: ['Affiliate-сравнения без дифференциации', 'Контент уровня «что такое X» без trust-слоя'],
    },
    top_overall: [
      { title: 'Vertical comparison hub (логистика)', why: 'Низкая SERP-конкуренция в вертикали, высокий коммерческий интент.', best_format: 'Сравнительный хаб + сравнения 1:1', speed_to_impact: 'q1', demand_quality: 75, business_value: 85, accessibility: 70, serp_openness: 80, ai_upside: 55, overall_score: 78 },
      { title: 'Локальные посадочные B2B (города 100–500 тыс.)', why: 'Местный SERP открыт, low-volume × high-value.', best_format: 'City + service pages', speed_to_impact: '30d', demand_quality: 60, business_value: 80, accessibility: 85, serp_openness: 85, ai_upside: 40, overall_score: 74 },
      { title: 'Калькулятор ROI и окупаемости', why: 'Linkable asset + конверсионный crossover, дефицит на рынке.', best_format: 'Интерактивный tool', speed_to_impact: 'q1', demand_quality: 55, business_value: 75, accessibility: 75, serp_openness: 70, ai_upside: 65, overall_score: 71 },
      { title: 'Канонические industry benchmarks', why: 'Высокий потенциал цитирований в AI и СМИ.', best_format: 'Stats / methodology', speed_to_impact: 'q2', demand_quality: 50, business_value: 60, accessibility: 60, serp_openness: 75, ai_upside: 90, overall_score: 70 },
      { title: 'Alternatives-страницы под конкурентов', why: 'Чистый коммерческий интент, открытый SERP в вертикали.', best_format: '«Alternative to X»', speed_to_impact: 'q1', demand_quality: 65, business_value: 80, accessibility: 70, serp_openness: 65, ai_upside: 45, overall_score: 68 },
    ],
    wedges: [
      { title: 'Comparison wedge', asset: '«X vs Y для [вертикали]»', payoff: 'Быстрый коммерческий трафик', speed: 'q1' },
      { title: 'Local wedge', asset: 'City pages + локальные кейсы', payoff: 'Низкая конкуренция, тёплые лиды', speed: '30d' },
      { title: 'Tool wedge', asset: 'ROI-калькулятор', payoff: 'Ссылки и брендовый поиск', speed: 'q1' },
      { title: 'Authority wedge', asset: 'Industry stats / benchmarks', payoff: 'Цитирования в AI и СМИ', speed: 'q2' },
    ],
    compounding: [
      { pair: 'Глоссарий → Сравнения', sequencing: 'Сначала канонические definition-страницы, затем сравнения цитируют их.', payoff: 'Внутренний линкинг и topical authority.' },
      { pair: 'Калькулятор → Pricing → Demo', sequencing: 'Калькулятор → расчёт → CTA на pricing → демо.', payoff: 'Удлинённая конверсионная воронка из SEO-трафика.' },
      { pair: 'Industry stats → PR/Outreach', sequencing: 'Публикуем бенчмарки → outreach в отраслевые медиа.', payoff: 'Линки + AI-цитирование + бренд.' },
    ],
    traps: [
      { title: 'Broad head-термины «CRM», «учёт»', why_looks_good: 'Огромный объём поиска и узнаваемые формулировки.', why_risk: 'Заняты лидерами и AI Overviews; CTR сжат, конверсия низкая.' },
      { title: '«Что такое X» без trust-слоя', why_looks_good: 'Лёгкий трафик и быстрый запуск.', why_risk: 'Vanity-трафик без LTV; первые жертвы AI-сжатия.' },
      { title: 'Тяжёлые affiliate-сравнения без UX-преимущества', why_looks_good: 'Высокий RPM у конкурентов.', why_risk: 'Нужны бренд и доверие; новые домены не выдерживают конкуренции.' },
    ],
    gaps: [
      { title: 'Use-case сегментация по ролям', why_underserved: 'Конкуренты пишут «для бизнеса», но не «для бухгалтера логистической компании».', asset_needed: 'Cluster role × industry pages.' },
      { title: 'Implementation / onboarding content', why_underserved: 'Рынок фокусируется на маркетинговом контенте, не на сценариях внедрения.', asset_needed: 'Implementation guides + чек-листы.' },
      { title: 'Локальные кейсы для городов 100–500 тыс.', why_underserved: 'Все кейсы — про Москву/СПб.', asset_needed: 'City case studies с цифрами клиента.' },
    ],
    sequencing: {
      '30_days': ['10 локальных посадочных', '5 alternatives-страниц', 'Базовый глоссарий 15 терминов'],
      q1: ['Comparison hub запуск', 'ROI-калькулятор v1', 'Первые 5 use-case кластеров'],
      q2: ['Industry stats / benchmarks', 'PR-outreach под benchmarks', 'Расширение глоссария и интерлинкинг'],
      '6_12m': ['Authority hub под вертикаль', 'Pricing-страницы по сегментам', 'Программа авторов-экспертов'],
      '12_24m': ['Расширение в смежные вертикали', 'Партнёрская программа', 'Локализация под новые гео'],
    },
    launch_model: 'wedge-first',
    recommendation: 'phased-go',
  },
};

const DEFAULT_FORM: FormData = {
  niche: '',
  geo: 'ru',
  businessType: 'b2b',
  monetization: 'subscription',
  audience: '',
  domainStrength: 'new',
  horizon: '6',
};

function levelColor(level: 'low' | 'mid' | 'high') {
  if (level === 'high') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  if (level === 'mid') return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
  return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
}

export default function NicheOverviewPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [reportData, setReportData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    setStageIndex(0);
    const id = setInterval(() => {
      setStageIndex((i) => (i + 1) % LOADING_STAGES.length);
    }, 4000);
    return () => clearInterval(id);
  }, [isLoading]);

  const update = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setFormData((s) => ({ ...s, [k]: v }));

  async function generateReport() {
    setIsLoading(true);
    setReportData(null);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-niche', { body: formData });
      if (error) throw error;
      const raw = (data as any)?.report;
      if (!raw || !raw.scoring) {
        throw new Error('Пустой ответ AI');
      }
      const report: ReportData = {
        ...raw,
        executive_summary: {
          ...raw.executive_summary,
          verdict: normalizeVerdict(raw?.executive_summary?.verdict, raw.scoring),
        },
        assumptions: normalizeAssumptions(raw?.assumptions),
        opportunities: normalizeOpportunities(raw?.opportunities),
      };
      setReportData(report);
    } catch (e: any) {
      console.error('analyze-niche failed', e);
      toast({
        title: 'AI недоступен',
        description: (e?.message || 'Ошибка запроса') + '. Показан демо-отчёт.',
        variant: 'destructive',
      });
      setReportData(MOCK_REPORT);
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = formData.niche.trim().length > 1 && !isLoading;

  async function handleDownload() {
    if (!reportData) return;
    try {
      await exportNicheOverviewDocx({
        niche: formData.niche,
        data: reportData,
        meta: {
          geo: formData.geo,
          businessType: formData.businessType,
          monetization: formData.monetization,
          audience: formData.audience,
          horizon: formData.horizon,
        },
      });
      toast({ title: 'Отчёт готов', description: 'Файл .docx сохранён.' });
    } catch (e: any) {
      toast({ title: 'Ошибка экспорта', description: e?.message || 'Не удалось создать .docx', variant: 'destructive' });
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Обзор ниши</h1>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              AI-анализ рыночных возможностей, барьеров входа и стратегии для выбранной ниши.
            </p>
          </div>
        </div>

        {!reportData && !isLoading && <ModuleDescription />}

        {!reportData && !isLoading && (
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="niche" asChild><HintLabel hint={FIELD_HINTS.niche}>Ниша / тематика *</HintLabel></Label>
                <Input
                  id="niche"
                  placeholder="Например: онлайн-курсы по программированию"
                  value={formData.niche}
                  onChange={(e) => update('niche', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label asChild><HintLabel hint={FIELD_HINTS.geo}>Гео</HintLabel></Label>
                <Select value={formData.geo} onValueChange={(v) => update('geo', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ru">Россия</SelectItem>
                    <SelectItem value="cis">СНГ</SelectItem>
                    <SelectItem value="ee">Восточная Европа</SelectItem>
                    <SelectItem value="global">Глобально</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label asChild><HintLabel hint={FIELD_HINTS.businessType}>Тип бизнеса</HintLabel></Label>
                <Select value={formData.businessType} onValueChange={(v) => update('businessType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="b2b">B2B</SelectItem>
                    <SelectItem value="b2c">B2C</SelectItem>
                    <SelectItem value="b2b2c">B2B2C</SelectItem>
                    <SelectItem value="marketplace">Маркетплейс</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label asChild><HintLabel hint={FIELD_HINTS.monetization}>Монетизация</HintLabel></Label>
                <Select value={formData.monetization} onValueChange={(v) => update('monetization', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subscription">Подписка</SelectItem>
                    <SelectItem value="one-time">Разовая продажа</SelectItem>
                    <SelectItem value="ads">Реклама</SelectItem>
                    <SelectItem value="commission">Комиссия</SelectItem>
                    <SelectItem value="services">Услуги</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label asChild><HintLabel hint={FIELD_HINTS.domainStrength}>Сила домена</HintLabel></Label>
                <Select value={formData.domainStrength} onValueChange={(v) => update('domainStrength', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">Новый сайт</SelectItem>
                    <SelectItem value="weak">Слабый (DR &lt; 20)</SelectItem>
                    <SelectItem value="mid">Средний (DR 20–50)</SelectItem>
                    <SelectItem value="strong">Сильный (DR &gt; 50)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="audience" asChild><HintLabel hint={FIELD_HINTS.audience}>Целевая аудитория</HintLabel></Label>
                <Input
                  id="audience"
                  placeholder="Кто ваши клиенты? Возраст, роль, проблемы"
                  value={formData.audience}
                  onChange={(e) => update('audience', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label asChild><HintLabel hint={FIELD_HINTS.horizon}>Горизонт планирования</HintLabel></Label>
                <Select value={formData.horizon} onValueChange={(v) => update('horizon', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 месяца</SelectItem>
                    <SelectItem value="6">6 месяцев</SelectItem>
                    <SelectItem value="12">12 месяцев</SelectItem>
                    <SelectItem value="24">24 месяца</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button onClick={generateReport} disabled={!canSubmit} size="lg">
                <Sparkles className="w-4 h-4 mr-2" />
                Запустить анализ
              </Button>
            </div>
          </Card>
        )}

        {isLoading && (
          <Card className="p-12 min-h-[420px] flex flex-col items-center justify-center text-center gap-6">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-foreground">Анализ ниши «{formData.niche || '...'}»</h2>
              <p className="text-sm text-muted-foreground transition-opacity duration-300 min-h-[20px]">
                {LOADING_STAGES[stageIndex]}
              </p>
            </div>
            <div className="w-full max-w-md space-y-2">
              <Progress value={((stageIndex + 1) / LOADING_STAGES.length) * 100} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Этап {stageIndex + 1} из {LOADING_STAGES.length}</span>
                <span>~12 сек</span>
              </div>
            </div>
          </Card>
        )}

        {reportData && !isLoading && (
          <ResultsDashboard
            data={reportData}
            niche={formData.niche}
            onDownload={handleDownload}
            onReset={() => {
              setReportData(null);
              setFormData(DEFAULT_FORM);
            }}
          />
        )}
      </main>
    </div>
    </TooltipProvider>
  );
}

function ResultsDashboard({
  data,
  niche,
  onDownload,
  onReset,
}: {
  data: ReportData;
  niche: string;
  onDownload: () => void;
  onReset: () => void;
}) {
  const scoringRadar = [
    { metric: 'Поисковый', value: data.scoring.searchOpp, raw: data.scoring.searchOpp, kind: 'direct' as const },
    { metric: 'Коммерческий', value: data.scoring.commercial, raw: data.scoring.commercial, kind: 'direct' as const },
    { metric: 'Доверие', value: data.scoring.trust, raw: data.scoring.trust, kind: 'direct' as const },
    { metric: 'AI-устойчивость', value: 100 - data.scoring.aiRisk, raw: data.scoring.aiRisk, kind: 'inverted' as const },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Отчёт по нише «{niche}»</h2>
          <p className="text-xs text-muted-foreground mt-1">Сгенерировано AI на основе ваших параметров</p>
        </div>
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={onDownload}>
                <FileDown className="w-4 h-4 mr-2" />
                Скачать отчёт .docx
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              Профессиональный отчёт для клиента в Word: резюме, метрики, рынок, барьеры и стратегия с фирменным оформлением.
            </TooltipContent>
          </Tooltip>
          <Button variant="outline" onClick={onReset}>Новый анализ</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <ScoreCard label="Search Opportunity" hint={SCORE_HINTS.searchOpp} value={data.scoring.searchOpp} icon={TrendingUp} accent="text-emerald-500" />
        <ScoreCard label="Commercial" hint={SCORE_HINTS.commercial} value={data.scoring.commercial} icon={Target} accent="text-blue-500" />
        <ScoreCard label="Trust" hint={SCORE_HINTS.trust} value={data.scoring.trust} icon={CheckCircle2} accent="text-violet-500" />
        <ScoreCard label="AI Risk" hint={SCORE_HINTS.aiRisk} value={data.scoring.aiRisk} icon={ShieldAlert} accent="text-amber-500" invert />
      </div>

      <Tabs defaultValue="summary" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="summary">Резюме</TabsTrigger>
          <TabsTrigger value="market">Рынок</TabsTrigger>
          <TabsTrigger value="barriers">Барьеры</TabsTrigger>
          <TabsTrigger value="strategy">Стратегия</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-4 space-y-4">
          <VerdictCard verdict={data.executive_summary.verdict} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-3">Топ-подниши</h3>
              <ul className="space-y-2">
                {data.executive_summary.top_subniches.map((s, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="secondary" className="shrink-0">{i + 1}</Badge>
                    <span className="text-foreground">{s}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card className="p-6">
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3 className="text-sm font-semibold text-foreground">Профиль ниши</h3>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-xs leading-relaxed">
                    Радарная диаграмма по 4 метрикам (шкала 0–100). Чем больше площадь — тем привлекательнее ниша.
                    AI-устойчивость инвертирована: на графике показано «100 − AI-риск», чтобы все оси читались «больше = лучше».
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Сводный профиль по 4 метрикам · шкала 0–100 · больше площадь = сильнее ниша
              </p>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={scoringRadar} outerRadius="78%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis
                      dataKey="metric"
                      tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }}
                      tickFormatter={(name) => {
                        const item = scoringRadar.find((s) => s.metric === name);
                        return item ? `${name} · ${item.value}` : name;
                      }}
                    />
                    <PolarRadiusAxis
                      domain={[0, 100]}
                      tickCount={5}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 9 }}
                      stroke="hsl(var(--border))"
                      axisLine={false}
                    />
                    <Radar
                      name="Оценка"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fill="hsl(var(--primary))"
                      fillOpacity={0.35}
                    />
                    <RechartsTooltip
                      contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12 }}
                      formatter={(val: any, _n: any, p: any) => {
                        const item = p?.payload;
                        if (item?.kind === 'inverted') {
                          return [`${val}/100 (AI-риск: ${item.raw}/100)`, item.metric];
                        }
                        return [`${val}/100`, item?.metric];
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {scoringRadar.map((s) => (
                  <div key={s.metric} className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground truncate">{s.metric}</span>
                    <span className="tabular-nums font-medium text-foreground">{s.value}/100</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Roadmap</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.executive_summary.roadmap).map(([k, v]) => (
                <div key={k} className="rounded-lg border border-border p-4">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    {k.replace('_', ' ')}
                  </div>
                  <p className="text-sm text-foreground">{v}</p>
                </div>
              ))}
            </div>
          </Card>
          {data.assumptions && data.assumptions.length > 0 && (
            <AssumptionsCard items={data.assumptions} />
          )}
        </TabsContent>

        <TabsContent value="market" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Объём рынка</div>
              <div className="text-2xl font-bold mt-2">{data.market.size_estimate}</div>
            </Card>
            <Card className="p-6">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Темп роста</div>
              <div className="text-2xl font-bold mt-2 text-emerald-500">{data.market.growth_rate}</div>
            </Card>
          </div>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Распределение долей</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.market.key_players}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                  <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Bar dataKey="share" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Map className="w-4 h-4 text-primary" />
              White Spaces
            </h3>
            <ul className="space-y-2">
              {data.market.white_spaces.map((w, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  {w}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="barriers" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">E-E-A-T факторы</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {data.barriers.eeat.map((e, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{e.name}</span>
                    <Badge variant="outline" className={levelColor(e.level)}>{e.level.toUpperCase()}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.note}</p>
                </div>
              ))}
            </div>
          </Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Капитал</h3>
              <p className="text-sm text-muted-foreground">{data.barriers.capital}</p>
            </Card>
            <Card className="p-6">
              <h3 className="text-sm font-semibold text-foreground mb-2">Регулирование</h3>
              <p className="text-sm text-muted-foreground">{data.barriers.regulation}</p>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="strategy" className="mt-4 space-y-4">
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Стратегии входа (Wedges)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {data.strategy.wedges.map((w, i) => (
                <div key={i} className="rounded-lg border border-border p-4 space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">{w.title}</h4>
                  <p className="text-xs text-muted-foreground">{w.description}</p>
                  <div className="flex gap-2 pt-2">
                    <Badge variant="secondary" className="text-[10px]">Усилия: {w.effort}</Badge>
                    <Badge variant="secondary" className="text-[10px]">Импакт: {w.impact}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              Риски
            </h3>
            <ul className="space-y-2">
              {data.strategy.risks.map((r, i) => (
                <li key={i} className="text-sm text-foreground flex gap-2">
                  <span className="text-amber-500">•</span>
                  {r}
                </li>
              ))}
            </ul>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScoreCard({
  label, value, icon: Icon, accent, invert, hint,
}: {
  label: string;
  value: number;
  icon: any;
  accent: string;
  invert?: boolean;
  hint?: string;
}) {
  const display = invert ? `${value}/100` : `${value}/100`;
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium truncate flex items-center gap-1">
            <span className="truncate">{label}</span>
            {hint && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" tabIndex={-1} className="shrink-0 hover:text-foreground transition-colors">
                    <Info className="w-3 h-3" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed normal-case tracking-normal">
                  {hint}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{display}</div>
        </div>
        <div className={`w-9 h-9 rounded-md bg-muted/40 flex items-center justify-center ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <Progress value={value} className="mt-3 h-1.5" />
    </Card>
  );
}

function ModuleDescription() {
  const items = [
    {
      icon: Database,
      title: 'Источники данных',
      desc: 'Параметры формы + знания AI-модели о рынке: спрос, конкуренция, экономика ниши, E-E-A-T-сигналы и риски AI-выдачи.',
    },
    {
      icon: Brain,
      title: 'Как считаем',
      desc: 'Скоринг по 4 метрикам (Search / Commercial / Trust / AI Risk) и сценарный анализ барьеров и White Spaces силами AI-аналитика.',
    },
    {
      icon: FileText,
      title: 'Что получите',
      desc: 'Профессиональный вердикт GO / CAUTION / NO-GO, roadmap на 3-6-12 месяцев и .docx-отчёт для клиента в фирменном оформлении.',
    },
  ];
  return (
    <Card className="p-6 space-y-5">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">О модуле</h2>
        <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
          «Обзор ниши» — стратегический AI-аудит рыночных возможностей. Модуль оценивает поисковый и коммерческий
          потенциал, барьеры входа по E-E-A-T, риск вытеснения трафика AI-ответами и предлагает дорожную карту входа
          под силу домена и горизонт планирования.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="rounded-lg border border-border bg-muted/20 p-4 flex gap-3">
              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4" />
              </div>
              <div className="space-y-1 min-w-0">
                <div className="text-sm font-medium text-foreground">{it.title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{it.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function positionMeta(pos: VerdictPosition) {
  if (pos === 'GO') return {
    label: 'РЕКОМЕНДУЕМ ВХОДИТЬ',
    badge: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
    accent: 'text-emerald-500',
    icon: ShieldCheck,
  };
  if (pos === 'NO-GO') return {
    label: 'НЕ РЕКОМЕНДУЕМ',
    badge: 'bg-rose-500/15 text-rose-500 border-rose-500/30',
    accent: 'text-rose-500',
    icon: XCircle,
  };
  return {
    label: 'ВХОДИТЬ С ОГОВОРКАМИ',
    badge: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
    accent: 'text-amber-500',
    icon: AlertTriangle,
  };
}

function confidenceLabel(c: VerdictConfidence) {
  return c === 'high' ? 'высокая' : c === 'low' ? 'низкая' : 'средняя';
}

function confidenceBadgeClass(c: 'high' | 'medium' | 'low') {
  if (c === 'high') return 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30';
  if (c === 'low') return 'bg-rose-500/15 text-rose-500 border-rose-500/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}

function AssumptionsCard({ items }: { items: Assumption[] }) {
  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-md bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">Гипотезы и предположения</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Места, где AI достроил картину из-за неполных входных данных. Проверьте перед принятием решений.
            </p>
          </div>
        </div>
        <Badge variant="outline" className="border-border text-muted-foreground">
          {items.length} {items.length === 1 ? 'допущение' : 'допущений'}
        </Badge>
      </div>
      <div className="space-y-3">
        {items.map((a, i) => (
          <div key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-500">
                {a.field}
              </div>
              <Badge variant="outline" className={confidenceBadgeClass(a.confidence)}>
                Уверенность: {confidenceLabel(a.confidence)}
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{a.assumption}</p>
            {a.impact && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground/80">Влияние:</span> {a.impact}
              </p>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

function VerdictCard({ verdict }: { verdict: StructuredVerdict }) {
  const meta = positionMeta(verdict.position);
  const Icon = meta.icon;
  return (
    <Card className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-10 h-10 rounded-lg bg-muted/40 flex items-center justify-center ${meta.accent}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              Стратегический вердикт
            </div>
            <h3 className="text-base font-semibold text-foreground leading-snug">
              {verdict.headline}
            </h3>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={meta.badge}>{meta.label}</Badge>
          <Badge variant="outline" className="border-border text-muted-foreground">
            Уверенность: {confidenceLabel(verdict.confidence)}
          </Badge>
        </div>
      </div>

      {verdict.summary && (
        <p className="text-sm text-foreground/90 leading-relaxed">{verdict.summary}</p>
      )}

      {(verdict.key_drivers.length > 0 || verdict.key_risks.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {verdict.key_drivers.length > 0 && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-emerald-500">
                  Ключевые драйверы
                </span>
              </div>
              <ul className="space-y-1.5">
                {verdict.key_drivers.map((d, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-emerald-500 shrink-0">▸</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {verdict.key_risks.length > 0 && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-semibold uppercase tracking-wider text-rose-500">
                  Ключевые риски
                </span>
              </div>
              <ul className="space-y-1.5">
                {verdict.key_risks.map((r, i) => (
                  <li key={i} className="text-sm text-foreground flex gap-2">
                    <span className="text-rose-500 shrink-0">▸</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {verdict.recommendation && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex gap-3">
          <div className="w-8 h-8 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
              Next best action
              <ArrowRight className="w-3 h-3" />
            </div>
            <p className="text-sm text-foreground leading-relaxed">{verdict.recommendation}</p>
          </div>
        </div>
      )}
    </Card>
  );
}
