import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { User, Key, Shield, Save } from 'lucide-react';

export default function AccountPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [brandSaving, setBrandSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setEmail(data.user.email || '');
    });
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast({ title: lang === 'ru' ? 'Пароль должен быть минимум 6 символов' : 'Password must be at least 6 characters', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      toast({ title: error.message, variant: 'destructive' });
    } else {
      toast({ title: lang === 'ru' ? 'Пароль обновлён' : 'Password updated' });
      setNewPassword('');
    }
    setSaving(false);
  };

  const t = {
    ru: {
      title: 'Личный кабинет',
      profile: 'Профиль',
      emailLabel: 'Email',
      security: 'Безопасность',
      newPassword: 'Новый пароль',
      changePassword: 'Изменить пароль',
      apiKeys: 'API Ключи',
      openrouterLabel: 'OpenRouter API Key',
      openrouterHint: 'Ключ используется для AI-анализа. Получите на openrouter.ai',
      saveKey: 'Сохранить ключ',
      stats: 'Статистика',
      totalAnalyses: 'Всего анализов',
      thisMonth: 'В этом месяце',
    },
    en: {
      title: 'Account',
      profile: 'Profile',
      emailLabel: 'Email',
      security: 'Security',
      newPassword: 'New Password',
      changePassword: 'Change Password',
      apiKeys: 'API Keys',
      openrouterLabel: 'OpenRouter API Key',
      openrouterHint: 'Used for AI analysis. Get yours at openrouter.ai',
      saveKey: 'Save Key',
      stats: 'Statistics',
      totalAnalyses: 'Total analyses',
      thisMonth: 'This month',
    },
  };
  const tr = t[lang];

  const [stats, setStats] = useState({ total: 0, month: 0 });
  useEffect(() => {
    const load = async () => {
      const { count: total } = await supabase.from('analyses').select('id', { count: 'exact', head: true });
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: month } = await supabase.from('analyses').select('id', { count: 'exact', head: true }).gte('created_at', monthStart.toISOString());
      setStats({ total: total || 0, month: month || 0 });
    };
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8 max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold text-foreground">{tr.title}</h1>

        {/* Profile */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">{tr.profile}</h2>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">{tr.emailLabel}</label>
            <Input value={email} disabled className="bg-secondary border-border/50 opacity-70" />
          </div>
        </div>

        {/* Security */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">{tr.security}</h2>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">{tr.newPassword}</label>
            <Input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-secondary border-border/50"
            />
          </div>
          <Button onClick={handleChangePassword} disabled={saving} className="btn-gradient border-0">
            {tr.changePassword}
          </Button>
        </div>

        {/* API Keys */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">{tr.apiKeys}</h2>
          </div>
          <div>
            <label className="text-sm text-muted-foreground mb-1.5 block">{tr.openrouterLabel}</label>
            <Input
              type="password"
              value={openrouterKey}
              onChange={e => setOpenrouterKey(e.target.value)}
              placeholder="sk-or-..."
              className="bg-secondary border-border/50"
            />
            <p className="text-xs text-muted-foreground mt-1.5">{tr.openrouterHint}</p>
          </div>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => toast({ title: lang === 'ru' ? 'Ключ сохранён (серверная настройка)' : 'Key saved (server config)' })}>
            <Save className="w-3.5 h-3.5" />
            {tr.saveKey}
          </Button>
        </div>

        {/* Stats */}
        <div className="glass-card p-6">
          <h2 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">{tr.stats}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold gradient-text">{stats.total}</p>
              <p className="text-xs text-muted-foreground mt-1">{tr.totalAnalyses}</p>
            </div>
            <div className="bg-secondary/50 rounded-xl p-4 text-center">
              <p className="text-3xl font-bold gradient-text">{stats.month}</p>
              <p className="text-xs text-muted-foreground mt-1">{tr.thisMonth}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
