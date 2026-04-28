import { useMemo, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BarChart3, Clock, Loader2, Download, Search, Play, X } from 'lucide-react';
import { REGION_GROUPS } from '@/lib/semanticCore/types';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

interface PositionItem { position: number; domain: string; url: string; title: string }
interface Snapshot { date: string; items: PositionItem[] }
interface ApiResponse {
  keyword: string; region: string; engine: 'yandex' | 'google'; depth: number;
  snapshots: Snapshot[]; current: PositionItem[]; fallback: boolean; message: string | null;
  serper_error?: 'no_credits' | 'no_key' | 'api_error' | null;
  serper_message?: string | null;
}

const AGGREGATORS = new Set([
  'yandex.ru', 'market.yandex.ru', 'google.ru', 'mail.ru', 'rambler.ru',
]);
const MARKETPLACES = new Set([
  'ozon.ru', 'wildberries.ru', 'wb.ru', 'aliexpress.ru', 'beru.ru',
  'sbermegamarket.ru', 'megamarket.ru', 'avito.ru', 'lamoda.ru', 'kazanexpress.ru',
]);

function detectBadge(domain: string): { label: string; cls: string } | null {
  const d = domain.toLowerCase();
  if (MARKETPLACES.has(d)) return { label: 'МП', cls: 'bg-secondary text-muted-foreground border border-border' };
  if (AGGREGATORS.has(d)) return { label: 'Агрегатор', cls: 'bg-secondary text-muted-foreground border border-border' };
  return null;
}

function isAggregatorDomain(d: string): boolean {
  const lc = d.toLowerCase();
  return AGGREGATORS.has(lc) || MARKETPLACES.has(lc);
}

