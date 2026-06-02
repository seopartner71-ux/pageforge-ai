import { useState, useEffect, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';
import { AppHeader } from '@/components/AppHeader';
import { supabase } from '@/integrations/supabase/client';
import { useAdsDashboard } from '@/lib/ads/useAdsDashboard';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  Calendar as CalendarIcon, Filter, Bell, ChevronRight, TrendingUp, TrendingDown,
  Bot, Send, Sparkles, AlertTriangle, Loader2, Check, User as UserIcon,
} from 'lucide-react';

const spark = (seed: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    x: i,
    y: Math.round(40 + Math.sin(i / 1.8 + seed) * 18 + (i % 3) * 4 + seed * 2),
  }));

const DYNAMIC_TABS = ['Расход', 'Конверсии', 'CPL', 'CTR', 'Показы'] as const;
type ChartTab = (typeof DYNAMIC_TABS)[number];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  working: { label: 'Работает', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  limited: { label: 'Ограничен бюджетом', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
  low_ctr: { label: 'Низкий CTR', color: 'bg-red-500/15 text-red-400 border-red-500/30' },
  paused:  { label: 'Остановлен', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
};
const ALERT_COLOR: Record<string, string> = {
  red: 'bg-red-500', yellow: 'bg-yellow-500', blue: 'bg-blue-500', emerald: 'bg-emerald-500',
};
const fmtMoney = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`;
const fmtShortDate = (iso: string) => format(new Date(iso), 'd MMM', { locale: ru });

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const heatVal = (d: number, h: number) => {
  const peak = Math.exp(-((h - 12) ** 2) / 18);
  const weekday = d < 5 ? 1 : 0.55;
  return Math.min(1, peak * weekday + ((d * 7 + h) % 5) * 0.03);
};
const heatColor = (v: number) => {
  if (v < 0.1) return 'bg-slate-800';
  if (v < 0.25) return 'bg-blue-900';
  if (v < 0.4) return 'bg-blue-800';
  if (v < 0.55) return 'bg-blue-700';
  if (v < 0.7) return 'bg-blue-600';
  if (v < 0.85) return 'bg-blue-500';
  return 'bg-blue-400';
};

/* ============ Atoms ============ */

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="w-3 h-3" />{up ? '+' : ''}{delta}%
    </span>
  );
}

function Sparkline({ seed, color = '#3B82F6' }: { seed: number; color?: string }) {
  const data = useMemo(() => spark(seed), [seed]);
  return (
    <ResponsiveContainer width="100%" height={40}>
      <LineChart data={data} margin={{ top: 4, bottom: 4, left: 0, right: 0 }}>
        <Line type="monotone" dataKey="y" stroke={color} strokeWidth={1.6} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CircularScore({ value, size = 96, stroke = 8 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1F2937" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#10B981" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-semibold text-white">{value}<span className="text-slate-400 text-xs">/100</span></span>
      </div>
    </div>
  );
}

function MiniScore({ value }: { value: number }) {
  const color = value >= 80 ? '#10B981' : value >= 70 ? '#3B82F6' : value >= 60 ? '#F59E0B' : '#EF4444';
  const size = 32, stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1F2937" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-semibold text-white">{value}</span>
    </div>
  );
}

/* ============ Page ============ */

type ChatMsg = { role: 'user' | 'ai'; text: string };

export default function AdsOverviewPage() {
  /* Date range — default: последние 7 дней */
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = new Date(); to.setHours(0, 0, 0, 0);
    const from = new Date(to); from.setDate(to.getDate() - 6);
    return { from, to };
  });

  const {
    loading, accounts, campaigns, daily, accountAggs, alerts, recs,
    queries: badQueries, axes, kpis,
    setRecs, setQueries: setBadQueries, setAlerts,
  } = useAdsDashboard(dateRange);

  /* Chart tabs */
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>('Расход');

  /* AI Chat */
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([
    { role: 'ai', text: 'Почему вырос CPL:\n1) CTR в РСЯ снизился на 18%\n2) Активизировались 3 крупных конкурента\n3) Бюджет смещён в дорогие ключи' },
  ]);
  const [aiTyping, setAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, aiTyping]);

  const sendChat = () => {
    const text = chatInput.trim();
    if (!text || aiTyping) return;
    setChatHistory((h) => [...h, { role: 'user', text }]);
    setChatInput('');
    setAiTyping(true);
    setTimeout(() => {
      setChatHistory((h) => [...h, {
        role: 'ai',
        text: 'Я проанализировал ваш запрос. Рекомендую снизить ставку на 15% в вечернее время и добавить корректировки по аудитории look-alike.',
      }]);
      setAiTyping(false);
    }, 1500);
  };

  /* Bad queries — пометка как минус-фраза в БД */
  const removeBadQuery = async (id: string) => {
    setBadQueries((q) => q.filter((x) => x.id !== id));
    const { error } = await supabase.from('ads_search_queries').update({ is_negative: true }).eq('id', id);
    if (error) toast.error('Не удалось сохранить'); else toast.success('Слово добавлено в минус-фразы');
  };

  /* AI recommendations */
  const [recLoading, setRecLoading] = useState<Record<string, boolean>>({});
  const applyRec = async (recId: string) => {
    if (recLoading[recId]) return;
    setRecLoading((s) => ({ ...s, [recId]: true }));
    toast.info('Запуск автоматизации...');
    const { error } = await supabase.from('ads_recommendations').update({ status: 'done' }).eq('id', recId);
    if (error) { toast.error('Ошибка'); setRecLoading((s) => ({ ...s, [recId]: false })); return; }
    setRecs((rs) => rs.map(r => r.id === recId ? { ...r, status: 'done' } : r));
    setRecLoading((s) => ({ ...s, [recId]: false }));
    toast.success('Рекомендация применена');
  };

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return 'Выбрать даты';
    if (!dateRange.to) return format(dateRange.from, 'd MMM yyyy', { locale: ru });
    return `${format(dateRange.from, 'd MMM', { locale: ru })} – ${format(dateRange.to, 'd MMM yyyy', { locale: ru })}`;
  }, [dateRange]);

  /* Данные графика — берём из daily, мапим по выбранной метрике */
  const chartData = useMemo(() => {
    const map: Record<ChartTab, (d: typeof daily[number]) => number> = {
      'Расход':    d => d.spend,
      'Конверсии': d => d.conversions,
      'CPL':       d => d.conversions > 0 ? Math.round(d.spend / d.conversions) : 0,
      'CTR':       d => d.impressions > 0 ? Number(((d.clicks / d.impressions) * 100).toFixed(2)) : 0,
      'Показы':    d => d.impressions,
    };
    const get = map[activeChartTab];
    return daily.map(d => ({ d: fmtShortDate(d.date), v: get(d) }));
  }, [daily, activeChartTab]);

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200">
      <AppHeader />
      <main className="px-6 py-5 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Реклама</span><ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-100 font-medium">Обзор</span>
          </div>
          <div className="flex items-center gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white">
                  <CalendarIcon className="w-4 h-4 mr-2" />{dateLabel}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#0B0F19] border-slate-800" align="end">
                <CalendarComp
                  mode="range"
                  selected={dateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                  locale={ru}
                  className="pointer-events-auto p-3"
                />
              </PopoverContent>
            </Popover>
            <Button
              variant="outline" size="sm"
              onClick={() => toast.info('Фильтры скоро будут доступны')}
              className="bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Filter className="w-4 h-4 mr-2" />Фильтры
            </Button>
            <Button
              variant="outline" size="icon"
              onClick={() => toast('У вас 3 новых уведомления')}
              className="relative bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white h-9 w-9"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">3</span>
            </Button>
          </div>
        </div>

        {/* ROW 1: KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-xl bg-[#111827] border-[#1F2937] p-4 space-y-3">
                  <Skeleton className="h-3 w-20 bg-slate-800" />
                  <Skeleton className="h-7 w-24 bg-slate-800" />
                  <Skeleton className="h-10 w-full bg-slate-800" />
                </Card>
              ))
            : (
              <>
                {kpis.map((k, i) => (
                  <Card key={k.key} className="rounded-xl bg-[#111827] border-[#1F2937] p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">{k.label}</span>
                      <DeltaBadge delta={k.delta} />
                    </div>
                    <div className="text-2xl font-semibold text-white tracking-tight">{k.value}</div>
                    <Sparkline seed={i + 1} color={k.delta >= 0 ? '#10B981' : '#EF4444'} />
                  </Card>
                ))}
                <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 flex items-center gap-3">
                  <CircularScore value={accountAggs[0]?.score ?? 84} />
                  <div>
                    <div className="text-xs text-slate-400">Оценка кабинета</div>
                    <div className="text-sm font-medium text-emerald-400 mt-1">Хорошая оптимизация</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{recs.length} рекомендаций</div>
                  </div>
                </Card>
              </>
            )}
        </div>

        {/* ROW 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-200 text-sm">Что требует внимания</h3>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800" />)}
              </div>
            ) : (
              <ul className="space-y-3">
                {alerts.length === 0 && <li className="text-xs text-slate-500 py-2">Нет активных алертов</li>}
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-start gap-2">
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${ALERT_COLOR[a.severity] ?? 'bg-slate-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-300 leading-snug">{a.text}</p>
                      <p className={`text-[11px] font-medium mt-0.5 ${a.impact_positive ? 'text-emerald-400' : 'text-red-400'}`}>
                        {a.impact_positive ? '+' : '−'}{Math.round(a.impact_value).toLocaleString('ru-RU')} ₽/мес
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-medium text-slate-200 text-sm">Динамика — {activeChartTab}</h3>
              <div className="flex gap-1">
                {DYNAMIC_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setActiveChartTab(t)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      activeChartTab === t
                        ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[240px]">
              {loading ? (
                <Skeleton className="h-full w-full bg-slate-800" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                    <XAxis dataKey="d" stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: '#1F2937' }} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={48} />
                    <Tooltip
                      contentStyle={{ background: '#0B0F19', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#94A3B8' }}
                    />
                    <Line type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2}
                      dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Кампании (топ 5)</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800" />)}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2">Кампания</TableHead>
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Расход</TableHead>
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">CPL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((c) => (
                    <TableRow key={c.name} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="py-2 px-2">
                        <div className="text-xs text-slate-200 truncate max-w-[140px]">{c.name}</div>
                        <Badge variant="outline" className={`mt-1 text-[10px] px-1.5 py-0 h-4 ${c.status.color}`}>{c.status.label}</Badge>
                      </TableCell>
                      <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{c.spend}</TableCell>
                      <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{c.cpl}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </div>

        {/* ROW 3 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 flex flex-col min-h-[320px]">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-slate-200 text-sm">AI-ассистент по рекламе</h3>
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1 max-h-[220px]">
              {chatHistory.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'ai' && (
                    <div className="w-6 h-6 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                      <Bot className="w-3 h-3" />
                    </div>
                  )}
                  <div
                    className={`text-xs leading-snug rounded-lg px-2.5 py-1.5 max-w-[85%] whitespace-pre-line ${
                      m.role === 'user'
                        ? 'bg-blue-500 text-white'
                        : 'bg-slate-800/60 text-slate-200 border border-slate-800'
                    }`}
                  >
                    {m.text}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-6 h-6 rounded-md bg-slate-800 text-slate-400 flex items-center justify-center shrink-0">
                      <UserIcon className="w-3 h-3" />
                    </div>
                  )}
                </div>
              ))}
              {aiTyping && (
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>AI печатает…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 mt-auto">
              <Input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }}
                placeholder="Спросите что угодно..."
                disabled={aiTyping}
                className="bg-[#0B0F19] border-slate-800 text-xs h-9 text-slate-200 placeholder:text-slate-500"
              />
              <Button
                size="icon" onClick={sendChat} disabled={aiTyping || !chatInput.trim()}
                className="h-9 w-9 bg-blue-500 hover:bg-blue-600 text-white shrink-0 disabled:opacity-50"
              >
                {aiTyping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-2">AI-аудит кабинета</h3>
            <div className="h-[220px]">
              {loading ? (
                <Skeleton className="h-full w-full bg-slate-800" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radar}>
                    <PolarGrid stroke="#1F2937" />
                    <PolarAngleAxis dataKey="axis" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} stroke="#1F2937" />
                    <Radar dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Поисковые запросы (проблемные)</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full bg-slate-800" />)}
              </div>
            ) : badQueries.length === 0 ? (
              <div className="text-xs text-slate-500 py-6 text-center">Все проблемные запросы обработаны 🎉</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2">Запрос</TableHead>
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Расход</TableHead>
                    <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {badQueries.map((q) => (
                    <TableRow key={q.id} className="border-slate-800 hover:bg-slate-800/30">
                      <TableCell className="py-2 px-2 text-xs text-slate-200 truncate max-w-[140px]">{q.q}</TableCell>
                      <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{q.spend}</TableCell>
                      <TableCell className="py-2 px-2 text-right">
                        <button
                          onClick={() => q.conv === 0
                            ? removeBadQuery(q.id)
                            : toast.info('Запрос отправлен на проверку')}
                          className={`text-[11px] font-medium ${q.conv === 0 ? 'text-red-400 hover:text-red-300' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                          {q.conv === 0 ? 'В минус' : 'Проверить'}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Конверсии по часам</h3>
            {loading ? (
              <Skeleton className="h-[160px] w-full bg-slate-800" />
            ) : (
              <div className="overflow-x-auto">
                <div className="inline-block">
                  <div className="flex">
                    <div className="w-8" />
                    {HOURS.filter((h) => h % 3 === 0).map((h) => (
                      <div key={h} className="text-[9px] text-slate-500 w-[24px] text-left" style={{ marginRight: 2 }}>{h}</div>
                    ))}
                  </div>
                  {DAYS.map((day, di) => (
                    <div key={day} className="flex items-center mb-0.5">
                      <div className="w-8 text-[10px] text-slate-500">{day}</div>
                      <div className="flex gap-0.5">
                        {HOURS.map((h) => {
                          const v = heatVal(di, h);
                          return <div key={h} className={`w-2 h-4 rounded-[2px] ${heatColor(v)}`} title={`${day} ${h}:00 — ${(v * 100).toFixed(0)}%`} />;
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[11px] text-blue-300">Лучшие часы: 10:00–13:00</span>
            </div>
          </Card>
        </div>

        {/* ROW 4 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <h3 className="font-medium text-slate-200 text-sm mb-3">AI-рекомендации</h3>
            <ul className="space-y-3">
              {INITIAL_RECS.map((r) => {
                const state = recState[r.id] ?? 'idle';
                return (
                  <li key={r.id} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${state === 'done' ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{r.text}</p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">+{r.save}</p>
                    </div>
                    <Button
                      variant="outline" size="sm"
                      onClick={() => applyRec(r)}
                      disabled={state === 'loading' || state === 'done'}
                      className="h-7 text-[11px] bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white shrink-0 disabled:opacity-60"
                    >
                      {state === 'loading' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
                      {state === 'done' && <Check className="w-3 h-3 mr-1 text-emerald-400" />}
                      {state === 'idle' ? r.cta : state === 'loading' ? 'Применяю…' : 'Выполнено'}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-2">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Кабинеты (все)</h3>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-slate-800" />)}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-[11px] text-slate-500 h-7">Кабинет</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7">Оценка</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">Расход</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">Конв.</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">CPL</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">ROMI</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">Проблемы</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7 text-right">Потери</TableHead>
                      <TableHead className="text-[11px] text-slate-500 h-7">Тренд</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a) => (
                      <TableRow key={a.id} className="border-slate-800 hover:bg-slate-800/30">
                        <TableCell className="py-2">
                          <div className="text-xs text-slate-100 font-medium">{a.name}</div>
                          <div className="text-[10px] text-slate-500">ID {a.id}</div>
                        </TableCell>
                        <TableCell className="py-2"><MiniScore value={a.score} /></TableCell>
                        <TableCell className="py-2 text-xs text-slate-300 text-right">{a.spend}</TableCell>
                        <TableCell className="py-2 text-xs text-slate-300 text-right">{a.conv}</TableCell>
                        <TableCell className="py-2 text-xs text-slate-300 text-right">{a.cpl}</TableCell>
                        <TableCell className="py-2 text-xs text-emerald-400 text-right">{a.romi}</TableCell>
                        <TableCell className="py-2 text-xs text-red-400 text-right font-medium">{a.problems}</TableCell>
                        <TableCell className="py-2 text-xs text-red-400 text-right">{a.loss}</TableCell>
                        <TableCell className="py-2 w-[120px]"><Sparkline seed={a.seed} color="#3B82F6" /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
