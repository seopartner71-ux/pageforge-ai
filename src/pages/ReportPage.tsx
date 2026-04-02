import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { ScoreGauge } from '@/components/ScoreGauge';
import { ReportTabs } from '@/components/ReportTabs';
import { ReportSidebar } from '@/components/ReportSidebar';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Zap, LogOut, Code, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ReportPageProps {
  url: string;
  onBack: () => void;
}

const scoresRu = [
  { score: 48, label: 'SEO HEALTH', description: 'Страница имеет хорош...', color: 'hsl(25, 95%, 53%)' },
  { score: 60, label: 'LLM-FRIENDLY', description: 'Наличие большого кол...', color: 'hsl(210, 100%, 52%)' },
  { score: 65, label: 'HUMAN TOUCH', description: 'На странице упомина...', color: 'hsl(142, 71%, 45%)' },
  { score: 55, label: 'SGE ADAPT', description: 'Страница имеет потен...', color: 'hsl(280, 67%, 55%)' },
];

const modulesRu = [
  { name: 'Go Parser', time: '2.1s', done: true },
  { name: 'Код-аналитика', time: '8.4s', done: true },
  { name: 'Semantic Relevance', time: '8.3s', done: true },
  { name: 'Topical Authority', time: '11.2s', done: true },
  { name: 'LLM Readiness', time: '6.7s', done: true },
  { name: 'Content Recs', time: '9.1s', done: true },
  { name: 'Technical Fixes', time: '5.8s', done: true },
];

const quickWinsRu = [
  { text: 'Внедрить семантические теги <main> и <section> для улучшения структуры.' },
  { text: 'Прописать осмысленные alt-тексты для всех 18 изображений.' },
  { text: 'Заполнить и внедрить OpenGraph теги (og:title, og:description, og:image).' },
  { text: 'Внедрить микроразметку Schema.org для LocalBusiness и Service.' },
  { text: 'Переписать Title и Description, добавив УТП и гео-привязку.' },
  { text: 'Разместить на видном месте номера телефонов и CTA-кнопку «Рассчитать стоимость».' },
];

export default function ReportPage({ url, onBack }: ReportPageProps) {
  const { tr, lang } = useLang();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center">
                <Zap className="w-3.5 h-3.5" />
              </div>
              <span className="font-bold gradient-text">{tr.appName}</span>
              <span className="text-xs text-muted-foreground hidden sm:inline">{tr.subtitle}</span>
            </div>
            <nav className="hidden md:flex items-center gap-6">
              <a href="#" className="text-sm font-medium text-foreground border-b-2 border-primary pb-0.5">{tr.nav.analysis}</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.history}</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.account}</a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{tr.nav.pdfEditor}</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {/* Back button */}
        <Button variant="outline" size="sm" onClick={onBack} className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          {lang === 'ru' ? '← Назад' : '← Back'}
        </Button>

        {/* URL bar */}
        <div className="flex items-center justify-between glass-card px-6 py-3">
          <div className="flex items-center gap-3">
            <span className="font-bold text-sm gradient-text">{tr.appName}</span>
            <span className="text-sm text-muted-foreground">{url}</span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-secondary text-muted-foreground">
              {lang === 'ru' ? 'Анализ' : 'Analysis'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="text-xs gap-1.5">
              <Code className="w-3 h-3" />
              {lang === 'ru' ? 'Посмотреть JSON' : 'View JSON'}
            </Button>
            <Button size="sm" className="btn-gradient border-0 text-xs gap-1.5" onClick={onBack}>
              <Plus className="w-3 h-3" />
              {lang === 'ru' ? '+ Новый анализ' : '+ New Analysis'}
            </Button>
          </div>
        </div>

        {/* Score cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {scoresRu.map((s, i) => (
            <ScoreGauge key={i} {...s} />
          ))}
        </div>

        {/* Content + sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          <div>
            <ReportTabs />
          </div>
          <div className="hidden lg:block">
            <div className="sticky top-20">
              <ReportSidebar
                modules={modulesRu}
                quickWins={quickWinsRu}
                modulesTitle={lang === 'ru' ? 'СТАТУС МОДУЛЕЙ' : 'MODULE STATUS'}
                readyLabel={lang === 'ru' ? 'ГОТОВО' : 'READY'}
                quickWinsTitle="QUICK WINS"
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
