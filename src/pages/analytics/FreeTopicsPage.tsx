import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, FileDown } from 'lucide-react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { FreeTopicsView, FreeTopicsData, normalizeFreeTopics } from '@/components/analytics/FreeTopicsView';
import { PageDescription } from '@/components/PageDescription';
import { exportFreeTopicsDocx } from '@/lib/analytics/exportFreeTopicsDocx';

type FormData = {
  niche: string; geo: string; language: string; businessType: string; siteMaturity: string;
  audience: string; goal: string; product: string; competitors: string; coveredTopics: string; constraints: string;
};

const DEFAULT_FORM: FormData = {
  niche: '', geo: 'ru', language: 'русский', businessType: 'services', siteMaturity: 'new',
  audience: '', goal: 'traffic', product: '', competitors: '', coveredTopics: '', constraints: '',
};

const LOADING_STAGES = [
  'Декомпозируем нишу и текущее покрытие рынка...',
  'Ищем topic, intent и audience gaps...',
  'Оцениваем funnel, format и depth/freshness gaps...',
  'Считаем commercial и AI-search white spaces...',
  'Отсеиваем ложные возможности...',
  'Собираем приоритизацию и план запуска...',
];

export default function FreeTopicsPage() {
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [isLoading, setIsLoading] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [data, setData] = useState<FreeTopicsData | null>(null);
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
      const { data: resp, error } = await supabase.functions.invoke('analyze-free-topics', { body: { ...formData } });
      if (error) throw error;
      const t = normalizeFreeTopics((resp as any)?.report);
      if (!t) throw new Error('AI не вернул валидную white-space карту');
      setData(t);
    } catch (e: any) {
      console.error('analyze-free-topics failed', e);
      toast({ title: 'AI недоступен', description: e?.message || 'Ошибка запроса', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }

  async function downloadDocx() {
    if (!data) return;
    setIsExporting(true);
    try {
      await exportFreeTopicsDocx(formData.niche, data);
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
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">Свободные темы</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Карта реальных white space возможностей: темы, интенты, аудитории, форматы и сегменты, где рынок недорабатывает.
              </p>
            </div>
          </div>

          {!data && !isLoading && (
            <PageDescription
              items={[
                { label: 'Что это', text: 'Decision-grade карта white space: не «long-tail keywords», а реальные точки входа без лобовой конкуренции — темы, интенты, форматы и сегменты, которые покрыты слабо, поверхностно или устарели.' },
                { label: 'Что анализируем', text: '16 фаз: декомпозиция ниши, типы gaps (topic, intent, audience, funnel, format, depth, freshness, geo, commercial, AI), оценка текущего покрытия, фильтр ложных возможностей, приоритизация и стратегическая модель входа.' },
                { label: 'Зачем', text: 'Чтобы перестать конкурировать «в лоб» по перегретым broad-темам. Получаете приоритизированный портфель white space: что брать сейчас, что готовить, что требует авторитета, а где gap — ложный.' },
                { label: 'Результат', text: '6 score 0-100, сводный вердикт с моделью входа, 5 топ-листов, карта сегментов, 10 видов разрывов с карточками, поэтапный план (сейчас / квартал / после авторитета / при ресурсах / не приоритет) и DOCX-отчёт.' },
              ]}
              help={{
                title: 'Методология white space discovery',
                content: [
                  'White space — это не «нет контента». Это разрыв между реальным интентом пользователя и тем, что предлагает SERP: где конкуренты пишут поверхностно, неправильно интерпретируют интент, устарели, игнорируют сегмент или формат, или просто не подготовили retrieval-friendly ответ для ИИ.',
                  'Не каждый gap — возможность. Отсутствие контента может означать отсутствие спроса, низкую business value или невозможность ранжироваться без trust. Анализ отдельно отделяет ложные gaps от настоящих, чтобы не тратить ресурс впустую.',
                  'White space для нового сайта и для зрелого домена — разные стратегии. Новый сайт идёт через format gaps, узкие use-case, локальные посадочные и AI-friendly ответы. Зрелый — через depth, commercial pages и authority-driven hubs.',
                  'Приоритизация переводит карту в порядок действий: 30 дней — быстрые победы по format/depth/local; квартал — core коммерческие активы; 6-24 мес — authority-hubs, compounding и AI-устойчивые ответы.',
                ],
                sources: [
                  { label: 'Google Search Central — Helpful Content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' },
                  { label: 'Ahrefs — Content gap analysis', url: 'https://ahrefs.com/blog/content-gap-analysis/' },
                  { label: 'Search Engine Journal — White space SEO', url: 'https://www.searchenginejournal.com/' },
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
                      <SelectItem value="authority">Authority</SelectItem>
                      <SelectItem value="ai-visibility">AI Visibility</SelectItem>
                      <SelectItem value="topical-authority">Topical authority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="audience">Целевая аудитория</Label>
                  <Input id="audience" placeholder="Кто ваши клиенты"
                    value={formData.audience} onChange={(e) => update('audience', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="competitors">Известные конкуренты (через запятую)</Label>
                  <Input id="competitors" placeholder="competitor1.com, competitor2.com"
                    value={formData.competitors} onChange={(e) => update('competitors', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="covered">Уже покрытые темы на сайте</Label>
                  <Textarea id="covered" placeholder="Перечислите основные темы, страницы, кластеры — если есть"
                    rows={2}
                    value={formData.coveredTopics} onChange={(e) => update('coveredTopics', e.target.value)} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="constraints">Ограничения</Label>
                  <Input id="constraints" placeholder="Например: слабый бренд, нет ссылок, только блог"
                    value={formData.constraints} onChange={(e) => update('constraints', e.target.value)} />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <Button onClick={run} disabled={!canSubmit} size="lg">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Построить white-space карту
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
                <h2 className="text-lg font-semibold text-foreground">Ищем свободные темы в «{formData.niche || '...'}»</h2>
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
                  <h2 className="text-lg font-semibold text-foreground">White space карта · «{formData.niche}»</h2>
                  <p className="text-xs text-muted-foreground mt-1">Сегменты · разрывы · возможности · план</p>
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
              <FreeTopicsView data={data} />
            </div>
          )}
        </main>
      </div>
    </TooltipProvider>
  );
}