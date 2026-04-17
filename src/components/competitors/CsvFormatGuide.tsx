import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, Download, FileText, ExternalLink } from 'lucide-react';

const REQUIRED_COLUMNS = [
  'Домен', 'В топ 1', 'В топ 3', 'В топ 5', 'В топ 10', 'В топ 50',
  'Упоминания в Алисе', 'Страниц', 'По видимости', 'По охвату ключей',
  'Запросов на страницу', 'Результативность', 'Видимость', 'Трафик',
  'Объявлений', 'Запросов в контексте', 'Запросов на объявление',
  'Трафик в контексте', 'Бюджет в контексте',
];

const SOURCES = [
  { name: 'Яндекс Вебмастер', url: 'https://webmaster.yandex.ru/' },
  { name: 'Serpstat', url: 'https://serpstat.com/' },
  { name: 'Keys.so', url: 'https://www.keys.so/' },
  { name: 'Megaindex', url: 'https://ru.megaindex.com/' },
  { name: 'PR-CY', url: 'https://pr-cy.ru/' },
];

function downloadTemplate() {
  const header = REQUIRED_COLUMNS.join(';');
  const zeros = Array(REQUIRED_COLUMNS.length - 1).fill('0').join(';');
  const content = `${header}\nexample.ru;${zeros}\ncompetitor.ru;${zeros}\n`;
  // BOM для корректной кодировки в Excel
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pageforge_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface CsvFormatGuideProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CsvFormatGuide({ open, onOpenChange }: CsvFormatGuideProps) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/40">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-700 dark:text-amber-400" />
              <span className="font-medium text-sm text-amber-900 dark:text-amber-200">
                Как подготовить файл для загрузки
              </span>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-amber-700 dark:text-amber-400 transition-transform ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Левый — требования */}
              <div className="rounded-md bg-background/60 border border-amber-200/60 dark:border-amber-900/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200 mb-2">
                  Требования к формату
                </h4>
                <ul className="space-y-1.5 text-sm text-foreground/80">
                  <li><span className="text-green-600 font-bold mr-1.5">✓</span>Формат файла: CSV с разделителем <code className="px-1 py-0.5 rounded bg-muted text-xs">;</code> (точка с запятой)</li>
                  <li><span className="text-green-600 font-bold mr-1.5">✓</span>Кодировка: UTF-8</li>
                  <li><span className="text-green-600 font-bold mr-1.5">✓</span>Первая строка — заголовки (как в шаблоне)</li>
                  <li><span className="text-green-600 font-bold mr-1.5">✓</span>Один домен = одна строка</li>
                  <li><span className="text-green-600 font-bold mr-1.5">✓</span>Максимум 50 доменов</li>
                  <li><span className="text-red-600 font-bold mr-1.5">✗</span>Не удалять и не переименовывать столбцы</li>
                  <li><span className="text-red-600 font-bold mr-1.5">✗</span>Не использовать запятую как разделитель</li>
                </ul>
              </div>

              {/* Правый — обязательные столбцы */}
              <div className="rounded-md bg-background/60 border border-amber-200/60 dark:border-amber-900/40 p-3">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200 mb-2">
                  Обязательные столбцы ({REQUIRED_COLUMNS.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {REQUIRED_COLUMNS.map((col) => (
                    <Badge key={col} variant="secondary" className="font-normal text-[11px]">
                      {col}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-1">
              <Button onClick={downloadTemplate} size="sm" className="gap-2 w-fit">
                <Download className="w-3.5 h-3.5" />
                Скачать шаблон CSV
              </Button>
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Данные можно экспортировать из:</span>
                {SOURCES.map((s) => (
                  <a
                    key={s.name}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-background border border-border hover:bg-muted hover:border-amber-300 transition-colors text-foreground"
                  >
                    {s.name}
                    <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
