import { useState, useMemo } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Play, CheckCircle2, AlertTriangle, XCircle, ChevronDown, ChevronUp,
  Bot, Search, FileCode2, BookOpen, ShieldCheck, Loader2, Target, Zap, Clock,
} from 'lucide-react';

/* ─── Types ─── */
interface CheckItem {
  id: string;
  label: string;
  status: 'pass' | 'warn' | 'fail';
  detail: string;
}

interface StageResult {
  id: string;
  title: string;
  score: number;
  items: CheckItem[];
}

interface AuditResult {
  geoScore: number;
  stages: StageResult[];
  criticals: string[];
  strategy: string[];
}

/* ─── Icon map for stages ─── */
const stageIcons: Record<string, React.ElementType> = {
  stage1: Bot,
  stage2: Search,
  stage3: FileCode2,
  stage4: BookOpen,
  stage5: ShieldCheck,
};

const stageColors: Record<string, string> = {
  stage1: 'hsl(var(--primary))',
  stage2: '#60A5FA',
  stage3: '#34D399',
  stage4: '#FBBF24',
  stage5: '#A78BFA',
};

/* ─── Status icon ─── */
function StatusIcon({ status }: { status: string }) {
  if (status === 'pass') return <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />;
  if (status === 'warn') return <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0" />;
  if (status === 'fail') return <XCircle className="w-4 h-4 text-red-500 shrink-0" />;
  return <div className="w-4 h-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />;
}

/* ─── Score Ring ─── */
function ScoreRing({ score, size = 120, strokeWidth = 8, color = 'hsl(var(--primary))' }: { score: number; size?: number; strokeWidth?: number; color?: string }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--border))" strokeWidth={strokeWidth} opacity={0.3} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" className="transition-all duration-1000" />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" className="fill-foreground rotate-90 origin-center" style={{ fontSize: size * 0.3, fontWeight: 700 }}>
        {score}
      </text>
    </svg>
  );
}

