import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, PageBreak,
  Header, Footer, PageNumber, LevelFormat, TabStopType, TabStopPosition,
} from 'docx';
import { saveAs } from 'file-saver';

export interface CrawlIssue {
  id?: string;
  type?: string | null;
  severity?: string | null;
  code: string;
  message?: string | null;
  page_url?: string | null;
  details?: any;
}

export interface CrawlStats {
  total_pages?: number;
  total_issues?: number;
  critical_count?: number;
  warning_count?: number;
  info_count?: number;
  avg_load_time_ms?: number;
  score?: number;
}

export interface TechnicalAuditExportInput {
  domain: string;
  stats?: CrawlStats | null;
  issues: CrawlIssue[];
  preparedBy?: string;
  periodMonths?: number;
}

// =====================================================================
// Каталог проверок - строится в стиле шаблона.
// Каждый чек: номер раздела, название, важность, сложность,
// описание (методичка) и ТЗ (что именно делать программисту).
// codes[] - какие коды из crawl_issues триггерят «Ошибка обнаружена».
// =====================================================================
type Importance = 'высокая' | 'средняя' | 'низкая';
type Complexity = 'низкая' | 'средняя' | 'высокая';

interface Check {
  num: string;            // «1.2», «3.1.1»
  title: string;
  importance: Importance;
  complexity: Complexity;
  description: string[];  // абзацы методички
  codes: string[];        // коды из crawl_issues, которые относятся к проверке
  fix: string[];          // абзацы ТЗ для программиста
  priority: 'P1' | 'P2' | 'P3';
}

