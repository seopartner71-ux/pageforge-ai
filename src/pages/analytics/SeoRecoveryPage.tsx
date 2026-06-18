import { useEffect, useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { LifeBuoy, Loader2, Play, RefreshCw, AlertCircle, Link as LinkIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SeoRecoveryView } from '@/components/analytics/SeoRecoveryView';
import { useNavigate } from 'react-router-dom';

type Status = { metrika_connected: boolean; metrika_login: string | null; gsc_available: boolean };

function shiftDates(preset: string): { date1: string; date2: string } {
  const today = new Date();
  today.setDate(today.getDate() - 2); // GSC задержка
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const end = new Date(today);
  let start = new Date(today);
  if (preset === '30d') start.setDate(end.getDate() - 29);
  else if (preset === 'mom') start.setDate(end.getDate() - 29);
  else if (preset === 'yoy') start.setDate(end.getDate() - 29);
  return { date1: fmt(start), date2: fmt(end) };
}

export default function SeoRecoveryPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status | null>(null);
  const [counterId, setCounterId] = useState('');
  const [gscSite, setGscSite] = useState('');
  const [preset, setPreset] = useState('30d');
  const initial = shiftDates('30d');
  const [date1, setDate1] = useState(initial.date1);
  const [date2, setDate2] = useState(initial.date2);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  async function checkStatus() {
    try {
      const { data, error } = await supabase.functions.invoke('seo-recovery-analyze', {
        body: { mode: 'check', date1, date2 },
      });
      if (error) throw error;
      setStatus(data as Status);
    } catch (e) { console.error(e); }
  }

  useEffect(() => { checkStatus(); /* eslint-disable-next-line */ }, []);

  function applyPreset(p: string) {
    setPreset(p);
    if (p !== 'custom') {
      const d = shiftDates(p);
      setDate1(d.date1);
      setDate2(d.date2);
    }
  }

  async function runAnalysis() {
    if (!counterId && !gscSite) {
      toast.error('Укажите счётчик Метрики или сайт GSC');
      return;
    }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const { data, error } = await supabase.functions.invoke('seo-recovery-analyze', {
        body: { counter_id: counterId || undefined, gsc_site: gscSite || undefined, date1, date2 },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error + ((data as any).details ? ': ' + (data as any).details.join('; ') : ''));
      setData(data);
    } catch (e: any) {
      setError(e?.message || 'Ошибка анализа');
    } finally {
      setLoading(false);
    }
  }

  async function connectYandex() {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const { data, error } = await supabase.functions.invoke('yandex-oauth-start', {
        body: {},
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (error) throw error;
      if ((data as any)?.url) window.open((data as any).url, '_blank', 'width=600,height=720');
      else throw new Error('Не получен URL авторизации');
    } catch (e: any) {
      toast.error('Ошибка: ' + (e?.message || 'неизвестная'));
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1400px] py-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><LifeBuoy className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">SEO Recovery AI</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">AI-аналитик причин изменения органического трафика. Анализ строго на фактах из Яндекс Метрики и Google Search Console — без догадок.</p>
          </div>
        </div>

        {/* Connection status */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-sm font-medium">Подключения</div>
            <Button variant="ghost" size="sm" onClick={checkStatus}><RefreshCw className="w-3.5 h-3.5 mr-1" />Обновить</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Яндекс Метрика</div>
                <div className="text-xs text-muted-foreground">{status?.metrika_connected ? `Подключено: ${status.metrika_login ?? 'аккаунт'}` : 'Не подключено'}</div>
              </div>
              {status?.metrika_connected
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">OK</Badge>
                : <Button size="sm" variant="outline" onClick={connectYandex}><LinkIcon className="w-3.5 h-3.5 mr-1" />Подключить</Button>}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Google Search Console</div>
                <div className="text-xs text-muted-foreground">{status?.gsc_available ? 'Коннектор подключен' : 'Не подключено'}</div>
              </div>
              {status?.gsc_available
                ? <Badge variant="outline" className="border-emerald-500/40 text-emerald-600">OK</Badge>
                : <Badge variant="outline" className="text-amber-600 border-amber-500/40">Нужен коннектор</Badge>}
            </div>
            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <div className="text-sm font-medium">Яндекс Вебмастер</div>
                <div className="text-xs text-muted-foreground">Дополнительно (индексация)</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/yandex-webmaster')}>Открыть</Button>
            </div>
          </div>
        </Card>

        {/* Form */}
        <Card className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="counter">ID счётчика Яндекс Метрики</Label>
              <Input id="counter" placeholder="напр. 12345678" value={counterId} onChange={(e) => setCounterId(e.target.value.trim())} />
              <p className="text-xs text-muted-foreground">Главный источник фактического трафика</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gsc">Сайт Google Search Console</Label>
              <Input id="gsc" placeholder="https://example.ru/ или sc-domain:example.ru" value={gscSite} onChange={(e) => setGscSite(e.target.value.trim())} />
              <p className="text-xs text-muted-foreground">Точно как в GSC, включая протокол и слэш</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Период сравнения</Label>
              <Select value={preset} onValueChange={applyPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="30d">Последние 30 дней</SelectItem>
                  <SelectItem value="mom">Месяц к месяцу</SelectItem>
                  <SelectItem value="yoy">Год к году</SelectItem>
                  <SelectItem value="custom">Свой период</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Дата с</Label>
              <Input type="date" value={date1} onChange={(e) => { setDate1(e.target.value); setPreset('custom'); }} />
            </div>
            <div className="space-y-1.5">
              <Label>Дата по</Label>
              <Input type="date" value={date2} onChange={(e) => { setDate2(e.target.value); setPreset('custom'); }} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={runAnalysis} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              {loading ? 'Анализ…' : 'Запустить анализ'}
            </Button>
          </div>
        </Card>

        {error && (
          <Card className="p-4 border-rose-500/40 bg-rose-500/5 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 mt-0.5" />
            <div className="text-sm">{error}</div>
          </Card>
        )}

        {loading && (
          <Card className="p-8 flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <div>Собираем данные из Метрики и GSC, считаем дельты, формируем AI-анализ…</div>
          </Card>
        )}

        {data && <SeoRecoveryView data={data} />}
      </main>
    </div>
  );
}