import Papa from 'papaparse';

export interface BacklinkRow {
  sourceDomain: string;
  sourceUrl: string;
  dr: number;
  anchor: string;
  type: string; // text | image | redirect | naked
  rel: string; // follow | nofollow
  targetUrl?: string;
  sourceTitle?: string;
  status?: 'active' | 'inactive';
}

export interface SiteAuditData {
  name: string;
  rows: BacklinkRow[];
  totalLinks: number;
  uniqueDomains: number;
  avgDR: number;
  medianDR: number;
  drDistribution: { range: string; count: number }[];
  linkTypes: { name: string; value: number; color: string }[];
  followStats: { name: string; value: number; color: string }[];
  topicStats: { name: string; value: number; color: string }[];
  topPages: { url: string; count: number }[];
  followPct: number;
  textPct: number;
}

const TYPE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899', '#64748B'];

// Universal column mapping — supports Ahrefs (EN), русские заголовки, generic
const FIELD_MAP: Record<string, string[]> = {
  sourceDomain: ['домен источник', 'домен-источник', 'source domain', 'referring domain', 'domain', 'referring page domain'],
  sourceUrl: ['url источник', 'source url', 'referring page url', 'referring page', 'url', 'page url'],
  dr: ['dr', 'domain rating', 'доменный рейтинг', 'domain authority', 'da', 'ur'],
  anchor: ['анкор', 'anchor', 'anchor text', 'link anchor'],
  type: ['тип', 'type', 'link type'],
  rel: ['атрибуты', 'rel', 'nofollow', 'attributes', 'link attributes', 'follow'],
  targetUrl: ['url целевой', 'целевой url', 'target url', 'destination', 'linked url', 'target'],
  sourceTitle: ['title источника', 'source title', 'page title', 'title'],
  status: ['статус ссылки', 'статус', 'status', 'link status'],
};

function findKey(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx >= 0) return headers[idx];
  }
  // partial match
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

