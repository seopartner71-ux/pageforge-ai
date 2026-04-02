import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { AnalysisForm } from '@/components/AnalysisForm';
import { ChecklistSidebar } from '@/components/ChecklistSidebar';
import ReportPage from '@/pages/ReportPage';
import { Button } from '@/components/ui/button';
import { Zap, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [analyzedUrl, setAnalyzedUrl] = useState<string | null>(null);

  const handleStartAnalysis = (data: any) => {
    setLoading(true);
    // Simulate analysis
    setTimeout(() => {
      setLoading(false);
      setAnalyzedUrl(data.url);
      toast({ title: `Анализ завершён: ${data.url}` });
    }, 2500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // Show report page
  if (analyzedUrl) {
    return <ReportPage url={analyzedUrl} onBack={() => setAnalyzedUrl(null)} />;
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
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

      {/* Main */}
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
            <AnalysisForm onStartAnalysis={handleStartAnalysis} loading={loading} />
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
