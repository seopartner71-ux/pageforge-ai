import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TechnicalAuditView } from '@/components/audit/TechnicalAuditView';
import { YandexWebmasterView } from '@/components/audit/YandexWebmasterView';
import { PageDescription } from '@/components/PageDescription';
import { ShieldAlert } from 'lucide-react';

export default function TechnicalAuditPage() {
  const [domainInput, setDomainInput] = useState('');
  const [activeDomain, setActiveDomain] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (!clean) return;
    setActiveDomain(clean);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Технический аудит</h1>
          <p className="text-sm text-muted-foreground">
            Полное сканирование сайта внешним краулером: HTTPS, robots, sitemap, meta, ссылки, скорость
          </p>
        </div>
      </div>

      <PageDescription
        items={[
          { label: 'Что это', text: 'Глубокое техническое сканирование сайта внешним краулером — обход всех страниц с проверкой 30+ факторов на уровне HTTP, HTML, ссылок и инфраструктуры.' },
          { label: 'Что проверяем', text: 'HTTPS и SSL, robots.txt, sitemap.xml, скорость ответа, индексируемость, статус-коды, title/description/H1, дубли, alt у картинок, битые ссылки, mixed content.' },
          { label: 'Зачем', text: 'Найти технические ошибки, которые мешают сайту попадать в выдачу и удерживать пользователей. Получить готовый план работ для разработчика и понятный отчёт для клиента.' },
          { label: 'Результат', text: 'Сводная оценка 0–100, список проблем по приоритетам (P1/P2/P3), затронутые URL по каждой проблеме и Word-документ с двумя разделами: отчёт для клиента и техническое задание для разработчика.' },
        ]}
        help={{
          content: [
            'Краулер обходит сайт от главной страницы вглубь, читает sitemap.xml и собирает HTML каждой страницы. Для каждого URL фиксируется HTTP-статус, время ответа сервера (TTFB), содержимое <head>, заголовки, мета-теги, изображения, внутренние и внешние ссылки.',
            'Проблемы группируются по типам и важности. Критические (P1) — это то, что блокирует индексацию (noindex на коммерческих страницах, 5xx ошибки, robots Disallow: /, отсутствие HTTPS). Предупреждения (P2) — дубли title/H1, отсутствующие meta description, alt у изображений, медленный TTFB. Информационные (P3) — внешние ссылки, рекомендации.',
            'Методология опирается на официальные руководства Google Search Central, Яндекс.Помощь для вебмастеров и стандарты W3C. Все проверки соответствуют требованиям современных поисковых систем (2024–2026).',
          ],
          sources: [
            { label: 'Google Search Central — Технические основы SEO', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
            { label: 'Яндекс.Помощь — Технические рекомендации', url: 'https://yandex.ru/support/webmaster/recommendations/site-quality.html' },
            { label: 'web.dev — Lighthouse SEO', url: 'https://developer.chrome.com/docs/lighthouse/seo/' },
            { label: 'Sitemaps.org — Протокол sitemap.xml', url: 'https://www.sitemaps.org/protocol.html' },
            { label: 'robots.txt — официальная спецификация (RFC 9309)', url: 'https://www.rfc-editor.org/rfc/rfc9309' },
          ],
        }}
      />

      <Card className="bg-card border-border p-5">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-[12px] text-muted-foreground mb-1.5 block">Домен сайта</label>
            <Input
              placeholder="example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!domainInput.trim()}>
            {activeDomain ? 'Сменить домен' : 'Открыть аудит'}
          </Button>
        </form>
      </Card>

      {activeDomain && (
        <Tabs defaultValue="checks" className="space-y-4">
          <TabsList>
            <TabsTrigger value="checks">Технические проверки</TabsTrigger>
            <TabsTrigger value="yandex">Яндекс Вебмастер</TabsTrigger>
          </TabsList>
          <TabsContent value="checks" className="mt-0">
            <TechnicalAuditView domain={activeDomain} />
          </TabsContent>
          <TabsContent value="yandex" className="mt-0">
            <YandexWebmasterView domain={activeDomain} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}