const CHECKS: Check[] = [
  // ============ 1. Технические ошибки ============
  {
    num: '1.2', title: 'Протокол HTTPS', importance: 'высокая', complexity: 'высокая',
    codes: ['no_https'], priority: 'P1',
    description: [
      'HTTPS (HyperText Transfer Protocol Secure) - расширение протокола HTTP, которое шифрует данные между сайтом и пользователем. Это снижает риск перехвата персональных данных (логины, пароли, данные карт) и предотвращает подмену контента.',
      'Google помечает HTTP-сайты в Chrome как «не защищённые», Яндекс считает HTTPS одним из показателей качества. С HTTP рекомендуется настроить прямой 301-редирект на HTTPS-версию (без цепочки редиректов).',
    ],
    fix: [
      'Установить SSL-сертификат (бесплатно через Let\'s Encrypt с автопродлением).',
      'Настроить 301-редирект всех HTTP-URL на HTTPS на уровне веб-сервера (nginx/Apache).',
      'Заменить абсолютные ссылки http:// → https:// в шаблонах, БД и контенте.',
      'Добавить заголовок HSTS: Strict-Transport-Security: max-age=31536000; includeSubDomains.',
      'Проверить отсутствие mixed content (картинки, скрипты, стили должны загружаться по HTTPS).',
    ],
  },
  {
    num: '1.3', title: 'XML-карта сайта (sitemap.xml)', importance: 'высокая', complexity: 'низкая',
    codes: ['no_sitemap'], priority: 'P1',
    description: [
      'XML-карта сайта - это файл, содержащий ссылки на все страницы сайта, подлежащие индексированию. Sitemap ускоряет индексацию и помогает поисковым системам находить новые страницы.',
      'Файл должен содержать только канонические URL с кодом ответа 200, без редиректов и закрытых от индексации страниц. Один файл - не более 50 000 URL и 50 МБ. Ссылка на sitemap должна быть указана в robots.txt.',
    ],
    fix: [
      'Сгенерировать /sitemap.xml (через CMS-плагин или серверный скрипт).',
      'Включать только страницы с кодом 200, исключить редиректы, 404 и noindex.',
      'Добавить в robots.txt: Sitemap: https://домен/sitemap.xml',
      'Настроить автообновление карты при добавлении/удалении страниц.',
      'Отправить sitemap в Google Search Console и Яндекс.Вебмастер.',
    ],
  },
  {
    num: '1.4', title: 'Файл Robots.txt', importance: 'высокая', complexity: 'низкая',
    codes: ['no_robots_txt', 'robots_blocks_all'], priority: 'P1',
    description: [
      'Robots.txt - текстовый файл с инструкциями для поисковых роботов о том, какие разделы сайта индексировать, а какие нет. Файл должен быть доступен по адресу /robots.txt в корне домена.',
      'Поисковые системы при каждом обходе обращаются к этому файлу в первую очередь. В нём указываются служебные разделы, исключаемые из поиска, и путь к sitemap.',
    ],
    fix: [
      'Создать файл /robots.txt в корне домена.',
      'Минимальное содержимое: User-agent: *  /  Allow: /  /  Sitemap: https://домен/sitemap.xml',
      'Закрыть служебные разделы (admin, корзина, фильтры) через Disallow.',
      'Убедиться, что нет глобального запрета Disallow: / для User-agent: *.',
      'После правок запросить переобход в Google Search Console и Яндекс.Вебмастер.',
    ],
  },
  {
    num: '1.5', title: 'Скорость ответа сервера (TTFB)', importance: 'высокая', complexity: 'средняя',
    codes: ['slow_ttfb'], priority: 'P1',
    description: [
      'TTFB (Time To First Byte) - время от запроса до получения первого байта ответа сервера. Это ключевая метрика производительности: чем выше TTFB, тем дольше пользователь видит белый экран.',
      'Google рекомендует TTFB ниже 800 мс. Значения выше 3 секунд негативно влияют на ранжирование и поведенческие факторы.',
    ],
    fix: [
      'Профилировать медленные запросы (APM, slow query log MySQL/PostgreSQL).',
      'Включить серверное кэширование (Redis/Memcached, OPcache для PHP).',
      'Оптимизировать тяжёлые SQL-запросы: добавить индексы, проверить EXPLAIN.',
      'Подключить CDN (Cloudflare, BunnyCDN) для статики и кэша HTML.',
      'При необходимости перейти на более быстрый хостинг / увеличить ресурсы.',
    ],
  },
  {
    num: '1.18', title: 'Элемент <meta name="robots"> (noindex)', importance: 'высокая', complexity: 'низкая',
    codes: ['noindex_meta'], priority: 'P1',
    description: [
      'Тег <meta name="robots" content="noindex"> запрещает поисковым системам показывать страницу в выдаче. Также аналогично работает HTTP-заголовок X-Robots-Tag: noindex.',
      'Если коммерческая или посадочная страница случайно закрыта от индексации - она исключается из поиска и теряет трафик. Закрывать от индексации стоит только служебные URL (личный кабинет, корзина, дубли).',
    ],
    fix: [
      'Удалить из <head> коммерческих страниц: <meta name="robots" content="noindex">.',
      'Проверить, что заголовок X-Robots-Tag: noindex не приходит из nginx/CDN/CMS.',
      'В CMS проверить чекбокс «Скрыть от поисковиков» на нужных страницах.',
      'После правок отправить страницы на переобход.',
    ],
  },
  {
    num: '1.20', title: 'Код ответа несуществующих страниц', importance: 'высокая', complexity: 'низкая',
    codes: ['status_404'], priority: 'P1',
    description: [
      'Несуществующая страница должна возвращать HTTP-код 404 (Not Found). Если такая страница отдаёт 200 OK или 302, поисковые системы индексируют её как обычную, что засоряет индекс.',
      'Большое количество страниц 404, на которые ведут внутренние ссылки, ухудшает поведенческие факторы и качество сайта в глазах поисковика.',
    ],
    fix: [
      'Для каждого 404-URL: либо настроить 301-редирект на актуальную страницу, либо восстановить контент.',
      'Найти источник битых ссылок (шаблоны, меню, контент) и поправить.',
      'Проверить корректность .htaccess / nginx rewrite-правил.',
      'Убедиться, что несуществующие страницы отдают именно код 404, а не 200.',
    ],
  },

  // ============ 2. Ссылки и контент ============
  {
    num: '2.3', title: 'Mixed Content (HTTP-ресурсы на HTTPS)', importance: 'средняя', complexity: 'средняя',
    codes: ['mixed_content'], priority: 'P2',
    description: [
      'Mixed content - ситуация, когда на защищённой HTTPS-странице загружаются ресурсы (картинки, скрипты, стили) по небезопасному HTTP. Браузер блокирует часть таких ресурсов, замок безопасности в адресной строке пропадает.',
      'Это снижает доверие пользователей и негативно сказывается на ранжировании.',
    ],
    fix: [
      'Найти HTTP-ссылки в коде: img/src, link/href, script/src, url() в CSS.',
      'Заменить http:// → https:// или использовать протоколо-независимые ссылки //.',
      'Добавить CSP-заголовок: Content-Security-Policy: upgrade-insecure-requests.',
      'Глобальный поиск/замена в БД для контента из CMS.',
    ],
  },

  // ============ 3. Ошибки, выявленные парсером ============
  {
    num: '3.1.1', title: 'Дубли страниц по заголовкам H1', importance: 'высокая', complexity: 'средняя',
    codes: ['duplicate_h1'], priority: 'P2',
    description: [
      'Заголовок H1 должен быть уникальным для каждой страницы. Если несколько страниц имеют одинаковый H1, поисковая система не понимает, какую из них показывать в выдаче по запросу - релевантность размывается.',
      'Дубли H1 типичны для шаблонных страниц (карточки товаров, города, фильтры), где не подставляется уникальный параметр.',
    ],
    fix: [
      'Сделать H1 уникальным для каждой страницы.',
      'Использовать паттерны: «{Категория} - {Подкатегория}», «{Товар} купить в {Город}».',
      'Проверить шаблоны CMS: H1 должен включать переменные (название товара/города/артикула).',
      'Для пагинации добавлять «- страница N» в H1.',
    ],
  },
  {
    num: '3.1.2', title: 'Страницы с отсутствующим H1', importance: 'высокая', complexity: 'низкая',
    codes: ['missing_h1'], priority: 'P1',
    description: [
      'H1 - главный заголовок страницы, который сообщает поисковику и пользователю основную тему. Отсутствие H1 затрудняет поисковую систему в определении тематики страницы.',
      'H1 должен быть один на страницу, содержать главный ключевой запрос и располагаться в начале контентной части.',
    ],
    fix: [
      'В шаблоне страницы добавить тег <h1> с уникальным заголовком.',
      'H1 должен содержать главный ключевой запрос страницы.',
      'Один H1 на страницу - других тегов H1 быть не должно.',
      'Длина 30–70 символов, без CAPS и спецсимволов.',
    ],
  },
  {
    num: '3.1.3', title: 'Страницы с несколькими H1', importance: 'высокая', complexity: 'низкая',
    codes: ['multiple_h1'], priority: 'P2',
    description: [
      'На странице должен быть только один тег H1. Несколько H1 размывают семантику страницы для поисковиков и нарушают иерархию заголовков.',
      'Часто несколько H1 появляются из-за того, что в H1 оформлен логотип в шапке или баннер в сайдбаре.',
    ],
    fix: [
      'Оставить один H1 на страницу - заголовок основного контента.',
      'Лишние H1 заменить на H2/H3 или на <div>/<span> с нужным стилем.',
      'Логотип в шапке - обернуть в <a> с alt у картинки, без H1.',
    ],
  },
  {
    num: '3.2.1', title: 'Дубли страниц по title', importance: 'высокая', complexity: 'средняя',
    codes: ['duplicate_title'], priority: 'P2',
    description: [
      'Title - основной заголовок страницы в результатах поиска и во вкладке браузера. Одинаковые title между страницами мешают поисковику различать страницы и снижают CTR.',
      'Каждая страница должна иметь уникальный title длиной 50–60 символов с главным ключевым запросом в начале.',
    ],
    fix: [
      'Шаблонизировать title в CMS: подставлять уникальные параметры (товар, город, артикул).',
      'Пример: «{Название товара} - купить в {Город} | {Бренд}».',
      'Длина 50–60 символов, главный ключ в начале, бренд в конце.',
      'Проверить настройки CMS на автогенерацию title.',
    ],
  },
  {
    num: '3.2.2', title: 'Страницы с отсутствующим title', importance: 'высокая', complexity: 'низкая',
    codes: ['missing_title'], priority: 'P1',
    description: [
      'Title - самый важный мета-тег для SEO. Это текст, который пользователь видит в результатах поиска и в вкладке браузера. Отсутствие title резко снижает кликабельность.',
      'Без title поисковая система формирует заголовок сама - обычно из H1 или фрагмента URL, что неоптимально.',
    ],
    fix: [
      'В <head> каждой страницы добавить <title>…</title>.',
      'Длина 50–60 символов, главный ключ в начале, бренд в конце.',
      'Title должен быть уникальным для каждой страницы.',
      'В CMS сделать поле обязательным при создании страницы.',
    ],
  },
  {
    num: '3.3.1', title: 'Дубли страниц по description', importance: 'средняя', complexity: 'средняя',
    codes: ['duplicate_description'], priority: 'P2',
    description: [
      'Meta description - краткое описание страницы (140–160 символов), которое часто отображается под заголовком в выдаче. Дубли description снижают уникальность каждой страницы и могут уменьшать CTR.',
    ],
    fix: [
      'Сделать description уникальным для каждой страницы.',
      'Использовать шаблоны с подстановкой переменных.',
      'Включать УТП, цену, наличие, призыв к действию.',
      'Длина 140–160 символов.',
    ],
  },
  {
    num: '3.3.2', title: 'Страницы с отсутствующим description', importance: 'высокая', complexity: 'средняя',
    codes: ['missing_description'], priority: 'P2',
    description: [
      'Meta description отображается под title в результатах поиска. Без description поисковик автоматически выбирает фрагмент со страницы - обычно неоптимальный, что снижает CTR.',
      'Description - это маркетинговый инструмент: он должен мотивировать пользователя кликнуть.',
    ],
    fix: [
      'Добавить <meta name="description" content="…"> в <head> каждой страницы.',
      'Длина 140–160 символов.',
      'Включить главное преимущество, цену/выгоду, призыв к действию.',
      'В CMS добавить отдельное поле для description при создании страницы.',
    ],
  },
  {
    num: '3.5', title: 'Ссылки с HTTP', importance: 'средняя', complexity: 'низкая',
    codes: ['http_link'], priority: 'P2',
    description: [
      'Внутренние ссылки на сайте должны использовать HTTPS-протокол. HTTP-ссылки приводят к лишнему редиректу, теряется скорость загрузки и расходуется крауд-бюджет поисковика.',
    ],
    fix: [
      'Глобальный поиск/замена: http://домен → https://домен в шаблонах, БД и контенте.',
      'Использовать относительные ссылки /page вместо абсолютных.',
      'Включить 301-редирект HTTP → HTTPS на уровне сервера.',
    ],
  },
  {
    num: '3.7', title: 'Битые ссылки и страницы 404', importance: 'высокая', complexity: 'средняя',
    codes: ['broken_link', 'status_404'], priority: 'P1',
    description: [
      'Битые ссылки ведут на несуществующие страницы (код 404). Это раздражает пользователей, ухудшает поведенческие факторы и расходует крауд-бюджет поисковика впустую.',
      'Особенно критичны битые ссылки в навигации, меню и сквозных блоках - они тиражируются на всех страницах.',
    ],
    fix: [
      'Для каждого 404-URL: восстановить контент или поставить 301-редирект на актуальный.',
      'Найти страницы-источники битых ссылок (по списку URL ниже) и заменить ссылки.',
      'Проверить меню, футер, сквозные блоки.',
      'В CMS - проверить таблицу связей контента, очистить мёртвые ссылки.',
    ],
  },
  {
    num: '3.8', title: 'Ошибки 500 (внутренняя ошибка сервера)', importance: 'высокая', complexity: 'высокая',
    codes: ['status_500'], priority: 'P1',
    description: [
      '500 Internal Server Error - общая ошибка сервера, означающая, что сервер не смог обработать запрос. Пользователь видит белую страницу вместо контента, поисковик исключает такие страницы из индекса.',
      'Если 500-ошибки появляются массово - это сигнал о серьёзной проблеме (упала БД, превышены лимиты, баг в коде).',
    ],
    fix: [
      'Открыть error_log веб-сервера (/var/log/nginx/error.log, apache, php-fpm).',
      'Воспроизвести запрос локально, поймать stacktrace в application-логах.',
      'Проверить подключение к БД, права на файлы, лимиты памяти и времени.',
      'Настроить мониторинг (Sentry, healthcheck) для оперативного реагирования.',
    ],
  },
  {
    num: '3.9', title: 'Изображения без атрибута alt', importance: 'средняя', complexity: 'низкая',
    codes: ['missing_alt'], priority: 'P2',
    description: [
      'Атрибут alt у тега <img> описывает содержимое изображения. Он используется поисковыми системами для понимания картинки, программами для незрячих и отображается, если картинка не загрузилась.',
      'Без alt теряется трафик из поиска по изображениям и страдает доступность сайта.',
    ],
    fix: [
      'Для всех <img> добавить атрибут alt с осмысленным описанием.',
      'Для декоративных изображений - alt="".',
      'В CMS сделать поле «Описание» обязательным при загрузке изображений.',
      'Использовать ключевые слова, но без переспама.',
    ],
  },
  {
    num: '3.11', title: 'Исходящие ссылки с сайта', importance: 'низкая', complexity: 'низкая',
    codes: ['external_link'], priority: 'P3',
    description: [
      'Внешние ссылки ведут на сторонние домены. Большое количество внешних ссылок или ссылки на некачественные ресурсы могут передавать вес и негативно влиять на ранжирование.',
      'Рекомендуется контролировать список внешних ссылок и закрывать сомнительные через rel="nofollow".',
    ],
    fix: [
      'Проверить релевантность внешних ссылок.',
      'Для сомнительных и партнёрских - добавить rel="nofollow noopener".',
      'Для рекламных - rel="sponsored".',
      'Для пользовательского контента - rel="ugc".',
    ],
  },
];

