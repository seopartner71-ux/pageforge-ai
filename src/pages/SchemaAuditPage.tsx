import { useState, useEffect, useMemo, useRef } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Play, CheckCircle2, AlertTriangle, XCircle, Loader2, Code2, Copy, Download,
  FileCode, Sparkles, ChevronDown, ChevronUp, ShieldAlert,
} from 'lucide-react';

/* ─── Types ─── */
interface SchemaField { key: string; status: 'ok' | 'missing' | 'warning'; value?: string }
interface FoundSchema {
  type: string;
  format: 'JSON-LD' | 'Microdata' | 'RDFa';
  raw: any;
  fields: SchemaField[];
  severity: 'ok' | 'warning' | 'critical';
  line?: number;
}
interface Issue {
  severity: 'critical' | 'warning' | 'info';
  schema: string;
  problem: string;
  solution: string;
  seoImpact?: string;
}
interface GeneratedBlock {
  type: string;
  label: string;
  reason: string;
  code: string;
}
interface AuditRow {
  id: string;
  url: string;
  domain: string;
  status: 'pending' | 'analyzing' | 'done' | 'error';
  overall_score: number;
  found_schemas_count: number;
  errors_count: number;
  schemas_data: FoundSchema[];
  issues: Issue[];
  generated_code: GeneratedBlock[];
  ai_recommendations: any;
  page_type: string;
  error_message?: string;
}

const PROGRESS_STEPS = [
  'Загружаем страницу...',
  'Извлекаем схемы JSON-LD, Microdata, RDFa...',
  'Проверяем обязательные поля...',
  'AI генерирует рекомендации и готовый код...',
];

function scoreColor(score: number): string {
  if (score <= 40) return 'text-red-400';
  if (score <= 70) return 'text-yellow-400';
  return 'text-green-400';
}
function scoreLabel(score: number): string {
  if (score <= 40) return 'Критично';
  if (score <= 70) return 'Требует работы';
  if (score <= 85) return 'Хорошо';
  return 'Отлично';
}
function severityIcon(sev: 'ok' | 'warning' | 'critical') {
  if (sev === 'ok') return <span className="text-green-500">🟢</span>;
  if (sev === 'warning') return <span className="text-yellow-500">🟡</span>;
  return <span className="text-red-500">🔴</span>;
}

