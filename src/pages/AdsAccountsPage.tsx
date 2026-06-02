import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { AppHeader } from '@/components/AppHeader';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Plug, Plus, RefreshCw, CheckCircle2, AlertCircle, ExternalLink, Trash2,
} from 'lucide-react';

type Account = {
  id: string; name: string; external_id: string; provider: string;
  status: string; currency: string; last_synced_at: string | null;
  project_id: string; created_at: string;
};
type Project = { id: string; name: string };
type ImportJob = {
  id: string; account_id: string; status: string; step: string | null;
  progress: number; total: number; error: string | null;
  imported_campaigns: number; imported_metric_rows: number; imported_query_rows: number;
  started_at: string | null; finished_at: string | null;
};

const STEP_LABELS: Record<string, string> = {
  queued: 'В очереди',
  campaigns: 'Импорт кампаний',
  daily_metrics: 'Импорт ежедневных метрик',
  search_queries: 'Импорт поисковых запросов',
  done: 'Готово',
};

const STATUS_BADGES: Record<string, { label: string; cls: string }> = {
  connected: { label: 'Подключён', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  syncing:   { label: 'Синхронизация', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  error:     { label: 'Ошибка', cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
  disconnected: { label: 'Отключён', cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};

export default function AdsAccountsPage() {
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [jobs, setJobs] = useState<Record<string, ImportJob>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [resyncing, setResyncing] = useState<Record<string, boolean>>({});
  const [codeDialogOpen, setCodeDialogOpen] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [exchanging, setExchanging] = useState(false);
  const [pendingProjectId, setPendingProjectId] = useState<string>('');

  const load = async () => {
    const [{ data: accs }, { data: projs }, { data: js }] = await Promise.all([
      supabase.from('ads_accounts').select('*').order('created_at', { ascending: false }),
      supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
      supabase.from('ads_import_jobs').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    setAccounts((accs as Account[]) ?? []);
    setProjects((projs as Project[]) ?? []);
    const latest: Record<string, ImportJob> = {};
    for (const j of (js as ImportJob[]) ?? []) {
      if (!latest[j.account_id]) latest[j.account_id] = j;
    }
    setJobs(latest);
    if (!selectedProjectId && projs && projs.length > 0) {
      setSelectedProjectId(projs[0].id);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Subscribe to job progress in realtime
  useEffect(() => {
    const ch = supabase
      .channel('ads-import-jobs')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'ads_import_jobs' },
        (payload) => {
          const row = payload.new as ImportJob;
          if (!row?.id) return;
          setJobs((prev) => ({ ...prev, [row.account_id]: row }));
          if (row.status === 'completed') {
            toast.success('Импорт завершён');
            load();
          }
          if (row.status === 'failed') toast.error(`Импорт упал: ${row.error ?? ''}`);
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const connectYandex = async () => {
    if (!selectedProjectId) {
      toast.error('Выберите проект');
      return;
    }
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('yandex-direct-oauth-start', {
        body: { project_id: selectedProjectId },
      });
      if (error || !data?.authorize_url) throw new Error(error?.message ?? 'No URL');
      // Open Yandex authorization in a new tab. The user will see a verification
      // code on https://oauth.yandex.ru/verification_code and paste it back.
      window.open(data.authorize_url, '_blank', 'noopener,noreferrer');
      setPendingProjectId(selectedProjectId);
      setCodeInput('');
      setCodeDialogOpen(true);
    } catch (e) {
      toast.error(`Ошибка: ${(e as Error).message}`);
    } finally {
      setConnecting(false);
    }
  };

  const submitCode = async () => {
    const code = codeInput.trim();
    if (!code) { toast.error('Введите код подтверждения'); return; }
    if (!pendingProjectId) { toast.error('Проект не выбран'); return; }
    setExchanging(true);
    try {
      const { data, error } = await supabase.functions.invoke('yandex-direct-oauth-callback', {
        body: { code, project_id: pendingProjectId },
      });
      if (error) throw new Error(error.message);
      if (!data?.ok) throw new Error(data?.error ?? 'Не удалось обменять код');
      toast.success(`Подключён аккаунт ${data.account?.login ?? ''}. Импорт запущен.`);
      setCodeDialogOpen(false);
      setCodeInput('');
      load();
    } catch (e) {
      toast.error(`Не удалось подключить: ${(e as Error).message}`);
    } finally {
      setExchanging(false);
    }
  };

  const resync = async (acc: Account) => {
    setResyncing((s) => ({ ...s, [acc.id]: true }));
    try {
      // Create job + invoke import
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Не авторизован');
      const { data: job, error } = await supabase
        .from('ads_import_jobs')
        .insert({
          user_id: user.id, project_id: acc.project_id, account_id: acc.id,
          provider: acc.provider, status: 'pending', step: 'queued',
        })
        .select('*').single();
      if (error || !job) throw error ?? new Error('insert failed');
      setJobs((p) => ({ ...p, [acc.id]: job as ImportJob }));
      const { error: invErr } = await supabase.functions.invoke('yandex-direct-import', {
        body: { job_id: job.id },
      });
      if (invErr) throw invErr;
      toast.info('Синхронизация запущена');
    } catch (e) {
      toast.error(`Не удалось запустить синхронизацию: ${(e as Error).message}`);
    } finally {
      setResyncing((s) => ({ ...s, [acc.id]: false }));
    }
  };

  const removeAccount = async (acc: Account) => {
    if (!confirm(`Отключить и удалить аккаунт ${acc.name}? Импортированные данные тоже будут удалены.`)) return;
    const { error } = await supabase.from('ads_accounts').delete().eq('id', acc.id);
    if (error) toast.error(error.message);
    else { toast.success('Аккаунт удалён'); load(); }
  };

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name ?? '—';

  const yandexAccounts = useMemo(
    () => accounts.filter((a) => a.provider === 'yandex_direct'),
    [accounts],
  );

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200">
      <AppHeader />
      <main className="px-6 py-5 max-w-[1200px] mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">Рекламные кабинеты</h1>
            <p className="text-sm text-slate-400 mt-1">
              Подключите рекламные кабинеты, чтобы данные автоматически попадали в дашборд.
            </p>
          </div>
        </div>

        {/* Connect card */}
        <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-5">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-11 h-11 rounded-xl bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0">
              <Plug className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-[240px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-semibold text-slate-100">Яндекс.Директ</h2>
                <Badge variant="outline" className="text-[10px] bg-blue-500/15 text-blue-400 border-blue-500/30">
                  OAuth
                </Badge>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Безопасная авторизация через Яндекс ID. Мы импортируем кампании, ежедневные метрики
                и поисковые запросы за последние 90 дней.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
                <SelectTrigger className="w-[200px] h-9 bg-[#0B0F19] border-slate-800 text-xs text-slate-200">
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent className="bg-[#0B0F19] border-slate-800">
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id} className="text-xs text-slate-200">
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={connectYandex}
                disabled={connecting || !selectedProjectId}
                className="bg-blue-500 hover:bg-blue-600 text-white"
              >
                {connecting
                  ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  : <Plus className="w-4 h-4 mr-2" />}
                Подключить Яндекс
              </Button>
            </div>
          </div>
        </Card>

        {/* List */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-slate-300">Подключённые кабинеты</h3>

          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) =>
                <Skeleton key={i} className="h-24 w-full bg-slate-800/40" />)}
            </div>
          )}

          {!loading && yandexAccounts.length === 0 && (
            <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-8 text-center text-sm text-slate-500">
              Кабинеты не подключены. Нажмите «Подключить Яндекс» выше.
            </Card>
          )}

          {yandexAccounts.map((acc) => {
            const job = jobs[acc.id];
            const running = job?.status === 'running' || job?.status === 'pending';
            const badge = running
              ? STATUS_BADGES.syncing
              : (job?.status === 'failed' ? STATUS_BADGES.error : STATUS_BADGES[acc.status] ?? STATUS_BADGES.connected);
            return (
              <Card key={acc.id} className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
                <div className="flex items-start gap-4 flex-wrap">
                  <div className="w-10 h-10 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0 font-bold text-sm">
                    Я
                  </div>
                  <div className="flex-1 min-w-[200px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-slate-100">{acc.name}</span>
                      <Badge variant="outline" className={`text-[10px] ${badge.cls}`}>{badge.label}</Badge>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>Логин: {acc.external_id}</span>
                      <span>Проект: {projectName(acc.project_id)}</span>
                      <span>Валюта: {acc.currency}</span>
                      {acc.last_synced_at && (
                        <span>Синхр.: {format(new Date(acc.last_synced_at), 'd MMM yyyy, HH:mm', { locale: ru })}</span>
                      )}
                    </div>
                    {running && (
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>{STEP_LABELS[job.step ?? 'queued'] ?? job.step}</span>
                          <span>{job.progress}%</span>
                        </div>
                        <Progress value={job.progress} className="h-1.5" />
                      </div>
                    )}
                    {job?.status === 'completed' && (
                      <div className="mt-2 flex items-center gap-3 text-[11px] text-slate-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Кампаний: {job.imported_campaigns}</span>
                        <span>Метрик: {job.imported_metric_rows}</span>
                        <span>Запросов: {job.imported_query_rows}</span>
                      </div>
                    )}
                    {job?.status === 'failed' && (
                      <div className="mt-2 flex items-start gap-2 text-[11px] text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <span className="break-all">{job.error}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => resync(acc)}
                      disabled={running || resyncing[acc.id]}
                      className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white"
                    >
                      {(running || resyncing[acc.id])
                        ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                      Синхронизировать
                    </Button>
                    <Button
                      variant="outline" size="icon"
                      onClick={() => removeAccount(acc)}
                      className="h-8 w-8 bg-transparent border-slate-700 text-slate-400 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-xl bg-[#0F1729] border-[#1F2937] p-4 text-xs text-slate-400">
          <div className="flex items-start gap-2">
            <ExternalLink className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-400" />
            <span>
              Для работы OAuth в настройках приложения Яндекса должен быть выбран redirect URI{' '}
              <strong>«Подставлять код подтверждения в URL»</strong>:{' '}
              <code className="text-slate-200">https://oauth.yandex.ru/verification_code</code>
            </span>
          </div>
        </Card>
      </main>

      <Dialog open={codeDialogOpen} onOpenChange={(o) => !exchanging && setCodeDialogOpen(o)}>
        <DialogContent className="bg-[#111827] border-[#1F2937] text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-slate-100">Введите код подтверждения Яндекса</DialogTitle>
            <DialogDescription className="text-slate-400">
              Авторизуйтесь во вкладке Яндекса и скопируйте код, который покажет страница{' '}
              <code className="text-slate-300">oauth.yandex.ru/verification_code</code>. Затем вставьте его сюда.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="yandex-code" className="text-xs text-slate-400">Код подтверждения</Label>
            <Input
              id="yandex-code"
              autoFocus
              value={codeInput}
              onChange={(e) => setCodeInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitCode(); }}
              placeholder="например, 1234567"
              className="bg-[#0B0F19] border-slate-800 text-slate-100 tracking-widest font-mono"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCodeDialogOpen(false)}
              disabled={exchanging}
              className="bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800"
            >
              Отмена
            </Button>
            <Button
              onClick={submitCode}
              disabled={exchanging || !codeInput.trim()}
              className="bg-blue-500 hover:bg-blue-600 text-white"
            >
              {exchanging
                ? <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Подключить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}