export type SiteType =
  | 'СМИ'
  | 'Блог / Инфосайт'
  | 'Корп. сайт'
  | 'Видео'
  | 'Неизвестно'
  | 'UGC'
  | 'Портал'
  | 'Соцсеть'
  | 'Форум'
  | 'Маркетплейс';

export interface IntentRow {
  engine: string;
  position: number;
  url: string;
  domain: string;
  title: string;
  snippet: string;
  siteType: SiteType;
  pageType: string;
}

export type IntentMatrix = Record<string, IntentRow[]>;

export const TYPE_COLORS: Record<SiteType, { bg: string; text: string }> = {
  'СМИ':              { bg: '#FEF3C7', text: '#92400E' },
  'Блог / Инфосайт':  { bg: '#DBEAFE', text: '#1E40AF' },
  'Корп. сайт':       { bg: '#D1FAE5', text: '#065F46' },
  'Видео':            { bg: '#FCE7F3', text: '#9D174D' },
  'Неизвестно':       { bg: '#F3F4F6', text: '#374151' },
  'UGC':              { bg: '#EDE9FE', text: '#5B21B6' },
  'Портал':           { bg: '#CFFAFE', text: '#164E63' },
  'Соцсеть':          { bg: '#FFE4E6', text: '#9F1239' },
  'Форум':            { bg: '#FEE2E2', text: '#991B1B' },
  'Маркетплейс':      { bg: '#FFF7ED', text: '#9A3412' },
};

export function classifyIntent(rows: IntentRow[]): { label: string; hint: string } {
  if (!rows.length) return { label: 'Нет данных', hint: '' };
  const total = rows.length;
  const corp = rows.filter(r => r.siteType === 'Корп. сайт' || r.siteType === 'Маркетплейс').length;
  const info = rows.filter(r => r.siteType === 'Блог / Инфосайт' || r.siteType === 'СМИ' || r.siteType === 'Портал').length;
  const corpShare = corp / total;
  const infoShare = info / total;
  if (corpShare >= 0.6) return { label: 'Коммерческий интент', hint: 'нужна страница услуги/товара' };
  if (infoShare >= 0.6) return { label: 'Информационный интент', hint: 'нужна статья/блог' };
  return { label: 'Смешанный интент', hint: 'нужны оба типа страниц' };
}

export function shortUrl(u: string): string {
  try {
    const x = new URL(u);
    const path = x.pathname.replace(/\/$/, '');
    const tail = path.length > 28 ? path.slice(0, 26) + '…' : path;
    return x.hostname.replace(/^www\./, '') + tail;
  } catch {
    return u;
  }
}