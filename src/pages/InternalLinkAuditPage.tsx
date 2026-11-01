import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileSpreadsheet, X, Play, Trash2, Network } from 'lucide-react';
import { toast } from 'sonner';
import { TypeRulesTab, type RuleRow } from '@/components/internalLinks/TypeRulesTab';
import { AuditResultView } from '@/components/internalLinks/AuditResultView';
import { DEFAULT_SETTINGS, norm, type AuditResult, type AuditSettings } from '@/lib/internalLinks/engine';
import type { AiReport } from '@/lib/internalLinks/exportXlsx';
import { readTable } from '@/lib/internalLinks/readFile';

interface Project { id: string; name: string; domain: string | null }
interface AuditRow { id: string; created_at: string; status: string; summary: any; source_note: string | null; created_by: string }
type Slot = 'internal' | 'inlinks' | 'gscPages' | 'gscQp';
const SLOTS: { key: Slot; title: string; hint: string; required: boolean }[] = [
  { key: 'internal', title: 'internal_all', hint: 'Screaming Frog: Internal → All', required: true },
  { key: 'inlinks', title: 'all_inlinks', hint: 'Bulk Export → Links → All Inlinks', required: true },
  { key: 'gscPages', title: 'GSC: страницы', hint: 'page, clicks, impressions, position (необязательно)', required: false },
  { key: 'gscQp', title: 'GSC: запрос + страница', hint: 'query, page, clicks, impressions, position (необязательно)', required: false },
];

function DropSlot({ title, hint, file, onFile, required }: { title: string; hint: string; file: File | null; onFile: (f: File | null) => void; required: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      onClick={() => ref.current?.click()}
      className={`rounded-md border border-dashed p-4 cursor-pointer transition-colors ${over ? 'border-primary bg-primary/5' : 'hover:border-primary/60'}`}>
      <input ref={ref} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(e) => onFile(e.target.files?.[0] ?? null)} />
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="font-medium text-sm">{title}{required && <span className="text-destructive"> *</span>}</div>
          <div className="text-xs text-muted-foreground">{hint}</div>
          {file && <div className="text-xs mt-1 flex items-center gap-1 truncate"><FileSpreadsheet className="h-3 w-3 shrink-0" />{file.name}</div>}
        </div>
        {file ? <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); onFile(null); }} aria-label="Убрать файл"><X className="h-4 w-4" /></Button>
          : <Upload className="h-5 w-5 text-muted-foreground shrink-0" />}
      </div>
    </div>
  );
}

