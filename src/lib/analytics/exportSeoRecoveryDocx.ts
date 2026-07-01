import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  LevelFormat,
} from 'docx';
import { saveAs } from 'file-saver';

const NAVY = '1E3A5F';
const MUTED = '6B7280';
const BORDER = 'CCCCCC';
const HEAD_FILL = 'E5E7EB';

const cb = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cbs = { top: cb, bottom: cb, left: cb, right: cb };

function p(text: string, opts: { bold?: boolean; italics?: boolean; color?: string; size?: number; align?: any; after?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.after ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italics, color: opts.color, size: opts.size ?? 22, font: 'Calibri' })],
  });
}
function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: NAVY, font: 'Calibri' })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: NAVY, font: 'Calibri' })],
  });
}
function h3(text: string, color?: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 180, after: 100 },
    children: [new TextRun({ text, bold: true, size: 22, color: color ?? NAVY, font: 'Calibri' })],
  });
}
function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'srb', level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });
}
function numbered(text: string) {
  return new Paragraph({
    numbering: { reference: 'srn', level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, font: 'Calibri' })],
  });
}
function cell(text: string, opts: { bold?: boolean; fill?: string; width?: number } = {}) {
  return new TableCell({
    borders: cbs,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ children: [new TextRun({ text: text ?? '—', bold: opts.bold, size: 20, font: 'Calibri' })] })],
  });
}
function tableFrom(headers: string[], rows: string[][], widths: number[]) {
  return new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    rows: [
      new TableRow({ tableHeader: true, children: headers.map((h, i) => cell(h, { bold: true, fill: HEAD_FILL, width: widths[i] })) }),
      ...rows.map((r) => new TableRow({ children: r.map((c, i) => cell(c, { width: widths[i] })) })),
    ],
  });
}