function extractDomain(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

function classifyType(raw: string, anchor: string, sourceDomain: string): string {
  const t = (raw || '').toLowerCase().trim();
  if (t.includes('image') || t.includes('изобр') || t === 'img') return 'image';
  if (t.includes('redirect') || t.includes('редирект') || t.includes('301') || t.includes('302')) return 'redirect';
  // Detect "безанкорные" — anchor is URL or empty
  const a = (anchor || '').trim();
  if (!a) return 'naked';
  if (/^https?:\/\//i.test(a) || a.includes(sourceDomain)) return 'naked';
  return 'text';
}

function classifyRel(raw: string): string {
  const t = (raw || '').toLowerCase();
  if (t.includes('nofollow') || t.includes('ugc') || t.includes('sponsored')) return 'nofollow';
  return 'follow';
}

function classifyTopic(domain: string): string {
  const d = domain.toLowerCase();
  if (d.endsWith('.ru')) return '.ru';
  if (d.endsWith('.рф') || d.endsWith('.xn--p1ai')) return '.рф';
  if (d.endsWith('.com')) return '.com';
  if (d.endsWith('.org')) return '.org';
  if (d.endsWith('.net')) return '.net';
  return 'другие';
}

function classifyStatus(raw: string): 'active' | 'inactive' {
  const t = (raw || '').toLowerCase().trim();
  if (!t) return 'active';
  if (t.includes('неактив') || t.includes('inactive') || t.includes('lost') || t.includes('removed') || t === 'no') return 'inactive';
  return 'active';
}

export function parseCsvToBacklinks(text: string): BacklinkRow[] {
  // Strip UTF-8 BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [';', ',', '\t', '|'],
  });

  const headers = parsed.meta.fields || [];
  if (!headers.length) return [];

  const map = {
    sourceDomain: findKey(headers, FIELD_MAP.sourceDomain),
    sourceUrl: findKey(headers, FIELD_MAP.sourceUrl),
    dr: findKey(headers, FIELD_MAP.dr),
    anchor: findKey(headers, FIELD_MAP.anchor),
    type: findKey(headers, FIELD_MAP.type),
    rel: findKey(headers, FIELD_MAP.rel),
    targetUrl: findKey(headers, FIELD_MAP.targetUrl),
    sourceTitle: findKey(headers, FIELD_MAP.sourceTitle),
    status: findKey(headers, FIELD_MAP.status),
  };

  return (parsed.data || []).map((row) => {
    const sourceUrl = map.sourceUrl ? String(row[map.sourceUrl] || '') : '';
    const sourceDomain = map.sourceDomain
      ? String(row[map.sourceDomain] || '').trim()
      : extractDomain(sourceUrl);
    const drRaw = map.dr ? String(row[map.dr] || '0') : '0';
    const dr = parseFloat(drRaw.replace(',', '.')) || 0;
    const anchor = map.anchor ? String(row[map.anchor] || '') : '';
    const type = map.type ? String(row[map.type] || '') : '';
    const rel = map.rel ? String(row[map.rel] || '') : '';
    const targetUrl = map.targetUrl ? String(row[map.targetUrl] || '') : '';
    const sourceTitle = map.sourceTitle ? String(row[map.sourceTitle] || '') : '';
    const status = map.status ? classifyStatus(String(row[map.status] || '')) : 'active';
    return {
      sourceDomain: sourceDomain.replace(/^www\./, ''),
      sourceUrl,
      dr,
      anchor,
      type: classifyType(type, anchor, sourceDomain),
      rel: classifyRel(rel),
      targetUrl,
      sourceTitle,
      status,
    } as BacklinkRow;
  }).filter((r) => r.sourceDomain || r.sourceUrl);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function analyzeSite(name: string, rows: BacklinkRow[]): SiteAuditData {
  const drs = rows.map((r) => r.dr);
  const avgDR = drs.length ? drs.reduce((a, b) => a + b, 0) / drs.length : 0;
  const medianDR = median(drs);

  const ranges = [
    { range: '0–10', min: 0, max: 10 },
    { range: '11–20', min: 11, max: 20 },
    { range: '21–30', min: 21, max: 30 },
    { range: '31–50', min: 31, max: 50 },
    { range: '51–100', min: 51, max: 100 },
  ];
  const drDistribution = ranges.map((r) => ({
    range: r.range,
    count: drs.filter((d) => d >= r.min && d <= r.max).length,
  }));

  const uniqueDomains = new Set(rows.map((r) => r.sourceDomain.toLowerCase())).size;

  const typeBuckets: Record<string, number> = { text: 0, naked: 0, image: 0, redirect: 0 };
  rows.forEach((r) => { typeBuckets[r.type] = (typeBuckets[r.type] || 0) + 1; });
  const typeLabels: Record<string, string> = {
    text: 'Текстовые', naked: 'Безанкорные', image: 'Изображения', redirect: 'Редиректы',
  };
  const linkTypes = Object.entries(typeBuckets)
    .filter(([, v]) => v > 0)
    .map(([k, v], i) => ({ name: typeLabels[k] || k, value: v, color: TYPE_COLORS[i % TYPE_COLORS.length] }));

  const followCount = rows.filter((r) => r.rel === 'follow').length;
  const nofollowCount = rows.length - followCount;
  const followStats = [
    { name: 'Follow', value: followCount, color: '#10B981' },
    { name: 'Nofollow', value: nofollowCount, color: '#64748B' },
  ].filter((s) => s.value > 0);

  const topicBuckets: Record<string, number> = {};
  rows.forEach((r) => {
    const t = classifyTopic(r.sourceDomain);
    topicBuckets[t] = (topicBuckets[t] || 0) + 1;
  });
  const topicStats = Object.entries(topicBuckets).map(([k, v], i) => ({
    name: k, value: v, color: TYPE_COLORS[i % TYPE_COLORS.length],
  }));

  const pageMap = new Map<string, number>();
  rows.forEach((r) => {
    // Приоритет: URL целевой (наша страница, на которую ведёт ссылка)
    const key = (r.targetUrl && r.targetUrl.trim()) || r.sourceUrl;
    if (!key) return;
    pageMap.set(key, (pageMap.get(key) || 0) + 1);
  });
  const topPages = Array.from(pageMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({ url, count }));

  return {
    name,
    rows,
    totalLinks: rows.length,
    uniqueDomains,
    avgDR: Math.round(avgDR * 10) / 10,
    medianDR: Math.round(medianDR * 10) / 10,
    drDistribution,
    linkTypes,
    followStats,
    topicStats,
    topPages,
    followPct: rows.length ? Math.round((followCount / rows.length) * 100) : 0,
    textPct: rows.length ? Math.round(((typeBuckets.text || 0) / rows.length) * 100) : 0,
  };
}

export const SITE_COLORS = ['#3B82F6', '#F59E0B', '#10B981', '#8B5CF6'];
