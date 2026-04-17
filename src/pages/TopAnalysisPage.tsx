import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { TopAnalysisUpload } from '@/components/topAnalysis/TopAnalysisUpload';
import { TopAnalysisFormatGuide } from '@/components/topAnalysis/TopAnalysisFormatGuide';
import { TopAnalysisMetrics } from '@/components/topAnalysis/TopAnalysisMetrics';
import { TopAnalysisFilters, type PositionRange } from '@/components/topAnalysis/TopAnalysisFilters';
import { TopAnalysisProjectBar } from '@/components/topAnalysis/TopAnalysisProjectBar';
import { PresenceMatrix } from '@/components/topAnalysis/PresenceMatrix';
import { TopAnalysisCharts } from '@/components/topAnalysis/TopAnalysisCharts';
import { QueriesTable } from '@/components/topAnalysis/QueriesTable';
import { TopAnalysisAiInsights } from '@/components/topAnalysis/TopAnalysisAiInsights';
import { TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { applyFilters, uniqueQueries } from '@/lib/topAnalysis/aggregate';
import { filterMarketplaces, getExcludedDomains } from '@/lib/topAnalysis/marketplaceFilter';
import { ExcludedDomainsManager } from '@/components/topAnalysis/ExcludedDomainsManager';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download } from 'lucide-react';
import { useToolHistory } from '@/hooks/useToolHistory';
import { SaveStatusBadge } from '@/components/SaveStatusBadge';

// exceljs (~700kb) — динамический импорт при клике
const exportTopAnalysisXlsx = (...args: Parameters<typeof import('@/lib/topAnalysis/exportTopAnalysis').exportTopAnalysisXlsx>) =>
  import('@/lib/topAnalysis/exportTopAnalysis').then(m => m.exportTopAnalysisXlsx(...args));

type Engine = 'yandex' | 'google';

interface EngineState {
  rows: TopRow[];
  fileName: string | null;
  selectedQueries: string[];
  positionRange: PositionRange;
  aiMarkdown: string | null;
}

const emptyEngine = (): EngineState => ({
  rows: [],
  fileName: null,
  selectedQueries: [],
  positionRange: 'all',
  aiMarkdown: null,
});

const ENGINE_LABEL: Record<Engine, string> = { yandex: 'Яндекс', google: 'Google' };

