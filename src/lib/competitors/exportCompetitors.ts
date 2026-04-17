import XLSX from 'xlsx-js-style';
import { CompetitorRow, COMPETITOR_COLUMNS } from './parseCompetitorsCsv';

// Метрики, которые попадут в транспонированную таблицу (без столбца "Домен")
const METRIC_COLUMNS = COMPETITOR_COLUMNS.filter((c) => c.key !== 'domain');

const BORDER = {
  top: { style: 'thin', color: { rgb: 'FFD1D5DB' } },
  bottom: { style: 'thin', color: { rgb: 'FFD1D5DB' } },
  left: { style: 'thin', color: { rgb: 'FFD1D5DB' } },
  right: { style: 'thin', color: { rgb: 'FFD1D5DB' } },
} as const;

export function exportCompetitorsXlsx(rows: CompetitorRow[], baseName = 'competitors') {
  if (rows.length === 0) return;

  const domains = rows.map((r) => r.domain);
  const totalCols = 1 + domains.length;

  // ---- Build AOA ----
  const aoa: any[][] = [];

  // Row 1: title (merged across all columns)
  aoa.push(['Анализ конкурентов — PageForge', ...Array(totalCols - 1).fill('')]);

  // Row 2: column headers
  aoa.push(['Показатель оценки', ...domains]);

  // Rows 3+: one row per metric
  for (const metric of METRIC_COLUMNS) {
    const line: any[] = [metric.label];
    for (const r of rows) {
      const v = Number(r[metric.key]) || 0;
      line.push(v);
    }
    aoa.push(line);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merge title row across all columns
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } },
  ];

  // Column widths: A=26, остальные=18
  ws['!cols'] = [{ wch: 26 }, ...domains.map(() => ({ wch: 18 }))];

  // Row heights
  ws['!rows'] = [{ hpt: 28 }, { hpt: 26 }];

  // ---- Styles ----

  // Title row
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) ws[addr] = { t: 's', v: c === 0 ? 'Анализ конкурентов — PageForge' : '' };
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FF1A1A18' } },
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 13 },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: BORDER,
    };
  }

  // Header row (row 2)
  for (let c = 0; c < totalCols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 1, c });
    if (!ws[addr]) continue;
    const isFirst = c === 0;
    ws[addr].s = {
      fill: {
        patternType: 'solid',
        fgColor: { rgb: isFirst ? 'FFEA580C' : 'FFFB923C' },
      },
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: BORDER,
    };
  }

  // Body rows: per-metric best/worst highlighting + zebra
  for (let i = 0; i < METRIC_COLUMNS.length; i++) {
    const metric = METRIC_COLUMNS[i];
    const rIdx = i + 2; // row in sheet
    const values = rows.map((r) => Number(r[metric.key]) || 0);
    const max = Math.max(...values);
    // worst = минимальное НЕНУЛЕВОЕ значение (если все нули — без подсветки)
    const nonZero = values.filter((v) => v > 0);
    const min = nonZero.length > 0 ? Math.min(...nonZero) : null;
    const allEqual = max === (min ?? max) && nonZero.length === values.length;

    const zebra = i % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB';

    // Label cell (col 0)
    const labelAddr = XLSX.utils.encode_cell({ r: rIdx, c: 0 });
    if (ws[labelAddr]) {
      ws[labelAddr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: 'FFF2F2F2' } },
        font: { bold: true, color: { rgb: 'FF1F2937' }, sz: 11 },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: BORDER,
      };
    }

    // Value cells
    for (let c = 0; c < domains.length; c++) {
      const addr = XLSX.utils.encode_cell({ r: rIdx, c: c + 1 });
      if (!ws[addr]) continue;
      const v = values[c];

      let fill = zebra;
      let fontColor = 'FF1F2937';
      let bold = false;

      if (!allEqual) {
        const higherBetter = metric.higherIsBetter !== false;
        const isBest = higherBetter ? v === max && v > 0 : v === min && v > 0;
        const isWorst = higherBetter ? v === min && v > 0 : v === max && v > 0;
        if (isBest) {
          fill = 'FFD1FAE5';
          fontColor = 'FF065F46';
          bold = true;
        } else if (isWorst) {
          fill = 'FFFEE2E2';
          fontColor = 'FF991B1B';
          bold = true;
        }
      }

      ws[addr].s = {
        fill: { patternType: 'solid', fgColor: { rgb: fill } },
        font: { sz: 11, color: { rgb: fontColor }, bold },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: BORDER,
        numFmt: '#,##0',
      };
      ws[addr].z = '#,##0';
    }
  }

  // Freeze header rows + first column
  (ws as any)['!freeze'] = { xSplit: 1, ySplit: 2 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Конкуренты');

  // ---- Дополнительный лист «Для графиков» ----
  const chartAoa: any[][] = [];
  chartAoa.push(['Выделите данные ниже и вставьте диаграмму (Вставка → Диаграмма)']);
  chartAoa.push([]);
  chartAoa.push(['График 1: Трафик по доменам']);
  chartAoa.push(['Домен', 'Трафик']);
  rows.forEach((r) => chartAoa.push([r.domain, Number(r.traffic) || 0]));
  chartAoa.push([]);
  chartAoa.push(['График 2: Видимость и В топ 1']);
  chartAoa.push(['Домен', 'Видимость', 'В топ 1']);
  rows.forEach((r) =>
    chartAoa.push([r.domain, Number(r.visibility) || 0, Number(r.top1) || 0])
  );

  const ws2 = XLSX.utils.aoa_to_sheet(chartAoa);
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 18 }];

  // Заголовки секций жирным
  const sectionRows = [0, 2, 3, 5 + rows.length, 6 + rows.length];
  for (const r of sectionRows) {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws2[addr]) {
      ws2[addr].s = {
        font: { bold: true, sz: 11, color: { rgb: 'FF1F2937' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FFF2F2F2' } },
        alignment: { horizontal: 'left', vertical: 'center' },
      };
    }
  }

  XLSX.utils.book_append_sheet(wb, ws2, 'Для графиков');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${baseName}_${date}.xlsx`);
}
