import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Loader2, Sparkles, FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { MODULE_BY_PATH, normalizeReport, type ModuleReport } from '@/lib/analytics/moduleConfig';
import { exportModuleDocx } from '@/lib/analytics/exportModuleDocx';
import NotFound from '@/pages/NotFound';

const EMPTY = { niche: '', site: '', geo: 'Россия', product: '', audience: '', businessType: '', extra: '' };

async function readError(e: any): Promise<string> {
  try { const j = await e?.context?.json?.(); if (j?.error) return j.error; } catch { /* ignore */ }
  return e?.message || 'Ошибка запроса';
}

export default function ModuleAnalysisPage() {
  const { pathname } = useLocation();
  const cfg = MODULE_BY_PATH[pathname];
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);
  const [data, setData] = useState<ModuleReport | null>(null);

  useEffect(() => { setData(null); }, [pathname]);
  useEffect(() => {
    if (!loading) return;
    setTick(0);
    const id = setInterval(() => setTick((t) => Math.min(t + 1, 95)), 900);
    return () => clearInterval(id);
  }, [loading]);

  if (!cfg) return <NotFound />;
  const set = (k: keyof typeof EMPTY, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function run() {
    setLoading(true); setData(null);
    try {
      const { data: resp, error } = await supabase.functions.invoke('analyze-module', { body: { module: cfg.id, ...form } });
      if (error) throw new Error(await readError(error));
      const r = normalizeReport((resp as any)?.report);
      if (!r) throw new Error('ИИ вернул пустой отчёт, попробуйте ещё раз');
      setData(r);
    } catch (e: any) {
      toast({ title: 'Не удалось построить отчёт', description: e?.message, variant: 'destructive' });
    } finally { setLoading(false); }
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
            </div>
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
            <p className="text-sm text-muted-foreground">Senior-аналитик разбирает «{form.niche}»… обычно до 1–2 минут</p>
            <Progress value={tick} className="max-w-md" />
          </Card>
        )}

        {data && !loading && (
          <div className="space-y-6">
            <div className="flex justify-between items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-foreground">«{form.niche}»</h2>
              <div className="flex gap-2">
                <Button onClick={() => exportModuleDocx(cfg.title, form.niche, data)}><FileDown className="w-4 h-4 mr-2" />Скачать Word</Button>
                <Button variant="outline" onClick={() => setData(null)}>Новый анализ</Button>
              </div>
            </div>

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
      </main>
    </div>
  );
}