const IMPORTANCE_LABEL: Record<Importance, string> = {
  'высокая': 'высокая', 'средняя': 'средняя', 'низкая': 'низкая',
};

// =====================================================================
// Стили / helpers
// =====================================================================
const COLOR_OK = '047857';      // зелёный
const COLOR_ERR = 'B91C1C';     // красный
const COLOR_TEXT = '111827';
const COLOR_MUTED = '6B7280';
const COLOR_ACCENT = '1F2937';
const COLOR_PRIORITY_HIGH = 'B91C1C';   // высокий - красный
const COLOR_PRIORITY_MID  = 'D97706';   // средний - оранжевый
const COLOR_PRIORITY_LOW  = '1F4E79';   // низкий - синий

const PRIORITY_LABEL: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'Высокий', P2: 'Средний', P3: 'Низкий',
};
const PRIORITY_COLOR: Record<'P1' | 'P2' | 'P3', string> = {
  P1: COLOR_PRIORITY_HIGH, P2: COLOR_PRIORITY_MID, P3: COLOR_PRIORITY_LOW,
};

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };
const CONTENT_W = 9638; // A4 - 2cm поля

function p(text: string, opts: { bold?: boolean; italic?: boolean; color?: string; size?: number; align?: any; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120, line: 300 },
    children: [new TextRun({
      text, bold: opts.bold, italics: opts.italic, color: opts.color,
      size: opts.size ?? 22, font: 'Arial',
    })],
  });
}

