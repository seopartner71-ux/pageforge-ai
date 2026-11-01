import * as XLSX from 'xlsx';
import type { AuditResult } from './engine';

export interface AiReport {
  verdict?: string; score?: number;
  findings?: { title: string; details: string; severity?: string }[];
  recommendations?: { priority: string; title: string; details: string; effect?: string }[];
  quick_wins?: string[];
}

export function exportInternalLinksXlsx(r: AuditResult, ai: AiReport | null, fileBase: string) {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ '': 'нет данных' }]);
    const keys = Object.keys(rows[0] ?? { '': '' });
    ws['!cols'] = keys.map((k) => ({ wch: Math.min(60, Math.max(10, k.length + 2, ...rows.slice(0, 60).map((x) => String(x[k] ?? '').length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  };
  const s = r.summary;
  add('Сводка', [
    ['Страниц (200, HTML)', s.pages], ['Страниц без входящих (сироты)', s.orphans], ['Страниц без ссылок из текста', s.noTextLinks],
    ['Ссылок на редиректы (уник. целей)', s.redirectTargets], ['Ссылок на битые (уник. целей)', s.brokenTargets],
    ['Конфликтов анкоров', s.anchorConflicts], ['Пар каннибализации (по GSC)', s.cannibal ?? 'нет данных'],
    ['Кандидатов на ссылку статья→услуга', s.candidates], ['Данные GSC подключены', r.hasGsc ? 'да' : 'нет'],
    ["Ссылок шаблона (меню/виджеты) исключено из 'текста'", s.templateLinks],
  ].map(([k, v]) => ({ 'Показатель': k, 'Значение': v })));
  if (ai) {
    const rows: Record<string, unknown>[] = [{ 'Раздел': 'Вывод', 'Приоритет': ai.score != null ? `Оценка ${ai.score}/100` : '', 'Текст': ai.verdict ?? '' }];
    (ai.findings ?? []).forEach((f) => rows.push({ 'Раздел': 'Вывод', 'Приоритет': f.severity ?? '', 'Текст': `${f.title}: ${f.details}` }));
    (ai.recommendations ?? []).forEach((f) => rows.push({ 'Раздел': 'Рекомендация', 'Приоритет': f.priority, 'Текст': `${f.title}: ${f.details}${f.effect ? ` Эффект: ${f.effect}` : ''}` }));
    (ai.quick_wins ?? []).forEach((q) => rows.push({ 'Раздел': 'Быстрая победа', 'Приоритет': '', 'Текст': q }));
    add('Выводы ИИ', rows);
  }
  add('План (приоритеты)', r.plan.map((p) => ({ 'Приоритет': p.priority, 'Действие': p.action, 'Страница': p.page, 'Основание': p.reason })));
  add('По типам страниц', r.byType.map((t) => ({ type: t.type, 'страниц': t.pages, 'pr_сред': t.prAvg, 'вх_из_текста': t.inTextAvg, 'без_ссылок_из_текста': t.noText, 'глубина_SF': t.depthAvg })));
  add('Страницы', r.pages.map((p) => ({ url: p.url, type: p.type, title: p.title, h1: p.h1, words: p.words, depth: p.depth, in_all: p.in_all, in_text: p.in_text,
    out_text: p.out_text, pr_all: +p.pr_all.toFixed(3), pr_text: +p.pr_text.toFixed(3), ...(r.hasGsc ? { clicks: p.clicks, impr: p.impr, pos: p.pos } : {}) })));
  add('Кандидаты на ссылки', r.candidates.map((c) => ({ 'Откуда (статья)': c.src, 'H1 статьи': c.srcH1, 'Куда (услуга)': c.dst, 'H1 услуги': c.dstH1,
    'Близость': c.sim, 'Анкор (предложение)': c.anchor, 'Пометка': c.duplicate ? 'возможный дубль — проверить каннибализацию' : '' })));
  add('Каннибализация (GSC)', r.cannibal.map((c) => ({ 'Запрос': c.query, 'Показы всего': c.impr, 'Страниц в выдаче': c.pages, 'Основная': c.main,
    'Поз. осн.': c.mainPos, 'Конкурент': c.rival, 'Поз. конк.': c.rivalPos, 'Доля конкурента': c.rivalShare })));
  add('Сироты', r.orphans);
  add('Без ссылок из текста', r.noText);
  const grp = (g: AuditResult['redirects']) => g.map((x) => ({ dst: x.dst, code: x.code, 'ссылок': x.links, 'примеры': x.examples.join(', ') }));
  add('Ссылки на редиректы', grp(r.redirects));
  add('Ссылки на битые', grp(r.broken));
  add('Конфликты анкоров', r.conflicts.map((c) => ({ 'Анкор': c.anchor, 'Ведёт на разных страниц': c.targets, 'Цели (кол-во ссылок)': c.detail.map((d) => `${d.url} (${d.count})`).join(' | ') })));
  XLSX.writeFile(wb, `${fileBase}.xlsx`);
}
