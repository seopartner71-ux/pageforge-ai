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
      <div class="metric-value">${esc(value?.display ?? "—")}</div>
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
          <div class="score-sub">Общая оценка скорости по данным Google Lighthouse. Шкала 0–100: 90+ — хорошо, 50–89 — средне, ниже 50 — плохо.</div>
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
<title>PageSpeed отчёт — ${esc(url)}</title>
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