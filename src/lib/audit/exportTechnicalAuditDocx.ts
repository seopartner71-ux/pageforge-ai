import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, PageBreak,
  Header, Footer, PageNumber, LevelFormat, TabStopType, TabStopPosition,
  ImageRun,
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
// Каталог проверок — 45 пунктов в стиле шаблона.
// screenshot — путь относительно /audit-template/ (public/audit-template/)
// =====================================================================
type Importance = 'высокая' | 'средняя' | 'низкая';
type Complexity = 'низкая' | 'средняя' | 'высокая';

interface Check {
  num: string;
  title: string;
  importance: Importance;
  complexity: Complexity;
  description: string[];
  codes: string[];
  fix: string[];
  priority: 'P1' | 'P2' | 'P3';
  screenshot?: { file: string; caption: string };
}

const CHECKS: Check[] = [
  // ============ 1. Технические ошибки ============
  {
    num: '1.1', title: 'Главное зеркало сайта (www / без www)', importance: 'высокая', complexity: 'низкая',
    codes: [], priority: 'P1',
    description: [
      'У сайта должно быть выбрано одно главное зеркало - с www или без. Второй вариант должен 301-редиректом склеиваться с главным. Иначе поисковики видят два разных сайта-дубля, ссылочный вес и поведенческие факторы делятся пополам.',
    ],
    fix: [
      'Выбрать главное зеркало (рекомендуется без www для коротких доменов).',
      'Настроить 301-редирект второстепенного варианта на главное на уровне nginx/Apache.',
      'Указать главное зеркало в Google Search Console и Яндекс.Вебмастер.',
      'Проверить, что все внутренние ссылки ведут на главное зеркало.',
    ],
  },
  {
    num: '1.2', title: 'Протокол HTTPS', importance: 'высокая', complexity: 'высокая',
    codes: ['no_https'], priority: 'P1',
    description: [
      'HTTPS - расширение протокола HTTP, которое шифрует данные между сайтом и пользователем. Снижает риск перехвата персональных данных и предотвращает подмену контента.',
      'Google помечает HTTP-сайты в Chrome как «не защищённые», Яндекс считает HTTPS показателем качества. С HTTP рекомендуется настроить прямой 301-редирект на HTTPS-версию.',
    ],
    fix: [
      'Установить SSL-сертификат (бесплатно через Let\'s Encrypt с автопродлением).',
      'Настроить 301-редирект всех HTTP-URL на HTTPS на уровне веб-сервера.',
      'Заменить абсолютные ссылки http:// → https:// в шаблонах, БД и контенте.',
      'Добавить заголовок HSTS: Strict-Transport-Security: max-age=31536000; includeSubDomains.',
      'Проверить отсутствие mixed content.',
    ],
  },
  {
    num: '1.3', title: 'XML-карта сайта (sitemap.xml)', importance: 'высокая', complexity: 'низкая',
    codes: ['no_sitemap'], priority: 'P1',
    description: [
      'XML-карта сайта - файл, содержащий ссылки на все страницы сайта, подлежащие индексированию. Sitemap ускоряет индексацию и помогает поисковым системам находить новые страницы.',
      'Файл должен содержать только канонические URL с кодом ответа 200, без редиректов и закрытых от индексации страниц. Один файл - не более 50 000 URL и 50 МБ.',
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
      'Robots.txt - текстовый файл с инструкциями для поисковых роботов о том, какие разделы сайта индексировать, а какие нет. Доступен по адресу /robots.txt в корне домена.',
      'Поисковые системы при каждом обходе обращаются к этому файлу в первую очередь. В нём указываются служебные разделы, исключаемые из поиска, и путь к sitemap.',
    ],
    fix: [
      'Создать файл /robots.txt в корне домена.',
      'Минимальное содержимое: User-agent: *  /  Allow: /  /  Sitemap: https://домен/sitemap.xml',
      'Закрыть служебные разделы (admin, корзина, фильтры) через Disallow.',
      'Убедиться, что нет глобального запрета Disallow: / для User-agent: *.',
      'После правок запросить переобход в Search Console и Вебмастере.',
    ],
  },
  {
    num: '1.5', title: 'Скорость ответа сервера (TTFB)', importance: 'высокая', complexity: 'средняя',
    codes: ['slow_ttfb'], priority: 'P1',
    description: [
      'TTFB (Time To First Byte) - время от запроса до получения первого байта ответа сервера. Ключевая метрика производительности: чем выше TTFB, тем дольше пользователь видит белый экран.',
      'Google рекомендует TTFB ниже 800 мс. Значения выше 3 секунд негативно влияют на ранжирование и поведенческие факторы.',
    ],
    fix: [
      'Профилировать медленные запросы (APM, slow query log MySQL/PostgreSQL).',
      'Включить серверное кэширование (Redis/Memcached, OPcache для PHP).',
      'Оптимизировать тяжёлые SQL-запросы: добавить индексы, проверить EXPLAIN.',
      'Подключить CDN (Cloudflare, BunnyCDN) для статики и кэша HTML.',
      'При необходимости перейти на более быстрый хостинг.',
    ],
  },
  {
    num: '1.6', title: 'Скорость загрузки страниц (Core Web Vitals)', importance: 'высокая', complexity: 'средняя',
    codes: ['slow_page'], priority: 'P1',
    description: [
      'Core Web Vitals - метрики Google, описывающие пользовательский опыт: LCP (загрузка крупнейшего элемента, цель < 2,5 с), INP (отзывчивость, < 200 мс), CLS (стабильность вёрстки, < 0,1).',
      'С 2021 года Web Vitals - официальный фактор ранжирования. Полная загрузка страницы должна укладываться в 3 секунды.',
    ],
    fix: [
      'Включить сжатие изображений (WebP/AVIF), задать width/height для CLS.',
      'Перенести второстепенные скрипты на defer/async, удалить неиспользуемый JS/CSS.',
      'Прелоадить главный шрифт и LCP-картинку (link rel="preload").',
      'Использовать lazy-load для изображений ниже первого экрана.',
      'Проверить через PageSpeed Insights и Lighthouse.',
    ],
  },
  {
    num: '1.7', title: 'Заголовок Last-Modified / If-Modified-Since', importance: 'средняя', complexity: 'средняя',
    codes: ['no_last_modified'], priority: 'P2',
    description: [
      'Заголовки Last-Modified и If-Modified-Since позволяют поисковому роботу не перекачивать содержимое страницы, если оно не менялось с прошлого визита. Сервер отдаёт 304 Not Modified - экономит крауд-бюджет и ускоряет переобход обновлённых страниц.',
      'Особенно важно для крупных сайтов (интернет-магазины, новостники), где роботу нужно успевать переобходить десятки тысяч URL.',
    ],
    fix: [
      'В ответе сервера отдавать заголовок Last-Modified: <дата последнего изменения>.',
      'Обрабатывать входящий If-Modified-Since и возвращать 304 при отсутствии изменений.',
      'Для CMS - включить опцию в настройках или поставить плагин.',
      'Проверить через curl -I https://домен/url или через Яндекс.Вебмастер.',
    ],
    screenshot: { file: 'last-modified.png', caption: 'Пример корректной отдачи заголовка Last-Modified и ответа 304 Not Modified' },
  },
  {
    num: '1.8', title: 'Gzip / Brotli-сжатие ответов', importance: 'средняя', complexity: 'низкая',
    codes: ['no_compression'], priority: 'P2',
    description: [
      'Сжатие текстовых ответов (HTML/CSS/JS/JSON) уменьшает их размер в 4–8 раз. Brotli даёт лучший результат, чем Gzip. Без сжатия страницы грузятся дольше, потребляют больше трафика.',
    ],
    fix: [
      'Nginx: gzip on; gzip_types text/plain text/css application/json application/javascript; brotli on;',
      'Apache: mod_deflate / mod_brotli с аналогичным набором MIME-типов.',
      'Проверить через https://check-gzip.com или curl -H "Accept-Encoding: br,gzip" -I.',
    ],
  },
  {
    num: '1.9', title: 'Кеширование статики (Cache-Control / Expires)', importance: 'средняя', complexity: 'низкая',
    codes: ['no_cache_headers'], priority: 'P2',
    description: [
      'Браузерное кеширование позволяет повторно использовать CSS/JS/картинки без повторной загрузки. Без корректных Cache-Control заголовков пользователь грузит одни и те же файлы при каждом визите.',
    ],
    fix: [
      'Для статики (.js, .css, .jpg, .png, .woff2): Cache-Control: public, max-age=31536000, immutable.',
      'Для HTML: Cache-Control: no-cache (контент должен быть свежим).',
      'Использовать версионирование файлов (hash в имени) для сброса кеша.',
    ],
  },
  {
    num: '1.10', title: 'Использование HTTP/2 или HTTP/3', importance: 'низкая', complexity: 'средняя',
    codes: ['no_http2'], priority: 'P3',
    description: [
      'HTTP/2 и HTTP/3 поддерживают мультиплексирование запросов, что значительно ускоряет загрузку страниц с большим количеством ресурсов по сравнению с HTTP/1.1.',
    ],
    fix: [
      'Nginx: listen 443 ssl http2; для HTTP/3 - quic + listen 443 quic reuseport.',
      'Apache: mod_http2, Protocols h2 http/1.1.',
      'Проверить через https://tools.keycdn.com/http2-test.',
    ],
  },
  {
    num: '1.11', title: 'Минификация HTML / CSS / JS', importance: 'низкая', complexity: 'низкая',
    codes: ['unminified'], priority: 'P3',
    description: [
      'Минификация удаляет из кода пробелы, переносы и комментарии, уменьшая размер файлов на 20–40%. В сочетании с сжатием экономит трафик и ускоряет загрузку.',
    ],
    fix: [
      'Подключить сборщик (Vite/Webpack/esbuild) для prod-сборки JS/CSS.',
      'HTML минифицировать на уровне шаблонизатора или middleware.',
      'Удалить console.log и debug-код в production.',
    ],
  },
  {
    num: '1.12', title: 'Кодировка UTF-8 на всех страницах', importance: 'средняя', complexity: 'низкая',
    codes: ['wrong_charset'], priority: 'P2',
    description: [
      'Все страницы сайта должны отдаваться в UTF-8. Иначе возможны «крякозябры» в выдаче, проблемы с индексацией кириллицы и обработкой контента поисковиками.',
    ],
    fix: [
      'В <head>: <meta charset="UTF-8"> в первых 1024 байтах документа.',
      'Сервер должен отдавать Content-Type: text/html; charset=utf-8.',
      'Файлы шаблонов сохранять в UTF-8 без BOM.',
      'БД - кодировка таблиц utf8mb4_unicode_ci.',
    ],
  },
  {
    num: '1.13', title: 'Доступность сайта (Uptime)', importance: 'высокая', complexity: 'средняя',
    codes: ['downtime'], priority: 'P1',
    description: [
      'Сайт должен быть доступен 99,9% времени. Регулярные падения приводят к тому, что робот при обходе получает 5xx-ошибки и постепенно выкидывает страницы из индекса.',
      'Также при недоступности теряется прямой трафик и доверие пользователей.',
    ],
    fix: [
      'Подключить мониторинг uptime: UptimeRobot, Pingdom, ХостТрекер.',
      'Настроить алерты в Telegram/email при падении.',
      'Проанализировать причины простоев в логах хостинга.',
      'При частых падениях - сменить хостинг или увеличить тариф.',
    ],
    screenshot: { file: 'uptime.jpg', caption: 'Пример отчёта мониторинга доступности сайта' },
  },
  {
    num: '1.14', title: 'Проверка на вирусы и санкции поисковиков', importance: 'высокая', complexity: 'средняя',
    codes: ['malware'], priority: 'P1',
    description: [
      'Сайт может быть заражён вредоносным кодом (скрытые ссылки, редиректы, майнеры) или попасть под санкции поисковиков за нарушения. Это приводит к исключению из выдачи или предупреждениям браузера.',
    ],
    fix: [
      'Проверить в Яндекс.Вебмастере раздел «Диагностика» → «Безопасность и нарушения».',
      'Проверить в Google Search Console раздел «Проблемы безопасности».',
      'Запустить антивирусное сканирование через AI-Bolit / ImunifyAV.',
      'При обнаружении - удалить вредоносный код, сменить пароли, запросить пересмотр в поисковике.',
    ],
    screenshot: { file: 'virus-check.png', caption: 'Проверка сайта на вирусы и санкции в Яндекс.Вебмастере' },
  },
  {
    num: '1.15', title: 'Цепочки и циклические редиректы', importance: 'высокая', complexity: 'средняя',
    codes: ['redirect_chain', 'redirect_loop'], priority: 'P1',
    description: [
      'Цепочка редиректов - когда URL A → B → C → D. Каждый шаг тратит время загрузки и часть ссылочного веса. Поисковики могут останавливаться после 3–5 переходов.',
      'Циклический редирект (A → B → A) полностью блокирует доступ к странице - и для пользователя, и для робота.',
    ],
    fix: [
      'Найти цепочки через Screaming Frog или curl -ILk.',
      'Заменить промежуточные шаги прямым 301-редиректом A → D.',
      'Разорвать циклы - проверить правила в .htaccess / nginx / CMS.',
      'Все внутренние ссылки переписать сразу на конечный URL.',
    ],
    screenshot: { file: 'cyclic-links.jpg', caption: 'Визуализация цепочек редиректов и циклических ссылок' },
  },
  {
    num: '1.16', title: 'Пагинация (rel=prev/next, canonical)', importance: 'средняя', complexity: 'средняя',
    codes: ['bad_pagination'], priority: 'P2',
    description: [
      'Страницы пагинации (?page=2, /page/3) должны корректно индексироваться. Каждая такая страница - уникальный URL с canonical на саму себя, title с указанием номера страницы, и без дублей контента с первой страницей.',
      'Ошибки: canonical всех страниц пагинации на первую (теряется индексация товаров), полное закрытие от индексации, дубль контента.',
    ],
    fix: [
      'На каждой странице пагинации - <link rel="canonical" href="?page=N">.',
      'Title и H1 уточнять: «Каталог - страница 2».',
      'Не дублировать SEO-текст с первой страницы на остальные.',
      'Все страницы пагинации должны индексироваться (без noindex).',
    ],
    screenshot: { file: 'pagination.jpg', caption: 'Правильная разметка пагинации с rel=canonical' },
  },
  {
    num: '1.17', title: 'Канонический URL (rel=canonical)', importance: 'высокая', complexity: 'средняя',
    codes: ['no_canonical', 'wrong_canonical'], priority: 'P1',
    description: [
      'Тег <link rel="canonical"> указывает поисковикам основной URL страницы, когда она доступна по нескольким адресам (с GET-параметрами, фильтрами, UTM-метками). Без canonical поисковик может выбрать неподходящую версию и склеивать дубли некорректно.',
    ],
    fix: [
      'На каждой странице в <head>: <link rel="canonical" href="https://домен/url">.',
      'Canonical должен быть абсолютным URL, без UTM/GET-параметров.',
      'Страница должна ссылаться сама на себя (если она каноническая).',
      'Не использовать canonical для пагинации (см. п. 1.16).',
    ],
  },
  {
    num: '1.18', title: 'Элемент <meta name="robots"> (noindex)', importance: 'высокая', complexity: 'низкая',
    codes: ['noindex_meta'], priority: 'P1',
    description: [
      'Тег <meta name="robots" content="noindex"> запрещает поисковым системам показывать страницу в выдаче. Аналогично работает HTTP-заголовок X-Robots-Tag: noindex.',
      'Если коммерческая страница случайно закрыта от индексации - она исключается из поиска. Закрывать стоит только служебные URL.',
    ],
    fix: [
      'Удалить из <head> коммерческих страниц: <meta name="robots" content="noindex">.',
      'Проверить, что заголовок X-Robots-Tag: noindex не приходит из nginx/CDN/CMS.',
      'В CMS проверить чекбокс «Скрыть от поисковиков».',
      'После правок отправить страницы на переобход.',
    ],
  },
  {
    num: '1.19', title: 'ЧПУ - человеко-понятные URL', importance: 'средняя', complexity: 'высокая',
    codes: ['bad_url'], priority: 'P2',
    description: [
      'URL вида /catalog/smartfony/iphone-15 лучше воспринимается пользователями и поисковиками, чем /index.php?cat=12&id=345. Транслитом, в нижнем регистре, со словами через дефис.',
      'Смена URL уже работающих страниц - сложная операция: требует массовых 301-редиректов и переобхода поисковиками.',
    ],
    fix: [
      'Включить mod_rewrite / rewrite в nginx, в CMS - режим ЧПУ.',
      'Транслитерировать на латиницу (kombinezony вместо комбинезоны).',
      'Слова разделять дефисом, нижний регистр, без подчёркиваний.',
      'При смене URL - настроить 301 со старого на новый, обновить sitemap.',
    ],
  },
  {
    num: '1.20', title: 'Код ответа несуществующих страниц', importance: 'высокая', complexity: 'низкая',
    codes: ['status_404'], priority: 'P1',
    description: [
      'Несуществующая страница должна возвращать HTTP-код 404 (Not Found). Если такая страница отдаёт 200 OK или 302, поисковые системы индексируют её как обычную, что засоряет индекс.',
      'Большое количество страниц 404 с внутренними ссылками ухудшает поведенческие факторы.',
    ],
    fix: [
      'Для каждого 404-URL: настроить 301-редирект или восстановить контент.',
      'Найти источник битых ссылок (шаблоны, меню, контент) и поправить.',
      'Проверить корректность .htaccess / nginx rewrite-правил.',
      'Создать дружественную 404-страницу с поиском и навигацией.',
      'Убедиться, что несуществующие страницы отдают именно код 404, а не 200.',
    ],
    screenshot: { file: '404-design.jpg', caption: 'Пример удобной 404-страницы с навигацией и поиском' },
  },

  // ============ 2. Ссылки и контент ============
  {
    num: '2.1', title: 'Внутренняя перелинковка и orphan-страницы', importance: 'высокая', complexity: 'средняя',
    codes: ['orphan_page'], priority: 'P2',
    description: [
      'Orphan-страница - страница, на которую не ведёт ни одна внутренняя ссылка. Поисковик находит её только через sitemap и считает малозначимой.',
      'Хорошая перелинковка распределяет вес по сайту, повышает индексируемость и помогает пользователю.',
    ],
    fix: [
      'Найти orphan-страницы (Screaming Frog → Crawl Analysis).',
      'Добавить ссылки на них из родственных категорий, блоков «Похожие товары/статьи».',
      'Использовать блоки «Популярное», «Недавно добавленное» в сайдбаре.',
      'Контекстные ссылки внутри текста - самые ценные.',
    ],
  },
  {
    num: '2.2', title: 'Анкоры внутренних ссылок', importance: 'средняя', complexity: 'низкая',
    codes: ['bad_anchor'], priority: 'P2',
    description: [
      'Анкор - кликабельный текст ссылки. Анкоры «здесь», «тут», «читать далее» не несут SEO-веса. Релевантные анкоры с ключевыми словами помогают ранжироваться по этим запросам.',
    ],
    fix: [
      'Заменить безликие анкоры на описательные: «купить iPhone 15» вместо «подробнее».',
      'Не использовать один и тот же анкор для разных URL.',
      'Не злоупотреблять прямым вхождением ключа - чередовать формы.',
    ],
  },
  {
    num: '2.3', title: 'Mixed Content (HTTP-ресурсы на HTTPS)', importance: 'средняя', complexity: 'средняя',
    codes: ['mixed_content'], priority: 'P2',
    description: [
      'Mixed content - ситуация, когда на защищённой HTTPS-странице загружаются ресурсы (картинки, скрипты, стили) по небезопасному HTTP. Браузер блокирует часть ресурсов, замок безопасности пропадает.',
    ],
    fix: [
      'Найти HTTP-ссылки в коде: img/src, link/href, script/src, url() в CSS.',
      'Заменить http:// → https:// или использовать протоколо-независимые ссылки //.',
      'Добавить CSP-заголовок: Content-Security-Policy: upgrade-insecure-requests.',
      'Глобальный поиск/замена в БД для контента из CMS.',
    ],
  },
  {
    num: '2.4', title: 'Глубина вложенности страниц (правило 3 кликов)', importance: 'средняя', complexity: 'средняя',
    codes: ['deep_nesting'], priority: 'P2',
    description: [
      'Любая важная страница должна быть доступна за 3–4 клика от главной. Глубокие страницы (>5 уровней) получают меньше внутреннего веса и хуже индексируются.',
    ],
    fix: [
      'Построить карту глубины через Screaming Frog (Crawl Depth).',
      'Для глубоких страниц - добавить прямые ссылки из меню, футера, родительских разделов.',
      'Использовать HTML-карту сайта для разделов глубже 4 уровней.',
    ],
  },
  {
    num: '2.5', title: 'Хлебные крошки (breadcrumbs)', importance: 'средняя', complexity: 'низкая',
    codes: ['no_breadcrumbs'], priority: 'P2',
    description: [
      'Breadcrumbs - навигационная цепочка вида «Главная → Каталог → Категория → Товар». Помогают пользователю и поисковику понять структуру сайта. Со Schema.org BreadcrumbList отображаются в сниппете Google вместо URL.',
    ],
    fix: [
      'Добавить хлебные крошки на все внутренние страницы.',
      'Разметить через JSON-LD BreadcrumbList.',
      'Главная - первый элемент, текущая страница - последний (без ссылки).',
    ],
  },

  // ============ 3. Ошибки, выявленные парсером ============
  {
    num: '3.1.1', title: 'Дубли страниц по заголовкам H1', importance: 'высокая', complexity: 'средняя',
    codes: ['duplicate_h1'], priority: 'P2',
    description: [
      'Заголовок H1 должен быть уникальным для каждой страницы. Если несколько страниц имеют одинаковый H1, поисковая система не понимает, какую из них показывать в выдаче по запросу - релевантность размывается.',
    ],
    fix: [
      'Сделать H1 уникальным для каждой страницы.',
      'Использовать паттерны: «{Категория} - {Подкатегория}», «{Товар} купить в {Город}».',
      'Проверить шаблоны CMS: H1 должен включать переменные.',
      'Для пагинации добавлять «- страница N» в H1.',
    ],
  },
  {
    num: '3.1.2', title: 'Страницы с отсутствующим H1', importance: 'высокая', complexity: 'низкая',
    codes: ['missing_h1'], priority: 'P1',
    description: [
      'H1 - главный заголовок страницы, который сообщает поисковику и пользователю основную тему. Отсутствие H1 затрудняет определение тематики страницы.',
      'H1 должен быть один на страницу, содержать главный ключевой запрос и располагаться в начале контентной части. Должна соблюдаться иерархия H1 → H2 → H3.',
    ],
    fix: [
      'В шаблоне страницы добавить тег <h1> с уникальным заголовком.',
      'H1 должен содержать главный ключевой запрос страницы.',
      'Один H1 на страницу - других тегов H1 быть не должно.',
      'Длина 30–70 символов, без CAPS и спецсимволов.',
    ],
    screenshot: { file: 'headings-hierarchy.png', caption: 'Правильная иерархия заголовков H1 → H2 → H3 на странице' },
  },
  {
    num: '3.1.3', title: 'Страницы с несколькими H1', importance: 'высокая', complexity: 'низкая',
    codes: ['multiple_h1'], priority: 'P2',
    description: [
      'На странице должен быть только один тег H1. Несколько H1 размывают семантику страницы и нарушают иерархию заголовков.',
      'Часто несколько H1 появляются из-за того, что в H1 оформлен логотип в шапке или баннер.',
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
      'Шаблонизировать title в CMS: подставлять уникальные параметры.',
      'Пример: «{Название товара} - купить в {Город} | {Бренд}».',
      'Длина 50–60 символов, главный ключ в начале, бренд в конце.',
    ],
  },
  {
    num: '3.2.2', title: 'Страницы с отсутствующим title', importance: 'высокая', complexity: 'низкая',
    codes: ['missing_title'], priority: 'P1',
    description: [
      'Title - самый важный мета-тег для SEO. Это текст, который пользователь видит в результатах поиска и в вкладке браузера. Отсутствие title резко снижает кликабельность.',
      'Без title поисковая система формирует заголовок сама - обычно из H1 или фрагмента URL.',
    ],
    fix: [
      'В <head> каждой страницы добавить <title>…</title>.',
      'Длина 50–60 символов, главный ключ в начале, бренд в конце.',
      'Title должен быть уникальным для каждой страницы.',
      'В CMS сделать поле обязательным при создании страницы.',
    ],
  },
  {
    num: '3.2.3', title: 'Длина title (короткие / длинные)', importance: 'средняя', complexity: 'низкая',
    codes: ['title_length'], priority: 'P2',
    description: [
      'Оптимальная длина title - 50–60 символов (до 600 пикселей). Короткие title (<30 символов) не используют потенциал, длинные (>70) обрезаются в выдаче троеточием.',
    ],
    fix: [
      'Пересмотреть title всех страниц с длиной вне диапазона 50–60.',
      'Главный ключ - в первые 30 символов.',
      'В конце - название бренда / города.',
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
    num: '3.4', title: 'Дубли страниц по содержимому', importance: 'высокая', complexity: 'высокая',
    codes: ['duplicate_content'], priority: 'P2',
    description: [
      'Дубли контента - страницы с одинаковым или почти одинаковым содержимым по разным URL. Чаще всего возникают из-за GET-параметров (?sort=, ?utm=), версии для печати, мобильной версии, фильтров каталога.',
      'Поисковик не знает, какую из дублей показывать в выдаче, и может склеить их непредсказуемо или понизить обе.',
    ],
    fix: [
      'Найти дубли через Siteliner или Screaming Frog (Duplicate Content).',
      'Указать canonical на основной URL.',
      'Закрыть мусорные параметры в robots.txt (Clean-param для Яндекса).',
      'Для фильтров каталога - либо noindex, либо отдельные SEO-страницы.',
    ],
  },
  {
    num: '3.5', title: 'Ссылки с HTTP', importance: 'средняя', complexity: 'низкая',
    codes: ['http_link'], priority: 'P2',
    description: [
      'Внутренние ссылки на сайте должны использовать HTTPS-протокол. HTTP-ссылки приводят к лишнему редиректу, теряется скорость загрузки и расходуется крауд-бюджет.',
    ],
    fix: [
      'Глобальный поиск/замена: http://домен → https://домен в шаблонах, БД и контенте.',
      'Использовать относительные ссылки /page вместо абсолютных.',
      'Включить 301-редирект HTTP → HTTPS на уровне сервера.',
    ],
  },
  {
    num: '3.6', title: 'Битые внешние ссылки', importance: 'средняя', complexity: 'низкая',
    codes: ['broken_external_link'], priority: 'P2',
    description: [
      'Ссылки на внешние сайты, которые возвращают 4xx/5xx или не существуют, ухудшают пользовательский опыт и могут сигнализировать поисковикам о низком качестве сайта.',
    ],
    fix: [
      'Найти битые внешние ссылки в списке ниже.',
      'Удалить ссылку, заменить на актуальный URL или на ссылку на архивную копию (web.archive.org).',
      'Регулярно проверять внешние ссылки автоматическим инструментом.',
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
      'Для каждого 404-URL: восстановить контент или поставить 301-редирект.',
      'Найти страницы-источники битых ссылок и заменить ссылки.',
      'Проверить меню, футер, сквозные блоки.',
      'В CMS - проверить таблицу связей контента, очистить мёртвые ссылки.',
    ],
  },
  {
    num: '3.8', title: 'Ошибки 500 (внутренняя ошибка сервера)', importance: 'высокая', complexity: 'высокая',
    codes: ['status_500'], priority: 'P1',
    description: [
      '500 Internal Server Error - общая ошибка сервера. Пользователь видит белую страницу вместо контента, поисковик исключает такие страницы из индекса.',
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
      'Атрибут alt у тега <img> описывает содержимое изображения. Используется поисковиками для понимания картинки, программами для незрячих, отображается при ошибке загрузки.',
      'Без alt теряется трафик из поиска по изображениям и страдает доступность сайта.',
    ],
    fix: [
      'Для всех <img> добавить атрибут alt с осмысленным описанием.',
      'Для декоративных изображений - alt="".',
      'В CMS сделать поле «Описание» обязательным при загрузке.',
      'Использовать ключевые слова, но без переспама.',
    ],
  },
  {
    num: '3.10', title: 'Вес изображений (оптимизация)', importance: 'средняя', complexity: 'низкая',
    codes: ['heavy_image'], priority: 'P2',
    description: [
      'Неоптимизированные изображения - частая причина медленной загрузки. PNG-фото весом 2 МБ должно быть JPEG/WebP весом 150 КБ при том же качестве.',
    ],
    fix: [
      'Конвертировать фото в WebP (или AVIF), декоративную графику в SVG.',
      'Перед загрузкой - сжимать через TinyPNG, Squoosh.',
      'Использовать responsive images (srcset, picture).',
      'Применить lazy-load для изображений ниже первого экрана.',
    ],
  },
  {
    num: '3.11', title: 'Исходящие ссылки с сайта', importance: 'низкая', complexity: 'низкая',
    codes: ['external_link'], priority: 'P3',
    description: [
      'Внешние ссылки ведут на сторонние домены. Большое количество ссылок или ссылки на некачественные ресурсы могут передавать вес и негативно влиять на ранжирование.',
    ],
    fix: [
      'Проверить релевантность внешних ссылок.',
      'Для сомнительных и партнёрских - добавить rel="nofollow noopener".',
      'Для рекламных - rel="sponsored".',
      'Для пользовательского контента - rel="ugc".',
    ],
  },
  {
    num: '3.12', title: 'Микроразметка Schema.org', importance: 'средняя', complexity: 'средняя',
    codes: ['no_schema'], priority: 'P2',
    description: [
      'Schema.org-разметка позволяет поисковикам понимать тип контента (товар, статья, организация, отзыв) и выводить расширенные сниппеты: цена, рейтинг, хлебные крошки, FAQ.',
      'Расширенные сниппеты повышают CTR на 15–30%.',
    ],
    fix: [
      'Подключить базовые типы: Organization, WebSite, BreadcrumbList на всех страницах.',
      'Для товаров - Product + Offer + AggregateRating + Review.',
      'Для статей - Article + Author + Publisher.',
      'Использовать формат JSON-LD, проверять через Schema Markup Validator.',
    ],
  },
  {
    num: '3.13', title: 'Open Graph / Twitter Cards', importance: 'низкая', complexity: 'низкая',
    codes: ['no_opengraph'], priority: 'P3',
    description: [
      'Open Graph и Twitter Cards управляют тем, как ссылка на страницу выглядит при репостах в соцсетях и мессенджерах: картинка, заголовок, описание.',
      'Без OG-разметки превью будут случайными или пустыми, что снижает CTR из соцсетей.',
    ],
    fix: [
      'Добавить в <head>: og:title, og:description, og:image (1200x630), og:url, og:type.',
      'Для Twitter: twitter:card (summary_large_image), twitter:title, twitter:image.',
      'Проверять через https://www.opengraph.xyz и Twitter Card Validator.',
    ],
  },
  {
    num: '3.14', title: 'Favicon (иконка сайта)', importance: 'низкая', complexity: 'низкая',
    codes: ['no_favicon'], priority: 'P3',
    description: [
      'Favicon - маленькая иконка сайта во вкладке браузера, закладках и в сниппете мобильной выдачи Google. Отсутствие favicon выглядит непрофессионально.',
    ],
    fix: [
      'Подготовить favicon.ico (16x16, 32x32) и PNG-версии (192x192, 512x512).',
      'Добавить в <head> link rel="icon", apple-touch-icon, манифест PWA.',
      'Положить /favicon.ico в корень сайта.',
    ],
  },
  {
    num: '3.15', title: 'Адаптивность (мобильная версия)', importance: 'высокая', complexity: 'высокая',
    codes: ['not_responsive'], priority: 'P1',
    description: [
      'С 2019 года Google применяет mobile-first indexing - ранжирует сайты по мобильной версии. Если сайт не адаптивен (мелкий текст, элементы заходят за экран, кнопки слипаются), позиции падают.',
    ],
    fix: [
      'Сверстать адаптивный шаблон через media-queries или fluid grid.',
      'Проверить через Google Mobile-Friendly Test.',
      'Размер шрифта - минимум 16 px, тач-цели - 48 px.',
      'Никаких горизонтальных скроллов.',
    ],
  },
  {
    num: '3.16', title: 'Viewport meta-тег', importance: 'высокая', complexity: 'низкая',
    codes: ['no_viewport'], priority: 'P1',
    description: [
      'Тег <meta name="viewport"> сообщает мобильному браузеру, как масштабировать страницу. Без него страница отображается в desktop-ширине и пользователю приходится её зумить.',
    ],
    fix: [
      'В <head>: <meta name="viewport" content="width=device-width, initial-scale=1">.',
      'Не использовать maximum-scale=1, user-scalable=no - это нарушает доступность.',
    ],
  },
];

const IMPORTANCE_LABEL: Record<Importance, string> = {
  'высокая': 'высокая', 'средняя': 'средняя', 'низкая': 'низкая',
};

// =====================================================================
// Стили / helpers
// =====================================================================
const COLOR_OK = '047857';
const COLOR_ERR = 'B91C1C';
const COLOR_TEXT = '111827';
const COLOR_MUTED = '6B7280';
const COLOR_ACCENT = '1F2937';
const COLOR_PRIORITY_HIGH = 'B91C1C';
const COLOR_PRIORITY_MID  = 'D97706';
const COLOR_PRIORITY_LOW  = '1F4E79';

const PRIORITY_LABEL: Record<'P1' | 'P2' | 'P3', string> = {
  P1: 'Высокий', P2: 'Средний', P3: 'Низкий',
};
const PRIORITY_COLOR: Record<'P1' | 'P2' | 'P3', string> = {
  P1: COLOR_PRIORITY_HIGH, P2: COLOR_PRIORITY_MID, P3: COLOR_PRIORITY_LOW,
};

const border = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const borders = { top: border, bottom: border, left: border, right: border };

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

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function safeName(s: string): string {
  return (s || 'site').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

// =====================================================================
// Загрузка скриншотов из public/audit-template/
// =====================================================================
type ScreenshotData = { buffer: ArrayBuffer; type: 'png' | 'jpg' };

async function loadScreenshots(): Promise<Map<string, ScreenshotData>> {
  const files = Array.from(new Set(
    CHECKS.filter(c => c.screenshot).map(c => c.screenshot!.file)
  ));
  const map = new Map<string, ScreenshotData>();
  await Promise.all(files.map(async (file) => {
    try {
      const res = await fetch(`/audit-template/${file}`);
      if (!res.ok) return;
      const buffer = await res.arrayBuffer();
      const type = file.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
      map.set(file, { buffer, type });
    } catch {
      // если картинка недоступна - просто не добавим её в документ
    }
  }));
  return map;
}

function screenshotParagraphs(file: string, caption: string, screenshots: Map<string, ScreenshotData>): Paragraph[] {
  const shot = screenshots.get(file);
  if (!shot) return [];
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 160, after: 60 },
      children: [new ImageRun({
        type: shot.type,
        data: shot.buffer,
        transformation: { width: 520, height: 300 },
        altText: { title: caption, description: caption, name: file },
      } as any)],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: caption, italics: true, size: 18, font: 'Arial', color: COLOR_MUTED })],
    }),
  ];
}

