import * as XLSX from 'xlsx';

export type ParsedTraffic = {
  rows: Array<{ period: string; yandex: number; google: number; bing: number; total: number }>;
  daily: Array<{ date: string; yandex: number; google: number; bing: number; total: number }>;
  baseYandex: number;
  baseGoogle: number;
  baseBing: number;
  lastMonth: { period: string; yandex: number; google: number; bing: number; total: number } | null;
  periodFrom: string | null;
  periodTo: string | null;
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
  clicksBuckets: { pos1: number; pos2_3: number; pos4_10: number; pos11_50: number };
  ctrPos1: number;
  potentialClicksFromPos23: number;
  additionalClicks: number;
  monthlyClicks: number;
  periodStr: string;
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
  const emptyResult = (msg: string): ParsedTraffic => ({
    rows: [], daily: [], baseYandex: 0, baseGoogle: 0, baseBing: 0,
    lastMonth: null, periodFrom: null, periodTo: null, summary: msg,
  });
  // Строгий поиск: первая ячейка строки строго равна «Период»
  const headerIdx = rows.findIndex((r) => String(r?.[0] ?? '').trim() === 'Период');
  if (headerIdx < 0) return emptyResult('Не найдена строка заголовков «Период».');

  const dateRe = /^\d{4}-\d{2}-\d{2}$/;

  type Daily = { date: string; yandex: number; google: number; bing: number; total: number };
  const daily: Daily[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const dateStr = String(r[0] ?? '').trim();
    if (!dateRe.test(dateStr)) continue; // пропускаем итоговые строки без даты
    const yandex = toNum(r[1]);
    const google = toNum(r[2]);
    const bing = toNum(r[3]);
    const total = r[4] != null && r[4] !== '' ? toNum(r[4]) : yandex + google + bing;
    daily.push({ date: dateStr, yandex, google, bing, total });
  }
  if (!daily.length) return emptyResult('Не найдены дневные строки (формат YYYY-MM-DD).');

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

  // База прогноза: среднее последних 2 ненулевых месяцев
  const nonZero = parsed.filter((m) => m.total > 0);
  const lastTwo = nonZero.slice(-2);
  const avg = (k: 'yandex' | 'google' | 'bing') =>
    lastTwo.length ? Math.round(lastTwo.reduce((s, m) => s + m[k], 0) / lastTwo.length) : 0;
  const baseYandex = avg('yandex');
  const baseGoogle = avg('google');
  const baseBing = avg('bing');
  const last = parsed[parsed.length - 1] ?? null;
  const periodFrom = daily[0].date;
  const periodTo = daily[daily.length - 1].date;

  const summary =
    `📅 Период: ${periodFrom} — ${periodTo}\n` +
    `📊 Последний месяц: Яндекс ${last?.yandex ?? 0}, Google ${last?.google ?? 0}, итого ${last?.total ?? 0}\n` +
    `📈 База прогноза: Яндекс ~${baseYandex}/мес., Google ~${baseGoogle}/мес.\n` +
    `🗓 Данных: ${daily.length} дней / ${parsed.length} мес.`;

  return { rows: parsed, daily, baseYandex, baseGoogle, baseBing, lastMonth: last, periodFrom, periodTo, summary };
}

