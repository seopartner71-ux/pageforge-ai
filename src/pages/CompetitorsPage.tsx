import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { CompetitorUpload } from '@/components/competitors/CompetitorUpload';
import { CompetitorMetrics } from '@/components/competitors/CompetitorMetrics';
import { CompetitorCharts } from '@/components/competitors/CompetitorCharts';
import { CompetitorTable } from '@/components/competitors/CompetitorTable';
import { AiInsights } from '@/components/competitors/AiInsights';
import { CsvFormatGuide } from '@/components/competitors/CsvFormatGuide';
import { CompetitorRow } from '@/lib/competitors/parseCompetitorsCsv';
import { Button } from '@/components/ui/button';
import { Download, Users } from 'lucide-react';
import { useToolHistory } from '@/hooks/useToolHistory';
import { SaveStatusBadge } from '@/components/SaveStatusBadge';
// exceljs+chart.js (~1MB) - динамический импорт при клике
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
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Users className="w-6 h-6 text-primary" />
              Конкуренты
            </h1>
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

        <PageDescription
          items={[
            { label: 'Что это', text: 'Сравнительный анализ позиций и видимости вашего сайта против конкурентов по общему семантическому ядру. Загружаете CSV из Serpstat или Топвизор - получаете сводную картину по доменам.' },
            { label: 'Что проверяем', text: 'Пересечение запросов между сайтами, средние позиции, видимость, ТОП-10 / ТОП-30 каждого конкурента, упущенные ключи (где конкурент в ТОПе, а вы - нет), общие точки роста и уникальные сильные стороны.' },
            { label: 'Зачем', text: 'Чтобы понять, кто реально борется за вашу аудиторию, по каким запросам вы отстаёте, какие темы у конкурентов работают, и куда направить силы - на расширение семантики или на улучшение существующих страниц.' },
            { label: 'Результат', text: 'Сводные таблицы по доменам, матрица пересечения запросов, AI-комментарий по сильным и слабым сторонам каждого сайта, выгрузка отчёта в Excel.' },
          ]}
          help={{
            content: [
              'Конкурентный анализ - обязательный этап SEO-стратегии: ваши SEO-конкуренты в выдаче часто отличаются от бизнес-конкурентов. Реальный конкурент - это сайт, который ранжируется по тем же запросам, что и вы (даже если предлагает другой продукт). Методология основана на работе Rand Fishkin и сообщества SEO (с 2007 года).',
              'Метрика "видимость" (visibility) - доля показов сайта в ТОПе по семантическому ядру, взвешенная по позициям и частотностям. Используется Semrush, Ahrefs, Topvisor, Serpstat по близким формулам. Эта метрика коррелирует с органическим трафиком и используется для мониторинга роста/просадок относительно конкурентов.',
              'Content gap analysis - поиск запросов, по которым конкуренты в ТОПе, а вы - нет. Это базовая техника расширения семантики: каждый такой запрос - потенциальная новая страница или раздел. Подход применяется в Google Search Console (отчёт "Запросы") и сторонних инструментах.',
            ],
            sources: [
              { label: 'Google Search Central - SEO documentation', url: 'https://developers.google.com/search/docs' },
              { label: 'Google Search Console - Performance report', url: 'https://support.google.com/webmasters/answer/7042828' },
              { label: 'Moz - Competitive Analysis Guide (Rand Fishkin методология)', url: 'https://moz.com/blog/seo-competitive-analysis' },
            ],
          }}
        />

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