// =====================================================================
// Анализ
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
// Сборка разделов
// =====================================================================
function buildCover(domain: string, preparedBy: string, periodMonths: number): Paragraph[] {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2400, after: 600 },
      children: [new TextRun({ text: 'Технический аудит', bold: true, size: 56, font: 'Arial', color: COLOR_TEXT })],
    }),
    new Paragraph({ spacing: { after: 4800 }, children: [new TextRun({ text: '' })] }),
    ...buildCoverCardParagraphs(domain, preparedBy, periodMonths),
  ];
}

function buildCoverCardParagraphs(domain: string, preparedBy: string, periodMonths: number): Paragraph[] {
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
    p('Документ содержит 45 проверок, сгруппированных в 3 раздела. Каждый пункт включает:', { bold: true }),
    bullet('Название проверяемой ошибки.'),
    bullet('Важность - насколько проблема может влиять на результаты продвижения.'),
    bullet('Сложность внесения - насколько трудно устранить проблему.'),
    bullet('Описание проблемы - в чём заключается проблема и как она влияет на SEO.'),
    bullet('Иллюстрацию (для ключевых проверок).'),
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

function buildCheckBlock(r: CheckResult, screenshots: Map<string, ScreenshotData>): Paragraph[] {
  const { check, hasError, totalIssues, affectedUrls } = r;
  const out: Paragraph[] = [];

  const level = check.num.split('.').length;
  if (level === 2) out.push(h2(`${check.num}. ${check.title}`));
  else out.push(h3(`${check.num}. ${check.title}`));

  out.push(p(`Важность - ${IMPORTANCE_LABEL[check.importance]}`, { italic: true, bold: true, after: 60 }));
  out.push(p(`Сложность внесения - ${check.complexity}`, { italic: true, bold: true, after: 160 }));

  for (const para of check.description) out.push(p(para));

  if (check.screenshot) {
    out.push(...screenshotParagraphs(check.screenshot.file, check.screenshot.caption, screenshots));
  }

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
  const screenshots = await loadScreenshots();

  const section1 = results.filter(r => r.check.num.startsWith('1.'));
  const section2 = results.filter(r => r.check.num.startsWith('2.'));
  const section3 = results.filter(r => r.check.num.startsWith('3.'));

  const children: (Paragraph | Table)[] = [];

  children.push(...buildCover(domain, preparedBy, periodMonths));
  children.push(...buildAbout());

  // Оглавление
  children.push(h1('Оглавление'));
  const tocSections: Array<{ title: string; items: CheckResult[] }> = [
    { title: '1. Технические ошибки', items: section1 },
    { title: '2. Ссылки и контент', items: section2 },
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

  // Разделы
  children.push(h1('Технические ошибки', '1'));
  for (const r of section1) children.push(...buildCheckBlock(r, screenshots));

  children.push(h1('Ссылки и контент', '2'));
  for (const r of section2) children.push(...buildCheckBlock(r, screenshots));

  children.push(h1('Ошибки, выявленные парсером', '3'));
  for (const r of section3) children.push(...buildCheckBlock(r, screenshots));

  // Рекомендации
  children.push(h1('Рекомендации по устранению ошибок', '4'));
  if (errors.length === 0) {
    children.push(p('Ошибки на сайте не обнаружены. Технических рекомендаций нет.',
      { italic: true, color: COLOR_OK, bold: true }));
  } else {
    children.push(p('В этом разделе собрано конкретное техническое задание для разработчика - только по тем проверкам, где была обнаружена ошибка. Задачи отсортированы по приоритету.'));
    const sorted = [...errors].sort((a, b) => a.check.priority.localeCompare(b.check.priority));
    sorted.forEach((r, idx) => children.push(...buildRecommendation(r, idx + 1)));
  }

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
          size: { width: 11906, height: 16838 },
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
