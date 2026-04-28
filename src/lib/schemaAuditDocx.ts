import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  Header, Footer, PageNumber, ExternalHyperlink, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';

/* ---- Types (mirror SchemaAuditPage AuditRow) ---- */
export interface DocxIssue {
  severity: 'critical' | 'warning' | 'info';
  schema: string;
  problem: string;
  solution: string;
  seoImpact?: string;
}
export interface DocxBlock {
  type: string;
  label: string;
  reason: string;
  code: string;
}
export interface DocxAudit {
  url: string;
  domain: string;
  overall_score: number;
  found_schemas_count: number;
  errors_count: number;
  issues: DocxIssue[];
  generated_code: DocxBlock[];
  ai_recommendations: any;
  page_type: string;
}

/* ---- Helpers ---- */
const fmt = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
const fmtFile = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };

const PAGE_TYPE_LABELS: Record<string, string> = {
  general: 'Главная', service: 'Услуги', contacts: 'Контакты',
  category: 'Категория', product: 'Карточка товара', article: 'Блог/Статья', faq: 'FAQ',
};
const ptLabel = (t: string) => PAGE_TYPE_LABELS[t] || t || 'Страница';

const priorityLabel = (score: number) =>
  score < 40 ? 'Высокий' : score < 70 ? 'Средний' : 'Низкий';

const placementHint = (type: string): string => {
  const t = (type || '').toLowerCase();
  if (t.includes('organization') || t.includes('website') || t.includes('person')) return 'На всех страницах сайта (в <head>)';
  if (t.includes('localbusiness')) return 'На страницах "Контакты" и главной';
  if (t.includes('product') || t.includes('offer')) return 'На карточках товаров';
  if (t.includes('article') || t.includes('blogposting')) return 'На страницах статей/блога';
  if (t.includes('faq')) return 'На страницах с FAQ';
  if (t.includes('breadcrumb')) return 'На всех вложенных страницах';
  if (t.includes('service')) return 'На страницах услуг';
  if (t.includes('event')) return 'На страницах мероприятий';
  return 'В <head> соответствующей страницы';
};

const priorityFromBlock = (label: string): 'КРИТИЧНО' | 'ВАЖНО' | 'РЕКОМЕНДУЕТСЯ' => {
  const l = (label || '').toLowerCase();
  if (l.includes('критич') || l.includes('обязат') || l.includes('исправ')) return 'КРИТИЧНО';
  if (l.includes('важн') || l.includes('добав')) return 'ВАЖНО';
  return 'РЕКОМЕНДУЕТСЯ';
};

const manualFieldsFromCode = (code: string): string[] => {
  const out: string[] = [];
  const placeholderRx = /"([A-Za-z@][A-Za-z0-9@_-]*)"\s*:\s*"(?:_+|TODO|XXX|укажите|пример|sample|your[-_ ]?[a-z]+)"/gi;
  let m: RegExpExecArray | null;
  while ((m = placeholderRx.exec(code))) out.push(m[1]);
  return Array.from(new Set(out));
};

/* ---- Style constants ---- */
const FONT = 'Arial';
const MONO = 'Courier New';
const COLOR_RED = 'C00000';
const COLOR_ORANGE = 'D97706';
const COLOR_BLUE = '1F4E79';
const COLOR_GREY = '6B7280';
const SHADE_CODE = 'F5F5F5';
const SHADE_HEAD = 'E7EEF7';

const cellBorder = { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' };
const allBorders = { top: cellBorder, bottom: cellBorder, left: cellBorder, right: cellBorder };

const p = (text: string, opts: any = {}) =>
  new Paragraph({
    spacing: { after: 100, ...(opts.spacing || {}) },
    alignment: opts.alignment,
    children: [new TextRun({ text, font: FONT, size: opts.size ?? 22, bold: opts.bold, color: opts.color, italics: opts.italics })],
  });

const runs = (parts: Array<{ text: string; bold?: boolean; color?: string; italics?: boolean }>, opts: any = {}) =>
  new Paragraph({
    spacing: { after: 100, ...(opts.spacing || {}) },
    children: parts.map(pt => new TextRun({ text: pt.text, font: FONT, size: opts.size ?? 22, bold: pt.bold, color: pt.color, italics: pt.italics })),
  });

const h1 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [new TextRun({ text, font: FONT, size: 32, bold: true, color: COLOR_BLUE })],
  });
const h2 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 140 },
    children: [new TextRun({ text, font: FONT, size: 28, bold: true, color: COLOR_BLUE })],
  });
const h3 = (text: string) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 220, after: 100 },
    children: [new TextRun({ text, font: FONT, size: 24, bold: true })],
  });

