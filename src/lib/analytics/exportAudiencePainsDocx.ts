import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Footer, PageNumber, LevelFormat, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AudiencePainsData, RoadmapPhase } from '@/components/analytics/AudiencePainsView';

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

function scoringTable(s: AudiencePainsData['scoring']) {
  const widths = [4400, 2400, 2600];
  const label = (v: number) => v >= 70 ? 'Высокая' : v >= 40 ? 'Средняя' : 'Низкая';
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Метрика', 'Значение', 'Оценка'], widths),
    tdRow(['Overall Problem Opportunity', { text: `${s.overall_problem_opportunity}/100`, bold: true, color: scoreColor(s.overall_problem_opportunity) }, label(s.overall_problem_opportunity)], widths),
    tdRow(['Pain Intensity', { text: `${s.pain_intensity}/100`, bold: true, color: scoreColor(s.pain_intensity) }, label(s.pain_intensity)], widths),
    tdRow(['Monetization Relevance', { text: `${s.monetization_relevance}/100`, bold: true, color: scoreColor(s.monetization_relevance) }, label(s.monetization_relevance)], widths),
    tdRow(['Trust Feasibility', { text: `${s.trust_feasibility}/100`, bold: true, color: scoreColor(s.trust_feasibility) }, label(s.trust_feasibility)], widths),
    tdRow(['AI Opportunity', { text: `${s.ai_opportunity}/100`, bold: true, color: scoreColor(s.ai_opportunity) }, label(s.ai_opportunity)], widths),
  ]});
}

function clustersTable(items: AudiencePainsData['problem_clusters']) {
  const widths = [2300, 1400, 2900, 2800];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Кластер', 'Sev/Urg/Conv', 'Root cause', 'Реальный язык + страница'], widths),
    ...items.map((c) => tdRow([
      { text: c.name, bold: true },
      { text: `${c.severity}/${c.urgency}/${c.conversion_proximity}`, color: scoreColor(Math.round((c.severity + c.urgency + c.conversion_proximity) / 3)), bold: true },
      c.root_cause || '—',
      { text: `«${c.real_language || '—'}» · ${c.best_page_type || '—'}`, italic: true },
    ], widths)),
  ]});
}

function journeyTable(items: AudiencePainsData['journey_stages']) {
  const widths = [2000, 3700, 2400, 1300];
  const valRu = (v: string) => v === 'high' ? 'Высокая' : v === 'low' ? 'Низкая' : 'Средняя';
  const valColor = (v: string) => v === 'high' ? SUCCESS : v === 'low' ? MUTED : PRIMARY;
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Стадия', 'Главные проблемы', 'Assets', 'Ценность'], widths),
    ...items.map((j) => tdRow([
      { text: j.stage, bold: true },
      j.dominant_problems.join(' · ') || '—',
      j.assets_needed.join(' · ') || '—',
      { text: valRu(j.business_value), color: valColor(j.business_value), bold: true },
    ], widths)),
  ]});
}

function falseTable(items: AudiencePainsData['false_problems']) {
  const widths = [3000, 4500, 1900];
  const actRu = (a: string) => a === 'ignore' ? 'Игнорировать' : a === 'downplay' ? 'Снизить приоритет' : 'Переформулировать';
  const actColor = (a: string) => a === 'ignore' ? DANGER : a === 'downplay' ? WARN : PRIMARY;
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Проблема', 'Почему переоценена', 'Действие'], widths),
    ...items.map((f) => tdRow([
      { text: f.problem, bold: true },
      f.why_misleading || '—',
      { text: actRu(f.action), color: actColor(f.action), bold: true },
    ], widths)),
  ]});
}

function phaseBlock(title: string, phase: RoadmapPhase) {
  const out: (Paragraph | Table)[] = [];
  out.push(p(title, { bold: true, color: PRIMARY, size: 24 }));
  if (phase.expected_kpi) out.push(p(`KPI: ${phase.expected_kpi}`, { color: MUTED, size: 20 }));
  if (phase.problems_to_target.length) {
    out.push(p('Проблемы таргетировать:', { bold: true, color: MUTED, size: 20 }));
    phase.problems_to_target.forEach((t) => out.push(bullet(t)));
  }
  if (phase.assets_to_build.length) {
    out.push(p('Assets строить:', { bold: true, color: MUTED, size: 20 }));
    phase.assets_to_build.forEach((t) => out.push(bullet(t)));
  }
  return out;
}

