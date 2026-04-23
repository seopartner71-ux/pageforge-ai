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
  'Корп. сайт':       { bg: '#16A34A', text: '#FFFFFF' },
  'Блог / Инфосайт':  { bg: '#3B82F6', text: '#FFFFFF' },
  'СМИ':              { bg: '#EAB308', text: '#1A1A18' },
  'Маркетплейс':      { bg: '#EA580C', text: '#FFFFFF' },
  'Портал':           { bg: '#06B6D4', text: '#FFFFFF' },
  'Видео':            { bg: '#EC4899', text: '#FFFFFF' },
  'Форум':            { bg: '#EF4444', text: '#FFFFFF' },
  'Соцсеть':          { bg: '#8B5CF6', text: '#FFFFFF' },
  'UGC':              { bg: '#6366F1', text: '#FFFFFF' },
  'Неизвестно':       { bg: '#6B7280', text: '#FFFFFF' },
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