const cell = (text: string | Paragraph[], opts: { width: number; bold?: boolean; shade?: string; color?: string } = { width: 4500 }) => {
  const children = Array.isArray(text) ? text : [
    new Paragraph({
      children: [new TextRun({ text: String(text ?? ''), font: FONT, size: 22, bold: opts.bold, color: opts.color })],
    }),
  ];
  return new TableCell({
    width: { size: opts.width, type: WidthType.DXA },
    borders: allBorders,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    children,
  });
};

const codeBlock = (code: string): Paragraph[] => {
  const lines = String(code || '').split('\n');
  return lines.map((line, i) =>
    new Paragraph({
      spacing: { after: 0 },
      shading: { fill: SHADE_CODE, type: ShadingType.CLEAR, color: 'auto' },
      border: {
        left: { style: BorderStyle.SINGLE, size: 18, color: COLOR_BLUE, space: 6 },
        ...(i === 0 ? { top: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB', space: 4 } } : {}),
        ...(i === lines.length - 1 ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'D1D5DB', space: 4 } } : {}),
      },
      children: [new TextRun({ text: line || ' ', font: MONO, size: 18 })],
    })
  );
};

/* ---- Section builders ---- */
function buildAuditSections(audit: DocxAudit, today: Date): Paragraph[] | (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = [];
  const date = fmt(today);
  const crit = audit.issues.filter(i => i.severity === 'critical');
  const warn = audit.issues.filter(i => i.severity === 'warning');
  const info = audit.issues.filter(i => i.severity === 'info');
  const pageData = audit.ai_recommendations?.pageData || {};
  const ai = audit.ai_recommendations || {};

  // Section 1: Резюме
  out.push(h1('1. Краткое резюме'));
  out.push(p(
    `На странице ${audit.url} обнаружено ${audit.found_schemas_count} схем микроразметки, из них ${crit.length} критических ошибок. ` +
    `Текущий балл — ${audit.overall_score}/100. Для повышения видимости в поиске необходимо внедрить ${audit.generated_code.length} ` +
    `блоков структурированных данных Schema.org с реальными данными компании.`
  ));
  out.push(p('Обнаружено на странице:', { bold: true, spacing: { before: 160 } }));

  const dataRows: Array<[string, string, string]> = [
    ['Компания', pageData.companyName || '—', pageData.companyName ? 'Структурированные данные' : 'Не найдено'],
    ['Телефон', pageData.phone || '—', pageData.phone ? 'Извлечено из страницы' : 'Не найдено'],
    ['Email', pageData.email || '—', pageData.email ? 'Извлечено из страницы' : 'Не найдено'],
    ['Адрес', pageData.address || '—', pageData.address ? 'Извлечено из страницы' : 'Не найдено'],
    ['Описание', pageData.description || '—', pageData.description ? 'meta description / og' : 'Не найдено'],
    ['Тип страницы', ptLabel(audit.page_type), 'Авто-определение'],
  ];
  out.push(new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [2400, 4200, 2400],
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell('Параметр', { width: 2400, bold: true, shade: SHADE_HEAD }),
        cell('Значение', { width: 4200, bold: true, shade: SHADE_HEAD }),
        cell('Источник', { width: 2400, bold: true, shade: SHADE_HEAD }),
      ]}),
      ...dataRows.map(([k, v, s]) => new TableRow({ children: [
        cell(k, { width: 2400, bold: true }),
        cell(v, { width: 4200 }),
        cell(s, { width: 2400, color: COLOR_GREY }),
      ]})),
    ],
  }));

  // Section 2: Проблемы
  out.push(h1('2. Текущие проблемы'));

  out.push(h2('🔴 Критические ошибки'));
  if (crit.length === 0) {
    out.push(p('Критических проблем не обнаружено.', { italics: true, color: COLOR_GREY }));
  } else {
    crit.forEach((i, idx) => {
      out.push(runs([
        { text: `${idx + 1}. ${i.schema}: `, bold: true, color: COLOR_RED },
        { text: i.problem, bold: true, color: COLOR_RED },
      ]));
      out.push(p(`Решение: ${i.solution || '—'}`, { color: COLOR_RED }));
      if (i.seoImpact) out.push(p(`SEO-эффект: ${i.seoImpact}`, { color: COLOR_RED, italics: true }));
    });
  }

  out.push(h2('🟡 Важные исправления'));
  if (warn.length === 0) {
    out.push(p('Важных предупреждений нет.', { italics: true, color: COLOR_GREY }));
  } else {
    warn.forEach((i, idx) => {
      out.push(runs([
        { text: `${idx + 1}. ${i.schema}: `, bold: true, color: COLOR_ORANGE },
        { text: i.problem, bold: true, color: COLOR_ORANGE },
      ]));
      out.push(p(`Решение: ${i.solution || '—'}`, { color: COLOR_ORANGE }));
    });
  }

  out.push(h2('🔵 Рекомендации'));
  if (info.length === 0) {
    out.push(p('Дополнительных рекомендаций нет.', { italics: true, color: COLOR_GREY }));
  } else {
    info.forEach(i => {
      out.push(new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text: `${i.problem}${i.solution ? ' → ' + i.solution : ''}`, font: FONT, size: 22 })],
      }));
    });
  }

  // Section 3: Готовый код
  out.push(h1('3. Готовый код'));
  out.push(h2('Готовый код для вставки в <head>'));

  audit.generated_code.forEach((block, idx) => {
    const action = /исправ/i.test(block.label) ? 'исправить' : 'добавить';
    out.push(h3(`${idx + 1}. ${block.type} — ${action}`));
    out.push(runs([
      { text: 'Где разместить: ', bold: true },
      { text: placementHint(block.type) },
    ]));
    codeBlock(`<script type="application/ld+json">\n${block.code}\n</script>`).forEach(pp => out.push(pp));
    const manual = manualFieldsFromCode(block.code);
    if (manual.length > 0) {
      out.push(p(`Заполните вручную: ${manual.join(', ')}`, { color: COLOR_ORANGE, bold: true, spacing: { before: 80, after: 200 } }));
    } else {
      out.push(p(' ', { spacing: { after: 120 } }));
    }
  });

  // Section 4: Чек-лист
  out.push(h1('4. Чек-лист внедрения'));
  const critBlocks = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'КРИТИЧНО');
  const warnBlocks = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'ВАЖНО');
  const recBlocks = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'РЕКОМЕНДУЕТСЯ');

  out.push(h3(`Этап 1 — Критические (до ${fmt(addDays(today, 3))})`));
  if (critBlocks.length === 0) out.push(p('☑ Критических исправлений не требуется', { color: COLOR_GREY }));
  else critBlocks.forEach(b => out.push(p(`☐ Добавить ${b.type} на ${placementHint(b.type)}`)));

  out.push(h3(`Этап 2 — Важные (до ${fmt(addDays(today, 14))})`));
  if (warnBlocks.length === 0) out.push(p('☑ Важных улучшений не требуется', { color: COLOR_GREY }));
  else warnBlocks.forEach(b => out.push(p(`☐ Добавить ${b.type}`)));

  out.push(h3(`Этап 3 — Рекомендуемые (до ${fmt(addDays(today, 30))})`));
  if (recBlocks.length === 0) out.push(p('☑ Дополнительных схем не требуется', { color: COLOR_GREY }));
  else recBlocks.forEach(b => out.push(p(`☐ Рассмотреть ${b.type}`)));

  // Section 5: Проверка
  out.push(h1('5. Проверка'));
  out.push(h2('Проверка после внедрения'));
  const tools: Array<[string, string, string]> = [
    ['Google Rich Results Test', 'https://search.google.com/test/rich-results', 'Rich results'],
    ['Schema.org Validator', 'https://validator.schema.org', 'Валидность'],
    ['Яндекс Вебмастер', 'https://webmaster.yandex.ru', 'Обнаружение'],
    ['Google Search Console', 'https://search.google.com/search-console', 'Ошибки'],
  ];
  out.push(new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [2700, 3600, 2700],
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell('Инструмент', { width: 2700, bold: true, shade: SHADE_HEAD }),
        cell('Ссылка', { width: 3600, bold: true, shade: SHADE_HEAD }),
        cell('Что проверять', { width: 2700, bold: true, shade: SHADE_HEAD }),
      ]}),
      ...tools.map(([n, u, w]) => new TableRow({ children: [
        cell(n, { width: 2700, bold: true }),
        new TableCell({
          width: { size: 3600, type: WidthType.DXA },
          borders: allBorders,
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [
            new ExternalHyperlink({ link: u, children: [new TextRun({ text: u, font: FONT, size: 20, color: '0563C1', underline: {} })] }),
          ]})],
        }),
        cell(w, { width: 2700 }),
      ]})),
    ],
  }));

  // Section 6: Ожидаемый результат
  out.push(h1('6. Ожидаемый результат'));
  const expectedTypes = (Array.isArray(ai.richResultsEligible)
    ? ai.richResultsEligible.filter((r: any) => r?.eligible).map((r: any) => r.type)
    : audit.generated_code.map(b => b.type)
  ).filter(Boolean);
  const expectedList = expectedTypes.length > 0 ? expectedTypes.join(', ') : 'Breadcrumbs, Sitelinks';
  const metrics: Array<[string, string, string]> = [
    ['Балл микроразметки', `${audit.overall_score}/100`, '85–95/100'],
    ['Rich Results', 'Нет', expectedList],
    ['CTR в выдаче', 'Базовый', '+15–30%'],
  ];
  out.push(new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: [3000, 3000, 3000],
    rows: [
      new TableRow({ tableHeader: true, children: [
        cell('Метрика', { width: 3000, bold: true, shade: SHADE_HEAD }),
        cell('До', { width: 3000, bold: true, shade: SHADE_HEAD }),
        cell('После', { width: 3000, bold: true, shade: SHADE_HEAD }),
      ]}),
      ...metrics.map(([k, b, a]) => new TableRow({ children: [
        cell(k, { width: 3000, bold: true }),
        cell(b, { width: 3000 }),
        cell(a, { width: 3000, color: COLOR_BLUE }),
      ]})),
    ],
  }));

  return out;
}

