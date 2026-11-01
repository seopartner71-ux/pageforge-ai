import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, FileDown, Trash2, History, Database, ShieldAlert } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MODULE_BY_PATH, normalizeReport, type ModuleReport, type ModuleEvidence } from '@/lib/analytics/moduleConfig';
import { exportModuleDocx } from '@/lib/analytics/exportModuleDocx';
import NotFound from '@/pages/NotFound';

const EMPTY = { niche: '', site: '', geo: 'Россия', product: '', audience: '', businessType: '', extra: '', queries: '' };

type SavedRow = {
  id: string;
  title: string;
  niche: string;
  geo: string;
  site: string;
  created_at: string;
  form: Record<string, string>;
  report: unknown;
  evidence: ModuleEvidence;
};

async function readError(e: any): Promise<string> {
  try { const j = await e?.context?.json?.(); if (j?.error) return j.error; } catch { /* ignore */ }
  return e?.message || 'Ошибка запроса';
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

export default function ModuleAnalysisPage() {
  const { pathname } = useLocation();
  const cfg = MODULE_BY_PATH[pathname];
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<ModuleReport | null>(null);
  const [evidence, setEvidence] = useState<ModuleEvidence | null>(null);
  const [saved, setSaved] = useState<SavedRow[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => { setData(null); setEvidence(null); setOpenId(null); }, [pathname]);

  useEffect(() => {
    if (!cfg) return;
    let alive = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: rows } = await supabase
        .from('module_analyses')
        .select('id,title,niche,geo,site,created_at,form,report,evidence')
        .eq('module_id', cfg.id)
        .order('created_at', { ascending: false })
        .limit(12);
      if (alive && Array.isArray(rows)) setSaved(rows as SavedRow[]);
    })();
    return () => { alive = false; };
  }, [cfg?.id]);

  useEffect(() => {
    if (!loading) return;
    setTick(0);
    const id = setInterval(() => setTick((t) => Math.min(t + 1, 95)), 900);
    return () => clearInterval(id);
  }, [loading]);

  if (!cfg) return <NotFound />;
  const set = (k: keyof typeof EMPTY, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function run() {
    setLoading(true); setData(null); setEvidence(null); setOpenId(null);
    try {
      const queries = form.queries.split(/[,\n;]+/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
      const { data: resp, error } = await supabase.functions.invoke('analyze-module', { body: { module: cfg.id, ...form, queries } });
      if (error) throw new Error(await readError(error));
      const r = normalizeReport((resp as any)?.report);
      if (!r) throw new Error('ИИ вернул пустой отчёт, попробуйте ещё раз');
      const ev = ((resp as any)?.evidence ?? null) as ModuleEvidence | null;
      setData(r); setEvidence(ev);

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        const { error: insErr } = await supabase.from('module_analyses').insert({
          user_id: user.id,
          module_id: cfg.id,
          title: form.niche.trim(),
          niche: form.niche.trim(),
          geo: form.geo.trim(),
          site: form.site.trim(),
          form,
          report: r,
          evidence: ev ?? {},
        });
        if (insErr) toast({ title: 'Отчёт не сохранён в историю', description: insErr.message, variant: 'destructive' });
        else {
          setOpenId(null);
          const { data: rows } = await supabase
            .from('module_analyses')
            .select('id,title,niche,geo,site,created_at,form,report,evidence')
            .eq('module_id', cfg.id)
            .order('created_at', { ascending: false })
            .limit(12);
          if (Array.isArray(rows)) setSaved(rows as SavedRow[]);
        }
      }
    } catch (e: any) {
      toast({ title: 'Не удалось построить отчёт', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
  }

  function openSaved(row: SavedRow) {
    const r = normalizeReport(row.report);
    if (!r) { toast({ title: 'Сохранённый отчёт повреждён', variant: 'destructive' }); return; }
    setData(r);
    setEvidence(row.evidence ?? null);
    setForm({ ...EMPTY, ...(row.form || {}) });
    setOpenId(row.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function removeSaved(id: string) {
    const { error } = await supabase.from('module_analyses').delete().eq('id', id);
    if (error) { toast({ title: 'Не удалось удалить', description: error.message, variant: 'destructive' }); return; }
    setSaved((s) => s.filter((x) => x.id !== id));
    if (openId === id) { setData(null); setEvidence(null); setOpenId(null); }
  }

  const field = (k: keyof typeof EMPTY, label: string, ph: string, wide = false) => (
    <div className={`space-y-2 ${wide ? 'md:col-span-2' : ''}`}>
      <Label htmlFor={k}>{label}</Label>
      <Input id={k} placeholder={ph} value={form[k]} onChange={(e) => set(k, e.target.value)} />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{cfg.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{cfg.desc}</p>
        </div>

        {!data && !loading && (
          <Card className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {field('niche', 'Ниша / тематика *', 'Например: рукава высокого давления', true)}
              {field('site', 'Сайт', 'example.ru')}
              {field('geo', 'Регион', 'Россия, Челябинск')}
              {field('product', 'Продукт / услуги', 'Что вы продаёте', true)}
              {field('audience', 'Аудитория', 'Кто ваши клиенты')}
              {field('businessType', 'Тип бизнеса', 'B2B, B2C, локальный, интернет-магазин')}
              {field('extra', 'Дополнительно', 'Особенности, ограничения, конкуренты', true)}
              {field('queries', 'Свои запросы для проверки выдачи', 'Через запятую: купить рукава рцд, рукава цена…', true)}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              По этим запросам сервис реально посмотрит ТОП-10 Google и соберёт частоты запросов — вывод ИИ будет опираться на них, а не только на догадки.
            </p>
            <div className="mt-6 flex justify-end">
              <Button size="lg" onClick={run} disabled={form.niche.trim().length < 2}>
                <Sparkles className="w-4 h-4 mr-2" />{cfg.cta}
              </Button>
            </div>
          </Card>
        )}

        {loading && (
          <Card className="p-12 flex flex-col items-center gap-5 text-center">
            <Loader2 className="w-10 h-10 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              Сначала смотрим реальную выдачу и частоты по «{form.niche}», потом Senior-аналитик разбирает данные… до 2 минут
            </p>
            <Progress value={tick} className="max-w-md" />
          </Card>
        )}

        {data && !loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">«{form.niche}»</h2>
              <div className="flex gap-2">
                <Button onClick={() => exportModuleDocx(cfg.title, form.niche, data)}><FileDown className="w-4 h-4 mr-2" />Скачать Word</Button>
                <Button variant="outline" onClick={() => { setData(null); setEvidence(null); setOpenId(null); }}>Новый анализ</Button>
              </div>
            </div>

            <Card className="p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Database className="w-4 h-4 text-primary" />
                Откуда данные в этом отчёте
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {evidence?.serp_queries ? (
                  <span className="px-2 py-1 rounded border border-border text-muted-foreground">
                    реальная выдача Google: {evidence.serp_queries} {evidence.serp_queries === 1 ? 'запрос' : 'запросов'}
                  </span>
                ) : null}
                {evidence?.keywords ? (
                  <span className="px-2 py-1 rounded border border-border text-muted-foreground">
                    реальные частоты: {evidence.keywords} {evidence.keywords === 1 ? 'фраза' : 'фраз'}
                  </span>
                ) : null}
                {!evidence?.serp_queries && !evidence?.keywords ? (
                  <span className="px-2 py-1 rounded border border-border text-muted-foreground">
                    реальных данных нет — только экспертная оценка ИИ
                  </span>
                ) : null}
              </div>
              {evidence?.serp_top?.length ? (
                <div className="grid md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  {evidence.serp_top.map((s, i) => (
                    <div key={i} className="flex justify-between gap-2 border-b border-border pb-1">
                      <span className="truncate">{s.query}</span>
                      <span className="shrink-0">
                        конкурентов {s.competitors} · агрегаторов {s.aggregators}{s.ai_overview ? ' · ИИ-ответ' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
              {evidence?.notes?.length ? (
                <div className="space-y-1">
                  {evidence.notes.map((n, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 mt-0.5 shrink-0" />{n}
                    </p>
                  ))}
                </div>
              ) : null}
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {data.scores.map((s) => (
                <Card key={s.label} className="p-4 space-y-2">
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                  <div className="text-3xl font-semibold text-foreground">{s.value}<span className="text-sm text-muted-foreground">/100</span></div>
                  <Progress value={s.value} />
                  {s.comment && <p className="text-xs text-muted-foreground">{s.comment}</p>}
                </Card>
              ))}
            </div>

            <Card className="p-5 space-y-3">
              <h3 className="font-semibold text-foreground">Вывод</h3>
              {data.verdict.overview && <p className="text-sm text-foreground">{data.verdict.overview}</p>}
              <div className="grid md:grid-cols-3 gap-3 text-sm">
                {data.verdict.main_opportunity && <div><div className="text-xs text-muted-foreground">Главная возможность</div>{data.verdict.main_opportunity}</div>}
                {data.verdict.main_risk && <div><div className="text-xs text-muted-foreground">Главный риск</div>{data.verdict.main_risk}</div>}
                {data.verdict.strategy && <div><div className="text-xs text-muted-foreground">Стратегия</div>{data.verdict.strategy}</div>}
              </div>
            </Card>

            <div className="grid md:grid-cols-2 gap-4">
              {data.top_lists.map((l) => (
                <Card key={l.title} className="p-5">
                  <h3 className="font-semibold text-foreground mb-2">{l.title}</h3>
                  <ol className="list-decimal pl-5 space-y-1 text-sm text-foreground">{l.items.map((i, n) => <li key={n}>{i}</li>)}</ol>
                </Card>
              ))}
            </div>

            {data.table.rows.length > 0 && (
              <Card className="p-5 overflow-x-auto">
                <h3 className="font-semibold text-foreground mb-3">{data.table.title}</h3>
                <table className="w-full text-sm">
                  <thead><tr>{data.table.columns.map((c) => <th key={c} className="text-left p-2 border-b border-border text-muted-foreground font-medium">{c}</th>)}</tr></thead>
                  <tbody>{data.table.rows.map((r, i) => (
                    <tr key={i} className="align-top">{data.table.columns.map((_, j) => <td key={j} className="p-2 border-b border-border text-foreground">{r[j]}</td>)}</tr>
                  ))}</tbody>
                </table>
              </Card>
            )}

            {data.roadmap.length > 0 && (
              <div className="grid md:grid-cols-3 gap-4">
                {data.roadmap.map((ph) => (
                  <Card key={ph.phase} className="p-5">
                    <h3 className="font-semibold text-foreground mb-2">{ph.phase}</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm text-foreground">{ph.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {saved.length > 0 && (
          <Card className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-foreground">Мои отчёты</h3>
              <span className="text-xs text-muted-foreground">сохраняются автоматически</span>
            </div>
            <div className="divide-y divide-border">
              {saved.map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-3 py-2">
                  <button className="text-left min-w-0 flex-1" onClick={() => openSaved(row)}>
                    <div className="text-sm text-foreground truncate">{row.title || 'Без названия'}</div>
                    <div className="text-xs text-muted-foreground">
                      {fmtDate(row.created_at)}{row.geo ? ` · ${row.geo}` : ''}{row.site ? ` · ${row.site}` : ''}
                    </div>
                  </button>
                  <Button variant="ghost" size="icon" onClick={() => removeSaved(row.id)} aria-label="Удалить отчёт">
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
