import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowDown, ArrowUp, Plus, Trash2, Save, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import { classify, pathOf } from '@/lib/internalLinks/engine';

export interface RuleRow { name: string; regex: string }

const regexError = (rx: string) => { if (!rx.trim()) return 'Пустое выражение'; try { new RegExp(rx); return null; } catch (e) { return (e as Error).message; } };

export function TypeRulesTab({ projectId, rules, onSaved, sampleUrls }: {
  projectId: string; rules: RuleRow[]; onSaved: (r: RuleRow[]) => void; sampleUrls: string[] | null;
}) {
  const [rows, setRows] = useState<RuleRow[]>(rules);
  const [saving, setSaving] = useState(false);
  const [showTest, setShowTest] = useState(false);
  useEffect(() => setRows(rules), [rules]);

  const errors = rows.map((r) => (r.name.trim() ? regexError(r.regex) : 'Укажите название'));
  const hasErr = errors.some(Boolean);

  const move = (i: number, d: number) => setRows((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  const save = async () => {
    if (hasErr) { toast.error('Исправьте ошибки в правилах'); return; }
    setSaving(true);
    const { error: delErr } = await supabase.from('internal_link_rules').delete().eq('project_id', projectId);
    if (!delErr && rows.length) {
      const { error } = await supabase.from('internal_link_rules').insert(rows.map((r, i) => ({ project_id: projectId, name: r.name.trim(), regex: r.regex, position: i })));
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else if (delErr) { toast.error(delErr.message); setSaving(false); return; }
    setSaving(false);
    toast.success('Правила сохранены');
    onSaved(rows);
  };

  const test = useMemo(() => {
    if (!showTest || !sampleUrls || hasErr) return null;
    const compiled = rows.map((r) => ({ name: r.name, rx: new RegExp(r.regex) }));
    const m = new Map<string, string[]>();
    for (const u of sampleUrls) { const t = classify(u, compiled); if (!m.has(t)) m.set(t, []); m.get(t)!.push(pathOf(u)); }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [showTest, sampleUrls, rows, hasErr]);

  return (
    <div className="space-y-4">
      <Card className="p-4 text-sm text-muted-foreground space-y-1">
        <p>Правила применяются сверху вниз по пути URL (например, <code className="text-foreground">^/blog/</code> или <code className="text-foreground">^/(logoped|tkmp)/</code>). Главная страница всегда «Главная», всё, что не подошло, — «Прочее».</p>
        <p>Для проверок нужны типы с точными названиями: <b className="text-foreground">«Статья»</b>, <b className="text-foreground">«Услуга»</b>, <b className="text-foreground">«Консультация»</b>. Без них не будет кандидатов «статья → услуга» и проверки услуг.</p>
      </Card>
      <Card className="p-4 space-y-2">
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Правил пока нет — все страницы попадут в «Прочее».</p>}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[200px_1fr_auto] gap-2 items-start">
            <Input value={r.name} placeholder="Тип (Статья)" onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <div>
              <Input value={r.regex} placeholder="^/blog/" className={`font-mono ${errors[i] && r.name.trim() ? 'border-destructive' : ''}`}
                onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, regex: e.target.value } : x)))} />
              {errors[i] && <p className="text-xs text-destructive mt-1">{errors[i]}</p>}
            </div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={() => move(i, -1)} aria-label="Выше"><ArrowUp className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => move(i, 1)} aria-label="Ниже"><ArrowDown className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setRows((p) => p.filter((_, j) => j !== i))} aria-label="Удалить"><Trash2 className="h-4 w-4" /></Button>
            </div>
          </div>
        ))}
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={() => setRows((p) => [...p, { name: '', regex: '' }])}><Plus className="h-4 w-4 mr-1" />Добавить правило</Button>
          <Button size="sm" onClick={save} disabled={saving || hasErr}><Save className="h-4 w-4 mr-1" />{saving ? 'Сохраняю…' : 'Сохранить'}</Button>
          <Button variant="outline" size="sm" onClick={() => setShowTest((v) => !v)} disabled={!sampleUrls}>
            <FlaskConical className="h-4 w-4 mr-1" />Проверить на данных
          </Button>
          {!sampleUrls && <span className="text-xs text-muted-foreground self-center">Загрузите internal_all во вкладке «Новый аудит», чтобы проверить правила.</span>}
        </div>
      </Card>
      {test && (
        <Card className="p-4 space-y-3">
          {test.map(([t, urls]) => (
            <div key={t}>
              <div className="text-sm font-medium">{t} <span className="text-muted-foreground">— {urls.length}</span></div>
              <div className="text-xs text-muted-foreground font-mono truncate">{urls.slice(0, 6).join('  ·  ')}</div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
