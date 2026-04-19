import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdminRole } from '@/hooks/useAdminRole';
import { AppHeader } from '@/components/AppHeader';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Settings, Users, BarChart3, Save, Loader2, Eye, EyeOff, ScrollText,
  ShieldCheck, CheckCircle2, XCircle, Activity, Zap, Clock, Mail, Send,
  Filter, TrendingUp, Globe, Layers, Calendar,
} from 'lucide-react';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { AdminOverviewTab } from '@/components/admin/AdminOverviewTab';
import { CopilotChatsTab } from '@/components/admin/CopilotChatsTab';
import { StatCard } from '@/components/dashboard/StatCard';
import { LayoutDashboard, MessageSquare } from 'lucide-react';

interface ApiSetting {
  id: string;
  key_name: string;
  key_value: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  display_name: string | null;
  credits: number;
  is_approved: boolean;
  created_at: string;
}

export default function AdminPage() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (!roleLoading && !isAdmin) navigate('/dashboard', { replace: true });
  }, [roleLoading, isAdmin, navigate]);

  if (roleLoading) return <div className="min-h-screen"><AppHeader /><div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8">
        <div className="flex items-baseline justify-between mb-6 flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Админ-панель</h1>
            <p className="text-sm text-muted-foreground mt-1">Управление платформой, пользователями и мониторинг системы</p>
          </div>
        </div>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="overview" className="gap-1.5"><LayoutDashboard className="w-4 h-4" /> Обзор</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Пользователи</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Статистика</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><ScrollText className="w-4 h-4" /> Логи анализов</TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5"><ShieldCheck className="w-4 h-4" /> Системная проверка</TabsTrigger>
            <TabsTrigger value="api" className="gap-1.5"><Settings className="w-4 h-4" /> API ключи</TabsTrigger>
          </TabsList>

          <TabsContent value="overview"><AdminOverviewTab /></TabsContent>
          <TabsContent value="api"><ApiSettingsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="logs"><AnalysisLogsTab /></TabsContent>
          <TabsContent value="system"><SystemCheckTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ─── API Settings Tab ─── */
function ApiSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<ApiSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [apiStatuses, setApiStatuses] = useState<Record<string, 'ok' | 'error' | 'checking' | 'unknown'>>({});

  useEffect(() => {
    supabase.from('system_settings').select('*').then(({ data }) => {
      if (data) setSettings(data as any);
      setLoading(false);
    });
  }, []);

  // Check API statuses on load
  useEffect(() => {
    if (settings.length === 0) return;
    const checkStatuses = async () => {
      const statuses: Record<string, 'ok' | 'error' | 'unknown'> = {};
      for (const s of settings) {
        statuses[s.key_name] = s.key_value && s.key_value.trim().length > 5 ? 'ok' : 'error';
      }
      setApiStatuses(statuses);
    };
    checkStatuses();
  }, [settings]);

  const updateSetting = (keyName: string, value: string) => {
    setSettings(prev => prev.map(s => s.key_name === keyName ? { ...s, key_value: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    // Параллельный апдейт всех ключей (раньше шло последовательно)
    await Promise.all(
      settings.map(s =>
        supabase.from('system_settings').update({ key_value: s.key_value, updated_at: new Date().toISOString() }).eq('key_name', s.key_name)
      )
    );
    setSaving(false);
    toast({ title: 'Настройки API успешно обновлены ✓' });
  };

  const keyLabels: Record<string, string> = {
    openai_api_key: 'OpenRouter API Key',
    serper_api_key: 'Serper.dev API Key',
    jina_api_key: 'Jina API Key',
    prodamus_api_key: 'Prodamus API Key',
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  // Ensure prodamus_api_key is in the list
  const allKeys = ['openai_api_key', 'serper_api_key', 'jina_api_key', 'prodamus_api_key'];
  const displaySettings = allKeys.map(key => {
    const existing = settings.find(s => s.key_name === key);
    return existing || { id: '', key_name: key, key_value: '' };
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">Управление ключами API. Изменения применяются мгновенно для всех Edge Functions.</p>
      {displaySettings.map(s => {
        const status = apiStatuses[s.key_name] || 'unknown';
        return (
          <div key={s.key_name} className="glass-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-foreground">{keyLabels[s.key_name] || s.key_name}</label>
              <div className="flex items-center gap-1.5">
                {status === 'ok' && <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />}
                {status === 'error' && <div className="w-2.5 h-2.5 rounded-full bg-red-500" />}
                {status === 'checking' && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                {status === 'unknown' && <div className="w-2.5 h-2.5 rounded-full bg-muted-foreground/50" />}
                <span className="text-[10px] text-muted-foreground">
                  {status === 'ok' ? 'Подключен' : status === 'error' ? 'Не настроен' : 'Проверка...'}
                </span>
              </div>
            </div>
            <div className="flex gap-2">
              <Input
                type={showKeys[s.key_name] ? 'text' : 'password'}
                value={s.key_value}
                onChange={e => updateSetting(s.key_name, e.target.value)}
                placeholder="Введите ключ..."
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowKeys(prev => ({ ...prev, [s.key_name]: !prev[s.key_name] }))}
              >
                {showKeys[s.key_name] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        );
      })}
      <Button onClick={handleSave} disabled={saving} className="btn-gradient border-0 gap-2">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        Сохранить настройки
      </Button>
    </div>
  );
}

/* ─── Users Tab ─── */
function UsersTab() {
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredits, setEditingCredits] = useState<Record<string, string>>({});
  const [userTab, setUserTab] = useState<'pending' | 'active'>('pending');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterActivity, setFilterActivity] = useState<string>('all');
  const [emailDialog, setEmailDialog] = useState<{ open: boolean; to: string; subject: string; body: string }>({ open: false, to: '', subject: '', body: '' });

  useEffect(() => {
    const load = async () => {
      const [usersRes, analysesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('analyses').select('user_id, status, created_at'),
      ]);
      if (usersRes.data) setUsers(usersRes.data as any);
      if (analysesRes.data) setAnalyses(analysesRes.data);
      setLoading(false);
    };
    load();
  }, []);

  // Pre-compute analysis stats per user to avoid O(N*M) filtering on every render
  const analysisStats = useMemo(() => {
    const counts: Record<string, number> = {};
    const lastDates: Record<string, Date> = {};
    for (const a of analyses) {
      counts[a.user_id] = (counts[a.user_id] || 0) + 1;
      const d = new Date(a.created_at);
      if (!lastDates[a.user_id] || d > lastDates[a.user_id]) lastDates[a.user_id] = d;
    }
    return { counts, lastDates };
  }, [analyses]);

  const getAnalysisCount = (userId: string) => analysisStats.counts[userId] || 0;
  const getLastActivity = (userId: string) => analysisStats.lastDates[userId] || null;

  const getPlan = (credits: number) => {
    if (credits >= 100) return 'AGENCY';
    if (credits >= 30) return 'PRO';
    if (credits >= 1) return 'STARTER';
    return 'FREE';
  };

  const isActiveRecently = (userId: string) => {
    const last = getLastActivity(userId);
    if (!last) return false;
    const daysDiff = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
    return daysDiff <= 30;
  };

  const handleCreditsUpdate = async (userId: string) => {
    const newCredits = parseInt(editingCredits[userId]);
    if (isNaN(newCredits)) return;
    await supabase.from('profiles').update({ credits: newCredits }).eq('user_id', userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, credits: newCredits } : u));
    setEditingCredits(prev => { const n = { ...prev }; delete n[userId]; return n; });
    toast({ title: `Кредиты обновлены: ${newCredits}` });
  };

  const handleApprove = async (userId: string, email: string | null) => {
    await supabase.from('profiles').update({ is_approved: true, credits: 1 }).eq('user_id', userId);
    setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, is_approved: true, credits: 1 } : u));
    toast({ title: `Пользователь ${email || userId} одобрен ✓` });
  };

  const openEmailDialog = (to: string) => {
    setEmailDialog({ open: true, to, subject: '', body: '' });
  };

  const openEmailAll = () => {
    const allEmails = activeUsers.filter(u => u.email).map(u => u.email!).join(', ');
    setEmailDialog({ open: true, to: allEmails, subject: '', body: '' });
  };

  const sendEmail = () => {
    window.location.href = `mailto:${emailDialog.to}?subject=${encodeURIComponent(emailDialog.subject)}&body=${encodeURIComponent(emailDialog.body)}`;
    setEmailDialog({ open: false, to: '', subject: '', body: '' });
  };

  const pendingUsers = useMemo(() => users.filter(u => !u.is_approved), [users]);
  const activeUsers = useMemo(() => users.filter(u => u.is_approved), [users]);

  const filteredActive = useMemo(() => activeUsers.filter(u => {
    if (filterPlan !== 'all' && getPlan(u.credits) !== filterPlan) return false;
    if (filterActivity === 'active' && !isActiveRecently(u.user_id)) return false;
    if (filterActivity === 'inactive' && isActiveRecently(u.user_id)) return false;
    return true;
  }), [activeUsers, filterPlan, filterActivity, analysisStats]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const displayUsers = userTab === 'pending' ? pendingUsers : filteredActive;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={userTab === 'pending' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUserTab('pending')}
            className={userTab === 'pending' ? 'btn-gradient border-0' : ''}
          >
            Ожидают ({pendingUsers.length})
          </Button>
          <Button
            variant={userTab === 'active' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setUserTab('active')}
            className={userTab === 'active' ? 'btn-gradient border-0' : ''}
          >
            Активные ({activeUsers.length})
          </Button>
        </div>
        {userTab === 'active' && (
          <div className="flex gap-2 items-center">
            <Select value={filterPlan} onValueChange={setFilterPlan}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <Filter className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Тариф" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все тарифы</SelectItem>
                <SelectItem value="FREE">FREE</SelectItem>
                <SelectItem value="STARTER">STARTER</SelectItem>
                <SelectItem value="PRO">PRO</SelectItem>
                <SelectItem value="AGENCY">AGENCY</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterActivity} onValueChange={setFilterActivity}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <Activity className="w-3 h-3 mr-1" />
                <SelectValue placeholder="Активность" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Вся активность</SelectItem>
                <SelectItem value="active">Активные (30д)</SelectItem>
                <SelectItem value="inactive">Неактивные</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={openEmailAll}>
              <Send className="w-3 h-3" /> Написать всем
            </Button>
          </div>
        )}
      </div>

      {userTab === 'pending' ? (
        /* Pending users - card view */
        <div className="space-y-2">
          {pendingUsers.length === 0 && (
            <div className="glass-card p-8 text-center text-muted-foreground">Нет пользователей, ожидающих активации.</div>
          )}
          {pendingUsers.map(u => (
            <div key={u.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.email || 'Нет email'}</p>
                <p className="text-xs text-muted-foreground">Регистрация: {new Date(u.created_at).toLocaleDateString('ru')}</p>
              </div>
              <Button size="sm" className="btn-gradient border-0 gap-1.5" onClick={() => handleApprove(u.user_id, u.email)}>
                <CheckCircle2 className="w-3.5 h-3.5" /> Одобрить
              </Button>
            </div>
          ))}
        </div>
      ) : (
        /* Active users - table view */
        <div className="glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Имя</TableHead>
                  <TableHead>Регистрация</TableHead>
                  <TableHead>Активность</TableHead>
                  <TableHead>Тариф</TableHead>
                  <TableHead className="text-center">Анализов</TableHead>
                  <TableHead className="text-center">Кредиты</TableHead>
                  <TableHead className="text-center">Статус</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayUsers.length === 0 && (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Нет пользователей</TableCell></TableRow>
                )}
                {displayUsers.map(u => {
                  const plan = getPlan(u.credits);
                  const isActive = isActiveRecently(u.user_id);
                  const lastAct = getLastActivity(u.user_id);
                  const count = getAnalysisCount(u.user_id);

                  return (
                    <TableRow key={u.id}>
                      <TableCell className="text-sm font-medium truncate max-w-[200px]">{u.email || '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.display_name || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString('ru')}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {lastAct ? lastAct.toLocaleDateString('ru') : 'Нет'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={plan === 'AGENCY' ? 'default' : plan === 'PRO' ? 'secondary' : 'outline'} className="text-[10px]">
                          {plan}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center text-sm font-medium">{count}</TableCell>
                      <TableCell className="text-center">
                        {editingCredits[u.user_id] !== undefined ? (
                          <div className="flex gap-1 justify-center">
                            <Input
                              type="number"
                              value={editingCredits[u.user_id]}
                              onChange={e => setEditingCredits(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                              className="w-16 h-7 text-xs"
                            />
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" onClick={() => handleCreditsUpdate(u.user_id)}>
                              <Save className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingCredits(prev => ({ ...prev, [u.user_id]: String(u.credits) }))}
                            className="text-sm font-bold text-accent hover:underline cursor-pointer"
                          >
                            {u.credits}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {isActive
                          ? <span className="inline-flex items-center gap-1 text-[10px] text-green-500"><span className="w-1.5 h-1.5 rounded-full bg-green-500" />Активен</span>
                          : <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />Неактивен</span>
                        }
                      </TableCell>
                      <TableCell>
                        {u.email && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEmailDialog(u.email!)}>
                            <Mail className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Email dialog */}
      <Dialog open={emailDialog.open} onOpenChange={(open) => !open && setEmailDialog(prev => ({ ...prev, open: false }))}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Mail className="w-4 h-4" /> Написать письмо</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Кому</label>
              <Input value={emailDialog.to} readOnly className="text-sm mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Тема</label>
              <Input
                value={emailDialog.subject}
                onChange={e => setEmailDialog(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Тема письма..."
                className="text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Сообщение</label>
              <textarea
                value={emailDialog.body}
                onChange={e => setEmailDialog(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Текст сообщения..."
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[120px] resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <Button onClick={sendEmail} className="btn-gradient border-0 gap-2 w-full">
              <Send className="w-4 h-4" /> Отправить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── Stats Tab ─── */
function StatsTab() {
  const [stats, setStats] = useState({ totalUsers: 0, totalAnalyses: 0, completedAnalyses: 0, todayAnalyses: 0, weekAnalyses: 0, monthAnalyses: 0 });
  const [topUrls, setTopUrls] = useState<{ url: string; count: number }[]>([]);
  const [topModules, setTopModules] = useState<{ module: string; count: number }[]>([]);
  const [regChart, setRegChart] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [analysesRes, profilesRes, resultsRes] = await Promise.all([
        supabase.from('analyses').select('id, url, status, created_at'),
        supabase.from('profiles').select('id, created_at'),
        supabase.from('analysis_results').select('tab_data'),
      ]);

      const allAnalyses = analysesRes.data || [];
      const allProfiles = profilesRes.data || [];
      const allResults = resultsRes.data || [];

      const completed = allAnalyses.filter(a => a.status === 'done' || a.status === 'completed').length;
      const today = allAnalyses.filter(a => a.created_at >= todayStart).length;
      const week = allAnalyses.filter(a => a.created_at >= weekStart).length;
      const month = allAnalyses.filter(a => a.created_at >= monthStart).length;

      setStats({
        totalUsers: allProfiles.length,
        totalAnalyses: allAnalyses.length,
        completedAnalyses: completed,
        todayAnalyses: today,
        weekAnalyses: week,
        monthAnalyses: month,
      });

      // Top URLs
      const urlCounts: Record<string, number> = {};
      allAnalyses.forEach(a => {
        try {
          const host = new URL(a.url).hostname;
          urlCounts[host] = (urlCounts[host] || 0) + 1;
        } catch { urlCounts[a.url] = (urlCounts[a.url] || 0) + 1; }
      });
      setTopUrls(
        Object.entries(urlCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([url, count]) => ({ url, count }))
      );

      // Top modules from tab_data
      const modCounts: Record<string, number> = {};
      allResults.forEach(r => {
        const td = r.tab_data as any;
        if (td && typeof td === 'object') {
          Object.keys(td).forEach(key => {
            if (key !== 'perfTiming' && key !== 'raw') {
              modCounts[key] = (modCounts[key] || 0) + 1;
            }
          });
        }
      });
      setTopModules(
        Object.entries(modCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([module, count]) => ({ module, count }))
      );

      // Registration chart (last 14 days)
      const days: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        days[d.toISOString().slice(0, 10)] = 0;
      }
      allProfiles.forEach(p => {
        const d = p.created_at.slice(0, 10);
        if (d in days) days[d]++;
      });
      setRegChart(Object.entries(days).map(([date, count]) => ({ date: date.slice(5), count })));

      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const statCards: { label: string; value: number; icon: typeof Users; accent: 'blue' | 'green' | 'teal' | 'violet' | 'amber' | 'pink' }[] = [
    { label: 'Всего пользователей', value: stats.totalUsers, icon: Users, accent: 'blue' },
    { label: 'Анализов за день', value: stats.todayAnalyses, icon: Calendar, accent: 'green' },
    { label: 'Анализов за неделю', value: stats.weekAnalyses, icon: TrendingUp, accent: 'teal' },
    { label: 'Анализов за месяц', value: stats.monthAnalyses, icon: BarChart3, accent: 'violet' },
    { label: 'Всего анализов', value: stats.totalAnalyses, icon: Layers, accent: 'amber' },
    { label: 'Завершённых', value: stats.completedAnalyses, icon: CheckCircle2, accent: 'pink' },
  ];

  const chartConfig = { count: { label: 'Регистрации', color: 'hsl(var(--primary))' } };

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map(c => (
          <StatCard key={c.label} label={c.label} value={c.value} icon={c.icon} accent={c.accent} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Registration chart */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Регистрации за 14 дней
          </h3>
          <ChartContainer config={chartConfig} className="h-[200px]">
            <BarChart data={regChart}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Top URLs */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Globe className="w-4 h-4 text-accent" /> Топ анализируемых доменов
          </h3>
          {topUrls.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет данных</p>
          ) : (
            <div className="space-y-2">
              {topUrls.map((item, i) => (
                <div key={item.url} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                    <span className="text-sm text-foreground truncate">{item.url}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] shrink-0">{item.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top modules */}
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" /> Топ используемых модулей
        </h3>
        {topModules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Нет данных</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {topModules.map(item => (
              <div key={item.module} className="flex items-center justify-between bg-secondary/30 rounded-lg px-3 py-2">
                <span className="text-sm text-foreground">{item.module}</span>
                <Badge variant="outline" className="text-[10px]">{item.count}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Analysis Logs Tab ─── */
function AnalysisLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [filterUser, setFilterUser] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  useEffect(() => {
    const load = async () => {
      const [analysesRes, profilesRes] = await Promise.all([
        supabase.from('analyses').select('id, url, status, created_at, user_id, page_type').order('created_at', { ascending: false }).limit(100),
        supabase.from('profiles').select('user_id, email, display_name'),
      ]);

      const analyses = analysesRes.data || [];
      const profs = profilesRes.data || [];
      const profMap: Record<string, string> = {};
      profs.forEach(p => { profMap[p.user_id] = p.email || p.display_name || p.user_id; });
      setProfiles(profMap);

      const ids = analyses.map(a => a.id);
      const { data: results } = await supabase
        .from('analysis_results')
        .select('analysis_id, scores, modules, tab_data, quick_wins')
        .in('analysis_id', ids);

      const resultsMap: Record<string, any> = {};
      for (const r of results || []) resultsMap[r.analysis_id] = r;

      setLogs(analyses.map(a => ({ ...a, result: resultsMap[a.id] || null })));
      setLoading(false);
    };
    load();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (filterUser) {
        const email = (profiles[log.user_id] || '').toLowerCase();
        if (!email.includes(filterUser.toLowerCase())) return false;
      }
      if (filterDateFrom && log.created_at < filterDateFrom) return false;
      if (filterDateTo && log.created_at > filterDateTo + 'T23:59:59') return false;
      return true;
    });
  }, [logs, filterUser, filterDateFrom, filterDateTo, profiles]);

  const getModulesUsed = (log: any): string[] => {
    if (!log.result?.tab_data || typeof log.result.tab_data !== 'object') return [];
    return Object.keys(log.result.tab_data).filter(k => k !== 'perfTiming' && k !== 'raw');
  };

  const getTimingMs = (log: any): number | null => {
    return (log.result?.tab_data as any)?.perfTiming?.total_ms || null;
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Последние 100 анализов с деталями модулей и времени выполнения.</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Пользователь</label>
          <Input
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            placeholder="Email..."
            className="w-[200px] h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Дата от</label>
          <Input
            type="date"
            value={filterDateFrom}
            onChange={e => setFilterDateFrom(e.target.value)}
            className="w-[150px] h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground uppercase">Дата до</label>
          <Input
            type="date"
            value={filterDateTo}
            onChange={e => setFilterDateTo(e.target.value)}
            className="w-[150px] h-8 text-xs mt-0.5"
          />
        </div>
        {(filterUser || filterDateFrom || filterDateTo) && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setFilterUser(''); setFilterDateFrom(''); setFilterDateTo(''); }}>
            Сбросить
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Пользователь</TableHead>
                <TableHead>URL</TableHead>
                <TableHead>Дата</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Модули</TableHead>
                <TableHead className="text-right">Время</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Нет записей</TableCell></TableRow>
              )}
              {filteredLogs.map(log => {
                const timingMs = getTimingMs(log);
                const totalSec = timingMs ? (timingMs / 1000).toFixed(1) : null;
                const isSlow = timingMs ? timingMs > 30000 : false;
                const modules = getModulesUsed(log);

                return (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground truncate max-w-[150px]">
                      {profiles[log.user_id] || log.user_id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="text-sm font-medium truncate max-w-[250px]">{log.url}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('ru', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs ${log.status === 'completed' || log.status === 'done' ? 'text-green-500' : log.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                        {log.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {modules.slice(0, 3).map(m => (
                          <Badge key={m} variant="outline" className="text-[9px] px-1 py-0">{m}</Badge>
                        ))}
                        {modules.length > 3 && <Badge variant="outline" className="text-[9px] px-1 py-0">+{modules.length - 3}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {totalSec && (
                        <Badge variant={isSlow ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                          {isSlow ? <Clock className="w-3 h-3 mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                          {totalSec}s
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs gap-1 h-7"
                        disabled={!log.result}
                        onClick={() => setSelectedLog(log)}
                      >
                        <Eye className="w-3 h-3" /> JSON
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* JSON Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">Лог: {selectedLog?.url}</DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="scores" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="mb-2">
              <TabsTrigger value="scores">Scores</TabsTrigger>
              <TabsTrigger value="modules">Modules</TabsTrigger>
              <TabsTrigger value="perf">Perf Timing</TabsTrigger>
              <TabsTrigger value="tabData">Tab Data</TabsTrigger>
              <TabsTrigger value="quickWins">Quick Wins</TabsTrigger>
            </TabsList>
            {['scores', 'modules', 'perf', 'tabData', 'quickWins'].map(key => (
              <TabsContent key={key} value={key} className="flex-1 overflow-auto">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-secondary/30 p-4 rounded-md max-h-[60vh] overflow-auto">
                  {JSON.stringify(
                    key === 'scores' ? selectedLog?.result?.scores :
                    key === 'modules' ? selectedLog?.result?.modules :
                    key === 'perf' ? (selectedLog?.result?.tab_data as any)?.perfTiming :
                    key === 'tabData' ? selectedLog?.result?.tab_data :
                    selectedLog?.result?.quick_wins,
                    null, 2
                  )}
                </pre>
              </TabsContent>
            ))}
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ─── System Check Tab ─── */
function SystemCheckTab() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<any>(null);

  const runCheck = async () => {
    setChecking(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await supabase.functions.invoke('system-check', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;
      setResult(res.data);
    } catch (e: any) {
      setResult({ overall: 'error', checks: [{ name: 'System', status: 'error', message: e.message, time_ms: 0 }] });
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Стресс-тест системы</h2>
          <p className="text-sm text-muted-foreground">Проверка соединений с API и базой данных</p>
        </div>
        <Button onClick={runCheck} disabled={checking} className="btn-gradient border-0 gap-2">
          {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}
          Run System Check
        </Button>
      </div>

      {result && (
        <div className="space-y-4">
          <div className={`glass-card p-6 text-center ${result.overall === 'ok' ? 'border-green-500/30' : 'border-red-500/30'}`}>
            {result.overall === 'ok' ? (
              <div className="flex items-center justify-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
                <span className="text-xl font-bold text-green-500">Все системы OK</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3">
                <XCircle className="w-8 h-8 text-red-500" />
                <span className="text-xl font-bold text-red-500">Обнаружены ошибки</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            {result.checks?.map((check: any, i: number) => (
              <div key={i} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {check.status === 'ok' ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground">{check.name}</p>
                    <p className="text-xs text-muted-foreground">{check.message}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{check.time_ms}ms</Badge>
              </div>
            ))}
          </div>

          {result.performance && (
            <div className="glass-card p-5 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                Производительность (последние 20 анализов)
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{result.performance.avgAnalysisTime}</div>
                  <div className="text-xs text-muted-foreground">Среднее время</div>
                </div>
                <div className="text-center">
                  <div className={`text-2xl font-bold ${result.performance.slowAnalyses > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {result.performance.slowAnalyses}
                  </div>
                  <div className="text-xs text-muted-foreground">Slow (&gt;30s)</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-foreground">{result.performance.totalRecent}</div>
                  <div className="text-xs text-muted-foreground">Всего проверено</div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
