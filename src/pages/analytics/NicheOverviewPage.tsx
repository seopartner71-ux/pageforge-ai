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
};

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
              <h3 className="text-sm font-semibold text-foreground mb-3">Профиль ниши</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={scoringRadar}>
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="metric" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                  </RadarChart>
                </ResponsiveContainer>
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