/* ─── Schema card ─── */
function SchemaCard({ schema }: { schema: FoundSchema }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
      <div className="flex items-center gap-2 text-sm">
        {severityIcon(schema.severity)}
        <span className="font-semibold text-foreground">{schema.type}</span>
        <span className="text-muted-foreground">•</span>
        <span className="text-xs px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{schema.format}</span>
        {schema.line ? (
          <>
            <span className="text-muted-foreground">•</span>
            <span className="text-xs text-muted-foreground">строка {schema.line}</span>
          </>
        ) : null}
      </div>
      {schema.fields.length > 0 && (
        <div className="space-y-1.5">
          {schema.fields.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="font-mono text-muted-foreground">
                <span className="text-foreground">{f.key}</span>
                {f.value ? <span>: "{f.value}"</span> : ':'}
              </span>
              {f.status === 'ok' && <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />}
              {f.status === 'missing' && (
                <span className="flex items-center gap-1 text-red-400 font-medium">
                  <XCircle className="w-3.5 h-3.5" /> ОТСУТСТВУЕТ
                </span>
              )}
              {f.status === 'warning' && (
                <span className="flex items-center gap-1 text-yellow-400 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" /> рекомендуется
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      <button onClick={() => setOpen(o => !o)} className="text-xs text-primary flex items-center gap-1 hover:underline">
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        {open ? 'Скрыть код' : 'Показать полный код'}
      </button>
      {open && (
        <pre className="bg-muted/40 rounded-md p-3 text-[11px] font-mono text-foreground overflow-x-auto max-h-60">
          {JSON.stringify(schema.raw, null, 2)}
        </pre>
      )}
    </div>
  );
}

/* ─── Code block with copy ─── */
function CodeBlock({ block }: { block: GeneratedBlock }) {
  const [copied, setCopied] = useState(false);
  const wrapped = `<script type="application/ld+json">\n${block.code}\n</script>`;
  const onCopy = async () => {
    await navigator.clipboard.writeText(wrapped);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">{block.label}</span>
          <span className="text-xs text-muted-foreground">— {block.reason}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={onCopy} className="h-7 gap-1.5 text-xs">
          <Copy className="w-3 h-3" /> {copied ? 'Скопировано' : 'Копировать'}
        </Button>
      </div>
      <pre className="p-4 text-[12px] font-mono text-foreground bg-[hsl(var(--background))] overflow-x-auto leading-relaxed">
{`<script type="application/ld+json">\n${block.code}\n</script>`}
      </pre>
    </div>
  );
}

/* ─── Coverage chips ─── */
function CoverageChips({ schemas }: { schemas: FoundSchema[] }) {
  const checks = ['Organization', 'Product', 'FAQPage', 'BreadcrumbList', 'WebSite', 'LocalBusiness', 'Article'];
  const present = new Set(schemas.map(s => s.type));
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <span className="text-muted-foreground">Покрытие:</span>
      {checks.map(c => (
        <span key={c} className={`flex items-center gap-1 ${present.has(c) ? 'text-green-400' : 'text-muted-foreground/60'}`}>
          {present.has(c) ? '✓' : '✗'} {c}
        </span>
      ))}
    </div>
  );
}

/* ─── Empty state ─── */
function EmptyState({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center text-center py-16 space-y-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <Code2 className="w-8 h-8 text-primary" />
      </div>
      <h2 className="text-lg font-semibold text-foreground">Проверьте микроразметку сайта</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Найдём JSON-LD, Microdata и RDFa, проверим на ошибки и сгенерируем готовый код
      </p>
      <Button onClick={onStart} className="gap-2 mt-2">
        <Play className="w-4 h-4" /> Начать проверку
      </Button>
    </div>
  );
}

/* ─── Helpers for TZ ─── */
function fmtDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d); x.setDate(x.getDate() + n); return x;
}
function pageTypeLabel(t: string): string {
  const map: Record<string, string> = {
    homepage: 'Главная страница', product: 'Карточка товара', article: 'Статья / блог',
    local_business: 'Локальный бизнес', general: 'Общая страница', other: 'Общая страница',
  };
  return map[t] || t || '—';
}
function priorityLabel(score: number): string {
  if (score < 40) return 'КРИТИЧЕСКИЙ';
  if (score < 70) return 'ВЫСОКИЙ';
  return 'СРЕДНИЙ';
}
function placementHint(type: string): string {
  const t = (type || '').toLowerCase();
  if (t === 'website' || t === 'organization') return 'Только на главной странице (один раз)';
  if (t === 'breadcrumblist') return 'На всех страницах внутри сайта (кроме главной)';
  if (t === 'product') return 'На всех карточках товаров';
  if (t === 'article' || t === 'blogposting') return 'На страницах статей и блога';
  if (t === 'localbusiness') return 'На главной и контактной странице';
  if (t === 'faqpage') return 'На страницах с FAQ-блоком';
  return 'На соответствующих страницах сайта';
}
function priorityFromBlock(label: string): string {
  const l = (label || '').toLowerCase();
  if (l.includes('критич')) return 'КРИТИЧНО';
  if (l.includes('исправ')) return 'КРИТИЧНО';
  if (l.includes('реком')) return 'РЕКОМЕНДУЕТСЯ';
  return 'ВАЖНО';
}
function dataSourceFromReason(reason: string, code: string): { label: string; manualFields: string[] } {
  const isFromPage = /Данные взяты со страницы/i.test(reason || '');
  const manualFields: string[] = [];
  if (!isFromPage) {
    // Naive: scan for empty strings/placeholders that need filling
    const placeholders = code.match(/"([^"]+)"\s*:\s*""/g) || [];
    placeholders.forEach(p => {
      const m = p.match(/"([^"]+)"/);
      if (m) manualFields.push(m[1]);
    });
  }
  return {
    label: isFromPage ? '✓ Взяты со страницы' : '⚠ Требуют уточнения',
    manualFields,
  };
}

