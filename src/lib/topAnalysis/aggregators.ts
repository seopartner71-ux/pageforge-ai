// Маркетплейсы и агрегаторы — выделяются красным и исключаются из основного анализа

export const AGGREGATOR_DOMAINS = new Set<string>([
  // Универсальные маркетплейсы
  'wildberries.ru', 'wb.ru',
  'ozon.ru',
  'market.yandex.ru', 'yandex.market.ru',
  'aliexpress.ru', 'aliexpress.com',
  'sbermegamarket.ru', 'megamarket.ru',
  'kazanexpress.ru',
  'lamoda.ru',
  'detmir.ru',
  'amazon.com', 'amazon.de',
  // Крупные DIY / инструменты / стройка / промышленные маркетплейсы
  'vseinstrumenti.ru', 'vi.ru',
  'leroymerlin.ru', 'leroy-merlin.ru',
  'petrovich.ru',
  'castorama.ru',
  'obi.ru',
  'maxidom.ru',
  'tdsoyuz.ru',
  '220-volt.ru', '220volt.ru',
  'vimos.ru',
  // Электроника
  'mvideo.ru', 'eldorado.ru', 'dns-shop.ru', 'citilink.ru', 'technopark.ru',
  // Авто / шины / запчасти
  'exist.ru', 'emex.ru', 'autodoc.ru', 'kolesa-darom.ru',
  // Промышленные B2B-агрегаторы
  'tiu.ru', 'pulscen.ru', 'satom.ru', 'all.biz', 'blizko.ru', 'flagma.ru',
  'rusprofile.ru', 'list-org.com',
  // Классифайды
  'avito.ru',
  'youla.ru',
  'drom.ru', 'auto.ru',
  'cian.ru', 'domclick.ru',
  'irecommend.ru', 'otzovik.ru', 'flamp.ru',
  'pikabu.ru',
  // Большие справочники
  '2gis.ru', 'zoon.ru', 'yell.ru',
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
  // СМИ-агрегаторы
  'rbc.ru', 'lenta.ru', 'kommersant.ru',
]);

const AGGREGATOR_KEYWORDS = [
  'wildberries', 'ozon', 'market.yandex', 'aliexpress', 'avito', 'youla',
  'sbermegamarket', 'megamarket', 'lamoda', 'detmir',
  'vseinstrumenti', 'leroymerlin', 'leroy-merlin', 'petrovich.ru', 'castorama',
  'obi.ru', 'maxidom', '220-volt', '220volt', 'vimos.ru',
  'mvideo', 'eldorado', 'dns-shop', 'citilink', 'technopark',
  'exist.ru', 'emex.ru', 'autodoc', 'kolesa-darom',
  '2gis', 'zoon', 'yell.ru', 'tiu.ru', 'pulscen', 'satom', 'all.biz', 'blizko', 'flagma',
  'rusprofile', 'list-org',
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
