import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, BorderStyle, WidthType, ShadingType,
  Footer, PageNumber, LevelFormat, AlignmentType,
} from 'docx';
import { saveAs } from 'file-saver';
import type { FreeTopicsData, PrioItem } from '@/components/analytics/FreeTopicsView';

const PRIMARY = '3B82F6';
const MUTED = '6B7280';
const BORDER = 'E5E7EB';
const SUCCESS = '10B981';
const WARN = 'F59E0B';
const DANGER = 'EF4444';
const VIOLET = '8B5CF6';

const cb = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cbs = { top: cb, bottom: cb, left: cb, right: cb };

function h1(t: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 280, after: 160 },
    children: [new TextRun({ text: t, bold: true, size: 32, color: '111827' })] });
}
function h2(t: string) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 220, after: 120 },
    children: [new TextRun({ text: t, bold: true, size: 26, color: '111827' })] });
}
function p(text: string, opts: { color?: string; bold?: boolean; size?: number; italic?: boolean } = {}) {
  return new Paragraph({ spacing: { after: 100 },
    children: [new TextRun({ text, color: opts.color, bold: opts.bold, italics: opts.italic, size: opts.size ?? 22 })] });
}
function bullet(text: string, color?: string) {
  return new Paragraph({ numbering: { reference: 'bullets', level: 0 }, spacing: { after: 60 },
    children: [new TextRun({ text, size: 22, color })] });
}
function divider() {
  return new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: PRIMARY, space: 1 } },
    spacing: { before: 60, after: 200 }, children: [new TextRun('')] });
}
function scoreColor(v: number) { return v >= 70 ? SUCCESS : v >= 40 ? WARN : DANGER; }
function thRow(cells: string[], widths: number[]) {
  return new TableRow({ tableHeader: true,
    children: cells.map((c, i) => new TableCell({ borders: cbs, width: { size: widths[i], type: WidthType.DXA },
      shading: { fill: 'F3F4F6', type: ShadingType.CLEAR, color: 'auto' },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: [new Paragraph({ children: [new TextRun({ text: c, bold: true, size: 20, color: '111827' })] })] })) });
}
function tdRow(cells: (string | { text: string; color?: string; bold?: boolean; italic?: boolean })[], widths: number[]) {
  return new TableRow({
    children: cells.map((c, i) => {
      const o = typeof c === 'string' ? { text: c } : c;
      return new TableCell({ borders: cbs, width: { size: widths[i], type: WidthType.DXA },
        margins: { top: 90, bottom: 90, left: 140, right: 140 },
        children: [new Paragraph({ children: [new TextRun({ text: o.text, size: 20, color: o.color, bold: o.bold, italics: o.italic })] })] });
    }),
  });
}

const LVL = (v: string) => v === 'high' ? 'Высокая' : v === 'low' ? 'Низкая' : 'Средняя';
const SAT = (v: string) => v === 'high' ? 'Высокое' : v === 'low' ? 'Низкое' : 'Среднее';
const FIT = (v: string) => v === 'yes' ? 'Подходит' : v === 'no' ? 'Не подходит' : 'Частично';
const VERD = (v: string) => ({ 'pursue-now': 'Брать сейчас', prepare: 'Готовить', monitor: 'Мониторить', avoid: 'Избегать' } as any)[v] || v;

function scoringTable(s: FreeTopicsData['scoring']) {
  const widths = [4400, 2400, 2600];
  const label = (v: number) => v >= 70 ? 'Высокая' : v >= 40 ? 'Средняя' : 'Низкая';
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Метрика', 'Значение', 'Оценка'], widths),
    tdRow(['Итог white space', { text: `${s.overall_white_space}/100`, bold: true, color: scoreColor(s.overall_white_space) }, label(s.overall_white_space)], widths),
    tdRow(['Насыщенность рынка', { text: `${s.market_saturation}/100`, bold: true, color: scoreColor(100 - s.market_saturation) }, label(100 - s.market_saturation)], widths),
    tdRow(['Недокрытие', { text: `${s.undercoverage}/100`, bold: true, color: scoreColor(s.undercoverage) }, label(s.undercoverage)], widths),
    tdRow(['Интент-разрыв', { text: `${s.intent_mismatch}/100`, bold: true, color: scoreColor(s.intent_mismatch) }, label(s.intent_mismatch)], widths),
    tdRow(['ИИ-разрыв', { text: `${s.ai_answerability_gap}/100`, bold: true, color: scoreColor(s.ai_answerability_gap) }, label(s.ai_answerability_gap)], widths),
    tdRow(['Реалистичность для нового сайта', { text: `${s.ease_for_new_site}/100`, bold: true, color: scoreColor(s.ease_for_new_site) }, label(s.ease_for_new_site)], widths),
  ]});
}

