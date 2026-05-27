import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, LevelFormat, PageBreak,
} from 'docx';
import { saveAs } from 'file-saver';

export interface DocxCheckItem {
  id: string;
  label: string;
  criteria: string;
  tools: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}
export interface DocxStage {
  id: string;
  title: string;
  subtitle: string;
  score: number;
  items: DocxCheckItem[];
}
export interface DocxGeoAudit {
  url: string;
  geoScore: number;
  stages: DocxStage[];
  criticals: string[];
  strategy: string[];
}

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const fmtFile = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const COLOR_ACCENT = '2E75B6';
const COLOR_TEXT = '1F2937';
const COLOR_MUTED = '6B7280';
const COLOR_PASS = '047857';
const COLOR_WARN = 'B45309';
const COLOR_FAIL = 'B91C1C';
const COLOR_BORDER = 'D1D5DB';
const COLOR_HEAD_BG = 'EEF2F7';

const statusLabel = (s: string) => s === 'pass' ? 'OK' : s === 'warn' ? 'Внимание' : 'Ошибка';
const statusColor = (s: string) => s === 'pass' ? COLOR_PASS : s === 'warn' ? COLOR_WARN : COLOR_FAIL;
const scoreColor = (n: number) => n >= 80 ? COLOR_PASS : n >= 60 ? COLOR_WARN : COLOR_FAIL;
const scoreVerdict = (n: number) =>
  n >= 85 ? 'Отлично - сайт хорошо оптимизирован для AI-поисковиков.' :
  n >= 70 ? 'Хорошо - есть точки роста, но фундамент крепкий.' :
  n >= 50 ? 'Удовлетворительно - требуется системная доработка.' :
  'Критично - без срочных правок сайт почти невидим для AI.';

const border = (color: string) => ({ style: BorderStyle.SINGLE, size: 4, color });
const cellBorders = {
  top: border(COLOR_BORDER), bottom: border(COLOR_BORDER),
  left: border(COLOR_BORDER), right: border(COLOR_BORDER),
};
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

const p = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean; align?: any } = {}) =>
  new Paragraph({
    alignment: opts.align,
    children: [new TextRun({
      text, bold: opts.bold, italics: opts.italics,
      size: opts.size ?? 22, color: opts.color ?? COLOR_TEXT, font: 'Arial',
    })],
  });

const h = (text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel], color = COLOR_TEXT) =>
  new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color, font: 'Arial' })],
  });

const cellTxt = (text: string, opts: { bold?: boolean; color?: string; size?: number; bg?: string; align?: any } = {}) =>
  new TableCell({
    borders: cellBorders,
    margins: cellMargins,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: [new Paragraph({
      alignment: opts.align,
      children: [new TextRun({
        text, bold: opts.bold, size: opts.size ?? 20,
        color: opts.color ?? COLOR_TEXT, font: 'Arial',
      })],
    })],
  });

const cellMulti = (paragraphs: Paragraph[], opts: { bg?: string; width?: number } = {}) =>
  new TableCell({
    borders: cellBorders, margins: cellMargins,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children: paragraphs,
  });

function buildHeader(domain: string, date: string) {
  return new Header({
    children: [new Paragraph({
      tabStops: [{ type: 'right' as any, position: 9000 }],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLOR_ACCENT, space: 4 } },
      children: [
        new TextRun({ text: `GEO Audit - ${domain}`, bold: true, size: 20, color: COLOR_ACCENT, font: 'Arial' }),
        new TextRun({ text: `\t${date}`, size: 20, color: COLOR_MUTED, font: 'Arial' }),
      ],
    })],
  });
}

function buildFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({ text: 'Страница ', size: 18, color: COLOR_MUTED, font: 'Arial' }),
        new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR_MUTED, font: 'Arial' }),
        new TextRun({ text: ' из ', size: 18, color: COLOR_MUTED, font: 'Arial' }),
        new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR_MUTED, font: 'Arial' }),
      ],
    })],
  });
}

