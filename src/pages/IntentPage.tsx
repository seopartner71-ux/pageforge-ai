import { useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Download, Sparkles, ExternalLink, Tag } from 'lucide-react';
import { TYPE_COLORS, classifyIntent, shortUrl, type IntentMatrix, type SiteType } from '@/lib/intent/types';
import { exportIntentXlsx } from '@/lib/intent/exportIntentXlsx';
import ReactMarkdown from 'react-markdown';

type Engine = 'google' | 'yandex' | 'both';

function TypeBadge({ type }: { type: SiteType }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS['Неизвестно'];
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
      style={{ backgroundColor: c.bg, color: c.text }}
    >{type}</span>
  );
}

export default function IntentPage() {
  const [engine, setEngine] = useState<Engine>('google');
  const [city, setCity] = useState('Москва');
  const [maxQueries, setMaxQueries] = useState<10 | 20 | 30>(10);
  const [depth, setDepth] = useState<10 | 20 | 30>(10);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [matrix, setMatrix] = useState<IntentMatrix | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [checkId, setCheckId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMd, setAiMd] = useState('');
  const [showCompare, setShowCompare] = useState(false);

  const parsedQueries = useMemo(
    () => Array.from(new Set(text.split(/\r?\n/).map(s => s.trim()).filter(Boolean))).slice(0, maxQueries),
    [text, maxQueries]
  );

  const runAnalysis = async () => {
    if (!parsedQueries.length) {
      toast.error('Добавьте хотя бы один запрос');
      return;
    }
    setLoading(true);
    setMatrix(null);
    setAiMd('');
    setShowCompare(false);
    try {
      const { data, error } = await supabase.functions.invoke('check-intent', {
        body: { queries: parsedQueries, searchEngine: engine, city, depth },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setMatrix((data as any).matrix as IntentMatrix);
      setQueries((data as any).queries || parsedQueries);
      setCheckId((data as any).checkId || null);
      toast.success('Анализ готов');
    } catch (e: any) {
      toast.error(`Ошибка: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const runAi = async () => {
    if (!matrix) return;
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('intent-ai', {
        body: { checkId, matrix, queries },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setAiMd((data as any).markdown || '');
    } catch (e: any) {
      toast.error(`AI ошибка: ${e?.message || e}`);
    } finally {
      setAiLoading(false);
    }
  };

  const onExport = () => {
    if (!matrix) return;
    exportIntentXlsx(matrix, queries, city);
  };

  const scrollToQuery = (q: string) => {
    const el = document.getElementById(`q-col-${encodeURIComponent(q)}`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
  };

  // Сравнительная матрица доменов
  const compareData = useMemo(() => {
    if (!matrix) return null;
    const map = new Map<string, Record<string, number>>();
    for (const q of queries) {
      for (const r of matrix[q] || []) {
        if (!r.domain) continue;
        const row = map.get(r.domain) || {};
        row[q] = (row[q] || 0) + 1;
        map.set(r.domain, row);
      }
    }
    const rows = Array.from(map.entries()).map(([domain, row]) => {
      const total = Object.values(row).reduce((a, b) => a + b, 0);
      return { domain, row, total };
    }).sort((a, b) => b.total - a.total).slice(0, 50);
    return rows;
  }, [matrix, queries]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Проверка интента</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Анализ поисковой выдачи Google по списку запросов с автоматической классификацией типов сайтов.
          </p>
        </div>

        {/* Форма */}
        <Card className="p-5 space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Поисковая система</Label>
            <div className="flex gap-2 mt-1.5">
              {([
                { v: 'google', l: 'Google' },
                { v: 'yandex', l: 'Яндекс (скоро)' },
                { v: 'both', l: 'Оба (скоро)' },
              ] as const).map(o => (
                <Button
                  key={o.v}
                  type="button"
                  size="sm"
                  variant={engine === o.v ? 'default' : 'outline'}
                  disabled={o.v !== 'google'}
                  onClick={() => setEngine(o.v as Engine)}
                >{o.l}</Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Город</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} className="mt-1.5" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Запросов (максимум)</Label>
              <div className="flex gap-2 mt-1.5">
                {[10, 20, 30].map(n => (
                  <Button key={n} size="sm" variant={maxQueries === n ? 'default' : 'outline'} onClick={() => setMaxQueries(n as any)}>{n}</Button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Глубина топа</Label>
              <div className="flex gap-2 mt-1.5">
                {[10, 20, 30].map(n => (
                  <Button key={n} size="sm" variant={depth === n ? 'default' : 'outline'} onClick={() => setDepth(n as any)}>{n}</Button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Запросы (каждый с новой строки)</Label>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'купить диван москва\nинтернет магазин мебели'}
              className="mt-1.5 min-h-[140px] font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground mt-1">{parsedQueries.length} / {maxQueries}</div>
          </div>

          <Button onClick={runAnalysis} disabled={loading || !parsedQueries.length}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {loading ? 'Анализирую…' : 'Запустить анализ'}
          </Button>
        </Card>

        {/* Результаты */}
        {matrix && (
          <>
            {/* Теги запросов */}
            <Card className="p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2"><Tag className="w-4 h-4" /> Запросы</div>
              <div className="flex flex-wrap gap-2">
                {queries.map(q => (
                  <button key={q} onClick={() => scrollToQuery(q)}
                    className="px-2.5 py-1 text-xs rounded-md bg-secondary hover:bg-secondary/70 text-foreground transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </Card>

            {/* Действия */}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={onExport}><Download className="w-4 h-4" /> Экспорт XLSX</Button>
              <Button size="sm" variant="outline" onClick={() => setShowCompare(s => !s)}>
                {showCompare ? 'Скрыть' : 'Сравнительная матрица'}
              </Button>
              <Button size="sm" onClick={runAi} disabled={aiLoading}>
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                AI-анализ
              </Button>
            </div>

            {/* Матрица результатов */}
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-secondary/40 sticky top-0">
                    <tr>
                      <th className="w-10 p-2 border-b border-border text-left text-muted-foreground">#</th>
                      {queries.map(q => (
                        <th key={q} id={`q-col-${encodeURIComponent(q)}`}
                          className="p-2 border-b border-l border-border text-left font-medium min-w-[260px] max-w-[320px]">
                          {q}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: depth }).map((_, i) => (
                      <tr key={i} className="hover:bg-secondary/20">
                        <td className="p-2 border-b border-border text-muted-foreground align-top">{i + 1}</td>
                        {queries.map(q => {
                          const r = (matrix[q] || [])[i];
                          if (!r) return <td key={q} className="p-2 border-b border-l border-border align-top text-muted-foreground">—</td>;
                          return (
                            <td key={q} className="p-2 border-b border-l border-border align-top">
                              <a href={r.url} target="_blank" rel="noopener noreferrer"
                                className="text-foreground hover:text-primary inline-flex items-center gap-1 break-all">
                                {shortUrl(r.url)} <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                              </a>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                <TypeBadge type={r.siteType} />
                                <span className="text-[10px] text-muted-foreground">· {r.pageType}</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Разбивка по запросам */}
            <Card className="p-4 space-y-4">
              <div className="text-sm font-medium">Разбивка по типам сайтов</div>
              {queries.map(q => {
                const list = matrix[q] || [];
                const n = list.length || 1;
                const counts = list.reduce<Record<string, number>>((acc, r) => {
                  acc[r.siteType] = (acc[r.siteType] || 0) + 1; return acc;
                }, {});
                const intent = classifyIntent(list);
                return (
                  <div key={q} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm truncate"><span className="text-muted-foreground mr-2">›</span>{q}</div>
                      <Badge variant="secondary" className="text-[10px]">{intent.label}</Badge>
                    </div>
                    <div className="h-2.5 rounded overflow-hidden flex bg-secondary/40">
                      {Object.entries(counts).map(([t, c]) => {
                        const color = TYPE_COLORS[t as SiteType]?.bg || '#888';
                        return <div key={t} title={`${t}: ${c}`} style={{ width: `${(c / n) * 100}%`, backgroundColor: color }} />;
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => (
                        <span key={t}>{t}: <span className="text-foreground font-medium">{c}</span> ({Math.round((c / n) * 100)}%)</span>
                      ))}
                    </div>
                    <div className="text-[11px] text-muted-foreground">→ {intent.hint}</div>
                  </div>
                );
              })}
            </Card>

            {/* Сравнительная матрица */}
            {showCompare && compareData && (
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-sm font-medium">Пересечение доменов</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-secondary/40">
                      <tr>
                        <th className="p-2 border-b border-border text-left">Домен</th>
                        {queries.map(q => (
                          <th key={q} className="p-2 border-b border-l border-border text-center min-w-[80px]" title={q}>
                            {q.length > 14 ? q.slice(0, 13) + '…' : q}
                          </th>
                        ))}
                        <th className="p-2 border-b border-l border-border text-center">Итого</th>
                      </tr>
                    </thead>
                    <tbody>
                      {compareData.map(({ domain, row, total }) => (
                        <tr key={domain} className="hover:bg-secondary/20">
                          <td className="p-2 border-b border-border font-medium">{domain}</td>
                          {queries.map(q => (
                            <td key={q} className="p-2 border-b border-l border-border text-center">
                              {row[q] ? <span className="text-foreground font-medium">{row[q]}</span> : <span className="text-muted-foreground">—</span>}
                            </td>
                          ))}
                          <td className="p-2 border-b border-l border-border text-center font-semibold">{total}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* AI результат */}
            {aiMd && (
              <Card className="p-5">
                <div className="text-sm font-medium mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> AI-анализ интента</div>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown>{aiMd}</ReactMarkdown>
                </div>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}