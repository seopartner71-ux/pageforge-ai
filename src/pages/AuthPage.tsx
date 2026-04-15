import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';

/* ── Animated demo metrics for left panel ── */
function DemoMetrics() {
  const { tr } = useLang();
  const d = tr.auth.demoMetrics;
  const metrics = [
    { label: d.seoScore, value: 87, color: 'hsl(217, 91%, 60%)' },
    { label: d.geoScore, value: 72, color: 'hsl(263, 70%, 58%)' },
    { label: d.readability, value: 94, color: 'hsl(152, 69%, 45%)' },
    { label: d.keywords, value: 156, color: 'hsl(217, 91%, 60%)', isCount: true },
  ];

  return (
    <div className="space-y-6 w-full max-w-xs">
      {metrics.map((m, i) => (
        <div key={i} className="glass-card p-4 animate-float" style={{ animationDelay: `${i * 0.8}s` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
            <span className="text-sm font-bold text-foreground">
              {m.isCount ? m.value : `${m.value}%`}
            </span>
          </div>
          {!m.isCount && (
            <div className="h-1.5 rounded-full bg-border/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${m.value}%`, background: m.color }}
              />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ── AUTH PAGE ── */
export default function AuthPage() {
  const { tr, lang } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const a = tr.auth;

  useEffect(() => {
    setIsLogin(searchParams.get('mode') !== 'signup');
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate('/dashboard', { replace: true });
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/dashboard');
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name },
            emailRedirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        toast({
          title: lang === 'ru'
            ? 'Проверьте email для подтверждения аккаунта.'
            : 'Check your email to confirm your account.',
        });
      }
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left — branding + demo */}
      <div className="hidden lg:flex flex-col justify-between w-[45%] p-10 relative overflow-hidden border-r border-border/80">
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">SEO-Аудит</span>
          </Link>
        </div>

        <div className="relative flex flex-col items-center gap-10">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">
              {lang === 'ru' ? 'SEO-аудит нового поколения' : 'Next-gen SEO audit'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              {lang === 'ru'
                ? '20+ модулей анализа · Сравнение с ТОП-10 · GEO Score'
                : '20+ analysis modules · TOP-10 comparison · GEO Score'}
            </p>
          </div>
          <DemoMetrics />
        </div>

        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} SEO-Аудит
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 relative">
        <div className="absolute top-5 right-5 flex items-center gap-2">
          <LangToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-10">
            <Link to="/">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                  <Zap className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-semibold text-foreground tracking-tight">SEO-Аудит</span>
              </div>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isLogin ? a.signInTitle : a.signUpTitle}
            </h1>
            {!isLogin && (
              <p className="text-sm text-muted-foreground">{a.signUpSubtitle}</p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">{a.name}</label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={a.namePlaceholder}
                  className="bg-secondary/40 border-border/40 focus:border-primary h-11"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{tr.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={a.emailPlaceholder}
                className="bg-secondary/40 border-border/40 focus:border-primary h-11"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-foreground">{tr.password}</label>
                {isLogin && (
                  <button type="button" className="text-xs text-primary hover:underline">
                    {a.forgotPassword}
                  </button>
                )}
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder={a.passwordPlaceholder}
                  className="bg-secondary/40 border-border/40 focus:border-primary h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground border-0 h-11 text-sm font-semibold mt-2">
              {loading ? '...' : isLogin ? a.signInBtn : a.signUpBtn}
            </Button>
          </form>

          {!isLogin && (
            <p className="text-xs text-muted-foreground mt-4 text-center">
              {a.privacyNote}{' '}
              <Link to="/privacy" className="text-primary hover:underline">{a.privacyLink}</Link>
              {' '}{a.and}{' '}
              <Link to="/terms" className="text-primary hover:underline">{a.termsLink}</Link>
            </p>
          )}

          <div className="text-center mt-6">
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-sm text-primary hover:underline font-medium"
            >
              {isLogin ? a.noAccountLink : a.hasAccountLink}
            </button>
          </div>

          <div className="mt-8 text-center">
            <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" />
              {a.backHome}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
