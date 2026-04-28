import { useEffect, useMemo, useRef, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Search, Download, Sparkles, RefreshCw, Star, Filter,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { REGION_GROUPS } from '@/lib/semanticCore/types';
import type { BlogTopic } from '@/lib/blogTopics/types';
import { COMPETITION_META } from '@/lib/blogTopics/types';
import { exportContentPlanDocx } from '@/lib/blogTopics/exportContentPlanDocx';

type CompFilter = 'all' | 'easy' | 'medium' | 'hard' | 'unchecked';

function CompetitionBadge({ level }: { level: BlogTopic['competition_level'] }) {
  if (!level) {
    return <span className="text-xs text-muted-foreground">Не проверено</span>;
  }
  const m = COMPETITION_META[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${m.badge}`}>
      <span>{m.emoji}</span>
      <span>{m.label}</span>
    </span>
  );
}

function recommendation(t: BlogTopic): string {
  if (t.competition_level === 'easy') return 'Старт-статья 1500 слов, H1 = запрос';
  if (t.competition_level === 'medium') return 'Статья 2500 слов + фото/таблицы';
  if (t.competition_level === 'hard') return 'Экспертный лонгрид 3000+ слов';
  return 'Сначала проверьте конкуренцию';
}

export default function BlogTopicsPage() {
  const [topic, setTopic] = useState('');
  const [region, setRegion] = useState('Москва');
  const [running, setRunning] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('');
  const [jobProgress, setJobProgress] = useState(0);
  const [serpProgress, setSerpProgress] = useState({ checked: 0, total: 0 });
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [search, setSearch] = useState('');
  const [compFilter, setCompFilter] = useState<CompFilter>('all');
  const [minFreq, setMinFreq] = useState(0);
  const [recheckBusy, setRecheckBusy] = useState<Set<string>>(new Set());

  const pollRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (pollRef.current) window.clearInterval(pollRef.current);
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };

  const fetchTopics = async (id: string) => {
    const { data } = await supabase
      .from('blog_topics')
      .select('*')
      .eq('job_id', id)
      .order('blog_score', { ascending: false });
    setTopics((data as any as BlogTopic[]) || []);
  };

  const startPolling = (id: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      const { data: job } = await supabase
        .from('blog_topics_jobs')
        .select('status, progress, serp_checked, serp_total, error_message')
        .eq('id', id)
        .maybeSingle();
      if (!job) return;
      setJobStatus(String(job.status));
      setJobProgress(Number(job.progress) || 0);
      setSerpProgress({ checked: Number(job.serp_checked) || 0, total: Number(job.serp_total) || 0 });
      if (job.status === 'done') {
        stopPolling();
        await fetchTopics(id);
        setRunning(false);
        toast.success('Темы для блога собраны!');
      } else if (job.status === 'error') {
        stopPolling();
        setRunning(false);
        toast.error(`Ошибка: ${job.error_message || 'неизвестно'}`);
      }
    }, 2000);
  };

  const handleStart = async () => {
    if (!topic.trim()) {
      toast.error('Укажите тематику сайта');
      return;
    }
    setRunning(true);
    setTopics([]);
    setJobProgress(0);
    setJobStatus('pending');
    setSerpProgress({ checked: 0, total: 0 });
    try {
      const { data, error } = await supabase.functions.invoke('blog-topics-start', {
        body: { topic: topic.trim(), region },
      });
      if (error) throw error;
      const id = (data as any)?.job_id;
      if (!id) throw new Error('Не получили job_id');
      setJobId(id);
      startPolling(id);
    } catch (e: any) {
      setRunning(false);
      toast.error(e?.message || 'Не удалось запустить анализ');
    }
  };

  const handleRecheck = async (t: BlogTopic) => {
    setRecheckBusy((prev) => new Set(prev).add(t.id));
    try {
      const { data, error } = await supabase.functions.invoke('blog-topics-worker', {
        body: { action: 'recheck', topic_id: t.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      if (jobId) await fetchTopics(jobId);
      toast.success('Конкуренция обновлена');
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось проверить');
    } finally {
      setRecheckBusy((prev) => {
        const next = new Set(prev);
        next.delete(t.id);
        return next;
      });
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return topics.filter((t) => {
      if (q && !t.keyword.toLowerCase().includes(q)) return false;
      if (minFreq > 0 && t.ws_frequency < minFreq) return false;
      if (compFilter === 'unchecked' && t.competition_level !== null) return false;
      if (compFilter !== 'all' && compFilter !== 'unchecked' && t.competition_level !== compFilter) return false;
      return true;
    });
  }, [topics, search, compFilter, minFreq]);

  const top10 = useMemo(() => {
    return [...topics].sort((a, b) => b.blog_score - a.blog_score).slice(0, 10);
  }, [topics]);

  const stats = useMemo(() => ({
    total: topics.length,
    easy: topics.filter((t) => t.competition_level === 'easy').length,
    medium: topics.filter((t) => t.competition_level === 'medium').length,
    hard: topics.filter((t) => t.competition_level === 'hard').length,
    unchecked: topics.filter((t) => !t.competition_level).length,
  }), [topics]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Темы для блога</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Информационные темы с анализом конкуренции через топ-10 Google
            </p>
          </div>
          {topics.length > 0 && (
            <Button
              variant="outline"
              onClick={() => exportContentPlanDocx(topics, topic, region)}
            >
              <Download className="w-4 h-4 mr-2" />
              Скачать контент-план
            </Button>
          )}
        </div>

        {/* Form */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Тематика сайта</label>
              <Input
                placeholder="например: стоматология, ремонт квартир"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={running}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Регион</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={running}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {REGION_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.regions.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>
          <Button onClick={handleStart} disabled={running} className="w-full md:w-auto">
            {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {running ? 'Анализируем...' : 'Найти темы для блога'}
          </Button>

          {running && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Статус: {jobStatus}</span>
                <span>{jobProgress}%</span>
              </div>
              <div className="h-1.5 bg-secondary rounded overflow-hidden">
                <div className="h-full bg-primary transition-all" style={{ width: `${jobProgress}%` }} />
              </div>
              {jobStatus === 'serp' && serpProgress.total > 0 && (
                <p className="text-xs text-muted-foreground">
                  Анализируем конкуренцию {serpProgress.checked}/{serpProgress.total}...
                </p>
              )}
            </div>
          )}
        </Card>

        {/* Top-10 best */}
        {top10.length > 0 && (
          <Card className="p-5 border-emerald-500/40 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-emerald-400 fill-emerald-400" />
              <h2 className="text-sm font-semibold">Лучшие темы для старта (топ-10)</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {top10.map((t) => (
                <div key={t.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-background/50">
                  <span className="text-sm truncate">{t.keyword}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="tabular-nums">{t.blog_score}</Badge>
                    <CompetitionBadge level={t.competition_level} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Filters */}
        {topics.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Filter className="w-3.5 h-3.5" />
                <span>Фильтры:</span>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Поиск по теме..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-7 h-8 text-sm"
                />
              </div>
              <select
                value={compFilter}
                onChange={(e) => setCompFilter(e.target.value as CompFilter)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="all">Все</option>
                <option value="easy">🟢 Низкая</option>
                <option value="medium">🟡 Средняя</option>
                <option value="hard">🔴 Высокая</option>
                <option value="unchecked">Не проверено</option>
              </select>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Мин. частота:</span>
                <input
                  type="range" min={0} max={20000} step={500}
                  value={minFreq}
                  onChange={(e) => setMinFreq(Number(e.target.value))}
                  className="w-32"
                />
                <span className="tabular-nums w-14">{minFreq}</span>
              </div>
              <div className="ml-auto text-xs text-muted-foreground">
                Найдено: <b>{filtered.length}</b> · Лёгких {stats.easy} · Средних {stats.medium} · Сложных {stats.hard} · Не проверено {stats.unchecked}
              </div>
            </div>
          </Card>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-secondary/50 text-xs text-muted-foreground">
                  <tr>
                    <th className="text-left p-3">Тема</th>
                    <th className="text-right p-3 whitespace-nowrap">Частота WS</th>
                    <th className="text-left p-3">Конкуренция</th>
                    <th className="text-center p-3 whitespace-nowrap">Сильных в топе</th>
                    <th className="text-right p-3">Score</th>
                    <th className="text-right p-3 whitespace-nowrap">Трафик/мес</th>
                    <th className="text-left p-3">Рекомендация</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                      <td className="p-3">{t.keyword}</td>
                      <td className="p-3 text-right tabular-nums">{t.ws_frequency.toLocaleString('ru-RU')}</td>
                      <td className="p-3"><CompetitionBadge level={t.competition_level} /></td>
                      <td className="p-3 text-center tabular-nums text-xs text-muted-foreground">
                        {t.strong_count != null ? `${t.strong_count}/10` : '—'}
                      </td>
                      <td className="p-3 text-right tabular-nums font-medium">{t.blog_score}</td>
                      <td className="p-3 text-right tabular-nums text-emerald-400">~{t.traffic_potential.toLocaleString('ru-RU')}</td>
                      <td className="p-3 text-xs text-muted-foreground">{recommendation(t)}</td>
                      <td className="p-3">
                        {!t.serp_checked && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={recheckBusy.has(t.id)}
                            onClick={() => handleRecheck(t)}
                            title="Проверить конкуренцию"
                          >
                            {recheckBusy.has(t.id)
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RefreshCw className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!running && topics.length === 0 && (
          <Card className="p-10 text-center text-sm text-muted-foreground">
            Введите тематику и нажмите «Найти темы для блога».
          </Card>
        )}
      </main>
    </div>
  );
}