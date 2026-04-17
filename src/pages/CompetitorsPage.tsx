import { useEffect, useState } from 'react';
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
import { exportCompetitorsXlsx } from '@/lib/competitors/exportCompetitors';

export default function CompetitorsPage() {
  const [rows, setRows] = useState<CompetitorRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [aiMarkdown, setAiMarkdown] = useState<string | null>(null);

  useEffect(() => {
    if (rows.length > 0) setGuideOpen(false);
  }, [rows.length]);

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

        <CsvFormatGuide open={guideOpen} onOpenChange={setGuideOpen} />

        <CompetitorUpload
          rows={rows}
          fileName={fileName}
          onLoaded={(r, n) => { setRows(r); setFileName(n); }}
          onReset={() => { setRows([]); setFileName(null); }}
        />

        {rows.length > 0 && (
          <>
            <CompetitorMetrics rows={rows} />
            <CompetitorCharts rows={rows} />
            <CompetitorTable rows={rows} />
            <AiInsights rows={rows} onMarkdown={setAiMarkdown} />
          </>
        )}
      </main>
    </div>
  );
}
