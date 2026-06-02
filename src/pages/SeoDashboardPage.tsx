import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, Target, Code2, Link2, Zap, Smartphone, History as HistoryIcon,
  Users, BarChart3, Network, PenSquare, FileText, ShieldCheck, Gauge, Radar, Mic,
} from 'lucide-react';

type Tool = { label: string; path: string; icon: any; desc: string };
type Group = { label: string; description: string; tools: Tool[] };

const GROUPS: Group[] = [
  {
    label: 'Аудиты',
    description: 'Глубокая SEO-диагностика страницы и сайта',
    tools: [
      { label: 'On-page страницы', path: '/dashboard', icon: Search, desc: 'TF-IDF, конкуренты ТОП-10, технический on-page' },
      { label: 'GEO Audit', path: '/geo-audit', icon: Sparkles, desc: '41 фактор готовности к AI-поиску' },
      { label: 'Видимость в ИИ ответах', path: '/ai-visibility', icon: Radar, desc: 'Упоминания бренда в ответах LLM' },
      { label: 'Видимость в ответах Алисы', path: '/alice-visibility', icon: Mic, desc: 'Видимость в ответах Яндекс.Алисы' },
      { label: 'Коммерческие факторы', path: '/eeat-audit', icon: Target, desc: 'E-E-A-T и сигналы доверия' },
      { label: 'Микроразметка', path: '/schema-audit', icon: Code2, desc: 'Schema.org, OpenGraph, JSON-LD' },
      { label: 'Ссылочный аудит', path: '/link-audit', icon: Link2, desc: 'Внутренние и внешние ссылки, анкоры' },
      { label: 'Ссылочный профиль', path: '/link-profile', icon: Link2, desc: 'Учёт размещённых ссылок' },
    ],
  },
  {
    label: 'Технические проверки',
    description: 'Скорость, адаптивность и видимость в поиске',
    tools: [
      { label: 'Технический аудит', path: '/technical-audit', icon: ShieldCheck, desc: 'Полный crawl сайта' },
      { label: 'Яндекс Вебмастер', path: '/yandex-webmaster', icon: Gauge, desc: 'Данные из Яндекс.Вебмастера' },
      { label: 'PageSpeed', path: '/pagespeed', icon: Zap, desc: 'Core Web Vitals и Lighthouse' },
      { label: 'Адаптивность', path: '/responsive', icon: Smartphone, desc: 'Mobile-friendly предпросмотр' },
      { label: 'История SERP', path: '/serp-history', icon: HistoryIcon, desc: 'Отслеживание позиций' },
    ],
  },
  {
    label: 'Конкуренты',
    description: 'Сравнение и анализ конкурентного окружения',
    tools: [
      { label: 'Анализ конкурентов', path: '/competitors', icon: Users, desc: 'Бенчмарк по метрикам и контенту' },
      { label: 'Анализ топа', path: '/top-analysis', icon: BarChart3, desc: 'Матрица присутствия в ТОП-10' },
    ],
  },
  {
    label: 'Семантика и контент',
    description: 'Сбор семантики, темы и поисковый интент',
    tools: [
      { label: 'Семантическое ядро', path: '/semantic-core', icon: Network, desc: 'Сбор ядра из 4 источников' },
      { label: 'Темы для блога', path: '/blog-topics', icon: PenSquare, desc: 'Генерация контент-плана' },
      { label: 'Интент запросов', path: '/intent', icon: FileText, desc: 'Классификация поискового намерения' },
    ],
  },
];

export default function SeoDashboardPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">SEO Dashboard</h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Все SEO-услуги, аудиты и проверки в одном месте. Выберите инструмент, чтобы начать работу.
          </p>
        </div>

        {GROUPS.map((group) => (
          <section key={group.label} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card
                    key={tool.path}
                    onClick={() => navigate(tool.path)}
                    className="p-4 cursor-pointer hover:border-primary/60 hover:bg-accent/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">{tool.label}</div>
                        <div className="text-xs text-muted-foreground line-clamp-2">{tool.desc}</div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        ))}
      </main>
    </div>
  );
}