// Аудит внутренней перелинковки — порт audit_links.py (эталон) на TypeScript.
// Чистые функции без DOM: выполняются в Web Worker и в тестах.

export type Row = Record<string, unknown>;

export interface AuditSettings {
  templateShare: number;   // доля страниц типа, ссылающихся на цель (0.5)
  templateMinGroup: number; // мин. размер группы типа (5)
  listingMin: number;       // листинг: >= N контентных ссылок на один тип (30)
  minSim: number;           // порог близости кандидатов (0.25)
  topK: number;             // топ целей на статью (3)
  minImpr: number;          // мин. показов запроса для каннибализации (100)
}

export const DEFAULT_SETTINGS: AuditSettings = {
  templateShare: 0.5, templateMinGroup: 5, listingMin: 30, minSim: 0.25, topK: 3, minImpr: 100,
};

export interface TypeRule { name: string; regex: string }

export interface PageOut {
  url: string; type: string; title: string; h1: string; words: number | null; depth: number | null;
  in_all: number; in_text: number; out_text: number; pr_all: number; pr_text: number;
  clicks?: number; impr?: number; pos?: number | null;
}
export interface LinkGroup { dst: string; code: number; links: number; examples: string[] }
export interface AnchorConflict { anchor: string; targets: number; detail: { url: string; count: number }[] }
export interface Candidate { src: string; srcH1: string; dst: string; dstH1: string; sim: number; anchor: string; duplicate: boolean }
export interface Cannibal { query: string; impr: number; pages: number; main: string; mainPos: number; rival: string; rivalPos: number; rivalShare: number }
export interface PlanItem { priority: string; action: string; page: string; reason: string; score: number }
export interface TypeStat { type: string; pages: number; prAvg: number; inTextAvg: number; noText: number; depthAvg: number | null }

export interface AuditResult {
  home: string;
  host: string;
  hasGsc: boolean;
  hasGscQp: boolean;
  summary: {
    pages: number; orphans: number; noTextLinks: number; redirectTargets: number; brokenTargets: number;
    anchorConflicts: number; cannibal: number | null; candidates: number; templateLinks: number;
  };
  plan: PlanItem[];
  byType: TypeStat[];
  pages: PageOut[];
  candidates: Candidate[];
  cannibal: Cannibal[];
  orphans: { url: string; type: string; title: string }[];
  noText: { url: string; type: string; title: string; in_all: number }[];
  redirects: LinkGroup[];
  broken: LinkGroup[];
  conflicts: AnchorConflict[];
}

// ---------- утилиты ----------
export class AuditInputError extends Error {}

