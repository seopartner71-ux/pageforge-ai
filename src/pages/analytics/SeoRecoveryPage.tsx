import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import {
  LifeBuoy, Loader2, Play, RefreshCw, AlertCircle, Link as LinkIcon,
  Gauge, CheckCircle2, XCircle, Link2, BarChart3, TrendingDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { SeoRecoveryView } from '@/components/analytics/SeoRecoveryView';
import { useNavigate } from 'react-router-dom';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Status = {
  yandex_connected?: boolean;
  yandex_login?: string | null;
  metrika_connected?: boolean;
  metrika_login?: string | null;
  gsc_available: boolean;
};

type Project = {
  id: string;
  name: string;
  domain: string | null;
  gsc_site_url: string | null;
  yandex_host: string | null;
  gsc_connected: boolean;
  yandex_connected: boolean;
};

type YandexHost = {
  host_id: string;
  ascii_host_url?: string;
  unicode_host_url?: string;
  verified?: boolean;
};

type GscSite = { siteUrl: string; permissionLevel?: string };

function shiftDates(preset: string): { date1: string; date2: string; comparison1: string; comparison2: string } {
  const today = new Date();
  today.setDate(today.getDate() - 2); // GSC задержка
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(today);

  if (preset === 'yoy') {
    const start = new Date(end);
    start.setDate(start.getDate() - 29);
    const compStart = new Date(start);
    compStart.setFullYear(compStart.getFullYear() - 1);
    const compEnd = new Date(end);
    compEnd.setFullYear(compEnd.getFullYear() - 1);
    return { date1: fmt(start), date2: fmt(end), comparison1: fmt(compStart), comparison2: fmt(compEnd) };
  }

  if (preset === 'mom') {
    const start = new Date(end.getFullYear(), end.getMonth(), 1);
    const compEnd = new Date(end.getFullYear(), end.getMonth(), 0);
    const compStart = new Date(end.getFullYear(), end.getMonth() - 1, 1);
    return { date1: fmt(start), date2: fmt(end), comparison1: fmt(compStart), comparison2: fmt(compEnd) };
  }

  // 30d
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  const compEnd = new Date(start);
  compEnd.setDate(compEnd.getDate() - 1);
  const compStart = new Date(compEnd);
  compStart.setDate(compStart.getDate() - 29);
  return { date1: fmt(start), date2: fmt(end), comparison1: fmt(compStart), comparison2: fmt(compEnd) };
}

function fmtDMY(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

const PRESET_LABELS: Record<string, string> = {
  '30d': 'Последние 30 дней',
  mom: 'Месяц к месяцу',
  yoy: 'Год к году',
  custom: 'Свой период',
};

function autoPrev(date1: string, date2: string): { comparison1: string; comparison2: string } {
  if (!date1 || !date2) return { comparison1: '', comparison2: '' };
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const days = Math.max(1, Math.round((+d2 - +d1) / 86400000) + 1);
  const compEnd = new Date(+d1 - 86400000);
  const compStart = new Date(+compEnd - (days - 1) * 86400000);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { comparison1: fmt(compStart), comparison2: fmt(compEnd) };
}

export default function SeoRecoveryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [yandexHost, setYandexHost] = useState('');
  const [gscSite, setGscSite] = useState('');
  const [preset, setPreset] = useState('30d');
  const initial = shiftDates('30d');
  const [date1, setDate1] = useState(initial.date1);
  const [date2, setDate2] = useState(initial.date2);
  const [comparison1, setComparison1] = useState(initial.comparison1);
  const [comparison2, setComparison2] = useState(initial.comparison2);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [yandexConnected, setYandexConnected] = useState(false);
  const [yandexLogin, setYandexLogin] = useState<string | null>(null);
  const [yandexCode, setYandexCode] = useState('');
  const [yandexCodeLoading, setYandexCodeLoading] = useState(false);
  const [yandexHosts, setYandexHosts] = useState<YandexHost[]>([]);
  const [yandexLoadingHosts, setYandexLoadingHosts] = useState(false);
  const [hostPickerOpen, setHostPickerOpen] = useState(false);
  const [gscPickerOpen, setGscPickerOpen] = useState(false);
  const [gscSites, setGscSites] = useState<GscSite[]>([]);
  const [gscSitesLoading, setGscSitesLoading] = useState(false);

  async function checkStatus() {
    try {
      const { data, error } = await supabase.functions.invoke('seo-recovery-analyze', {
        body: { mode: 'check', date1, date2 },
      });
      if (error) throw error;
      const s = data as Status;
      setStatus(s);
      setYandexConnected(Boolean(s?.yandex_connected ?? s?.metrika_connected));
      setYandexLogin(s?.yandex_login ?? s?.metrika_login ?? null);
    } catch (e) { console.error(e); }
  }

  async function loadProjects() {
    setProjectsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setProjects([]); return; }
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, domain, gsc_site_url, yandex_host, gsc_connected, yandex_connected')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as Project[];
      setProjects(list);

      if (!selectedProjectId && list.length > 0) {
        const preferred = list.find((p) => p.gsc_connected || p.yandex_connected) ?? list[0];
        applyProject(preferred, false);
      }
    } catch (e: any) {
      toast.error('Не удалось загрузить проекты: ' + (e?.message || 'ошибка'));
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => {
    checkStatus();
    loadProjects();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'yandex-oauth-done') {
        toast.success('Яндекс подключён');
        checkStatus();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyProject(project: Project, notify = true) {
    setSelectedProjectId(project.id);
    setGscSite(project.gsc_connected && project.gsc_site_url ? project.gsc_site_url : '');
    setYandexHost(project.yandex_connected && project.yandex_host ? project.yandex_host : '');
    if (notify) toast.success('Проект выбран: ' + project.name);
  }

  function onProjectChange(id: string) {
    if (id === 'none') {
      setSelectedProjectId('');
      setGscSite('');
      setYandexHost('');
      return;
    }
    const p = projects.find((x) => x.id === id);
    if (p) applyProject(p);
  }

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== 'custom') {
      const d = shiftDates(p);
      setDate1(d.date1);
      setDate2(d.date2);
      setComparison1(d.comparison1);
      setComparison2(d.comparison2);
    }
  }

  async function runAnalysis() {
    if (!yandexHost && !gscSite) {
      toast.error('Выберите сайт Яндекса из проекта или укажите сайт GSC');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const { data, error } = await supabase.functions.invoke('seo-recovery-analyze', {
        body: { yandex_host: yandexHost || undefined, gsc_site: gscSite || undefined, date1, date2, comparison1, comparison2 },
      });
      if (error) throw error;
      if ((data as any)?.error) {
        const det = (data as any).details;
        const msg = Array.isArray(det) ? det.map((d: any) => typeof d === 'string' ? d : (d?.title || d?.code || JSON.stringify(d))).join(' • ') : '';
        throw new Error((data as any).error + (msg ? ': ' + msg : ''));
      }
      setData(data);
    } catch (e: any) {
      setError(e?.message || 'Ошибка анализа');
    } finally {
      setLoading(false);
    }
  }

  async function connectYandex() {
    await startYandexOAuth();
  }

  async function startYandexOAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Войдите в систему');
        return;
      }
      const res = await fetch(`${SUPABASE_URL}/functions/v1/yandex-oauth-start`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: SUPABASE_KEY,
        },
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || 'oauth_start_failed');
      const w = window.open(json.url, 'yandex_oauth', 'width=560,height=720');
      if (!w) window.location.href = json.url;
    } catch (e: any) {
      toast.error('Ошибка: ' + (e?.message || 'неизвестная'));
    }
  }

  async function exchangeYandexCode() {
    const code = yandexCode.trim();
    if (!code) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error('Войдите в систему');
      return;
    }
    setYandexCodeLoading(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/yandex-oauth-exchange-code`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ code }),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || 'token_exchange_failed');
      setYandexCode('');
      toast.success(json.yandex_login ? `Яндекс подключён: ${json.yandex_login}` : 'Яндекс подключён');
      await checkStatus();
    } catch (e: any) {
      toast.error('Не удалось подключить Яндекс: ' + (e?.message || 'ошибка'));
    } finally {
      setYandexCodeLoading(false);
    }
  }

  async function callYandex(body: Record<string, unknown>) {
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/yandex-webmaster-api`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session?.access_token}`,
        'Content-Type': 'application/json',
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'request failed');
    return json;
  }

  async function openHostPicker() {
    if (!yandexConnected) {
      toast.error('Сначала подключите Яндекс-аккаунт');
      return;
    }
    setHostPickerOpen(true);
    setYandexLoadingHosts(true);
    setYandexHosts([]);
    try {
      const r = await callYandex({ action: 'hosts' });
      setYandexHosts(r.hosts ?? []);
    } catch (e: any) {
      toast.error('Не удалось получить сайты Яндекса: ' + (e?.message || 'ошибка'));
    } finally {
      setYandexLoadingHosts(false);
    }
  }

  async function useYandexHost(host: YandexHost) {
    setYandexHost(host.host_id);
    if (selectedProjectId) {
      const { error } = await supabase
        .from('projects')
        .update({ yandex_host: host.host_id, yandex_connected: true })
        .eq('id', selectedProjectId);
      if (error) {
        toast.error('Не удалось сохранить сайт в проекте: ' + error.message);
      } else {
        await loadProjects();
      }
    }
    toast.success('Сайт Яндекса выбран: ' + (host.unicode_host_url || host.host_id));
    setHostPickerOpen(false);
  }

  async function openGscPicker() {
    if (!status?.gsc_available) {
      toast.error('Google Search Console не подключен');
      return;
    }
    setGscPickerOpen(true);
    setGscSitesLoading(true);
    setGscSites([]);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-sites-list', { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setGscSites(((data as any)?.sites ?? []) as GscSite[]);
    } catch (e: any) {
      toast.error('Не удалось получить сайты GSC: ' + (e?.message || 'ошибка'));
    } finally {
      setGscSitesLoading(false);
    }
  }

  async function useGscSite(site: GscSite) {
    setGscSite(site.siteUrl);
    if (selectedProjectId) {
      const { error } = await supabase
        .from('projects')
        .update({ gsc_site_url: site.siteUrl, gsc_connected: true })
        .eq('id', selectedProjectId);
      if (error) toast.error('Не удалось сохранить сайт в проекте: ' + error.message);
      else await loadProjects();
    }
    toast.success('Сайт GSC выбран: ' + site.siteUrl);
    setGscPickerOpen(false);
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><LifeBuoy className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">SEO Recovery AI</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">AI-аналитик причин изменения органического трафика. Использует те же подключения проектов к Яндексу и Google Search Console — без отдельного ошибочного мастера Метрики.</p>
          </div>
        </div>

        {/* Connection status */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">Подключения</div>
            <Button variant="ghost" size="sm" onClick={checkStatus}><RefreshCw className="w-3.5 h-3.5 mr-1" />Обновить</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Яндекс</div>
                <div className="text-xs text-muted-foreground">{yandexConnected ? `Подключено: ${yandexLogin ?? 'аккаунт'}` : 'Не подключено'}</div>
              </div>
              {yandexConnected
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">OK</Badge>
                : <Button size="sm" variant="outline" onClick={connectYandex}><LinkIcon className="w-3.5 h-3.5 mr-1" />Подключить</Button>}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Google Search Console</div>
                <div className="text-xs text-muted-foreground">{status?.gsc_available ? 'Коннектор подключен' : 'Не подключено'}</div>
              </div>
              {status?.gsc_available
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">OK</Badge>
                : <Badge variant="outline" className="text-amber-600 border-amber-500/40">Нужен коннектор</Badge>}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Яндекс.Вебмастер</div>
                <div className="text-xs text-muted-foreground">Сайты и доступы из /projects</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/projects')}>Открыть проекты</Button>
            </div>
          </div>
          {!yandexConnected && (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-border/60 bg-muted/20 p-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Код авторизации Яндекса</Label>
                <Input
                  className="h-9 w-[220px]"
                  placeholder="Код от Яндекса"
                  value={yandexCode}
                  onChange={(e) => setYandexCode(e.target.value)}
                />
              </div>
              <Button size="sm" variant="secondary" onClick={exchangeYandexCode} disabled={!yandexCode.trim() || yandexCodeLoading}>
                {yandexCodeLoading ? 'Проверка…' : 'Вставить код'}
              </Button>
              <Button size="sm" onClick={startYandexOAuth}>
                <Link2 className="h-4 w-4 mr-1.5" /> Получить код
              </Button>
              <div className="text-xs text-muted-foreground max-w-md">
                Подключение сделано так же, как на странице «Проекты»: сначала получите код у Яндекса, затем вставьте его здесь.
              </div>
            </div>
          )}
        </Card>

        {/* Form */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Проект</Label>
              <Select value={selectedProjectId || 'none'} onValueChange={onProjectChange}>
                <SelectTrigger>
                  <SelectValue placeholder={projectsLoading ? 'Загрузка…' : 'Выберите проект'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Без проекта</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Берём подключения из /projects</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="yandexHost">Сайт в Яндексе</Label>
              <div className="flex gap-2">
                <Input id="yandexHost" placeholder="host_id из Яндекс.Вебмастера" value={yandexHost} onChange={(e) => setYandexHost(e.target.value.trim())} />
                <Button type="button" variant="outline" onClick={openHostPicker} disabled={!yandexConnected}>
                  <Gauge className="w-4 h-4 mr-1" />Выбрать
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">То же подключение Яндекса, что на странице «Проекты»</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gsc">Сайт Google Search Console</Label>
              <div className="flex gap-2">
                <Input id="gsc" placeholder="https://example.ru/ или sc-domain:example.ru" value={gscSite} onChange={(e) => setGscSite(e.target.value.trim())} />
                <Button type="button" variant="outline" onClick={openGscPicker} disabled={!status?.gsc_available}>
                  <Gauge className="w-4 h-4 mr-1" />Выбрать
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Точно как в GSC, включая протокол и слэш</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Период сравнения</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Последние 30 дней</SelectItem>
                  <SelectItem value="mom">Месяц к месяцу</SelectItem>
                  <SelectItem value="yoy">Год к году</SelectItem>
                  <SelectItem value="custom">Свой период</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Дата с</Label>
              <Input type="date" value={date1} onChange={(e) => { setDate1(e.target.value); setPreset('custom'); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Дата по</Label>
              <Input type="date" value={date2} onChange={(e) => { setDate2(e.target.value); setPreset('custom'); }} />
            </div>
          {preset !== 'custom' && comparison1 && comparison2 && (
            <p className="text-sm text-muted-foreground">
              Период сравнения: {fmtDMY(comparison1)} → {fmtDMY(comparison2)}
            </p>
          )}
          </div>
          <div className="flex justify-end">
            <Button onClick={runAnalysis} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {loading ? 'Анализ…' : 'Запустить анализ'}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="p-4 border-rose-500/40 bg-rose-500/5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5" />
            <div className="text-sm">{error}</div>
          </Card>
        )}

        {loading && (
          <Card className="p-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <div>Собираем данные из Яндекса и GSC, считаем дельты, формируем AI-анализ…</div>
          </Card>
        )}

        {data && <SeoRecoveryView data={data} />}
      </main>
      <Dialog open={hostPickerOpen} onOpenChange={setHostPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Выберите сайт в Яндексе</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {yandexLoadingHosts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка сайтов…
              </div>
            ) : yandexHosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                В подключённом Яндекс-аккаунте нет доступных сайтов. Добавьте сайт в /projects или Яндекс.Вебмастер.
              </p>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto">
                {yandexHosts.map((h) => (
                  <button
                    key={h.host_id}
                    onClick={() => useYandexHost(h)}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60 hover:bg-secondary transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">
                        {h.unicode_host_url || h.ascii_host_url || h.host_id}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">{h.host_id}</div>
                    </div>
                    {h.verified ? (
                      <Badge variant="secondary" className="gap-1 shrink-0">
                        <CheckCircle2 className="h-3 w-3 text-green-500" /> Подтверждён
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
                        <XCircle className="h-3 w-3" /> Не подтверждён
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={gscPickerOpen} onOpenChange={setGscPickerOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Выберите сайт в Google Search Console</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {gscSitesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка сайтов…
              </div>
            ) : gscSites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                В подключённом GSC-аккаунте нет доступных сайтов.
              </p>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto">
                {gscSites.map((s) => (
                  <button
                    key={s.siteUrl}
                    onClick={() => useGscSite(s)}
                    className="w-full text-left flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border/60 hover:bg-secondary transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{s.siteUrl}</div>
                    </div>
                    {s.permissionLevel && (
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {s.permissionLevel}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}