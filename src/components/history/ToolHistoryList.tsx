import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, ExternalLink, FileSpreadsheet, Link as LinkIcon, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

type Kind = 'link_audits' | 'competitor_analyses' | 'top_analyses';

const META: Record<Kind, { route: string; icon: any; label: string; emptyHint: string }> = {
  link_audits: {
    route: '/link-audit',
    icon: LinkIcon,
    label: 'Ссылочные аудиты',
    emptyHint: 'Загрузите CSV на странице «Ссылочный аудит» — он сохранится сюда автоматически.',
  },
  competitor_analyses: {
    route: '/competitors',
    icon: FileSpreadsheet,
    label: 'Анализы конкурентов',
    emptyHint: 'Загрузите CSV на странице «Конкуренты» — он сохранится сюда автоматически.',
  },
  top_analyses: {
    route: '/top-analysis',
    icon: BarChart3,
    label: 'Анализы топа',
    emptyHint: 'Загрузите CSV на странице «Анализ топа» — он сохранится сюда автоматически.',
  },
};

interface Row {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  region?: string;
  my_domain?: string;
  file_name?: string;
  ai_markdown?: string;
}

export function ToolHistoryList({ kind }: { kind: Kind }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [projects, setProjects] = useState<Record<string, string>>({});
  const navigate = useNavigate();
  const meta = META[kind];

  const load = async () => {
    setRows(null);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setRows([]); return; }

    const [{ data: items }, { data: projs }] = await Promise.all([
      supabase
        .from(kind)
        .select('id, name, created_at, updated_at, project_id, file_name, ai_markdown' + (kind === 'top_analyses' ? ', region, my_domain' : ''))
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false }),
      supabase.from('projects').select('id, name').eq('user_id', user.id),
    ]);

    const projMap: Record<string, string> = {};
    projs?.forEach((p: any) => { projMap[p.id] = p.name; });
    setProjects(projMap);
    setRows((items as any) || []);
  };

  useEffect(() => { load(); }, [kind]);

  const remove = async (id: string) => {
    const { error } = await supabase.from(kind).delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    setRows((prev) => (prev || []).filter((r) => r.id !== id));
    toast.success('Запись удалена');
  };

  if (rows === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="glass-card p-12 text-center space-y-3">
        <meta.icon className="w-10 h-10 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{meta.emptyHint}</p>
        <Button variant="outline" onClick={() => navigate(meta.route)}>
          Перейти на страницу
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div
          key={r.id}
          className="glass-card p-4 flex items-center justify-between gap-3 group hover:border-primary/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
              <meta.icon className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{r.name || 'Без названия'}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                {projects[r.project_id] && <span>📁 {projects[r.project_id]}</span>}
                {r.file_name && <span className="truncate max-w-[180px]">📄 {r.file_name}</span>}
                {r.region && <span>📍 {r.region}</span>}
                {r.my_domain && <span>🌐 {r.my_domain}</span>}
                {r.ai_markdown && <span className="text-emerald-500">✨ AI-выводы</span>}
                <span>
                  {new Date(r.updated_at).toLocaleDateString('ru-RU', {
                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`${meta.route}?restore=${r.id}`)}
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Открыть
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive h-8 w-8">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Удалить запись?</AlertDialogTitle>
                  <AlertDialogDescription>
                    «{r.name}» будет удалено безвозвратно.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Отмена</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => remove(r.id)}
                  >
                    Удалить
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      ))}
    </div>
  );
}
