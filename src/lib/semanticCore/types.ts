export type IntentKind = 'info' | 'commercial' | 'nav' | 'transac';

export interface SemanticKeyword {
  keyword: string;
  wsFrequency: number;
  exactFrequency: number;
  intent: IntentKind;
  score: number;
  cluster: string;            // cluster id
  included: boolean;
  topUrls?: string[];
}

export interface SemanticCluster {
  id: string;
  name: string;
  type: 'INFORMATIONAL' | 'COMMERCIAL' | 'MIXED';
  keywords: string[];         // keyword strings
  totalQueries: number;
}

export interface SemanticCorePayload {
  topic: string;
  seedKeywords: string[];
  region: string;
  searchEngine: 'yandex' | 'google';
  keywords: SemanticKeyword[];
  clusters: SemanticCluster[];
  wordstatMode: 'mock' | 'real';
  generatedAt: string;
}

export const INTENT_LABEL: Record<IntentKind, string> = {
  info: 'info',
  commercial: 'commercial',
  nav: 'nav',
  transac: 'transac',
};

export const INTENT_BADGE: Record<IntentKind, string> = {
  info: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  commercial: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  nav: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
  transac: 'bg-primary/15 text-primary border border-primary/30',
};

export const INTENT_WEIGHT: Record<IntentKind, number> = {
  commercial: 1.0,
  transac: 0.9,
  info: 0.6,
  nav: 0.4,
};

export function classifyIntentByKeyword(kw: string): IntentKind {
  const k = kw.toLowerCase();
  if (/(купить|заказать|цена|стоимость|недорого|со скидкой|интернет.магазин)/.test(k)) return 'commercial';
  if (/(оформить|оплатить|доставка|корзина|оплата)/.test(k)) return 'transac';
  if (/(сайт|официальный|вход|личный кабинет|логин)/.test(k)) return 'nav';
  if (/(как|что|почему|зачем|какой|обзор|сравнение|рейтинг|отзыв|своими руками|инструкция)/.test(k)) return 'info';
  return 'info';
}

export const REGIONS = [
  'Россия', 'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
];