import { useState } from 'react';
import { ChevronDown, HelpCircle, Download } from 'lucide-react';

function downloadCsv(filename: string, headers: string[]) {
  const BOM = '\uFEFF';
  const content = BOM + headers.join(';') + '\n';
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

const BACKLINKS_HEADERS = [
  'Домен источник',
  'URL источник',
  'DR',
  'Анкор',
  'Тип',
  'Атрибуты',
  'Статус ссылки',
];

const SUMMARY_HEADERS = [
  'Домен',
  'DR',
  'Трафик',
  'Обратные ссылки',
  'Ссылающихся доменов',
  'В топ 10',
  'В топ 50',
];

export function CsvFormatGuide() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'backlinks' | 'summary'>('backlinks');

  return (
    <div
      className="rounded-md border border-border bg-secondary/40 print:hidden"
      style={{ fontSize: 13 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium">Как подготовить CSV файлы</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
          {/* Tabs */}
          <div className="inline-flex rounded-md border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setTab('backlinks')}
              className={`px-3 py-1 text-xs ${tab === 'backlinks' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'}`}
            >
              Бэклинки (по сайтам)
            </button>
            <button
              type="button"
              onClick={() => setTab('summary')}
              className={`px-3 py-1 text-xs ${tab === 'summary' ? 'bg-primary text-primary-foreground' : 'bg-card text-foreground hover:bg-accent'}`}
            >
              Сводная таблица доменов
            </button>
          </div>

          {tab === 'backlinks' && (
            <div className="space-y-2 text-foreground/90">
              <p className="text-muted-foreground">
                Экспорт из Serpstat / Ahrefs / SE Ranking
              </p>
              <p className="font-medium">Обязательные колонки:</p>
              <ul className="space-y-1 list-disc pl-5">
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Домен источник</code> — донор ссылки</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">URL источник</code> — страница донора</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">DR</code> — доменный рейтинг (число)</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Анкор</code> — текст ссылки</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Тип</code> — Текст / Изображение / Редирект</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Атрибуты</code> — follow / nofollow</li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Статус ссылки</code> — Активная / Неактивная</li>
              </ul>
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                <p>Разделитель: точка с запятой <code className="font-mono bg-muted px-1 rounded">;</code></p>
                <p>Кодировка: UTF-8</p>
                <p>Загружать отдельно для каждого сайта: первый файл = аудируемый сайт, остальные = конкуренты.</p>
              </div>
              <button
                type="button"
                onClick={() => downloadCsv('Шаблон бэклинков.csv', BACKLINKS_HEADERS)}
                className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              >
                <Download className="w-3.5 h-3.5" /> Скачать шаблон CSV
              </button>
            </div>
          )}

          {tab === 'summary' && (
            <div className="space-y-2 text-foreground/90">
              <p className="text-muted-foreground">
                Экспорт из Serpstat (Batch анализ доменов)
              </p>
              <p className="font-medium">Обязательные колонки:</p>
              <ul className="space-y-1 list-disc pl-5">
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Домен</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">DR</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Трафик</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Обратные ссылки</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">Ссылающихся доменов</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">В топ 10</code></li>
                <li><code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">В топ 50</code></li>
              </ul>
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                <p>Разделитель: точка с запятой <code className="font-mono bg-muted px-1 rounded">;</code></p>
                <p>Кодировка: UTF-8</p>
                <p>Первая строка = аудируемый сайт, остальные = конкуренты. Все сайты в одном файле.</p>
              </div>
              <button
                type="button"
                onClick={() => downloadCsv('Шаблон доменов.csv', SUMMARY_HEADERS)}
                className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              >
                <Download className="w-3.5 h-3.5" /> Скачать шаблон CSV
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