function pRuns(runs: TextRun[], opts: { align?: any; after?: number } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120, line: 300 },
    children: runs,
  });
}

function h1(text: string, num?: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: true,
    spacing: { before: 240, after: 240 },
    children: [new TextRun({
      text: num ? `${num}. ${text}` : text,
      bold: true, size: 32, font: 'Arial', color: COLOR_TEXT,
    })],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: COLOR_TEXT })],
  });
}

function h3(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 24, font: 'Arial', color: COLOR_ACCENT })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 80, line: 300 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })],
  });
}

function cell(content: Paragraph | Paragraph[], width: number, opts: { fill?: string; bold?: boolean } = {}): TableCell {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 120, bottom: 120, left: 160, right: 160 },
    children: Array.isArray(content) ? content : [content],
  });
}

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function safeName(s: string): string {
  return (s || 'site').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

// =====================================================================
// Анализ: определение, есть ли ошибка по чеку, и сбор затронутых URL
// =====================================================================
interface CheckResult {
  check: Check;
  hasError: boolean;
  affectedUrls: string[];
  totalIssues: number;
}

function analyzeChecks(issues: CrawlIssue[]): CheckResult[] {
  const byCode = new Map<string, CrawlIssue[]>();
  for (const i of issues) {
    const code = i.code || 'unknown';
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code)!.push(i);
  }
  return CHECKS.map(check => {
    const matched: CrawlIssue[] = [];
    for (const code of check.codes) {
      const arr = byCode.get(code);
      if (arr) matched.push(...arr);
    }
    const urls = new Set<string>();
    for (const i of matched) {
      const u = i.page_url || (i.details && (i.details.url || i.details.page_url));
      if (u) urls.add(u);
    }
    return {
      check,
      hasError: matched.length > 0,
      affectedUrls: Array.from(urls),
      totalIssues: matched.length,
    };
  });
}

