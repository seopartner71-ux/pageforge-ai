import ExcelJS from 'exceljs';
import { Chart, registerables } from 'chart.js';
import type { SiteAuditData } from './linkAudit';

Chart.register(...registerables);

const SITE_COLORS_HEX = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6'];

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

/** Рендерит chart.js на offscreen canvas и возвращает PNG dataURL */
async function renderChartPng(
  config: any,
  width = 720,
  height = 380,
): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // canvas нужен в DOM (некоторые браузеры) но скрыт
  canvas.style.position = 'fixed';
  canvas.style.left = '-99999px';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d')!;
  // Белый фон чтобы PNG не был прозрачным
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
  // Дать chart.js нарисоваться
  await new Promise((r) => setTimeout(r, 50));
  const dataUrl = canvas.toDataURL('image/png');
  chart.destroy();
  canvas.remove();
  return dataUrl;
}

function dataUrlToBase64(dataUrl: string): string {
  return dataUrl.split(',')[1];
}

export async function exportLinkAuditXlsx(sites: SiteAuditData[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ========== Лист 1: Сводная ==========
  const summary = wb.addWorksheet('Сводная');
  summary.addRow(['Показатель', ...sites.map((s) => s.name)]);
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' },
  };
  const dataRows: [string, ...(number | string)[]][] = [
    ['Доменный рейтинг (средний)', ...sites.map((s) => s.avgDR)],
    ['Доменный рейтинг (медиана)', ...sites.map((s) => s.medianDR)],
    ['Уникальные ссылки', ...sites.map((s) => s.totalLinks)],
    ['Ссылающиеся домены', ...sites.map((s) => s.uniqueDomains)],
    ['% follow ссылок', ...sites.map((s) => `${s.followPct}%`)],
    ['% текстовых ссылок', ...sites.map((s) => `${s.textPct}%`)],
  ];
  dataRows.forEach((r) => summary.addRow(r));
  summary.getColumn(1).width = 32;
  for (let i = 2; i <= sites.length + 1; i++) summary.getColumn(i).width = 24;

  // ========== Лист 2: Графики ==========
  const charts = wb.addWorksheet('Графики');
  charts.getColumn(1).width = 4;

  const labels = sites.map((s) => s.name);
  const colors = sites.map((_, i) => SITE_COLORS_HEX[i % SITE_COLORS_HEX.length]);

  const barConfigs: { title: string; values: number[] }[] = [
    { title: 'DR средний по сайтам', values: sites.map((s) => s.avgDR) },
    { title: 'Уникальные ссылки по сайтам', values: sites.map((s) => s.totalLinks) },
    { title: 'Ссылающиеся домены по сайтам', values: sites.map((s) => s.uniqueDomains) },
  ];

  let currentRow = 1;
  // Bar charts (один под другим)
  for (const cfg of barConfigs) {
    const png = await renderChartPng({
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: cfg.title,
          data: cfg.values,
          backgroundColor: colors,
          borderColor: colors,
          borderWidth: 1,
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: cfg.title, font: { size: 16, weight: 'bold' } },
          legend: { display: false },
        },
        scales: { y: { beginAtZero: true } },
      },
    }, 720, 360);

    const imgId = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
    charts.addImage(imgId, {
      tl: { col: 1, row: currentRow },
      ext: { width: 720, height: 360 },
    });
    currentRow += 20; // отступ между графиками
  }

  // Pie: follow vs nofollow для каждого сайта (в одну строку 2x2)
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const png = await renderChartPng({
      type: 'doughnut',
      data: {
        labels: ['Follow', 'Nofollow'],
        datasets: [{
          data: [s.followPct, 100 - s.followPct],
          backgroundColor: ['#10B981', '#64748B'],
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: `${s.name}: Follow / Nofollow`, font: { size: 14, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
      },
    }, 420, 360);

    const imgId = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
    const colOffset = (i % 2) * 8;
    const rowOffset = Math.floor(i / 2) * 20;
    charts.addImage(imgId, {
      tl: { col: 1 + colOffset, row: currentRow + rowOffset },
      ext: { width: 420, height: 360 },
    });
  }
  currentRow += Math.ceil(sites.length / 2) * 20;

  // Pie: текстовые vs прочие (2x2)
  for (let i = 0; i < sites.length; i++) {
    const s = sites[i];
    const png = await renderChartPng({
      type: 'doughnut',
      data: {
        labels: ['Текстовые', 'Прочие'],
        datasets: [{
          data: [s.textPct, 100 - s.textPct],
          backgroundColor: [SITE_COLORS_HEX[i], '#CBD5E1'],
        }],
      },
      options: {
        plugins: {
          title: { display: true, text: `${s.name}: Текстовые vs Прочие`, font: { size: 14, weight: 'bold' } },
          legend: { position: 'bottom' },
        },
      },
    }, 420, 360);

    const imgId = wb.addImage({ base64: dataUrlToBase64(png), extension: 'png' });
    const colOffset = (i % 2) * 8;
    const rowOffset = Math.floor(i / 2) * 20;
    charts.addImage(imgId, {
      tl: { col: 1 + colOffset, row: currentRow + rowOffset },
      ext: { width: 420, height: 360 },
    });
  }

  // ========== Детальные листы для каждого сайта ==========
  sites.forEach((site, idx) => {
    const safeName = site.name.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 28);
    const ws = wb.addWorksheet(`${idx + 1}. ${safeName}`.slice(0, 31));
    ws.addRow(['Домен источник', 'URL источник', 'DR', 'Анкор', 'Тип', 'Атрибуты', 'Статус']);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: `FF${SITE_COLORS_HEX[idx].replace('#', '')}` },
    };
    site.rows.forEach((r) => {
      const row = ws.addRow([
        r.sourceDomain, r.sourceUrl, r.dr, r.anchor, r.type, r.rel,
        r.status === 'inactive' ? 'Неактивная' : 'Активная',
      ]);
      // Подсветка статуса
      if (r.status === 'inactive') {
        row.getCell(7).fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' },
        };
        row.getCell(7).font = { color: { argb: 'FF64748B' } };
      } else {
        row.getCell(7).fill = {
          type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' },
        };
        row.getCell(7).font = { color: { argb: 'FF065F46' } };
      }
    });
    ws.columns = [
      { width: 28 }, { width: 50 }, { width: 6 },
      { width: 35 }, { width: 14 }, { width: 12 }, { width: 14 },
    ];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const auditedName = (sites[0]?.name || 'audit').replace(/[^a-zA-Z0-9._а-яА-Я-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${auditedName}__Ссылочный_аудит_${date}.xlsx`);
}
