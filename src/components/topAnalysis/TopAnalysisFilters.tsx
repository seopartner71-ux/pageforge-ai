import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronDown, Filter, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

export type PositionRange = 'top3' | 'top5' | 'top10' | 'top30' | 'top50' | 'all';

interface Props {
  allQueries: string[];
  selectedQueries: string[];
  onSelectedQueriesChange: (qs: string[]) => void;
  positionRange: PositionRange;
  onPositionRangeChange: (r: PositionRange) => void;
}

const RANGES: { value: PositionRange; label: string }[] = [
  { value: 'top3', label: 'Топ-3' },
  { value: 'top5', label: 'Топ-5' },
  { value: 'top10', label: 'Топ-10' },
  { value: 'top30', label: 'Топ-30' },
  { value: 'top50', label: 'Топ-50' },
  { value: 'all', label: 'Все' },
];

export function TopAnalysisFilters({
  allQueries,
  selectedQueries,
  onSelectedQueriesChange,
  positionRange,
  onPositionRangeChange,
}: Props) {
  const allSelected = selectedQueries.length === 0;

  const toggleQuery = (q: string) => {
    if (selectedQueries.includes(q)) {
      onSelectedQueriesChange(selectedQueries.filter(x => x !== q));
    } else {
      onSelectedQueriesChange([...selectedQueries, q]);
    }
  };

  return (
    <Card className="p-3 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Filter className="w-3.5 h-3.5" />
        Фильтры:
      </div>

      {/* Запросы */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 h-8 text-xs">
            {allSelected ? `Все запросы (${allQueries.length})` : `Запросов: ${selectedQueries.length}/${allQueries.length}`}
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2 max-h-80 overflow-auto">
          <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-border">
            <span className="text-xs font-medium">Запросы</span>
            <button
              onClick={() => onSelectedQueriesChange([])}
              className="text-[11px] text-primary hover:underline"
            >
              Сбросить
            </button>
          </div>
          {allQueries.map((q) => {
            const checked = selectedQueries.length === 0 || selectedQueries.includes(q);
            return (
              <button
                key={q}
                onClick={() => toggleQuery(q)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-secondary rounded text-xs text-left"
              >
                <Checkbox checked={checked} className="pointer-events-none" />
                <span className="truncate flex-1">{q}</span>
              </button>
            );
          })}
        </PopoverContent>
      </Popover>

      {/* Диапазон позиций */}
      <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => onPositionRangeChange(r.value)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${
              positionRange === r.value
                ? 'bg-primary text-primary-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {selectedQueries.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs gap-1"
          onClick={() => onSelectedQueriesChange([])}
        >
          <Check className="w-3 h-3" /> Все запросы
        </Button>
      )}
    </Card>
  );
}
