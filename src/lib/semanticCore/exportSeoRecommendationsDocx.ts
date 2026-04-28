import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, WidthType, BorderStyle, ShadingType,
  LevelFormat, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import type { SemanticCorePayload, SemanticKeyword } from './types';

// ============== GOLDEN LOGIC (зеркало UI/exportGoldenKeywords) ==============
const GOLDEN_STOP_WORDS = [
  'авито', 'яндекс', 'озон', 'ozon', 'сбер',
  'wildberries', 'вайлдберриз', 'aliexpress', 'алиэкспресс',
  'маркет', 'дром', 'auto.ru',
];
const YEAR_RX = /\b(201[0-9]|202[0-9])\b/;

type GoldenTier = 'easy' | 'medium' | 'hard';

function isGolden(k: SemanticKeyword): boolean {
  if (k.intent !== 'info') return false;
  if ((k.score ?? 0) <= 60) return false;
  const ws = k.wsFrequency ?? 0;
  if (ws < 1000 || ws > 60000) return false;
  const kw = (k.keyword || '').trim();
  if (!kw) return false;
  if (kw.split(/\s+/).filter(Boolean).length < 3) return false;
  if (YEAR_RX.test(kw)) return false;
  const lower = kw.toLowerCase();
  if (GOLDEN_STOP_WORDS.some((b) => lower.includes(b))) return false;
  return true;
}

function tierOf(k: SemanticKeyword): GoldenTier {
  const ws = k.wsFrequency ?? 0;
  if (ws < 5000) return 'easy';
  if (ws < 20000) return 'medium';
  return 'hard';
}

const TIER_LABEL: Record<GoldenTier, string> = {
  easy: '🟢 Легко',
  medium: '🟡 Средне',
  hard: '🟠 Сложно',
};

const TIER_RECOMMENDATION: Record<GoldenTier, string> = {
  easy: 'Статья 1000-1500 слов. H1 = запрос. Результат: 1-2 мес',
  medium: 'Статья 2000-3000 слов + фото/таблицы. Результат: 3-4 мес',
  hard: 'Экспертная статья 3000+ слов + видео + ссылки. Результат: 6+ мес',
};

// ============== HELPERS ==============
function safeFile(s: string): string {
  return (s || 'project').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
}

function todayLabel(): string {
  return new Date().toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function p(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: opts.bold, size: opts.size, color: opts.color })],
    spacing: { after: 80 },
  });
}

function headerRow(cells: string[], widths: number[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: cells.map((c, i) => new TableCell({
      borders: CELL_BORDERS,
      width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: 'E8E8E8', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 22 })] })],
    })),
  });
}

function bodyRow(cells: string[], widths: number[]): TableRow {
  return new TableRow({
    children: cells.map((c, i) => new TableCell({
      borders: CELL_BORDERS,
      width: { size: widths[i], type: WidthType.DXA },
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      children: [new Paragraph({ children: [new TextRun({ text: c, size: 20 })] })],
    })),
  });
}

function divider(): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '2E75B6', space: 1 } },
    spacing: { before: 200, after: 200 },
    children: [new TextRun('')],
  });
}