export async function exportAudiencePainsDocx(niche: string, data: AudiencePainsData) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: 'ПРОБЛЕМЫ АУДИТОРИИ · SEO-АУДИТ', bold: true, size: 22, color: PRIMARY })],
  }));
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: niche || '—', bold: true, size: 44, color: '111827' })],
  }));
  children.push(p('Decision-grade problem map: реальные боли, root causes, скрытые и ложные проблемы, привязка к страницам и конверсии.', { color: MUTED }));
  children.push(p(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, { color: MUTED, size: 20 }));
  children.push(divider());

  children.push(h1('1. Scoring framework'));
  children.push(scoringTable(data.scoring));
  if (data.scoring.reasoning) {
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: data.scoring.reasoning, size: 22, color: '374151' })] }));
  }

  children.push(h1('2. Executive verdict'));
  const lvlRu = data.executive_verdict.pain_driven_level === 'high' ? 'Высокий'
    : data.executive_verdict.pain_driven_level === 'low' ? 'Низкий' : 'Средний';
  children.push(p(`Уровень pain-driven: ${lvlRu}`, { color: PRIMARY, bold: true }));
  children.push(p(`Стратегическая модель: ${data.executive_verdict.strategy_model}`, { color: PRIMARY, bold: true }));
  children.push(h2('Картина болей'));
  children.push(p(data.executive_verdict.overview || '—'));
  children.push(h2('Главный риск'));
  children.push(p(data.executive_verdict.main_risk || '—', { color: DANGER }));
  children.push(h2('Главная возможность'));
  children.push(p(data.executive_verdict.main_opportunity || '—', { color: SUCCESS }));

  children.push(h1('3. Топ-листы проблем'));
  const lists: [string, string[], string][] = [
    ['Core проблемы', data.top_lists.core_problems, DANGER],
    ['Высокая конверсия', data.top_lists.high_conversion_problems, SUCCESS],
    ['Быстрые победы', data.top_lists.quick_wins, PRIMARY],
    ['Недоработанные кластеры', data.top_lists.neglected_clusters, VIOLET],
    ['Trust-sensitive', data.top_lists.trust_sensitive, WARN],
    ['Переоценённые (избегать)', data.top_lists.overhyped_avoid, DANGER],
    ['Типы страниц для запуска', data.top_lists.recommended_page_types, PRIMARY],
  ];
  for (const [title, items, color] of lists) {
    if (items.length === 0) continue;
    children.push(h2(title));
    items.forEach((t) => children.push(bullet(t, color)));
  }

  if (data.problem_clusters.length) {
    children.push(h1('4. Кластеры проблем'));
    children.push(clustersTable(data.problem_clusters));
    data.problem_clusters.forEach((c) => {
      if (c.comment) {
        children.push(p(`${c.name}: ${c.comment}`, { color: MUTED, size: 20 }));
      }
    });
  }

  if (data.journey_stages.length) {
    children.push(h1('5. Проблемы по этапам пути клиента'));
    children.push(journeyTable(data.journey_stages));
  }

  if (data.segments.length) {
    children.push(h1('6. Сегменты аудитории'));
    data.segments.forEach((sg) => {
      children.push(h2(sg.segment));
      if (sg.main_problems.length) {
        children.push(p('Главные проблемы:', { bold: true, color: MUTED, size: 20 }));
        sg.main_problems.forEach((mp) => children.push(bullet(mp)));
      }
      if (sg.pain_language) children.push(p(`Язык: «${sg.pain_language}»`, { italic: true, color: '374151' }));
      if (sg.content_implication) children.push(p(`Импликация для контента: ${sg.content_implication}`, { color: MUTED, size: 20 }));
    });
  }

  if (data.hidden_problems.length) {
    children.push(h1('7. Скрытые проблемы'));
    data.hidden_problems.forEach((h) => {
      children.push(p(h.problem, { bold: true, color: VIOLET }));
      children.push(p(`Почему скрыт: ${h.why_hidden}`, { color: MUTED, size: 20 }));
      children.push(p(`Как закрывать: ${h.how_to_close}`));
    });
  }

  if (data.false_problems.length) {
    children.push(h1('8. Ложные / переоценённые проблемы'));
    children.push(falseTable(data.false_problems));
  }

  children.push(h1('9. Phased problem roadmap'));
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
              new TextRun({ text: 'SEO-Аудит · Проблемы аудитории · ', size: 18, color: MUTED }),
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
  saveAs(blob, `audience-pains-${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}