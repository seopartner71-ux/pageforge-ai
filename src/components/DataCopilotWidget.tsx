import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Send, LineChart, AlertTriangle, CheckCircle2,
  XCircle, Wand2, CreditCard, Activity, Bot, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ──────────────────── Types ──────────────────── */
type IntentAction =
  | 'ACTION_TFIDF_ANALYZE'
  | 'ACTION_SGE_BLUEPRINT'
  | 'ACTION_STEALTH_REWRITE'
  | 'ACTION_CREDIT_BALANCE'
  | 'ACTION_DEFAULT';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  card?: IntentAction;
  ts: number;
}

/* ──────────────────── Intent Router ──────────────────── */
function classifyIntent(text: string): IntentAction {
  const t = text.toLowerCase();
  if (/(спам|переспам|tf-?idf|ципф|zipf|плотност)/.test(t)) return 'ACTION_TFIDF_ANALYZE';
  if (/(sge|chatgpt|perplexity|claude|структур|ai-поиск|blueprint|ai\s)/.test(t)) return 'ACTION_SGE_BLUEPRINT';
  if (/(stealth|очеловеч|lsi|редактор|текст|humanness|forge)/.test(t)) return 'ACTION_STEALTH_REWRITE';
  if (/(кредит|баланс|batch|парсинг|загрузк|тариф|оплат)/.test(t)) return 'ACTION_CREDIT_BALANCE';
  return 'ACTION_DEFAULT';
}

async function processUserMessage(text: string): Promise<{ text: string; card?: IntentAction }> {
  await new Promise((r) => setTimeout(r, 500 + Math.random() * 400));
  const intent = classifyIntent(text);
  switch (intent) {
    case 'ACTION_TFIDF_ANALYZE':
      return {
        text:
          'Обнаружено нарушение **закона Ципфа**: частотное распределение топ-токенов отклоняется от ожидаемой кривой 1/n. Ключ «купить» доминирует над медианой ТОП-10 в **3.4×** — классический сигнал коммерческого переспама. Поисковые алгоритмы (Я: «Палех», G: «Helpful Content») понизят страницу в выдаче.\n\n**Рекомендация**: сократить плотность до 2–4%, добавить LSI из конкурентов.',
        card: 'ACTION_TFIDF_ANALYZE',
      };
    case 'ACTION_SGE_BLUEPRINT':
      return {
        text:
          'Для попадания в **AI-ответы (SGE / ChatGPT / Perplexity)** страница должна соответствовать «Золотому Blueprint». Анализ показал критичные пробелы: отсутствует Definition Box в первых 200 словах и низкий Information Gain.\n\n**Приоритет P1**: добавить TL;DR-блок + JSON-LD `FAQPage`.',
        card: 'ACTION_SGE_BLUEPRINT',
      };
    case 'ACTION_STEALTH_REWRITE':
      return {
        text:
          '⚙️ **Initiating Stealth Engine** (методика DrMax)…\n\nПрименены: вариативность ритма предложений, замена шаблонных коннекторов, локализация фразеологии, инъекция LSI-кластера. AI-детекторы (GPTZero, Originality.ai) больше не классифицируют текст как машинный.',
        card: 'ACTION_STEALTH_REWRITE',
      };
    case 'ACTION_CREDIT_BALANCE':
      return {
        text:
          '💳 Текущий баланс и расход кредитов. **Batch-режим** обрабатывает 2–5 URL параллельно, каждый URL = 1 кредит. Гео-таргетинг и AI-аналитика входят в стоимость без доплаты.',
        card: 'ACTION_CREDIT_BALANCE',
      };
    default:
      return {
        text:
          '👋 Я **Data Copilot** — аналитический ассистент SEO-Аудит. Могу помочь с:\n\n• 📊 **TF-IDF / Закон Ципфа** — диагностика переспама\n• 🤖 **SGE Predictor** — оптимизация под AI-поиск\n• ✍️ **Stealth Engine** — очеловечивание AI-контента\n• 💳 **Кредиты и Batch** — управление балансом\n\nЗадайте вопрос или используйте ключевые слова: *tf-idf, sge, stealth, кредиты*.',
      };
  }
}

/* ──────────────────── Markdown-lite renderer ──────────────────── */
function MdText({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <p key={i}>
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} className="font-semibold text-foreground">{p.slice(2, -2)}</strong>;
              if (p.startsWith('`') && p.endsWith('`'))
                return <code key={j} className="font-mono text-[12px] px-1 py-0.5 rounded bg-muted text-primary">{p.slice(1, -1)}</code>;
              return <span key={j}>{p}</span>;
            })}
          </p>
        );
      })}
    </div>
  );
}

