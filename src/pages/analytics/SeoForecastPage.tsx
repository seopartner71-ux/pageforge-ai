import { useState, useCallback, useMemo, useEffect } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { BarChart2, Upload, RotateCcw, Download, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Loader2, Plus, X } from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import {
  parseMetrikaTraffic, parseMetrikaSources, parseGsc, parseTopvisor,
  parseWebmasterQueries, parseGeneric,
  type ParsedTraffic, type ParsedSources, type ParsedGsc, type ParsedTopvisor,
  type ParsedWebmasterQueries, type ParsedGeneric,
} from '@/lib/analytics/forecastParsers';
import { calculateForecast, type ForecastProjectData, type ForecastResult } from '@/lib/analytics/forecastCalculator';
import { exportSeoForecastDocx } from '@/lib/analytics/exportSeoForecastDocx';

type FileSlot = { status: 'idle' | 'ok' | 'error'; name?: string; error?: string };

type ExtraFileType =
  | 'wm_queries' | 'wm_indexing' | 'wm_links'
  | 'direct_stats' | 'roistat' | 'other';

const EXTRA_TYPE_LABELS: Record<ExtraFileType, string> = {
  wm_queries: 'Яндекс.Вебмастер — поисковые запросы',
  wm_indexing: 'Яндекс.Вебмастер — индексация',
  wm_links: 'Яндекс.Вебмастер — внешние ссылки',
  direct_stats: 'Яндекс.Директ — статистика',
  roistat: 'Roistat — источники',
  other: 'Другое (указать вручную)',
};

type ExtraRow = {
  id: string;
  type: ExtraFileType | '';
  customName?: string;
  slot: FileSlot;
  parsed?: ParsedWebmasterQueries | ParsedGeneric | null;
};

const emptyProject: ForecastProjectData = {
  domain: '', clientName: '', topic: '', region: '',
  horizon: 3,
  engines: { yandex: true, google: true, bing: false },
  siteStatus: 'growing',
  works: { blog: false, cards: false, links: false, crowd: false, external: false, tech: false },
  publishPace: undefined,
  context: '',
};

