import * as XLSX from 'xlsx';

export type ParsedTraffic = {
  rows: Array<{ period: string; yandex: number; google: number; bing: number; total: number }>;
  summary: string;
};

export type ParsedSources = {
  rows: Array<{ source: string; visits: number; users: number; bounce: number; depth: number; duration: number }>;
  totalVisits: number;
  yandexOrganic: number;
  summary: string;
};

export type ParsedGsc = {
  impressions: number;
  clicks: number;
  ctr: number;
  position: number;
  buckets: { top1: number; top2_3: number; top4_10: number; top11_50: number };
  summary: string;
};

export type ParsedTopvisor = {
  rows: Array<{ query: string; position: number | null; region?: string; engine?: string }>;
  total: number;
  top10: number;
  top100: number;
  outside: number;
  summary: string;
};

function sheetToRows(file: ArrayBuffer): any[][] {
  const wb = XLSX.read(file, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][];
}

function toNum(v: any): number {
  if (v == null || v === '') return 0;
  if (typeof v === 'number') return v;
  const s = String(v).replace(/\s+/g, '').replace(',', '.').replace('%', '');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function findHeaderRow(rows: any[][], keywords: string[]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const line = rows[i].map((c) => String(c).toLowerCase()).join('|');
    if (keywords.every((k) => line.includes(k))) return i;
  }
  return -1;
}

export async function parseMetrikaTraffic(file: File): Promise<ParsedTraffic> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const headerIdx = findHeaderRow(rows, ['яндекс']) >= 0 ? findHeaderRow(rows, ['яндекс']) : 0;
  const header = rows[headerIdx].map((c) => String(c).toLowerCase());
  const idx = {
    period: header.findIndex((c) => /дата|период|месяц/i.test(c)),
    yandex: header.findIndex((c) => c.includes('яндекс') || c.includes('yandex')),
    google: header.findIndex((c) => c.includes('google') || c.includes('гугл')),
    bing: header.findIndex((c) => c.includes('bing')),
    total: header.findIndex((c) => c.includes('итог') || c.includes('всего')),
  };
  const parsed: ParsedTraffic['rows'] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.every((c) => c === '' || c == null)) continue;
    const period = String(r[idx.period >= 0 ? idx.period : 0] ?? '').trim();
    if (!period) continue;
    const y = toNum(r[idx.yandex]);
    const g = toNum(r[idx.google]);
    const b = idx.bing >= 0 ? toNum(r[idx.bing]) : 0;
    const t = idx.total >= 0 ? toNum(r[idx.total]) : y + g + b;
    parsed.push({ period, yandex: y, google: g, bing: b, total: t });
  }
  const last = parsed[parsed.length - 1];
  const summary = last
    ? `Данные за ${parsed[0]?.period ?? '?'} — ${last.period}. Последний период: ${last.yandex} визитов из Яндекса, ${last.google} из Google.`
    : 'Данные не распознаны.';
  return { rows: parsed, summary };
}

export async function parseMetrikaSources(file: File): Promise<ParsedSources> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const headerIdx = findHeaderRow(rows, ['источник']);
  const startIdx = headerIdx >= 0 ? headerIdx : 0;
  const header = rows[startIdx].map((c) => String(c).toLowerCase());
  const idx = {
    source: header.findIndex((c) => c.includes('источник')),
    visits: header.findIndex((c) => c.includes('визит')),
    users: header.findIndex((c) => c.includes('посетит') || c.includes('пользоват')),
    bounce: header.findIndex((c) => c.includes('отказ')),
    depth: header.findIndex((c) => c.includes('глубин')),
    duration: header.findIndex((c) => c.includes('время')),
  };
  const out: ParsedSources['rows'] = [];
  for (let i = startIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const source = String(r[idx.source >= 0 ? idx.source : 0] ?? '').trim();
    if (!source) continue;
    out.push({
      source,
      visits: toNum(r[idx.visits]),
      users: toNum(r[idx.users]),
      bounce: toNum(r[idx.bounce]),
      depth: toNum(r[idx.depth]),
      duration: toNum(r[idx.duration]),
    });
  }
  const totalVisits = out.reduce((s, r) => s + r.visits, 0);
  const yaOrg = out.find((r) => /яндекс|yandex/i.test(r.source) && /орган|organic/i.test(r.source));
  const yandexOrganic = yaOrg?.visits ?? 0;
  const summary = `Всего визитов: ${totalVisits}${yandexOrganic ? `, органика Яндекс: ${yandexOrganic} (${totalVisits ? Math.round((yandexOrganic / totalVisits) * 100) : 0}%)` : ''}.`;
  return { rows: out, totalVisits, yandexOrganic, summary };
}

