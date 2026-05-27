import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { PageSpeedBlock } from '@/components/PageSpeedBlock';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap } from 'lucide-react';

export default function PageSpeedPage() {
  const [input, setInput] = useState('');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = input.trim();
    if (!v) return;
    setSiteUrl(v);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            PageSpeed Insights
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Проверка скорости загрузки и Core Web Vitals по данным Google Lighthouse
          </p>
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'Анализ производительности страницы для мобильной и десктопной версий через Google PageSpeed.' },
            { label: 'Что проверяем', text: 'Performance Score, LCP, TBT, CLS, FCP, Speed Index и аудиты Lighthouse.' },
            { label: 'Зачем', text: 'Найти узкие места скорости и улучшить пользовательский опыт и ранжирование.' },
            { label: 'Результат', text: 'Оценка 0–100, метрики Core Web Vitals, топ-3 приоритета и список рекомендаций.' },
          ]}
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

        {siteUrl && <PageSpeedBlock key={siteUrl} siteUrl={siteUrl} />}
      </main>
    </div>
  );
}
