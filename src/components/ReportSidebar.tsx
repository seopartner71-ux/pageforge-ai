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
}

export function ReportSidebar({ modules, quickWins, modulesTitle, readyLabel, quickWinsTitle }: ReportSidebarProps) {
  return (
    <div className="space-y-6">
      {/* Module status */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-xs tracking-widest text-muted-foreground font-semibold">{modulesTitle}</h3>
          <span className="text-xs font-semibold text-accent">✓ {readyLabel}</span>
        </div>
        <div className="space-y-3">
          {modules.map((m, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${m.done ? 'bg-accent' : 'bg-muted-foreground'}`} />
                <span className="text-sm text-foreground">{m.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">{m.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Wins */}
      <div className="glass-card p-6">
        <h3 className="text-xs tracking-widest text-muted-foreground font-semibold mb-4">{quickWinsTitle}</h3>
        <div className="space-y-3">
          {quickWins.map((w, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-accent mt-0.5 shrink-0">✓</span>
              <span className="text-sm text-foreground leading-snug">{w.text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