function buildCover(audit: DocxGeoAudit, domain: string, date: string): Paragraph[] {
  const passCount = audit.stages.flatMap(s => s.items).filter(i => i.status === 'pass').length;
  const warnCount = audit.stages.flatMap(s => s.items).filter(i => i.status === 'warn').length;
  const failCount = audit.stages.flatMap(s => s.items).filter(i => i.status === 'fail').length;
  const total = passCount + warnCount + failCount;

  return [
    new Paragraph({ spacing: { before: 2400 }, children: [] }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: 'GEO AUDIT', bold: true, size: 56, color: COLOR_ACCENT, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 480 },
      children: [new TextRun({ text: 'Аудит готовности к AI-поиску', size: 28, color: COLOR_MUTED, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: domain, bold: true, size: 36, color: COLOR_TEXT, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 720 },
      children: [new TextRun({ text: audit.url, size: 20, color: COLOR_MUTED, italics: true, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `${audit.geoScore} / 100`, bold: true, size: 96, color: scoreColor(audit.geoScore), font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { after: 720 },
      children: [new TextRun({ text: 'Общий GEO Score', size: 22, color: COLOR_MUTED, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: scoreVerdict(audit.geoScore), size: 24, color: COLOR_TEXT, font: 'Arial' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 480 },
      children: [
        new TextRun({ text: `${passCount} `, bold: true, size: 24, color: COLOR_PASS, font: 'Arial' }),
        new TextRun({ text: 'OK   ', size: 20, color: COLOR_MUTED, font: 'Arial' }),
        new TextRun({ text: `${warnCount} `, bold: true, size: 24, color: COLOR_WARN, font: 'Arial' }),
        new TextRun({ text: 'внимание   ', size: 20, color: COLOR_MUTED, font: 'Arial' }),
        new TextRun({ text: `${failCount} `, bold: true, size: 24, color: COLOR_FAIL, font: 'Arial' }),
        new TextRun({ text: `ошибок   •   ${total} проверок`, size: 20, color: COLOR_MUTED, font: 'Arial' }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 1800 },
      children: [new TextRun({ text: `Дата отчёта: ${date}`, size: 20, color: COLOR_MUTED, font: 'Arial' })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildExecSummary(audit: DocxGeoAudit): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(h('Резюме для руководителя', HeadingLevel.HEADING_1, COLOR_ACCENT));
  out.push(p(scoreVerdict(audit.geoScore), { size: 24 }));
  out.push(p('', {}));
  out.push(p('Распределение по этапам:', { bold: true, size: 24 }));

  const stageRows = audit.stages.map(s =>
    new TableRow({ children: [
      cellTxt(s.title, { bold: true, size: 20 }),
      cellTxt(s.subtitle, { size: 20 }),
      cellTxt(`${s.score}%`, { bold: true, color: scoreColor(s.score), align: AlignmentType.RIGHT, size: 22 }),
    ]})
  );
  out.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [1400, 6360, 1600],
    rows: [
      new TableRow({ tableHeader: true, children: [
        cellTxt('Этап', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT }),
        cellTxt('Раздел', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT }),
        cellTxt('Score', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT, align: AlignmentType.RIGHT }),
      ]}),
      ...stageRows,
    ],
  }));

  if (audit.criticals.length) {
    out.push(h('Топ критических находок', HeadingLevel.HEADING_2, COLOR_FAIL));
    audit.criticals.forEach(c => {
      out.push(new Paragraph({
        numbering: { reference: 'critList', level: 0 },
        children: [new TextRun({ text: c, size: 22, color: COLOR_TEXT, font: 'Arial' })],
      }));
    });
  }

  out.push(new Paragraph({ children: [new PageBreak()] }));
  return out;
}

function buildStageSection(stage: DocxStage): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(h(`${stage.title}. ${stage.subtitle}`, HeadingLevel.HEADING_1, COLOR_ACCENT));
  out.push(p(`Score этапа: ${stage.score}% • Проверок: ${stage.items.length}`, { color: COLOR_MUTED, italics: true }));
  out.push(p('', {}));

  // Table: Пункт / Критерий / Статус / Что обнаружено
  const headerRow = new TableRow({ tableHeader: true, children: [
    cellTxt('Пункт проверки', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT }),
    cellTxt('Критерий', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT }),
    cellTxt('Статус', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT, align: AlignmentType.CENTER }),
    cellTxt('Что обнаружено / Рекомендация', { bold: true, color: 'FFFFFF', bg: COLOR_ACCENT }),
  ]});

  const rows = stage.items.map(item => {
    const rowBg = item.status === 'fail' ? 'FEE2E2' : item.status === 'warn' ? 'FEF3C7' : undefined;
    return new TableRow({ children: [
      cellMulti([
        new Paragraph({ children: [new TextRun({ text: item.label, bold: true, size: 20, color: COLOR_TEXT, font: 'Arial' })] }),
        new Paragraph({ children: [new TextRun({ text: `Инструмент: ${item.tools}`, size: 16, color: COLOR_MUTED, italics: true, font: 'Arial' })] }),
      ], { bg: rowBg, width: 2200 }),
      cellMulti([new Paragraph({ children: [new TextRun({ text: item.criteria, size: 18, color: COLOR_TEXT, font: 'Arial' })] })], { bg: rowBg, width: 2800 }),
      cellMulti([new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: statusLabel(item.status), bold: true, size: 20, color: statusColor(item.status), font: 'Arial' })],
      })], { bg: rowBg, width: 1200 }),
      cellMulti([new Paragraph({ children: [new TextRun({ text: item.detail, size: 18, color: COLOR_TEXT, font: 'Arial' })] })], { bg: rowBg, width: 3160 }),
    ]});
  });

  out.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2200, 2800, 1200, 3160],
    rows: [headerRow, ...rows],
  }));

  return out;
}

