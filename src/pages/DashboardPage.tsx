import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { UrlInput } from '@/components/UrlInput';
import { AnalysisTabs } from '@/components/AnalysisTabs';
import { Button } from '@/components/ui/button';
import { Zap, LogOut } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function DashboardPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const [analyzedUrl, setAnalyzedUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAnalyze = (url: string) => {
    setLoading(true);
    // Simulate analysis start
    setTimeout(() => {
      setAnalyzedUrl(url);
      setLoading(false);
      toast({ title: `Analysis started for ${url}` });
    }, 1500);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <span className="font-bold text-lg gradient-text">{tr.appName}</span>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              {tr.logout}
            </Button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container py-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">{tr.dashboard}</h1>
          <p className="text-muted-foreground">{tr.tagline}</p>
        </div>

        <div className="glass-card p-6">
          <UrlInput onAnalyze={handleAnalyze} loading={loading} />
        </div>

        {analyzedUrl && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground animate-slide-up">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            {analyzedUrl}
          </div>
        )}

        <AnalysisTabs hasUrl={!!analyzedUrl} />
      </main>
    </div>
  );
}
