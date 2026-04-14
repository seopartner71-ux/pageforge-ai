import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Zap, ArrowLeft, Eye, EyeOff } from 'lucide-react';

export default function AuthPage() {
  const { tr, lang } = useLang();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isRu = lang === 'ru';

  useEffect(() => {
    setIsLogin(searchParams.get('mode') !== 'signup');
  }, [searchParams]);

  // If already logged in, redirect
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
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({ title: isRu ? 'Проверьте email для подтверждения аккаунта.' : 'Check your email to confirm your account.' });
      }
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-10 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/5" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="relative">
          <Link to="/" className="inline-flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg gradient-text">PageForge AI</span>
          </Link>
        </div>
        <div className="relative space-y-4">
          <h2 className="text-3xl font-bold leading-tight">
            {isRu ? (
              <>Глубокий On-Page<br />SEO аудит<br /><span className="gradient-text">с ИИ-рекомендациями</span></>
            ) : (
              <>Deep On-Page<br />SEO Audit<br /><span className="gradient-text">with AI Recommendations</span></>
            )}
          </h2>
          <p className="text-muted-foreground text-sm max-w-sm">
            {isRu
              ? '12 модулей анализа · Сравнение с ТОП-10 · TF·IDF · GEO Score · Golden Source Blueprint'
              : '12 analysis modules · TOP-10 comparison · TF·IDF · GEO Score · Golden Source Blueprint'}
          </p>
        </div>
        <div className="relative text-xs text-muted-foreground">
          © {new Date().getFullYear()} PageForge AI
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <LangToggle />
        </div>

        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Link to="/" className="inline-flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg btn-gradient flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary-foreground" />
              </div>
              <span className="font-bold text-lg gradient-text">PageForge AI</span>
            </Link>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              {isLogin
                ? (isRu ? 'Добро пожаловать' : 'Welcome back')
                : (isRu ? 'Создать аккаунт' : 'Create account')}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isLogin
                ? (isRu ? 'Войдите в свой аккаунт PageForge AI' : 'Sign in to your PageForge AI account')
                : (isRu ? 'Зарегистрируйтесь для начала работы' : 'Sign up to get started')}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{tr.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                className="bg-secondary/50 border-border/50 focus:border-primary h-11"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">{tr.password}</label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="••••••••"
                  className="bg-secondary/50 border-border/50 focus:border-primary h-11 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-gradient border-0 h-11 text-sm font-semibold">
              {loading ? '...' : isLogin ? tr.login : tr.signup}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {isLogin ? tr.noAccount : tr.hasAccount}{' '}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline font-medium"
            >
              {isLogin ? tr.signup : tr.login}
            </button>
          </p>

          <div className="mt-8 text-center">
            <Link to="/" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-3 h-3" />
              {isRu ? 'На главную' : 'Back to home'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
