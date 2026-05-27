import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { AnalysisForm, type AnalysisFormData } from '@/components/AnalysisForm';
import { ChecklistSidebar } from '@/components/ChecklistSidebar';
import { CreateProjectDialog } from '@/components/CreateProjectDialog';
import { AnalysisProgressModal } from '@/components/AnalysisProgressModal';
import { useToast } from '@/hooks/use-toast';

const ReportPage = lazy(() => import('@/pages/ReportPage'));
const BatchReportPage = lazy(() => import('@/pages/BatchReportPage'));

interface Project {
  id: string;
  name: string;
  domain: string;
}

interface BatchItem {
  analysisId: string;
  url: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  scores?: any;
  results?: any;
}

export default function DashboardPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null);
  const [analysisId, setAnalysisId] = useState<string | null>(null);
  const [pendingAnalysisUrl, setPendingAnalysisUrl] = useState<string | null>(null);
  const [pendingAnalysisId, setPendingAnalysisId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const [batchItems, setBatchItems] = useState<BatchItem[] | null>(null);

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const [projectsRes, profileRes] = await Promise.all([
        supabase.from('projects').select('id, name, domain').order('created_at', { ascending: false }),
        user ? supabase.from('profiles').select('credits').eq('user_id', user.id).maybeSingle() : null,
      ]);
      if (projectsRes.data) setProjects(projectsRes.data.map(p => ({ id: p.id, name: p.name, domain: p.domain || '' })));
      if (profileRes?.data) setCredits(profileRes.data.credits);
      else setCredits(null);
      setProjectsLoaded(true);
    };
    loadData();
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

  const fireAnalysis = async (analysisId: string, data: AnalysisFormData, url: string) => {
    const { data: session } = await supabase.auth.getSession();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/seo-analyze`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.session?.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({
          url,
          pageType: data.pageType,
          competitors: data.competitors,
          aiContext: data.aiContext,
          clusterMode: data.clusterMode,
          analysisId,
          region: data.region,
        }),
      }
    );
    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Analysis failed (${response.status})`);
    }
  };

  const handleStartAnalysis = async (data: AnalysisFormData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const projectId = data.projectId || projects[0]?.id;
    if (!projectId) {
      toast({ title: 'Сначала создайте проект', variant: 'destructive' });
      return;
    }

    // Batch mode
    if (data.batchMode && data.urls && data.urls.length >= 2) {
      const requiredCredits = data.urls.length;
      if (credits !== null && credits < requiredCredits) {
        toast({ title: `Недостаточно кредитов. Нужно: ${requiredCredits}, доступно: ${credits}`, variant: 'destructive' });
        return;
      }

      setLoading(true);
      const items: BatchItem[] = [];

      // Create all analysis records
      for (const url of data.urls) {
        const { data: analysis, error } = await supabase
          .from('analyses')
          .insert({
            user_id: user.id,
            project_id: projectId,
            url,
            page_type: data.pageType,
            competitors: data.competitors,
            ai_context: data.aiContext,
            cluster_mode: data.clusterMode,
            region: data.region,
            status: 'pending',
          })
          .select('id')
          .single();

        if (error || !analysis) {
          toast({ title: `Ошибка создания анализа для ${url}: ${error?.message}`, variant: 'destructive' });
          continue;
        }
        items.push({ analysisId: analysis.id, url, status: 'pending' });
      }

      if (items.length < 2) {
        toast({ title: 'Не удалось создать достаточно анализов', variant: 'destructive' });
        setLoading(false);
        return;
      }

      setBatchItems(items);

      // Fire all analyses in parallel
      for (const item of items) {
        fireAnalysis(item.analysisId, data, item.url).catch(err => {
          toast({ title: `Ошибка: ${err.message}`, variant: 'destructive' });
        });
      }
      setLoading(false);
      return;
    }

    // Single mode (existing logic)
    if (credits !== null && credits <= 0) {
      toast({ title: 'Лимит исчерпан. Обратитесь к администратору для пополнения кредитов.', variant: 'destructive' });
      return;
    }

    setLoading(true);

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
        region: data.region,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !analysis) {
      toast({ title: error?.message || 'Error creating analysis', variant: 'destructive' });
      setLoading(false);
      return;
    }

    setPendingAnalysisId(analysis.id);
    setPendingAnalysisUrl(data.url);

    fireAnalysis(analysis.id, data, data.url).catch(err => {
      toast({ title: err.message || 'Analysis failed', variant: 'destructive' });
    }).finally(() => setLoading(false));
  };

  const handleAnalysisComplete = useCallback(async () => {
    if (pendingAnalysisId && pendingAnalysisUrl) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && credits !== null) {
        const newCredits = Math.max(0, credits - 1);
        await supabase.from('profiles').update({ credits: newCredits }).eq('user_id', user.id);
        setCredits(newCredits);
      }
      setAnalysisId(pendingAnalysisId);
      setAnalyzedUrl(pendingAnalysisUrl);
      setPendingAnalysisId(null);
      setPendingAnalysisUrl(null);
      setLoading(false);
      toast({ title: `Анализ завершён` });
    }
  }, [pendingAnalysisId, pendingAnalysisUrl, toast, credits]);

  // Batch report view
  if (batchItems) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-lg btn-gradient animate-pulse" /></div>}>
        <BatchReportPage items={batchItems} onBack={() => { setBatchItems(null); }} />
      </Suspense>
    );
  }

  if (analyzedUrl) {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 rounded-lg btn-gradient animate-pulse" /></div>}>
        <ReportPage
          url={analyzedUrl}
          analysisId={analysisId}
          onBack={() => { setAnalyzedUrl(null); setAnalysisId(null); }}
          onReanalyze={(reUrl) => {
            setAnalyzedUrl(null);
            setAnalysisId(null);
            handleStartAnalysis({
              url: reUrl,
              pageType: '',
              competitors: [],
              aiContext: '',
              clusterMode: false,
              region: '',
              batchMode: false,
              urls: [],
              projectId: projects[0]?.id || '',
            });
          }}
        />
      </Suspense>
    );
  }

  if (!projectsLoaded) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 rounded-lg btn-gradient animate-pulse" />
        </div>
      </div>
    );
  }

  if (projects.length === 0 || showNewProject) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <CreateProjectDialog onCreated={handleCreateProject} />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      {pendingAnalysisId && pendingAnalysisUrl && (
        <AnalysisProgressModal
          analysisId={pendingAnalysisId}
          url={pendingAnalysisUrl}
          onComplete={handleAnalysisComplete}
        />
      )}
      <main className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
          <div className="space-y-2">
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-foreground whitespace-pre-line leading-tight">
                {tr.tagline.split('\n')[0]}{' '}
                <span className="text-primary">{tr.tagline.split('\n')[1]}</span>
              </h1>
              <p className="text-sm text-muted-foreground mt-3 whitespace-pre-line leading-relaxed">{tr.taglineDesc}</p>
            </div>
            <PageDescription
              className="mb-6"
              items={[
                { label: 'Что это', text: 'Комплексный SEO-аудит страницы по методологии 2026: программный разбор HTML, сравнение с ТОП-10 выдачи, оценка контента, структуры, технических факторов и сигналов E-E-A-T.' },
                { label: 'Что проверяем', text: 'Title, Description, заголовки H1–H6, структура контента, ключевые слова и LSI, TF-IDF против конкурентов, перелинковка, Schema.org, скорость загрузки, мобильная адаптация, изображения, индексация.' },
                { label: 'Зачем', text: 'Чтобы увидеть, чего не хватает вашей странице для выхода в ТОП: какие темы раскрывают конкуренты, какие сущности и ключи упускаете, какие технические ошибки мешают ранжированию.' },
                { label: 'Результат', text: 'Подробный отчёт с оценкой по модулям, конкурентный анализ ТОП-10, список задач P1/P2/P3, готовый план внедрения и выгрузка в Excel, PDF или Google Docs.' },
              ]}
              help={{
                content: [
                  'On-page SEO — оптимизация элементов самой страницы, которые поисковые системы используют для понимания темы и качества контента. Базовые рекомендации зафиксированы в Google SEO Starter Guide: уникальный точный title (50–60 символов), описательный meta description (≤ 160 символов), один H1, логичная структура H2–H6, alt-атрибуты у изображений, читаемые URL.',
                  'Сравнение с ТОП-10 — стандартная методология конкурентного контент-анализа: вычисление средней длины текста, количества заголовков, плотности тематических n-грамм. Используется TF-IDF (Term Frequency — Inverse Document Frequency, классический алгоритм информационного поиска, Spärck Jones, 1972) для выявления значимых терминов, которые есть у конкурентов и отсутствуют у вас.',
                  'Google неоднократно подтверждал (John Mueller, Search Central Office Hours, 2021–2024): нет фиксированной "оптимальной" длины контента или плотности ключей. Алгоритм оценивает полноту раскрытия темы (topical authority), наличие сущностей (entities из Knowledge Graph) и качество подачи. Поэтому проверка сравнивает страницу с реальным ТОПом, а не с абстрактными нормативами.',
                ],
                sources: [
                  { label: 'Google SEO Starter Guide', url: 'https://developers.google.com/search/docs/fundamentals/seo-starter-guide' },
                  { label: 'Google — How Search Works', url: 'https://www.google.com/search/howsearchworks/' },
                  { label: 'Google — Helpful Content System', url: 'https://developers.google.com/search/updates/helpful-content-update' },
                  { label: 'Stanford IR Book — TF-IDF', url: 'https://nlp.stanford.edu/IR-book/html/htmledition/tf-idf-weighting-1.html' },
                  { label: 'Яндекс — Алгоритм Королёв (нейросети и смысл)', url: 'https://yandex.ru/company/technologies/korolev/' },
                ],
              }}
            />
            <AnalysisForm
              onStartAnalysis={handleStartAnalysis}
              loading={loading}
              projects={projects}
              onNewProject={() => setShowNewProject(true)}
              credits={credits}
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
