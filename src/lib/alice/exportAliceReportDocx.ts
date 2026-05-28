import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber,
} from 'docx';
import { saveAs } from 'file-saver';
import type { AliceParsed } from './parseAliceXlsx';

const ACCENT = '2E75B6';
const TEXT = '1F2937';
const MUTED = '6B7280';
const PASS = '047857';
const FAIL = 'B91C1C';
const BORDER = 'D1D5DB';
const HEAD_BG = 'EEF2F7';

const cellBorder = { top: { style: BorderStyle.SINGLE, size: 4, color: BORDER }, bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER }, left: { style: BorderStyle.SINGLE, size: 4, color: BORDER }, right: { style: BorderStyle.SINGLE, size: 4, color: BORDER } };

const P = (text: string, opts: any = {}) =>
  new Paragraph({ children: [new TextRun({ text, ...opts })], spacing: { after: 100 } });

const H1 = (text: string) =>
  new Paragraph({ children: [new TextRun({ text, bold: true, size: 36, color: ACCENT })], heading: HeadingLevel.HEADING_1, spacing: { before: 240, after: 200 } });

const H2 = (text: string) =>
  new Paragraph({ children: [new TextRun({ text, bold: true, size: 26, color: TEXT })], heading: HeadingLevel.HEADING_2, spacing: { before: 240, after: 160 } });

const cell = (text: string, opts: { bold?: boolean; bg?: string; color?: string; align?: any } = {}) =>
  new TableCell({
    width: { size: 0, type: WidthType.AUTO },
    borders: cellBorder,
    shading: opts.bg ? { type: ShadingType.CLEAR, color: 'auto', fill: opts.bg } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({
      alignment: opts.align,
      children: [new TextRun({ text, bold: opts.bold, color: opts.color, size: 20 })],
    })],
  });

function metricsTable(d: AliceParsed) {
  const rows = [
    ['Запросов проверено', String(d.totals.queries)],
    ['Сумма частотности (Wordstat)', d.totals.totalFrequency.toLocaleString('ru-RU')],
    ['Сумма точной частотности', d.totals.totalExact.toLocaleString('ru-RU')],
    ['Запросов с упоминанием бренда', `${d.totals.brandMentions} (${d.totals.visibilityPct}%)`],
    ['Цитирований бренда', `${d.totals.brandCitations} из ${d.totals.totalCitations} (${d.totals.citationSharePct}%)`],
  ];
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [4680, 4680],
    rows: rows.map(([k, v]) =>
      new TableRow({ children: [
        cell(k, { bg: HEAD_BG, bold: true }),
        cell(v, { bold: true, color: ACCENT }),
      ] }),
    ),
  });
}

function domainsTable(d: AliceParsed) {
  const header = new TableRow({ children: [
    cell('Домен-источник', { bold: true, bg: HEAD_BG }),
    cell('Цитирований', { bold: true, bg: HEAD_BG, align: AlignmentType.CENTER }),
    cell('Тип', { bold: true, bg: HEAD_BG }),
  ] });
  const body = d.topDomains.slice(0, 15).map((dr) => new TableRow({ children: [
    cell(dr.domain, { color: dr.isBrand ? PASS : TEXT, bold: dr.isBrand }),
    cell(String(dr.count), { align: AlignmentType.CENTER }),
    cell(dr.isBrand ? 'ВАШ БРЕНД' : '—', { color: dr.isBrand ? PASS : MUTED }),
  ] }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5000, 2000, 2360],
    rows: [header, ...body],
  });
}

function queriesTable(d: AliceParsed) {
  const header = new TableRow({ children: [
    cell('Запрос', { bold: true, bg: HEAD_BG }),
    cell('Частотн.', { bold: true, bg: HEAD_BG, align: AlignmentType.CENTER }),
    cell('Бренд', { bold: true, bg: HEAD_BG, align: AlignmentType.CENTER }),
    cell('Цитат', { bold: true, bg: HEAD_BG, align: AlignmentType.CENTER }),
  ] });
  const body = d.rows.map((r) => new TableRow({ children: [
    cell(r.query),
    cell(r.frequency.toLocaleString('ru-RU'), { align: AlignmentType.CENTER }),
    cell(r.brandMentioned ? '✓' : '—', { color: r.brandMentioned ? PASS : FAIL, bold: true, align: AlignmentType.CENTER }),
    cell(String(r.citedDomains.length), { align: AlignmentType.CENTER }),
  ] }));
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [5360, 1500, 1200, 1300],
    rows: [header, ...body],
  });
}

