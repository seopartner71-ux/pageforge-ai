import ExcelJS from 'exceljs';

interface AuditData {
  url: string;
  scores: any;
  tabData: any;
  quickWins: any[];
  aiReport: any;
}

function getMonthName(): string {
  const months = [
    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
  ];
  return months[new Date().getMonth()];
}

/** Resolve title from technicalAudit (server uses metaTitle, but support legacy `title`). */
function getCurrentTitle(data: AuditData): string {
  const a = data.tabData?.technicalAudit || {};
  return a.metaTitle || a.title || '';
}

function getCurrentDescription(data: AuditData): string {
  const a = data.tabData?.technicalAudit || {};
  return a.metaDesc || a.metaDescription || '';
}

function getH1(data: AuditData): string {
  const a = data.tabData?.technicalAudit || {};
  if (Array.isArray(a.h1Tags) && a.h1Tags.length) return a.h1Tags[0];
  if (a.h1Text) return a.h1Text;
  // Fallback to first H1 from heading hierarchy
  const headings = data.tabData?.headingHierarchy?.headings || [];
  const firstH1 = headings.find((h: any) => (h.level === 1 || h.tag === 'H1'));
  return firstH1?.text || '';
}

function getRecommendedTitle(data: AuditData): string {
  return (
    data.tabData?.blueprint?.metaTitle ||
    data.tabData?.recommendedTitle ||
    data.aiReport?.recommendedTitle ||
    data.aiReport?.metaTitle ||
    ''
  );
}

function getRecommendedDescription(data: AuditData): string {
  return (
    data.tabData?.blueprint?.metaDescription ||
    data.tabData?.recommendedDescription ||
    data.aiReport?.recommendedDescription ||
    data.aiReport?.metaDescription ||
    ''
  );
}

function getUniqueness(data: AuditData): number | null {
  const s = data.tabData?.stealth || {};
  if (typeof s.uniqueness === 'number') return s.uniqueness;
  if (typeof s.uniquenessScore === 'number') return s.uniquenessScore;
  return null;
}

function uniquenessRecommendation(u: number | null): string {
  if (u === null) return 'Запустите проверку Stealth Engine';
  if (u >= 100) return 'Уникальность в норме';
  if (u >= 90) return 'Рекомендуется улучшить уникальность';
  return 'Требуется рерайт текста';
}

function collectAllRemarks(data: AuditData): string {
  const remarks: string[] = [];
  const audit = data.tabData?.technicalAudit || {};
  const tfidf = data.tabData?.tfidf || [];
  const scores = data.scores || {};
  const pageStats = data.tabData?.pageStats?.target || data.tabData?.pageStats || {};

  const title = getCurrentTitle(data);
  if (!title) remarks.push('🔴 Title отсутствует на странице');
  else if (title.length < 30) remarks.push(`🟡 Title слишком короткий (${title.length} симв.) — рекомендуется 50-60`);
  else if (title.length > 70) remarks.push(`🟡 Title слишком длинный (${title.length} симв.) — рекомендуется 50-60`);

  const desc = getCurrentDescription(data);
  if (!desc) remarks.push('🔴 Meta Description отсутствует');
  else if (desc.length < 120) remarks.push(`🟡 Description слишком короткий (${desc.length} симв.) — рекомендуется 150-160`);
  else if (desc.length > 170) remarks.push(`🟡 Description слишком длинный (${desc.length} симв.) — рекомендуется 150-160`);

  const h1 = getH1(data);
  if (!h1) remarks.push('🔴 H1 отсутствует на странице');

  const hh = data.tabData?.headingHierarchy;
  if (hh?.issues?.length) {
    hh.issues.forEach((iss: string) => remarks.push(`🟡 ${iss}`));
  }

  if (audit.hasJsonLd === false) remarks.push('🟢 Schema.org разметка (JSON-LD) отсутствует — рекомендуется добавить');
  if (audit.hasOpenGraph === false || audit.hasOg === false) remarks.push('🟢 OpenGraph разметка отсутствует');
  if (!audit.canonical) remarks.push('🟡 Canonical не настроен');
  const robots = audit.robotsMeta || data.tabData?.metaDirectives?.metaRobots;
  if (robots && (String(robots).includes('noindex') || String(robots).includes('nofollow'))) {
    remarks.push(`🔴 Страница имеет директиву: ${robots}`);
  }

  const imgNoAlt = audit.imagesWithoutAlt ?? 0;
  if (imgNoAlt > 0) remarks.push(`🟡 Изображения без alt-тегов: ${imgNoAlt} шт`);

  const wordCount = pageStats.wordCount || 0;
  if (wordCount && wordCount < 300) remarks.push(`🟡 Недостаточно текста: ${wordCount} слов (рекомендуется от 800)`);

  const internalLinksCount = getInternalLinksCount(data);
  if (internalLinksCount < 3) remarks.push(`🟡 Внутренних ссылок: ${internalLinksCount} (норма 3-5)`);

  const u = getUniqueness(data);
  if (u !== null && u < 90) remarks.push(`🟡 Уникальность текста ${u}% — ниже нормы, требуется рерайт`);

  if (scores.seoHealth !== undefined && scores.seoHealth < 50) {
    remarks.push(`🔴 Общий SEO Health: ${scores.seoHealth}% — критически низкий`);
  }
  if (scores.llmFriendly !== undefined && scores.llmFriendly < 50) {
    remarks.push(`🟡 LLM-дружелюбность: ${scores.llmFriendly}% — контент плохо оптимизирован для ИИ`);
  }

  const missingKw = tfidf.filter((t: any) => t.status === 'missing' || t.status === 'low' || t.status === 'gap').slice(0, 5);
  if (missingKw.length > 0) {
    remarks.push(`🟡 Отсутствуют ключевые слова: ${missingKw.map((t: any) => t.term).join(', ')}`);
  }

  const aiRecs = data.tabData?.aiReport?.recommendations || data.aiReport?.recommendations || [];
  aiRecs.slice(0, 3).forEach((r: string) => remarks.push(`🟢 ${r}`));

  data.quickWins?.slice(0, 3).forEach((qw: any) => {
    const task = qw.task || qw.title || qw.text || '';
    if (task && !remarks.some((r) => r.includes(task.substring(0, 20)))) {
      const priority = (qw.priority || 'medium') === 'high' ? '🔴' : '🟡';
      remarks.push(`${priority} ${task}`);
    }
  });

  if (remarks.length === 0) remarks.push('🟢 Критических замечаний не обнаружено');
  return remarks.map((r, i) => `${i + 1}. ${r}`).join('\n');
}

