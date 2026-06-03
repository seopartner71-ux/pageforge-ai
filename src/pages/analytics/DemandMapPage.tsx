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
            <Card className="p-6 space-y-5">
              <div className="space-y-1">
                <h2 className="text-base font-semibold text-foreground">О модуле</h2>
                <p className="text-sm text-muted-foreground max-w-3xl leading-relaxed">
                  Раскладывает спрос ниши по стадиям buyer journey и intent-слоям, отделяет
                  real-value кластеры от vanity-зон, фиксирует trust- и AI-барьеры, выдаёт sequencing roadmap.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { icon: Database, title: 'Источники данных', desc: 'Параметры формы + экспертная модель спроса, intent-таксономия, SERP-знание.' },
                  { icon: Brain, title: 'Как считаем', desc: '4 score 0–100 (attractiveness, commercial, AI-resilience, trust-feasibility), risk-adjusted интерпретация.' },
                  { icon: FileText, title: 'Что получите', desc: 'Buyer journey, intent split, vanity-vs-value, trust-adjusted барьеры, AI/SERP риски, 30d / Q1 / 6–12m roadmap.' },
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