function fmt(v: any): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'number') return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
  return String(v);
}
function pct(v: any): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n > 0 ? '+' : ''}${Math.round(n * 10) / 10}%`;
}

function metricRows(data: any): string[][] {
  const rows: string[][] = [];
  const g = data?.gsc, y = data?.yandex;
  if (g) {
    rows.push(['Google', 'Клики', fmt(g.previous?.clicks), fmt(g.current?.clicks), pct(g.delta?.clicks)]);
    rows.push(['Google', 'Показы', fmt(g.previous?.impressions), fmt(g.current?.impressions), pct(g.delta?.impressions)]);
    rows.push(['Google', 'Позиция', fmt(g.previous?.position), fmt(g.current?.position), pct(g.delta?.position)]);
    const ctrWas = typeof g.previous?.ctr === 'number' ? (g.previous.ctr * 100).toFixed(2) + '%' : '—';
    const ctrNow = typeof g.current?.ctr === 'number' ? (g.current.ctr * 100).toFixed(2) + '%' : '—';
    rows.push(['Google', 'CTR', ctrWas, ctrNow, pct(g.delta?.ctr)]);
  }
  if (y) {
    rows.push(['Яндекс', 'Клики', fmt(y.previous?.clicks), fmt(y.current?.clicks), pct(y.delta?.clicks)]);
    rows.push(['Яндекс', 'Показы', fmt(y.previous?.impressions), fmt(y.current?.impressions), pct(y.delta?.impressions)]);
    rows.push(['Яндекс', 'Позиция', fmt(y.previous?.position), fmt(y.current?.position), pct(y.delta?.position)]);
  }
  return rows;
}

export async function exportSeoRecoveryDocx(data: any) {
  const ai = data?.ai ?? {};
  const site = data?.gsc_site || data?.yandex_host || data?.gsc?.site || '—';
  const cur = data?.period?.current;
  const prev = data?.period?.previous;
  const periodStr = cur && prev ? `${cur.date1} → ${cur.date2}  vs  ${prev.date1} → ${prev.date2}` : '—';
  const today = new Date().toLocaleDateString('ru-RU');
  const score = ai.seo_score ?? '—';

  const children: (Paragraph | Table)[] = [];

  // 1. Title
  children.push(new Paragraph({
    spacing: { before: 400, after: 200 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'SEO-анализ органического трафика', bold: true, size: 44, color: NAVY, font: 'Calibri' })],
  }));
  children.push(p(`Сайт: ${site}`, { align: AlignmentType.CENTER, bold: true, size: 24 }));
  children.push(p(`Период: ${periodStr}`, { align: AlignmentType.CENTER, color: MUTED }));
  children.push(p(`Дата: ${today}`, { align: AlignmentType.CENTER, color: MUTED }));
  children.push(p(`SEO Score: ${score}/100`, { align: AlignmentType.CENTER, bold: true, size: 28, color: NAVY, after: 300 }));

  // 2. Executive summary
  children.push(h1('Исполнительное резюме'));
  if (ai.headline?.summary) children.push(p(String(ai.headline.summary)));
  const mrows = metricRows(data);
  if (mrows.length) {
    children.push(tableFrom(
      ['Источник', 'Метрика', 'Было', 'Стало', 'Изменение'],
      mrows,
      [1600, 2200, 1800, 1800, 1960],
    ));
  }

  // 3. Main cause
  if (ai.main_cause) {
    children.push(h1('Главная причина'));
    if (ai.main_cause.title) children.push(h2(String(ai.main_cause.title)));
    const conf = ai.main_cause.confidence === 'high' ? 'высокая' : ai.main_cause.confidence === 'medium' ? 'средняя' : ai.main_cause.confidence === 'low' ? 'низкая' : '—';
    children.push(p(`Уверенность: ${conf}`, { bold: true, color: MUTED }));
    if (ai.main_cause.conclusion) children.push(p(String(ai.main_cause.conclusion)));
  }

  // 4. Hypotheses
  const hyps = Array.isArray(ai.root_cause_hypotheses) ? ai.root_cause_hypotheses : [];
  if (hyps.length) {
    children.push(h1('Гипотезы'));
    hyps.forEach((h: any) => {
      children.push(h3(`${h.hypothesis ?? 'Гипотеза'} (P=${h.probability ?? '—'}%)`));
      const ev = Array.isArray(h.evidence) ? h.evidence : [];
      ev.forEach((e: any) => {
        if (typeof e === 'string') children.push(bullet(e));
        else children.push(bullet(`${e.source ?? ''} · ${e.metric ?? ''}: ${e.was ?? '—'} → ${e.now ?? '—'} (${e.delta ?? '—'})`));
      });
      if (h.verification_step) children.push(p(`Как проверить: ${h.verification_step}`, { italics: true, color: MUTED }));
    });
  }

  // 5. Lost pages
  const lostPages = Array.isArray(ai.lost_pages) ? ai.lost_pages : [];
  if (lostPages.length) {
    children.push(h1('Потерянные страницы'));
    children.push(tableFrom(
      ['URL', 'Было кликов', 'Стало', 'Изменение %'],
      lostPages.slice(0, 30).map((r: any) => [String(r.url ?? '—'), fmt(r.was ?? r.clicks_was), fmt(r.now ?? r.clicks_now), pct(r.delta_pct ?? r.delta)]),
      [4400, 1800, 1800, 1360],
    ));
  }

  // 6. Lost queries
  const lostQ = Array.isArray(ai.lost_queries) ? ai.lost_queries : [];
  if (lostQ.length) {
    children.push(h1('Потерянные запросы'));
    children.push(tableFrom(
      ['Запрос', 'Клики было', 'Клики стало', 'Позиция было', 'Позиция стало'],
      lostQ.slice(0, 30).map((r: any) => [String(r.query ?? '—'), fmt(r.clicks_was ?? r.was), fmt(r.clicks_now ?? r.now), fmt(r.pos_was), fmt(r.pos_now)]),
      [3200, 1500, 1500, 1580, 1580],
    ));
  }

  // 7. Plan
  const recs = Array.isArray(ai.recommendations) ? ai.recommendations : [];
  if (recs.length) {
    children.push(h1('План действий'));
    recs.forEach((r: any) => {
      const prio = r.priority ? `[${r.priority}] ` : '';
      children.push(h3(`${prio}${r.title ?? 'Рекомендация'}`));
      if (r.why) children.push(p(`Почему: ${r.why}`, { bold: true }));
      if (r.action) children.push(p(String(r.action)));
      if (r.kpi?.metric || r.kpi?.target_delta) {
        children.push(p(`KPI: ${r.kpi?.metric ?? ''} ${r.kpi?.target_delta ?? ''}`.trim(), { italics: true, color: MUTED }));
      }
    });
  }

  // 8. Manual checks
  const steps = Array.isArray(ai.next_steps) ? ai.next_steps : [];
  if (steps.length) {
    children.push(h1('Что проверить вручную'));
    steps.forEach((s: string) => children.push(numbered(String(s))));
  }

  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `SEO Recovery ${site}`,
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [
        { reference: 'srb', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
        { reference: 'srn', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 } } }, // ~2.5cm
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = String(site).replace(/[^a-zA-Z0-9\-_.]+/g, '-').slice(0, 60) || 'site';
  saveAs(blob, `seo-recovery-${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}