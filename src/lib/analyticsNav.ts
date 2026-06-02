import {
  Compass, TrendingUp, Sparkles, Lock, Coins,
  Map as MapIcon, LineChart, CalendarRange, Globe2, ShoppingCart,
  AlertCircle, Users, Target, Route, Languages,
  Swords, ClipboardList, GitCompare, ShieldAlert, Link2,
  Bot, Network, Layers, Award, AlertTriangle, FileType,
  Zap, Search, UserPlus, Brain, Lightbulb,
} from 'lucide-react';

export type AnalyticsItem = { label: string; path: string; icon: any };
export type AnalyticsSection = { label: string; items: AnalyticsItem[] };

export const ANALYTICS_SECTIONS: AnalyticsSection[] = [
  {
    label: 'Анализ ниши',
    items: [
      { label: 'Обзор ниши', path: '/analytics/niche/overview', icon: Compass },
      { label: 'Рыночные возможности', path: '/analytics/niche/opportunities', icon: TrendingUp },
      { label: 'Свободные темы', path: '/analytics/niche/free-topics', icon: Sparkles },
      { label: 'Сложность входа', path: '/analytics/niche/entry-barrier', icon: Lock },
      { label: 'Потенциал монетизации', path: '/analytics/niche/monetization', icon: Coins },
    ],
  },
  {
    label: 'Анализ спроса',
    items: [
      { label: 'Карта спроса', path: '/analytics/demand/map', icon: MapIcon },
      { label: 'Тренды', path: '/analytics/demand/trends', icon: LineChart },
      { label: 'Сезонность', path: '/analytics/demand/seasonality', icon: CalendarRange },
      { label: 'География спроса', path: '/analytics/demand/geo', icon: Globe2 },
      { label: 'Коммерческий потенциал', path: '/analytics/demand/commercial', icon: ShoppingCart },
    ],
  },
  {
    label: 'Анализ аудитории',
    items: [
      { label: 'Проблемы аудитории', path: '/analytics/audience/pains', icon: AlertCircle },
      { label: 'Сегменты аудитории', path: '/analytics/audience/segments', icon: Users },
      { label: 'Задачи клиентов (JTBD)', path: '/analytics/audience/jtbd', icon: Target },
      { label: 'Путь клиента', path: '/analytics/audience/journey', icon: Route },
      { label: 'Язык аудитории', path: '/analytics/audience/language', icon: Languages },
    ],
  },
  {
    label: 'Анализ конкуренции',
    items: [
      { label: 'Конкурентное поле', path: '/analytics/competition/field', icon: Swords },
      { label: 'Стратегии конкурентов', path: '/analytics/competition/strategies', icon: ClipboardList },
      { label: 'Разрывы спроса', path: '/analytics/competition/gaps', icon: GitCompare },
      { label: 'Слабые места конкурентов', path: '/analytics/competition/weakness', icon: ShieldAlert },
      { label: 'Ссылочный потенциал', path: '/analytics/competition/links', icon: Link2 },
    ],
  },
  {
    label: 'AI-Аналитика рынка',
    items: [
      { label: 'Возможности AI Search', path: '/analytics/ai/search', icon: Bot },
      { label: 'Карта сущностей', path: '/analytics/ai/entities', icon: Network },
      { label: 'Экосистема ниши', path: '/analytics/ai/ecosystem', icon: Layers },
      { label: 'Требования E-E-A-T', path: '/analytics/ai/eeat', icon: Award },
      { label: 'Риски ниши', path: '/analytics/ai/risks', icon: AlertTriangle },
      { label: 'Форматы контента', path: '/analytics/ai/formats', icon: FileType },
    ],
  },
  {
    label: 'Точки роста',
    items: [
      { label: 'Быстрые победы', path: '/analytics/growth/quick-wins', icon: Zap },
      { label: 'Незанятые запросы', path: '/analytics/growth/free-queries', icon: Search },
      { label: 'Новые сегменты', path: '/analytics/growth/new-segments', icon: UserPlus },
      { label: 'Возможности AI Search', path: '/analytics/growth/ai-search', icon: Brain },
      { label: 'Рекомендации по развитию', path: '/analytics/growth/recommendations', icon: Lightbulb },
    ],
  },
];

export const ANALYTICS_LABELS: Record<string, string> = Object.fromEntries(
  ANALYTICS_SECTIONS.flatMap((s) => s.items.map((i) => [i.path, i.label])),
);

ANALYTICS_LABELS['/analytics'] = 'Аналитика';