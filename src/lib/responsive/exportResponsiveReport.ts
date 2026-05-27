import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  ShadingType,
} from "docx";
import { saveAs } from "file-saver";

const BRAND = "2E75B6";
const MUTED = "6B7280";

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: any; spacingAfter?: number } = {}) {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: opts.spacingAfter ?? 120 },
    children: [new TextRun({ text, bold: opts.bold, size: opts.size ?? 22, color: opts.color, font: "Calibri" })],
  });
}

function h1(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 240, after: 200 },
    children: [new TextRun({ text, bold: true, size: 32, color: BRAND, font: "Calibri" })],
  });
}

function h2(text: string) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 200, after: 120 },
    children: [new TextRun({ text, bold: true, size: 26, color: "111827", font: "Calibri" })],
  });
}

function cell(text: string, opts: { bold?: boolean; fill?: string; width?: number; align?: any } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.fill ? { fill: opts.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, size: 20, font: "Calibri" })],
      }),
    ],
  });
}

const DEVICES = [
  { label: "iPhone 14 (Mobile)", width: "390 × 780 px", note: "Основной mobile-first viewport" },
  { label: "iPad (Tablet)", width: "768 × 1024 px", note: "Промежуточные планшетные разрешения" },
  { label: "Desktop", width: "1280 × 800 px", note: "Стандартное десктоп-разрешение" },
];

const CHECKLIST = [
  { item: "Meta viewport", criteria: "<meta name=viewport content='width=device-width, initial-scale=1'>", why: "Обязательно для mobile-friendly индексации Google" },
  { item: "Отсутствие горизонтальной прокрутки", criteria: "Контент укладывается в ширину экрана на всех устройствах", why: "Горизонтальный скролл — критическая ошибка UX на мобильных" },
  { item: "Размер шрифта", criteria: "Не менее 16px для основного текста на мобильных", why: "Меньший шрифт нечитаем без зума, штраф Google" },
  { item: "Размер кликабельных элементов", criteria: "Кнопки и ссылки минимум 48×48 px с отступами 8 px", why: "Mobile Usability требование Google Search Console" },
  { item: "Адаптивные изображения", criteria: "srcset / sizes, max-width: 100%, lazy loading", why: "Скорость загрузки и корректное отображение на разных DPR" },
  { item: "Touch-friendly навигация", criteria: "Бургер-меню или адаптивный header без hover-only элементов", why: "На touch-устройствах нет hover — функции должны быть доступны по тапу" },
  { item: "Скрытие/перестроение контента", criteria: "Контент не скрывается полностью на мобильных, важные блоки сохранены", why: "Mobile-first индексация: Google видит мобильную версию как основную" },
  { item: "Корректные breakpoints", criteria: "Адаптация на 360, 414, 768, 1024, 1280 px", why: "Покрытие реальных устройств пользователей" },
];

export async function downloadResponsiveReportDocx(opts: { url: string; checkedAt?: string | null }) {
  const date = opts.checkedAt ? new Date(opts.checkedAt) : new Date();
  const dateStr = date.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });

  const cover = [
    new Paragraph({ spacing: { before: 2000, after: 200 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "ОТЧЁТ ОБ АДАПТИВНОСТИ САЙТА", bold: true, size: 44, color: BRAND, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 400 },
      children: [new TextRun({ text: "Mobile-Friendly Audit", size: 28, color: MUTED, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 },
      children: [new TextRun({ text: opts.url, size: 24, bold: true, font: "Calibri" })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 800 },
      children: [new TextRun({ text: dateStr, size: 20, color: MUTED, font: "Calibri" })] }),
  ];

  const summary = [
    h1("Сводка"),
    p("Аудит адаптивности проверяет корректность отображения страницы на ключевых разрешениях экранов: мобильных телефонах, планшетах и десктопах. Google использует mobile-first индексацию — мобильная версия сайта является основной для ранжирования."),
    p(`URL: ${opts.url}`, { bold: true, spacingAfter: 80 }),
    p(`Дата проверки: ${dateStr}`, { color: MUTED, spacingAfter: 200 }),
  ];

  const devicesHeader = new TableRow({
    tableHeader: true,
    children: [
      cell("Устройство", { bold: true, fill: "F3F4F6", width: 3000 }),
      cell("Разрешение", { bold: true, fill: "F3F4F6", width: 2500 }),
      cell("Назначение", { bold: true, fill: "F3F4F6", width: 3860 }),
    ],
  });
  const devicesRows = DEVICES.map((d) =>
    new TableRow({ children: [cell(d.label, { width: 3000 }), cell(d.width, { width: 2500 }), cell(d.note, { width: 3860 })] }),
  );
  const devicesTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3000, 2500, 3860],
    rows: [devicesHeader, ...devicesRows],
  });

  const checklistHeader = new TableRow({
    tableHeader: true,
    children: [
      cell("Критерий", { bold: true, fill: "F3F4F6", width: 2600 }),
      cell("Требование", { bold: true, fill: "F3F4F6", width: 3700 }),
      cell("Зачем", { bold: true, fill: "F3F4F6", width: 3060 }),
    ],
  });
  const checklistRows = CHECKLIST.map((c) =>
    new TableRow({ children: [cell(c.item, { bold: true, width: 2600 }), cell(c.criteria, { width: 3700 }), cell(c.why, { width: 3060 })] }),
  );
  const checklistTable = new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2600, 3700, 3060],
    rows: [checklistHeader, ...checklistRows],
  });

  const recommendations = [
    h1("Рекомендации"),
    p("1. Проверьте корректность тега viewport в <head>. Без него Google помечает страницу как not mobile-friendly."),
    p("2. Убедитесь, что все интерактивные элементы (кнопки, ссылки, поля ввода) имеют размер не менее 48×48 px с достаточными отступами."),
    p("3. Используйте относительные единицы (rem, %, vw) вместо фиксированных пикселей для контейнеров и шрифтов."),
    p("4. Применяйте responsive-изображения (srcset/sizes, <picture>) и lazy loading для ускорения загрузки на мобильных."),
    p("5. Протестируйте сайт в Google Mobile-Friendly Test и Search Console → Mobile Usability."),
    p("6. Избегайте горизонтальной прокрутки — используйте overflow-x: hidden только как временное решение, исправляйте причину."),
    p("7. Скрытие важного контента на мобильных снижает позиции — оптимизируйте, а не убирайте."),
  ];

  const doc = new Document({
    creator: "SEO-Аудит",
    title: `Адаптивность ${opts.url}`,
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
    },
    sections: [
      {
        properties: { page: { margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        children: [
          ...cover,
          ...summary,
          h2("Проверенные устройства"),
          devicesTable,
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun("")] }),
          h2("Чек-лист mobile-friendly"),
          checklistTable,
          new Paragraph({ spacing: { after: 200 }, children: [new TextRun("")] }),
          ...recommendations,
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 600 },
            children: [new TextRun({ text: "Отчёт сгенерирован системой SEO-Аудит", size: 18, color: MUTED, italics: true, font: "Calibri" })] }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safe = opts.url.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "site";
  saveAs(blob, `responsive-${safe}-${date.toISOString().slice(0, 10)}.docx`);
}