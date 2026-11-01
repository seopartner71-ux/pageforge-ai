import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { AuditResult } from '@/lib/internalLinks/engine';
import type { AiReport } from '@/lib/internalLinks/exportXlsx';

const MAX_ROWS = 300;

function T({ head, rows }: { head: string[]; rows: (string | number | null | undefined)[][] }) {
  if (!rows.length) return <p className="text-sm text-muted-foreground p-4">Проблем не найдено.</p>;
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>{head.map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow></TableHeader>
        <TableBody>
          {rows.slice(0, MAX_ROWS).map((r, i) => (
            <TableRow key={i}>{r.map((c, j) => <TableCell key={j} className="text-xs max-w-[420px] break-all">{c ?? '—'}</TableCell>)}</TableRow>
          ))}
        </TableBody>
      </Table>
      {rows.length > MAX_ROWS && <p className="text-xs text-muted-foreground p-2">Показаны первые {MAX_ROWS} из {rows.length}. Полный список — в выгрузке Excel.</p>}
    </div>
  );
}

const prioVariant = (p: string) => (p.startsWith('Высок') ? 'destructive' : p.startsWith('Сред') ? 'default' : 'secondary') as 'destructive' | 'default' | 'secondary';

export function AuditResultView({ auditId, result, ai, onAi, fileBase }: {
  auditId: string; result: AuditResult; ai: AiReport | null; onAi: (r: AiReport) => void; fileBase: string;
}) {
  const [loading, setLoading] = useState(false);
  const s = result.summary;

  const genAi = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('internal-link-insights', { body: { audit_id: auditId } });
    setLoading(false);
    if (error) {
      let msg = error.message;
      try { const b = await (error as any).context?.json(); msg = b?.error || msg; } catch { /* */ }
      toast.error(msg); return;
    }
    if (data?.error) { toast.error(data.error); return; }
    onAi(data.report);
  };

  const exportX = async () => {
    const m = await import('@/lib/internalLinks/exportXlsx');
    m.exportInternalLinksXlsx(result, ai, fileBase);
  };

  const stats: [string, string | number][] = [
    ['Страниц (200, HTML)', s.pages], ['Сироты', s.orphans], ['Без ссылок из текста', s.noTextLinks],
    ['Ссылки на редиректы (целей)', s.redirectTargets], ['Битые (целей)', s.brokenTargets], ['Конфликты анкоров', s.anchorConflicts],
    ['Каннибализация', s.cannibal ?? 'нет GSC'], ['Кандидатов статья→услуга', s.candidates],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(([k, v]) => (
          <Card key={k} className="p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-semibold">{v}</div></Card>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Шаблонных ссылок (меню, виджеты, листинги) исключено из «ссылок из текста»: {s.templateLinks}. GSC: {result.hasGsc ? 'подключён' : 'нет данных'}.</p>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Выводы и рекомендации ИИ</h3>
          <div className="flex gap-2">
            <Button size="sm" variant={ai ? 'outline' : 'default'} onClick={genAi} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}{ai ? 'Обновить' : 'Сгенерировать'}
            </Button>
            <Button size="sm" variant="outline" onClick={exportX}><Download className="h-4 w-4 mr-1" />Excel</Button>
          </div>
        </div>
        {loading && !ai && <p className="text-sm text-muted-foreground">ИИ анализирует результаты, это займёт до минуты…</p>}
        {ai && (
          <div className="space-y-4 text-sm">
            <div className="flex gap-3 items-start">
              {ai.score != null && <div className="text-3xl font-bold text-primary shrink-0">{ai.score}<span className="text-sm text-muted-foreground">/100</span></div>}
              <p>{ai.verdict}</p>
            </div>
            {!!ai.findings?.length && (
              <div className="space-y-2">
                <div className="font-medium">Выводы</div>
                {ai.findings.map((f, i) => (
                  <div key={i} className="border-l-2 pl-3" style={{ borderColor: f.severity === 'critical' ? 'hsl(var(--destructive))' : f.severity === 'warning' ? 'hsl(var(--primary))' : 'hsl(var(--border))' }}>
                    <div className="font-medium">{f.title}</div><div className="text-muted-foreground">{f.details}</div>
                  </div>
                ))}
              </div>
            )}
            {!!ai.recommendations?.length && (
              <div className="space-y-2">
                <div className="font-medium">Рекомендации</div>
                {ai.recommendations.map((r, i) => (
                  <div key={i} className="rounded-md border p-3 space-y-1">
                    <div className="flex gap-2 items-center"><Badge variant={prioVariant(r.priority)}>{r.priority}</Badge><span className="font-medium">{r.title}</span></div>
                    <div className="text-muted-foreground break-words">{r.details}</div>
                    {r.effect && <div className="text-xs">Эффект: {r.effect}</div>}
                  </div>
                ))}
              </div>
            )}
            {!!ai.quick_wins?.length && (
              <div><div className="font-medium mb-1">Быстрые победы</div><ul className="list-disc pl-5 text-muted-foreground">{ai.quick_wins.map((q, i) => <li key={i}>{q}</li>)}</ul></div>
            )}
          </div>
        )}
      </Card>

      <Tabs defaultValue="plan">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="plan">План ({result.plan.length})</TabsTrigger>
          <TabsTrigger value="types">По типам</TabsTrigger>
          <TabsTrigger value="pages">Страницы ({result.pages.length})</TabsTrigger>
          <TabsTrigger value="cand">Кандидаты ({result.candidates.length})</TabsTrigger>
          <TabsTrigger value="cann">Каннибализация</TabsTrigger>
          <TabsTrigger value="orph">Сироты ({result.orphans.length})</TabsTrigger>
          <TabsTrigger value="notext">Без ссылок из текста ({result.noText.length})</TabsTrigger>
          <TabsTrigger value="redir">Редиректы ({result.redirects.length})</TabsTrigger>
          <TabsTrigger value="broken">Битые ({result.broken.length})</TabsTrigger>
          <TabsTrigger value="anchors">Анкоры ({result.conflicts.length})</TabsTrigger>
        </TabsList>
        <Card className="mt-2">
          <TabsContent value="plan" className="m-0">
            <T head={['Приоритет', 'Действие', 'Страница', 'Основание']} rows={result.plan.map((p) => [p.priority, p.action, p.page, p.reason])} />
            {!result.hasGsc && <p className="text-xs text-muted-foreground p-2">* Нет данных GSC — услуги отсортированы по числу ссылок из текста, а не по показам.</p>}
          </TabsContent>
          <TabsContent value="types" className="m-0">
            <T head={['Тип', 'Страниц', 'Ср. PageRank', 'Ср. входящих из текста', 'Без ссылок из текста', 'Ср. глубина']}
              rows={result.byType.map((t) => [t.type, t.pages, t.prAvg, t.inTextAvg, t.noText, t.depthAvg])} />
          </TabsContent>
          <TabsContent value="pages" className="m-0">
            <T head={['URL', 'Тип', 'H1', 'Слов', 'Глубина', 'Вх. всего', 'Вх. из текста', 'Исх. из текста', 'PR', 'PR текст', ...(result.hasGsc ? ['Показы', 'Поз.'] : [])]}
              rows={result.pages.map((p) => [p.url, p.type, p.h1, p.words, p.depth, p.in_all, p.in_text, p.out_text, p.pr_all.toFixed(2), p.pr_text.toFixed(2),
                ...(result.hasGsc ? [p.impr, p.pos != null ? p.pos.toFixed(1) : null] : [])])} />
          </TabsContent>
          <TabsContent value="cand" className="m-0">
            <T head={['Откуда (статья)', 'Куда (услуга)', 'Близость', 'Анкор', 'Пометка']}
              rows={result.candidates.map((c) => [c.src, c.dst, c.sim, c.anchor, c.duplicate ? 'возможный дубль — проверить каннибализацию' : ''])} />
          </TabsContent>
          <TabsContent value="cann" className="m-0">
            {result.hasGscQp ? (
              <T head={['Запрос', 'Показы', 'Основная', 'Поз.', 'Конкурент', 'Поз.', 'Доля']}
                rows={result.cannibal.map((c) => [c.query, c.impr, c.main, c.mainPos, c.rival, c.rivalPos, c.rivalShare])} />
            ) : <p className="text-sm text-muted-foreground p-4">Загрузите выгрузку GSC «запрос + страница», чтобы проверить каннибализацию.</p>}
          </TabsContent>
          <TabsContent value="orph" className="m-0"><T head={['URL', 'Тип', 'Title']} rows={result.orphans.map((p) => [p.url, p.type, p.title])} /></TabsContent>
          <TabsContent value="notext" className="m-0"><T head={['URL', 'Тип', 'Title', 'Вх. всего']} rows={result.noText.map((p) => [p.url, p.type, p.title, p.in_all])} /></TabsContent>
          <TabsContent value="redir" className="m-0"><T head={['Цель', 'Код', 'Ссылок', 'Примеры источников']} rows={result.redirects.map((g) => [g.dst, g.code, g.links, g.examples.join(', ')])} /></TabsContent>
          <TabsContent value="broken" className="m-0"><T head={['Цель', 'Код', 'Ссылок', 'Примеры источников']} rows={result.broken.map((g) => [g.dst, g.code, g.links, g.examples.join(', ')])} /></TabsContent>
          <TabsContent value="anchors" className="m-0"><T head={['Анкор', 'Страниц', 'Цели']} rows={result.conflicts.map((c) => [c.anchor, c.targets, c.detail.map((d) => `${d.url} (${d.count})`).join(' | ')])} /></TabsContent>
        </Card>
      </Tabs>
    </div>
  );
}
