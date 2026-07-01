import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  LevelFormat, Header, Footer, PageNumber, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import type { ForecastProjectData, ForecastResult, ForecastScenario } from './forecastCalculator';
import type { ParsedTraffic, ParsedSources, ParsedGsc, ParsedTopvisor, ParsedWebmasterQueries, ParsedGeneric } from './forecastParsers';

export type ForecastExtra = {
  typeLabel: string;
  fileName?: string;
  parsed: ParsedWebmasterQueries | ParsedGeneric | null;
  kind: 'wm_queries' | 'generic';
};

const NAVY = '1F3864';
const SLATE = '44546A';
const GREEN = '548235';
const GREY_DARK = '808080';
const LGREY = 'F2F2F2';
const TEXT = '1A1A1A';
const WHITE = 'FFFFFF';
const BORDER = 'BFBFBF';

const FONT = 'Arial';
const cb = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cbs = { top: cb, bottom: cb, left: cb, right: cb };

function p(text: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; align?: any; after?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120, line: 360 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color ?? TEXT, size: opts.size ?? 22, font: FONT })],
  });
}
function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: FONT })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: SLATE, font: FONT })],
  });
}
function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'sf-bullets', level: 0 },
    spacing: { after: 80, line: 340 },
    children: [new TextRun({ text, size: 22, color: TEXT, font: FONT })],
  });
}
function cell(text: string, opts: { bold?: boolean; fill?: string; color?: string; align?: any; width?: number } = {}) {
  return new TableCell({
    borders: cbs,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align,
      children: [new TextRun({ text, bold: opts.bold, color: opts.color ?? TEXT, size: 22, font: FONT })],
    })],
  });
}

function twoColRow(k: string, v: string, alt = false): TableRow {
  return new TableRow({
    children: [
      cell(k, { bold: true, fill: alt ? LGREY : WHITE, width: 3400 }),
      cell(v, { fill: alt ? LGREY : WHITE, width: 5960 }),
    ],
  });
}

function tableWithHeader(headers: string[], rows: string[][], widths?: number[]): Table {
  const totalW = 9360;
  const cw = widths ?? headers.map(() => Math.floor(totalW / headers.length));
  return new Table({
    width: { size: totalW, type: WidthType.DXA },
    columnWidths: cw,
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map((h, i) => cell(h, { bold: true, fill: NAVY, color: WHITE, align: AlignmentType.CENTER, width: cw[i] })),
      }),
      ...rows.map((r, ri) =>
        new TableRow({
          children: r.map((c, i) => cell(c, { fill: ri % 2 === 0 ? LGREY : WHITE, align: i === 0 ? undefined : AlignmentType.RIGHT, width: cw[i] })),
        }),
      ),
    ],
  });
}

const STATUS_LABEL: Record<string, string> = {
  young: 'Молодой сайт (0–6 мес.)',
  growing: 'Развивающийся (6–18 мес.)',
  mature: 'Зрелый сайт (18+ мес.)',
};

const WORK_LABEL: Record<string, string> = {
  blog: 'Блог/контент',
  cards: 'Карточки товаров/объектов',
  links: 'Закупка ссылок',
  crowd: 'Крауд-маркетинг',
  external: 'Публикации на внешних площадках',
  tech: 'Техническое SEO',
};

function scenarioTable(sc: ForecastScenario, labels: string[], engines: ForecastProjectData['engines']): Table {
  const headerFill = sc.name === 'conservative' ? GREY_DARK : sc.name === 'base' ? NAVY : GREEN;
  const headers = ['Показатель', ...labels];
  const cw = [2400, ...labels.map(() => Math.floor(6960 / labels.length))];
  const rows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headers.map((h, i) => cell(h, { bold: true, fill: headerFill, color: WHITE, align: i === 0 ? undefined : AlignmentType.CENTER, width: cw[i] })),
    }),
  ];
  const add = (label: string, key: keyof ForecastScenario['months'][number], ri: number) => {
    const values = sc.months.map((m) => String(m[key] ?? 0));
    rows.push(new TableRow({
      children: [
        cell(label, { bold: true, fill: ri % 2 === 0 ? LGREY : WHITE, width: cw[0] }),
        ...values.map((v, i) => cell(v, { fill: ri % 2 === 0 ? LGREY : WHITE, align: AlignmentType.RIGHT, width: cw[i + 1] })),
      ],
    }));
  };
  let ri = 0;
  if (engines.yandex) { add('Яндекс визитов/мес.', 'yandex', ri++); }
  if (engines.google) { add('Google визитов/мес.', 'google', ri++); }
  if (engines.bing) { add('Bing визитов/мес.', 'bing', ri++); }
  add('Итого органика', 'total', ri++);
  if (sc.months[0].newTop10 != null) add('Новых запросов в топ-10', 'newTop10', ri++);
  if (sc.months[0].gscClicks != null) add('Клики GSC/мес.', 'gscClicks', ri++);

  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: cw, rows });
}

