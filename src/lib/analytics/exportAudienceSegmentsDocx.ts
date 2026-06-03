import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Footer, PageNumber, LevelFormat, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AudienceSegmentsData, RoadmapPhase } from '@/components/analytics/AudienceSegmentsView';

const PRIMARY = '3B82F6';
const MUTED = '6B7280';
const BORDER = 'E5E7EB';
const SUCCESS = '10B981';
const WARN = 'F59E0B';
const DANGER = 'EF4444';
const VIOLET = '8B5CF6';

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
function p(text: string, opts: { color?: string; bold?: boolean; size?: number; italic?: boolean } = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, color: opts.color, bold: opts.bold, italics: opts.italic, size: opts.size ?? 22 })],
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
function tdRow(cells: (string | { text: string; color?: string; bold?: boolean; italic?: boolean })[], widths: number[]) {
  return new TableRow({
    children: cells.map((c, i) => {
      const o = typeof c === 'string' ? { text: c } : c;
      return new TableCell({
        borders: cbs, width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: o.text, size: 20, color: o.color, bold: o.bold, italics: o.italic })] })],
      });
    }),
  });
}

function scoringTable(s: AudienceSegmentsData['scoring']) {
  const widths = [4400, 2400, 2600];
  const label = (v: number) => v >= 70 ? 'Высокая' : v >= 40 ? 'Средняя' : 'Низкая';
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Метрика', 'Значение', 'Оценка'], widths),
    tdRow(['Overall Segment Attractiveness', { text: `${s.overall_segment_attractiveness}/100`, bold: true, color: scoreColor(s.overall_segment_attractiveness) }, label(s.overall_segment_attractiveness)], widths),
    tdRow(['Market Relevance', { text: `${s.market_relevance}/100`, bold: true, color: scoreColor(s.market_relevance) }, label(s.market_relevance)], widths),
    tdRow(['Business Value', { text: `${s.business_value}/100`, bold: true, color: scoreColor(s.business_value) }, label(s.business_value)], widths),
    tdRow(['Conversion Fit', { text: `${s.conversion_fit}/100`, bold: true, color: scoreColor(s.conversion_fit) }, label(s.conversion_fit)], widths),
    tdRow(['Trust Feasibility', { text: `${s.trust_feasibility}/100`, bold: true, color: scoreColor(s.trust_feasibility) }, label(s.trust_feasibility)], widths),
    tdRow(['AI Opportunity', { text: `${s.ai_opportunity}/100`, bold: true, color: scoreColor(s.ai_opportunity) }, label(s.ai_opportunity)], widths),
  ]});
}

function segmentsTable(items: AudienceSegmentsData['segments']) {
  const widths = [2400, 1300, 2400, 1700, 1600];
  const vRu: Record<string, string> = { 'pursue-now': 'Брать сейчас', prepare: 'Готовить', monitor: 'Мониторить', avoid: 'Избегать' };
  const vCol: Record<string, string> = { 'pursue-now': SUCCESS, prepare: PRIMARY, monitor: WARN, avoid: DANGER };
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Сегмент', 'Тип', 'Scores (Биз/Конв/Trust/AI/Fit)', 'Лучшие страницы', 'Вердикт'], widths),
    ...items.map((c) => tdRow([
      { text: c.name, bold: true },
      c.type || '—',
      { text: `${c.business_value}/${c.conversion_fit}/${c.trust_threshold}/${c.ai_opportunity}/${c.feasibility_for_project}`, color: scoreColor(Math.round((c.business_value + c.conversion_fit + c.feasibility_for_project) / 3)), bold: true },
      c.best_page_types.join(' · ') || '—',
      { text: vRu[c.verdict] || c.verdict, color: vCol[c.verdict] || MUTED, bold: true },
    ], widths)),
  ]});
}

function journeyTable(items: AudienceSegmentsData['journey_stages']) {
  const widths = [1700, 2700, 2400, 2600];
  const valRu = (v: string) => v === 'high' ? 'Высокая' : v === 'low' ? 'Низкая' : 'Средняя';
  const valColor = (v: string) => v === 'high' ? SUCCESS : v === 'low' ? MUTED : PRIMARY;
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Стадия', 'Активные сегменты', 'Самые ценные', 'Ценность · Assets'], widths),
    ...items.map((j) => tdRow([
      { text: j.stage, bold: true },
      j.active_segments.join(' · ') || '—',
      j.most_valuable.join(' · ') || '—',
      { text: `${valRu(j.business_value)} · ${j.needed_assets.join(' · ') || '—'}`, color: valColor(j.business_value) },
    ], widths)),
  ]});
}

function jtbdTable(items: AudienceSegmentsData['jtbd_segments']) {
  const widths = [2100, 3400, 1400, 1300, 1200];
  const ru: Record<string, string> = { low: 'Низк.', medium: 'Средн.', high: 'Высок.' };
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Сегмент', 'Job', 'Search', 'Money', 'Asset'], widths),
    ...items.map((j) => tdRow([
      { text: j.segment, bold: true },
      j.job || '—',
      ru[j.search_driven] || j.search_driven,
      ru[j.monetization] || j.monetization,
      j.best_asset || '—',
    ], widths)),
  ]});
}

