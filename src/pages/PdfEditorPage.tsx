import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { FileText, Download, Loader2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalysisItem {
  id: string;
  url: string;
  created_at: string;
  status: string;
}

export default function PdfEditorPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('analyses')
        .select('id, url, created_at, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setAnalyses(data);
      setLoading(false);
    };
    load();
  }, []);

  const handleGenerate = (id: string) => {
    setGenerating(id);
    setTimeout(() => {
      setGenerating(null);
      toast({
        title: lang === 'ru' ? 'PDF-генерация будет доступна в следующем обновлении' : 'PDF generation coming in next update',
      });
    }, 1500);
  };

  const t = {
    ru: {
      title: 'PDF-Редактор',
      subtitle: 'Генерация PDF-отчётов по результатам анализа',
      selectAnalysis: 'Выберите анализ для генерации PDF',
      noCompleted: 'Нет завершённых анализов',
      generate: 'Сгенерировать PDF',
      generating: 'Генерация...',
      preview: 'Предпросмотр',
      download: 'Скачать',
      sections: 'Разделы отчёта',
      sectionsList: [
        'Общий SEO-аудит и скоры',
        'Приоритетные рекомендации',
        'Golden Source Blueprint',
        'TF-IDF анализ ключевых слов',
        'N-граммы и частотность',
        'Закон Ципфа',
        'Анализ изображений',
        'Анализ анкоров',
        'PageSpeed и Core Web Vitals',
        'Stealth Engine',
      ],
    },
    en: {
      title: 'PDF Editor',
      subtitle: 'Generate PDF reports from analysis results',
      selectAnalysis: 'Select analysis to generate PDF',
      noCompleted: 'No completed analyses',
      generate: 'Generate PDF',
      generating: 'Generating...',
      preview: 'Preview',
      download: 'Download',
      sections: 'Report Sections',
      sectionsList: [
        'Overall SEO Audit & Scores',
        'Priority Recommendations',
        'Golden Source Blueprint',
        'TF-IDF Keyword Analysis',
        'N-grams & Frequency',
        "Zipf's Law",
        'Image Analysis',
        'Anchor Analysis',
        'PageSpeed & Core Web Vitals',
        'Stealth Engine',
      ],
    },
  };
  const tr = t[lang];

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8 max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{tr.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tr.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Analysis list */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground">{tr.selectAnalysis}</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : analyses.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">
                {tr.noCompleted}
              </div>
            ) : (
              <div className="space-y-3">
                {analyses.map(a => (
                  <div key={a.id} className="glass-card p-4 flex items-center justify-between hover:border-primary/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                            day: 'numeric', month: 'short', year: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" disabled>
                        <Eye className="w-3.5 h-3.5" />
                        {tr.preview}
                      </Button>
                      <Button
                        size="sm"
                        className="btn-gradient border-0 gap-1.5 text-xs"
                        onClick={() => handleGenerate(a.id)}
                        disabled={generating === a.id}
                      >
                        {generating === a.id ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {tr.generating}</>
                        ) : (
                          <><Download className="w-3.5 h-3.5" /> {tr.generate}</>
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Report sections sidebar */}
          <div className="hidden lg:block">
            <div className="glass-card p-5 sticky top-20">
              <h3 className="text-sm font-semibold tracking-widest text-muted-foreground mb-4">{tr.sections}</h3>
              <div className="space-y-2.5">
                {tr.sectionsList.map((section, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                      {i + 1}
                    </div>
                    <span className="text-xs text-foreground">{section}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
