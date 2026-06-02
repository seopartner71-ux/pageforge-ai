import { useState } from 'react';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';
import {
  Calendar, Filter, Bell, ChevronRight, TrendingUp, TrendingDown,
  Bot, Send, Sparkles, AlertTriangle, CircleAlert, CircleCheck, Info,
} from 'lucide-react';

/* ---------- Mock data ---------- */

const spark = (seed: number) =>
  Array.from({ length: 14 }, (_, i) => ({
    x: i,
    y: Math.round(40 + Math.sin(i / 1.8 + seed) * 18 + (i % 3) * 4 + seed * 2),
  }));

const KPIS = [
  { label: 'Расход', value: '45 300 ₽', delta: +18, sparkSeed: 1 },
  { label: 'Конверсии', value: '73', delta: +12, sparkSeed: 2 },
  { label: 'CPL', value: '620 ₽', delta: -14, sparkSeed: 3 },
  { label: 'CTR средний', value: '2.31%', delta: +6, sparkSeed: 4 },
  { label: 'ROMI', value: '348%', delta: +24, sparkSeed: 5 },
];

const DYNAMIC_TABS = ['Расход', 'Конверсии', 'CPL', 'CTR', 'Показы'] as const;
const DYNAMIC_DATA = [
  { d: '13 мая', v: 5200 }, { d: '14 мая', v: 6100 }, { d: '15 мая', v: 5800 },
  { d: '16 мая', v: 7300 }, { d: '17 мая', v: 6900 }, { d: '18 мая', v: 8200 },
  { d: '19 мая', v: 7800 },
];

const ALERTS = [
  { color: 'bg-red-500', text: 'Кампания «Поиск / Москва» ограничена бюджетом', impact: '−8 700 ₽/мес', impactColor: 'text-red-400' },
  { color: 'bg-yellow-500', text: 'Объявления группы «РСЯ-Ретаргет» с низким CTR', impact: '−2 300 ₽/мес', impactColor: 'text-red-400' },
  { color: 'bg-blue-500', text: 'Найдены минус-слова для группы «Услуги»', impact: '+1 200 ₽/мес', impactColor: 'text-emerald-400' },
  { color: 'bg-emerald-500', text: 'Стратегия «Макс. конверсий» работает стабильно', impact: '+4 500 ₽/мес', impactColor: 'text-emerald-400' },
  { color: 'bg-yellow-500', text: 'Снижается доля показов на мобильных', impact: '−1 600 ₽/мес', impactColor: 'text-red-400' },
];

