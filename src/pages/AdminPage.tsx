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
import { Settings, Users, BarChart3, Save, Loader2, Eye, EyeOff, ScrollText } from 'lucide-react';

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
  created_at: string;
}

export default function AdminPage() {
  const { isAdmin, loading: roleLoading } = useAdminRole();
  const navigate = useNavigate();
  const { toast } = useToast();

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
          </TabsList>

          <TabsContent value="api"><ApiSettingsTab /></TabsContent>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="stats"><StatsTab /></TabsContent>
          <TabsContent value="logs"><AnalysisLogsTab /></TabsContent>
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

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Всего пользователей: {users.length}</p>
      <div className="space-y-2">
        {users.map(u => (
          <div key={u.id} className="glass-card p-4 flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{u.email || 'Нет email'}</p>
              <p className="text-xs text-muted-foreground">Регистрация: {new Date(u.created_at).toLocaleDateString('ru')}</p>
            </div>
            <div className="flex items-center gap-3">
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
      const completed = (analysesRes.data || []).filter((a: any) => a.status === 'done').length;
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
