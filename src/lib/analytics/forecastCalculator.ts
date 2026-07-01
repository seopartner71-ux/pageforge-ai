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
};

const STATUS_RATE: Record<ForecastProjectData['siteStatus'], number> = {
  young: 0.32,
  growing: 0.15,
  mature: 0.07,
};

const WORK_BONUS: Record<keyof ForecastProjectData['works'], number> = {
  blog: 0.05,
  cards: 0.04,
  links: 0.05,
  crowd: 0.03,
  external: 0.02,
  tech: 0.04,
};

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

  // Base traffic (avg last 2 non-zero months)
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

  // Growth rate
  let rate = STATUS_RATE[project.siteStatus];
  (Object.keys(project.works) as Array<keyof ForecastProjectData['works']>).forEach((k) => {
    if (project.works[k]) rate += WORK_BONUS[k];
  });

  // Topvisor signal
  const hasTopvisor = !!files.topvisor && files.topvisor.total > 0;
  const allDashes = hasTopvisor && files.topvisor!.outside === files.topvisor!.total;
  const hasTop10 = hasTopvisor && files.topvisor!.top10 > 0;
  const optimisticBoost = hasTop10 ? 1.2 : 1.0;
  const lagFirstMonth = allDashes;

  // GSC potential
  const hasGsc = !!files.gsc && files.gsc.impressions > 0;
  const googlePotentialPerMonth = hasGsc
    ? Math.round(files.gsc!.buckets.top2_3 * 0.30 + files.gsc!.buckets.top4_10 * 0.08)
    : 0;

  function build(name: ForecastScenario['name'], mult: number): ForecastScenario {
    const r = rate * mult;
    const months: ForecastScenario['months'] = [];
    let y = yBase, g = gBase, b = bBase;
    const gscCurrentMonthClicks = hasGsc ? Math.round(files.gsc!.clicks / 12) : 0;
    const top10Now = hasTopvisor ? files.topvisor!.top10 : 0;
    for (let m = 1; m <= horizon; m++) {
      const monthMult = m === 1 && lagFirstMonth ? 0.1 : 1;
      y = Math.round(y * (1 + r * monthMult));
      g = Math.round(g * (1 + r * monthMult));
      b = Math.round(b * (1 + r * monthMult));
      // Optional google potential injected from month 3 in optimistic
      if (name === 'optimistic' && hasGsc && m >= 3) {
        g += Math.round(googlePotentialPerMonth * ((m - 2) / horizon));
      }
      const entry: ForecastScenario['months'][number] = {
        monthIndex: m,
        yandex: project.engines.yandex ? y : 0,
        google: project.engines.google ? g : 0,
        bing: project.engines.bing ? b : 0,
        total: 0,
      };
      entry.total = entry.yandex + entry.google + entry.bing;
      if (hasTopvisor || project.works.blog || project.works.links) {
        entry.newTop10 = top10Now + Math.round(10 * r * m);
      }
      if (hasGsc) {
        entry.gscClicks = Math.round(gscCurrentMonthClicks * Math.pow(1 + r, m));
      }
      months.push(entry);
    }
    return { name, monthlyGrowthRate: r, months };
  }

  const scenarios = {
    conservative: build('conservative', 0.4),
    base: build('base', 1.0),
    optimistic: build('optimistic', 1.8 * optimisticBoost),
  };

  // Growth points
  const growthPoints: string[] = [];
  if (googlePotentialPerMonth > 0) growthPoints.push(`Потенциал Google: ~${googlePotentialPerMonth} кликов/мес. при доводке позиций 2–10 в топ-3.`);
  if (hasTopvisor && files.topvisor!.top100 - files.topvisor!.top10 > 0) growthPoints.push(`${files.topvisor!.top100 - files.topvisor!.top10} запросов в топ-100 (не в топ-10) — потенциал быстрых побед.`);
  if (project.works.blog && project.publishPace) growthPoints.push(`Плановые ${project.publishPace} публикаций/мес. создают базу для роста информационного трафика.`);
  if (project.works.links) growthPoints.push('Закупка ссылок ускорит рост позиций коммерческих запросов на 1–2 месяца.');
  if (project.works.tech) growthPoints.push('Техническое SEO снижает риск деиндексации и повышает потолок роста.');
  if (allDashes) growthPoints.push('Стартовая позиция — вне топ-100 по всем запросам; первый месяц заложен как «раскачка» (x0.1 от базового прироста).');

  return {
    baseTraffic: { yandex: yBase, google: gBase, bing: bBase, total: totalBase },
    scenarios,
    monthLabels,
    hasTopvisor,
    hasGsc,
    googlePotentialPerMonth,
    growthPoints,
  };
}