import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Footer, PageNumber, LevelFormat, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { DemandMapData, Level, BusinessValue } from '@/components/analytics/DemandMapView';

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
function bullet(text: string, ref = 'bullets') {
  return new Paragraph({
    numbering: { reference: ref, level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
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
function lvlRu(l: Level) { return l === 'High' ? 'Высокий' : l === 'Low' ? 'Низкий' : 'Средний'; }
function lvlColor(l: Level) { return l === 'High' ? SUCCESS : l === 'Low' ? DANGER : WARN; }
function lvlColorInv(l: Level) { return l === 'High' ? DANGER : l === 'Low' ? SUCCESS : WARN; }
function bvRu(b: BusinessValue) { return b === 'High' ? 'Высокая' : b === 'Low' ? 'Низкая' : 'Средняя'; }

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

function scoringTable(s: DemandMapData['scoring']) {
  const widths = [4200, 2400, 2800];
  const rows = [
    thRow(['Метрика', 'Значение', 'Оценка'], widths),
    tdRow(['Привлекательность ниши',
      { text: `${s.overall_attractiveness}/100`, bold: true, color: scoreColor(s.overall_attractiveness) },
      s.overall_attractiveness >= 70 ? 'Высокая' : s.overall_attractiveness >= 40 ? 'Средняя' : 'Низкая'], widths),
    tdRow(['Коммерческая ценность',
      { text: `${s.commercial_value}/100`, bold: true, color: scoreColor(s.commercial_value) },
      s.commercial_value >= 70 ? 'Высокая' : s.commercial_value >= 40 ? 'Средняя' : 'Низкая'], widths),
    tdRow(['Устойчивость к AI',
      { text: `${s.ai_resilience}/100`, bold: true, color: scoreColor(s.ai_resilience) },
      s.ai_resilience >= 70 ? 'Высокая' : s.ai_resilience >= 40 ? 'Средняя' : 'Низкая'], widths),
    tdRow(['Реализуемость доверия (E-E-A-T)',
      { text: `${s.trust_feasibility}/100`, bold: true, color: scoreColor(s.trust_feasibility) },
      s.trust_feasibility >= 70 ? 'Высокая' : s.trust_feasibility >= 40 ? 'Средняя' : 'Низкая'], widths),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function journeyTable(items: DemandMapData['buyer_journey']) {
  const widths = [2800, 1400, 1600, 3600];
  const rows = [
    thRow(['Стадия', 'Сила спроса', 'Ценность', 'Примеры запросов'], widths),
    ...items.map((j) => tdRow([
      { text: j.stage, bold: true },
      { text: `${j.demand_strength_percent}%`, bold: true, color: PRIMARY },
      { text: bvRu(j.business_value), color: lvlColor(j.business_value as Level), bold: true },
      j.queries.join(' · ') || '—',
    ], widths)),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function intentTable(d: DemandMapData['intent_distribution']) {
  const widths = [4700, 2350, 2350];
  const rows = [
    thRow(['Тип намерения', 'Доля', 'Что это'], widths),
    tdRow([{ text: 'Коммерческий', bold: true }, { text: `${d.commercial}%`, bold: true, color: PRIMARY }, 'Намерение купить / выбрать поставщика'], widths),
    tdRow([{ text: 'Информационный', bold: true }, { text: `${d.informational}%`, bold: true, color: PRIMARY }, 'Узнать, как / что такое / почему'], widths),
    tdRow([{ text: 'Локальный', bold: true }, { text: `${d.local}%`, bold: true, color: PRIMARY }, 'Запросы с географией («рядом», «в городе»)'], widths),
    tdRow([{ text: 'Поддержка', bold: true }, { text: `${d.support}%`, bold: true, color: PRIMARY }, 'Запросы существующих пользователей: FAQ, инструкции'], widths),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function clustersTable(items: { cluster: string; reason: string }[], reasonHeader: string) {
  const widths = [3200, 6200];
  const rows = [
    thRow(['Кластер', reasonHeader], widths),
    ...items.map((c) => tdRow([{ text: c.cluster, bold: true }, c.reason || '—'], widths)),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function trustAdjustedTable(items: DemandMapData['barriers']['trust_adjusted']) {
  const widths = [3400, 2000, 2000, 2000];
  const rows = [
    thRow(['Кластер', 'Спрос (raw)', 'Требования E-E-A-T', 'Доступность'], widths),
    ...items.map((t) => tdRow([
      { text: t.cluster, bold: true },
      { text: lvlRu(t.raw_demand), color: lvlColor(t.raw_demand), bold: true },
      { text: lvlRu(t.ee_a_t_requirement), color: lvlColorInv(t.ee_a_t_requirement), bold: true },
      { text: lvlRu(t.accessibility), color: lvlColor(t.accessibility), bold: true },
    ], widths)),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function aiSerpTable(a: DemandMapData['barriers']['ai_and_serp']) {
  const widths = [4700, 2350, 2350];
  const rows = [
    thRow(['Параметр', 'Значение', 'Что значит'], widths),
    tdRow(['Потенциал в AI-выдаче (AI upside)', { text: `${a.ai_upside}/100`, bold: true, color: scoreColor(a.ai_upside) }, 'Шанс быть процитированным в AI-ответах'], widths),
    tdRow(['Открытость SERP', { text: `${a.serp_openness}/100`, bold: true, color: scoreColor(a.serp_openness) }, 'Свободные слоты в ТОП-10 (не маркетплейсы/агрегаторы)'], widths),
    tdRow(['Риск zero-click', { text: `${a.zero_click_risk}/100`, bold: true, color: scoreColor(100 - a.zero_click_risk) }, 'Доля запросов с ответом прямо в выдаче (минус трафик)'], widths),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function phaseBlock(title: string, phase: { targets: string[]; page_types: string[] }) {
  const out: (Paragraph | Table)[] = [];
  out.push(p(title, { bold: true, color: PRIMARY, size: 24 }));
  if (phase.targets.length) {
    out.push(p('Цели этапа:', { bold: true, color: MUTED, size: 20 }));
    phase.targets.forEach((t) => out.push(bullet(t)));
  }
  if (phase.page_types.length) {
    out.push(p('Типы страниц:', { bold: true, color: MUTED, size: 20 }));
    phase.page_types.forEach((t) => out.push(bullet(t)));
  }
  return out;
}

export async function exportDemandMapDocx(niche: string, data: DemandMapData) {
  const children: (Paragraph | Table)[] = [];

  // Cover
  children.push(new Paragraph({
    spacing: { before: 200, after: 60 }, alignment: AlignmentType.LEFT,
    children: [new TextRun({ text: 'КАРТА СПРОСА · SEO-АУДИТ', bold: true, size: 22, color: PRIMARY })],
  }));
  children.push(new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text: niche || '—', bold: true, size: 44, color: '111827' })],
  }));
  children.push(p('Risk-adjusted demand map: путь покупателя, распределение намерений, vanity vs value, барьеры доверия и sequencing roadmap.', { color: MUTED, size: 22 }));
  children.push(p(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, { color: MUTED, size: 20 }));
  children.push(divider());

  // 1. Scoring
  children.push(h1('1. Оценка ниши с поправкой на риски'));
  children.push(scoringTable(data.scoring));
  if (data.scoring.scoring_reasoning) {
    children.push(new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: data.scoring.scoring_reasoning, size: 22, color: '374151' })] }));
  }

  // 2. Executive summary
  children.push(h1('2. Executive summary'));
  children.push(h2('Сильнейшие слои'));
  children.push(p(data.executive_summary.strongest_layers || '—'));
  children.push(h2('Главные риски'));
  children.push(p(data.executive_summary.main_risks || '—', { color: DANGER }));

  if (data.executive_summary.top_5_quick_wins.length) {
    children.push(h2('Топ-5 быстрых побед'));
    data.executive_summary.top_5_quick_wins.forEach((w) => children.push(bullet(w)));
  }
  if (data.executive_summary.top_5_avoid_zones.length) {
    children.push(h2('Топ-5 зон, куда не идти'));
    data.executive_summary.top_5_avoid_zones.forEach((w) => children.push(bullet(w)));
  }

  // 3. Buyer journey
  if (data.buyer_journey.length) {
    children.push(h1('3. Путь покупателя: сила спроса по стадиям'));
    children.push(journeyTable(data.buyer_journey));
  }

  // 4. Intent distribution
  children.push(h1('4. Распределение намерений пользователей'));
  children.push(intentTable(data.intent_distribution));

  // 5. Vanity vs value
  children.push(h1('5. Денежные и ложные кластеры'));
  if (data.vanity_vs_value.high_value.length) {
    children.push(h2('Денежные кластеры (high-value)'));
    children.push(clustersTable(data.vanity_vs_value.high_value, 'Почему ценный'));
  }
  if (data.vanity_vs_value.vanity_misleading.length) {
    children.push(h2('Ложные кластеры (vanity)'));
    children.push(clustersTable(data.vanity_vs_value.vanity_misleading, 'Почему ложный спрос'));
  }

  // 6. Barriers
  children.push(h1('6. Барьеры доверия и доступности'));
  if (data.barriers.trust_adjusted.length) {
    children.push(h2('Trust-adjusted кластеры'));
    children.push(trustAdjustedTable(data.barriers.trust_adjusted));
  }
  children.push(h2('AI-выдача и SERP'));
  children.push(aiSerpTable(data.barriers.ai_and_serp));

  // 7. Roadmap
  children.push(h1('7. Дорожная карта запуска'));
  phaseBlock('Первые 30 дней', data.sequencing_roadmap.first_30_days).forEach((c) => children.push(c));
  phaseBlock('Первый квартал', data.sequencing_roadmap.first_quarter).forEach((c) => children.push(c));
  phaseBlock('6–12 месяцев', data.sequencing_roadmap.months_6_to_12).forEach((c) => children.push(c));

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
              new TextRun({ text: 'SEO-Аудит · Карта спроса · ', size: 18, color: MUTED }),
              new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED }),
            ],
          })],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safeName = (niche || 'niche').replace(/[^a-zA-Z0-9а-яА-Я0-9\-_]+/g, '-').slice(0, 60);
  saveAs(blob, `demand-map-${safeName}-${new Date().toISOString().slice(0, 10)}.docx`);
}