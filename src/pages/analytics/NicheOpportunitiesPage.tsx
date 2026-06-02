import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { OpportunitiesView, OpportunitiesData, normalizeOpportunities } from '@/components/analytics/OpportunitiesView';

type FormData = {
  niche: string;
  geo: string;
  businessType: string;
  monetization: string;
  audience: string;
  domainStrength: string;
  horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', businessType: 'b2b', monetization: 'subscription',
  audience: '', domainStrength: 'new', horizon: '6',
};

const LOADING_STAGES = [
  'Сканируем спрос, SERP и интенты...',
  'Картируем подниши и intent layers...',
  'Ищем wedges, gaps и compounding-пары...',
  'Считаем risk-adjusted score возможностей...',
  'Собираем 24-месячный sequencing...',
];

const MOCK_OPPORTUNITIES: OpportunitiesData = {
  summary: 'Ниша opportunity-rich, но «тяжёлый верх» закрыт лидерами. Реальные возможности — в узких вертикалях, локальном B2B и канонических сравнительных активах.',
  portfolio: {
    core_growth: ['Хаб «Сравнения и альтернативы» под вертикали', 'Use-case кластеры для логистики и салонов', 'Канонический глоссарий категории'],
    quick_wins: ['10 long-tail сравнений «X vs Y для [вертикали]»', 'Локальные посадочные для 5 городов', 'Калькулятор ROI / окупаемости'],
    revenue_priority: ['Pricing-страницы по сегментам', 'Use-case → демо-форма', 'Кейс-стади с ROI и цифрами'],
    trust_building: ['Авторы-эксперты с публичным треком', 'Прозрачная методология ревью'],
    authority_ai_visibility: ['Цитируемые stats-страницы', 'FAQ-хабы под answer-форматы'],
    defer: ['Broad head-термины', 'Тяжёлые медиа-форматы без распределения'],
    avoid: ['Affiliate-сравнения без дифференциации'],
  },
  top_overall: [
    { title: 'Vertical comparison hub', why: 'Низкая SERP-конкуренция в вертикали, высокий коммерческий интент.', best_format: 'Сравнительный хаб', speed_to_impact: 'q1', demand_quality: 75, business_value: 85, accessibility: 70, serp_openness: 80, ai_upside: 55, overall_score: 78 },
    { title: 'Локальные посадочные B2B', why: 'Местный SERP открыт, low-volume × high-value.', best_format: 'City + service pages', speed_to_impact: '30d', demand_quality: 60, business_value: 80, accessibility: 85, serp_openness: 85, ai_upside: 40, overall_score: 74 },
  ],
  wedges: [
    { title: 'Comparison wedge', asset: '«X vs Y для [вертикали]»', payoff: 'Быстрый коммерческий трафик', speed: 'q1' },
    { title: 'Local wedge', asset: 'City pages + локальные кейсы', payoff: 'Низкая конкуренция, тёплые лиды', speed: '30d' },
  ],
  compounding: [
    { pair: 'Глоссарий → Сравнения', sequencing: 'Сначала definition-страницы, затем сравнения цитируют их.', payoff: 'Внутренний линкинг и topical authority.' },
  ],
  traps: [
    { title: 'Broad head-термины', why_looks_good: 'Огромный объём поиска.', why_risk: 'Заняты лидерами и AI Overviews.' },
  ],
  gaps: [
    { title: 'Use-case сегментация по ролям', why_underserved: 'Конкуренты не сегментируют по ролям.', asset_needed: 'Role × industry pages.' },
  ],
  sequencing: {
    '30_days': ['10 локальных посадочных', '5 alternatives-страниц'],
    q1: ['Comparison hub запуск', 'ROI-калькулятор v1'],
    q2: ['Industry stats / benchmarks', 'PR-outreach'],
    '6_12m': ['Authority hub под вертикаль', 'Pricing-страницы по сегментам'],
    '12_24m': ['Расширение в смежные вертикали', 'Партнёрская программа'],
  },
  launch_model: 'wedge-first',
  recommendation: 'phased-go',
};

