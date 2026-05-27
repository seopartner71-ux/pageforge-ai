import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, LevelFormat, PageBreak,
} from 'docx';

export interface EeatCheck {
  factor: string;
  status: string; // "Да" | "Нет" | "Неприменимо"
  comment?: string;
  evidence?: string;
}

export interface EeatAuditData {
  siteUrl: string;
  siteType: string;
  niche: string;
  summary: string;
  score: number;
  baseChecks: EeatCheck[];
  nicheChecks: EeatCheck[];
  missingPages: string[];
  recommendations: string[];
}

function fmtDate(d = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function safe(s: string): string {
  return (s || '').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 80);
}

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };

function cell(text: string, width: number, opts: { bold?: boolean; fill?: string; color?: string } = {}): TableCell {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text || '-', bold: opts.bold, color: opts.color })] })],
  });
}

function statusColor(s: string): string {
  const x = (s || '').toLowerCase();
  if (x.startsWith('да')) return 'D1FAE5';
  if (x.startsWith('нет')) return 'FEE2E2';
  return 'F3F4F6';
}

function buildChecksTable(checks: EeatCheck[]): Table {
  const widths = [3600, 1400, 2200, 2160];
  const headerCells = [
    cell('Фактор', widths[0], { bold: true, fill: 'D5E8F0' }),
    cell('Статус', widths[1], { bold: true, fill: 'D5E8F0' }),
    cell('Оценка состояния', widths[2], { bold: true, fill: 'D5E8F0' }),
    cell('Подтверждение', widths[3], { bold: true, fill: 'D5E8F0' }),
  ];
  const rows = [new TableRow({ children: headerCells })];
  checks.forEach((c) => {
    rows.push(new TableRow({
      children: [
        cell(c.factor, widths[0]),
        cell(c.status, widths[1], { fill: statusColor(c.status), bold: true }),
        cell(c.comment || '-', widths[2]),
        cell(c.evidence || '-', widths[3]),
      ],
    }));
  });
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

export async function exportEeatAuditDocx(data: EeatAuditData): Promise<void> {
  const passCount = data.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('да')).length;
  const failCount = data.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('нет')).length;
  const naCount = data.baseChecks.filter(c => (c.status || '').toLowerCase().startsWith('неп')).length;

  const summaryTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3360, 6000],
    rows: [
      new TableRow({ children: [cell('Параметр', 3360, { bold: true, fill: 'D5E8F0' }), cell('Значение', 6000, { bold: true, fill: 'D5E8F0' })] }),
      new TableRow({ children: [cell('Сайт', 3360), cell(data.siteUrl, 6000)] }),
      new TableRow({ children: [cell('Тип сайта', 3360), cell(data.siteType, 6000)] }),
      new TableRow({ children: [cell('Ниша', 3360), cell(data.niche, 6000)] }),
      new TableRow({ children: [cell('Дата аудита', 3360), cell(fmtDate(), 6000)] }),
      new TableRow({ children: [cell('Общий балл', 3360), cell(`${data.score} / 100`, 6000, { bold: true })] }),
      new TableRow({ children: [cell('Базовых факторов: Да / Нет / Неприменимо', 3360), cell(`${passCount} / ${failCount} / ${naCount}`, 6000)] }),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 280, after: 220 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'numbers',
          levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children: [
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Аудит E-E-A-T и Коммерческих факторов', bold: true })],
        }),
        new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: data.siteUrl, italics: true, color: '666666' })] }),
        new Paragraph({ text: '' }),
        summaryTable,

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Краткое резюме' })] }),
        new Paragraph({ children: [new TextRun(data.summary || '-')] }),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Топ-5 приоритетных рекомендаций' })] }),
        ...(data.recommendations.length
          ? data.recommendations.map((r) => new Paragraph({
              numbering: { reference: 'numbers', level: 0 },
              children: [new TextRun(r)],
            }))
          : [new Paragraph({ children: [new TextRun({ text: '-', italics: true, color: '888888' })] })]),

        ...(data.missingPages.length ? [
          new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Обязательные страницы, отсутствующие на сайте' })] }),
          ...data.missingPages.map((p) => new Paragraph({
            numbering: { reference: 'bullets', level: 0 },
            children: [new TextRun(p)],
          })),
        ] : []),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Базовый чек-лист коммерческих факторов' })] }),
        buildChecksTable(data.baseChecks),

        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Нишевые факторы E-E-A-T' })] }),
        buildChecksTable(data.nicheChecks),

        new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun({ text: 'Методология' })] }),
        new Paragraph({ numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun('Полный рендеринг страниц через reader-сервис (включая JS-контент).')] }),
        new Paragraph({ numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun('Парсинг sitemap.xml + ссылок главной для поиска страниц.')] }),
        new Paragraph({ numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun('Верификация назначения каждой страницы по Title/H1.')] }),
        new Paragraph({ numbering: { reference: 'bullets', level: 0 },
          children: [new TextRun('Оценка по комбинированному чек-листу: базовый (76 пунктов) + нишевые E-E-A-T факторы.')] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `EEAT-Audit-${safe(data.siteUrl.replace(/^https?:\/\//, ''))}-${fmtDate().replace(/\./g, '-')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}