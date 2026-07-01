import type { ParsedTraffic, ParsedSources, ParsedGsc, ParsedTopvisor } from './forecastParsers';

export type ForecastProjectData = {
  domain: string;
  clientName: string;
  topic: string;
  region: string;
  horizon: 3 | 6;
  engines: { yandex: boolean; google: boolean; bing: boolean };
  siteStatus: 'young' | 'growing' | 'mature';
  works: {
    blog: boolean;
    cards: boolean;
    links: boolean;
    crowd: boolean;
    external: boolean;
    tech: boolean;
  };
  publishPace?: number;
  context?: string;
};

export type ForecastScenario = {
  name: 'conservative' | 'base' | 'optimistic';
  monthlyGrowthRate: number;
  months: Array<{
    monthIndex: number;
    yandex: number;
    google: number;
    bing: number;
    total: number;
    newTop10?: number;
    gscClicks?: number;
  }>;
};

export type ForecastResult = {
  baseTraffic: { yandex: number; google: number; bing: number; total: number };
  scenarios: { conservative: ForecastScenario; base: ForecastScenario; optimistic: ForecastScenario };
  monthLabels: string[];
  hasTopvisor: boolean;
  hasGsc: boolean;
  googlePotentialPerMonth: number;
  growthPoints: string[];
  insights: string[];
  seasonalityNote: string;
  seasonSource: 'niche' | 'actual';
  peakMonths: string[];
};

// Block B — базовые темпы по статусу сайта {conservative, base, optimistic}
const STATUS_RATES: Record<ForecastProjectData['siteStatus'], { min: number; base: number; max: number }> = {
  young:   { min: 0.25, base: 0.32, max: 0.42 },
  growing: { min: 0.08, base: 0.14, max: 0.22 },
  mature:  { min: 0.03, base: 0.07, max: 0.12 },
};

// Block C — мультипликаторы работ, раздельно Я и G, с лагом
const WORK_MULT: Record<keyof ForecastProjectData['works'], { yandex: number; google: number; lag: number }> = {
  blog:     { yandex: 0.05, google: 0.03, lag: 1 },
  cards:    { yandex: 0.04, google: 0.02, lag: 1 },
  links:    { yandex: 0.04, google: 0.06, lag: 2 },
  crowd:    { yandex: 0.03, google: 0.01, lag: 1 },
  external: { yandex: 0.02, google: 0.02, lag: 1 },
  tech:     { yandex: 0.03, google: 0.05, lag: 1 },
};

// Block E — сезонные коэффициенты по нишам (январь=0)
const SEASONALITY: Record<string, number[]> = {
  'Металлопрокат':                [0.70, 0.80, 1.30, 1.40, 1.30, 1.10, 0.90, 0.90, 1.20, 1.10, 0.80, 0.60],
  'Строительство и стройматериалы':[0.65, 0.75, 1.25, 1.45, 1.40, 1.15, 0.95, 0.95, 1.20, 1.10, 0.80, 0.55],
  'Недвижимость':                 [0.85, 0.95, 1.10, 1.20, 1.15, 1.05, 0.90, 0.90, 1.20, 1.25, 1.05, 0.85],
  'Медицина и здоровье':          [1.20, 1.10, 1.05, 0.95, 0.90, 0.85, 0.80, 0.85, 1.05, 1.10, 1.15, 1.15],
  'Туризм и путешествия':         [0.75, 0.80, 1.05, 1.15, 1.20, 1.25, 1.20, 1.15, 1.10, 0.90, 0.75, 0.70],
  'Авто и запчасти':              [0.80, 0.85, 1.15, 1.20, 1.15, 1.05, 0.95, 1.00, 1.10, 1.05, 0.85, 0.75],
  'E-commerce (товары)':          [0.75, 0.80, 0.95, 0.95, 1.00, 0.95, 0.90, 0.95, 1.05, 1.10, 1.25, 1.40],
  'IT и SaaS':                    [1.05, 1.10, 1.10, 1.05, 1.00, 0.95, 0.85, 0.90, 1.05, 1.10, 1.05, 0.90],
  'Юридические услуги':           [1.10, 1.05, 1.05, 1.00, 1.00, 0.95, 0.85, 0.85, 1.05, 1.10, 1.05, 0.95],
  'Финансы и кредиты':            [1.05, 1.05, 1.10, 1.05, 1.00, 0.95, 0.85, 0.90, 1.05, 1.10, 1.05, 0.90],
  'Образование':                  [1.00, 1.00, 1.05, 1.00, 1.05, 0.95, 0.75, 1.10, 1.25, 1.10, 1.00, 0.80],
  'Промышленное оборудование':    [0.80, 0.85, 1.15, 1.25, 1.20, 1.05, 0.90, 0.90, 1.15, 1.10, 0.85, 0.70],
  'Другое':                       [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0],
};
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];

