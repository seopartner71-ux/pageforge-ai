import * as XLSX from 'xlsx';
import type { SemanticCorePayload } from './types';

export function exportSemanticCoreXlsx(payload: SemanticCorePayload): void {
  const wb = XLSX.utils.book_new();
  const clusterMap = new Map(payload.clusters.map(c => [c.id, c.name]));

  // Лист «Запросы»
  const rows: any[][] = [[
    'Запрос', 'Частота WS', 'Точная частота', 'Интент', 'Score', 'KD', 'Кластер', 'Включён',
  ]];
  for (const k of payload.keywords) {
    rows.push([
      k.keyword,
      k.wsFrequency,
      k.exactFrequency,
      k.intent,
      k.score,
      k.keywordDifficulty ?? '',
      clusterMap.get(k.cluster) || k.cluster,
      k.included ? 'Да' : 'Нет',
    ]);
  }
  const ws1 = XLSX.utils.aoa_to_sheet(rows);
  ws1['!cols'] = [{ wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 6 }, { wch: 28 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Запросы');

  // Лист «Кластеры»
  const cRows: any[][] = [['Кластер', 'Тип', 'Кол-во запросов', 'Топ-5 запросов']];
  for (const c of payload.clusters) {
    const top = payload.keywords
      .filter(k => k.cluster === c.id)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(k => k.keyword)
      .join('\n');
    cRows.push([c.name, c.type, c.totalQueries, top]);
  }
  const ws2 = XLSX.utils.aoa_to_sheet(cRows);
  ws2['!cols'] = [{ wch: 32 }, { wch: 16 }, { wch: 14 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Кластеры');

  XLSX.writeFile(wb, `semantic_core_${new Date().toISOString().slice(0, 10)}.xlsx`);
}