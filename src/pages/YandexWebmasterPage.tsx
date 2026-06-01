import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { YandexWebmasterView } from '@/components/audit/YandexWebmasterView';
import { Gauge, Plug, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

export default function YandexWebmasterPage() {
  const [domainInput, setDomainInput] = useState('');
  const [activeDomain, setActiveDomain] = useState<string | null>(null);
  const [tokenInfo, setTokenInfo] = useState<{ yandex_login: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnection();
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'yandex-oauth-done') {
        checkConnection();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const checkConnection = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('yandex_tokens')
      .select('yandex_login')
      .maybeSingle();
    setTokenInfo(data ?? null);
    setLoading(false);
  };

  const connectYandex = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const jwt = sessionData.session?.access_token;
    if (!jwt) {
      alert('Сначала войдите в систему');
      return;
    }
    const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-oauth-start`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const json = await res.json();
    if (!res.ok || !json.url) {
      alert(json.error || 'Не удалось начать авторизацию');
      return;
    }
    window.open(json.url, 'yandex_oauth', 'width=600,height=600');
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = domainInput.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '');
    if (!clean) return;
    setActiveDomain(clean);
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
          <Gauge className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Яндекс Вебмастер</h1>
          <p className="text-sm text-muted-foreground">
            Каталог из 37 проверок Яндекс.Вебмастера: фатальные, критичные, возможные и рекомендации
          </p>
        </div>
      </div>

      {/* Connection Status */}
      <Card className="bg-card border-border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {loading ? (
              <span className="text-sm text-muted-foreground">Проверка подключения…</span>
            ) : tokenInfo ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                <div>
                  <span className="text-sm font-medium text-foreground">
                    Яндекс.Вебмастер подключён
                  </span>
                  {tokenInfo.yandex_login && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({tokenInfo.yandex_login})
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <Plug className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Яндекс.Вебмастер не подключён — данные из API недоступны
                </span>
              </>
            )}
          </div>
          {!loading && !tokenInfo && (
            <Button size="sm" onClick={connectYandex} className="gap-1.5">
              <Plug className="h-3.5 w-3.5" /> Подключить Яндекс.Вебмастер
            </Button>
          )}
        </div>
      </Card>

      <Card className="bg-card border-border p-5">
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[260px]">
            <label className="text-[12px] text-muted-foreground mb-1.5 block">Домен сайта</label>
            <Input
              placeholder="example.com"
              value={domainInput}
              onChange={(e) => setDomainInput(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={!domainInput.trim()}>
            {activeDomain ? 'Сменить домен' : 'Открыть аудит'}
          </Button>
        </form>
      </Card>

      {activeDomain && <YandexWebmasterView domain={activeDomain} />}
    </div>
  );
}
