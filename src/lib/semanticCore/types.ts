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
  dataSource?: 'mock' | 'dataforseo' | 'topvisor';
  keywordDifficulty?: number | null; // 0-100
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

export const REGION_GROUPS: { label: string; regions: string[] }[] = [
  {
    label: 'Вся Россия',
    regions: ['Россия'],
  },
  {
    label: 'Города-миллионники',
    regions: [
      'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург',
      'Казань', 'Нижний Новгород', 'Челябинск', 'Самара', 'Уфа',
      'Красноярск', 'Ростов-на-Дону', 'Пермь', 'Воронеж', 'Краснодар',
      'Волгоград', 'Саратов', 'Тюмень', 'Тольятти', 'Ижевск', 'Барнаул',
      'Ульяновск', 'Иркутск', 'Хабаровск', 'Омск',
    ],
  },
  {
    label: 'Другие крупные города',
    regions: [
      'Ярославль', 'Владивосток', 'Махачкала', 'Томск', 'Оренбург',
      'Кемерово', 'Новокузнецк', 'Рязань', 'Астрахань', 'Набережные Челны',
      'Пенза', 'Липецк', 'Тула', 'Киров', 'Чебоксары', 'Калининград',
      'Брянск', 'Курск', 'Магнитогорск', 'Иваново', 'Улан-Удэ', 'Сочи',
      'Ставрополь', 'Белгород', 'Нижний Тагил', 'Владимир', 'Архангельск',
      'Чита', 'Смоленск', 'Калуга', 'Мурманск',
    ],
  },
];

// Flat list (kept for backwards compatibility)
export const REGIONS: string[] = REGION_GROUPS.flatMap(g => g.regions);