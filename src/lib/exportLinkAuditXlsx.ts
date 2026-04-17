import ExcelJS from 'exceljs';
import { Chart, registerables } from 'chart.js';
import type { SiteAuditData } from './linkAudit';
import type { DomainSummaryRow } from './domainSummary';

Chart.register(...registerables);

// Фирменные цвета (по образцу шаблона)
const ORANGE = 'FFE8834A';
const ZEBRA = 'FFF9F9F9';
const BORDER_GRAY = 'FFD0D0D0';
const SITE_BAR_COLORS = ['#378ADD', '#EF9F27', '#1D9E75', '#7F77DD'];

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

async function renderChartPng(config: any, width = 720, height = 380): Promise<string> {
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

const ARIAL_10 = { name: 'Arial', size: 10 } as const;
const ARIAL_10_BOLD_WHITE = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } } as const;

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  left: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  right: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
};

export async function exportLinkAuditXlsx(sites: SiteAuditData[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ============================================================
  // ЛИСТ 1 — Сводная таблица
  // Структура: A=показатель, B=аудируемый, C-D=к1, E-F=к2, G-H=к3
  // (для конкурентов резервируем 2 колонки на случай подзаголовков)
  // ============================================================
  const summary = wb.addWorksheet('Сводная таблица');
  summary.views = [{ showGridLines: false }];

  // Шапка (строка 1) — объединения
  summary.mergeCells('A1:A2');
  summary.mergeCells('B1:B2');
  // Конкуренты — каждая по 2 колонки на ширину
  summary.mergeCells('C1:D2');
  summary.mergeCells('E1:F2');
  summary.mergeCells('G1:H2');

  summary.getCell('A1').value = 'Показатель оценки';
  summary.getCell('B1').value = sites[0]?.name || 'Аудируемый сайт';
  summary.getCell('C1').value = sites[1]?.name || 'Конкурент 1';
  summary.getCell('E1').value = sites[2]?.name || 'Конкурент 2';
  summary.getCell('G1').value = sites[3]?.name || 'Конкурент 3';

  ['A1', 'B1', 'C1', 'E1', 'G1'].forEach((addr) => {
    const c = summary.getCell(addr);
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
    c.font = ARIAL_10_BOLD_WHITE;
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    c.border = thinBorder;
  });

  // Чтобы границы были и на правых ячейках в объединениях
  ['D1', 'F1', 'H1', 'A2', 'B2', 'D2', 'F2', 'H2', 'C2', 'E2', 'G2'].forEach((addr) => {
    summary.getCell(addr).border = thinBorder;
    summary.getCell(addr).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
  });

  // Данные (с 3-й строки)
  const metricRows: { label: string; values: (number | string)[] }[] = [
    { label: 'Доменный рейтинг (средний)', values: sites.map((s) => s.avgDR) },
    { label: 'Доменный рейтинг (медиана)', values: sites.map((s) => s.medianDR) },
    { label: 'Уникальные ссылки', values: sites.map((s) => s.totalLinks) },
    { label: 'Ссылающиеся домены', values: sites.map((s) => s.uniqueDomains) },
    { label: '% follow ссылок', values: sites.map((s) => `${s.followPct}%`) },
    { label: '% текстовых ссылок', values: sites.map((s) => `${s.textPct}%`) },
  ];

  // Колонки данных: B (auditee), C-D (к1), E-F (к2), G-H (к3)
  // Значение пишем в первую колонку группы и мерджим
  metricRows.forEach((m, idx) => {
    const row = idx + 3;
    summary.getCell(`A${row}`).value = m.label;
    summary.getCell(`B${row}`).value = m.values[0] ?? '';
    if (sites[1]) summary.getCell(`C${row}`).value = m.values[1] ?? '';
    if (sites[2]) summary.getCell(`E${row}`).value = m.values[2] ?? '';
    if (sites[3]) summary.getCell(`G${row}`).value = m.values[3] ?? '';

    // Объединяем парные колонки конкурентов
    summary.mergeCells(`C${row}:D${row}`);
    summary.mergeCells(`E${row}:F${row}`);
    summary.mergeCells(`G${row}:H${row}`);

    const isZebra = idx % 2 === 1;
    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((col) => {
      const cell = summary.getCell(`${col}${row}`);
      cell.font = ARIAL_10;
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: col === 'A' ? 'left' : 'center', wrapText: true };
      if (isZebra) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
      }
    });
  });

  summary.getColumn(1).width = 30;
  ['B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach((col) => {
    summary.getColumn(col).width = 20;
  });
  summary.getRow(1).height = 32;

  // ============================================================
  // ЛИСТ 2 — Графики
  // ============================================================
  const charts = wb.addWorksheet('Графики');
  charts.views = [{ showGridLines: false }];
  charts.getColumn(1).width = 3;

  const labels = sites.map((s) => s.name);
  const barColors = sites.map((_, i) => SITE_BAR_COLORS[i % SITE_BAR_COLORS.length]);

  // ----- График 1: Доменный рейтинг (DR средний) -----
  const png1 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Средний DR',
        data: sites.map((s) => s.avgDR),
        backgroundColor: barColors,
        borderColor: barColors,
        borderWidth: 1,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Доменный рейтинг (средний)', font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 380);
  let imgId = wb.addImage({ base64: dataUrlToBase64(png1), extension: 'png' });
  charts.addImage(imgId, { tl: { col: 1, row: 1 }, ext: { width: 800, height: 380 } });

  // ----- График 2: Ссылочная масса (Уникальные ссылки + Домены) -----
  const png2 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Уникальные ссылки',
          data: sites.map((s) => s.totalLinks),
          backgroundColor: '#378ADD',
        },
        {
          label: 'Ссылающиеся домены',
          data: sites.map((s) => s.uniqueDomains),
          backgroundColor: '#EF9F27',
        },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Ссылочная масса', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 380);
  imgId = wb.addImage({ base64: dataUrlToBase64(png2), extension: 'png' });
  charts.addImage(imgId, { tl: { col: 1, row: 22 }, ext: { width: 800, height: 380 } });

  // ----- График 3: Follow/Nofollow — 4 пончика (2x2) -----
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const png = await renderChartPng({
      type: 'doughnut',
      data: {
        labels: ['Follow', 'Nofollow'],
        datasets: [{
          data: [s.followPct, 100 - s.followPct],
          backgroundColor: [SITE_BAR_COLORS[i % SITE_BAR_COLORS.length], '#CBD5E1'],
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: `${s.name}: Follow / Nofollow`, font: { size: 14, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
      },
    }, 400, 360);
    const id = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
    const colOffset = (i % 2) * 7;
    const rowOffset = Math.floor(i / 2) * 19;
    charts.addImage(id, {
      tl: { col: 1 + colOffset, row: 43 + rowOffset },
      ext: { width: 400, height: 360 },
    });
  }

  // ----- График 4: % текстовых ссылок (сравнение) -----
  const png4 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '% текстовых ссылок',
        data: sites.map((s) => s.textPct),
        backgroundColor: barColors,
      }],
    },
    options: {
      plugins: {
        title: { display: true, text: '% текстовых ссылок', font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => `${v}%` } } },
    },
  }, 800, 380);
  imgId = wb.addImage({ base64: dataUrlToBase64(png4), extension: 'png' });
  charts.addImage(imgId, { tl: { col: 1, row: 82 }, ext: { width: 800, height: 380 } });

  // ============================================================
  // ЛИСТЫ 3-6 — детальные данные каждого сайта
  // ============================================================
  sites.forEach((site) => {
    const safeName = site.name.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 31);
    const ws = wb.addWorksheet(safeName);
    ws.views = [{ showGridLines: false }];

    // Шапка
    const header = ['Домен источник', 'DR', 'Анкор', 'Тип', 'Атрибуты', 'Статус'];
    ws.addRow(header);
    const hr = ws.getRow(1);
    hr.height = 22;
    header.forEach((_, i) => {
      const c = hr.getCell(i + 1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
      c.font = ARIAL_10_BOLD_WHITE;
      c.alignment = { horizontal: 'center', vertical: 'middle' };
      c.border = thinBorder;
    });

    site.rows.forEach((r, idx) => {
      const row = ws.addRow([
        r.sourceDomain,
        r.dr,
        r.anchor,
        r.type,
        r.rel,
        r.status === 'inactive' ? 'Неактивная' : 'Активная',
      ]);
      const isZebra = idx % 2 === 1;
      for (let i = 1; i <= 6; i++) {
        const c = row.getCell(i);
        c.font = ARIAL_10;
        c.border = thinBorder;
        c.alignment = { vertical: 'top', wrapText: true, horizontal: i === 2 ? 'center' : 'left' };
        if (isZebra) {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
        }
      }
      // Подсветка статуса
      const statusCell = row.getCell(6);
      if (r.status === 'inactive') {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        statusCell.font = { ...ARIAL_10, color: { argb: 'FF64748B' } };
      } else {
        statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } };
        statusCell.font = { ...ARIAL_10, color: { argb: 'FF065F46' } };
      }
    });

    ws.columns = [
      { width: 32 }, { width: 8 }, { width: 40 },
      { width: 14 }, { width: 12 }, { width: 14 },
    ];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const auditedName = (sites[0]?.name || 'audit').replace(/[^a-zA-Z0-9._а-яА-Я-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${auditedName}__Ссылочный_аудит_${date}.xlsx`);
}