function buildHeadingsFactText(data: AuditData): string {
  const counts = data.tabData?.headingHierarchy?.counts;
  if (counts) {
    const parts: string[] = [];
    (['h1','h2','h3','h4','h5','h6'] as const).forEach(k => {
      const v = counts[k];
      if (v && v > 0) parts.push(`${k.toUpperCase()}: ${v}шт`);
    });
    return parts.length ? parts.join(', ') : 'Не обнаружено';
  }
  // Legacy fallback
  const headings = data.tabData?.headings || data.tabData?.headingHierarchy?.headings || [];
  if (!headings.length) return 'Не обнаружено';
  const counts2: Record<string, number> = {};
  headings.forEach((h: any) => {
    const tag = h.tag || (h.level ? `H${h.level}` : 'H?');
    counts2[tag] = (counts2[tag] || 0) + 1;
  });
  return Object.entries(counts2).map(([k, v]) => `${k}: ${v}шт`).join(', ');
}

function buildHeadingsRecommendations(data: AuditData): string {
  const hh = data.tabData?.headingHierarchy;
  const recs: string[] = [];
  if (hh) {
    const h1 = hh.counts?.h1 ?? 0;
    if (h1 === 0) recs.push('H1 отсутствует');
    else if (h1 > 1) recs.push('Несколько H1 на странице');
    if (hh.issues?.some((i: string) => /пропуск|skip/i.test(i))) recs.push('Пропуск уровней заголовков');
    if ((hh.counts?.h2 ?? 0) < 2) recs.push('Добавить больше H2 подзаголовков');
  }
  return recs.join('; ') || 'Структура в норме';
}

function buildKeywordsFact(data: AuditData): string {
  const tfidf = data.tabData?.tfidf || [];
  if (!tfidf.length) return 'Нет данных';
  return tfidf.slice(0, 5).map((t: any) => t.term).join(', ');
}

function buildKeywordsRecommendations(data: AuditData): string {
  const tfidf = data.tabData?.tfidf || [];
  const missing = tfidf.filter((t: any) => t.status === 'missing' || t.status === 'low' || t.status === 'gap');
  if (!missing.length) {
    // Try priorities (Content category)
    const prio = data.tabData?.priorities || [];
    const contentTask = prio.find((p: any) => /keyword|ключев|content|контент/i.test(p.category || '') && /keyword|ключев|term|слов/i.test(p.task || ''));
    if (contentTask) return contentTask.task;
    return 'Ключевые слова в норме';
  }
  return `Дефицит: ${missing.slice(0, 5).map((t: any) => t.term).join(', ')}`;
}