export async function exportSeoForecastDocx(
  project: ForecastProjectData,
  files: {
    traffic?: ParsedTraffic | null;
    sources?: ParsedSources | null;
    gsc?: ParsedGsc | null;
    topvisor?: ParsedTopvisor | null;
    extras?: ForecastExtra[];
  },
  forecast: ForecastResult,
) {
  const dateStr = new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
  const enginesList = [
    project.engines.yandex && 'Яндекс',
    project.engines.google && 'Google',
    project.engines.bing && 'Bing',
  ].filter(Boolean).join(', ');
  const worksList = (Object.keys(project.works) as Array<keyof ForecastProjectData['works']>)
    .filter((k) => project.works[k]).map((k) => WORK_LABEL[k]).join(', ') || '—';

  const children: any[] = [];

  // Title
  children.push(
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: 'SEO-прогноз по проекту', bold: true, size: 40, color: NAVY, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [new TextRun({ text: `${project.domain} / ${project.clientName}`, bold: true, size: 28, color: SLATE, font: FONT })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 320 }, children: [new TextRun({ text: `${project.topic} · ${project.region} · Прогноз на ${project.horizon} мес. · ${dateStr}`, size: 22, color: SLATE, font: FONT })] }),
  );

  // 1. Исходные данные
  children.push(h1('1. Исходные данные проекта'));
  const dataTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3400, 5960],
    rows: [
      twoColRow('Домен', project.domain, false),
      twoColRow('Клиент', project.clientName, true),
      twoColRow('Тематика', project.topic, false),
      twoColRow('Регион', project.region, true),
      twoColRow('Статус сайта', STATUS_LABEL[project.siteStatus], false),
      twoColRow('Поисковые системы', enginesList || '—', true),
      twoColRow('Планируемые работы', worksList, false),
      twoColRow('Горизонт прогноза', `${project.horizon} мес.`, true),
      ...(project.publishPace ? [twoColRow('Темп публикаций', `${project.publishPace} статей/мес.`, false)] : []),
      ...(project.context ? [twoColRow('Контекст', project.context, project.publishPace ? true : false)] : []),
    ],
  });
  children.push(dataTable);

  let sectionNum = 2;

  // Traffic
  if (files.traffic && files.traffic.rows.length) {
    children.push(h1(`${sectionNum++}. Динамика органического трафика (факт)`));
    children.push(p(files.traffic.summary));
    const rows = files.traffic.rows.slice(-12).map((r) => [r.period, String(r.yandex), String(r.google), String(r.bing), String(r.total)]);
    children.push(tableWithHeader(['Период', 'Яндекс', 'Google', 'Bing', 'Итого'], rows, [2400, 1740, 1740, 1740, 1740]));
  }

  // GSC
  if (files.gsc && files.gsc.impressions > 0) {
    children.push(h1(`${sectionNum++}. Данные Google Search Console`));
    children.push(p(files.gsc.summary));
    const buckets = files.gsc.buckets;
    children.push(tableWithHeader(['Показатель', 'Значение', 'Комментарий'], [
      ['Показы', String(files.gsc.impressions), 'Суммарно за период выгрузки'],
      ['Клики', String(files.gsc.clicks), '—'],
      ['CTR', `${files.gsc.ctr.toFixed(2)}%`, 'Средний по проекту'],
      ['Средняя позиция', files.gsc.position.toFixed(1), '—'],
      ['Показы: топ-1', String(buckets.top1), 'Готовые к росту CTR'],
      ['Показы: топ 2–3', String(buckets.top2_3), 'Ближайший потенциал в топ-1'],
      ['Показы: топ 4–10', String(buckets.top4_10), 'Потенциал доведения до топ-3'],
      ['Показы: топ 11–50', String(buckets.top11_50), 'Требует контентной/ссылочной работы'],
    ], [3200, 2400, 3760]));
  }

  // Sources
  if (files.sources && files.sources.rows.length) {
    children.push(h1(`${sectionNum++}. Структура трафика по источникам`));
    children.push(p(files.sources.summary));
    const total = files.sources.totalVisits || 1;
    const rows = files.sources.rows.slice(0, 15).map((r) => [
      r.source,
      String(r.visits),
      `${((r.visits / total) * 100).toFixed(1)}%`,
      /орган/i.test(r.source) ? 'Органический трафик' : /direct|прям/i.test(r.source) ? 'Прямые заходы' : '',
    ]);
    children.push(tableWithHeader(['Источник', 'Визиты', 'Доля', 'Комментарий'], rows, [3200, 1700, 1500, 2960]));
  }

  // Topvisor
  if (files.topvisor && files.topvisor.total > 0) {
    children.push(h1(`${sectionNum++}. Текущие позиции`));
    children.push(p(files.topvisor.summary));
    children.push(tableWithHeader(['Метрика', 'Значение'], [
      ['Всего запросов', String(files.topvisor.total)],
      ['В топ-10', String(files.topvisor.top10)],
      ['В топ-100', String(files.topvisor.top100)],
      ['Вне топ-100', String(files.topvisor.outside)],
    ], [5000, 4360]));
  }

  // Forecast
  children.push(h1(`${sectionNum++}. Прогноз на ${project.horizon} мес. — сводные сценарии`));
  children.push(p(`Прогноз рассчитан от базового уровня трафика (${forecast.baseTraffic.total} визитов/мес. — среднее за 2 последних периода). Дата среза: ${dateStr}. Учитывается статус сайта, набор работ и данные загруженных источников.`));

  children.push(h2('Консервативный сценарий'));
  children.push(scenarioTable(forecast.scenarios.conservative, forecast.monthLabels, project.engines));
  children.push(h2('Базовый сценарий'));
  children.push(scenarioTable(forecast.scenarios.base, forecast.monthLabels, project.engines));
  children.push(h2('Оптимистичный сценарий'));
  children.push(scenarioTable(forecast.scenarios.optimistic, forecast.monthLabels, project.engines));

  // Points
  children.push(h1(`${sectionNum++}. Точки роста`));
  const points = forecast.growthPoints.length ? forecast.growthPoints : ['Данных для формулировки точек роста недостаточно. Загрузите GSC и/или Topvisor для более точных выводов.'];
  points.forEach((pt) => children.push(bullet(pt)));

  // Limits
  children.push(h1(`${sectionNum++}. Ограничения прогноза`));
  [
    'Прогноз статистический и опирается на среднеотраслевые темпы роста для указанного статуса сайта.',
    'Не учитывает алгоритмические апдейты (Core Update, антиспам), санкции и деиндексацию.',
    'Не учитывает сезонность ниши и всплески/спад спроса.',
    'Точность выше, если загружены минимум 3 источника данных (Метрика, GSC, Topvisor).',
    'Оптимистичный сценарий достижим только при полной реализации всех отмеченных работ в срок.',
  ].forEach((t) => children.push(bullet(t)));

  // Summary
  children.push(h1(`${sectionNum++}. Резюме`));
  const last = forecast.scenarios.base.months[forecast.scenarios.base.months.length - 1];
  const lastCons = forecast.scenarios.conservative.months[forecast.scenarios.conservative.months.length - 1];
  const lastOpt = forecast.scenarios.optimistic.months[forecast.scenarios.optimistic.months.length - 1];
  const growthX = forecast.baseTraffic.total ? (last.total / forecast.baseTraffic.total).toFixed(1) : '—';
  children.push(p(
    `К ${forecast.monthLabels[forecast.monthLabels.length - 1]} органический трафик по базовому сценарию составит ~${last.total} визитов/мес. `
    + `(диапазон ${lastCons.total}–${lastOpt.total}) — рост в ${growthX} раза к текущему уровню (${forecast.baseTraffic.total} визитов/мес.).`,
  ));

  const doc = new Document({
    creator: 'Системное SEO',
    numbering: {
      config: [{
        reference: 'sf-bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    styles: {
      default: { document: { run: { font: FONT, size: 22 } } },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            tabStops: [{ type: 'right' as any, position: 9000 }],
            children: [
              new TextRun({ text: 'Системное SEO', bold: true, color: NAVY, size: 20, font: FONT }),
              new TextRun({ text: `\t${project.domain} — SEO-прогноз`, color: SLATE, size: 20, font: FONT }),
            ],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ children: [PageNumber.CURRENT], color: SLATE, size: 20, font: FONT })],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = project.domain.replace(/[^\w.-]+/g, '_');
  saveAs(blob, `seo-forecast_${safe}_${project.horizon}m.docx`);
}