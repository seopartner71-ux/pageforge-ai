import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { CompetitorUpload } from '@/components/competitors/CompetitorUpload';
import { CompetitorMetrics } from '@/components/competitors/CompetitorMetrics';
import { CompetitorCharts } from '@/components/competitors/CompetitorCharts';
import { CompetitorTable } from '@/components/competitors/CompetitorTable';
import { AiInsights } from '@/components/competitors/AiInsights';
import { CsvFormatGuide } from '@/components/competitors/CsvFormatGuide';
import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useToolHistory } from '@/hooks/useToolHistory';
import { SaveStatusBadge } from '@/components/SaveStatusBadge';
// exceljs+chart.js (~1MB) — динамический импорт при клике
const exportCompetitorsXlsx = (...args: Parameters<typeof import('@/lib/competitors/exportCompetitors').exportCompetitorsXlsx>) =>
  import('@/lib/competitors/exportCompetitors').then(m => m.exportCompetitorsXlsx(...args));

export default function CompetitorsPage() {
  const [searchParams] = useSearchParams();
  const restoreId = searchParams.get('restore');

  const [rows, setRows] = useState<CompetitorRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (rows.length > 0) setGuideOpen(false);
  }, [rows.length]);

  const saveName = fileName?.replace(/\.csv$/i, '') || (rows.length ? 'Анализ конкурентов' : '');
  const { savingState, hasProject, loadById } = useToolHistory({
    table: 'competitor_analyses',
    enabled: rows.length > 0,
    name: saveName,
    data: {
      file_name: fileName || '',
      payload: { rows },
      ai_markdown: aiMarkdown || '',
    },
  });

  useEffect(() => {
    if (!restoreId) return;
    (async () => {
      const row = await loadById(restoreId);
      if (!row) return;
      const p = (row as any).payload || {};
      setRows(p.rows || []);
      setFileName((row as any).file_name || null);
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
            <h1 className="text-2xl font-semibold">Конкуренты</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Загрузите CSV-выгрузку из Serpstat / Топвизор и получите сравнительный анализ доменов.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {rows.length > 0 && <SaveStatusBadge state={savingState} hasProject={hasProject} />}
            {rows.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => exportCompetitorsXlsx(rows, fileName?.replace(/\.csv$/i, '') || 'competitors', aiMarkdown)}
                className="gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                Excel
              </Button>
            )}
          </div>
        </div>

        <CsvFormatGuide open={guideOpen} onOpenChange={setGuideOpen} />

        <CompetitorUpload
          rows={rows}
          fileName={fileName}
          onLoaded={(r, n) => { setRows(r); setFileName(n); setAiMarkdown(null); }}
          onReset={() => { setRows([]); setFileName(null); setAiMarkdown(null); }}
        />

        {rows.length > 0 && (
          <>
            <CompetitorMetrics rows={rows} />
            <CompetitorCharts rows={rows} />
            <CompetitorTable rows={rows} />
            <AiInsights rows={rows} initialMarkdown={aiMarkdown} onMarkdown={setAiMarkdown} />
          </>
        )}
      </main>
    </div>
  );
}
