import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CheckCircle2, Loader2, AlertCircle, Clock } from 'lucide-react';

interface Stage {
  name: string;
  status: 'pending' | 'running' | 'done' | 'error';
  time?: string;
}

interface AnalysisProgressModalProps {
  analysisId: string;
  url: string;
  onComplete: () => void;
}

export function AnalysisProgressModal({ analysisId, url, onComplete }: AnalysisProgressModalProps) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [status, setStatus] = useState<string>('running');

  useEffect(() => {
    // Poll for progress updates every 2 seconds
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('analyses')
        .select('status, progress')
        .eq('id', analysisId)
        .single();

      if (data) {
        setStatus(data.status);
        if (data.progress && Array.isArray(data.progress)) {
          setStages(data.progress as Stage[]);
        }
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
          if (data.status === 'completed') {
            setTimeout(onComplete, 1000); // Brief delay to show final state
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [analysisId, onComplete]);

  const completedCount = stages.filter(s => s.status === 'done').length;
  const totalCount = stages.length || 1;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const statusIcon = (s: Stage['status']) => {
    switch (s) {
      case 'done': return <CheckCircle2 className="w-4 h-4 text-accent" />;
      case 'running': return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-destructive" />;
      default: return <Clock className="w-4 h-4 text-muted-foreground/40" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="glass-card w-full max-w-md mx-4 p-6 space-y-5">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl btn-gradient mx-auto flex items-center justify-center">
            <Loader2 className={`w-6 h-6 text-white ${status === 'completed' ? '' : 'animate-spin'}`} />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            {status === 'completed' ? 'Анализ завершён!' : status === 'failed' ? 'Ошибка анализа' : 'Анализ страницы...'}
          </h2>
          <p className="text-xs text-muted-foreground truncate max-w-[300px] mx-auto">{url}</p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{completedCount} / {stages.length} модулей</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Stages list */}
        <div className="space-y-1">
          {stages.map((stage, i) => (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                stage.status === 'running' ? 'bg-primary/5 border border-primary/20' :
                stage.status === 'done' ? 'bg-accent/5' :
                stage.status === 'error' ? 'bg-destructive/5' :
                ''
              }`}
            >
              <div className="flex items-center gap-2.5">
                {statusIcon(stage.status)}
                <span className={`text-sm ${
                  stage.status === 'done' ? 'text-foreground' :
                  stage.status === 'running' ? 'text-foreground font-medium' :
                  stage.status === 'error' ? 'text-destructive' :
                  'text-muted-foreground/50'
                }`}>
                  {stage.name}
                </span>
              </div>
              {stage.time && (
                <span className="text-xs text-muted-foreground">{stage.time}</span>
              )}
            </div>
          ))}
        </div>

        {/* Status message */}
        {status === 'failed' && (
          <p className="text-sm text-destructive text-center">Произошла ошибка. Попробуйте ещё раз.</p>
        )}
      </div>
    </div>
  );
}
