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
  PageBreak,
} from "docx";
import { saveAs } from "file-saver";

type Strategy = "mobile" | "desktop";

type AuditItem = {
  id: string;
  title: string;
  description: string;
  displayValue?: string;
  score: number | null;
  scoreDisplayMode: string;
  savingsMs?: number;
  savingsBytes?: number;
  severity: "critical" | "warning" | "info";
};

export type PageSpeedMetrics = {
  score: number;
  lcp?: { display: string; numeric?: number };
  tbt?: { display: string; numeric?: number };
  cls?: { display: string; numeric?: number };
  fcp?: { display: string; numeric?: number };
  speedIndex?: { display: string; numeric?: number };
  opportunities: AuditItem[];
  diagnostics: AuditItem[];
  failed: AuditItem[];
};

export type PageSpeedResults = Partial<Record<Strategy, PageSpeedMetrics>>;

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(score: number): string {
  if (score >= 90) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

function scoreLabel(score: number): string {
  if (score >= 90) return "Хорошо";
  if (score >= 50) return "Требует улучшений";
  return "Плохо";
}

function sevColor(s: AuditItem["severity"]): string {
  if (s === "critical") return "#ef4444";
  if (s === "warning") return "#f59e0b";
  return "#3b82f6";
}

function sevLabel(s: AuditItem["severity"]): string {
  if (s === "critical") return "Критично";
  if (s === "warning") return "Предупреждение";
  return "Инфо";
}

function cleanDescription(md: string): string {
  if (!md) return "";
  return md
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)\.?/g, "$1")
    .trim();
}

function renderScoreCircle(score: number): string {
  const color = scoreColor(score);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return `
    <div class="score-wrap">
      <svg viewBox="0 0 128 128" width="128" height="128">
        <circle cx="64" cy="64" r="${radius}" stroke="#e5e7eb" stroke-width="10" fill="none"/>
        <circle cx="64" cy="64" r="${radius}"
          stroke="${color}" stroke-width="10" fill="none"
          stroke-linecap="round" stroke-dasharray="${circumference}"
          stroke-dashoffset="${offset}"
          transform="rotate(-90 64 64)"/>
      </svg>
      <div class="score-num" style="color:${color}">${score}</div>
    </div>
  `;
}

function renderMetric(label: string, value?: { display: string }, hint?: string): string {
  return `
    <div class="metric">
      <div class="metric-label">${esc(label)}</div>
      <div class="metric-value">${esc(value?.display ?? "-")}</div>
      ${hint ? `<div class="metric-hint">${esc(hint)}</div>` : ""}
    </div>
  `;
}

