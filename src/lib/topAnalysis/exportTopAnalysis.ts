import ExcelJS from 'exceljs';
import { TopRow } from './parseTopAnalysisCsv';
import { aggregateDomains, aggregateQueries, uniqueQueries } from './aggregate';

// Палитра по ТЗ
const HEADER_DARK = 'FF1A1A18';
const HEADER_ORANGE = 'FFEA580C';
const HEADER_ORANGE_DARK = 'FFC2410C';
const WHITE = 'FFFFFFFF';
const ZEBRA = 'FFF9F9F9';
const BORDER_GRAY = 'FFD0D0D0';

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

export async function exportTopAnalysisXlsx(rows: TopRow[], baseName = 'top_analysis') {
  if (rows.length === 0) return;

  const queries = uniqueQueries(rows);
  const domains = aggregateDomains(rows).sort((a, b) => b.coverage - a.coverage || a.avgPos - b.avgPos);
  const queriesAgg = aggregateQueries(rows);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge';
  wb.created = new Date();

  // ============ ЛИСТ "Матрица" ============
  const ws = wb.addWorksheet('Матрица');
  ws.views = [{ showGridLines: false }];

  const totalCols = 1 + queries.length + 2 + 1; // Домен + запросы + Сумма + В топах + Замечания

  // Заголовок
  const head = ws.getRow(1);
  head.height = 36;
  head.getCell(1).value = 'Домен';
  queries.forEach((q, i) => head.getCell(i + 2).value = q);
  head.getCell(queries.length + 2).value = 'Сумма позиций';
  head.getCell(queries.length + 3).value = 'В топах';
  head.getCell(queries.length + 4).value = 'Замечания';

  for (let c = 1; c <= totalCols; c++) {
    const cell = head.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c === 1 ? HEADER_DARK : HEADER_ORANGE_DARK } };
    cell.font = ARIAL_10_BOLD_WHITE;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // Строки доменов
  domains.forEach((d, idx) => {
    const r = ws.getRow(idx + 2);
    // Колонка домена — оранжевый фон
    const dc = r.getCell(1);
    dc.value = d.domain;
    dc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ORANGE } };
    dc.font = { ...ARIAL_10_BOLD_WHITE };
    dc.alignment = { horizontal: 'left', vertical: 'middle' };
    dc.border = thinBorder;

    // Позиции по запросам
    queries.forEach((q, i) => {
      const pos = d.byQuery.get(q);
      applyPositionStyle(r.getCell(i + 2), pos);
    });

    // Сумма
    const sc = r.getCell(queries.length + 2);
    sc.value = d.sumPos;
    sc.numFmt = '#,##0';
    sc.alignment = { horizontal: 'center', vertical: 'middle' };
    sc.font = { ...ARIAL_10, bold: true };
    sc.border = thinBorder;
    sc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 ? ZEBRA : WHITE } };

    // В топах
    const tc = r.getCell(queries.length + 3);
    tc.value = d.coverage;
    tc.numFmt = '0';
    tc.alignment = { horizontal: 'center', vertical: 'middle' };
    tc.font = { ...ARIAL_10, bold: true };
    tc.border = thinBorder;
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: idx % 2 ? ZEBRA : WHITE } };

    // Замечания
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
  ws.views = [{ showGridLines: false, state: 'frozen', xSplit: 1, ySplit: 1 }];

  // ============ ЛИСТ "По запросам" ============
  const ws2 = wb.addWorksheet('По запросам');
  ws2.views = [{ showGridLines: false }];

  const head2 = ws2.getRow(1);
  head2.height = 28;
  ['Запрос', '#', 'Домен', 'URL', 'Позиция'].forEach((label, i) => {
    const c = head2.getCell(i + 1);
    c.value = label;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ORANGE } };
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
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_ORANGE } };
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
  ws2.views = [{ showGridLines: false, state: 'frozen', ySplit: 1 }];

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  saveBlob(buffer as ArrayBuffer, `${baseName}_${date}.xlsx`);
}
