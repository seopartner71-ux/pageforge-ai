import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Network, Loader2, Check, Search, Download, Tag, X, Plus,
  AlertTriangle, LayoutGrid, Table as TableIcon, Sparkles, Info, ChevronDown,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getFrequencies, isWordstatRealMode } from '@/services/wordstatService';
import {
  classifyIntentByKeyword, INTENT_BADGE, INTENT_WEIGHT, REGIONS,
  type IntentKind, type SemanticCluster, type SemanticCorePayload, type SemanticKeyword,
} from '@/lib/semanticCore/types';
import { exportSemanticCoreXlsx } from '@/lib/semanticCore/exportSemanticCoreXlsx';

type Step = 'expand' | 'wordstat' | 'serp' | 'cluster';
const STEP_LABELS: Record<Step, string> = {
  expand: 'AI расширяет ядро...',
  wordstat: 'Получаем частоты Яндекс.Вордстат...',
  serp: 'Анализируем топ-10 выдачи...',
  cluster: 'Кластеризуем запросы...',
};

function intentTypeForCluster(items: SemanticKeyword[]): SemanticCluster['type'] {
  const c = items.filter(i => i.intent === 'commercial' || i.intent === 'transac').length;
  const inf = items.filter(i => i.intent === 'info').length;
  const total = items.length || 1;
  if (c / total > 0.7) return 'COMMERCIAL';
  if (inf / total > 0.7) return 'INFORMATIONAL';
  return 'MIXED';
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

export default function SemanticCorePage() {
  const [topic, setTopic] = useState('');
  const [seeds, setSeeds] = useState<string[]>([]);
  const [seedInput, setSeedInput] = useState('');
  const [region, setRegion] = useState('Москва');
  const [engine, setEngine] = useState<'yandex' | 'google'>('yandex');

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
  const [sortKey, setSortKey] = useState<'score' | 'wsFrequency' | 'exactFrequency' | 'keyword'>('score');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [wordstatReal, setWordstatReal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const runGenerate = async () => {
    if (!topic.trim() && !seeds.length) {
      toast.error('Введите тему или хотя бы один seed-ключ');
      return;
    }
    setRunning(true);
    setKeywords([]); setClusters([]); setCoreId(null);
    setStepStatus({ expand: 'idle', wordstat: 'idle', serp: 'idle', cluster: 'idle' });

    try {
      // 1) AI expand
      setStep('expand', 'active');
      const { data: expData, error: expErr } = await supabase.functions.invoke('semantic-core', {
        body: { action: 'expand', topic, seeds },
      });
      if (expErr) throw expErr;
      const expandedRaw: string[] = (expData as any)?.keywords || [];
      // Включаем и сидов, чтобы пользовательские точно остались
      const expanded = Array.from(new Set([...seeds, ...expandedRaw].map(s => s.toLowerCase().trim()).filter(Boolean)));
      if (!expanded.length) throw new Error('AI не вернул ключевых слов');
      setStep('expand', 'done');

      // 2) Wordstat
      setStep('wordstat', 'active');
      const freqs = await getFrequencies(expanded);
      setStep('wordstat', 'done');

      const maxFreq = Math.max(1, ...freqs.map(f => f.wsFrequency));
      let initial: SemanticKeyword[] = freqs.map(f => {
        const intent = classifyIntentByKeyword(f.keyword);
        const w = INTENT_WEIGHT[intent];
        const ratio = f.wsFrequency > 0 ? f.exactFrequency / f.wsFrequency : 0;
        const score = Math.max(0, Math.min(100, Math.round(
          (Math.log(f.wsFrequency + 1) / Math.log(maxFreq + 1)) * 60 +
          w * 25 +
          ratio * 15
        )));
        return {
          keyword: f.keyword, wsFrequency: f.wsFrequency, exactFrequency: f.exactFrequency,
          intent, score, cluster: '', included: true,
        };
      });

      // 3) SERP
      setStep('serp', 'active');
      // 4) Cluster (через ту же edge-функцию, она тянет SERP внутри)
      setStep('cluster', 'active');
      const { data: clData, error: clErr } = await supabase.functions.invoke('semantic-core', {
        body: {
          action: 'cluster',
          region,
          items: initial.map(k => ({ keyword: k.keyword, score: k.score })),
        },
      });
      if (clErr) throw clErr;
      setStep('serp', 'done');

      const rawClusters: { id: string; name: string; keywords: string[] }[] = (clData as any)?.clusters || [];
      const assignments: Record<string, string> = (clData as any)?.assignments || {};
      const method: string | undefined = (clData as any)?.method;
      if (method) setClusterMethod(method);

      initial = initial.map(k => ({ ...k, cluster: assignments[k.keyword] || 'unclustered' }));

      const builtClusters: SemanticCluster[] = rawClusters.map(c => {
        const items = initial.filter(k => k.cluster === c.id);
        return {
          id: c.id,
          name: c.name,
          type: intentTypeForCluster(items),
          keywords: items.map(i => i.keyword),
          totalQueries: items.length,
        };
      });
      setStep('cluster', 'done');

      setKeywords(initial);
      setClusters(builtClusters);

      // 5) Save
      const payload: SemanticCorePayload = {
        topic, seedKeywords: seeds, region, searchEngine: engine,
        keywords: initial, clusters: builtClusters,
        wordstatMode: wordstatReal ? 'real' : 'mock',
        generatedAt: new Date().toISOString(),
      };
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const { data: saved } = await supabase.from('semantic_cores').insert({
          user_id: u.user.id,
          name: topic ? `СЯ: ${topic.slice(0, 60)}` : 'Семантическое ядро',
          topic, seed_keywords: seeds, region, search_engine: engine,
          keywords: initial as any, clusters: builtClusters as any,
          wordstat_mode: payload.wordstatMode,
        }).select('id').single();
        if (saved?.id) setCoreId(saved.id);
      }
      toast.success(`Готово: ${initial.length} запросов в ${builtClusters.length} кластерах`);

      if (initial.length > 0 && builtClusters.length / initial.length > 0.5) {
        toast.warning('Кластеризация не дала результатов — попробуйте другую тему или проверьте API ключи');
      }
    } catch (e: any) {
      const msg = e?.message || String(e);
      toast.error(`Ошибка: ${msg}`);
    } finally {
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
    arr = [...arr].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const cmp = typeof av === 'string' ? av.localeCompare(bv) : (av - bv);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [keywords, search, intentFilter, clusterFilter, sortKey, sortDir]);

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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Регион</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full h-10 px-3 rounded-md bg-background border border-input text-sm"
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
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
                    { n: 1, t: 'AI-расширение', d: 'ИИ генерирует 150–200 запросов по теме: синонимы, хвосты, вопросы, коммерческие.' },
                    { n: 2, t: 'Частоты', d: 'Яндекс.Вордстат возвращает частоту каждого запроса в месяц.' },
                    { n: 3, t: 'Кластеры', d: 'Запросы с похожей выдачей в топе группируются в один кластер.' },
                    { n: 4, t: 'Результат', d: 'Таблица с частотами, скорингом и кластерами. Экспорт в XLSX.' },
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
            disabled={running}
            className="w-full h-11 gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {running ? 'Собираем ядро...' : 'Generate Semantics'}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            AI расширит ядро → получит частоты → кластеризует по топам
          </p>

          {!wordstatReal && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-yellow-500" />
              <span>
                <strong className="text-yellow-400">Wordstat: Mock-режим</strong> — частоты случайные.
                Добавьте API ключ в Настройках (админ-панель → API Keys).
              </span>
            </div>
          )}

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
                <Download className="w-3.5 h-3.5" /> Export XLSX
              </Button>
            </div>

            {view === 'table' ? (
              <>
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
                      >{i}</button>
                    ))}
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
                          Частота WS{!wordstatReal && <MockBadge />}
                        </th>
                        <th className="text-right px-3 py-2 cursor-pointer hover:text-primary whitespace-nowrap" onClick={() => toggleSort('exactFrequency')}>
                          Точная{!wordstatReal && <MockBadge />}
                        </th>
                        <th className="text-left px-3 py-2">Интент</th>
                        <th className="text-left px-3 py-2 cursor-pointer hover:text-primary" onClick={() => toggleSort('score')}>Score</th>
                        <th className="text-left px-3 py-2">Кластер</th>
                        <th className="text-center px-3 py-2 w-12">✓</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((k, i) => (
                        <tr key={k.keyword + i} className="border-t border-border/50 hover:bg-muted/20">
                          <td className="px-3 py-2">{k.keyword}</td>
                          <td className="px-3 py-2 text-right tabular-nums">{k.wsFrequency.toLocaleString('ru')}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{k.exactFrequency.toLocaleString('ru')}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${INTENT_BADGE[k.intent]}`}>
                              {k.intent}
                            </span>
                          </td>
                          <td className="px-3 py-2"><ScoreBar score={k.score} /></td>
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
    return <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${map[t]}`}>{t}</span>;
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
        return (
          <Card key={c.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight">{c.name}</h3>
              {typeBadge(c.type)}
            </div>
            <div className="space-y-1">
              {display.map(k => (
                <div key={k.keyword} className="flex items-center justify-between text-xs gap-2">
                  <span className="truncate" title={k.keyword}>{k.keyword}</span>
                  <span className="tabular-nums text-muted-foreground shrink-0">{k.score}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <span className="text-xs text-muted-foreground">{c.totalQueries} запр.</span>
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