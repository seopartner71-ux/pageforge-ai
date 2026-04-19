import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, MessageSquare, User as UserIcon, Bot, Search, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface CopilotMsg {
  id: string;
  user_id: string;
  session_id: string;
  role: 'user' | 'assistant';
  text: string;
  intent: string | null;
  card_name: string | null;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  email: string | null;
  display_name: string | null;
}

interface SessionGroup {
  session_id: string;
  user_id: string;
  email: string;
  lastAt: string;
  count: number;
  messages: CopilotMsg[];
}

const intentColor: Record<string, string> = {
  ACTION_GREETING: 'bg-muted text-foreground',
  ACTION_TFIDF_ANALYZE: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  ACTION_SGE_BLUEPRINT: 'bg-violet-500/15 text-violet-500 border-violet-500/30',
  ACTION_UNKNOWN_SUPPORT: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
};

export function CopilotChatsTab() {
  const [loading, setLoading] = useState(true);
  const [msgs, setMsgs] = useState<CopilotMsg[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [search, setSearch] = useState('');
  const [activeSession, setActiveSession] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: m } = await supabase
      .from('copilot_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
    const list = (m ?? []) as CopilotMsg[];
    setMsgs(list);

    const ids = Array.from(new Set(list.map((x) => x.user_id)));
    if (ids.length) {
      const { data: p } = await supabase
        .from('profiles')
        .select('user_id,email,display_name')
        .in('user_id', ids);
      const map: Record<string, ProfileLite> = {};
      (p ?? []).forEach((row: any) => { map[row.user_id] = row; });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const sessions: SessionGroup[] = useMemo(() => {
    const map = new Map<string, SessionGroup>();
    // msgs отсортированы по убыванию — реверсируем порядок внутри сессии
    [...msgs].reverse().forEach((m) => {
      const prof = profiles[m.user_id];
      const email = prof?.email || prof?.display_name || m.user_id.slice(0, 8);
      const g = map.get(m.session_id) ?? {
        session_id: m.session_id,
        user_id: m.user_id,
        email,
        lastAt: m.created_at,
        count: 0,
        messages: [],
      };
      g.messages.push(m);
      g.count = g.messages.length;
      if (m.created_at > g.lastAt) g.lastAt = m.created_at;
      g.email = email;
      map.set(m.session_id, g);
    });
    const arr = Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
    if (!search.trim()) return arr;
    const q = search.toLowerCase();
    return arr.filter(
      (s) => s.email.toLowerCase().includes(q) || s.messages.some((m) => m.text.toLowerCase().includes(q)),
    );
  }, [msgs, profiles, search]);

  const active = sessions.find((s) => s.session_id === activeSession) ?? sessions[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Диалоги с Data Copilot
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Все запросы пользователей к ИИ-консультанту: интенты, ответы, тикеты в поддержку.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск по email или тексту…"
              className="pl-8 h-9 w-64"
            />
          </div>
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Обновить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4 border border-border/60 rounded-lg overflow-hidden bg-card">
        {/* Список сессий */}
        <div className="col-span-4 border-r border-border/60 max-h-[640px] overflow-y-auto">
          {sessions.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Пока нет диалогов с Copilot.
            </div>
          ) : (
            sessions.map((s) => {
              const isActive = (active?.session_id) === s.session_id;
              const lastIntent = [...s.messages].reverse().find((m) => m.intent)?.intent;
              return (
                <button
                  key={s.session_id}
                  onClick={() => setActiveSession(s.session_id)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/40 transition-colors ${
                    isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-foreground truncate">{s.email}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {new Date(s.lastAt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-4">
                      {s.count} сообщ.
                    </Badge>
                    {lastIntent && (
                      <Badge className={`text-[10px] font-mono px-1.5 py-0 h-4 border ${intentColor[lastIntent] ?? 'bg-muted'}`}>
                        {lastIntent.replace('ACTION_', '')}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Просмотр сессии */}
        <div className="col-span-8 max-h-[640px] overflow-y-auto bg-background">
          {!active ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Выберите диалог слева</div>
          ) : (
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2">
                <div className="text-sm font-semibold text-foreground">{active.email}</div>
                <code className="text-[10px] font-mono text-muted-foreground">{active.session_id.slice(0, 8)}…</code>
              </div>
              {active.messages.map((m) => (
                <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-md shrink-0 flex items-center justify-center border ${
                    m.role === 'user' ? 'bg-primary/15 border-primary/30 text-primary' : 'bg-muted border-border/60 text-foreground'
                  }`}>
                    {m.role === 'user' ? <UserIcon className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  </div>
                  <div className={`flex-1 min-w-0 ${m.role === 'user' ? 'flex justify-end' : ''}`}>
                    <div className={`inline-block max-w-[90%] rounded-lg px-3 py-2 ${
                      m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border/60 text-foreground'
                    }`}>
                      <div className="text-[12px] whitespace-pre-wrap leading-relaxed">{m.text}</div>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-[9px] font-mono opacity-60">
                          {new Date(m.created_at).toLocaleTimeString('ru-RU')}
                        </span>
                        {m.intent && (
                          <span className={`text-[9px] font-mono px-1 rounded border ${intentColor[m.intent] ?? 'bg-muted'}`}>
                            {m.intent.replace('ACTION_', '')}
                          </span>
                        )}
                        {m.card_name && (
                          <span className="text-[9px] font-mono px-1 rounded bg-muted text-muted-foreground">
                            {m.card_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
