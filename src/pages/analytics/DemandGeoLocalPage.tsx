import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Globe2, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { DemandGeoLocalView } from '@/components/analytics/DemandGeoLocalView';

type FormData = {
  niche: string; geo: string; additionalGeos: string; language: string; locales: string;
  businessType: string; workModel: string; audience: string; goal: string;
  categories: string; presence: string; constraints: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'Россия', additionalGeos: '', language: 'русский', locales: '',
  businessType: 'services', workModel: 'national', audience: '', goal: 'leads',
  categories: '', presence: '', constraints: '',
};

const LOADING_STAGES = [
  'Оцениваем уровень геозависимости ниши...',
  'Декомпозируем спрос по country / region / city / locale...',
  'Сравниваем спрос и конкуренцию между гео...',
  'Ищем языковые различия и local terminology...',
  'Строим карту локального интента и SERP-архетипов...',
  'Находим гео-возможности и барьеры входа...',
  'Проектируем архитектуру: country / regional / city / location pages...',
  'Приоритизируем рынки и формируем phased plan...',
];

export default function DemandGeoLocalPage() {
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-demand-geo-local', {
        body: formData,
      });
      if (error) throw error;
      const report = (resp as any)?.report;
      if (!report) throw new Error('AI не вернул отчёт');
      setData(report);
    } catch (e: any) {
      console.error('analyze-demand-geo-local failed', e);
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
              <Globe2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Географические и локальные возможности</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade карта geo & locale opportunity: приоритизация рынков, local SERP, city / country pages, локализация vs перевод.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <>
              <Card className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                  <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    Модуль разделяет country / region / city / locale-level возможности, отличает local intent от national,
                    локализацию от перевода. Определяет приоритетные рынки, SERP-архетипы, барьеры входа,
                    архитектуру гео-страниц, local trust и AI-search импликации.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { icon: Database, title: 'Что учитываем', desc: 'Ниша, основное и доп. гео, язык, локали, тип бизнеса, модель работы, аудитория, ограничения.' },
                    { icon: Brain, title: 'Как считаем', desc: '15 фаз × country/region/city/locale × intent × SERP × trust → geo opportunity map.' },
                    { icon: FileText, title: 'Что получите', desc: 'Приоритизация рынков, SERP-паттерны, barriers, wedges, архитектура, локализация, phased plan.' },
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
                    <Input id="niche" placeholder="Например: юридические услуги для малого бизнеса"
                      value={formData.niche} onChange={(e) => update('niche', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Основное гео</Label>
                    <Input value={formData.geo} onChange={(e) => update('geo', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Дополнительные гео (через запятую)</Label>
                    <Input placeholder="Казахстан, Беларусь, ОАЭ..."
                      value={formData.additionalGeos} onChange={(e) => update('additionalGeos', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Язык</Label>
                    <Input value={formData.language} onChange={(e) => update('language', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Локали (если релевантно)</Label>
                    <Input placeholder="ru-RU, ru-KZ, en-US..."
                      value={formData.locales} onChange={(e) => update('locales', e.target.value)} />
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
                    <Label>Модель работы</Label>
                    <Select value={formData.workModel} onValueChange={(v) => update('workModel', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national">National</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="multi-location">Multi-location</SelectItem>
                        <SelectItem value="international">International</SelectItem>
                        <SelectItem value="multilingual">Multilingual</SelectItem>
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
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="audience">Целевая аудитория</Label>
                    <Input id="audience" placeholder="Кто клиент, роль, отрасль, потребности"
                      value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="categories">Продуктовые категории / услуги</Label>
                    <Input id="categories" placeholder="Список через запятую"
                      value={formData.categories} onChange={(e) => update('categories', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="presence">Регионы присутствия бизнеса</Label>
                    <Input id="presence" placeholder="Города, офисы, склады, представительства..."
                      value={formData.presence} onChange={(e) => update('presence', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="constraints">Ограничения</Label>
                    <Textarea id="constraints" rows={2}
                      placeholder="Нет локальных офисов / нет отзывов / нет разработки / только блог / только коммерческие страницы..."
                      value={formData.constraints} onChange={(e) => update('constraints', e.target.value)} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={run} disabled={!canSubmit} size="lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Построить geo opportunity map
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
                <h2 className="text-lg font-semibold text-foreground">Гео-анализ «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Geo opportunity map · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Country / region / city / locale-level стратегия</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); }}>Новый анализ</Button>
              </div>
              <DemandGeoLocalView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}