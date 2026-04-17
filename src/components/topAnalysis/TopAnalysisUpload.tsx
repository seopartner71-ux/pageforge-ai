import { useRef, useState, DragEvent } from 'react';
import { Upload, FileText, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { parseTopAnalysisCsv, TopRow } from '@/lib/topAnalysis/parseTopAnalysisCsv';
import { toast } from 'sonner';

interface Props {
  rows: TopRow[];
  fileName: string | null;
  onLoaded: (rows: TopRow[], fileName: string) => void;
  onReset: () => void;
}

export function TopAnalysisUpload({ rows, fileName, onLoaded, onReset }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast.error('Поддерживается только CSV');
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const { rows: parsed, errors } = await parseTopAnalysisCsv(text);
      if (errors.length) { toast.error(errors.join('\n')); return; }
      if (parsed.length === 0) { toast.error('Файл пуст'); return; }
      onLoaded(parsed, file.name);
      const queries = new Set(parsed.map(r => r.query)).size;
      const domains = new Set(parsed.map(r => r.domain)).size;
      toast.success(`Загружено ${parsed.length} строк · ${queries} запросов · ${domains} доменов`);
    } catch (e: any) {
      toast.error(`Ошибка чтения файла: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  if (rows.length > 0 && fileName) {
    const queries = new Set(rows.map(r => r.query)).size;
    const domains = new Set(rows.map(r => r.domain)).size;
    return (
      <Card className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{fileName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {rows.length} строк · {queries} запросов · {domains} доменов
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onReset} className="gap-2 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" />
          Сбросить
        </Button>
      </Card>
    );
  }

  return (
    <Card
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`p-10 border-2 border-dashed transition-colors cursor-pointer ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
      }`}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Upload className="w-6 h-6 text-primary" />
        </div>
        <div>
          <div className="font-medium text-sm">
            {loading ? 'Чтение файла...' : 'Перетащите CSV или нажмите для выбора'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Колонки: Запрос; Домен; URL; Позиция · разделитель «;» · UTF-8
          </div>
        </div>
        <Button variant="outline" size="sm" disabled={loading}>
          Загрузить CSV
        </Button>
      </div>
    </Card>
  );
}