const CAMPAIGNS = [
  { name: 'Поиск / Москва', spend: '14 200 ₽', conv: 28, cpl: '507 ₽', status: { label: 'Работает', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' } },
  { name: 'РСЯ / Ретаргет', spend: '8 900 ₽', conv: 11, cpl: '809 ₽', status: { label: 'Ограничен бюджетом', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' } },
  { name: 'Поиск / Регионы', spend: '6 400 ₽', conv: 9, cpl: '711 ₽', status: { label: 'Работает', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' } },
  { name: 'Мастер кампаний', spend: '9 700 ₽', conv: 14, cpl: '692 ₽', status: { label: 'Низкий CTR', color: 'bg-red-500/15 text-red-400 border-red-500/30' } },
  { name: 'Бренд', spend: '6 100 ₽', conv: 11, cpl: '554 ₽', status: { label: 'Работает', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' } },
];

const RADAR_DATA = [
  { axis: 'Настройки', value: 88 },
  { axis: 'Объявления', value: 72 },
  { axis: 'Стратегии', value: 90 },
  { axis: 'Конверсии', value: 81 },
  { axis: 'Аудитории', value: 76 },
];

const BAD_QUERIES = [
  { q: 'купить бесплатно', spend: '1 240 ₽', conv: 0 },
  { q: 'скачать торрент', spend: '980 ₽', conv: 0 },
  { q: 'работа удаленно', spend: '760 ₽', conv: 1 },
  { q: 'отзывы форум', spend: '540 ₽', conv: 0 },
  { q: 'своими руками', spend: '420 ₽', conv: 0 },
];

const DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
function heatVal(d: number, h: number) {
  const peak = Math.exp(-((h - 12) ** 2) / 18);
  const weekday = d < 5 ? 1 : 0.55;
  return Math.min(1, peak * weekday + ((d * 7 + h) % 5) * 0.03);
}
function heatColor(v: number) {
  if (v < 0.1) return 'bg-slate-800';
  if (v < 0.25) return 'bg-blue-900';
  if (v < 0.4) return 'bg-blue-800';
  if (v < 0.55) return 'bg-blue-700';
  if (v < 0.7) return 'bg-blue-600';
  if (v < 0.85) return 'bg-blue-500';
  return 'bg-blue-400';
}

const AI_RECS = [
  { icon: Sparkles, text: 'Добавьте 12 минус-слов в группу «Услуги»', save: '8 700 ₽/мес', cta: 'Применить' },
  { icon: Sparkles, text: 'Перераспределить бюджет с РСЯ на Поиск', save: '5 400 ₽/мес', cta: 'Применить' },
  { icon: Sparkles, text: 'Сгенерировать 6 новых объявлений для группы «Москва»', save: '3 100 ₽/мес', cta: 'Сгенерировать' },
  { icon: Sparkles, text: 'Включить корректировки −20% для мобильных в ночное время', save: '1 800 ₽/мес', cta: 'Применить' },
];

const ACCOUNTS = [
  { name: 'Главный кабинет', id: '8123-44-21', score: 84, spend: '45 300 ₽', conv: 73, cpl: '620 ₽', romi: '348%', problems: 5, loss: '12 600 ₽', seed: 2 },
  { name: 'Клиент: Аптека+', id: '7711-09-02', score: 71, spend: '32 100 ₽', conv: 41, cpl: '783 ₽', romi: '212%', problems: 8, loss: '9 200 ₽', seed: 4 },
  { name: 'Клиент: AutoPro', id: '6620-77-15', score: 92, spend: '58 700 ₽', conv: 96, cpl: '611 ₽', romi: '412%', problems: 2, loss: '2 100 ₽', seed: 6 },
  { name: 'Клиент: EduMax', id: '5520-31-88', score: 64, spend: '21 400 ₽', conv: 18, cpl: '1 188 ₽', romi: '118%', problems: 11, loss: '14 800 ₽', seed: 1 },
];

/* ---------- Atoms ---------- */

function DeltaBadge({ delta }: { delta: number }) {
  const up = delta >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
      <Icon className="w-3 h-3" />
      {up ? '+' : ''}{delta}%
    </span>
  );
}

function Sparkline({ seed, color = '#3B82F6' }: { seed: number; color?: string }) {
  const data = spark(seed);
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
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="#10B981" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
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
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
      </svg>
      <span className="absolute text-[10px] font-semibold text-white">{value}</span>
    </div>
  );
}

/* ---------- Page ---------- */

export default function AdsOverviewPage() {
  const [tab, setTab] = useState<(typeof DYNAMIC_TABS)[number]>('Расход');

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200">
      <AppHeader />
      <main className="px-6 py-5 max-w-[1600px] mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Реклама</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-100 font-medium">Обзор</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white">
              <Calendar className="w-4 h-4 mr-2" />13 – 19 мая 2024
            </Button>
            <Button variant="outline" size="sm" className="bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white">
              <Filter className="w-4 h-4 mr-2" />Фильтры
            </Button>
            <Button variant="outline" size="icon" className="relative bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white h-9 w-9">
              <Bell className="w-4 h-4" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">3</span>
            </Button>
          </div>
        </div>

        {/* ROW 1: KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {KPIS.map((k) => (
            <Card key={k.label} className="rounded-xl bg-[#111827] border-[#1F2937] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">{k.label}</span>
                <DeltaBadge delta={k.delta} />
              </div>
              <div className="text-2xl font-semibold text-white tracking-tight">{k.value}</div>
              <Sparkline seed={k.sparkSeed} color={k.delta >= 0 ? '#10B981' : '#EF4444'} />
            </Card>
          ))}
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 flex items-center gap-3">
            <CircularScore value={84} />
            <div>
              <div className="text-xs text-slate-400">Оценка кабинета</div>
              <div className="text-sm font-medium text-emerald-400 mt-1">Хорошая оптимизация</div>
              <div className="text-[11px] text-slate-500 mt-0.5">5 рекомендаций</div>
            </div>
          </Card>
        </div>

        {/* ROW 2: 1/4 + 2/4 + 1/4 */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-200 text-sm">Что требует внимания</h3>
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
            </div>
            <ul className="space-y-3">
              {ALERTS.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-300 leading-snug">{a.text}</p>
                    <p className={`text-[11px] font-medium mt-0.5 ${a.impactColor}`}>{a.impact}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-2">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="font-medium text-slate-200 text-sm">Динамика</h3>
              <div className="flex gap-1">
                {DYNAMIC_TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`text-xs px-2.5 py-1 rounded-md transition-colors ${
                      tab === t ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'text-slate-400 hover:text-slate-200 border border-transparent'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={DYNAMIC_DATA} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
                  <XAxis dataKey="d" stroke="#475569" fontSize={11} tickLine={false} axisLine={{ stroke: '#1F2937' }} />
                  <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip
                    contentStyle={{ background: '#0B0F19', border: '1px solid #1F2937', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#94A3B8' }}
                  />
                  <Line type="monotone" dataKey="v" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Кампании (топ 5)</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2">Кампания</TableHead>
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Расход</TableHead>
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">CPL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {CAMPAIGNS.map((c) => (
                  <TableRow key={c.name} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell className="py-2 px-2">
                      <div className="text-xs text-slate-200 truncate max-w-[140px]">{c.name}</div>
                      <Badge variant="outline" className={`mt-1 text-[10px] px-1.5 py-0 h-4 ${c.status.color}`}>
                        {c.status.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{c.spend}</TableCell>
                    <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{c.cpl}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>

        {/* ROW 3: 4 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <h3 className="font-medium text-slate-200 text-sm">AI-ассистент по рекламе</h3>
            </div>
            <p className="text-xs text-slate-400 mb-2">Почему вырос CPL:</p>
            <ol className="space-y-1.5 text-xs text-slate-300 list-decimal list-inside flex-1">
              <li>Снизился CTR в РСЯ-кампаниях на 18%</li>
              <li>Активизировались 3 крупных конкурента</li>
              <li>Бюджет смещён в дорогие ключевые фразы</li>
            </ol>
            <div className="flex items-center gap-2 mt-3">
              <Input
                placeholder="Спросите что угодно..."
                className="bg-[#0B0F19] border-slate-800 text-xs h-9 text-slate-200 placeholder:text-slate-500"
              />
              <Button size="icon" className="h-9 w-9 bg-blue-500 hover:bg-blue-600 text-white shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-2">AI-аудит кабинета</h3>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={RADAR_DATA}>
                  <PolarGrid stroke="#1F2937" />
                  <PolarAngleAxis dataKey="axis" tick={{ fill: '#94A3B8', fontSize: 11 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 10 }} stroke="#1F2937" />
                  <Radar dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.35} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Поисковые запросы (проблемные)</h3>
            <Table>
              <TableHeader>
                <TableRow className="border-slate-800 hover:bg-transparent">
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2">Запрос</TableHead>
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Расход</TableHead>
                  <TableHead className="text-[11px] text-slate-500 h-7 px-2 text-right">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BAD_QUERIES.map((q) => (
                  <TableRow key={q.q} className="border-slate-800 hover:bg-slate-800/30">
                    <TableCell className="py-2 px-2 text-xs text-slate-200 truncate max-w-[140px]">{q.q}</TableCell>
                    <TableCell className="py-2 px-2 text-xs text-slate-300 text-right">{q.spend}</TableCell>
                    <TableCell className="py-2 px-2 text-right">
                      <button className={`text-[11px] font-medium ${q.conv === 0 ? 'text-red-400 hover:text-red-300' : 'text-slate-400 hover:text-slate-200'}`}>
                        {q.conv === 0 ? 'В минус' : 'Проверить'}
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Конверсии по часам</h3>
            <div className="overflow-x-auto">
              <div className="inline-block">
                <div className="flex">
                  <div className="w-8" />
                  {HOURS.filter((h) => h % 3 === 0).map((h) => (
                    <div key={h} className="text-[9px] text-slate-500 w-[24px] text-left" style={{ marginRight: 2 }}>
                      {h}
                    </div>
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
            <div className="mt-3 flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-blue-500/10 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="text-[11px] text-blue-300">Лучшие часы: 10:00–13:00</span>
            </div>
          </Card>
        </div>

        {/* ROW 4: 1/3 + 2/3 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-1">
            <h3 className="font-medium text-slate-200 text-sm mb-3">AI-рекомендации</h3>
            <ul className="space-y-3">
              {AI_RECS.map((r, i) => {
                const Icon = r.icon;
                return (
                  <li key={i} className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-md bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-200 leading-snug">{r.text}</p>
                      <p className="text-[11px] text-emerald-400 mt-0.5">+{r.save}</p>
                    </div>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] bg-transparent border-slate-700 text-slate-200 hover:bg-slate-800 hover:text-white shrink-0">
                      {r.cta}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="rounded-xl bg-[#111827] border-[#1F2937] p-4 lg:col-span-2">
            <h3 className="font-medium text-slate-200 text-sm mb-3">Кабинеты (все)</h3>
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
                  {ACCOUNTS.map((a) => (
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
          </Card>
        </div>
      </main>
    </div>
  );
}