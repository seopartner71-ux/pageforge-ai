import * as XLSX from 'xlsx';

export type ParsedTraffic = {
  rows: Array<{ period: string; yandex: number; google: number; bing: number; total: number }>;
  summary: string;
};

export type ParsedSources = {
  rows: Array<{ source: string; visits: number; users: number; bounce: number; depth: number; duration: number }>;
  totalVisits: number;
  yandexOrganic: number;
  googleOrganic: number;
  direct: number;
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

export type ParsedWebmasterQueries = {
  rows: Array<{ query: string; impressions: number; clicks: number; position: number | null }>;
  total: number;
  top10: number;
  avgPosition: number;
  summary: string;
};

export type ParsedGeneric = {
  rows: any[][];
  columns: string[];
  rowCount: number;
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
  // 1. Найти строку, где первая ячейка = «Период»
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const first = String(rows[i]?.[0] ?? '').trim().toLowerCase();
    if (first === 'период' || first === 'date' || first === 'дата') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) {
    return { rows: [], summary: 'Не найдена строка заголовков «Период».' };
  }

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;
  const isDate = (v: any) => {
    const s = String(v ?? '').trim();
    return dateRe.test(s) || /^\d{4}-\d{2}$/.test(s);
  };

  // 2-3. Читать строки после заголовка, пока [0] похоже на дату
  type Daily = { date: string; yandex: number; google: number; bing: number; total: number };
  const daily: Daily[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || !isDate(r[0])) break;
    const date = String(r[0]).trim();
    const yandex = toNum(r[1]);
    const google = toNum(r[2]);
    const bing = toNum(r[3]);
    const total = r[4] != null && r[4] !== '' ? toNum(r[4]) : yandex + google + bing;
    daily.push({ date, yandex, google, bing, total });
  }

  // 4. Агрегировать по месяцам
  const byMonth = new Map<string, { yandex: number; google: number; bing: number; total: number }>();
  for (const d of daily) {
    const m = d.date.slice(0, 7); // YYYY-MM
    const cur = byMonth.get(m) ?? { yandex: 0, google: 0, bing: 0, total: 0 };
    cur.yandex += d.yandex;
    cur.google += d.google;
    cur.bing += d.bing;
    cur.total += d.total;
    byMonth.set(m, cur);
  }

  const parsed: ParsedTraffic['rows'] = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, v]) => ({ period, ...v }));

  const last = parsed[parsed.length - 1];
  const summary = last
    ? `Данные за ${parsed[0].period} — ${last.period} (${daily.length} дней, ${parsed.length} мес.). Последний месяц: ${last.yandex} визитов Яндекс, ${last.google} Google.`
    : 'Данные по дням не распознаны.';
  return { rows: parsed, summary };
}

export async function parseMetrikaSources(file: File): Promise<ParsedSources> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  // 1. Найти строку, где первая ячейка = «Источник трафика»
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const first = String(rows[i]?.[0] ?? '').trim().toLowerCase();
    if (first.includes('источник трафика') || first === 'источник') {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) headerIdx = 0;

  // Метрика может выдавать иерархию в 2 колонках: [0]=тип источника, [1]=подсточник
  // Метрики обычно: Визиты, Посетители, Отказы, Глубина, Время
  const header = (rows[headerIdx] ?? []).map((c) => String(c).toLowerCase());
  const iVisits = Math.max(header.findIndex((c) => c.includes('визит')), 2);
  const iUsers = header.findIndex((c) => c.includes('посетит') || c.includes('пользоват'));
  const iBounce = header.findIndex((c) => c.includes('отказ'));
  const iDepth = header.findIndex((c) => c.includes('глубин'));
  const iDuration = header.findIndex((c) => c.includes('время'));

  const out: ParsedSources['rows'] = [];
  let yandexOrganic = 0;
  let googleOrganic = 0;
  let direct = 0;
  let totalVisits = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const c0 = String(r[0] ?? '').trim();
    const c1 = String(r[1] ?? '').trim();
    if (!c0 && !c1) continue;

    const visits = toNum(r[iVisits]);
    const source = c1 ? `${c0} / ${c1}` : c0;
    out.push({
      source,
      visits,
      users: iUsers >= 0 ? toNum(r[iUsers]) : 0,
      bounce: iBounce >= 0 ? toNum(r[iBounce]) : 0,
      depth: iDepth >= 0 ? toNum(r[iDepth]) : 0,
      duration: iDuration >= 0 ? toNum(r[iDuration]) : 0,
    });

    const c0Low = c0.toLowerCase();
    const c1Low = c1.toLowerCase();

    // 2-3. Органика: [0] содержит «поисковых систем», [1] = Яндекс/Google
    if (c0Low.includes('поисковых систем') || c0Low.includes('поисковые системы')) {
      if (c1Low === 'яндекс' || c1Low === 'yandex') yandexOrganic += visits;
      else if (c1Low === 'google' || c1Low === 'гугл') googleOrganic += visits;
    }
    if (c0Low.includes('прям') || c0Low.includes('direct')) {
      if (!c1) direct += visits;
    }
  }

  // Итого визитов: берём только строки верхнего уровня (без подсточника), чтобы не дублировать
  totalVisits = out
    .filter((r) => !r.source.includes(' / '))
    .reduce((s, r) => s + r.visits, 0);
  if (!totalVisits) totalVisits = out.reduce((s, r) => s + r.visits, 0);

  const summary = `Всего визитов: ${totalVisits}. Органика Яндекс: ${yandexOrganic}, Google: ${googleOrganic}, прямые: ${direct}.`;
  return { rows: out, totalVisits, yandexOrganic, googleOrganic, direct, summary };
}

