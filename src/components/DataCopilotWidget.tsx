import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Send, LineChart, AlertTriangle, CheckCircle2,
  XCircle, LifeBuoy, Activity, Bot, User as UserIcon, Loader2, BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/* ──────────────────── Types ──────────────────── */
type IntentAction =
  | 'ACTION_GREETING'
  | 'ACTION_TFIDF_ANALYZE'
  | 'ACTION_SGE_BLUEPRINT'
  | 'ACTION_UNKNOWN_SUPPORT';

type CardName = 'render_tfidf_alert' | 'render_sge_blueprint' | 'render_support_ticket' | 'render_register_cta';

interface CardPayload { name: CardName; args?: any; }

interface KbSource { title: string; heading: string; }

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  card?: CardPayload | null;
  kbSources?: KbSource[];
  ts: number;
}

/* ──────────────────── Intent Router ────────────────────
 * Локально определяем только явный вызов саппорта. Всё остальное → реальный AI
 * через edge-функцию copilot-chat (openrouter, gemini-2.5-flash + tool calls).
 * AI сам решит, нужно ли рендерить карточку (TF-IDF / SGE / Stealth / Billing). */
const RX_FORCE_SUPPORT = /(оператор|саппорт|поддержк|позов(и|ите) человек|жив(ой|ого) человек|тикет|сломал|не работает|баг)/i;

function shouldForceSupport(text: string): boolean {
  return RX_FORCE_SUPPORT.test(text.trim());
}

/* ──────────────────── Markdown-lite ──────────────────── */
function MdText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed">
      {text.split('\n').map((line, i) => {
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

/* ──────────────────── Cards ──────────────────── */
function TfIdfCard() {
  const rows = [
    { word: 'купить',    freq: '9.0%', median: '2.6%', status: 'spam' },
    { word: 'пластиковые окна', freq: '6.4%', median: '3.1%', status: 'spam' },
    { word: 'недорого',  freq: '4.8%', median: '1.9%', status: 'spam' },
    { word: 'монтаж',    freq: '0.4%', median: '2.2%', status: 'low' },
    { word: 'гарантия',  freq: '2.1%', median: '2.0%', status: 'ok' },
  ];
  return (
    <div className="mt-2 rounded-lg border border-destructive/40 bg-destructive/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-destructive/30 bg-destructive/10">
        <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
        <span className="text-xs font-semibold text-destructive uppercase tracking-wider">TF-IDF Alert · Zipf Violation</span>
      </div>
      <div className="font-mono text-[11px]">
        <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr] px-3 py-1.5 text-muted-foreground border-b border-border/40 bg-muted/30">
          <span>TOKEN</span><span>FREQ</span><span>MED.</span><span>STATUS</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr] px-3 py-1.5 border-b border-border/20 last:border-0">
            <span className="text-foreground truncate">{r.word}</span>
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
      <div className="px-3 py-2 border-t border-border/40 bg-muted/30 text-[10px] font-mono text-muted-foreground">
        ⚠ Демо-данные. Запустите полный TF-IDF анализ на странице <span className="text-primary">/dashboard</span>.
      </div>
    </div>
  );
}

function SgeBlueprintCard() {
  const items = [
    { label: 'Definition Box (60–80 слов)', status: 'missing' },
    { label: 'FAQ Schema (JSON-LD)',         status: 'valid' },
    { label: 'Information Gain Score',       status: 'low' },
    { label: 'E-E-A-T авторская подпись',    status: 'missing' },
    { label: 'TL;DR в начале статьи',        status: 'valid' },
  ];
  const readiness = 42;
  const color = readiness >= 70 ? 'text-emerald-500' : readiness >= 40 ? 'text-amber-500' : 'text-destructive';
  return (
    <div className="mt-2 rounded-lg border border-primary/30 bg-primary/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-primary/30 bg-primary/10">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-primary uppercase tracking-wider">Golden Blueprint · SGE Audit</span>
      </div>
      <div className="divide-y divide-border/20">
        {items.map((it, i) => (
          <div key={i} className="flex items-center justify-between px-3 py-2 text-[12px]">
            <span className="text-foreground">{it.label}</span>
            <span className="flex items-center gap-1.5 font-mono text-[11px]">
              {it.status === 'valid' && <><CheckCircle2 className="w-3 h-3 text-emerald-500" /><span className="text-emerald-500">VALID</span></>}
              {it.status === 'missing' && <><XCircle className="w-3 h-3 text-destructive" /><span className="text-destructive">MISSING</span></>}
              {it.status === 'low' && <><AlertTriangle className="w-3 h-3 text-amber-500" /><span className="text-amber-500">LOW</span></>}
            </span>
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border/40 bg-muted/30 text-[11px] font-mono text-muted-foreground flex justify-between items-center">
        <span>SGE_READINESS:</span>
        <span className={`${color} font-semibold`}>{readiness} / 100</span>
      </div>
    </div>
  );
}

/* Карточка тикета — пишет в notifications для админа (RLS позволяет insert своих) */
function SupportTicketCard({ originalQuery }: { originalQuery: string }) {
  const [body, setBody] = useState(originalQuery ? `Вопрос: «${originalQuery}»\n\nКонтекст:\n` : '');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!body.trim() || sending) return;
    setSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Войдите в систему, чтобы создать тикет');
        setSending(false);
        return;
      }
      const { error } = await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'support_ticket',
        title: 'Тикет в техподдержку (Data Copilot)',
        message: body.trim().slice(0, 2000),
        metadata: { source: 'data_copilot', original_query: originalQuery, route: window.location.pathname },
      });
      if (error) throw error;
      setSent(true);
      toast.success('Тикет отправлен. Мы ответим в течение рабочего дня.');
    } catch (e: any) {
      console.error('[copilot] ticket error', e);
      toast.error(`Не удалось отправить: ${e?.message || 'ошибка'}`);
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <div className="mt-2 rounded-lg border border-emerald-500/40 bg-emerald-500/5 p-3">
        <div className="flex items-center gap-2 text-emerald-500">
          <CheckCircle2 className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wider">Тикет создан</span>
        </div>
        <p className="text-[12px] text-muted-foreground mt-1.5">
          Ответ придёт в уведомления (🔔 в шапке) и на email.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-amber-500/30 bg-amber-500/10">
        <LifeBuoy className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-xs font-semibold text-amber-600 dark:text-amber-500 uppercase tracking-wider">Создать тикет в поддержку</span>
      </div>
      <div className="p-3 space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Опишите вашу задачу или проблему — оператор ответит в течение рабочего дня."
          className="w-full resize-none rounded-md border border-border/60 bg-background px-2.5 py-2 text-[12px] font-mono outline-none focus:border-primary/50"
        />
        <Button size="sm" onClick={submit} disabled={sending || !body.trim()} className="w-full h-8 text-xs">
          {sending ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Отправка…</> : <><Send className="w-3.5 h-3.5 mr-1.5" />Отправить тикет</>}
        </Button>
      </div>
    </div>
  );
}

