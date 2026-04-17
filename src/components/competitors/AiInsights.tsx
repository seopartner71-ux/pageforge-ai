import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2 } from 'lucide-react';
import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props { rows: CompetitorRow[] }

export function AiInsights({ rows }: Props) {
  const [loading, setLoading] = useState(false);
  const [markdown, setMarkdown] = useState<string | null>(null);

  const fetchInsights = async () => {
    if (rows.length === 0) return;
    setLoading(true);
    setMarkdown(null);
    try {
      const { data, error } = await supabase.functions.invoke('competitors-insights', {
        body: { competitors: rows },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const md = (data as any)?.markdown;
      if (!md) throw new Error('Пустой ответ AI');
      setMarkdown(md);
    } catch (e: any) {
      toast.error(`Ошибка AI-анализа: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            AI-анализ конкурентов
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Автоматические выводы по лидерам, слабым местам и точкам роста.
          </p>
        </div>
        <Button onClick={fetchInsights} disabled={loading || rows.length === 0} size="sm">
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Анализирую...</>
          ) : (
            'Получить AI-анализ'
          )}
        </Button>
      </div>

      {markdown && (
        <div className="prose prose-sm dark:prose-invert max-w-none mt-4 text-sm">
          <ReactMarkdown>{markdown}</ReactMarkdown>
        </div>
      )}
      {!markdown && !loading && (
        <div className="text-xs text-muted-foreground italic mt-4">
          Нажмите «Получить AI-анализ», чтобы увидеть выводы по загруженным данным.
        </div>
      )}
    </Card>
  );
}
