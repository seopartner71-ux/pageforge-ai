import { useState, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/contexts/LangContext";
import { supabase } from "@/integrations/supabase/client";
import { PendingApprovalScreen } from "@/components/PendingApprovalScreen";
import { useAdminRole } from "@/hooks/useAdminRole";
import LandingPage from "./pages/LandingPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import NotFound from "./pages/NotFound.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";
import PdfEditorPage from "./pages/PdfEditorPage.tsx";
import ReportRouterPage from "./pages/ReportRouterPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import SharedReportPage from "./pages/SharedReportPage.tsx";
import PrivacyPage from "./pages/PrivacyPage.tsx";
import TermsPage from "./pages/TermsPage.tsx";

const queryClient = new QueryClient();

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

  if (session === undefined) return null;
  if (!session) return <AuthPage />;
  if (isApproved === undefined) return null;
  if (!isApproved) return <PendingApprovalScreen />;
  return <>{children}</>;
}

function AdminGate({ children }: { children: React.ReactNode }) {
  const session = useAuthSession();
  const { isAdmin, loading } = useAdminRole();

  if (session === undefined || loading) return null;
  if (!session) return <AuthPage />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LangProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
            <Route path="/history" element={<AuthGate><HistoryPage /></AuthGate>} />
            <Route path="/report/:id" element={<AuthGate><ReportRouterPage /></AuthGate>} />
            <Route path="/account" element={<AuthGate><AccountPage /></AuthGate>} />
            <Route path="/pdf-editor" element={<AuthGate><PdfEditorPage /></AuthGate>} />
            <Route path="/admin" element={<AdminGate><AdminPage /></AdminGate>} />
            <Route path="/shared/:token" element={<SharedReportPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
