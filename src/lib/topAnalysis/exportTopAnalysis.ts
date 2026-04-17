import ExcelJS from 'exceljs';
import { Chart, registerables } from 'chart.js';
import { TopRow } from './parseTopAnalysisCsv';
import { aggregateDomains, aggregateQueries, uniqueQueries } from './aggregate';

Chart.register(...registerables);

// ===== Палитра =====
const ORANGE = 'FFE8834A';
const ORANGE_DARK = 'FFC2410C';
const HEADER_DARK = 'FF1A1A18';
const ZEBRA = 'FFF9F9F9';
const WHITE = 'FFFFFFFF';
const BORDER_GRAY = 'FFD0D0D0';
const NAVY = 'FF1F3864';
const SITE_BAR_COLORS = ['#378ADD', '#EF9F27', '#1D9E75', '#7F77DD', '#EC4899', '#06B6D4', '#F59E0B', '#10B981'];

const POS_GREEN_BG = 'FFD1FAE5';
const POS_GREEN_FG = 'FF065F46';
const POS_YELLOW_BG = 'FFFEF3C7';
const POS_YELLOW_FG = 'FF92400E';
const POS_RED_BG = 'FFFEE2E2';
const POS_RED_FG = 'FF991B1B';
const MUTED_FG = 'FF9CA3AF';

const ARIAL_10 = { name: 'Arial', size: 10 } as const;
const ARIAL_10_BOLD_WHITE = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } } as const;

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  left: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  right: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
};

function saveBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function renderChartPng(config: any, width = 800, height = 380): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  const chart = new Chart(ctx, {
    ...config,
    options: {
      ...(config.options || {}),
      responsive: false,
      animation: false,
      devicePixelRatio: 2,
    },
  });
  await new Promise((r) => setTimeout(r, 50));
  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

const dataUrlToBase64 = (d: string) => d.split(',')[1];

function applyPositionStyle(cell: ExcelJS.Cell, pos: number | undefined) {
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.border = thinBorder;
  if (!pos) {
    cell.value = '—';
    cell.font = { ...ARIAL_10, color: { argb: MUTED_FG } };
    return;
  }
  cell.value = pos;
  cell.numFmt = '0';
  if (pos <= 3) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: POS_GREEN_BG } };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: POS_GREEN_FG } };
  } else if (pos <= 10) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: POS_YELLOW_BG } };
    cell.font = { name: 'Arial', size: 10, color: { argb: POS_YELLOW_FG } };
  } else if (pos <= 20) {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: POS_RED_BG } };
    cell.font = { name: 'Arial', size: 10, color: { argb: POS_RED_FG } };
  } else {
    cell.font = { ...ARIAL_10, color: { argb: MUTED_FG } };
  }
}

function noteFor(coverage: number, totalQueries: number, avgPos: number): string {
  const ratio = coverage / Math.max(1, totalQueries);
  if (ratio >= 0.7 && avgPos <= 5) return 'Универсальный лидер';
  if (ratio >= 0.5) return 'Сильный игрок';
  if (coverage <= 2 && avgPos <= 3) return 'Узкая специализация';
  if (coverage <= 2) return 'Слабое присутствие';
  return 'Средний охват';
}

