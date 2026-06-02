import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { DateRange } from 'react-day-picker';
import { seedAdsDemoData } from './seedDemoData';

export interface AccountRow {
  id: string;
  name: string;
  external_id: string;
  is_primary: boolean;
}

export interface CampaignAgg {
  id: string;
  name: string;
  status: string;
  spend: number;
  conversions: number;
  cpl: number;
}

export interface DailyPoint {
  date: string;
  spend: number;
  conversions: number;
  clicks: number;
  impressions: number;
  revenue: number;
}

export interface AccountAgg {
  id: string;
  name: string;
  external_id: string;
  spend: number;
  conversions: number;
  cpl: number;
  romi: number;
  score: number;
  problems: number;
  loss: number;
}

export interface AlertRow {
  id: string;
  severity: string;
  text: string;
  impact_value: number;
  impact_positive: boolean;
}

export interface RecRow {
  id: string;
  text: string;
  savings: number;
  cta: string;
  status: string;
}

export interface SearchQueryRow {
  id: string;
  query: string;
  spend: number;
  conversions: number;
}

export interface AxisRow { axis: string; value: number; }

function fmtDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function pctDelta(curr: number, prev: number): number {
  if (!prev) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100);
}

export function useAdsDashboard(dateRange: DateRange | undefined) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignAgg[]>([]);
  const [daily, setDaily] = useState<DailyPoint[]>([]);
  const [prevDaily, setPrevDaily] = useState<DailyPoint[]>([]);
  const [accountAggs, setAccountAggs] = useState<AccountAgg[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [queries, setQueries] = useState<SearchQueryRow[]>([]);
  const [axes, setAxes] = useState<AxisRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Авто-сидирование, если нет кабинетов
      const { data: existingAccs } = await supabase.from('ads_accounts').select('id').eq('user_id', user.id).limit(1);
      if (!existingAccs || existingAccs.length === 0) {
        const { data: project } = await supabase
          .from('projects')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();
        let projectId = project?.id;
        if (!projectId) {
          const { data: created } = await supabase
            .from('projects')
            .insert({ name: 'Реклама — демо', domain: '', user_id: user.id })
            .select('id').single();
          projectId = created?.id;
        }
        if (projectId) await seedAdsDemoData(user.id, projectId);
      }

      const from = dateRange?.from ?? new Date(Date.now() - 7 * 86400000);
      const to = dateRange?.to ?? dateRange?.from ?? new Date();
      const fromStr = fmtDate(from);
      const toStr = fmtDate(to);
      const periodDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
      const prevFrom = new Date(from); prevFrom.setDate(prevFrom.getDate() - periodDays);
      const prevTo = new Date(from); prevTo.setDate(prevTo.getDate() - 1);

      const [
        accRes, campRes, metricsRes, prevMetricsRes,
        alertsRes, recsRes, queriesRes, axesRes,
      ] = await Promise.all([
        supabase.from('ads_accounts').select('id, name, external_id, is_primary').eq('user_id', user.id).order('is_primary', { ascending: false }),
        supabase.from('ads_campaigns').select('id, name, status, account_id').eq('user_id', user.id),
        supabase.from('ads_daily_metrics').select('date, spend, conversions, clicks, impressions, revenue, account_id, campaign_id').eq('user_id', user.id).gte('date', fromStr).lte('date', toStr),
        supabase.from('ads_daily_metrics').select('spend, conversions, clicks, impressions, revenue').eq('user_id', user.id).gte('date', fmtDate(prevFrom)).lte('date', fmtDate(prevTo)),
        supabase.from('ads_alerts').select('id, severity, text, impact_value, impact_positive').eq('user_id', user.id).eq('is_resolved', false).order('created_at', { ascending: false }),
        supabase.from('ads_recommendations').select('id, text, savings, cta, status').eq('user_id', user.id).order('created_at', { ascending: false }),
        supabase.from('ads_search_queries').select('id, query, spend, conversions').eq('user_id', user.id).eq('is_negative', false).order('spend', { ascending: false }).limit(8),
        supabase.from('ads_audit_axes').select('axis, value, account_id').eq('user_id', user.id),
      ]);

      if (accRes.error) throw accRes.error;
      const accs = (accRes.data ?? []) as AccountRow[];
      setAccounts(accs);
      const primaryId = accs.find(a => a.is_primary)?.id ?? accs[0]?.id;

      // Daily metrics — общая агрегация по дате
      const allMetrics = (metricsRes.data ?? []) as any[];
      const byDate = new Map<string, DailyPoint>();
      for (const m of allMetrics) {
        const cur = byDate.get(m.date) ?? { date: m.date, spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 };
        cur.spend += Number(m.spend);
        cur.conversions += m.conversions;
        cur.clicks += m.clicks;
        cur.impressions += m.impressions;
        cur.revenue += Number(m.revenue);
        byDate.set(m.date, cur);
      }
      const dailyArr = Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
      setDaily(dailyArr);

      // Prev period totals
      const prevTotals = (prevMetricsRes.data ?? []).reduce<DailyPoint>((acc, m: any) => ({
        date: '',
        spend: acc.spend + Number(m.spend),
        conversions: acc.conversions + m.conversions,
        clicks: acc.clicks + m.clicks,
        impressions: acc.impressions + m.impressions,
        revenue: acc.revenue + Number(m.revenue),
      }), { date: '', spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 });
      setPrevDaily([prevTotals]);

      // Campaigns — топ-5 по кампаниям primary-кабинета
      const allCamps = (campRes.data ?? []) as any[];
      const campAggMap = new Map<string, { spend: number; conversions: number }>();
      for (const m of allMetrics) {
        if (!m.campaign_id) continue;
        const c = campAggMap.get(m.campaign_id) ?? { spend: 0, conversions: 0 };
        c.spend += Number(m.spend);
        c.conversions += m.conversions;
        campAggMap.set(m.campaign_id, c);
      }
      const campAgg: CampaignAgg[] = allCamps
        .filter(c => c.account_id === primaryId)
        .map(c => {
          const a = campAggMap.get(c.id) ?? { spend: 0, conversions: 0 };
          return {
            id: c.id, name: c.name, status: c.status,
            spend: a.spend, conversions: a.conversions,
            cpl: a.conversions > 0 ? Math.round(a.spend / a.conversions) : 0,
          };
        })
        .sort((a, b) => b.spend - a.spend)
        .slice(0, 5);
      setCampaigns(campAgg);

      // Per-account aggregates
      const accAggMap = new Map<string, { spend: number; conversions: number; revenue: number }>();
      for (const m of allMetrics) {
        const a = accAggMap.get(m.account_id) ?? { spend: 0, conversions: 0, revenue: 0 };
        a.spend += Number(m.spend);
        a.conversions += m.conversions;
        a.revenue += Number(m.revenue);
        accAggMap.set(m.account_id, a);
      }
      const accAggs: AccountAgg[] = accs.map((a, idx) => {
        const v = accAggMap.get(a.id) ?? { spend: 0, conversions: 0, revenue: 0 };
        const cpl = v.conversions > 0 ? Math.round(v.spend / v.conversions) : 0;
        const romi = v.spend > 0 ? Math.round(((v.revenue - v.spend) / v.spend) * 100) : 0;
        return {
          id: a.id, name: a.name, external_id: a.external_id,
          spend: v.spend, conversions: v.conversions, cpl, romi,
          score: [84, 71, 92, 64][idx] ?? 75,
          problems: [5, 8, 2, 11][idx] ?? 4,
          loss: [12600, 9200, 2100, 14800][idx] ?? 3000,
        };
      });
      setAccountAggs(accAggs);

      setAlerts((alertsRes.data ?? []) as AlertRow[]);
      setRecs((recsRes.data ?? []) as RecRow[]);
      setQueries((queriesRes.data ?? []) as SearchQueryRow[]);
      // Радар — только для primary
      const axesAll = (axesRes.data ?? []) as any[];
      setAxes(axesAll.filter(a => a.account_id === primaryId).map(a => ({ axis: a.axis, value: a.value })));
    } catch (e: any) {
      console.error('[ads dashboard] load error', e);
      setError(e?.message ?? 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.from, dateRange?.to]);

  useEffect(() => { load(); }, [load]);

  // Totals + дельты
  const totals = daily.reduce((acc, d) => ({
    spend: acc.spend + d.spend,
    conversions: acc.conversions + d.conversions,
    clicks: acc.clicks + d.clicks,
    impressions: acc.impressions + d.impressions,
    revenue: acc.revenue + d.revenue,
  }), { spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 });

  const prev = prevDaily[0] ?? { spend: 0, conversions: 0, clicks: 0, impressions: 0, revenue: 0 };
  const cpl = totals.conversions > 0 ? Math.round(totals.spend / totals.conversions) : 0;
  const prevCpl = prev.conversions > 0 ? Math.round(prev.spend / prev.conversions) : 0;
  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
  const prevCtr = prev.impressions > 0 ? (prev.clicks / prev.impressions) * 100 : 0;
  const romi = totals.spend > 0 ? Math.round(((totals.revenue - totals.spend) / totals.spend) * 100) : 0;
  const prevRomi = prev.spend > 0 ? Math.round(((prev.revenue - prev.spend) / prev.spend) * 100) : 0;

  const kpis = [
    { key: 'spend',       label: 'Расход',        value: `${totals.spend.toLocaleString('ru-RU')} ₽`, delta: pctDelta(totals.spend, prev.spend) },
    { key: 'conversions', label: 'Конверсии',     value: String(totals.conversions),                    delta: pctDelta(totals.conversions, prev.conversions) },
    { key: 'cpl',         label: 'CPL',           value: `${cpl.toLocaleString('ru-RU')} ₽`,            delta: -pctDelta(cpl, prevCpl) }, // меньше = лучше
    { key: 'ctr',         label: 'CTR средний',   value: `${ctr.toFixed(2)}%`,                          delta: pctDelta(Math.round(ctr * 100), Math.round(prevCtr * 100)) },
    { key: 'romi',        label: 'ROMI',          value: `${romi}%`,                                    delta: pctDelta(romi, prevRomi) },
  ];

  return {
    loading, error,
    accounts, campaigns, daily, accountAggs,
    alerts, recs, queries, axes,
    kpis, totals,
    reload: load,
    setRecs, setQueries, setAlerts,
  };
}