import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Table2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export interface XlsxExportConfig {
  sheets: {
    metrics: boolean;
    tasks: boolean;
    tfidf: boolean;
  };
  columns: {
    // Metrics sheet
    url: boolean;
    region: boolean;
    pageType: boolean;
    date: boolean;
    seoHealth: boolean;
    llmFriendly: boolean;
    humanTouch: boolean;
    sgeAdapt: boolean;
    h1: boolean;
    title: boolean;
    metaDescription: boolean;
    jsonLd: boolean;
    openGraph: boolean;
    imageCount: boolean;
    imagesWithoutAlt: boolean;
    wordCount: boolean;
    // Tasks sheet
    priority: boolean;
    aiRecommendations: boolean;
    // TF-IDF sheet
    competitorMedian: boolean;
    status: boolean;
  };
}

const defaultConfig: XlsxExportConfig = {
  sheets: { metrics: true, tasks: true, tfidf: true },
  columns: {
    url: true, region: true, pageType: true, date: true,
    seoHealth: true, llmFriendly: true, humanTouch: true, sgeAdapt: true,
    h1: true, title: true, metaDescription: true, jsonLd: true, openGraph: true,
    imageCount: true, imagesWithoutAlt: true, wordCount: true,
    priority: true, aiRecommendations: true,
    competitorMedian: true, status: true,
  },
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (config: XlsxExportConfig) => void;
  loading: boolean;
  hasTfidf: boolean;
}

export function ExcelExportDialog({ open, onOpenChange, onExport, loading, hasTfidf }: Props) {
  const { lang } = useLang();
  const isRu = lang === 'ru';
  const [config, setConfig] = useState<XlsxExportConfig>(defaultConfig);

  const toggleSheet = (key: keyof XlsxExportConfig['sheets']) => {
    setConfig(prev => ({ ...prev, sheets: { ...prev.sheets, [key]: !prev.sheets[key] } }));
  };

  const toggleCol = (key: keyof XlsxExportConfig['columns']) => {
    setConfig(prev => ({ ...prev, columns: { ...prev.columns, [key]: !prev.columns[key] } }));
  };

  const anySheet = Object.values(config.sheets).some(Boolean);

  const metricsColumns: { key: keyof XlsxExportConfig['columns']; ru: string; en: string }[] = [
    { key: 'url', ru: 'URL страницы', en: 'Page URL' },
    { key: 'region', ru: 'Регион', en: 'Region' },
    { key: 'pageType', ru: 'Тип страницы', en: 'Page Type' },
    { key: 'date', ru: 'Дата анализа', en: 'Analysis Date' },
    { key: 'seoHealth', ru: 'SEO Health', en: 'SEO Health' },
    { key: 'llmFriendly', ru: 'LLM-Дружелюбность', en: 'LLM-Friendly' },
    { key: 'humanTouch', ru: 'Человечность', en: 'Human Touch' },
    { key: 'sgeAdapt', ru: 'SGE Адаптация', en: 'SGE Adapt' },
    { key: 'h1', ru: 'H1', en: 'H1' },
    { key: 'title', ru: 'Title', en: 'Title' },
    { key: 'metaDescription', ru: 'Meta Description', en: 'Meta Description' },
    { key: 'jsonLd', ru: 'JSON-LD', en: 'JSON-LD' },
    { key: 'openGraph', ru: 'OpenGraph', en: 'OpenGraph' },
    { key: 'imageCount', ru: 'Кол-во изображений', en: 'Image Count' },
    { key: 'imagesWithoutAlt', ru: 'Без alt', en: 'Without alt' },
    { key: 'wordCount', ru: 'Кол-во слов', en: 'Word Count' },
  ];

  const tasksColumns: { key: keyof XlsxExportConfig['columns']; ru: string; en: string }[] = [
    { key: 'priority', ru: 'Приоритет', en: 'Priority' },
    { key: 'aiRecommendations', ru: 'AI рекомендации', en: 'AI Recommendations' },
  ];

  const tfidfColumns: { key: keyof XlsxExportConfig['columns']; ru: string; en: string }[] = [
    { key: 'competitorMedian', ru: 'Медиана конкурентов', en: 'Competitor Median' },
    { key: 'status', ru: 'Статус', en: 'Status' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="w-4 h-4" />
            {isRu ? 'Настройка Excel-экспорта' : 'Configure Excel Export'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sheets */}
          <div>
            <p className="text-sm font-semibold mb-2">{isRu ? 'Листы' : 'Sheets'}</p>
            <div className="space-y-2">
              {([
                { key: 'metrics' as const, ru: 'Метрики (SEO аудит)', en: 'Metrics (SEO Audit)' },
                { key: 'tasks' as const, ru: 'Задачи (Quick Wins)', en: 'Tasks (Quick Wins)' },
                { key: 'tfidf' as const, ru: 'TF-IDF (Ключевые слова)', en: 'TF-IDF (Keywords)', disabled: !hasTfidf },
              ]).map(s => (
                <div key={s.key} className="flex items-center gap-2">
                  <Checkbox
                    id={`sheet-${s.key}`}
                    checked={config.sheets[s.key]}
                    onCheckedChange={() => toggleSheet(s.key)}
                    disabled={'disabled' in s && s.disabled}
                  />
                  <Label htmlFor={`sheet-${s.key}`} className="text-sm cursor-pointer">
                    {isRu ? s.ru : s.en}
                    {'disabled' in s && s.disabled && (
                      <span className="text-muted-foreground ml-1">({isRu ? 'нет данных' : 'no data'})</span>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Metrics columns */}
          {config.sheets.metrics && (
            <div>
              <p className="text-sm font-semibold mb-2">{isRu ? 'Колонки — Метрики' : 'Columns — Metrics'}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {metricsColumns.map(c => (
                  <div key={c.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${c.key}`}
                      checked={config.columns[c.key]}
                      onCheckedChange={() => toggleCol(c.key)}
                    />
                    <Label htmlFor={`col-${c.key}`} className="text-xs cursor-pointer">{isRu ? c.ru : c.en}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tasks columns */}
          {config.sheets.tasks && (
            <div>
              <p className="text-sm font-semibold mb-2">{isRu ? 'Колонки — Задачи' : 'Columns — Tasks'}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {tasksColumns.map(c => (
                  <div key={c.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${c.key}`}
                      checked={config.columns[c.key]}
                      onCheckedChange={() => toggleCol(c.key)}
                    />
                    <Label htmlFor={`col-${c.key}`} className="text-xs cursor-pointer">{isRu ? c.ru : c.en}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TF-IDF columns */}
          {config.sheets.tfidf && hasTfidf && (
            <div>
              <p className="text-sm font-semibold mb-2">{isRu ? 'Колонки — TF-IDF' : 'Columns — TF-IDF'}</p>
              <div className="grid grid-cols-2 gap-1.5">
                {tfidfColumns.map(c => (
                  <div key={c.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`col-${c.key}`}
                      checked={config.columns[c.key]}
                      onCheckedChange={() => toggleCol(c.key)}
                    />
                    <Label htmlFor={`col-${c.key}`} className="text-xs cursor-pointer">{isRu ? c.ru : c.en}</Label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {isRu ? 'Отмена' : 'Cancel'}
          </Button>
          <Button size="sm" disabled={!anySheet || loading} onClick={() => onExport(config)} className="gap-1.5">
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Table2 className="w-3 h-3" />}
            {isRu ? 'Скачать Excel' : 'Download Excel'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
