import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Target, Sparkles, FileDown } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AudienceJtbdView, AudienceJtbdData, normalizeAudienceJtbd } from '@/components/analytics/AudienceJtbdView';
import { PageDescription } from '@/components/PageDescription';
import { exportAudienceJtbdDocx } from '@/lib/analytics/exportAudienceJtbdDocx';

type FormData = {
  niche: string; geo: string; language: string; businessType: string; monetization: string;
  product: string; audience: string; goal: string; siteMaturity: string; horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', language: 'русский', businessType: 'b2c', monetization: 'sales',
  product: '', audience: '', goal: 'sales', siteMaturity: 'new', horizon: '12',
};

const LOADING_STAGES = [
  'Разбираем, какой реальный прогресс пытаются совершить пользователи...',
  'Строим JTBD universe: функциональные, эмоциональные, decision, trust, retention...',
  'Раскладываем силы прогресса (push / pull / habit / anxiety) и триггеры...',
  'Считаем спрос, конверсию, доверие, ИИ и feasibility по каждой задаче...',
  'Собираем underserved, переоценённые и усиливающие связки задач...',
  'Формируем roadmap на 30 дней / квартал / 6-12 / 12-24 месяца...',
];

export default function AudienceJtbdPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<AudienceJtbdData | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
      const { data: resp, error } = await supabase.functions.invoke('analyze-audience-jtbd', {
        body: { ...formData },
      });
      if (error) throw error;
      const t = normalizeAudienceJtbd((resp as any)?.report);
      if (!t) throw new Error('AI не вернул валидную JTBD-карту');
      setData(t);
    } catch (e: any) {
      console.error('analyze-audience-jtbd failed', e);
      toast({ title: 'AI недоступен', description: e?.message || 'Ошибка запроса', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadDocx() {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportAudienceJtbdDocx(formData.niche, data);
    } catch (e: any) {
      toast({ title: 'Не удалось сформировать DOCX', description: e?.message || 'Ошибка', variant: 'destructive' });
    } finally {
      setIsExporting(false);
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
              <Target className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Задачи клиентов (JTBD)</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Карта реальных задач, которые «нанимают» решать пользователи: силы прогресса, триггеры, путь клиента и поэтапный план под SEO, контент и конверсию.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Decision-grade JTBD-карта: не «темы и ключи», а реальные задачи, которые пользователь пытается выполнить, перейти из текущего состояния в желаемое и оценить успех — основа архитектуры сайта, messaging и CTA.' },
                { label: 'Что анализируем', text: '33 фазы: типы задач, JTBD universe, прогресс, силы (push/pull/habit/anxiety), триггеры, путь клиента, сегменты, sophistication, желаемые результаты, барьеры, язык задачи, связки с проблемами, спросом, query-классами, страницами, форматами, конверсией, доверием, ИИ, монетизацией и гео; underserved, переоценённые и усиливающие связки.' },
                { label: 'Зачем', text: 'Чтобы перестать путать задачу и тему, задачу и фичу, задачу и проблему. Получаете приоритизированный портфель задач: какие закрывать сейчас (quick wins + high-conversion), какие готовить, какие мониторить, какие — переоценённые и не стоит вкладываться.' },
                { label: 'Результат', text: '6 score 0-100 (Итог, Спрос, Бизнес, Конверсия, Доверие, ИИ), сводный вердикт со стратегической моделью, 7 топ-листов, 6-10 карточек задач с прогрессом и языком пользователя, таблицы сил прогресса и триггеров, путь клиента, цепочки усиливающих задач, поэтапный план на 30 дней / квартал / 6-12 / 12-24 мес и DOCX-отчёт.' },
              ]}
              help={{
                title: 'Методология Jobs-to-be-Done для SEO',
                content: [
                  'JTBD — это не «персона» и не «потребность». Это конкретная работа, которую пользователь пытается выполнить, и прогресс, который он хочет совершить: «перейти из растерянности к ясности», «из выбора к уверенности», «из неработающего решения — к работающему». Тема — это про что страница. Задача — что человек хочет в итоге получить.',
                  'Forces of progress (push/pull/habit/anxiety) определяют messaging и дизайн страниц. Push — что выталкивает из текущей ситуации. Pull — чем привлекает новое решение. Habit — что удерживает на старом. Anxiety — чего боится при переходе. Хорошая страница явно адресует все четыре силы.',
                  'Trust-adjusted и AI-adjusted фильтры обязательны. Сильная задача с высоким trust threshold (YMYL, B2B-purchase) не закрывается без proof-слоя — её отправляем в «готовить». Задача, на которую AI даёт прямой ответ, требует click-defense, citation-first или deeper execution — иначе трафик уходит в SGE.',
                  'Поэтапный план переводит JTBD-карту в реальный порядок действий: 30 дней — quick wins и high-conversion задачи под текущие активы; квартал — core задачи с подготовленными trust- и format-слоями; 6-24 мес — authority, compounding-связки (диагностика → выбор → внедрение → удержание) и AI-устойчивые ответы.',
                ],
                sources: [
                  { label: 'Strategyn — Jobs-to-be-Done framework', url: 'https://strategyn.com/jobs-to-be-done/' },
                  { label: 'JTBD.info — Forces of Progress', url: 'https://jtbd.info/replacing-the-user-story-with-the-job-story-af7cdee10c27' },
                  { label: 'Google Search Central — People-first content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Google — E-E-A-T and Quality Rater Guidelines', url: 'https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t' },
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="product">Продукт / услуга / категории</Label>
                  <Input id="product" placeholder="Что вы продаёте"
                    value={formData.product} onChange={(e) => update('product', e.target.value)} />
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
                      <SelectItem value="saas">SaaS</SelectItem>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                      <SelectItem value="services">Услуги</SelectItem>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="media">Media</SelectItem>
                      <SelectItem value="marketplace">Marketplace</SelectItem>
                      <SelectItem value="local">Local business</SelectItem>
                      <SelectItem value="b2b">B2B</SelectItem>
                      <SelectItem value="b2c">B2C</SelectItem>
                      <SelectItem value="expert">Expert brand</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Модель монетизации</Label>
                  <Select value={formData.monetization} onValueChange={(v) => update('monetization', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="leads">Лиды</SelectItem>
                      <SelectItem value="sales">Продажи</SelectItem>
                      <SelectItem value="subscription">Подписка</SelectItem>
                      <SelectItem value="affiliate">Affiliate</SelectItem>
                      <SelectItem value="ads">Реклама</SelectItem>
                      <SelectItem value="marketplace">Marketplace fee</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
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
                      <SelectItem value="authority">Authority</SelectItem>
                      <SelectItem value="ai-visibility">AI Visibility</SelectItem>
                      <SelectItem value="entry">Market entry</SelectItem>
                      <SelectItem value="messaging">Messaging</SelectItem>
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
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="audience">Известная аудитория / гипотезы задач</Label>
                  <Input id="audience" placeholder="Например: новички боятся выбрать неверный курс — если есть гипотезы"
                    value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Построить JTBD-карту
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
                <h2 className="text-lg font-semibold text-foreground">Строим JTBD-карту «{formData.niche || '...'}»</h2>
                <p className="text-sm text-muted-foreground min-h-[20px]">{LOADING_STAGES[stageIndex]}</p>
              </div>
              <div className="w-full max-w-md space-y-2">
                <Progress value={((stageIndex + 1) / LOADING_STAGES.length) * 100} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Этап {stageIndex + 1} из {LOADING_STAGES.length}</span>
                  <span>~60 сек</span>
                </div>
              </div>
            </Card>
          )}

          {data && !isLoading && (
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">JTBD-карта · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Задачи · силы · триггеры · путь · связки · roadmap</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={downloadDocx} disabled={isExporting}>
                    {isExporting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
                    Скачать DOCX
                  </Button>
                  <Button variant="outline" onClick={() => { setData(null); setFormData(DEFAULT_FORM); }}>
                    Новый анализ
                  </Button>
                </div>
              </div>
              <AudienceJtbdView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}