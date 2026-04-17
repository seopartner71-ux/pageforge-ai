import ExcelJS from 'exceljs';
import type { SiteAuditData } from './linkAudit';

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

const SITE_COLORS_HEX = ['3B82F6', 'F59E0B', '10B981', '8B5CF6'];

export async function exportLinkAuditXlsx(sites: SiteAuditData[]) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ========== Лист 1: Сводная ==========
  const summary = wb.addWorksheet('Сводная');
  const headerRow = ['Показатель', ...sites.map((s) => s.name)];
  summary.addRow(headerRow);
  summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  summary.getRow(1).fill = {
    type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3864' },
  };

  const rows: [string, ...(number | string)[]][] = [
    ['Доменный рейтинг (средний)', ...sites.map((s) => s.avgDR)],
    ['Доменный рейтинг (медиана)', ...sites.map((s) => s.medianDR)],
    ['Уникальные ссылки', ...sites.map((s) => s.totalLinks)],
    ['Ссылающиеся домены', ...sites.map((s) => s.uniqueDomains)],
    ['% follow ссылок', ...sites.map((s) => s.followPct)],
    ['% текстовых ссылок', ...sites.map((s) => s.textPct)],
  ];
  rows.forEach((r) => summary.addRow(r));

  summary.getColumn(1).width = 32;
  for (let i = 2; i <= sites.length + 1; i++) summary.getColumn(i).width = 24;

  // ========== Лист 2: Графики ==========
  const charts = wb.addWorksheet('Графики');
  charts.getColumn(1).width = 28;
  for (let i = 2; i <= sites.length + 1; i++) charts.getColumn(i).width = 18;

  // Данные для bar-чартов (Sites x metric)
  charts.addRow(['Метрика', ...sites.map((s) => s.name)]); // row 1
  charts.addRow(['DR средний', ...sites.map((s) => s.avgDR)]); // row 2
  charts.addRow(['Уникальные ссылки', ...sites.map((s) => s.totalLinks)]); // row 3
  charts.addRow(['Ссылающиеся домены', ...sites.map((s) => s.uniqueDomains)]); // row 4
  charts.getRow(1).font = { bold: true };

  const lastCol = sites.length + 1;
  const colLetter = (n: number) => String.fromCharCode(64 + n); // 1->A

  // Bar chart helpers — используем встроенные диаграммы ExcelJS
  type ChartConfig = {
    title: string;
    dataRow: number;
    anchorCell: string;
  };
  const barCharts: ChartConfig[] = [
    { title: 'DR средний по сайтам', dataRow: 2, anchorCell: 'A6' },
    { title: 'Уникальные ссылки по сайтам', dataRow: 3, anchorCell: 'A22' },
    { title: 'Ссылающиеся домены по сайтам', dataRow: 4, anchorCell: 'A38' },
  ];

  for (const cfg of barCharts) {
    // ExcelJS типы графиков ограничены — используем bar
    const chart = (charts as any).addChart?.('bar', {
      title: { name: cfg.title },
      legend: { position: 'b' },
      plotArea: {
        catAx: { title: { name: 'Сайты' } },
        valAx: { title: { name: 'Значение' } },
      },
      series: [
        {
          name: cfg.title,
          categories: {
            sheet: 'Графики',
            range: `B1:${colLetter(lastCol)}1`,
          },
          values: {
            sheet: 'Графики',
            range: `B${cfg.dataRow}:${colLetter(lastCol)}${cfg.dataRow}`,
          },
        },
      ],
      anchor: cfg.anchorCell,
    });
    // Если addChart недоступен (некоторые сборки) — рисуем через images-фолбэк
    if (!chart) break;
  }

  // ========== Per-site donut data + charts ==========
  // Для каждого сайта добавим блок с follow/nofollow + текст/прочие
  const startRow = 56;
  sites.forEach((s, idx) => {
    const base = startRow + idx * 14;
    charts.getCell(`A${base}`).value = `${s.name} — Follow / Nofollow`;
    charts.getCell(`A${base}`).font = { bold: true, color: { argb: `FF${SITE_COLORS_HEX[idx]}` } };
    charts.getCell(`A${base + 1}`).value = 'Тип';
    charts.getCell(`B${base + 1}`).value = '%';
    charts.getCell(`A${base + 2}`).value = 'Follow';
    charts.getCell(`B${base + 2}`).value = s.followPct;
    charts.getCell(`A${base + 3}`).value = 'Nofollow';
    charts.getCell(`B${base + 3}`).value = 100 - s.followPct;

    charts.getCell(`D${base}`).value = `${s.name} — Текстовые / Прочие`;
    charts.getCell(`D${base}`).font = { bold: true, color: { argb: `FF${SITE_COLORS_HEX[idx]}` } };
    charts.getCell(`D${base + 1}`).value = 'Тип';
    charts.getCell(`E${base + 1}`).value = '%';
    charts.getCell(`D${base + 2}`).value = 'Текстовые';
    charts.getCell(`E${base + 2}`).value = s.textPct;
    charts.getCell(`D${base + 3}`).value = 'Прочие';
    charts.getCell(`E${base + 3}`).value = 100 - s.textPct;

    // Pie charts (если поддерживается)
    (charts as any).addChart?.('doughnut', {
      title: { name: `${s.name}: Follow / Nofollow` },
      legend: { position: 'r' },
      series: [{
        name: 'Follow %',
        categories: { sheet: 'Графики', range: `A${base + 2}:A${base + 3}` },
        values: { sheet: 'Графики', range: `B${base + 2}:B${base + 3}` },
      }],
      anchor: `G${base}`,
    });
    (charts as any).addChart?.('doughnut', {
      title: { name: `${s.name}: Текстовые / Прочие` },
      legend: { position: 'r' },
      series: [{
        name: 'Текстовые %',
        categories: { sheet: 'Графики', range: `D${base + 2}:D${base + 3}` },
        values: { sheet: 'Графики', range: `E${base + 2}:E${base + 3}` },
      }],
      anchor: `K${base}`,
    });
  });

  // ========== Детальные листы ==========
  sites.forEach((site, idx) => {
    const safeName = site.name.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 28);
    const ws = wb.addWorksheet(`${idx + 1}. ${safeName}`.slice(0, 31));
    ws.addRow(['Домен источник', 'URL источник', 'DR', 'Анкор', 'Тип', 'Атрибуты', 'Статус']);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern', pattern: 'solid',
      fgColor: { argb: `FF${SITE_COLORS_HEX[idx]}` },
    };
    site.rows.forEach((r) => {
      ws.addRow([
        r.sourceDomain, r.sourceUrl, r.dr, r.anchor, r.type, r.rel,
        r.status === 'inactive' ? 'Неактивная' : 'Активная',
      ]);
    });
    ws.columns = [
      { width: 28 }, { width: 50 }, { width: 6 },
      { width: 35 }, { width: 14 }, { width: 12 }, { width: 12 },
    ];
  });

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  const auditedName = (sites[0]?.name || 'audit').replace(/[^a-zA-Z0-9._-]/g, '_');
  saveBlob(buffer as ArrayBuffer, `${auditedName}__Ссылочный_аудит_${date}.xlsx`);
}