function pickSeasonality(niche: string): number[] {
  const key = Object.keys(SEASONALITY).find((k) => niche.toLowerCase().includes(k.toLowerCase().split(' ')[0]));
  return SEASONALITY[key ?? 'Другое'] ?? SEASONALITY['Другое'];
}

function actualSeasonalityFromTraffic(rows: ParsedTraffic['rows']): number[] | null {
  const dated = rows.filter((r) => {
    const d = new Date(r.period);
    return !isNaN(d.getTime()) && r.total > 0;
  });
  if (dated.length < 10) return null;
  const avg = dated.reduce((s, r) => s + r.total, 0) / dated.length;
  if (!avg) return null;
  return Array.from({ length: 12 }, (_, i) => {
    const monthRows = dated.filter((r) => new Date(r.period).getMonth() === i);
    if (!monthRows.length) return 1.0;
    return (monthRows.reduce((s, r) => s + r.total, 0) / monthRows.length) / avg;
  });
}

// Block D — S-кривая (медленный старт → ускорение → стабилизация)
function phaseMultiplier(monthIndex: number, horizon: number): number {
  const ratio = (monthIndex + 1) / horizon;
  if (ratio <= 0.25) return 0.35;
  if (ratio <= 0.65) return 1.25;
  return 0.90;
}

// Block H — накопительный эффект контента (насыщение после ~50 статей)
function contentBoost(articlesPerMonth: number, monthIndex: number): number {
  const total = articlesPerMonth * (monthIndex + 1);
  const raw = total * 0.012;
  return 1 + Math.min(raw, 0.55);
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' });
}

