import {
  Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Line, Rect, Path,
} from '@react-pdf/renderer';

/* ══════════════════════════════════════════════════════════════
   FONTS — Roboto 4 weights with full Cyrillic
   ══════════════════════════════════════════════════════════════ */
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-medium-webfont.ttf', fontWeight: 500 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback(word => [word]); // prevent word breaking

/* ══════════════════════════════════════════════════════════════
   THEME SYSTEM
   ══════════════════════════════════════════════════════════════ */
interface ThemeColors {
  bg: string; bgCard: string; bgRow1: string; bgRow2: string;
  fg: string; fgMuted: string; accent: string; accentAlt: string;
  green: string; red: string; yellow: string; purple: string; border: string;
}

const DARK: ThemeColors = {
  bg: '#0B0E14', bgCard: '#151921', bgRow1: '#161B26', bgRow2: '#0F131B',
  fg: '#FFFFFF', fgMuted: '#94A3B8', accent: '#3B82F6', accentAlt: '#60A5FA',
  green: '#22C55E', red: '#EF4444', yellow: '#F59E0B', purple: '#8B5CF6', border: '#1E293B',
};

const LIGHT: ThemeColors = {
  bg: '#F9FAFB', bgCard: '#FFFFFF', bgRow1: '#F3F4F6', bgRow2: '#FFFFFF',
  fg: '#111827', fgMuted: '#6B7280', accent: '#2563EB', accentAlt: '#3B82F6',
  green: '#16A34A', red: '#DC2626', yellow: '#D97706', purple: '#7C3AED', border: '#E5E7EB',
};

/* ══════════════════════════════════════════════════════════════
   HELPERS
   ══════════════════════════════════════════════════════════════ */
function str(v: any, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    for (const k of ['text', 'title', 'name', 'description', 'term', 'task', 'gram', 'phrase', 'heading']) {
      if (typeof v[k] === 'string') return v[k];
    }
    try { return JSON.stringify(v); } catch { return '[data]'; }
  }
  return String(v);
}

function scoreColor(v: number, t: ThemeColors): string {
  if (v >= 70) return t.green;
  if (v >= 40) return t.yellow;
  return t.red;
}

/* ══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ══════════════════════════════════════════════════════════════ */

function PageHeader({ t, companyName }: { t: ThemeColors; companyName?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: t.border }} fixed>
      <Text style={{ fontSize: 11, fontWeight: 700, color: t.accent, letterSpacing: 1, fontFamily: 'Roboto' }}>PageForge AI</Text>
      {companyName ? <Text style={{ fontSize: 8, color: t.fgMuted, fontFamily: 'Roboto' }}>{companyName}</Text> : null}
    </View>
  );
}

function PageFooter({ t, projectName, isRu }: { t: ThemeColors; projectName?: string; isRu: boolean }) {
  return (
    <View style={{ position: 'absolute', bottom: 20, left: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: t.border, paddingTop: 6 }} fixed>
      <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }}>PageForge AI</Text>
      {projectName ? <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }}>{projectName}</Text> : null}
      <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }} render={({ pageNumber, totalPages }) =>
        `${isRu ? 'Страница' : 'Page'} ${pageNumber} ${isRu ? 'из' : 'of'} ${totalPages}`
      } />
    </View>
  );
}

