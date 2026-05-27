import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Smartphone, Tablet, Monitor, ExternalLink, RefreshCw, FileDown } from 'lucide-react';
import { downloadResponsiveReportDocx } from '@/lib/responsive/exportResponsiveReport';

const DEVICES = [
  { id: 'mobile', label: 'iPhone 14', width: 390, height: 780, icon: Smartphone },
  { id: 'tablet', label: 'iPad', width: 768, height: 1024, icon: Tablet },
  { id: 'desktop', label: 'Desktop', width: 1280, height: 800, icon: Monitor },
];

function normalizeUrl(v: string) {
  const t = v.trim();
  if (!t) return '';
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function ResponsivePage() {
  const [input, setInput] = useState('');
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = normalizeUrl(input);
    if (!u) return;
    setSiteUrl(u);
    setReloadKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Smartphone className="w-6 h-6 text-primary" />
              Адаптивность сайта
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Проверка mobile-friendly критериев и предпросмотр на разных устройствах
            </p>
          </div>
          {siteUrl && (
            <div className="flex items-center gap-2">
              <Button onClick={() => setReloadKey((k) => k + 1)} variant="outline" size="sm" className="gap-2">
                <RefreshCw className="w-4 h-4" />
                Обновить
              </Button>
              <Button
                onClick={() => downloadResponsiveReportDocx({ url: siteUrl, checkedAt: new Date().toISOString() })}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <FileDown className="w-4 h-4" />
                Отчёт для клиента (Word)
              </Button>
            </div>
          )}
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'Визуальный аудит адаптивности страницы на мобильных, планшетах и десктопах.' },
            { label: 'Что проверяем', text: 'Рендеринг страницы в трёх ключевых разрешениях (390 / 768 / 1280 px).' },
            { label: 'Зачем', text: 'Mobile-first индексация Google требует корректного отображения на всех устройствах.' },
            { label: 'Результат', text: 'Предпросмотр в iPhone, iPad и Desktop одновременно для быстрой визуальной проверки.' },
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
              Проверить адаптивность
            </Button>
          </form>
        </Card>

        {siteUrl && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm font-medium">Предпросмотр на устройствах</div>
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              >
                {siteUrl}
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex flex-wrap gap-6 justify-center">
              {DEVICES.map((d) => {
                const Icon = d.icon;
                return (
                  <div key={d.id} className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon className="w-3.5 h-3.5" />
                      <span className="font-medium text-foreground">{d.label}</span>
                      <span>{d.width}px</span>
                    </div>
                    <div
                      className="border border-border/60 rounded-lg overflow-hidden bg-muted/20 shadow-sm"
                      style={{ width: Math.min(d.width, 420), height: Math.min(d.width, 420) * (d.height / d.width) }}
                    >
                      <iframe
                        key={`${d.id}-${reloadKey}`}
                        src={siteUrl}
                        title={d.label}
                        style={{
                          width: d.width,
                          height: d.height,
                          border: 0,
                          transform: `scale(${Math.min(d.width, 420) / d.width})`,
                          transformOrigin: '0 0',
                        }}
                        sandbox="allow-scripts allow-same-origin allow-forms"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Некоторые сайты блокируют встраивание во фреймы (X-Frame-Options / CSP). В этом случае откройте сайт по ссылке выше.
            </p>
          </Card>
        )}
      </main>
    </div>
  );
}