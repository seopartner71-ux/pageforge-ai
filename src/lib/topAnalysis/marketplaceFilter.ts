// Фильтр маркетплейсов, агрегаторов, отзовиков и крупных контентных порталов.
// Используется во всём модуле «Анализ ТОПа» — данные исключаются ещё до агрегации.

import { TopRow, normalizeDomain } from './parseTopAnalysisCsv';

const STORAGE_KEY = 'top-analysis:excluded-domains';

// Базовый встроенный список (RU + глобальные)
export const DEFAULT_EXCLUDED_DOMAINS: string[] = [
  // Маркетплейсы
  'wildberries.ru', 'ozon.ru', 'market.yandex.ru', 'megamarket.ru', 'sbermegamarket.ru',
  'aliexpress.ru', 'aliexpress.com', 'lamoda.ru', 'kazanexpress.ru', 'flip.kz',
  'avito.ru', 'youla.ru', 'beru.ru', 'goods.ru', 'tmall.ru',
  'amazon.com', 'amazon.de', 'ebay.com',

  // Крупные интернет-магазины электроники / DIY / стройка
  'dns-shop.ru', 'mvideo.ru', 'eldorado.ru', 'citilink.ru', 'technopark.ru',
  'leroymerlin.ru', 'lemanapro.ru', 'obi.ru', 'castorama.ru', 'petrovich.ru',
  'vseinstrumenti.ru', 'stroylandiya.ru', 'maxidom.ru', 'baucenter.ru', 'allinstrum.ru',
  '220-volt.ru', 'tdmel.ru', 'instrumtorg.ru',

  // Геосервисы / справочники
  'yandex.ru', 'maps.yandex.ru', 'uslugi.yandex.ru', 'dzen.ru', 'zen.yandex.ru',
  '2gis.ru', 'zoon.ru', 'profi.ru', 'youdo.com', 'flamp.ru', 'spr.ru',

  // Отзовики
  'otzovik.com', 'irecommend.ru', 'otzyvru.com', 'spasibovsem.ru', 'tiu.ru',

  // Энциклопедии / контент-площадки / блог-платформы
  'wikipedia.org', 'ru.wikipedia.org', 'pikabu.ru', 'vc.ru', 'habr.com',
  'livejournal.com', 'liveinternet.ru', 'fishki.net', 'adme.ru',

  // Видео / соцсети
  'youtube.com', 'm.youtube.com', 'rutube.ru', 'vk.com', 'ok.ru', 'tiktok.com',
  'instagram.com', 'facebook.com', 't.me', 'telegram.org',

  // Q&A
  'otvet.mail.ru', 'thequestion.ru', 'quora.com',
];

// Получить актуальный список (база + правки пользователя)
export function getExcludedDomains(): string[] {
  if (typeof window === 'undefined') return DEFAULT_EXCLUDED_DOMAINS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_EXCLUDED_DOMAINS;
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr)) return DEFAULT_EXCLUDED_DOMAINS;
    return arr.map(normalizeDomain).filter(Boolean);
  } catch {
    return DEFAULT_EXCLUDED_DOMAINS;
  }
}

export function setExcludedDomains(list: string[]): void {
  if (typeof window === 'undefined') return;
  const cleaned = Array.from(new Set(list.map(normalizeDomain).filter(Boolean)));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
}

export function resetExcludedDomains(): string[] {
  setExcludedDomains(DEFAULT_EXCLUDED_DOMAINS);
  return [...DEFAULT_EXCLUDED_DOMAINS];
}

// Проверка: попадает ли домен под исключение (включая поддомены)
export function isExcludedDomain(domain: string, excluded: string[]): boolean {
  const d = normalizeDomain(domain);
  if (!d) return false;
  return excluded.some((ex) => d === ex || d.endsWith('.' + ex));
}

// Применить фильтр + посчитать сколько исключено
export interface FilterResult {
  rows: TopRow[];
  excludedDomains: string[]; // уникальные исключённые домены
  excludedRows: number;       // количество отброшенных строк
}

export function filterMarketplaces(rows: TopRow[], excluded: string[]): FilterResult {
  const kept: TopRow[] = [];
  const excludedSet = new Set<string>();
  let excludedRows = 0;
  for (const r of rows) {
    if (isExcludedDomain(r.domain, excluded)) {
      excludedSet.add(normalizeDomain(r.domain));
      excludedRows++;
    } else {
      kept.push(r);
    }
  }
  return { rows: kept, excludedDomains: [...excludedSet].sort(), excludedRows };
}
