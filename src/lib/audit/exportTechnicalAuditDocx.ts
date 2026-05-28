import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, PageBreak,
  Header, Footer, PageNumber,
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
}

// ---- Каталог проверок: человеческое название + объяснение клиенту + ТЗ разработчику ----
type CheckMeta = {
  label: string;
  client: string;     // что это значит для бизнеса
  fix: string;        // что именно делать программисту
  severity: 'critical' | 'warning' | 'info';
};

const CHECKS: Record<string, CheckMeta> = {
  no_https: {
    label: 'Сайт не использует HTTPS',
    client: 'Сайт открывается по небезопасному протоколу HTTP. Браузеры показывают предупреждение «Не защищено», поисковые системы понижают такой сайт в выдаче.',
    fix: 'Установить и настроить SSL-сертификат (Let\'s Encrypt бесплатно). Настроить 301-редирект со всех HTTP-URL на HTTPS на уровне веб-сервера. Обновить абсолютные ссылки и атрибут <base> в шаблонах. Включить HSTS-заголовок: Strict-Transport-Security: max-age=31536000; includeSubDomains.',
    severity: 'critical',
  },
  no_robots_txt: {
    label: 'Отсутствует файл robots.txt',
    client: 'Поисковые роботы не получают инструкций, какие разделы сайта индексировать. Это снижает контроль над тем, что попадает в поиск.',
    fix: 'Создать /robots.txt в корне домена. Указать User-agent: *, разрешённые/запрещённые разделы, ссылку на Sitemap. Минимальный пример: User-agent: *\\nAllow: /\\nSitemap: https://домен/sitemap.xml',
    severity: 'warning',
  },
  robots_blocks_all: {
    label: 'robots.txt блокирует весь сайт',
    client: 'Текущие настройки запрещают поисковикам индексировать сайт целиком. Сайт исчезнет из выдачи.',
    fix: 'Удалить директиву Disallow: / из robots.txt. Проверить, что нет глобальных запретов для User-agent: *. После правки запросить переобход в Google Search Console и Яндекс.Вебмастер.',
    severity: 'critical',
  },
  no_sitemap: {
    label: 'Отсутствует файл sitemap.xml',
    client: 'Поисковые роботы вынуждены искать страницы сами. Новые материалы попадают в индекс медленнее.',
    fix: 'Сгенерировать sitemap.xml (динамически или через CMS-плагин). Добавить ссылку в robots.txt: Sitemap: https://домен/sitemap.xml. Загрузить карту в Google Search Console и Яндекс.Вебмастер.',
    severity: 'warning',
  },
  slow_ttfb: {
    label: 'Медленный ответ сервера (TTFB > 3 сек)',
    client: 'Страница долго «думает», прежде чем начать загружаться. Пользователи уходят, поведенческие факторы падают.',
    fix: 'Профилировать запросы (APM, slow query log). Включить серверное кэширование (Redis/Memcached, OPcache). Оптимизировать тяжёлые SQL-запросы (индексы, EXPLAIN). Подключить CDN. Перейти на быстрый хостинг при необходимости.',
    severity: 'critical',
  },
  noindex_meta: {
    label: 'Страница закрыта от индексации (noindex)',
    client: 'Страница помечена тегом, который запрещает её показ в поисковой выдаче. Если это коммерческая страница — потеря трафика.',
    fix: 'Удалить из <head>: <meta name="robots" content="noindex">. Убедиться, что заголовок X-Robots-Tag: noindex не приходит из CMS/CDN. Проверить, что страница должна индексироваться.',
    severity: 'critical',
  },
  status_404: {
    label: 'Страницы возвращают 404 (не найдено)',
    client: 'Ссылки ведут в никуда. Пользователи и поисковики получают пустую страницу.',
    fix: 'Для каждого 404-URL: либо настроить 301-редирект на актуальную страницу, либо восстановить контент. Найти источник битых ссылок (внутренние ссылки в шаблонах, меню, контент) и поправить. Проверить корректность .htaccess / nginx rewrite-правил.',
    severity: 'critical',
  },
  status_500: {
    label: 'Страницы возвращают 500 (ошибка сервера)',
    client: 'Сервер падает на этих страницах — пользователи видят техническую ошибку вместо контента.',
    fix: 'Открыть error_log веб-сервера и application-логи. Воспроизвести запрос, поймать stacktrace. Проверить подключение к БД, права на файлы, превышение лимитов памяти/времени выполнения.',
    severity: 'critical',
  },
  mixed_content: {
    label: 'Mixed content (HTTP-ресурсы на HTTPS-странице)',
    client: 'На защищённой странице загружаются файлы (картинки, скрипты) по небезопасному протоколу. Браузер блокирует часть контента, замок безопасности пропадает.',
    fix: 'Найти HTTP-ссылки на ресурсы (img/src, link/href, script/src, url() в CSS). Заменить http:// на https:// или относительные //. Добавить CSP-заголовок: upgrade-insecure-requests.',
    severity: 'warning',
  },
  broken_link: {
    label: 'Битые внутренние ссылки',
    client: 'Ссылки внутри сайта ведут на несуществующие страницы. Это раздражает пользователей и снижает доверие поисковика.',
    fix: 'По списку битых URL найти страницы-источники и заменить ссылки на актуальные либо удалить. В CMS — проверить таблицу связей контента.',
    severity: 'critical',
  },
  http_link: {
    label: 'Ссылки с HTTP на HTTPS-сайте',
    client: 'Внутренние ссылки используют небезопасный протокол. Браузер делает лишний редирект, теряется скорость.',
    fix: 'Глобальный поиск/замена http://домен на https://домен в шаблонах, БД, контенте. Включить редирект на уровне сервера.',
    severity: 'warning',
  },
  external_link: {
    label: 'Исходящие внешние ссылки',
    client: 'Информационный список ссылок на сторонние сайты для контроля.',
    fix: 'Проверить релевантность ссылок. Для сомнительных — добавить rel="nofollow noopener". Для рекламных — rel="sponsored".',
    severity: 'info',
  },
  missing_h1: {
    label: 'Страницы без H1',
    client: 'У страницы нет главного заголовка — поисковику сложнее понять, о чём она.',
    fix: 'В шаблоне страницы добавить уникальный <h1> с ключевым запросом. Один H1 на страницу.',
    severity: 'critical',
  },
  duplicate_h1: {
    label: 'Дубли страниц по H1',
    client: 'Несколько страниц имеют одинаковый заголовок — поисковик не понимает, какую показывать в выдаче.',
    fix: 'Сделать H1 уникальным для каждой страницы. Использовать паттерны вида «{Категория} — {Подкатегория}» или включать в заголовок отличающийся параметр.',
    severity: 'warning',
  },
  missing_title: {
    label: 'Страницы без тега title',
    client: 'Нет текста, который показывается в выдаче и во вкладке браузера. Кликабельность падает резко.',
    fix: 'Добавить <title> в <head> каждой страницы. Длина 50–60 символов, главный ключевой запрос в начале, бренд в конце.',
    severity: 'critical',
  },
  duplicate_title: {
    label: 'Дубли страниц по title',
    client: 'Одинаковые заголовки в выдаче — поисковик не различает страницы и может скрыть часть из них.',
    fix: 'Шаблонизировать title: подставлять уникальные параметры (название товара, города, артикула). Проверить settings CMS на автогенерацию title.',
    severity: 'warning',
  },
  missing_description: {
    label: 'Страницы без meta description',
    client: 'Под заголовком в выдаче нет описания — снижается CTR.',
    fix: 'Добавить <meta name="description" content="..."> длиной 140–160 символов с УТП и призывом к действию.',
    severity: 'warning',
  },
  missing_alt: {
    label: 'Изображения без атрибута alt',
    client: 'Поисковики не понимают, что на картинках. Теряется трафик из поиска по изображениям, страдает доступность для незрячих.',
    fix: 'Для всех <img> добавить alt с описанием содержимого. Для декоративных — alt="". В CMS — обязательное поле «Описание» при загрузке.',
    severity: 'warning',
  },
  ssl_expiring_soon: {
    label: 'SSL-сертификат истекает менее чем через 30 дней',
    client: 'Сертификат скоро перестанет действовать. После истечения сайт станет недоступен с ошибкой безопасности.',
    fix: 'Продлить SSL-сертификат у регистратора. Настроить автопродление (certbot renew + cron). Добавить мониторинг срока действия.',
    severity: 'warning',
  },
  no_hsts: {
    label: 'Не настроен HSTS-заголовок',
    client: 'Браузер каждый раз разрешает первое подключение по HTTP, что создаёт окно для атаки.',
    fix: 'В конфигурации веб-сервера добавить заголовок: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload',
    severity: 'warning',
  },
};