// =====================================================================
// Сборка разделов документа
// =====================================================================
function buildCover(domain: string, preparedBy: string, periodMonths: number): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 600 },
      children: [new TextRun({ text: 'Технический аудит', bold: true, size: 56, font: 'Arial', color: COLOR_TEXT })],
    }),
    new Paragraph({ spacing: { after: 4800 }, children: [new TextRun({ text: '' })] }),
    // Карточка
    ...buildCoverCardParagraphs(domain, preparedBy, periodMonths),
  ];
}

function buildCoverCardParagraphs(domain: string, preparedBy: string, periodMonths: number): Paragraph[] {
  const tab = TabStopPosition.MAX;
  const line = (label: string, value: string) => new Paragraph({
    spacing: { after: 160, line: 300 },
    tabStops: [{ type: TabStopType.LEFT, position: 2400 }],
    children: [
      new TextRun({ text: label, bold: true, size: 26, font: 'Arial', color: COLOR_TEXT }),
      new TextRun({ text: '\t', size: 26, font: 'Arial' }),
      new TextRun({ text: value, size: 26, font: 'Arial', color: COLOR_ACCENT }),
    ],
  });
  return [
    line('Сайт:', domain),
    line('Дата:', fmtDate()),
    line('Период:', `${periodMonths} мес.`),
    line('Подготовил:', preparedBy),
  ];
}