function recommendations(d: AliceParsed): Paragraph[] {
  const v = d.totals.visibilityPct;
  const recs: string[] = [];

  if (v < 30) recs.push('Критически низкая видимость в Алисе (< 30%). Приоритет №1 — публиковать развёрнутые экспертные материалы с упоминанием бренда на сторонних авторитетных площадках (Хабр, vc.ru, отраслевые СМИ).');
  else if (v < 60) recs.push(`Средний уровень видимости (${v}%). Сфокусируйтесь на запросах, где бренд ещё не упомянут — создайте под них посадочные страницы и питч-материалы для отраслевых медиа.`);
  else recs.push(`Высокая видимость (${v}%). Удерживайте позиции, публикуйте свежие кейсы и статистические данные — Алиса предпочитает актуальные источники.`);

  if (d.totals.citationSharePct < 20) recs.push(`Доля цитирований бренда — всего ${d.totals.citationSharePct}%. Алиса чаще ссылается на маркетплейсы и СМИ. Поработайте над линкбилдингом с упоминанием домена и каноническим описанием компании в энциклопедиях (Wikipedia, Wikidata, Ruwiki).`);

  const nonBrandTop = d.topDomains.filter((x) => !x.isBrand).slice(0, 5);
  if (nonBrandTop.length) {
    recs.push(`Топ-конкуренты в выдаче Алисы: ${nonBrandTop.map((x) => x.domain).join(', ')}. Изучите их контент-стратегию: какие форматы, какие сигналы доверия (отзывы, сертификаты, экспертные подписи).`);
  }

  const noMention = d.rows.filter((r) => !r.brandMentioned).slice(0, 10);
  if (noMention.length) {
    recs.push(`Запросы без упоминания бренда (top-10): ${noMention.map((r) => `«${r.query}»`).join('; ')}. Создайте под каждый отдельную посадочную страницу с подробным FAQ и структурой Schema.org/FAQPage.`);
  }

  recs.push('Технические шаги для попадания в источники Алисы: 1) Schema.org Organization + sameAs со всеми соцсетями; 2) FAQPage и HowTo разметка; 3) корректный robots.txt без блокировки YandexBot; 4) карточка организации в Яндекс.Бизнес с заполненными атрибутами.');

  return recs.map((t, i) => new Paragraph({
    spacing: { after: 120 },
    children: [
      new TextRun({ text: `${i + 1}. `, bold: true, color: ACCENT, size: 22 }),
      new TextRun({ text: t, size: 22 }),
    ],
  }));
}

function geoPlanParagraphs(md: string): Paragraph[] {
  const lines = md.split('\n');
  const out: Paragraph[] = [];
  for (const raw of lines) {
    const line = raw.replace(/\*\*/g, '').replace(/—/g, '-');
    if (!line.trim()) { out.push(new Paragraph({ spacing: { after: 60 }, children: [] })); continue; }
    if (line.startsWith('## ')) { out.push(H2(line.slice(3).trim())); continue; }
    if (line.startsWith('# ')) { out.push(H2(line.slice(2).trim())); continue; }
    const m = line.match(/^\s*[-*]\s+(.*)/);
    if (m) {
      out.push(new Paragraph({
        spacing: { after: 80 }, indent: { left: 360, hanging: 200 },
        children: [new TextRun({ text: '• ', bold: true, color: ACCENT, size: 22 }), new TextRun({ text: m[1], size: 22 })],
      }));
      continue;
    }
    const num = line.match(/^\s*(\d+)\.\s+(.*)/);
    if (num) {
      out.push(new Paragraph({
        spacing: { after: 80 }, indent: { left: 360, hanging: 200 },
        children: [new TextRun({ text: `${num[1]}. `, bold: true, color: ACCENT, size: 22 }), new TextRun({ text: num[2], size: 22 })],
      }));
      continue;
    }
    out.push(P(line, { size: 22 }));
  }
  return out;
}

export async function exportAliceReportDocx(
  d: AliceParsed,
  filename = 'alisa-visibility-report.docx',
  geoPlan?: string,
) {
  const today = new Date();
  const dateStr = today.toLocaleDateString('ru-RU');

  const doc = new Document({
    creator: 'SEO-Аудит',
    styles: {
      default: { document: { run: { font: 'Arial', size: 22, color: TEXT } } },
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      headers: {
        default: new Header({ children: [new Paragraph({ alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: `Отчёт по видимости в Алисе · ${dateStr}`, size: 18, color: MUTED })] })] }),
      },
      footers: {
        default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Страница ', size: 18, color: MUTED }), new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED })] })] }),
      },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
          children: [new TextRun({ text: 'ВИДИМОСТЬ В ОТВЕТАХ ЯНДЕКС АЛИСЫ', bold: true, size: 44, color: ACCENT })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 360 },
          children: [new TextRun({ text: `${d.brand || d.domain} · ${dateStr}`, color: MUTED, size: 22 })] }),

        H1('1. Резюме'),
        P(`Проанализировано ${d.totals.queries} ключевых запросов с суммарной частотностью ${d.totals.totalFrequency.toLocaleString('ru-RU')} показов/мес по Wordstat. Бренд "${d.brand}" упомянут в ${d.totals.brandMentions} ответах Алисы (${d.totals.visibilityPct}% видимость). Доля цитирований домена ${d.domain} — ${d.totals.citationSharePct}% от всех источников.`),

        H1('2. Ключевые метрики'),
        metricsTable(d),

        H1('3. Топ-источники, на которые ссылается Алиса'),
        P('Чем чаще домен появляется в источниках Алисы по вашей семантике, тем выше его авторитет в нише. Ваш бренд выделен зелёным.', { color: MUTED, italics: true }),
        new Paragraph({ spacing: { after: 80 }, children: [] }),
        domainsTable(d),

        H1('4. Детализация по запросам'),
        queriesTable(d),

        H1('5. Рекомендации'),
        ...recommendations(d),

        ...(geoPlan && geoPlan.trim() ? [
          H1('6. GEO-стратегия (план 30/60/90 дней)'),
          P('Сгенерировано ИИ на основе данных аудита: какие запросы не приводят к упоминанию бренда, какие домены доминируют в выдаче Алисы.', { color: MUTED, italics: true }),
          ...geoPlanParagraphs(geoPlan),
        ] : []),

        new Paragraph({ spacing: { before: 480 }, alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: '— Конец отчёта —', color: MUTED, size: 18 })] }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, filename);
}