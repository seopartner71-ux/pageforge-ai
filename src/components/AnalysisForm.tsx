import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Home, ShoppingBag, Wrench, FileText, ShoppingCart, Target,
  X, Search, Play, Loader2, Check, MapPin, Plus, Layers,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const pageTypeIcons = [
  { key: 'homepage', icon: Home },
  { key: 'category', icon: ShoppingBag },
  { key: 'service', icon: Wrench },
  { key: 'article', icon: FileText },
  { key: 'product', icon: ShoppingCart },
  { key: 'landing', icon: Target },
] as const;

const REGIONS = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград',
  'Краснодар', 'Тюмень', 'Саратов', 'Тула', 'Ижевск',
  'Барнаул', 'Иркутск', 'Хабаровск', 'Владивосток', 'Ярославль',
  'Махачкала', 'Томск', 'Оренбург', 'Кемерово', 'Рязань',
];

export interface AnalysisFormData {
  url: string;
  urls?: string[];
  pageType: string;
  competitors: string[];
  aiContext: string;
  clusterMode: boolean;
  projectId?: string;
  region: string;
  batchMode?: boolean;
}

interface AnalysisFormProps {
  onStartAnalysis: (data: AnalysisFormData) => void;
  loading: boolean;
  projects?: { id?: string; name: string; domain: string }[];
  onNewProject?: () => void;
  credits?: number | null;
}