function segmentsTable(items: FreeTopicsData['segments_map']) {
  const widths = [2600, 1600, 1700, 1900, 1600];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Сегмент', 'Насыщенность', 'Качество покрытия', 'Вероятность white space', 'Типы разрывов'], widths),
    ...items.map((s) => tdRow([
      { text: s.segment, bold: true }, SAT(s.saturation), LVL(s.coverage_quality), LVL(s.white_space_likelihood),
      s.gap_types.join(' · ') || '—',
    ], widths)),
  ]});
}

function topicsTable(items: FreeTopicsData['topic_gaps']) {
  const widths = [2600, 2000, 1800, 1500, 1500];
  return new Table({ width: { size: 9400, type: WidthType.DXA }, columnWidths: widths, rows: [
    thRow(['Тема', 'Page type', 'Scores (Спрос/Бизнес/Лёгкость)', 'Новый сайт', 'Вердикт'], widths),
    ...items.map((c) => tdRow([
      { text: c.topic, bold: true },
      c.best_page_type || '—',
      { text: `${c.demand_signal}/${c.business_value}/${c.ease}`, bold: true, color: scoreColor(Math.round((c.demand_signal + c.business_value + c.ease) / 3)) },
      FIT(c.fits_new_site),
      VERD(c.verdict),
    ], widths)),
  ]});
}

function phaseBlock(title: string, items: PrioItem[]) {
  const out: (Paragraph | Table)[] = [];
  out.push(p(title, { bold: true, color: PRIMARY, size: 24 }));
  if (!items.length) { out.push(p('—', { color: MUTED })); return out; }
  items.forEach((c) => {
    out.push(p(c.what, { bold: true }));
    if (c.why) out.push(p(`Почему: ${c.why}`, { color: MUTED, size: 20 }));
    if (c.expected_impact) out.push(p(`Эффект: ${c.expected_impact}`, { color: SUCCESS, size: 20 }));
    if (c.risk) out.push(p(`Риск: ${c.risk}`, { color: DANGER, size: 20 }));
    if (c.needs) out.push(p(`Нужно: ${c.needs}`, { color: MUTED, size: 20 }));
  });
  return out;
}

