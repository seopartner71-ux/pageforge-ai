import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Brain, ListChecks, Map, BarChart3, Hash, Shield, FileDown,
} from 'lucide-react';

const tabIcons = {
  aiReport: Brain,
  priorities: ListChecks,
  blueprint: Map,
  tfidf: BarChart3,
  ngrams: Hash,
  stealth: Shield,
  pdf: FileDown,
};

type TabKey = keyof typeof tabIcons;

export function AnalysisTabs({ hasUrl }: { hasUrl: boolean }) {
  const { tr } = useLang();

  const tabKeys: TabKey[] = ['aiReport', 'priorities', 'blueprint', 'tfidf', 'ngrams', 'stealth', 'pdf'];

  return (
    <Tabs defaultValue="aiReport" className="w-full">
      <TabsList className="w-full h-auto flex flex-wrap gap-1 bg-secondary/50 p-1.5 rounded-xl">
        {tabKeys.map((key) => {
          const Icon = tabIcons[key];
          return (
            <TabsTrigger
              key={key}
              value={key}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-muted-foreground text-sm font-medium transition-all"
            >
              <Icon className="w-4 h-4" />
              {tr.tabs[key]}
            </TabsTrigger>
          );
        })}
      </TabsList>

      {tabKeys.map((key) => (
        <TabsContent key={key} value={key} className="mt-6">
          <div className="glass-card p-8 min-h-[300px] flex items-center justify-center">
            {hasUrl ? (
              <div className="text-center space-y-3 max-w-md">
                {(() => { const Icon = tabIcons[key]; return <Icon className="w-10 h-10 mx-auto text-primary animate-pulse-glow" />; })()}
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {tr.placeholders[key]}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{tr.urlRequired}</p>
            )}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