export function AnalysisForm({ onStartAnalysis, loading, projects = [], onNewProject, credits }: AnalysisFormProps) {
  const { tr, lang } = useLang();
  const { toast } = useToast();
  const [url, setUrl] = useState('');
  const [batchMode, setBatchMode] = useState(false);
  const [batchUrls, setBatchUrls] = useState<string[]>(['', '']);
  const [pageType, setPageType] = useState('');
  const [competitors, setCompetitors] = useState(['']);
  const [aiContext, setAiContext] = useState('');
  const [clusterMode, setClusterMode] = useState(false);
  const [speedEnabled, setSpeedEnabled] = useState(true);
  const [semanticsEnabled, setSemanticsEnabled] = useState(true);
  const [selectedProjectIdx, setSelectedProjectIdx] = useState(0);
  const [findingCompetitors, setFindingCompetitors] = useState(false);
  const [findSuccess, setFindSuccess] = useState(false);
  const [region, setRegion] = useState('');
  const [regionSearch, setRegionSearch] = useState('');
  const [regionOpen, setRegionOpen] = useState(false);

  const isRu = lang === 'ru';

  const filteredRegions = regionSearch
    ? REGIONS.filter(r => r.toLowerCase().includes(regionSearch.toLowerCase()))
    : REGIONS;

  const addCompetitor = () => {
    if (competitors.length < 10) setCompetitors([...competitors, '']);
  };

  const removeCompetitor = (index: number) => {
    setCompetitors(competitors.filter((_, i) => i !== index));
  };

  const updateCompetitor = (index: number, value: string) => {
    const updated = [...competitors];
    updated[index] = value;
    setCompetitors(updated);
  };

  const addBatchUrl = () => {
    if (batchUrls.length < 5) setBatchUrls([...batchUrls, '']);
  };

  const removeBatchUrl = (index: number) => {
    if (batchUrls.length > 2) setBatchUrls(batchUrls.filter((_, i) => i !== index));
  };

  const updateBatchUrl = (index: number, value: string) => {
    const updated = [...batchUrls];
    updated[index] = value;
    setBatchUrls(updated);
  };

  const validBatchUrls = batchUrls.filter(u => u.trim());
  const requiredCredits = batchMode ? validBatchUrls.length : 1;
  const hasEnoughCredits = credits === null || credits === undefined || credits >= requiredCredits;

  const handleAutoFind = async () => {
    const targetUrl = batchMode ? validBatchUrls[0] : url.trim();
    if (!targetUrl) {
      toast({ title: 'Сначала введите URL страницы', variant: 'destructive' });
      return;
    }
    if (!region.trim()) {
      toast({ title: 'Выберите регион для точного анализа', variant: 'destructive' });
      return;
    }
    setFindingCompetitors(true);
    setFindSuccess(false);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/find-competitors`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ url: targetUrl, region: region.trim() }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Error ${res.status}`);
      }
      const data = await res.json();
      const found: string[] = (data.competitors || []).map((c: any) => c.url).slice(0, 10);
      if (found.length === 0) {
        toast({ title: 'Конкуренты не найдены', variant: 'destructive' });
      } else {
        setCompetitors(found);
        setFindSuccess(true);
        setTimeout(() => setFindSuccess(false), 2000);
        toast({ title: `Найдено ${found.length} конкурентов` });
      }
    } catch (err: any) {
      toast({ title: err.message || 'Ошибка поиска конкурентов', variant: 'destructive' });
    } finally {
      setFindingCompetitors(false);
    }
  };

  const handleSubmit = () => {
    if (batchMode) {
      if (validBatchUrls.length < 2) {
        toast({ title: isRu ? 'Введите минимум 2 URL' : 'Enter at least 2 URLs', variant: 'destructive' });
        return;
      }
      if (!hasEnoughCredits) {
        toast({ title: isRu ? 'Недостаточно кредитов' : 'Not enough credits', variant: 'destructive' });
        return;
      }
      onStartAnalysis({
        url: validBatchUrls[0],
        urls: validBatchUrls,
        pageType,
        competitors: competitors.filter(c => c.trim()),
        aiContext,
        clusterMode,
        projectId: projects[selectedProjectIdx]?.id,
        region: region.trim(),
        batchMode: true,
      });
    } else {
      if (!url.trim()) return;
      onStartAnalysis({
        url: url.trim(),
        pageType,
        competitors: competitors.filter(c => c.trim()),
        aiContext,
        clusterMode,
        projectId: projects[selectedProjectIdx]?.id,
        region: region.trim(),
      });
    }
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
          <div className="flex items-center gap-4">
            {/* Batch mode toggle */}
            <div className="flex items-center gap-2">
              <Layers className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground font-medium">
                {isRu ? 'Пакетный (1-5)' : 'Batch (1-5)'}
              </span>
              <Switch checked={batchMode} onCheckedChange={setBatchMode} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground font-medium">● {tr.pageSection.clusterToggle}</span>
              <Switch checked={clusterMode} onCheckedChange={setClusterMode} />
            </div>
          </div>
        </div>

        {batchMode ? (
          <div className="space-y-3">
            <label className="text-sm text-muted-foreground mb-2 block">
              {isRu ? 'URL страниц для анализа (2-5 штук)' : 'Page URLs for analysis (2-5)'}
            </label>
            {batchUrls.map((bu, i) => (
              <div key={i} className="flex gap-2 items-center">
                <span className="text-xs text-muted-foreground w-5 text-center font-mono">{i + 1}</span>
                <Input
                  type="url"
                  value={bu}
                  onChange={(e) => updateBatchUrl(i, e.target.value)}
                  placeholder={`https://example.com/page-${i + 1}`}
                  className="h-11 bg-secondary border-border/50 focus:border-primary flex-1"
                />
                {batchUrls.length > 2 && (
                  <button onClick={() => removeBatchUrl(i)} className="w-9 h-9 rounded-lg border border-border/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
            {batchUrls.length < 5 && (
              <button
                onClick={addBatchUrl}
                className="w-full h-9 rounded-lg border border-dashed border-border/50 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {isRu ? 'Добавить URL' : 'Add URL'}
              </button>
            )}
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>💡</span>
              <span>{isRu
                ? `Будет создано ${validBatchUrls.length} анализов → списание ${validBatchUrls.length} кредитов. Результаты объединятся в сводный отчёт.`
                : `${validBatchUrls.length} analyses → ${validBatchUrls.length} credits. Results merged into a comparison report.`
              }</span>
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm text-muted-foreground mb-2 block">{tr.pageSection.urlLabel}</label>
            <Input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={tr.pageSection.urlPlaceholder}
              className="h-11 bg-secondary border-border/50 focus:border-primary"
              data-tour="seo-url"
            />
          </div>
        )}

        {/* Region selector */}
        <div className="relative">
          <label className="text-sm text-muted-foreground mb-2 block flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Регион поиска
          </label>
          <Input
            value={region}
            onChange={(e) => { setRegion(e.target.value); setRegionSearch(e.target.value); setRegionOpen(true); }}
            onFocus={() => setRegionOpen(true)}
            onBlur={() => setTimeout(() => setRegionOpen(false), 150)}
            placeholder="Выберите город или введите вручную"
            className="h-11 bg-secondary border-border/50 focus:border-primary"
          />
          {regionOpen && filteredRegions.length > 0 && (
            <div className="absolute z-50 top-full mt-1 w-full max-h-48 overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
              {filteredRegions.map(r => (
                <button
                  key={r}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setRegion(r); setRegionOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-secondary transition-colors"
                >
                  {r}
                </button>
              ))}
            </div>
          )}
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

        <button
          onClick={handleAutoFind}
          disabled={findingCompetitors || (batchMode ? validBatchUrls.length === 0 : !url.trim())}
          className="w-full h-12 rounded-lg border border-border/50 bg-secondary/50 text-sm font-medium text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {findingCompetitors ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Ищем конкурентов…</>
          ) : findSuccess ? (
            <><Check className="w-4 h-4 text-green-500" /> Найдено!</>
          ) : (
            <><Search className="w-4 h-4" /> {tr.competitors.autoFind}</>
          )}
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

      {/* Credits info */}
      {credits !== null && credits !== undefined && (
        <div className={`glass-card p-4 flex items-center justify-between ${!hasEnoughCredits ? 'border border-destructive/30' : ''}`}>
          <span className="text-sm text-muted-foreground">
            {isRu ? 'Остаток кредитов:' : 'Credits remaining:'}
          </span>
          <div className="flex items-center gap-3">
            {batchMode && validBatchUrls.length > 1 && (
              <span className="text-xs text-muted-foreground">
                {isRu ? `Нужно: ${requiredCredits}` : `Required: ${requiredCredits}`}
              </span>
            )}
            <span className={`text-lg font-bold ${!hasEnoughCredits ? 'text-destructive' : 'text-accent'}`}>{credits}</span>
          </div>
        </div>
      )}

      {/* Start analysis button */}
      <button
        onClick={handleSubmit}
        disabled={loading || (!batchMode && !url.trim()) || (batchMode && validBatchUrls.length < 2) || !hasEnoughCredits}
        className="w-full h-14 rounded-2xl btn-gradient text-base font-semibold flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {!hasEnoughCredits ? (
          <>🚫 {isRu ? 'Недостаточно кредитов' : 'Not enough credits'}</>
        ) : loading ? (
          <><Loader2 className="w-5 h-5 animate-spin" /> {tr.analyzing}</>
        ) : batchMode ? (
          <><Layers className="w-5 h-5" /> {isRu ? `Анализ ${validBatchUrls.length} страниц` : `Analyze ${validBatchUrls.length} pages`}</>
        ) : (
          <><Play className="w-5 h-5" /> {tr.startAnalysis}</>
        )}
      </button>
    </div>
  );
}
