import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, TrendingUp, Sparkles, FileDown } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { TrendsView, TrendsData, normalizeTrends } from '@/components/analytics/TrendsView';
import { PageDescription } from '@/components/PageDescription';
import { exportTrendsDocx } from '@/lib/analytics/exportTrendsDocx';

type FormData = {
  niche: string; geo: string; businessType: string; monetization: string;
  audience: string; domainStrength: string; horizon: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', businessType: 'b2b', monetization: 'subscription',
  audience: '', domainStrength: 'new', horizon: '12',
};

const LOADING_STAGES = [
  'Сканируем слабые сигналы рынка...',
  'Отделяем структурные тренды от хайпа...',
  'Анализируем влияние AI на спрос...',
  'Считаем durability и early-mover advantage...',
  'Формируем Roadmap раннего входа...',
];

export default function TrendsPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<TrendsData | null>(null);
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-trends', {
        body: { ...formData },
      });
      if (error) throw error;
      const t = normalizeTrends((resp as any)?.report);
      if (!t) throw new Error('AI не вернул валидный trend landscape');
      setData(t);
    } catch (e: any) {
      console.error('analyze-trends failed', e);
      toast({ title: 'AI недоступен', description: e?.message || 'Ошибка запроса', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadDocx() {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportTrendsDocx(formData.niche, data);
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
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Тренды и сдвиги рынка</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Trend Landscape: durable shifts vs хайп, AI-влияние, early-mover окна и phased roadmap.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Глубокое исследование трендов и структурных сдвигов в нише: что устойчиво и будет приносить деньги годами, а что — хайп, который умрёт за 6–12 месяцев и сожжёт бюджет.' },
                { label: 'Что анализируем', text: '31 фаза анализа: durable low-noise shifts, hype cycles, AI-влияние на спрос (upside / downside), изменения SERP и форматов, сдвиги E-E-A-T, ранние окна для входа и реалистичные KPI по горизонтам.' },
                { label: 'Зачем', text: 'Чтобы не сливать бюджет на громкие тренды без бизнес-эффекта и не пропустить тихие структурные сдвиги, которые конкуренты заметят через 12 месяцев. Решение об инвестициях принимается по durability и early-mover advantage, а не по хайпу.' },
                { label: 'Результат', text: '4 score 0–100 (Overall Opportunity, Durability, AI Relevance, Early-Mover Advantage), executive verdict, топ-5 act-now / 3 wedges / 3 hype traps, таблица durable shifts, AI upside vs downside по сегментам и phased roadmap на 30 дней / квартал / 6–12 / 12–24 мес.' },
              ]}
              help={{
                title: 'Методология trend discovery',
                content: [
                  'Цель — отделить сигнал от шума. Большинство «трендов», о которых пишут в LinkedIn, — это хайп с пиком 6–12 месяцев и без структурного роста спроса. Мы оцениваем долговечность (durability) каждого тренда: подтверждается ли он реальными изменениями поведения пользователей, монетизацией и стабильным ростом запросов, а не только инфоповодом.',
                  'AI-блок отдельно — потому что 2025–2026 переписывают экономику ниш. Для одних сегментов AI это upside (AI-помощники, генерация, рекомендации), для других — downside (zero-click, AI Overviews, чат-ответы выбивают коммерческий трафик). Один и тот же тренд может одновременно быть и тем и другим — мы оцениваем оба измерения.',
                  'Early-mover advantage показывает, насколько ещё открыто окно для входа. Если в нише уже сидит 5 сильных брендов, формальный «тренд» вам ничего не даст — выдача занята. Если же тренд только зарождается, у небольшого игрока есть 6–12 месяцев на захват кластера до прихода крупных доменов.',
                  'Phased roadmap привязывает тренды к исполнению: 30 дней — quick reaction на act-now тренды, квартал — assets под early-mover wedges, 6–12 — структурные durable shifts, 12–24 — авторитет и доминирование. Hype traps выносятся в отдельный список с обоснованием, почему туда не идти.',
                ],
                sources: [
                  { label: 'Google Search Central — Helpful, reliable, people-first content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Google — E-E-A-T and Quality Rater Guidelines', url: 'https://developers.google.com/search/blog/2022/12/google-raters-guidelines-e-e-a-t' },
                  { label: 'Google Trends — Methodology', url: 'https://support.google.com/trends/answer/4365533' },
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
                      <SelectItem value="6">6 месяцев</SelectItem>
                      <SelectItem value="12">12 месяцев</SelectItem>
                      <SelectItem value="24">24 месяца</SelectItem>
                      <SelectItem value="36">36 месяцев</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Анализировать тренды
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
                <h2 className="text-lg font-semibold text-foreground">Сканируем тренды «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">Trend Landscape · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Структурные сдвиги vs хайп · AI · early-mover окна</p>
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
              <TrendsView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}