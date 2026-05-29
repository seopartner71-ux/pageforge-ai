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
  FolderKanban, Plus, Trash2, Gauge, Search as SearchIcon, CheckCircle2, XCircle,
} from 'lucide-react';

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
  const [connectFor, setConnectFor] = useState<{ project: Project; kind: 'gsc' | 'yandex' } | null>(null);
  const [connectValue, setConnectValue] = useState('');

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data, error } = await supabase
      .from('projects')
      .select('id, name, domain, gsc_site_url, yandex_host, gsc_connected, yandex_connected, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) toast({ title: 'Ошибка загрузки', description: error.message, variant: 'destructive' });
    setProjects((data ?? []) as Project[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const createProject = async () => {
    const name = newName.trim();
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const domain = newDomain ? normalizeDomain(newDomain) : '';
    const { error } = await supabase.from('projects').insert({
      user_id: user.id, name, domain,
    });
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

  const openConnect = (project: Project, kind: 'gsc' | 'yandex') => {
    setConnectFor({ project, kind });
    setConnectValue(kind === 'gsc'
      ? (project.gsc_site_url || (project.domain ? `https://${project.domain}/` : ''))
      : (project.yandex_host || project.domain || ''));
  };

  const saveConnect = async () => {
    if (!connectFor) return;
    const { project, kind } = connectFor;
    const value = connectValue.trim();
    if (!value) return;
    const patch = kind === 'gsc'
      ? { gsc_site_url: value, gsc_connected: true }
      : { yandex_host: normalizeDomain(value), yandex_connected: true };
    const { error } = await supabase.from('projects').update(patch).eq('id', project.id);
    if (error) {
      toast({ title: 'Ошибка сохранения', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Подключено' });
    setConnectFor(null);
    load();
  };

  const disconnect = async (project: Project, kind: 'gsc' | 'yandex') => {
    const patch = kind === 'gsc'
      ? { gsc_connected: false }
      : { yandex_connected: false };
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
                  onConnect={() => openConnect(p, 'gsc')}
                  onDisconnect={() => disconnect(p, 'gsc')}
                />
                <ConnectionRow
                  icon={<Gauge className="h-4 w-4" />}
                  label="Яндекс.Вебмастер"
                  connected={p.yandex_connected}
                  detail={p.yandex_host}
                  onConnect={() => openConnect(p, 'yandex')}
                  onDisconnect={() => disconnect(p, 'yandex')}
                />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!connectFor} onOpenChange={(o) => !o && setConnectFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {connectFor?.kind === 'gsc' ? 'Подключить Google Search Console' : 'Подключить Яндекс.Вебмастер'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="block text-sm">
              {connectFor?.kind === 'gsc' ? 'URL ресурса в GSC' : 'Хост сайта в Вебмастере'}
            </Label>
            <Input
              value={connectValue}
              onChange={(e) => setConnectValue(e.target.value)}
              placeholder={connectFor?.kind === 'gsc' ? 'https://example.com/' : 'example.com'}
            />
            <p className="text-[11px] text-muted-foreground">
              {connectFor?.kind === 'gsc'
                ? 'Укажите ресурс ровно как он добавлен в Google Search Console (с протоколом и слэшем).'
                : 'Хост сайта без протокола, например: example.com'}
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConnectFor(null)}>Отмена</Button>
            <Button onClick={saveConnect} disabled={!connectValue.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConnectionRow({
  icon, label, connected, detail, onConnect, onDisconnect,
}: {
  icon: React.ReactNode;
  label: string;
  connected: boolean;
  detail: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
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
          <Button size="sm" variant="outline" onClick={onConnect}>Подключить</Button>
        )}
      </div>
    </div>
  );
}