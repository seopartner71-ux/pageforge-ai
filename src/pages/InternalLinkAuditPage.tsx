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
import { Upload, FileSpreadsheet, X, Play, Trash2, Network, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { TypeRulesTab, type RuleRow } from '@/components/internalLinks/TypeRulesTab';
import { AuditResultView } from '@/components/internalLinks/AuditResultView';
import { DEFAULT_SETTINGS, norm, type AuditResult, type AuditSettings } from '@/lib/internalLinks/engine';
import type { AiReport } from '@/lib/internalLinks/exportXlsx';
import { readTable } from '@/lib/internalLinks/readFile';
import { autoDetectTypes, type SamplePage } from '@/lib/internalLinks/autoTypes';
import { loadAudit, saveAudit } from '@/lib/internalLinks/store';


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
  const [samplePages, setSamplePages] = useState<SamplePage[] | null>(null);
  const [autoing, setAutoing] = useState(false);
  const runAuto = async () => {
    if (!samplePages?.length) { toast.error('Сначала загрузите internal_all — по нему ИИ определит типы страниц'); return; }
    setAutoing(true);
    try {
      const r = await autoDetectTypes(projectId, samplePages);
      setRules(r);
      toast.success(`Типы настроены автоматически: ${r.map((x) => x.name).join(', ')}. Проверьте их во вкладке «Типы страниц».`);
    } catch (e) { toast.error((e as Error).message); } finally { setAutoing(false); }
  };
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
      if (!f) { setSampleUrls(null); setSamplePages(null); return; }
      try {
        const rows = readTable(f.name, await f.arrayBuffer());
        const keys = Object.keys(rows[0] ?? {});
        const col = keys.find((c) => ['address', 'адрес'].includes(c.toLowerCase().trim()));
        const tcol = keys.find((c) => /^(title 1|title|h1-1)$/i.test(c.trim()));
        const ccol = keys.find((c) => /^(status code|код ответа)$/i.test(c.trim()));
        const ctcol = keys.find((c) => /^(content type|тип содержимого)$/i.test(c.trim()));
        const ok = col ? rows.filter((r) => (!ccol || Number(r[ccol]) === 200) && (!ctcol || String(r[ctcol] ?? '').toLowerCase().includes('html'))) : [];
        setSampleUrls(col ? rows.map((r) => norm(r[col])).filter(Boolean) : null);
        setSamplePages(col ? ok.map((r) => ({ url: norm(r[col]), title: tcol ? String(r[tcol] ?? '') : '' })).filter((p) => p.url) : null);
      } catch { setSampleUrls(null); setSamplePages(null); }
    }
  };

  const openAudit = async (id: string) => {
    const { results, ai, date, error } = await loadAudit(supabase, id);
    if (error || !results) { toast.error(`Не удалось открыть аудит: ${error ?? 'нет данных'}`); return; }
    setOpen({ id, result: results, ai: (ai as AiReport) ?? null, date });

    setTab('audits');
  };

  const run = async () => {
    if (!files.internal || !files.inlinks || !userId || !projectId) return;
    let gp = files.gscPages, gq = files.gscQp;
    if (!gp && !gq && project?.domain) {
      setRunning({ stage: 'Загрузка данных Search Console', pct: 1 });
      const g = await loadGsc(undefined, true);
      if (g) { gp = g.pf; gq = g.qf; }
    }
    setRunning({ stage: 'Подготовка', pct: 2 });
    const toWf = async (f: File | null) => (f ? { name: f.name, buf: await f.arrayBuffer() } : null);
    const payload = { internal: await toWf(files.internal), inlinks: await toWf(files.inlinks), gscPages: await toWf(gp), gscQp: await toWf(gq), rules, settings };
    const worker = new Worker(new URL('../workers/internalLinks.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = async (e) => {
      const m = e.data;
      if (m.kind === 'progress') { setRunning({ stage: m.stage, pct: m.pct }); return; }
      worker.terminate();
      if (m.kind === 'error') { setRunning(null); toast.error(m.message); return; }
      const result = m.result as AuditResult;
      setRunning({ stage: 'Сохранение', pct: 100 });
      // Списки режутся на части по ~700 КБ и сохраняются отдельными строками:
      // прокси на хостинге отклоняет запросы больше ~1 МБ (413). Ничего не выбрасывается.
      let data: { id: string; created_at: string } | null = null;
      let error: { message: string } | null = null;
      try {
        data = await saveAudit(supabase, {
          project_id: projectId, created_by: userId, status: 'done', settings: settings as any,
          summary: result.summary as any,
          source_note: [files.internal?.name, files.inlinks?.name, gp?.name, gq?.name].filter(Boolean).join(', '),
        }, result);
      } catch (e) { error = { message: (e as Error).message }; }
      setRunning(null);
      if (error || !data) { toast.error(`Расчёт готов, но не сохранился: ${error?.message}`); return; }
      toast.success('Аудит готов');
      setOpen({ id: data.id, result, ai: null, date: data.created_at });

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

  const [gscLoading, setGscLoading] = useState(false);
  const [gscChoices, setGscChoices] = useState<string[] | null>(null);
  const [gscInfo, setGscInfo] = useState<string | null>(null);
  useEffect(() => { setGscChoices(null); setGscInfo(null); setFiles((p) => ({ ...p, gscPages: null, gscQp: null })); }, [projectId]);

  const loadGsc = async (siteUrl?: string, silent = false): Promise<{ pf: File; qf: File } | null> => {
    if (!project?.domain) { if (!silent) toast.error('У проекта не указан домен'); return null; }
    setGscLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gsc-page-data', { body: { domain: project.domain, siteUrl } });
      if (error) {
        let msg = error.message;
        try { const b = await (error as any).context?.json(); msg = b?.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      if (data?.status === 'selection_required') { setGscChoices(data.candidates); if (silent) toast.info('Сайт заведён в Search Console несколькими ресурсами — выберите нужный рядом с кнопкой «Загрузить из Search Console»'); return null; }
      setGscChoices(null);
      const csv = (rows: Record<string, unknown>[], cols: string[]) =>
        [cols.join(','), ...rows.map((r) => cols.map((c) => { const v = String(r[c] ?? ''); return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v; }).join(','))].join('\n');
      const pf = new File([csv(data.pages, ['page', 'clicks', 'impressions', 'position'])], 'gsc_pages.csv', { type: 'text/csv' });
      const qf = new File([csv(data.queryPages, ['query', 'page', 'clicks', 'impressions', 'position'])], 'gsc_query_page.csv', { type: 'text/csv' });
      setFiles((p) => ({ ...p, gscPages: pf, gscQp: qf }));
      setGscInfo(`Search Console (${data.siteUrl}), ${data.startDate} — ${data.endDate}: страниц ${data.pages.length}, пар запрос+страница ${data.queryPages.length}`);
      toast.success('Данные Search Console загружены');
      return { pf, qf };
    } catch (e) {
      const msg = (e as Error).message;
      setGscInfo(`Search Console: ${msg}`);
      if (silent) toast.warning(`Аудит без данных Search Console: ${msg}`); else toast.error(msg);
      return null;
    } finally { setGscLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container mx-auto px-4 py-6 space-y-4 max-w-7xl">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2"><Network className="h-6 w-6 text-primary" />Аудит перелинковки</h1>
            <PageDescription items={[
              { label: 'Что делает', text: 'Анализирует внутренние ссылки по выгрузкам Screaming Frog: сироты, PageRank, ссылки из текста, битые и редиректы, кандидаты «статья → услуга», каннибализация.' },
              { label: 'Данные', text: 'Файлы обрабатываются в браузере и не загружаются на сервер. Сохраняются только итоги аудита.' },
              { label: 'Результат', text: 'План действий с приоритетами, выводы и рекомендации ИИ, выгрузка в Excel.' },
            ]} />
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
                <Card className="p-3 text-sm border-primary/40 flex items-center gap-3 flex-wrap">
                  <span className="flex-1 min-w-[260px]">Типы «Статья», «Услуга», «Консультация» не настроены — кандидаты на ссылки и проверка услуг будут пустыми.{!samplePages && ' Загрузите internal_all, чтобы настроить их автоматически.'}</span>
                  <Button size="sm" onClick={runAuto} disabled={autoing || !samplePages}><Sparkles className="h-4 w-4 mr-1" />{autoing ? 'ИИ определяет типы…' : 'Настроить автоматически'}</Button>
                  <Button variant="link" className="p-0 h-auto" onClick={() => setTab('types')}>Вручную</Button>
                </Card>
              )}
              <div className="grid md:grid-cols-2 gap-3">
                {SLOTS.map((s) => <DropSlot key={s.key} title={s.title} hint={s.hint} required={s.required} file={files[s.key]} onFile={(f) => setFile(s.key, f)} />)}
              </div>
              <Card className="p-3 flex items-center gap-3 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => loadGsc()} disabled={gscLoading}>
                  <Download className="h-4 w-4 mr-1" />{gscLoading ? 'Загружаю…' : 'Загрузить из Search Console'}
                </Button>
                {gscChoices && (
                  <div className="w-72">
                    <Select onValueChange={(v) => loadGsc(v)}>
                      <SelectTrigger><SelectValue placeholder="Выберите ресурс Search Console" /></SelectTrigger>
                      <SelectContent>{gscChoices.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <span className="text-xs text-muted-foreground">{gscInfo ?? 'Данные за 90 дней подтянутся автоматически при запуске аудита.'}</span>
              </Card>
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
              <Card className="p-3 mb-3 flex items-center gap-3 flex-wrap text-sm">
                <Button size="sm" variant="outline" onClick={runAuto} disabled={autoing || !samplePages}><Sparkles className="h-4 w-4 mr-1" />{autoing ? 'ИИ определяет типы…' : 'Настроить автоматически (ИИ)'}</Button>
                <span className="text-xs text-muted-foreground">ИИ изучит адреса и заголовки страниц из internal_all и заменит текущие правила.</span>
              </Card>
              <TypeRulesTab projectId={projectId} rules={rules} onSaved={setRules} sampleUrls={sampleUrls} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}