function getInternalLinksCount(data: AuditData): number {
  const il = data.tabData?.internalLinking;
  if (il && typeof il.internalCount === 'number') return il.internalCount;
  if (il && Array.isArray(il.internal)) return il.internal.length;
  const anchors = data.tabData?.anchorsData || [];
  if (Array.isArray(anchors) && anchors.length) {
    let baseDomain = '';
    try { baseDomain = new URL(data.url).hostname.replace(/^www\./, ''); } catch {}
    return anchors.filter((a: any) => {
      const href = a.href || '';
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
      try {
        const h = new URL(href, data.url).hostname.replace(/^www\./, '');
        return h === baseDomain;
      } catch { return href.startsWith('/'); }
    }).length;
  }
  const links = data.tabData?.internalLinks;
  if (Array.isArray(links)) return links.length;
  return data.tabData?.technicalAudit?.internalLinkCount ?? data.tabData?.pageStats?.target?.linkCount ?? 0;
}

function buildInternalLinksFact(data: AuditData): string {
  return `${getInternalLinksCount(data)} внутренних ссылок`;
}

function buildInternalLinksRecs(data: AuditData): string {
  const count = getInternalLinksCount(data);
  if (count < 3) return 'Добавить внутреннюю перелинковку (минимум 3-5 ссылок)';
  if (count > 50) return 'Избыточная перелинковка — оставить 15-30 релевантных';
  return 'В норме';
}

function buildContentComment(data: AuditData): string {
  // Prefer the first AI recommendation / priority as main takeaway
  const aiRecs = data.tabData?.aiReport?.recommendations || data.aiReport?.recommendations || [];
  if (aiRecs.length) return String(aiRecs[0]);
  const summary = data.tabData?.aiReport?.summary || data.aiReport?.summary;
  if (summary) {
    const s = String(summary).split(/\n\n|\.\s/)[0];
    return s.length > 250 ? s.slice(0, 250) + '…' : s;
  }
  const prio = data.tabData?.priorities || [];
  if (prio.length) return prio[0].task || '';
  // Fallback to scores summary
  const parts: string[] = [];
  const wc = data.tabData?.pageStats?.target?.wordCount;
  if (wc) parts.push(`Слов: ${wc}`);
  if (data.scores?.seoHealth !== undefined) parts.push(`SEO: ${data.scores.seoHealth}%`);
  if (data.scores?.llmFriendly !== undefined) parts.push(`LLM: ${data.scores.llmFriendly}%`);
  return parts.join(' | ') || '—';
}


const ORANGE = 'FFE8834A';
const NAVY = 'FF1F3864';
const SUBHEADER_GRAY = 'FFF2F2F2';
const ALT_ROW = 'FFF9F9F9';
const WHITE = 'FFFFFFFF';
const RED_BG = 'FFFFE0E0';
const YELLOW_BG = 'FFFFF3CD';
const GREEN_BG = 'FFD4EDDA';
const BORDER_GRAY = 'FFD9D9D9';

const thinBorder = {
  top: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  left: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  bottom: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
  right: { style: 'thin' as const, color: { argb: BORDER_GRAY } },
};

