import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Users, Sparkles, FileDown } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { AudienceSegmentsView, AudienceSegmentsData, normalizeAudienceSegments } from '@/components/analytics/AudienceSegmentsView';
import { PageDescription } from '@/components/PageDescription';
import { exportAudienceSegmentsDocx } from '@/lib/analytics/exportAudienceSegmentsDocx';

type FormData = {
  niche: string; geo: string; language: string; businessType: string; monetization: string;
  product: string; audience: string; goal: string; siteMaturity: string; horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', language: 'русский', businessType: 'b2c', monetization: 'sales',
  product: '', audience: '', goal: 'sales', siteMaturity: 'new', horizon: '12',
};

const LOADING_STAGES = [
  'Строим segmentation universe: роли, JTBD, sophistication, use-cases...',
  'Считаем business value, конверсию, trust, AI и feasibility по сегментам...',
  'Ищем underserved, overhyped и false segments...',
  'Находим segment-driven wedges и compounding structures...',
  'Привязываем сегменты к страницам и формируем roadmap...',
];

export default function AudienceSegmentsPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<AudienceSegmentsData | null>(null);
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-audience-segments', {
        body: { ...formData },
      });
      if (error) throw error;
      const t = normalizeAudienceSegments((resp as any)?.report);
      if (!t) throw new Error('AI не вернул валидную segmentation map');
      setData(t);
    } catch (e: any) {
      console.error('analyze-audience-segments failed', e);
      toast({ title: 'AI недоступен', description: e?.message || 'Ошибка запроса', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadDocx() {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportAudienceSegmentsDocx(formData.niche, data);
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
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Сегменты аудитории</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Decision-grade segmentation map: реальные сегменты, JTBD, путь клиента, wedges и phased roadmap для SEO, контента и конверсии.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Глубокая стратегическая сегментация ниши: не «аватары ЦА», а реальные сегменты по JTBD, sophistication, urgency, trust threshold и conversion proximity, на которых строится архитектура сайта и messaging.' },
                { label: 'Что анализируем', text: '30 фаз: segment universe, business relevance, JTBD, pain intensity, sophistication / awareness, search behavior, buyer journey, trust requirements, economic profile, use-cases, stakeholder roles, geo & maturity, language patterns, demand / page / conversion / AI fit, underserved / overhyped / false segments, wedges, compounding structures, feasibility и portfolio.' },
                { label: 'Зачем', text: 'Чтобы не путать сегмент и persona card, demographic split и strategic segmentation. Получаете карту сегментов с приоритизацией: какие брать сейчас, какие готовить, какие мониторить, а какие — игнорировать как переоценённые.' },
                { label: 'Результат', text: '6 score 0-100 (Overall, Market, Business, Conversion, Trust, AI), executive verdict с уровнем segment diversity и рекомендованной моделью, 7 топ-листов, 6-10 карточек сегментов со своим scoring и языком, JTBD-таблица, journey stages, wedges, phased roadmap на 30 дней / квартал / 6-12 / 12-24 мес и DOCX-отчёт для клиента.' },
              ]}
              help={{
                title: 'Методология audience segmentation',
                content: [
                  'Сегмент — это не «женщины 25–45», а группа, которая отличается по реальной задаче (JTBD), urgency, sophistication, объекциям, языку и порогу доверия. Если две группы ведут себя одинаково в поиске, конверсии и trust, это один сегмент. Если демография разная, но поведение одинаковое — сегментировать по демографии бессмысленно.',
                  'Strategic segmentation начинается с business value, а не с descriptive профилей. Сегменты ранжируются по совокупности: market relevance, business value, conversion fit, trust feasibility, AI opportunity и feasibility for current project. Низкая feasibility отправляет сегмент в «готовить» или «мониторить», независимо от привлекательности.',
                  'Trust threshold и AI opportunity — обязательные модификаторы. YMYL- и B2B-сегменты не закрываются без сильного proof-слоя. Сегменты, на которые AI уже даёт прямой ответ, требуют click-defense или citation-first подхода. Underserved сегменты — главные wedges для слабого бренда.',
                  'Phased roadmap переводит segmentation map в реальный план: какие сегменты атаковать в первые 30 дней (quick wins + high-conversion), какие — в квартал (core targets с подготовленными assets), какие — на 6-24 мес (authority и compounding structures).',
                ],
                sources: [
                  { label: 'Strategyn — Jobs-to-be-Done framework', url: 'https://strategyn.com/jobs-to-be-done/' },
                  { label: 'Google Search Central — People-first content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Google — E-E-A-T and Quality Rater Guidelines', url: 'https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t' },
                  { label: 'HBR — The Buying Process and Buying Roles', url: 'https://hbr.org/' },
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
                  <Label htmlFor="audience">Известная аудитория / гипотезы сегментов</Label>
                  <Input id="audience" placeholder="Например: новички, малый бизнес, агентства — если есть гипотезы"
                    value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Построить segmentation map
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
                <h2 className="text-lg font-semibold text-foreground">Строим segmentation map «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Segmentation map · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Сегменты · JTBD · путь клиента · wedges · roadmap</p>
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
              <AudienceSegmentsView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}