import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Network, Loader2, Check, Search, Download, Tag, X, Plus,
  AlertTriangle, LayoutGrid, Table as TableIcon, Sparkles, Info, ChevronDown, DollarSign, Star,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getFrequencies, isWordstatRealMode } from '@/services/wordstatService';
import {
  classifyIntentByKeyword, INTENT_BADGE, INTENT_WEIGHT, REGION_GROUPS,
  type IntentKind, type SemanticCluster, type SemanticCorePayload, type SemanticKeyword,
} from '@/lib/semanticCore/types';
import { exportSemanticCoreXlsx } from '@/lib/semanticCore/exportSemanticCoreXlsx';
import { exportGoldenKeywordsXlsx } from '@/lib/semanticCore/exportGoldenKeywords';
import { exportSeoRecommendationsDocx } from '@/lib/semanticCore/exportSeoRecommendationsDocx';

type Step = 'expand' | 'wordstat' | 'serp' | 'cluster';
const STEP_LABELS: Record<Step, string> = {
  expand: 'Собираем ключи из источников (DataForSEO + AI)...',
  wordstat: 'Получаем частоты...',
  serp: 'Анализируем выдачу...',
  cluster: 'Кластеризуем...',
};

type SourceKey = 'autocomplete' | 'suggestions' | 'competitors' | 'ai';
const SOURCE_LABELS: Record<SourceKey, { title: string; desc: string }> = {
  autocomplete: { title: 'Подсказки поисковиков', desc: 'Автоподсказки Google/Yandex (DataForSEO)' },
  suggestions:  { title: 'База ключевых слов',     desc: 'Семантически близкие запросы (DataForSEO)' },
  competitors:  { title: 'Ключи конкурентов',      desc: 'Топ-3 домена из выдачи (DataForSEO)' },
  ai:           { title: 'AI-генерация',           desc: 'Длинные хвосты, вопросные, сезонные (Gemini)' },
};

type JobStatus = 'pending' | 'expanding' | 'frequencies' | 'serp' | 'clustering' | 'done' | 'error';

function statusToStepStatus(status: JobStatus): Record<Step, 'idle' | 'active' | 'done'> {
  const order: Record<Step, number> = { expand: 0, wordstat: 1, serp: 2, cluster: 3 };
  let activeIdx = 0;
  switch (status) {
    case 'pending':
    case 'expanding': activeIdx = 0; break;
    case 'frequencies': activeIdx = 1; break;
    case 'serp': activeIdx = 2; break;
    case 'clustering': activeIdx = 3; break;
    case 'done': activeIdx = 4; break;
    default: activeIdx = 0;
  }
  const out: Record<Step, 'idle' | 'active' | 'done'> = {
    expand: 'idle', wordstat: 'idle', serp: 'idle', cluster: 'idle',
  };
  for (const s of Object.keys(order) as Step[]) {
    const i = order[s];
    if (i < activeIdx) out[s] = 'done';
    else if (i === activeIdx) out[s] = 'active';
  }
  return out;
}

function intentTypeForCluster(items: SemanticKeyword[]): SemanticCluster['type'] {
  const c = items.filter(i => i.intent === 'commercial' || i.intent === 'transac').length;
  const inf = items.filter(i => i.intent === 'info').length;
  const total = items.length || 1;
  if (c / total > 0.7) return 'COMMERCIAL';
  if (inf / total > 0.7) return 'INFORMATIONAL';
  return 'MIXED';
}

const INTENT_LABELS: Record<string, string> = {
  info: 'Информационный',
  commercial: 'Коммерческий',
  nav: 'Навигационный',
  transac: 'Транзакционный',
};

type KdBucket = 'easy' | 'medium' | 'hard' | 'veryhard' | 'none';
function kdBucket(kd: number | null | undefined): KdBucket {
  if (kd == null || Number.isNaN(kd)) return 'none';
  if (kd <= 30) return 'easy';
  if (kd <= 60) return 'medium';
  if (kd <= 80) return 'hard';
  return 'veryhard';
}
const KD_LABELS: Record<KdBucket, string> = {
  easy: 'Низкая',
  medium: 'Средняя',
  hard: 'Высокая',
  veryhard: 'Очень высокая',
  none: '—',
};
const KD_BADGE: Record<KdBucket, string> = {
  easy: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
  hard: 'bg-orange-500/15 text-orange-400 border border-orange-500/30',
  veryhard: 'bg-red-500/15 text-red-400 border border-red-500/30',
  none: 'bg-secondary text-muted-foreground border border-border',
};
function KdBadge({ kd }: { kd: number | null | undefined }) {
  const b = kdBucket(kd);
  if (kd == null || Number.isNaN(kd as number)) {
    return (
      <span
        className="inline-flex items-center px-1.5 text-xs text-muted-foreground/60 tabular-nums"
        title="Конкуренция в Google Ads неизвестна"
      >
        —
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium ${KD_BADGE[b]}`}
      title={`Google Ads competition index = ${kd} (0–100). Это конкуренция в контекстной рекламе (PPC), а не SEO Keyword Difficulty.`}
    >
      <span>{KD_LABELS[b]}</span>
      <span className="tabular-nums opacity-80">{kd}</span>
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
        <div className={`h-full ${color} transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs tabular-nums w-7 text-right">{score}</span>
    </div>
  );
}

function MockBadge() {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-500 border border-yellow-500/40 ml-1.5 align-middle">
      MOCK
    </span>
  );
}

