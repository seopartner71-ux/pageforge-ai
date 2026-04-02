import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Clock, LogOut } from 'lucide-react';

export function PendingApprovalScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-slide-up">
        <div className="glass-card p-10 space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Доступ ограничен</h1>
          <p className="text-muted-foreground leading-relaxed">
            Ваш аккаунт ожидает активации. Администратор проверит ваши данные и откроет доступ в течение 24 часов.
          </p>
          <Button
            variant="outline"
            onClick={() => supabase.auth.signOut()}
            className="gap-2"
          >
            <LogOut className="w-4 h-4" />
            Выйти
          </Button>
        </div>
      </div>
    </div>
  );
}
