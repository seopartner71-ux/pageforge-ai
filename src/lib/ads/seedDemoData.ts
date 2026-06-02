import { supabase } from '@/integrations/supabase/client';

/**
 * Сидирует демо-данные модуля «Реклама» за последние 90 дней
 * для указанного пользователя и проекта. Идемпотентно: если у
 * пользователя уже есть ads_accounts, ничего не делает.
 */
export async function seedAdsDemoData(userId: string, projectId: string) {
  // Проверяем, есть ли уже кабинеты
  const { count } = await supabase
    .from('ads_accounts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if ((count ?? 0) > 0) return false;

  // 1. Кабинеты
  const accountsSeed = [
    { name: 'Главный кабинет', external_id: '8123-44-21', is_primary: true },
    { name: 'Клиент: Аптека+', external_id: '7711-09-02', is_primary: false },
    { name: 'Клиент: AutoPro', external_id: '6620-77-15', is_primary: false },
    { name: 'Клиент: EduMax', external_id: '5520-31-88', is_primary: false },
  ];
  const { data: accounts, error: accErr } = await supabase
    .from('ads_accounts')
    .insert(accountsSeed.map(a => ({ ...a, user_id: userId, project_id: projectId, provider: 'yandex_direct' })))
    .select('id, name, is_primary');
  if (accErr || !accounts) throw accErr;

  const primary = accounts.find(a => a.is_primary) ?? accounts[0];

  // 2. Кампании для главного кабинета
  const campaignSeed = [
    { name: 'Поиск / Москва', status: 'working' },
    { name: 'РСЯ / Ретаргет', status: 'limited' },
    { name: 'Поиск / Регионы', status: 'working' },
    { name: 'Мастер кампаний', status: 'low_ctr' },
    { name: 'Бренд', status: 'working' },
  ];
  const { data: campaigns, error: campErr } = await supabase
    .from('ads_campaigns')
    .insert(campaignSeed.map(c => ({ ...c, user_id: userId, account_id: primary.id })))
    .select('id, name');
  if (campErr || !campaigns) throw campErr;

  // 3. Ежедневные метрики за 90 дней — по каждой кампании каждого кабинета
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const metricRows: any[] = [];
  for (const acc of accounts) {
    // Для не-главных кабинетов сгенерируем 1 «общую» кампанию-агрегатор
    const campIds = acc.id === primary.id
      ? campaigns.map(c => c.id)
      : [null];
    for (let i = 89; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const iso = date.toISOString().slice(0, 10);
      const weekday = date.getDay();
      const weekFactor = (weekday === 0 || weekday === 6) ? 0.55 : 1;
      for (const cid of campIds) {
        const seed = (acc.id.charCodeAt(0) + (cid?.charCodeAt(0) ?? 0) + i) % 7;
        const base = 600 + seed * 180 + Math.sin(i / 4) * 220;
        const spend = Math.max(120, Math.round(base * weekFactor + Math.random() * 220));
        const impressions = Math.round(spend * (12 + Math.random() * 8));
        const clicks = Math.round(impressions * (0.018 + Math.random() * 0.012));
        const conversions = Math.max(0, Math.round(clicks * (0.045 + Math.random() * 0.04)));
        const revenue = Math.round(conversions * (1800 + Math.random() * 1400));
        metricRows.push({
          user_id: userId,
          account_id: acc.id,
          campaign_id: cid,
          date: iso,
          spend, conversions, clicks, impressions, revenue,
        });
      }
    }
  }
  // Чанки по 500 строк (PostgREST лимит)
  for (let i = 0; i < metricRows.length; i += 500) {
    const chunk = metricRows.slice(i, i + 500);
    const { error } = await supabase.from('ads_daily_metrics').insert(chunk);
    if (error) throw error;
  }

  // 4. Поисковые запросы
  const queries = [
    { query: 'купить бесплатно', spend: 1240, conversions: 0 },
    { query: 'скачать торрент', spend: 980, conversions: 0 },
    { query: 'работа удаленно', spend: 760, conversions: 1 },
    { query: 'отзывы форум', spend: 540, conversions: 0 },
    { query: 'своими руками', spend: 420, conversions: 0 },
    { query: 'вакансии', spend: 360, conversions: 0 },
  ];
  await supabase.from('ads_search_queries').insert(
    queries.map(q => ({ ...q, user_id: userId, account_id: primary.id, date: today.toISOString().slice(0, 10) }))
  );

  // 5. Алерты
  const alerts = [
    { severity: 'red', text: 'Кампания «Поиск / Москва» ограничена бюджетом', impact_value: 8700, impact_positive: false },
    { severity: 'yellow', text: 'Объявления группы «РСЯ-Ретаргет» с низким CTR', impact_value: 2300, impact_positive: false },
    { severity: 'blue', text: 'Найдены минус-слова для группы «Услуги»', impact_value: 1200, impact_positive: true },
    { severity: 'emerald', text: 'Стратегия «Макс. конверсий» работает стабильно', impact_value: 4500, impact_positive: true },
    { severity: 'yellow', text: 'Снижается доля показов на мобильных', impact_value: 1600, impact_positive: false },
  ];
  await supabase.from('ads_alerts').insert(
    alerts.map(a => ({ ...a, user_id: userId, account_id: primary.id }))
  );

  // 6. AI-рекомендации
  const recs = [
    { text: 'Добавьте 12 минус-слов в группу «Услуги»', savings: 8700, cta: 'Применить' },
    { text: 'Перераспределить бюджет с РСЯ на Поиск', savings: 5400, cta: 'Применить' },
    { text: 'Сгенерировать 6 новых объявлений для группы «Москва»', savings: 3100, cta: 'Сгенерировать' },
    { text: 'Включить корректировки −20% для мобильных в ночное время', savings: 1800, cta: 'Применить' },
  ];
  await supabase.from('ads_recommendations').insert(
    recs.map(r => ({ ...r, user_id: userId, account_id: primary.id, status: 'idle' }))
  );

  // 7. AI-аудит (радар)
  const axesSeed: Record<string, number[]> = {
    'Настройки':  [88, 71, 92, 64],
    'Объявления': [72, 65, 88, 58],
    'Стратегии':  [90, 74, 95, 62],
    'Конверсии':  [81, 68, 89, 55],
    'Аудитории':  [76, 70, 84, 60],
  };
  const axesRows: any[] = [];
  accounts.forEach((acc, idx) => {
    Object.entries(axesSeed).forEach(([axis, values]) => {
      axesRows.push({ user_id: userId, account_id: acc.id, axis, value: values[idx] ?? 70 });
    });
  });
  await supabase.from('ads_audit_axes').insert(axesRows);

  return true;
}