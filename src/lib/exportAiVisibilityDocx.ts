import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, ImageRun,
} from 'docx';
import { saveAs } from 'file-saver';
import { renderVBarChartPng, renderHBarChartPng, renderDonutChartPng } from './docx/charts';

export interface AiVisRow {
  keyword: string;
  model: string;
  brand_mentioned: boolean;
  domain_linked: boolean;
  sentiment: string | null;
  competitor_domains: string[];
  ai_response_text: string | null;
  checked_at: string;
}

export interface AiVisReport {
  brandName: string;
  domain: string;
  language: string;
  modelStats: { model: string; total: number; visible: number; som: number }[];
  topCompetitors: [string, number][];
  rows: AiVisRow[];
}

const COLOR_ACCENT = '2E75B6';
const COLOR_TEXT = '1F2937';
const COLOR_MUTED = '6B7280';
const COLOR_PASS = '047857';
const COLOR_FAIL = 'B91C1C';
const COLOR_BORDER = 'D1D5DB';
const COLOR_HEAD_BG = 'EEF2F7';

const fmtDate = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const fmtFile = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const border = (color: string) => ({ style: BorderStyle.SINGLE, size: 4, color });
const cellBorders = {
  top: border(COLOR_BORDER), bottom: border(COLOR_BORDER),
  left: border(COLOR_BORDER), right: border(COLOR_BORDER),
};
const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

function p(text: string, opts: { bold?: boolean; color?: string; size?: number; align?: any } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [new TextRun({
      text, bold: opts.bold, color: opts.color || COLOR_TEXT, size: opts.size || 22, font: 'Arial',
    })],
  });
}
function h(text: string, level: typeof HeadingLevel[keyof typeof HeadingLevel], color = COLOR_ACCENT) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, color, font: 'Arial' })],
  });
}
function headCell(text: string, width: number) {
  return new TableCell({
    borders: cellBorders, margins: cellMargins,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: COLOR_HEAD_BG, type: ShadingType.CLEAR, color: 'auto' },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20, font: 'Arial', color: COLOR_TEXT })] })],
  });
}
function cell(children: Paragraph[], width: number) {
  return new TableCell({ borders: cellBorders, margins: cellMargins, width: { size: width, type: WidthType.DXA }, children });
}
const txt = (s: string, color = COLOR_TEXT, bold = false) =>
  new Paragraph({ children: [new TextRun({ text: s, color, bold, size: 20, font: 'Arial' })] });

const MODEL_LABELS: Record<string, string> = {
  gemini_flash: 'Gemini', chatgpt: 'ChatGPT', perplexity: 'Perplexity',
  claude: 'Claude', deepseek: 'DeepSeek', mistral: 'Mistral', llama: 'Llama',
};
const ml = (m: string) => MODEL_LABELS[m] || m;