function Stepper({ step }: { step: number }) {
  const items = [
    { n: 1, label: 'Данные проекта' },
    { n: 2, label: 'Загрузка файлов' },
    { n: 3, label: 'Прогноз и отчёт' },
  ];
  return (
    <div className="flex items-center gap-4 mb-6">
      {items.map((it, i) => (
        <div key={it.n} className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border ${step >= it.n ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border'}`}>
            {it.n}
          </div>
          <div className={`text-sm ${step >= it.n ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{it.label}</div>
          {i < items.length - 1 && <div className="w-8 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function FileBlock<T>({
  title, hint, slot, parsed, onFile, onRemove, summaryNode,
}: {
  title: string;
  hint: string;
  slot: FileSlot;
  parsed: T | null;
  onFile: (file: File) => void;
  onRemove?: () => void;
  summaryNode?: React.ReactNode;
}) {
  const [drag, setDrag] = useState(false);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{hint}</div>
        </div>
        <div className="text-xs flex items-center gap-2">
          {slot.status === 'ok' && (
            <>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 border border-green-500/30 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Загружен
              </span>
              {onRemove && (
                <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600 transition">
                  <X className="w-3.5 h-3.5" /> Удалить файл
                </button>
              )}
            </>
          )}
          {slot.status === 'error' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/30 font-medium">
              <XCircle className="w-3.5 h-3.5" /> Ошибка
            </span>
          )}
          {slot.status === 'idle' && <span className="text-muted-foreground">Не загружен</span>}
        </div>
      </div>
      <label
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files?.[0]; if (f) onFile(f);
        }}
        className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-4 cursor-pointer transition ${drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'}`}
      >
        <Upload className="w-5 h-5 text-muted-foreground mb-1" />
        <div className="text-xs text-muted-foreground">{slot.name ?? 'Перетащите xlsx или нажмите для выбора'}</div>
        <input
          type="file" accept=".xlsx,.xls" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
        />
      </label>
      {slot.status === 'ok' && (summaryNode ?? (parsed != null && (
        <div className="text-xs text-foreground bg-muted/50 rounded p-2">
          {(parsed as any).summary ?? ''}
        </div>
      )))}
      {slot.status === 'error' && (
        <div className="text-xs text-red-600">{slot.error ?? 'Не удалось распознать структуру файла.'}</div>
      )}
    </Card>
  );
}

function ScenarioTable({ title, color, forecast, sc, engines }: {
  title: string; color: string;
  forecast: ForecastResult;
  sc: ForecastResult['scenarios']['base'];
  engines: ForecastProjectData['engines'];
}) {
  const rows: Array<{ label: string; key: keyof (typeof sc)['months'][number] }> = [];
  if (engines.yandex) rows.push({ label: 'Яндекс', key: 'yandex' });
  if (engines.google) rows.push({ label: 'Google', key: 'google' });
  if (engines.bing) rows.push({ label: 'Bing', key: 'bing' });
  rows.push({ label: 'Итого органика', key: 'total' });
  if (sc.months[0].newTop10 != null) rows.push({ label: 'Новых в топ-10', key: 'newTop10' });
  if (sc.months[0].gscClicks != null) rows.push({ label: 'Клики GSC', key: 'gscClicks' });

  return (
    <Card className="overflow-hidden">
      <div className={`px-4 py-2 text-sm font-semibold text-white ${color}`}>{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-3 py-2 font-medium">Показатель</th>
              {forecast.monthLabels.map((m) => <th key={m} className="text-right px-3 py-2 font-medium">{m}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={i % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                <td className="px-3 py-1.5 font-medium">{r.label}</td>
                {sc.months.map((m) => <td key={m.monthIndex} className="text-right px-3 py-1.5 tabular-nums">{(m as any)[r.key] ?? 0}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function SeoForecastPage() {
  const [step, setStep] = useState(1);
  const [project, setProject] = useState<ForecastProjectData>(emptyProject);
  const [slots, setSlots] = useState<Record<'traffic' | 'sources' | 'gsc' | 'topvisor', FileSlot>>({
    traffic: { status: 'idle' }, sources: { status: 'idle' }, gsc: { status: 'idle' }, topvisor: { status: 'idle' },
  });
  const [traffic, setTraffic] = useState<ParsedTraffic | null>(null);
  const [sources, setSources] = useState<ParsedSources | null>(null);
  const [gsc, setGsc] = useState<ParsedGsc | null>(null);
  const [topvisor, setTopvisor] = useState<ParsedTopvisor | null>(null);
  const [extras, setExtras] = useState<ExtraRow[]>([]);
  const [exporting, setExporting] = useState(false);

  const step1Valid = project.domain.trim() && project.clientName.trim() && project.topic.trim() && project.region.trim()
    && (project.engines.yandex || project.engines.google || project.engines.bing);

  const forecast = useMemo(() => {
    if (step !== 3) return null;
    return calculateForecast(project, { traffic, sources, gsc, topvisor });
  }, [step, project, traffic, sources, gsc, topvisor]);

  useEffect(() => {
    if (!project.works.blog) {
      setProject((p) => ({ ...p, publishPace: undefined }));
    }
  }, [project.works.blog]);

  const handleFile = useCallback(async (kind: keyof typeof slots, file: File) => {
    setSlots((s) => ({ ...s, [kind]: { status: 'idle', name: file.name } }));
    try {
      if (kind === 'traffic') setTraffic(await parseMetrikaTraffic(file));
      else if (kind === 'sources') setSources(await parseMetrikaSources(file));
      else if (kind === 'gsc') setGsc(await parseGsc(file));
      else if (kind === 'topvisor') setTopvisor(await parseTopvisor(file));
      setSlots((s) => ({ ...s, [kind]: { status: 'ok', name: file.name } }));
    } catch (e: any) {
      setSlots((s) => ({ ...s, [kind]: { status: 'error', name: file.name, error: 'Не удалось распознать структуру файла. Убедитесь, что это оригинальная выгрузка.' } }));
    }
  }, []);

  const removeMain = useCallback((kind: keyof typeof slots) => {
    setSlots((s) => ({ ...s, [kind]: { status: 'idle' } }));
    if (kind === 'traffic') setTraffic(null);
    else if (kind === 'sources') setSources(null);
    else if (kind === 'gsc') setGsc(null);
    else if (kind === 'topvisor') setTopvisor(null);
  }, []);

  const addExtra = () => {
    if (extras.length >= 5) { toast.error('Максимум 5 дополнительных файлов'); return; }
    setExtras((e) => [...e, { id: crypto.randomUUID(), type: '', slot: { status: 'idle' }, parsed: null }]);
  };
  const removeExtra = (id: string) => setExtras((e) => e.filter((r) => r.id !== id));
  const updateExtra = (id: string, patch: Partial<ExtraRow>) =>
    setExtras((e) => e.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const handleExtraFile = async (row: ExtraRow, file: File) => {
    if (!row.type) { toast.error('Сначала выберите тип файла'); return; }
    updateExtra(row.id, { slot: { status: 'idle', name: file.name }, parsed: null });
    try {
      const parsed = row.type === 'wm_queries'
        ? await parseWebmasterQueries(file)
        : await parseGeneric(file);
      updateExtra(row.id, { slot: { status: 'ok', name: file.name }, parsed });
    } catch {
      updateExtra(row.id, { slot: { status: 'error', name: file.name, error: 'Не удалось распознать файл.' } });
    }
  };

  const reset = () => {
    setStep(1); setProject(emptyProject);
    setSlots({ traffic: { status: 'idle' }, sources: { status: 'idle' }, gsc: { status: 'idle' }, topvisor: { status: 'idle' } });
    setTraffic(null); setSources(null); setGsc(null); setTopvisor(null); setExtras([]);
  };

  const download = async () => {
    if (!forecast) return;
    setExporting(true);
    try {
      const extrasForReport = extras
        .filter((r) => r.type && r.slot.status === 'ok' && r.parsed)
        .map((r) => ({
          typeLabel: r.type === 'other' ? (r.customName?.trim() || 'Другое') : EXTRA_TYPE_LABELS[r.type as ExtraFileType],
          fileName: r.slot.name,
          parsed: r.parsed!,
          kind: (r.type === 'wm_queries' ? 'wm_queries' : 'generic') as 'wm_queries' | 'generic',
        }));
      await exportSeoForecastDocx(project, { traffic, sources, gsc, topvisor, extras: extrasForReport }, forecast);
      toast.success('Отчёт готов ✓');
    } catch (e: any) {
      toast.error('Не удалось сгенерировать отчёт');
    } finally { setExporting(false); }
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1200px] py-8 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><BarChart2 className="w-5 h-5" /></div>
            <div>
              <h1 className="text-2xl font-semibold">SEO-прогноз</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">Загрузите данные проекта — получите прогноз органического трафика на 3 или 6 месяцев и готовый Word-отчёт.</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2"><RotateCcw className="w-4 h-4" /> Начать заново</Button>
        </div>

        <Stepper step={step} />

        {step === 1 && (
          <Card className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Домен сайта *" hint="например: s-atlant.ru">
                <Input value={project.domain} onChange={(e) => setProject((p) => ({ ...p, domain: e.target.value }))} placeholder="example.ru" />
              </Field>
              <Field label="Название проекта / клиента *" hint="для шапки отчёта">
                <Input value={project.clientName} onChange={(e) => setProject((p) => ({ ...p, clientName: e.target.value }))} />
              </Field>
              <Field label="Тематика сайта *" hint="Металлопрокат / Недвижимость / …">
                <Input value={project.topic} onChange={(e) => setProject((p) => ({ ...p, topic: e.target.value }))} />
              </Field>
              <Field label="Регион продвижения *" hint="Москва, Ростов-на-Дону, …">
                <Input value={project.region} onChange={(e) => setProject((p) => ({ ...p, region: e.target.value }))} />
              </Field>
              <Field label="Горизонт прогноза *">
                <Select value={String(project.horizon)} onValueChange={(v) => setProject((p) => ({ ...p, horizon: Number(v) as 3 | 6 }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 месяца</SelectItem>
                    <SelectItem value="6">6 месяцев</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Статус сайта *">
                <Select value={project.siteStatus} onValueChange={(v: any) => setProject((p) => ({ ...p, siteStatus: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="young">Молодой сайт (0–6 мес.)</SelectItem>
                    <SelectItem value="growing">Развивающийся (6–18 мес.)</SelectItem>
                    <SelectItem value="mature">Зрелый сайт (18+ мес.)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label="Поисковые системы *">
              <div className="flex gap-4 flex-wrap">
                {(['yandex', 'google', 'bing'] as const).map((eng) => (
                  <label key={eng} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={project.engines[eng]} onCheckedChange={(v) => setProject((p) => ({ ...p, engines: { ...p.engines, [eng]: !!v } }))} />
                    {eng === 'yandex' ? 'Яндекс' : eng === 'google' ? 'Google' : 'Bing'}
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Планируемые работы">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {([
                  ['blog', 'Блог/контент'], ['cards', 'Карточки товаров/объектов'], ['links', 'Закупка ссылок'],
                  ['crowd', 'Крауд-маркетинг'], ['external', 'Публикации на внешних площадках'], ['tech', 'Техническое SEO'],
                ] as const).map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={project.works[k]} onCheckedChange={(v) => setProject((p) => ({ ...p, works: { ...p.works, [k]: !!v } }))} />
                    {label}
                  </label>
                ))}
              </div>
            </Field>

            {project.works.blog && (
              <Field label="Темп публикаций" hint="статей в месяц">
                <Input type="number" min={0} value={project.publishPace ?? ''} onChange={(e) => setProject((p) => ({ ...p, publishPace: e.target.value ? Number(e.target.value) : undefined }))} />
              </Field>
            )}

            <Field label="Дополнительный контекст">
              <Textarea
                rows={4}
                placeholder="Особенности ниши, основные конкуренты, цели клиента, любая информация которая поможет сделать отчёт точнее"
                value={project.context}
                onChange={(e) => setProject((p) => ({ ...p, context: e.target.value }))}
              />
            </Field>

            <div className="flex justify-end pt-2">
              <TooltipProvider delayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-block">
                      <Button disabled={!step1Valid} onClick={() => setStep(2)} className="gap-2">Далее <ChevronRight className="w-4 h-4" /></Button>
                    </span>
                  </TooltipTrigger>
                  {!step1Valid && <TooltipContent side="top">Заполните все обязательные поля</TooltipContent>}
                </Tooltip>
              </TooltipProvider>
            </div>
          </Card>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <section className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Блок 1 — Яндекс.Метрика</div>
              <FileBlock title="Трафик по поисковым системам" hint="xlsx: дата, Яндекс, Google, Bing, итого"
                slot={slots.traffic} parsed={traffic}
                onFile={(f) => handleFile('traffic', f)}
                onRemove={() => removeMain('traffic')}
                summaryNode={traffic ? <TrafficSummary data={traffic} /> : null} />
              <FileBlock title="Источники трафика, сводка" hint="xlsx: источник, визиты, посетители, отказы, глубина, время"
                slot={slots.sources} parsed={sources}
                onFile={(f) => handleFile('sources', f)}
                onRemove={() => removeMain('sources')}
                summaryNode={sources ? <SourcesSummary data={sources} /> : null} />
            </section>
            <section className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Блок 2 — Google Search Console</div>
              <FileBlock title="Выгрузка GSC" hint="xlsx: показы, клики, CTR, позиция"
                slot={slots.gsc} parsed={gsc}
                onFile={(f) => handleFile('gsc', f)}
                onRemove={() => removeMain('gsc')}
                summaryNode={gsc ? <GscSummary data={gsc} /> : null} />
            </section>
            <section className="space-y-3">
              <div className="text-sm font-semibold text-foreground">Блок 3 — Topvisor / позиции</div>
              <FileBlock title="Выгрузка позиций" hint="xlsx: запрос, позиция (или «--»), регион, поисковая система"
                slot={slots.topvisor} parsed={topvisor}
                onFile={(f) => handleFile('topvisor', f)}
                onRemove={() => removeMain('topvisor')}
                summaryNode={topvisor ? <TopvisorSummary data={topvisor} /> : null} />
            </section>

            <section className="space-y-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Блок 4 — Дополнительные источники данных</div>
                <div className="text-xs text-muted-foreground mt-0.5">Яндекс.Вебмастер, Яндекс.Директ, Roistat, любые другие выгрузки</div>
              </div>
              {extras.map((row) => (
                <ExtraFileRow key={row.id}
                  row={row}
                  onTypeChange={(t) => updateExtra(row.id, { type: t, customName: t === 'other' ? row.customName ?? '' : undefined })}
                  onCustomNameChange={(n) => updateExtra(row.id, { customName: n })}
                  onFile={(f) => handleExtraFile(row, f)}
                  onRemove={() => removeExtra(row.id)}
                  onClearFile={() => updateExtra(row.id, { slot: { status: 'idle' }, parsed: null })}
                />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addExtra} disabled={extras.length >= 5} className="gap-2">
                <Plus className="w-4 h-4" /> Добавить файл {extras.length > 0 && <span className="text-muted-foreground">({extras.length}/5)</span>}
              </Button>
            </section>

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)} className="gap-2"><ChevronLeft className="w-4 h-4" /> Назад</Button>
              <Button onClick={() => setStep(3)} className="gap-2">Далее <ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        )}

        {step === 3 && forecast && (
          <div className="space-y-5">
            <Card className="p-5 bg-primary/5 border-primary/20">
              <div className="text-sm">
                {forecast.baseTraffic.total > 0 ? (
                  <>К <b>{forecast.monthLabels[forecast.monthLabels.length - 1]}</b> органический трафик по базовому сценарию составит <b>~{forecast.scenarios.base.months.at(-1)!.total}</b> визитов/мес.
                  {' '}(диапазон {forecast.scenarios.conservative.months.at(-1)!.total}–{forecast.scenarios.optimistic.months.at(-1)!.total}) — рост в <b>{(forecast.scenarios.base.months.at(-1)!.total / forecast.baseTraffic.total).toFixed(1)}</b> раза к текущему уровню ({forecast.baseTraffic.total} визитов/мес.).</>
                ) : (
                  <>Данных о базовом трафике нет — прогноз рассчитан от нулевой точки на основе выбранного статуса сайта и работ. К <b>{forecast.monthLabels[forecast.monthLabels.length - 1]}</b> ожидаемо ~{forecast.scenarios.base.months.at(-1)!.total} визитов/мес. по базовому сценарию.</>
                )}
              </div>
            </Card>

            <ScenarioTable title="Консервативный сценарий" color="bg-slate-500" forecast={forecast} sc={forecast.scenarios.conservative} engines={project.engines} />
            <ScenarioTable title="Базовый сценарий" color="bg-primary" forecast={forecast} sc={forecast.scenarios.base} engines={project.engines} />
            <ScenarioTable title="Оптимистичный сценарий" color="bg-green-600" forecast={forecast} sc={forecast.scenarios.optimistic} engines={project.engines} />

            {forecast.insights.length > 0 && (
              <Card className="p-5 space-y-2">
                <div className="text-sm font-semibold">Ключевые инсайты и точки роста</div>
                <ul className="text-sm text-foreground space-y-1.5 list-disc pl-5">
                  {forecast.insights.map((t, i) => <li key={i}>{t}</li>)}
                </ul>
                <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                  {forecast.seasonalityNote} Прогноз использует S-кривую (медленный старт → ускорение → стабилизация) и лаги эффектов работ.
                </div>
              </Card>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="gap-2"><ChevronLeft className="w-4 h-4" /> Назад</Button>
              <Button onClick={download} disabled={exporting} className="gap-2">
                {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Скачать Word-отчёт
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SummaryCard({ title, borderClass, children }: { title: string; borderClass: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-md border-2 ${borderClass} bg-muted/40 p-3 space-y-1`}>
      <div className="text-xs font-semibold text-foreground/80 uppercase tracking-wide">{title}</div>
      <div className="text-xs text-foreground space-y-1 leading-relaxed">{children}</div>
    </div>
  );
}

function TrafficSummary({ data }: { data: ParsedTraffic }) {
  const first = data.rows[0]; const last = data.rows[data.rows.length - 1];
  return (
    <SummaryCard title="Трафик по поисковым системам" borderClass="border-green-500/40">
      <div>📅 Период: {first?.period ?? '—'} — {last?.period ?? '—'}</div>
      <div>📊 Последний месяц: Яндекс {last?.yandex ?? 0}, Google {last?.google ?? 0}, итого {last?.total ?? 0} визитов</div>
      <div>📈 Всего строк данных: {data.rows.length}</div>
    </SummaryCard>
  );
}

function SourcesSummary({ data }: { data: ParsedSources }) {
  const pct = (n: number) => (data.totalVisits ? Math.round((n / data.totalVisits) * 100) : 0);
  return (
    <SummaryCard title="Источники трафика" borderClass="border-green-500/40">
      <div>🌐 Всего визитов за период: {data.totalVisits}</div>
      <div>🔍 Органика Яндекс: {data.yandexOrganic} ({pct(data.yandexOrganic)}% от всех)</div>
      <div>🔍 Органика Google: {data.googleOrganic} ({pct(data.googleOrganic)}% от всех)</div>
      <div>📎 Прямые заходы: {data.direct} ({pct(data.direct)}%)</div>
    </SummaryCard>
  );
}

function GscSummary({ data }: { data: ParsedGsc }) {
  // Потенциал: показы позиций 2-3 * (0.30 - 0.10) ≈ +20% CTR при выходе в топ-1
  const potentialImp = data.buckets?.top2_3 ?? 0;
  const extraClicks = Math.round(potentialImp * 0.20);
  return (
    <SummaryCard title="Google Search Console" borderClass="border-green-500/40">
      <div>👁 Показов: {data.impressions} | Кликов: {data.clicks} | CTR: {data.ctr.toFixed(2)}%</div>
      <div>📍 Средняя позиция: {data.position.toFixed(1)}</div>
      <div>⚡ Потенциал (поз. 2-3): {potentialImp} показов → ~{extraClicks} доп. кликов при выходе в топ-1</div>
    </SummaryCard>
  );
}

function TopvisorSummary({ data }: { data: ParsedTopvisor }) {
  const allOutside = data.total > 0 && data.outside === data.total;
  return (
    <SummaryCard title="Topvisor" borderClass="border-green-500/40">
      <div>🔑 Запросов всего: {data.total}</div>
      <div>✅ В топ-10: {data.top10} | В топ-100: {data.top100} | Вне топ-100 (--): {data.outside}</div>
      <div>📍 Стартовая точка: {allOutside ? 'все вне топ-100' : 'есть позиции'}</div>
    </SummaryCard>
  );
}

function ExtraFileRow({
  row, onTypeChange, onCustomNameChange, onFile, onRemove, onClearFile,
}: {
  row: ExtraRow;
  onTypeChange: (t: ExtraFileType) => void;
  onCustomNameChange: (n: string) => void;
  onFile: (f: File) => void;
  onRemove: () => void;
  onClearFile: () => void;
}) {
  const [drag, setDrag] = useState(false);
  const isWmQueries = row.type === 'wm_queries';
  const parsedWm = isWmQueries ? (row.parsed as ParsedWebmasterQueries | null) : null;
  const parsedGeneric = !isWmQueries && row.parsed ? (row.parsed as ParsedGeneric) : null;
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3">
          <div className="space-y-2">
            <Select value={row.type || undefined} onValueChange={(v) => onTypeChange(v as ExtraFileType)}>
              <SelectTrigger><SelectValue placeholder="Тип файла" /></SelectTrigger>
              <SelectContent>
                {(Object.keys(EXTRA_TYPE_LABELS) as ExtraFileType[]).map((k) => (
                  <SelectItem key={k} value={k}>{EXTRA_TYPE_LABELS[k]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {row.type === 'other' && (
              <Input placeholder="Название источника" value={row.customName ?? ''} onChange={(e) => onCustomNameChange(e.target.value)} />
            )}
          </div>
          <label
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
            className={`flex flex-col items-center justify-center border-2 border-dashed rounded-md p-3 cursor-pointer transition ${drag ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'} ${!row.type ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <Upload className="w-5 h-5 text-muted-foreground mb-1" />
            <div className="text-xs text-muted-foreground text-center">{row.slot.name ?? (row.type ? 'Перетащите xlsx или нажмите для выбора' : 'Сначала выберите тип файла')}</div>
            <input type="file" accept=".xlsx,.xls" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
          </label>
        </div>
        <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-red-600 transition p-1" title="Удалить строку">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="text-xs flex items-center gap-2">
        {row.slot.status === 'ok' && (
          <>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 border border-green-500/30 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" /> Загружен ✓ {row.slot.name}
            </span>
            <button type="button" onClick={onClearFile} className="inline-flex items-center gap-1 text-muted-foreground hover:text-red-600 transition">
              <X className="w-3.5 h-3.5" /> Удалить файл
            </button>
          </>
        )}
        {row.slot.status === 'error' && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-600 border border-red-500/30 font-medium">
            <XCircle className="w-3.5 h-3.5" /> {row.slot.error ?? 'Ошибка'}
          </span>
        )}
      </div>

      {row.slot.status === 'ok' && parsedWm && (
        <SummaryCard title="Яндекс.Вебмастер — поисковые запросы" borderClass="border-green-500/40">
          <div>🔑 Запросов: {parsedWm.total} | Топ-10: {parsedWm.top10} | Ср. позиция: {parsedWm.avgPosition.toFixed(1)}</div>
        </SummaryCard>
      )}
      {row.slot.status === 'ok' && parsedGeneric && (
        <SummaryCard title={row.type === 'other' ? (row.customName || 'Другое') : EXTRA_TYPE_LABELS[row.type as ExtraFileType]} borderClass="border-green-500/40">
          <div>📄 Строк данных: {parsedGeneric.rowCount}</div>
          {parsedGeneric.columns.length > 0 && (
            <div>🧾 Колонки: {parsedGeneric.columns.slice(0, 8).join(', ')}{parsedGeneric.columns.length > 8 ? '…' : ''}</div>
          )}
        </SummaryCard>
      )}
    </Card>
  );
}