function buildInsights(
  domains: ReturnType<typeof aggregateDomains>,
  totalQueries: number,
  myDomain?: string,
): { priority: 'critical' | 'warning' | 'good'; metric: string; fact: string; recommendation: string }[] {
  const out: { priority: 'critical' | 'warning' | 'good'; metric: string; fact: string; recommendation: string }[] = [];
  const sorted = [...domains].sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos);
  const leader = sorted[0];
  if (leader) {
    out.push({
      priority: 'good',
      metric: 'Лидер ниши',
      fact: `${leader.domain} — охват ${leader.coverage}/${totalQueries} запросов, средняя позиция ${leader.avgPos}`,
      recommendation: 'Изучите контентную модель и структуру лидера для бенчмарка.',
    });
  }
  const top3Pool = domains.filter(d => d.top3 >= 3).sort((a, b) => b.top3 - a.top3).slice(0, 3);
  if (top3Pool.length) {
    out.push({
      priority: 'warning',
      metric: 'Концентрация в Топ-3',
      fact: `${top3Pool.map(d => `${d.domain} (${d.top3})`).join(', ')} удерживают большинство Топ-3 позиций`,
      recommendation: 'Эти домены — основные конкуренты. Анализируйте их обратные ссылки и контент в первую очередь.',
    });
  }
  if (myDomain) {
    const me = domains.find(d => d.domain.toLowerCase().includes(myDomain.toLowerCase()));
    if (me) {
      const gapPct = Math.round((me.coverage / Math.max(1, totalQueries)) * 100);
      out.push({
        priority: gapPct < 30 ? 'critical' : gapPct < 60 ? 'warning' : 'good',
        metric: 'Ваше присутствие',
        fact: `${me.domain}: охват ${me.coverage}/${totalQueries} (${gapPct}%), средняя позиция ${me.avgPos}, в Топ-10: ${me.top10}`,
        recommendation: gapPct < 60
          ? 'Расширьте семантику и создайте контент под недостающие запросы.'
          : 'Продолжайте укреплять позиции и работайте над переходом из Топ-10 в Топ-3.',
      });
    } else {
      out.push({
        priority: 'critical',
        metric: 'Ваше присутствие',
        fact: `Домен «${myDomain}» не найден в выгрузке`,
        recommendation: 'Проверьте корректность написания домена или расширьте семантическое ядро.',
      });
    }
  }
  const niche = domains.filter(d => d.coverage <= 2 && d.avgPos <= 3);
  if (niche.length >= 2) {
    out.push({
      priority: 'warning',
      metric: 'Узкие специалисты',
      fact: `${niche.length} доменов держат Топ-3 в 1–2 запросах`,
      recommendation: 'Эти ниши слабо защищены — потенциал для быстрого захвата конкретных кластеров.',
    });
  }
  return out;
}

export interface TopAnalysisExportOptions {
  aiMarkdown?: string | null;
  region?: string;
  myDomain?: string;
  engine?: string;
}

/**
 * Добавляет в workbook 4 листа для одной ПС (Сводная / Матрица / По запросам / Анализ ниши).
 * Имена листов префиксуются `prefix` (например "Яндекс · ").
 */
