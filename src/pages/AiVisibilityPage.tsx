import { useEffect, useMemo, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Radar as RadarIcon, Plus, Play, Trash2, Loader2, CheckCircle2, XCircle, FileDown, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  RadarChart, Radar as RadarShape, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip,
} from 'recharts';
import { exportAiVisibilityDocx } from '@/lib/exportAiVisibilityDocx';
import MentionsPage from './ai-visibility/MentionsPage';
import PromptsPage from './ai-visibility/PromptsPage';
import SourcesPage from './ai-visibility/SourcesPage';
import ReactMarkdown from 'react-markdown';

type Project = { id: string; brand_name: string; domain: string; language: string };
type Keyword = { id: string; keyword: string; last_checked_at: string | null };
type Result = {
  id: string;
  keyword_id: string | null;
  model: string;
  status: string;
  brand_mentioned: boolean;
  domain_linked: boolean;
  sentiment: string | null;
  competitor_domains: string[];
  ai_response_text: string | null;
  checked_at: string;
};

const MODEL_LABELS: Record<string, string> = {
  gemini_flash: 'Gemini',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
  deepseek: 'DeepSeek',
  mistral: 'Mistral',
  llama: 'Llama',
};

export default function AiVisibilityPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>('');
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [newKw, setNewKw] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [brand, setBrand] = useState('');
  const [domain, setDomain] = useState('');
  const [lang, setLang] = useState('ru');
  const [description, setDescription] = useState('');
  const [products, setProducts] = useState('');
  const [bulkKeywords, setBulkKeywords] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [selectedResult, setSelectedResult] = useState<Result | null>(null);

  const activeProject = useMemo(
    () => projects.find((p) => p.id === activeProjectId) || null,
    [projects, activeProjectId],
  );

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    if (activeProjectId) { loadKeywords(); loadResults(); }
    else { setKeywords([]); setResults([]); }
  }, [activeProjectId]);

  async function loadProjects() {
    const { data, error } = await supabase
      .from('radar_projects')
      .select('id, brand_name, domain, language')
      .order('created_at', { ascending: false });
    if (error) { toast.error('Не удалось загрузить проекты'); return; }
    setProjects(data || []);
    if (data?.length && !activeProjectId) setActiveProjectId(data[0].id);
  }

  async function loadKeywords() {
    const { data } = await supabase
      .from('radar_keywords')
      .select('id, keyword, last_checked_at')
      .eq('project_id', activeProjectId)
      .order('created_at', { ascending: false });
    setKeywords(data || []);
  }

  async function loadResults() {
    const { data } = await supabase
      .from('radar_results')
      .select('id, keyword_id, model, status, brand_mentioned, domain_linked, sentiment, competitor_domains, ai_response_text, checked_at')
      .in('keyword_id', keywords.map(k => k.id).length ? keywords.map(k => k.id) : ['00000000-0000-0000-0000-000000000000'])
      .order('checked_at', { ascending: false })
      .limit(500);
    setResults((data as any) || []);
  }

  useEffect(() => { if (keywords.length) loadResults(); }, [keywords.length]);

  async function createProject() {
    if (!brand.trim() || !domain.trim()) { toast.error('Укажите бренд и домен'); return; }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { toast.error('Войдите в аккаунт'); return; }
    const { data, error } = await supabase
      .from('radar_projects')
      .insert({ user_id: user.user.id, brand_name: brand.trim(), domain: domain.trim(), language: lang })
      .select('id, brand_name, domain, language')
      .single();
    if (error) { toast.error(error.message); return; }

    // Parse bulk keywords (one per line, max 10)
    const kws = bulkKeywords
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .slice(0, 10);
    if (kws.length) {
      const rows = kws.map((keyword) => ({
        user_id: user.user!.id, project_id: data.id, keyword,
      }));
      const { error: kerr } = await supabase.from('radar_keywords').insert(rows);
      if (kerr) toast.error(`Запросы: ${kerr.message}`);
    }

    toast.success(`Проект создан${kws.length ? `, добавлено запросов: ${kws.length}` : ''}`);
    setCreateOpen(false);
    setBrand(''); setDomain(''); setDescription(''); setProducts(''); setBulkKeywords('');
    setProjects((p) => [data as Project, ...p]);
    setActiveProjectId(data.id);
  }

  async function suggestPrompts() {
    if (!brand.trim() || !domain.trim()) {
      toast.error('Сначала укажите бренд и домен');
      return;
    }
    setSuggesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('radar-suggest-prompts', {
        body: {
          brand_name: brand.trim(),
          domain: domain.trim(),
          language: lang,
          description: description.trim(),
          products: products.trim(),
          count: 10,
        },
      });
      if (error) throw error;
      const prompts: string[] = (data as any)?.prompts || [];
      if (!prompts.length) {
        toast.error('ИИ не вернул промты, попробуйте ещё раз');
        return;
      }
      // Merge with existing, dedupe, cap at 10
      const existing = bulkKeywords.split('\n').map((s) => s.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...prompts])].slice(0, 10);
      setBulkKeywords(merged.join('\n'));
      toast.success(`Сгенерировано ${prompts.length} промтов`);
    } catch (e: any) {
      toast.error(e.message || 'Не удалось сгенерировать промты');
    } finally {
      setSuggesting(false);
    }
  }

  async function addKeyword() {
    const kw = newKw.trim();
    if (!kw || !activeProjectId) return;
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return;
    const { error } = await supabase.from('radar_keywords').insert({
      user_id: user.user.id, project_id: activeProjectId, keyword: kw,
    });
    if (error) { toast.error(error.message); return; }
    setNewKw('');
    loadKeywords();
  }

  async function removeKeyword(id: string) {
    const { error } = await supabase.from('radar_keywords').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    loadKeywords();
  }

  async function runAnalysis() {
    if (!activeProjectId || keywords.length === 0) return;
    setRunning(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Войдите в аккаунт');
      const { data: run } = await supabase.from('radar_analysis_runs').insert({
        user_id: user.user.id, project_id: activeProjectId,
        total_prompts: keywords.length * 7, completed_prompts: 0, status: 'running',
      }).select('id').single();

      let done = 0;
      for (const kw of keywords) {
        const { error } = await supabase.functions.invoke('radar-check', {
          body: { keyword_id: kw.id, project_id: activeProjectId, run_id: run?.id },
        });
        if (error) toast.error(`${kw.keyword}: ${error.message}`);
        done++;
        toast.message(`Обработано ${done}/${keywords.length}`);
      }
      await supabase.from('radar_analysis_runs')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', run!.id);
      toast.success('Анализ завершён');
      await loadKeywords();
      await loadResults();
    } catch (e: any) {
      toast.error(e.message || 'Ошибка анализа');
    } finally {
      setRunning(false);
    }
  }

  // Aggregations
  const radarData = useMemo(() => {
    const totalsByModel = new Map<string, { total: number; visible: number }>();
    for (const r of results) {
      const m = totalsByModel.get(r.model) || { total: 0, visible: 0 };
      m.total++;
      if (r.brand_mentioned || r.domain_linked) m.visible++;
      totalsByModel.set(r.model, m);
    }
    return Object.keys(MODEL_LABELS).map((k) => {
      const v = totalsByModel.get(k);
      const som = v && v.total ? Math.round((v.visible / v.total) * 100) : 0;
      return { model: MODEL_LABELS[k], som };
    });
  }, [results]);

  const topCompetitors = useMemo(() => {
    const counter = new Map<string, number>();
    for (const r of results) {
      for (const c of r.competitor_domains || []) counter.set(c, (counter.get(c) || 0) + 1);
    }
    return [...counter.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [results]);

  const [exporting, setExporting] = useState(false);
  const [runProgress, setRunProgress] = useState<{ completed: number; total: number; current?: string } | null>(null);
  const [geoPlan, setGeoPlan] = useState('');
  const [planLoading, setPlanLoading] = useState(false);

  // Realtime progress subscription
  useEffect(() => {
    if (!activeProjectId) return;
    const channel = supabase
      .channel(`radar-runs-${activeProjectId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'radar_analysis_runs',
        filter: `project_id=eq.${activeProjectId}`,
      }, (payload: any) => {
        const row = payload.new;
        if (!row) return;
        if (row.status === 'running') {
          setRunProgress({ completed: row.completed_prompts || 0, total: row.total_prompts || 0, current: row.current_prompt_text || '' });
        } else {
          setRunProgress(null);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeProjectId]);

  async function generateGeoPlan() {
    if (!activeProject) return;
    setPlanLoading(true);
    setGeoPlan('');
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error('Войдите в аккаунт');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-geo-plan`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          project_id: activeProject.id,
          radar_data: { radar: radarData, topCompetitors, totalResults: results.length },
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let acc = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() || '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const json = JSON.parse(data);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) { acc += delta; setGeoPlan(acc); }
          } catch {}
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Не удалось сформировать план');
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleExportDocx() {
    if (!activeProject || results.length === 0) {
      toast.error('Нет данных для экспорта. Запустите прогон.');
      return;
    }
    setExporting(true);
    try {
      const totalsByModel = new Map<string, { total: number; visible: number }>();
      for (const r of results) {
        const m = totalsByModel.get(r.model) || { total: 0, visible: 0 };
        m.total++;
        if (r.brand_mentioned || r.domain_linked) m.visible++;
        totalsByModel.set(r.model, m);
      }
      const modelStats = Object.keys(MODEL_LABELS).map((k) => {
        const v = totalsByModel.get(k) || { total: 0, visible: 0 };
        return { model: k, total: v.total, visible: v.visible, som: v.total ? Math.round((v.visible / v.total) * 100) : 0 };
      });
      const rows = results.map((r) => ({
        keyword: keywords.find((k) => k.id === r.keyword_id)?.keyword || '—',
        model: r.model,
        brand_mentioned: r.brand_mentioned,
        domain_linked: r.domain_linked,
        sentiment: r.sentiment,
        competitor_domains: r.competitor_domains || [],
        ai_response_text: r.ai_response_text,
        checked_at: r.checked_at,
      }));
      await exportAiVisibilityDocx({
        brandName: activeProject.brand_name,
        domain: activeProject.domain,
        language: activeProject.language,
        modelStats,
        topCompetitors,
        rows,
      });
      toast.success('Отчёт Word сформирован');
    } catch (e: any) {
      toast.error(e.message || 'Не удалось сформировать отчёт');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <RadarIcon className="w-6 h-6 text-primary" />
            Видимость в ИИ ответах
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Мониторинг присутствия вашего бренда в ответах ChatGPT, Gemini, Perplexity, Claude, DeepSeek, Mistral и Llama.
          </p>
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'GEO Radar — мониторинг, как ваш бренд представлен в ответах 7 генеративных ИИ-моделей.' },
            { label: 'Как работает', text: 'Создайте проект (бренд + домен), добавьте запросы, запустите прогон. Система задаёт каждый запрос 7 моделям параллельно через OpenRouter.' },
            { label: 'Что получаете', text: 'Радар-чарт видимости (SOM), список упомянутых конкурентов, тональность и полные тексты ответов ИИ.' },
            { label: 'Кредиты', text: '1 запрос × 7 моделей за прогон.' },
          ]}
        />

        <Card className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-xs">Проект</Label>
            <Select value={activeProjectId} onValueChange={setActiveProjectId}>
              <SelectTrigger><SelectValue placeholder="Выберите проект" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.brand_name} — {p.domain}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Plus className="w-4 h-4 mr-1" />Новый проект</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Новый проект GEO Radar</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Название бренда</Label>
                  <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Например, Acme" />
                </div>
                <div>
                  <Label>Домен</Label>
                  <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="acme.com" />
                </div>
                <div>
                  <Label>Язык</Label>
                  <Select value={lang} onValueChange={setLang}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ru">Русский</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Описание компании <span className="text-muted-foreground text-xs">(для AI-подсказок)</span></Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Чем занимается компания, для кого, регион"
                    rows={2}
                  />
                </div>
                <div>
                  <Label>Продукты / услуги</Label>
                  <Textarea
                    value={products}
                    onChange={(e) => setProducts(e.target.value)}
                    placeholder="Например: CRM для малого бизнеса, IP-телефония, чат-боты"
                    rows={2}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label>Запросы (до 10, по одному на строку)</Label>
                    <Button
                      type="button" size="sm" variant="outline"
                      onClick={suggestPrompts} disabled={suggesting}
                    >
                      {suggesting ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RadarIcon className="w-3 h-3 mr-1" />}
                      Сгенерировать с ИИ
                    </Button>
                  </div>
                  <Textarea
                    value={bulkKeywords}
                    onChange={(e) => setBulkKeywords(e.target.value)}
                    placeholder={'лучшие CRM для малого бизнеса\nсравнение CRM 2026\n...'}
                    rows={6}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    {bulkKeywords.split('\n').filter((s) => s.trim().length >= 2).length} / 10 запросов
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createProject}>Создать</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button onClick={runAnalysis} disabled={!activeProjectId || keywords.length === 0 || running}>
            {running ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Play className="w-4 h-4 mr-1" />}
            Запустить прогон
          </Button>
          <Button variant="outline" onClick={handleExportDocx} disabled={!activeProjectId || results.length === 0 || exporting}>
            {exporting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <FileDown className="w-4 h-4 mr-1" />}
            Скачать отчёт Word
          </Button>
        </Card>

        {runProgress && runProgress.total > 0 && (
          <Card className="p-4 space-y-2 border-primary/40">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 font-medium">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                Сканирование: {runProgress.completed} / {runProgress.total}
              </span>
              <span className="text-muted-foreground">
                {Math.round((runProgress.completed / runProgress.total) * 100)}%
              </span>
            </div>
            <Progress value={(runProgress.completed / runProgress.total) * 100} />
            {runProgress.current && (
              <p className="text-xs text-muted-foreground truncate">→ {runProgress.current}</p>
            )}
          </Card>
        )}

        {activeProject ? (
          <Tabs defaultValue="dashboard" className="space-y-4">
            <TabsList>
              <TabsTrigger value="dashboard">Дашборд</TabsTrigger>
              <TabsTrigger value="mentions">Позиции</TabsTrigger>
              <TabsTrigger value="prompts">Промпты</TabsTrigger>
              <TabsTrigger value="sources">Источники</TabsTrigger>
              <TabsTrigger value="strategy">GEO Стратегия</TabsTrigger>
              <TabsTrigger value="keywords">Запросы ({keywords.length})</TabsTrigger>
              <TabsTrigger value="results">Результаты ({results.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="dashboard" className="space-y-4">
              <div className="grid lg:grid-cols-2 gap-4">
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Share of Model (видимость по моделям)</h3>
                  <div className="h-[320px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} outerRadius="70%">
                        <PolarGrid />
                        <PolarAngleAxis dataKey="model" tick={{ fontSize: 12 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                        <RadarShape name="SOM %" dataKey="som" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.4} />
                        <Tooltip />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
                <Card className="p-4">
                  <h3 className="text-sm font-semibold mb-3">Топ упомянутых конкурентов</h3>
                  {topCompetitors.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Нет данных. Запустите прогон.</p>
                  ) : (
                    <ul className="space-y-2">
                      {topCompetitors.map(([d, n]) => (
                        <li key={d} className="flex justify-between text-sm border-b py-1">
                          <span className="truncate">{d}</span>
                          <Badge variant="secondary">{n}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="mentions">
              <MentionsPage projectId={activeProject.id} />
            </TabsContent>
            <TabsContent value="prompts">
              <PromptsPage projectId={activeProject.id} />
            </TabsContent>
            <TabsContent value="sources">
              <SourcesPage projectId={activeProject.id} />
            </TabsContent>
            <TabsContent value="strategy">
              <Card className="p-5 space-y-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-semibold flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      GEO Стратегия
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI-сгенерированный план действий на 30/60/90 дней на основе данных аудита.
                    </p>
                  </div>
                  <Button onClick={generateGeoPlan} disabled={planLoading || results.length === 0}>
                    {planLoading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1" />}
                    {geoPlan ? 'Перегенерировать' : 'Сгенерировать GEO-план'}
                  </Button>
                </div>
                {geoPlan ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{geoPlan}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {results.length === 0
                      ? 'Сначала запустите прогон, чтобы собрать данные для плана.'
                      : 'Нажмите кнопку, чтобы AI составил персональный план роста видимости в LLM.'}
                  </p>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="keywords">
              <Card className="p-4 space-y-3">
                <div className="flex gap-2">
                  <Input value={newKw} onChange={(e) => setNewKw(e.target.value)}
                    placeholder="Новый ключевой запрос"
                    onKeyDown={(e) => e.key === 'Enter' && addKeyword()} />
                  <Button onClick={addKeyword}><Plus className="w-4 h-4 mr-1" />Добавить</Button>
                </div>
                {keywords.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Запросов нет. Добавьте первый.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Запрос</TableHead>
                        <TableHead className="w-[180px]">Последний прогон</TableHead>
                        <TableHead className="w-[60px]" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keywords.map((k) => (
                        <TableRow key={k.id}>
                          <TableCell>{k.keyword}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {k.last_checked_at ? new Date(k.last_checked_at).toLocaleString('ru-RU') : '—'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => removeKeyword(k.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="results">
              <Card className="p-4">
                {results.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Результатов пока нет. Запустите прогон.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Запрос</TableHead>
                        <TableHead>Модель</TableHead>
                        <TableHead>Видимость</TableHead>
                        <TableHead>Домен</TableHead>
                        <TableHead>Тон</TableHead>
                        <TableHead>Конкуренты</TableHead>
                        <TableHead className="w-[120px]">Когда</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {results.map((r) => {
                        const kw = keywords.find((k) => k.id === r.keyword_id);
                        return (
                          <TableRow key={r.id} className="cursor-pointer" onClick={() => setSelectedResult(r)}>
                            <TableCell className="max-w-[220px] truncate">{kw?.keyword || '—'}</TableCell>
                            <TableCell><Badge variant="outline">{MODEL_LABELS[r.model] || r.model}</Badge></TableCell>
                            <TableCell>
                              {r.brand_mentioned
                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                : <XCircle className="w-4 h-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell>
                              {r.domain_linked
                                ? <CheckCircle2 className="w-4 h-4 text-green-500" />
                                : <XCircle className="w-4 h-4 text-muted-foreground" />}
                            </TableCell>
                            <TableCell className="text-xs">{r.sentiment || '—'}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {(r.competitor_domains || []).slice(0, 3).join(', ')}
                              {(r.competitor_domains?.length || 0) > 3 && '…'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(r.checked_at).toLocaleString('ru-RU')}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        ) : (
          <Card className="p-12 text-center space-y-3">
            <RadarIcon className="w-12 h-12 text-primary/40 mx-auto" />
            <h2 className="text-lg font-semibold">Создайте первый проект</h2>
            <p className="text-sm text-muted-foreground">Укажите бренд и домен — и начнём мониторинг видимости в ответах ИИ.</p>
          </Card>
        )}

        <Dialog open={!!selectedResult} onOpenChange={(o) => !o && setSelectedResult(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedResult && (MODEL_LABELS[selectedResult.model] || selectedResult.model)} — ответ ИИ
              </DialogTitle>
            </DialogHeader>
            {selectedResult && (
              <div className="space-y-3 text-sm">
                <div className="flex gap-2 flex-wrap">
                  <Badge variant={selectedResult.brand_mentioned ? 'default' : 'secondary'}>
                    Бренд: {selectedResult.brand_mentioned ? 'упомянут' : 'нет'}
                  </Badge>
                  <Badge variant={selectedResult.domain_linked ? 'default' : 'secondary'}>
                    Домен: {selectedResult.domain_linked ? 'найден' : 'нет'}
                  </Badge>
                  <Badge variant="outline">Тон: {selectedResult.sentiment}</Badge>
                </div>
                <div className="whitespace-pre-wrap bg-muted p-3 rounded text-xs">
                  {selectedResult.ai_response_text || '—'}
                </div>
                {selectedResult.competitor_domains?.length > 0 && (
                  <div>
                    <div className="font-semibold mb-1">Конкуренты в ответе:</div>
                    <div className="flex flex-wrap gap-1">
                      {selectedResult.competitor_domains.map((d) => (
                        <Badge key={d} variant="secondary">{d}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}