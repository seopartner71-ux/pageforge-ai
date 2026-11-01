export type ModuleConfig = { id: string; title: string; desc: string; cta: string };

/** Route path → module served by the `analyze-module` function. */
export const MODULE_BY_PATH: Record<string, ModuleConfig> = {
  '/analytics/demand/commercial': { id: 'demand-commercial', title: 'Спрос с высокой коммерческой ценностью', desc: 'Денежные кластеры, близость к покупке, ценность лида и конкуренция за деньги.', cta: 'Найти коммерческий спрос' },
  '/analytics/audience/journey': { id: 'audience-journey', title: 'Запросы по этапам пути покупателя', desc: 'Какие запросы задают на каждом этапе — от осознания проблемы до повторной покупки.', cta: 'Построить карту запросов' },
  '/analytics/audience/journey-v2': { id: 'audience-journey-v2', title: 'Карта пути покупателя (v2.1)', desc: 'Этапы, триггеры, барьеры, точки контакта, эмоции и нужные доказательства.', cta: 'Построить карту пути' },
  '/analytics/audience/language': { id: 'audience-language', title: 'Карта языка и терминов ниши', desc: 'Как говорит клиент и как говорит эксперт: синонимы, жаргон, ошибочные написания.', cta: 'Составить словарь' },
  '/analytics/audience/community': { id: 'audience-community', title: 'Живой язык и сигналы сообщества', desc: 'Где обсуждают нишу, частые вопросы, жалобы, мифы и живые фразы.', cta: 'Изучить сообщество' },
  '/analytics/ai/formats': { id: 'ai-formats', title: 'Форматы контента под спрос', desc: 'Какой формат выигрывает выдачу и ИИ-ответы по каждому кластеру.', cta: 'Подобрать форматы' },
  '/analytics/competition/serp-reality': { id: 'serp-reality', title: 'Реальная конкурентность выдачи', desc: 'Кто в ТОП, давление агрегаторов и ИИ-ответов, где выдача слабая.', cta: 'Оценить выдачу' },
  '/analytics/ai/ecosystem': { id: 'ai-ecosystem', title: 'Платформы и внешняя среда', desc: 'Маркетплейсы, карты, отзовики, соцсети: где нужно присутствие и что это даёт.', cta: 'Разобрать площадки' },
  '/analytics/competition/linkability': { id: 'linkability', title: 'Потенциал естественных ссылок', desc: 'Какие материалы собирают ссылки, кто доноры, поводы для PR.', cta: 'Оценить потенциал' },
  '/analytics/ai/eeat': { id: 'eeat', title: 'Требования к доверию (E-E-A-T)', desc: 'Авторы, доказательства опыта, лицензии, коммерческие факторы, красные флаги.', cta: 'Определить требования' },
  '/analytics/ai/entities': { id: 'entities', title: 'Карта сущностей ниши', desc: 'Ключевые сущности, их атрибуты и связи для тематической полноты.', cta: 'Построить карту сущностей' },
  '/analytics/ai/risks': { id: 'risks', title: 'Регуляторные и репутационные риски', desc: 'Законы, репутация, санкции поисковиков, риски ИИ-текстов — и как их снизить.', cta: 'Найти риски' },
  '/analytics/ai/search': { id: 'ai-search', title: 'Возможности в ИИ-поиске', desc: 'Где стать цитируемым источником в Нейро, AI Overviews и ChatGPT, и где защищать клики.', cta: 'Найти возможности' },
};

export type ModuleReport = {
  scores: { label: string; value: number; comment?: string }[];
  verdict: { overview?: string; main_opportunity?: string; main_risk?: string; strategy?: string };
  top_lists: { title: string; items: string[] }[];
  table: { title: string; columns: string[]; rows: string[][] };
  roadmap: { phase: string; actions: string[] }[];
};

const arr = (v: any) => (Array.isArray(v) ? v : []);

export function normalizeReport(r: any): ModuleReport | null {
  if (!r || typeof r !== 'object') return null;
  const cols = arr(r.table?.columns).map(String);
  const out: ModuleReport = {
    scores: arr(r.scores).map((s: any) => ({ label: String(s?.label ?? ''), value: Math.max(0, Math.min(100, Number(s?.value) || 0)), comment: s?.comment ? String(s.comment) : undefined })),
    verdict: r.verdict && typeof r.verdict === 'object' ? r.verdict : {},
    top_lists: arr(r.top_lists).map((l: any) => ({ title: String(l?.title ?? ''), items: arr(l?.items).map(String) })),
    table: { title: String(r.table?.title ?? ''), columns: cols, rows: arr(r.table?.rows).map((row: any) => arr(row).map((c: any) => String(c ?? ''))) },
    roadmap: arr(r.roadmap).map((p: any) => ({ phase: String(p?.phase ?? ''), actions: arr(p?.actions).map(String) })),
  };
  if (!out.scores.length && !out.table.rows.length && !out.top_lists.length) return null;
  return out;
}
