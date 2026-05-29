import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  FolderKanban, Plus, Trash2, Gauge, Search as SearchIcon, CheckCircle2, XCircle, Link2, Loader2,
} from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

type Project = {
  id: string;
  name: string;
  domain: string | null;
  gsc_site_url: string | null;
  yandex_host: string | null;
  gsc_connected: boolean;
  yandex_connected: boolean;
  created_at: string;
};

type YandexHost = {
  host_id: string;
  ascii_host_url?: string;
  unicode_host_url?: string;
  verified?: boolean;
};

function normalizeDomain(value: string): string {
  return value.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase();
}

export default function ProjectsPage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDomain, setNewDomain] = useState('');
  const [gscFor, setGscFor] = useState<Project | null>(null);
  const [gscValue, setGscValue] = useState('');

  const [yandexConnected, setYandexConnected] = useState(false);
  const [yandexLogin, setYandexLogin] = useState<string | null>(null);
  const [yandexHosts, setYandexHosts] = useState<YandexHost[]>([]);
  const [yandexLoadingHosts, setYandexLoadingHosts] = useState(false);
  const [pickHostFor, setPickHostFor] = useState<Project | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const [{ data, error }, { data: tok }] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, domain, gsc_site_url, yandex_host, gsc_connected, yandex_connected, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('yandex_tokens').select('yandex_login').eq('user_id', user.id).maybeSingle(),
    ]);
    if (error) toast({ title: 'Ошибка загрузки', description: error.message, variant: 'destructive' });
    setProjects((data ?? []) as Project[]);
    setYandexConnected(!!tok);
    setYandexLogin(tok?.yandex_login ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const onMsg = (e: MessageEvent) => {
      if (e.data?.type === 'yandex-oauth-done') {
        toast({ title: 'Яндекс подключён' });
        load();
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const domain = newDomain ? normalizeDomain(newDomain) : '';
    const { error } = await supabase.from('projects').insert({ user_id: user.id, name, domain });
    if (error) {
      toast({ title: 'Не удалось создать', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Проект создан' });
    setNewName(''); setNewDomain(''); setCreateOpen(false);
    load();
  };

  const removeProject = async (id: string) => {
    if (!confirm('Удалить проект? Это действие необратимо.')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      toast({ title: 'Ошибка удаления', description: error.message, variant: 'destructive' });
      return;
    }
    setProjects((p) => p.filter((x) => x.id !== id));
  };

  // === Yandex OAuth ===
  const startYandexOAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast({ title: 'Войдите в систему', variant: 'destructive' });
      return;
    }
    try {
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
    } catch (e) {
      toast({ title: 'Ошибка OAuth', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const callYandex = async (body: Record<string, unknown>) => {
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
  };

  const openHostPicker = async (project: Project) => {
    setPickHostFor(project);
    setYandexLoadingHosts(true);
    setYandexHosts([]);
    try {
      const r = await callYandex({ action: 'hosts' });
      setYandexHosts(r.hosts ?? []);
    } catch (e) {
      toast({ title: 'Не удалось получить хосты', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setYandexLoadingHosts(false);
    }
  };

  const linkHostToProject = async (host: YandexHost) => {
    if (!pickHostFor) return;
    const { error } = await supabase
      .from('projects')
      .update({ yandex_host: host.host_id, yandex_connected: true })
      .eq('id', pickHostFor.id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Сайт привязан', description: host.unicode_host_url || host.host_id });
    setPickHostFor(null);
    load();
  };

  const disconnectYandexAccount = async () => {
    if (!confirm('Отключить аккаунт Яндекса? Все проекты потеряют связь с Вебмастером.')) return;
    try {
      await callYandex({ action: 'disconnect' });
      toast({ title: 'Аккаунт отключён' });
      load();
    } catch (e) {
      toast({ title: 'Ошибка', description: (e as Error).message, variant: 'destructive' });
    }
  };

  const onYandexAction = (project: Project) => {
    if (!yandexConnected) startYandexOAuth();
    else openHostPicker(project);
  };

  const openGsc = (project: Project) => {
    setGscFor(project);
    setGscValue(project.gsc_site_url || (project.domain ? `https://${project.domain}/` : ''));
  };

  const saveGsc = async () => {
    if (!gscFor) return;
    const value = gscValue.trim();
    if (!value) return;
    const { error } = await supabase
      .from('projects')
      .update({ gsc_site_url: value, gsc_connected: true })
      .eq('id', gscFor.id);
    if (error) {
      toast({ title: 'Ошибка сохранения', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Подключено' });
    setGscFor(null);
    load();
  };

  const disconnect = async (project: Project, kind: 'gsc' | 'yandex') => {
    const patch = kind === 'gsc'
      ? { gsc_connected: false }
      : { yandex_connected: false, yandex_host: null };
    const { error } = await supabase.from('projects').update(patch).eq('id', project.id);
    if (error) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
      return;
    }
    load();
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
            <FolderKanban className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Проекты</h1>
            <p className="text-sm text-muted-foreground">
              Добавьте сайты и подключите их к Яндекс.Вебмастеру или Google Search Console
            </p>
          </div>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1.5" /> Новый проект</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый проект</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="mb-1.5 block">Название *</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Мой сайт" />
              </div>
              <div>
                <Label className="mb-1.5 block">Домен</Label>
                <Input value={newDomain} onChange={(e) => setNewDomain(e.target.value)} placeholder="example.com" />
                <p className="text-[11px] text-muted-foreground mt-1">Без http(s)://, например: example.com</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Отмена</Button>
              <Button onClick={createProject} disabled={!newName.trim()}>Создать</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border p-4 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-md bg-primary/10 text-primary flex items-center justify-center">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">Аккаунт Яндекс.Вебмастера</div>
            <div className="text-[11px] text-muted-foreground truncate">
              {yandexConnected
                ? <>Подключён{yandexLogin ? ` как ${yandexLogin}` : ''} — используется для всех проектов</>
                : <>Подключите аккаунт один раз — затем выбирайте сайт из списка ваших хостов</>}
            </div>
          </div>
        </div>
        {yandexConnected ? (
          <Button variant="ghost" size="sm" onClick={disconnectYandexAccount}>
            Отключить аккаунт
          </Button>
        ) : (
          <Button size="sm" onClick={startYandexOAuth}>
            <Link2 className="h-4 w-4 mr-1.5" /> Подключить Яндекс
          </Button>
        )}
      </Card>

      {loading ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">Загрузка…</Card>
      ) : projects.length === 0 ? (
        <Card className="p-10 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium mb-1">У вас ещё нет проектов</p>
          <p className="text-sm text-muted-foreground mb-4">
            Создайте первый проект, чтобы группировать аудиты и подключить источники данных
          </p>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Создать проект
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {projects.map((p) => (
            <Card key={p.id} className="p-5 space-y-4 bg-card border-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold text-foreground truncate">{p.name}</h3>
                  <p className="text-xs text-muted-foreground truncate">
                    {p.domain || 'домен не указан'}
                  </p>
                </div>
                <Button
                  variant="ghost" size="icon"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => removeProject(p.id)}
                  title="Удалить проект"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2">
                <ConnectionRow
                  icon={<SearchIcon className="h-4 w-4" />}
                  label="Google Search Console"
                  connected={p.gsc_connected}
                  detail={p.gsc_site_url}
                  onConnect={() => openGsc(p)}
                  onDisconnect={() => disconnect(p, 'gsc')}
                />
                <ConnectionRow
                  icon={<Gauge className="h-4 w-4" />}
                  label="Яндекс.Вебмастер"
                  connected={p.yandex_connected}
                  detail={p.yandex_host}
                  onConnect={() => onYandexAction(p)}
                  onDisconnect={() => disconnect(p, 'yandex')}
                  actionLabel={yandexConnected ? 'Выбрать сайт' : 'Подключить Яндекс'}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!pickHostFor} onOpenChange={(o) => !o && setPickHostFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Выберите сайт в Яндекс.Вебмастере</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {yandexLoadingHosts ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" /> Загрузка хостов…
              </div>
            ) : yandexHosts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                В вашем Вебмастере нет добавленных сайтов
              </p>
            ) : (
              <div className="space-y-1 max-h-[420px] overflow-y-auto">
                {yandexHosts.map((h) => (
                  <button
                    key={h.host_id}
                    onClick={() => linkHostToProject(h)}
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
                      <Badge variant="outline" className="shrink-0 text-muted-foreground">Не подтверждён</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!gscFor} onOpenChange={(o) => !o && setGscFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подключить Google Search Console</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="block text-sm">URL ресурса в GSC</Label>
            <Input
              value={gscValue}
              onChange={(e) => setGscValue(e.target.value)}
              placeholder="https://example.com/"
            />
            <p className="text-[11px] text-muted-foreground">
              Укажите ресурс ровно как он добавлен в Google Search Console (с протоколом и слэшем).
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setGscFor(null)}>Отмена</Button>
            <Button onClick={saveGsc} disabled={!gscValue.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionRow({
  icon, label, connected, detail, onConnect, onDisconnect, actionLabel,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  detail: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2">
      <div className="flex items-center gap-2 min-w-0">
        <div className="text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <div className="text-sm text-foreground">{label}</div>
          {detail && (
            <div className="text-[11px] text-muted-foreground truncate max-w-[220px]">{detail}</div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {connected ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Подключено
          </Badge>
        ) : (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            <XCircle className="h-3 w-3" /> Не подключено
          </Badge>
        )}
        {connected ? (
          <Button size="sm" variant="ghost" onClick={onDisconnect}>Отключить</Button>
        ) : (
          <Button size="sm" variant="outline" onClick={onConnect}>{actionLabel || 'Подключить'}</Button>
        )}
      </div>
    </div>
  );
}