import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Download, Loader2, Eye, Upload, X, Building2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AnalysisItem {
  id: string;
  url: string;
  created_at: string;
  status: string;
}

const ALL_SECTIONS = [
  'scores', 'aiReport', 'priorities', 'tfidf', 'ngrams',
  'images', 'anchors', 'stealth', 'semanticMap',
] as const;

type SectionKey = typeof ALL_SECTIONS[number];

const sectionLabels: Record<string, Record<SectionKey, string>> = {
  ru: {
    scores: 'Общие скоры',
    aiReport: 'ИИ-отчёт',
    priorities: 'Приоритетные рекомендации',
    tfidf: 'TF-IDF анализ',
    ngrams: 'N-граммы и частотность',
    images: 'Анализ изображений',
    anchors: 'Анализ анкоров',
    stealth: 'Stealth Engine',
    semanticMap: 'Семантическая карта',
  },
  en: {
    scores: 'Overall Scores',
    aiReport: 'AI Report',
    priorities: 'Priority Recommendations',
    tfidf: 'TF-IDF Analysis',
    ngrams: 'N-grams & Frequency',
    images: 'Image Analysis',
    anchors: 'Anchor Analysis',
    stealth: 'Stealth Engine',
    semanticMap: 'Semantic Map',
  },
};

