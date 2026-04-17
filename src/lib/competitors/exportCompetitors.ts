import ExcelJS from 'exceljs';
import { Chart, registerables } from 'chart.js';
import { CompetitorRow, COMPETITOR_COLUMNS } from './parseCompetitorsCsv';

Chart.register(...registerables);

// Фирменные цвета (как в exportLinkAuditXlsx)
const ORANGE = 'FFE8834A';
const ZEBRA = 'FFF9F9F9';
const WHITE = 'FFFFFFFF';
const BORDER_GRAY = 'FFD0D0D0';
const SITE_BAR_COLORS = ['#378ADD', '#EF9F27', '#1D9E75', '#7F77DD', '#EC4899', '#06B6D4', '#F43F5E', '#10B981'];

const ARIAL_10 = { name: 'Arial', size: 10 } as const;
const ARIAL_10_BOLD_WHITE = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } } as const;

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  left: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  right: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
};

// Метрики, попадающие в транспонированную таблицу (без столбца "Домен")
const METRICS = COMPETITOR_COLUMNS.filter((c) => c.key !== 'domain');

function saveBlob(buffer: ArrayBuffer, filename: string) {
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function renderChartPng(config: any, width = 800, height = 360): Promise<string> {
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

export async function exportCompetitorsXlsx(rows: CompetitorRow[], baseName = 'competitors') {
  if (rows.length === 0) return;

  const domains = rows.map((r) => r.domain);
  const totalCols = 1 + domains.length;
  const lastColLetter = (() => {
    // Простой конвертер 1->A, 2->B ...
    let n = totalCols;
    let s = '';
    while (n > 0) {
      const m = (n - 1) % 26;
      s = String.fromCharCode(65 + m) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  })();

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ============================================================
  // ЛИСТ "Конкуренты" — транспонированная таблица + графики
  // ============================================================
  const ws = wb.addWorksheet('Конкуренты');
  ws.views = [{ showGridLines: false }];

  // Шапка: первая строка — заголовки (A = "Показатель оценки", дальше домены)
  const headerRow = ws.getRow(1);
  headerRow.height = 32;
  headerRow.getCell(1).value = 'Показатель оценки';
  domains.forEach((d, i) => {
    headerRow.getCell(i + 2).value = d;
  });
  for (let c = 1; c <= totalCols; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    cell.font = ARIAL_10_BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // Строки данных: каждая = метрика
  METRICS.forEach((metric, idx) => {
    const rowIdx = idx + 2;
    const row = ws.getRow(rowIdx);
    row.getCell(1).value = metric.label;

    const values = rows.map((r) => Number(r[metric.key]) || 0);
    values.forEach((v, i) => {
      row.getCell(i + 2).value = v;
      row.getCell(i + 2).numFmt = '#,##0';
    });

    // best / worst (worst = минимальное ненулевое)
    const max = Math.max(...values);
    const nonZero = values.filter((v) => v > 0);
    const min = nonZero.length ? Math.min(...nonZero) : null;
    const allEqual = min !== null && max === min;
    const higherBetter = metric.higherIsBetter !== false;
    const isZebra = idx % 2 === 1;

    for (let c = 1; c <= totalCols; c++) {
      const cell = row.getCell(c);
      cell.font = ARIAL_10;
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: c === 1 ? 'left' : 'right',
        wrapText: true,
      };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? ZEBRA : WHITE },
      };
    }

    // Подсветка best/worst в значениях
    if (!allEqual) {
      values.forEach((v, i) => {
        const cell = row.getCell(i + 2);
        const isBest = higherBetter ? v === max && v > 0 : v === min && v > 0;
        const isWorst = higherBetter ? v === min && v > 0 : v === max && v > 0;
        if (isBest) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF065F46' } };
        } else if (isWorst) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        }
      });
    }
  });

  // Ширина колонок
  ws.getColumn(1).width = 30;
  for (let c = 2; c <= totalCols; c++) ws.getColumn(c).width = 20;

  // ============================================================
  // ГРАФИКИ — встраиваем под таблицей
  // Данные занимают строки 1..(1 + METRICS.length). Графики начинаем через 2 пустые строки.
  // ============================================================
  const labels = domains;
  const colors = labels.map((_, i) => SITE_BAR_COLORS[i % SITE_BAR_COLORS.length]);
  let chartRow = 1 + METRICS.length + 2; // 0-индексированный для anchor

  // График 1 — Трафик по доменам
  const png1 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Трафик',
        data: rows.map((r) => Number(r.traffic) || 0),
        backgroundColor: colors,
        borderColor: colors,
        borderWidth: 1,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Трафик по доменам', font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
  let imgId = wb.addImage({ base64: dataUrlToBase64(png1), extension: 'png' });
  ws.addImage(imgId, { tl: { col: 0, row: chartRow }, ext: { width: 800, height: 360 } });

  // График 2 — Видимость и ТОП-1
  chartRow += 20;
  const png2 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Видимость', data: rows.map((r) => Number(r.visibility) || 0), backgroundColor: '#378ADD' },
        { label: 'В топ 1', data: rows.map((r) => Number(r.top1) || 0), backgroundColor: '#EF9F27' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Видимость и позиции в ТОП-1', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
  imgId = wb.addImage({ base64: dataUrlToBase64(png2), extension: 'png' });
  ws.addImage(imgId, { tl: { col: 0, row: chartRow }, ext: { width: 800, height: 360 } });

  // График 3 — ТОП-1 / ТОП-3 / ТОП-10 (сгруппированный)
  chartRow += 20;
  const png3 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'ТОП-1', data: rows.map((r) => Number(r.top1) || 0), backgroundColor: '#1D9E75' },
        { label: 'ТОП-3', data: rows.map((r) => Number(r.top3) || 0), backgroundColor: '#378ADD' },
        { label: 'ТОП-10', data: rows.map((r) => Number(r.top10) || 0), backgroundColor: '#EF9F27' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Распределение по ТОП-позициям', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
  imgId = wb.addImage({ base64: dataUrlToBase64(png3), extension: 'png' });
  ws.addImage(imgId, { tl: { col: 0, row: chartRow }, ext: { width: 800, height: 360 } });

  // График 4 — Бюджет в контексте
  chartRow += 20;
  const png4 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Бюджет в контексте',
        data: rows.map((r) => Number(r.contextBudget) || 0),
        backgroundColor: colors,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Бюджет в контексте', font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
  imgId = wb.addImage({ base64: dataUrlToBase64(png4), extension: 'png' });
  ws.addImage(imgId, { tl: { col: 0, row: chartRow }, ext: { width: 800, height: 360 } });

  // ============================================================
  // ЛИСТ "Сырые данные" — обычная плоская таблица как backup
  // ============================================================
  const raw = wb.addWorksheet('Сырые данные');
  raw.views = [{ showGridLines: false }];
  const rawHeaders = COMPETITOR_COLUMNS.map((c) => c.label);
  const rawHeaderRow = raw.addRow(rawHeaders);
  rawHeaderRow.height = 22;
  rawHeaders.forEach((_, i) => {
    const c = rawHeaderRow.getCell(i + 1);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });

  rows.forEach((r, idx) => {
    const line = COMPETITOR_COLUMNS.map((col) =>
      col.numeric ? Number(r[col.key]) || 0 : (r[col.key] as string)
    );
    const rowEl = raw.addRow(line);
    const isZebra = idx % 2 === 1;
    for (let i = 1; i <= COMPETITOR_COLUMNS.length; i++) {
      const c = rowEl.getCell(i);
      c.font = ARIAL_10;
      c.border = thinBorder;
      c.alignment = {
        vertical: 'middle',
        horizontal: i === 1 ? 'left' : 'right',
      };
      if (COMPETITOR_COLUMNS[i - 1].numeric) c.numFmt = '#,##0';
      c.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isZebra ? ZEBRA : WHITE },
      };
    }
  });

  raw.getColumn(1).width = 28;
  for (let i = 2; i <= COMPETITOR_COLUMNS.length; i++) raw.getColumn(i).width = 16;

  // Сохранение
  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  saveBlob(buffer as ArrayBuffer, `${baseName}_${date}.xlsx`);
}
