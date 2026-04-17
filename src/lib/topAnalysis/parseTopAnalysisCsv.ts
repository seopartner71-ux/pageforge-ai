import Papa from 'papaparse';

export interface TopRow {
  query: string;
  domain: string;
  url: string;
  position: number;
}

const HEADER_MAP: Record<string, keyof TopRow> = {
  'запрос': 'query',
  'query': 'query',
  'keyword': 'query',
  'домен': 'domain',
  'domain': 'domain',
  'url': 'url',
  'ссылка': 'url',
  'позиция': 'position',
  'position': 'position',
  'pos': 'position',
};

function toInt(v: any): number {
  if (v === null || v === undefined || v === '') return 0;
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

// Извлекает чистый домен из URL/строки
export function normalizeDomain(raw: string): string {
  if (!raw) return '';
  let s = raw.trim().toLowerCase();
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.split('/')[0];
  return s;
}

export interface TopParseResult {
  rows: TopRow[];
  errors: string[];
}

export function parseTopAnalysisCsv(text: string): Promise<TopParseResult> {
  return new Promise((resolve) => {
    Papa.parse<Record<string, string>>(text, {
      delimiter: ';',
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase(),
      complete: (res) => {
        const errors: string[] = [];
        const rows: TopRow[] = [];

        for (const raw of res.data) {
          const row: TopRow = { query: '', domain: '', url: '', position: 0 };
          for (const [header, value] of Object.entries(raw)) {
            const key = HEADER_MAP[header];
            if (!key) continue;
            if (key === 'position') {
              row.position = toInt(value);
            } else {
              (row as any)[key] = String(value || '').trim();
            }
          }
          // Если домен не задан — пробуем достать из URL
          if (!row.domain && row.url) row.domain = normalizeDomain(row.url);
          else row.domain = normalizeDomain(row.domain);

          if (row.query && row.domain && row.position > 0) rows.push(row);
        }

        if (rows.length === 0) {
          errors.push('Не найдено валидных строк. Проверьте формат CSV (разделитель «;», UTF-8) и колонки: Запрос, Домен, URL, Позиция.');
        }
        resolve({ rows, errors });
      },
      error: (err: any) => {
        resolve({ rows: [], errors: [err?.message || 'Ошибка парсинга CSV'] });
      },
    });
  });
}
