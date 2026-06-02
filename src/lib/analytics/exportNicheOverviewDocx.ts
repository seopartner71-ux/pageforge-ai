import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Header, Footer, PageNumber, LevelFormat,
} from 'docx';
import { saveAs } from 'file-saver';

export type NicheReportData = {
  scoring: { searchOpp: number; commercial: number; trust: number; aiRisk: number };
  executive_summary: {
    verdict: string;
    top_subniches: string[];
    roadmap: { '3_months': string; '6_months': string; '12_months': string };
  };
  market: {
    size_estimate: string;
    growth_rate: string;
    key_players: { name: string; share: number }[];
    white_spaces: string[];
  };
  barriers: {
    eeat: { name: string; level: 'low' | 'mid' | 'high'; note: string }[];
    capital: string;
    regulation: string;
  };
  strategy: {
    wedges: { title: string; description: string; effort: string; impact: string }[];
    risks: string[];
  };
};

const PRIMARY = '3B82F6';
const MUTED = '6B7280';
const BORDER = 'E5E7EB';
const SUCCESS = '10B981';
const WARN = 'F59E0B';
const DANGER = 'EF4444';

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 160 },
    children: [new TextRun({ text, bold: true, size: 32, color: '111827' })],
  });
}
function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 220, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: '111827' })],
  });
}
function p(text: string, opts: { color?: string; bold?: boolean; size?: number } = {}) {
  return new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text, color: opts.color, bold: opts.bold, size: opts.size ?? 22 })],
  });
}
function bullet(text: string) {
  return new Paragraph({
    numbering: { reference: 'bullets', level: 0 },
    spacing: { after: 60 },
    children: [new TextRun({ text, size: 22 })],
  });
}
function divider() {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 1 } },
    spacing: { before: 60, after: 200 },
    children: [new TextRun('')],
  });
}

function scoreColor(value: number, invert = false) {
  const v = invert ? 100 - value : value;
  if (v >= 70) return SUCCESS;
  if (v >= 40) return WARN;
  return DANGER;
}

function levelLabel(level: 'low' | 'mid' | 'high') {
  if (level === 'high') return { text: 'ВЫСОКИЙ', color: DANGER };
  if (level === 'mid') return { text: 'СРЕДНИЙ', color: WARN };
  return { text: 'НИЗКИЙ', color: SUCCESS };
}

function tableHeader(cells: string[], widths: number[]) {
  return new TableRow({
    tableHeader: true,
    children: cells.map((c, i) => new TableCell({
      borders: cellBorders,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: 'F3F4F6', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 20, color: '111827' })] })],
    })),
  });
}
function tableRow(cells: (string | { text: string; color?: string; bold?: boolean })[], widths: number[]) {
  return new TableRow({
    children: cells.map((c, i) => {
      const obj = typeof c === 'string' ? { text: c } : c;
      return new TableCell({
        borders: cellBorders,
        width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: obj.text, size: 20, color: obj.color, bold: obj.bold })] })],
      });
    }),
  });
}

