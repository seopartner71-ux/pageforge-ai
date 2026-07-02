import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Coins, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { NicheMonetizationFitView } from '@/components/analytics/NicheMonetizationFitView';

type FormData = {
  niche: string; geo: string; language: string;
  businessType: string; monetizationModel: string; alternativeModels: string;
  product: string; audience: string; goal: string; siteMaturity: string;
  economics: string; conversionPoints: string;
  competitors: string; constraints: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'Россия', language: 'русский',
  businessType: 'services', monetizationModel: 'leads', alternativeModels: '',
  product: '', audience: '', goal: 'sales', siteMaturity: 'new',
  economics: '', conversionPoints: '',
  competitors: '', constraints: '',
};

const LOADING_STAGES = [
  'Определяем monetization scope и success threshold...',
  'Декомпозируем нишу по monetization segments...',
  'Сравниваем модели монетизации: leads / subscription / sales / affiliate / ads...',
  'Считаем demand-to-revenue alignment и WTP...',
  'Оцениваем conversion path complexity и trust...',
  'Ищем monetization wedges и low-fit зоны...',
  'Строим scoring model и final recommendation...',
];

export default function NicheMonetizationPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<any>(null);

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
      const { data: resp, error } = await supabase.functions.invoke('analyze-niche-monetization-fit', {
        body: formData,
      });
      if (error) throw error;
      const report = (resp as any)?.report;
      if (!report) throw new Error('AI не вернул отчёт');
      setData(report);
    } catch (e: any) {
      console.error('analyze-niche-monetization-fit failed', e);
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
              <Coins className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Соответствие ниши модели монетизации</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade monetization fit map: где реальные деньги, какие модели подходят, где traffic не равен revenue.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <>
              <Card className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                  <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    Модуль отделяет traffic potential от monetization fit. Оценивает WTP, urgency, trust, conversion path,
                    value density, retention и подсказывает, какая модель монетизации даст лучший revenue-per-traffic.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { icon: Database, title: 'Что учитываем', desc: 'Ниша, бизнес-модель, экономика, ресурсы, точки конверсии, ограничения.' },
                    { icon: Brain, title: 'Как считаем', desc: '22 фактора × сегменты × модели монетизации → risk-adjusted fit score.' },
                    { icon: FileText, title: 'Что получите', desc: 'Scoring, wedges, low-fit зоны, page-type fit, retention, phased launch plan.' },
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

              <Card className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="niche">Ниша / тематика *</Label>
                    <Input id="niche" placeholder="Например: онлайн-курсы по инвестициям"
                      value={formData.niche} onChange={(e) => update('niche', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Гео</Label>
                    <Input value={formData.geo} onChange={(e) => update('geo', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Язык</Label>
                    <Input value={formData.language} onChange={(e) => update('language', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Тип бизнеса</Label>
                    <Select value={formData.businessType} onValueChange={(v) => update('businessType', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saas">SaaS</SelectItem>
                        <SelectItem value="ecommerce">E-commerce</SelectItem>
                        <SelectItem value="services">Услуги</SelectItem>
                        <SelectItem value="affiliate">Affiliate</SelectItem>
                        <SelectItem value="media">Media / publisher</SelectItem>
                        <SelectItem value="marketplace">Marketplace</SelectItem>
                        <SelectItem value="local">Local business</SelectItem>
                        <SelectItem value="b2b">B2B</SelectItem>
                        <SelectItem value="b2c">B2C</SelectItem>
                        <SelectItem value="subscription">Subscription</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Рассматриваемая модель монетизации</Label>
                    <Select value={formData.monetizationModel} onValueChange={(v) => update('monetizationModel', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="leads">Лиды</SelectItem>
                        <SelectItem value="subscription">Подписка / SaaS</SelectItem>
                        <SelectItem value="sales">Продажи</SelectItem>
                        <SelectItem value="affiliate">Affiliate</SelectItem>
                        <SelectItem value="ads">Реклама / media</SelectItem>
                        <SelectItem value="demo">Demo / trial</SelectItem>
                        <SelectItem value="consultation">Consultation</SelectItem>
                        <SelectItem value="booking">Booking</SelectItem>
                        <SelectItem value="marketplace-fee">Marketplace fee</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Тип сайта</Label>
                    <Select value={formData.siteMaturity} onValueChange={(v) => update('siteMaturity', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Новый</SelectItem>
                        <SelectItem value="growing">Растущий</SelectItem>
                        <SelectItem value="mature">Зрелый</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Приоритетная цель</Label>
                    <Select value={formData.goal} onValueChange={(v) => update('goal', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="revenue">Revenue growth</SelectItem>
                        <SelectItem value="leads">Лиды</SelectItem>
                        <SelectItem value="sales">Продажи</SelectItem>
                        <SelectItem value="subscriptions">Подписки</SelectItem>
                        <SelectItem value="commission">Commission</SelectItem>
                        <SelectItem value="brand">Brand authority</SelectItem>
                        <SelectItem value="ai">AI visibility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="alternativeModels">Альтернативные модели (через запятую)</Label>
                    <Input id="alternativeModels" placeholder="subscription, affiliate, consultation"
                      value={formData.alternativeModels} onChange={(e) => update('alternativeModels', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product">Продукт / услуги / категории</Label>
                    <Input id="product" placeholder="Что продаёте, ключевые категории или услуги"
                      value={formData.product} onChange={(e) => update('product', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="audience">Целевая аудитория</Label>
                    <Input id="audience" placeholder="Кто клиент: роль, отрасль, боль, размер компании"
                      value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="economics">Средний чек / LTV / recurring</Label>
                    <Input id="economics" placeholder="Например: 2 000 ₽/мес, LTV 24 мес, retention 65%"
                      value={formData.economics} onChange={(e) => update('economics', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="conversionPoints">Точки конверсии</Label>
                    <Input id="conversionPoints" placeholder="форма / demo / trial / checkout / звонок / booking"
                      value={formData.conversionPoints} onChange={(e) => update('conversionPoints', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="competitors">Конкуренты (необязательно)</Label>
                    <Input id="competitors" placeholder="site1.ru, site2.ru, ..."
                      value={formData.competitors} onChange={(e) => update('competitors', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="constraints">Ограничения</Label>
                    <Textarea id="constraints" rows={2}
                      placeholder="Нет sales team, только блог, слабый бренд, ограниченный бюджет..."
                      value={formData.constraints} onChange={(e) => update('constraints', e.target.value)} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={run} disabled={!canSubmit} size="lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Оценить monetization fit
                  </Button>
                </div>
              </Card>
            </>
          )}

          {isLoading && (
            <Card className="p-12 min-h-[420px] flex flex-col items-center justify-center text-center gap-6">
              <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
              </div>
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">Анализ monetization fit «{formData.niche || '...'}»</h2>
                <p className="text-sm text-muted-foreground min-h-[20px]">{LOADING_STAGES[stageIndex]}</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={((stageIndex + 1) / LOADING_STAGES.length) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Этап {stageIndex + 1} из {LOADING_STAGES.length}</span>
                  <span>~30 сек</span>
                </div>
              </div>
            </Card>
          )}

          {data && !isLoading && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Monetization fit · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Revenue-fit assessment for chosen monetization model</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); }}>Новый анализ</Button>
              </div>
              <NicheMonetizationFitView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}