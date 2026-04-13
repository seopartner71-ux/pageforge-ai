import { useLang } from '@/contexts/LangContext';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip, Legend,
} from 'recharts';

interface TabDataProps { data: any; }

/* ─────────── Readability Tab ─────────── */
export function ReadabilityTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const r = data?.readability;
  if (!r) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const metrics = [
    { label: isRu ? 'Оценка читабельности' : 'Readability Score', value: `${r.score}/100`, bar: r.score },
    { label: isRu ? 'Уровень' : 'Grade', value: r.grade },
    { label: isRu ? 'Среднее слов в предложении' : 'Avg words/sentence', value: r.avgWordsPerSentence },
    { label: isRu ? 'Среднее слогов в слове' : 'Avg syllables/word', value: r.avgSyllablesPerWord },
    { label: isRu ? 'Всего предложений' : 'Total sentences', value: r.sentenceCount },
    { label: isRu ? 'Всего слов' : 'Total words', value: r.wordCount },
    { label: isRu ? 'Сложных слов (3+ слога)' : 'Complex words (3+ syllables)', value: `${r.complexWords} (${r.complexPercent}%)` },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '📖 Оценка читабельности' : '📖 Readability Score'}</h2>
      <div className="glass-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-4xl font-bold ${r.score >= 60 ? 'text-accent' : r.score >= 40 ? 'text-yellow-500' : 'text-destructive'}`}>{r.score}</div>
          <div>
            <p className="text-sm font-medium text-foreground">{r.grade}</p>
            <p className="text-xs text-muted-foreground">{isRu ? 'Индекс Флеша' : 'Flesch Index'}</p>
          </div>
        </div>
        <Progress value={r.score} className="h-2 mb-4" />
        <div className="grid grid-cols-2 gap-3">
          {metrics.slice(2).map((m, i) => (
            <div key={i} className="p-3 rounded-lg bg-secondary/30">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-sm font-bold text-foreground mt-1">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─────────── Headings Hierarchy Tab ─────────── */
export function HeadingsTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const h = data?.headingHierarchy;
  if (!h) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const levelColors: Record<number, string> = { 1: 'text-primary', 2: 'text-accent', 3: 'text-muted-foreground', 4: 'text-muted-foreground/70', 5: 'text-muted-foreground/50', 6: 'text-muted-foreground/40' };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '🏗️ Иерархия заголовков' : '🏗️ Heading Hierarchy'}</h2>
      {h.issues?.length > 0 && (
        <div className="glass-card p-4 border-l-2 border-destructive">
          {h.issues.map((issue: string, i: number) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" />{issue}</p>
          ))}
        </div>
      )}
      <div className="grid grid-cols-6 gap-2 mb-4">
        {[1,2,3,4,5,6].map(l => (
          <div key={l} className="glass-card p-3 text-center">
            <p className="text-lg font-bold text-foreground">H{l}</p>
            <p className="text-xs text-muted-foreground">{h.counts?.[`h${l}` as keyof typeof h.counts] || 0}</p>
          </div>
        ))}
      </div>
      <div className="glass-card p-4 space-y-1">
        {h.headings?.map((heading: any, i: number) => (
          <div key={i} className={`flex items-start gap-2 py-1.5 ${heading.issues?.length ? 'bg-destructive/5 rounded px-2' : ''}`} style={{ paddingLeft: `${(heading.level - 1) * 16}px` }}>
            <span className={`text-xs font-bold shrink-0 ${levelColors[heading.level] || 'text-muted-foreground'}`}>H{heading.level}</span>
            <span className="text-sm text-foreground">{heading.text}</span>
            {heading.issues?.length > 0 && <AlertTriangle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── Snippet Preview Tab ─────────── */
export function SnippetPreviewTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const s = data?.snippetPreview;
  if (!s) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '🔍 Превью сниппета Google' : '🔍 Google Snippet Preview'}</h2>
      {/* Desktop preview */}
      <div className="glass-card p-6">
        <p className="text-xs text-muted-foreground mb-3">{isRu ? 'Десктоп' : 'Desktop'}</p>
        <div className="bg-background p-4 rounded-lg border border-border/50 max-w-xl">
          <p className="text-[#1a0dab] text-lg hover:underline cursor-pointer leading-snug">{s.titleTruncated || '(нет title)'}</p>
          <p className="text-xs text-[#006621] mt-1">{s.displayUrl}</p>
          <p className="text-sm text-foreground/70 mt-1 leading-relaxed">{s.descTruncated || '(нет description)'}</p>
        </div>
      </div>
      {/* Mobile preview */}
      <div className="glass-card p-6">
        <p className="text-xs text-muted-foreground mb-3">{isRu ? 'Мобильный' : 'Mobile'}</p>
        <div className="bg-background p-3 rounded-lg border border-border/50 max-w-xs">
          <p className="text-[#1a0dab] text-base hover:underline cursor-pointer leading-snug">{s.titleTruncated || '(нет title)'}</p>
          <p className="text-xs text-[#006621] mt-1 truncate">{s.displayUrl}</p>
          <p className="text-xs text-foreground/70 mt-1 leading-relaxed line-clamp-3">{s.descTruncated || '(нет description)'}</p>
        </div>
      </div>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`glass-card p-4 ${s.titleLength > 60 ? 'border-l-2 border-destructive' : s.titleLength < 30 ? 'border-l-2 border-yellow-500' : 'border-l-2 border-accent'}`}>
          <p className="text-xs text-muted-foreground">Title</p>
          <p className="text-lg font-bold text-foreground">{s.titleLength}/60</p>
        </div>
        <div className={`glass-card p-4 ${s.descLength > 160 ? 'border-l-2 border-destructive' : s.descLength < 70 ? 'border-l-2 border-yellow-500' : 'border-l-2 border-accent'}`}>
          <p className="text-xs text-muted-foreground">Description</p>
          <p className="text-lg font-bold text-foreground">{s.descLength}/160</p>
        </div>
      </div>
      {s.issues?.length > 0 && (
        <div className="space-y-2">
          {s.issues.map((issue: string, i: number) => (
            <div key={i} className="p-2 rounded bg-destructive/5 text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{issue}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Meta Directives Tab ─────────── */
export function MetaDirectivesTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const m = data?.metaDirectives;
  if (!m) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const checks = [
    { label: 'Canonical', value: m.canonical || (isRu ? 'Не указан' : 'Not set'), ok: !!m.canonical },
    { label: 'Meta Robots', value: m.metaRobots || (isRu ? 'Не указан (по умолчанию index,follow)' : 'Not set (default index,follow)'), ok: !m.hasNoindex },
    { label: 'Noindex', value: m.hasNoindex ? '⚠️ ДА' : 'Нет', ok: !m.hasNoindex },
    { label: 'Nofollow', value: m.hasNofollow ? '⚠️ ДА' : 'Нет', ok: !m.hasNofollow },
    { label: 'Hreflang', value: m.hreflangs?.length > 0 ? `${m.hreflangs.length} языков` : (isRu ? 'Не указан' : 'Not set'), ok: true },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '🏷️ Canonical, Hreflang, Robots' : '🏷️ Canonical, Hreflang, Robots'}</h2>
      <div className="space-y-2">
        {checks.map((c, i) => (
          <div key={i} className={`glass-card p-4 flex items-center gap-4 ${!c.ok ? 'border-l-2 border-destructive' : ''}`}>
            {c.ok ? <CheckCircle2 className="w-5 h-5 text-accent shrink-0" /> : <XCircle className="w-5 h-5 text-destructive shrink-0" />}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{c.label}</p>
              <p className="text-xs text-muted-foreground break-all">{c.value}</p>
            </div>
          </div>
        ))}
      </div>
      {m.hreflangs?.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-sm font-bold text-foreground mb-2">Hreflang</p>
          {m.hreflangs.map((h: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1 text-xs">
              <span className="font-mono font-bold text-primary">{h.lang}</span>
              <span className="text-muted-foreground truncate">{h.url}</span>
            </div>
          ))}
        </div>
      )}
      {m.issues?.length > 0 && (
        <div className="space-y-1">
          {m.issues.map((issue: string, i: number) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── URL Structure Tab ─────────── */
export function UrlStructureTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const u = data?.urlStructure;
  if (!u) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const metrics = [
    { label: isRu ? 'Длина URL' : 'URL length', value: `${u.length} ${isRu ? 'символов' : 'chars'}` },
    { label: isRu ? 'Глубина' : 'Depth', value: `${u.depth} ${isRu ? 'уровней' : 'levels'}` },
    { label: 'Trailing slash', value: u.hasTrailingSlash ? isRu ? 'Есть' : 'Yes' : isRu ? 'Нет' : 'No' },
    { label: isRu ? 'Кириллица' : 'Cyrillic', value: u.hasCyrillic ? '⚠️' : 'OK' },
    { label: isRu ? 'Заглавные' : 'Uppercase', value: u.hasUppercase ? '⚠️' : 'OK' },
    { label: isRu ? 'Подчёркивания' : 'Underscores', value: u.hasUnderscores ? '⚠️' : 'OK' },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '🔗 Анализ структуры URL' : '🔗 URL Structure Analysis'}</h2>
      <div className="glass-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-4xl font-bold ${u.score >= 80 ? 'text-accent' : u.score >= 50 ? 'text-yellow-500' : 'text-destructive'}`}>{u.score}</div>
          <div>
            <p className="text-sm font-medium text-foreground">{isRu ? 'Оценка URL' : 'URL Score'}</p>
            <p className="text-xs text-muted-foreground font-mono break-all">{u.path}</p>
          </div>
        </div>
        <Progress value={u.score} className="h-2 mb-4" />
        <div className="grid grid-cols-3 gap-2">
          {metrics.map((m, i) => (
            <div key={i} className="p-2 rounded bg-secondary/30 text-center">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="text-sm font-bold text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
      </div>
      {u.issues?.length > 0 && (
        <div className="space-y-1">
          {u.issues.map((issue: string, i: number) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Content Freshness Tab ─────────── */
export function ContentFreshnessTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const f = data?.contentFreshness;
  if (!f) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const freshnessLabels: Record<string, { ru: string; en: string; color: string }> = {
    fresh: { ru: '🟢 Свежий (до 30 дней)', en: '🟢 Fresh (< 30 days)', color: 'text-accent' },
    recent: { ru: '🟡 Недавний (до 6 мес.)', en: '🟡 Recent (< 6 months)', color: 'text-yellow-500' },
    aging: { ru: '🟠 Устаревает (до 1 года)', en: '🟠 Aging (< 1 year)', color: 'text-orange-500' },
    stale: { ru: '🔴 Устаревший (> 1 года)', en: '🔴 Stale (> 1 year)', color: 'text-destructive' },
    unknown: { ru: '⚪ Не определён', en: '⚪ Unknown', color: 'text-muted-foreground' },
  };

  const label = freshnessLabels[f.freshness] || freshnessLabels.unknown;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '📅 Свежесть контента' : '📅 Content Freshness'}</h2>
      <div className="glass-card p-5">
        <p className={`text-lg font-bold ${label.color}`}>{isRu ? label.ru : label.en}</p>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground">{isRu ? 'Дата публикации' : 'Published'}</p>
            <p className="text-sm font-bold text-foreground">{f.datePublished || (isRu ? 'Не найдена' : 'Not found')}</p>
          </div>
          <div className="p-3 rounded bg-secondary/30">
            <p className="text-xs text-muted-foreground">{isRu ? 'Дата обновления' : 'Modified'}</p>
            <p className="text-sm font-bold text-foreground">{f.dateModified || (isRu ? 'Не найдена' : 'Not found')}</p>
          </div>
        </div>
        {f.ageInDays !== null && (
          <p className="text-sm text-muted-foreground mt-3">{isRu ? `Возраст: ${f.ageInDays} дней` : `Age: ${f.ageInDays} days`}</p>
        )}
        {f.freshness === 'unknown' && (
          <p className="text-sm text-destructive mt-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />{isRu ? 'Добавьте datePublished / dateModified в JSON-LD или meta-теги article:published_time' : 'Add datePublished / dateModified to JSON-LD or article:published_time meta tags'}</p>
        )}
      </div>
    </div>
  );
}

/* ─────────── Schema Validator Tab ─────────── */
export function SchemaValidatorTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const sv = data?.schemaValidation;
  if (!sv) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '📐 Валидация Schema Markup' : '📐 Schema Markup Validator'}</h2>
      <div className="glass-card p-5">
        <p className="text-sm text-muted-foreground mb-3">{isRu ? `Найдено схем: ${sv.totalSchemas}` : `Schemas found: ${sv.totalSchemas}`}</p>
        {sv.schemas?.map((s: any, i: number) => (
          <div key={i} className={`p-3 rounded-lg mb-2 ${s.missingRequired?.length > 0 ? 'bg-destructive/5 border-l-2 border-destructive' : 'bg-accent/5 border-l-2 border-accent'}`}>
            <p className="text-sm font-bold text-foreground">{s.type}</p>
            <p className="text-xs text-muted-foreground mt-1">{isRu ? 'Поля' : 'Fields'}: {s.fields?.join(', ')}</p>
            {s.missingRequired?.length > 0 && (
              <p className="text-xs text-destructive mt-1">{isRu ? 'Отсутствуют' : 'Missing'}: {s.missingRequired.join(', ')}</p>
            )}
          </div>
        ))}
        {sv.totalSchemas === 0 && (
          <p className="text-sm text-destructive flex items-center gap-2"><XCircle className="w-4 h-4" />{isRu ? 'JSON-LD разметка не найдена' : 'No JSON-LD markup found'}</p>
        )}
      </div>
      {sv.missingSchemas?.length > 0 && (
        <div className="glass-card p-4">
          <p className="text-sm font-bold text-foreground mb-2">{isRu ? 'Рекомендуемые схемы (отсутствуют)' : 'Recommended schemas (missing)'}</p>
          <div className="flex flex-wrap gap-2">
            {sv.missingSchemas.map((s: string, i: number) => (
              <span key={i} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20">{s}</span>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span>Microdata: {sv.hasMicrodata ? '✅' : '❌'}</span>
        <span>RDFa: {sv.hasRdfa ? '✅' : '❌'}</span>
      </div>
    </div>
  );
}

/* ─────────── Content Metrics Tab ─────────── */
export function ContentMetricsTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const cm = data?.contentMetrics;
  if (!cm) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  const metrics = [
    { label: isRu ? 'Слов' : 'Words', value: cm.wordCount, icon: '📝' },
    { label: isRu ? 'Текст/HTML' : 'Text/HTML', value: `${cm.textToHtmlRatio}%`, icon: '📊' },
    { label: isRu ? 'Параграфов' : 'Paragraphs', value: cm.paragraphs, icon: '📄' },
    { label: isRu ? 'Списков (UL/OL)' : 'Lists (UL/OL)', value: `${cm.ulCount}/${cm.olCount}`, icon: '📋' },
    { label: isRu ? 'Пунктов списков' : 'List items', value: cm.listItems, icon: '•' },
    { label: isRu ? 'Таблиц' : 'Tables', value: cm.tables, icon: '📑' },
    { label: isRu ? 'Изображений' : 'Images', value: cm.images, icon: '🖼️' },
    { label: isRu ? 'Видео' : 'Videos', value: cm.videos, icon: '🎬' },
    { label: isRu ? 'Форм' : 'Forms', value: cm.forms, icon: '📝' },
    { label: isRu ? 'Медиа на 1000 слов' : 'Media per 1000 words', value: cm.mediaRatio, icon: '📈' },
  ];

  const issues: string[] = [];
  if (cm.textToHtmlRatio < 10) issues.push(isRu ? 'Низкое соотношение текст/HTML (< 10%) — мало полезного контента' : 'Low text/HTML ratio (< 10%)');
  if (cm.paragraphs < 3) issues.push(isRu ? 'Мало параграфов (< 3)' : 'Few paragraphs (< 3)');
  if (cm.tables === 0) issues.push(isRu ? 'Нет таблиц — таблицы повышают шанс попадания в SGE' : 'No tables — tables boost SGE inclusion');
  if (cm.ulCount + cm.olCount === 0) issues.push(isRu ? 'Нет маркированных списков' : 'No bulleted lists');
  if (cm.mediaRatio < 1) issues.push(isRu ? 'Мало медиа: менее 1 изображения/видео на 1000 слов' : 'Low media ratio: less than 1 per 1000 words');

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '📊 Контент-метрики' : '📊 Content Metrics'}</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {metrics.map((m, i) => (
          <div key={i} className="glass-card p-3 text-center">
            <p className="text-lg">{m.icon}</p>
            <p className="text-lg font-bold text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground">{m.label}</p>
          </div>
        ))}
      </div>
      {issues.length > 0 && (
        <div className="space-y-1">
          {issues.map((issue, i) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────── Internal Linking Tab ─────────── */
export function InternalLinkingTab({ data }: TabDataProps) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const il = data?.internalLinking;
  if (!il) return <p className="text-muted-foreground text-sm">{isRu ? 'Нет данных.' : 'No data.'}</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{isRu ? '🔗 Внутренняя перелинковка' : '🔗 Internal Linking'}</h2>
      <div className="glass-card p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className={`text-4xl font-bold ${il.score >= 80 ? 'text-accent' : il.score >= 50 ? 'text-yellow-500' : 'text-destructive'}`}>{il.score}</div>
          <div>
            <p className="text-sm font-medium text-foreground">{isRu ? 'Оценка перелинковки' : 'Linking Score'}</p>
          </div>
        </div>
        <Progress value={il.score} className="h-2 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 rounded bg-secondary/30 text-center">
            <p className="text-lg font-bold text-foreground">{il.totalInternal}</p>
            <p className="text-xs text-muted-foreground">{isRu ? 'Внутренних' : 'Internal'}</p>
          </div>
          <div className="p-3 rounded bg-secondary/30 text-center">
            <p className="text-lg font-bold text-foreground">{il.totalExternal}</p>
            <p className="text-xs text-muted-foreground">{isRu ? 'Внешних' : 'External'}</p>
          </div>
          <div className="p-3 rounded bg-secondary/30 text-center">
            <p className="text-lg font-bold text-foreground">{il.uniqueInternalUrls}</p>
            <p className="text-xs text-muted-foreground">{isRu ? 'Уникальных URL' : 'Unique URLs'}</p>
          </div>
          <div className="p-3 rounded bg-secondary/30 text-center">
            <p className="text-lg font-bold text-foreground">{il.emptyAnchors}</p>
            <p className="text-xs text-muted-foreground">{isRu ? 'Без анкора' : 'No anchor'}</p>
          </div>
        </div>
      </div>
      {il.issues?.length > 0 && (
        <div className="space-y-1">
          {il.issues.map((issue: string, i: number) => (
            <p key={i} className="text-sm text-destructive flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" />{issue}</p>
          ))}
        </div>
      )}
    </div>
  );
}