// ============== MAIN EXPORT ==============
export function exportSeoRecommendationsDocx(payload: SemanticCorePayload): number {
  const golden = payload.keywords.filter(isGolden);
  if (!golden.length) return 0;

  const sortedGolden = [...golden].sort((a, b) => (b.wsFrequency || 0) - (a.wsFrequency || 0));
  const tierCounts: Record<GoldenTier, number> = { easy: 0, medium: 0, hard: 0 };
  for (const k of sortedGolden) tierCounts[tierOf(k)]++;

  // ===== Заголовок =====
  const children: (Paragraph | Table)[] = [];
  children.push(divider());
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: 'SEO-РЕКОМЕНДАЦИИ', bold: true, size: 36 })],
  }));
  children.push(p(`Тема: ${payload.topic}`, { size: 22 }));
  children.push(p(`Регион: ${payload.region}`, { size: 22 }));
  children.push(p(`Дата: ${todayLabel()}`, { size: 22 }));
  children.push(divider());

  // ===== РАЗДЕЛ 1: Золотые запросы =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'РАЗДЕЛ 1: ЗОЛОТЫЕ ЗАПРОСЫ ДЛЯ КОНТЕНТА', bold: true, size: 28 })],
    spacing: { before: 200, after: 160 },
  }));

  const colWidths = [3400, 1300, 1400, 3260]; // sum = 9360 (US Letter content)
  const goldenRows: TableRow[] = [
    headerRow(['Запрос', 'Частота WS', 'Сложность', 'Рекомендация'], colWidths),
  ];
  for (const k of sortedGolden) {
    const tier = tierOf(k);
    goldenRows.push(bodyRow([
      k.keyword,
      (k.wsFrequency || 0).toLocaleString('ru'),
      TIER_LABEL[tier],
      TIER_RECOMMENDATION[tier],
    ], colWidths));
  }
  children.push(new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: goldenRows,
  }));

  children.push(divider());

  // ===== РАЗДЕЛ 2: План действий =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'РАЗДЕЛ 2: ПЛАН ДЕЙСТВИЙ', bold: true, size: 28 })],
    spacing: { before: 200, after: 160 },
  }));
  const planSteps = [
    'Начните с лёгких запросов (🟢) — быстрый результат',
    'Публикуйте 2-3 статьи в неделю',
    'Добавляйте внутренние ссылки между статьями одного кластера',
    'После первых позиций переходите к средним запросам (🟡)',
    'Сложные запросы (🟠) — только после наработки ссылочной массы',
  ];
  for (const step of planSteps) {
    children.push(new Paragraph({
      numbering: { reference: 'plan-numbers', level: 0 },
      children: [new TextRun({ text: step, size: 22 })],
      spacing: { after: 100 },
    }));
  }

  children.push(divider());

  // ===== РАЗДЕЛ 3: Кластеры =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'РАЗДЕЛ 3: КЛАСТЕРЫ', bold: true, size: 28 })],
    spacing: { before: 200, after: 160 },
  }));

  const sortedClusters = [...payload.clusters].sort((a, b) => b.totalQueries - a.totalQueries);
  for (const c of sortedClusters) {
    const items = payload.keywords
      .filter((k) => k.cluster === c.id)
      .sort((a, b) => (b.wsFrequency || 0) - (a.wsFrequency || 0));
    const top = items.slice(0, 3);
    children.push(new Paragraph({
      numbering: { reference: 'cluster-bullets', level: 0 },
      children: [
        new TextRun({ text: `${c.name}: `, bold: true, size: 22 }),
        new TextRun({ text: `${c.totalQueries} запр.`, size: 22 }),
      ],
      spacing: { after: 60 },
    }));
    if (top.length > 0) {
      const topStr = top
        .map((k) => `${k.keyword} (${(k.wsFrequency || 0).toLocaleString('ru')})`)
        .join(', ');
      children.push(new Paragraph({
        indent: { left: 720 },
        children: [
          new TextRun({ text: 'Топ запросы: ', italics: true, size: 20, color: '666666' }),
          new TextRun({ text: topStr, size: 20, color: '666666' }),
        ],
        spacing: { after: 120 },
      }));
    }
  }

  children.push(divider());

  // ===== РАЗДЕЛ 4: Статистика =====
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text: 'РАЗДЕЛ 4: СТАТИСТИКА', bold: true, size: 28 })],
    spacing: { before: 200, after: 160 },
  }));
  const stats = [
    `Всего запросов найдено: ${payload.keywords.length}`,
    `Золотых запросов: ${sortedGolden.length}`,
    `Лёгких: ${tierCounts.easy} | Средних: ${tierCounts.medium} | Сложных: ${tierCounts.hard}`,
    `Кластеров: ${payload.clusters.length}`,
    `Источник частот: Яндекс Wordstat`,
  ];
  for (const s of stats) {
    children.push(new Paragraph({
      numbering: { reference: 'stats-bullets', level: 0 },
      children: [new TextRun({ text: s, size: 22 })],
      spacing: { after: 80 },
    }));
  }

  // ===== Сборка документа =====
  const doc = new Document({
    styles: {
      default: { document: { run: { font: 'Arial', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial' },
          paragraph: { spacing: { before: 240, after: 240 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial', color: '2E75B6' },
          paragraph: { spacing: { before: 200, after: 160 }, outlineLevel: 1 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'plan-numbers', levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }] },
        { reference: 'cluster-bullets', levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 200 } } },
        }] },
        { reference: 'stats-bullets', levels: [{
          level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 360, hanging: 200 } } },
        }] },
      ],
    },
    sections: [{
      properties: {
        page: {
          size: { width: 12240, height: 15840, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
        },
      },
      children,
    }],
  });

  const date = new Date().toISOString().slice(0, 10);
  const filename = `Рекомендации-SEO-${safeFile(payload.topic)}-${date}.docx`;
  Packer.toBlob(doc).then((blob) => saveAs(blob, filename));
  return sortedGolden.length;
}