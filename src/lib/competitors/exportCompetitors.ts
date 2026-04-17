import * as XLSX from 'xlsx';
import { CompetitorRow, COMPETITOR_COLUMNS } from './parseCompetitorsCsv';

function buildRemarks(row: CompetitorRow, leaders: { traffic: number; budget: number; visibility: number }): string {
  const remarks: string[] = [];
  if (row.traffic === leaders.traffic && row.traffic > 0) remarks.push('Лидер по трафику');
  if (row.traffic === 0) remarks.push('Нет органики');
  if (leaders.budget > 0 && row.contextBudget >= leaders.budget * 0.7 && row.contextBudget > 0) {
    remarks.push('Высокий рекламный бюджет');
  }
  if (leaders.visibility > 0 && row.visibility < leaders.visibility * 0.1) {
    remarks.push('Слабая видимость');
  }
  if (row.top1 === 0 && row.top10 === 0) remarks.push('Не ранжируется в ТОП-10');
  if (row.pages > 100000) remarks.push('Очень крупный сайт');
  return remarks.join('; ') || '—';
}

export function exportCompetitorsXlsx(rows: CompetitorRow[], baseName = 'competitors') {
  if (rows.length === 0) return;

  const leaders = {
    traffic: Math.max(...rows.map((r) => r.traffic)),
    budget: Math.max(...rows.map((r) => r.contextBudget)),
    visibility: Math.max(...rows.map((r) => r.visibility)),
  };

  // min/max per numeric col
  const mm: Record<string, { min: number; max: number }> = {};
  for (const c of COMPETITOR_COLUMNS) {
    if (!c.numeric) continue;
    const vals = rows.map((r) => Number(r[c.key]) || 0);
    mm[c.key] = { min: Math.min(...vals), max: Math.max(...vals) };
  }

  const headers = [...COMPETITOR_COLUMNS.map((c) => c.label), 'Замечания'];
  const data: any[][] = [headers];

  rows.forEach((row) => {
    const line: any[] = [];
    for (const c of COMPETITOR_COLUMNS) {
      line.push(c.numeric ? Number(row[c.key]) || 0 : row[c.key]);
    }
    line.push(buildRemarks(row, leaders));
    data.push(line);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Column widths
  ws['!cols'] = [
    { wch: 28 },
    ...COMPETITOR_COLUMNS.slice(1).map(() => ({ wch: 14 })),
    { wch: 36 },
  ];

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');

  // Header style
  for (let col = range.s.c; col <= range.e.c; col++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!ws[addr]) continue;
    ws[addr].s = {
      fill: { patternType: 'solid', fgColor: { rgb: 'FFEA580C' } },
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border: {
        top: { style: 'thin', color: { rgb: 'FFEA580C' } },
        bottom: { style: 'thin', color: { rgb: 'FFEA580C' } },
        left: { style: 'thin', color: { rgb: 'FFEA580C' } },
        right: { style: 'thin', color: { rgb: 'FFEA580C' } },
      },
    };
  }

  // Body styles — best/worst highlighting
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    for (let cIdx = 0; cIdx < COMPETITOR_COLUMNS.length; cIdx++) {
      const col = COMPETITOR_COLUMNS[cIdx];
      const addr = XLSX.utils.encode_cell({ r: r + 1, c: cIdx });
      if (!ws[addr]) continue;
      const baseStyle: any = {
        font: { sz: 11 },
        alignment: { horizontal: col.numeric ? 'right' : 'left', vertical: 'center' },
        border: {
          top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        },
      };
      if (col.numeric) {
        const v = Number(row[col.key]) || 0;
        const m = mm[col.key as string];
        if (m && m.min !== m.max) {
          const isMax = v === m.max;
          const isMin = v === m.min;
          const best = col.higherIsBetter ? isMax : isMin;
          const worst = col.higherIsBetter ? isMin : isMax;
          if (best) {
            baseStyle.fill = { patternType: 'solid', fgColor: { rgb: 'FFF0FDF4' } };
            baseStyle.font = { sz: 11, bold: true, color: { rgb: 'FF15803D' } };
          } else if (worst) {
            baseStyle.fill = { patternType: 'solid', fgColor: { rgb: 'FFFEF2F2' } };
            baseStyle.font = { sz: 11, bold: true, color: { rgb: 'FFB91C1C' } };
          }
        }
        ws[addr].z = '#,##0';
      }
      ws[addr].s = baseStyle;
    }
    // Remarks column
    const remarksAddr = XLSX.utils.encode_cell({ r: r + 1, c: COMPETITOR_COLUMNS.length });
    if (ws[remarksAddr]) {
      ws[remarksAddr].s = {
        font: { sz: 11, italic: true },
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
        border: {
          top: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { rgb: 'FFE5E7EB' } },
        },
      };
    }
  }

  ws['!rows'] = [{ hpt: 32 }];
  ws['!freeze'] = { xSplit: 1, ySplit: 1 } as any;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Конкуренты');

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${baseName}_${date}.xlsx`);
}