export async function exportAiVisibilityDocx(report: AiVisReport) {
  const now = new Date();
  const totalChecks = report.rows.length;
  const visibleChecks = report.rows.filter(r => r.brand_mentioned || r.domain_linked).length;
  const overallSom = totalChecks ? Math.round((visibleChecks / totalChecks) * 100) : 0;

  // === Charts ===
  const somChart = report.modelStats.length
    ? await renderVBarChartPng(
        report.modelStats.map((s) => ({ label: ml(s.model), value: s.som })),
        { title: 'Видимость бренда по моделям (Share of Model, %)', maxValue: 100, valueSuffix: '%', width: 900, height: 320 },
      )
    : null;

  const competitorsChart = report.topCompetitors.length
    ? await renderHBarChartPng(
        report.topCompetitors.slice(0, 10).map(([d, n]) => ({ label: d, value: n })),
        { title: 'Топ-10 конкурентов в ответах ИИ', width: 900 },
      )
    : null;

  const visibilityDonut = await renderDonutChartPng(
    [
      { label: 'Бренд упомянут', value: visibleChecks, color: '#10B981' },
      { label: 'Не упомянут', value: Math.max(0, totalChecks - visibleChecks), color: '#E5E7EB' },
    ],
    { title: 'Общая видимость бренда', width: 720, height: 320 },
  );

  const chartImg = (data: Uint8Array, w: number, h: number) =>
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 120, after: 120 },
      children: [new ImageRun({ type: 'png', data, transformation: { width: w, height: h }, altText: { title: 'chart', description: 'chart', name: 'chart' } })],
    });

  const summaryTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 6240],
    rows: [
      new TableRow({ children: [headCell('Параметр', 3120), headCell('Значение', 6240)] }),
      new TableRow({ children: [cell([txt('Бренд', COLOR_MUTED)], 3120), cell([txt(report.brandName, COLOR_TEXT, true)], 6240)] }),
      new TableRow({ children: [cell([txt('Домен', COLOR_MUTED)], 3120), cell([txt(report.domain)], 6240)] }),
      new TableRow({ children: [cell([txt('Язык', COLOR_MUTED)], 3120), cell([txt(report.language.toUpperCase())], 6240)] }),
      new TableRow({ children: [cell([txt('Дата отчёта', COLOR_MUTED)], 3120), cell([txt(fmtDate(now))], 6240)] }),
      new TableRow({ children: [cell([txt('Всего проверок', COLOR_MUTED)], 3120), cell([txt(String(totalChecks), COLOR_TEXT, true)], 6240)] }),
      new TableRow({ children: [cell([txt('Видимость бренда', COLOR_MUTED)], 3120), cell([txt(`${overallSom}% (${visibleChecks}/${totalChecks})`, overallSom >= 50 ? COLOR_PASS : COLOR_FAIL, true)], 6240)] }),
    ],
  });

  const somHeaderRow = new TableRow({ children: [
    headCell('Модель', 3120), headCell('Проверок', 1560), headCell('Упомянут', 1560), headCell('Видимость (SOM)', 3120),
  ]});
  const somRows = report.modelStats.map(s => new TableRow({ children: [
    cell([txt(ml(s.model), COLOR_TEXT, true)], 3120),
    cell([txt(String(s.total))], 1560),
    cell([txt(String(s.visible))], 1560),
    cell([txt(`${s.som}%`, s.som >= 50 ? COLOR_PASS : COLOR_FAIL, true)], 3120),
  ]}));
  const somTable = new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [3120, 1560, 1560, 3120], rows: [somHeaderRow, ...somRows] });

  const compHeader = new TableRow({ children: [headCell('Конкурент', 7020), headCell('Упоминаний', 2340)] });
  const compRows = report.topCompetitors.length
    ? report.topCompetitors.map(([d, n]) => new TableRow({ children: [cell([txt(d)], 7020), cell([txt(String(n), COLOR_ACCENT, true)], 2340)] }))
    : [new TableRow({ children: [cell([txt('Конкуренты не обнаружены', COLOR_MUTED)], 7020), cell([txt('—', COLOR_MUTED)], 2340)] })];
  const compTable = new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [7020, 2340], rows: [compHeader, ...compRows] });

  // Detailed results grouped by keyword
  const byKw = new Map<string, AiVisRow[]>();
  for (const r of report.rows) {
    const arr = byKw.get(r.keyword) || [];
    arr.push(r); byKw.set(r.keyword, arr);
  }

  const detailBlocks: (Paragraph | Table)[] = [];
  for (const [kw, rows] of byKw) {
    detailBlocks.push(h(`Запрос: ${kw}`, HeadingLevel.HEADING_3, COLOR_TEXT));
    const header = new TableRow({ children: [
      headCell('Модель', 1800), headCell('Бренд', 1200), headCell('Домен', 1200), headCell('Тон', 1200), headCell('Конкуренты', 3960),
    ]});
    const trs = rows.map(r => new TableRow({ children: [
      cell([txt(ml(r.model), COLOR_TEXT, true)], 1800),
      cell([txt(r.brand_mentioned ? 'Да' : 'Нет', r.brand_mentioned ? COLOR_PASS : COLOR_MUTED, true)], 1200),
      cell([txt(r.domain_linked ? 'Да' : 'Нет', r.domain_linked ? COLOR_PASS : COLOR_MUTED, true)], 1200),
      cell([txt(r.sentiment || '—')], 1200),
      cell([txt((r.competitor_domains || []).join(', ') || '—', COLOR_MUTED)], 3960),
    ]}));
    detailBlocks.push(new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: [1800, 1200, 1200, 1200, 3960], rows: [header, ...trs] }));

    // AI answers
    for (const r of rows) {
      if (!r.ai_response_text) continue;
      detailBlocks.push(new Paragraph({
        spacing: { before: 120, after: 40 },
        children: [new TextRun({ text: `${ml(r.model)} — полный ответ:`, bold: true, size: 20, color: COLOR_ACCENT, font: 'Arial' })],
      }));
      const lines = r.ai_response_text.split(/\n+/).filter(Boolean);
      for (const line of lines) {
        detailBlocks.push(new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: line, size: 20, color: COLOR_TEXT, font: 'Arial' })],
        }));
      }
    }
  }

  const doc = new Document({
    creator: 'SEO-Аудит',
    title: `Отчёт по видимости в ИИ — ${report.brandName}`,
    styles: { default: { document: { run: { font: 'Arial', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1440, bottom: 1080, left: 1440 } } },
      headers: { default: new Header({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: `Видимость в ИИ ответах · ${report.brandName}`, size: 18, color: COLOR_MUTED, font: 'Arial' })],
      })] }) },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: 'Страница ', size: 18, color: COLOR_MUTED, font: 'Arial' }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: COLOR_MUTED, font: 'Arial' }),
          new TextRun({ text: ' из ', size: 18, color: COLOR_MUTED, font: 'Arial' }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, color: COLOR_MUTED, font: 'Arial' }),
        ],
      })] }) },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 120 },
          children: [new TextRun({ text: 'Отчёт по видимости в ИИ-ответах', bold: true, size: 40, color: COLOR_ACCENT, font: 'Arial' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: `${report.brandName} · ${report.domain} · ${fmtDate(now)}`, size: 22, color: COLOR_MUTED, font: 'Arial' })],
        }),
        h('1. Сводка', HeadingLevel.HEADING_1),
        summaryTable,
        p(''),
        chartImg(visibilityDonut, 540, 240),
        p('Отчёт показывает, как ваш бренд представлен в ответах ведущих генеративных ИИ-моделей. Чем выше показатель видимости (SOM), тем чаще модели упоминают ваш бренд или ссылаются на ваш домен в ответах на целевые запросы.', { color: COLOR_MUTED }),

        h('2. Видимость по моделям (Share of Model)', HeadingLevel.HEADING_1),
        ...(somChart ? [chartImg(somChart, 600, 213)] : []),
        somTable,
        p(''),
        p('SOM = доля проверок, в которых модель упомянула бренд или сослалась на домен. Это основной показатель присутствия в AI-выдаче.', { color: COLOR_MUTED }),

        h('3. Конкуренты в ответах ИИ', HeadingLevel.HEADING_1),
        ...(competitorsChart ? [chartImg(competitorsChart, 600, Math.min(420, 60 + report.topCompetitors.slice(0, 10).length * 22))] : []),
        compTable,
        p(''),
        p('Список доменов, которые ИИ-модели упоминают вместо или вместе с вашим брендом. Это прямые конкуренты за внимание в AI-поиске.', { color: COLOR_MUTED }),

        h('4. Детальные результаты по запросам', HeadingLevel.HEADING_1),
        ...detailBlocks,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `ai-visibility-${report.brandName.replace(/[^\w-]+/g, '_')}-${fmtFile(now)}.docx`);
}