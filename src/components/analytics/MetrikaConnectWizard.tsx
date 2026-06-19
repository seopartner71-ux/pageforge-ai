import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle2, XCircle, AlertCircle, RefreshCw, ExternalLink, Copy, ArrowLeft, ArrowRight, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';

type Counter = {
  id: number;
  name: string;
  site: string;
  status: string;
  permission: 'own' | 'edit' | 'view' | 'public_stats' | string;
  owner_login?: string;
};

type CheckResult = {
  ok: boolean;
  access: 'granted' | 'denied' | 'not_found' | 'error';
  permission?: string | null;
  counter?: { id: number; name: string; site: string; owner_login?: string; status?: string };
  message?: string;
  yandex_login?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirmed: (counterId: string) => void;
  initialCounterId?: string;
};

const PERM_LABEL: Record<string, string> = {
  own: 'Владелец', edit: 'Редактор', view: 'Просмотр', public_stats: 'Публичная статистика',
};

export function MetrikaConnectWizard({ open, onOpenChange, onConfirmed, initialCounterId }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [connected, setConnected] = useState<{ login: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [counters, setCounters] = useState<Counter[] | null>(null);
  const [counterId, setCounterId] = useState(initialCounterId ?? '');
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(1); setCheck(null); setListError(null);
    refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function refreshStatus() {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('seo-recovery-analyze', { body: { mode: 'check', date1: '2024-01-01', date2: '2024-01-02' } });
      if (error) throw error;
      const c = data as any;
      if (c?.metrika_connected) {
        setConnected({ login: c.metrika_login ?? null });
        await loadCounters();
        setStep(2);
      } else {
        setConnected(null);
        setStep(1);
      }
    } catch (e: any) {
      toast.error('Не удалось проверить подключение: ' + e?.message);
    } finally { setLoading(false); }
  }

  async function loadCounters() {
    setListError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('metrika-counters', { body: { action: 'list' } });
      if (error) throw error;
      const d = data as any;
      if (d?.error) { setListError(d.message || d.error); setCounters([]); return; }
      setCounters(d.counters ?? []);
    } catch (e: any) {
      setListError(e?.message || 'Ошибка загрузки счётчиков');
      setCounters([]);
    } finally { setLoading(false); }
  }

  async function connectYandex() {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const { data, error } = await supabase.functions.invoke('yandex-oauth-start', {
        body: {}, headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if ((data as any)?.url) {
        const popup = window.open((data as any).url, '_blank', 'width=600,height=720');
        const listener = (ev: MessageEvent) => {
          if (ev?.data?.type === 'yandex-oauth-done') {
            window.removeEventListener('message', listener);
            refreshStatus();
          }
        };
        window.addEventListener('message', listener);
        // Fallback poll
        const poll = setInterval(async () => {
          if (popup?.closed) { clearInterval(poll); refreshStatus(); }
        }, 1500);
      }
    } catch (e: any) { toast.error('OAuth: ' + (e?.message || 'ошибка')); }
  }

  async function runCheck(id?: string) {
    const cid = (id ?? counterId).trim();
    if (!cid) { toast.error('Укажите ID счётчика'); return; }
    setCounterId(cid);
    setLoading(true); setCheck(null);
    try {
      const { data, error } = await supabase.functions.invoke('metrika-counters', { body: { action: 'check', counter_id: cid } });
      if (error) throw error;
      setCheck(data as CheckResult);
      setStep(3);
    } catch (e: any) { toast.error('Проверка: ' + (e?.message || 'ошибка')); }
    finally { setLoading(false); }
  }

  const grantEmail = connected?.login ? `${connected.login}@yandex.ru` : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Мастер подключения Яндекс Метрики</DialogTitle>
          <DialogDescription>
            Шаг {step} из 3 — {step === 1 ? 'подключение аккаунта' : step === 2 ? 'выбор счётчика' : 'проверка доступа'}
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 text-xs">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`flex-1 h-1.5 rounded-full ${s <= step ? 'bg-primary' : 'bg-muted'}`} />
          ))}
        </div>

        {/* Step 1: connect */}
        {step === 1 && (
          <div className="space-y-4 py-2">
            <Card className="p-4 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="text-sm">
                  Подключите Яндекс-аккаунт через OAuth. Используйте тот аккаунт, у которого есть доступ к нужному счётчику Метрики (или попросите владельца дать доступ — это покажем на шаге 3).
                </div>
              </div>
              <Button onClick={connectYandex} disabled={loading}>
                <LinkIcon className="w-4 h-4 mr-2" />Подключить Яндекс
              </Button>
            </Card>
          </div>
        )}

        {/* Step 2: pick counter */}
        {step === 2 && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm">
                Подключено: <span className="font-medium">{connected?.login ?? 'аккаунт'}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={loadCounters} disabled={loading}>
                <RefreshCw className="w-3.5 h-3.5 mr-1" />Обновить список
              </Button>
            </div>

            {listError && (
              <Card className="p-3 border-rose-500/40 bg-rose-500/5 text-sm">{listError}</Card>
            )}

            {loading && !counters && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />Загрузка счётчиков…
              </div>
            )}

            {counters && counters.length > 0 && (
              <ScrollArea className="h-64 border rounded-md">
                <div className="divide-y">
                  {counters.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => runCheck(String(c.id))}
                      className="w-full text-left p-3 hover:bg-muted/40 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name || c.site || c.id}</div>
                        <div className="text-xs text-muted-foreground truncate">{c.site} · ID {c.id}</div>
                      </div>
                      <Badge variant="outline" className={c.permission === 'own' || c.permission === 'edit' || c.permission === 'view' ? 'border-emerald-500/40 text-emerald-600' : 'border-amber-500/40 text-amber-600'}>
                        {PERM_LABEL[c.permission] ?? c.permission}
                      </Badge>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}

            {counters && counters.length === 0 && !listError && (
              <Card className="p-3 text-sm text-muted-foreground">
                У этого аккаунта нет счётчиков. Введите ID счётчика вручную — мы проверим доступ и подскажем, как его получить.
              </Card>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cid">Или введите ID счётчика вручную</Label>
              <div className="flex gap-2">
                <Input id="cid" placeholder="напр. 12345678" value={counterId} onChange={(e) => setCounterId(e.target.value.trim())} />
                <Button onClick={() => runCheck()} disabled={loading || !counterId}>
                  Проверить<ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: verify */}
        {step === 3 && check && (
          <div className="space-y-4 py-2">
            {check.access === 'granted' && (
              <Card className="p-4 border-emerald-500/40 bg-emerald-500/5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-600 font-medium">
                  <CheckCircle2 className="w-5 h-5" />Доступ подтверждён
                </div>
                <div className="text-sm">
                  Счётчик <span className="font-medium">{check.counter?.name || check.counter?.id}</span>
                  {check.counter?.site && <> · {check.counter.site}</>}<br />
                  Уровень прав: <Badge variant="outline" className="ml-1">{PERM_LABEL[check.permission ?? ''] ?? check.permission}</Badge>
                </div>
              </Card>
            )}

            {check.access === 'denied' && (
              <Card className="p-4 border-amber-500/40 bg-amber-500/5 space-y-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium">
                  <XCircle className="w-5 h-5" />Нет доступа к счётчику
                </div>
                <div className="text-sm">
                  Аккаунт <span className="font-medium">{check.yandex_login}</span> не имеет прав на счётчик <span className="font-mono">{counterId}</span>.
                  Владелец должен предоставить доступ — это бесплатно и занимает 30 секунд.
                </div>
                <div className="rounded-md border bg-background p-3 space-y-2 text-sm">
                  <div className="font-medium">Как предоставить доступ (инструкция для владельца):</div>
                  <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                    <li>Открыть <a className="text-primary inline-flex items-center gap-1" target="_blank" rel="noreferrer" href={`https://metrika.yandex.ru/settings?id=${counterId}&tab=access`}>Настройки счётчика → вкладка «Доступ» <ExternalLink className="w-3 h-3" /></a></li>
                    <li>Нажать «Добавить пользователя»</li>
                    <li>Указать логин Яндекса и уровень «Только просмотр»</li>
                    <li>Сохранить</li>
                  </ol>
                  {grantEmail && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-xs text-muted-foreground">Логин для доступа:</span>
                      <code className="text-xs px-2 py-1 rounded bg-muted">{connected?.login}</code>
                      <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(connected!.login!); toast.success('Скопировано'); }}>
                        <Copy className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button variant="outline" onClick={() => runCheck()} disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Проверить ещё раз
                </Button>
              </Card>
            )}

            {check.access === 'not_found' && (
              <Card className="p-4 border-rose-500/40 bg-rose-500/5 text-sm">
                Счётчик <span className="font-mono">{counterId}</span> не найден. Проверьте ID в интерфейсе Метрики.
              </Card>
            )}

            {check.access === 'error' && (
              <Card className="p-4 border-rose-500/40 bg-rose-500/5 text-sm">
                Ошибка проверки: {check.message || 'неизвестная'}
              </Card>
            )}
          </div>
        )}

        <DialogFooter className="flex items-center justify-between gap-2 sm:justify-between">
          <div>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)}>
                <ArrowLeft className="w-4 h-4 mr-1" />Назад
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            {step === 3 && check?.access === 'granted' && (
              <Button onClick={() => { onConfirmed(String(check.counter?.id ?? counterId)); onOpenChange(false); }}>
                Использовать этот счётчик
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}