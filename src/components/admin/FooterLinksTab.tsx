import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Plus, Trash2, Link2 } from 'lucide-react';
import type { FooterLink } from '@/hooks/useFooterLinks';

export function FooterLinksTab() {
  const { toast } = useToast();
  const [links, setLinks] = useState<FooterLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase
      .from('site_config')
      .select('value')
      .eq('key', 'footer_links')
      .maybeSingle()
      .then(({ data }) => {
        const value = data?.value;
        if (Array.isArray(value)) setLinks(value as FooterLink[]);
        setLoading(false);
      });
  }, []);

  const update = (i: number, patch: Partial<FooterLink>) => {
    setLinks(prev => prev.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  };

  const add = () => setLinks(prev => [...prev, { label: '', url: '', newTab: true }]);
  const remove = (i: number) => setLinks(prev => prev.filter((_, idx) => idx !== i));

  const save = async () => {
    setSaving(true);
    const cleaned = links
      .map(l => ({ label: l.label.trim(), url: l.url.trim(), newTab: l.newTab !== false }))
      .filter(l => l.label && l.url);

    const { error } = await supabase
      .from('site_config')
      .upsert(
        { key: 'footer_links', value: cleaned as any, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    setSaving(false);
    if (error) {
      toast({ title: 'Ошибка сохранения', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Ссылки футера обновлены ✓' });
      setLinks(cleaned);
    }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  return (
    <div className="space-y-4 max-w-3xl">
      <div>
        <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Link2 className="w-4 h-4 text-primary" /> Ссылки в футере
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Управляйте URL и анкорами ссылок, которые отображаются в футере лендинга.
        </p>
      </div>

      <div className="space-y-3">
        {links.map((link, i) => (
          <div key={i} className="glass-card p-4 grid grid-cols-1 md:grid-cols-[1fr_2fr_auto_auto] gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Анкор</label>
              <Input value={link.label} onChange={e => update(i, { label: e.target.value })} placeholder="Системное SEO" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">URL</label>
              <Input value={link.url} onChange={e => update(i, { url: e.target.value })} placeholder="https://example.com" />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground pb-2">
              <input
                type="checkbox"
                checked={link.newTab !== false}
                onChange={e => update(i, { newTab: e.target.checked })}
                className="w-4 h-4 accent-primary"
              />
              Новое окно
            </label>
            <Button variant="outline" size="icon" onClick={() => remove(i)} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {links.length === 0 && (
          <p className="text-sm text-muted-foreground italic py-4 text-center">Нет ссылок. Добавьте первую.</p>
        )}
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={add} className="gap-2">
          <Plus className="w-4 h-4" /> Добавить ссылку
        </Button>
        <Button onClick={save} disabled={saving} className="btn-gradient border-0 gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Сохранить
        </Button>
      </div>
    </div>
  );
}