function buildCover(opts: { title: string; subtitle: string; rows: Array<[string, string]> }) {
  const out: (Paragraph | Table)[] = [];
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 200 },
    children: [new TextRun({ text: opts.title, font: FONT, size: 40, bold: true, color: COLOR_BLUE })],
  }));
  out.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 400 },
    children: [new TextRun({ text: opts.subtitle, font: FONT, size: 28, color: COLOR_GREY })],
  }));
  out.push(new Table({
    width: { size: 9000, type: WidthType.DXA },
    columnWidths: Array(opts.rows.length).fill(Math.floor(9000 / opts.rows.length)),
    rows: [
      new TableRow({ tableHeader: true, children: opts.rows.map(([k]) =>
        cell(k, { width: Math.floor(9000 / opts.rows.length), bold: true, shade: SHADE_HEAD })
      )}),
      new TableRow({ children: opts.rows.map(([, v]) =>
        cell(v, { width: Math.floor(9000 / opts.rows.length) })
      )}),
    ],
  }));
  return out;
}

function makeFooter() {
  return new Footer({
    children: [new Paragraph({
      border: { top: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BLUE, space: 6 } },
      tabStops: [{ type: 'right' as any, position: 9000 }],
      children: [
        new TextRun({ text: 'PageForge Schema Audit', font: FONT, size: 18, color: COLOR_GREY }),
        new TextRun({ text: '\t', font: FONT, size: 18 }),
        new TextRun({ children: ['Стр. ', PageNumber.CURRENT, ' из ', PageNumber.TOTAL_PAGES], font: FONT, size: 18, color: COLOR_GREY }),
      ],
    })],
  });
}

