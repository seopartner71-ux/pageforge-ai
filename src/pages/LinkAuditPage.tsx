import { useState, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Upload, FileText, X, Download, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  parseCsvToBacklinks, analyzeSite, detectSiteDomain, SITE_COLORS,
  type SiteAuditData, type BacklinkRow,
} from '@/lib/linkAudit';
// exceljs+chart.js (~1MB) — грузим только при экспорте
const exportLinkAuditXlsx = (...args: Parameters<typeof import('@/lib/exportLinkAuditXlsx').exportLinkAuditXlsx>) =>
  import('@/lib/exportLinkAuditXlsx').then(m => m.exportLinkAuditXlsx(...args));
import { parseDomainSummaryCsv, type DomainSummaryRow } from '@/lib/domainSummary';
import { InsightsBlock, type Insight } from '@/components/InsightsBlock';
import { CsvFormatGuide } from '@/components/CsvFormatGuide';

interface SiteSlot {
  name: string;
  rows: BacklinkRow[] | null;
  fileName?: string;
}

const DEFAULT_NAMES = ['Аудируемый сайт', 'Конкурент 1', 'Конкурент 2', 'Конкурент 3'];

export default function LinkAuditPage() {
  const [slots, setSlots] = useState<SiteSlot[]>(
    DEFAULT_NAMES.map((name) => ({ name, rows: null }))
  );
  const [activeOnly, setActiveOnly] = useState(true);
  const [mode, setMode] = useState<'separate' | 'summary'>('separate');
  const [summaryRows, setSummaryRows] = useState<DomainSummaryRow[]>([]);
  const [summaryFile, setSummaryFile] = useState<string>('');
  const fileInputs = useRef<(HTMLInputElement | null)[]>([]);
  const summaryInput = useRef<HTMLInputElement | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);

  const handleSummaryFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Поддерживаются только CSV файлы');
      return;
    }
    try {
      const text = await file.text();
      const rows = parseDomainSummaryCsv(text);
      if (!rows.length) {
        toast.error('Не удалось распознать колонки в CSV');
        return;
      }
      setSummaryRows(rows);
      setSummaryFile(file.name);
      toast.success(`Загружено ${rows.length} сайтов: ${file.name}`);
    } catch (e: any) {
      toast.error(`Ошибка чтения файла: ${e?.message || e}`);
    }
  };

  const handleFile = async (idx: number, file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Поддерживаются только CSV файлы');
      return;
    }
    try {
      const text = await file.text();
      const rows = parseCsvToBacklinks(text);
      if (!rows.length) {
        toast.error('Не удалось распознать колонки в CSV');
        return;
      }
      setSlots((prev) => {
        const next = [...prev];
        const detected = detectSiteDomain(rows);
        // Авто-имя: реальный домен, если найден; иначе оставить дефолтное
        const autoName = detected || next[idx].name;
        next[idx] = { ...next[idx], rows, fileName: file.name, name: autoName };
        return next;
      });
      const activeCount = rows.filter((r) => r.status !== 'inactive').length;
      toast.success(`Загружено ${rows.length} ссылок (активных: ${activeCount}): ${file.name}`);
    } catch (e: any) {
      toast.error(`Ошибка чтения файла: ${e?.message || e}`);
    }
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(idx, file);
  };

  const renameSlot = (idx: number, name: string) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], name };
      return next;
    });
  };

  const clearSlot = (idx: number) => {
    setSlots((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], rows: null, fileName: undefined };
      return next;
    });
  };

  const analyses: SiteAuditData[] = slots
    .filter((s) => s.rows && s.rows.length)
    .map((s) => {
      const filtered = activeOnly ? s.rows!.filter((r) => r.status !== 'inactive') : s.rows!;
      return analyzeSite(s.name, filtered);
    });

  const hasData = analyses.length > 0;
  const hasSummary = summaryRows.length > 0;
  const hasAnyData = hasData || hasSummary;

  const exportXlsx = async () => {
    if (!hasAnyData) {
      toast.error('Нет данных для экспорта');
      return;
    }
    try {
      toast.info('Готовлю Excel-файл с графиками…');
      await exportLinkAuditXlsx(analyses, summaryRows, insights);
      toast.success('Excel-файл скачан');
    } catch (e: any) {
      toast.error(`Ошибка экспорта: ${e?.message || e}`);
    }
  };

  const exportPdf = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <LinkIcon className="w-6 h-6 text-primary" />
              Ссылочный аудит
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Загрузите CSV-экспорты бэклинков из Ahrefs / SEO-инструментов и сравните до 4 сайтов.
            </p>
          </div>
          <div className="flex gap-2 print:hidden items-center">
            <Button
              variant={activeOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveOnly((v) => !v)}
              title="Учитывать только активные ссылки"
            >
              {activeOnly ? '✓ Только активные' : 'Все ссылки'}
            </Button>
            <Button variant="outline" onClick={exportPdf} disabled={!hasAnyData}>
              <Download className="w-4 h-4 mr-1.5" /> Скачать PDF
            </Button>
            <Button onClick={exportXlsx} disabled={!hasAnyData}>
              <Download className="w-4 h-4 mr-1.5" /> Скачать Excel
            </Button>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center gap-2 print:hidden">
          <span className="text-xs text-muted-foreground">Режим загрузки:</span>
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setMode('separate')}
              className={`px-3 py-1.5 text-xs ${mode === 'separate' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'}`}
            >
              Отдельные CSV (4 файла)
            </button>
            <button
              type="button"
              onClick={() => setMode('summary')}
              className={`px-3 py-1.5 text-xs ${mode === 'summary' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'}`}
            >
              Сводная таблица
            </button>
          </div>
        </div>

        <CsvFormatGuide />

        {/* Drop zones — separate mode */}
        {mode === 'separate' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 print:hidden">
            {slots.map((slot, idx) => {
              const color = SITE_COLORS[idx];
              return (
                <Card key={idx} className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ background: color }} />
                    <Input
                      value={slot.name}
                      onChange={(e) => renameSlot(idx, e.target.value)}
                      className="h-7 text-xs"
                    />
                  </div>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => handleDrop(idx, e)}
                    onClick={() => fileInputs.current[idx]?.click()}
                    className="border-2 border-dashed border-border rounded-md p-4 text-center cursor-pointer hover:border-primary/60 transition-colors"
                  >
                    {slot.rows ? (
                      <div className="space-y-1">
                        <FileText className="w-6 h-6 mx-auto text-primary" />
                        <p className="text-xs font-medium truncate">{slot.fileName}</p>
                        <p className="text-[11px] text-muted-foreground">{slot.rows.length} строк</p>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clearSlot(idx); }}
                          className="text-[11px] text-destructive hover:underline inline-flex items-center gap-1"
                        >
                          <X className="w-3 h-3" /> Удалить
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-6 h-6 mx-auto text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">Перетащите CSV или нажмите</p>
                      </div>
                    )}
                    <input
                      ref={(el) => (fileInputs.current[idx] = el)}
                      type="file"
                      accept=".csv,text/csv"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleFile(idx, f);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* Drop zone — summary mode */}
        {mode === 'summary' && (
          <Card className="p-4 print:hidden">
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleSummaryFile(f);
              }}
              onClick={() => summaryInput.current?.click()}
              className="border-2 border-dashed border-border rounded-md p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
            >
              {hasSummary ? (
                <div className="space-y-1">
                  <FileText className="w-8 h-8 mx-auto text-primary" />
                  <p className="text-sm font-medium">{summaryFile}</p>
                  <p className="text-xs text-muted-foreground">{summaryRows.length} сайтов загружено</p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setSummaryRows([]); setSummaryFile(''); }}
                    className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Удалить
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-8 h-8 mx-auto text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Загрузите CSV со всеми сайтами</p>
                  <p className="text-xs text-muted-foreground">Первая строка = аудируемый сайт. Разделитель «;»</p>
                </div>
              )}
              <input
                ref={summaryInput}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleSummaryFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          </Card>
        )}

        {!hasAnyData && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Загрузите хотя бы один CSV, чтобы увидеть отчёт.
          </Card>
        )}

        {hasSummary && (
          <DomainSummarySection rows={summaryRows} />
        )}
        {hasData && (
          <>
            {/* Метрики-карточки */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {analyses.map((s, i) => (
                <Card key={i} className="p-4 space-y-2 border-l-4" style={{ borderLeftColor: SITE_COLORS[i] }}>
                  <p className="text-xs text-muted-foreground truncate">{s.name}</p>
                  <p className="text-2xl font-semibold">{s.totalLinks.toLocaleString('ru')}</p>
                  <div className="text-[11px] text-muted-foreground space-y-0.5">
                    <div>Доменов: <span className="text-foreground">{s.uniqueDomains}</span></div>
                    <div>Сред. DR: <span className="text-foreground">{s.avgDR}</span></div>
                  </div>
                </Card>
              ))}
            </div>

            {/* Сравнительная таблица */}
            <Card className="p-4">
              <h2 className="text-sm font-semibold mb-3">Сравнение показателей</h2>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Показатель</TableHead>
                    {analyses.map((s, i) => (
                      <TableHead key={i} style={{ color: SITE_COLORS[i] }}>{s.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { label: 'Доменный рейтинг (средний)', get: (s: SiteAuditData) => s.avgDR },
                    { label: 'Доменный рейтинг (медиана)', get: (s: SiteAuditData) => s.medianDR },
                    { label: 'Уникальные ссылки', get: (s: SiteAuditData) => s.totalLinks.toLocaleString('ru') },
                    { label: 'Ссылающиеся домены', get: (s: SiteAuditData) => s.uniqueDomains.toLocaleString('ru') },
                    { label: '% follow ссылок', get: (s: SiteAuditData) => `${s.followPct}%` },
                    { label: '% текстовых ссылок', get: (s: SiteAuditData) => `${s.textPct}%` },
                  ].map((row, ri) => (
                    <TableRow key={ri}>
                      <TableCell className="font-medium">{row.label}</TableCell>
                      {analyses.map((s, si) => (
                        <TableCell key={si}>{row.get(s)}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>

            {/* DR distribution */}
            <Card className="p-4">
              <h2 className="text-sm font-semibold mb-3">Распределение DR по диапазонам</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={analyses[0].drDistribution.map((d, idx) => {
                    const row: any = { range: d.range };
                    analyses.forEach((s) => { row[s.name] = s.drDistribution[idx]?.count || 0; });
                    return row;
                  })}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="range" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {analyses.map((s, i) => (
                    <Bar key={i} dataKey={s.name} fill={SITE_COLORS[i]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* Donut grids */}
            <DonutGrid title="Типы ссылок" sites={analyses} field="linkTypes" />
            <DonutGrid title="Тематика доноров (по TLD)" sites={analyses} field="topicStats" />
            <DonutGrid title="Follow / Nofollow" sites={analyses} field="followStats" />

            {/* Top pages */}
            <Card className="p-4">
              <h2 className="text-sm font-semibold mb-3">ТОП-5 страниц по числу ссылок</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
                {analyses.map((s, i) => (
                  <div key={i}>
                    <p className="text-xs font-medium mb-2" style={{ color: SITE_COLORS[i] }}>{s.name}</p>
                    {s.topPages.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Нет данных</p>
                    ) : (
                      <Table>
                        <TableBody>
                          {s.topPages.map((p, pi) => (
                            <TableRow key={pi}>
                              <TableCell className="text-[11px] truncate max-w-[220px]" title={p.url}>{p.url}</TableCell>
                              <TableCell className="text-[11px] text-right font-medium">{p.count}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {hasAnyData && (
          <InsightsBlock
            sites={analyses.map((s) => ({
              name: s.name,
              totalLinks: s.totalLinks,
              uniqueDomains: s.uniqueDomains,
              avgDR: s.avgDR,
              followPct: s.followPct,
              textPct: s.textPct,
            }))}
            summary={summaryRows.map((r) => ({
              domain: r.domain,
              dr: r.dr,
              top10: r.top10,
              top50: r.top50,
              traffic: r.traffic,
              backlinks: r.backlinks,
              refDomains: r.refDomains,
            }))}
            onLoaded={setInsights}
          />
        )}
      </main>
    </div>
  );
}

function DonutGrid({
  title, sites, field,
}: {
  title: string;
  sites: SiteAuditData[];
  field: 'linkTypes' | 'followStats' | 'topicStats';
}) {
  return (
    <Card className="p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {sites.map((s, i) => (
          <div key={i} className="text-center">
            <p className="text-xs font-medium mb-1 truncate" style={{ color: SITE_COLORS[i] }}>{s.name}</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={s[field]}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                >
                  {s[field].map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 11 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DomainSummarySection({ rows }: { rows: DomainSummaryRow[] }) {
  const colors = ['#378ADD', '#EF9F27', '#1D9E75', '#7F77DD', '#EC4899', '#06B6D4'];
  const metrics: { label: string; key: keyof DomainSummaryRow }[] = [
    { label: 'DR', key: 'dr' },
    { label: 'В топ 10', key: 'top10' },
    { label: 'В топ 50', key: 'top50' },
    { label: 'Трафик', key: 'traffic' },
    { label: 'Обратные ссылки', key: 'backlinks' },
    { label: 'Ссылающихся доменов', key: 'refDomains' },
  ];

  const visibilityData = rows.map((r) => ({
    name: r.domain, 'В топ 10': r.top10, 'В топ 50': r.top50,
  }));
  const trafficData = rows.map((r, i) => ({
    name: r.domain, Трафик: r.traffic, fill: colors[i % colors.length],
  }));
  const linkProfileData = rows.map((r) => ({
    name: r.domain,
    'Обратные ссылки': r.backlinks,
    'Ссылающиеся домены': r.refDomains,
    DR: r.dr,
  }));

  return (
    <>
      <Card className="p-4">
        <h2 className="text-sm font-semibold mb-3">Общие показатели сайтов</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Показатель</TableHead>
              {rows.map((r, i) => (
                <TableHead key={i} style={{ color: colors[i % colors.length] }}>{r.domain}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m, mi) => (
              <TableRow key={mi}>
                <TableCell className="font-medium">{m.label}</TableCell>
                {rows.map((r, ri) => (
                  <TableCell key={ri}>{Number(r[m.key]).toLocaleString('ru')}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Видимость в поиске</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={visibilityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="В топ 10" fill="#378ADD" />
              <Bar dataKey="В топ 50" fill="#EF9F27" />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3">Органический трафик</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={trafficData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
              <Bar dataKey="Трафик">
                {trafficData.map((d, i) => (<Cell key={i} fill={d.fill} />))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3">Ссылочный профиль</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={linkProfileData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Обратные ссылки" fill="#378ADD" />
            <Bar dataKey="Ссылающиеся домены" fill="#EF9F27" />
            <Bar dataKey="DR" fill="#1D9E75" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </>
  );
}
