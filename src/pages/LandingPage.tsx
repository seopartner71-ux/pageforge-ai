import { useNavigate } from 'react-router-dom';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import {
  Zap, BarChart3, Search, FileText, Shield, Globe, Brain,
  ArrowRight, CheckCircle2, Layers, TrendingUp, Eye, Radar,
  FileSpreadsheet, Users, Lock
} from 'lucide-react';

const featuresRu = [
  { icon: BarChart3, title: 'TF·IDF анализ', desc: 'Сравнение плотности ключевых слов с медианой ТОП-10 конкурентов' },
  { icon: TrendingUp, title: 'Закон Ципфа', desc: 'Оценка естественности текста через частотное распределение слов' },
  { icon: Layers, title: 'N-граммы', desc: 'Биграммы и триграммы с визуализацией и сравнением с конкурентами' },
  { icon: Brain, title: 'Topical Gap', desc: 'Поиск пропущенных сущностей и тем по сравнению с лидерами выдачи' },
  { icon: Globe, title: 'GEO Score', desc: 'Готовность страницы к AI Overview и SGE — оценка по 9 критериям' },
  { icon: FileText, title: 'Golden Source Blueprint', desc: 'AI генерирует идеальную структуру страницы на основе ТОП-10' },
  { icon: Eye, title: 'Читабельность', desc: 'Flesch-Kincaid / Оборнева индексы, длина предложений, абзацев' },
  { icon: Search, title: 'SERP Preview', desc: 'Предпросмотр сниппета в Google: title, description, URL' },
  { icon: Shield, title: 'Schema Validator', desc: 'Проверка структурированных данных — Article, Product, FAQ, HowTo' },
  { icon: Radar, title: 'vs ТОП-10', desc: 'Радарная диаграмма и таблица сравнения метрик с конкурентами' },
  { icon: FileSpreadsheet, title: 'Excel & PDF экспорт', desc: 'Настраиваемый экспорт отчётов с выбором листов и колонок' },
  { icon: Lock, title: 'Stealth Engine', desc: 'Антидетект-оптимизация: рекомендации по снижению следов SEO' },
];

const featuresEn = [
  { icon: BarChart3, title: 'TF·IDF Analysis', desc: 'Keyword density comparison against TOP-10 competitor median' },
  { icon: TrendingUp, title: "Zipf's Law", desc: 'Text naturalness assessment via word frequency distribution' },
  { icon: Layers, title: 'N-grams', desc: 'Bigrams and trigrams with visualization and competitor comparison' },
  { icon: Brain, title: 'Topical Gap', desc: 'Find missing entities and topics compared to SERP leaders' },
  { icon: Globe, title: 'GEO Score', desc: 'Page readiness for AI Overview & SGE — 9-criteria score' },
  { icon: FileText, title: 'Golden Source Blueprint', desc: 'AI generates ideal page structure based on TOP-10' },
  { icon: Eye, title: 'Readability', desc: 'Flesch-Kincaid indices, sentence length, paragraph analysis' },
  { icon: Search, title: 'SERP Preview', desc: 'Google snippet preview: title, description, URL structure' },
  { icon: Shield, title: 'Schema Validator', desc: 'Structured data validation — Article, Product, FAQ, HowTo' },
  { icon: Radar, title: 'vs TOP-10', desc: 'Radar chart and comparison table of metrics vs competitors' },
  { icon: FileSpreadsheet, title: 'Excel & PDF Export', desc: 'Customizable report export with sheet and column selection' },
  { icon: Lock, title: 'Stealth Engine', desc: 'Anti-detect optimization: reduce SEO footprint recommendations' },
];

const statsRu = [
  { value: '12+', label: 'Модулей анализа' },
  { value: '5', label: 'Параллельных AI-потоков' },
  { value: 'ТОП-10', label: 'Бенчмарк конкурентов' },
  { value: '< 60с', label: 'Время полного аудита' },
];

const statsEn = [
  { value: '12+', label: 'Analysis Modules' },
  { value: '5', label: 'Parallel AI Streams' },
  { value: 'TOP-10', label: 'Competitor Benchmark' },
  { value: '< 60s', label: 'Full Audit Time' },
];