export async function exportSeoAuditXlsx(data: AuditData): Promise<void> {
  const audit = data.tabData?.technicalAudit || {};
  const stealth = data.tabData?.stealth || {};
  const domain = (() => {
    try { return new URL(data.url).hostname; } catch { return 'site'; }
  })();
  const dateStr = new Date().toISOString().slice(0, 10);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'PageForge SEO-Audit';
  wb.created = new Date();
  const ws = wb.addWorksheet(getMonthName(), {
    views: [{ state: 'frozen', ySplit: 2 }],
  });

  // Column widths
  const widths = [5, 20, 35, 40, 40, 40, 40, 15, 25, 25, 25, 25, 25, 40, 20, 25, 10, 10, 60];
  widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // ============ ROW 1: group headers ============
  const row1Values = [
    '№', 'Название страницы', 'URL',
    'Мета-данные Title', '',
    'Мета-данные Description', '',
    'Текст Уникальность', '',
    'Вхождения ключевых слов', '',
    'Структура заголовков', '',
    'Комментарии по контенту',
    'Перелинковка со страницы', '',
    'Позиции', '',
    'Все замечания и рекомендации',
  ];
  ws.getRow(1).values = row1Values;
  ws.getRow(1).height = 32;

  // Merges row 1
  ws.mergeCells('D1:E1');
  ws.mergeCells('F1:G1');
  ws.mergeCells('H1:I1');
  ws.mergeCells('J1:K1');
  ws.mergeCells('L1:M1');
  ws.mergeCells('O1:P1');
  ws.mergeCells('Q1:R1');

  // Style row 1 — orange except column S (navy)
  for (let c = 1; c <= 19; c++) {
    const cell = ws.getCell(1, c);
    const isS = c === 19;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isS ? NAVY : ORANGE },
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: WHITE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // ============ ROW 2: sub-headers ============
  const row2Values = [
    '', '', '',
    'До', 'После',
    'До', 'После',
    'Факт (%)', 'Рекомендации',
    'Факт', 'Рекомендации',
    'Факт', 'Рекомендации',
    '',
    'Факт', 'Рекомендации',
    'До', 'После',
    '',
  ];
  ws.getRow(2).values = row2Values;
  ws.getRow(2).height = 22;

  for (let c = 1; c <= 19; c++) {
    const cell = ws.getCell(2, c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: SUBHEADER_GRAY },
    };
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF333333' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = thinBorder;
  }

  // ============ DATA ROW(S) ============
  const uniquenessRaw = stealth.uniqueness;
  const uniquenessFact: number | string = typeof uniquenessRaw === 'number' ? uniquenessRaw : '';
  const uniquenessRec = (() => {
    const u = uniquenessRaw;
    if (u === undefined || u === null) return 'Нет данных';
    if (u >= 100) return 'Отличная уникальность';
    if (u >= 90) return 'Уникальность в норме';
    return `Уникальность ${u}% — требуется рерайт`;
  })();

  const contentComment = (() => {
    const parts: string[] = [];
    const wc = data.tabData?.pageStats?.wordCount;
    if (wc) parts.push(`Слов: ${wc}`);
    if (data.scores?.seoHealth !== undefined) parts.push(`SEO: ${data.scores.seoHealth}%`);
    if (data.scores?.llmFriendly !== undefined) parts.push(`LLM: ${data.scores.llmFriendly}%`);
    if (data.scores?.humanTouch !== undefined) parts.push(`Human: ${data.scores.humanTouch}%`);
    return parts.join(' | ') || '—';
  })();

  const titleAfter = data.tabData?.recommendedTitle || data.aiReport?.recommendedTitle || '';
  const descAfter = data.tabData?.recommendedDescription || data.aiReport?.recommendedDescription || '';
  const pageName = audit.h1Text || audit.title || domain;

  const dataRow = [
    1,
    pageName,
    data.url,
    audit.title || '',
    titleAfter,
    audit.metaDescription || '',
    descAfter,
    uniquenessFact,
    uniquenessRec,
    buildKeywordsFact(data),
    buildKeywordsRecommendations(data),
    buildHeadingsFactText(data),
    buildHeadingsRecommendations(data),
    contentComment,
    buildInternalLinksFact(data),
    buildInternalLinksRecs(data),
    '', '',
    collectAllRemarks(data),
  ];

  const rowIdx = 3;
  ws.getRow(rowIdx).values = dataRow;
  ws.getRow(rowIdx).height = 240;

  for (let c = 1; c <= 19; c++) {
    const cell = ws.getCell(rowIdx, c);
    cell.font = { name: 'Arial', size: 10 };
    cell.alignment = {
      horizontal: c === 1 || c === 8 ? 'center' : 'left',
      vertical: 'top',
      wrapText: true,
    };
    cell.border = thinBorder;
    // Alternating row baseline (single data row → white, but pattern set for future expansion)
    const isAlt = (rowIdx % 2) === 0;
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: isAlt ? ALT_ROW : WHITE },
    };
  }

  // URL hyperlink (column C)
  const urlCell = ws.getCell(rowIdx, 3);
  urlCell.value = { text: data.url, hyperlink: data.url };
  urlCell.font = { name: 'Arial', size: 10, color: { argb: 'FF2563EB' }, underline: true };

  // Conditional formatting for uniqueness (column H = 8)
  if (typeof uniquenessRaw === 'number') {
    const uCell = ws.getCell(rowIdx, 8);
    let bg = WHITE;
    if (uniquenessRaw >= 100) bg = GREEN_BG;
    else if (uniquenessRaw >= 90) bg = YELLOW_BG;
    else bg = RED_BG;
    uCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
    uCell.numFmt = '0"%"';
  }

  // Number format for column A
  ws.getCell(rowIdx, 1).numFmt = '0';

  // ============ DOWNLOAD ============
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${domain}__SEO-Аудит_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
