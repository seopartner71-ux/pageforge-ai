import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { Loader2, Users, FileBarChart2, CheckCircle2, Clock, TrendingUp, AlertCircle, UserCheck, Zap, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function AdminOverviewTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    totalUsers: number; pendingUsers: number; approvedUsers: number;
    newUsers7d: number; newUsersPrev7d: number;
    activeUsers30d: number;
    totalAnalyses: number; analyses7d: number; analysesPrev7d: number;
    completed: number; failed: number; inProgress: number;
    avgDurationSec: number;
    chartUsers: { date: string; count: number }[];
    chartAnalyses: { date: string; count: number }[];
    topDomains: { host: string; count: number }[];
  } | null>(null);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const ms = (d: number) => new Date(now.getTime() - d * 86400000);

      const [profilesRes, analysesRes, resultsRes] = await Promise.all([
        supabase.from('profiles').select('user_id, is_approved, created_at'),
        supabase.from('analyses').select('id, url, status, created_at, user_id'),
        supabase.from('analysis_results').select('analysis_id, tab_data').limit(500),
      ]);
      const profiles = profilesRes.data || [];
      const analyses = analysesRes.data || [];
      const results = resultsRes.data || [];

      const pending = profiles.filter(p => !p.is_approved).length;
      const approved = profiles.length - pending;
      const newUsers7d = profiles.filter(p => new Date(p.created_at) >= ms(7)).length;
      const newUsersPrev7d = profiles.filter(p => {
        const d = new Date(p.created_at);
        return d >= ms(14) && d < ms(7);
      }).length;

      const activeUserIds = new Set(analyses.filter(a => new Date(a.created_at) >= ms(30)).map(a => a.user_id));
      const activeUsers30d = activeUserIds.size;

      const analyses7d = analyses.filter(a => new Date(a.created_at) >= ms(7)).length;
      const analysesPrev7d = analyses.filter(a => {
        const d = new Date(a.created_at);
        return d >= ms(14) && d < ms(7);
      }).length;

      const completed = analyses.filter(a => a.status === 'completed' || a.status === 'done').length;
      const failed = analyses.filter(a => a.status === 'failed' || a.status === 'error').length;
      const inProgress = analyses.length - completed - failed;

      const durations = results
        .map(r => (r.tab_data as any)?.perfTiming?.total_ms)
        .filter((x: any) => typeof x === 'number' && x > 0);
      const avgDurationSec = durations.length
        ? Math.round(durations.reduce((s: number, x: number) => s + x, 0) / durations.length / 1000)
        : 0;

      // 30-day series
      const usersDays: Record<string, number> = {};
      const analysesDays: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const key = ms(i).toISOString().slice(0, 10);
        usersDays[key] = 0;
        analysesDays[key] = 0;
      }
      profiles.forEach(p => {
        const k = p.created_at.slice(0, 10);
        if (k in usersDays) usersDays[k]++;
      });
      analyses.forEach(a => {
        const k = a.created_at.slice(0, 10);
        if (k in analysesDays) analysesDays[k]++;
      });
      const fmt = (k: string) => new Date(k).toLocaleDateString('ru', { day: '2-digit', month: 'short' });
      const chartUsers = Object.entries(usersDays).map(([date, count]) => ({ date: fmt(date), count }));
      const chartAnalyses = Object.entries(analysesDays).map(([date, count]) => ({ date: fmt(date), count }));

      // Top domains
      const domainCount: Record<string, number> = {};
      analyses.forEach(a => {
        try {
          const h = new URL(a.url).hostname.replace(/^www\./, '');
          domainCount[h] = (domainCount[h] || 0) + 1;
        } catch {}
      });
      const topDomains = Object.entries(domainCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([host, count]) => ({ host, count }));

      setData({
        totalUsers: profiles.length, pendingUsers: pending, approvedUsers: approved,
        newUsers7d, newUsersPrev7d, activeUsers30d,
        totalAnalyses: analyses.length, analyses7d, analysesPrev7d,
        completed, failed, inProgress,
        avgDurationSec,
        chartUsers, chartAnalyses, topDomains,
      });
      setLoading(false);
    };
    load();
  }, []);

  const userDelta = useMemo(() => {
    if (!data) return 0;
    const { newUsers7d, newUsersPrev7d } = data;
    if (newUsersPrev7d === 0) return newUsers7d > 0 ? 100 : 0;
    return Math.round(((newUsers7d - newUsersPrev7d) / newUsersPrev7d) * 100);
  }, [data]);

  const analysisDelta = useMemo(() => {
    if (!data) return 0;
    const { analyses7d, analysesPrev7d } = data;
    if (analysesPrev7d === 0) return analyses7d > 0 ? 100 : 0;
    return Math.round(((analyses7d - analysesPrev7d) / analysesPrev7d) * 100);
  }, [data]);

  if (loading || !data) {
    return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  }

  const successRate = data.totalAnalyses > 0 ? Math.round((data.completed / data.totalAnalyses) * 100) : 0;
  const approvalRate = data.totalUsers > 0 ? Math.round((data.approvedUsers / data.totalUsers) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard label="Всего пользователей" value={data.totalUsers} icon={Users} />
        <StatCard label="Новых за 7д" value={data.newUsers7d} delta={{ value: userDelta }} icon={TrendingUp} />
        <StatCard label="Активных (30д)" value={data.activeUsers30d} icon={UserCheck} hint={`${data.totalUsers > 0 ? Math.round(data.activeUsers30d / data.totalUsers * 100) : 0}% базы`} />
        <StatCard label="Ожидают одобрения" value={data.pendingUsers} icon={AlertCircle} hint={`${approvalRate}% одобрено`} />
        <StatCard label="Анализов всего" value={data.totalAnalyses} icon={FileBarChart2} />
        <StatCard label="За 7 дней" value={data.analyses7d} delta={{ value: analysisDelta }} icon={Zap} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> Регистрации (30 дней)
            </h3>
            <Badge variant="secondary" className="text-[10px]">30D</Badge>
          </div>
          <ActivityChart data={data.chartUsers} color="hsl(var(--primary))" />
        </div>
        <div className="rounded-lg border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FileBarChart2 className="w-4 h-4 text-primary" /> Анализы (30 дней)
            </h3>
            <Badge variant="secondary" className="text-[10px]">30D</Badge>
          </div>
          <ActivityChart data={data.chartAnalyses} color="hsl(var(--primary))" />
        </div>
      </div>

      {/* Health + Top domains */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">Здоровье анализов</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">Завершено</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{data.completed}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs text-muted-foreground">В процессе</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{data.inProgress}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-xs text-muted-foreground">С ошибкой</span>
              </div>
              <span className="text-sm font-semibold tabular-nums text-foreground">{data.failed}</span>
            </div>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Success rate</span>
                <span className="text-sm font-semibold tabular-nums text-emerald-500">{successRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Ср. длительность</span>
                <span className="text-sm font-semibold tabular-nums text-foreground">{data.avgDurationSec}s</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" /> Топ анализируемых доменов
          </h3>
          {data.topDomains.length === 0 ? (
            <p className="text-xs text-muted-foreground">Нет данных</p>
          ) : (
            <div className="space-y-2.5">
              {data.topDomains.map((d, i) => {
                const max = data.topDomains[0].count;
                const pct = (d.count / max) * 100;
                return (
                  <div key={d.host} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-foreground font-medium">
                        <span className="text-muted-foreground mr-2">{i + 1}.</span>{d.host}
                      </span>
                      <span className="text-muted-foreground tabular-nums">{d.count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
