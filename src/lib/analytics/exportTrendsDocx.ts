import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Footer, PageNumber, LevelFormat, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { TrendsData, RoadmapPhase } from '@/components/analytics/TrendsView';

const PRIMARY = '3B82F6';
const MUTED = '6B7280';
const BORDER = 'E5E7EB';
const SUCCESS = '10B981';
const WARN = 'F59E0B';
const DANGER = 'EF4444';

const cb = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cbs = { top: cb, bottom: cb, left: cb, right: cb };

function h1(t: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 160 },
    children: [new TextRun({ text: t, bold: true, size: 32, color: '111827' })],
  });
}
function h2(t: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 },
    children: [new TextRun({ text: t, bold: true, size: 26, color: '111827' })],
  });
}
function p(text: string, opts: { color?: string; bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, color: opts.color, bold: opts.bold, size: opts.size ?? 22 })],
  });
}
function bullet(text: string, color?: string) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color })],
  });
}
function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 1 } },
    spacing: { before: 60, after: 200 }, children: [new TextRun('')],
  });
}
function scoreColor(v: number) {
  if (v >= 70) return SUCCESS;
  if (v >= 40) return WARN;
  return DANGER;
}

function thRow(cells: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((c, i) => new TableCell({
      borders: cbs, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: 'F3F4F6', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 20, color: '111827' })] })],
    })),
  });
}
function tdRow(cells: (string | { text: string; color?: string; bold?: boolean })[], widths: number[]) {
  return new TableRow({
    children: cells.map((c, i) => {
      const o = typeof c === 'string' ? { text: c } : c;
      return new TableCell({
        borders: cbs, width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: o.text, size: 20, color: o.color, bold: o.bold })] })],
      });
    }),
  });
}

function scoringTable(s: TrendsData['scoring']) {
  const widths = [4400, 2400, 2600];
  const label = (v: number) => v >= 70 ? 'Высокая' : v >= 40 ? 'Средняя' : 'Низкая';
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Метрика', 'Значение', 'Оценка'], widths),
    tdRow(['Overall Opportunity', { text: `${s.overall_opportunity}/100`, bold: true, color: scoreColor(s.overall_opportunity) }, label(s.overall_opportunity)], widths),
    tdRow(['Durability (долговечность)', { text: `${s.durability}/100`, bold: true, color: scoreColor(s.durability) }, label(s.durability)], widths),
    tdRow(['AI Relevance', { text: `${s.ai_relevance}/100`, bold: true, color: scoreColor(s.ai_relevance) }, label(s.ai_relevance)], widths),
    tdRow(['Early-Mover Advantage', { text: `${s.early_mover_advantage}/100`, bold: true, color: scoreColor(s.early_mover_advantage) }, label(s.early_mover_advantage)], widths),
  ]});
}

function shiftsTable(items: TrendsData['market_shifts']['durable_shifts']) {
  const widths = [2800, 3300, 3300];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Тренд', 'Почему важно', 'Как адаптировать SEO'], widths),
    ...items.map((d) => tdRow([{ text: d.shift, bold: true }, d.why_it_matters || '—', d.seo_adaptation || '—'], widths)),
  ]});
}

function aiTable(items: TrendsData['ai_and_trust']['ai_trends']) {
  const widths = [4400, 2500, 2500];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Сегмент', 'AI Upside', 'AI Downside'], widths),
    ...items.map((a) => tdRow([
      { text: a.segment, bold: true },
      { text: `${a.ai_upside_score}/100`, bold: true, color: scoreColor(a.ai_upside_score) },
      { text: `${a.ai_downside_score}/100`, bold: true, color: scoreColor(100 - a.ai_downside_score) },
    ], widths)),
  ]});
}

