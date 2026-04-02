import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Zap } from 'lucide-react';

export default function AuthPage() {
  const { tr } = useLang();
  const { toast } = useToast();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast({ title: 'Check your email to confirm your account.' });
      }
    } catch (err: any) {
      toast({ title: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl btn-gradient flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">{tr.appName}</h1>
          </div>
          <p className="text-muted-foreground text-sm">{tr.tagline}</p>
        </div>

        <div className="glass-card p-8">
          <h2 className="text-xl font-semibold text-foreground mb-6">
            {isLogin ? tr.login : tr.signup}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">{tr.email}</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-secondary border-border/50 focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1.5 block">{tr.password}</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="bg-secondary border-border/50 focus:border-primary"
              />
            </div>
            <Button type="submit" disabled={loading} className="w-full btn-gradient border-0 h-11">
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
        </div>
      </div>
    </div>
  );
}