const isMissing = (v: unknown) => v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v)) || v === '';
const str = (v: unknown) => (isMissing(v) ? '' : String(v));
const num = (v: unknown): number | null => {
  if (isMissing(v)) return null;
  if (typeof v === 'number') return v;
  const n = Number(String(v).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export function pick(cols: string[], ...names: string[]): string | null {
  const low = new Map<string, string>();
  for (const c of cols) low.set(c.toLowerCase().trim(), c);
  for (const n of names) { const hit = low.get(n.toLowerCase()); if (hit) return hit; }
  return null;
}

const URL_RX = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(?:\?([^#]*))?/;
/** Аналог norm() из скрипта: хост в нижнем регистре, без якоря, пустой путь = "/". */
export function norm(u: unknown): string {
  const s = str(u).trim();
  const m = s.match(URL_RX);
  if (!m) return s.split('#')[0];
  const [, scheme, netloc, path, query] = m;
  return `${scheme}://${netloc.toLowerCase()}${path || '/'}${query ? `?${query}` : ''}`;
}
export const pathOf = (u: string) => { const m = u.match(URL_RX); return m ? m[3] : u; };
export const hostOf = (u: string) => { const m = u.match(URL_RX); return m ? m[2].toLowerCase() : ''; };

const colsOf = (rows: Row[]) => (rows.length ? Object.keys(rows[0]) : []);
function need(cols: string[], file: string, label: string, ...names: string[]) {
  const c = pick(cols, ...names);
  if (!c) throw new AuditInputError(`В файле ${file} нет колонки «${label}»`);
  return c;
}

// ---------- загрузка ----------
interface PageIn { url: string; code: number | null; title: string; h1: string; words: number | null; depth: number | null; ctype: unknown }
interface LinkIn { src: string; dst: string; anchor: string; isImg: boolean; follow: boolean; pos: string; code: number | null; isText: boolean; tmpl: boolean }

export function loadPages(rows: Row[]): PageIn[] {
  const cols = colsOf(rows);
  const url = need(cols, 'internal_all', 'Address', 'Address', 'Адрес');
  const code = need(cols, 'internal_all', 'Status Code', 'Status Code', 'Код ответа');
  const title = pick(cols, 'Title 1', 'Title');
  const h1 = pick(cols, 'H1-1', 'H1');
  const words = pick(cols, 'Word Count', 'Количество слов');
  const depth = pick(cols, 'Crawl Depth', 'Глубина');
  const ctype = pick(cols, 'Content Type', 'Content');
  let out = rows.map((r) => ({
    url: norm(r[url]), code: num(r[code]), title: title ? str(r[title]) : '', h1: h1 ? str(r[h1]) : '',
    words: words ? num(r[words]) : null, depth: depth ? num(r[depth]) : null, ctype: ctype ? r[ctype] : null,
  }));
  if (ctype) out = out.filter((p) => isMissing(p.ctype) || String(p.ctype).toLowerCase().includes('html'));
  return out;
}

export function loadLinks(rows: Row[]): LinkIn[] {
  const cols = colsOf(rows);
  const type = pick(cols, 'Type', 'Тип');
  const src = need(cols, 'all_inlinks', 'Source', 'Source', 'From', 'Источник');
  const dst = need(cols, 'all_inlinks', 'Destination', 'Destination', 'To', 'Назначение');
  const anchor = pick(cols, 'Anchor', 'Анкор');
  const alt = pick(cols, 'Alt Text');
  const follow = pick(cols, 'Follow');
  const pos = pick(cols, 'Link Position', 'Позиция ссылки');
  const code = pick(cols, 'Status Code', 'Код ответа');
  const out: LinkIn[] = [];
  for (const r of rows) {
    if (type && !String(r[type] ?? '').toLowerCase().includes('hyperlink')) continue;
    const s = norm(r[src]); const d = norm(r[dst]);
    if (s === d) continue;
    let a = anchor ? str(r[anchor]).trim() : '';
    let isImg = false;
    if (alt) { isImg = a === '' && !isMissing(r[alt]); if (isImg) a = String(r[alt]); }
    const p = pos ? (isMissing(r[pos]) ? 'Content' : String(r[pos])) : 'Content';
    out.push({
      src: s, dst: d, anchor: a, isImg,
      follow: follow ? String(r[follow] ?? '').toLowerCase() !== 'false' : true,
      pos: p, code: code ? num(r[code]) : null, isText: p.toLowerCase() === 'content', tmpl: false,
    });
  }
  return out;
}

interface GscPage { page: string; clicks: number | null; impr: number | null; pos: number | null }
export function loadGscPages(rows: Row[]): GscPage[] {
  const cols = colsOf(rows);
  const page = need(cols, 'GSC (страницы)', 'page', 'page', 'Top pages', 'Страницы', 'Популярные страницы', 'Страница');
  const c = pick(cols, 'clicks', 'Clicks', 'Клики');
  const i = pick(cols, 'impressions', 'Impressions', 'Показы');
  const p = pick(cols, 'position', 'Position', 'Позиция');
  return rows.map((r) => ({ page: norm(r[page]), clicks: c ? num(r[c]) : null, impr: i ? num(r[i]) : null, pos: p ? num(r[p]) : null }));
}
interface GscQp { query: string; page: string; impr: number; pos: number }
export function loadGscQp(rows: Row[]): GscQp[] {
  const cols = colsOf(rows);
  const q = need(cols, 'GSC (запрос+страница)', 'query', 'query', 'Top queries', 'Запрос', 'Запросы');
  const page = need(cols, 'GSC (запрос+страница)', 'page', 'page', 'Страница', 'Top pages');
  const i = need(cols, 'GSC (запрос+страница)', 'impressions', 'impressions', 'Impressions', 'Показы');
  const p = pick(cols, 'position', 'Position', 'Позиция');
  return rows.map((r) => ({ query: str(r[q]), page: norm(r[page]), impr: num(r[i]) ?? NaN, pos: p ? num(r[p]) ?? NaN : NaN }));
}

// ---------- расчёты ----------
export function classify(url: string, rules: { name: string; rx: RegExp }[]): string {
  const path = pathOf(url);
  if (path === '' || path === '/') return 'Главная';
  for (const r of rules) if (r.rx.test(path)) return r.name;
  return 'Прочее';
}

const DATE_RX = /^\d{1,2}\s+(янв|фев|мар|апр|мая|май|июн|июл|авг|сен|окт|ноя|дек)/iu;

/** PageRank как в networkx (alpha 0.85, висячие узлы распределяются равномерно), затем среднее = 1. */
export function pagerank(nodes: string[], edges: [string, string][], alpha = 0.85, maxIter = 100, tol = 1e-6): Map<string, number> {
  const N = nodes.length;
  const idx = new Map(nodes.map((n, i) => [n, i]));
  const out: number[][] = nodes.map(() => []);
  for (const [s, d] of edges) { const a = idx.get(s), b = idx.get(d); if (a !== undefined && b !== undefined) out[a].push(b); }
  let x = new Array(N).fill(1 / N);
  for (let it = 0; it < maxIter; it++) {
    const last = x; x = new Array(N).fill(0);
    let dangle = 0;
    for (let i = 0; i < N; i++) if (out[i].length === 0) dangle += last[i];
    dangle *= alpha;
    for (let i = 0; i < N; i++) {
      const o = out[i];
      if (o.length) { const w = (alpha * last[i]) / o.length; for (const j of o) x[j] += w; }
    }
    let err = 0;
    for (let i = 0; i < N; i++) { x[i] += dangle / N + (1 - alpha) / N; err += Math.abs(x[i] - last[i]); }
    if (err < N * tol) break;
  }
  const mean = x.reduce((a, b) => a + b, 0) / (N || 1);
  return new Map(nodes.map((n, i) => [n, mean ? x[i] / mean : 0]));
}

// TF-IDF, analyzer=char_wb, ngram 3–5, sublinear_tf, smooth idf, l2 — как в sklearn
function charWb(text: string, minN = 3, maxN = 5): string[] {
  const grams: string[] = [];
  for (const raw of text.split(/\s+/).filter(Boolean)) {
    const w = ` ${raw} `; const len = [...w].length; const chars = [...w];
    for (let n = minN; n <= maxN; n++) {
      let off = 0;
      grams.push(chars.slice(off, off + n).join(''));
      while (off + n < len) { off++; grams.push(chars.slice(off, off + n).join('')); }
      if (off === 0) break;
    }
  }
  return grams;
}
export function tfidfVectors(docs: string[]): Map<string, number>[] {
  const tfs = docs.map((d) => { const m = new Map<string, number>(); for (const g of charWb(d)) m.set(g, (m.get(g) ?? 0) + 1); return m; });
  const df = new Map<string, number>();
  for (const m of tfs) for (const k of m.keys()) df.set(k, (df.get(k) ?? 0) + 1);
  const n = docs.length;
  return tfs.map((m) => {
    const v = new Map<string, number>(); let norm2 = 0;
    for (const [k, c] of m) { const w = (1 + Math.log(c)) * (Math.log((1 + n) / (1 + df.get(k)!)) + 1); v.set(k, w); norm2 += w * w; }
    const nr = Math.sqrt(norm2) || 1;
    for (const [k, w] of v) v.set(k, w / nr);
    return v;
  });
}
const dot = (a: Map<string, number>, b: Map<string, number>) => {
  const [s, l] = a.size < b.size ? [a, b] : [b, a]; let r = 0;
  for (const [k, w] of s) { const o = l.get(k); if (o) r += w * o; }
  return r;
};

const slug = (u: string) => pathOf(u).replace(/\/+$/, '').split('/').pop() ?? '';
function slugSimilar(a: string, b: string) {
  const x = slug(a), y = slug(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const tx = new Set(x.split(/[-_]/)), ty = new Set(y.split(/[-_]/));
  const inter = [...tx].filter((t) => ty.has(t)).length;
  return inter / Math.max(tx.size, ty.size) >= 0.6;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export interface AuditInput {
  internal: Row[]; inlinks: Row[]; gscPages?: Row[] | null; gscQp?: Row[] | null;
  rules: TypeRule[]; settings?: Partial<AuditSettings>;
  onProgress?: (stage: string, pct: number) => void;
}

export function runAudit(input: AuditInput): AuditResult {
  const S = { ...DEFAULT_SETTINGS, ...(input.settings ?? {}) };
  const prog = input.onProgress ?? (() => {});
  const rules = input.rules.filter((r) => r.name && r.regex).map((r) => {
    try { return { name: r.name, rx: new RegExp(r.regex) }; } catch { throw new AuditInputError(`Неверное регулярное выражение у типа «${r.name}»: ${r.regex}`); }
  });

  prog('Чтение страниц', 10);
  const pages = loadPages(input.internal);
  if (!pages.length) throw new AuditInputError('В internal_all нет HTML-страниц');
  prog('Чтение ссылок', 20);
  const links = loadLinks(input.inlinks);

  const home = pages.reduce((a, p) => (pathOf(p.url).length < pathOf(a.url).length ? p : a), pages[0]).url;

  // ok-страницы и типы
  const okMap = new Map<string, PageIn & { type: string }>();
  for (const p of pages) if (p.code === 200 && !okMap.has(p.url)) okMap.set(p.url, { ...p, type: classify(p.url, rules) });
  // pandas сохраняет дубли строк; дубли Address у SF редки — берём первую
  const ok = [...okMap.values()];
  const typ = new Map(ok.map((p) => [p.url, p.type]));
  const nSrc = new Map<string, number>();
  for (const p of ok) nSrc.set(p.type, (nSrc.get(p.type) ?? 0) + 1);

  prog('Шаблонные ссылки', 35);
  // a) доля страниц типа-источника, ведущих на цель
  const pairSrc = new Map<string, Set<string>>();
  for (const l of links) {
    const st = typ.get(l.src);
    if (!st || l.pos.toLowerCase() !== 'content') continue;
    const k = `${st}\u0000${l.dst}`;
    if (!pairSrc.has(k)) pairSrc.set(k, new Set());
    pairSrc.get(k)!.add(l.src);
  }
  // d) листинги
  const listing = new Map<string, Set<string>>();
  for (const l of links) {
    const dt = typ.get(l.dst);
    if (!dt || l.pos.toLowerCase() !== 'content') continue;
    const k = `${l.src}\u0000${dt}`;
    if (!listing.has(k)) listing.set(k, new Set());
    listing.get(k)!.add(l.dst);
  }
  let templateLinks = 0;
  for (const l of links) {
    const st = typ.get(l.src);
    let t = false;
    if (st) {
      const set = pairSrc.get(`${st}\u0000${l.dst}`);
      const n = nSrc.get(st) ?? 0;
      if (set && n >= S.templateMinGroup && set.size / n >= S.templateShare) t = true;
    }
    if (DATE_RX.test(l.anchor) || l.isImg) t = true;
    const dt = typ.get(l.dst);
    if (dt && (listing.get(`${l.src}\u0000${dt}`)?.size ?? 0) >= S.listingMin) t = true;
    l.tmpl = t;
    l.isText = l.isText && !t;
    if (t && l.pos.toLowerCase() === 'content') templateLinks++;
  }

  const live = links.filter((l) => okMap.has(l.dst) && okMap.has(l.src) && l.follow);
  const liveText = live.filter((l) => l.isText);

  prog('PageRank', 50);
  const uniqEdges = (arr: LinkIn[]) => { const s = new Set<string>(); const e: [string, string][] = [];
    for (const l of arr) { const k = `${l.src}\u0000${l.dst}`; if (!s.has(k)) { s.add(k); e.push([l.src, l.dst]); } } return e; };
  const nodes = ok.map((p) => p.url);
  const prAll = pagerank(nodes, uniqEdges(live));
  const prText = pagerank(nodes, uniqEdges(liveText));

  const nunique = (arr: LinkIn[], key: 'src' | 'dst', val: 'src' | 'dst') => {
    const m = new Map<string, Set<string>>();
    for (const l of arr) { if (!m.has(l[key])) m.set(l[key], new Set()); m.get(l[key])!.add(l[val]); }
    return m;
  };
  const inAll = nunique(live, 'dst', 'src');
  const inText = nunique(liveText, 'dst', 'src');
  const outText = nunique(liveText, 'src', 'dst');

  const gp = input.gscPages ? loadGscPages(input.gscPages) : null;
  const gpMap = new Map<string, GscPage>();
  if (gp) for (const g of gp) if (!gpMap.has(g.page)) gpMap.set(g.page, g);

  const outPages: PageOut[] = ok.map((p) => {
    const row: PageOut = {
      url: p.url, type: p.type, title: p.title, h1: p.h1, words: p.words, depth: p.depth,
      in_all: inAll.get(p.url)?.size ?? 0, in_text: inText.get(p.url)?.size ?? 0, out_text: outText.get(p.url)?.size ?? 0,
      pr_all: prAll.get(p.url) ?? 0, pr_text: prText.get(p.url) ?? 0,
    };
    if (gp) { const g = gpMap.get(p.url); row.clicks = g?.clicks ?? 0; row.impr = g?.impr ?? 0; row.pos = g?.pos ?? null; }
    return row;
  });

  prog('Проблемы', 65);
  const orphans = outPages.filter((p) => p.in_all === 0 && p.url !== home);
  const TEXT_TYPES = ['Статья', 'Блог', 'Услуга', 'Консультация', 'Прочее'];
  const noText = outPages.filter((p) => p.in_text === 0 && p.url !== home && TEXT_TYPES.includes(p.type));
  const host = hostOf(home);
  const internal = links.filter((l) => hostOf(l.dst) === host);
  const group = (codes: number[]): LinkGroup[] => {
    const m = new Map<string, { dst: string; code: number; srcs: string[]; set: Set<string> }>();
    for (const l of internal) {
      if (l.code === null || !codes.includes(l.code)) continue;
      const k = `${l.dst}\u0000${l.code}`;
      if (!m.has(k)) m.set(k, { dst: l.dst, code: l.code, srcs: [], set: new Set() });
      const g = m.get(k)!; if (!g.set.has(l.src)) { g.set.add(l.src); g.srcs.push(l.src); }
    }
    return [...m.values()].map((g) => ({ dst: g.dst, code: g.code, links: g.set.size, examples: g.srcs.slice(0, 3) }))
      .sort((a, b) => b.links - a.links);
  };
  const redirects = group([301, 302, 307, 308]);
  const broken = group([404, 410, 500, 502, 503]);

  // конфликты анкоров
  const anc = new Map<string, Map<string, number>>();
  for (const l of liveText) {
    if (!l.anchor) continue;
    const a = l.anchor.toLowerCase().trim();
    if (!anc.has(a)) anc.set(a, new Map());
    const m = anc.get(a)!; m.set(l.dst, (m.get(l.dst) ?? 0) + 1);
  }
  const conflicts: AnchorConflict[] = [...anc.entries()].filter(([, m]) => m.size > 1)
    .map(([a, m]) => ({ anchor: a, targets: m.size, detail: [...m.entries()].sort((x, y) => y[1] - x[1]).map(([url, count]) => ({ url, count })) }))
    .sort((a, b) => b.targets - a.targets);

  // каннибализация
  let cannibal: Cannibal[] = [];
  if (input.gscQp) {
    const qp = loadGscQp(input.gscQp).filter((r) => okMap.has(r.page) && r.impr >= 1);
    const byQ = new Map<string, GscQp[]>();
    for (const r of qp) { if (!byQ.has(r.query)) byQ.set(r.query, []); byQ.get(r.query)!.push(r); }
    for (const [q, sub] of byQ) {
      const nPages = new Set(sub.map((s) => s.page)).size;
      const total = sub.reduce((a, s) => a + s.impr, 0);
      if (nPages < 2 || total < S.minImpr) continue;
      const sorted = [...sub].sort((a, b) => b.impr - a.impr);
      const [top, sec] = sorted;
      const share2 = sec.impr / total;
      if (share2 < 0.15) continue;
      cannibal.push({ query: q, impr: Math.round(total), pages: nPages, main: top.page, mainPos: Math.round(top.pos * 10) / 10,
        rival: sec.page, rivalPos: Math.round(sec.pos * 10) / 10, rivalShare: r2(share2) });
    }
    cannibal = cannibal.sort((a, b) => b.impr - a.impr);
  }

  prog('Кандидаты на ссылки (TF-IDF)', 80);
  const srcP = outPages.filter((p) => p.type === 'Статья' || p.type === 'Блог');
  const dstP = outPages.filter((p) => p.type === 'Услуга' || p.type === 'Консультация');
  let candidates: Candidate[] = [];
  if (srcP.length && dstP.length) {
    const txt = (p: PageOut) => `${p.title} ${p.h1}`.toLowerCase();
    const vecs = tfidfVectors([...srcP.map(txt), ...dstP.map(txt)]);
    const sv = vecs.slice(0, srcP.length), dv = vecs.slice(srcP.length);
    const have = new Set(liveText.map((l) => `${l.src}\u0000${l.dst}`));
    srcP.forEach((s, i) => {
      const sims = dv.map((d, j) => ({ j, v: dot(sv[i], d) })).sort((a, b) => b.v - a.v).slice(0, S.topK);
      for (const { j, v } of sims) {
        if (v < S.minSim) break;
        const d = dstP[j];
        if (have.has(`${s.url}\u0000${d.url}`)) continue;
        candidates.push({ src: s.url, srcH1: s.h1, dst: d.url, dstH1: d.h1, sim: r2(v), anchor: d.h1, duplicate: v > 0.6 && slugSimilar(s.url, d.url) });
      }
    });
    candidates = candidates.sort((a, b) => b.sim - a.sim);
  }

  prog('План действий', 90);
  const plan: PlanItem[] = [];
  const hasGsc = !!gp;
  const commercial = outPages.filter((p) => p.type === 'Услуга' || p.type === 'Консультация');
  if (hasGsc) {
    commercial.map((p) => ({ p, score: (p.impr ?? 0) / (1 + p.in_text) })).sort((a, b) => b.score - a.score)
      .filter((x) => x.p.in_text < 3).slice(0, 15)
      .forEach(({ p, score }) => plan.push({ priority: 'Высокий', action: 'Усилить услугу ссылками из текста', page: p.url,
        reason: `Показов ${Math.round(p.impr ?? 0)}, поз. ${p.pos != null ? p.pos.toFixed(1) : '—'}, ссылок из текста ${p.in_text}`, score }));
  } else {
    commercial.filter((p) => p.in_text < 3).sort((a, b) => a.in_text - b.in_text).slice(0, 15)
      .forEach((p) => plan.push({ priority: 'Средний*', action: 'Усилить услугу ссылками из текста', page: p.url,
        reason: `Ссылок из текста ${p.in_text} (нет данных GSC — приоритет по ссылкам)`, score: 100 - p.in_text }));
  }
  broken.slice(0, 10).forEach((r) => plan.push({ priority: 'Высокий', action: `Исправить ссылку на ${r.code}`, page: r.dst, reason: `Ссылок: ${r.links}`, score: 1000 + r.links }));
  redirects.filter((r) => r.links >= 5).slice(0, 10).forEach((r) => plan.push({ priority: 'Средний', action: 'Заменить ссылки на конечный URL (редирект)', page: r.dst, reason: `Ссылок: ${r.links}`, score: 500 + r.links }));
  cannibal.slice(0, 10).forEach((r) => plan.push({ priority: 'Высокий', action: 'Каннибализация: проверить, развести или склеить', page: `${r.main} ↔ ${r.rival}`,
    reason: `Запрос «${r.query}», ${r.impr} показов, доля конкурента ${r.rivalShare}`, score: 800 + r.impr / 100 }));
  orphans.slice(0, 10).forEach((r) => plan.push({ priority: 'Средний', action: 'Страница-сирота: дать ссылку из тематической страницы', page: r.url, reason: 'Нет входящих ссылок', score: 300 }));
  plan.sort((a, b) => b.score - a.score);

  // по типам
  const tm = new Map<string, PageOut[]>();
  for (const p of outPages) { if (!tm.has(p.type)) tm.set(p.type, []); tm.get(p.type)!.push(p); }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
  const byType: TypeStat[] = [...tm.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([type, ps]) => {
    const ds = ps.map((p) => p.depth).filter((d): d is number => d !== null);
    return { type, pages: ps.length, prAvg: r2(avg(ps.map((p) => p.pr_all))), inTextAvg: r2(avg(ps.map((p) => p.in_text))),
      noText: ps.filter((p) => p.in_text === 0).length, depthAvg: ds.length ? r2(avg(ds)) : null };
  });

  prog('Готово', 100);
  return {
    home, host, hasGsc, hasGscQp: !!input.gscQp,
    summary: {
      pages: ok.length, orphans: orphans.length, noTextLinks: noText.length, redirectTargets: redirects.length,
      brokenTargets: broken.length, anchorConflicts: conflicts.length, cannibal: input.gscQp ? cannibal.length : null,
      candidates: candidates.length, templateLinks,
    },
    plan, byType,
    pages: [...outPages].sort((a, b) => a.in_text - b.in_text),
    candidates, cannibal,
    orphans: orphans.map((p) => ({ url: p.url, type: p.type, title: p.title })),
    noText: noText.map((p) => ({ url: p.url, type: p.type, title: p.title, in_all: p.in_all })),
    redirects, broken, conflicts,
  };
}
