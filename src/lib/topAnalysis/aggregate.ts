import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';

export interface DomainStat {
  domain: string;
  positions: number[];        // все позиции
  byQuery: Map<string, number>; // запрос → лучшая позиция
  coverage: number;            // в скольких запросах присутствует
  top3: number;
  top5: number;
  top10: number;
  avgPos: number;
  sumPos: number;
}

export interface QueryStat {
  query: string;
  byDomain: Array<{ domain: string; position: number; url: string }>;
  domainsCount: number;
  competitionLevel: 'высокая' | 'средняя' | 'низкая';
}

export function aggregateDomains(rows: TopRow[]): DomainStat[] {
  const map = new Map<string, DomainStat>();
  // keep best (минимальная) позиция домена в рамках одного запроса
  const bestByDomainQuery = new Map<string, Map<string, number>>();

  for (const r of rows) {
    let dq = bestByDomainQuery.get(r.domain);
    if (!dq) { dq = new Map(); bestByDomainQuery.set(r.domain, dq); }
    const cur = dq.get(r.query);
    if (cur === undefined || r.position < cur) dq.set(r.query, r.position);
  }

  for (const [domain, byQuery] of bestByDomainQuery.entries()) {
    const positions = [...byQuery.values()];
    const sumPos = positions.reduce((s, p) => s + p, 0);
    map.set(domain, {
      domain,
      positions,
      byQuery,
      coverage: positions.length,
      top3: positions.filter(p => p <= 3).length,
      top5: positions.filter(p => p <= 5).length,
      top10: positions.filter(p => p <= 10).length,
      avgPos: positions.length ? +(sumPos / positions.length).toFixed(1) : 0,
      sumPos,
    });
  }
  return [...map.values()];
}

export function aggregateQueries(rows: TopRow[]): QueryStat[] {
  const map = new Map<string, Map<string, { position: number; url: string }>>();
  for (const r of rows) {
    let q = map.get(r.query);
    if (!q) { q = new Map(); map.set(r.query, q); }
    const cur = q.get(r.domain);
    if (!cur || r.position < cur.position) q.set(r.domain, { position: r.position, url: r.url });
  }
  const result: QueryStat[] = [];
  for (const [query, dm] of map.entries()) {
    const byDomain = [...dm.entries()]
      .map(([domain, v]) => ({ domain, position: v.position, url: v.url }))
      .sort((a, b) => a.position - b.position);
    const count = byDomain.length;
    const competitionLevel: QueryStat['competitionLevel'] =
      count >= 10 ? 'высокая' : count >= 5 ? 'средняя' : 'низкая';
    result.push({ query, byDomain, domainsCount: count, competitionLevel });
  }
  return result;
}

export function uniqueQueries(rows: TopRow[]): string[] {
  return [...new Set(rows.map(r => r.query))];
}

export function applyFilters(
  rows: TopRow[],
  selectedQueries: string[] | null,
  positionRange: 'top3' | 'top5' | 'top10' | 'top30' | 'top50' | 'all',
): TopRow[] {
  const max =
    positionRange === 'top3' ? 3 :
    positionRange === 'top5' ? 5 :
    positionRange === 'top10' ? 10 :
    positionRange === 'top30' ? 30 :
    positionRange === 'top50' ? 50 : 999;
  return rows.filter(r =>
    (!selectedQueries || selectedQueries.length === 0 || selectedQueries.includes(r.query)) &&
    r.position <= max
  );
}
