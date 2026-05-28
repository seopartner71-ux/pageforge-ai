import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { PageSpeedBlock } from '@/components/PageSpeedBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, FileDown } from 'lucide-react';
import { downloadPageSpeedReportDocx, type PageSpeedResults } from '@/lib/pagespeed/exportPageSpeedReport';

export default function PageSpeedPage() {
  const [input, setInput] = useState('');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [results, setResults] = useState<PageSpeedResults>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    setSiteUrl(v);
  };

  const hasResults = !!(results.mobile || results.desktop);
  const handleExport = () => {
    if (!siteUrl || !hasResults) return;
    void downloadPageSpeedReportDocx({ url: siteUrl, results, checkedAt });
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              PageSpeed Insights
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Проверка скорости загрузки и Core Web Vitals по данным Google Lighthouse
            </p>
          </div>
          {hasResults && (
            <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
              <FileDown className="w-4 h-4" />
              Отчёт для клиента (Word)
            </Button>
          )}
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'Анализ производительности страницы для мобильной и десктопной версий через Google PageSpeed.' },
            { label: 'Что проверяем', text: 'Performance Score, LCP, TBT, CLS, FCP, Speed Index и аудиты Lighthouse.' },
            { label: 'Зачем', text: 'Найти узкие места скорости и улучшить пользовательский опыт и ранжирование.' },
            { label: 'Результат', text: 'Оценка 0–100, метрики Core Web Vitals, топ-3 приоритета и список рекомендаций.' },
          ]}
          help={{
            content: [
              'Проверка основана на Google PageSpeed Insights и движке Lighthouse - открытом инструменте Google для аудита качества веб-страниц. Анализируются как лабораторные данные (эмулированная загрузка Moto G4 / медленный 4G), так и полевые данные реальных пользователей Chrome (CrUX).',
              'Core Web Vitals - три ключевые метрики пользовательского опыта, которые Google официально учитывает в ранжировании: LCP (Largest Contentful Paint, рендер главного элемента ≤ 2,5 с), INP (Interaction to Next Paint, отклик на действия ≤ 200 мс) и CLS (Cumulative Layout Shift, визуальная стабильность ≤ 0,1). С марта 2024 INP заменил FID.',
              'Performance Score - взвешенная сумма 6 метрик Lighthouse: FCP, LCP, TBT, CLS, Speed Index. Шкала: 0–49 красная (плохо), 50–89 жёлтая (средне), 90–100 зелёная (хорошо). Аудит выявляет конкретные ресурсы, тормозящие страницу: тяжёлый JS, неоптимизированные изображения, render-blocking CSS.',
            ],
            sources: [
              { label: 'Google web.dev - Core Web Vitals', url: 'https://web.dev/articles/vitals' },
              { label: 'PageSpeed Insights API v5 - официальная документация', url: 'https://developers.google.com/speed/docs/insights/v5/about' },
              { label: 'Lighthouse Performance Scoring', url: 'https://developer.chrome.com/docs/lighthouse/performance/performance-scoring' },
              { label: 'Google Search Central - Page Experience', url: 'https://developers.google.com/search/docs/appearance/page-experience' },
            ],
          }}
        />

        <Card className="p-5">
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="example.com или https://example.com/page"
              className="flex-1"
            />
            <Button type="submit" disabled={!input.trim()}>
              Анализировать
            </Button>
          </form>
        </Card>

        {siteUrl && (
          <PageSpeedBlock
            key={siteUrl}
            siteUrl={siteUrl}
            onResults={({ results, checkedAt }) => {
              setResults(results);
              setCheckedAt(checkedAt);
            }}
          />
        )}
      </main>
    </div>
  );
}
