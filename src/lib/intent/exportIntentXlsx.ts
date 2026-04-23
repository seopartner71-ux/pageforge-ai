import * as XLSX from 'xlsx';
import type { IntentMatrix } from './types';
import { classifyIntent } from './types';

export function exportIntentXlsx(matrix: IntentMatrix, queries: string[], city: string): void {
  const wb = XLSX.utils.book_new();
  const maxDepth = Math.max(0, ...queries.map(q => (matrix[q] || []).length));

  // Лист «Матрица»
  const header = ['#', ...queries];
  const rows: any[][] = [header];
  for (let i = 0; i < maxDepth; i++) {
    const row: any[] = [i + 1];
    for (const q of queries) {
      const r = (matrix[q] || [])[i];
      row.push(r ? `${r.url}\n${r.siteType} · ${r.pageType}` : '');
    }
    rows.push(row);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{ wch: 4 }, ...queries.map(() => ({ wch: 42 }))];
  XLSX.utils.book_append_sheet(wb, ws1, 'Матрица');

  // Лист «Статистика»
  const stat: any[][] = [['Запрос', 'Корп. сайт %', 'Блог %', 'СМИ %', 'Видео %', 'Маркетплейс %', 'Прочее %', 'Интент']];
  let totals = { corp: 0, blog: 0, media: 0, video: 0, market: 0, other: 0, n: 0 };
  for (const q of queries) {
    const list = matrix[q] || [];
    const n = list.length || 1;
    const corp = list.filter(r => r.siteType === 'Корп. сайт').length;
    const blog = list.filter(r => r.siteType === 'Блог / Инфосайт').length;
    const media = list.filter(r => r.siteType === 'СМИ').length;
    const video = list.filter(r => r.siteType === 'Видео').length;
    const market = list.filter(r => r.siteType === 'Маркетплейс').length;
    const other = n - corp - blog - media - video - market;
    totals = { corp: totals.corp + corp, blog: totals.blog + blog, media: totals.media + media, video: totals.video + video, market: totals.market + market, other: totals.other + other, n: totals.n + list.length };
    const intent = classifyIntent(list as any).label;
    const pct = (x: number) => Math.round((x / n) * 100) + '%';
    stat.push([q, pct(corp), pct(blog), pct(media), pct(video), pct(market), pct(other), intent]);
  }
  const T = totals.n || 1;
  const tpct = (x: number) => Math.round((x / T) * 100) + '%';
  stat.push(['Итого', tpct(totals.corp), tpct(totals.blog), tpct(totals.media), tpct(totals.video), tpct(totals.market), tpct(totals.other), '—']);

  const ws2 = XLSX.utils.aoa_to_sheet(stat);
  ws2['!cols'] = [{ wch: 36 }, { wch: 14 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 16 }, { wch: 12 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Статистика');

  XLSX.writeFile(wb, `intent_${city}_${new Date().toISOString().slice(0,10)}.xlsx`);
}