import { ChevronDown, HelpCircle, Download, ExternalLink } from 'lucide-react';

const SOURCES = [
  { name: 'Яндекс Вебмастер', url: 'https://webmaster.yandex.ru/' },
  { name: 'Serpstat', url: 'https://serpstat.com/' },
  { name: 'Keys.so', url: 'https://www.keys.so/' },
  { name: 'Топвизор', url: 'https://topvisor.com/' },
  { name: 'Rush Analytics', url: 'https://www.rush-analytics.ru/' },
];

function downloadTemplate() {
  const content = '\uFEFF' + 'Запрос;Домен;URL;Позиция\n' +
    'пример запрос 1;example.ru;https://example.ru/page;1\n' +
    'пример запрос 1;competitor.ru;https://competitor.ru/page;2\n' +
    'пример запрос 2;example.ru;https://example.ru/page2;3\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'top_analysis_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopAnalysisFormatGuide({ open, onOpenChange }: Props) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 print:hidden" style={{ fontSize: 13 }}>
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium">Как подготовить CSV файл</span>
        </span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
          <p className="text-muted-foreground">
            Экспорт данных по позициям в топе из Яндекс Вебмастер / Serpstat / Keys.so / Топвизор / Rush Analytics
          </p>

          <div>
            <p className="font-medium mb-1.5">Обязательные колонки (4):</p>
            <div className="flex flex-wrap gap-1">
              {['Запрос', 'Домен', 'URL', 'Позиция'].map((col) => (
                <code key={col} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{col}</code>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
            <p>Разделитель: точка с запятой <code className="font-mono bg-muted px-1 rounded">;</code></p>
            <p>Кодировка: UTF-8</p>
            <p>Первая строка — заголовки. Каждая строка = один результат (запрос × домен × позиция).</p>
            <p>Если столбец «Домен» пуст — он будет извлечён автоматически из URL.</p>
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
