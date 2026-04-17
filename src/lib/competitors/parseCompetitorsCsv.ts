import Papa from 'papaparse';

export interface CompetitorRow {
  domain: string;
  top1: number;
  top3: number;
  top5: number;
  top10: number;
  top50: number;
  aliceMentions: number;
  pages: number;
  byVisibility: number;
  keysCoverage: number;
  reqPerPage: number;
  effectiveness: number;
  visibility: number;
  traffic: number;
  ads: number;
  contextRequests: number;
  reqPerAd: number;
  contextTraffic: number;
  contextBudget: number;
}

export const COMPETITOR_COLUMNS: { key: keyof CompetitorRow; label: string; numeric: boolean; higherIsBetter?: boolean }[] = [
  { key: 'domain', label: 'Домен', numeric: false },
  { key: 'top1', label: 'В топ 1', numeric: true, higherIsBetter: true },
  { key: 'top3', label: 'В топ 3', numeric: true, higherIsBetter: true },
  { key: 'top5', label: 'В топ 5', numeric: true, higherIsBetter: true },
  { key: 'top10', label: 'В топ 10', numeric: true, higherIsBetter: true },
  { key: 'top50', label: 'В топ 50', numeric: true, higherIsBetter: true },
  { key: 'aliceMentions', label: 'Упоминания в Алисе', numeric: true, higherIsBetter: true },
  { key: 'pages', label: 'Страниц', numeric: true, higherIsBetter: true },
  { key: 'byVisibility', label: 'По видимости', numeric: true, higherIsBetter: true },
  { key: 'keysCoverage', label: 'По охвату ключей', numeric: true, higherIsBetter: true },
  { key: 'reqPerPage', label: 'Запросов на страницу', numeric: true, higherIsBetter: true },
  { key: 'effectiveness', label: 'Результативность', numeric: true, higherIsBetter: true },
  { key: 'visibility', label: 'Видимость', numeric: true, higherIsBetter: true },
  { key: 'traffic', label: 'Трафик', numeric: true, higherIsBetter: true },
  { key: 'ads', label: 'Объявлений', numeric: true, higherIsBetter: true },
  { key: 'contextRequests', label: 'Запросов в контексте', numeric: true, higherIsBetter: true },
  { key: 'reqPerAd', label: 'Запросов на объявление', numeric: true, higherIsBetter: true },
  { key: 'contextTraffic', label: 'Трафик в контексте', numeric: true, higherIsBetter: true },
  { key: 'contextBudget', label: 'Бюджет в контексте', numeric: true, higherIsBetter: false }, // ниже = лучше
];

const HEADER_MAP: Record<string, keyof CompetitorRow> = {
  'домен': 'domain',
  'domain': 'domain',
  'в топ 1': 'top1',
  'в топ 3': 'top3',
  'в топ 5': 'top5',
  'в топ 10': 'top10',
  'в топ 50': 'top50',
  'упоминания в алисе': 'aliceMentions',
  'страниц': 'pages',
  'по видимости': 'byVisibility',
  'по охвату ключей': 'keysCoverage',
  'запросов на страницу': 'reqPerPage',
  'результативность': 'effectiveness',
  'видимость': 'visibility',
  'трафик': 'traffic',
  'объявлений': 'ads',
  'запросов в контексте': 'contextRequests',
  'запросов на объявление': 'reqPerAd',
  'трафик в контексте': 'contextTraffic',
  'бюджет в контексте': 'contextBudget',
};

function toNumber(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export interface ParseResult {
  rows: CompetitorRow[];
  errors: string[];
}

export function parseCompetitorsCsv(text: string): Promise<ParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const errors: string[] = [];
        const rows: CompetitorRow[] = [];

        for (const raw of res.data) {
          const row: any = {
            domain: '', top1: 0, top3: 0, top5: 0, top10: 0, top50: 0,
            aliceMentions: 0, pages: 0, byVisibility: 0, keysCoverage: 0,
            reqPerPage: 0, effectiveness: 0, visibility: 0, traffic: 0,
            ads: 0, contextRequests: 0, reqPerAd: 0, contextTraffic: 0, contextBudget: 0,
          };
          for (const [header, value] of Object.entries(raw)) {
            const key = HEADER_MAP[header];
            if (!key) continue;
            if (key === 'domain') {
              row[key] = String(value || '').trim();
            } else {
              row[key] = toNumber(value);
            }
          }
          if (row.domain) rows.push(row);
        }

        if (rows.length === 0) {
          errors.push('Не найдено ни одной строки. Проверьте формат CSV (разделитель «;», UTF-8) и колонку «Домен».');
        }

        resolve({ rows, errors });
      },
      error: (err: any) => {
        resolve({ rows: [], errors: [err?.message || 'Ошибка парсинга CSV'] });
      },
    });
  });
}
