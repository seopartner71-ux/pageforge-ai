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
import { Loader2, Download, Sparkles, ExternalLink, Tag, Rocket, Target, Globe, Zap } from 'lucide-react';
import { TYPE_COLORS, classifyIntent, shortUrl, type IntentMatrix, type SiteType } from '@/lib/intent/types';
import { exportIntentXlsx } from '@/lib/intent/exportIntentXlsx';
import ReactMarkdown from 'react-markdown';

type Engine = 'google' | 'yandex' | 'both';

function TypeBadge({ type }: { type: SiteType }) {
  const c = TYPE_COLORS[type] || TYPE_COLORS['Неизвестно'];
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold leading-none tracking-wide animate-fade-in"
      style={{ backgroundColor: c.bg, color: c.text }}
    >{type}</span>
  );
}

const INTENT_BADGE: Record<string, string> = {
  'Коммерческий интент': 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  'Информационный интент': 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
  'Смешанный интент': 'bg-primary/15 text-primary border border-primary/30',
  'Нет данных': 'bg-muted text-muted-foreground border border-border',
};

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
        {/* Заголовок страницы — как в LinkAuditPage */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Target className="w-6 h-6 text-primary" />
              Проверка интента запросов
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Определите тип контента, который ранжирует поисковая система по вашим запросам
            </p>
          </div>
        </div>

        {/* Форма */}
        <Card className="p-5 space-y-5">
          <div>
            <Label className="text-xs text-muted-foreground">Поисковая система</Label>
            <div className="inline-flex rounded-md border border-border overflow-hidden mt-2">
              {([
                { v: 'google', l: 'Google', icon: <Globe className="w-3.5 h-3.5" /> },
                { v: 'yandex', l: 'Яндекс (скоро)', icon: <span className="text-[10px] font-bold">Я</span> },
                { v: 'both', l: 'Яндекс + Google (скоро)', icon: <Zap className="w-3.5 h-3.5" /> },
              ] as const).map(o => {
                const active = engine === o.v;
                return (
                  <button
                    key={o.v}
                    type="button"
                    disabled={o.v !== 'google'}
                    onClick={() => setEngine(o.v as Engine)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border last:border-r-0 transition-colors ${
                      active
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card text-foreground hover:bg-accent'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                  >
                    {o.icon}{o.l}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Город</Label>
              <Input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-2 h-9"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Запросов</Label>
              <div className="inline-flex rounded-md border border-border overflow-hidden mt-2">
                {[10, 20, 30].map(n => {
                  const active = maxQueries === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setMaxQueries(n as any)}
                      className={`px-4 py-1.5 text-xs border-r border-border last:border-r-0 transition-colors ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
                      }`}
                    >{n}</button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Глубина топа</Label>
              <div className="inline-flex rounded-md border border-border overflow-hidden mt-2">
                {[10, 20, 30].map(n => {
                  const active = depth === n;
                  return (
                    <button
                      key={n}
                      onClick={() => setDepth(n as any)}
                      className={`px-4 py-1.5 text-xs border-r border-border last:border-r-0 transition-colors ${
                        active ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'
                      }`}
                    >{n}</button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs text-muted-foreground">Запросы (по одному на строку)</Label>
              <span className={`text-xs font-mono ${parsedQueries.length > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                {parsedQueries.length} / {maxQueries}
              </span>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={'купить диван москва\nинтернет магазин мебели'}
              className="min-h-[140px] font-mono text-sm"
            />
          </div>

          <Button
            onClick={runAnalysis}
            disabled={loading || !parsedQueries.length}
            className="gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            {loading ? 'Анализирую запросы…' : 'Запустить анализ'}
          </Button>
        </Card>

        {/* Прогресс анализа */}
        {loading && (
          <Card className="p-4">
            <div className="text-sm font-medium mb-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              Анализируем запросы…
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary animate-pulse" style={{ width: '60%' }} />
            </div>
            <div className="mt-3 space-y-1.5">
              {parsedQueries.map((q, i) => (
                <div key={q} className="flex items-center gap-2 text-xs">
                  <div className={`w-1.5 h-1.5 rounded-full ${i === 0 ? 'bg-primary animate-pulse' : 'bg-muted-foreground/30'}`} />
                  <span className="text-muted-foreground truncate">{q}</span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Результаты */}
        {matrix && (
          <>
            {/* Теги запросов */}
            <Card className="p-4">
              <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Tag className="w-4 h-4 text-primary" /> Запросы ({queries.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={onExport}>
                    <Download className="w-4 h-4 mr-1.5" /> Экспорт XLSX
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setShowCompare(s => !s)}>
                    {showCompare ? 'Скрыть пересечения' : 'Пересечение доменов'}
                  </Button>
                  <Button size="sm" onClick={runAi} disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                    AI-анализ
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {queries.map(q => (
                  <button key={q} onClick={() => scrollToQuery(q)}
                    className="px-2.5 py-1 text-xs rounded-md bg-muted/40 border border-border text-muted-foreground hover:text-foreground hover:border-primary/50 hover:bg-accent transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            </Card>

            {/* Матрица результатов */}
            <Card className="p-0 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/40 sticky top-0 z-10">
                    <tr>
                      <th className="w-10 p-3 border-b border-border text-left text-muted-foreground font-medium">#</th>
                      {queries.map(q => (
                        <th key={q} id={`q-col-${encodeURIComponent(q)}`}
                          title={q}
                          className="p-3 border-b border-l border-border text-left font-semibold text-foreground min-w-[260px] max-w-[320px]">
                          {q.length > 22 ? q.slice(0, 21) + '…' : q}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: depth }).map((_, i) => (
                      <tr key={i} className="hover:bg-accent/40 transition-colors">
                        <td className="p-3 border-b border-border text-muted-foreground align-top font-mono">{i + 1}</td>
                        {queries.map(q => {
                          const r = (matrix[q] || [])[i];
                          if (!r) return <td key={q} className="p-3 border-b border-l border-border align-top text-muted-foreground">—</td>;
                          return (
                            <td key={q} className="p-3 border-b border-l border-border align-top group">
                              <a href={r.url} target="_blank" rel="noopener noreferrer"
                                className="text-foreground hover:text-primary inline-flex items-center gap-1 break-all transition-colors">
                                <span className="truncate">{shortUrl(r.url)}</span>
                                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 shrink-0 transition-opacity" />
                              </a>
                              <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
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
            <Card className="p-4 space-y-5">
              <h2 className="text-sm font-semibold">Разбивка по типам сайтов</h2>
              {queries.map(q => {
                const list = matrix[q] || [];
                const n = list.length || 1;
                const counts = list.reduce<Record<string, number>>((acc, r) => {
                  acc[r.siteType] = (acc[r.siteType] || 0) + 1; return acc;
                }, {});
                const intent = classifyIntent(list);
                const badgeClass = INTENT_BADGE[intent.label] || INTENT_BADGE['Нет данных'];
                return (
                  <div key={q} className="space-y-2 pb-4 border-b border-border last:border-0 last:pb-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm font-medium truncate">{q}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${badgeClass}`}>
                        {intent.label}
                      </span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex bg-muted">
                      {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => {
                        const color = TYPE_COLORS[t as SiteType]?.bg || '#6B7280';
                        return (
                          <div
                            key={t}
                            title={`${t}: ${c} (${Math.round((c / n) * 100)}%)`}
                            className="transition-all"
                            style={{ width: `${(c / n) * 100}%`, backgroundColor: color }}
                          />
                        );
                      })}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                      {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t, c]) => {
                        const color = TYPE_COLORS[t as SiteType]?.bg || '#6B7280';
                        return (
                          <span key={t} className="inline-flex items-center gap-1.5 text-muted-foreground">
                            <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: color }} />
                            {t}: <span className="text-foreground font-semibold">{c}</span>
                            <span className="opacity-60">({Math.round((c / n) * 100)}%)</span>
                          </span>
                        );
                      })}
                    </div>
                    <div className="text-[11px] text-muted-foreground italic pl-1">→ {intent.hint}</div>
                  </div>
                );
              })}
            </Card>

            {/* Сравнительная матрица */}
            {showCompare && compareData && (
              <Card className="p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-border text-sm font-semibold">
                  Пересечение доменов
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="bg-muted/40">
                      <tr>
                        <th className="p-3 border-b border-border text-left font-semibold">Домен</th>
                        {queries.map(q => (
                          <th key={q} className="p-3 border-b border-l border-border text-center min-w-[80px] font-medium text-muted-foreground" title={q}>
                            {q.length > 14 ? q.slice(0, 13) + '…' : q}
                          </th>
                        ))}
                        <th className="p-3 border-b border-l border-border text-center font-semibold">Итого</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const maxTotal = Math.max(...compareData.map(d => d.total), 1);
                        return compareData.map(({ domain, row, total }, idx) => (
                          <tr key={domain} className="hover:bg-accent/40 transition-colors">
                            <td className="p-3 border-b border-border font-medium">
                              {idx < 3 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary mr-2" />}
                              {domain}
                            </td>
                            {queries.map(q => (
                              <td key={q} className="p-3 border-b border-l border-border text-center">
                                {row[q]
                                  ? <span className="text-foreground font-semibold">{row[q]}</span>
                                  : <span className="text-muted-foreground/50">—</span>}
                              </td>
                            ))}
                            <td className="p-3 border-b border-l border-border text-center">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${(total / maxTotal) * 100}%` }} />
                                </div>
                                <span className="font-bold text-foreground tabular-nums w-5 text-right">{total}</span>
                              </div>
                            </td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* AI результат */}
            {(aiMd || aiLoading) && (
              <Card className="p-5 border-primary/30">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
                  <Sparkles className={`w-4 h-4 text-primary ${aiLoading ? 'animate-pulse' : ''}`} />
                  <span className="text-sm font-semibold">AI-интерпретация результатов</span>
                </div>

                {aiLoading && !aiMd ? (
                  <div className="flex flex-col gap-2">
                    {[100, 85, 92, 70, 88, 78, 95].map((w, i) => (
                      <div
                        key={i}
                        className="h-3 rounded bg-muted animate-pulse"
                        style={{
                          width: `${w}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-sm leading-relaxed">
                    <ReactMarkdown
                      components={{
                        h1: ({ children }) => <h2 className="text-base font-bold text-primary mt-4 mb-2">{children}</h2>,
                        h2: ({ children }) => <h2 className="text-sm font-semibold text-primary mt-4 mb-1.5">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-xs font-semibold text-primary/80 mt-3 mb-1 uppercase tracking-wide">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-xs font-semibold text-foreground mt-2 mb-1">{children}</h4>,
                        p: ({ children }) => <p className="text-[13px] text-foreground/80 leading-relaxed my-1.5">{children}</p>,
                        strong: ({ children }) => <strong className="text-foreground font-semibold">{children}</strong>,
                        em: ({ children }) => <em className="text-primary/90 italic">{children}</em>,
                        ul: ({ children }) => <ul className="my-2 space-y-1 list-none">{children}</ul>,
                        ol: ({ children }) => <ol className="my-2 space-y-1 pl-5 list-decimal text-foreground/80">{children}</ol>,
                        li: ({ children }) => (
                          <li className="text-[13px] text-foreground/80 leading-relaxed pl-4 relative">
                            <span className="absolute left-0 top-0 text-primary font-bold">•</span>
                            {children}
                          </li>
                        ),
                        a: ({ children, href }) => (
                          <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline hover:no-underline">{children}</a>
                        ),
                        code: ({ children }) => (
                          <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-xs font-mono">{children}</code>
                        ),
                        blockquote: ({ children }) => (
                          <blockquote className="border-l-2 border-primary pl-3 my-2 text-muted-foreground italic">{children}</blockquote>
                        ),
                        hr: () => <hr className="border-0 border-t border-border my-3" />,
                      }}
                    >
                      {aiMd}
                    </ReactMarkdown>
                  </div>
                )}
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
}