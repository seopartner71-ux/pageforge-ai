import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Filter, RotateCcw } from 'lucide-react';
import {
  DEFAULT_EXCLUDED_DOMAINS,
  getExcludedDomains,
  setExcludedDomains,
  resetExcludedDomains,
} from '@/lib/topAnalysis/marketplaceFilter';
import { toast } from 'sonner';

interface Props {
  excludedRows: number;
  excludedDomains: string[];
  onChange: () => void;
}

export function ExcludedDomainsManager({ excludedRows, excludedDomains, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  useEffect(() => {
    if (open) setText(getExcludedDomains().join('\n'));
  }, [open]);

  const save = () => {
    const list = text.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    setExcludedDomains(list);
    toast.success(`Сохранено: ${list.length} доменов в стоп-листе`);
    setOpen(false);
    onChange();
  };

  const reset = () => {
    const list = resetExcludedDomains();
    setText(list.join('\n'));
    toast.info('Восстановлен стандартный список');
    onChange();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="w-3.5 h-3.5" />
          Исключено: <Badge variant="secondary" className="ml-1">{excludedDomains.length}</Badge>
          <span className="text-muted-foreground hidden sm:inline">· {excludedRows} строк</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Стоп-лист доменов</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Эти домены и все их поддомены исключаются из таблиц, графиков, AI-анализа и Excel-выгрузки.
            Один домен на строку (можно через запятую). По умолчанию: маркетплейсы, агрегаторы, отзовики, крупные интернет-магазины.
          </p>

          {excludedDomains.length > 0 && (
            <div className="rounded-md border bg-muted/30 p-3">
              <div className="text-xs font-medium mb-2">
                В текущей выгрузке исключено: {excludedDomains.length} доменов · {excludedRows} строк
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-auto">
                {excludedDomains.map((d) => (
                  <Badge key={d} variant="outline" className="text-xs font-mono">{d}</Badge>
                ))}
              </div>
            </div>
          )}

          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            className="font-mono text-xs"
            placeholder="wildberries.ru&#10;ozon.ru&#10;..."
          />
          <p className="text-xs text-muted-foreground">
            Текущий стандартный список содержит {DEFAULT_EXCLUDED_DOMAINS.length} доменов.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" size="sm" onClick={reset} className="gap-2 mr-auto">
            <RotateCcw className="w-3.5 h-3.5" />
            Сбросить к стандартному
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Отмена</Button>
          <Button size="sm" onClick={save}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
