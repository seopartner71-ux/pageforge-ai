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
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToolHistory } from '@/hooks/useToolHistory';
import { SaveStatusBadge } from '@/components/SaveStatusBadge';

// exceljs (~700kb) — динамический импорт при клике
const exportTopAnalysisXlsx = (...args: Parameters<typeof import('@/lib/topAnalysis/exportTopAnalysis').exportTopAnalysisXlsx>) =>
  import('@/lib/topAnalysis/exportTopAnalysis').then(m => m.exportTopAnalysisXlsx(...args));

export default function TopAnalysisPage() {
  const [searchParams] = useSearchParams();
  const restoreId = searchParams.get('restore');

  const [rows, setRows] = useState<TopRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedQueries, setSelectedQueries] = useState<string[]>([]);
  const [positionRange, setPositionRange] = useState<PositionRange>('all');
  const [region, setRegion] = useState<string>('');
  const [myDomain, setMyDomain] = useState<string>('');
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (rows.length > 0) setGuideOpen(false);
  }, [rows.length]);

  const allQueries = useMemo(() => uniqueQueries(rows), [rows]);
  const filteredRows = useMemo(
    () => applyFilters(rows, selectedQueries, positionRange),
    [rows, selectedQueries, positionRange],
  );

  // Автосохранение в историю
  const saveName = fileName?.replace(/\.csv$/i, '') || (rows.length ? 'Анализ топа' : '');
  const { savingState, hasProject, loadById } = useToolHistory({
    table: 'top_analyses',
    enabled: rows.length > 0,
    name: saveName,
    data: {
      file_name: fileName || '',
      region,
      my_domain: myDomain,
      payload: { rows, selectedQueries, positionRange },
      ai_markdown: aiMarkdown || '',
    },
  });

  // Восстановление по ?restore=<id>
  useEffect(() => {
    if (!restoreId) return;
    (async () => {
      const row = await loadById(restoreId);
      if (!row) return;
      const p = (row as any).payload || {};
      setRows(p.rows || []);
      setFileName((row as any).file_name || null);
      setSelectedQueries(p.selectedQueries || []);
      setPositionRange(p.positionRange || 'all');
      setRegion((row as any).region || '');
      setMyDomain((row as any).my_domain || '');
      setAiMarkdown((row as any).ai_markdown || null);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restoreId]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Анализ топа</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Загрузите CSV с позициями (Запрос; Домен; URL; Позиция) — получите матрицу присутствия, графики и AI-аналитику ниши.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {rows.length > 0 && <SaveStatusBadge state={savingState} hasProject={hasProject} />}
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportTopAnalysisXlsx(
                  rows,
                  fileName?.replace(/\.csv$/i, '') || 'top_analysis',
                  { aiMarkdown, region, myDomain },
                )}
                className="gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </Button>
            )}
          </div>
        </div>

        <TopAnalysisFormatGuide open={guideOpen} onOpenChange={setGuideOpen} />

        <TopAnalysisProjectBar
          rows={rows}
          region={region}
          onRegionChange={setRegion}
          myDomain={myDomain}
          onMyDomainChange={setMyDomain}
        />

        <TopAnalysisUpload
          rows={rows}
          fileName={fileName}
          onLoaded={(r, n) => { setRows(r); setFileName(n); setSelectedQueries([]); setPositionRange('all'); setAiMarkdown(null); }}
          onReset={() => { setRows([]); setFileName(null); setSelectedQueries([]); setPositionRange('all'); setAiMarkdown(null); }}
        />

        {rows.length > 0 && (
          <>
            <TopAnalysisMetrics rows={filteredRows} />

            <TopAnalysisFilters
              allQueries={allQueries}
              selectedQueries={selectedQueries}
              onSelectedQueriesChange={setSelectedQueries}
              positionRange={positionRange}
              onPositionRangeChange={setPositionRange}
            />

            <PresenceMatrix rows={filteredRows} myDomain={myDomain} />
            <TopAnalysisCharts rows={filteredRows} />
            <QueriesTable rows={filteredRows} />
            <TopAnalysisAiInsights
              rows={filteredRows}
              region={region}
              myDomain={myDomain}
              initialMarkdown={aiMarkdown}
              onMarkdown={setAiMarkdown}
            />
          </>
        )}
      </main>
    </div>
  );
}
