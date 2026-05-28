import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ChevronDown, ChevronRight, ExternalLink, ShieldAlert, Link2, FileSearch,
  CheckCircle2, AlertTriangle, Info, AlertCircle, HelpCircle, Trash2, Lock, FileDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { CrawlerStatusIndicator } from './CrawlerStatusIndicator';
import { AuditInsightsBlock } from './AuditInsightsBlock';
import { downloadTechnicalAuditDocx } from '@/lib/audit/exportTechnicalAuditDocx';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type CheckInfo = { description: string; importance: 'Критическая' | 'Высокая' | 'Средняя' | 'Низкая' };

function computeScore(stats: { total_pages?: number | null; critical_count?: number | null; warning_count?: number | null; score?: number | null } | null | undefined): number {
  if (!stats) return 0;
  if (typeof stats.score === 'number' && stats.score > 0) return stats.score;
  const pages = Math.max(1, stats.total_pages ?? 0);
  const critical = stats.critical_count ?? 0;
  const warnings = stats.warning_count ?? 0;
  const penalty = (critical * 2 + warnings * 0.5) / pages;
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}
const CHECK_INFO: Record<string, CheckInfo> = {
  no_https: { importance: 'Высокая', description: 'Сайт не использует HTTPS — фактор ранжирования и безопасности.' },
  no_robots_txt: { importance: 'Высокая', description: 'Нет robots.txt — нет управления индексацией.' },
  robots_blocks_all: { importance: 'Критическая', description: 'robots.txt блокирует весь сайт.' },
  no_sitemap: { importance: 'Высокая', description: 'Нет sitemap.xml — карта сайта помогает индексации.' },
  slow_ttfb: { importance: 'Высокая', description: 'TTFB более 3 секунд — плохо влияет на ранжирование.' },
  noindex_meta: { importance: 'Критическая', description: 'Страница закрыта от индексации тегом noindex.' },
  status_404: { importance: 'Высокая', description: 'Страницы с 404 ошибкой.' },
  status_500: { importance: 'Высокая', description: 'Ошибки 500 на сервере.' },
  missing_h1: { importance: 'Высокая', description: 'Страница без заголовка H1.' },
  missing_title: { importance: 'Высокая', description: 'Страница без тега title.' },
  missing_description: { importance: 'Высокая', description: 'Нет meta description.' },
  duplicate_title: { importance: 'Высокая', description: 'Дубли title между страницами.' },
  duplicate_h1: { importance: 'Высокая', description: 'Дубли H1 между страницами.' },
  missing_alt: { importance: 'Средняя', description: 'Картинки без alt.' },
  broken_link: { importance: 'Высокая', description: 'Битые внутренние ссылки.' },
};
const IMPORTANCE_CLS: Record<string, string> = {
  'Критическая': 'text-red-400', 'Высокая': 'text-orange-400',
  'Средняя': 'text-yellow-400', 'Низкая': 'text-blue-400',
};

type CheckDef = { code: string; label: string; severity: 'critical' | 'warning' | 'info' };
type SectionDef = { id: string; title: string; types: string[]; checks: CheckDef[]; icon: any; description: string };

