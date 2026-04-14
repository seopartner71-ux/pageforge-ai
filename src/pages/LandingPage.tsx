import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import {
  Zap, ArrowRight, BarChart3, Globe, FileText, Layers,
  Check, ChevronDown, ChevronUp
} from 'lucide-react';

/* ──────────────────── Intersection Observer hook ──────────────────── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); } }, { threshold });
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/* ──────────────────── Animated counter ──────────────────── */
function AnimatedGauge({ value, label, delay = 0 }: { value: number; label: string; delay?: number }) {
  const [current, setCurrent] = useState(0);
  const { ref, visible } = useInView(0.3);

  useEffect(() => {
    if (!visible) return;
    const timeout = setTimeout(() => {
      let start = 0;
      const step = () => {
        start += Math.ceil(value / 40);
        if (start >= value) { setCurrent(value); return; }
        setCurrent(start);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, delay);
    return () => clearTimeout(timeout);
  }, [visible, value, delay]);

  const r = 54, c = 2 * Math.PI * r;
  const offset = c - (current / 100) * c;

  return (
    <div ref={ref} className="flex flex-col items-center gap-3">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--border))" strokeWidth="6" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke="hsl(var(--primary))" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl font-bold text-foreground">{current}%</span>
        </div>
      </div>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

/* ──────────────────── FAQ Accordion ──────────────────── */
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 text-left group">
        <span className="font-medium text-foreground pr-4 group-hover:text-primary transition-colors">{q}</span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
      </button>
      {open && <p className="pb-5 text-sm text-muted-foreground leading-relaxed">{a}</p>}
    </div>
  );
}

/* ──────────────────── Section wrapper ──────────────────── */
function Section({ children, className = '', id }: { children: React.ReactNode; className?: string; id?: string }) {
  const { ref, visible } = useInView();
  return (
    <section id={id} ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}>
      {children}
    </section>
  );
}

/* ──────────────────── LANDING ──────────────────── */
export default function LandingPage() {
  const { lang, tr } = useLang();
  const navigate = useNavigate();
  const l = tr.landing;

  const featureCards = [
    { icon: BarChart3, title: l.features.tfidf, desc: l.features.tfidfDesc },
    { icon: Globe, title: l.features.geo, desc: l.features.geoDesc },
    { icon: FileText, title: l.features.blueprint, desc: l.features.blueprintDesc },
    { icon: Layers, title: l.features.modules, desc: l.features.modulesDesc },
  ];

  const plans = [
    {
      name: l.pricing.starter,
      price: l.pricing.starterPrice,
      period: l.pricing.starterPeriod,
      feature: l.pricing.starterFeature,
      items: l.pricing.features,
      popular: false,
    },
    {
      name: l.pricing.pro,
      price: l.pricing.proPrice,
      period: l.pricing.proPeriod,
      feature: l.pricing.proFeature,
      items: [...l.pricing.features, ...l.pricing.proExtra],
      popular: true,
      badge: l.pricing.proBadge,
    },
    {
      name: l.pricing.agency,
      price: l.pricing.agencyPrice,
      period: l.pricing.agencyPeriod,
      feature: l.pricing.agencyFeature,
      items: [...l.pricing.features, ...l.pricing.agencyExtra],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* ── NAV ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <div className="container flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground tracking-tight">SEO-Аудит</span>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate('/auth')} className="text-muted-foreground hover:text-foreground text-sm">
              {tr.login}
            </Button>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 text-sm" onClick={() => navigate('/auth?mode=signup')}>
              {l.ctaStart} <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 relative">
        <div className="container relative text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md border border-border/60 bg-secondary text-xs text-muted-foreground mb-8">
            <Zap className="w-3 h-3 text-primary" />
            {l.heroSubtitle}
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] mb-6 text-foreground">
            {lang === 'ru' ? 'Полный SEO-аудит' : 'Complete SEO audit'}
            <br />
            <span className="text-primary">{lang === 'ru' ? 'за 30 секунд' : 'in 30 seconds'}</span>
          </h1>

          <p className="text-base text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed">
            {l.heroDesc}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground border-0 h-12 px-8 text-sm font-semibold" onClick={() => navigate('/auth?mode=signup')}>
              {l.ctaStart} <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
            <Button variant="outline" size="lg" className="h-12 px-6 text-sm border-border/80 hover:border-primary/40 hover:bg-primary/5" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>
              {l.ctaLearn}
            </Button>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <Section id="features" className="py-24">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">{l.features.title}</h2>
            <p className="text-muted-foreground max-w-lg mx-auto">{l.features.subtitle}</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {featureCards.map((f, i) => (
              <div key={i} className="glass-card-hover p-6 group">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary/20 transition-colors">
                  <f.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── METRICS ── */}
      <Section className="py-24 border-t border-border/20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">{l.metrics.title}</h2>
            <p className="text-muted-foreground">{l.metrics.subtitle}</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
            <AnimatedGauge value={87} label={l.metrics.seoHealth} delay={0} />
            <AnimatedGauge value={72} label={l.metrics.llm} delay={200} />
            <AnimatedGauge value={94} label={l.metrics.humanness} delay={400} />
            <AnimatedGauge value={68} label={l.metrics.sge} delay={600} />
          </div>
        </div>
      </Section>

      {/* ── PRICING ── */}
      <Section className="py-24 border-t border-border/20">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-foreground">{l.pricing.title}</h2>
            <p className="text-muted-foreground">{l.pricing.subtitle}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {plans.map((plan) => (
              <div key={plan.name} className={`glass-card p-7 relative flex flex-col ${plan.popular ? 'border-primary/40' : ''}`}>
                {plan.popular && plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold">
                    {plan.badge}
                  </div>
                )}
                <div className="mb-6">
                  <div className="text-xs font-semibold tracking-wider text-muted-foreground mb-3">{plan.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">{plan.price}</span>
                    <span className="text-muted-foreground text-sm">{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.feature}</p>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  className={`w-full h-11 ${plan.popular ? 'btn-gradient border-0' : 'border-border/40 hover:border-primary/40 hover:bg-primary/5'}`}
                  variant={plan.popular ? 'default' : 'outline'}
                  onClick={() => navigate('/auth?mode=signup')}
                >
                  {l.pricing.chooseBtn}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* ── FAQ ── */}
      <Section className="py-24 border-t border-border/20">
        <div className="container max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-center mb-12 text-foreground">{l.faq.title}</h2>
          <div>
            {l.faq.items.map((item, i) => (
              <FaqItem key={i} q={item.q} a={item.a} />
            ))}
          </div>
        </div>
      </Section>

      {/* ── CTA ── */}
      <Section className="py-24">
        <div className="container">
          <div className="glass-card p-14 text-center max-w-2xl mx-auto relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-accent/[0.04]" />
            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-foreground">
                {lang === 'ru' ? 'Готовы к аудиту?' : 'Ready for an audit?'}
              </h2>
              <p className="text-muted-foreground mb-8">
                {lang === 'ru' ? '3 бесплатных анализа. Без привязки карты.' : '3 free analyses. No credit card required.'}
              </p>
              <Button size="lg" className="btn-gradient border-0 h-13 px-10 text-base font-semibold" onClick={() => navigate('/auth?mode=signup')}>
                {l.ctaStart} <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </Section>

      {/* ── FOOTER ── */}
      <footer className="py-10 border-t border-border/20">
        <div className="container">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span>{l.footer.company}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link to="/privacy" className="hover:text-foreground transition-colors">{l.footer.privacy}</Link>
              <Link to="/terms" className="hover:text-foreground transition-colors">{l.footer.terms}</Link>
              <span>© {new Date().getFullYear()}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