async function addEngineSheets(
  wb: ExcelJS.Workbook,
  rows: TopRow[],
  opts: TopAnalysisExportOptions & { sheetPrefix?: string },
) {
  if (rows.length === 0) return;

  const queries = uniqueQueries(rows);
  const domains = aggregateDomains(rows).sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos);
  const queriesAgg = aggregateQueries(rows);
  const top10Domains = domains.slice(0, 10);
  const prefix = opts.sheetPrefix || '';

  // ===== ЛИСТ 1 — Сводная =====
  const summary = wb.addWorksheet(`${prefix}Сводная`.slice(0, 31));
  summary.views = [{ showGridLines: false }];

  summary.mergeCells('A1:H1');
  const titleCell = summary.getCell('A1');
  titleCell.value = `Анализ ТОПа${opts.engine ? ` · ${opts.engine}` : ''}${opts.region ? ` · регион: ${opts.region}` : ''}${opts.myDomain ? ` · мой домен: ${opts.myDomain}` : ''}`;
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_DARK } };
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: WHITE } };
  titleCell.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  summary.getRow(1).height = 30;

  const metricsHeader = ['Домен', 'Охват (запросов)', 'Средняя позиция', 'Топ-3', 'Топ-10', 'Сумма позиций', 'Замечание'];
  metricsHeader.forEach((label, i) => {
    const c = summary.getRow(3).getCell(i + 1);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });
  summary.getRow(3).height = 28;

  top10Domains.forEach((d, idx) => {
    const r = summary.getRow(4 + idx);
    const vals: any[] = [d.domain, d.coverage, d.avgPos, d.top3, d.top10, d.sumPos, noteFor(d.coverage, queries.length, d.avgPos)];
    vals.forEach((v, ci) => {
      const c = r.getCell(ci + 1);
      c.value = v;
      c.font = ARIAL_10;
      c.border = thinBorder;
      c.alignment = { vertical: 'middle', horizontal: ci === 0 || ci === 6 ? 'left' : 'center', wrapText: true };
      if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    });
    r.getCell(3).numFmt = '0.0';
  });

  summary.getColumn(1).width = 32;
  summary.getColumn(2).width = 16;
  summary.getColumn(3).width = 16;
  summary.getColumn(4).width = 10;
  summary.getColumn(5).width = 10;
  summary.getColumn(6).width = 16;
  summary.getColumn(7).width = 26;

  // ===== Графики =====
  const labels = top10Domains.map((d) => d.domain);
  const colorList = top10Domains.map((_, i) => SITE_BAR_COLORS[i % SITE_BAR_COLORS.length]);

  const png1 = await renderChartPng({
    type: 'bar',
    data: { labels, datasets: [{ label: 'Охват (запросов)', data: top10Domains.map((d) => d.coverage), backgroundColor: colorList }] },
    options: {
      plugins: {
        title: { display: true, text: `Охват ниши${opts.engine ? ` · ${opts.engine}` : ''}`, font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 380);
  let imgId = wb.addImage({ base64: dataUrlToBase64(png1), extension: 'png' });
  const chart1Row = 4 + top10Domains.length + 1;
  summary.addImage(imgId, { tl: { col: 0, row: chart1Row }, ext: { width: 800, height: 380 } });

  const png2 = await renderChartPng({
    type: 'bar',
    data: { labels, datasets: [{ label: 'Средняя позиция (меньше = лучше)', data: top10Domains.map((d) => d.avgPos), backgroundColor: colorList }] },
    options: {
      plugins: {
        title: { display: true, text: `Средняя позиция доменов${opts.engine ? ` · ${opts.engine}` : ''}`, font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 380);
  imgId = wb.addImage({ base64: dataUrlToBase64(png2), extension: 'png' });
  const chart2Row = chart1Row + 21;
  summary.addImage(imgId, { tl: { col: 0, row: chart2Row }, ext: { width: 800, height: 380 } });

  const png3 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Топ-3', data: top10Domains.map((d) => d.top3), backgroundColor: '#1D9E75' },
        { label: 'Топ-10', data: top10Domains.map((d) => d.top10), backgroundColor: '#EF9F27' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: `Концентрация в Топ-3 / Топ-10${opts.engine ? ` · ${opts.engine}` : ''}`, font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 380);
  imgId = wb.addImage({ base64: dataUrlToBase64(png3), extension: 'png' });
  const chart3Row = chart2Row + 21;
  summary.addImage(imgId, { tl: { col: 0, row: chart3Row }, ext: { width: 800, height: 380 } });

  const buckets = [
    { label: 'Топ-1', count: rows.filter(r => r.position === 1).length, color: '#10B981' },
    { label: 'Топ-2–3', count: rows.filter(r => r.position >= 2 && r.position <= 3).length, color: '#1D9E75' },
    { label: 'Топ-4–10', count: rows.filter(r => r.position >= 4 && r.position <= 10).length, color: '#EF9F27' },
    { label: 'Топ-11–20', count: rows.filter(r => r.position >= 11 && r.position <= 20).length, color: '#F97316' },
    { label: '21+', count: rows.filter(r => r.position > 20).length, color: '#EF4444' },
  ];
  const png4 = await renderChartPng({
    type: 'doughnut',
    data: { labels: buckets.map(b => b.label), datasets: [{ data: buckets.map(b => b.count), backgroundColor: buckets.map(b => b.color) }] },
    options: {
      plugins: {
        title: { display: true, text: `Распределение позиций${opts.engine ? ` · ${opts.engine}` : ''}`, font: { size: 16, weight: 'bold' } },
        legend: { position: 'right' },
      },
    },
  }, 800, 380);
  imgId = wb.addImage({ base64: dataUrlToBase64(png4), extension: 'png' });
  const chart4Row = chart3Row + 21;
  summary.addImage(imgId, { tl: { col: 0, row: chart4Row }, ext: { width: 800, height: 380 } });

  // ===== Выводы =====
  const insights = buildInsights(domains, queries.length, opts.myDomain);
  if (insights.length) {
    const startRow = chart4Row + 21 + 1;
    summary.mergeCells(`A${startRow}:G${startRow}`);
    const tc = summary.getCell(`A${startRow}`);
    tc.value = 'ВЫВОДЫ И РЕКОМЕНДАЦИИ';
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    tc.font = { name: 'Arial', size: 12, bold: true, color: { argb: WHITE } };
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    tc.border = thinBorder;
    summary.getRow(startRow).height = 24;

    const headerRow = startRow + 1;
    summary.mergeCells(`C${headerRow}:D${headerRow}`);
    summary.mergeCells(`E${headerRow}:G${headerRow}`);
    summary.getCell(`A${headerRow}`).value = 'Приоритет';
    summary.getCell(`B${headerRow}`).value = 'Показатель';
    summary.getCell(`C${headerRow}`).value = 'Факт';
    summary.getCell(`E${headerRow}`).value = 'Рекомендация';
    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col) => {
      const c = summary.getCell(`${col}${headerRow}`);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
      c.font = ARIAL_10_BOLD_WHITE;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = thinBorder;
    });

    const PRIO = {
      critical: { label: '🔴 Критично', bg: 'FFFEE2E2', color: 'FFB91C1C' },
      warning: { label: '🟡 Важно', bg: 'FFFEF3C7', color: 'FFB45309' },
      good: { label: '🟢 Хорошо', bg: 'FFD1FAE5', color: 'FF065F46' },
    } as const;

    insights.forEach((ins, i) => {
      const r = headerRow + 1 + i;
      summary.mergeCells(`C${r}:D${r}`);
      summary.mergeCells(`E${r}:G${r}`);
      const p = PRIO[ins.priority];
      summary.getCell(`A${r}`).value = p.label;
      summary.getCell(`B${r}`).value = ins.metric;
      summary.getCell(`C${r}`).value = ins.fact;
      summary.getCell(`E${r}`).value = ins.recommendation;
      ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach((col) => {
        const c = summary.getCell(`${col}${r}`);
        c.font = ARIAL_10;
        c.border = thinBorder;
        c.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
      });
      const prioCell = summary.getCell(`A${r}`);
      prioCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: p.bg } };
      prioCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: p.color } };
      summary.getRow(r).height = 42;
    });
  }

  // ===== ЛИСТ 2 — Матрица =====
  const ws = wb.addWorksheet(`${prefix}Матрица`.slice(0, 31));
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 1 }];

  const totalCols = 1 + queries.length + 2 + 1;
  const head = ws.getRow(1);
  head.height = 36;
  head.getCell(1).value = 'Домен';
  queries.forEach((q, i) => head.getCell(i + 2).value = q);
  head.getCell(queries.length + 2).value = 'Сумма позиций';
  head.getCell(queries.length + 3).value = 'В топах';
  head.getCell(queries.length + 4).value = 'Замечания';

  for (let c = 1; c <= totalCols; c++) {
    const cell = head.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === 1 ? HEADER_DARK : ORANGE_DARK } };
    cell.font = ARIAL_10_BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  domains.forEach((d, idx) => {
    const r = ws.getRow(idx + 2);
    const dc = r.getCell(1);
    dc.value = d.domain;
    dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    dc.font = { ...ARIAL_10_BOLD_WHITE };
    dc.alignment = { horizontal: 'left', vertical: 'middle' };
    dc.border = thinBorder;

    queries.forEach((q, i) => applyPositionStyle(r.getCell(i + 2), d.byQuery.get(q)));

    const sc = r.getCell(queries.length + 2);
    sc.value = d.sumPos; sc.numFmt = '#,##0';
    sc.alignment = { horizontal: 'center', vertical: 'middle' };
    sc.font = { ...ARIAL_10, bold: true };
    sc.border = thinBorder;
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 ? ZEBRA : WHITE } };

    const tc = r.getCell(queries.length + 3);
    tc.value = d.coverage; tc.numFmt = '0';
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    tc.font = { ...ARIAL_10, bold: true };
    tc.border = thinBorder;
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 ? ZEBRA : WHITE } };

    const nc = r.getCell(queries.length + 4);
    nc.value = noteFor(d.coverage, queries.length, d.avgPos);
    nc.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    nc.font = ARIAL_10;
    nc.border = thinBorder;
    nc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 ? ZEBRA : WHITE } };
  });

  ws.getColumn(1).width = 28;
  for (let i = 0; i < queries.length; i++) ws.getColumn(i + 2).width = 16;
  ws.getColumn(queries.length + 2).width = 14;
  ws.getColumn(queries.length + 3).width = 10;
  ws.getColumn(queries.length + 4).width = 24;

  // ===== ЛИСТ 3 — По запросам =====
  const ws2 = wb.addWorksheet(`${prefix}По запросам`.slice(0, 31));
  ws2.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];

  const head2 = ws2.getRow(1);
  head2.height = 28;
  ['Запрос', '#', 'Домен', 'URL', 'Позиция'].forEach((label, i) => {
    const c = head2.getCell(i + 1);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });

  let rowIdx = 2;
  queriesAgg.forEach((q) => {
    q.byDomain.forEach((d, i) => {
      const r = ws2.getRow(rowIdx++);
      const isFirst = i === 0;
      const cells: any[] = [isFirst ? q.query : '', i + 1, d.domain, d.url || '', null];
      cells.forEach((v, ci) => {
        const cell = r.getCell(ci + 1);
        if (ci === 4) {
          applyPositionStyle(cell, d.position);
        } else {
          cell.value = v;
          cell.alignment = { horizontal: ci === 1 ? 'center' : 'left', vertical: 'middle', wrapText: ci === 0 };
          cell.font = isFirst && ci === 0 ? { ...ARIAL_10, bold: true } : ARIAL_10;
          cell.border = thinBorder;
          if (isFirst && ci === 0) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
            cell.font = ARIAL_10_BOLD_WHITE;
          }
        }
      });
    });
  });

  ws2.getColumn(1).width = 36;
  ws2.getColumn(2).width = 5;
  ws2.getColumn(3).width = 28;
  ws2.getColumn(4).width = 50;
  ws2.getColumn(5).width = 12;

  // ===== ЛИСТ 4 — Анализ ниши (AI) =====
  const ws4 = wb.addWorksheet(`${prefix}Анализ ниши`.slice(0, 31));
  ws4.views = [{ showGridLines: false, state: 'frozen', ySplit: 2 }];
  ws4.getColumn(1).width = 110;

  ws4.getCell('A1').value = `AI-анализ ниши${opts.engine ? ` · ${opts.engine}` : ''}`;
  ws4.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: WHITE } };
  ws4.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_DARK } };
  ws4.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  ws4.getRow(1).height = 28;

  const meta: string[] = [];
  if (opts.region) meta.push(`Регион: ${opts.region}`);
  if (opts.myDomain) meta.push(`Мой домен: ${opts.myDomain}`);
  meta.push(`Запросов: ${queries.length}`, `Доменов: ${domains.length}`);
  ws4.getCell('A2').value = meta.join('  •  ');
  ws4.getCell('A2').font = { name: 'Arial', size: 9, color: { argb: 'FF6B7280' }, italic: true };
  ws4.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };

  const md = (opts.aiMarkdown || '').trim();
  if (!md) {
    ws4.getCell('A4').value = 'AI-анализ ещё не сгенерирован.';
    ws4.getCell('A4').font = { name: 'Arial', size: 10, italic: true, color: { argb: 'FF9CA3AF' } };
    ws4.getCell('A4').alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };
  } else {
    let row = 4;
    for (const raw of md.split('\n')) {
      const line = raw.replace(/\r$/, '');
      const cell = ws4.getCell(`A${row}`);
      cell.alignment = { horizontal: 'left', vertical: 'top', wrapText: true, indent: 1 };

      if (/^##\s+/.test(line)) {
        cell.value = line.replace(/^##\s+/, '');
        cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: ORANGE_DARK } };
        ws4.getRow(row).height = 22;
      } else if (/^#\s+/.test(line)) {
        cell.value = line.replace(/^#\s+/, '');
        cell.font = { name: 'Arial', size: 13, bold: true, color: { argb: HEADER_DARK } };
        ws4.getRow(row).height = 24;
      } else if (/^\s*[-*]\s+/.test(line)) {
        cell.value = '•  ' + line.replace(/^\s*[-*]\s+/, '').replace(/\*\*(.+?)\*\*/g, '$1');
        cell.font = ARIAL_10;
      } else if (line.trim() === '') {
        cell.value = '';
      } else {
        cell.value = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/`(.+?)`/g, '$1');
        cell.font = ARIAL_10;
      }
      row++;
    }
  }
}