function buildAbout(): Paragraph[] {
  return [
    h1('О документе'),
    p('Технический аудит - комплекс мероприятий по проверке сайта с технической точки зрения. По результатам анализа выявляются ошибки, которые мешают сайту нормально индексироваться и ранжироваться в поисковых системах, а также формируется техническое задание по их устранению.'),
    p('В топ-10 Google и Яндекса быстрее попадают технически исправные сайты. Идеальная архитектура и качественный контент не дадут результата, если присутствуют технические ошибки.'),
    p('Каждый пункт документа состоит из следующих элементов:', { bold: true }),
    bullet('Название проверяемой ошибки.'),
    bullet('Важность - насколько проблема может влиять на результаты продвижения.'),
    bullet('Сложность внесения - насколько трудно устранить проблему.'),
    bullet('Описание проблемы - в чём заключается проблема и как она влияет на SEO.'),
    bullet('Результат проверки: «Ошибки не найдены» или «Ошибка обнаружена».'),
    p('Если в проверяемом пункте обнаружена ошибка, конкретное ТЗ по её устранению описано в разделе «Рекомендации по устранению ошибок».', { bold: true }),
    p('Приоритет рекомендаций:', { bold: true }),
    pRuns([
      new TextRun({ text: '● ', size: 22, font: 'Arial' }),
      new TextRun({ text: 'Высокий', bold: true, size: 22, font: 'Arial', color: COLOR_PRIORITY_HIGH }),
      new TextRun({ text: ' - выполнить в первую очередь. Игнорирование ведёт к серьёзным проблемам с индексацией.', size: 22, font: 'Arial' }),
    ], { after: 80 }),
    pRuns([
      new TextRun({ text: '● ', size: 22, font: 'Arial' }),
      new TextRun({ text: 'Средний', bold: true, size: 22, font: 'Arial', color: COLOR_PRIORITY_MID }),
      new TextRun({ text: ' - необходимо для успешного продвижения, но не блокирует индексацию.', size: 22, font: 'Arial' }),
    ], { after: 80 }),
    pRuns([
      new TextRun({ text: '● ', size: 22, font: 'Arial' }),
      new TextRun({ text: 'Низкий', bold: true, size: 22, font: 'Arial', color: COLOR_PRIORITY_LOW }),
      new TextRun({ text: ' - не влияет напрямую на ранжирование, можно выполнить в плановом порядке.', size: 22, font: 'Arial' }),
    ], { after: 80 }),
  ];
}

