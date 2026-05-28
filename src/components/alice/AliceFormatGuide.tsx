import { useState } from 'react';
import { ChevronDown, HelpCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

const COLUMNS = [
  'Запрос',
  'Частотность',
  '"!Частотность"',
  '"[!Частотность]"',
  'Ответ ИИ',
  'Источники',
];

const SAMPLE_ANSWER =
  'Косметика бренда Ренессанс — отечественная марка натуральной косметики. ' +
  'Подробнее о составе можно почитать в обзоре [`1`](https://www.ozon.ru/brand/renessans-100123/) ' +
  'и в каталоге [`2`](https://ren-cosm.ru/catalog).';

function downloadTemplate() {
  const rows = [
    COLUMNS,
    [
      'купить крем ренессанс',
      1200,
      450,
      120,
      SAMPLE_ANSWER,
      'https://www.ozon.ru/brand/renessans-100123/\nhttps://ren-cosm.ru/catalog',
    ],
    [
      'натуральная косметика отзывы',
      8800,
      2100,
      640,
      'По отзывам покупателей хорошо себя зарекомендовали бренды [`1`](https://otzovik.com/...) и [`2`](https://irecommend.ru/...).',
      'https://otzovik.com/\nhttps://irecommend.ru/',
    ],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 18 }, { wch: 70 }, { wch: 40 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Алиса');
  XLSX.writeFile(wb, 'alice_visibility_template.xlsx');
}

export function AliceFormatGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-border bg-secondary/40" style={{ fontSize: 13 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left"
      >
        <span className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-primary" />
          <span className="font-medium">Формат XLSX файла и шаблон</span>
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border">
          <p className="text-muted-foreground">
            Файл Excel (.xlsx) с листом <code className="font-mono bg-muted px-1 rounded">Алиса</code>{' '}
            (если листа с таким именем нет — берётся первый). Каждая строка — один запрос из семантического ядра.
          </p>

          <div>
            <p className="font-medium mb-1.5">Колонки ({COLUMNS.length}):</p>
            <div className="flex flex-wrap gap-1">
              {COLUMNS.map((c) => (
                <code key={c} className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">
                  {c}
                </code>
              ))}
            </div>
          </div>

          <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
            <li><b>Запрос</b> — ключевая фраза (обязательно).</li>
            <li><b>Частотность</b> — общая частотность Wordstat (число).</li>
            <li><b>"!Частотность"</b> — точная частотность (с оператором «!»).</li>
            <li><b>"[!Частотность]"</b> — фразовая частотность (с операторами «[!]»).</li>
            <li>
              <b>Ответ ИИ</b> — текст ответа Алисы в формате Markdown.
              Ссылки-цитаты в формате{' '}
              <code className="font-mono bg-muted px-1 rounded">[`1`](https://example.com)</code>{' '}
              распознаются автоматически.
            </li>
            <li>
              <b>Источники</b> — ссылки на источники (по одной в строке, через запятую или пробел).
              Учитываются вместе с цитатами из ответа.
            </li>
          </ul>

          <div className="text-xs text-muted-foreground">
            Кодировка любая (UTF-8 рекомендуется). Максимум — без жёсткого ограничения, тестировалось до ~1000 строк.
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
            >
              <Download className="w-3.5 h-3.5" /> Скачать шаблон XLSX
            </button>
          </div>
        </div>
      )}
    </div>
  );
}