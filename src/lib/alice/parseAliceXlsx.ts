import * as XLSX from 'xlsx';

export interface AliceRow {
  query: string;
  frequency: number;
  exactFrequency: number;
  phraseFrequency: number;
  aiAnswer: string;
  sources: string[];
  citations: { idx: string; url: string }[];
  citedDomains: string[];
  brandMentioned: boolean;
  brandCited: boolean;
}

export interface AliceParsed {
  brand: string;
  domain: string;
  rows: AliceRow[];
  totals: {
    queries: number;
    totalFrequency: number;
    totalExact: number;
    brandMentions: number;
    brandCitations: number;
    totalCitations: number;
    visibilityPct: number;
    citationSharePct: number;
  };
  topDomains: { domain: string; count: number; isBrand: boolean }[];
  sourceTypes: { type: string; label: string; count: number }[];
}

const COL_ALIASES: Record<keyof Omit<AliceRow, 'citations' | 'citedDomains' | 'brandMentioned' | 'brandCited'>, string[]> = {
  query: ['запрос', 'query', 'keyword'],
  frequency: ['частотность', 'frequency', 'wordstat'],
  exactFrequency: ['"!частотность"', '!частотность', 'exact'],
  phraseFrequency: ['"[!частотность]"', '[!частотность]', 'phrase'],
  aiAnswer: ['ответ ии', 'ответ', 'answer', 'ai answer'],
  sources: ['источники', 'sources'],
};

function findKey(row: Record<string, any>, aliases: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const a of aliases) {
    const k = keys.find((k) => k.toLowerCase().trim().replace(/\s+/g, ' ') === a);
    if (k) return k;
  }
  for (const a of aliases) {
    const k = keys.find((k) => k.toLowerCase().includes(a));
    if (k) return k;
  }
  return undefined;
}

function extractCitations(markdown: string): { idx: string; url: string }[] {
  if (!markdown) return [];
  // [```N```](url) or [N](url)
  const re = /\[`{0,3}([^\]`]+?)`{0,3}\]\((https?:\/\/[^\s)]+)\)/g;
  const out: { idx: string; url: string }[] = [];
  let m;
  while ((m = re.exec(markdown))) out.push({ idx: m[1].trim(), url: m[2] });
  return out;
}

function urlDomain(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); }
  catch { return ''; }
}

const SOURCE_TYPES: { type: string; label: string; test: RegExp }[] = [
  { type: 'marketplace', label: 'Маркетплейс', test: /ozon|wildberries|amazon|ebay|aliexpress|yandex\.market|sbermegamarket|lamoda|detmir/i },
  { type: 'ugc',         label: 'UGC / Отзывы', test: /reddit|pikabu|quora|otzovik|irecommend|otzyvy|forum/i },
  { type: 'media',       label: 'Медиа / СМИ', test: /vc\.ru|habr|rb\.ru|kp\.ru|forbes|tass|ria|lenta|kommersant|cosmo|elle/i },
  { type: 'aggregator',  label: 'Агрегатор',  test: /sravni|price|compare|2gis|zoon|yell|orgpage/i },
  { type: 'content',     label: 'Контент / Блог', test: /blog|wiki|medium|substack|dzen|livejournal/i },
  { type: 'store',       label: 'Магазин',    test: /shop|store|magazin/i },
  { type: 'brand',       label: 'Бренд / Сайт компании', test: /.*/ },
];

function categorize(domain: string): { type: string; label: string } {
  for (const t of SOURCE_TYPES) if (t.test.test(domain)) return { type: t.type, label: t.label };
  return { type: 'other', label: 'Прочее' };
}

export async function parseAliceXlsx(file: File, brand: string, brandDomain: string): Promise<AliceParsed> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  // Prefer first sheet named "Алиса" / "Alisa" / first
  const sheetName = wb.SheetNames.find((n) => /алис|alis/i.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  const cleanDomain = brandDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();
  const cleanBrand = (brand || '').toLowerCase();

  const rows: AliceRow[] = raw
    .map((r) => {
      const qKey = findKey(r, COL_ALIASES.query);
      const freqKey = findKey(r, COL_ALIASES.frequency);
      const exactKey = findKey(r, COL_ALIASES.exactFrequency);
      const phraseKey = findKey(r, COL_ALIASES.phraseFrequency);
      const aiKey = findKey(r, COL_ALIASES.aiAnswer);
      const srcKey = findKey(r, COL_ALIASES.sources);

      const query = String(qKey ? r[qKey] : '').trim();
      if (!query) return null;

      const frequency = Number(freqKey ? r[freqKey] : 0) || 0;
      const exactFrequency = Number(exactKey ? r[exactKey] : 0) || 0;
      const phraseFrequency = Number(phraseKey ? r[phraseKey] : 0) || 0;
      const aiAnswer = String(aiKey ? r[aiKey] : '');
      const srcText = String(srcKey ? r[srcKey] : '');
      const sources = srcText
        .split(/[\n,;\s]+/)
        .map((s) => s.trim())
        .filter((s) => /^https?:\/\//.test(s));

      const citations = extractCitations(aiAnswer);
      const citedDomains = [...new Set([...citations.map((c) => urlDomain(c.url)), ...sources.map(urlDomain)])].filter(Boolean);

      const lcAnswer = aiAnswer.toLowerCase();
      const brandMentioned =
        (cleanBrand && lcAnswer.includes(cleanBrand)) ||
        citedDomains.some((d) => d.includes(cleanDomain)) ||
        lcAnswer.includes(cleanDomain);
      const brandCited = citedDomains.some((d) => d.includes(cleanDomain));

      return {
        query, frequency, exactFrequency, phraseFrequency,
        aiAnswer, sources, citations, citedDomains,
        brandMentioned, brandCited,
      } as AliceRow;
    })
    .filter((r): r is AliceRow => r !== null);

  // Aggregations
  const totalFrequency = rows.reduce((s, r) => s + r.frequency, 0);
  const totalExact = rows.reduce((s, r) => s + r.exactFrequency, 0);
  const brandMentions = rows.filter((r) => r.brandMentioned).length;
  const brandCitations = rows.reduce((s, r) => s + r.citedDomains.filter((d) => d.includes(cleanDomain)).length, 0);
  const totalCitations = rows.reduce((s, r) => s + r.citedDomains.length, 0);

  // Domain counts
  const domainCount = new Map<string, number>();
  for (const r of rows) {
    for (const d of r.citedDomains) domainCount.set(d, (domainCount.get(d) || 0) + 1);
  }
  const topDomains = [...domainCount.entries()]
    .map(([domain, count]) => ({ domain, count, isBrand: domain.includes(cleanDomain) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 25);

  // Source types
  const typeCount = new Map<string, { type: string; label: string; count: number }>();
  for (const r of rows) {
    for (const d of r.citedDomains) {
      const c = categorize(d);
      const prev = typeCount.get(c.type) || { type: c.type, label: c.label, count: 0 };
      prev.count++;
      typeCount.set(c.type, prev);
    }
  }
  const sourceTypes = [...typeCount.values()].sort((a, b) => b.count - a.count);

  return {
    brand, domain: cleanDomain, rows,
    totals: {
      queries: rows.length,
      totalFrequency,
      totalExact,
      brandMentions,
      brandCitations,
      totalCitations,
      visibilityPct: rows.length ? Math.round((brandMentions / rows.length) * 100) : 0,
      citationSharePct: totalCitations ? Math.round((brandCitations / totalCitations) * 100) : 0,
    },
    topDomains,
    sourceTypes,
  };
}