function renderAuditGroup(title: string, items: AuditItem[]): string {
  if (!items.length) return "";
  return `
    <div class="group">
      <h3>${esc(title)} <span class="muted">· ${items.length}</span></h3>
      <div class="audits">
        ${items
          .map((it) => {
            const color = sevColor(it.severity);
            const text = cleanDescription(it.description);
            return `
              <div class="audit" style="border-left-color:${color}">
                <div class="audit-head">
                  <span class="sev" style="background:${color}1a;color:${color}">${esc(sevLabel(it.severity))}</span>
                  <span class="audit-title">${esc(it.title)}</span>
                  ${it.displayValue ? `<span class="audit-value">${esc(it.displayValue)}</span>` : ""}
                  ${it.savingsMs && it.savingsMs > 0 ? `<span class="audit-saving">экономия ~${Math.round(it.savingsMs)} мс</span>` : ""}
                </div>
                ${text ? `<div class="audit-desc">${esc(text)}</div>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderStrategy(label: string, data: PageSpeedMetrics): string {
  const top3 = [...data.opportunities, ...data.diagnostics, ...data.failed]
    .map((it) => ({ it, w: (it.savingsMs ?? 0) + ({ critical: 3, warning: 2, info: 1 }[it.severity]) * 50 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.it);

  return `
    <section class="strategy">
      <div class="strategy-head">
        <h2>${esc(label)}</h2>
        <span class="badge" style="background:${scoreColor(data.score)}1a;color:${scoreColor(data.score)}">${esc(scoreLabel(data.score))}</span>
      </div>

      <div class="score-card">
        ${renderScoreCircle(data.score)}
        <div>
          <div class="score-title">Performance Score</div>
          <div class="score-sub">Общая оценка скорости по данным Google Lighthouse. Шкала 0–100: 90+ - хорошо, 50–89 - средне, ниже 50 - плохо.</div>
        </div>
      </div>

      <div class="metrics-grid">
        ${renderMetric("LCP", data.lcp, "Largest Contentful Paint")}
        ${renderMetric("TBT", data.tbt, "Total Blocking Time")}
        ${renderMetric("CLS", data.cls, "Cumulative Layout Shift")}
        ${renderMetric("FCP", data.fcp, "First Contentful Paint")}
        ${renderMetric("Speed Index", data.speedIndex, "Скорость отображения")}
      </div>

      ${
        top3.length
          ? `
        <div class="top3">
          <h3>Топ-3 приоритета</h3>
          <div class="top3-grid">
            ${top3
              .map(
                (it, i) => `
              <div class="top3-card" style="border-color:${sevColor(it.severity)}40">
                <div class="top3-num" style="background:${sevColor(it.severity)}">${i + 1}</div>
                <div class="top3-title">${esc(it.title)}</div>
                ${it.savingsMs && it.savingsMs > 0 ? `<div class="top3-sub">экономия ~${Math.round(it.savingsMs)} мс</div>` : it.displayValue ? `<div class="top3-sub">${esc(it.displayValue)}</div>` : ""}
              </div>
            `,
              )
              .join("")}
          </div>
        </div>
      `
          : ""
      }

      ${renderAuditGroup("Возможности ускорения", data.opportunities)}
      ${renderAuditGroup("Диагностика", data.diagnostics)}
      ${renderAuditGroup("Прочие найденные проблемы", data.failed)}
    </section>
  `;
}

export function openPageSpeedReportPrint(opts: {
  url: string;
  results: PageSpeedResults;
  checkedAt?: string | null;
}): void {
  const { url, results, checkedAt } = opts;
  const date = checkedAt ? new Date(checkedAt) : new Date();
  const dateStr = date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>PageSpeed отчёт - ${esc(url)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, sans-serif;
    color: #111827;
    background: #f9fafb;
    margin: 0;
    padding: 32px;
    font-size: 13px;
    line-height: 1.5;
  }
  .container { max-width: 880px; margin: 0 auto; }
  header.cover {
    background: linear-gradient(135deg, #0f172a, #1e3a8a);
    color: #fff;
    padding: 36px 32px;
    border-radius: 14px;
    margin-bottom: 28px;
  }
  header.cover .brand {
    font-size: 11px;
    letter-spacing: 2px;
    text-transform: uppercase;
    opacity: .7;
  }
  header.cover h1 { font-size: 26px; margin: 8px 0 6px; font-weight: 700; }
  header.cover .url { font-size: 14px; opacity: .85; word-break: break-all; }
  header.cover .date { margin-top: 16px; font-size: 12px; opacity: .7; }

  section.strategy {
    background: #fff;
    border: 1px solid #e5e7eb;
    border-radius: 14px;
    padding: 24px;
    margin-bottom: 24px;
    page-break-inside: avoid;
  }
  .strategy-head {
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid #e5e7eb; padding-bottom: 14px; margin-bottom: 18px;
  }
  .strategy-head h2 { font-size: 18px; margin: 0; }
  .badge { padding: 4px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }

  .score-card {
    display: flex; align-items: center; gap: 22px;
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 18px;
  }
  .score-wrap { position: relative; width: 128px; height: 128px; flex-shrink: 0; }
  .score-num {
    position: absolute; inset: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 34px; font-weight: 700;
  }
  .score-title { font-size: 14px; font-weight: 600; }
  .score-sub { color: #6b7280; font-size: 12px; margin-top: 4px; }

  .metrics-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 10px;
    margin-bottom: 22px;
  }
  .metric { border: 1px solid #e5e7eb; border-radius: 10px; padding: 10px 12px; background: #fff; }
  .metric-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; }
  .metric-value { font-size: 17px; font-weight: 600; margin-top: 2px; }
  .metric-hint { font-size: 10px; color: #9ca3af; margin-top: 2px; }

  .top3 { margin-bottom: 22px; }
  .top3 h3 { font-size: 14px; margin: 0 0 10px; }
  .top3-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .top3-card { border: 1px solid; border-radius: 10px; padding: 12px; background: #fff; position: relative; }
  .top3-num {
    width: 22px; height: 22px; border-radius: 50%; color: #fff;
    font-size: 12px; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 8px;
  }
  .top3-title { font-size: 12px; font-weight: 600; line-height: 1.35; }
  .top3-sub { font-size: 11px; color: #6b7280; margin-top: 6px; }

  .group { margin-top: 18px; }
  .group h3 { font-size: 13px; margin: 0 0 8px; }
  .muted { color: #9ca3af; font-weight: 400; }
  .audits { display: flex; flex-direction: column; gap: 8px; }
  .audit {
    border: 1px solid #e5e7eb;
    border-left: 3px solid;
    border-radius: 8px;
    padding: 10px 12px;
    background: #fff;
    page-break-inside: avoid;
  }
  .audit-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .sev { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }
  .audit-title { font-size: 12.5px; font-weight: 600; flex: 1; min-width: 200px; }
  .audit-value, .audit-saving {
    font-size: 10.5px; background: #f3f4f6; color: #4b5563;
    padding: 2px 6px; border-radius: 4px; font-variant-numeric: tabular-nums;
  }
  .audit-desc { font-size: 11.5px; color: #4b5563; margin-top: 6px; line-height: 1.5; }

  footer.foot {
    text-align: center; color: #9ca3af; font-size: 11px;
    margin-top: 24px;
  }

  @media print {
    body { background: #fff; padding: 0; }
    .container { max-width: none; }
    header.cover { border-radius: 0; margin-bottom: 18px; }
    section.strategy { border-radius: 0; box-shadow: none; }
    .no-print { display: none !important; }
  }

  .actions {
    position: sticky; top: 0; z-index: 10;
    background: rgba(255,255,255,.95); backdrop-filter: blur(6px);
    padding: 10px 0; margin-bottom: 16px;
    display: flex; gap: 8px; justify-content: flex-end;
  }
  .btn {
    border: none; background: #2563eb; color: #fff;
    padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500;
    cursor: pointer;
  }
  .btn.secondary { background: #e5e7eb; color: #111827; }
</style>
</head>
<body>
  <div class="container">
    <div class="actions no-print">
      <button class="btn secondary" onclick="window.close()">Закрыть</button>
      <button class="btn" onclick="window.print()">Скачать PDF</button>
    </div>

    <header class="cover">
      <div class="brand">PageSpeed Insights · отчёт</div>
      <h1>Аудит скорости загрузки</h1>
      <div class="url">${esc(url)}</div>
      <div class="date">Дата проверки: ${esc(dateStr)}</div>
    </header>

    ${results.mobile ? renderStrategy("Мобильная версия", results.mobile) : ""}
    ${results.desktop ? renderStrategy("Десктоп версия", results.desktop) : ""}

    <footer class="foot">
      Отчёт сгенерирован на основе данных Google PageSpeed Insights · Lighthouse
    </footer>
  </div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.print(); }, 400);
    });
  </script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) {
    alert("Разрешите всплывающие окна, чтобы сформировать отчёт");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

// ============= DOCX export =============

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: "D1D5DB" };
const CELL_BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER };

function p(text: string, opts: { bold?: boolean; size?: number; color?: string; align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: opts.size ?? 22,
        color: opts.color,
        font: "Calibri",
      }),
    ],
  });
}

function heading(text: string, level: (typeof HeadingLevel)[keyof typeof HeadingLevel]) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: "Calibri" })],
  });
}

function cell(text: string, opts: { bold?: boolean; bg?: string; width?: number; color?: string } = {}) {
  return new TableCell({
    borders: CELL_BORDERS,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [
      new Paragraph({
        children: [new TextRun({ text, bold: opts.bold, color: opts.color, font: "Calibri", size: 20 })],
      }),
    ],
  });
}

function scoreHex(score: number) {
  if (score >= 90) return "10B981";
  if (score >= 50) return "F59E0B";
  return "EF4444";
}

function sevHex(s: AuditItem["severity"]) {
  if (s === "critical") return "EF4444";
  if (s === "warning") return "F59E0B";
  return "3B82F6";
}

function strategyBlock(label: string, data: PageSpeedMetrics): Paragraph[] | (Paragraph | Table)[] {
  const blocks: (Paragraph | Table)[] = [];

  blocks.push(heading(label, HeadingLevel.HEADING_1));

  // Score row
  blocks.push(
    new Paragraph({
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Performance Score: ", bold: true, font: "Calibri", size: 24 }),
        new TextRun({ text: String(data.score), bold: true, color: scoreHex(data.score), font: "Calibri", size: 36 }),
        new TextRun({ text: "  / 100  ·  " + scoreLabel(data.score), color: "6B7280", font: "Calibri", size: 20 }),
      ],
    }),
  );

  // Metrics table
  const metrics: Array<[string, string, string]> = [
    ["LCP", data.lcp?.display ?? "-", "Largest Contentful Paint"],
    ["TBT", data.tbt?.display ?? "-", "Total Blocking Time"],
    ["CLS", data.cls?.display ?? "-", "Cumulative Layout Shift"],
    ["FCP", data.fcp?.display ?? "-", "First Contentful Paint"],
    ["Speed Index", data.speedIndex?.display ?? "-", "Скорость отображения"],
  ];

  blocks.push(heading("Core Web Vitals", HeadingLevel.HEADING_2));
  blocks.push(
    new Table({
      width: { size: 9360, type: WidthType.DXA },
      columnWidths: [2000, 2000, 5360],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell("Метрика", { bold: true, bg: "F3F4F6", width: 2000 }),
            cell("Значение", { bold: true, bg: "F3F4F6", width: 2000 }),
            cell("Описание", { bold: true, bg: "F3F4F6", width: 5360 }),
          ],
        }),
        ...metrics.map(
          ([m, v, d]) =>
            new TableRow({
              children: [cell(m, { bold: true, width: 2000 }), cell(v, { width: 2000 }), cell(d, { width: 5360, color: "6B7280" })],
            }),
        ),
      ],
    }),
  );

  // Top-3
  const top3 = [...data.opportunities, ...data.diagnostics, ...data.failed]
    .map((it) => ({ it, w: (it.savingsMs ?? 0) + { critical: 3, warning: 2, info: 1 }[it.severity] * 50 }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 3)
    .map((x) => x.it);

  if (top3.length) {
    blocks.push(heading("Топ-3 приоритета", HeadingLevel.HEADING_2));
    top3.forEach((it, i) => {
      blocks.push(
        new Paragraph({
          spacing: { before: 80, after: 40 },
          children: [
            new TextRun({ text: `${i + 1}. `, bold: true, font: "Calibri", size: 22, color: sevHex(it.severity) }),
            new TextRun({ text: it.title, bold: true, font: "Calibri", size: 22 }),
            it.savingsMs && it.savingsMs > 0
              ? new TextRun({ text: `  · экономия ~${Math.round(it.savingsMs)} мс`, color: "6B7280", font: "Calibri", size: 20 })
              : it.displayValue
                ? new TextRun({ text: `  · ${it.displayValue}`, color: "6B7280", font: "Calibri", size: 20 })
                : new TextRun({ text: "" }),
          ],
        }),
      );
    });
  }

  // Audit groups
  const groups: Array<[string, AuditItem[]]> = [
    ["Возможности ускорения", data.opportunities],
    ["Диагностика", data.diagnostics],
    ["Прочие найденные проблемы", data.failed],
  ];

  for (const [title, items] of groups) {
    if (!items.length) continue;
    blocks.push(heading(`${title} (${items.length})`, HeadingLevel.HEADING_2));
    for (const it of items) {
      blocks.push(
        new Paragraph({
          spacing: { before: 120, after: 40 },
          children: [
            new TextRun({ text: `[${sevLabel(it.severity)}] `, bold: true, color: sevHex(it.severity), font: "Calibri", size: 20 }),
            new TextRun({ text: it.title, bold: true, font: "Calibri", size: 22 }),
            it.displayValue ? new TextRun({ text: `  · ${it.displayValue}`, color: "4B5563", font: "Calibri", size: 20 }) : new TextRun({ text: "" }),
            it.savingsMs && it.savingsMs > 0
              ? new TextRun({ text: `  · экономия ~${Math.round(it.savingsMs)} мс`, color: "4B5563", font: "Calibri", size: 20 })
              : new TextRun({ text: "" }),
          ],
        }),
      );
      const desc = cleanDescription(it.description);
      if (desc) blocks.push(p(desc, { color: "4B5563", size: 20 }));
    }
  }

  return blocks;
}

export async function downloadPageSpeedReportDocx(opts: {
  url: string;
  results: PageSpeedResults;
  checkedAt?: string | null;
}): Promise<void> {
  const { url, results, checkedAt } = opts;
  const date = checkedAt ? new Date(checkedAt) : new Date();
  const dateStr = date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const children: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
      children: [new TextRun({ text: "PageSpeed Insights · отчёт", color: "6B7280", font: "Calibri", size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Аудит скорости загрузки", bold: true, font: "Calibri", size: 40 })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: url, font: "Calibri", size: 22, color: "2563EB" })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 },
      children: [new TextRun({ text: `Дата проверки: ${dateStr}`, font: "Calibri", size: 20, color: "6B7280" })],
    }),
  ];

  if (results.mobile) {
    children.push(...(strategyBlock("Мобильная версия", results.mobile) as (Paragraph | Table)[]));
  }
  if (results.desktop) {
    if (results.mobile) children.push(new Paragraph({ children: [new PageBreak()] }));
    children.push(...(strategyBlock("Десктоп версия", results.desktop) as (Paragraph | Table)[]));
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 400 },
      children: [
        new TextRun({
          text: "Отчёт сгенерирован на основе данных Google PageSpeed Insights · Lighthouse",
          color: "9CA3AF",
          font: "Calibri",
          size: 18,
          italics: true,
        }),
      ],
    }),
  );

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Calibri", size: 22 } } },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, color: "0F172A", font: "Calibri" },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, color: "1E3A8A", font: "Calibri" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeUrl = url.replace(/^https?:\/\//, "").replace(/[^\w.-]+/g, "_").slice(0, 60);
  saveAs(blob, `pagespeed_${safeUrl}_${date.toISOString().slice(0, 10)}.docx`);
}