function monthLabel(date: string): string {
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

export default function SerpHistoryPage() {
  const [keyword, setKeyword] = useState('');
  const [region, setRegion] = useState('Москва');
  const [engine, setEngine] = useState<'yandex' | 'google'>('yandex');
  const [depth, setDepth] = useState(10);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [hideAggregators, setHideAggregators] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [detail, setDetail] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const months = useMemo(() => (data?.snapshots || []).map(s => s.date), [data]);

  // matrix[position][monthIdx] = domain
  const matrix = useMemo(() => {
    if (!data) return [] as (PositionItem | null)[][];
    const rows: (PositionItem | null)[][] = [];
    for (let pos = 1; pos <= data.depth; pos++) {
      const row: (PositionItem | null)[] = [];
      for (const snap of data.snapshots) {
        const item = snap.items.find(it => it.position === pos) || null;
        row.push(item);
      }
      rows.push(row);
    }
    return rows;
  }, [data]);

  // Detect cell change-types: build per-domain history of all positions across all months
  const domainPrevPos = useMemo(() => {
    if (!data) return new Map<string, Map<number, number | undefined>>();
    const m = new Map<string, Map<number, number | undefined>>();
    const allDomains = new Set<string>();
    for (const snap of data.snapshots) for (const it of snap.items) allDomains.add(it.domain);
    for (const dom of allDomains) {
      const perMonth = new Map<number, number | undefined>();
      let prev: number | undefined = undefined;
      data.snapshots.forEach((snap, idx) => {
        const found = snap.items.find(it => it.domain === dom);
        perMonth.set(idx, prev);
        prev = found?.position;
      });
      m.set(dom, perMonth);
    }
    return m;
  }, [data]);

  const cellClass = (item: PositionItem | null, monthIdx: number): string => {
    if (!item) return 'bg-muted/30 text-muted-foreground';
    if (isAggregatorDomain(item.domain)) return 'bg-secondary/60 text-muted-foreground';
    const prev = domainPrevPos.get(item.domain)?.get(monthIdx);
    if (prev === undefined) return 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'; // newcomer
    if (prev === item.position) return 'bg-card';
    if (prev > item.position) return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'; // moved up
    return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'; // moved down
  };

  // Find domains that dropped (were in previous month, not in current)
  const droppedCells: { monthIdx: number; domain: string; prevPos: number }[] = useMemo(() => {
    if (!data) return [];
    const out: { monthIdx: number; domain: string; prevPos: number }[] = [];
    data.snapshots.forEach((snap, idx) => {
      if (idx === 0) return;
      const prev = data.snapshots[idx - 1];
      for (const item of prev.items) {
        if (!snap.items.find(x => x.domain === item.domain)) {
          out.push({ monthIdx: idx, domain: item.domain, prevPos: item.position });
        }
      }
    });
    return out;
  }, [data]);

  const visibleRows = useMemo(() => {
    if (!data) return [] as { pos: number; cells: (PositionItem | null)[] }[];
    let rows = matrix.map((cells, i) => ({ pos: i + 1, cells }));
    if (hideAggregators) {
      rows = rows.map(r => ({
        ...r,
        cells: r.cells.map(c => (c && isAggregatorDomain(c.domain) ? null : c)),
      }));
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(r => r.cells.some(c => c?.domain?.toLowerCase().includes(q)));
    }
    if (onlyChanged) {
      rows = rows.filter(r => {
        const seen = new Set(r.cells.filter(Boolean).map(c => c!.domain));
        return seen.size > 1;
      });
    }
    return rows;
  }, [matrix, hideAggregators, search, onlyChanged, data]);

  const run = async () => {
    if (!keyword.trim()) {
      toast.error('Введите поисковую фразу');
      inputRef.current?.focus();
      return;
    }
    setLoading(true);
    setData(null);
    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast.error('Сессия истекла'); setLoading(false); return; }

      const { data: projects } = await supabase
        .from('projects').select('id').eq('user_id', session.user.id)
        .order('created_at', { ascending: false }).limit(1);
      const projectId = projects?.[0]?.id || null;

      const { data: resp, error } = await supabase.functions.invoke('serp-history', {
        body: { keyword: keyword.trim(), region, engine, depth, project_id: projectId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if ((resp as any)?.error) throw new Error((resp as any).error);
      setData(resp as ApiResponse);
      if ((resp as ApiResponse).fallback) {
        toast.message('Показаны только текущие данные', {
          description: (resp as ApiResponse).message || 'История накапливается с первого запроса.',
        });
      } else {
        toast.success(`Загружено ${(resp as ApiResponse).snapshots.length} снимков SERP`);
      }
    } catch (e: any) {
      toast.error(`Ошибка: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const exportXlsx = () => {
    if (!data) { toast.error('Сначала запустите анализ'); return; }
    const wb = XLSX.utils.book_new();
    // Sheet 1: matrix
    const header = ['Позиция', ...data.snapshots.map(s => monthLabel(s.date))];
    const sheet1: any[][] = [header];
    matrix.forEach((row, i) => {
      sheet1.push([i + 1, ...row.map(c => c?.domain || '')]);
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), 'История SERP');

    // Sheet 2: current top
    const sheet2: any[][] = [['Позиция', 'Домен', 'URL', 'Заголовок']];
    data.current.forEach(it => sheet2.push([it.position, it.domain, it.url, it.title]));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), 'Текущий топ');

    // Sheet 3: domain analytics
    const stats = new Map<string, number[]>();
    for (const snap of data.snapshots) for (const it of snap.items) {
      if (!stats.has(it.domain)) stats.set(it.domain, []);
      stats.get(it.domain)!.push(it.position);
    }
    const sheet3: any[][] = [['Домен', 'Месяцев в топе', 'Лучшая', 'Худшая', 'Средняя', 'Тренд']];
    for (const [dom, ps] of stats) {
      const avg = ps.reduce((a, b) => a + b, 0) / ps.length;
      const trend = ps.length < 2 ? 'нов.' : ps[ps.length - 1] < ps[0] ? 'растёт' : ps[ps.length - 1] > ps[0] ? 'падает' : 'стабилен';
      sheet3.push([dom, ps.length, Math.min(...ps), Math.max(...ps), Math.round(avg * 10) / 10, trend]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3), 'Анализ доменов');

    const safeKw = keyword.replace(/[^\wа-яА-Я-]/gi, '_').slice(0, 40);
    XLSX.writeFile(wb, `SERP_history_${safeKw}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success('XLSX скачан ✓');
  };

  const detailStats = useMemo(() => {
    if (!detail || !data) return null;
    const positions: { date: string; pos: number }[] = [];
    for (const snap of data.snapshots) {
      const it = snap.items.find(x => x.domain === detail);
      if (it) positions.push({ date: snap.date, pos: it.position });
    }
    if (!positions.length) return null;
    const ps = positions.map(p => p.pos);
    return {
      months: positions.length,
      best: Math.min(...ps),
      worst: Math.max(...ps),
      avg: Math.round((ps.reduce((a, b) => a + b, 0) / ps.length) * 10) / 10,
      timeline: positions,
    };
  }, [detail, data]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <div className="container py-6 space-y-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-semibold">История SERP</h1>
        </div>

        {/* INPUT PANEL */}
        <Card className="p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Поисковая фраза</Label>
              <Input
                ref={inputRef}
                placeholder="купить букет москва"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Региональная база</Label>
              <div className="flex gap-2">
                <Select value={engine} onValueChange={(v) => setEngine(v as any)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yandex">Яндекс</SelectItem>
                    <SelectItem value="google">Google</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REGION_GROUPS.map((g) => (
                      <SelectGroup key={g.label}>
                        <SelectLabel>{g.label}</SelectLabel>
                        {g.regions.map((r) => (
                          <SelectItem key={r} value={r}>{r}</SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Глубина проверки</Label>
            <div className="flex gap-2 flex-wrap">
              {[5, 10, 20, 50].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={depth === d ? 'default' : 'outline'}
                  onClick={() => setDepth(d)}
                >
                  ТОП-{d}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-xs text-muted-foreground">Анализ спишет 3 кредита</p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!data}>
                <Download className="w-4 h-4 mr-1" /> XLSX
              </Button>
              <Button onClick={run} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
                Обработать
              </Button>
            </div>
          </div>

          {loading && (
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Получаем исторические данные SERP...
            </div>
          )}
        </Card>

        {/* EMPTY STATE */}
        {!data && !loading && (
          <Card className="p-12 text-center space-y-3">
            <div className="flex justify-center gap-2 text-primary">
              <BarChart3 className="w-12 h-12" />
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-semibold">Узнайте кто был в топе</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Введите запрос и посмотрите историю выдачи за последние 2-3 года.
              Отслеживайте конкурентов и находите новых игроков.
            </p>
            <Button onClick={() => inputRef.current?.focus()}>Начать анализ</Button>
          </Card>
        )}

        {/* TABLE */}
        {data && data.snapshots.length > 0 && (
          <>
            {/* Engine-specific banners */}
            {data.engine === 'yandex' && (
              <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
                <div className="text-sm">
                  <div className="font-medium mb-1">ℹ️ Яндекс: история накапливается</div>
                  <div className="text-muted-foreground">
                    DataForSEO не предоставляет историю выдачи Яндекса. История накапливается при каждом запросе. Запускайте анализ ежемесячно для построения полной картины.
                  </div>
                </div>
              </Card>
            )}
            {data.engine === 'google' && data.fallback && (
              <Card className="p-4 border-l-4 border-l-primary bg-primary/5">
                <div className="text-sm">
                  <div className="font-medium mb-1">ℹ️ Показана только текущая выдача</div>
                  <div className="text-muted-foreground">
                    {data.message || 'Исторические данные DataForSEO недоступны для этого запроса. История будет накапливаться при каждом новом запросе.'}
                  </div>
                </div>
              </Card>
            )}

            {/* Snapshot accumulation summary */}
            <Card className="p-4 flex items-center justify-between flex-wrap gap-3 bg-card">
              <div className="text-sm">
                <span className="font-medium">Накоплено снимков:</span>{' '}
                <span className="text-primary font-semibold">{data.snapshots.length}</span>
                {data.snapshots.length > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({data.snapshots.map(s => monthLabel(s.date)).join(', ')})
                  </span>
                )}
              </div>
              {data.snapshots.length < 3 && (
                <div className="text-xs text-muted-foreground italic">
                  💡 Совет: запускайте анализ раз в месяц — через 3-4 месяца появится полная история выдачи для сравнения конкурентов.
                </div>
              )}
            </Card>
            {/* FILTERS */}
            <Card className="p-4 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Switch checked={hideAggregators} onCheckedChange={setHideAggregators} id="hide-agg" />
                <Label htmlFor="hide-agg" className="text-sm">Скрыть агрегаторы и маркетплейсы</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={onlyChanged} onCheckedChange={setOnlyChanged} id="only-changed" />
                <Label htmlFor="only-changed" className="text-sm">Только изменения</Label>
              </div>
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Найти домен..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8"
                />
              </div>
            </Card>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className="bg-emerald-600 text-white font-bold px-3 py-2 text-left sticky left-0 z-10 border-r border-emerald-700">
                        Поз.
                      </th>
                      {data.snapshots.map((s) => (
                        <th
                          key={s.date}
                          className="bg-emerald-600 text-white font-bold px-3 py-2 text-left whitespace-nowrap border-r border-emerald-700/30"
                        >
                          {monthLabel(s.date)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((row) => (
                      <tr key={row.pos} className="border-b border-border/50">
                        <td className="px-3 py-1.5 font-semibold sticky left-0 bg-card border-r border-border/60 text-muted-foreground">
                          {row.pos}
                        </td>
                        {row.cells.map((cell, monthIdx) => {
                          const dropped = !cell && droppedCells.find(d => d.monthIdx === monthIdx && d.prevPos === row.pos);
                          return (
                            <td
                              key={monthIdx}
                              className={`px-3 py-1.5 border-r border-border/30 whitespace-nowrap cursor-pointer ${
                                dropped
                                  ? 'bg-red-500/15 text-red-700 dark:text-red-400'
                                  : cellClass(cell, monthIdx)
                              } ${search && cell?.domain?.toLowerCase().includes(search.toLowerCase()) ? 'ring-2 ring-primary ring-inset' : ''}`}
                              onClick={() => cell && setDetail(cell.domain)}
                              title={cell?.url || ''}
                            >
                              {dropped ? (
                                <span className="text-xs italic">выбыл: {dropped.domain}</span>
                              ) : cell ? (
                                <div className="flex items-center gap-1.5">
                                  <span>{cell.domain}</span>
                                  {detectBadge(cell.domain) && (
                                    <Badge variant="outline" className={`${detectBadge(cell.domain)!.cls} text-[9px] py-0 px-1`}>
                                      {detectBadge(cell.domain)!.label}
                                    </Badge>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground/40">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* LEGEND */}
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/15 inline-block" /> Новичок / вырос</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/15 inline-block" /> Выбыл</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/10 inline-block" /> Упал</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-card border border-border inline-block" /> Без изменений</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-secondary inline-block" /> Агрегатор / МП</span>
            </div>

            {/* CURRENT TOP — always show details for today */}
            {data.current && data.current.length > 0 && (
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                  <div className="font-semibold">Текущий ТОП — {new Date().toLocaleDateString('ru-RU')}</div>
                  <div className="text-xs text-muted-foreground">{data.engine === 'yandex' ? 'Яндекс' : 'Google'} · {data.region}</div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 w-14">Поз.</th>
                        <th className="px-3 py-2">Домен</th>
                        <th className="px-3 py-2">Заголовок</th>
                        <th className="px-3 py-2">URL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.current.map((it) => (
                        <tr key={it.position} className="border-b border-border/40 hover:bg-muted/30">
                          <td className="px-3 py-2 font-semibold text-muted-foreground">{it.position}</td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <img src={`https://www.google.com/s2/favicons?domain=${it.domain}&sz=16`} alt="" className="w-4 h-4" />
                              <span className="font-medium">{it.domain}</span>
                              {detectBadge(it.domain) && (
                                <Badge variant="outline" className={`${detectBadge(it.domain)!.cls} text-[9px] py-0 px-1`}>
                                  {detectBadge(it.domain)!.label}
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2 max-w-md truncate" title={it.title}>{it.title}</td>
                          <td className="px-3 py-2 max-w-xs truncate text-xs text-muted-foreground">
                            <a href={it.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline" title={it.url}>
                              {it.url}
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}

        {/* DOMAIN DETAIL MODAL */}
        <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <img src={`https://www.google.com/s2/favicons?domain=${detail}&sz=32`} alt="" className="w-5 h-5" />
                {detail}
              </DialogTitle>
            </DialogHeader>
            {detailStats && (
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 rounded-md bg-secondary"><div className="text-xs text-muted-foreground">Месяцев</div><div className="text-xl font-bold">{detailStats.months}</div></div>
                  <div className="p-3 rounded-md bg-secondary"><div className="text-xs text-muted-foreground">Лучшая</div><div className="text-xl font-bold text-emerald-500">{detailStats.best}</div></div>
                  <div className="p-3 rounded-md bg-secondary"><div className="text-xs text-muted-foreground">Худшая</div><div className="text-xl font-bold text-orange-500">{detailStats.worst}</div></div>
                  <div className="p-3 rounded-md bg-secondary"><div className="text-xs text-muted-foreground">Средняя</div><div className="text-xl font-bold">{detailStats.avg}</div></div>
                </div>
                <div className="space-y-1 max-h-60 overflow-auto">
                  {detailStats.timeline.map((t) => (
                    <div key={t.date} className="flex justify-between text-sm border-b border-border/40 py-1">
                      <span className="text-muted-foreground">{monthLabel(t.date)}</span>
                      <span className="font-mono">поз. {t.pos}</span>
                    </div>
                  ))}
                </div>
                <Button asChild className="w-full">
                  <a href={`/dashboard?url=${encodeURIComponent('https://' + detail)}`}>Проверить сайт</a>
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}