export default function PdfEditorPage() {
  const { lang } = useLang();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [analyses, setAnalyses] = useState<AnalysisItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enabledSections, setEnabledSections] = useState<Set<SectionKey>>(new Set(ALL_SECTIONS));
  const [companyName, setCompanyName] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('analyses')
        .select('id, url, created_at, status')
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) setAnalyses(data);
      setLoading(false);
    })();
  }, []);

  const toggleSection = (key: SectionKey) => {
    setEnabledSections(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    setEnabledSections(prev =>
      prev.size === ALL_SECTIONS.length ? new Set() : new Set(ALL_SECTIONS)
    );
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const ext = file.name.split('.').pop();
      const path = `${user.id}/logo.${ext}`;
      const { error } = await supabase.storage.from('report-logos').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('report-logos').getPublicUrl(path);
      setLogoUrl(publicUrl);
      toast({ title: lang === 'ru' ? 'Логотип загружен' : 'Logo uploaded' });
    } catch (err: any) {
      toast({ title: lang === 'ru' ? 'Ошибка загрузки' : 'Upload error', description: err.message, variant: 'destructive' });
    } finally {
      setLogoUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: {
          analysisId: selectedId,
          sections: Array.from(enabledSections),
          logoUrl,
          companyName,
          lang,
        },
      });
      if (error) throw error;
      if (data?.html) {
        setPreviewHtml(data.html);
        setShowPreview(true);
      }
    } catch (err: any) {
      toast({ title: lang === 'ru' ? 'Ошибка генерации' : 'Generation error', description: err.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-report-${selectedId?.slice(0, 8)}.html`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: lang === 'ru' ? 'Отчёт скачан (HTML)' : 'Report downloaded (HTML)' });
  };

  const handlePrint = () => {
    if (!previewHtml) return;
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(previewHtml);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  };

  const selectedAnalysis = analyses.find(a => a.id === selectedId);

  const t = lang === 'ru' ? {
    title: 'PDF-Редактор',
    subtitle: 'Конструктор отчёта с White Label',
    selectAnalysis: 'Выберите анализ',
    noCompleted: 'Нет завершённых анализов',
    sections: 'Разделы отчёта',
    selectAll: 'Выбрать все',
    deselectAll: 'Снять все',
    whiteLabel: 'White Label',
    companyNameLabel: 'Название компании',
    companyNamePlaceholder: 'Ваша компания',
    uploadLogo: 'Загрузить логотип',
    removeLogo: 'Удалить',
    generate: 'Сгенерировать отчёт',
    generating: 'Генерация...',
    preview: 'Предпросмотр',
    downloadHtml: 'Скачать HTML',
    printPdf: 'Печать / PDF',
    selected: 'Выбран',
    close: 'Закрыть',
  } : {
    title: 'PDF Editor',
    subtitle: 'Report constructor with White Label',
    selectAnalysis: 'Select analysis',
    noCompleted: 'No completed analyses',
    sections: 'Report Sections',
    selectAll: 'Select all',
    deselectAll: 'Deselect all',
    whiteLabel: 'White Label',
    companyNameLabel: 'Company name',
    companyNamePlaceholder: 'Your company',
    uploadLogo: 'Upload logo',
    removeLogo: 'Remove',
    generate: 'Generate report',
    generating: 'Generating...',
    preview: 'Preview',
    downloadHtml: 'Download HTML',
    printPdf: 'Print / PDF',
    selected: 'Selected',
    close: 'Close',
  };

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="container py-8 max-w-5xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.subtitle}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Left: Analysis list */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{t.selectAnalysis}</h2>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : analyses.length === 0 ? (
              <div className="glass-card p-8 text-center text-muted-foreground">{t.noCompleted}</div>
            ) : (
              <div className="space-y-2">
                {analyses.map(a => (
                  <div
                    key={a.id}
                    onClick={() => setSelectedId(a.id)}
                    className={`glass-card p-4 flex items-center justify-between cursor-pointer transition-all ${
                      selectedId === a.id ? 'border-primary ring-1 ring-primary/30' : 'hover:border-primary/20'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileText className="w-5 h-5 text-primary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{a.url}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(a.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    </div>
                    {selectedId === a.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Generate button */}
            {selectedId && (
              <Button
                size="lg"
                className="w-full btn-gradient border-0 gap-2"
                onClick={handleGenerate}
                disabled={generating || enabledSections.size === 0}
              >
                {generating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> {t.generating}</>
                ) : (
                  <><Download className="w-4 h-4" /> {t.generate}</>
                )}
              </Button>
            )}
          </div>

          {/* Right sidebar: Sections + White Label */}
          <div className="space-y-4">
            {/* Sections checkboxes */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold tracking-widest text-muted-foreground uppercase">{t.sections}</CardTitle>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
                    {enabledSections.size === ALL_SECTIONS.length ? t.deselectAll : t.selectAll}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {ALL_SECTIONS.map((key) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer group">
                    <Checkbox
                      checked={enabledSections.has(key)}
                      onCheckedChange={() => toggleSection(key)}
                    />
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">
                      {sectionLabels[lang][key]}
                    </span>
                  </label>
                ))}
              </CardContent>
            </Card>

            {/* White Label */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold tracking-widest text-muted-foreground uppercase flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {t.whiteLabel}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{t.companyNameLabel}</label>
                  <Input
                    placeholder={t.companyNamePlaceholder}
                    value={companyName}
                    onChange={e => setCompanyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{t.uploadLogo}</label>
                  {logoUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                      <img src={logoUrl} alt="Logo" className="h-10 max-w-[120px] object-contain" />
                      <Button variant="ghost" size="sm" onClick={() => setLogoUrl(null)} className="text-xs gap-1">
                        <X className="w-3 h-3" /> {t.removeLogo}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full"
                      onClick={() => fileRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {t.uploadLogo}
                    </Button>
                  )}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Preview Dialog */}
        <Dialog open={showPreview} onOpenChange={setShowPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                {t.preview}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto border rounded-md bg-white">
              {previewHtml && (
                <iframe
                  srcDoc={previewHtml}
                  className="w-full min-h-[600px] h-full"
                  style={{ border: 'none' }}
                  title="PDF Preview"
                />
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" /> {t.downloadHtml}
              </Button>
              <Button className="btn-gradient border-0 gap-2" onClick={handlePrint}>
                <FileText className="w-4 h-4" /> {t.printPdf}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