export function calculateForecast(
  project: ForecastProjectData,
  files: {
    traffic?: ParsedTraffic | null;
    sources?: ParsedSources | null;
    gsc?: ParsedGsc | null;
    topvisor?: ParsedTopvisor | null;
  },
): ForecastResult {
  const horizon = project.horizon;
  const monthLabels = Array.from({ length: horizon }, (_, i) => monthLabel(i + 1));
  const startMonth = new Date().getMonth();
  const nextMonth0 = (startMonth + 1) % 12;

  // Block A — база трафика: среднее последних 2 ненулевых периодов
  let yBase = 0, gBase = 0, bBase = 0;
  if (files.traffic && files.traffic.rows.length) {
    const nonZero = files.traffic.rows.filter((r) => r.total > 0).slice(-2);
    if (nonZero.length) {
      yBase = Math.round(nonZero.reduce((s, r) => s + r.yandex, 0) / nonZero.length);
      gBase = Math.round(nonZero.reduce((s, r) => s + r.google, 0) / nonZero.length);
      bBase = Math.round(nonZero.reduce((s, r) => s + r.bing, 0) / nonZero.length);
    }
  }
  const totalBase = yBase + gBase + bBase;

  // Block E — сезонность: фактическая или из справочника
  const actualSeason = files.traffic ? actualSeasonalityFromTraffic(files.traffic.rows) : null;
  const nicheSeason = pickSeasonality(project.topic);
  const seasonCoeff = actualSeason ?? nicheSeason;
  const seasonSource: 'niche' | 'actual' = actualSeason ? 'actual' : 'niche';
  const peakIdx = [...seasonCoeff.map((v, i) => ({ v, i }))].sort((a, b) => b.v - a.v).slice(0, 3).map((x) => MONTHS_RU[x.i]);

  // Block I — сигналы Topvisor
  const hasTopvisor = !!files.topvisor && files.topvisor.total > 0;
  const allDashes = hasTopvisor && files.topvisor!.outside === files.topvisor!.total;
  const top10Ratio = hasTopvisor ? (files.topvisor!.top10 / files.topvisor!.total) : 0;
  const currentTop10 = hasTopvisor ? files.topvisor!.top10 : 0;

  // Block F — потолок Google из GSC (CTR топ-1 ≈ 35%)
  const hasGsc = !!files.gsc && files.gsc.impressions > 0;
  const googleCap = hasGsc ? Math.round(files.gsc!.impressions * 0.35 / 12) : Infinity; // визитов/мес.
  const googlePotentialPerMonth = hasGsc
    ? Math.round(files.gsc!.buckets.top2_3 * 0.30 + files.gsc!.buckets.top4_10 * 0.08)
    : 0;

  // Block G — раздельные параметры Я/G. Если Google почти не раскрыт — потенциал роста выше.
  const googleRatePower = (yBase > 0 && gBase < yBase * 0.05) ? 1.6 : 1.0;

  const rates = STATUS_RATES[project.siteStatus];
  const enabledWorks = (Object.keys(project.works) as Array<keyof ForecastProjectData['works']>).filter((k) => project.works[k]);
  const articlesPerMonth = project.works.blog ? (project.publishPace ?? 0) : 0;

  function build(name: ForecastScenario['name']): ForecastScenario {
    const scenarioRate = name === 'conservative' ? rates.min : name === 'base' ? rates.base : rates.max;
    // Optimistic усиливается если много запросов в топ-10
    const optiTopvisorBoost = name === 'optimistic' ? 1 + top10Ratio * 0.3 : 1;

    let y = yBase, g = gBase, b = bBase;
    // Если базы нет — небольшой seed чтобы прогноз стартовал
    if (totalBase === 0) {
      y = project.engines.yandex ? 15 : 0;
      g = project.engines.google ? 10 : 0;
      b = project.engines.bing ? 3 : 0;
    }

    const gscMonthly = hasGsc ? files.gsc!.clicks / 12 : 0;
    let gscClicks = gscMonthly;
    const months: ForecastScenario['months'] = [];

    for (let i = 0; i < horizon; i++) {
      const monthCal = (nextMonth0 + i) % 12;
      const season = seasonCoeff[monthCal];
      const phase = phaseMultiplier(i, horizon);

      // Собираем boosts работ с учётом лага
      let yWorkBoost = 0, gWorkBoost = 0;
      for (const k of enabledWorks) {
        const w = WORK_MULT[k];
        if (i >= w.lag) { yWorkBoost += w.yandex; gWorkBoost += w.google; }
      }

      const yRate = (scenarioRate + yWorkBoost);
      const gRate = (scenarioRate + gWorkBoost) * googleRatePower;

      // Block I — нулевая точка Topvisor: первый месяц как раскачка
      const firstMonthLag = (i === 0 && allDashes) ? { y: 0.12, g: 0.08 } : { y: 1, g: 1 };

      y = y * (1 + yRate * phase * season * firstMonthLag.y);
      g = g * (1 + gRate * phase * season * firstMonthLag.g);
      b = b * (1 + scenarioRate * phase * season);

      // Block H — накопительный эффект контента (только Яндекс, с i>=1)
      if (articlesPerMonth > 0 && i >= 1) {
        y = y * (contentBoost(articlesPerMonth, i - 1) / contentBoost(articlesPerMonth, i - 2 < 0 ? 0 : i - 2));
      }

      // Оптимистичный сценарий: инъекция потенциала Google из GSC начиная с мес.3
      if (name === 'optimistic' && hasGsc && i >= 2) {
        g += googlePotentialPerMonth * ((i - 1) / horizon);
      }
      // Optimistic bump от Topvisor top-10
      if (name === 'optimistic') y *= 1 + (optiTopvisorBoost - 1) / horizon;

      // Block F — потолок Google
      if (g > googleCap) g = googleCap;

      const yv = project.engines.yandex ? Math.round(y) : 0;
      const gv = project.engines.google ? Math.round(g) : 0;
      const bv = project.engines.bing ? Math.round(b) : 0;

      const entry: ForecastScenario['months'][number] = {
        monthIndex: i + 1,
        yandex: yv, google: gv, bing: bv,
        total: yv + gv + bv,
      };
      if (hasTopvisor) {
        entry.newTop10 = currentTop10 + Math.round(scenarioRate * 15 * (i + 1));
      }
      if (hasGsc) {
        gscClicks = gscClicks * (1 + scenarioRate * phase * season);
        entry.gscClicks = Math.round(gscClicks);
      }
      months.push(entry);
    }
    return { name, monthlyGrowthRate: scenarioRate, months };
  }

  const scenarios = {
    conservative: build('conservative'),
    base: build('base'),
    optimistic: build('optimistic'),
  };

  // Points (короткие пункты, попадут в отчёт как «Точки роста»)
  const growthPoints: string[] = [];
  if (googlePotentialPerMonth > 0) growthPoints.push(`Потенциал Google: ~${googlePotentialPerMonth} кликов/мес. при доводке позиций 2–10 в топ-3.`);
  if (hasTopvisor && files.topvisor!.top100 - files.topvisor!.top10 > 0) growthPoints.push(`${files.topvisor!.top100 - files.topvisor!.top10} запросов в топ-100 (не в топ-10) — потенциал быстрых побед.`);
  if (project.works.blog && project.publishPace) growthPoints.push(`Плановые ${project.publishPace} публикаций/мес. создают базу для роста информационного трафика.`);
  if (project.works.links) growthPoints.push('Закупка ссылок ускорит рост позиций коммерческих запросов на 1–2 месяца.');
  if (project.works.tech) growthPoints.push('Техническое SEO снижает риск деиндексации и повышает потолок роста.');
  if (allDashes) growthPoints.push('Стартовая позиция — вне топ-100 по всем запросам; первый месяц заложен как «раскачка» (~10% от базового прироста).');

  // Автоматические инсайты (Block: insightsGenerator)
  const insights: string[] = [];
  if (hasGsc && yBase > 0 && gBase < yBase * 0.05) {
    insights.push(`Google практически не используется (${gBase} визитов против ${yBase} из Яндекса). При наличии ${files.gsc!.impressions.toLocaleString('ru-RU')} показов в GSC это главный резерв роста — целенаправленная работа с Google даст кратный прирост уже через 2–3 месяца.`);
  }
  if (hasGsc && files.gsc!.buckets.top2_3 > 500) {
    const extra = Math.round(files.gsc!.buckets.top2_3 * 0.30);
    insights.push(`${files.gsc!.buckets.top2_3.toLocaleString('ru-RU')} показов на позициях 2–3 в Google. Сдвиг этих запросов в топ-1 (CTR ~35%) даст ~${extra} дополнительных кликов в месяц без создания нового контента.`);
  }
  if (allDashes && hasTopvisor) {
    insights.push(`Сайт отсутствует в топ-100 по всем ${files.topvisor!.total} проверенным запросам — это нулевая стартовая точка. Первый месяц уйдёт на индексацию, заметный рост начнётся с месяца 2–3.`);
  }
  if (files.traffic && files.traffic.rows.length >= 3) {
    const rr = files.traffic.rows.slice(-3);
    if (rr[2].total > 0 && rr[2].total < rr[0].total * 0.85) {
      insights.push(`Зафиксирован откат трафика в последние месяцы (${rr[0].total} → ${rr[2].total}). Возможна сезонность ниши или алгоритмическая коррекция — рекомендуется мониторинг позиций и Search Console на предмет деиндексации.`);
    }
  }
  insights.push(`Пик спроса в нише «${project.topic || 'выбранная тематика'}»: ${peakIdx.join(', ')}. Контент под сезонные запросы стоит публиковать за 2–3 месяца до пика.`);
  if (project.works.blog && articlesPerMonth >= 8) {
    const boostPct = Math.round((contentBoost(articlesPerMonth, horizon - 1) - 1) * 100);
    insights.push(`При темпе ${articlesPerMonth} статей/мес. накопительный эффект контента даст +${boostPct}% к базовому Яндекс-трафику к концу периода.`);
  }
  if (hasTopvisor && top10Ratio > 0.15) {
    insights.push(`${Math.round(top10Ratio * 100)}% запросов уже в топ-10 — оптимистичный сценарий усилен: рост позиций даёт непропорциональный прирост CTR.`);
  }

  const seasonalityNote = seasonSource === 'actual'
    ? 'Сезонные коэффициенты рассчитаны из фактических данных Метрики (≥10 месяцев истории).'
    : `Сезонные коэффициенты взяты из справочника по нише «${project.topic || 'Другое'}».`;

  return {
    baseTraffic: { yandex: yBase, google: gBase, bing: bBase, total: totalBase },
    scenarios,
    monthLabels,
    hasTopvisor,
    hasGsc,
    googlePotentialPerMonth,
    growthPoints,
    insights,
    seasonalityNote,
    seasonSource,
    peakMonths: peakIdx,
  };
}