const SECTIONS: SectionDef[] = [
  {
    id: 'technical', title: 'Технические ошибки', icon: ShieldAlert,
    description: 'HTTPS, robots, sitemap, скорость ответа сервера', types: ['technical'],
    checks: [
      { code: 'no_https', label: 'Сайт не использует HTTPS', severity: 'critical' },
      { code: 'no_robots_txt', label: 'Нет файла robots.txt', severity: 'warning' },
      { code: 'robots_blocks_all', label: 'robots.txt блокирует весь сайт', severity: 'critical' },
      { code: 'no_sitemap', label: 'Нет sitemap.xml', severity: 'warning' },
      { code: 'slow_ttfb', label: 'Медленный ответ сервера (>3 сек)', severity: 'critical' },
      { code: 'noindex_meta', label: 'Страница закрыта от индексации', severity: 'critical' },
      { code: 'status_404', label: 'Страницы с ошибкой 404', severity: 'critical' },
      { code: 'status_500', label: 'Страницы с ошибкой 500', severity: 'critical' },
      { code: 'mixed_content', label: 'Mixed content', severity: 'warning' },
    ],
  },
  {
    id: 'links', title: 'Ссылки и контент', icon: Link2,
    description: 'Внутренние и внешние ссылки', types: ['links'],
    checks: [
      { code: 'broken_link', label: 'Битые внутренние ссылки', severity: 'critical' },
      { code: 'http_link', label: 'Ссылки с HTTP на HTTPS сайте', severity: 'warning' },
      { code: 'external_link', label: 'Исходящие внешние ссылки', severity: 'info' },
    ],
  },
  {
    id: 'onpage', title: 'Ошибки парсера', icon: FileSearch,
    description: 'Title, description, H1, изображения', types: ['onpage', 'media'],
    checks: [
      { code: 'missing_h1', label: 'Страницы без H1', severity: 'critical' },
      { code: 'duplicate_h1', label: 'Дубли страниц по H1', severity: 'warning' },
      { code: 'missing_title', label: 'Страницы без title', severity: 'critical' },
      { code: 'duplicate_title', label: 'Дубли страниц по title', severity: 'warning' },
      { code: 'missing_description', label: 'Страницы без description', severity: 'warning' },
      { code: 'missing_alt', label: 'Картинки без alt', severity: 'warning' },
    ],
  },
  {
    id: 'security', title: 'Безопасность', icon: Lock,
    description: 'SSL сертификат, заголовки безопасности', types: ['security'],
    checks: [
      { code: 'ssl_expiring_soon', label: 'SSL истекает менее чем через 30 дней', severity: 'warning' },
      { code: 'no_hsts', label: 'Нет заголовка HSTS', severity: 'warning' },
    ],
  },
];

const SEV_CLS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};
const SEV_LABEL: Record<string, string> = { critical: 'Критическая', warning: 'Предупреждение', info: 'Информация' };
const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };
const SEV_ICON: Record<string, any> = { critical: AlertCircle, warning: AlertTriangle, info: Info, ok: CheckCircle2 };
const SEV_ICON_COLOR: Record<string, string> = {
  critical: 'text-red-400', warning: 'text-yellow-400', info: 'text-blue-400', ok: 'text-emerald-400',
};

function extractUrl(issue: any): string | null {
  if (issue?.page_url) return issue.page_url;
  const d = issue?.details;
  if (d && typeof d === 'object') {
    if (typeof d.url === 'string') return d.url;
    if (typeof d.page_url === 'string') return d.page_url;
  }
  return null;
}
function pageWord(n: number) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'страница';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'страницы';
  return 'страниц';
}

