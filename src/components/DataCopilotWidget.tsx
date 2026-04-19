import { useEffect, useRef, useState } from 'react';
import {
  Sparkles, X, Send, LineChart, AlertTriangle, CheckCircle2,
  XCircle, Wand2, CreditCard, Activity, Bot, User as UserIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/* ──────────────────── Types ──────────────────── */
type CardName =
  | 'render_tfidf_alert'
  | 'render_sge_blueprint'
  | 'render_stealth_result'
  | 'render_billing_card';

interface CardPayload { name: CardName; args: any; }

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  card?: CardPayload | null;
  ts: number;
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
function TfIdfCard({ rows = [] }: { rows?: Array<{ word: string; freq: string; median: string; status: string }> }) {
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
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.7fr] px-3 py-1.5 border-b border-border/20 last:border-0">
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
    </div>
  );
}

function SgeBlueprintCard({ items = [], readiness = 0 }: { items?: Array<{ label: string; status: string }>; readiness?: number }) {
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
      <div className="px-3 py-2 border-t border-border/40 bg-muted/30 text-[11px] font-mono text-muted-foreground">
        SGE_READINESS: <span className={`${color} font-semibold`}>{readiness} / 100</span>
      </div>
    </div>
  );
}

function StealthRewriteCard({ before = '', after = '', humanness = 0, seo_health = 0, lsi_added = 0 }: {
  before?: string; after?: string; humanness?: number; seo_health?: number; lsi_added?: number;
}) {
  return (
    <div className="mt-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-emerald-500/30 bg-emerald-500/10">
        <Wand2 className="w-3.5 h-3.5 text-emerald-500" />
        <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wider">Stealth Engine · Result</span>
      </div>
      <div className="p-3 space-y-2.5">
        <div className="rounded border border-destructive/30 bg-destructive/5 p-2 font-mono text-[11px]">
          <div className="text-destructive/70 mb-1">— BEFORE</div>
          <div className="text-foreground/80 line-through decoration-destructive/40">{before}</div>
        </div>
        <div className="rounded border border-emerald-500/30 bg-emerald-500/5 p-2 font-mono text-[11px]">
          <div className="text-emerald-500/80 mb-1">+ AFTER</div>
          <div className="text-foreground">{after}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">HUMANNESS</div>
            <div className="font-mono text-base font-bold text-emerald-500">{humanness}%</div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">SEO HEALTH</div>
            <div className="font-mono text-base font-bold text-primary">{seo_health}%</div>
          </div>
          <div className="rounded bg-muted/40 p-2 text-center">
            <div className="font-mono text-[10px] text-muted-foreground">LSI INJ.</div>
            <div className="font-mono text-base font-bold text-foreground">+{lsi_added}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CreditBalanceCard({ credits = 0, plan = '—' }: { credits?: number; plan?: string }) {
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
            <div className="font-mono text-3xl font-bold text-primary leading-none mt-1">{credits}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground uppercase">Plan</div>
            <div className="font-mono text-xs text-foreground mt-1">{plan}</div>
          </div>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          <div className="flex justify-between"><span>Batch processing</span><span className="text-foreground">1 credit / URL</span></div>
          <div className="flex justify-between"><span>GEO Audit v2.0</span><span className="text-foreground">1 credit</span></div>
          <div className="flex justify-between"><span>Stealth Engine</span><span className="text-emerald-500">FREE</span></div>
        </div>
        <Button size="sm" className="w-full h-8 text-xs bg-primary hover:bg-primary/90" onClick={() => (window.location.href = '/account')}>
          Купить кредиты
        </Button>
      </div>
    </div>
  );
}

function CardRenderer({ card }: { card: CardPayload }) {
  switch (card.name) {
    case 'render_tfidf_alert':   return <TfIdfCard rows={card.args?.rows} />;
    case 'render_sge_blueprint': return <SgeBlueprintCard items={card.args?.items} readiness={card.args?.readiness} />;
    case 'render_stealth_result':return <StealthRewriteCard {...(card.args || {})} />;
    case 'render_billing_card':  return <CreditBalanceCard credits={card.args?.credits} plan={card.args?.plan} />;
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
      role: 'assistant',
      text:
        '👋 Я **Data Copilot** — аналитический ассистент SEO-Аудит на базе Gemini 2.5 Flash.\n\nМогу помочь с:\n• 📊 TF-IDF / Закон Ципфа\n• 🤖 SGE Predictor\n• ✍️ Stealth Engine\n• 💳 Кредиты и Batch\n\nЗадайте вопрос или используйте чипы ниже.',
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
    const history = [...messages, userMsg];
    setMessages(history);
    setBusy(true);

    try {
      const apiMessages = history
        .filter((m) => m.id !== 'init')
        .map((m) => ({ role: m.role, content: m.text }));

      const { data, error } = await supabase.functions.invoke('copilot-chat', {
        body: { messages: apiMessages },
      });

      if (error) {
        const status = (error as any).context?.status;
        if (status === 429) toast.error('Превышен лимит запросов. Попробуйте через минуту.');
        else if (status === 402) toast.error('Закончились кредиты Lovable AI.');
        else toast.error('Не удалось получить ответ от AI.');
        throw error;
      }

      if (data?.error) {
        toast.error(data.error);
        throw new Error(data.error);
      }

      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data?.text || '',
        card: data?.card || null,
        ts: Date.now(),
      }]);
    } catch (e) {
      console.error('[copilot] send error', e);
      setMessages((m) => [...m, {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: '⚠️ Не удалось получить ответ. Попробуйте ещё раз.',
        ts: Date.now(),
      }]);
    } finally {
      setBusy(false);
    }
  };

  const chips = [
    { label: 'TF-IDF переспам', q: 'Проанализируй переспам по TF-IDF на коммерческой странице' },
    { label: 'SGE структура', q: 'Как попасть в SGE и AI-ответы? Сделай аудит структуры' },
    { label: 'Stealth текст', q: 'Очеловечь типичный AI-абзац через Stealth Engine' },
    { label: 'Кредиты', q: 'Сколько у меня кредитов и как работает batch?' },
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
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">SEO-Аудит · Gemini 2.5</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-emerald-500/30 bg-emerald-500/10">
                <Activity className="w-3 h-3 text-emerald-500" />
                <span className="text-[10px] font-mono font-semibold text-emerald-500 uppercase">Live</span>
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
              Powered by Lovable AI · Tool-calling enabled
            </div>
          </div>
        </div>
      )}
    </>
  );
}