function FreqDot({ source }: { source?: 'mock' | 'dataforseo' | 'topvisor' }) {
  const real = source === 'dataforseo' || source === 'topvisor';
  const title =
    source === 'topvisor'
      ? 'Реальные данные Яндекс Wordstat (Topvisor)'
      : source === 'dataforseo'
        ? 'Реальные данные DataForSEO'
        : 'Оценочные данные';
  return (
    <span
      className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${real ? 'bg-emerald-500' : 'bg-muted-foreground/40'}`}
      title={title}
    />
  );
}

// "Золотой" запрос — органический трафик через SEO-статьи (long-tail info).
// Условия (все обязательны):
// 1. intent === 'info' (коммерческие убираем — там платная реклама давит)
// 2. wsFrequency 1000-60000 (меньше — нет трафика, больше — монстры)
// 3. ≥3 слов в запросе (long-tail = ниже конкуренция)
// 4. Без агрегаторов-монстров
// 5. score > 60
// 6. Без года (устаревают)
const GOLDEN_STOP_WORDS = [
  'авито', 'яндекс', 'озон', 'ozon', 'сбер',
  'wildberries', 'вайлдберриз', 'aliexpress', 'алиэкспресс',
  'маркет', 'дром', 'auto.ru',
];
const YEAR_RX = /\b(201[0-9]|202[0-9])\b/;

export type GoldenTier = 'easy' | 'medium' | 'hard';

export function isGoldenKeyword(k: SemanticKeyword): boolean {
  if (k.intent !== 'info') return false;
  if ((k.score ?? 0) <= 60) return false;
  const ws = k.wsFrequency ?? 0;
  if (ws < 1000 || ws > 60000) return false;
  const kw = (k.keyword || '').trim();
  if (!kw) return false;
  if (kw.split(/\s+/).filter(Boolean).length < 3) return false;
  if (YEAR_RX.test(kw)) return false;
  const lower = kw.toLowerCase();
  if (GOLDEN_STOP_WORDS.some(b => lower.includes(b))) return false;
  return true;
}

export function goldenTier(k: SemanticKeyword): GoldenTier | null {
  if (!isGoldenKeyword(k)) return null;
  const ws = k.wsFrequency ?? 0;
  const score = k.score ?? 0;
  if (ws >= 1000 && ws < 5000 && score > 70) return 'easy';
  if (ws >= 5000 && ws < 20000 && score > 65) return 'medium';
  if (ws >= 20000 && ws <= 60000 && score > 60) return 'hard';
  // Попадает в golden, но между tier'ами — выбираем по частоте
  if (ws < 5000) return 'easy';
  if (ws < 20000) return 'medium';
  return 'hard';
}

const TIER_META: Record<GoldenTier, { label: string; emoji: string; star: string; badge: string }> = {
  easy:   { label: 'Легко',  emoji: '🟢', star: 'fill-emerald-400 text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' },
  medium: { label: 'Средне', emoji: '🟡', star: 'fill-amber-400 text-amber-400',     badge: 'bg-amber-500/15 text-amber-300 border-amber-500/40' },
  hard:   { label: 'Сложно', emoji: '🟠', star: 'fill-orange-500 text-orange-500',   badge: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
};

function tierTooltip(tier: GoldenTier): string {
  if (tier === 'easy')   return 'Легко взять топ — мало конкурентов';
  if (tier === 'medium') return 'Средние усилия — нужна качественная статья';
  return 'Сложно — нужна экспертная статья и время';
}

// Грамматически правильное склонение для «идеальный запрос»
function idealLabel(n: number): string {
  if (n === 1) return 'Найден 1 идеальный запрос';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `Найдено ${n} идеальных запроса`;
  }
  return `Найдено ${n} идеальных запросов`;
}
const GOLDEN_TOOLTIP =
  'Информационные запросы для SEO-статей — пишите экспертный контент и получайте органический трафик';

export default function SemanticCorePage() {
  const [topic, setTopic] = useState('');
  const [seeds, setSeeds] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [stopWordsText, setStopWordsText] = useState('');
  const [region, setRegion] = useState('Москва');
  const [engine, setEngine] = useState<'yandex' | 'google'>('yandex');
  const [enabledSources, setEnabledSources] = useState<Record<SourceKey, boolean>>({
    autocomplete: true, suggestions: true, competitors: true, ai: true,
  });
  const [dfsConfigured, setDfsConfigured] = useState<boolean | null>(null);

  const [running, setRunning] = useState(false);
  const [stepStatus, setStepStatus] = useState<Record<Step, 'idle' | 'active' | 'done'>>({
    expand: 'idle', wordstat: 'idle', serp: 'idle', cluster: 'idle',
  });

  const [keywords, setKeywords] = useState<SemanticKeyword[]>([]);
  const [clusters, setClusters] = useState<SemanticCluster[]>([]);
  const [coreId, setCoreId] = useState<string | null>(null);
  const [clusterMethod, setClusterMethod] = useState<string | null>(null);

  const [view, setView] = useState<'table' | 'clusters'>('table');
  const [search, setSearch] = useState('');
  const [intentFilter, setIntentFilter] = useState<Set<IntentKind>>(new Set());
  const [clusterFilter, setClusterFilter] = useState<Set<string>>(new Set());
  const [kdFilter, setKdFilter] = useState<Set<KdBucket>>(new Set());
  const [idealOnly, setIdealOnly] = useState(false);
  const [goldenOnly, setGoldenOnly] = useState(false);
  const [sortKey, setSortKey] = useState<'score' | 'wsFrequency' | 'exactFrequency' | 'keyword'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [wordstatReal, setWordstatReal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [jobId, setJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState(0);
  const [jobLiveCounts, setJobLiveCounts] = useState<{ keywords: number; clusters: number }>({ keywords: 0, clusters: 0 });
  const [dailyUsage, setDailyUsage] = useState<{ used: number; limit: number } | null>(null);
  const [sourceBreakdown, setSourceBreakdown] = useState<Record<string, number>>({});
  const [dataforseoCost, setDataforseoCost] = useState<number>(0);
  const pollRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  const [howItWorksOpen, setHowItWorksOpen] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('semanticCore_howItWorks_expanded') === '1';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('semanticCore_howItWorks_expanded', howItWorksOpen ? '1' : '0');
    }
  }, [howItWorksOpen]);

  useEffect(() => {
    isWordstatRealMode().then(setWordstatReal);
  }, [running]);

  // Detect whether DataForSEO secrets are configured (best-effort via test endpoint).
  // Falls back silently if user is not admin — we just show the warning badge.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke('dataforseo-test', { body: {} });
        if (cancelled) return;
        const conf = (data as any)?.configured;
        if (typeof conf === 'boolean') setDfsConfigured(conf);
      } catch {
        // 403 for non-admins — silently leave as null
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Load daily quota
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) return;
      // Admins → no limits
      const { data: isAdminData } = await supabase.rpc('has_role', {
        _user_id: u.user.id,
        _role: 'admin' as any,
      });
      if (isAdminData) {
        setDailyUsage({ used: 0, limit: -1 });
        return;
      }
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from('semantic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.user.id)
        .gte('created_at', since);
      setDailyUsage({ used: count || 0, limit: 50 });
    })();
  }, [running]);

  // Cleanup polling on unmount
  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
    if (pollTimeoutRef.current) window.clearTimeout(pollTimeoutRef.current);
  }, []);

  const addSeed = () => {
    const v = seedInput.trim();
    if (!v || seeds.length >= 20) return;
    if (seeds.includes(v)) { setSeedInput(''); return; }
    setSeeds([...seeds, v]);
    setSeedInput('');
  };
  const removeSeed = (s: string) => setSeeds(seeds.filter(x => x !== s));

  const setStep = (step: Step, status: 'active' | 'done') =>
    setStepStatus(prev => ({ ...prev, [step]: status }));

  const fetchJobResults = async (id: string) => {
    const [{ data: kwRows }, { data: clRows }] = await Promise.all([
      supabase.from('semantic_keywords').select('*').eq('job_id', id).order('score', { ascending: false }),
      supabase.from('semantic_clusters').select('*').eq('job_id', id).order('avg_score', { ascending: false }),
    ]);
    const kws: SemanticKeyword[] = (kwRows || []).map((r: any) => ({
      keyword: r.keyword,
      wsFrequency: r.ws_frequency,
      exactFrequency: r.exact_frequency,
      intent: r.intent as IntentKind,
      score: r.score,
      cluster: r.cluster_id != null ? `c${r.cluster_id}` : 'unclustered',
      included: r.included,
      topUrls: r.serp_urls || [],
      dataSource:
        r.data_source === 'dataforseo'
          ? 'dataforseo'
          : r.data_source === 'topvisor'
            ? 'topvisor'
            : 'mock',
      keywordDifficulty: r.keyword_difficulty == null ? null : Number(r.keyword_difficulty),
    }));
    const cls: SemanticCluster[] = (clRows || []).map((r: any) => {
      const items = kws.filter(k => k.cluster === `c${r.cluster_index}`);
      return {
        id: `c${r.cluster_index}`,
        name: r.name,
        type: r.type === 'commercial' ? 'COMMERCIAL' : r.type === 'informational' ? 'INFORMATIONAL' : 'MIXED',
        keywords: items.map(i => i.keyword),
        totalQueries: items.length,
      };
    });
    setKeywords(kws);
    setClusters(cls);
  };

  const stopPolling = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
    if (pollTimeoutRef.current) { window.clearTimeout(pollTimeoutRef.current); pollTimeoutRef.current = null; }
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const { data: job, error } = await supabase
        .from('semantic_jobs')
        .select('status, progress, keyword_count, cluster_count, error_message, source_breakdown, dataforseo_cost')
        .eq('id', id)
        .maybeSingle();
      if (error || !job) return;
      const status = job.status as JobStatus;
      setStepStatus(statusToStepStatus(status));
      setJobProgress(job.progress || 0);
      setJobLiveCounts({ keywords: job.keyword_count || 0, clusters: job.cluster_count || 0 });
      if (job.source_breakdown && typeof job.source_breakdown === 'object') {
        setSourceBreakdown(job.source_breakdown as Record<string, number>);
      }
      if (typeof job.dataforseo_cost === 'number') {
        setDataforseoCost(job.dataforseo_cost);
      } else if (job.dataforseo_cost) {
        setDataforseoCost(Number(job.dataforseo_cost) || 0);
      }

      if (status === 'done') {
        stopPolling();
        await fetchJobResults(id);
        setRunning(false);
        toast.success(`Готово: ${job.keyword_count} запросов в ${job.cluster_count} кластерах`);
      } else if (status === 'error') {
        stopPolling();
        setRunning(false);
        toast.error(`Ошибка: ${job.error_message || 'неизвестная'}`);
      }
    }, 3000);
    pollTimeoutRef.current = window.setTimeout(() => {
      stopPolling();
      setRunning(false);
      toast.error('Таймаут анализа (10 минут). Проверьте задачу позже.');
    }, 600000);
  };

  const runGenerate = async () => {
    if (!topic.trim()) {
      toast.error('Введите тему');
      return;
    }
    const selectedSources = (Object.keys(enabledSources) as SourceKey[]).filter((k) => enabledSources[k]);
    if (!selectedSources.length) {
      toast.error('Выберите хотя бы один источник');
      return;
    }
    setRunning(true);
    setKeywords([]); setClusters([]); setCoreId(null); setJobId(null);
    setJobProgress(0);
    setJobLiveCounts({ keywords: 0, clusters: 0 });
    setSourceBreakdown({});
    setDataforseoCost(0);
    setStepStatus({ expand: 'active', wordstat: 'idle', serp: 'idle', cluster: 'idle' });

    try {
      // Ensure fresh session token before invoking edge function
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Сессия истекла, войдите снова');
        setRunning(false);
        return;
      }
      const stop_words = stopWordsText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 100);
      const { data, error } = await supabase.functions.invoke('semantic-core-start', {
        body: { topic, seeds, region, engine, enabled_sources: selectedSources, stop_words },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const id = (data as any)?.job_id as string;
      if (!id) throw new Error('Не получен job_id');
      setJobId(id);
      const isAdmin = !!(data as any)?.is_admin;
      if (isAdmin) {
        setDailyUsage({ used: 0, limit: -1 }); // -1 → "без лимита"
      } else if (typeof (data as any)?.daily_used === 'number') {
        setDailyUsage({ used: (data as any).daily_used, limit: (data as any).daily_limit || 50 });
      }
      startPolling(id);
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(`Ошибка запуска: ${msg}`);
      setRunning(false);
    }
  };

  const filtered = useMemo(() => {
    let arr = keywords;
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(k => k.keyword.includes(q));
    }
    if (intentFilter.size) arr = arr.filter(k => intentFilter.has(k.intent));
    if (clusterFilter.size) arr = arr.filter(k => clusterFilter.has(k.cluster));
    if (kdFilter.size) arr = arr.filter(k => kdFilter.has(kdBucket(k.keywordDifficulty)));
    if (idealOnly) {
      arr = arr.filter(k =>
        k.score > 70 && k.keywordDifficulty != null && k.keywordDifficulty < 40,
      );
    }
    if (goldenOnly) arr = arr.filter(isGoldenKeyword);
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av - bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    console.log('[filtered debug]', {
      arrLen: arr.length,
      kwLen: keywords.length,
      idealOnly,
      goldenOnly,
      search,
      intentFilter: intentFilter.size,
      clusterFilter: clusterFilter.size,
      kdFilter: kdFilter.size,
      sample: keywords.slice(0, 2),
    });
    return arr;
  }, [keywords, search, intentFilter, clusterFilter, kdFilter, idealOnly, goldenOnly, sortKey, sortDir]);

  const idealCount = useMemo(
    () => keywords.filter(k => k.score > 70 && k.keywordDifficulty != null && k.keywordDifficulty < 40).length,
    [keywords],
  );

  const goldenCount = useMemo(
    () => keywords.filter(isGoldenKeyword).length,
    [keywords],
  );

  // Авто-сброс фильтра «только золотые», если в текущем ядре нет ни одного золотого
  // запроса — чтобы пользователь не видел пустую таблицу.
  useEffect(() => {
    if (goldenOnly && keywords.length > 0 && goldenCount === 0) {
      setGoldenOnly(false);
    }
  }, [goldenOnly, goldenCount, keywords.length]);

  const clusterMap = useMemo(() => new Map(clusters.map(c => [c.id, c])), [clusters]);

  const toggleSet = <T,>(set: Set<T>, val: T): Set<T> => {
    const next = new Set(set);
    if (next.has(val)) next.delete(val); else next.add(val);
    return next;
  };
  const toggleIncluded = (kw: string) => {
    setKeywords(prev => prev.map(k => k.keyword === kw ? { ...k, included: !k.included } : k));
  };
  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const handleExport = () => {
    if (!keywords.length) return;
    exportSemanticCoreXlsx({
      topic, seedKeywords: seeds, region, searchEngine: engine,
      keywords, clusters, wordstatMode: wordstatReal ? 'real' : 'mock',
      generatedAt: new Date().toISOString(),
    });
  };

  const buildPayload = () => ({
    topic, seedKeywords: seeds, region, searchEngine: engine,
    keywords, clusters, wordstatMode: (wordstatReal ? 'real' : 'mock') as 'real' | 'mock',
    generatedAt: new Date().toISOString(),
  });

  const handleExportGolden = () => {
    const n = exportGoldenKeywordsXlsx(buildPayload());
    if (n === 0) toast.error('Золотых запросов не найдено');
    else toast.success(`Экспортировано ${n} золотых запросов`);
  };

  const handleDownloadSeoRecommendations = () => {
    const n = exportSeoRecommendationsDocx(buildPayload());
    if (n === 0) toast.error('Золотых запросов не найдено — рекомендации создавать не для чего');
    else toast.success('Рекомендации SEO скачаны');
  };

  const allIntents: IntentKind[] = ['info', 'commercial', 'nav', 'transac'];
  const hasResults = keywords.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Network className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-semibold">Семантическое ядро</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              AI-сборка ядра + кластеризация по интенту и пересечению выдачи
            </p>
          </div>
        </div>

        {/* INPUT PANEL */}
        <Card className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Тема или ключевые слова</label>
            <Textarea
              ref={textareaRef}
              id="sc-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="например: купить диван в москве"
              className="min-h-[80px] text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5" /> Дополнительные seed-ключи
              <span className="text-xs text-muted-foreground font-normal">({seeds.length}/20)</span>
            </label>
            <div className="flex gap-2">
              <Input
                value={seedInput}
                onChange={(e) => setSeedInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addSeed(); }
                }}
                placeholder="введите ключ и нажмите Enter"
                disabled={seeds.length >= 20}
                className="text-sm"
              />
              <Button type="button" variant="outline" size="sm" onClick={addSeed} disabled={!seedInput.trim() || seeds.length >= 20}>
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
            {seeds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {seeds.map(s => (
                  <span key={s} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-secondary text-xs">
                    {s}
                    <button onClick={() => removeSeed(s)} className="hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block flex items-center gap-1.5">
              <X className="w-3.5 h-3.5" /> Стоп-слова
            </label>
            <Textarea
              value={stopWordsText}
              onChange={(e) => setStopWordsText(e.target.value.slice(0, 2000))}
              placeholder="авито, яндекс, дром, бесплатно..."
              className="min-h-[64px] text-sm"
              maxLength={2000}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ключевые слова содержащие эти слова будут исключены
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Регион</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
              >
                {REGION_GROUPS.map(g => (
                  <optgroup key={g.label} label={g.label}>
                    {g.regions.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Поисковая система</label>
              <div className="inline-flex rounded-md border border-input p-0.5">
                <button
                  onClick={() => setEngine('yandex')}
                  className={`px-4 h-9 text-sm rounded ${engine === 'yandex' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >Яндекс</button>
                <button
                  onClick={() => setEngine('google')}
                  className={`px-4 h-9 text-sm rounded ${engine === 'google' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                >Google</button>
              </div>
            </div>
          </div>

          {/* SOURCES */}
          <div className="rounded-md border border-border/60 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Источники сбора ключей</label>
              <span className="text-[11px] text-muted-foreground">
                Выбрано: {(Object.values(enabledSources) as boolean[]).filter(Boolean).length}/4
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
              {(Object.keys(SOURCE_LABELS) as SourceKey[]).map((k) => {
                const meta = SOURCE_LABELS[k];
                const checked = enabledSources[k];
                const requiresDfs = k !== 'ai';
                const disabled = requiresDfs && dfsConfigured === false;
                return (
                  <label
                    key={k}
                    className={`flex items-start gap-2 px-2.5 py-2 rounded border text-xs cursor-pointer transition-colors ${
                      disabled
                        ? 'border-border/40 bg-muted/10 opacity-50 cursor-not-allowed'
                        : checked
                        ? 'border-primary/40 bg-primary/5'
                        : 'border-border/60 hover:bg-muted/20'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked && !disabled}
                      disabled={disabled}
                      onChange={(e) => setEnabledSources((p) => ({ ...p, [k]: e.target.checked }))}
                      className="mt-0.5 accent-primary"
                    />
                    <span className="flex-1">
                      <span className="font-medium text-foreground block">{meta.title}</span>
                      <span className="text-muted-foreground">{meta.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* How it works */}
          <div className="rounded-md border border-border/60 bg-muted/20">
            <button
              type="button"
              onClick={() => setHowItWorksOpen(v => !v)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/40 transition-colors rounded-md"
            >
              <span className="flex items-center gap-2 text-muted-foreground">
                <Info className="w-4 h-4 text-primary" />
                <span className="font-medium text-foreground">Как это работает?</span>
              </span>
              {howItWorksOpen ? (
                <X className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
            {howItWorksOpen && (
              <div className="px-3 pb-3 pt-1">
                <div className="flex flex-col md:flex-row md:items-stretch gap-3 md:gap-1">
                  {[
                    { n: 1, t: 'Источники', d: 'DataForSEO собирает реальные подсказки, базу ключей и ключи конкурентов. AI добавляет редкие хвосты и вопросы.' },
                    { n: 2, t: 'Частоты', d: 'Реальные месячные объёмы поиска — DataForSEO. Для ключей AI используется оценка.' },
                    { n: 3, t: 'Кластеры', d: 'Запросы с похожей выдачей в топе группируются — отдельно коммерческие и информационные.' },
                    { n: 4, t: 'Результат', d: 'Таблица с частотами, скорингом и кластерами. Зелёный индикатор = реальные данные. Экспорт в XLSX.' },
                  ].map((s, i, arr) => (
                    <div key={s.n} className="flex md:flex-1 items-stretch gap-1">
                      <div className="flex-1 rounded-md border border-border/60 bg-background p-3">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-[11px] font-bold">
                            {s.n}
                          </span>
                          <span className="text-sm font-semibold">{s.t}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{s.d}</p>
                      </div>
                      {i < arr.length - 1 && (
                        <div className="hidden md:flex items-center text-muted-foreground/50 px-0.5">→</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={runGenerate}
            disabled={running || (dailyUsage && dailyUsage.limit !== -1 ? dailyUsage.used >= dailyUsage.limit : false)}
            className="w-full h-11 gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {running ? 'Собираем ядро...' : 'Генерировать семантику'}
          </Button>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Источники → частоты → SERP → кластеризация по интенту</span>
            {dailyUsage && (
              <span>
                {dailyUsage.limit === -1 ? (
                  <>Режим администратора: <strong className="text-foreground">без лимитов</strong></>
                ) : (
                  <>Использовано сегодня: <strong className="text-foreground">{dailyUsage.used}</strong> / {dailyUsage.limit}</>
                )}
              </span>
            )}
          </div>

          {/* Progress steps */}
          {running && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              {(['expand', 'wordstat', 'serp', 'cluster'] as Step[]).map(s => {
                const st = stepStatus[s];
                return (
                  <div key={s} className="flex items-center gap-2 text-sm">
                    {st === 'done' ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : st === 'active' ? (
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border" />
                    )}
                    <span className={st === 'idle' ? 'text-muted-foreground' : ''}>{STEP_LABELS[s]}</span>
                  </div>
                );
              })}
              <div className="pt-1">
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${Math.max(2, jobProgress)}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1.5 text-[11px] text-muted-foreground">
                  <span>{jobProgress}%</span>
                  {jobLiveCounts.keywords > 0 && (
                    <span
                      title={
                        Object.keys(sourceBreakdown).length
                          ? `Подсказки: ${sourceBreakdown.autocomplete ?? 0}\nБаза DataForSEO: ${sourceBreakdown.suggestions ?? 0}\nКонкуренты: ${sourceBreakdown.competitors ?? 0}\nAI: ${sourceBreakdown.ai ?? 0}`
                          : ''
                      }
                    >
                      Собрано <strong className="text-foreground">{jobLiveCounts.keywords}</strong> запросов
                      {Object.keys(sourceBreakdown).length > 0 && <> из 4 источников</>}
                      {jobLiveCounts.clusters > 0 && <> / <strong className="text-foreground">{jobLiveCounts.clusters}</strong> кластеров</>}
                      {dataforseoCost > 0 && (
                        <> · <span className="inline-flex items-center"><DollarSign className="w-3 h-3" />{dataforseoCost.toFixed(3)}</span></>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* EMPTY STATE */}
        {!hasResults && !running && (
          <Card className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center mb-4">
              <Network className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">Соберите семантическое ядро</h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
              Введите тему — AI расширит список запросов, получит частоты и сгруппирует по смыслу
            </p>
            <Button variant="outline" onClick={() => textareaRef.current?.focus()}>
              Начать анализ
            </Button>
          </Card>
        )}

        {/* RESULTS */}
        {hasResults && (
          <Card className="p-5 space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="inline-flex rounded-md border border-input p-0.5">
                  <button
                    onClick={() => setView('table')}
                    className={`px-3 h-8 text-xs rounded gap-1.5 inline-flex items-center ${view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  ><TableIcon className="w-3.5 h-3.5" /> Таблица</button>
                  <button
                    onClick={() => setView('clusters')}
                    className={`px-3 h-8 text-xs rounded gap-1.5 inline-flex items-center ${view === 'clusters' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  ><LayoutGrid className="w-3.5 h-3.5" /> Кластеры</button>
                </div>
                <span className="text-xs text-muted-foreground">
                  Найдено <strong className="text-foreground">{keywords.length}</strong> запросов /{' '}
                  <strong className="text-foreground">{clusters.length}</strong> кластеров
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Экспорт XLSX
              </Button>
              {goldenCount > 0 && (
                <>
                  <Button
                    size="sm"
                    onClick={handleExportGolden}
                    className="gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black hover:from-amber-400 hover:to-yellow-400 border-0"
                    title="Только золотые запросы с расчётом потенциала трафика"
                  >
                    <Star className="w-3.5 h-3.5 fill-black" /> Экспорт золотых запросов
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSeoRecommendations}
                    className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                    title="Word-документ с рекомендациями по работе с золотыми запросами"
                  >
                    <Download className="w-3.5 h-3.5" /> Рекомендации SEO
                  </Button>
                </>
              )}
            </div>

            {view === 'table' ? (
              <>
                {/* Wordstat (RU) info banner — shown when KD is unavailable for the dataset */}
                {keywords.length > 0 && keywords.every(k => k.keywordDifficulty == null) && (
                  <div className="w-full flex items-start gap-3 px-4 py-2.5 rounded-md border bg-blue-500/10 border-blue-500/30 text-blue-300 text-sm">
                    <span className="text-base leading-none mt-0.5">ℹ️</span>
                    <span>
                      <strong>Данные частот:</strong> Яндекс Вордстат — реальные данные по России.{' '}
                      <span className="opacity-80">Конкуренция в Google Ads недоступна для данных Яндекса.</span>
                    </span>
                  </div>
                )}

                {/* Ideal opportunities banner */}
                {idealCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIdealOnly(v => !v)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-md border text-left transition-all ${
                      idealOnly
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/15'
                    }`}
                    title="Score > 70 и низкая конкуренция в Google Ads — приоритетные запросы"
                  >
                    <span className="text-sm font-medium">
                      🎯 <strong>{idealLabel(idealCount)}</strong>{' '}
                      <span className="text-xs opacity-80 font-normal">(Score &gt; 70, PPC конк. &lt; 40)</span>
                    </span>
                    <span className="text-xs opacity-80">
                      {idealOnly ? 'Сбросить фильтр' : 'Показать только их'}
                    </span>
                  </button>
                )}

                {/* Golden keywords banner */}
                {goldenCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setGoldenOnly(v => !v)}
                    className={`w-full flex items-start justify-between gap-3 px-4 py-3 rounded-md border text-left transition-all bg-gradient-to-r ${
                      goldenOnly
                        ? 'from-amber-500/25 to-yellow-500/15 border-amber-400/60'
                        : 'from-amber-500/15 to-yellow-500/5 border-amber-500/40 hover:from-amber-500/20 hover:to-yellow-500/10'
                    }`}
                    title={GOLDEN_TOOLTIP}
                  >
                    <span className="flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold text-amber-300">
                        <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                        Найдено {goldenCount} золотых запросов
                      </span>
                       <span className="block text-xs text-amber-200/80 mt-0.5 font-normal leading-relaxed">
                         Информационные запросы для SEO-статей — пишите экспертный
                         контент и получайте органический трафик
                       </span>
                    </span>
                    <span className="text-xs text-amber-200/90 shrink-0 self-center px-2 py-1 rounded border border-amber-400/40 bg-amber-500/10">
                      {goldenOnly ? 'Сбросить фильтр' : 'Показать только золотые'}
                    </span>
                  </button>
                )}

                {/* Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск по запросам..."
                      className="pl-9 h-9 text-sm"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground self-center mr-1">Интент:</span>
                    {allIntents.map(i => (
                      <button
                        key={i}
                        onClick={() => setIntentFilter(toggleSet(intentFilter, i))}
                        className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                          intentFilter.has(i)
                            ? INTENT_BADGE[i]
                            : 'bg-secondary text-muted-foreground border border-transparent hover:text-foreground'
                        }`}
                       >{INTENT_LABELS[i] ?? i}</button>
                    ))}
                    {goldenCount > 0 && (
                      <button
                        onClick={() => setGoldenOnly(v => !v)}
                        title={GOLDEN_TOOLTIP}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] transition-all ${
                          goldenOnly
                            ? 'bg-amber-500/25 text-amber-200 border border-amber-400/60'
                            : 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                        }`}
                      >
                        <Star className="w-3 h-3 fill-current" />
                        Золотые
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground self-center mr-1">Сложность:</span>
                    {(['easy','medium','hard','veryhard'] as KdBucket[]).map(b => {
                      const ranges: Record<KdBucket, string> = {
                        easy: '0–30', medium: '31–60', hard: '61–80', veryhard: '81+', none: '',
                      };
                      const active = kdFilter.has(b);
                      return (
                        <button
                          key={b}
                          onClick={() => setKdFilter(toggleSet(kdFilter, b))}
                          className={`px-2 py-0.5 rounded text-[11px] transition-all ${
                            active
                              ? KD_BADGE[b]
                              : 'bg-secondary text-muted-foreground border border-transparent hover:text-foreground'
                          }`}
                        >{KD_LABELS[b]} <span className="opacity-70">({ranges[b]})</span></button>
                      );
                    })}
                  </div>
                  {clusters.length > 1 && (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-xs text-muted-foreground self-center mr-1">Кластер:</span>
                      {clusters.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setClusterFilter(toggleSet(clusterFilter, c.id))}
                          className={`px-2 py-0.5 rounded text-[11px] transition-all max-w-[200px] truncate ${
                            clusterFilter.has(c.id)
                              ? 'bg-primary/15 text-primary border border-primary/30'
                              : 'bg-secondary text-muted-foreground border border-transparent hover:text-foreground'
                          }`}
                          title={c.name}
                        >{c.name}</button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Table */}
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40 text-xs">
                      <tr>
                        <th className="text-left px-3 py-2 cursor-pointer hover:text-primary" onClick={() => toggleSort('keyword')}>Запрос</th>
                        <th className="text-right px-3 py-2 cursor-pointer hover:text-primary whitespace-nowrap" onClick={() => toggleSort('wsFrequency')}>
                          Частота WS
                        </th>
                        <th className="text-right px-3 py-2 cursor-pointer hover:text-primary whitespace-nowrap" onClick={() => toggleSort('exactFrequency')}>
                          Точная
                        </th>
                        <th className="text-left px-3 py-2">Интент</th>
                        <th
                          className="text-left px-3 py-2 cursor-pointer hover:text-primary"
                          onClick={() => toggleSort('score')}
                          title="Score — приоритет запроса (частота × интент × специфичность)."
                        >Score</th>
                        <th
                          className="text-left px-3 py-2 whitespace-nowrap"
                          title="Google Ads competition index (0–100) — конкуренция в контекстной рекламе (PPC), а НЕ SEO Keyword Difficulty. Реальный SEO KD требует отдельного платного запроса DataForSEO."
                        >PPC конк.<span className="text-muted-foreground/60 ml-1">ⓘ</span></th>
                        <th className="text-left px-3 py-2">Кластер</th>
                        <th className="text-center px-3 py-2 w-12">✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((k, i) => (
                        <tr key={k.keyword + i} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2">
                            {(() => {
                              const tier = goldenTier(k);
                              if (!tier) return <span>{k.keyword}</span>;
                              const meta = TIER_META[tier];
                              const tip = `${meta.emoji} ${meta.label} — ${tierTooltip(tier)} (score ${k.score}, ${k.wsFrequency.toLocaleString('ru')}/мес)`;
                              return (
                                <>
                                  <span title={tip} className="inline-flex items-center gap-1 align-middle mr-1.5">
                                    <Star className={`w-3.5 h-3.5 ${meta.star}`} aria-label={`Золотой запрос — ${meta.label}`} />
                                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${meta.badge}`}>
                                      {meta.emoji} {meta.label}
                                    </span>
                                  </span>
                                  <span title={tip}>{k.keyword}</span>
                                </>
                              );
                            })()}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                            <FreqDot source={k.dataSource} />
                            {k.wsFrequency.toLocaleString('ru')}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{k.exactFrequency.toLocaleString('ru')}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${INTENT_BADGE[k.intent]}`}>
                              {INTENT_LABELS[k.intent] ?? k.intent}
                            </span>
                          </td>
                          <td className="px-3 py-2"><ScoreBar score={k.score} /></td>
                          <td className="px-3 py-2"><KdBadge kd={k.keywordDifficulty} /></td>
                          <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate" title={clusterMap.get(k.cluster)?.name}>
                            {clusterMap.get(k.cluster)?.name || '—'}
                          </td>
                          <td className="px-3 py-2 text-center">
                            <input
                              type="checkbox"
                              checked={k.included}
                              onChange={() => toggleIncluded(k.keyword)}
                              className="accent-primary"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className="p-6 text-center text-sm text-muted-foreground">Нет запросов под фильтр</div>
                  )}
                </div>
              </>
            ) : (
              <ClusterGrid clusters={clusters} keywords={keywords} />
            )}
          </Card>
        )}
      </main>
    </div>
  );
}

function ClusterGrid({ clusters, keywords }: { clusters: SemanticCluster[]; keywords: SemanticKeyword[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string) => {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id); else next.add(id);
    setExpanded(next);
  };

  const typeBadge = (t: SemanticCluster['type']) => {
    const map = {
      INFORMATIONAL: 'bg-sky-500/15 text-sky-400 border border-sky-500/30',
      COMMERCIAL: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      MIXED: 'bg-primary/15 text-primary border border-primary/30',
    };
    const labelMap: Record<SemanticCluster['type'], string> = {
      INFORMATIONAL: 'Информационный',
      COMMERCIAL: 'Коммерческий',
      MIXED: 'Смешанный',
    };
    return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${map[t]}`}>{labelMap[t]}</span>;
  };

  const sortedClusters = [...clusters].sort((a, b) => b.totalQueries - a.totalQueries);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {sortedClusters.map(c => {
        const items = keywords
          .filter(k => k.cluster === c.id)
          .sort((a, b) => b.score - a.score);
        const top = items.slice(0, 5);
        const isOpen = expanded.has(c.id);
        const display = isOpen ? items : top;
        const kdValues = items
          .map(k => k.keywordDifficulty)
          .filter((v): v is number => typeof v === 'number');
        const avgKd = kdValues.length
          ? Math.round(kdValues.reduce((s, v) => s + v, 0) / kdValues.length)
          : null;
        const goldenItems = items.filter(isGoldenKeyword);
        return (
          <Card key={c.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight">{c.name}</h3>
              {typeBadge(c.type)}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span title="Средняя конкуренция в Google Ads (PPC), не SEO KD">Ср. PPC конк.:</span>
              <KdBadge kd={avgKd} />
            </div>
            <div className="space-y-1">
              {display.map(k => (
                <div key={k.keyword} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate flex items-center gap-1" title={k.keyword}>
                    {(() => {
                      const tier = goldenTier(k);
                      if (!tier) return null;
                      const meta = TIER_META[tier];
                      return (
                        <span title={`${meta.emoji} ${meta.label} — ${tierTooltip(tier)}`} className="inline-flex shrink-0">
                          <Star className={`w-3 h-3 ${meta.star}`} />
                        </span>
                      );
                    })()}
                    <span className="truncate">{k.keyword}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground shrink-0">{k.score}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground flex items-center gap-2">
                <span>{c.totalQueries} запр.</span>
                {goldenItems.length >= 3 && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
                    title={GOLDEN_TOOLTIP}
                  >
                    <Star className="w-3 h-3 fill-current" />
                    {goldenItems.length} золотых
                  </span>
                )}
              </span>
              {items.length > 5 && (
                <button onClick={() => toggle(c.id)} className="text-xs text-primary hover:underline">
                  {isOpen ? 'Свернуть' : 'Открыть кластер'}
                </button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}