export async function parseGsc(file: File): Promise<ParsedGsc> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  // Формат Topvisor: строка 0 — заголовки, строка 1 (ALL_QUERIES) — сводные данные
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as any[][];
  if (!rows.length) {
    return { impressions: 0, clicks: 0, ctr: 0, position: 0, buckets: { top1: 0, top2_3: 0, top4_10: 0, top11_50: 0 }, summary: 'Пустой файл.' };
  }
  const header = rows[0].map((c) => String(c).toLowerCase());

  const findCol = (needles: string[]) =>
    header.findIndex((c) => needles.every((n) => c.includes(n)));

  const iImp = findCol(['impressions']);
  const iCli = findCol(['clicks']);
  const iCtr = findCol(['ctr']);
  const iPos = header.findIndex((c) => c.includes('avg') && c.includes('position'));

  const iTop1 = header.findIndex((c) => c.includes('impressions') && (c.includes('1st') || c.includes('pos. 1') || c.includes('position 1')));
  const iTop23 = header.findIndex((c) => c.includes('impressions') && (c.includes('2-3') || c.includes('2 - 3')));
  const iTop410 = header.findIndex((c) => c.includes('impressions') && (c.includes('4-10') || c.includes('4 - 10')));
  const iTop1150 = header.findIndex((c) => c.includes('impressions') && (c.includes('11-50') || c.includes('11 - 50')));

  // Ищем строку ALL_QUERIES (обычно строка 1)
  let dataRow: any[] | undefined;
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const marker = String(r[2] ?? r[1] ?? r[0] ?? '').toUpperCase();
    if (marker.includes('ALL_QUERIES') || marker.includes('ALL QUERIES')) {
      dataRow = r;
      break;
    }
  }
  if (!dataRow) dataRow = rows[1];

  const impressions = iImp >= 0 ? toNum(dataRow[iImp]) : 0;
  const clicks = iCli >= 0 ? toNum(dataRow[iCli]) : 0;
  const ctrRaw = iCtr >= 0 ? toNum(dataRow[iCtr]) : 0;
  const ctr = ctrRaw > 1 ? ctrRaw : ctrRaw * 100; // проценты
  const position = iPos >= 0 ? toNum(dataRow[iPos]) : 0;

  const buckets = {
    top1: iTop1 >= 0 ? toNum(dataRow[iTop1]) : 0,
    top2_3: iTop23 >= 0 ? toNum(dataRow[iTop23]) : 0,
    top4_10: iTop410 >= 0 ? toNum(dataRow[iTop410]) : 0,
    top11_50: iTop1150 >= 0 ? toNum(dataRow[iTop1150]) : 0,
  };

  const summary = `Показов: ${impressions}, кликов: ${clicks}, CTR: ${ctr.toFixed(2)}%, ср. позиция: ${position.toFixed(1)}. Top-1: ${buckets.top1}, 2-3: ${buckets.top2_3}, 4-10: ${buckets.top4_10}, 11-50: ${buckets.top11_50}.`;
  return { impressions, clicks, ctr, position, buckets, summary };
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

export async function parseWebmasterQueries(file: File): Promise<ParsedWebmasterQueries> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const headerIdx = findHeaderRow(rows, ['запрос']) >= 0 ? findHeaderRow(rows, ['запрос']) : 0;
  const header = rows[headerIdx].map((c) => String(c).toLowerCase());
  const iQ = header.findIndex((c) => c.includes('запрос') || c.includes('ключ'));
  const iImp = header.findIndex((c) => c.includes('показ') || c.includes('impress'));
  const iCli = header.findIndex((c) => c.includes('клик') || c.includes('click'));
  const iPos = header.findIndex((c) => c.includes('позиц') || c.includes('position'));
  const out: ParsedWebmasterQueries['rows'] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i]; if (!r) continue;
    const q = String(r[iQ >= 0 ? iQ : 0] ?? '').trim();
    if (!q) continue;
    const pos = iPos >= 0 ? toNum(r[iPos]) : 0;
    out.push({
      query: q,
      impressions: iImp >= 0 ? toNum(r[iImp]) : 0,
      clicks: iCli >= 0 ? toNum(r[iCli]) : 0,
      position: pos > 0 ? pos : null,
    });
  }
  const total = out.length;
  const top10 = out.filter((r) => r.position != null && r.position <= 10).length;
  const posRows = out.filter((r) => r.position != null);
  const avgPosition = posRows.length ? posRows.reduce((s, r) => s + (r.position || 0), 0) / posRows.length : 0;
  const summary = `Запросов: ${total}, в топ-10: ${top10}, ср. позиция: ${avgPosition.toFixed(1)}.`;
  return { rows: out, total, top10, avgPosition, summary };
}

export async function parseGeneric(file: File): Promise<ParsedGeneric> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const headerRow = rows[0] || [];
  const columns = headerRow.map((c) => String(c)).filter(Boolean);
  const dataRows = rows.slice(1).filter((r) => r && r.some((c) => c !== '' && c != null));
  return {
    rows: dataRows,
    columns,
    rowCount: dataRows.length,
    summary: `Строк: ${dataRows.length}, колонок: ${columns.length}${columns.length ? ` (${columns.slice(0, 6).join(', ')}${columns.length > 6 ? '…' : ''})` : ''}.`,
  };
}