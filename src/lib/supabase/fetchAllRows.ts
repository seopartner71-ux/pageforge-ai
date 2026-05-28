import { supabase } from '@/integrations/supabase/client';

/**
 * Обходит лимит PostgREST в 1000 строк, выгружая все записи постранично через .range().
 *
 * Используется везде, где запрос к Supabase может вернуть >1000 строк
 * (crawl_issues, crawl_pages, semantic_keywords, intent_results и т.п.).
 *
 * @example
 *   const rows = await fetchAllRows('crawl_issues', {
 *     select: 'id, code, severity, page_url',
 *     filter: (q) => q.eq('job_id', jobId),
 *     orderColumn: 'id',
 *   });
 */
export async function fetchAllRows<T = any>(
  table: string,
  opts: {
    select?: string;
    filter?: (q: any) => any;
    orderColumn?: string;
    ascending?: boolean;
    pageSize?: number;
    maxRows?: number;
  } = {},
): Promise<T[]> {
  const PAGE = opts.pageSize ?? 1000;
  const MAX = opts.maxRows ?? 200_000;
  const ordCol = opts.orderColumn ?? 'id';
  const asc = opts.ascending ?? true;

  const all: T[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    let q: any = (supabase as any).from(table).select(opts.select ?? '*');
    if (opts.filter) q = opts.filter(q);
    q = q.order(ordCol, { ascending: asc }).range(from, from + PAGE - 1);
    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as T[];
    all.push(...batch);
    if (batch.length < PAGE) break;
  }
  return all;
}