import { useState, useEffect, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LangProvider } from "@/contexts/LangContext";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import DashboardPage from "./pages/DashboardPage.tsx";
import HistoryPage from "./pages/HistoryPage.tsx";
import AccountPage from "./pages/AccountPage.tsx";
import PdfEditorPage from "./pages/PdfEditorPage.tsx";
import ReportRouterPage from "./pages/ReportRouterPage.tsx";

const queryClient = new QueryClient();

function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<any>(undefined);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    return () => subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (!session) return <AuthPage />;
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
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<AuthGate><DashboardPage /></AuthGate>} />
            <Route path="/history" element={<AuthGate><HistoryPage /></AuthGate>} />
            <Route path="/report/:id" element={<AuthGate><ReportRouterPage /></AuthGate>} />
            <Route path="/account" element={<AuthGate><AccountPage /></AuthGate>} />
            <Route path="/pdf-editor" element={<AuthGate><PdfEditorPage /></AuthGate>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LangProvider>
  </QueryClientProvider>
);

export default App;
