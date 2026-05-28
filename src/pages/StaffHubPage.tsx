import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  KeyRound, Package, BookOpen, Video, LinkIcon, Plus, Download, Trash2, ExternalLink, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { PageDescription } from '@/components/PageDescription';

type Kind = 'credential' | 'software' | 'memo' | 'video' | 'link';

type Resource = {
  id: string;
  title: string;
  description: string | null;
  kind: Kind;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  external_url: string | null;
  created_by: string;
  created_at: string;
};

const KIND_META: Record<Kind, { label: string; icon: any; hint: string }> = {
  credential: { label: 'Доступы', icon: KeyRound, hint: 'Логины, пароли, ключи API' },
  software:   { label: 'Софт',     icon: Package,  hint: 'Архивы, установщики, утилиты' },
  memo:       { label: 'Памятки',  icon: BookOpen, hint: 'Инструкции, чек-листы, регламенты' },
  video:      { label: 'Видео',    icon: Video,    hint: 'Записи и обучающие материалы' },
  link:       { label: 'Ссылки',   icon: LinkIcon, hint: 'Полезные сервисы и ресурсы' },
};

const ORDER: Kind[] = ['credential', 'software', 'memo', 'video', 'link'];

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  let v = bytes; let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export default function StaffHubPage() {
  const [items, setItems] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // form
  const [kind, setKind] = useState<Kind>('memo');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('staff_resources')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { toast.error(error.message); }
    setItems((data ?? []) as Resource[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setKind('memo'); setTitle(''); setDescription(''); setContent('');
    setExternalUrl(''); setFile(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!title.trim()) { toast.error('Укажите название'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Нет авторизации');

      let file_path: string | null = null;
      let file_name: string | null = null;
      let file_size: number | null = null;
      let mime_type: string | null = null;

      if (file) {
        const safe = file.name.replace(/[^\w.\-]+/g, '_');
        const path = `${user.id}/${Date.now()}_${safe}`;
        const { error: upErr } = await supabase.storage
          .from('staff-files')
          .upload(path, file, { upsert: false, contentType: file.type || undefined });
        if (upErr) throw upErr;
        file_path = path;
        file_name = file.name;
        file_size = file.size;
        mime_type = file.type || null;
      }

      const { error } = await supabase.from('staff_resources').insert({
        title: title.trim(),
        description: description.trim(),
        kind,
        content: content.trim(),
        external_url: externalUrl.trim() || null,
        file_path, file_name, file_size, mime_type,
        created_by: user.id,
      });
      if (error) throw error;

      toast.success('Добавлено');
      setOpen(false); resetForm(); load();
    } catch (e: any) {
      toast.error(e.message ?? 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const download = async (r: Resource) => {
    if (!r.file_path) return;
    const { data, error } = await supabase.storage
      .from('staff-files')
      .createSignedUrl(r.file_path, 60 * 10);
    if (error || !data?.signedUrl) { toast.error('Не удалось получить ссылку'); return; }
    window.open(data.signedUrl, '_blank');
  };

  const remove = async (r: Resource) => {
    if (!confirm(`Удалить «${r.title}»?`)) return;
    if (r.file_path) {
      await supabase.storage.from('staff-files').remove([r.file_path]);
    }
    const { error } = await supabase.from('staff_resources').delete().eq('id', r.id);
    if (error) { toast.error(error.message); return; }
    toast.success('Удалено');
    load();
  };

  const grouped = (k: Kind) => items.filter((i) => i.kind === k);

  return (
    <div className="p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Help me</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Центр помощи сотрудникам - доступы, софт, памятки и обучающие материалы.
            Раздел виден только сотрудникам и админам.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Добавить материал</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Новый материал</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Тип</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as Kind)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORDER.map((k) => (
                      <SelectItem key={k} value={k}>{KIND_META[k].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Название</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Например: Доступ к панели хостинга" />
              </div>
              <div>
                <Label>Краткое описание</Label>
                <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Кому и зачем" />
              </div>
              <div>
                <Label>Содержимое / заметка</Label>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  placeholder={kind === 'credential' ? 'login: ...\\npassword: ...\\nurl: ...' : 'Текст памятки, шаги, инструкции'}
                />
              </div>
              <div>
                <Label>Внешняя ссылка (необязательно)</Label>
                <Input value={externalUrl} onChange={(e) => setExternalUrl(e.target.value)} placeholder="https://..." />
              </div>
              <div>
                <Label>Файл (архив, видео, pdf - необязательно)</Label>
                <Input
                  ref={fileRef}
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {file.name} - {formatSize(file.size)}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>Отмена</Button>
              <Button onClick={submit} disabled={saving}>{saving ? 'Сохраняем...' : 'Сохранить'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <PageDescription
        items={[
          {
            label: 'Что это',
            text: 'Внутренняя база знаний команды: единое место для доступов, дистрибутивов софта, памяток, видео и полезных ссылок.',
          },
          {
            label: 'Что внутри',
            text: 'Пять разделов: Доступы (логины/ключи), Софт (архивы и установщики), Памятки (регламенты и чек-листы), Видео и Ссылки на сервисы.',
          },
          {
            label: 'Зачем',
            text: 'Чтобы новые сотрудники быстро находили нужные инструменты и инструкции, а старые - не теряли время на поиск доступов и регламентов.',
          },
          {
            label: 'Доступ',
            text: 'Раздел закрыт: его видят только пользователи с ролью «Сотрудник» или «Админ». Файлы хранятся в защищённом приватном хранилище.',
          },
        ]}
      />

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="all">Все ({items.length})</TabsTrigger>
          {ORDER.map((k) => {
            const Icon = KIND_META[k].icon;
            return (
              <TabsTrigger key={k} value={k} className="gap-1.5">
                <Icon className="w-3.5 h-3.5" />
                {KIND_META[k].label} ({grouped(k).length})
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : items.length === 0 ? (
            <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
              Пока пусто. Нажмите «Добавить материал», чтобы загрузить первый.
            </CardContent></Card>
          ) : (
            ORDER.map((k) => {
              const list = grouped(k);
              if (!list.length) return null;
              const Icon = KIND_META[k].icon;
              return (
                <section key={k} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold">{KIND_META[k].label}</h2>
                    <span className="text-xs text-muted-foreground">- {KIND_META[k].hint}</span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {list.map((r) => <ResourceCard key={r.id} r={r} onDownload={download} onDelete={remove} />)}
                  </div>
                </section>
              );
            })
          )}
        </TabsContent>

        {ORDER.map((k) => (
          <TabsContent key={k} value={k} className="mt-4">
            <div className="grid gap-3 md:grid-cols-2">
              {grouped(k).map((r) => <ResourceCard key={r.id} r={r} onDownload={download} onDelete={remove} />)}
              {grouped(k).length === 0 && !loading && (
                <Card className="md:col-span-2"><CardContent className="p-10 text-center text-sm text-muted-foreground">
                  В этой категории пока пусто.
                </CardContent></Card>
              )}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function ResourceCard({
  r, onDownload, onDelete,
}: { r: Resource; onDownload: (r: Resource) => void; onDelete: (r: Resource) => void }) {
  const Icon = KIND_META[r.kind].icon;
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-start gap-2">
          <Icon className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <span className="flex-1 break-words">{r.title}</span>
          <Badge variant="secondary" className="shrink-0">{KIND_META[r.kind].label}</Badge>
        </CardTitle>
        {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
      </CardHeader>
      <CardContent className="space-y-3">
        {r.content && (
          <pre className="text-xs bg-muted/40 rounded-md p-3 whitespace-pre-wrap break-words font-mono max-h-60 overflow-auto">
            {r.content}
          </pre>
        )}
        {r.file_name && (
          <div className="flex items-center justify-between gap-2 text-xs bg-muted/30 rounded-md px-3 py-2">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate">{r.file_name}</span>
              {r.file_size != null && <span className="text-muted-foreground shrink-0">{formatSize(r.file_size)}</span>}
            </div>
            <Button size="sm" variant="outline" onClick={() => onDownload(r)}>
              <Download className="w-3.5 h-3.5 mr-1" />Скачать
            </Button>
          </div>
        )}
        {r.external_url && (
          <a href={r.external_url} target="_blank" rel="noreferrer"
             className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <ExternalLink className="w-3.5 h-3.5" />{r.external_url}
          </a>
        )}
        <div className="flex justify-between items-center pt-1">
          <span className="text-[10px] text-muted-foreground">
            {new Date(r.created_at).toLocaleString('ru-RU')}
          </span>
          <Button size="sm" variant="ghost" onClick={() => onDelete(r)} className="text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}