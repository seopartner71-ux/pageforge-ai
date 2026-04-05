import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, Link2, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';

interface Props {
  open: boolean;
  onClose: () => void;
  analysisIds: string[];
}

interface AnalysisData {
  id: string;
  url: string;
  keywords: { term: string; density: number; inTitle?: boolean; inH1?: boolean }[];
}

export function ClusterSynergyModal({ open, onClose, analysisIds }: Props) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalysisData[]>([]);

  useEffect(() => {
    if (!open || analysisIds.length < 2) return;
    setLoading(true);
    (async () => {
      const results: AnalysisData[] = [];
      for (const id of analysisIds) {
        const { data: analysis } = await supabase
          .from('analyses')
          .select('id, url')
          .eq('id', id)
          .single();

        const { data: result } = await supabase
          .from('analysis_results')
          .select('tab_data')
          .eq('analysis_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (analysis && result) {
          const tabData = result.tab_data as any;
          const tfidf = tabData?.tfidf || [];
          const keywords = tfidf
            .filter((t: any) => t.density > 0)
            .map((t: any) => ({
              term: t.term,
              density: t.density,
              inTitle: t.inTitle || false,
              inH1: t.inH1 || false,
            }))
            .slice(0, 50);

          results.push({ id: analysis.id, url: analysis.url, keywords });
        }
      }
      setData(results);
      setLoading(false);
    })();
  }, [open, analysisIds]);

  // Find cannibalized keywords (present with density > 0.5 on 2+ pages)
  const cannibalized = useMemo(() => {
    if (data.length < 2) return [];

    const termMap = new Map<string, { pages: { url: string; density: number; inTitle: boolean; inH1: boolean }[] }>();

    data.forEach(d => {
      d.keywords.forEach(kw => {
        const key = kw.term.toLowerCase();
        if (!termMap.has(key)) termMap.set(key, { pages: [] });
        termMap.get(key)!.pages.push({
          url: d.url,
          density: kw.density,
          inTitle: kw.inTitle || false,
          inH1: kw.inH1 || false,
        });
      });
    });

    return Array.from(termMap.entries())
      .filter(([, v]) => v.pages.length >= 2 && v.pages.some(p => p.density > 0.5))
      .map(([term, v]) => ({ term, pages: v.pages }))
      .sort((a, b) => b.pages.length - a.pages.length || b.pages[0].density - a.pages[0].density)
      .slice(0, 30);
  }, [data]);

  // Interlinking suggestions
  const interlinkSuggestions = useMemo(() => {
    if (data.length < 2) return [];
    const suggestions: { from: string; to: string; anchor: string; reason: string }[] = [];

    // For each pair, find unique strong keywords and suggest linking
    for (let i = 0; i < data.length; i++) {
      for (let j = 0; j < data.length; j++) {
        if (i === j) continue;
        const fromPage = data[i];
        const toPage = data[j];

        // Keywords strong on toPage but weak/missing on fromPage
        const fromTerms = new Set(fromPage.keywords.map(k => k.term.toLowerCase()));
        const uniqueToTerms = toPage.keywords
          .filter(k => k.density > 1 && !fromTerms.has(k.term.toLowerCase()))
          .slice(0, 2);

        if (uniqueToTerms.length > 0) {
          suggestions.push({
            from: fromPage.url,
            to: toPage.url,
            anchor: uniqueToTerms.map(t => t.term).join(', '),
            reason: isRu
              ? `Передаст вес по теме "${uniqueToTerms[0].term}"`
              : `Will pass weight for "${uniqueToTerms[0].term}"`,
          });
        }
      }
    }
    return suggestions.slice(0, 10);
  }, [data, isRu]);

  const shortUrl = (url: string) => {
    try {
      const u = new URL(url);
      return u.pathname.length > 30 ? u.pathname.slice(0, 30) + '...' : u.pathname || '/';
    } catch {
      return url.slice(0, 30);
    }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-primary" />
            {isRu ? 'Анализ Синергии Кластера' : 'Cluster Synergy Analysis'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">
              {isRu ? 'Сравнение ключевых слов...' : 'Comparing keywords...'}
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-6 pr-2">
            {/* Pages overview */}
            <div className="flex flex-wrap gap-2">
              {data.map((d, i) => (
                <Badge key={d.id} variant="secondary" className="text-xs">
                  <span className="font-bold mr-1">#{i + 1}</span> {shortUrl(d.url)}
                  <span className="ml-1 text-muted-foreground">({d.keywords.length} {isRu ? 'слов' : 'terms'})</span>
                </Badge>
              ))}
            </div>

            {/* Cannibalization Matrix */}
            <div>
              <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                {isRu ? 'Каннибализация запросов' : 'Keyword Cannibalization'}
                {cannibalized.length > 0 && (
                  <Badge variant="destructive" className="text-xs">{cannibalized.length}</Badge>
                )}
              </h3>

              {cannibalized.length === 0 ? (
                <div className="glass-card p-6 text-center text-sm text-muted-foreground">
                  ✅ {isRu ? 'Каннибализация не обнаружена!' : 'No cannibalization detected!'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 text-muted-foreground font-medium">
                          {isRu ? 'Ключевое слово' : 'Keyword'}
                        </th>
                        {data.map((d, i) => (
                          <th key={d.id} className="text-center p-2 text-muted-foreground font-medium min-w-[100px]">
                            #{i + 1} {shortUrl(d.url)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cannibalized.map((c, ci) => (
                        <tr key={ci} className="border-b border-border/30 hover:bg-secondary/30">
                          <td className="p-2 font-medium text-foreground">{c.term}</td>
                          {data.map(d => {
                            const match = c.pages.find(p => p.url === d.url);
                            if (!match) return <td key={d.id} className="text-center p-2 text-muted-foreground/30">—</td>;

                            const isTitle = match.inTitle || match.inH1;
                            const bg = isTitle
                              ? 'bg-destructive/20 text-destructive'
                              : 'bg-yellow-500/20 text-yellow-600';

                            return (
                              <td key={d.id} className="text-center p-2">
                                <span className={`inline-block px-2 py-0.5 rounded text-xs font-mono ${bg}`}>
                                  {match.density.toFixed(1)}%
                                  {isTitle && ' 🎯'}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-destructive/20" /> {isRu ? 'В Title/H1' : 'In Title/H1'}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded bg-yellow-500/20" /> {isRu ? 'В тексте' : 'In body'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Interlinking Scheme */}
            {interlinkSuggestions.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" />
                  {isRu ? 'Схема перелинковки' : 'Interlinking Scheme'}
                </h3>
                <div className="space-y-2">
                  {interlinkSuggestions.map((s, i) => (
                    <div key={i} className="glass-card p-3 flex items-center gap-3 text-xs">
                      <span className="text-muted-foreground font-mono truncate max-w-[180px]" title={s.from}>
                        {shortUrl(s.from)}
                      </span>
                      <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                      <span className="text-foreground font-mono truncate max-w-[180px]" title={s.to}>
                        {shortUrl(s.to)}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-xs">{s.anchor}</Badge>
                      <span className="text-muted-foreground ml-auto hidden sm:block">{s.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>
            {isRu ? 'Закрыть' : 'Close'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