export async function parseMetrikaSources(file: File): Promise<ParsedSources> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  // Строгий поиск заголовка
  const headerIdx = rows.findIndex((r) => String(r?.[0] ?? '').trim() === 'Источник трафика');
  if (headerIdx < 0) {
    return { rows: [], totalVisits: 0, yandexOrganic: 0, googleOrganic: 0, direct: 0, summary: 'Не найдена строка «Источник трафика».' };
  }

  // Метрика может выдавать иерархию в 2 колонках: [0]=тип источника, [1]=подсточник
  // Метрики обычно: Визиты, Посетители, Отказы, Глубина, Время
  const header = (rows[headerIdx] ?? []).map((c) => String(c).toLowerCase());
  const iVisits = Math.max(header.findIndex((c) => c.includes('визит')), 2);
  const iUsers = header.findIndex((c) => c.includes('посетит') || c.includes('пользоват'));
  const iBounce = header.findIndex((c) => c.includes('отказ'));
  const iDepth = header.findIndex((c) => c.includes('глубин'));
  const iDuration = header.findIndex((c) => c.includes('время'));

  const out: ParsedSources['rows'] = [];
  let totalVisits = 0;
  let yandexOrganic = 0;
  let googleOrganic = 0;
  let direct = 0;
  let referral = 0;

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const c0 = String(r[0] ?? '').trim();
    const c1 = String(r[1] ?? '').trim();
    if (!c0 && !c1) continue;
    const visits = toNum(r[iVisits]);
    // Строка «Итого и средние» — берём как total и не добавляем в rows
    if (c0 === 'Итого и средние' || c0.toLowerCase().startsWith('итого')) {
      totalVisits = visits;
      continue;
    }
    if (!visits) continue;

    const source = c1 ? `${c0} / ${c1}` : c0;
    out.push({
      source,
      visits,
      users: iUsers >= 0 ? toNum(r[iUsers]) : 0,
      bounce: iBounce >= 0 ? toNum(r[iBounce]) : 0,
      depth: iDepth >= 0 ? toNum(r[iDepth]) : 0,
      duration: iDuration >= 0 ? toNum(r[iDuration]) : 0,
    });

    if (c0.includes('поисковых систем')) {
      if (c1 === 'Яндекс') yandexOrganic += visits;
      else if (c1 === 'Google') googleOrganic += visits;
    }
    if (c0.includes('Прямые')) direct += visits;
    if (c0.includes('ссылкам на сайтах')) referral += visits;
  }

  if (!totalVisits) {
    // fallback: сумма верхнеуровневых строк (без подсточника)
    totalVisits = out.filter((r) => !r.source.includes(' / ')).reduce((s, r) => s + r.visits, 0);
  }
  const pct = (n: number) => (totalVisits > 0 ? Math.round((n / totalVisits) * 100) : 0);
  const summary =
    `🌐 Всего визитов: ${totalVisits}\n` +
    `🔍 Органика Яндекс: ${yandexOrganic} (${pct(yandexOrganic)}%)\n` +
    `🔍 Органика Google: ${googleOrganic} (${pct(googleOrganic)}%)\n` +
    `📎 Прямые заходы: ${direct} (${pct(direct)}%)\n` +
    `🔗 Реферальные: ${referral} (${pct(referral)}%)`;
  return { rows: out, totalVisits, yandexOrganic, googleOrganic, direct, summary };
}

export async function parseGsc(file: File): Promise<ParsedGsc> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  // Формат Topvisor GSC: фиксированные колонки
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as any[][];
  const empty: ParsedGsc = {
    impressions: 0, clicks: 0, ctr: 0, position: 0,
    buckets: { top1: 0, top2_3: 0, top4_10: 0, top11_50: 0 },
    clicksBuckets: { pos1: 0, pos2_3: 0, pos4_10: 0, pos11_50: 0 },
    ctrPos1: 0, potentialClicksFromPos23: 0, additionalClicks: 0,
    monthlyClicks: 0, periodStr: '', summary: 'Пустой или нераспознанный файл GSC.',
  };
  if (rows.length < 2) return empty;

  const h = (rows[0] ?? []).map((c) => String(c));
  const isTopvisorGsc = h[3]?.includes('Impressions') && h[4]?.includes('Clicks') && h[2]?.includes('Special group');
  if (!isTopvisorGsc) return empty;

  const dataRow = rows.find((r) => String(r?.[2] ?? '').trim() === 'ALL_QUERIES');
  if (!dataRow) return empty;

  const impressions = toNum(dataRow[3]);
  const clicks = toNum(dataRow[4]);
  const ctr = Math.round(toNum(dataRow[5]) * 100) / 100;
  const position = Math.round(toNum(dataRow[6]) * 100) / 100;
  const impressionsPos1 = toNum(dataRow[8]);
  const clicksPos1 = toNum(dataRow[9]);
  const ctrPos1 = toNum(dataRow[10]);
  const impressionsPos23 = toNum(dataRow[11]);
  const clicksPos23 = toNum(dataRow[12]);
  const impressionsPos410 = toNum(dataRow[16]);
  const clicksPos410 = toNum(dataRow[17]);
  const impressionsPos1150 = toNum(dataRow[21]);
  const clicksPos1150 = toNum(dataRow[22]);

  const potentialClicksFromPos23 = Math.round(impressionsPos23 * (ctrPos1 / 100));
  const additionalClicks = Math.max(0, potentialClicksFromPos23 - clicksPos23);
  const monthlyClicks = Math.round(clicks / 12);
  const periodStr = String(dataRow[1] ?? '').trim();

  const summary =
    `👁 Показов: ${impressions} | Кликов: ${clicks} | CTR: ${ctr}%\n` +
    `📍 Средняя позиция: ${position}\n` +
    `⚡ Потенциал (поз. 2–3): ${impressionsPos23} показов → +${additionalClicks} доп. кликов/мес. при выходе в топ-1\n` +
    `📊 Топ-1: ${impressionsPos1} | Поз. 2–3: ${impressionsPos23} | Поз. 4–10: ${impressionsPos410} | Поз. 11–50: ${impressionsPos1150}`;

  return {
    impressions, clicks, ctr, position,
    buckets: { top1: impressionsPos1, top2_3: impressionsPos23, top4_10: impressionsPos410, top11_50: impressionsPos1150 },
    clicksBuckets: { pos1: clicksPos1, pos2_3: clicksPos23, pos4_10: clicksPos410, pos11_50: clicksPos1150 },
    ctrPos1, potentialClicksFromPos23, additionalClicks, monthlyClicks, periodStr,
    summary,
  };
}