/* ─── TZ generator (professional document) ─── */
function buildTzMarkdown(audit: AuditRow): string {
  const L: string[] = [];
  const today = new Date();
  const date = fmtDate(today);
  const crit = audit.issues.filter(i => i.severity === 'critical');
  const warn = audit.issues.filter(i => i.severity === 'warning');
  const info = audit.issues.filter(i => i.severity === 'info');
  const pageData = audit.ai_recommendations?.pageData || {};
  const pageType = pageTypeLabel(audit.page_type || 'general');
  const ai = audit.ai_recommendations || {};

  // ── Header ──
  L.push('# Техническое задание на внедрение микроразметки Schema.org');
  L.push('');
  L.push(`**Сайт:** ${audit.url}  `);
  L.push(`**Дата аудита:** ${date}  `);
  L.push(`**Общий балл до внедрения:** ${audit.overall_score}/100  `);
  L.push(`**Приоритет:** ${priorityLabel(audit.overall_score)}  `);
  L.push(`**Исполнитель:** _______________  `);
  L.push(`**Срок выполнения:** _______________  `);
  L.push('');
  L.push('---');
  L.push('');

  // ── Summary ──
  L.push('## 📋 Краткое резюме');
  L.push('');
  const summary = `На сайте ${audit.domain} обнаружено ${audit.found_schemas_count} схем микроразметки, из них ${crit.length} критических ошибок. Текущий балл — ${audit.overall_score}/100. Для повышения видимости в поиске и получения расширенных сниппетов необходимо внедрить ${audit.generated_code.length} блоков структурированных данных Schema.org с реальными данными компании.`;
  L.push(summary);
  L.push('');
  L.push('**Обнаружено на странице:**');
  L.push('');
  L.push('| Параметр | Значение |');
  L.push('|----------|----------|');
  L.push(`| Компания | ${pageData.companyName || 'Не определено'} |`);
  L.push(`| Телефон | ${pageData.phone || 'Не найден'} |`);
  L.push(`| Email | ${pageData.email || 'Не найден'} |`);
  L.push(`| Адрес | ${pageData.address || 'Не найден'} |`);
  L.push(`| Цены | ${pageData.priceRange || 'Не найдены'} |`);
  L.push(`| Тип страницы | ${pageType} |`);
  L.push(`| Найдено схем | ${audit.found_schemas_count} |`);
  L.push(`| Критических ошибок | ${crit.length} |`);
  L.push('');
  L.push('---');
  L.push('');

  // ── Goals ──
  L.push('## 🎯 Цель работы');
  L.push('');
  L.push('Внедрение структурированных данных Schema.org для:');
  L.push('');
  L.push('- Получения расширенных сниппетов в Google и Яндекс');
  L.push('- Повышения CTR в поисковой выдаче на 15–30%');
  L.push('- Улучшения понимания контента страницы поисковыми системами');
  L.push('- Подготовки сайта к требованиям AI-поиска (SGE, Яндекс Нейро)');
  L.push('');
  L.push('---');
  L.push('');

  // ── Issues ──
  L.push('## ⚠️ Текущие проблемы');
  L.push('');

  L.push('### 🔴 Критические (влияют на попадание в Rich Results)');
  L.push('');
  if (crit.length === 0) {
    L.push('_Критических проблем не обнаружено._');
  } else {
    crit.forEach((i, idx) => {
      L.push(`**${idx + 1}. ${i.schema}: ${i.problem}**`);
      if (i.seoImpact) L.push(`- **Последствие:** ${i.seoImpact}`);
      L.push(`- **Решение:** ${i.solution || 'См. готовый код ниже.'}`);
      L.push('');
    });
  }
  L.push('');

  L.push('### 🟡 Важные (снижают качество разметки)');
  L.push('');
  if (warn.length === 0) {
    L.push('_Важных предупреждений нет._');
  } else {
    warn.forEach((i, idx) => {
      L.push(`**${idx + 1}. ${i.schema}: ${i.problem}**`);
      L.push(`- **Решение:** ${i.solution || 'См. готовый код ниже.'}`);
      L.push('');
    });
  }
  L.push('');

  L.push('### 🔵 Рекомендации (для максимального эффекта)');
  L.push('');
  if (info.length === 0) {
    L.push('_Дополнительных рекомендаций нет._');
  } else {
    info.forEach(i => {
      L.push(`- ${i.problem} → ${i.solution || '—'}`);
    });
  }
  L.push('');
  L.push('---');
  L.push('');

  // ── Ready code blocks ──
  L.push('## 💻 Готовый код для внедрения');
  L.push('');
  L.push('> Весь код проверен и готов к копированию.  ');
  L.push('> Вставьте каждый блок внутрь тега `<head>` на нужных страницах.');
  L.push('');

  audit.generated_code.forEach((block, idx) => {
    const action = /исправ/i.test(block.label) ? 'исправить' : 'добавить';
    const placement = placementHint(block.type);
    const priority = priorityFromBlock(block.label);
    const ds = dataSourceFromReason(block.reason || '', block.code || '');

    L.push(`### ${idx + 1}. ${block.type} — ${action}`);
    L.push('');
    L.push(`**Где разместить:** ${placement}  `);
    L.push(`**Приоритет:** ${priority}  `);
    L.push(`**Данные:** ${ds.label}`);
    L.push('');
    L.push('```html');
    L.push('<script type="application/ld+json">');
    L.push(block.code);
    L.push('</script>');
    L.push('```');
    L.push('');
    if (ds.manualFields.length > 0) {
      L.push('⚠️ **Поля для заполнения вручную:**');
      ds.manualFields.forEach(f => {
        L.push(`- \`"${f}"\` — укажите реальное значение для вашей компании`);
      });
      L.push('');
    } else if (ds.label.includes('Требуют')) {
      L.push('⚠️ **Внимание:** часть данных не была найдена автоматически — проверьте код перед публикацией и замените примерные значения на реальные данные компании.');
      L.push('');
    }
    L.push('---');
    L.push('');
  });

  // ── Checklist ──
  L.push('## ✅ Чек-лист внедрения');
  L.push('');
  L.push('Разработчику отметить после выполнения:');
  L.push('');

  const critTypes = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'КРИТИЧНО');
  const warnTypes = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'ВАЖНО');
  const recTypes = audit.generated_code.filter(b => priorityFromBlock(b.label) === 'РЕКОМЕНДУЕТСЯ');

  L.push(`### Этап 1 — Критические исправления (до ${fmtDate(addDays(today, 3))})`);
  L.push('');
  if (critTypes.length === 0) {
    L.push('- [x] Критических исправлений не требуется');
  } else {
    critTypes.forEach(b => {
      L.push(`- [ ] Добавить/исправить ${b.type} — ${placementHint(b.type)}`);
    });
    L.push('- [ ] Проверить каждую схему в Google Rich Results Test');
    L.push('- [ ] Проверить в Яндекс Вебмастер → Разметка');
  }
  L.push('');

  L.push(`### Этап 2 — Важные улучшения (до ${fmtDate(addDays(today, 14))})`);
  L.push('');
  if (warnTypes.length === 0) {
    L.push('- [x] Важных улучшений не требуется');
  } else {
    warnTypes.forEach(b => {
      L.push(`- [ ] Добавить ${b.type}`);
    });
    L.push('- [ ] Проверить валидатором Schema.org');
  }
  L.push('');

  L.push(`### Этап 3 — Рекомендуемые дополнения (до ${fmtDate(addDays(today, 30))})`);
  L.push('');
  if (recTypes.length === 0) {
    L.push('- [x] Дополнительных схем не требуется');
  } else {
    recTypes.forEach(b => {
      L.push(`- [ ] Рассмотреть добавление ${b.type}`);
    });
  }
  L.push('');
  L.push('---');
  L.push('');

  // ── Verification ──
  L.push('## 🔍 Проверка после внедрения');
  L.push('');
  L.push('### Обязательные инструменты');
  L.push('');
  L.push('| Инструмент | Ссылка | Что проверять |');
  L.push('|-----------|--------|---------------|');
  L.push('| Google Rich Results Test | https://search.google.com/test/rich-results | Наличие rich results |');
  L.push('| Schema.org Validator | https://validator.schema.org | Валидность разметки |');
  L.push('| Яндекс Вебмастер | https://webmaster.yandex.ru → Разметка | Обнаружение Яндексом |');
  L.push('| Google Search Console | https://search.google.com/search-console | Ошибки разметки |');
  L.push('');
  L.push('### Критерии успешного внедрения');
  L.push('');
  L.push('- [ ] Google Rich Results Test показывает зелёный статус для всех схем');
  L.push('- [ ] Нет ошибок в Schema.org Validator');
  L.push('- [ ] Яндекс Вебмастер обнаружил разметку (через 3–7 дней)');
  L.push('- [ ] В GSC нет предупреждений по структурированным данным');
  L.push('');
  L.push('---');
  L.push('');

  // ── Expected outcome ──
  L.push('## 📈 Ожидаемый результат');
  L.push('');
  const expectedTypes = (Array.isArray(ai.richResultsEligible)
    ? ai.richResultsEligible.filter((r: any) => r?.eligible).map((r: any) => r.type)
    : audit.generated_code.map(b => b.type)
  ).filter(Boolean);
  const expectedList = expectedTypes.length > 0 ? expectedTypes.join(', ') : 'Breadcrumbs, Sitelinks';

  L.push('| Метрика | До внедрения | После внедрения |');
  L.push('|---------|--------------|-----------------|');
  L.push(`| Балл микроразметки | ${audit.overall_score}/100 | 85–95/100 |`);
  L.push(`| Rich Results в Google | Нет | ${expectedList} |`);
  L.push('| CTR в выдаче | Базовый | +15–30% |');
  L.push('| Видимость в AI-поиске | Низкая | Высокая |');
  L.push('');
  L.push('---');
  L.push('');

  // ── Footer ──
  L.push('## 📞 Контакты и вопросы');
  L.push('');
  L.push('По вопросам технического задания обращайтесь:  ');
  L.push('**Аудит выполнен:** PageForge SEO Platform  ');
  L.push(`**Дата документа:** ${date}  `);
  L.push('');
  L.push('---');
  L.push('');
  L.push('*Документ сгенерирован автоматически на основе анализа страницы.  ');
  L.push('Рекомендуется проверить актуальность данных перед внедрением.*');

  return L.join('\n');
}

