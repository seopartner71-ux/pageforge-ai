import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import {
  Search, Sparkles, Target, Code2, Link2, Zap, Smartphone, History as HistoryIcon,
  Users, BarChart3, Network, PenSquare, FileText,
} from 'lucide-react';

type Tool = {
  label: string;
  path: string;
  icon: any;
  desc: string;
};

type Group = { label: string; description: string; tools: Tool[] };

const GROUPS: Group[] = [
  {
    label: 'Аудиты',
    description: 'Глубокая SEO-диагностика страницы и сайта',
    tools: [
      { label: 'On-page страницы', path: '/dashboard', icon: Search, desc: 'TF-IDF, конкуренты ТОП-10, технический on-page' },
      { label: 'GEO Audit', path: '/geo-audit', icon: Sparkles, desc: '41 фактор готовности к AI-поиску (ChatGPT, AI Overviews)' },
      { label: 'Коммерческие факторы', path: '/eeat-audit', icon: Target, desc: 'E-E-A-T и коммерческие сигналы доверия' },
      { label: 'Микроразметка', path: '/schema-audit', icon: Code2, desc: 'Schema.org, OpenGraph, валидация JSON-LD' },
      { label: 'Ссылочный аудит', path: '/link-audit', icon: Link2, desc: 'Внутренние и внешние ссылки, анкоры' },
     { label: 'Ссылочный профиль', path: '/link-profile', icon: Link2, desc: 'Учёт размещённых ссылок: статус, бюджет, потери' },
    ],
  },
  {
    label: 'Технические проверки',
    description: 'Скорость, адаптивность и видимость в поиске',
    tools: [
      { label: 'PageSpeed', path: '/pagespeed', icon: Zap, desc: 'Core Web Vitals и аудит Lighthouse' },
      { label: 'Адаптивность', path: '/responsive', icon: Smartphone, desc: 'Mobile-friendly предпросмотр на 3 устройствах' },
      { label: 'История SERP', path: '/serp-history', icon: HistoryIcon, desc: 'Отслеживание позиций по ключевым запросам' },
    ],
  },
  {
    label: 'Конкуренты',
    description: 'Сравнение и анализ конкурентного окружения',
    tools: [
      { label: 'Анализ конкурентов', path: '/competitors', icon: Users, desc: 'Бенчмарк по метрикам и контенту' },
      { label: 'Анализ топа', path: '/top-analysis', icon: BarChart3, desc: 'Матрица присутствия в ТОП-10 по запросам' },
    ],
  },
  {
    label: 'Семантика и контент',
    description: 'Сбор семантики, темы и поисковый интент',
    tools: [
      { label: 'Семантическое ядро', path: '/semantic-core', icon: Network, desc: 'Сбор ядра из 4 источников с частотами' },
      { label: 'Темы для блога', path: '/blog-topics', icon: PenSquare, desc: 'Генерация контент-плана и тем' },
      { label: 'Интент', path: '/intent', icon: FileText, desc: 'Классификация поискового намерения запросов' },
    ],
  },
];

export default function ToolsHubPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-10">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            SEO Workbench
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Единый рабочий стол со всеми инструментами SEO-аудита, технических проверок,
            анализа конкурентов и работы с семантикой.
          </p>
        </div>

        {GROUPS.map((group) => (
          <section key={group.label} className="space-y-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-semibold text-foreground uppercase tracking-wider">
                  {group.label}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {group.tools.length} {group.tools.length === 1 ? 'инструмент' : 'инструмента'}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {group.tools.map((tool) => {
                const Icon = tool.icon;
                return (
                  <Card
                    key={tool.path}
                    onClick={() => navigate(tool.path)}
                    className="group p-5 cursor-pointer hover:border-primary/50 hover:bg-card/70 transition-all hover:-translate-y-0.5"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                        <Icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {tool.label}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {tool.desc}
                        </p>
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