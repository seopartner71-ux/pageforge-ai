import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType, LevelFormat, PageBreak,
} from 'docx';
import type { BlogTopic } from './types';

function safeFileSegment(s: string): string {
  return (s || 'тематика').trim().replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, '-').slice(0, 60);
}
function fmtDate(d = new Date()): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtNum(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n || 0));
}

const cellBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function tableCell(text: string, width: number, bold = false, fill?: string): TableCell {
  return new TableCell({
    borders: cellBorders,
    width: { size: width, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
  });
}

function buildMonthSection(title: string, color: string, topics: BlogTopic[]): Paragraph[] {
  const out: Paragraph[] = [
    new Paragraph({ text: '' }),
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun({ text: title, bold: true, color })],
    }),
  ];
  if (topics.length === 0) {
    out.push(new Paragraph({ children: [new TextRun({ text: 'Нет подходящих тем.', italics: true, color: '888888' })] }));
    return out;
  }
  topics.forEach((t, i) => {
    const week = i + 1;
    out.push(new Paragraph({
      numbering: { reference: 'plan-bullets', level: 0 },
      children: [
        new TextRun({ text: `Неделя ${week}: `, bold: true }),
        new TextRun({ text: t.keyword }),
        new TextRun({ text: `  — частота ${fmtNum(t.ws_frequency)}, потенциал ~${fmtNum(t.traffic_potential)} визитов`, color: '666666' }),
      ],
    }));
  });
  return out;
}

export async function exportContentPlanDocx(topics: BlogTopic[], topic: string, region: string): Promise<void> {
  const easy = topics.filter((t) => t.competition_level === 'easy').sort((a, b) => b.blog_score - a.blog_score).slice(0, 8);
  const medium = topics.filter((t) => t.competition_level === 'medium').sort((a, b) => b.blog_score - a.blog_score).slice(0, 8);
  const hard = topics.filter((t) => t.competition_level === 'hard').sort((a, b) => b.blog_score - a.blog_score).slice(0, 8);

  const summaryTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: [
      new TableRow({ children: [tableCell('Параметр', 4680, true, 'D5E8F0'), tableCell('Значение', 4680, true, 'D5E8F0')] }),
      new TableRow({ children: [tableCell('Тематика', 4680), tableCell(topic, 4680)] }),
      new TableRow({ children: [tableCell('Регион', 4680), tableCell(region, 4680)] }),
      new TableRow({ children: [tableCell('Дата', 4680), tableCell(fmtDate(), 4680)] }),
      new TableRow({ children: [tableCell('Всего тем', 4680), tableCell(String(topics.length), 4680)] }),
      new TableRow({ children: [tableCell('Лёгких / Средних / Сложных', 4680), tableCell(`${easy.length} / ${medium.length} / ${hard.length}`, 4680)] }),
    ],
  });

  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 32, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 26, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'plan-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
        { reference: 'rec-bullets',
          levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
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
          children: [new TextRun({ text: 'Контент-план на 3 месяца', bold: true })],
        }),
        new Paragraph({ text: '' }),
        summaryTable,
        ...buildMonthSection('Месяц 1 — Лёгкие темы (быстрый результат)', '10B981', easy),
        ...buildMonthSection('Месяц 2 — Средние темы', 'F59E0B', medium),
        ...buildMonthSection('Месяц 3 — Сложные темы (после наработки авторитета)', 'EF4444', hard),
        new Paragraph({ children: [new PageBreak()] }),
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          children: [new TextRun({ text: 'Рекомендации', bold: true })],
        }),
        new Paragraph({ numbering: { reference: 'rec-bullets', level: 0 },
          children: [new TextRun('Публикуйте 1-2 статьи в неделю — стабильность важнее объёма.')] }),
        new Paragraph({ numbering: { reference: 'rec-bullets', level: 0 },
          children: [new TextRun('Минимум 1500 слов для лёгких тем.')] }),
        new Paragraph({ numbering: { reference: 'rec-bullets', level: 0 },
          children: [new TextRun('Минимум 3000 слов для средних тем.')] }),
        new Paragraph({ numbering: { reference: 'rec-bullets', level: 0 },
          children: [new TextRun('Экспертные статьи 3000+ слов и видео для сложных тем.')] }),
        new Paragraph({ numbering: { reference: 'rec-bullets', level: 0 },
          children: [new TextRun('Добавляйте внутренние ссылки между статьями кластера.')] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Контент-план-${safeFileSegment(topic)}-${fmtDate().replace(/\./g, '-')}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}