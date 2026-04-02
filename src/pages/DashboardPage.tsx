import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { AnalysisForm } from '@/components/AnalysisForm';
import { ChecklistSidebar } from '@/components/ChecklistSidebar';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import ReportPage from '@/pages/ReportPage';
import { Button } from '@/components/ui/button';
import { Zap, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Project {
  id: string;
  name: string;
  domain: string;
}

export default function DashboardPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);

  // Load projects from DB
  useEffect(() => {
    const loadProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('id, name, domain')
        .order('created_at', { ascending: false });
      if (data) setProjects(data.map(p => ({ id: p.id, name: p.name, domain: p.domain || '' })));
      setProjectsLoaded(true);
    };
    loadProjects();
  }, []);

  const handleCreateProject = async (project: { name: string; domain: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('projects')
      .insert({ name: project.name, domain: project.domain, user_id: user.id })
      .select('id, name, domain')
      .single();

    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      return;
    }
    if (data) {
      setProjects(prev => [{ id: data.id, name: data.name, domain: data.domain || '' }, ...prev]);
      setShowNewProject(false);
      toast({ title: `Проект "${data.name}" создан` });
    }
  };

  const handleStartAnalysis = async (data: {
    url: string;
    pageType: string;
    competitors: string[];
    aiContext: string;
    clusterMode: boolean;
    projectId?: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const projectId = data.projectId || projects[0]?.id;
    if (!projectId) {
      toast({ title: 'Сначала создайте проект', variant: 'destructive' });
      return;
    }

    setLoading(true);

    // Create analysis in DB
    const { data: analysis, error } = await supabase
      .from('analyses')
      .insert({
        user_id: user.id,
        project_id: projectId,
        url: data.url,
        page_type: data.pageType,
        competitors: data.competitors,
        ai_context: data.aiContext,
        cluster_mode: data.clusterMode,
        status: 'running',
      })
      .select('id')
      .single();

    if (error) {
      toast({ title: error.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Simulate analysis completion and save mock results
    setTimeout(async () => {
      if (analysis) {
        // Save mock results
        await supabase.from('analysis_results').insert({
          analysis_id: analysis.id,
          scores: {
            seoHealth: 48,
            llmFriendly: 60,
            humanTouch: 65,
            sgeAdapt: 55,
          },
          modules: [
            { name: 'Go Parser', time: '2.1s', done: true },
            { name: 'Код-аналитика', time: '8.4s', done: true },
            { name: 'Semantic Relevance', time: '8.3s', done: true },
            { name: 'Topical Authority', time: '11.2s', done: true },
            { name: 'LLM Readiness', time: '6.7s', done: true },
            { name: 'Content Recs', time: '9.1s', done: true },
            { name: 'Technical Fixes', time: '5.8s', done: true },
          ],
          quick_wins: [
            { text: 'Внедрить семантические теги <main> и <section> для улучшения структуры.' },
            { text: 'Прописать осмысленные alt-тексты для всех 18 изображений.' },
            { text: 'Заполнить и внедрить OpenGraph теги (og:title, og:description, og:image).' },
            { text: 'Внедрить микроразметку Schema.org для LocalBusiness и Service.' },
            { text: 'Переписать Title и Description, добавив УТП и гео-привязку.' },
            { text: 'Разместить на видном месте номера телефонов и CTA-кнопку «Рассчитать стоимость».' },
          ],
          tab_data: {},
        });

        // Update analysis status
        await supabase.from('analyses').update({ status: 'completed' }).eq('id', analysis.id);

        setAnalysisId(analysis.id);
        setAnalyzedUrl(data.url);
      }
      setLoading(false);
      toast({ title: `Анализ завершён: ${data.url}` });
    }, 2500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Show report page
  if (analyzedUrl) {
    return <ReportPage url={analyzedUrl} analysisId={analysisId} onBack={() => { setAnalyzedUrl(null); setAnalysisId(null); }} />;
  }

  // Header
  const header = (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container flex items-center justify-between h-14">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold gradient-text">{tr.appName}</span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{tr.subtitle}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#" className="text-sm font-medium text-foreground border-b-2 border-primary pb-0.5">{tr.nav.analysis}</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.history}</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.account}</a>
            <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.pdfEditor}</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );

  if (!projectsLoaded) {
    return (
      <div className="min-h-screen">
        {header}
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-lg btn-gradient animate-pulse" />
        </div>
      </div>
    );
  }

  if (projects.length === 0 || showNewProject) {
    return (
      <div className="min-h-screen">
        {header}
        <CreateProjectDialog onCreated={handleCreateProject} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {header}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-2">
            <div className="mb-8">
              <h1 className="text-3xl font-bold text-foreground whitespace-pre-line leading-tight">
                {tr.tagline.split('\n')[0]}{' '}
                <span className="gradient-text">{tr.tagline.split('\n')[1]}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line leading-relaxed">{tr.taglineDesc}</p>
            </div>
            <AnalysisForm
              onStartAnalysis={handleStartAnalysis}
              loading={loading}
              projects={projects}
              onNewProject={() => setShowNewProject(true)}
            />
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <ChecklistSidebar />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
