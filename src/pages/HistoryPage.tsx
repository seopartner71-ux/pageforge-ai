import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search, ExternalLink, Trash2, Clock, CheckCircle2, XCircle, Loader2,
  Folder, FolderOpen, ArrowLeft, FileText, AlertTriangle, Plus, GitCompareArrows,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ClusterSynergyModal } from '@/components/ClusterSynergyModal';

/* ── Types ── */

interface ProjectFolder {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
  analysis_count: number;
}

interface AnalysisRow {
  id: string;
  url: string;
  region: string;
  page_type: string | null;
  status: string;
  created_at: string;
}

/* ── Component ── */

export default function HistoryPage() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const isRu = lang === 'ru';

  const [projects, setProjects] = useState<ProjectFolder[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [openProjectName, setOpenProjectName] = useState('');
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [synergyOpen, setSynergyOpen] = useState(false);

  /* ── Load projects with analysis counts ── */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: projectRows } = await supabase
        .from('projects')
        .select('id, name, domain, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!projectRows) { setLoading(false); return; }

      // Count analyses per project
      const { data: analysisCounts } = await supabase
        .from('analyses')
        .select('project_id')
        .eq('user_id', user.id);

      const countMap: Record<string, number> = {};
      analysisCounts?.forEach((a: any) => {
        countMap[a.project_id] = (countMap[a.project_id] || 0) + 1;
      });

      setProjects(projectRows.map(p => ({
        ...p,
        analysis_count: countMap[p.id] || 0,
      })));
      setLoading(false);
    })();
  }, []);

  /* ── Open a project folder ── */
  const openFolder = async (project: ProjectFolder) => {
    setOpenProjectId(project.id);
    setOpenProjectName(project.name);
    setSearch('');
    setLoadingAnalyses(true);

    const { data } = await supabase
      .from('analyses')
      .select('id, url, region, page_type, status, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: false });

    setAnalyses(data || []);
    setLoadingAnalyses(false);
  };

  /* ── Back to projects ── */
  const goBack = () => {
    setOpenProjectId(null);
    setOpenProjectName('');
    setAnalyses([]);
    setSearch('');
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); }
      else if (next.size < 5) { next.add(id); }
      else { toast.error(isRu ? 'Максимум 5 анализов' : 'Max 5 analyses'); }
      return next;
    });
  };

  /* ── Delete project ── */
  const handleDeleteProject = async (projectId: string) => {
    // Delete analyses first, then project
    await supabase.from('analysis_results').delete().in(
      'analysis_id',
      (await supabase.from('analyses').select('id').eq('project_id', projectId)).data?.map(a => a.id) || []
    );
    await supabase.from('analyses').delete().eq('project_id', projectId);
    const { error } = await supabase.from('projects').delete().eq('id', projectId);
    if (!error) {
      setProjects(prev => prev.filter(p => p.id !== projectId));
      toast.success(isRu ? 'Проект удалён' : 'Project deleted');
    } else {
      toast.error(error.message);
    }
  };

  /* ── Delete analysis ── */
  const handleDeleteAnalysis = async (id: string) => {
    await supabase.from('analysis_results').delete().eq('analysis_id', id);
    const { error } = await supabase.from('analyses').delete().eq('id', id);
    if (!error) {
      setAnalyses(prev => prev.filter(a => a.id !== id));
      setProjects(prev => prev.map(p =>
        p.id === openProjectId ? { ...p, analysis_count: p.analysis_count - 1 } : p
      ));
      toast.success(isRu ? 'Анализ удалён' : 'Analysis deleted');
    }
  };

  /* ── Filtered lists ── */
  const filteredProjects = useMemo(() =>
    projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase())),
    [projects, search]
  );

  const filteredAnalyses = useMemo(() =>
    analyses.filter(a => a.url.toLowerCase().includes(search.toLowerCase())),
    [analyses, search]
  );

  /* ── Helpers ── */
  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': case 'done': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, Record<string, string>> = {
      ru: { completed: 'Завершён', done: 'Завершён', failed: 'Ошибка', running: 'В процессе', pending: 'Ожидание' },
      en: { completed: 'Completed', done: 'Completed', failed: 'Failed', running: 'Running', pending: 'Pending' },
    };
    return labels[lang]?.[status] || status;
  };

  /* ══════════════════════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════════════════════ */

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8 space-y-6">

        {/* ── Header + breadcrumbs ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {openProjectId && (
              <Button variant="ghost" size="icon" onClick={goBack} className="shrink-0">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              {openProjectId ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <button onClick={goBack} className="hover:text-foreground transition-colors">
                    {isRu ? 'История' : 'History'}
                  </button>
                  <span>/</span>
                  <span className="text-foreground font-medium">{openProjectName}</span>
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-foreground">
                  {isRu ? 'Мои проекты' : 'My Projects'}
                </h1>
              )}
              {!openProjectId && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {isRu
                    ? `${projects.length} ${projects.length === 1 ? 'проект' : 'проектов'}`
                    : `${projects.length} project${projects.length !== 1 ? 's' : ''}`
                  }
                </p>
              )}
            </div>
          </div>

          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={
                openProjectId
                  ? (isRu ? 'Поиск по URL...' : 'Search by URL...')
                  : (isRu ? 'Поиск проекта...' : 'Search project...')
              }
              className="pl-9 bg-secondary border-border/50"
            />
          </div>
        </div>

        {/* ── Loading ── */}
        {(loading || loadingAnalyses) && (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* ══════════ Level 1: Project Folders ══════════ */}
        {!loading && !openProjectId && (
          <>
            {filteredProjects.length === 0 ? (
              <div className="glass-card p-12 text-center space-y-3">
                <Folder className="w-12 h-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  {isRu ? 'Нет проектов. Создайте проект на странице Анализа.' : 'No projects. Create one on the Analysis page.'}
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  <Plus className="w-4 h-4 mr-2" />
                  {isRu ? 'Создать проект' : 'Create Project'}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredProjects.map(p => (
                  <div
                    key={p.id}
                    className="glass-card p-5 cursor-pointer group hover:border-primary/40 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5"
                    onClick={() => openFolder(p)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors shrink-0">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{p.name}</p>
                          {p.domain && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">{p.domain}</p>
                          )}
                        </div>
                      </div>

                      {/* Delete button */}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive shrink-0 h-8 w-8"
                            onClick={e => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent onClick={e => e.stopPropagation()}>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              {isRu ? 'Удалить проект?' : 'Delete project?'}
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {isRu
                                ? `Проект "${p.name}" и все его анализы (${p.analysis_count}) будут удалены безвозвратно.`
                                : `Project "${p.name}" and all its analyses (${p.analysis_count}) will be permanently deleted.`
                              }
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{isRu ? 'Отмена' : 'Cancel'}</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => handleDeleteProject(p.id)}
                            >
                              {isRu ? 'Удалить' : 'Delete'}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>

                    <div className="flex items-center gap-3 mt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {p.analysis_count} {isRu ? 'анализ' : 'analys'}{isRu ? (p.analysis_count === 1 ? '' : p.analysis_count < 5 ? 'а' : 'ов') : (p.analysis_count === 1 ? 'is' : 'es')}
                      </span>
                      <span>
                        {new Date(p.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
                          day: 'numeric', month: 'short', year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ══════════ Level 2: Analyses inside project ══════════ */}
        {!loadingAnalyses && openProjectId && (
          <>
            {filteredAnalyses.length === 0 ? (
              <div className="glass-card p-12 text-center space-y-3">
                <AlertTriangle className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">
                  {isRu
                    ? 'В этом проекте ещё не сделано ни одной проверки.'
                    : 'No analyses in this project yet.'
                  }
                </p>
                <Button variant="outline" onClick={() => navigate('/dashboard')}>
                  <Plus className="w-4 h-4 mr-2" />
                  {isRu ? 'Начать анализ' : 'Start Analysis'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAnalyses.map(a => (
                  <div key={a.id} className="glass-card p-4 flex items-center justify-between group hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {statusIcon(a.status)}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{a.url}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {a.region && (
                            <span className="text-xs text-muted-foreground">📍 {a.region}</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {new Date(a.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', {
                              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={
                        (a.status === 'completed' || a.status === 'done') ? 'default'
                          : a.status === 'failed' ? 'destructive' : 'secondary'
                      }>
                        {statusLabel(a.status)}
                      </Badge>
                      {(a.status === 'completed' || a.status === 'done') && (
                        <Button variant="ghost" size="sm" onClick={() => navigate(`/report/${a.id}`)}>
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteAnalysis(a.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </main>
    </div>
  );
}