export async function exportTopAnalysisXlsx(
  rows: TopRow[],
  baseName = 'top_analysis',
  opts: TopAnalysisExportOptions = {},
) {
  if (rows.length === 0) return;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();
  await addEngineSheets(wb, rows, opts);
  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = baseName.replace(/[^a-zA-Z0-9._а-яА-Я-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${safeBase}__Анализ_ТОПа_${date}.xlsx`);
}

// ============================================================
// ОБЪЕДИНЁННЫЙ ЭКСПОРТ — Яндекс + Google + Сравнение
// ============================================================

export interface CombinedEngineData {
  rows: TopRow[];
  aiMarkdown?: string | null;
  label: string; // "Яндекс" | "Google"
  shortPrefix: string; // "Я · " | "G · "
}

export interface CombinedExportOptions {
  region?: string;
  myDomain?: string;
}

export async function exportCombinedTopAnalysisXlsx(
  yandex: CombinedEngineData,
  google: CombinedEngineData,
  baseName = 'top_analysis',
  opts: CombinedExportOptions = {},
) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ===== ЛИСТ 0 — Сравнение Яндекс vs Google =====
  const cmp = wb.addWorksheet('Сравнение Я vs G');
  cmp.views = [{ showGridLines: false, state: 'frozen', ySplit: 4 }];

  cmp.mergeCells('A1:H1');
  const tc = cmp.getCell('A1');
  tc.value = `Сравнение поисковых систем · Яндекс vs Google${opts.region ? ` · регион: ${opts.region}` : ''}${opts.myDomain ? ` · мой домен: ${opts.myDomain}` : ''}`;
  tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_DARK } };
  tc.font = { name: 'Arial', size: 13, bold: true, color: { argb: WHITE } };
  tc.alignment = { horizontal: 'left', vertical: 'middle', indent: 1 };
  cmp.getRow(1).height = 30;

  // Сводные показатели по обеим ПС
  const yQ = uniqueQueries(yandex.rows);
  const gQ = uniqueQueries(google.rows);
  const yD = aggregateDomains(yandex.rows);
  const gD = aggregateDomains(google.rows);

  cmp.mergeCells('A3:D3'); cmp.mergeCells('E3:H3');
  const yh = cmp.getCell('A3'); yh.value = `🔴 ${yandex.label}`;
  const gh = cmp.getCell('E3'); gh.value = `🔵 ${google.label}`;
  [yh, gh].forEach((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    c.font = { name: 'Arial', size: 11, bold: true, color: { argb: WHITE } };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });
  cmp.getRow(3).height = 22;

  const subHeader = ['Запросов', 'Доменов', 'Avg позиция', 'Топ-3 (всего)'];
  [...subHeader, ...subHeader].forEach((label, i) => {
    const c = cmp.getRow(4).getCell(i + 1);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });
  cmp.getRow(4).height = 26;

  const avgPos = (rows: TopRow[]) =>
    rows.length ? +(rows.reduce((s, r) => s + r.position, 0) / rows.length).toFixed(1) : 0;
  const totalTop3 = (rows: TopRow[]) => rows.filter(r => r.position <= 3).length;

  const stats = [
    yQ.length, yD.length, avgPos(yandex.rows), totalTop3(yandex.rows),
    gQ.length, gD.length, avgPos(google.rows), totalTop3(google.rows),
  ];
  stats.forEach((v, i) => {
    const c = cmp.getRow(5).getCell(i + 1);
    c.value = v;
    c.font = { ...ARIAL_10, bold: true };
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });
  cmp.getRow(5).height = 22;

  // ===== Таблица сравнения доменов =====
  const allDomainsMap = new Map<string, { y?: typeof yD[0]; g?: typeof gD[0] }>();
  yD.forEach(d => allDomainsMap.set(d.domain, { ...(allDomainsMap.get(d.domain) || {}), y: d }));
  gD.forEach(d => {
    const ex = allDomainsMap.get(d.domain) || {};
    allDomainsMap.set(d.domain, { ...ex, g: d });
  });

  const merged = Array.from(allDomainsMap.entries())
    .map(([domain, v]) => ({
      domain,
      yCov: v.y?.coverage || 0,
      yAvg: v.y?.avgPos || 0,
      yTop3: v.y?.top3 || 0,
      gCov: v.g?.coverage || 0,
      gAvg: v.g?.avgPos || 0,
      gTop3: v.g?.top3 || 0,
    }))
    .map(d => ({
      ...d,
      totalCov: d.yCov + d.gCov,
      verdict: verdictFor(d, yQ.length, gQ.length),
    }))
    .sort((a, b) => b.totalCov - a.totalCov)
    .slice(0, 30);

  const headerRow = 7;
  cmp.getCell(`A${headerRow}`).value = 'СРАВНЕНИЕ ДОМЕНОВ (ТОП-30 по сумме охвата)';
  cmp.mergeCells(`A${headerRow}:H${headerRow}`);
  const tch = cmp.getCell(`A${headerRow}`);
  tch.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  tch.font = { name: 'Arial', size: 12, bold: true, color: { argb: WHITE } };
  tch.alignment = { horizontal: 'center', vertical: 'middle' };
  cmp.getRow(headerRow).height = 22;

  const cols = ['Домен', 'Я · охват', 'Я · avg', 'Я · топ-3', 'G · охват', 'G · avg', 'G · топ-3', 'Вердикт'];
  cols.forEach((label, i) => {
    const c = cmp.getRow(headerRow + 1).getCell(i + 1);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });
  cmp.getRow(headerRow + 1).height = 28;

  merged.forEach((d, idx) => {
    const r = cmp.getRow(headerRow + 2 + idx);
    const vals: any[] = [
      d.domain,
      d.yCov || '—', d.yAvg || '—', d.yTop3,
      d.gCov || '—', d.gAvg || '—', d.gTop3,
      d.verdict,
    ];
    vals.forEach((v, ci) => {
      const c = r.getCell(ci + 1);
      c.value = v;
      c.font = ARIAL_10;
      c.border = thinBorder;
      c.alignment = { vertical: 'middle', horizontal: ci === 0 || ci === 7 ? 'left' : 'center', wrapText: true };
      if (idx % 2 === 1) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      if ((ci === 2 || ci === 5) && typeof v === 'number') c.numFmt = '0.0';
    });
  });

  cmp.getColumn(1).width = 30;
  for (let i = 2; i <= 7; i++) cmp.getColumn(i).width = 12;
  cmp.getColumn(8).width = 32;

  // ===== Графики сравнения =====
  const top10Merged = merged.slice(0, 10);
  const cmpLabels = top10Merged.map(d => d.domain);

  const png = await renderChartPng({
    type: 'bar',
    data: {
      labels: cmpLabels,
      datasets: [
        { label: yandex.label, data: top10Merged.map(d => d.yCov), backgroundColor: '#EF4444' },
        { label: google.label, data: top10Merged.map(d => d.gCov), backgroundColor: '#3B82F6' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Охват по доменам · Яндекс vs Google', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 900, 420);
  const imgId1 = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
  const chartRow = headerRow + 2 + merged.length + 2;
  cmp.addImage(imgId1, { tl: { col: 0, row: chartRow }, ext: { width: 900, height: 420 } });

  const png2 = await renderChartPng({
    type: 'bar',
    data: {
      labels: cmpLabels,
      datasets: [
        { label: `${yandex.label} · avg позиция`, data: top10Merged.map(d => d.yAvg || null), backgroundColor: '#EF4444' },
        { label: `${google.label} · avg позиция`, data: top10Merged.map(d => d.gAvg || null), backgroundColor: '#3B82F6' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Средняя позиция · Яндекс vs Google (меньше = лучше)', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 900, 420);
  const imgId2 = wb.addImage({ base64: dataUrlToBase64(png2), extension: 'png' });
  cmp.addImage(imgId2, { tl: { col: 0, row: chartRow + 23 }, ext: { width: 900, height: 420 } });

  // ===== Листы по каждой ПС =====
  await addEngineSheets(wb, yandex.rows, {
    region: opts.region,
    myDomain: opts.myDomain,
    engine: yandex.label,
    aiMarkdown: yandex.aiMarkdown,
    sheetPrefix: yandex.shortPrefix,
  });
  await addEngineSheets(wb, google.rows, {
    region: opts.region,
    myDomain: opts.myDomain,
    engine: google.label,
    aiMarkdown: google.aiMarkdown,
    sheetPrefix: google.shortPrefix,
  });

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const safeBase = baseName.replace(/[^a-zA-Z0-9._а-яА-Я-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${safeBase}__Анализ_ТОПа_объединённый_${date}.xlsx`);
}

function verdictFor(
  d: { yCov: number; yAvg: number; gCov: number; gAvg: number },
  yTotal: number,
  gTotal: number,
): string {
  if (d.yCov === 0 && d.gCov > 0) return 'Только в Google';
  if (d.gCov === 0 && d.yCov > 0) return 'Только в Яндексе';
  const yShare = d.yCov / Math.max(1, yTotal);
  const gShare = d.gCov / Math.max(1, gTotal);
  const diff = Math.abs(yShare - gShare);
  if (diff < 0.1 && Math.abs(d.yAvg - d.gAvg) < 3) return 'Стабилен в обеих ПС';
  if (yShare > gShare + 0.15) return 'Сильнее в Яндексе';
  if (gShare > yShare + 0.15) return 'Сильнее в Google';
  if (d.yAvg && d.gAvg && d.yAvg < d.gAvg - 5) return 'Выше позиции в Яндексе';
  if (d.yAvg && d.gAvg && d.gAvg < d.yAvg - 5) return 'Выше позиции в Google';
  return 'Сопоставимое присутствие';
}
