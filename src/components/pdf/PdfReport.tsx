import {
  Document, Page, Text, View, StyleSheet, Font, Svg, Circle, Line, Rect,
} from '@react-pdf/renderer';

/* ── Register Roboto with Cyrillic support ── */
Font.register({
  family: 'Roboto',
  fonts: [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-regular-webfont.ttf', fontWeight: 400 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-bold-webfont.ttf', fontWeight: 700 },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/ink/3.1.10/fonts/Roboto/roboto-light-webfont.ttf', fontWeight: 300 },
  ],
});

/* ── Colors ── */
const C = {
  bg: '#0B0E14',
  bgCard: '#131720',
  bgRow1: '#161B26',
  bgRow2: '#0F131B',
  white: '#FFFFFF',
  muted: '#94A3B8',
  blue: '#3B82F6',
  green: '#22C55E',
  red: '#EF4444',
  yellow: '#F59E0B',
  purple: '#8B5CF6',
  border: '#1E293B',
};

/* ── Base styles ── */
const s = StyleSheet.create({
  page: { backgroundColor: C.bg, padding: 40, fontFamily: 'Roboto', color: C.white, fontSize: 10, position: 'relative' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: C.border },
  brand: { fontSize: 12, fontWeight: 700, color: C.blue, letterSpacing: 1 },
  footer: { position: 'absolute', bottom: 20, left: 40, right: 40, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerText: { fontSize: 7, color: C.muted },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: C.blue, marginBottom: 12, marginTop: 8 },
  card: { backgroundColor: C.bgCard, borderRadius: 6, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 3, fontSize: 7, fontWeight: 700 },
  tableHeader: { flexDirection: 'row', backgroundColor: C.blue, paddingVertical: 6, paddingHorizontal: 8, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tableHeaderText: { color: C.white, fontSize: 8, fontWeight: 700 },
  tableRow: { flexDirection: 'row', paddingVertical: 5, paddingHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: C.border },
});

/* ── Helper: safe string ── */
function str(v: any, fallback = ''): string {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (typeof v === 'object') {
    if (v.text) return String(v.text);
    if (v.title) return String(v.title);
    if (v.description) return String(v.description);
    if (v.term) return String(v.term);
    if (v.task) return String(v.task);
    try { return JSON.stringify(v); } catch { return '[data]'; }
  }
  return String(v);
}

function scoreColor(v: number): string {
  if (v >= 70) return C.green;
  if (v >= 40) return C.yellow;
  return C.red;
}

/* ── Components ── */

function PageHeader({ companyName }: { companyName?: string }) {
  return (
    <View style={s.header} fixed>
      <Text style={s.brand}>PageForge AI</Text>
      {companyName ? <Text style={{ fontSize: 8, color: C.muted }}>{companyName}</Text> : null}
    </View>
  );
}

function PageFooter() {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>pageforge.ai</Text>
      <Text style={s.footerText} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}

/* Score circle via SVG */
function ScoreCircle({ value, label, color }: { value: number; label: string; color: string }) {
  const r = 28;
  const cx = 35;
  const cy = 35;
  const circumference = 2 * Math.PI * r;
  const progress = (value / 100) * circumference;
  return (
    <View style={{ alignItems: 'center', width: 80 }}>
      <Svg width={70} height={70} viewBox="0 0 70 70">
        <Circle cx={cx} cy={cy} r={r} stroke={C.border} strokeWidth={4} fill="none" />
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={color} strokeWidth={4} fill="none"
          strokeDasharray={`${progress} ${circumference - progress}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
        <Rect x={cx - 14} y={cy - 8} width={28} height={16} fill="none" />
      </Svg>
      <Text style={{ fontSize: 16, fontWeight: 700, color, marginTop: -38 }}>{value}</Text>
      <Text style={{ fontSize: 6, color: C.muted, marginTop: 24, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

/* ── Bar chart simulation ── */
function BarChart({ data, maxVal }: { data: { label: string; value: number }[]; maxVal?: number }) {
  const max = maxVal || Math.max(...data.map(d => d.value), 1);
  return (
    <View style={{ marginTop: 8 }}>
      {data.slice(0, 12).map((d, i) => (
        <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ fontSize: 7, color: C.muted, width: 80 }} numberOfLines={1}>{str(d.label)}</Text>
          <View style={{ flex: 1, height: 8, backgroundColor: C.bgRow2, borderRadius: 2, overflow: 'hidden' }}>
            <View style={{ width: `${Math.min((d.value / max) * 100, 100)}%`, height: 8, backgroundColor: C.blue, borderRadius: 2 }} />
          </View>
          <Text style={{ fontSize: 7, color: C.white, width: 30, textAlign: 'right' }}>{typeof d.value === 'number' ? d.value.toFixed ? d.value.toFixed(2) : d.value : d.value}</Text>
        </View>
      ))}
    </View>
  );
}

/* ── Main Document ── */

interface PdfReportProps {
  analysis: any;
  results: any;
  template?: any;
  companyName?: string;
  lang?: string;
}

export function PdfReportDocument({ analysis, results, template, companyName, lang }: PdfReportProps) {
  const isRu = lang === 'ru';
  const scores = results?.scores || {};
  const tabData = results?.tab_data || {};
  const quickWins = results?.quick_wins || [];
  const aiReport = tabData?.aiReport || {};
  const tfidf = tabData?.tfidf || [];
  const ngrams = tabData?.ngrams || {};
  const implementationPlan = tabData?.implementationPlan || [];
  const blueprint = tabData?.blueprint || {};
  const url = analysis?.url || '';
  const date = analysis?.created_at ? new Date(analysis.created_at).toLocaleDateString(isRu ? 'ru-RU' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' }) : '';

  const scoreItems = [
    { label: 'SEO HEALTH', value: scores.seoHealth || 0, color: scoreColor(scores.seoHealth || 0) },
    { label: 'LLM-FRIENDLY', value: scores.llmFriendly || 0, color: scoreColor(scores.llmFriendly || 0) },
    { label: 'HUMAN TOUCH', value: scores.humanTouch || 0, color: scoreColor(scores.humanTouch || 0) },
    { label: 'SGE ADAPT', value: scores.sgeAdapt || 0, color: scoreColor(scores.sgeAdapt || 0) },
  ];

  return (
    <Document title={`SEO Report — ${url}`} author="PageForge AI" subject="SEO Analysis Report">

      {/* ═══ PAGE 1: COVER ═══ */}
      <Page size="A4" style={{ ...s.page, justifyContent: 'center', alignItems: 'center' }}>
        <PageFooter />
        <Text style={{ fontSize: 10, fontWeight: 300, color: C.blue, letterSpacing: 4, marginBottom: 8 }}>PAGEFORGE AI</Text>
        <Text style={{ fontSize: 28, fontWeight: 700, color: C.white, textAlign: 'center', marginBottom: 6 }}>
          {isRu ? 'ОТЧЁТ АНАЛИЗА СТРАНИЦЫ' : 'PAGE ANALYSIS REPORT'}
        </Text>
        <View style={{ width: 60, height: 2, backgroundColor: C.blue, marginVertical: 16 }} />
        <Text style={{ fontSize: 12, color: C.muted, textAlign: 'center', marginBottom: 4 }}>{url}</Text>
        {companyName ? <Text style={{ fontSize: 10, color: C.muted, marginBottom: 4 }}>{companyName}</Text> : null}
        <Text style={{ fontSize: 9, color: C.muted }}>{date}</Text>

        {/* Score circles */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 50 }}>
          {scoreItems.map((sc, i) => (
            <ScoreCircle key={i} value={sc.value} label={sc.label} color={sc.color} />
          ))}
        </View>
      </Page>

      {/* ═══ PAGE 2: SUMMARY + QUICK WINS ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader companyName={companyName} />
        <PageFooter />

        <Text style={s.sectionTitle}>{isRu ? 'Резюме анализа' : 'Analysis Summary'}</Text>
        <View style={s.card}>
          <Text style={{ fontSize: 10, color: C.white, lineHeight: 1.6 }}>
            {str(aiReport.summary, isRu ? 'Нет данных' : 'No data')}
          </Text>
        </View>

        {/* Strengths / Weaknesses */}
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <View style={{ ...s.card, flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.green, marginBottom: 6 }}>{isRu ? 'Сильные стороны' : 'Strengths'}</Text>
            {(Array.isArray(aiReport.strengths) ? aiReport.strengths : []).map((item: any, i: number) => (
              <Text key={i} style={{ fontSize: 8, color: C.white, marginBottom: 3 }}>• {str(item)}</Text>
            ))}
          </View>
          <View style={{ ...s.card, flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: 700, color: C.red, marginBottom: 6 }}>{isRu ? 'Слабые стороны' : 'Weaknesses'}</Text>
            {(Array.isArray(aiReport.weaknesses) ? aiReport.weaknesses : []).map((item: any, i: number) => (
              <Text key={i} style={{ fontSize: 8, color: C.white, marginBottom: 3 }}>• {str(item)}</Text>
            ))}
          </View>
        </View>

        {/* Quick Wins */}
        <Text style={s.sectionTitle}>Quick Wins</Text>
        {(Array.isArray(quickWins) ? quickWins : []).slice(0, 8).map((win: any, i: number) => (
          <View key={i} style={{ ...s.card, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: C.blue, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
              <Text style={{ fontSize: 8, fontWeight: 700, color: C.white }}>{i + 1}</Text>
            </View>
            <Text style={{ fontSize: 9, color: C.white, flex: 1, lineHeight: 1.5 }}>{str(win)}</Text>
          </View>
        ))}
      </Page>

      {/* ═══ PAGE 3: IMPLEMENTATION PLAN ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader companyName={companyName} />
        <PageFooter />

        <Text style={s.sectionTitle}>{isRu ? 'Пошаговое ТЗ на внедрение' : 'Implementation Plan'}</Text>

        {['P1', 'P2', 'P3'].map(priority => {
          const items = (Array.isArray(implementationPlan) ? implementationPlan : []).filter((t: any) => t.priority === priority);
          if (items.length === 0) return null;
          const pColor = priority === 'P1' ? C.red : priority === 'P2' ? C.yellow : C.green;
          const pLabel = priority === 'P1' ? (isRu ? 'P1 — Критично' : 'P1 — Critical')
            : priority === 'P2' ? (isRu ? 'P2 — Важно' : 'P2 — Important')
            : (isRu ? 'P3 — Рекомендовано' : 'P3 — Recommended');
          return (
            <View key={priority} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                <View style={{ ...s.badge, backgroundColor: pColor + '30' }}>
                  <Text style={{ color: pColor, fontSize: 7, fontWeight: 700 }}>{pLabel}</Text>
                </View>
              </View>
              {items.map((task: any, i: number) => (
                <View key={i} style={{ ...s.card, borderLeftWidth: 3, borderLeftColor: pColor }}>
                  <Text style={{ fontSize: 9, fontWeight: 700, color: C.white, marginBottom: 3 }}>{str(task.title)}</Text>
                  {task.where && <Text style={{ fontSize: 7, color: C.muted, marginBottom: 2 }}>{isRu ? 'Где' : 'Where'}: {str(task.where)}</Text>}
                  {task.action && <Text style={{ fontSize: 8, color: C.green, marginBottom: 2 }}>{isRu ? 'Действие' : 'Action'}: {str(task.action)}</Text>}
                  {task.expectedResult && <Text style={{ fontSize: 7, color: C.blue }}>{isRu ? 'Результат' : 'Result'}: {str(task.expectedResult)}</Text>}
                  {task.rule && <Text style={{ fontSize: 6, color: C.purple, marginTop: 2 }}>[{str(task.rule)}]</Text>}
                </View>
              ))}
            </View>
          );
        })}
      </Page>

      {/* ═══ PAGE 4: TF-IDF ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader companyName={companyName} />
        <PageFooter />

        <Text style={s.sectionTitle}>TF-IDF {isRu ? 'Анализ ключевых слов' : 'Keyword Analysis'}</Text>

        {Array.isArray(tfidf) && tfidf.length > 0 ? (
          <View>
            <View style={s.tableHeader}>
              <Text style={{ ...s.tableHeaderText, width: '30%' }}>{isRu ? 'Термин' : 'Term'}</Text>
              <Text style={{ ...s.tableHeaderText, width: '15%', textAlign: 'right' }}>TF-IDF</Text>
              <Text style={{ ...s.tableHeaderText, width: '15%', textAlign: 'right' }}>{isRu ? 'Вы' : 'You'}</Text>
              <Text style={{ ...s.tableHeaderText, width: '15%', textAlign: 'right' }}>{isRu ? 'Конк.' : 'Comp.'}</Text>
              <Text style={{ ...s.tableHeaderText, width: '10%', textAlign: 'right' }}>{isRu ? 'Плотн.' : 'Dens.'}</Text>
              <Text style={{ ...s.tableHeaderText, width: '15%', textAlign: 'center' }}>{isRu ? 'Статус' : 'Status'}</Text>
            </View>
            {tfidf.slice(0, 35).map((item: any, i: number) => {
              const statusColor = item.status === 'Missing' ? C.red : item.status === 'Spam' ? C.yellow : C.green;
              return (
                <View key={i} style={{ ...s.tableRow, backgroundColor: i % 2 === 0 ? C.bgRow1 : C.bgRow2 }}>
                  <Text style={{ fontSize: 7, color: C.white, width: '30%' }} numberOfLines={1}>{str(item.term)}</Text>
                  <Text style={{ fontSize: 7, color: C.white, width: '15%', textAlign: 'right' }}>{typeof item.tfidf === 'number' ? item.tfidf.toFixed(4) : str(item.tfidf)}</Text>
                  <Text style={{ fontSize: 7, color: C.white, width: '15%', textAlign: 'right' }}>{str(item.userCount ?? item.count ?? '')}</Text>
                  <Text style={{ fontSize: 7, color: C.muted, width: '15%', textAlign: 'right' }}>{str(item.competitorMedianCount ?? item.compMedian ?? '')}</Text>
                  <Text style={{ fontSize: 7, color: C.white, width: '10%', textAlign: 'right' }}>{typeof item.density === 'number' ? item.density.toFixed(2) + '%' : ''}</Text>
                  <View style={{ width: '15%', alignItems: 'center' }}>
                    <View style={{ ...s.badge, backgroundColor: statusColor + '25' }}>
                      <Text style={{ color: statusColor, fontSize: 6 }}>{str(item.status)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={{ color: C.muted }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}
      </Page>

      {/* ═══ PAGE 5: N-GRAMS + ZIPF ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader companyName={companyName} />
        <PageFooter />

        <Text style={s.sectionTitle}>{isRu ? 'N-граммы и частотный анализ' : 'N-grams & Frequency Analysis'}</Text>

        {ngrams && typeof ngrams === 'object' ? (
          Object.entries(ngrams).slice(0, 4).map(([key, items]: [string, any]) => {
            if (!Array.isArray(items) || items.length === 0) return null;
            const chartData = items.slice(0, 10).map((it: any) => ({
              label: str(it.gram || it.phrase || it.text || ''),
              value: Number(it.count || it.frequency || 0),
            }));
            return (
              <View key={key} style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 6 }}>{key}</Text>
                <BarChart data={chartData} />
              </View>
            );
          })
        ) : (
          <Text style={{ color: C.muted }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}

        {/* Zipf simulation */}
        {Array.isArray(tfidf) && tfidf.length > 5 && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 11, fontWeight: 700, color: C.white, marginBottom: 8 }}>{isRu ? 'Закон Ципфа (распределение)' : "Zipf's Law (distribution)"}</Text>
            <Svg width={480} height={100} viewBox="0 0 480 100">
              <Rect x={0} y={0} width={480} height={100} fill={C.bgCard} rx={4} />
              {tfidf.slice(0, 24).map((item: any, i: number) => {
                const maxTf = tfidf[0]?.tfidf || 1;
                const barH = Math.max(((item.tfidf || 0) / maxTf) * 80, 2);
                const barW = 16;
                const x = 10 + i * 19;
                return (
                  <Rect key={i} x={x} y={90 - barH} width={barW} height={barH} fill={item.status === 'Missing' ? C.red : item.status === 'Spam' ? C.yellow : C.blue} rx={2} opacity={0.85} />
                );
              })}
            </Svg>
          </View>
        )}
      </Page>

      {/* ═══ PAGE 6: BLUEPRINT ═══ */}
      <Page size="A4" style={s.page}>
        <PageHeader companyName={companyName} />
        <PageFooter />

        <Text style={s.sectionTitle}>Golden Blueprint</Text>

        {blueprint && (blueprint.h1 || blueprint.sections) ? (
          <View>
            {blueprint.h1 && (
              <View style={{ ...s.card, borderLeftWidth: 3, borderLeftColor: C.blue }}>
                <Text style={{ fontSize: 8, color: C.blue, fontWeight: 700 }}>H1</Text>
                <Text style={{ fontSize: 10, color: C.white, marginTop: 3 }}>{str(blueprint.h1)}</Text>
              </View>
            )}
            {blueprint.metaTitle && (
              <View style={{ ...s.card, borderLeftWidth: 3, borderLeftColor: C.purple }}>
                <Text style={{ fontSize: 8, color: C.purple, fontWeight: 700 }}>Meta Title</Text>
                <Text style={{ fontSize: 9, color: C.white, marginTop: 3 }}>{str(blueprint.metaTitle)}</Text>
              </View>
            )}
            {blueprint.metaDescription && (
              <View style={{ ...s.card, borderLeftWidth: 3, borderLeftColor: C.green }}>
                <Text style={{ fontSize: 8, color: C.green, fontWeight: 700 }}>Meta Description</Text>
                <Text style={{ fontSize: 9, color: C.white, marginTop: 3 }}>{str(blueprint.metaDescription)}</Text>
              </View>
            )}
            {Array.isArray(blueprint.sections) && blueprint.sections.map((sec: any, i: number) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, paddingLeft: sec.tag === 'h3' ? 20 : 0 }}>
                <View style={{ ...s.badge, backgroundColor: sec.tag === 'h2' ? C.blue + '30' : C.muted + '30', marginRight: 6 }}>
                  <Text style={{ color: sec.tag === 'h2' ? C.blue : C.muted, fontSize: 7 }}>{str(sec.tag).toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 9, color: C.white, flex: 1 }}>{str(sec.text)}</Text>
                {sec.wordCount && <Text style={{ fontSize: 7, color: C.muted }}>~{sec.wordCount} {isRu ? 'сл.' : 'w.'}</Text>}
              </View>
            ))}
          </View>
        ) : (
          <Text style={{ color: C.muted }}>{isRu ? 'Нет данных' : 'No data'}</Text>
        )}

        {/* Recommendations */}
        {Array.isArray(aiReport.recommendations) && aiReport.recommendations.length > 0 && (
          <View style={{ marginTop: 14 }}>
            <Text style={s.sectionTitle}>{isRu ? 'Рекомендации' : 'Recommendations'}</Text>
            {aiReport.recommendations.map((rec: any, i: number) => (
              <View key={i} style={{ ...s.card, flexDirection: 'row', gap: 8 }}>
                <Text style={{ fontSize: 8, color: C.blue, fontWeight: 700 }}>{i + 1}.</Text>
                <Text style={{ fontSize: 8, color: C.white, flex: 1, lineHeight: 1.5 }}>{str(rec)}</Text>
              </View>
            ))}
          </View>
        )}
      </Page>

    </Document>
  );
}
