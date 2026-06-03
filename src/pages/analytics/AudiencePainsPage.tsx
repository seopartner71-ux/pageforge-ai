import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, AlertCircle, Sparkles, FileDown } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AudiencePainsView, AudiencePainsData, normalizeAudiencePains } from '@/components/analytics/AudiencePainsView';
import { PageDescription } from '@/components/PageDescription';
import { exportAudiencePainsDocx } from '@/lib/analytics/exportAudiencePainsDocx';

type FormData = {
  niche: string; geo: string; language: string; businessType: string; monetization: string;
  product: string; audience: string; goal: string; siteMaturity: string; horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', language: 'русский', businessType: 'b2c', monetization: 'sales',
  product: '', audience: '', goal: 'sales', siteMaturity: 'new', horizon: '12',
};

const LOADING_STAGES = [
  'Разделяем core, support, trust и false-assumed проблемы...',
  'Извлекаем root causes и реальный язык аудитории...',
  'Считаем severity, urgency и conversion proximity...',
  'Ищем скрытые и недоработанные кластеры...',
  'Привязываем проблемы к страницам и формируем roadmap...',
];

export default function AudiencePainsPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<AudiencePainsData | null>(null);
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-audience-pains', {
        body: { ...formData },
      });
      if (error) throw error;
      const t = normalizeAudiencePains((resp as any)?.report);
      if (!t) throw new Error('AI не вернул валидную problem map');
      setData(t);
    } catch (e: any) {
      console.error('analyze-audience-pains failed', e);
      toast({ title: 'AI недоступен', description: e?.message || 'Ошибка запроса', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadDocx() {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportAudiencePainsDocx(formData.niche, data);
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
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Проблемы аудитории</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade problem map: реальные боли, root causes, скрытые и ложные проблемы, привязка к страницам и конверсии.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Глубокий аналитический разбор проблем аудитории внутри ниши: не «боли ЦА» из шаблонов, а реальные core / trust / hidden / false-assumed проблемы, на которых строится SEO, контент, conversion-копирайтинг и messaging.' },
                { label: 'Что анализируем', text: '32 фазы: problem universe, JTBD, symptoms vs root causes, trigger moments, journey stages, audience segments, pain types, severity / urgency / recurrence, скрытые и ложные проблемы, реальный язык, trust- и AI-adjusted attractiveness, page-type fit, neglected кластеры, compounding структуры.' },
                { label: 'Зачем', text: 'Чтобы не путать тему и проблему, симптом и root cause, keyword demand и pain severity. Получаете карту проблем, по которой можно строить архитектуру сайта, content strategy, conversion messaging и приоритеты roadmap.' },
                { label: 'Результат', text: '5 score 0-100 (Overall, Pain Intensity, Monetization, Trust Feasibility, AI Opportunity), executive verdict с уровнем pain-driven и рекомендованной стратегической моделью, 7 топ-листов по 5 пунктов, таблица кластеров с root causes и языком аудитории, journey stages, сегменты, скрытые и ложные проблемы, phased roadmap на 30 дней / квартал / 6-12 / 12-24 мес.' },
              ]}
              help={{
                title: 'Методология problem discovery',
                content: [
                  'Цель — отделить настоящие проблемы аудитории от шаблонных «болей ЦА». Большинство pain-листов в маркетинге — это generic клише или founder-centric гипотезы, которые не подтверждаются ни поведением в выдаче, ни деньгами. Мы разделяем core / symptom / trust / decision / implementation / hidden / false-assumed проблемы и оцениваем каждую по силе, срочности, повторяемости и близости к конверсии.',
                  'Root cause важнее симптома. Пользователь говорит «дорого», а реально — не понимает ценности или не доверяет результату. Если строить контент на симптоме, попадёте в hype-кластер с нулевой конверсией. Если на root cause — получите выигрышное messaging и сильные коммерческие страницы.',
                  'Trust-adjusted и AI-adjusted attractiveness — обязательные модификаторы. Сильная боль без trust feasibility не закрывается новым сайтом. Сильная боль, на которую AI уже даёт прямой ответ в выдаче, требует click-defense или citation-first подхода, а не классической SEO-статьи.',
                  'Phased roadmap превращает problem map в реальный план: какие проблемы атаковать сейчас, какие подготовить, какие отложить до роста авторитета, какие переформулировать и какие игнорировать как переоценённые.',
                ],
                sources: [
                  { label: 'Google Search Central — Helpful, reliable, people-first content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Google — E-E-A-T and Quality Rater Guidelines', url: 'https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t' },
                  { label: 'Strategyn — Jobs-to-be-Done framework', url: 'https://strategyn.com/jobs-to-be-done/' },
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
                  <Label htmlFor="audience">Целевая аудитория</Label>
                  <Input id="audience" placeholder="Кто ваши клиенты? Возраст, роль, контекст, ограничения"
                    value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Построить problem map
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
                <h2 className="text-lg font-semibold text-foreground">Строим problem map «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Problem map · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Core / trust / hidden / false-assumed · root causes · roadmap</p>
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
              <AudiencePainsView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}