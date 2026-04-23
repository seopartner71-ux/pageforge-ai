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
const SharedReportPage = lazy(() => import('./pages/SharedReportPage.tsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.tsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.tsx'));
const LinkAuditPage = lazy(() => import('./pages/LinkAuditPage.tsx'));
const CompetitorsPage = lazy(() => import('./pages/CompetitorsPage.tsx'));
const TopAnalysisPage = lazy(() => import('./pages/TopAnalysisPage.tsx'));
const IntentPage = lazy(() => import('./pages/IntentPage.tsx'));
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
                <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
                <Route path="/history" element={<AuthGate><HistoryPage /></AuthGate>} />
                <Route path="/report/:id" element={<AuthGate><ReportRouterPage /></AuthGate>} />
                <Route path="/account" element={<AuthGate><AccountPage /></AuthGate>} />
                
                <Route path="/admin" element={<AdminGate><AdminPage /></AdminGate>} />
                <Route path="/geo-audit" element={<AuthGate><GeoAuditPage /></AuthGate>} />
                <Route path="/link-audit" element={<AuthGate><LinkAuditPage /></AuthGate>} />
                <Route path="/competitors" element={<AuthGate><CompetitorsPage /></AuthGate>} />
                <Route path="/top-analysis" element={<AuthGate><TopAnalysisPage /></AuthGate>} />
                <Route path="/intent" element={<AuthGate><IntentPage /></AuthGate>} />
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
