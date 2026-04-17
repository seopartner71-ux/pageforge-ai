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

export async function exportLinkAuditXlsx(
  sites: SiteAuditData[],
  summaryRows: DomainSummaryRow[] = [],
) {
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
  // ГРАФИКИ — встраиваем прямо на лист "Сводная таблица" под данными
  // Данные занимают строки 1-8 (шапка 1-2 + 6 метрик), графики с 12-й
  // ============================================================
  const labels = sites.map((s) => s.name);
  const barColors = sites.map((_, i) => SITE_BAR_COLORS[i % SITE_BAR_COLORS.length]);

  // График 1 (строки 12-30): Доменный рейтинг (DR)
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
        title: { display: true, text: 'Доменный рейтинг (DR)', font: { size: 16, weight: 'bold' } },
        legend: { display: false },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 360);
  let imgId = wb.addImage({ base64: dataUrlToBase64(png1), extension: 'png' });
  // ExcelJS колонки/строки 0-индексированы для anchor
  summary.addImage(imgId, { tl: { col: 0, row: 11 }, ext: { width: 800, height: 360 } });

  // График 2 (строки 32-50): Ссылочная масса
  const png2 = await renderChartPng({
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Уникальные ссылки', data: sites.map((s) => s.totalLinks), backgroundColor: '#378ADD' },
        { label: 'Ссылающиеся домены', data: sites.map((s) => s.uniqueDomains), backgroundColor: '#EF9F27' },
      ],
    },
    options: {
      plugins: {
        title: { display: true, text: 'Ссылочная масса', font: { size: 16, weight: 'bold' } },
        legend: { position: 'bottom' },
      },
      scales: { y: { beginAtZero: true } },
    },
  }, 800, 360);
  imgId = wb.addImage({ base64: dataUrlToBase64(png2), extension: 'png' });
  summary.addImage(imgId, { tl: { col: 0, row: 31 }, ext: { width: 800, height: 360 } });

  // График 3 (строки 52-70): Видимость в поиске (из сводки если есть, иначе % текстовых)
  let png3: string;
  let title3: string;
  if (summaryRows.length) {
    const sLabels = summaryRows.map((r) => r.domain);
    png3 = await renderChartPng({
      type: 'bar',
      data: {
        labels: sLabels,
        datasets: [
          { label: 'В топ 10', data: summaryRows.map((r) => r.top10), backgroundColor: '#378ADD' },
          { label: 'В топ 50', data: summaryRows.map((r) => r.top50), backgroundColor: '#EF9F27' },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Видимость в поиске', font: { size: 16, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
        scales: { y: { beginAtZero: true } },
      },
    }, 800, 360);
    title3 = 'Видимость в поиске';
  } else {
    png3 = await renderChartPng({
      type: 'bar',
      data: {
        labels,
        datasets: [{ label: '% текстовых ссылок', data: sites.map((s) => s.textPct), backgroundColor: barColors }],
      },
      options: {
        plugins: {
          title: { display: true, text: '% текстовых ссылок', font: { size: 16, weight: 'bold' } },
          legend: { display: false },
        },
        scales: { y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => `${v}%` } } },
      },
    }, 800, 360);
    title3 = '% текстовых ссылок';
  }
  imgId = wb.addImage({ base64: dataUrlToBase64(png3), extension: 'png' });
  summary.addImage(imgId, { tl: { col: 0, row: 51 }, ext: { width: 800, height: 360 } });

  // График 4 (строки 72-90): Follow / Nofollow — пончики для каждого сайта рядом
  // Размер каждого пончика ~190x360 чтобы 4 шт уместились в ширину 8 колонок
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
          title: { display: true, text: `${s.name}: Follow/Nofollow`, font: { size: 12, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
      },
    }, 380, 360);
    const id = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
    // 4 пончика в ряд: каждый занимает 2 колонки
    summary.addImage(id, {
      tl: { col: i * 2, row: 71 },
      ext: { width: 380, height: 360 },
    });
  }
  // Заголовок над пончиками
  summary.getCell('A71').value = 'Follow / Nofollow %';
  summary.getCell('A71').font = { name: 'Arial', size: 12, bold: true };


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

  // ============================================================
  // ЛИСТ "Общие показатели" — из сводной таблицы (если загружена)
  // ============================================================
  if (summaryRows.length) {
    const ov = wb.addWorksheet('Общие показатели');
    ov.views = [{ showGridLines: false }];

    const summaryColors = ['#378ADD', '#EF9F27', '#1D9E75', '#7F77DD', '#EC4899', '#06B6D4'];
    const metrics: { label: string; key: keyof DomainSummaryRow }[] = [
      { label: 'DR', key: 'dr' },
      { label: 'В топ 10', key: 'top10' },
      { label: 'В топ 50', key: 'top50' },
      { label: 'Трафик', key: 'traffic' },
      { label: 'Обратные ссылки', key: 'backlinks' },
      { label: 'Ссылающихся доменов', key: 'refDomains' },
      { label: 'Исходящих доменов', key: 'outDomains' },
      { label: 'Исходящие ссылки', key: 'outLinks' },
      { label: 'Ссылающихся IP', key: 'refIps' },
    ];

    // Шапка
    const headerRow = ['Показатель', ...summaryRows.map((r) => r.domain)];
    ov.addRow(headerRow);
    const hr = ov.getRow(1);
    hr.height = 26;
    headerRow.forEach((_, i) => {
      const c = hr.getCell(i + 1);
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ORANGE } };
      c.font = ARIAL_10_BOLD_WHITE;
      c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      c.border = thinBorder;
    });

    metrics.forEach((m, mi) => {
      const row = ov.addRow([m.label, ...summaryRows.map((r) => Number(r[m.key]))]);
      const isZebra = mi % 2 === 1;
      for (let i = 1; i <= summaryRows.length + 1; i++) {
        const c = row.getCell(i);
        c.font = ARIAL_10;
        c.border = thinBorder;
        c.alignment = { vertical: 'middle', horizontal: i === 1 ? 'left' : 'center' };
        if (isZebra) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
      }
    });

    ov.getColumn(1).width = 30;
    for (let i = 2; i <= summaryRows.length + 1; i++) ov.getColumn(i).width = 18;

    // Графики
    const labels = summaryRows.map((r) => r.domain);
    const colorList = summaryRows.map((_, i) => summaryColors[i % summaryColors.length]);
    let chartRow = metrics.length + 4;

    // 1. Видимость в поиске (топ-10 + топ-50)
    const visPng = await renderChartPng({
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'В топ 10', data: summaryRows.map((r) => r.top10), backgroundColor: '#378ADD' },
          { label: 'В топ 50', data: summaryRows.map((r) => r.top50), backgroundColor: '#EF9F27' },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Видимость в поиске', font: { size: 16, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
        scales: { y: { beginAtZero: true } },
      },
    }, 800, 380);
    let id = wb.addImage({ base64: dataUrlToBase64(visPng), extension: 'png' });
    ov.addImage(id, { tl: { col: 1, row: chartRow }, ext: { width: 800, height: 380 } });
    chartRow += 21;

    // 2. Трафик
    const trafPng = await renderChartPng({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Органический трафик',
          data: summaryRows.map((r) => r.traffic),
          backgroundColor: colorList,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Органический трафик', font: { size: 16, weight: 'bold' } },
          legend: { display: false },
        },
        scales: { y: { beginAtZero: true } },
      },
    }, 800, 380);
    id = wb.addImage({ base64: dataUrlToBase64(trafPng), extension: 'png' });
    ov.addImage(id, { tl: { col: 1, row: chartRow }, ext: { width: 800, height: 380 } });
    chartRow += 21;

    // 3. Ссылочный профиль (Backlinks + RefDomains + DR)
    const profPng = await renderChartPng({
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Обратные ссылки', data: summaryRows.map((r) => r.backlinks), backgroundColor: '#378ADD' },
          { label: 'Ссылающиеся домены', data: summaryRows.map((r) => r.refDomains), backgroundColor: '#EF9F27' },
          { label: 'DR', data: summaryRows.map((r) => r.dr), backgroundColor: '#1D9E75' },
        ],
      },
      options: {
        plugins: {
          title: { display: true, text: 'Ссылочный профиль', font: { size: 16, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
        scales: { y: { beginAtZero: true } },
      },
    }, 800, 380);
    id = wb.addImage({ base64: dataUrlToBase64(profPng), extension: 'png' });
    ov.addImage(id, { tl: { col: 1, row: chartRow }, ext: { width: 800, height: 380 } });
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const auditedName = (sites[0]?.name || summaryRows[0]?.domain || 'audit').replace(/[^a-zA-Z0-9._а-яА-Я-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${auditedName}__Ссылочный_аудит_${date}.xlsx`);
}