/* ─── Main page ─── */
export default function SchemaAuditPage() {
  const [url, setUrl] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualHtml, setManualHtml] = useState('');
  const [running, setRunning] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [audit, setAudit] = useState<AuditRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [errorDomain, setErrorDomain] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const codeSectionRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const handleRun = async () => {
    const target = url.trim();
    if (!target) return;
    if (manualMode && !manualHtml.trim()) {
      toast({ title: 'Вставьте HTML', description: 'В режиме ручного ввода нужно вставить HTML страницы', variant: 'destructive' });
      return;
    }
    setRunning(true);
    setError(null);
    setErrorCode(null);
    setErrorDomain(null);
    setAudit(null);
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep(p => (p < PROGRESS_STEPS.length - 1 ? p + 1 : p));
    }, 2500);

    try {
      await supabase.auth.refreshSession();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: 'Сессия истекла', description: 'Войдите снова', variant: 'destructive' });
        return;
      }

      // Get current project (latest)
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      const projectId = projects?.[0]?.id || null;

      const { data, error: fnErr } = await supabase.functions.invoke('schema-audit', {
        body: { url: target, project_id: projectId, manual_html: manualMode ? manualHtml : undefined },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (data?.error) {
        const code = data.code || null;
        setErrorCode(code);
        setErrorDomain(data.domain || null);
        setError(data.error);
        if (code === 'BOT_PROTECTED') {
          setManualMode(true);
          toast({ title: 'Сайт защищён от парсинга', description: 'Вставьте HTML страницы вручную и запустите анализ повторно.' });
          return;
        }
        throw new Error(data.error);
      }
      if (fnErr) {
        const response = (fnErr as any)?.context;
        const payload = response?.clone ? await response.clone().json().catch(() => null) : null;
        if (payload?.error) {
          const code = payload.code || null;
          setErrorCode(code);
          setErrorDomain(payload.domain || null);
          setError(payload.error);
          if (code === 'BOT_PROTECTED') {
            setManualMode(true);
            toast({ title: 'Сайт защищён от парсинга', description: 'Вставьте HTML страницы вручную и запустите анализ повторно.' });
            return;
          }
          throw new Error(payload.error);
        }
        throw new Error(fnErr.message);
      }
      const auditId = data?.audit_id;
      if (!auditId) throw new Error('Не получен ID анализа');

      // Poll
      const started = Date.now();
      while (Date.now() - started < 90_000) {
        const { data: row } = await supabase
          .from('schema_audits')
          .select('*')
          .eq('id', auditId)
          .maybeSingle();
        if (row && (row.status === 'done' || row.status === 'error')) {
          if (row.status === 'error') throw new Error(row.error_message || 'Ошибка анализа');
          setAudit(row as unknown as AuditRow);
          break;
        }
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e: any) {
      const msg = e?.message || 'Ошибка анализа';
      setError(msg);
      toast({ title: 'Ошибка анализа', description: msg, variant: 'destructive' });
    } finally {
      clearInterval(interval);
      setRunning(false);
    }
  };

  const filteredSchemas = useMemo(() => {
    if (!audit) return [];
    if (activeTab === 'all') return audit.schemas_data;
    const map: Record<string, string> = { jsonld: 'JSON-LD', microdata: 'Microdata', rdfa: 'RDFa' };
    return audit.schemas_data.filter(s => s.format === map[activeTab]);
  }, [audit, activeTab]);

  const downloadTz = () => {
    if (!audit) return;
    const md = buildTzMarkdown(audit);
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const safeDomain = (audit.domain || 'site').replace(/[^\w.-]/g, '_');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `TZ_schema_${safeDomain}_${dateStr}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast({ title: 'ТЗ скачано', description: 'Передайте разработчику для внедрения.' });
  };

  const scrollToCode = () => codeSectionRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1200px] py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Микроразметка</h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto">
            Найдём JSON-LD, Microdata и RDFa, проверим на ошибки и сгенерируем готовый код
          </p>
        </div>

        {/* Input panel */}
        <div className="rounded-xl border border-border/60 bg-card p-6 max-w-2xl mx-auto space-y-3">
          <Input
            ref={inputRef}
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="https://example.com/page"
            className="h-11 text-sm"
            onKeyDown={e => e.key === 'Enter' && handleRun()}
            disabled={running}
          />
          <div className="flex items-center justify-between rounded-md border border-border/40 px-3 py-2">
            <Label htmlFor="manual-mode" className="text-xs text-muted-foreground cursor-pointer">
              Вставить HTML вручную (для сайтов с защитой от ботов)
            </Label>
            <Switch id="manual-mode" checked={manualMode} onCheckedChange={setManualMode} disabled={running} />
          </div>
          {manualMode && (
            <Textarea
              value={manualHtml}
              onChange={e => setManualHtml(e.target.value)}
              placeholder="Вставьте HTML код страницы сюда..."
              className="min-h-[160px] text-xs font-mono"
              disabled={running}
            />
          )}
          <Button onClick={handleRun} disabled={running || !url.trim()} className="w-full h-11 gap-2">
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {running ? 'Анализ...' : (manualMode ? 'Анализировать HTML' : 'Проверить микроразметку')}
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Анализируем JSON-LD, Microdata и RDFa • Стоимость: 2 кредита
          </p>
        </div>

        {/* Loading */}
        {running && (
          <div className="flex flex-col items-center gap-6 py-8">
            <Loader2 className="w-7 h-7 text-primary animate-spin" />
            <div className="w-72 space-y-2">
              {PROGRESS_STEPS.map((s, i) => (
                <div key={i} className={`flex items-center gap-2 text-xs transition-opacity ${i <= progressStep ? 'opacity-100' : 'opacity-30'}`}>
                  {i < progressStep ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" /> :
                   i === progressStep ? <Loader2 className="w-3.5 h-3.5 text-primary animate-spin shrink-0" /> :
                   <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" />}
                  <span className="text-muted-foreground">{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && !running && errorCode === 'BOT_PROTECTED' && (
          <div className="rounded-xl border border-yellow-500/30 bg-card p-6 max-w-2xl mx-auto space-y-3">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-yellow-500" />
              <p className="text-sm font-semibold text-foreground">Сайт защищён от парсинга</p>
            </div>
            <p className="text-xs text-muted-foreground">
              {errorDomain || 'Сайт'} использует защиту от ботов (DDoS-Guard / Cloudflare / KillBot).
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Варианты:</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Включите «Вставить HTML вручную» и вставьте код страницы</li>
                <li>Проверьте другую страницу того же сайта</li>
                <li>Используйте Google Cache версию страницы</li>
              </ul>
            </div>
            <Button size="sm" variant="outline" onClick={() => setManualMode(true)} className="gap-2 mt-2">
              <Code2 className="w-3.5 h-3.5" /> Включить ручной ввод HTML
            </Button>
          </div>
        )}

        {error && !running && errorCode !== 'BOT_PROTECTED' && (
          <div className="rounded-xl border border-red-500/30 bg-card p-6 text-center max-w-2xl mx-auto">
            <XCircle className="w-7 h-7 text-red-500 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Не удалось выполнить анализ</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {!audit && !running && !error && <EmptyState onStart={() => inputRef.current?.focus()} />}

        {/* Results */}
        {audit && !running && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Scores */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Общий балл</p>
                <p className={`text-3xl font-bold ${scoreColor(audit.overall_score)}`}>
                  {audit.overall_score}<span className="text-base text-muted-foreground font-normal">/100</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">{scoreLabel(audit.overall_score)}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Найдено схем</p>
                <p className="text-3xl font-bold text-foreground">{audit.found_schemas_count}</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Ошибок</p>
                <p className={`text-3xl font-bold ${audit.errors_count > 0 ? 'text-red-400' : 'text-green-400'}`}>{audit.errors_count}</p>
              </div>
              {(() => {
                const RICH_TYPES = ['Product','Article','BlogPosting','FAQPage','BreadcrumbList','LocalBusiness'];
                const implemented = audit.schemas_data.filter(s => s.severity === 'ok' && RICH_TYPES.includes(s.type)).length;
                const potential = (audit.generated_code || []).filter(b => RICH_TYPES.includes(b.type)).length;
                const total = implemented + potential;
                const color = implemented > 0 ? 'text-green-400' : potential > 0 ? 'text-yellow-400' : 'text-muted-foreground';
                return (
                  <div className="rounded-xl border border-border/60 bg-card p-5 text-center">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">Rich Results</p>
                    <p className={`text-3xl font-bold ${color}`}>
                      {implemented > 0 ? implemented : `Возможно ${total}`}
                    </p>
                    {implemented === 0 && potential > 0 && (
                      <p className="text-[10px] text-muted-foreground mt-1">после внедрения схем</p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div className="rounded-xl border border-border/60 bg-card p-4">
              <CoverageChips schemas={audit.schemas_data} />
            </div>

            {/* Page data extracted */}
            {audit.ai_recommendations?.pageData && (
              <div className="rounded-xl border border-border/60 bg-card p-5 space-y-3">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  📊 Обнаружено на странице
                </h2>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  ✅ — из meta/schema (надёжно) · ⚠️ — из текста (проверьте) · ❌ — не найдено
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                  {([
                    ['Компания', audit.ai_recommendations.pageData.companyName, 'companyName'],
                    ['Телефон', audit.ai_recommendations.pageData.phone, 'phone'],
                    ['Адрес', audit.ai_recommendations.pageData.address, 'address'],
                    ['Email', audit.ai_recommendations.pageData.email, 'email'],
                    ['Цены', audit.ai_recommendations.pageData.priceRange, null],
                    ['Рейтинг', audit.ai_recommendations.pageData.rating, null],
                    ['Часы работы', audit.ai_recommendations.pageData.workingHours, null],
                    ['Описание', audit.ai_recommendations.pageData.description, 'description'],
                  ] as [string, string | null, string | null][]).map(([label, val, key]) => {
                    const conf = (key && audit.ai_recommendations?.pageData?.confidence?.[key]) || (val ? 'low' : 'none');
                    const icon = !val ? '❌' : conf === 'high' ? '✅' : '⚠️';
                    const tone = !val ? 'text-muted-foreground/50'
                      : conf === 'high' ? 'text-foreground'
                      : 'text-amber-300';
                    const title = !val ? 'Не найдено'
                      : conf === 'high' ? 'Высокая надёжность — из структурированных данных'
                      : 'Низкая надёжность — извлечено из текста, проверьте';
                    return (
                    <div key={label} className="flex items-center justify-between gap-3 py-1 border-b border-border/30 last:border-0">
                      <span className="text-muted-foreground text-xs">{label}</span>
                      <span className={`text-xs truncate max-w-[60%] flex items-center gap-1.5 ${tone}`} title={title}>
                        <span className="truncate">{val || 'не найдено'}</span>
                        <span className="shrink-0 text-[11px]" aria-hidden>{icon}</span>
                      </span>
                    </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Schemas */}
            {audit.schemas_data.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Найденные схемы</h2>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="all">Все</TabsTrigger>
                    <TabsTrigger value="jsonld">JSON-LD</TabsTrigger>
                    <TabsTrigger value="microdata">Microdata</TabsTrigger>
                    <TabsTrigger value="rdfa">RDFa</TabsTrigger>
                  </TabsList>
                  <TabsContent value={activeTab} className="space-y-3 mt-4">
                    {filteredSchemas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">Схем этого формата не найдено</p>
                    ) : filteredSchemas.map((s, i) => <SchemaCard key={i} schema={s} />)}
                  </TabsContent>
                </Tabs>
              </div>
            )}

            {/* Issues */}
            {audit.issues.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-base font-semibold text-foreground">Проблемы и рекомендации</h2>
                {(['critical', 'warning', 'info'] as const).map(sev => {
                  const items = audit.issues.filter(i => i.severity === sev);
                  if (items.length === 0) return null;
                  const config = {
                    critical: { icon: '🔴', title: 'КРИТИЧНО (блокирует Rich Results)', cls: 'border-red-500/20' },
                    warning: { icon: '🟡', title: 'ПРЕДУПРЕЖДЕНИЯ', cls: 'border-yellow-500/20' },
                    info: { icon: '🔵', title: 'РЕКОМЕНДАЦИИ', cls: 'border-blue-500/20' },
                  }[sev];
                  return (
                    <div key={sev} className={`rounded-xl border ${config.cls} bg-card p-5 space-y-3`}>
                      <h3 className="text-sm font-semibold text-foreground">{config.icon} {config.title}</h3>
                      <ul className="space-y-2">
                        {items.map((it, i) => (
                          <li key={i} className="text-sm text-foreground flex items-start gap-2">
                            <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground shrink-0 mt-0.5">{it.schema}</span>
                            <div className="flex-1">
                              <p>{it.problem}</p>
                              {it.solution && <p className="text-xs text-muted-foreground mt-0.5">{it.solution}</p>}
                              {it.seoImpact && <p className="text-xs text-muted-foreground mt-0.5 italic">Почему важно: {it.seoImpact}</p>}
                            </div>
                            {audit.generated_code.length > 0 && (
                              <button onClick={scrollToCode} className="text-xs text-primary hover:underline shrink-0">Как исправить →</button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Generated code */}
            {audit.generated_code.length > 0 && (
              <div ref={codeSectionRef} className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-semibold text-foreground">Готовый код для вставки в &lt;head&gt;</h2>
                </div>
                <div className="space-y-4">
                  {audit.generated_code.map((b, i) => <CodeBlock key={i} block={b} />)}
                </div>
              </div>
            )}

            {/* TZ download */}
            <div className="rounded-xl border border-border/60 bg-card p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">ТЗ для разработчика</h3>
                <p className="text-xs text-muted-foreground">Полный план внедрения с готовым кодом и инструкциями</p>
              </div>
              <Button onClick={downloadTz} className="gap-2">
                <Download className="w-4 h-4" /> Скачать ТЗ
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}