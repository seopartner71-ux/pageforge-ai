import { useState } from 'react';
import { CheckCircle2, Circle, Sparkles } from 'lucide-react';

interface ModuleStatusItem {
  name: string;
  time: string;
  done: boolean;
}

interface QuickWinItem {
  text: string;
}

interface ReportSidebarProps {
  modules: ModuleStatusItem[];
  quickWins: QuickWinItem[];
  modulesTitle: string;
  readyLabel: string;
  quickWinsTitle: string;
  scores?: any;
}

export function ReportSidebar({ modules, quickWins, modulesTitle, readyLabel, quickWinsTitle, scores }: ReportSidebarProps) {
  const [checkedWins, setCheckedWins] = useState<Set<number>>(new Set());

  const toggleWin = (i: number) => {
    setCheckedWins(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Module status */}
      <div className="report-soft-panel p-4">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{modulesTitle}</span>
          <span className="text-[11px] font-medium text-emerald-500">
            {readyLabel}
          </span>
        </div>
        <div className="space-y-1">
          {modules.map((m, i) => (
            <div key={i} className="flex items-center justify-between rounded-lg px-2.5 py-1.5 hover:bg-secondary/50 transition-colors">
              <div className="flex items-center gap-2">
                <div className={`h-1.5 w-1.5 rounded-full ${m.done ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                <span className="text-[12px] text-foreground/80">{m.name}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{m.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick wins */}
      {quickWins.length > 0 && (
        <div className="report-soft-panel overflow-hidden">
          <div className="border-b border-border/80 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-sm font-semibold text-foreground">{quickWinsTitle}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">{checkedWins.size}/{quickWins.length}</span>
            </div>
          </div>
          <div className="space-y-1 p-3">
            {quickWins.map((w, i) => (
              <button
                key={i}
                onClick={() => toggleWin(i)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-200 ${
                  checkedWins.has(i)
                    ? 'border-primary/20 bg-primary/5 opacity-60'
                    : 'border-border/60 hover:border-border hover:bg-secondary/30'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  {checkedWins.has(i) ? (
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={`text-[12px] leading-snug ${checkedWins.has(i) ? 'text-muted-foreground line-through' : 'text-foreground/80'}`}>
                    {w.text}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