export default function TopAnalysisPage() {
  const [searchParams] = useSearchParams();
  const restoreId = searchParams.get('restore');

  const [engine, setEngine] = useState<Engine>('yandex');
  const [engines, setEngines] = useState<Record<Engine, EngineState>>({
    yandex: emptyEngine(),
    google: emptyEngine(),
  });

  const [guideOpen, setGuideOpen] = useState(false);
  const [region, setRegion] = useState<string>('');
  const [myDomain, setMyDomain] = useState<string>('');
  const [excludedVersion, setExcludedVersion] = useState(0);

  const cur = engines[engine];
  const updateCur = (patch: Partial<EngineState>) =>
    setEngines((prev) => ({ ...prev, [engine]: { ...prev[engine], ...patch } }));

  useEffect(() => {
    if (cur.rows.length > 0) setGuideOpen(false);
  }, [cur.rows.length]);

  // Глобальный фильтр маркетплейсов
  const { rows: cleanRows, excludedDomains, excludedRows } = useMemo(() => {
    const excluded = getExcludedDomains();
    return filterMarketplaces(cur.rows, excluded);
  }, [cur.rows, excludedVersion]);

  const allQueries = useMemo(() => uniqueQueries(cleanRows), [cleanRows]);
  const filteredRows = useMemo(
    () => applyFilters(cleanRows, cur.selectedQueries, cur.positionRange),
    [cleanRows, cur.selectedQueries, cur.positionRange],
  );

  // Имя сохранения = имя любого загруженного файла
  const anyName = engines.yandex.fileName?.replace(/\.csv$/i, '')
    || engines.google.fileName?.replace(/\.csv$/i, '')
    || '';
  const hasAnyData = engines.yandex.rows.length > 0 || engines.google.rows.length > 0;

  const { savingState, hasProject, loadById } = useToolHistory({
    table: 'top_analyses',
    enabled: hasAnyData,
    name: anyName || 'Анализ топа',
    data: {
      file_name: cur.fileName || '',
      region,
      my_domain: myDomain,
      payload: { engines, activeEngine: engine },
    },
  });

  // Восстановление по ?restore=<id>
  useEffect(() => {
    if (!restoreId) return;
    (async () => {
      const row = await loadById(restoreId);
      if (!row) return;
      const p = (row as any).payload || {};
      // Поддержка нового и старого формата
      if (p.engines) {
        setEngines({
          yandex: { ...emptyEngine(), ...(p.engines.yandex || {}) },
          google: { ...emptyEngine(), ...(p.engines.google || {}) },
        });
        setEngine(p.activeEngine || 'yandex');
      } else {
        // legacy: одна выгрузка → кладём в Яндекс
        setEngines({
          yandex: {
            rows: p.rows || [],
            fileName: (row as any).file_name || null,
            selectedQueries: p.selectedQueries || [],
            positionRange: p.positionRange || 'all',
            aiMarkdown: (row as any).ai_markdown || null,
          },
          google: emptyEngine(),
        });
        setEngine('yandex');
      }
      setRegion((row as any).region || '');
      setMyDomain((row as any).my_domain || '');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreId]);

  const exportExcel = () => {
    const baseName = (cur.fileName?.replace(/\.csv$/i, '') || anyName || 'top_analysis') + `_${engine}`;
    exportTopAnalysisXlsx(
      cleanRows,
      baseName,
      { aiMarkdown: cur.aiMarkdown, region, myDomain, engine: ENGINE_LABEL[engine] },
    );
  };

  const otherEngine: Engine = engine === 'yandex' ? 'google' : 'yandex';
  const otherFilled = engines[otherEngine].rows.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold">Анализ топа</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Загрузите отдельные CSV для Яндекса и Google — для каждой ПС своя матрица, графики, AI-анализ и Excel.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {hasAnyData && <SaveStatusBadge state={savingState} hasProject={hasProject} />}
            {cur.rows.length > 0 && (
              <ExcludedDomainsManager
                excludedRows={excludedRows}
                excludedDomains={excludedDomains}
                onChange={() => setExcludedVersion((v) => v + 1)}
              />
            )}
            {cleanRows.length > 0 && (
              <Button variant="outline" size="sm" onClick={exportExcel} className="gap-2">
                <Download className="w-3.5 h-3.5" />
                Excel · {ENGINE_LABEL[engine]}
              </Button>
            )}
          </div>
        </div>

        {/* Переключатель поисковых систем */}
        <Tabs value={engine} onValueChange={(v) => setEngine(v as Engine)}>
          <TabsList className="grid grid-cols-2 w-full max-w-md">
            <TabsTrigger value="yandex" className="gap-2">
              Яндекс
              {engines.yandex.rows.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {engines.yandex.rows.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="google" className="gap-2">
              Google
              {engines.google.rows.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                  {engines.google.rows.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <TopAnalysisFormatGuide open={guideOpen} onOpenChange={setGuideOpen} />

        <TopAnalysisProjectBar
          rows={cleanRows}
          region={region}
          onRegionChange={setRegion}
          myDomain={myDomain}
          onMyDomainChange={setMyDomain}
        />

        <TopAnalysisUpload
          rows={cur.rows}
          fileName={cur.fileName}
          onLoaded={(r, n) => updateCur({ rows: r, fileName: n, selectedQueries: [], positionRange: 'all', aiMarkdown: null })}
          onReset={() => updateCur(emptyEngine())}
        />

        {cur.rows.length === 0 && otherFilled && (
          <div className="text-xs text-muted-foreground italic px-1">
            В «{ENGINE_LABEL[otherEngine]}» уже загружено {engines[otherEngine].rows.length} строк. Загрузите CSV и для «{ENGINE_LABEL[engine]}», чтобы получить отдельный анализ и Excel.
          </div>
        )}

        {cur.rows.length > 0 && (
          <>
            <TopAnalysisMetrics rows={filteredRows} />

            <TopAnalysisFilters
              allQueries={allQueries}
              selectedQueries={cur.selectedQueries}
              onSelectedQueriesChange={(qs) => updateCur({ selectedQueries: qs })}
              positionRange={cur.positionRange}
              onPositionRangeChange={(r) => updateCur({ positionRange: r })}
            />

            <PresenceMatrix rows={filteredRows} myDomain={myDomain} />
            <TopAnalysisCharts rows={filteredRows} />
            <QueriesTable rows={filteredRows} />
            <TopAnalysisAiInsights
              rows={filteredRows}
              region={region}
              myDomain={myDomain}
              initialMarkdown={cur.aiMarkdown}
              onMarkdown={(md) => updateCur({ aiMarkdown: md })}
            />
          </>
        )}
      </main>
    </div>
  );
}