export default function InternalLinkAuditPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>('');
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [audits, setAudits] = useState<AuditRow[]>([]);
  const [tab, setTab] = useState('audits');
  const [files, setFiles] = useState<Record<Slot, File | null>>({ internal: null, inlinks: null, gscPages: null, gscQp: null });
  const [sampleUrls, setSampleUrls] = useState<string[] | null>(null);
  const [settings, setSettings] = useState<AuditSettings>(DEFAULT_SETTINGS);
  const [running, setRunning] = useState<{ stage: string; pct: number } | null>(null);
  const [open, setOpen] = useState<{ id: string; result: AuditResult; ai: AiReport | null; date: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data } = await supabase.from('projects').select('id, name, domain').eq('user_id', user.id).order('created_at', { ascending: false });
      setProjects(data ?? []);
      if (data?.length) setProjectId(data[0].id);
    })();
  }, []);

  const loadProject = useCallback(async (pid: string) => {
    const [{ data: r }, { data: a }] = await Promise.all([
      supabase.from('internal_link_rules').select('name, regex, position').eq('project_id', pid).order('position'),
      supabase.from('internal_link_audits').select('id, created_at, status, summary, source_note, created_by').eq('project_id', pid).order('created_at', { ascending: false }).limit(50),
    ]);
    setRules((r ?? []).map((x) => ({ name: x.name, regex: x.regex })));
    setAudits((a ?? []) as AuditRow[]);
  }, []);
  useEffect(() => { if (projectId) { setOpen(null); loadProject(projectId); } }, [projectId, loadProject]);

  const setFile = async (k: Slot, f: File | null) => {
    setFiles((p) => ({ ...p, [k]: f }));
    if (k === 'internal') {
      if (!f) { setSampleUrls(null); return; }
      try {
        const rows = readTable(f.name, await f.arrayBuffer());
        const col = Object.keys(rows[0] ?? {}).find((c) => ['address', 'адрес'].includes(c.toLowerCase().trim()));
        setSampleUrls(col ? rows.map((r) => norm(r[col])).filter(Boolean) : null);
      } catch { setSampleUrls(null); }
    }
  };

  const openAudit = async (id: string) => {
    const { data, error } = await supabase.from('internal_link_audits').select('id, created_at, results, ai_report').eq('id', id).maybeSingle();
    if (error || !data) { toast.error('Не удалось открыть аудит'); return; }
    setOpen({ id: data.id, result: data.results as unknown as AuditResult, ai: (data.ai_report as AiReport) ?? null, date: data.created_at });
    setTab('audits');
  };

  const run = async () => {
    if (!files.internal || !files.inlinks || !userId || !projectId) return;
    setRunning({ stage: 'Подготовка', pct: 1 });
    const toWf = async (f: File | null) => (f ? { name: f.name, buf: await f.arrayBuffer() } : null);
    const payload = { internal: await toWf(files.internal), inlinks: await toWf(files.inlinks), gscPages: await toWf(files.gscPages), gscQp: await toWf(files.gscQp), rules, settings };
    const worker = new Worker(new URL('../workers/internalLinks.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (e) => {
      const m = e.data;
      if (m.kind === 'progress') { setRunning({ stage: m.stage, pct: m.pct }); return; }
      worker.terminate();
      if (m.kind === 'error') { setRunning(null); toast.error(m.message); return; }
      const result = m.result as AuditResult;
      setRunning({ stage: 'Сохранение', pct: 100 });
      const saved = { ...result, pages: result.pages.slice(0, 5000) };
      const { data, error } = await supabase.from('internal_link_audits').insert({
        project_id: projectId, created_by: userId, status: 'done', settings: settings as any,
        summary: result.summary as any, results: saved as any,
        source_note: [files.internal?.name, files.inlinks?.name, files.gscPages?.name, files.gscQp?.name].filter(Boolean).join(', '),
      }).select('id, created_at').single();
      setRunning(null);
      if (error || !data) { toast.error(`Расчёт готов, но не сохранился: ${error?.message}`); return; }
      toast.success('Аудит готов');
      setOpen({ id: data.id, result: saved, ai: null, date: data.created_at });
      setTab('audits');
      loadProject(projectId);
    };
    worker.onerror = (e) => { worker.terminate(); setRunning(null); toast.error(`Ошибка расчёта: ${e.message}`); };
    worker.postMessage(payload, [payload.internal!.buf, payload.inlinks!.buf, ...(payload.gscPages ? [payload.gscPages.buf] : []), ...(payload.gscQp ? [payload.gscQp.buf] : [])]);
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить аудит?')) return;
    const { error } = await supabase.from('internal_link_audits').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    if (open?.id === id) setOpen(null);
    loadProject(projectId);
  };

  const project = projects.find((p) => p.id === projectId);
  const hasCore = rules.some((r) => ['Статья', 'Услуга', 'Консультация'].includes(r.name.trim()));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><Network className="h-6 w-6 text-primary" />Аудит перелинковки</h1>
            <PageDescription text="Анализ внутренних ссылок по выгрузкам Screaming Frog: сироты, PageRank, ссылки из текста, битые и редиректы, кандидаты «статья → услуга», каннибализация. Файлы обрабатываются в браузере и не загружаются на сервер." />
          </div>
          <div className="w-64">
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Выберите проект" /></SelectTrigger>
              <SelectContent>{projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}{p.domain ? ` · ${p.domain}` : ''}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        {!projectId ? (
          <Card className="p-8 text-center text-muted-foreground">Создайте проект на странице «Проекты», чтобы запускать аудит перелинковки.</Card>
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="audits">Аудиты</TabsTrigger>
              <TabsTrigger value="new">Новый аудит</TabsTrigger>
              <TabsTrigger value="types">Типы страниц</TabsTrigger>
            </TabsList>

            <TabsContent value="audits" className="space-y-4">
              {open ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Аудит от {new Date(open.date).toLocaleString('ru-RU')}</div>
                    <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>← К списку</Button>
                  </div>
                  <AuditResultView auditId={open.id} result={open.result} ai={open.ai}
                    onAi={(ai) => setOpen((o) => (o ? { ...o, ai } : o))}
                    fileBase={`${open.result.host || project?.name || 'site'}_перелинковка_${open.date.slice(0, 10)}`} />
                </>
              ) : audits.length === 0 ? (
                <Card className="p-8 text-center space-y-3">
                  <p className="font-medium">Аудитов пока нет</p>
                  <p className="text-sm text-muted-foreground max-w-xl mx-auto">Нужны две выгрузки Screaming Frog: <b>Internal → All</b> и <b>Bulk Export → Links → All Inlinks</b> (.xlsx или .csv). Для приоритетов по трафику и каннибализации добавьте выгрузки Search Console. Сначала настройте типы страниц.</p>
                  <Button onClick={() => setTab('new')}>Новый аудит</Button>
                </Card>
              ) : (
                <Card>
                  <div className="divide-y">
                    {audits.map((a) => (
                      <div key={a.id} className="p-3 flex items-center gap-4 hover:bg-muted/40 cursor-pointer" onClick={() => openAudit(a.id)}>
                        <div className="w-40 text-sm">{new Date(a.created_at).toLocaleString('ru-RU')}<div className="text-xs text-muted-foreground">{a.created_by === userId ? 'вы' : 'другой пользователь'}</div></div>
                        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <span>Страниц: <b>{a.summary?.pages ?? '—'}</b></span>
                          <span>Сирот: <b>{a.summary?.orphans ?? '—'}</b></span>
                          <span>Без ссылок из текста: <b>{a.summary?.noTextLinks ?? '—'}</b></span>
                          <span>Битых: <b>{a.summary?.brokenTargets ?? '—'}</b></span>
                        </div>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); remove(a.id); }} aria-label="Удалить"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="new" className="space-y-4">
              {!hasCore && (
                <Card className="p-3 text-sm border-primary/40">Типы «Статья», «Услуга», «Консультация» не настроены — кандидаты на ссылки и проверка услуг будут пустыми. <Button variant="link" className="p-0 h-auto" onClick={() => setTab('types')}>Настроить типы</Button></Card>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                {SLOTS.map((s) => <DropSlot key={s.key} title={s.title} hint={s.hint} required={s.required} file={files[s.key]} onFile={(f) => setFile(s.key, f)} />)}
              </div>
              <Card className="p-4">
                <div className="text-sm font-medium mb-3">Пороги шаблонных ссылок и кандидатов</div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  {([
                    ['templateShare', 'Доля страниц типа (0–1)', 0.05],
                    ['templateMinGroup', 'Мин. страниц в типе', 1],
                    ['listingMin', 'Листинг: ссылок на тип', 1],
                    ['minSim', 'Порог близости', 0.05],
                    ['minImpr', 'Мин. показов (каннибализация)', 10],
                  ] as [keyof AuditSettings, string, number][]).map(([k, label, step]) => (
                    <div key={k} className="space-y-1">
                      <Label className="text-xs">{label}</Label>
                      <Input type="number" step={step} value={settings[k]} onChange={(e) => setSettings((p) => ({ ...p, [k]: Number(e.target.value) }))} />
                    </div>
                  ))}
                </div>
              </Card>
              {running ? (
                <Card className="p-4 space-y-2">
                  <div className="text-sm">{running.stage}…</div>
                  <Progress value={running.pct} />
                </Card>
              ) : (
                <Button onClick={run} disabled={!files.internal || !files.inlinks}><Play className="h-4 w-4 mr-1" />Запустить аудит</Button>
              )}
            </TabsContent>

            <TabsContent value="types">
              <TypeRulesTab projectId={projectId} rules={rules} onSaved={setRules} sampleUrls={sampleUrls} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
