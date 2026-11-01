// Хранение аудита: большие списки режутся на части по ~700 КБ и кладутся
// отдельными строками в internal_link_audit_parts — прокси на хостинге
// отклоняет запросы больше ~1 МБ (413). Ничего не выбрасывается.
import type { AuditResult } from './engine';

/** Списки, которые могут быть огромными — они уходят в части. */
export const ARR_KEYS = ['pages', 'plan', 'candidates', 'cannibal', 'orphans', 'noText', 'redirects', 'broken', 'conflicts'] as const;

const PART_LIMIT = 700_000;
const MAX_PARTS = 300;
const enc = new TextEncoder(); // сервер считает байты, а кириллица в JSON — 2 байта на символ


export type Part = Record<string, unknown[]>;

/** Разрезает результат на «шапку» (итоги + мелкие списки) и части с большими списками. */
export function splitResult(result: AuditResult, limit = PART_LIMIT): { meta: Record<string, unknown>; parts: Part[] } {
  const meta: Record<string, unknown> = {
    home: result.home, host: result.host, hasGsc: result.hasGsc, hasGscQp: result.hasGscQp,
    summary: result.summary, byType: result.byType,
  };
  const pairs: [string, unknown][] = [];
  for (const k of ARR_KEYS) for (const it of (result[k] as unknown[]) ?? []) pairs.push([k, it]);

  const parts: Part[] = [];
  let cur: Part = {};
  let size = 2;
  const flush = () => { if (Object.keys(cur).length) { parts.push(cur); cur = {}; size = 2; } };
  for (const [k, it] of pairs) {
    const s = enc.encode(JSON.stringify(it)).length + k.length + 5;
    if (size + s > limit && Object.keys(cur).length && parts.length < MAX_PARTS - 1) flush();
    (cur[k] ||= []).push(it);
    size += s;
  }
  flush();
  return { meta, parts };
}

/** Собирает результат обратно из шапки и частей. */
export function mergeParts(meta: Record<string, unknown>, parts: Part[]): AuditResult {
  const out: Record<string, unknown> = { ...meta };
  for (const k of ARR_KEYS) out[k] = [];
  for (const p of parts) for (const k of Object.keys(p)) {
    if (!(ARR_KEYS as readonly string[]).includes(k)) continue;
    (out[k] as unknown[]).push(...(p[k] ?? []));
  }
  return out as unknown as AuditResult;
}

type Sb = {
  from: (t: string) => any;
};

/** Сохраняет аудит: одна строка итогов + N строк-частей. При ошибке чистит за собой. */
export async function saveAudit(
  sb: Sb,
  base: { project_id: string; created_by: string; status: string; settings: unknown; summary: unknown; source_note: string },
  result: AuditResult,
  limit = PART_LIMIT,
): Promise<{ id: string; created_at: string }> {
  const { meta, parts } = splitResult(result, limit);

  const ins = await sb.from('internal_link_audits').insert({
    ...base, results: meta as any,
  }).select('id, created_at').single();
  if (ins.error || !ins.data) throw new Error(ins.error?.message ?? 'не удалось сохранить итоги');

  const id = (ins.data as { id: string }).id;
  try {
    for (let i = 0; i < parts.length; i++) {
      const r = await sb.from('internal_link_audit_parts').insert({ audit_id: id, idx: i, payload: parts[i] as any });
      if (r.error) throw new Error(r.error.message);
    }
  } catch (e) {
    await sb.from('internal_link_audits').delete().eq('id', id);
    throw e;
  }
  return ins.data as { id: string; created_at: string };
}

export interface LoadedAudit { results: AuditResult | null; ai: unknown; date: string; error: string | null }

/** Читает аудит целиком: старые строки с results сразу, новые — склейкой частей. */
export async function loadAudit(sb: Sb, id: string): Promise<LoadedAudit> {
  const { data, error } = await sb.from('internal_link_audits').select('id, created_at, results, ai_report').eq('id', id).maybeSingle();
  if (error || !data) return { results: null, ai: null, date: '', error: error?.message ?? 'аудит не найден' };
  const meta = (data.results ?? {}) as Record<string, unknown>;
  const ai = data.ai_report ?? null;
  const date = String(data.created_at ?? '');
  if (Array.isArray(meta.pages)) return { results: data.results as AuditResult, ai, date, error: null };

  const parts: Part[] = [];
  let from = 0;
  for (;;) {
    const { data: rows, error: pe } = await sb.from('internal_link_audit_parts')
      .select('idx, payload').eq('audit_id', id).range(from, from + 49).order('idx');
    if (pe) return { results: null, ai, date, error: pe.message };
    for (const r of rows ?? []) parts.push(r.payload as Part);
    if (!rows || rows.length < 50) break;
    from += 50;
  }
  return { results: mergeParts(meta, parts), ai, date, error: null };
}

