import { useState, useEffect, Suspense, lazy } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom';
import { Toaster as Sonner } from '@/components/ui/sonner';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { LangProvider } from '@/contexts/LangContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';
import { useAdminRole } from '@/hooks/useAdminRole';

const LandingPage = lazy(() => import('./pages/LandingPage.tsx'));
const AuthPage = lazy(() => import('./pages/AuthPage.tsx'));
const NotFound = lazy(() => import('./pages/NotFound.tsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.tsx'));
const HistoryPage = lazy(() => import('./pages/HistoryPage.tsx'));
const AccountPage = lazy(() => import('./pages/AccountPage.tsx'));

const ReportRouterPage = lazy(() => import('./pages/ReportRouterPage.tsx'));
const AdminPage = lazy(() => import('./pages/AdminPage.tsx'));
const GeoAuditPage = lazy(() => import('./pages/GeoAuditPage.tsx'));
const EeatAuditPage = lazy(() => import('./pages/EeatAuditPage.tsx'));
const SharedReportPage = lazy(() => import('./pages/SharedReportPage.tsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.tsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.tsx'));
const LinkAuditPage = lazy(() => import('./pages/LinkAuditPage.tsx'));
const CompetitorsPage = lazy(() => import('./pages/CompetitorsPage.tsx'));
const TopAnalysisPage = lazy(() => import('./pages/TopAnalysisPage.tsx'));
const IntentPage = lazy(() => import('./pages/IntentPage.tsx'));
const SemanticCorePage = lazy(() => import('./pages/SemanticCorePage.tsx'));
const BlogTopicsPage = lazy(() => import('./pages/BlogTopicsPage.tsx'));
const SchemaAuditPage = lazy(() => import('./pages/SchemaAuditPage.tsx'));
const SerpHistoryPage = lazy(() => import('./pages/SerpHistoryPage.tsx'));
const PageSpeedPage = lazy(() => import('./pages/PageSpeedPage.tsx'));
const ResponsivePage = lazy(() => import('./pages/ResponsivePage.tsx'));
const ToolsHubPage = lazy(() => import('./pages/ToolsHubPage.tsx'));
const AppLayout = lazy(() => import('./components/AppLayout.tsx'));
const DataCopilotWidget = lazy(() => import('./components/DataCopilotWidget.tsx'));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-8 h-8 rounded-lg btn-gradient animate-pulse" />
    </div>
  );
}

function useAuthSession() {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    return () => subscription.unsubscribe();
  }, []);

  return session;
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useAuthSession();
  const [isApproved, setIsApproved] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!session?.user) {
      setIsApproved(undefined);
      return;
    }

    supabase
      .from('profiles')
      .select('is_approved')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsApproved(data?.is_approved ?? false);
      });
  }, [session?.user?.id]);

  if (session === undefined) return <PageLoader />;
  if (!session) return <AuthPage />;
  if (isApproved === undefined) return <PageLoader />;
  if (!isApproved) return <PendingApprovalScreen />;
  return <>{children}</>;
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const session = useAuthSession();
  const { isAdmin, loading } = useAdminRole();

  if (session === undefined || loading) return <PageLoader />;
  if (!session) return <AuthPage />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LangProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<AuthPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/terms" element={<TermsPage />} />
                <Route element={<AuthGate><AppLayout /></AuthGate>}>
                  <Route path="/tools" element={<ToolsHubPage />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/history" element={<HistoryPage />} />
                  <Route path="/report/:id" element={<ReportRouterPage />} />
                  <Route path="/account" element={<AccountPage />} />
                  <Route path="/geo-audit" element={<GeoAuditPage />} />
                  <Route path="/eeat-audit" element={<EeatAuditPage />} />
                  <Route path="/link-audit" element={<LinkAuditPage />} />
                  <Route path="/competitors" element={<CompetitorsPage />} />
                  <Route path="/top-analysis" element={<TopAnalysisPage />} />
                  <Route path="/intent" element={<IntentPage />} />
                  <Route path="/semantic-core" element={<SemanticCorePage />} />
                  <Route path="/blog-topics" element={<BlogTopicsPage />} />
                  <Route path="/schema-audit" element={<SchemaAuditPage />} />
                  <Route path="/serp-history" element={<SerpHistoryPage />} />
                  <Route path="/pagespeed" element={<PageSpeedPage />} />
                  <Route path="/responsive" element={<ResponsivePage />} />
                </Route>
                <Route element={<AdminGate><AppLayout /></AdminGate>}>
                  <Route path="/admin" element={<AdminPage />} />
                </Route>
                <Route path="/shared/:token" element={<SharedReportPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <DataCopilotWidget />
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </LangProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