/* ──────────────────── Agentic UI Cards ──────────────────── */
function TfIdfCard() {
  const rows = [
    { word: 'купить', freq: '9.0%', median: '2.6%', status: 'spam' },
    { word: 'недорого', freq: '5.4%', median: '1.8%', status: 'spam' },
    { word: 'доставка', freq: '2.1%', median: '2.0%', status: 'ok' },
    { word: 'гарантия', freq: '0.3%', median: '1.5%', status: 'low' },
  ];
  return (
    <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-destructive/30 bg-destructive/10">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-semibold text-destructive uppercase tracking-wider">TF-IDF Alert · Zipf Violation</span>
      </div>
      <div className="font-mono text-[11px]">
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] px-3 py-1.5 text-muted-foreground border-b border-border/40 bg-muted/30">
          <span>TOKEN</span><span>FREQ</span><span>MED.</span><span>STATUS</span>
        </div>
        {rows.map((r) => (
          <div key={r.word} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] px-3 py-1.5 border-b border-border/20 last:border-0">
            <span className="text-foreground">{r.word}</span>
            <span className={r.status === 'spam' ? 'text-destructive font-semibold' : 'text-foreground'}>{r.freq}</span>
            <span className="text-muted-foreground">{r.median}</span>
            <span className={
              r.status === 'spam' ? 'text-destructive' :
              r.status === 'low' ? 'text-amber-500' : 'text-emerald-500'
            }>
              {r.status === 'spam' ? '● SPAM' : r.status === 'low' ? '● LOW' : '● OK'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SgeBlueprintCard() {
  const items = [
    { label: 'Definition Box (200w)', status: 'missing' },
    { label: 'FAQ Schema (JSON-LD)', status: 'valid' },
    { label: 'Information Gain Score', status: 'low' },
    { label: 'Author E-E-A-T', status: 'valid' },
    { label: 'TL;DR Summary Block', status: 'missing' },
    { label: 'Comparison Table', status: 'low' },
  ];
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/30 bg-primary/10">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Golden Blueprint · SGE Audit</span>
      </div>
      <div className="divide-y divide-border/20">
        {items.map((i) => (
          <div key={i.label} className="flex items-center justify-between px-3 py-2 text-[12px]">
            <span className="text-foreground">{i.label}</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              {i.status === 'valid' && <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">VALID</span></>}
              {i.status === 'missing' && <><XCircle className="w-3 h-3 text-destructive" /><span className="text-destructive">MISSING</span></>}
              {i.status === 'low' && <><AlertTriangle className="w-3 h-3 text-amber-500" /><span className="text-amber-500">LOW</span></>}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border/40 bg-muted/30 text-[11px] font-mono text-muted-foreground">
        SGE_READINESS: <span className="text-amber-500 font-semibold">42 / 100</span>
      </div>
    </div>
  );
}

function StealthRewriteCard() {
  return (
    <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/30 bg-emerald-500/10">
        <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Stealth Engine · Result</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[11px]">
          <div className="text-destructive/70 mb-1">— BEFORE</div>
          <div className="text-foreground/80 line-through decoration-destructive/40">
            Кроме того, важно отметить, что наш продукт является лучшим решением на рынке.
          </div>
        </div>
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 font-mono text-[11px]">
          <div className="text-emerald-500/80 mb-1">+ AFTER</div>
          <div className="text-foreground">
            Продукт держит лидерство в нише — это подтверждают независимые тесты NIST 2026.
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">HUMANNESS</div>
            <div className="font-mono text-base font-bold text-emerald-500">94%</div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">SEO HEALTH</div>
            <div className="font-mono text-base font-bold text-primary">88%</div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">LSI INJ.</div>
            <div className="font-mono text-base font-bold text-foreground">+12</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditBalanceCard() {
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-muted/30">
        <CreditCard className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Billing · Account</span>
      </div>
      <div className="p-3 space-y-3">
        <div className="flex items-end justify-between">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground uppercase">Remaining Credits</div>
            <div className="font-mono text-3xl font-bold text-primary leading-none mt-1">12</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground uppercase">Plan</div>
            <div className="font-mono text-xs text-foreground mt-1">PRO · monthly</div>
          </div>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          <div className="flex justify-between"><span>Batch processing</span><span className="text-foreground">1 credit / URL</span></div>
          <div className="flex justify-between"><span>GEO Audit v2.0</span><span className="text-foreground">1 credit</span></div>
          <div className="flex justify-between"><span>Stealth Engine</span><span className="text-emerald-500">FREE</span></div>
        </div>
        <Button size="sm" className="w-full h-8 text-xs bg-primary hover:bg-primary/90">
          Купить кредиты
        </Button>
      </div>
    </div>
  );
}

function CardRenderer({ card }: { card: IntentAction }) {
  switch (card) {
    case 'ACTION_TFIDF_ANALYZE': return <TfIdfCard />;
    case 'ACTION_SGE_BLUEPRINT': return <SgeBlueprintCard />;
    case 'ACTION_STEALTH_REWRITE': return <StealthRewriteCard />;
    case 'ACTION_CREDIT_BALANCE': return <CreditBalanceCard />;
    default: return null;
  }
}

/* ──────────────────── Main Widget ──────────────────── */
export default function DataCopilotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'ai',
      text:
        '👋 Я **Data Copilot** — аналитический ассистент SEO-Аудит.\n\nДоступные модули:\n• 📊 TF-IDF / Закон Ципфа\n• 🤖 SGE Predictor\n• ✍️ Stealth Engine\n• 💳 Кредиты и Batch\n\nСпросите что-нибудь или нажмите быстрый чип ниже.',
      ts: Date.now(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    const res = await processUserMessage(text);
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: 'ai', text: res.text, card: res.card, ts: Date.now() }]);
    setBusy(false);
  };

  const chips = [
    { label: 'TF-IDF переспам', q: 'Почему страница попала под переспам tf-idf?' },
    { label: 'SGE структура', q: 'Как попасть в SGE и AI-ответы?' },
    { label: 'Stealth текст', q: 'Очеловечь AI-текст через stealth' },
    { label: 'Кредиты', q: 'Сколько у меня кредитов и как работает batch?' },
  ];

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[60] w-14 h-14 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-all hover:scale-105 group"
          aria-label="Open Data Copilot"
        >
          <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-6 right-6 z-[60] flex flex-col rounded-xl border border-border/60 bg-background shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ width: 420, height: 650, maxHeight: 'calc(100vh - 48px)', maxWidth: 'calc(100vw - 24px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <LineChart className="w-4 h-4 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-bold text-foreground tracking-tight">Data Copilot</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">SEO-Аудит · v2.0</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-mono font-semibold text-emerald-500 uppercase">Normal</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-4 bg-background">
            {messages.map((m) => (
              <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-md shrink-0 flex items-center justify-center border ${
                  m.role === 'user'
                    ? 'bg-primary/15 border-primary/30 text-primary'
                    : 'bg-muted border-border/60 text-foreground'
                }`}>
                  {m.role === 'user' ? <UserIcon className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>
                <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'flex justify-end' : ''}`}>
                  <div className={`inline-block max-w-full rounded-lg px-3 py-2 ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border/60 text-foreground'
                  }`}>
                    <MdText text={m.text} />
                    {m.card && <CardRenderer card={m.card} />}
                  </div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-md bg-muted border border-border/60 flex items-center justify-center">
                  <Bot className="w-3.5 h-3.5 text-foreground" />
                </div>
                <div className="bg-card border border-border/60 rounded-lg px-3 py-2.5 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '120ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '240ms' }} />
                  <span className="ml-2 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">analyzing…</span>
                </div>
              </div>
            )}
          </div>

          {/* Quick chips */}
          <div className="px-3 py-2 border-t border-border/60 bg-card flex gap-1.5 overflow-x-auto scrollbar-none">
            {chips.map((c) => (
              <button
                key={c.label}
                onClick={() => send(c.q)}
                disabled={busy}
                className="shrink-0 text-[11px] font-mono px-2.5 py-1 rounded-md border border-border/60 bg-background hover:bg-primary/10 hover:border-primary/40 hover:text-primary text-muted-foreground transition-colors disabled:opacity-50"
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/60 bg-card">
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background focus-within:border-primary/50 transition-colors">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Спросите про tf-idf, sge, stealth, кредиты…"
                disabled={busy}
                className="flex-1 bg-transparent px-3 py-2.5 text-[13px] outline-none placeholder:text-muted-foreground/60 font-mono"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className="mr-1.5 w-8 h-8 rounded-md bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground flex items-center justify-center transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 text-[10px] font-mono text-muted-foreground/70 text-center uppercase tracking-wider">
              Mock data · Intent Router v1
            </div>
          </div>
        </div>
      )}
    </>
  );
}
