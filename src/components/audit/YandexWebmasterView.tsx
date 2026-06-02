import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, Search, Globe, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

type CheckStatus = 'ok' | 'error' | 'not_checked';
type SectionType = 'fatal' | 'critical' | 'possible' | 'recommendation';

interface WmCheck {
  number: string;
  name: string;
  section: SectionType;
  apiField: string;
  actionUrl?: string;
  actionLabel?: string;
  status: CheckStatus;
  errorCount?: number;
  errorUrls?: string[];
}

const SECTION_META: Record<SectionType, { label: string; toneVar: string; emoji: string; info: string }> = {
  fatal: {
    label: 'Фатальные ошибки', toneVar: '--destructive', emoji: '🔴',
    info: 'Фатальные ошибки несовместимы с отображением сайта в поисковой выдаче. Требуют немедленного исправления.',
  },
  critical: {
    label: 'Критичные ошибки', toneVar: '--chart-4', emoji: '🟠',
    info: 'Критичные ошибки серьёзно затрудняют индексацию. Могут сильно снизить видимость сайта в поиске.',
  },
  possible: {
    label: 'Возможные проблемы', toneVar: '--chart-5', emoji: '🟡',
    info: 'Возможные проблемы влияют на удобство и корректную индексацию. Рекомендуется устранить.',
  },
  recommendation: {
    label: 'Рекомендации', toneVar: '--chart-2', emoji: '🔵',
    info: 'Рекомендации носят необязательный характер, но помогают улучшить сайт и его отображение.',
  },
};

// Маппинг типов проблем Яндекса (problem_type) на наши apiField
const PROBLEM_TYPE_TO_FIELD: Record<string, string> = {
  SITE_ERROR: 'security_problems',
  MALWARE: 'security_problems',
  DANGEROUS_SITE: 'security_problems',
  DNS_ERROR: 'dns_error',
  SERVER_ERROR: 'server_error',
  MAIN_PAGE_RETURNED_ERROR: 'main_page_unavailable',
  DISALLOWED_BY_USER_IN_ROBOTS_TXT: 'robots_disallow_all',
  SITE_CLOSED_FOR_ROBOT: 'robots_disallow_all',
  SSL_CERTIFICATE_ERROR: 'ssl_error',
  PAGES_WITH_DUPLICATING_QUERY_PARAMS: 'get_params_duplicates',
  SITE_HTTP_5XX: 'http_5xx_pages',
  SITE_HTTP_4XX: 'http_4xx_pages',
  SLOW_SERVER_RESPONSE: 'slow_server_response',
  NO_CORRECT_ROBOTS_TXT: 'robots_errors',
  INCORRECT_404_PAGE: 'incorrect_404',
  NO_TITLE: 'missing_titles',
  NO_DESCRIPTION: 'missing_descriptions',
  NO_METRIKA_COUNTER: 'metrika_missing',
  METRIKA_COUNTER_NOT_LINKED: 'metrika_not_linked',
  SUBDOMAINS_DETECTED: 'subdomains_found',
  DUPLICATE_TITLES_DESCRIPTIONS: 'duplicate_titles_descriptions',
  ROBOTS_TXT_NOT_FOUND: 'robots_not_found',
  NO_SITEMAPS: 'no_sitemap',
  SITEMAP_ERRORS: 'sitemap_errors',
  SITEMAP_OUTDATED: 'sitemap_outdated',
  DUPLICATE_PAGES: 'duplicate_pages',
  FAVICON_INACCESSIBLE: 'favicon_inaccessible',
  FAVICON_NOT_FOUND: 'favicon_missing',
  VIDEO_AGREEMENT_REQUIRED: 'video_agreement',
  MAIN_PAGE_REDIRECT: 'main_page_redirect',
  COUNTER_CRAWL_DISABLED: 'counter_crawl_disabled',
  USEFUL_PAGES_CLOSED: 'useful_pages_closed',
  YANDEX_AGREEMENT_REQUIRED: 'yandex_agreement_required',
  NO_HTTPS_MIRROR: 'no_https_mirror',
  PRODUCTS_NOT_SUBMITTED: 'products_not_submitted',
  NO_FAVICON_SVG: 'favicon_recommendation',
  REGION_NOT_SET: 'region_not_set',
  YANDEX_BUSINESS_CARD_CREATED: 'business_card_created',
  NOT_IN_YANDEX_BUSINESS: 'add_to_yandex_business',
  MOBILE_NOT_OPTIMIZED: 'mobile_not_optimized',
};