export async function parseTopvisor(file: File): Promise<ParsedTopvisor> {
  const buf = await file.arrayBuffer();
  const rows = sheetToRows(buf);
  const empty: ParsedTopvisor = { rows: [], total: 0, top10: 0, top100: 0, outside: 0, summary: 'Пустой файл.' };
  if (rows.length < 2) return empty;

  const out: ParsedTopvisor['rows'] = [];
  const first = rows[0] ?? [];
  const dateRe = /^(\d{4}-\d{2}-\d{2}|\d{2}\.\d{2}\.\d{4})$/;

  // Формат матрицы: строка 0 — даты снятия в колонках 1+
  let matrixDateColIdx = -1;
  for (let i = 1; i < first.length; i++) {
    if (dateRe.test(String(first[i] ?? '').trim())) matrixDateColIdx = i;
  }

  if (matrixDateColIdx > 0) {
    // Берём последнюю дату (снимок)
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const q = String(r[0] ?? '').trim();
      if (!q) continue;
      const raw = String(r[matrixDateColIdx] ?? '').trim();
      const position = raw === '--' || raw === '-' || raw === '' ? null : toNum(raw);
      out.push({ query: q, position });
    }
  } else {
    // Плоский формат: [запрос, позиция, регион?, ПС?]
    const headerLike = String(first[0] ?? '').toLowerCase();
    const startRow = headerLike.includes('запрос') || headerLike.includes('query') || headerLike.includes('ключ') ? 1 : 0;
    for (let i = startRow; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const q = String(r[0] ?? '').trim();
      if (!q) continue;
      const raw = String(r[1] ?? '').trim();
      const position = raw === '--' || raw === '-' || raw === '' ? null : toNum(raw);
      out.push({
        query: q, position,
        region: r[2] != null ? String(r[2]) : undefined,
        engine: r[3] != null ? String(r[3]) : undefined,
      });
    }
  }

  const total = out.length;
  if (!total) return empty;
  const top10 = out.filter((r) => r.position != null && r.position > 0 && r.position <= 10).length;
  const top3 = out.filter((r) => r.position != null && r.position > 0 && r.position <= 3).length;
  const top100 = out.filter((r) => r.position != null && r.position > 0 && r.position <= 100).length;
  const outside = out.filter((r) => r.position == null || (r.position ?? 0) > 100).length;
  const posWithValue = out.filter((r) => r.position != null).map((r) => r.position!);
  const avg = posWithValue.length ? Math.round((posWithValue.reduce((s, p) => s + p, 0) / posWithValue.length) * 10) / 10 : null;
  const summary =
    `🔑 Запросов всего: ${total}\n` +
    `✅ Топ-3: ${top3} | Топ-10: ${top10} | Топ-100: ${top100} | Вне топ-100: ${outside}\n` +
    `📍 Средняя позиция (попавших): ${avg ?? 'нет данных'}` +
    (outside === total ? `\n⚠️ Нулевая точка — сайт вне топ-100 по всем запросам` : '');
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