function metaFor(code: string, severity?: string | null): CheckMeta {
  return CHECKS[code] ?? {
    label: code,
    client: 'Техническая проблема, требующая проверки.',
    fix: 'Изучить детали в данных аудита и устранить.',
    severity: (severity as any) || 'info',
  };
}

const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
const SEV_RU: Record<string, string> = { critical: 'Критично', warning: 'Предупреждение', info: 'Информация' };
const SEV_FILL: Record<string, string> = { critical: 'FEE2E2', warning: 'FEF3C7', info: 'DBEAFE' };
const SEV_TEXT: Record<string, string> = { critical: '991B1B', warning: '92400E', info: '1E40AF' };

// ----- helpers -----
const border = { style: BorderStyle.SINGLE, size: 1, color: 'D1D5DB' };
const borders = { top: border, bottom: border, left: border, right: border };
const CONTENT_W = 9360;

function cell(text: string | TextRun[], width: number, opts: { bold?: boolean; fill?: string; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}): TableCell {
  const runs = typeof text === 'string'
    ? [new TextRun({ text: text || '-', bold: opts.bold, color: opts.color, size: 20, font: 'Arial' })]
    : text;
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 100, bottom: 100, left: 140, right: 140 },
    children: [new Paragraph({ alignment: opts.align, children: runs })],
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 180 },
    children: [new TextRun({ text, bold: true, size: 36, font: 'Arial', color: '111827' })],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Arial', color: '1F2937' })],
  });
}