function RegisterCtaCard() {
  return (
    <div className="mt-2 rounded-md border border-primary/40 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <div className="text-base">🔒</div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold text-foreground mb-1">
            Полный экспертный разбор — после регистрации
          </div>
          <div className="text-[11px] text-muted-foreground mb-2 leading-relaxed">
            Зарегистрируйтесь, чтобы получить развёрнутые ответы, доступ к ТФ-ИДФ, Предиктору ИИ-выдачи, Стелс-движку и пакетному анализу.
          </div>
          <Button
            size="sm"
            className="h-7 text-[11px] gap-1.5"
            onClick={() => { window.location.href = '/auth'; }}
          >
            <Sparkles className="w-3 h-3" /> Зарегистрироваться бесплатно
          </Button>
        </div>
      </div>
    </div>
  );
}

function CardRenderer({ card }: { card: CardPayload }) {
  switch (card.name) {
    case 'render_tfidf_alert':    return <TfIdfCard />;
    case 'render_sge_blueprint':  return <SgeBlueprintCard />;
    case 'render_support_ticket': return <SupportTicketCard originalQuery={card.args?.query || ''} />;
    case 'render_register_cta':   return <RegisterCtaCard />;
    default: return null;
  }
}

/* ──────────────────── AI Processor (real openrouter via edge fn) ──────────────────── */
async function processUserMessage(
  userText: string,
  history: { role: 'user' | 'assistant'; content: string }[],
): Promise<{ text: string; card: CardPayload | null; kbSources: KbSource[]; intent: string }> {
  // Явный вызов саппорта — без обращения к AI.
  if (shouldForceSupport(userText)) {
    return {
      text: '🛡 Понял, передаю обращение **техподдержке**. Опишите детали в форме ниже — оператор ответит в уведомлениях (🔔) и на email.',
      card: { name: 'render_support_ticket', args: { query: userText } },
      kbSources: [],
      intent: 'ACTION_FORCE_SUPPORT',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('copilot-chat', {
      body: { messages: [...history, { role: 'user', content: userText }] },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);

    const text: string = (data as any)?.text || '';
    const rawCard = (data as any)?.card as { name: string; args: any } | null;
    const kbSources: KbSource[] = Array.isArray((data as any)?.kbSources) ? (data as any).kbSources : [];

    let card: CardPayload | null = null;
    if (rawCard?.name === 'render_tfidf_alert') card = { name: 'render_tfidf_alert', args: rawCard.args };
    else if (rawCard?.name === 'render_sge_blueprint') card = { name: 'render_sge_blueprint', args: rawCard.args };
    else if (rawCard?.name === 'render_register_cta') card = { name: 'render_register_cta', args: {} };

    return {
      text: text || '🤖 Ответ пуст. Уточните вопрос.',
      card,
      kbSources,
      intent: rawCard?.name ? `TOOL:${rawCard.name}` : (kbSources.length > 0 ? 'RAG' : 'TEXT'),
    };
  } catch (e: any) {
    console.error('[copilot] AI error', e);
    return {
      text: '⚠ Не удалось получить ответ от AI (' + (e?.message || 'ошибка сети') + '). Если вопрос срочный — создайте тикет:',
      card: { name: 'render_support_ticket', args: { query: userText } },
      kbSources: [],
      intent: 'ERROR',
    };
  }
}

/* Источники из базы знаний под ответом */
function KbSourcesBlock({ sources }: { sources: KbSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-2 pt-2 border-t border-border/40">
      <div className="flex items-center gap-1.5 text-[10px] font-mono text-primary uppercase tracking-wider mb-1">
        <BookOpen className="w-3 h-3" />
        Источники из базы знаний
      </div>
      <ul className="space-y-0.5">
        {sources.map((s, i) => (
          <li key={i} className="text-[11px] text-muted-foreground truncate">
            • <span className="text-foreground">{s.title}</span>{s.heading ? ` · ${s.heading}` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ──────────────────── Main Widget ──────────────────── */
export default function DataCopilotWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionIdRef = useRef<string>(crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init',
      role: 'assistant',
      text:
        '👋 Я **Data Copilot** — строгий аналитический ассистент.\n\n' +
        'Помогу с:\n• 📊 TF-IDF / Закон Ципфа\n• 🤖 SGE Blueprint\n\n' +
        'Любой другой вопрос → передам в техподдержку. Без галлюцинаций.',
      ts: Date.now(),
    },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // Логирование диалога в Supabase (для админа). Молча игнорируем ошибки.
  const logMessage = async (role: 'user' | 'assistant', text: string, intent?: string, cardName?: string | null) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from('copilot_messages').insert({
        user_id: user.id,
        session_id: sessionIdRef.current,
        role,
        text,
        intent: intent ?? null,
        card_name: cardName ?? null,
      });
    } catch { /* noop */ }
  };

  const send = async (raw?: string) => {
    const text = (raw ?? input).trim();
    if (!text || busy) return;
    setInput('');
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', text, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    void logMessage('user', text);

    // Передаём в AI предыдущую историю (только текст) для контекста
    const history = messages
      .filter((m) => m.text)
      .map((m) => ({ role: m.role, content: m.text }));

    const { text: replyText, card, kbSources, intent } = await processUserMessage(text, history);
    setMessages((m) => [...m, {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: replyText,
      card,
      kbSources,
      ts: Date.now(),
    }]);
    void logMessage('assistant', replyText, intent, card?.name ?? null);
    setBusy(false);
  };

  const chips = [
    { label: 'TF-IDF переспам', q: 'Как обнаружить переспам по TF-IDF?' },
    { label: 'SGE структура',   q: 'Как попасть в SGE и AI-ответы?' },
    { label: 'Связаться с поддержкой', q: 'Хочу позвать оператора' },
  ];

  return (
    <>
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

      {open && (
        <div
          className="fixed bottom-6 right-6 z-[60] flex flex-col rounded-xl border border-border/60 bg-background shadow-2xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
          style={{ width: 400, height: 600, maxHeight: 'calc(100vh - 48px)', maxWidth: 'calc(100vw - 24px)' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-card">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                <LineChart className="w-4 h-4 text-primary" />
              </div>
              <div className="leading-tight">
                <div className="text-[13px] font-bold text-foreground tracking-tight">Data Copilot</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">SEO-Аудит · AI Mode</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-mono font-semibold text-emerald-500 uppercase">System Normal</span>
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
          <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 space-y-4 bg-background">
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
                    {/* Источники намеренно скрыты — экспертиза подаётся как собственная */}
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
                  <span className="ml-2 text-[11px] font-mono text-muted-foreground uppercase tracking-wider">routing…</span>
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
                placeholder="Спросите про tf-idf или sge…"
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
              Strict IntentRouter · Zero Hallucinations
            </div>
          </div>
        </div>
      )}
    </>
  );
}
