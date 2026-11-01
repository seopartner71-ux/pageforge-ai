import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  BorderStyle, WidthType, ShadingType, Footer, PageNumber, LevelFormat, AlignmentType, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import type { LinkTz } from './exportXlsx';

const PRIMARY = '3B82F6';
const cb = { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB' };
const borders = { top: cb, bottom: cb, left: cb, right: cb };
// A4 альбомная, поля 1 см → ширина текста 16838 - 2*567
const W = 16838 - 1134;

const h = (t: string, lvl: 1 | 2) => new Paragraph({
  heading: lvl === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
  spacing: { before: lvl === 1 ? 280 : 200, after: 120 },
  children: [new TextRun({ text: t, bold: true, size: lvl === 1 ? 32 : 26 })],
});
const para = (t: string, bold?: string) => new Paragraph({
  spacing: { after: 100 },
  children: [...(bold ? [new TextRun({ text: bold, bold: true, size: 21 })] : []), new TextRun({ text: t, size: 21 })],
});
const bullet = (t: string) => new Paragraph({ numbering: { reference: 'b', level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: t, size: 21 })] });

function table(head: string[], widths: number[], rows: string[][]) {
  const total = widths.reduce((a, b) => a + b, 0);
  const ws = widths.map((w) => Math.floor((w / total) * W));
  ws[ws.length - 1] += W - ws.reduce((a, b) => a + b, 0);
  const cell = (t: string, i: number, hd = false) => new TableCell({
    borders, width: { size: ws[i], type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    shading: hd ? { fill: 'E8F0FE', type: ShadingType.CLEAR } : undefined,
    children: [new Paragraph({ children: [new TextRun({ text: t || '—', bold: hd, size: 18 })] })],
  });
  return new Table({
    width: { size: W, type: WidthType.DXA }, columnWidths: ws,
    rows: [
      new TableRow({ tableHeader: true, children: head.map((t, i) => cell(t, i, true)) }),
      ...rows.map((r) => new TableRow({ children: r.map((t, i) => cell(t, i)) })),
    ],
  });
}

export async function exportLinkTzDocx(tz: LinkTz, host: string, fileBase: string) {
  const content = tz.content ?? [];
  const tech = tz.tech ?? [];
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: 'Техническое задание', bold: true, size: 40 })] }),
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: PRIMARY, space: 1 } }, spacing: { after: 200 },
      children: [new TextRun({ text: `Исправление внутренней перелинковки · ${host} · ${new Date(tz.generated_at ?? Date.now()).toLocaleDateString('ru-RU')}`, size: 22, color: '6B7280' })],
    }),
  ];
  if (tz.goal) children.push(para(tz.goal, 'Цель: '));
  if (tz.scope) children.push(para(tz.scope, 'Состав работ: '));

  children.push(h('1. Задачи для контент-менеджера', 1));
  if (content.length) {
    children.push(table(['№', 'Приоритет', 'Страница', 'Действие', 'Анкор', 'Цель ссылки', 'Где разместить', 'Проверка'],
      [4, 8, 18, 16, 12, 18, 14, 12],
      content.map((c, i) => [String(i + 1), c.priority, c.page, c.action, c.anchor ?? '', c.target ?? '', c.placement ?? '', c.check ?? ''])));
  } else children.push(para('Контентных правок не требуется.'));

  children.push(h('2. Задачи для программиста', 1));
  if (tech.length) {
    children.push(table(['№', 'Приоритет', 'Область', 'Задача', 'Затронутые URL', 'Как сделать', 'Приёмка'],
      [4, 8, 10, 18, 22, 22, 14],
      tech.map((t, i) => [String(i + 1), t.priority, t.area, t.task, (t.urls ?? []).join('\n'), t.how ?? '', t.check ?? ''])));
  } else children.push(para('Технических правок не требуется.'));

  if (tz.acceptance?.length) { children.push(h('3. Критерии приёмки', 1)); tz.acceptance.forEach((a) => children.push(bullet(a))); }
  if (tz.notes?.length) { children.push(h('4. Замечания', 1)); tz.notes.forEach((a) => children.push(bullet(a))); }

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Arial', size: 21 } } } },
    numbering: { config: [{ reference: 'b', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }] },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE }, margin: { top: 567, bottom: 567, left: 567, right: 567 } } },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ children: ['Стр. ', PageNumber.CURRENT], size: 16, color: '9CA3AF' })] })] }) },
      children,
    }],
  });
  saveAs(await Packer.toBlob(doc), `${fileBase}-TZ-perelinkovka.docx`);
}
