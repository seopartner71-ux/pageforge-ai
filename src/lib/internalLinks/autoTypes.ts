import { supabase } from '@/integrations/supabase/client';
import { pathOf } from '@/lib/internalLinks/engine';

export interface SamplePage { url: string; title?: string }

/** ИИ предлагает правила типов страниц по списку URL и сохраняет их в проект. */
export async function autoDetectTypes(projectId: string, pages: SamplePage[]) {
  const host = (() => { try { return new URL(pages[0].url).hostname; } catch { return ''; } })();
  const { data, error } = await supabase.functions.invoke('internal-link-types', {
    body: { host, pages: pages.map((p) => ({ path: pathOf(p.url), title: p.title ?? '' })) },
  });
  if (error) {
    let msg = error.message;
    try { const b = await (error as any).context?.json(); msg = b?.error || msg; } catch { /* ignore */ }
    throw new Error(msg);
  }
  const rules = (data?.rules ?? []) as { name: string; regex: string }[];
  const { error: delErr } = await supabase.from('internal_link_rules').delete().eq('project_id', projectId);
  if (delErr) throw new Error(delErr.message);
  const { error: insErr } = await supabase.from('internal_link_rules').insert(rules.map((r, i) => ({ project_id: projectId, name: r.name, regex: r.regex, position: i })));
  if (insErr) throw new Error(insErr.message);
  return rules.map((r) => ({ name: r.name, regex: r.regex }));
}