/* ---- Public API ---- */
export async function downloadAuditDocx(audit: DocxAudit) {
  const today = new Date();
  const cover = buildCover({
    title: 'Техническое задание на внедрение микроразметки Schema.org',
    subtitle: audit.domain,
    rows: [
      ['Дата', fmt(today)],
      ['Балл', `${audit.overall_score}/100`],
      ['Приоритет', priorityLabel(audit.overall_score)],
      ['Страниц проверено', '1'],
    ],
  });
  const body = buildAuditSections(audit, today);

  const doc = new Document({
    creator: 'PageForge',
    title: `TZ ${audit.domain}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      footers: { default: makeFooter() },
      children: [...cover, ...body],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (audit.domain || 'site').replace(/[^\w.-]/g, '_');
  saveAs(blob, `TZ_schema_${safe}_${fmtFile(today)}.docx`);
}

export async function downloadCombinedAuditDocx(items: Array<{ type: string; audit: DocxAudit }>) {
  if (items.length === 0) return;
  const today = new Date();
  const avg = Math.round(items.reduce((s, r) => s + (r.audit.overall_score || 0), 0) / items.length);
  const totalErrors = items.reduce((s, r) => s + (r.audit.errors_count || 0), 0);
  const domain = items[0].audit.domain;

  const cover = buildCover({
    title: 'Сводное ТЗ на внедрение микроразметки Schema.org',
    subtitle: domain,
    rows: [
      ['Дата', fmt(today)],
      ['Средний балл', `${avg}/100`],
      ['Ошибок', String(totalErrors)],
      ['Страниц', String(items.length)],
    ],
  });

  const children: (Paragraph | Table)[] = [...cover];
  items.forEach((r, idx) => {
    children.push(new Paragraph({
      pageBreakBefore: true,
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
      children: [new TextRun({
        text: `Раздел ${idx + 1}. ${ptLabel(r.type)} — ${r.audit.url}`,
        font: FONT, size: 36, bold: true, color: COLOR_BLUE,
      })],
    }));
    children.push(...buildAuditSections(r.audit, today));
  });

  const doc = new Document({
    creator: 'PageForge',
    title: `Combined TZ ${domain}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
        },
      },
      footers: { default: makeFooter() },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (domain || 'site').replace(/[^\w.-]/g, '_');
  saveAs(blob, `TZ_schema_site_${safe}_${fmtFile(today)}.docx`);
}