/* ─── Stage Card ─── */
function StageCard({ stage }: { stage: StageResult }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = stageIcons[stage.id] || Bot;
  const color = stageColors[stage.id] || 'hsl(var(--primary))';
  const passCount = stage.items.filter(i => i.status === 'pass').length;
  const warnCount = stage.items.filter(i => i.status === 'warn').length;
  const failCount = stage.items.filter(i => i.status === 'fail').length;

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className="shrink-0">
          <ScoreRing score={stage.score} size={56} strokeWidth={5} color={color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Icon className="w-4 h-4 shrink-0" style={{ color }} />
            <h3 className="text-sm font-semibold text-foreground truncate">{stage.title}</h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-green-500" />{passCount}</span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-yellow-500" />{warnCount}</span>
            <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-red-500" />{failCount}</span>
          </div>
        </div>
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 divide-y divide-border/30">
          {stage.items.map((item, i) => (
            <div key={item.id || i} className="flex items-start gap-3 px-6 py-3.5 hover:bg-secondary/20 transition-colors">
              <div className="mt-0.5">
                <StatusIcon status={item.status} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{item.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.detail}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] shrink-0 mt-0.5 ${
                  item.status === 'pass' ? 'border-green-500/40 text-green-500' :
                  item.status === 'warn' ? 'border-yellow-500/40 text-yellow-500' :
                  'border-red-500/40 text-red-500'
                }`}
              >
                {item.status === 'pass' ? 'OK' : item.status === 'warn' ? 'Внимание' : 'Ошибка'}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Progress steps ─── */
const PROGRESS_STEPS = [
  'Загрузка страницы...',
  'Проверка robots.txt и sitemap...',
  'Анализ структуры HTML...',
  'Проверка Schema.org разметки...',
  'Анализ контента и E-E-A-T...',
  'Формирование рекомендаций...',
];

/* ─── Main Page ─── */
export default function GeoAuditPage() {
  const [url, setUrl] = useState('');
  const [running, setRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [result, setResult] = useState<AuditResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleRun = async () => {
    if (!url.trim()) return;
    setRunning(true);
    setResult(null);
    setError(null);
    setProgressStep(0);

    // Animate progress
    const interval = setInterval(() => {
      setProgressStep(prev => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 3000);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('geo-audit', {
        body: { url: url.trim() },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);

      setResult(data as AuditResult);
    } catch (err: any) {
      const msg = err?.message || 'Ошибка при выполнении аудита';
      setError(msg);
      toast({ title: 'Ошибка GEO Audit', description: msg, variant: 'destructive' });
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  };

  const scoreColor = useMemo(() => {
    if (!result) return 'hsl(var(--primary))';
    if (result.geoScore >= 80) return '#34D399';
    if (result.geoScore >= 60) return '#FBBF24';
    return '#EF4444';
  }, [result]);

  const totalChecks = result ? result.stages.reduce((s, st) => s + st.items.length, 0) : 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container max-w-[960px] py-10 space-y-10">
        {/* Hero */}
        <div className="text-center space-y-3">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            GEO Audit v2.0 — Полный чек-лист AI Optimization
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            5 этапов глубокого аудита: техническая доступность для ИИ, структура, контент, E-E-A-T и репутация бренда.
          </p>
        </div>

        {/* Input */}
        <div className="flex gap-3 max-w-xl mx-auto">
          <Input
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="h-11 text-sm bg-card border-border/60"
            onKeyDown={e => e.key === 'Enter' && handleRun()}
          />
          <Button
            onClick={handleRun}
            disabled={running || !url.trim()}
            className="h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2 shrink-0"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Анализ...' : 'Запустить полный GEO Audit'}
          </Button>
        </div>

        {/* Loading */}
        {running && (
          <div className="flex flex-col items-center gap-6 py-12">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">Выполняется глубокий GEO Audit</p>
              <p className="text-xs text-muted-foreground">{PROGRESS_STEPS[progressStep]}</p>
            </div>
            <div className="w-64 space-y-2">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-opacity duration-300 ${i <= progressStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < progressStep ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                  ) : i === progressStep ? (
                    <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />
                  )}
                  <span className="text-muted-foreground">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && !running && (
          <div className="rounded-xl border border-red-500/30 bg-card p-6 text-center">
            <XCircle className="w-8 h-8 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Не удалось выполнить аудит</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Results */}
        {result && !running && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Overall Score */}
            <div className="rounded-xl border border-border/60 bg-card p-8 flex flex-col md:flex-row items-center gap-8">
              <ScoreRing score={result.geoScore} size={140} strokeWidth={10} color={scoreColor} />
              <div className="flex-1 text-center md:text-left">
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Общий GEO Score</p>
                <p className="text-3xl font-bold text-foreground">{result.geoScore}<span className="text-lg text-muted-foreground font-normal"> / 100</span></p>
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {result.geoScore >= 80 ? 'Отличная оптимизация для AI-поисковиков.' :
                   result.geoScore >= 60 ? 'Есть потенциал для улучшения. Исправьте критические проблемы.' :
                   'Требуется серьёзная доработка для AI-видимости.'}
                </p>
                <div className="flex items-center gap-4 mt-4 justify-center md:justify-start text-xs text-muted-foreground">
                  <span>{totalChecks} проверок</span>
                  <span>•</span>
                  <span>{result.stages.flatMap(s => s.items).filter(i => i.status === 'pass').length} пройдено</span>
                  <span>•</span>
                  <span>{result.stages.flatMap(s => s.items).filter(i => i.status === 'fail').length} ошибок</span>
                </div>
                <div className="flex items-center gap-4 mt-3 justify-center md:justify-start">
                  {result.stages.map(s => (
                    <div key={s.id} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: stageColors[s.id] || 'hsl(var(--primary))' }} />
                      <span className="text-xs text-muted-foreground">{s.score}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stages */}
            <div className="space-y-4">
              {result.stages.map(stage => (
                <StageCard key={stage.id} stage={stage} />
              ))}
            </div>

            {/* Criticals */}
            {result.criticals.length > 0 && (
              <div className="rounded-xl border border-red-500/20 bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Target className="w-5 h-5 text-red-500" />
                  <h2 className="text-base font-semibold text-foreground">Критические рекомендации</h2>
                </div>
                <div className="space-y-3">
                  {result.criticals.map((c, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 w-5 h-5 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-red-500">{i + 1}</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{c}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strategy */}
            {result.strategy.length > 0 && (
              <div className="rounded-xl border border-primary/20 bg-card p-6 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Стратегия улучшения — 30–60 дней</h2>
                </div>
                <div className="space-y-3">
                  {result.strategy.map((s, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-1 shrink-0">
                        <Clock className="w-4 h-4 text-primary/60" />
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
