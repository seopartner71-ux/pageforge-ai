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

function collectAllRemarks(data: AuditData): string {
  const remarks: string[] = [];
  const audit = data.tabData?.technicalAudit || {};
  const tfidf = data.tabData?.tfidf || [];
  const scores = data.scores || {};
  const pageStats = data.tabData?.pageStats || {};

  const title = audit.title || '';
  if (!title) remarks.push('🔴 Title отсутствует на странице');
  else if (title.length < 30) remarks.push(`🟡 Title слишком короткий (${title.length} симв.) — рекомендуется 50-60`);
  else if (title.length > 70) remarks.push(`🟡 Title слишком длинный (${title.length} симв.) — рекомендуется 50-60`);

  const desc = audit.metaDescription || '';
  if (!desc) remarks.push('🔴 Meta Description отсутствует');
  else if (desc.length < 120) remarks.push(`🟡 Description слишком короткий (${desc.length} симв.) — рекомендуется 150-160`);
  else if (desc.length > 170) remarks.push(`🟡 Description слишком длинный (${desc.length} симв.) — рекомендуется 150-160`);

  const h1 = audit.h1Text || '';
  if (!h1) remarks.push('🔴 H1 отсутствует на странице');

  const headings = data.tabData?.headings || [];
  if (headings.length === 0) remarks.push('🟡 Структура заголовков не обнаружена');

  if (!audit.hasJsonLd) remarks.push('🟢 Schema.org разметка (JSON-LD) отсутствует — рекомендуется добавить');
  if (!audit.hasOg) remarks.push('🟢 OpenGraph разметка отсутствует');
  if (!audit.canonical) remarks.push('🟡 Canonical не настроен');
  if (audit.robotsMeta && (audit.robotsMeta.includes('noindex') || audit.robotsMeta.includes('nofollow'))) {
    remarks.push(`🔴 Страница имеет директиву: ${audit.robotsMeta}`);
  }

  const imgCount = audit.imageCount ?? 0;
  const imgNoAlt = audit.imagesWithoutAlt ?? 0;
  if (imgNoAlt > 0) remarks.push(`🟡 Изображения без alt-тегов: ${imgNoAlt} шт`);
  if (imgCount === 0) remarks.push('🟢 Изображения отсутствуют — рекомендуется добавить визуальный контент');

  const wordCount = pageStats.wordCount || 0;
  if (wordCount && wordCount < 300) remarks.push(`🟡 Недостаточно текста: ${wordCount} слов (рекомендуется от 800)`);

  const internalLinks = data.tabData?.internalLinks?.length ?? audit.internalLinkCount ?? 0;
  if (internalLinks < 3) remarks.push(`🟡 Внутренних ссылок: ${internalLinks} (норма 3-5)`);

  const pageSpeed = data.tabData?.pageSpeed || {};
  if (pageSpeed.score && pageSpeed.score < 50) remarks.push(`🟡 Скорость загрузки низкая: ${pageSpeed.score}/100`);

  const stealth = data.tabData?.stealth || {};
  if (stealth.uniqueness !== undefined && stealth.uniqueness < 90) {
    remarks.push(`🟡 Уникальность текста ${stealth.uniqueness}% — ниже нормы, требуется рерайт`);
  }

  if (scores.seoHealth !== undefined && scores.seoHealth < 50) {
    remarks.push(`🔴 Общий SEO Health: ${scores.seoHealth}% — критически низкий`);
  }
  if (scores.llmFriendly !== undefined && scores.llmFriendly < 50) {
    remarks.push(`🟡 LLM-дружелюбность: ${scores.llmFriendly}% — контент плохо оптимизирован для ИИ`);
  }

  const missingKw = tfidf.filter((t: any) => t.status === 'missing' || t.status === 'low').slice(0, 5);
  if (missingKw.length > 0) {
    remarks.push(`🟡 Отсутствуют ключевые слова: ${missingKw.map((t: any) => t.term).join(', ')}`);
  }

  const aiRecs = data.aiReport?.recommendations || [];
  aiRecs.slice(0, 3).forEach((r: string) => remarks.push(`🟢 ${r}`));

  data.quickWins?.slice(0, 3).forEach((qw: any) => {
    const task = qw.task || qw.title || '';
    if (task && !remarks.some((r) => r.includes(task.substring(0, 20)))) {
      const priority = (qw.priority || 'medium') === 'high' ? '🔴' : '🟡';
      remarks.push(`${priority} ${task}`);
    }
  });

  if (remarks.length === 0) remarks.push('🟢 Критических замечаний не обнаружено');
  return remarks.map((r, i) => `${i + 1}. ${r}`).join('\n');
}

function buildHeadingsFactText(data: AuditData): string {
  const headings = data.tabData?.headings || [];
  if (!headings.length) return 'Не обнаружено';
  const counts: Record<string, number> = {};
  headings.forEach((h: any) => {
    const tag = h.tag || h.level || 'H?';
    counts[tag] = (counts[tag] || 0) + 1;
  });
  return Object.entries(counts).map(([k, v]) => `${k}: ${v}`).join(', ');
}

function buildHeadingsRecommendations(data: AuditData): string {
  const recs: string[] = [];
  const headings = data.tabData?.headings || [];
  const h1Count = headings.filter((h: any) => (h.tag || h.level) === 'H1').length;
  if (h1Count === 0) recs.push('Добавить H1');
  else if (h1Count > 1) recs.push(`H1 встречается ${h1Count} раз — должен быть один`);
  if (headings.length < 3) recs.push('Добавить больше подзаголовков (H2-H3)');
  return recs.join('; ') || 'Структура в норме';
}

function buildKeywordsFact(data: AuditData): string {
  const tfidf = data.tabData?.tfidf || [];
  if (!tfidf.length) return 'Нет данных';
  return tfidf.slice(0, 5)
    .map((t: any) => `${t.term} (${typeof t.tfidf === 'number' ? t.tfidf.toFixed(3) : t.tfidf})`)
    .join(', ');
}

function buildKeywordsRecommendations(data: AuditData): string {
  const tfidf = data.tabData?.tfidf || [];
  const missing = tfidf.filter((t: any) => t.status === 'missing' || t.status === 'low');
  if (!missing.length) return 'Ключевые слова в норме';
  return `Добавить: ${missing.slice(0, 5).map((t: any) => t.term).join(', ')}`;
}

function buildInternalLinksFact(data: AuditData): string {
  const links = data.tabData?.internalLinks || [];
  const count = links.length || data.tabData?.technicalAudit?.internalLinkCount || 0;
  return `${count} ссылок`;
}

function buildInternalLinksRecs(data: AuditData): string {
  const count = data.tabData?.internalLinks?.length ?? data.tabData?.technicalAudit?.internalLinkCount ?? 0;
  if (count < 3) return 'Добавить внутреннюю перелинковку (минимум 3-5 ссылок)';
  if (count > 50) return 'Избыточная перелинковка — оставить 15-30 релевантных';
  return 'В норме';
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
