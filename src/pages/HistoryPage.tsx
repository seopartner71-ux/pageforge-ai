import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, ExternalLink, Trash2, Clock, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

interface AnalysisRow {
  id: string;
  url: string;
  page_type: string | null;
  status: string;
  created_at: string;
  project: { name: string } | null;
}

export default function HistoryPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<AnalysisRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadAnalyses();
  }, []);

  const loadAnalyses = async () => {
    const { data, error } = await supabase
      .from('analyses')
      .select('id, url, page_type, status, created_at, project:projects(name)')
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      setAnalyses(data.map((a: any) => ({ ...a, project: a.project?.[0] || a.project })));
    }
    if (error) console.error(error);
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('analyses').delete().eq('id', id);
    if (!error) {
      setAnalyses(prev => prev.filter(a => a.id !== id));
      toast({ title: lang === 'ru' ? 'Анализ удалён' : 'Analysis deleted' });
    }
  };

  const filtered = analyses.filter(a =>
    a.url.toLowerCase().includes(search.toLowerCase())
  );

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'running': return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const statusLabel = (status: string) => {
    const labels: Record<string, Record<string, string>> = {
      ru: { completed: 'Завершён', failed: 'Ошибка', running: 'В процессе', pending: 'Ожидание' },
      en: { completed: 'Completed', failed: 'Failed', running: 'Running', pending: 'Pending' },
    };
    return labels[lang]?.[status] || status;
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">
            {lang === 'ru' ? 'История анализов' : 'Analysis History'}
          </h1>
          <div className="relative w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === 'ru' ? 'Поиск по URL...' : 'Search by URL...'}
              className="pl-9 bg-secondary border-border/50"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-muted-foreground">
              {lang === 'ru' ? 'Нет анализов' : 'No analyses found'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(a => (
              <div key={a.id} className="glass-card p-4 flex items-center justify-between group hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {statusIcon(a.status)}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{a.url}</p>
                    <div className="flex items-center gap-3 mt-1">
                      {a.project && (
                        <span className="text-xs text-muted-foreground">📁 {typeof a.project === 'object' && a.project !== null ? a.project.name : ''}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(a.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                          day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={a.status === 'completed' ? 'default' : a.status === 'failed' ? 'destructive' : 'secondary'}>
                    {statusLabel(a.status)}
                  </Badge>
                  {a.status === 'completed' && (
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/report/${a.id}`)}>
                      <ExternalLink className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(a.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
