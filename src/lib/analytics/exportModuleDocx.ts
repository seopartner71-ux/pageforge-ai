import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, PageOrientation } from 'docx';
import { saveAs } from 'file-saver';
import type { ModuleReport } from './moduleConfig';

const h = (t: string, l: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => new Paragraph({ heading: l, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: t, bold: true })] });
const p = (t: string, bold = false) => new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: t, bold, size: 21 })] });
const li = (t: string) => new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: t, size: 21 })] });
const cell = (t: string, bold = false) => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, bold, size: 18 })] })] });

export async function exportModuleDocx(title: string, niche: string, r: ModuleReport) {
  const body: (Paragraph | Table)[] = [h(`${title} — «${niche}»`, HeadingLevel.TITLE)];
  body.push(h('Оценки', HeadingLevel.HEADING_1));
  r.scores.forEach((s) => body.push(p(`${s.label}: ${s.value}/100${s.comment ? ` — ${s.comment}` : ''}`)));
  body.push(h('Вывод', HeadingLevel.HEADING_1));
  const v = r.verdict;
  if (v.overview) body.push(p(v.overview));
  if (v.main_opportunity) body.push(p(`Главная возможность: ${v.main_opportunity}`));
  if (v.main_risk) body.push(p(`Главный риск: ${v.main_risk}`));
  if (v.strategy) body.push(p(`Стратегия: ${v.strategy}`));
  r.top_lists.forEach((l) => { body.push(h(l.title, HeadingLevel.HEADING_2)); l.items.forEach((i) => body.push(li(i))); });
  if (r.table.rows.length) {
    body.push(h(r.table.title || 'Таблица', HeadingLevel.HEADING_1));
    body.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [new TableRow({ tableHeader: true, children: r.table.columns.map((c) => cell(c, true)) }),
        ...r.table.rows.map((row) => new TableRow({ children: r.table.columns.map((_, i) => cell(row[i] ?? '')) }))],
    }));
  }
  if (r.roadmap.length) {
    body.push(h('План действий', HeadingLevel.HEADING_1));
    r.roadmap.forEach((ph) => { body.push(p(ph.phase, true)); ph.actions.forEach((a) => body.push(li(a))); });
  }
  const doc = new Document({ sections: [{ properties: { page: { size: { orientation: PageOrientation.LANDSCAPE } } }, children: body }] });
  saveAs(await Packer.toBlob(doc), `${title} - ${niche}.docx`.replace(/[\\/:*?"<>|]/g, '_'));
}
