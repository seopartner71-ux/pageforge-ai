import { useState, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Upload, FileDown, Mic, Loader2, ExternalLink, CheckCircle2, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Cell,
  PieChart, Pie, Legend,
} from 'recharts';
import ReactMarkdown from 'react-markdown';
import { parseAliceXlsx, type AliceParsed, type AliceRow } from '@/lib/alice/parseAliceXlsx';
import { exportAliceReportDocx } from '@/lib/alice/exportAliceReportDocx';

const PIE_COLORS = ['hsl(var(--primary))', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#6B7280'];

export default function AliceVisibilityPage() {
  const [brand, setBrand] = useState('Ренессанс Косметик');
  const [domain, setDomain] = useState('ren-cosm.ru');
  const [data, setData] = useState<AliceParsed | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [viewRow, setViewRow] = useState<AliceRow | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (!domain.trim()) { toast.error('Укажите домен бренда'); return; }
    setLoading(true);
    try {
      const parsed = await parseAliceXlsx(file, brand.trim(), domain.trim());
      setData(parsed);
      toast.success(`Загружено: ${parsed.totals.queries} запросов`);
    } catch (e: any) {
      toast.error(e.message || 'Не удалось распарсить файл');
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    if (!data) return;
    setExporting(true);
    try {
      await exportAliceReportDocx(data, `alisa-${data.domain}-${new Date().toISOString().slice(0, 10)}.docx`);
      toast.success('Отчёт Word сформирован');
    } catch (e: any) {
      toast.error(e.message || 'Ошибка экспорта');
    } finally { setExporting(false); }
  }

  const topQueriesChart = data
    ? [...data.rows].sort((a, b) => b.frequency - a.frequency).slice(0, 10).map((r) => ({
        name: r.query.length > 28 ? r.query.slice(0, 28) + '…' : r.query,
        freq: r.frequency, mentioned: r.brandMentioned,
      }))
    : [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Mic className="w-6 h-6 text-primary" />
            Видимость в ответах Алисы
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Профессиональный анализ упоминаний бренда в ответах Яндекс Алисы по семантическому ядру.
          </p>
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'Анализ выгрузки из Яндекс Метрики/AI-инструмента: какие ваши запросы Алиса знает, кого цитирует, где упоминает ваш бренд.' },
            { label: 'Что загружать', text: 'XLSX с колонками: Запрос, Частотность, "!Частотность", "[!Частотность]", Ответ ИИ, Источники.' },
            { label: 'Что получаете', text: 'Дашборд с метриками видимости, топ-конкурентами, типизацией источников + Word-отчёт для клиента.' },
          ]}
        />

        <Card className="p-4 space-y-3">
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Название бренда</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Ренессанс Косметик" />
            </div>
            <div>
              <Label className="text-xs">Домен бренда</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="ren-cosm.ru" />
            </div>
            <div className="flex items-end">
              <input
                type="file" accept=".xlsx,.xls" hidden ref={fileRef}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <Button className="w-full" onClick={() => fileRef.current?.click()} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                Загрузить XLSX
              </Button>
            </div>
          </div>
          {data && (
            <div className="flex justify-end">
              <Button variant="outline" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
                Скачать отчёт Word
              </Button>
            </div>
          )}
        </Card>

        {!data ? (
          <Card className="p-12 text-center space-y-3">
            <Mic className="w-12 h-12 text-primary/40 mx-auto" />
            <h2 className="text-lg font-semibold">Загрузите файл XLSX</h2>
            <p className="text-sm text-muted-foreground">
              Excel-файл с выгрузкой запросов и ответов Алисы. Поддерживается формат отчёта Яндекса.
            </p>
          </Card>
        ) : (
          <>
            {/* KPI cards */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Kpi label="Запросов" value={data.totals.queries} accent="primary" />
              <Kpi label="Частотность" value={data.totals.totalFrequency.toLocaleString('ru-RU')} accent="muted" />
              <Kpi label="Упоминаний" value={`${data.totals.brandMentions}/${data.totals.queries}`} accent="primary" />
              <Kpi label="Видимость" value={`${data.totals.visibilityPct}%`} accent={data.totals.visibilityPct >= 50 ? 'good' : data.totals.visibilityPct >= 30 ? 'warn' : 'bad'} />
              <Kpi label="Доля цитат" value={`${data.totals.citationSharePct}%`} accent={data.totals.citationSharePct >= 20 ? 'good' : 'warn'} />
            </div>

            <Tabs defaultValue="dashboard" className="space-y-4">
              <TabsList>
                <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
                <TabsTrigger value="queries">Запросы ({data.rows.length})</TabsTrigger>
                <TabsTrigger value="domains">Источники ({data.topDomains.length})</TabsTrigger>
                <TabsTrigger value="types">Типы источников</TabsTrigger>
              </TabsList>

              <TabsContent value="dashboard" className="space-y-4">
                <div className="grid lg:grid-cols-2 gap-4">
                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Топ-10 запросов по частотности</h3>
                    <div className="h-[340px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={topQueriesChart} layout="vertical" margin={{ left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={150} />
                          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                          <Bar dataKey="freq" radius={[0, 4, 4, 0]}>
                            {topQueriesChart.map((d, i) => (
                              <Cell key={i} fill={d.mentioned ? 'hsl(var(--primary))' : '#9CA3AF'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      <span className="inline-block w-2 h-2 rounded-sm bg-primary mr-1" /> бренд упомянут{' '}
                      <span className="inline-block w-2 h-2 rounded-sm bg-gray-400 ml-3 mr-1" /> не упомянут
                    </p>
                  </Card>

                  <Card className="p-4">
                    <h3 className="text-sm font-semibold mb-3">Топ-цитируемые домены</h3>
                    <div className="space-y-2 max-h-[340px] overflow-auto">
                      {data.topDomains.slice(0, 12).map((d) => (
                        <div key={d.domain} className="flex items-center justify-between text-sm border-b py-1.5">
                          <span className="truncate flex items-center gap-2">
                            {d.isBrand && <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px]">ВАШ</Badge>}
                            <span className={d.isBrand ? 'font-medium' : ''}>{d.domain}</span>
                          </span>
                          <Badge variant="secondary" className="tabular-nums">{d.count}</Badge>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="queries">
                <Card className="p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Запрос</TableHead>
                        <TableHead className="w-[110px] text-right">Частотн.</TableHead>
                        <TableHead className="w-[90px] text-center">Бренд</TableHead>
                        <TableHead className="w-[90px] text-center">Цитата</TableHead>
                        <TableHead className="w-[80px] text-center">Источн.</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.rows.map((r, i) => (
                        <TableRow key={i} className="cursor-pointer" onClick={() => setViewRow(r)}>
                          <TableCell className="max-w-[360px] truncate">{r.query}</TableCell>
                          <TableCell className="text-right tabular-nums">{r.frequency.toLocaleString('ru-RU')}</TableCell>
                          <TableCell className="text-center">
                            {r.brandMentioned ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.brandCited ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" /> : <XCircle className="w-4 h-4 text-muted-foreground mx-auto" />}
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-xs">{r.citedDomains.length}</TableCell>
                          <TableCell><Eye className="w-4 h-4 text-muted-foreground" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="domains">
                <Card className="p-0 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Домен</TableHead>
                        <TableHead className="w-[140px] text-center">Цитирований</TableHead>
                        <TableHead className="w-[80px] text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topDomains.map((d) => (
                        <TableRow key={d.domain}>
                          <TableCell className="flex items-center gap-2">
                            {d.isBrand && <Badge className="bg-emerald-500/15 text-emerald-600 border-0 text-[10px]">ВАШ</Badge>}
                            <span className={d.isBrand ? 'font-semibold' : ''}>{d.domain}</span>
                          </TableCell>
                          <TableCell className="text-center tabular-nums">{d.count}</TableCell>
                          <TableCell className="text-right">
                            <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              <ExternalLink className="w-3.5 h-3.5 inline" />
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </TabsContent>

              <TabsContent value="types">
                <Card className="p-4">
                  <div className="h-[340px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data.sourceTypes} dataKey="count" nameKey="label" outerRadius={120} label>
                          {data.sourceTypes.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}

        <Dialog open={!!viewRow} onOpenChange={(o) => !o && setViewRow(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="pr-8">{viewRow?.query}</DialogTitle>
            </DialogHeader>
            {viewRow && (
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">Частотность: {viewRow.frequency.toLocaleString('ru-RU')}</Badge>
                  <Badge variant={viewRow.brandMentioned ? 'default' : 'secondary'}>
                    {viewRow.brandMentioned ? 'Бренд упомянут' : 'Бренд не упомянут'}
                  </Badge>
                  {viewRow.brandCited && <Badge className="bg-emerald-500/15 text-emerald-600 border-0">Цитирован домен</Badge>}
                </div>
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Ответ Алисы</h4>
                  <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/40 rounded p-3">
                    <ReactMarkdown>{viewRow.aiAnswer || '—'}</ReactMarkdown>
                  </div>
                </div>
                {viewRow.citedDomains.length > 0 && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      Цитируемые домены ({viewRow.citedDomains.length})
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {viewRow.citedDomains.map((d) => (
                        <Badge key={d} variant={d.includes(domain.toLowerCase()) ? 'default' : 'secondary'}>
                          {d}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | number; accent: 'primary' | 'good' | 'warn' | 'bad' | 'muted' }) {
  const color =
    accent === 'good' ? 'text-emerald-500' :
    accent === 'warn' ? 'text-amber-500' :
    accent === 'bad' ? 'text-red-500' :
    accent === 'primary' ? 'text-primary' : 'text-foreground';
  return (
    <Card className="p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
      <div className={`text-2xl font-bold mt-1 tabular-nums ${color}`}>{value}</div>
    </Card>
  );
}