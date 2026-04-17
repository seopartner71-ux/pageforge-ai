import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { StatCard } from '@/components/dashboard/StatCard';
import { ActivityChart } from '@/components/dashboard/ActivityChart';
import { useNavigate } from 'react-router-dom';
import {
  User, Key, Shield, Save, Building2, Activity, Coins, FileBarChart2,
  TrendingUp, Clock, ArrowUpRight, Loader2, CheckCircle2, AlertCircle,
} from 'lucide-react';

interface AnalysisRow {
  id: string;
  url: string;
  status: string;
  region: string;
  created_at: string;
}

export default function AccountPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [credits, setCredits] = useState(0);
  const [createdAt, setCreatedAt] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);

  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      setUserId(user.id);
      setEmail(user.email || '');

      const [profileRes, analysesRes] = await Promise.all([
        supabase.from('profiles').select('company_name, logo_url, credits, created_at').eq('user_id', user.id).maybeSingle(),
        supabase.from('analyses').select('id, url, status, region, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(500),
      ]);

      if (profileRes.data) {
        setCompanyName(profileRes.data.company_name || '');
        setLogoUrl(profileRes.data.logo_url || '');
        setCredits(profileRes.data.credits ?? 0);
        setCreatedAt(profileRes.data.created_at);
      }
      if (analysesRes.data) setAnalyses(analysesRes.data as AnalysisRow[]);
      setLoading(false);
    };
    load();
  }, []);

  // ─── Computed metrics ───
  const metrics = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const weekAgo = new Date(now.getTime() - 7 * 86400000);

    const total = analyses.length;
    const month = analyses.filter(a => new Date(a.created_at) >= monthStart).length;
    const prevMonth = analyses.filter(a => {
      const d = new Date(a.created_at);
      return d >= prevMonthStart && d < monthStart;
    }).length;
    const week = analyses.filter(a => new Date(a.created_at) >= weekAgo).length;
    const completed = analyses.filter(a => a.status === 'completed').length;
    const failed = analyses.filter(a => a.status === 'failed').length;
    const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const monthDelta = prevMonth > 0 ? Math.round(((month - prevMonth) / prevMonth) * 100) : (month > 0 ? 100 : 0);

    // 30-day chart
    const days: { date: string; count: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString(lang === 'ru' ? 'ru' : 'en', { day: '2-digit', month: 'short' });
      const count = analyses.filter(a => a.created_at.slice(0, 10) === key).length;
      days.push({ date: label, count });
    }

    return { total, month, prevMonth, week, completed, failed, successRate, monthDelta, days };
  }, [analyses, lang]);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: lang === 'ru' ? 'Пароль должен быть минимум 6 символов' : 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) toast({ title: error.message, variant: 'destructive' });
    else { toast({ title: lang === 'ru' ? 'Пароль обновлён' : 'Password updated' }); setNewPassword(''); }
    setSaving(false);
  };

  const handleSaveBranding = async () => {
    if (!userId) return;
    setBrandSaving(true);
    const { error } = await supabase.from('profiles').update({ company_name: companyName, logo_url: logoUrl } as any).eq('user_id', userId);
    if (error) toast({ title: error.message, variant: 'destructive' });
    else toast({ title: lang === 'ru' ? 'Брендинг сохранён' : 'Branding saved' });
    setBrandSaving(false);
  };

  const t = {
    overview: lang === 'ru' ? 'Обзор' : 'Overview',
    activity: lang === 'ru' ? 'Активность' : 'Activity',
    settings: lang === 'ru' ? 'Настройки' : 'Settings',
    branding: lang === 'ru' ? 'Брендинг' : 'Branding',
    totalAnalyses: lang === 'ru' ? 'Всего анализов' : 'Total analyses',
    monthAnalyses: lang === 'ru' ? 'За этот месяц' : 'This month',
    weekAnalyses: lang === 'ru' ? 'За 7 дней' : 'Last 7 days',
    creditsLeft: lang === 'ru' ? 'Кредитов осталось' : 'Credits left',
    successRate: lang === 'ru' ? 'Успешных' : 'Success rate',
    chart30d: lang === 'ru' ? 'Активность за 30 дней' : 'Activity (last 30 days)',
    recent: lang === 'ru' ? 'Последние анализы' : 'Recent analyses',
    viewAll: lang === 'ru' ? 'Вся история' : 'View all',
    noAnalyses: lang === 'ru' ? 'Анализов пока нет' : 'No analyses yet',
    runFirst: lang === 'ru' ? 'Запустить первый анализ' : 'Run your first analysis',
    accountSince: lang === 'ru' ? 'Аккаунт создан' : 'Member since',
    profile: lang === 'ru' ? 'Профиль' : 'Profile',
    security: lang === 'ru' ? 'Безопасность' : 'Security',
    newPassword: lang === 'ru' ? 'Новый пароль' : 'New password',
    changePassword: lang === 'ru' ? 'Изменить пароль' : 'Change password',
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-6 space-y-6">
        {/* Header with greeting */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">{lang === 'ru' ? 'Личный кабинет' : 'Account'}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {email}
              {createdAt && (
                <span className="ml-3 text-xs">
                  · {t.accountSince} {new Date(createdAt).toLocaleDateString(lang === 'ru' ? 'ru' : 'en', { month: 'long', year: 'numeric' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 py-1.5">
              <Coins className="w-3.5 h-3.5 text-primary" />
              <span className="font-medium tabular-nums">{credits}</span>
              <span className="text-muted-foreground">{lang === 'ru' ? 'кредитов' : 'credits'}</span>
            </Badge>
          </div>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview" className="gap-1.5"><Activity className="w-3.5 h-3.5" /> {t.overview}</TabsTrigger>
            <TabsTrigger value="settings" className="gap-1.5"><Shield className="w-3.5 h-3.5" /> {t.settings}</TabsTrigger>
            <TabsTrigger value="branding" className="gap-1.5"><Building2 className="w-3.5 h-3.5" /> {t.branding}</TabsTrigger>
          </TabsList>

          {/* ─── OVERVIEW ─── */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* KPI grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <StatCard label={t.totalAnalyses} value={metrics.total} icon={FileBarChart2} />
              <StatCard
                label={t.monthAnalyses}
                value={metrics.month}
                delta={metrics.prevMonth > 0 || metrics.month > 0 ? { value: metrics.monthDelta } : null}
                icon={TrendingUp}
              />
              <StatCard label={t.weekAnalyses} value={metrics.week} icon={Clock} />
              <StatCard label={t.creditsLeft} value={credits} icon={Coins} hint={lang === 'ru' ? '1 анализ = 1 кредит' : '1 analysis = 1 credit'} />
              <StatCard
                label={t.successRate}
                value={`${metrics.successRate}%`}
                icon={CheckCircle2}
                hint={`${metrics.completed}/${metrics.total} ${lang === 'ru' ? 'успешно' : 'completed'}`}
              />
            </div>

            {/* Chart + Recent */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{t.chart30d}</h3>
                  <Badge variant="secondary" className="text-[10px]">30D</Badge>
                </div>
                <ActivityChart data={metrics.days} />
              </div>

              <div className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-foreground">{t.recent}</h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => navigate('/history')}>
                    {t.viewAll} <ArrowUpRight className="w-3 h-3" />
                  </Button>
                </div>
                {analyses.length === 0 ? (
                  <div className="text-center py-8 space-y-3">
                    <p className="text-xs text-muted-foreground">{t.noAnalyses}</p>
                    <Button size="sm" className="btn-gradient border-0" onClick={() => navigate('/dashboard')}>
                      {t.runFirst}
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-2.5">
                    {analyses.slice(0, 6).map(a => {
                      let host = a.url;
                      try { host = new URL(a.url).hostname.replace(/^www\./, ''); } catch {}
                      const statusColor = a.status === 'completed' ? 'bg-emerald-500' : a.status === 'failed' ? 'bg-rose-500' : 'bg-amber-500';
                      return (
                        <li
                          key={a.id}
                          onClick={() => navigate(`/report/${a.id}`)}
                          className="flex items-center gap-2.5 cursor-pointer group p-1.5 -mx-1.5 rounded hover:bg-muted/50 transition-colors"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${statusColor} shrink-0`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate group-hover:text-primary transition-colors">{host}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(a.created_at).toLocaleDateString(lang === 'ru' ? 'ru' : 'en', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          {a.region && <Badge variant="outline" className="text-[9px] py-0 px-1.5 shrink-0">{a.region.toUpperCase()}</Badge>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Status breakdown */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.completed}</p>
                  <p className="text-[11px] text-muted-foreground">{lang === 'ru' ? 'Завершено' : 'Completed'}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.total - metrics.completed - metrics.failed}</p>
                  <p className="text-[11px] text-muted-foreground">{lang === 'ru' ? 'В процессе' : 'In progress'}</p>
                </div>
              </div>
              <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums text-foreground">{metrics.failed}</p>
                  <p className="text-[11px] text-muted-foreground">{lang === 'ru' ? 'С ошибкой' : 'Failed'}</p>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ─── SETTINGS ─── */}
          <TabsContent value="settings" className="space-y-4 mt-6 max-w-2xl">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t.profile}</h2>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                <Input value={email} disabled className="opacity-70" />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">{t.security}</h2>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">{t.newPassword}</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={handleChangePassword} disabled={saving} className="btn-gradient border-0 gap-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {t.changePassword}
              </Button>
            </div>
          </TabsContent>

          {/* ─── BRANDING ─── */}
          <TabsContent value="branding" className="space-y-4 mt-6 max-w-2xl">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  {lang === 'ru' ? 'White Label брендинг' : 'White Label Branding'}
                </h2>
              </div>
              <p className="text-xs text-muted-foreground">
                {lang === 'ru'
                  ? 'Эти данные будут использоваться в Excel-отчётах вместо стандартного брендинга.'
                  : 'This data will be used in Excel reports instead of default branding.'}
              </p>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  {lang === 'ru' ? 'Название компании' : 'Company name'}
                </label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder={lang === 'ru' ? 'Моё SEO-агентство' : 'My SEO Agency'} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">
                  {lang === 'ru' ? 'URL логотипа' : 'Logo URL'}
                </label>
                <Input value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://example.com/logo.png" />
                <p className="text-[11px] text-muted-foreground mt-1">
                  {lang === 'ru' ? 'Прямая ссылка на PNG/SVG' : 'Direct link to PNG/SVG'}
                </p>
              </div>
              <Button onClick={handleSaveBranding} disabled={brandSaving} className="btn-gradient border-0 gap-2">
                {brandSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {lang === 'ru' ? 'Сохранить' : 'Save'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