function h3(text: string, color = '111827'): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Arial', color })],
  });
}

function p(text: string, opts: { bold?: boolean; color?: string; italics?: boolean; size?: number } = {}): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size ?? 22, font: 'Arial' })],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Arial' })],
  });
}

function spacer(): Paragraph {
  return new Paragraph({ children: [new TextRun({ text: '' })] });
}

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
}

function safeName(s: string): string {
  return (s || 'site').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

function scoreLabel(score: number): { text: string; color: string } {
  if (score >= 80) return { text: 'Хорошо', color: '047857' };
  if (score >= 50) return { text: 'Требует улучшений', color: 'B45309' };
  return { text: 'Плохо', color: 'B91C1C' };
}

// группировка issues по code
function groupIssues(issues: CrawlIssue[]) {
  const byCode = new Map<string, { urls: Set<string>; total: number; severity: string }>();
  for (const i of issues) {
    const code = i.code || 'unknown';
    let g = byCode.get(code);
    if (!g) { g = { urls: new Set(), total: 0, severity: i.severity || 'info' }; byCode.set(code, g); }
    g.total += 1;
    const url = i.page_url || (i.details && (i.details.url || i.details.page_url)) || null;
    if (url) g.urls.add(url);
    if ((SEV_ORDER[i.severity || 'info'] ?? 9) < (SEV_ORDER[g.severity] ?? 9)) g.severity = i.severity!;
  }
  return Array.from(byCode.entries())
    .map(([code, g]) => ({ code, ...g, urls: Array.from(g.urls) }))
    .sort((a, b) => (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9) || b.total - a.total);
}

// ----- основной экспорт -----
export async function downloadTechnicalAuditDocx(input: TechnicalAuditExportInput): Promise<void> {
  const { domain, stats, issues } = input;
  const grouped = groupIssues(issues || []);
  const totalPages = stats?.total_pages ?? 0;
  const score = stats?.score ?? 0;
  const scoreInfo = scoreLabel(score);

  // ---------- Титульник ----------
  const cover: Paragraph[] = [
    new Paragraph({ spacing: { before: 1800, after: 240 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'ТЕХНИЧЕСКИЙ SEO-АУДИТ', bold: true, size: 48, font: 'Arial', color: '111827' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
      children: [new TextRun({ text: domain, size: 32, font: 'Arial', color: '3B82F6', bold: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 1200 },
      children: [new TextRun({ text: fmtDate(), size: 22, font: 'Arial', color: '6B7280' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
      children: [new TextRun({ text: `Оценка: ${score}/100 — ${scoreInfo.text}`, bold: true, size: 28, font: 'Arial', color: scoreInfo.color })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Просканировано страниц: ${totalPages}`, size: 22, font: 'Arial', color: '4B5563' })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];

  // ---------- Часть 1: для клиента ----------
  const clientPart: (Paragraph | Table)[] = [
    h1('Часть 1. Отчёт для клиента'),
    p('Этот раздел описывает результаты аудита простым языком — без технических терминов. Здесь видно, насколько сайт здоров с точки зрения поисковой оптимизации и какие проблемы требуют внимания.'),

    h2('Сводка'),
    new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [3120, 3120, 3120],
      rows: [
        new TableRow({ tableHeader: true, children: [
          cell('Страниц проверено', 3120, { bold: true, fill: 'F3F4F6' }),
          cell('Найдено проблем', 3120, { bold: true, fill: 'F3F4F6' }),
          cell('Средний ответ сервера', 3120, { bold: true, fill: 'F3F4F6' }),
        ]}),
        new TableRow({ children: [
          cell(String(totalPages), 3120, { align: AlignmentType.CENTER }),
          cell(String(stats?.total_issues ?? issues.length), 3120, { align: AlignmentType.CENTER }),
          cell(`${stats?.avg_load_time_ms ?? 0} мс`, 3120, { align: AlignmentType.CENTER }),
        ]}),
        new TableRow({ tableHeader: true, children: [
          cell('Критических', 3120, { bold: true, fill: 'FEE2E2', color: '991B1B' }),
          cell('Предупреждений', 3120, { bold: true, fill: 'FEF3C7', color: '92400E' }),
          cell('Информационных', 3120, { bold: true, fill: 'DBEAFE', color: '1E40AF' }),
        ]}),
        new TableRow({ children: [
          cell(String(stats?.critical_count ?? 0), 3120, { align: AlignmentType.CENTER, bold: true }),
          cell(String(stats?.warning_count ?? 0), 3120, { align: AlignmentType.CENTER, bold: true }),
          cell(String(stats?.info_count ?? 0), 3120, { align: AlignmentType.CENTER, bold: true }),
        ]}),
      ],
    }),
    spacer(),

    h2('Что означает каждая категория'),
    bullet('Критические проблемы — мешают сайту попадать в поиск или работать корректно. Решать в первую очередь.'),
    bullet('Предупреждения — не блокируют работу, но снижают позиции и удобство. Решать после критических.'),
    bullet('Информационные — не требуют срочных действий, оставлены для контроля.'),

    h2('Список найденных проблем (для клиента)'),
  ];

  if (grouped.length === 0) {
    clientPart.push(p('Серьёзных проблем не обнаружено. Сайт прошёл проверку.', { italics: true, color: '047857' }));
  } else {
    // компактная таблица для клиента
    const clientRows: TableRow[] = [
      new TableRow({ tableHeader: true, children: [
        cell('Проблема', 5400, { bold: true, fill: 'F3F4F6' }),
        cell('Важность', 1800, { bold: true, fill: 'F3F4F6', align: AlignmentType.CENTER }),
        cell('Стр.', 2160, { bold: true, fill: 'F3F4F6', align: AlignmentType.CENTER }),
      ]}),
    ];
    for (const g of grouped) {
      const m = metaFor(g.code, g.severity);
      clientRows.push(new TableRow({ children: [
        cell(m.label, 5400),
        cell(SEV_RU[g.severity] || g.severity, 1800, {
          align: AlignmentType.CENTER, bold: true,
          fill: SEV_FILL[g.severity], color: SEV_TEXT[g.severity],
        }),
        cell(String(g.urls.length || g.total), 2160, { align: AlignmentType.CENTER }),
      ]}));
    }
    clientPart.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [5400, 1800, 2160],
      rows: clientRows,
    }));

    clientPart.push(spacer());
    clientPart.push(h2('Краткие пояснения к проблемам'));
    for (const g of grouped) {
      const m = metaFor(g.code, g.severity);
      clientPart.push(h3(`${m.label}`, SEV_TEXT[g.severity]));
      clientPart.push(p(m.client));
      clientPart.push(p(`Затронуто страниц: ${g.urls.length || g.total}`, { italics: true, color: '6B7280', size: 20 }));
    }
  }

  clientPart.push(new Paragraph({ children: [new PageBreak()] }));

  // ---------- Часть 2: ТЗ для разработчика ----------
  const devPart: (Paragraph | Table)[] = [
    h1('Часть 2. Техническое задание для разработчика'),
    p('Раздел оформлен как чек-лист: по каждой проблеме — приоритет, что делать, где править и список конкретных URL. Двигаться сверху вниз (от критических к информационным).'),

    h2('Приоритеты'),
    bullet('P1 — Критические. Блокируют индексацию или работу сайта. Сделать в течение 1–3 дней.'),
    bullet('P2 — Предупреждения. Влияют на SEO и UX. Сделать в течение 1–2 недель.'),
    bullet('P3 — Информационные. Можно включить в плановые работы.'),

    h2('Сводный план задач'),
  ];

  if (grouped.length === 0) {
    devPart.push(p('Замечаний к технической части нет.', { italics: true, color: '047857' }));
  } else {
    const planRows: TableRow[] = [
      new TableRow({ tableHeader: true, children: [
        cell('№', 540, { bold: true, fill: 'F3F4F6', align: AlignmentType.CENTER }),
        cell('Приоритет', 1260, { bold: true, fill: 'F3F4F6', align: AlignmentType.CENTER }),
        cell('Задача', 5760, { bold: true, fill: 'F3F4F6' }),
        cell('URL', 1800, { bold: true, fill: 'F3F4F6', align: AlignmentType.CENTER }),
      ]}),
    ];
    grouped.forEach((g, idx) => {
      const m = metaFor(g.code, g.severity);
      const prio = g.severity === 'critical' ? 'P1' : g.severity === 'warning' ? 'P2' : 'P3';
      planRows.push(new TableRow({ children: [
        cell(String(idx + 1), 540, { align: AlignmentType.CENTER }),
        cell(prio, 1260, { align: AlignmentType.CENTER, bold: true,
          fill: SEV_FILL[g.severity], color: SEV_TEXT[g.severity] }),
        cell(m.label, 5760),
        cell(String(g.urls.length || g.total), 1800, { align: AlignmentType.CENTER }),
      ]}));
    });
    devPart.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [540, 1260, 5760, 1800],
      rows: planRows,
    }));

    devPart.push(new Paragraph({ children: [new PageBreak()] }));
    devPart.push(h2('Детальные задачи'));

    grouped.forEach((g, idx) => {
      const m = metaFor(g.code, g.severity);
      const prio = g.severity === 'critical' ? 'P1' : g.severity === 'warning' ? 'P2' : 'P3';

      devPart.push(h3(`${idx + 1}. [${prio}] ${m.label}`, SEV_TEXT[g.severity]));

      devPart.push(new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [2400, 6960],
        rows: [
          new TableRow({ children: [
            cell('Код проверки', 2400, { bold: true, fill: 'F9FAFB' }),
            cell(g.code, 6960),
          ]}),
          new TableRow({ children: [
            cell('Приоритет', 2400, { bold: true, fill: 'F9FAFB' }),
            cell(`${prio} (${SEV_RU[g.severity]})`, 6960,
              { fill: SEV_FILL[g.severity], color: SEV_TEXT[g.severity], bold: true }),
          ]}),
          new TableRow({ children: [
            cell('Затронуто страниц', 2400, { bold: true, fill: 'F9FAFB' }),
            cell(String(g.urls.length || g.total), 6960),
          ]}),
          new TableRow({ children: [
            cell('Суть проблемы', 2400, { bold: true, fill: 'F9FAFB' }),
            cell(m.client, 6960),
          ]}),
          new TableRow({ children: [
            cell('Что сделать', 2400, { bold: true, fill: 'F9FAFB' }),
            cell(m.fix, 6960),
          ]}),
        ],
      }));

      if (g.urls.length > 0) {
        devPart.push(p('URL-адреса для исправления:', { bold: true, size: 20 }));
        const shown = g.urls.slice(0, 50);
        for (const u of shown) {
          devPart.push(new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: `• ${u}`, size: 18, font: 'Consolas', color: '1F2937' })],
          }));
        }
        if (g.urls.length > shown.length) {
          devPart.push(p(`…и ещё ${g.urls.length - shown.length} URL — полный список в исходных данных аудита.`,
            { italics: true, color: '6B7280', size: 18 }));
        }
      }
      devPart.push(spacer());
    });
  }

  // ---------- Документ ----------
  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `Технический SEO-аудит — ${domain}`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial', color: '111827' },
          paragraph: { spacing: { before: 240, after: 180 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: '1F2937' },
          paragraph: { spacing: { before: 220, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 22, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 180, after: 100 }, outlineLevel: 2 } },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 }, // A4
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // ~2 см
        },
      },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Технический SEO-аудит • ${domain}`, size: 18, color: '9CA3AF', font: 'Arial' })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Стр. ', size: 18, color: '9CA3AF', font: 'Arial' }),
                     new TextRun({ children: [PageNumber.CURRENT], size: 18, color: '9CA3AF', font: 'Arial' })] })] }),
      },
      children: [...cover, ...clientPart, ...devPart],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Tech-Audit_${safeName(domain)}_${new Date().toISOString().slice(0, 10)}.docx`;
  saveAs(blob, filename);
}