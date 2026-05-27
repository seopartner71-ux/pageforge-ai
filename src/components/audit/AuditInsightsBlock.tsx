import { useEffect, useState } from 'react';
import { Sparkles, Wand2, Loader2, ChevronUp, ChevronDown, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  reason: string;
}
interface AuditInsights {
  verdict: string;
  key_findings: string[];
  recommendations: Recommendation[];
}

const STORAGE_PREFIX = 'audit-insights:';

export function AuditInsightsBlock({ jobId }: { jobId: string }) {
  const [insights, setInsights] = useState<AuditInsights | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!jobId) return;
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + jobId);
      if (raw) {
        const parsed = JSON.parse(raw);
        setInsights(parsed.insights ?? null);
        setGeneratedAt(parsed.generated_at ?? null);
      } else {
        setInsights(null);
        setGeneratedAt(null);
      }
    } catch { /* ignore */ }
  }, [jobId]);

  const handleGenerate = async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Не авторизованы');
      const { data, error } = await supabase.functions.invoke('audit-insights', {
        body: { job_id: jobId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setInsights(data.insights);
      setGeneratedAt(data.generated_at);
      try {
        localStorage.setItem(STORAGE_PREFIX + jobId, JSON.stringify({
          insights: data.insights, generated_at: data.generated_at,
        }));
      } catch { /* quota */ }
      toast.success('AI-выводы готовы');
    } catch (err: any) {
      toast.error('Не удалось сгенерировать AI-выводы: ' + (err?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative rounded-xl border border-primary/20 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-purple-500/5 to-primary/8" />
      <div className="absolute inset-0 bg-card/60" />
      <div className="relative p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Выводы и рекомендации AI</h3>
              <p className="text-[11px] text-muted-foreground">
                {generatedAt ? `Сгенерировано: ${new Date(generatedAt).toLocaleString('ru-RU')}` : 'Краткий разбор результатов аудита'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1.5" onClick={handleGenerate} disabled={loading}>
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
              {insights ? 'Перегенерировать' : 'Сгенерировать'}
            </Button>
            {insights && (
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => setExpanded(!expanded)}>
                {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            )}
          </div>
        </div>
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI анализирует результаты аудита…</p>
          </div>
        ) : insights && expanded ? (
          <div className="space-y-4">
            {insights.verdict && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-0.5">Вердикт</p>
                <p className="text-sm text-foreground leading-relaxed">{insights.verdict}</p>
              </div>
            )}
            {insights.key_findings?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5">Ключевые выводы</p>
                <ul className="space-y-1.5">
                  {insights.key_findings.map((f, i) => (
                    <li key={i} className="text-sm text-foreground leading-relaxed flex gap-2">
                      <span className="text-primary mt-1 shrink-0">•</span><span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.recommendations?.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Рекомендации</p>
                {insights.recommendations.map((r, i) => (
                  <Card key={i} className="bg-background/50 border-border p-3">
                    <div className="flex items-start gap-2.5">
                      {r.priority === 'high' ? <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                        : r.priority === 'medium' ? <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                        : <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className={cn(
                          'text-[10px] font-semibold border mb-1',
                          r.priority === 'high' && 'bg-destructive/15 text-destructive border-destructive/30',
                          r.priority === 'medium' && 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
                          r.priority === 'low' && 'bg-blue-500/15 text-blue-400 border-blue-500/30',
                        )}>
                          {r.priority === 'high' ? 'Высокий приоритет' : r.priority === 'medium' ? 'Средний' : 'Низкий'}
                        </Badge>
                        <p className="text-sm font-medium text-foreground leading-snug mb-1">{r.action}</p>
                        {r.reason && <p className="text-xs text-muted-foreground leading-relaxed">{r.reason}</p>}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        ) : !insights ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Получите AI-разбор результатов аудита: вердикт, ключевые выводы и приоритетные рекомендации.
            </p>
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleGenerate}>
              <Wand2 className="h-3 w-3" /> Сгенерировать выводы
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}