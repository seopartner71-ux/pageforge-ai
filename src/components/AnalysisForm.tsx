import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Home, ShoppingBag, Wrench, FileText, ShoppingCart, Target,
  X, Search, Play, Loader2,
} from 'lucide-react';

const pageTypeIcons = [
  { key: 'homepage', icon: Home },
  { key: 'category', icon: ShoppingBag },
  { key: 'service', icon: Wrench },
  { key: 'article', icon: FileText },
  { key: 'product', icon: ShoppingCart },
  { key: 'landing', icon: Target },
] as const;

interface AnalysisFormProps {
  onStartAnalysis: (data: {
    url: string;
    pageType: string;
    competitors: string[];
    aiContext: string;
    clusterMode: boolean;
    projectId?: string;
  }) => void;
  loading: boolean;
  projects?: { id?: string; name: string; domain: string }[];
  onNewProject?: () => void;
}

export function AnalysisForm({ onStartAnalysis, loading, projects = [], onNewProject }: AnalysisFormProps) {
  const { tr } = useLang();
  const [url, setUrl] = useState('');
  const [pageType, setPageType] = useState('');
  const [competitors, setCompetitors] = useState(['']);
  const [aiContext, setAiContext] = useState('');
  const [clusterMode, setClusterMode] = useState(false);
  const [speedEnabled, setSpeedEnabled] = useState(true);
  const [semanticsEnabled, setSemanticsEnabled] = useState(true);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState(0);

  const addCompetitor = () => {
    if (competitors.length < 5) setCompetitors([...competitors, '']);
  };

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const updateCompetitor = (index: number, value: string) => {
    const updated = [...competitors];
    updated[index] = value;
    setCompetitors(updated);
  };

  const handleSubmit = () => {
    if (!url.trim()) return;
    onStartAnalysis({
      url: url.trim(),
      pageType,
      competitors: competitors.filter(c => c.trim()),
      aiContext,
      clusterMode,
      projectId: projects[selectedProjectIdx]?.id,
    });
  };

  return (
    <div className="space-y-6">
      {/* Project selector */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs tracking-widest text-muted-foreground font-semibold">📁 {tr.projectSection.title}</span>
          </div>
          <button onClick={onNewProject} className="text-sm text-accent hover:underline font-medium">{tr.projectSection.newProject}</button>
        </div>
        <div className="flex gap-3">
          <select
            value={selectedProjectIdx}
            onChange={(e) => setSelectedProjectIdx(Number(e.target.value))}
            className="flex-1 h-11 rounded-lg bg-secondary border border-border/50 px-4 text-sm text-foreground focus:border-primary outline-none"
          >
            {projects.map((p, i) => (
              <option key={i} value={i}>{p.name} — {p.domain || 'без домена'}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Page URL + type */}
      <div className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <span className="text-xs tracking-widest text-muted-foreground font-semibold">📄 {tr.pageSection.title}</span>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground font-medium">● {tr.pageSection.clusterToggle}</span>
            <Switch checked={clusterMode} onCheckedChange={setClusterMode} />
          </div>
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-2 block">{tr.pageSection.urlLabel}</label>
          <Input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={tr.pageSection.urlPlaceholder}
            className="h-11 bg-secondary border-border/50 focus:border-primary"
          />
        </div>

        <div>
          <label className="text-sm text-muted-foreground mb-3 block">{tr.pageTypes.title}</label>
          <div className="grid grid-cols-3 gap-3">
            {pageTypeIcons.map(({ key, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPageType(key)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                  pageType === key
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border/50 bg-secondary/50 text-muted-foreground hover:border-border hover:text-foreground'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{tr.pageTypes[key as keyof typeof tr.pageTypes]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Competitors */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-muted-foreground font-semibold">🔍 {tr.competitors.title}</span>
          <span className="text-xs text-muted-foreground">{tr.competitors.limit}</span>
        </div>

        {competitors.map((comp, i) => (
          <div key={i} className="flex gap-2">
            <Input
              value={comp}
              onChange={(e) => updateCompetitor(i, e.target.value)}
              placeholder={tr.competitors.placeholder}
              className="h-11 bg-secondary border-border/50 focus:border-primary"
            />
            {competitors.length > 1 && (
              <button onClick={() => removeCompetitor(i)} className="w-11 h-11 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-border transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        <button
          onClick={addCompetitor}
          className="w-full h-11 rounded-lg border border-dashed border-border/50 text-sm text-muted-foreground hover:text-foreground hover:border-border transition-colors"
        >
          {tr.competitors.addManual}
        </button>

        <div className="text-center text-xs text-muted-foreground py-1">{tr.competitors.or}</div>

        <button className="w-full h-12 rounded-lg border border-border/50 bg-secondary/50 text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2">
          <Search className="w-4 h-4" />
          {tr.competitors.autoFind}
        </button>
      </div>

      {/* AI Context */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-muted-foreground font-semibold">🧠 {tr.aiContext.title}</span>
          <span className="text-xs text-muted-foreground">{tr.aiContext.optional}</span>
        </div>
        <label className="text-sm text-muted-foreground block">{tr.aiContext.label}</label>
        <textarea
          value={aiContext}
          onChange={(e) => setAiContext(e.target.value)}
          placeholder={tr.aiContext.placeholder}
          rows={4}
          className="w-full rounded-lg bg-secondary border border-border/50 px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary outline-none resize-none"
        />
      </div>

      {/* Integrations */}
      <div className="glass-card p-6 space-y-5">
        <div className="flex items-center gap-2">
          <span className="text-xs tracking-widest text-muted-foreground font-semibold">⚡ {tr.integrations.title}</span>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm text-foreground">{tr.integrations.gsc}</span>
          </div>
          <button className="px-4 py-1.5 rounded-lg border border-border/50 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
            {tr.integrations.loadCsv}
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm text-foreground">{tr.integrations.yandex}</span>
          </div>
          <button className="px-4 py-1.5 rounded-lg border border-border/50 text-xs font-medium text-foreground hover:bg-secondary transition-colors">
            {tr.integrations.loadCsv}
          </button>
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm text-foreground">{tr.integrations.speed}</span>
          </div>
          <Switch checked={speedEnabled} onCheckedChange={setSpeedEnabled} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <span className="text-sm text-foreground">{tr.integrations.semantics}</span>
          </div>
          <Switch checked={semanticsEnabled} onCheckedChange={setSemanticsEnabled} />
        </div>
      </div>

      {/* Start analysis button */}
      <button
        onClick={handleSubmit}
        disabled={loading || !url.trim()}
        className="w-full h-14 rounded-2xl btn-gradient text-base font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> {tr.analyzing}</>
        ) : (
          <><Play className="w-5 h-5" /> {tr.startAnalysis}</>
        )}
      </button>
    </div>
  );
}