export default function LandingPage() {
  const { lang } = useLang();
  const navigate = useNavigate();
  const isRu = lang === 'ru';
  const features = isRu ? featuresRu : featuresEn;
  const stats = isRu ? statsRu : statsEn;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg gradient-text">PageForge AI</span>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')}>
              {isRu ? 'Войти' : 'Sign In'}
            </Button>
            <Button size="sm" className="btn-gradient border-0" onClick={() => navigate('/auth?mode=signup')}>
              {isRu ? 'Начать бесплатно' : 'Get Started'}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-32 pb-20 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px]" />
        </div>
        <div className="container relative text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border/50 bg-secondary/50 text-sm text-muted-foreground mb-8">
            <Zap className="w-3.5 h-3.5 text-primary" />
            {isRu ? 'On-Page SEO + GEO оптимизация' : 'On-Page SEO + GEO Optimization'}
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            {isRu ? (
              <>Глубокий аудит страницы<br /><span className="gradient-text">с ИИ-рекомендациями</span></>
            ) : (
              <>Deep Page Audit<br /><span className="gradient-text">with AI Recommendations</span></>
            )}
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            {isRu
              ? 'TF·IDF · Закон Ципфа · N-граммы · Topical Gap · GEO Score · Golden Source Blueprint — 12 модулей анализа через 5 параллельных AI-потоков'
              : "TF·IDF · Zipf's Law · N-grams · Topical Gap · GEO Score · Golden Source Blueprint — 12 analysis modules via 5 parallel AI streams"}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button size="lg" className="btn-gradient border-0 h-12 px-8 text-base" onClick={() => navigate('/auth?mode=signup')}>
              {isRu ? 'Попробовать бесплатно' : 'Try for Free'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-8 text-base" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              {isRu ? 'Узнать больше' : 'Learn More'}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-y border-border/30">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold gradient-text mb-1">{s.value}</div>
                <div className="text-sm text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="container">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold mb-3">
              {isRu ? 'Полный арсенал On-Page SEO' : 'Complete On-Page SEO Arsenal'}
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              {isRu
                ? 'Каждый модуль сравнивает вашу страницу с ТОП-10 конкурентов и даёт конкретные рекомендации'
                : 'Every module compares your page against TOP-10 competitors and provides actionable recommendations'}
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div key={i} className="glass-card p-6 hover:border-primary/30 transition-colors group">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 border-t border-border/30">
        <div className="container max-w-3xl">
          <h2 className="text-3xl font-bold text-center mb-14">
            {isRu ? 'Как это работает' : 'How It Works'}
          </h2>
          <div className="space-y-8">
            {(isRu
              ? [
                  { step: '01', title: 'Введите URL', desc: 'Укажите страницу для анализа и выберите тип контента' },
                  { step: '02', title: 'Конкуренты найдены', desc: 'Система автоматически находит ТОП-10 через SERP API или вы добавляете вручную' },
                  { step: '03', title: 'AI-анализ', desc: '5 параллельных модулей анализируют контент, структуру и техническую оптимизацию' },
                  { step: '04', title: 'Отчёт готов', desc: 'Получите детальный отчёт со скорами, рекомендациями и экспортом в Excel/PDF' },
                ]
              : [
                  { step: '01', title: 'Enter URL', desc: 'Specify the page to analyze and select content type' },
                  { step: '02', title: 'Competitors Found', desc: 'System auto-finds TOP-10 via SERP API or you add manually' },
                  { step: '03', title: 'AI Analysis', desc: '5 parallel modules analyze content, structure and technical optimization' },
                  { step: '04', title: 'Report Ready', desc: 'Get a detailed report with scores, recommendations and Excel/PDF export' },
                ]
            ).map((item) => (
              <div key={item.step} className="flex gap-5 items-start">
                <div className="shrink-0 w-12 h-12 rounded-xl btn-gradient flex items-center justify-center text-sm font-bold text-primary-foreground">
                  {item.step}
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="glass-card p-12 text-center max-w-2xl mx-auto glow-effect">
            <h2 className="text-2xl font-bold mb-3">
              {isRu ? 'Готовы к аудиту?' : 'Ready for an Audit?'}
            </h2>
            <p className="text-muted-foreground mb-8">
              {isRu
                ? 'Зарегистрируйтесь и запустите первый анализ за 60 секунд'
                : 'Sign up and launch your first analysis in 60 seconds'}
            </p>
            <Button size="lg" className="btn-gradient border-0 h-12 px-8 text-base" onClick={() => navigate('/auth?mode=signup')}>
              {isRu ? 'Начать бесплатно' : 'Get Started Free'}
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border/30">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span>PageForge AI</span>
          </div>
          <span>© {new Date().getFullYear()}</span>
        </div>
      </footer>
    </div>
  );
}
