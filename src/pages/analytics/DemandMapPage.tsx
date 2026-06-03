import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Map, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DemandMapView, DemandMapData, normalizeDemandMap } from '@/components/analytics/DemandMapView';
import { PageDescription } from '@/components/PageDescription';

type FormData = {
  niche: string; geo: string; businessType: string; monetization: string;
  audience: string; domainStrength: string; horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', businessType: 'b2b', monetization: 'subscription',
  audience: '', domainStrength: 'new', horizon: '6',
};

const LOADING_STAGES = [
  'Картируем спрос по слоям buyer journey...',
  'Распределяем intent: commercial / info / local / support...',
  'Отделяем high-value кластеры от vanity-зон...',
  'Считаем trust-adjusted барьеры и AI/SERP риски...',
  'Собираем sequencing roadmap по горизонтам...',
];

export default function DemandMapPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<DemandMapData | null>(null);

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
      const { data: resp, error } = await supabase.functions.invoke('analyze-demand-map', {
        body: { ...formData },
      });
      if (error) throw error;
      const map = normalizeDemandMap((resp as any)?.report);
      if (!map) throw new Error('AI не вернул валидную карту спроса');
      setData(map);
    } catch (e: any) {
      console.error('analyze-demand-map failed', e);
      toast({
        title: 'AI недоступен',
        description: e?.message || 'Ошибка запроса',
        variant: 'destructive',
      });
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
              <Map className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Карта спроса</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade demand map: buyer journey, intent distribution, vanity vs value, trust-adjusted барьеры и sequencing roadmap.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Decision-grade карта спроса в нише: раскладывает рынок по слоям buyer journey (Problem Awareness → Solution → Vendor Research → Evaluation → Purchase → Post-Purchase) и intent-слоям, отделяя реальные деньги от ложного объёма.' },
                { label: 'Что анализируем', text: 'Сила спроса по стадиям и бизнес-ценность стадий, распределение intent (commercial / informational / local / support), high-value vs vanity кластеры, trust-adjusted барьеры (raw demand × E-E-A-T × accessibility), AI upside, SERP openness, zero-click risk.' },
                { label: 'Зачем', text: 'Чтобы выбирать стратегический scope не по интуиции и не по объёмам Wordstat, а по risk-adjusted модели — где реально лежат деньги, где спрос ложный, где барьер E-E-A-T убивает ROI, и какие слои отдадут трафик зерокликам и AI.' },
                { label: 'Результат', text: '4 score 0–100 (overall attractiveness, commercial value, AI resilience, trust feasibility), executive summary, топ-5 quick wins / avoid zones, карта buyer journey с запросами и sequencing roadmap на 30 дней / квартал / 6–12 месяцев с конкретными page types.' },
              ]}
              help={{
                title: 'Методология карты спроса',
                content: [
                  'Карта спроса (demand map) — это decomposition ниши не по ключевым словам, а по слоям пользовательского намерения. Мы исходим из модели buyer journey: каждая стадия (Problem Awareness, Solution Awareness, Vendor Research, Evaluation, Purchase, Post-Purchase / Advocacy) генерирует свой тип запросов, свою конверсионную ценность и требует своего page type.',
                  'Risk-adjusted scoring отличает реальный коммерческий спрос от vanity-зон: высокочастотные кластеры с низкой конверсией, размытым intent или жёстким E-E-A-T барьером (YMYL: медицина, финансы) могут давать миллионы показов и ноль выручки. Мы фиксируем такие зоны явно — чтобы их не таргетить.',
                  'AI/SERP-блок оценивает три вещи: AI upside (citation потенциал, structured data, прямые ответы), SERP openness (насколько открыта выдача для нового домена vs marketplace/aggregator dominance) и zero-click risk — доля запросов, на которые пользователь получает ответ прямо в SERP.',
                  'Sequencing roadmap привязывает выводы к исполнению: 30 дней — быстрые wins, low-EEAT, high openness; квартал — доменный трафик, glossary, comparison; 6–12 месяцев — authority, money pages, локальные кластеры. Page types конкретные: blog, glossary, comparison, calculator, pricing, service, case-study, FAQ, local.',
                ],
                sources: [
                  { label: 'Google Search Central — Helpful, reliable, people-first content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Google — E-E-A-T and Quality Rater Guidelines', url: 'https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t' },
                  { label: 'Google Search Central — SEO Starter Guide', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
                  { label: 'SparkToro — Zero-click search study', url: 'https://sparktoro.com/blog/2024-zero-click-search-study/' },
                ],
              }}
            />
          )}

          {!data && !isLoading && (
            <Card className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="niche">Ниша / тематика *</Label>
                  <Input id="niche" placeholder="Например: онлайн-курсы по программированию"
                    value={formData.niche} onChange={(e) => update('niche', e.target.value)} />
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
                  <Input id="audience" placeholder="Кто ваши клиенты? Возраст, роль, проблемы"
                    value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
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
                  Построить карту спроса
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
                <h2 className="text-lg font-semibold text-foreground">Анализ спроса «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Demand map · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Risk-adjusted карта спроса по слоям</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); setFormData(DEFAULT_FORM); }}>
                  Новый анализ
                </Button>
              </div>
              <DemandMapView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}