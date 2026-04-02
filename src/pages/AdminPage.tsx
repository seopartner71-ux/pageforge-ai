import { useState, useEffect } from 'react';
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
import {
  Settings, Users, BarChart3, Save, Loader2, Eye, EyeOff, ScrollText,
  ShieldCheck, CheckCircle2, XCircle, Activity, Zap, Clock,
} from 'lucide-react';

interface ApiSetting {
  id: string;
  key_name: string;
  key_value: string;
}

interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
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
        <h1 className="text-2xl font-bold text-foreground mb-6">Админ-панель</h1>
        <Tabs defaultValue="api" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="api" className="gap-1.5"><Settings className="w-4 h-4" /> Настройки API</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5"><Users className="w-4 h-4" /> Пользователи</TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5"><BarChart3 className="w-4 h-4" /> Статистика</TabsTrigger>
            <TabsTrigger value="logs" className="gap-1.5"><ScrollText className="w-4 h-4" /> Логи анализов</TabsTrigger>
            <TabsTrigger value="system" className="gap-1.5"><ShieldCheck className="w-4 h-4" /> Системная проверка</TabsTrigger>
          </TabsList>

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

  useEffect(() => {
    supabase.from('system_settings').select('*').then(({ data }) => {
      if (data) setSettings(data as any);
      setLoading(false);
    });
  }, []);

  const updateSetting = (keyName: string, value: string) => {
    setSettings(prev => prev.map(s => s.key_name === keyName ? { ...s, key_value: value } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    for (const s of settings) {
      await supabase.from('system_settings').update({ key_value: s.key_value, updated_at: new Date().toISOString() }).eq('key_name', s.key_name);
    }
    setSaving(false);
    toast({ title: 'Настройки API успешно обновлены ✓' });
  };

  const keyLabels: Record<string, string> = {
    openai_api_key: 'OpenRouter API Key',
    serper_api_key: 'Serper.dev API Key',
    jina_api_key: 'Jina API Key',
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <p className="text-sm text-muted-foreground">Управление ключами API. Изменения применяются мгновенно для всех Edge Functions.</p>
      {settings.map(s => (
        <div key={s.key_name} className="glass-card p-4 space-y-2">
          <label className="text-sm font-medium text-foreground">{keyLabels[s.key_name] || s.key_name}</label>
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
      ))}
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
  const [loading, setLoading] = useState(true);
  const [editingCredits, setEditingCredits] = useState<Record<string, string>>({});
  const [userTab, setUserTab] = useState<'pending' | 'active'>('pending');

  useEffect(() => {
    supabase.from('profiles').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      if (data) setUsers(data as any);
      setLoading(false);
    });
  }, []);

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

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const pendingUsers = users.filter(u => !u.is_approved);
  const activeUsers = users.filter(u => u.is_approved);
  const displayUsers = userTab === 'pending' ? pendingUsers : activeUsers;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-4">
        <Button
          variant={userTab === 'pending' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setUserTab('pending')}
          className={userTab === 'pending' ? 'btn-gradient border-0' : ''}
        >
          Ожидают активации ({pendingUsers.length})
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

      <p className="text-sm text-muted-foreground">
        {userTab === 'pending'
          ? 'Пользователи, ожидающие подтверждения доступа.'
          : `Всего активных: ${activeUsers.length}`}
      </p>

      {displayUsers.length === 0 && (
        <div className="glass-card p-8 text-center text-muted-foreground">
          {userTab === 'pending' ? 'Нет пользователей, ожидающих активации.' : 'Нет активных пользователей.'}
        </div>
      )}

      <div className="space-y-2">
        {displayUsers.map(u => (
          <div key={u.id} className="glass-card p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{u.email || 'Нет email'}</p>
              <p className="text-xs text-muted-foreground">Регистрация: {new Date(u.created_at).toLocaleDateString('ru')}</p>
            </div>
            <div className="flex items-center gap-3">
              {userTab === 'pending' ? (
                <Button
                  size="sm"
                  className="btn-gradient border-0 gap-1.5"
                  onClick={() => handleApprove(u.user_id, u.email)}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Одобрить
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Кредиты:</span>
                  {editingCredits[u.user_id] !== undefined ? (
                    <div className="flex gap-1">
                      <Input
                        type="number"
                        value={editingCredits[u.user_id]}
                        onChange={e => setEditingCredits(prev => ({ ...prev, [u.user_id]: e.target.value }))}
                        className="w-20 h-8 text-sm"
                      />
                      <Button size="sm" variant="outline" className="h-8" onClick={() => handleCreditsUpdate(u.user_id)}>
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
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Stats Tab ─── */
function StatsTab() {
  const [stats, setStats] = useState({ totalAnalyses: 0, completedAnalyses: 0, totalUsers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [analysesRes, profilesRes] = await Promise.all([
        supabase.from('analyses').select('id, status', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
      ]);
      const completed = (analysesRes.data || []).filter((a: any) => a.status === 'done' || a.status === 'completed').length;
      setStats({
        totalAnalyses: analysesRes.count || 0,
        completedAnalyses: completed,
        totalUsers: profilesRes.count || 0,
      });
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const cards = [
    { label: 'Всего анализов', value: stats.totalAnalyses, color: 'text-primary' },
    { label: 'Завершённых', value: stats.completedAnalyses, color: 'text-accent' },
    { label: 'Пользователей', value: stats.totalUsers, color: 'text-foreground' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {cards.map(c => (
        <div key={c.label} className="glass-card p-6 text-center">
          <div className={`text-3xl font-bold ${c.color}`}>{c.value}</div>
          <div className="text-sm text-muted-foreground mt-1">{c.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Analysis Logs Tab ─── */
function AnalysisLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    const load = async () => {
      const { data: analyses } = await supabase
        .from('analyses')
        .select('id, url, status, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(50);
      if (!analyses) { setLoading(false); return; }

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

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Полные JSON-ответы для отладки точности. Последние 50 анализов.</p>
      <div className="space-y-2">
        {logs.map(log => {
          const perfTiming = (log.result?.tab_data as any)?.perfTiming;
          const totalSec = perfTiming?.total_ms ? (perfTiming.total_ms / 1000).toFixed(1) : null;
          const isSlow = perfTiming?.total_ms > 30000;

          return (
            <div key={log.id} className="glass-card p-4 flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{log.url}</p>
                <div className="flex gap-3 mt-1 items-center">
                  <span className={`text-xs ${log.status === 'completed' || log.status === 'done' ? 'text-green-500' : log.status === 'failed' ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {log.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('ru')}
                  </span>
                  {totalSec && (
                    <Badge variant={isSlow ? 'destructive' : 'secondary'} className="text-[10px] h-5">
                      {isSlow ? <Clock className="w-3 h-3 mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                      {totalSec}s
                    </Badge>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                disabled={!log.result}
                onClick={() => setSelectedLog(log)}
              >
                <Eye className="w-3.5 h-3.5" /> JSON
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">
              Лог: {selectedLog?.url}
            </DialogTitle>
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
          {/* Overall status */}
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

          {/* Individual checks */}
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
                <Badge variant="secondary" className="text-[10px]">
                  {check.time_ms}ms
                </Badge>
              </div>
            ))}
          </div>

          {/* Performance stats */}
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
