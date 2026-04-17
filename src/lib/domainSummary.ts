import Papa from 'papaparse';

export interface DomainSummaryRow {
  domain: string;
  top10: number;
  top50: number;
  traffic: number;
  backlinks: number;
  refDomains: number;
  outDomains: number;
  outLinks: number;
  dr: number;
  refIps: number;
}

const FIELD_MAP: Record<keyof DomainSummaryRow, string[]> = {
  domain: ['домен', 'domain', 'site'],
  top10: ['в топ 10', 'топ 10', 'top 10', 'top10'],
  top50: ['в топ 50', 'топ 50', 'top 50', 'top50'],
  traffic: ['трафик', 'traffic', 'organic traffic'],
  backlinks: ['обратные ссылки', 'backlinks', 'ссылки'],
  refDomains: ['ссылающихся доменов', 'ссылающиеся домены', 'referring domains', 'ref domains'],
  outDomains: ['исходящих доменов', 'исходящие домены', 'outgoing domains'],
  outLinks: ['исходящие ссылки', 'outgoing links', 'external links'],
  dr: ['dr', 'domain rating', 'доменный рейтинг'],
  refIps: ['ссылающихся ip', 'ссылающиеся ip', 'referring ips', 'ref ips'],
};

function findKey(headers: string[], aliases: string[]): string | undefined {
  const lower = headers.map((h) => h.trim().toLowerCase());
  for (const alias of aliases) {
    const idx = lower.indexOf(alias);
    if (idx >= 0) return headers[idx];
  }
  for (const alias of aliases) {
    const idx = lower.findIndex((h) => h.includes(alias));
    if (idx >= 0) return headers[idx];
  }
  return undefined;
}

const num = (v: any): number => {
  if (v == null) return 0;
  const s = String(v).replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

const cleanDomain = (s: string) =>
  String(s || '').trim().replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

export function parseDomainSummaryCsv(text: string): DomainSummaryRow[] {
  const clean = text.replace(/^\uFEFF/, '');
  const parsed = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    delimitersToGuess: [';', ',', '\t', '|'],
  });
  const headers = parsed.meta.fields || [];
  if (!headers.length) return [];

  const map: Record<keyof DomainSummaryRow, string | undefined> = {
    domain: findKey(headers, FIELD_MAP.domain),
    top10: findKey(headers, FIELD_MAP.top10),
    top50: findKey(headers, FIELD_MAP.top50),
    traffic: findKey(headers, FIELD_MAP.traffic),
    backlinks: findKey(headers, FIELD_MAP.backlinks),
    refDomains: findKey(headers, FIELD_MAP.refDomains),
    outDomains: findKey(headers, FIELD_MAP.outDomains),
    outLinks: findKey(headers, FIELD_MAP.outLinks),
    dr: findKey(headers, FIELD_MAP.dr),
    refIps: findKey(headers, FIELD_MAP.refIps),
  };

  return (parsed.data || [])
    .map((row) => ({
      domain: cleanDomain(map.domain ? row[map.domain] : ''),
      top10: num(map.top10 && row[map.top10]),
      top50: num(map.top50 && row[map.top50]),
      traffic: num(map.traffic && row[map.traffic]),
      backlinks: num(map.backlinks && row[map.backlinks]),
      refDomains: num(map.refDomains && row[map.refDomains]),
      outDomains: num(map.outDomains && row[map.outDomains]),
      outLinks: num(map.outLinks && row[map.outLinks]),
      dr: num(map.dr && row[map.dr]),
      refIps: num(map.refIps && row[map.refIps]),
    }))
    .filter((r) => r.domain);
}