function buildRoadmap(audit: DocxGeoAudit): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({ children: [new PageBreak()] }));
  out.push(h('Дорожная карта внедрения (30–60 дней)', HeadingLevel.HEADING_1, COLOR_ACCENT));
  out.push(p('Приоритизированный план действий на основе результатов аудита.', { color: COLOR_MUTED, italics: true }));
  out.push(p('', {}));

  if (audit.strategy.length) {
    audit.strategy.forEach((s, i) => {
      const [period, ...rest] = s.split(':');
      const body = rest.join(':').trim() || s;
      out.push(new Paragraph({
        spacing: { before: 120, after: 60 },
        children: [
          new TextRun({ text: `${i + 1}. `, bold: true, size: 22, color: COLOR_ACCENT, font: 'Arial' }),
          new TextRun({ text: period, bold: true, size: 22, color: COLOR_TEXT, font: 'Arial' }),
          rest.length ? new TextRun({ text: ' - ', size: 22, color: COLOR_MUTED, font: 'Arial' }) : new TextRun({ text: '', font: 'Arial' }),
          rest.length ? new TextRun({ text: body, size: 22, color: COLOR_TEXT, font: 'Arial' }) : new TextRun({ text: '', font: 'Arial' }),
        ],
      }));
    });
  }

  return out;
}

function buildMethodology(): Paragraph[] {
  return [
    new Paragraph({ children: [new PageBreak()] }),
    h('Методология', HeadingLevel.HEADING_1, COLOR_ACCENT),
    p('Аудит выполнен по 5 этапам, всего ~35 точек проверки, охватывающих:', {}),
    new Paragraph({ numbering: { reference: 'bullets', level: 0 },
      children: [new TextRun({ text: 'Этап 1 - Техническая доступность для ИИ: robots.txt, sitemap, CWV, мобильная адаптация, индексируемость.', size: 22, color: COLOR_TEXT, font: 'Arial' })] }),
    new Paragraph({ numbering: { reference: 'bullets', level: 0 },
      children: [new TextRun({ text: 'Этап 2 - Прямая проверка в ИИ: цитируемость в AI Overview / ChatGPT / Perplexity, корректность извлечения данных, chunking.', size: 22, color: COLOR_TEXT, font: 'Arial' })] }),
    new Paragraph({ numbering: { reference: 'bullets', level: 0 },
      children: [new TextRun({ text: 'Этап 3 - Структура и семантика: H1/иерархия, семантические теги HTML5, Schema.org, связывание сущностей через @id.', size: 22, color: COLOR_TEXT, font: 'Arial' })] }),
    new Paragraph({ numbering: { reference: 'bullets', level: 0 },
      children: [new TextRun({ text: 'Этап 4 - Контент: подход «Ответ-прежде-всего», тематические кластеры, информационные пробелы, мультимодальность.', size: 22, color: COLOR_TEXT, font: 'Arial' })] }),
    new Paragraph({ numbering: { reference: 'bullets', level: 0 },
      children: [new TextRun({ text: 'Этап 5 - E-E-A-T: опыт автора, авторитетность, упоминания бренда, FAQ/рейтинги, ссылочный профиль, GBP, панель знаний.', size: 22, color: COLOR_TEXT, font: 'Arial' })] }),
    p('', {}),
    p('Шкала статусов:', { bold: true }),
    new Paragraph({ children: [
      new TextRun({ text: '• OK', bold: true, color: COLOR_PASS, size: 22, font: 'Arial' }),
      new TextRun({ text: ' - критерий выполнен полностью.', size: 22, color: COLOR_TEXT, font: 'Arial' }),
    ]}),
    new Paragraph({ children: [
      new TextRun({ text: '• Внимание', bold: true, color: COLOR_WARN, size: 22, font: 'Arial' }),
      new TextRun({ text: ' - частичное соответствие, рекомендуется доработка.', size: 22, color: COLOR_TEXT, font: 'Arial' }),
    ]}),
    new Paragraph({ children: [
      new TextRun({ text: '• Ошибка', bold: true, color: COLOR_FAIL, size: 22, font: 'Arial' }),
      new TextRun({ text: ' - критическое нарушение, требует срочного исправления.', size: 22, color: COLOR_TEXT, font: 'Arial' }),
    ]}),
    p('', {}),
    p('Расчёт Score:', { bold: true }),
    p('Score этапа = средневзвешенное по проверкам, где OK = 1.0, Внимание = 0.5, Ошибка = 0. Общий GEO Score - среднее по 5 этапам.', { color: COLOR_MUTED, italics: true, size: 20 }),
  ];
}

export async function exportGeoAuditDocx(audit: DocxGeoAudit) {
  const date = fmtDate(new Date());
  let domain = 'site';
  try { domain = new URL(audit.url).hostname.replace(/^www\./, ''); } catch {}

  const allContent: (Paragraph | Table)[] = [
    ...buildCover(audit, domain, date),
    ...buildExecSummary(audit),
    ...audit.stages.flatMap(s => buildStageSection(s)),
    ...buildRoadmap(audit),
    ...buildMethodology(),
  ];

  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `GEO Audit - ${domain}`,
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial', color: COLOR_ACCENT },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial', color: COLOR_TEXT },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'critList',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      headers: { default: buildHeader(domain, date) },
      footers: { default: buildFooter() },
      children: allContent,
    }],
  });

  const buf = await Packer.toBlob(doc);
  saveAs(buf, `GEO-Audit_${domain}_${fmtFile(new Date())}.docx`);
}