function buildCheckBlock(r: CheckResult): Paragraph[] {
  const { check, hasError, totalIssues, affectedUrls } = r;
  const out: Paragraph[] = [];

  // Заголовок
  const level = check.num.split('.').length;
  if (level === 2) out.push(h2(`${check.num}. ${check.title}`));
  else out.push(h3(`${check.num}. ${check.title}`));

  // Важность / сложность
  out.push(p(`Важность - ${IMPORTANCE_LABEL[check.importance]}`, { italic: true, bold: true, after: 60 }));
  out.push(p(`Сложность внесения - ${check.complexity}`, { italic: true, bold: true, after: 160 }));

  // Описание
  for (const para of check.description) out.push(p(para));

  // Результат
  out.push(pRuns([
    new TextRun({ text: 'Результат проверки: ', size: 22, font: 'Arial' }),
    new TextRun({
      text: hasError ? 'Ошибка обнаружена' : 'Ошибки не найдены',
      bold: true, size: 22, font: 'Arial',
      color: hasError ? COLOR_ERR : COLOR_OK,
    }),
    ...(hasError ? [new TextRun({
      text: ` (затронуто страниц: ${affectedUrls.length || totalIssues})`,
      size: 22, font: 'Arial', color: COLOR_MUTED,
    })] : []),
  ], { after: 120 }));

  if (hasError) {
    out.push(p('Задание по устранению ошибки описано в разделе «Рекомендации по устранению ошибок».', { italic: true, color: COLOR_MUTED, size: 20 }));
  }

  return out;
}

function buildRecommendation(r: CheckResult, idx: number): Paragraph[] {
  const { check, affectedUrls, totalIssues } = r;
  const out: Paragraph[] = [];

  out.push(new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text: `${idx}. `, bold: true, size: 24, font: 'Arial', color: COLOR_ACCENT }),
      new TextRun({ text: PRIORITY_LABEL[check.priority], bold: true, size: 24, font: 'Arial', color: PRIORITY_COLOR[check.priority] }),
      new TextRun({ text: ` - ${check.title}`, bold: true, size: 24, font: 'Arial', color: COLOR_ACCENT }),
    ],
  }));
  out.push(pRuns([
    new TextRun({ text: 'Приоритет: ', italics: true, size: 20, font: 'Arial', color: COLOR_MUTED }),
    new TextRun({ text: PRIORITY_LABEL[check.priority], bold: true, italics: true, size: 20, font: 'Arial', color: PRIORITY_COLOR[check.priority] }),
    new TextRun({ text: ` • Важность: ${IMPORTANCE_LABEL[check.importance]} • Затронуто страниц: ${affectedUrls.length || totalIssues}`,
      italics: true, size: 20, font: 'Arial', color: COLOR_MUTED }),
  ], { after: 160 }));

  out.push(p('Что сделать:', { bold: true, after: 80 }));
  for (const step of check.fix) out.push(bullet(step));

  if (affectedUrls.length > 0) {
    out.push(p('Затронутые URL:', { bold: true, after: 80 }));
    const shown = affectedUrls.slice(0, 50);
    for (const u of shown) {
      out.push(new Paragraph({
        spacing: { after: 40, line: 280 },
        children: [new TextRun({ text: `• ${u}`, size: 18, font: 'Consolas', color: COLOR_ACCENT })],
      }));
    }
    if (affectedUrls.length > shown.length) {
      out.push(p(`…и ещё ${affectedUrls.length - shown.length} URL - полный список доступен в интерфейсе аудита.`,
        { italic: true, color: COLOR_MUTED, size: 18 }));
    }
  }

  out.push(new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: '' })] }));
  return out;
}