function phaseBlock(title: string, phase: RoadmapPhase) {
  const out: (Paragraph | Table)[] = [];
  out.push(p(title, { bold: true, color: PRIMARY, size: 24 }));
  if (phase.expected_kpi) out.push(p(`KPI: ${phase.expected_kpi}`, { color: MUTED, size: 20 }));
  if (phase.segments_to_target.length) {
    out.push(p('Сегменты таргетировать:', { bold: true, color: MUTED, size: 20 }));
    phase.segments_to_target.forEach((t) => out.push(bullet(t)));
  }
  if (phase.assets_to_build.length) {
    out.push(p('Assets строить:', { bold: true, color: MUTED, size: 20 }));
    phase.assets_to_build.forEach((t) => out.push(bullet(t)));
  }
  return out;
}

export async function exportAudienceSegmentsDocx(niche: string, data: AudienceSegmentsData) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: 'СЕГМЕНТЫ АУДИТОРИИ · SEO-АУДИТ', bold: true, size: 22, color: PRIMARY })],
  }));
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: niche || '—', bold: true, size: 44, color: '111827' })],
  }));
  children.push(p('Decision-grade segmentation map: сегменты, JTBD, путь клиента, wedges и phased roadmap.', { color: MUTED }));
  children.push(p(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, { color: MUTED, size: 20 }));
  children.push(divider());

  children.push(h1('1. Scoring framework'));
  children.push(scoringTable(data.scoring));
  if (data.scoring.reasoning) {
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: data.scoring.reasoning, size: 22, color: '374151' })] }));
  }

  children.push(h1('2. Executive verdict'));
  const lvlRu = data.executive_verdict.diversity_level === 'high' ? 'Высокое'
    : data.executive_verdict.diversity_level === 'low' ? 'Низкое' : 'Среднее';
  children.push(p(`Сегментное разнообразие: ${lvlRu}`, { color: PRIMARY, bold: true }));
  children.push(p(`Стратегическая модель: ${data.executive_verdict.strategy_model}`, { color: PRIMARY, bold: true }));
  children.push(h2('Картина сегментов'));
  children.push(p(data.executive_verdict.overview || '—'));
  children.push(h2('Главный риск'));
  children.push(p(data.executive_verdict.main_risk || '—', { color: DANGER }));
  children.push(h2('Главная возможность'));
  children.push(p(data.executive_verdict.main_opportunity || '—', { color: SUCCESS }));

  children.push(h1('3. Топ-листы сегментов'));
  const lists: [string, string[], string][] = [
    ['Топ-10 сегментов', data.top_lists.top_segments, PRIMARY],
    ['Core targets (приоритет 1)', data.top_lists.core_targets, SUCCESS],
    ['Высокая конверсия', data.top_lists.high_conversion, SUCCESS],
    ['Underserved', data.top_lists.underserved, VIOLET],
    ['Trust-sensitive', data.top_lists.trust_sensitive, WARN],
    ['Переоценённые (избегать)', data.top_lists.overhyped_avoid, DANGER],
    ['Типы страниц для запуска', data.top_lists.recommended_page_types, PRIMARY],
  ];
  for (const [title, items, color] of lists) {
    if (items.length === 0) continue;
    children.push(h2(title));
    items.forEach((t) => children.push(bullet(t, color)));
  }

  if (data.segments.length) {
    children.push(h1('4. Карточки сегментов'));
    children.push(segmentsTable(data.segments));
    data.segments.forEach((c) => {
      children.push(h2(c.name));
      if (c.real_language) children.push(p(`Язык: «${c.real_language}»`, { italic: true, color: '374151' }));
      if (c.knowledge_level) children.push(p(`Уровень знаний: ${c.knowledge_level}`, { color: MUTED, size: 20 }));
      if (c.core_problems.length) {
        children.push(p('Core проблемы:', { bold: true, color: MUTED, size: 20 }));
        c.core_problems.forEach((x) => children.push(bullet(x)));
      }
      if (c.desired_outcomes.length) {
        children.push(p('Желаемые результаты:', { bold: true, color: MUTED, size: 20 }));
        c.desired_outcomes.forEach((x) => children.push(bullet(x, SUCCESS)));
      }
      if (c.best_cta) children.push(p(`Best CTA: ${c.best_cta}`, { color: PRIMARY }));
      if (c.comment) children.push(p(c.comment, { color: MUTED, size: 20 }));
    });
  }

  if (data.jtbd_segments.length) {
    children.push(h1('5. JTBD-сегменты'));
    children.push(jtbdTable(data.jtbd_segments));
  }

  if (data.journey_stages.length) {
    children.push(h1('6. Сегменты по этапам пути клиента'));
    children.push(journeyTable(data.journey_stages));
  }

  if (data.wedges.length) {
    children.push(h1('7. Wedges (точки входа)'));
    data.wedges.forEach((w) => {
      children.push(h2(w.wedge));
      if (w.segment) children.push(p(`Сегмент: ${w.segment}`, { color: MUTED, size: 20 }));
      if (w.why_attractive) children.push(p(w.why_attractive));
      if (w.needed_assets.length) {
        children.push(p('Нужные assets:', { bold: true, color: MUTED, size: 20 }));
        w.needed_assets.forEach((a) => children.push(bullet(a)));
      }
      const fitRu = w.fit_for_project === 'high' ? 'Высокий' : w.fit_for_project === 'low' ? 'Низкий' : 'Средний';
      children.push(p(`Fit для проекта: ${fitRu}`, { color: PRIMARY }));
    });
  }

  children.push(h1('8. Phased segment roadmap'));
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
              new TextRun({ text: 'SEO-Аудит · Сегменты аудитории · ', size: 18, color: MUTED }),
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
  saveAs(blob, `audience-segments-${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}