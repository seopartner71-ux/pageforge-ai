import { describe, it, expect } from 'vitest';
import { splitResult, mergeParts, saveAudit, loadAudit } from './store';
import type { AuditResult } from './engine';

const mk = (n: number, tag: string) => Array.from({ length: n }, (_, i) => ({
  url: `https://site.ru/${tag}${i}/`, type: 'Статья', title: `Заголовок ${i}`, h1: `H1 ${i}`,
  words: 500 + i, depth: 2, in_all: i, in_text: i % 3, out_text: 1, pr_all: 1.234, pr_text: 0.5,
}));

const result = (nPages: number, nNoText: number): AuditResult => ({
  home: 'https://site.ru/', host: 'site.ru', hasGsc: false, hasGscQp: false,
  summary: { pages: nPages, orphans: 0, noTextLinks: nNoText, redirectTargets: 0, brokenTargets: 0, anchorConflicts: 0, cannibal: null, candidates: 0, templateLinks: 0 },
  plan: [{ priority: 'Высокий', action: 'Добавить ссылки', page: '/a/', reason: 'нет входящих', score: 9 }],
  byType: [{ type: 'Статья', pages: nPages, prAvg: 1, inTextAvg: 0.5, noText: nNoText, depthAvg: 2 }],
  pages: mk(nPages, 'p') as any,
  candidates: [], cannibal: [], orphans: [],
  noText: mk(nNoText, 'nt').map((x) => ({ url: x.url, type: x.type, title: x.title, in_all: x.in_all })) as any,
  redirects: [], broken: [], conflicts: [],
});

/** Подделка клиента базы: хранит вставки в массивах, отвечает на select/eq/range. */
function fakeSb() {
  const audits: any[] = [];
  const parts: any[] = [];
  let seq = 0;
  const fail = { at: -1 };
  return {
    audits, parts, fail,
    from(table: string) {
      const rows = table === 'internal_link_audits' ? audits : parts;
      const q: any = { _ins: null, _sel: false, _del: false, _one: false, _where: [], _rng: null };
      q.insert = (v: any) => { q._ins = v; return q; };
      q.select = () => { q._sel = true; return q; };
      q.delete = () => { q._del = true; return q; };
      q.eq = (k: string, v: any) => { q._where.push([k, v]); return q; };
      q.range = (a: number, b: number) => { q._rng = [a, b]; return q; };
      q.order = () => q;
      q.single = () => { q._one = true; return q; };
      q.maybeSingle = () => { q._one = true; return q; };
      q.then = (resolve: any) => { run().then(resolve); };
      async function run() {
        const match = (r: any) => q._where.every(([k, v]: [string, any]) => r[k] === v);
        if (q._ins) {
          if (table === 'internal_link_audits') {
            const row = { id: `id-${++seq}`, created_at: '2026-11-01T00:00:00Z', ...q._ins };
            audits.push(row);
            return { data: q._one ? { id: row.id, created_at: row.created_at } : null, error: null };
          }
          if (fail.at >= 0 && parts.length >= fail.at) return { data: null, error: { message: '413 Request Entity Too Large' } };
          parts.push(q._ins);
          return { data: null, error: null };
        }
        if (q._del) {
          const ids = q._where.map(([, v]: [string, any]) => v);
          for (let i = audits.length - 1; i >= 0; i--) if (ids.includes(audits[i].id)) audits.splice(i, 1);
          return { data: null, error: null };
        }
        const found = rows.filter(match);
        if (table === 'internal_link_audit_parts') {
          const sorted = [...found].sort((a, b) => a.idx - b.idx);
          return { data: q._rng ? sorted.slice(q._rng[0], q._rng[1] + 1) : sorted, error: null };
        }
        return { data: q._one ? found[0] ?? null : found, error: null };
      }
    },
  };
}

describe('хранение аудита по частям', () => {
  it('разрезает на части под лимит и склеивает без потерь', () => {
    const r = result(400, 250);
    const { meta, parts } = splitResult(r, 20_000);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(new Blob([JSON.stringify(p)]).size).toBeLessThanOrEqual(20_000);
    const back = mergeParts(meta, parts);
    expect(back.pages.length).toBe(400);
    expect(back.noText.length).toBe(250);
    expect(back.pages[399]).toEqual(r.pages[399]);
    expect(back.summary).toEqual(r.summary);
    expect(back.byType).toEqual(r.byType);
    expect(back.host).toBe('site.ru');
  });

  it('сохраняет частями и читает обратно целиком', async () => {
    const sb = fakeSb();
    const r = result(300, 200);
    const saved = await saveAudit(sb as any, {
      project_id: 'p1', created_by: 'u1', status: 'done', settings: {}, summary: r.summary, source_note: 'internal_all.xlsx',
    }, r, 15_000);
    expect(sb.parts.length).toBeGreaterThan(1);
    for (const p of sb.parts) expect(new Blob([JSON.stringify(p.payload)]).size).toBeLessThanOrEqual(15_000);
    const loaded = await loadAudit(sb as any, saved.id);
    expect(loaded.error).toBeNull();
    expect(loaded.results!.pages.length).toBe(300);
    expect(loaded.results!.noText.length).toBe(200);
    expect(loaded.results!.pages[299]).toEqual(r.pages[299]);
    expect(loaded.date).toBe('2026-11-01T00:00:00Z');
  });

  it('при отказе части удаляет строку аудита', async () => {
    const sb = fakeSb();
    sb.fail.at = 1;
    const r = result(300, 200);
    await expect(saveAudit(sb as any, {
      project_id: 'p1', created_by: 'u1', status: 'done', settings: {}, summary: r.summary, source_note: 'x',
    }, r, 15_000)).rejects.toThrow('413');
    expect(sb.audits.length).toBe(0);
  });

  it('старый аудит с results в одной строке читается как есть', async () => {
    const sb = fakeSb();
    const r = result(5, 2);
    sb.audits.push({ id: 'old', created_at: '2026-06-01T00:00:00Z', results: r, ai_report: null });
    const loaded = await loadAudit(sb as any, 'old');
    expect(loaded.error).toBeNull();
    expect(loaded.results!.pages.length).toBe(5);
    expect(sb.parts.length).toBe(0);
  });
});
