// Маркетплейсы и агрегаторы — выделяются красным и исключаются из основного анализа

export const AGGREGATOR_DOMAINS = new Set<string>([
  // Маркетплейсы
  'wildberries.ru', 'wb.ru',
  'ozon.ru',
  'market.yandex.ru', 'yandex.market.ru',
  'aliexpress.ru', 'aliexpress.com',
  'sbermegamarket.ru', 'megamarket.ru',
  'kazanexpress.ru',
  'lamoda.ru',
  'detmir.ru',
  'amazon.com', 'amazon.de',
  // Агрегаторы / классифайды / прайс-агрегаторы
  'avito.ru',
  'youla.ru',
  'drom.ru', 'auto.ru',
  'cian.ru', 'domclick.ru', 'avito.ru',
  'irecommend.ru', 'otzovik.ru', 'flamp.ru',
  'pikabu.ru',
  // Большие справочники / порталы
  '2gis.ru', 'zoon.ru', 'yell.ru',
  'tiu.ru', 'pulscen.ru', 'satom.ru', 'all.biz',
  // Видео/контент-платформы
  'youtube.com', 'youtu.be',
  'rutube.ru',
  'dzen.ru', 'zen.yandex.ru',
  'vk.com', 'vk.ru',
  'ok.ru',
  't.me', 'telegram.org',
  'instagram.com',
  'tiktok.com',
  // Энциклопедии / Q&A
  'wikipedia.org', 'ru.wikipedia.org',
  'otvet.mail.ru',
  'thequestion.ru',
  // Карты / поиск
  'maps.yandex.ru', 'yandex.ru',
  'google.com', 'google.ru',
  // Каталоги статей / СМИ-агрегаторы
  'rbc.ru', 'lenta.ru', 'kommersant.ru',
]);

const AGGREGATOR_KEYWORDS = [
  'wildberries', 'ozon', 'market.yandex', 'aliexpress', 'avito', 'youla',
  'sbermegamarket', 'megamarket', 'lamoda', 'detmir',
  '2gis', 'zoon', 'yell', 'tiu', 'pulscen', 'satom',
  'youtube', 'rutube', 'dzen', 'zen.yandex',
  'wikipedia', 'pikabu', 'otzovik', 'irecommend', 'flamp',
];

export function isAggregator(domain: string): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().trim();
  if (AGGREGATOR_DOMAINS.has(d)) return true;
  // частичное совпадение — на случай поддоменов (market.yandex.ru → yandex.market...)
  return AGGREGATOR_KEYWORDS.some(k => d.includes(k));
}