function scoringTable(s: NicheReportData['scoring']) {
  const widths = [3600, 2800, 3000];
  const rows = [
    tableHeader(['Метрика', 'Значение', 'Оценка'], widths),
    tableRow([
      'Поисковый потенциал (Search Opportunity)',
      { text: `${s.searchOpp}/100`, bold: true, color: scoreColor(s.searchOpp) },
      s.searchOpp >= 70 ? 'Высокий' : s.searchOpp >= 40 ? 'Средний' : 'Низкий',
    ], widths),
    tableRow([
      'Коммерческий потенциал',
      { text: `${s.commercial}/100`, bold: true, color: scoreColor(s.commercial) },
      s.commercial >= 70 ? 'Высокий' : s.commercial >= 40 ? 'Средний' : 'Низкий',
    ], widths),
    tableRow([
      'Уровень доверия (Trust / E-E-A-T)',
      { text: `${s.trust}/100`, bold: true, color: scoreColor(s.trust) },
      s.trust >= 70 ? 'Высокий' : s.trust >= 40 ? 'Средний' : 'Низкий',
    ], widths),
    tableRow([
      'AI-риск (вытеснение AI-ответами)',
      { text: `${s.aiRisk}/100`, bold: true, color: scoreColor(s.aiRisk, true) },
      s.aiRisk >= 70 ? 'Высокий' : s.aiRisk >= 40 ? 'Средний' : 'Низкий',
    ], widths),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function playersTable(players: { name: string; share: number }[]) {
  const widths = [5400, 2000, 2000];
  const rows = [
    tableHeader(['Игрок', 'Доля рынка', 'Статус'], widths),
    ...players.map((pl) => tableRow([
      pl.name,
      { text: `${pl.share}%`, bold: true },
      pl.share >= 25 ? 'Лидер' : pl.share >= 10 ? 'Игрок' : 'Малый',
    ], widths)),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function eeatTable(items: NicheReportData['barriers']['eeat']) {
  const widths = [3000, 1800, 4600];
  const rows = [
    tableHeader(['Фактор', 'Барьер', 'Комментарий'], widths),
    ...items.map((e) => {
      const lvl = levelLabel(e.level);
      return tableRow([
        { text: e.name, bold: true },
        { text: lvl.text, bold: true, color: lvl.color },
        e.note,
      ], widths);
    }),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

function wedgesTable(wedges: NicheReportData['strategy']['wedges']) {
  const widths = [2600, 4600, 1100, 1100];
  const rows = [
    tableHeader(['Стратегия', 'Описание', 'Усилия', 'Импакт'], widths),
    ...wedges.map((w) => tableRow([
      { text: w.title, bold: true },
      w.description,
      w.effort,
      { text: w.impact, bold: true, color: PRIMARY },
    ], widths)),
  ];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows });
}

export async function exportNicheOverviewDocx(opts: {
  niche: string;
  data: NicheReportData;
  meta?: { geo?: string; businessType?: string; monetization?: string; audience?: string; horizon?: string };
}) {
  const { niche, data, meta = {} } = opts;
  const today = new Date().toLocaleDateString('ru-RU');

  const children: Paragraph[] | (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: 'AI-АНАЛИЗ НИШИ', bold: true, size: 22, color: PRIMARY })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: niche, bold: true, size: 44, color: '111827' })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Профессиональный отчёт для клиента  ·  ${today}`, color: MUTED, size: 20 })],
    }),
    divider(),

    h1('1. Параметры анализа'),
    ...[
      ['Ниша', niche],
      ['Гео', meta.geo || '—'],
      ['Тип бизнеса', meta.businessType || '—'],
      ['Монетизация', meta.monetization || '—'],
      ['Целевая аудитория', meta.audience || '—'],
      ['Горизонт планирования', meta.horizon ? `${meta.horizon} мес.` : '—'],
    ].map(([k, v]) => new Paragraph({
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${k}: `, bold: true, size: 22 }),
        new TextRun({ text: String(v), size: 22, color: '374151' }),
      ],
    })),

    h1('2. Резюме (Executive Summary)'),
    h2('Вердикт'),
    p(data.executive_summary.verdict, { size: 22 }),
    h2('Топ-подниши для входа'),
    ...data.executive_summary.top_subniches.map((s, i) => bullet(`${i + 1}. ${s}`)),
    h2('Дорожная карта'),
    p('Этап 1 (3 месяца):', { bold: true, color: PRIMARY }),
    p(data.executive_summary.roadmap['3_months']),
    p('Этап 2 (6 месяцев):', { bold: true, color: PRIMARY }),
    p(data.executive_summary.roadmap['6_months']),
    p('Этап 3 (12 месяцев):', { bold: true, color: PRIMARY }),
    p(data.executive_summary.roadmap['12_months']),

    h1('3. Scoring-модель ниши'),
    p('Комплексная оценка по 4 ключевым метрикам (шкала 0–100).', { color: MUTED }),
    scoringTable(data.scoring),

    h1('4. Рынок'),
    p(`Объём рынка: ${data.market.size_estimate}`, { bold: true }),
    p(`Темп роста: ${data.market.growth_rate}`, { bold: true, color: SUCCESS }),
    h2('Ключевые игроки и распределение долей'),
    playersTable(data.market.key_players),
    h2('White Spaces — свободные зоны для входа'),
    ...data.market.white_spaces.map((w) => bullet(w)),

    h1('5. Барьеры входа'),
    h2('E-E-A-T факторы'),
    eeatTable(data.barriers.eeat),
    h2('Капитальные требования'),
    p(data.barriers.capital),
    h2('Регулирование'),
    p(data.barriers.regulation),

    h1('6. Стратегия входа'),
    h2('Wedges — точки прорыва'),
    wedgesTable(data.strategy.wedges),
    h2('Риски'),
    ...data.strategy.risks.map((r) => bullet(r)),

    divider(),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({
        text: 'Отчёт сгенерирован платформой SEO-Аудит на основе AI-анализа',
        italics: true, color: MUTED, size: 18,
      })],
    }),
  ];

  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `Анализ ниши: ${niche}`,
    styles: {
      default: { document: { run: { font: 'Inter', size: 22 } } },
    },
    numbering: {
      config: [{
        reference: 'bullets',
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1200, right: 1200, bottom: 1200, left: 1200 },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'SEO-Аудит  ·  AI-анализ ниши', color: MUTED, size: 18 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Страница ', color: MUTED, size: 18 }),
              new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 18 }),
              new TextRun({ text: ' из ', color: MUTED, size: 18 }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 18 }),
            ],
          })],
        }),
      },
      children: children as any,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = niche.replace(/[^\p{L}\p{N}\s-]+/gu, '').trim().slice(0, 60) || 'niche';
  saveAs(blob, `Анализ ниши — ${safe}.docx`);
}