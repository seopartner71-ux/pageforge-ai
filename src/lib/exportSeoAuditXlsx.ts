import * as XLSX from 'xlsx';

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

  // Title checks
  const title = audit.title || '';
  if (!title) {
    remarks.push('🔴 Title отсутствует на странице');
  } else if (title.length < 30) {
    remarks.push(`🟡 Title слишком короткий (${title.length} символов) — рекомендуется 50-60`);
  } else if (title.length > 70) {
    remarks.push(`🟡 Title слишком длинный (${title.length} символов) — рекомендуется 50-60`);
  }

  // Meta description checks
  const desc = audit.metaDescription || '';
  if (!desc) {
    remarks.push('🔴 Meta Description отсутствует');
  } else if (desc.length < 120) {
    remarks.push(`🟡 Description слишком короткий (${desc.length} символов) — рекомендуется 150-160`);
  } else if (desc.length > 170) {
    remarks.push(`🟡 Description слишком длинный (${desc.length} символов) — рекомендуется 150-160`);
  }

  // H1 check
  const h1 = audit.h1Text || '';
  if (!h1) {
    remarks.push('🔴 H1 отсутствует на странице');
  }

  // Heading hierarchy
  const headings = data.tabData?.headings || [];
  if (headings.length === 0) {
    remarks.push('🟡 Структура заголовков не обнаружена');
  }

  // Schema / JSON-LD
  if (!audit.hasJsonLd) {
    remarks.push('🟢 Schema.org разметка (JSON-LD) отсутствует — рекомендуется добавить');
  }

  // OpenGraph
  if (!audit.hasOg) {
    remarks.push('🟢 OpenGraph разметка отсутствует');
  }

  // Canonical
  if (!audit.canonical) {
    remarks.push('🟡 Canonical не настроен');
  }

  // Robots meta
  if (audit.robotsMeta && (audit.robotsMeta.includes('noindex') || audit.robotsMeta.includes('nofollow'))) {
    remarks.push(`🔴 Страница имеет директиву: ${audit.robotsMeta}`);
  }

  // Images
  const imgCount = audit.imageCount ?? 0;
  const imgNoAlt = audit.imagesWithoutAlt ?? 0;
  if (imgNoAlt > 0) {
    remarks.push(`🟡 Изображения без alt-тегов: ${imgNoAlt} шт`);
  }
  if (imgCount === 0) {
    remarks.push('🟢 Изображения отсутствуют — рекомендуется добавить визуальный контент');
  }

  // Word count
  const wordCount = pageStats.wordCount || 0;
  if (wordCount < 300) {
    remarks.push(`🟡 Недостаточно текста: ${wordCount} слов (рекомендуется от 800)`);
  }

  // Internal links
  const internalLinks = data.tabData?.internalLinks?.length ?? audit.internalLinkCount ?? 0;
  if (internalLinks < 3) {
    remarks.push(`🟡 Внутренних ссылок: ${internalLinks} (норма 3-5)`);
  }

  // PageSpeed
  const pageSpeed = data.tabData?.pageSpeed || {};
  if (pageSpeed.score && pageSpeed.score < 50) {
    remarks.push(`🟡 Скорость загрузки низкая: ${pageSpeed.score}/100`);
  }

  // Uniqueness / Stealth
  const stealth = data.tabData?.stealth || {};
  if (stealth.uniqueness !== undefined && stealth.uniqueness < 90) {
    remarks.push(`🟡 Уникальность текста ${stealth.uniqueness}% — ниже нормы, требуется рерайт`);
  }

  // SEO Health
  if (scores.seoHealth !== undefined && scores.seoHealth < 50) {
    remarks.push(`🔴 Общий SEO Health: ${scores.seoHealth}% — критически низкий`);
  }

  // LLM friendly
  if (scores.llmFriendly !== undefined && scores.llmFriendly < 50) {
    remarks.push(`🟡 LLM-дружелюбность: ${scores.llmFriendly}% — контент плохо оптимизирован для ИИ`);
  }

  // TF-IDF missing keywords
  const missingKw = tfidf.filter((t: any) => t.status === 'missing' || t.status === 'low').slice(0, 5);
  if (missingKw.length > 0) {
    remarks.push(`🟡 Отсутствуют ключевые слова: ${missingKw.map((t: any) => t.term).join(', ')}`);
  }

  // URL structure
  const urlCheck = data.tabData?.urlStructure || {};
  if (urlCheck.hasUppercase) {
    remarks.push('🟢 URL содержит заглавные буквы — рекомендуется нижний регистр');
  }
  if (urlCheck.hasUnderscore) {
    remarks.push('🟢 URL содержит подчёркивания — рекомендуется использовать дефисы');
  }

  // Content freshness
  const freshness = data.tabData?.contentFreshness || {};
  if (freshness.lastModified) {
    const daysSince = Math.floor((Date.now() - new Date(freshness.lastModified).getTime()) / 86400000);
    if (daysSince > 365) {
      remarks.push(`🟡 Контент не обновлялся ${daysSince} дней — рекомендуется обновить`);
    }
  }

  // AI recommendations
  const aiRecs = data.aiReport?.recommendations || [];
  aiRecs.slice(0, 3).forEach((r: string) => {
    remarks.push(`🟢 ${r}`);
  });

  // Quick wins
  data.quickWins.slice(0, 3).forEach((qw: any) => {
    const task = qw.task || qw.title || '';
    if (task && !remarks.some((r) => r.includes(task.substring(0, 20)))) {
      const priority = (qw.priority || 'medium') === 'high' ? '🔴' : '🟡';
      remarks.push(`${priority} ${task}`);
    }
  });

  if (remarks.length === 0) {
    remarks.push('🟢 Критических замечаний не обнаружено');
  }

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
  const top = tfidf.slice(0, 5);
  return top.map((t: any) => `${t.term} (${typeof t.tfidf === 'number' ? t.tfidf.toFixed(3) : t.tfidf})`).join(', ');
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

