import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, CalendarRange, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DemandSeasonalityView } from '@/components/analytics/DemandSeasonalityView';

type FormData = {
  niche: string; geo: string; language: string;
  businessType: string; siteMaturity: string; audience: string;
  goal: string; horizon: string; categories: string; regions: string;
  events: string; constraints: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'Россия', language: 'русский',
  businessType: 'services', siteMaturity: 'new', audience: '',
  goal: 'traffic', horizon: '12', categories: '', regions: '',
  events: '', constraints: '',
};

const LOADING_STAGES = [
  'Декомпозируем нишу по сезонным сегментам...',
  'Определяем тип сезонности каждого кластера...',
  'Строим временную карту: pre-season → peak → off-season...',
  'Разделяем сезонность по интентам и аудиториям...',
  'Анализируем внешние факторы: праздники, погода, календари...',
  'Отделяем устойчивую сезонность от шума...',
  'Считаем lead time и evergreen vs seasonal layers...',
  'Формируем editorial calendar и стратегию...',
];

export default function DemandSeasonalityPage() {
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-demand-seasonality', {
        body: formData,
      });
      if (error) throw error;
      const report = (resp as any)?.report;
      if (!report) throw new Error('AI не вернул отчёт');
      setData(report);
    } catch (e: any) {
      console.error('analyze-demand-seasonality failed', e);
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
              <CalendarRange className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Анализ сезонности, циклов и всплесков спроса</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade seasonality map: evergreen vs seasonal, pre-season windows, lead time, editorial calendar.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <>
              <Card className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                  <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    Модуль разделяет evergreen, cyclical, event-driven и spike-driven спрос. Определяет pre-season окна,
                    lead time под публикации и апдейты, evergreen core vs seasonal layers и связывает сезонность
                    с editorial calendar, архитектурой сайта и AI-search стратегией.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { icon: Database, title: 'Что учитываем', desc: 'Ниша, гео, бизнес-модель, аудитория, события, регионы, ограничения.' },
                    { icon: Brain, title: 'Как считаем', desc: '15 фаз × кластеры × интенты × external drivers → seasonal map + lead time.' },
                    { icon: FileText, title: 'Что получите', desc: 'Segments, месячная интенсивность, lead time, editorial calendar, риски, phased plan.' },
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
                    <Input id="niche" placeholder="Например: подготовка к ЕГЭ по математике"
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
                        <SelectItem value="traffic">Трафик</SelectItem>
                        <SelectItem value="leads">Лиды</SelectItem>
                        <SelectItem value="sales">Продажи</SelectItem>
                        <SelectItem value="brand">Узнаваемость</SelectItem>
                        <SelectItem value="ai">AI visibility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Горизонт планирования (мес)</Label>
                    <Select value={formData.horizon} onValueChange={(v) => update('horizon', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="3">3</SelectItem>
                        <SelectItem value="6">6</SelectItem>
                        <SelectItem value="12">12</SelectItem>
                        <SelectItem value="24">24</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="audience">Целевая аудитория</Label>
                    <Input id="audience" placeholder="Кто клиент, роль, отрасль, потребности"
                      value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="categories">Продуктовые категории / направления</Label>
                    <Input id="categories" placeholder="Список направлений через запятую"
                      value={formData.categories} onChange={(e) => update('categories', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="regions">Регионы (если несколько рынков)</Label>
                    <Input id="regions" placeholder="Москва, СПб, регионы РФ, СНГ..."
                      value={formData.regions} onChange={(e) => update('regions', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="events">Важные события / даты (если известны)</Label>
                    <Textarea id="events" rows={2}
                      placeholder="Праздники, распродажи, отраслевые ивенты, экзамены, отчётные периоды, климатические пики..."
                      value={formData.events} onChange={(e) => update('events', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="constraints">Ограничения команды</Label>
                    <Textarea id="constraints" rows={2}
                      placeholder="Мало ресурсов, нет разработки, только блог, только коммерческие страницы..."
                      value={formData.constraints} onChange={(e) => update('constraints', e.target.value)} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={run} disabled={!canSubmit} size="lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Проанализировать сезонность
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
                <h2 className="text-lg font-semibold text-foreground">Анализ сезонности «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Сезонность · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Seasonal SEO map + editorial calendar</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); }}>Новый анализ</Button>
              </div>
              <DemandSeasonalityView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}