export async function parseGsc(file: File): Promise<ParsedGsc> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  let impressions = 0, clicks = 0, position = 0, positionCount = 0;
  const buckets = { top1: 0, top2_3: 0, top4_10: 0, top11_50: 0 };
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' }) as any[][];
    if (!rows.length) continue;
    const header = rows[0].map((c) => String(c).toLowerCase());
    const iImp = header.findIndex((c) => c.includes('показ') || c.includes('impress'));
    const iCli = header.findIndex((c) => c.includes('клик') || c.includes('click'));
    const iPos = header.findIndex((c) => c.includes('позиц') || c.includes('position'));
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r) continue;
      const imp = toNum(r[iImp]);
      const cli = toNum(r[iCli]);
      const pos = toNum(r[iPos]);
      impressions += imp;
      clicks += cli;
      if (pos > 0) {
        position += pos;
        positionCount++;
        if (pos <= 1) buckets.top1 += imp;
        else if (pos <= 3) buckets.top2_3 += imp;
        else if (pos <= 10) buckets.top4_10 += imp;
        else if (pos <= 50) buckets.top11_50 += imp;
      }
    }
  }
  const avgPos = positionCount ? position / positionCount : 0;
  const ctr = impressions ? (clicks / impressions) * 100 : 0;
  const summary = `Показов: ${impressions}, кликов: ${clicks}, CTR: ${ctr.toFixed(2)}%, ср. позиция: ${avgPos.toFixed(1)}.`;
  return { impressions, clicks, ctr, position: avgPos, buckets, summary };
}

export async function parseTopvisor(file: File): Promise<ParsedTopvisor> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const headerIdx = findHeaderRow(rows, ['запрос']) >= 0 ? findHeaderRow(rows, ['запрос']) : 0;
  const header = rows[headerIdx].map((c) => String(c).toLowerCase());
  const idx = {
    query: header.findIndex((c) => c.includes('запрос') || c.includes('ключ')),
    position: header.findIndex((c) => c.includes('позиц') || c.includes('position')),
    region: header.findIndex((c) => c.includes('регион') || c.includes('город')),
    engine: header.findIndex((c) => c.includes('поиск') || c.includes('engine') || c.includes('система')),
  };
  const out: ParsedTopvisor['rows'] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const q = String(r[idx.query >= 0 ? idx.query : 0] ?? '').trim();
    if (!q) continue;
    const raw = r[idx.position];
    const posStr = String(raw ?? '').trim();
    const position = posStr === '--' || posStr === '-' || posStr === '' ? null : toNum(raw);
    out.push({
      query: q,
      position,
      region: idx.region >= 0 ? String(r[idx.region] ?? '') : undefined,
      engine: idx.engine >= 0 ? String(r[idx.engine] ?? '') : undefined,
    });
  }
  const total = out.length;
  const top10 = out.filter((r) => r.position != null && r.position > 0 && r.position <= 10).length;
  const top100 = out.filter((r) => r.position != null && r.position > 0 && r.position <= 100).length;
  const outside = out.filter((r) => r.position == null || (r.position ?? 0) > 100).length;
  const summary = `Запросов: ${total}, в топ-10: ${top10}, в топ-100: ${top100}, вне топ-100: ${outside}.`;
  return { rows: out, total, top10, top100, outside, summary };
}