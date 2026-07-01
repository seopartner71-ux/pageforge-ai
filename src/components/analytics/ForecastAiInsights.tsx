import { useState } from 'react';
import { Sparkles, Loader2, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ForecastProjectContext {
  domain?: string;
  clientName?: string;
  niche?: string;
  region?: string;
  siteStatus?: string;
  horizon?: number;
  plannedWorks?: string[];
  articlesPerMonth?: number;
  competition?: string;
  currentTraffic?: string;
  baseYandex?: number;
  baseGoogle?: number;
  gscImpressions?: number;
  gscClicks?: number;
  gscCtr?: number;
  gscAvgPosition?: number;
  gscImpressionsPos23?: number;
  topvisorTotal?: number;
  topvisorTop10?: number;
  topvisorMissing?: number;
  allPositionsMissing?: boolean;
  forecastBaseYandexFinal?: number;
  forecastBaseGoogleFinal?: number;
  forecastBaseTotalFinal?: number;
  forecastGrowthMultiplier?: number;
}

export interface AIForecastInsights {
  nicheAnalysis?: string;
  startingPoint?: string;
  growthPoints?: string[];
  monthByMonth?: string[];
  risks?: string[];
  conditions?: string[];
  summary?: string;
}

interface Props {
  context: ForecastProjectContext;
  value: AIForecastInsights | null;
  onChange: (v: AIForecastInsights | null) => void;
}

export function ForecastAiInsights({ context, value, onChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  async function handleGenerate() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('forecast-ai-insights', { body: context });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      onChange((data as any).insights as AIForecastInsights);
      toast.success('AI-анализ готов');
    } catch (e: any) {
      toast.error('Не удалось получить AI-анализ: ' + (e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  }

  if (loading && !value) {
    return (
      <Card className="p-8 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <div className="text-sm font-medium">Claude анализирует проект…</div>
        <div className="text-xs text-muted-foreground">Обычно 10–20 секунд</div>
      </Card>
    );
  }

  if (!value) {
    return (
      <Card className="p-6 border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="font-semibold text-sm">AI-анализ проекта</div>
            <p className="text-xs text-muted-foreground">
              Claude проанализирует нишу, ваши данные и сгенерирует уникальные инсайты, точки роста, риски и разбор по месяцам — всё это войдёт в Word-отчёт.
            </p>
            <Button onClick={handleGenerate} disabled={loading} className="gap-2 mt-2">
              <Sparkles className="w-4 h-4" /> Сгенерировать AI-анализ
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-primary/10 to-transparent border-b border-border hover:bg-primary/15 transition"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">AI-анализ проекта</span>
          <Badge variant="secondary" className="text-[10px] h-5">Claude</Badge>
        </div>
        <div className="flex items-center gap-2">
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => { e.stopPropagation(); handleGenerate(); }}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Перегенерировать
          </span>
          {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {expanded && (
        <div className="p-5 space-y-5 text-sm">
          {value.nicheAnalysis && (
            <Section title="Анализ ниши"><p className="whitespace-pre-wrap leading-relaxed">{value.nicheAnalysis}</p></Section>
          )}
          {value.startingPoint && (
            <Section title="Оценка стартовой точки"><p className="whitespace-pre-wrap leading-relaxed">{value.startingPoint}</p></Section>
          )}
          {value.growthPoints?.length ? (
            <Section title="Точки роста">
              <ol className="space-y-2">
                {value.growthPoints.map((pt, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary font-semibold shrink-0">{i + 1}.</span><span className="leading-relaxed">{pt}</span></li>
                ))}
              </ol>
            </Section>
          ) : null}
          {value.monthByMonth?.length ? (
            <Section title="Что происходит по месяцам">
              <ul className="space-y-1.5">
                {value.monthByMonth.map((m, i) => (
                  <li key={i} className="flex gap-2"><span className="text-muted-foreground shrink-0">—</span><span className="leading-relaxed">{m}</span></li>
                ))}
              </ul>
            </Section>
          ) : null}
          {value.risks?.length ? (
            <Section title="Риски">
              <ul className="space-y-1.5">
                {value.risks.map((r, i) => (
                  <li key={i} className="flex gap-2"><span className="text-yellow-600 shrink-0">⚠</span><span className="leading-relaxed">{r}</span></li>
                ))}
              </ul>
            </Section>
          ) : null}
          {value.conditions?.length ? (
            <Section title="Условия достижения прогноза">
              <ul className="space-y-1.5">
                {value.conditions.map((c, i) => (
                  <li key={i} className="flex gap-2"><span className="text-green-600 shrink-0">✓</span><span className="leading-relaxed">{c}</span></li>
                ))}
              </ul>
            </Section>
          ) : null}
          {value.summary && (
            <Section title="Резюме">
              <p className="whitespace-pre-wrap leading-relaxed font-medium bg-primary/5 border border-primary/20 rounded-md p-3">{value.summary}</p>
            </Section>
          )}
        </div>
      )}
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div>
      <div className="text-foreground">{children}</div>
    </div>
  );
}