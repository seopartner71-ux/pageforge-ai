import {
  Compass, TrendingUp, Sparkles, Lock, Coins,
  Map as MapIcon, LineChart, CalendarRange, Globe2, ShoppingCart,
  AlertCircle, Users, Target, Route, Languages,
  Swords, Link2,
  Bot, Network, Layers, Award, AlertTriangle, FileType,
  MessageCircle,
  Activity, LifeBuoy,
  BarChart2,
} from 'lucide-react';

export type AnalyticsItem = { label: string; path: string; icon: any };
export type AnalyticsSection = { label: string; items: AnalyticsItem[] };

export const ANALYTICS_SECTIONS: AnalyticsSection[] = [
  {
    label: 'Анализ ниши',
    items: [
      { label: 'Картина ниши, структуры и точек роста', path: '/analytics/niche/overview', icon: Compass },
      { label: 'Поиск перспективных рыночных возможностей', path: '/analytics/niche/opportunities', icon: TrendingUp },
      { label: 'Оценка сложности входа в нишу', path: '/analytics/niche/entry-barrier', icon: Lock },
      { label: 'Соответствие ниши модели монетизации', path: '/analytics/niche/monetization', icon: Coins },
    ],
  },
  {
    label: 'Анализ спроса',
    items: [
      { label: 'Карта реального и ценного поискового спроса', path: '/analytics/demand/map', icon: MapIcon },
      { label: 'Поиск трендов, сигналов и будущих сдвигов', path: '/analytics/demand/trends', icon: LineChart },
      { label: 'Анализ сезонности, циклов и всплесков спроса', path: '/analytics/demand/seasonality', icon: CalendarRange },
      { label: 'Географические и локальные возможности', path: '/analytics/demand/geo', icon: Globe2 },
      { label: 'Спрос с высокой коммерческой ценностью', path: '/analytics/demand/commercial', icon: ShoppingCart },
    ],
  },
  {
    label: 'Анализ аудитории',
    items: [
      { label: 'Реальные проблемы и боли аудитории', path: '/analytics/audience/pains', icon: AlertCircle },
      { label: 'Сегментация аудитории по ценности и поведению', path: '/analytics/audience/segments', icon: Users },
      { label: 'Карта задач, стоящих за поиском (JTBD)', path: '/analytics/audience/jtbd', icon: Target },
      { label: 'Запросы по этапам пути покупателя', path: '/analytics/audience/journey', icon: Route },
      { label: 'Карта пути покупателя (базовая v2.1)', path: '/analytics/audience/journey-v2', icon: Route },
      { label: 'Карта языка, терминов и формулировок ниши', path: '/analytics/audience/language', icon: Languages },
      { label: 'Живой язык и сигналы сообщества', path: '/analytics/audience/community', icon: MessageCircle },
    ],
  },
  {
    label: 'Контент и темы',
    items: [
      { label: 'Поиск свободных и недозакрытых тем', path: '/analytics/niche/free-topics', icon: Sparkles },
      { label: 'Подбор форматов под спрос и интенты', path: '/analytics/ai/formats', icon: FileType },
    ],
  },
  {
    label: 'Анализ конкуренции',
    items: [
      { label: 'Проверка реальной конкурентности SERP', path: '/analytics/competition/serp-reality', icon: Swords },
      { label: 'Анализ платформ, площадок и внешней среды', path: '/analytics/ai/ecosystem', icon: Layers },
      { label: 'Потенциал получения естественных ссылок', path: '/analytics/competition/linkability', icon: Link2 },
    ],
  },
  {
    label: 'Доверие, сущности и риски',
    items: [
      { label: 'Требования к доверию и экспертности (E-E-A-T)', path: '/analytics/ai/eeat', icon: Award },
      { label: 'Карта сущностей и смысловых связей ниши', path: '/analytics/ai/entities', icon: Network },
      { label: 'Регуляторные, репутационные и контентные риски', path: '/analytics/ai/risks', icon: AlertTriangle },
    ],
  },
  {
    label: 'AI Search',
    items: [
      { label: 'Возможности в ИИ-поиске', path: '/analytics/ai/search', icon: Bot },
    ],
  },
  {
    label: 'SEO Recovery',
    items: [
      { label: 'SEO Recovery AI', path: '/analytics/recovery/main', icon: LifeBuoy },
      { label: 'SEO Мониторинг', path: '/analytics/recovery/monitoring', icon: Activity },
    ],
  },
  {
    label: 'SEO прогнозы',
    items: [
      { label: 'SEO-прогноз', path: '/analytics/seo-forecast', icon: BarChart2 },
    ],
  },
];

export const ANALYTICS_LABELS: Record<string, string> = Object.fromEntries(
  ANALYTICS_SECTIONS.flatMap((s) => s.items.map((i) => [i.path, i.label])),
);

ANALYTICS_LABELS['/analytics'] = 'Аналитика';