function AuditSection({ section, issues }: { section: SectionDef; issues: any[] }) {
  const [sectionOpen, setSectionOpen] = useState(true);
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>({});
  const sectionCodes = new Set(section.checks.map((c) => c.code));
  const sectionIssues = (issues ?? []).filter((i) => section.types.includes(i.type) || sectionCodes.has(i.code));
  type Group = { items: { url: string | null; details: any }[]; total: number; severity: string };
  const groupMap = new Map<string, Group>();
  for (const i of sectionIssues) {
    const code = i.code || 'unknown';
    let g = groupMap.get(code);
    if (!g) { g = { items: [], total: 0, severity: i.severity || 'info' }; groupMap.set(code, g); }
    g.total += 1;
    g.items.push({ url: extractUrl(i), details: i.details });
    if ((SEV_ORDER[i.severity] ?? 9) < (SEV_ORDER[g.severity] ?? 9)) g.severity = i.severity;
  }
  const rows = section.checks.map((c) => ({
    code: c.code, label: c.label,
    severity: groupMap.get(c.code)?.severity ?? c.severity,
    group: groupMap.get(c.code),
  })).sort((a, b) => {
    const aH = !!a.group, bH = !!b.group;
    if (aH !== bH) return aH ? -1 : 1;
    return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
  });
  const problemCount = rows.filter((r) => !!r.group).length;
  const hasCritical = rows.some((r) => !!r.group && r.severity === 'critical');
  const hasWarning = rows.some((r) => !!r.group && r.severity === 'warning');
  const Icon = section.icon;

  return (
    <Card className="bg-card border-border overflow-hidden">
      <button type="button" onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left">
        <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
          problemCount === 0 ? 'bg-emerald-500/15' : hasCritical ? 'bg-red-500/15' : hasWarning ? 'bg-yellow-500/15' : 'bg-blue-500/15')}>
          <Icon className={cn('h-5 w-5',
            problemCount === 0 ? 'text-emerald-400' : hasCritical ? 'text-red-400' : hasWarning ? 'text-yellow-400' : 'text-blue-400')} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
        </div>
        <Badge className={cn('text-[11px] border',
          problemCount === 0 ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            : hasCritical ? 'bg-red-500/15 text-red-400 border-red-500/30'
            : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30')}>
          {problemCount === 0 ? 'Ошибок нет' : `Найдено: ${problemCount}`}
        </Badge>
        {sectionOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
      </button>
      {sectionOpen && (
        <div className="border-t border-border divide-y divide-border">
          {rows.map((r) => {
            const has = !!r.group;
            const items = r.group ? r.group.items : [];
            const uniqueUrls = Array.from(new Set(items.map((it) => it.url).filter(Boolean) as string[]));
            const pages = uniqueUrls.length || r.group?.total || 0;
            const sevKey = has ? r.severity : 'ok';
            const SevIcon = SEV_ICON[sevKey];
            const isOpen = !!rowOpen[r.code];
            return (
              <div key={r.code}>
                <button type="button" disabled={!has}
                  onClick={() => has && setRowOpen((p) => ({ ...p, [r.code]: !p[r.code] }))}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                    has ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default')}>
                  <SevIcon className={cn('h-4 w-4 shrink-0', SEV_ICON_COLOR[sevKey])} />
                  <span className={cn('flex-1 min-w-0 flex items-center gap-1.5 text-[13px]', has ? 'text-foreground' : 'text-muted-foreground')}>
                    <span className="truncate">{r.label}</span>
                    {CHECK_INFO[r.code] && (
                      <TooltipProvider delayDuration={150}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span onClick={(e) => e.stopPropagation()} className="inline-flex shrink-0 text-muted-foreground hover:text-foreground cursor-help">
                              <HelpCircle className="h-3.5 w-3.5" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[320px] text-[12px]">
                            <div className="space-y-1.5">
                              <div className="font-semibold">{r.label}</div>
                              <div>{CHECK_INFO[r.code].description}</div>
                              <div className="pt-1 border-t border-border">
                                <span className="text-muted-foreground">Важность: </span>
                                <span className={cn('font-semibold', IMPORTANCE_CLS[CHECK_INFO[r.code].importance])}>
                                  {CHECK_INFO[r.code].importance}
                                </span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </span>
                  {has ? (
                    <>
                      <Badge className="bg-muted text-foreground/90 text-[11px] border-0">{pages} {pageWord(pages)}</Badge>
                      <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium', SEV_CLS[r.severity] ?? SEV_CLS.info)}>
                        {SEV_LABEL[r.severity] ?? r.severity}
                      </span>
                      {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                    </>
                  ) : (
                    <span className="text-[11px] text-emerald-400">Ошибок нет</span>
                  )}
                </button>
                {has && isOpen && (
                  <div className="px-4 py-3 pl-11 space-y-1 bg-muted/30">
                    {uniqueUrls.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">URL не переданы краулером</div>
                    ) : uniqueUrls.slice(0, 100).map((u, i) => (
                      <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-[12px] text-primary hover:underline font-mono">
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        <span className="truncate">{u}</span>
                      </a>
                    ))}
                    {uniqueUrls.length > 100 && (
                      <div className="text-[11px] text-muted-foreground">…и ещё {uniqueUrls.length - 100}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

export function TechnicalAuditView({ domain }: { domain: string }) {
  const [scanStatus, setScanStatus] = useState<'idle' | 'pending' | 'running' | 'done' | 'completed' | 'error'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [confirmStopOpen, setConfirmStopOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const queryClient = useQueryClient();

  // Restore latest job for this domain
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('crawl_jobs')
        .select('*')
        .eq('domain', domain)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setJobId(data.id);
        setScanStatus(data.status as any);
        setScanProgress(data.progress ?? 0);
      }
    })();
  }, [domain]);

  // Realtime + polling fallback (realtime publication may lag/miss events)
  useEffect(() => {
    if (!jobId) return;
    let cancelled = false;
    const applyRow = (row: any) => {
      if (cancelled || !row) return;
      setScanStatus(row.status);
      setScanProgress(row.progress ?? 0);
    };
    const ch = supabase
      .channel(`crawl-job-${jobId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'crawl_jobs', filter: `id=eq.${jobId}` },
        (payload: any) => {
          const row = payload.new;
          applyRow(row);
          if (row.status === 'completed' || row.status === 'done') toast.success('Аудит завершён');
          if (row.status === 'error') toast.error('Ошибка аудита: ' + (row.error_message ?? ''));
        })
      .subscribe();

    // Poll every 3s while the job is not in a terminal state — covers the case
    // when realtime events get lost.
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('crawl_jobs')
        .select('status, progress, error_message')
        .eq('id', jobId)
        .maybeSingle();
      if (!data) return;
      const prevStatus = scanStatus;
      applyRow(data);
      if ((data.status === 'completed' || data.status === 'done') &&
          prevStatus !== 'completed' && prevStatus !== 'done') {
        queryClient.invalidateQueries({ queryKey: ['crawl-stats', jobId] });
        queryClient.invalidateQueries({ queryKey: ['crawl-issues-all', jobId] });
      }
      if (data.status === 'completed' || data.status === 'done' || data.status === 'error') {
        clearInterval(poll);
      }
    }, 3000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      supabase.removeChannel(ch);
    };
  }, [jobId, queryClient]);

  const isDone = scanStatus === 'completed' || scanStatus === 'done';

  const { data: jobStats } = useQuery({
    queryKey: ['crawl-stats', jobId],
    enabled: !!jobId && isDone,
    queryFn: async () => {
      const { data } = await supabase.from('crawl_stats').select('*').eq('job_id', jobId!).maybeSingle();
      return data;
    },
  });

  const { data: jobIssues = [] } = useQuery({
    queryKey: ['crawl-issues-all', jobId],
    enabled: !!jobId && isDone,
    queryFn: async () => {
      const { data } = await supabase
        .from('crawl_issues')
        .select('id, type, severity, code, message, page_url, details')
        .eq('job_id', jobId!);
      return (data ?? []) as any[];
    },
  });

  const { data: scannedPages = 0 } = useQuery({
    queryKey: ['crawl-pages-count', jobId, scanStatus],
    enabled: !!jobId && (scanStatus === 'running' || scanStatus === 'pending'),
    refetchInterval: 3000,
    queryFn: async () => {
      const { count } = await supabase
        .from('crawl_pages').select('id', { count: 'exact', head: true }).eq('job_id', jobId!);
      return count ?? 0;
    },
  });

  const handleStart = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) { toast.error('Войдите в систему'); return; }
    const cleanDomain = domain.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (!cleanDomain) { toast.error('Введите домен'); return; }
    const { data: job, error } = await supabase
      .from('crawl_jobs')
      .insert({ user_id: u.user.id, domain: cleanDomain, status: 'pending', progress: 0 })
      .select().single();
    if (error || !job) { toast.error('Не удалось создать задание: ' + (error?.message ?? '')); return; }
    setJobId(job.id);
    setScanStatus('pending');
    setScanProgress(0);
    toast.success('Задание создано — ожидает запуска краулера');
  };

  const handleStop = async () => {
    if (!jobId) return;
    setConfirmStopOpen(false);
    setStopping(true);
    try {
      const { error } = await supabase.functions.invoke('stop-audit', { body: { job_id: jobId } });
      if (error) throw error;
      setScanStatus('error');
      toast.success('Аудит остановлен');
    } catch (e: any) {
      toast.error('Не удалось остановить: ' + (e?.message ?? ''));
    } finally { setStopping(false); }
  };

  const handleReset = async () => {
    setConfirmResetOpen(false);
    setResetting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Не авторизованы');
      const { data: jobs } = await supabase
        .from('crawl_jobs').select('id').eq('user_id', u.user.id).eq('domain', domain);
      const jobIds = (jobs ?? []).map((j: any) => j.id);
      if (jobIds.length > 0) {
        await supabase.from('crawl_jobs').delete().in('id', jobIds);
      }
      setJobId(null);
      setScanStatus('idle');
      setScanProgress(0);
      await queryClient.invalidateQueries({ queryKey: ['crawl-stats'] });
      await queryClient.invalidateQueries({ queryKey: ['crawl-issues-all'] });
      toast.success('Данные сканирования удалены');
    } catch (e: any) {
      toast.error('Не удалось сбросить: ' + (e?.message ?? ''));
    } finally { setResetting(false); }
  };

  const isRunning = scanStatus === 'pending' || scanStatus === 'running';

  const handleExport = async () => {
    if (!jobId) return;
    try {
      await downloadTechnicalAuditDocx({
        domain,
        stats: jobStats ?? null,
        issues: jobIssues as any[],
      });
      toast.success('Отчёт сформирован');
    } catch (e: any) {
      toast.error('Не удалось сформировать отчёт: ' + (e?.message ?? ''));
    }
  };

  return (
    <div className="space-y-5">
      {isDone && jobId && <AuditInsightsBlock jobId={jobId} />}

      <Card className="bg-card border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Технический аудит</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              <span>Сайт: <span className="text-foreground font-medium">{domain}</span></span>
              <span>Дата: <span className="text-foreground">{format(new Date(), 'dd.MM.yyyy')}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {isDone && jobId && (
              <Button variant="outline" size="sm" onClick={handleExport}
                className="gap-1.5 text-[12px]">
                <FileDown className="h-3.5 w-3.5" />
                Отчёт + ТЗ (Word)
              </Button>
            )}
            {(jobId || scanStatus !== 'idle') && (
              <Button variant="outline" size="sm" disabled={resetting || isRunning}
                onClick={() => setConfirmResetOpen(true)}
                className="gap-1.5 text-[12px] border-destructive/40 text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" />{resetting ? 'Сброс…' : 'Сбросить'}
              </Button>
            )}
            {isRunning && jobId && (
              <Button variant="outline" size="sm" disabled={stopping}
                onClick={() => setConfirmStopOpen(true)}
                className="gap-1.5 text-[12px] border-destructive/40 text-destructive hover:bg-destructive/10">
                <span className="h-2.5 w-2.5 rounded-sm bg-destructive" />
                {stopping ? 'Остановка…' : 'Стоп'}
              </Button>
            )}
            <CrawlerStatusIndicator />
            <Button size="sm" onClick={handleStart} disabled={isRunning}
              className={cn('gap-1.5 text-[12px]', isRunning && 'opacity-80')}>
              {isRunning ? (
                <><span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />Аудит идёт…</>
              ) : isDone ? 'Перезапустить' : 'Запустить аудит'}
            </Button>
          </div>
        </div>
      </Card>

      {isRunning && (
        <Card className="p-3 border bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-4">
            <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 animate-pulse" />
            <div className="min-w-0 leading-tight">
              <div className="text-[13px] font-semibold text-yellow-300">
                {scanStatus === 'pending' ? 'Аудит в очереди' : 'Аудит идёт…'}
              </div>
              <div className="text-[11px] text-muted-foreground">Краулер обходит страницы — не закрывайте вкладку</div>
            </div>
            <div className="flex items-center gap-3 flex-1">
              <Progress value={Math.min(scanProgress, 100)} className="h-2 flex-1" />
              <span className="text-[12px] font-semibold tabular-nums text-yellow-300 shrink-0">
                {Math.max(scannedPages, Math.round(scanProgress))} {pageWord(Math.max(scannedPages, Math.round(scanProgress)))}
              </span>
            </div>
          </div>
        </Card>
      )}

      {isDone && jobStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Всего страниц', value: jobStats.total_pages, icon: FileSearch, cls: 'bg-primary/10 text-primary' },
            { label: 'Критических', value: jobStats.critical_count, icon: AlertCircle, cls: 'bg-destructive/10 text-destructive' },
            { label: 'Предупреждений', value: jobStats.warning_count, icon: AlertTriangle, cls: 'bg-yellow-500/10 text-yellow-400' },
            { label: 'Средний TTFB', value: `${jobStats.avg_load_time_ms} мс`, icon: Info, cls: 'bg-blue-500/10 text-blue-400' },
            { label: 'Оценка', value: `${computeScore(jobStats)}/100`, icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-400' },
          ].map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label} className="bg-card border-border p-4">
                <div className="flex items-center gap-3">
                  <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center', k.cls)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{k.label}</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{k.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {isDone && (
        <div className="space-y-3">
          {SECTIONS.map((s) => (
            <AuditSection key={s.id} section={s} issues={jobIssues} />
          ))}
        </div>
      )}

      {!isDone && !isRunning && (
        <Card className="bg-card border-border p-8 text-center">
          <div className="text-sm text-muted-foreground">
            Запустите аудит, чтобы получить технический анализ сайта
          </div>
        </Card>
      )}

      <AlertDialog open={confirmStopOpen} onOpenChange={setConfirmStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Остановить аудит?</AlertDialogTitle>
            <AlertDialogDescription>
              Текущий прогресс будет помечен как прерванный. Уже собранные данные сохранятся.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Остановить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmResetOpen} onOpenChange={setConfirmResetOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить все данные сканирования?</AlertDialogTitle>
            <AlertDialogDescription>
              Будут удалены все задания, страницы и ошибки по этому домену. Действие необратимо.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}