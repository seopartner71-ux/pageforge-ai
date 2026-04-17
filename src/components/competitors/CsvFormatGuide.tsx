import { ChevronDown, HelpCircle, Download, ExternalLink } from 'lucide-react';

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
  const content = '\uFEFF' + `${header}\nexample.ru;${zeros}\ncompetitor.ru;${zeros}\n`;
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
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
    <div
      className="rounded-md border border-border bg-secondary/40 print:hidden"
      style={{ fontSize: 13 }}
    >
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium">Как подготовить CSV файл</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
          <p className="text-muted-foreground">
            Экспорт из Яндекс Вебмастер / Serpstat / Keys.so / Megaindex / PR-CY
          </p>

          <div>
            <p className="font-medium mb-1.5">Обязательные колонки ({REQUIRED_COLUMNS.length}):</p>
            <div className="flex flex-wrap gap-1">
              {REQUIRED_COLUMNS.map((col) => (
                <code
                  key={col}
                  className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded"
                >
                  {col}
                </code>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            <p>Разделитель: точка с запятой <code className="font-mono bg-muted px-1 rounded">;</code></p>
            <p>Кодировка: UTF-8</p>
            <p>Первая строка — заголовки. Один домен = одна строка. Максимум 50 доменов.</p>
            <p>Не удаляйте и не переименовывайте столбцы. Не используйте запятую как разделитель.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
            >
              <Download className="w-3.5 h-3.5" /> Скачать шаблон CSV
            </button>
            <span className="text-xs text-muted-foreground">Источники данных:</span>
            {SOURCES.map((s) => (
              <a
                key={s.name}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent text-foreground"
              >
                {s.name}
                <ExternalLink className="w-2.5 h-2.5 opacity-60" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