function ScoreGauge({ value, label, color, t }: { value: number; label: string; color: string; t: ThemeColors }) {
  const r = 36; const cx = 44; const cy = 44;
  const circ = 2 * Math.PI * r;
  const prog = (value / 100) * circ;
  return (
    <View style={{ alignItems: 'center', width: 100 }}>
      <Svg width={88} height={88} viewBox="0 0 88 88">
        <Circle cx={cx} cy={cy} r={r} stroke={t.border} strokeWidth={5} fill="none" />
        <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={5} fill="none"
          strokeDasharray={`${prog} ${circ - prog}`} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`} />
      </Svg>
      <Text style={{ fontSize: 22, fontWeight: 700, color, marginTop: -56, fontFamily: 'Roboto' }}>{value}</Text>
      <Text style={{ fontSize: 7, color: t.fgMuted, marginTop: 28, textAlign: 'center', fontFamily: 'Roboto', letterSpacing: 0.5 }}>{label}</Text>
    </View>
  );
}

function SectionTitle({ children, t }: { children: string; t: ThemeColors }) {
  return (
    <Text style={{ fontSize: 15, fontWeight: 700, color: t.accent, marginBottom: 10, marginTop: 4, fontFamily: 'Roboto' }} minPresenceAhead={60}>
      {children}
    </Text>
  );
}

function Card({ children, t, borderColor }: { children: React.ReactNode; t: ThemeColors; borderColor?: string }) {
  return (
    <View style={{
      backgroundColor: t.bgCard, borderRadius: 6, padding: 12, marginBottom: 8,
      borderWidth: 1, borderColor: t.border,
      ...(borderColor ? { borderLeftWidth: 3, borderLeftColor: borderColor } : {}),
    }} wrap={false}>
      {children}
    </View>
  );
}

function Badge({ text, color, t }: { text: string; color: string; t: ThemeColors }) {
  return (
    <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, backgroundColor: color + '25' }}>
      <Text style={{ color, fontSize: 7, fontWeight: 700, fontFamily: 'Roboto' }}>{text}</Text>
    </View>
  );
}

function HBar({ data, t }: { data: { label: string; value: number }[]; t: ThemeColors }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ marginTop: 6 }}>
      {data.slice(0, 10).map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ fontSize: 7, color: t.fgMuted, width: 90, fontFamily: 'Roboto' }}>{str(d.label).slice(0, 22)}</Text>
          <View style={{ flex: 1, height: 8, backgroundColor: t.bgRow2, borderRadius: 2 }}>
            <View style={{ width: `${Math.min((d.value / max) * 100, 100)}%`, height: 8, backgroundColor: t.accent, borderRadius: 2, opacity: 0.85 }} />
          </View>
          <Text style={{ fontSize: 7, color: t.fg, width: 32, textAlign: 'right', fontFamily: 'Roboto' }}>
            {typeof d.value === 'number' && d.value % 1 !== 0 ? d.value.toFixed(2) : d.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

/* ══════════════════════════════════════════════════════════════
   ZIPF CHART — ideal curve + real bars
   ══════════════════════════════════════════════════════════════ */
function ZipfChart({ tfidf, t }: { tfidf: any[]; t: ThemeColors }) {
  const items = tfidf.slice(0, 24);
  const maxTf = items[0]?.tfidf || 1;
  const W = 480; const H = 110; const padL = 8; const padB = 10;
  const barW = 16; const gap = 20 - barW;

  // Ideal Zipf curve points (1/rank)
  const idealPoints = items.map((_, i) => {
    const x = padL + i * (barW + gap) + barW / 2;
    const y = H - padB - ((1 / (i + 1)) * (H - padB - 10));
    return `${x},${y}`;
  });
  const idealPath = idealPoints.length > 1 ? `M ${idealPoints.join(' L ')}` : '';

  return (
    <Svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <Rect x={0} y={0} width={W} height={H} fill={t.bgCard} rx={4} />
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map((f, i) => (
        <Line key={i} x1={padL} y1={H - padB - f * (H - padB - 10)} x2={W - 8} y2={H - padB - f * (H - padB - 10)}
          stroke={t.border} strokeWidth={0.5} />
      ))}
      {/* Bars */}
      {items.map((item: any, i: number) => {
        const barH = Math.max(((item.tfidf || 0) / maxTf) * (H - padB - 10), 2);
        const x = padL + i * (barW + gap);
        const clr = item.status === 'Missing' ? t.red : item.status === 'Spam' ? t.yellow : t.accent;
        return <Rect key={i} x={x} y={H - padB - barH} width={barW} height={barH} fill={clr} rx={2} opacity={0.8} />;
      })}
      {/* Ideal curve */}
      {idealPath && <Path d={idealPath} stroke={t.green} strokeWidth={1.5} fill="none" strokeDasharray="4,3" opacity={0.7} />}
    </Svg>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN DOCUMENT
   ══════════════════════════════════════════════════════════════ */

interface PdfReportProps {
  analysis: any;
  results: any;
  template?: any;
  companyName?: string;
  lang?: string;
}

export function PdfReportDocument({ analysis, results, template, companyName, lang }: PdfReportProps) {
  const isRu = lang === 'ru';
  const isDark = (template?.theme || 'dark') === 'dark';
  const t = isDark ? DARK : LIGHT;

  const scores = results?.scores || {};
  const tabData = results?.tab_data || {};
  const quickWins = results?.quick_wins || [];
  const aiReport = tabData?.aiReport || {};
  const tfidf = tabData?.tfidf || [];
  const ngrams = tabData?.ngrams || {};
  const implementationPlan = tabData?.implementationPlan || [];
  const blueprint = tabData?.blueprint || {};
  const url = analysis?.url || '';
  const date = analysis?.created_at
    ? new Date(analysis.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const company = template?.company_name || companyName || '';

  const scoreItems = [
    { label: 'SEO HEALTH', value: scores.seoHealth || 0, color: scoreColor(scores.seoHealth || 0, t) },
    { label: 'LLM-FRIENDLY', value: scores.llmFriendly || 0, color: scoreColor(scores.llmFriendly || 0, t) },
    { label: 'HUMAN TOUCH', value: scores.humanTouch || 0, color: scoreColor(scores.humanTouch || 0, t) },
    { label: 'SGE ADAPT', value: scores.sgeAdapt || 0, color: scoreColor(scores.sgeAdapt || 0, t) },
  ];

  const pageStyle = { backgroundColor: t.bg, paddingTop: 56, paddingBottom: 50, paddingHorizontal: 56, fontFamily: 'Roboto' as const, color: t.fg, fontSize: 10 };

  /* TOC sections */
  const tocItems = [
    { num: 1, title: isRu ? 'Обложка и скоринг' : 'Cover & Scoring' },
    { num: 2, title: isRu ? 'Содержание' : 'Table of Contents' },
    { num: 3, title: isRu ? 'Резюме и Quick Wins' : 'Summary & Quick Wins' },
    { num: 4, title: isRu ? 'Пошаговое ТЗ на внедрение' : 'Implementation Plan' },
    { num: 5, title: 'TF-IDF' },
    { num: 6, title: isRu ? 'N-граммы и Закон Ципфа' : 'N-grams & Zipf' },
    { num: 7, title: isRu ? 'Golden Blueprint и рекомендации' : 'Golden Blueprint & Recommendations' },
  ];

  return (
    <Document title={`SEO Report — ${url}`} author="PageForge AI" subject="SEO Analysis Report">

      {/* ═══════ PAGE 1: COVER ═══════ */}
      <Page size="A4" style={{ ...pageStyle, justifyContent: 'center', alignItems: 'center' }}>
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <View style={{ width: 40, height: 3, backgroundColor: t.accent, marginBottom: 20 }} />
        <Text style={{ fontSize: 10, fontWeight: 300, color: t.accent, letterSpacing: 5, marginBottom: 10, fontFamily: 'Roboto' }}>
          PAGEFORGE AI
        </Text>
        <Text style={{ fontSize: 26, fontWeight: 700, color: t.fg, textAlign: 'center', marginBottom: 6, fontFamily: 'Roboto' }}>
          {isRu ? 'ОТЧЁТ АНАЛИЗА СТРАНИЦЫ' : 'PAGE ANALYSIS REPORT'}
        </Text>
        <View style={{ width: 50, height: 2, backgroundColor: t.accent, marginVertical: 14 }} />
        <Text style={{ fontSize: 11, color: t.fgMuted, textAlign: 'center', marginBottom: 4, fontFamily: 'Roboto' }}>{url}</Text>
        {company ? <Text style={{ fontSize: 10, color: t.fgMuted, marginBottom: 4, fontFamily: 'Roboto' }}>{company}</Text> : null}
        <Text style={{ fontSize: 9, color: t.fgMuted, fontFamily: 'Roboto' }}>{date}</Text>

        {/* Score gauges */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 50 }}>
          {scoreItems.map((sc, i) => (
            <ScoreGauge key={i} value={sc.value} label={sc.label} color={sc.color} t={t} />
          ))}
        </View>
      </Page>

      {/* ═══════ PAGE 2: TABLE OF CONTENTS ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>{isRu ? 'Содержание' : 'Table of Contents'}</SectionTitle>
        <View style={{ marginTop: 10 }}>
          {tocItems.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 0.5, borderBottomColor: t.border }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: t.accent + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Text style={{ fontSize: 10, fontWeight: 700, color: t.accent, fontFamily: 'Roboto' }}>{item.num}</Text>
              </View>
              <Text style={{ fontSize: 11, color: t.fg, flex: 1, fontFamily: 'Roboto' }}>{item.title}</Text>
              <Text style={{ fontSize: 9, color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'стр.' : 'p.'} {item.num}</Text>
            </View>
          ))}
        </View>

        {/* Content Effort & Info Gain summary */}
        {(aiReport.contentEffort || aiReport.informationGain) && (
          <View style={{ marginTop: 20 }}>
            <SectionTitle t={t}>{isRu ? 'Оценка качества контента' : 'Content Quality Assessment'}</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {aiReport.contentEffort && (
                <Card t={t} borderColor={aiReport.contentEffort === 'high' ? t.green : aiReport.contentEffort === 'medium' ? t.yellow : t.red}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: t.fgMuted, marginBottom: 4, fontFamily: 'Roboto' }}>CONTENT EFFORT</Text>
                  <Text style={{ fontSize: 14, fontWeight: 700, color: aiReport.contentEffort === 'high' ? t.green : aiReport.contentEffort === 'medium' ? t.yellow : t.red, fontFamily: 'Roboto' }}>
                    {aiReport.contentEffort.toUpperCase()}
                  </Text>
                </Card>
              )}
              {Array.isArray(aiReport.informationGain) && aiReport.informationGain.length > 0 && (
                <Card t={t} borderColor={t.accent}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: t.fgMuted, marginBottom: 4, fontFamily: 'Roboto' }}>INFORMATION GAIN</Text>
                  {aiReport.informationGain.map((ig: any, i: number) => (
                    <Text key={i} style={{ fontSize: 8, color: t.fg, marginBottom: 2, fontFamily: 'Roboto' }}>• {str(ig)}</Text>
                  ))}
                </Card>
              )}
            </View>
          </View>
        )}
      </Page>

      {/* ═══════ PAGE 3: SUMMARY + QUICK WINS ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>{isRu ? 'Резюме анализа' : 'Analysis Summary'}</SectionTitle>
        <Card t={t}>
          <Text style={{ fontSize: 10, color: t.fg, lineHeight: 1.7, fontFamily: 'Roboto' }}>
            {str(aiReport.summary, isRu ? 'Нет данных' : 'No data')}
          </Text>
        </Card>

        {/* Strengths / Weaknesses side by side */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          <View style={{ flex: 1 }}>
            <Card t={t} borderColor={t.green}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: t.green, marginBottom: 6, fontFamily: 'Roboto' }}>
                {isRu ? 'Сильные стороны' : 'Strengths'}
              </Text>
              {(Array.isArray(aiReport.strengths) ? aiReport.strengths : []).map((item: any, i: number) => (
                <Text key={i} style={{ fontSize: 8, color: t.fg, marginBottom: 3, fontFamily: 'Roboto' }}>• {str(item)}</Text>
              ))}
            </Card>
          </View>
          <View style={{ flex: 1 }}>
            <Card t={t} borderColor={t.red}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: t.red, marginBottom: 6, fontFamily: 'Roboto' }}>
                {isRu ? 'Слабые стороны' : 'Weaknesses'}
              </Text>
              {(Array.isArray(aiReport.weaknesses) ? aiReport.weaknesses : []).map((item: any, i: number) => (
                <Text key={i} style={{ fontSize: 8, color: t.fg, marginBottom: 3, fontFamily: 'Roboto' }}>• {str(item)}</Text>
              ))}
            </Card>
          </View>
        </View>

        {/* Quick Wins */}
        <SectionTitle t={t}>Quick Wins</SectionTitle>
        {(Array.isArray(quickWins) ? quickWins : []).slice(0, 8).map((win: any, i: number) => (
          <View key={i} wrap={false} style={{
            backgroundColor: t.bgCard, borderRadius: 6, padding: 10, marginBottom: 6,
            borderWidth: 1, borderColor: t.border,
            flexDirection: 'row', alignItems: 'flex-start', gap: 10,
          }}>
            <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 9, fontWeight: 700, color: '#FFFFFF', fontFamily: 'Roboto' }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 9, color: t.fg, flex: 1, lineHeight: 1.6, fontFamily: 'Roboto' }}>{str(win)}</Text>
          </View>
        ))}
      </Page>

      {/* ═══════ PAGE 4: IMPLEMENTATION PLAN ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>{isRu ? 'Пошаговое ТЗ на внедрение' : 'Implementation Plan'}</SectionTitle>

        {['P1', 'P2', 'P3'].map(priority => {
          const items = (Array.isArray(implementationPlan) ? implementationPlan : []).filter((x: any) => x.priority === priority);
          if (items.length === 0) return null;
          const pColor = priority === 'P1' ? t.red : priority === 'P2' ? t.yellow : t.green;
          const pLabel = priority === 'P1' ? (isRu ? 'P1 — Критично' : 'P1 — Critical')
            : priority === 'P2' ? (isRu ? 'P2 — Важно' : 'P2 — Important')
            : (isRu ? 'P3 — Рекомендовано' : 'P3 — Recommended');
          return (
            <View key={priority} style={{ marginBottom: 10 }}>
              <View style={{ marginBottom: 6 }}>
                <Badge text={pLabel} color={pColor} t={t} />
              </View>
              {items.map((task: any, idx: number) => (
                <Card key={idx} t={t} borderColor={pColor}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: t.fg, marginBottom: 3, fontFamily: 'Roboto' }}>{str(task.title)}</Text>
                  {task.where && (
                    <Text style={{ fontSize: 7, color: t.fgMuted, marginBottom: 2, fontFamily: 'Roboto' }}>
                      {isRu ? 'Где' : 'Where'}: {str(task.where)}
                    </Text>
                  )}
                  {task.action && (
                    <Text style={{ fontSize: 8, color: t.green, marginBottom: 2, fontFamily: 'Roboto' }}>
                      {isRu ? 'Действие' : 'Action'}: {str(task.action)}
                    </Text>
                  )}
                  {task.expectedResult && (
                    <Text style={{ fontSize: 7, color: t.accent, fontFamily: 'Roboto' }}>
                      {isRu ? 'Результат' : 'Result'}: {str(task.expectedResult)}
                    </Text>
                  )}
                  {task.rule && (
                    <Text style={{ fontSize: 6, color: t.purple, marginTop: 2, fontFamily: 'Roboto' }}>[{str(task.rule)}]</Text>
                  )}
                </Card>
              ))}
            </View>
          );
        })}
      </Page>

      {/* ═══════ PAGE 5: TF-IDF TABLE ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>TF-IDF {isRu ? 'Анализ ключевых слов' : 'Keyword Analysis'}</SectionTitle>

        {Array.isArray(tfidf) && tfidf.length > 0 ? (
          <View>
            {/* Table header */}
            <View style={{ flexDirection: 'row', backgroundColor: t.accent, paddingVertical: 7, paddingHorizontal: 10, borderTopLeftRadius: 4, borderTopRightRadius: 4 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '28%', fontFamily: 'Roboto' }}>{isRu ? 'Термин' : 'Term'}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '14%', textAlign: 'right', fontFamily: 'Roboto' }}>TF-IDF</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '12%', textAlign: 'right', fontFamily: 'Roboto' }}>{isRu ? 'Вы' : 'You'}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '14%', textAlign: 'right', fontFamily: 'Roboto' }}>{isRu ? 'Конк.' : 'Comp.'}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '12%', textAlign: 'right', fontFamily: 'Roboto' }}>{isRu ? 'Плотн.' : 'Dens.'}</Text>
              <Text style={{ color: '#FFFFFF', fontSize: 8, fontWeight: 700, width: '20%', textAlign: 'center', fontFamily: 'Roboto' }}>{isRu ? 'Статус' : 'Status'}</Text>
            </View>
            {/* Table rows */}
            {tfidf.slice(0, 35).map((item: any, i: number) => {
              const sColor = item.status === 'Missing' ? t.red : item.status === 'Spam' ? t.yellow : t.green;
              return (
                <View key={i} wrap={false} style={{
                  flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 10,
                  backgroundColor: i % 2 === 0 ? t.bgRow1 : t.bgRow2,
                  borderBottomWidth: 0.5, borderBottomColor: t.border,
                }}>
                  <Text style={{ fontSize: 7, color: t.fg, width: '28%', fontFamily: 'Roboto' }}>{str(item.term).slice(0, 28)}</Text>
                  <Text style={{ fontSize: 7, color: t.fg, width: '14%', textAlign: 'right', fontFamily: 'Roboto' }}>
                    {typeof item.tfidf === 'number' ? item.tfidf.toFixed(4) : str(item.tfidf)}
                  </Text>
                  <Text style={{ fontSize: 7, color: t.fg, width: '12%', textAlign: 'right', fontFamily: 'Roboto' }}>
                    {str(item.userCount ?? item.count ?? '')}
                  </Text>
                  <Text style={{ fontSize: 7, color: t.fgMuted, width: '14%', textAlign: 'right', fontFamily: 'Roboto' }}>
                    {str(item.competitorMedianCount ?? item.compMedian ?? '')}
                  </Text>
                  <Text style={{ fontSize: 7, color: t.fg, width: '12%', textAlign: 'right', fontFamily: 'Roboto' }}>
                    {typeof item.density === 'number' ? item.density.toFixed(2) + '%' : ''}
                  </Text>
                  <View style={{ width: '20%', alignItems: 'center' }}>
                    <Badge text={str(item.status)} color={sColor} t={t} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}
      </Page>

      {/* ═══════ PAGE 6: N-GRAMS + ZIPF ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>{isRu ? 'N-граммы и частотный анализ' : 'N-grams & Frequency Analysis'}</SectionTitle>

        {ngrams && typeof ngrams === 'object' ? (
          Object.entries(ngrams).slice(0, 3).map(([key, items]: [string, any]) => {
            if (!Array.isArray(items) || items.length === 0) return null;
            const chartData = items.slice(0, 10).map((it: any) => ({
              label: str(it),
              value: Number(it.count || it.frequency || 0),
            }));
            return (
              <View key={key} style={{ marginBottom: 14 }} wrap={false}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: t.fg, marginBottom: 6, fontFamily: 'Roboto' }}>{key}</Text>
                <HBar data={chartData} t={t} />
              </View>
            );
          })
        ) : (
          <Text style={{ color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}

        {/* Zipf chart with ideal curve + real bars */}
        {Array.isArray(tfidf) && tfidf.length > 5 && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: t.fg, marginBottom: 8, fontFamily: 'Roboto' }}>
              {isRu ? 'Закон Ципфа' : "Zipf's Law"}
            </Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 12, height: 6, backgroundColor: t.accent, borderRadius: 1 }} />
                <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'Реальная' : 'Actual'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <View style={{ width: 12, height: 1, backgroundColor: t.green, borderRadius: 1 }} />
                <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'Идеальная' : 'Ideal'}</Text>
              </View>
            </View>
            <ZipfChart tfidf={tfidf} t={t} />
          </View>
        )}
      </Page>

      {/* ═══════ PAGE 7: BLUEPRINT + RECOMMENDATIONS ═══════ */}
      <Page size="A4" style={pageStyle}>
        <PageHeader t={t} companyName={company} />
        <PageFooter t={t} projectName={company} isRu={isRu} />

        <SectionTitle t={t}>Golden Blueprint</SectionTitle>

        {blueprint && (blueprint.h1 || blueprint.sections) ? (
          <View>
            {blueprint.h1 && (
              <Card t={t} borderColor={t.accent}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: t.accent, fontFamily: 'Roboto' }}>H1</Text>
                <Text style={{ fontSize: 10, color: t.fg, marginTop: 3, fontFamily: 'Roboto' }}>{str(blueprint.h1)}</Text>
              </Card>
            )}
            {blueprint.metaTitle && (
              <Card t={t} borderColor={t.purple}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: t.purple, fontFamily: 'Roboto' }}>Meta Title</Text>
                <Text style={{ fontSize: 9, color: t.fg, marginTop: 3, fontFamily: 'Roboto' }}>{str(blueprint.metaTitle)}</Text>
              </Card>
            )}
            {blueprint.metaDescription && (
              <Card t={t} borderColor={t.green}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: t.green, fontFamily: 'Roboto' }}>Meta Description</Text>
                <Text style={{ fontSize: 9, color: t.fg, marginTop: 3, fontFamily: 'Roboto' }}>{str(blueprint.metaDescription)}</Text>
              </Card>
            )}
            {/* Section hierarchy */}
            {Array.isArray(blueprint.sections) && blueprint.sections.map((sec: any, i: number) => (
              <View key={i} wrap={false} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: sec.tag === 'h3' ? 20 : 0 }}>
                <Badge text={str(sec.tag).toUpperCase()} color={sec.tag === 'h2' ? t.accent : t.fgMuted} t={t} />
                <Text style={{ fontSize: 9, color: t.fg, flex: 1, marginLeft: 6, fontFamily: 'Roboto' }}>{str(sec.text)}</Text>
                {sec.wordCount && <Text style={{ fontSize: 7, color: t.fgMuted, fontFamily: 'Roboto' }}>~{sec.wordCount} {isRu ? 'сл.' : 'w.'}</Text>}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: t.fgMuted, fontFamily: 'Roboto' }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}

        {/* Recommendations */}
        {Array.isArray(aiReport.recommendations) && aiReport.recommendations.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <SectionTitle t={t}>{isRu ? 'Рекомендации' : 'Recommendations'}</SectionTitle>
            {aiReport.recommendations.map((rec: any, i: number) => (
              <Card key={i} t={t}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Text style={{ fontSize: 8, fontWeight: 700, color: t.accent, fontFamily: 'Roboto' }}>{i + 1}.</Text>
                  <Text style={{ fontSize: 8, color: t.fg, flex: 1, lineHeight: 1.6, fontFamily: 'Roboto' }}>{str(rec)}</Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </Page>

    </Document>
  );
}