function phaseBlock(title: string, phase: RoadmapPhase) {
  const out: (Paragraph | Table)[] = [];
  out.push(p(title, { bold: true, color: PRIMARY, size: 24 }));
  if (phase.expected_kpi) out.push(p(`KPI: ${phase.expected_kpi}`, { color: MUTED, size: 20 }));
  if (phase.trends_to_activate.length) {
    out.push(p('Тренды активировать:', { bold: true, color: MUTED, size: 20 }));
    phase.trends_to_activate.forEach((t) => out.push(bullet(t)));
  }
  if (phase.assets_to_build.length) {
    out.push(p('Assets строить:', { bold: true, color: MUTED, size: 20 }));
    phase.assets_to_build.forEach((t) => out.push(bullet(t)));
  }
  return out;
}

export async function exportTrendsDocx(niche: string, data: TrendsData) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: 'ТРЕНДЫ И СДВИГИ · SEO-АУДИТ', bold: true, size: 22, color: PRIMARY })],
  }));
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: niche || '—', bold: true, size: 44, color: '111827' })],
  }));
  children.push(p('Trend Landscape: отделяем структурные сдвиги рынка от хайпа. Куда идти, что строить, чего избегать.', { color: MUTED }));
  children.push(p(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, { color: MUTED, size: 20 }));
  children.push(divider());

  children.push(h1('1. Scoring framework'));
  children.push(scoringTable(data.scoring));
  if (data.scoring.reasoning) {
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: data.scoring.reasoning, size: 22, color: '374151' })] }));
  }

  children.push(h1('2. Executive verdict'));
  children.push(h2('Картина трендов'));
  children.push(p(data.executive_verdict.overview || '—'));
  children.push(h2('Главный риск'));
  children.push(p(data.executive_verdict.main_risk || '—', { color: DANGER }));
  children.push(h2('Главная возможность'));
  children.push(p(data.executive_verdict.main_opportunity || '—', { color: SUCCESS }));

  children.push(h1('3. Топ-листы трендов'));
  if (data.top_lists.act_now_trends.length) {
    children.push(h2('Act-Now тренды'));
    data.top_lists.act_now_trends.forEach((t) => children.push(bullet(t, SUCCESS)));
  }
  if (data.top_lists.early_mover_wedges.length) {
    children.push(h2('Early-Mover wedges'));
    data.top_lists.early_mover_wedges.forEach((t) => children.push(bullet(t, PRIMARY)));
  }
  if (data.top_lists.hype_traps.length) {
    children.push(h2('Hype traps (избегать)'));
    data.top_lists.hype_traps.forEach((t) => children.push(bullet(t, DANGER)));
  }

  if (data.market_shifts.durable_shifts.length) {
    children.push(h1('4. Durable low-noise shifts'));
    children.push(shiftsTable(data.market_shifts.durable_shifts));
  }
  if (data.market_shifts.format_trends.length) {
    children.push(h2('Растущие форматы контента'));
    data.market_shifts.format_trends.forEach((f) => children.push(bullet(f)));
  }
  if (data.market_shifts.audience_behavior.length) {
    children.push(h2('Сдвиги в поведении аудитории'));
    data.market_shifts.audience_behavior.forEach((b) => children.push(bullet(b)));
  }

  children.push(h1('5. AI и Trust'));
  if (data.ai_and_trust.ai_trends.length) {
    children.push(h2('Влияние AI по сегментам'));
    children.push(aiTable(data.ai_and_trust.ai_trends));
  }
  children.push(h2('Trust & expectations'));
  children.push(p(data.ai_and_trust.trust_expectations || '—'));

  children.push(h1('6. Phased roadmap'));
  phaseBlock('Первые 30 дней', data.roadmap.first_30_days).forEach((c) => children.push(c));
  phaseBlock('Первый квартал', data.roadmap.first_quarter).forEach((c) => children.push(c));
  phaseBlock('6-12 месяцев', data.roadmap.months_6_to_12).forEach((c) => children.push(c));
  phaseBlock('12-24 месяца', data.roadmap.months_12_to_24).forEach((c) => children.push(c));

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 540, hanging: 280 } } },
        }],
      }],
    },
    sections: [{
      properties: { page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } } },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: 'SEO-Аудит · Тренды · ', size: 18, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (niche || 'niche').replace(/[^a-zA-Z0-9а-яА-Я\-_]+/g, '-').slice(0, 60);
  saveAs(blob, `trends-${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}