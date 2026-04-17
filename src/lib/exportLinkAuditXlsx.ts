import * as XLSX from 'xlsx';
import type { SiteAuditData } from './linkAudit';

export function exportLinkAuditXlsx(sites: SiteAuditData[]) {
  const wb = XLSX.utils.book_new();

  // Лист 1 — Сводная таблица
  const header = ['Показатель', ...sites.map((s) => s.name)];
  const rows = [
    ['Доменный рейтинг (средний)', ...sites.map((s) => s.avgDR)],
    ['Доменный рейтинг (медиана)', ...sites.map((s) => s.medianDR)],
    ['Уникальные ссылки', ...sites.map((s) => s.totalLinks)],
    ['Ссылающиеся домены', ...sites.map((s) => s.uniqueDomains)],
    ['% follow ссылок', ...sites.map((s) => `${s.followPct}%`)],
    ['% текстовых ссылок', ...sites.map((s) => `${s.textPct}%`)],
  ];
  const summary = XLSX.utils.aoa_to_sheet([header, ...rows]);
  summary['!cols'] = [{ wch: 32 }, ...sites.map(() => ({ wch: 24 }))];
  XLSX.utils.book_append_sheet(wb, summary, 'Сводная');

  // Листы 2-5 — детальные данные
  sites.forEach((site, idx) => {
    const detail = [
      ['Домен источник', 'URL источник', 'DR', 'Анкор', 'Тип', 'Атрибуты'],
      ...site.rows.map((r) => [r.sourceDomain, r.sourceUrl, r.dr, r.anchor, r.type, r.rel]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(detail);
    ws['!cols'] = [{ wch: 28 }, { wch: 50 }, { wch: 6 }, { wch: 35 }, { wch: 14 }, { wch: 12 }];
    const safeName = site.name.replace(/[\\\/\?\*\[\]:]/g, '_').slice(0, 28);
    XLSX.utils.book_append_sheet(wb, ws, `${idx + 1}. ${safeName}`.slice(0, 31));
  });

  const date = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Ссылочный_аудит_${date}.xlsx`);
}