export default function NicheOpportunitiesPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<OpportunitiesData | null>(null);

  useEffect(() => {
    if (!isLoading) return;
    setStageIndex(0);
    const id = setInterval(() => setStageIndex((i) => (i + 1) % LOADING_STAGES.length), 4000);
    return () => clearInterval(id);
  }, [isLoading]);

  const update = <K extends keyof FormData>(k: K, v: FormData[K]) =>
    setFormData((s) => ({ ...s, [k]: v }));

  async function run() {
    setIsLoading(true);
    setData(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke('analyze-niche', { body: formData });
      if (error) throw error;
      const opp = normalizeOpportunities((resp as any)?.report?.opportunities);
      if (!opp) throw new Error('AI не вернул блок возможностей');
      setData(opp);
    } catch (e: any) {
      console.error('analyze-niche opportunities failed', e);
      toast({
        title: 'AI недоступен',
        description: (e?.message || 'Ошибка запроса') + '. Показан демо-отчёт.',
        variant: 'destructive',
      });
      setData(MOCK_OPPORTUNITIES);
    } finally {
      setIsLoading(false);
    }
  }

  const canSubmit = formData.niche.trim().length > 1 && !isLoading;

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="container max-w-[1400px] py-8 space-y-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Рыночные возможности</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade карта SEO-возможностей: risk-adjusted scoring, wedges, gaps, traps и 24-месячный sequencing.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <Card className="p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  Модуль превращает нишу в портфель приоритизированных SEO-возможностей: оценивает demand quality,
                  бизнес-ценность, доступность, открытость SERP и AI-upside, отсекает ложные «лёгкие победы» и предлагает порядок запуска.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: Database, title: 'Источники данных', desc: 'Параметры формы + знания AI о спросе, конкуренции, SERP и поведении AI-выдачи.' },
                  { icon: Brain, title: 'Как считаем', desc: 'Risk-adjusted скоринг по 5 факторам, кластеризация в Core / Quick wins / Revenue / Trust / Authority, отсев traps.' },
                  { icon: FileText, title: 'Что получите', desc: 'Карта opportunity portfolio, топ-возможности, wedges, compounding-пары, gaps, traps и стратегический sequencing.' },
                ].map((it) => {
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
          )}

          {!data && !isLoading && (
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="niche">Ниша / тематика *</Label>
                  <Input
                    id="niche"
                    placeholder="Например: онлайн-курсы по программированию"
                    value={formData.niche}
                    onChange={(e) => update('niche', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Гео</Label>
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
                  <Label>Тип бизнеса</Label>
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
                  <Label>Монетизация</Label>
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
                  <Label>Сила домена</Label>
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
                  <Label htmlFor="audience">Целевая аудитория</Label>
                  <Input
                    id="audience"
                    placeholder="Кто ваши клиенты? Возраст, роль, проблемы"
                    value={formData.audience}
                    onChange={(e) => update('audience', e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Горизонт планирования</Label>
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
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Построить opportunity map
                </Button>
              </div>
            </Card>
          )}

          {isLoading && (
            <Card className="p-12 min-h-[420px] flex flex-col items-center justify-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Анализ возможностей «{formData.niche || '...'}»</h2>
                <p className="text-sm text-muted-foreground min-h-[20px]">{LOADING_STAGES[stageIndex]}</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={((stageIndex + 1) / LOADING_STAGES.length) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Этап {stageIndex + 1} из {LOADING_STAGES.length}</span>
                  <span>~15 сек</span>
                </div>
              </div>
            </Card>
          )}

          {data && !isLoading && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Opportunity map · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Risk-adjusted портфель SEO-возможностей</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); setFormData(DEFAULT_FORM); }}>
                  Новый анализ
                </Button>
              </div>
              <OpportunitiesView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}
