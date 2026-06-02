import {
  Search, ShieldAlert, Target, Code2, Zap, Smartphone, Gauge,
  Network, PenSquare, FileText, Brain,
  Sparkles, Radar, Mic,
  Link2,
  Users, BarChart3, History as HistoryIcon,
} from 'lucide-react';

export type SeoItem = { label: string; path: string; icon: any };
export type SeoSection = { label: string; items: SeoItem[] };

export const SEO_SECTIONS: SeoSection[] = [
  {
    label: 'Аудит сайта',
    items: [
      { label: 'On-page страницы', path: '/dashboard', icon: Search },
      { label: 'Технический аудит', path: '/technical-audit', icon: ShieldAlert },
      { label: 'Коммерческие факторы', path: '/eeat-audit', icon: Target },
      { label: 'Микроразметка', path: '/schema-audit', icon: Code2 },
      { label: 'PageSpeed', path: '/pagespeed', icon: Zap },
      { label: 'Адаптивность', path: '/responsive', icon: Smartphone },
      { label: 'Яндекс Вебмастер', path: '/yandex-webmaster', icon: Gauge },
    ],
  },
  {
    label: 'Контент',
    items: [
      { label: 'Семантическое ядро', path: '/semantic-core', icon: Network },
      { label: 'Темы для блога', path: '/blog-topics', icon: PenSquare },
      { label: 'Интент запросов', path: '/intent', icon: FileText },
      { label: 'Content Intelligence', path: '/seo/content-intelligence', icon: Brain },
    ],
  },
  {
    label: 'AI Search',
    items: [
      { label: 'GEO Audit', path: '/geo-audit', icon: Sparkles },
      { label: 'Видимость в ИИ-ответах', path: '/ai-visibility', icon: Radar },
      { label: 'Видимость в ответах Алисы', path: '/alice-visibility', icon: Mic },
    ],
  },
  {
    label: 'Ссылки',
    items: [
      { label: 'Ссылочный аудит', path: '/link-audit', icon: Link2 },
      { label: 'Ссылочный профиль', path: '/link-profile', icon: Link2 },
    ],
  },
  {
    label: 'Конкуренты',
    items: [
      { label: 'Анализ конкурентов', path: '/competitors', icon: Users },
      { label: 'Анализ ТОП выдачи', path: '/top-analysis', icon: BarChart3 },
      { label: 'История SERP', path: '/serp-history', icon: HistoryIcon },
    ],
  },
];

export const SEO_LABELS: Record<string, string> = Object.fromEntries(
  SEO_SECTIONS.flatMap((s) => s.items.map((i) => [i.path, i.label])),
);
SEO_LABELS['/seo'] = 'SEO Dashboard';