// =====================================================================
// Основной экспорт
// =====================================================================
export async function downloadTechnicalAuditDocx(input: TechnicalAuditExportInput): Promise<void> {
  const { domain, stats, issues, preparedBy = 'SEO-Аудит', periodMonths = 1 } = input;
  const results = analyzeChecks(issues || []);
  const errors = results.filter(r => r.hasError);
  const totalPages = stats?.total_pages ?? 0;

  // Группировка чеков по разделам
  const section1 = results.filter(r => r.check.num.startsWith('1.'));
  const section2 = results.filter(r => r.check.num.startsWith('2.'));
  const section3 = results.filter(r => r.check.num.startsWith('3.'));

  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(...buildCover(domain, preparedBy, periodMonths));

  // О документе
  children.push(...buildAbout());

  // Сводка
  children.push(h1('Сводка по аудиту'));
  children.push(p(`Проверено страниц: ${totalPages}`));
  children.push(p(`Всего проверок выполнено: ${results.length}`));
  children.push(pRuns([
    new TextRun({ text: 'Без ошибок: ', size: 22, font: 'Arial' }),
    new TextRun({ text: String(results.length - errors.length), bold: true, color: COLOR_OK, size: 22, font: 'Arial' }),
    new TextRun({ text: '   •   ', size: 22, font: 'Arial', color: COLOR_MUTED }),
    new TextRun({ text: 'С ошибками: ', size: 22, font: 'Arial' }),
    new TextRun({ text: String(errors.length), bold: true, color: COLOR_ERR, size: 22, font: 'Arial' }),
  ]));
  children.push(p(`Средний ответ сервера (TTFB): ${stats?.avg_load_time_ms ?? 0} мс`));

  // Оглавление
  children.push(h2('Оглавление'));
  const tocSections: Array<{ title: string; items: CheckResult[] }> = [
    { title: '1. Технические ошибки', items: section1 },
    ...(section2.length > 0 ? [{ title: '2. Ссылки и контент', items: section2 }] : []),
    { title: '3. Ошибки, выявленные парсером', items: section3 },
  ];
  for (const sec of tocSections) {
    children.push(p(sec.title, { bold: true, after: 80 }));
    for (const r of sec.items) {
      children.push(new Paragraph({
        spacing: { after: 40, line: 280 },
        tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
        children: [
          new TextRun({ text: `   ${r.check.num}. ${r.check.title}`, size: 20, font: 'Arial', color: COLOR_TEXT }),
          new TextRun({ text: '\t', size: 20, font: 'Arial' }),
          new TextRun({
            text: r.hasError ? 'Ошибка обнаружена' : 'Ошибки не найдены',
            size: 20, font: 'Arial', bold: true,
            color: r.hasError ? COLOR_ERR : COLOR_OK,
          }),
        ],
      }));
    }
  }
  children.push(p('4. Рекомендации по устранению ошибок', { bold: true, after: 40 }));
  children.push(pRuns([
    new TextRun({ text: `   Всего задач для разработчика: `, size: 20, font: 'Arial', color: COLOR_TEXT }),
    new TextRun({ text: String(errors.length), size: 20, font: 'Arial', bold: true, color: errors.length > 0 ? COLOR_ERR : COLOR_OK }),
  ], { after: 120 }));

  // Раздел 1
  children.push(h1('Технические ошибки', '1'));
  for (const r of section1) children.push(...buildCheckBlock(r));

  // Раздел 2
  if (section2.length > 0) {
    children.push(h1('Ссылки и контент', '2'));
    for (const r of section2) children.push(...buildCheckBlock(r));
  }

  // Раздел 3
  children.push(h1('Ошибки, выявленные парсером', '3'));
  for (const r of section3) children.push(...buildCheckBlock(r));

  // Раздел 4: Рекомендации (только по ошибкам)
  children.push(h1('Рекомендации по устранению ошибок', '4'));
  if (errors.length === 0) {
    children.push(p('Ошибки на сайте не обнаружены. Технических рекомендаций нет.',
      { italic: true, color: COLOR_OK, bold: true }));
  } else {
    children.push(p('В этом разделе собрано конкретное техническое задание для разработчика - только по тем проверкам, где была обнаружена ошибка. Задачи отсортированы по приоритету.'));
    // Сортировка: P1 → P2 → P3
    const sorted = [...errors].sort((a, b) => a.check.priority.localeCompare(b.check.priority));
    sorted.forEach((r, idx) => children.push(...buildRecommendation(r, idx + 1)));
  }

  // Документ
  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `Технический аудит - ${domain}`,
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '●', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: COLOR_TEXT },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: COLOR_TEXT },
          paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial', color: COLOR_ACCENT },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 2 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Технический аудит • ${domain}`, size: 18, color: '9CA3AF', font: 'Arial' })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: 'Стр. ', size: 18, color: '9CA3AF', font: 'Arial' }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF', font: 'Arial' }),
          ] })] }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Tehnicheskiy-audit_${safeName(domain)}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
}