export async function exportFreeTopicsDocx(niche: string, data: FreeTopicsData) {
  const children: (Paragraph | Table)[] = [];

  children.push(new Paragraph({ spacing: { before: 200, after: 60 },
    children: [new TextRun({ text: 'СВОБОДНЫЕ ТЕМЫ · WHITE SPACE · SEO-АУДИТ', bold: true, size: 22, color: PRIMARY })] }));
  children.push(new Paragraph({ spacing: { after: 120 },
    children: [new TextRun({ text: niche || '—', bold: true, size: 44, color: '111827' })] }));
  children.push(p('Decision-grade карта незакрытых тем, интентов, форматов и сегментов.', { color: MUTED }));
  children.push(p(`Сформировано: ${new Date().toLocaleDateString('ru-RU')}`, { color: MUTED, size: 20 }));
  children.push(divider());

  children.push(h1('1. Оценка white-space ландшафта'));
  children.push(scoringTable(data.scoring));
  if (data.scoring.reasoning) children.push(new Paragraph({ spacing: { before: 120 },
    children: [new TextRun({ text: data.scoring.reasoning, size: 22, color: '374151' })] }));

  children.push(h1('2. Сводный вердикт'));
  children.push(p(`Насыщенность ниши: ${SAT(data.executive_verdict.saturation_level)}`, { color: PRIMARY, bold: true }));
  children.push(p(`Модель входа: ${data.executive_verdict.entry_model}`, { color: PRIMARY, bold: true }));
  children.push(h2('Общая картина'));
  children.push(p(data.executive_verdict.overview || '—'));
  children.push(h2('Основная зона разрывов'));
  children.push(p(data.executive_verdict.main_gap_zone || '—', { color: PRIMARY }));
  children.push(h2('Главный риск'));
  children.push(p(data.executive_verdict.main_risk || '—', { color: DANGER }));
  children.push(h2('Главная возможность'));
  children.push(p(data.executive_verdict.main_opportunity || '—', { color: SUCCESS }));

  children.push(h1('3. Топ-листы'));
  const lists: [string, string[], string][] = [
    ['Топ возможностей', data.top_lists.top_opportunities, PRIMARY],
    ['Для нового сайта', data.top_lists.for_new_site, SUCCESS],
    ['Требуют авторитета', data.top_lists.requires_authority, VIOLET],
    ['Лучшие типы страниц', data.top_lists.best_page_types, PRIMARY],
    ['Ложные возможности', data.top_lists.false_gaps_short, DANGER],
  ];
  for (const [title, items, color] of lists) {
    if (!items.length) continue;
    children.push(h2(title));
    items.forEach((t) => children.push(bullet(t, color)));
  }

  if (data.segments_map.length) {
    children.push(h1('4. Карта сегментов ниши'));
    children.push(segmentsTable(data.segments_map));
  }

  if (data.topic_gaps.length) {
    children.push(h1('5. Topic gaps'));
    children.push(topicsTable(data.topic_gaps));
    data.topic_gaps.forEach((c) => {
      children.push(h2(c.topic));
      if (c.why_gap) children.push(p(`Почему gap: ${c.why_gap}`));
      if (c.why_market_misses) children.push(p(`Рынок упускает: ${c.why_market_misses}`, { color: MUTED }));
      if (c.intent) children.push(p(`Интент: ${c.intent}`, { color: PRIMARY }));
      if (c.horizon) children.push(p(`Горизонт: ${c.horizon}`, { color: MUTED, size: 20 }));
    });
  }

  if (data.intent_gaps.length) {
    children.push(h1('6. Intent gaps'));
    data.intent_gaps.forEach((c) => {
      children.push(h2(c.intent_missed));
      if (c.current_problem) children.push(p(`Проблема: ${c.current_problem}`, { color: DANGER }));
      if (c.better_match) children.push(p(`Лучший match: ${c.better_match}`, { color: SUCCESS }));
      if (c.needed_page_type) children.push(p(`Тип страницы: ${c.needed_page_type}`, { color: PRIMARY }));
      if (c.comment) children.push(p(c.comment, { color: MUTED, size: 20 }));
    });
  }

  if (data.audience_gaps.length) {
    children.push(h1('7. Audience gaps'));
    data.audience_gaps.forEach((c) => {
      children.push(h2(c.audience));
      if (c.why_important) children.push(p(`Почему важно: ${c.why_important}`));
      if (c.demand_signal) children.push(p(`Сигнал спроса: ${c.demand_signal}`, { color: MUTED, size: 20 }));
      if (c.needed_content) children.push(p(`Нужный контент: ${c.needed_content}`, { color: PRIMARY }));
      children.push(p(`Бизнес-ценность: ${LVL(c.business_value)}`, { color: SUCCESS, size: 20 }));
    });
  }

  if (data.funnel_gaps.length) {
    children.push(h1('8. Funnel gaps'));
    data.funnel_gaps.forEach((c) => {
      children.push(h2(c.stage));
      children.push(p(`Покрытие: ${LVL(c.coverage)} · Приоритет: ${c.priority?.toUpperCase()}`, { color: MUTED, size: 20 }));
      if (c.gap) children.push(p(c.gap));
      if (c.needed_page_types.length) children.push(p(`Типы страниц: ${c.needed_page_types.join(' · ')}`, { color: PRIMARY }));
      if (c.comment) children.push(p(c.comment, { color: MUTED, size: 20 }));
    });
  }

  if (data.format_gaps.length) {
    children.push(h1('9. Format & page-type gaps'));
    data.format_gaps.forEach((c) => {
      children.push(h2(c.missing_format));
      if (c.why_white_space) children.push(p(`Почему gap: ${c.why_white_space}`));
      if (c.where_wins) children.push(p(`Где побеждает: ${c.where_wins}`, { color: SUCCESS }));
      children.push(p(`Подходит новому сайту: ${FIT(c.fits_new_site)}`, { color: MUTED, size: 20 }));
      if (c.comment) children.push(p(c.comment, { color: MUTED, size: 20 }));
    });
  }

  if (data.depth_freshness_gaps.length) {
    children.push(h1('10. Depth & freshness gaps'));
    data.depth_freshness_gaps.forEach((c) => {
      children.push(h2(`${c.type === 'freshness' ? 'Свежесть' : 'Глубина'}: ${c.where}`));
      if (c.how_to_use) children.push(p(`Как использовать: ${c.how_to_use}`, { color: SUCCESS }));
      if (c.best_format) children.push(p(`Лучший формат: ${c.best_format}`, { color: PRIMARY }));
      if (c.speed) children.push(p(`Скорость: ${c.speed}`, { color: MUTED, size: 20 }));
    });
  }

  if (data.geo_gaps.length) {
    children.push(h1('11. Geo & localization gaps'));
    data.geo_gaps.forEach((c) => {
      children.push(h2(c.geo));
      if (c.gap) children.push(p(`Gap: ${c.gap}`));
      if (c.why_exists) children.push(p(`Почему существует: ${c.why_exists}`, { color: MUTED }));
      if (c.best_page_type) children.push(p(`Page type: ${c.best_page_type}`, { color: PRIMARY }));
      children.push(p(`Потенциал: ${LVL(c.potential)}`, { color: SUCCESS, size: 20 }));
    });
  }

  if (data.commercial_gaps.length) {
    children.push(h1('12. Commercial white spaces'));
    data.commercial_gaps.forEach((c) => {
      children.push(h2(c.opportunity));
      if (c.scenario) children.push(p(`Сценарий: ${c.scenario}`));
      if (c.best_page_type) children.push(p(`Page type: ${c.best_page_type}`, { color: PRIMARY }));
      children.push(p(`Revenue: ${LVL(c.revenue_potential)} · Новый сайт: ${FIT(c.fits_new_site)}`, { color: MUTED, size: 20 }));
    });
  }

  if (data.ai_gaps.length) {
    children.push(h1('13. AI-search white spaces'));
    data.ai_gaps.forEach((c) => {
      children.push(h2(c.opportunity));
      if (c.why_ai_matters) children.push(p(`Почему важно для ИИ: ${c.why_ai_matters}`));
      if (c.needed_format) children.push(p(`Формат: ${c.needed_format}`, { color: PRIMARY }));
      children.push(p(`Organic: ${LVL(c.organic_upside)} · AI: ${LVL(c.ai_upside)}`, { color: SUCCESS, size: 20 }));
    });
  }

  if (data.false_gaps.length) {
    children.push(h1('14. Ложные white spaces'));
    data.false_gaps.forEach((c) => {
      children.push(h2(c.fake_gap));
      if (c.why_looks_like_opp) children.push(p(`Кажется возможностью: ${c.why_looks_like_opp}`, { color: MUTED }));
      if (c.why_not_worth) children.push(p(`Слабая ставка: ${c.why_not_worth}`, { color: DANGER }));
      if (c.when_to_revisit) children.push(p(`Когда вернуться: ${c.when_to_revisit}`, { color: SUCCESS }));
    });
  }

  children.push(h1('15. Поэтапный план'));
  phaseBlock('Запускать сейчас', data.prioritization.launch_now).forEach((c) => children.push(c));
  phaseBlock('В ближайший квартал', data.prioritization.launch_quarter).forEach((c) => children.push(c));
  phaseBlock('После роста авторитета', data.prioritization.after_authority).forEach((c) => children.push(c));
  phaseBlock('При наличии ресурсов', data.prioritization.with_resources).forEach((c) => children.push(c));
  phaseBlock('Не приоритет', data.prioritization.deprioritize).forEach((c) => children.push(c));

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    numbering: { config: [{ reference: 'bullets', levels: [{
      level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 540, hanging: 280 } } },
    }] }] },
    sections: [{
      properties: { page: { margin: { top: 1100, right: 1100, bottom: 1100, left: 1100 } } },
      footers: { default: new Footer({ children: [new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'SEO-Аудит · Свободные темы · ', size: 18, color: MUTED }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, color: MUTED }),
        ],
      })] }) },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = (niche || 'niche').replace(/[^a-zA-Z0-9а-яА-Я\-_]+/g, '-').slice(0, 60);
  saveAs(blob, `free-topics-${safe}-${new Date().toISOString().slice(0, 10)}.docx`);
}