export function exportSeoAuditXlsx(data: AuditData): void {
  const audit = data.tabData?.technicalAudit || {};
  const stealth = data.tabData?.stealth || {};
  const domain = (() => {
    try { return new URL(data.url).hostname; } catch { return 'site'; }
  })();
  const dateStr = new Date().toISOString().slice(0, 10);

  const wb = XLSX.utils.book_new();
  const sheetName = getMonthName();

  // Header row 1 (group headers) and row 2 (sub-headers)
  const row1: string[] = [
    '№', 'Название страницы', 'URL',
    'Мета-данные Title', '', // D:E merged
    'Мета-данные Description', '', // F:G merged
    'Уникальность', '', // H:I merged
    'Вхождения ключевых слов', '', // J:K merged
    'Структура заголовков', '', // L:M merged
    'Комментарии по контенту страницы',
    'Перелинковка', '', // O:P merged
    'Позиции', '', // Q:R merged
    'Все замечания и рекомендации', // S
  ];

  const row2: string[] = [
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

  // Data row
  const uniquenessFact = stealth.uniqueness !== undefined ? stealth.uniqueness : '';
  const uniquenessRec = (() => {
    const u = stealth.uniqueness;
    if (u === undefined) return 'Нет данных';
    if (u >= 95) return 'Отличная уникальность';
    if (u >= 90) return 'Уникальность в норме';
    return `Уникальность ${u}% — ниже нормы, требуется рерайт`;
  })();

  const contentComment = (() => {
    const parts: string[] = [];
    const wc = data.tabData?.pageStats?.wordCount;
    if (wc) parts.push(`Слов: ${wc}`);
    if (data.scores?.seoHealth) parts.push(`SEO: ${data.scores.seoHealth}%`);
    if (data.scores?.llmFriendly) parts.push(`LLM: ${data.scores.llmFriendly}%`);
    return parts.join(' | ') || '';
  })();

  const allRemarks = collectAllRemarks(data);

  // Recommended title/desc from AI
  const aiRecs = data.aiReport?.recommendations || [];
  const titleAfter = data.tabData?.recommendedTitle || '';
  const descAfter = data.tabData?.recommendedDescription || '';

  const pageName = audit.h1Text || audit.title || domain;

  const dataRow: (string | number)[] = [
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
    '', // Positions before (manual)
    '', // Positions after (manual)
    allRemarks,
  ];

  const aoa = [row1, row2, dataRow];
  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Merges for row 1
  ws['!merges'] = [
    { s: { r: 0, c: 3 }, e: { r: 0, c: 4 } },   // D:E Title
    { s: { r: 0, c: 5 }, e: { r: 0, c: 6 } },   // F:G Description
    { s: { r: 0, c: 7 }, e: { r: 0, c: 8 } },   // H:I Uniqueness
    { s: { r: 0, c: 9 }, e: { r: 0, c: 10 } },  // J:K Keywords
    { s: { r: 0, c: 11 }, e: { r: 0, c: 12 } }, // L:M Headings
    { s: { r: 0, c: 14 }, e: { r: 0, c: 15 } }, // O:P Internal links
    { s: { r: 0, c: 16 }, e: { r: 0, c: 17 } }, // Q:R Positions
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 5 },   // A
    { wch: 20 },  // B
    { wch: 35 },  // C
    { wch: 40 },  // D
    { wch: 40 },  // E
    { wch: 40 },  // F
    { wch: 40 },  // G
    { wch: 25 },  // H
    { wch: 25 },  // I
    { wch: 25 },  // J
    { wch: 25 },  // K
    { wch: 25 },  // L
    { wch: 25 },  // M
    { wch: 40 },  // N
    { wch: 25 },  // O
    { wch: 25 },  // P
    { wch: 10 },  // Q
    { wch: 10 },  // R
    { wch: 60 },  // S
  ];

  // Row heights
  ws['!rows'] = [
    { hpt: 30 }, // header
    { hpt: 25 }, // sub-header
    { hpt: 200 }, // data row (tall for remarks)
  ];

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${domain}__SEO-Audit_${dateStr}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
