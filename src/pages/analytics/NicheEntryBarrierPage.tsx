import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Lock, Sparkles, Database, Brain, FileText } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { NicheEntryDifficultyView } from '@/components/analytics/NicheEntryDifficultyView';

type FormData = {
  niche: string; geo: string; language: string;
  businessType: string; siteMaturity: string; domainStrength: string;
  audience: string; goal: string; product: string;
  competitors: string; resources: string; constraints: string;
  horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'Россия', language: 'русский',
  businessType: 'b2b', siteMaturity: 'new', domainStrength: 'weak',
  audience: '', goal: 'traffic', product: '',
  competitors: '', resources: 'small', constraints: '',
  horizon: '12',
};

const LOADING_STAGES = [
  'Определяем scope входа и success threshold...',
  'Декомпозируем нишу на entry segments...',
  'Сравниваем demand и difficulty...',
  'Анализируем SERP barrier и incumbent moats...',
  'Оцениваем trust, content и link барьеры...',
  'Ищем entry wedges и quick wins...',
  'Строим scoring model и final recommendation...',
];

export default function NicheEntryBarrierPage() {
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-niche-entry-difficulty', {
        body: formData,
      });
      if (error) throw error;
      const report = (resp as any)?.report;
      if (!report) throw new Error('AI не вернул отчёт');
      setData(report);
    } catch (e: any) {
      console.error('analyze-niche-entry-difficulty failed', e);
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
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Сложность входа в нишу</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade оценка: насколько реалистично войти в нишу через SEO с учётом типа сайта, ресурсов и структурных барьеров.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <>
              <Card className="p-6 space-y-5">
                <div className="space-y-1">
                  <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                  <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                    Модуль разделяет общую сложность ниши и сложность именно для вашего сайта. Оценивает SERP-барьеры,
                    moat лидеров, trust, links, content depth, geo и ресурсы; находит entry wedges и даёт go / phased / no-go рекомендацию.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {[
                    { icon: Database, title: 'Что учитываем', desc: 'Ниша, тип бизнеса, зрелость сайта, ресурсы, ограничения, горизонт.' },
                    { icon: Brain, title: 'Как считаем', desc: '12 факторов сложности + wedge offset + site-fit adjustment → risk-adjusted score.' },
                    { icon: FileText, title: 'Что получите', desc: 'Scoring, сегменты, барьеры, wedges, quick wins, phased entry plan и итоговое решение.' },
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
                    <Input id="niche" placeholder="Например: сервис доставки продуктов для ресторанов"
                      value={formData.niche} onChange={(e) => update('niche', e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Гео</Label>
                    <Input value={formData.geo} onChange={(e) => update('geo', e.target.value)} placeholder="Россия / Москва / СНГ" />
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
                    <Label>Сила домена</Label>
                    <Select value={formData.domainStrength} onValueChange={(v) => update('domainStrength', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weak">Слабый</SelectItem>
                        <SelectItem value="mid">Средний</SelectItem>
                        <SelectItem value="strong">Сильный</SelectItem>
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
                        <SelectItem value="authority">Topical authority</SelectItem>
                        <SelectItem value="ai">AI visibility</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Ресурсы команды</Label>
                    <Select value={formData.resources} onValueChange={(v) => update('resources', v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Маленькая команда</SelectItem>
                        <SelectItem value="mid">Средняя команда</SelectItem>
                        <SelectItem value="strong">Сильная команда + эксперты + PR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Горизонт (мес.)</Label>
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
                    <Input id="audience" placeholder="Кто клиент: роль, отрасль, размер компании, боли"
                      value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="product">Продукт / категории</Label>
                    <Input id="product" placeholder="Что продаёте, ключевые категории или услуги"
                      value={formData.product} onChange={(e) => update('product', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="competitors">Конкуренты (необязательно)</Label>
                    <Input id="competitors" placeholder="site1.ru, site2.ru, ..."
                      value={formData.competitors} onChange={(e) => update('competitors', e.target.value)} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="constraints">Ограничения</Label>
                    <Textarea id="constraints" rows={2}
                      placeholder="Слабый бренд, мало ссылок, нет reviewers, только блог, ограниченный бюджет..."
                      value={formData.constraints} onChange={(e) => update('constraints', e.target.value)} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end">
                  <Button onClick={run} disabled={!canSubmit} size="lg">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Оценить сложность входа
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
                <h2 className="text-lg font-semibold text-foreground">Анализ сложности входа «{formData.niche || '...'}»</h2>
                <p className="text-sm text-muted-foreground min-h-[20px]">{LOADING_STAGES[stageIndex]}</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={((stageIndex + 1) / LOADING_STAGES.length) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Этап {stageIndex + 1} из {LOADING_STAGES.length}</span>
                  <span>~25 сек</span>
                </div>
              </div>
            </Card>
          )}

          {data && !isLoading && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Отчёт по входу · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Site-specific niche entry difficulty assessment</p>
                </div>
                <Button variant="outline" onClick={() => { setData(null); }}>Новый анализ</Button>
              </div>
              <NicheEntryDifficultyView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}