function buildChecks(d: string): WmCheck[] {
  return [
    // FATAL
    { number: '1.1', name: 'Нарушения безопасности', section: 'fatal', apiField: 'security_problems', status: 'not_checked' },
    { number: '1.2', name: 'Ошибка DNS', section: 'fatal', apiField: 'dns_error', status: 'not_checked', actionUrl: `https://mxtoolbox.com/SuperTool.aspx?action=dns%3a${d}`, actionLabel: 'Проверить DNS' },
    { number: '1.3', name: 'Ошибка сервера', section: 'fatal', apiField: 'server_error', status: 'not_checked', actionUrl: `https://check-host.net/check-http?host=${d}`, actionLabel: 'Проверить сервер' },
    { number: '1.4', name: 'Главная страница недоступна', section: 'fatal', apiField: 'main_page_unavailable', status: 'not_checked', actionUrl: `https://${d}`, actionLabel: 'Открыть сайт' },
    { number: '1.5', name: 'Сайт закрыт в robots.txt', section: 'fatal', apiField: 'robots_disallow_all', status: 'not_checked', actionUrl: `https://${d}/robots.txt`, actionLabel: 'Открыть robots.txt' },
    // CRITICAL
    { number: '2.1', name: 'Некорректный SSL-сертификат', section: 'critical', apiField: 'ssl_error', status: 'not_checked', actionUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${d}`, actionLabel: 'Проверить SSL' },
    { number: '2.2', name: 'Страницы-дубли с GET-параметрами', section: 'critical', apiField: 'get_params_duplicates', status: 'not_checked' },
    { number: '2.3', name: 'Страницы отвечают 5xx', section: 'critical', apiField: 'http_5xx_pages', status: 'not_checked' },
    { number: '2.4', name: 'Страницы отвечают 4xx', section: 'critical', apiField: 'http_4xx_pages', status: 'not_checked' },
    { number: '2.5', name: 'Долгий ответ сервера', section: 'critical', apiField: 'slow_server_response', status: 'not_checked' },
    // POSSIBLE
    { number: '3.1', name: 'Некорректная настройка 404', section: 'possible', apiField: 'incorrect_404', status: 'not_checked' },
    { number: '3.2', name: 'Отсутствуют теги title', section: 'possible', apiField: 'missing_titles', status: 'not_checked' },
    { number: '3.3', name: 'Ошибки в robots.txt', section: 'possible', apiField: 'robots_errors', status: 'not_checked', actionUrl: `https://${d}/robots.txt`, actionLabel: 'Проверить robots.txt' },
    { number: '3.4', name: 'Счётчик Метрики не привязан', section: 'possible', apiField: 'metrika_not_linked', status: 'not_checked', actionUrl: 'https://metrika.yandex.ru', actionLabel: 'Привязать' },
    { number: '3.5', name: 'Найдены поддомены в поиске', section: 'possible', apiField: 'subdomains_found', status: 'not_checked' },
    { number: '3.6', name: 'Одинаковые заголовки и описания', section: 'possible', apiField: 'duplicate_titles_descriptions', status: 'not_checked' },
    { number: '3.7', name: 'Не найден robots.txt', section: 'possible', apiField: 'robots_not_found', status: 'not_checked', actionUrl: `https://${d}/robots.txt`, actionLabel: 'Открыть' },
    { number: '3.8', name: 'Нет файлов Sitemap', section: 'possible', apiField: 'no_sitemap', status: 'not_checked', actionUrl: `https://${d}/sitemap.xml`, actionLabel: 'Проверить Sitemap' },
    { number: '3.9', name: 'Страницы дублируют друг друга', section: 'possible', apiField: 'duplicate_pages', status: 'not_checked' },
    { number: '3.10', name: 'Favicon недоступен для робота', section: 'possible', apiField: 'favicon_inaccessible', status: 'not_checked', actionUrl: `https://${d}/favicon.ico`, actionLabel: 'Проверить favicon' },
    { number: '3.11', name: 'Отсутствуют метатеги Description', section: 'possible', apiField: 'missing_descriptions', status: 'not_checked' },
    { number: '3.12', name: 'Пользовательское соглашение видео', section: 'possible', apiField: 'video_agreement', status: 'not_checked', actionUrl: 'https://yandex.ru/support/webmaster/', actionLabel: 'Справка Яндекса' },
    { number: '3.13', name: 'Главная перенаправляет на другой сайт', section: 'possible', apiField: 'main_page_redirect', status: 'not_checked', actionUrl: `https://${d}`, actionLabel: 'Проверить редирект' },
    { number: '3.14', name: 'Не включён обход по счётчикам', section: 'possible', apiField: 'counter_crawl_disabled', status: 'not_checked', actionUrl: 'https://webmaster.yandex.ru', actionLabel: 'Настроить' },
    { number: '3.15', name: 'Ошибки в файлах Sitemap', section: 'possible', apiField: 'sitemap_errors', status: 'not_checked', actionUrl: 'https://validator.w3.org/feed/', actionLabel: 'Валидатор Sitemap' },
    { number: '3.16', name: 'Полезные страницы закрыты от индексации', section: 'possible', apiField: 'useful_pages_closed', status: 'not_checked' },
    { number: '3.17', name: 'Требуется соглашение с Яндексом', section: 'possible', apiField: 'yandex_agreement_required', status: 'not_checked', actionUrl: 'https://yandex.ru/support/webmaster/', actionLabel: 'Справка' },
    { number: '3.18', name: 'Sitemap давно не обновлялись', section: 'possible', apiField: 'sitemap_outdated', status: 'not_checked' },
    { number: '3.19', name: 'Главное зеркало без HTTPS', section: 'possible', apiField: 'no_https_mirror', status: 'not_checked', actionUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${d}`, actionLabel: 'Проверить SSL' },
    { number: '3.20', name: 'Не все товары переданы в поиск', section: 'possible', apiField: 'products_not_submitted', status: 'not_checked', actionUrl: 'https://webmaster.yandex.ru', actionLabel: 'Яндекс Вебмастер' },
    // RECOMMENDATIONS
    { number: '4.1', name: 'Добавить favicon SVG 120×120', section: 'recommendation', apiField: 'favicon_recommendation', status: 'not_checked', actionUrl: 'https://yandex.ru/support/webmaster/', actionLabel: 'Справка' },
    { number: '4.2', name: 'Указать регион сайта', section: 'recommendation', apiField: 'region_not_set', status: 'not_checked', actionUrl: 'https://webmaster.yandex.ru', actionLabel: 'Настроить регион' },
    { number: '4.3', name: 'Яндекс Бизнес создал карточку', section: 'recommendation', apiField: 'business_card_created', status: 'not_checked', actionUrl: 'https://business.yandex.ru', actionLabel: 'Проверить карточку' },
    { number: '4.4', name: 'Добавить сайт в Яндекс Бизнес', section: 'recommendation', apiField: 'add_to_yandex_business', status: 'not_checked', actionUrl: 'https://business.yandex.ru', actionLabel: 'Добавить' },
    { number: '4.5', name: 'Счётчик Метрики не установлен', section: 'recommendation', apiField: 'metrika_missing', status: 'not_checked', actionUrl: 'https://metrika.yandex.ru', actionLabel: 'Установить' },
    { number: '4.6', name: 'Сайт не оптимизирован для мобильных', section: 'recommendation', apiField: 'mobile_not_optimized', status: 'not_checked', actionUrl: 'https://webmaster.yandex.ru/tools/mobile-friendly/', actionLabel: 'Проверить' },
    { number: '4.7', name: 'Файл favicon не найден', section: 'recommendation', apiField: 'favicon_missing', status: 'not_checked', actionUrl: 'https://yandex.ru/support/webmaster/', actionLabel: 'Справка' },
  ];
}

function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === 'ok') return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">✅ Ошибок нет</span>;
  if (status === 'error') return <span className="inline-flex items-center gap-1 text-[11px] text-destructive">🔴 Ошибка обнаружена</span>;
  return <span className="text-[11px] text-muted-foreground">Не проверено</span>;
}

function CheckRow({ check, sectionType }: { check: WmCheck; sectionType: SectionType }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SECTION_META[sectionType];
  const borderColor = check.status === 'error'
    ? `hsl(var(${meta.toneVar}))`
    : check.status === 'ok' ? 'hsl(var(--emerald-500, 142 71% 45%))' : 'hsl(var(--border))';
  return (
    <div className="rounded-r-lg border-l-[3px]" style={{ borderLeftColor: borderColor }}>
      <div
        className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors"
        onClick={() => check.errorUrls && check.errorUrls.length > 0 && setExpanded(!expanded)}
      >
        <span className="w-[40px] text-[12px] text-muted-foreground font-mono shrink-0">{check.number}</span>
        <span className={cn('flex-1 text-[13px] truncate', check.status === 'ok' ? 'text-muted-foreground' : 'text-foreground')}>
          {check.name}
        </span>
        <div className="w-[180px] shrink-0"><StatusBadge status={check.status} /></div>
        {check.errorCount !== undefined && check.errorCount > 0 && (
          <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[10px]">{check.errorCount} стр.</Badge>
        )}
        <div className="w-[140px] shrink-0 flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {check.actionUrl && (
            <Button
              variant="outline" size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={() => window.open(check.actionUrl, '_blank')}
            >
              {check.actionLabel || 'Открыть'} <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
        {check.errorUrls && check.errorUrls.length > 0 && (
          <span className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </span>
        )}
      </div>
      {expanded && check.errorUrls && (
        <div className="px-4 pb-3 pl-[60px] space-y-1">
          {check.errorUrls.slice(0, 10).map((u, i) => (
            <div key={i} className="text-[12px] text-muted-foreground font-mono">{u}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function Section({ section, checks }: { section: SectionType; checks: WmCheck[] }) {
  const [open, setOpen] = useState(false);
  const meta = SECTION_META[section];
  const errCount = checks.filter((c) => c.status === 'error').length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-lg hover:bg-muted/50 transition-colors">
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="text-[14px] font-semibold text-foreground">{meta.emoji} {meta.label}</span>
          <Badge
            className="text-[11px] border"
            style={{
              backgroundColor: `hsl(var(${meta.toneVar}) / 0.12)`,
              color: `hsl(var(${meta.toneVar}))`,
              borderColor: `hsl(var(${meta.toneVar}) / 0.30)`,
            }}
          >
            {checks.length} проверок
          </Badge>
          {errCount > 0 && (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 text-[11px]">{errCount} ошибок</Badge>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className="mx-4 mt-2 mb-2 rounded-lg px-4 py-2 text-[12px] border"
          style={{
            backgroundColor: `hsl(var(${meta.toneVar}) / 0.06)`,
            borderColor: `hsl(var(${meta.toneVar}) / 0.20)`,
            color: `hsl(var(${meta.toneVar}) / 0.85)`,
          }}
        >
          {meta.info}
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-muted-foreground font-medium border-b border-border mx-1">
          <div className="w-[40px] shrink-0">№</div>
          <div className="flex-1">Проверка</div>
          <div className="w-[180px] shrink-0">Статус</div>
          <div className="w-[80px] shrink-0">Кол-во</div>
          <div className="w-[140px] shrink-0 text-right">Действие</div>
          <div className="w-[20px]" />
        </div>
        <div className="space-y-0.5 mt-1">
          {checks.map((c) => <CheckRow key={c.number} check={c} sectionType={section} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function YandexWebmasterView({ domain }: { domain: string }) {
  const [filter, setFilter] = useState<'all' | 'errors' | 'fatal' | 'critical'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [summary, setSummary] = useState<any | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const jwt = sess.session?.access_token;
      if (!jwt) throw new Error('Не авторизованы');
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-webmaster-api`;
      // 1. hosts
      const hostsRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'hosts' }),
      });
      const hostsJson = await hostsRes.json();
      if (!hostsRes.ok) throw new Error(hostsJson.error || 'Ошибка загрузки хостов');
      const hosts = hostsJson.hosts || [];
      const clean = domain.toLowerCase().replace(/^www\./, '');
      const match = hosts.find((h: any) => {
        const hu = (h.unicode_host_url || h.ascii_host_url || '').toLowerCase();
        return hu.includes(clean);
      });
      if (!match) {
        throw new Error(`Домен ${domain} не найден в вашем Яндекс.Вебмастере. Добавьте сайт на webmaster.yandex.ru`);
      }
      setHostId(match.host_id);
      setVerified(!!match.verified);
      // 2. summary
      const sumRes = await fetch(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'summary', host_id: match.host_id }),
      });
      const sumJson = await sumRes.json();
      if (!sumRes.ok) throw new Error(sumJson.error || 'Ошибка загрузки сводки');
      setSummary(sumJson.summary);
      setLastUpdated(new Date().toLocaleString('ru-RU'));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (domain) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  // Карта найденных проблем: apiField -> severity
  const problemMap = useMemo(() => {
    const m = new Map<string, SectionType>();
    const arr = summary?.host_problems || [];
    for (const p of arr) {
      const field = PROBLEM_TYPE_TO_FIELD[p.problem_type];
      if (!field) continue;
      const sev: SectionType =
        p.severity === 'FATAL' ? 'fatal'
        : p.severity === 'CRITICAL' ? 'critical'
        : p.severity === 'POSSIBLE' ? 'possible'
        : 'recommendation';
      m.set(field, sev);
    }
    return m;
  }, [summary]);

  const checks = useMemo(() => {
    const base = buildChecks(domain);
    if (!summary) return base;
    return base.map((c) => {
      const has = problemMap.has(c.apiField);
      return { ...c, status: has ? 'error' : 'ok' } as WmCheck;
    });
  }, [domain, summary, problemMap]);

  const hasData = !!summary;

  const bySection = (s: SectionType) => {
    let f = checks.filter((c) => c.section === s);
    if (filter === 'errors') f = f.filter((c) => c.status === 'error');
    if (filter === 'fatal') f = f.filter((c) => c.section === 'fatal');
    if (filter === 'critical') f = f.filter((c) => c.section === 'critical');
    if (search) f = f.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
    return f;
  };

  const fatalCount = checks.filter((c) => c.section === 'fatal' && c.status === 'error').length;
  const criticalCount = checks.filter((c) => c.section === 'critical' && c.status === 'error').length;
  const possibleCount = checks.filter((c) => c.section === 'possible' && c.status === 'error').length;
  const recCount = checks.filter((c) => c.section === 'recommendation' && c.status === 'error').length;

  const summary = [
    { label: 'Фатальные ошибки', count: fatalCount, tone: '--destructive', emoji: '🔴' },
    { label: 'Критичные ошибки', count: criticalCount, tone: '--chart-4', emoji: '🟠' },
    { label: 'Возможные проблемы', count: possibleCount, tone: '--chart-5', emoji: '🟡' },
    { label: 'Рекомендации', count: recCount, tone: '--chart-2', emoji: '🔵' },
  ];

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <Card className="bg-card border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-foreground">Яндекс Вебмастер</h2>
              {hasData ? (
                <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-[11px]">
                  Данные загружены
                </Badge>
              ) : loading ? (
                <Badge className="bg-muted text-muted-foreground border-border text-[11px]">
                  Загрузка…
                </Badge>
              ) : error ? (
                <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[11px]">
                  Ошибка
                </Badge>
              ) : null}
              {verified === false && (
                <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-[11px]">
                  Сайт не подтверждён
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              <span>Сайт: <span className="text-foreground font-medium">{domain}</span></span>
              <span>Дата анализа: <span className="text-foreground">{lastUpdated || '-'}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={load}
              disabled={loading}
              className="gap-1.5 text-[12px]"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              Обновить данные
            </Button>
          </div>
        </div>
      </Card>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summary.map((c) => (
          <Card key={c.label} className="bg-card border-border p-4">
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-lg flex items-center justify-center text-base"
                style={{ backgroundColor: `hsl(var(${c.tone}) / 0.12)` }}
              >
                <span>{c.emoji}</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{c.label}</p>
                <p
                  className="text-xl font-bold tabular-nums"
                  style={{ color: c.count > 0 ? `hsl(var(${c.tone}))` : 'hsl(var(--foreground))' }}
                >
                  {c.count}
                </p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* STATUS BANNER */}
      {error ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-[13px] text-destructive">
          ⚠️ {error}
        </div>
      ) : !hasData ? (
        <div className="rounded-lg bg-muted/40 border border-border px-4 py-3 text-[13px] text-muted-foreground">
          {loading ? 'Загружаем данные из Я.Вебмастера…' : `Каталог из ${checks.length} проверок. Нажмите «Обновить данные».`}
        </div>
      ) : fatalCount > 0 ? (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-[13px] text-destructive font-medium">
          🚨 Фатальные ошибки! Сайт может пропасть из поиска
        </div>
      ) : criticalCount > 0 ? (
        <div className="rounded-lg px-4 py-3 text-[13px] font-medium border" style={{ backgroundColor: 'hsl(var(--chart-4) / 0.1)', borderColor: 'hsl(var(--chart-4) / 0.2)', color: 'hsl(var(--chart-4))' }}>
          ⚠️ Обнаружены критичные ошибки - требуют срочного исправления
        </div>
      ) : (
        <div className="rounded-lg px-4 py-3 text-[13px] font-medium border" style={{ backgroundColor: 'hsl(var(--chart-2) / 0.1)', borderColor: 'hsl(var(--chart-2) / 0.2)', color: 'hsl(var(--chart-2))' }}>
          ✅ Критических проблем не обнаружено
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', 'Все'], ['errors', 'Только ошибки'], ['fatal', 'Фатальные'], ['critical', 'Критичные']] as const).map(([val, label]) => (
          <Button
            key={val}
            variant={filter === val ? 'default' : 'outline'}
            size="sm"
            className="text-[11px] h-7"
            onClick={() => setFilter(val)}
          >
            {label}
          </Button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск по проверке..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 bg-muted/40 border-border text-foreground/90 text-[12px] h-7 w-[240px]"
          />
        </div>
      </div>

      {/* SECTIONS */}
      <div className="space-y-3">
        <Section section="fatal" checks={bySection('fatal')} />
        <Section section="critical" checks={bySection('critical')} />
        <Section section="possible" checks={bySection('possible')} />
        <Section section="recommendation" checks={bySection('recommendation')} />
      </div>

      {/* DATA WIDGETS placeholder */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            title: '📊 Индексация',
            rows: [
              ['Страниц в поиске', summary?.searchable_pages_count?.toLocaleString('ru-RU') ?? '-'],
              ['Загружено страниц', summary?.loaded_pages_count?.toLocaleString('ru-RU') ?? '-'],
              ['Исключено', summary?.excluded_pages_count?.toLocaleString('ru-RU') ?? '-'],
            ],
          },
          {
            title: '🔍 Поисковые запросы (7д)',
            rows: [
              ['Показы', summary?.search_query_stat?.total_shows?.toLocaleString('ru-RU') ?? '-'],
              ['Клики', summary?.search_query_stat?.total_clicks?.toLocaleString('ru-RU') ?? '-'],
              ['Средний CTR', summary?.search_query_stat?.avg_ctr != null ? `${summary.search_query_stat.avg_ctr.toFixed(2)}%` : '-'],
            ],
          },
          {
            title: '🔗 Внешние ссылки',
            rows: [
              ['Всего ссылок', summary?.links_count?.toLocaleString('ru-RU') ?? '-'],
              ['SQI', summary?.sqi?.toLocaleString('ru-RU') ?? '-'],
            ],
          },
          {
            title: '🌐 Сайт',
            rows: [
              ['Подтверждён', verified == null ? '-' : verified ? 'Да' : 'Нет'],
              ['ID хоста', hostId ? hostId.slice(0, 24) + '…' : '-'],
            ],
          },
        ].map((w) => (
          <Card key={w.title} className="bg-card border-border p-4">
            <h4 className="text-[13px] font-semibold text-foreground mb-3 flex items-center gap-2">
              <Globe className="h-3.5 w-3.5 text-muted-foreground" /> {w.title}
            </h4>
            <div className="space-y-2">
              {w.rows.map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12px]">
                  <span className="text-muted-foreground">{k}</span>
                  <span className="text-foreground font-bold">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default YandexWebmasterView;