import { LangToggle } from '@/components/LangToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NotificationBell } from '@/components/NotificationBell';
import { SidebarTrigger } from '@/components/ui/sidebar';

export function AppHeader() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <header className="border-b border-border/80 bg-card sticky top-0 z-40">
      <div className="flex items-center h-12 px-4 gap-3">
        <SidebarTrigger className="shrink-0" />
        <div className="flex-1" />
        <div className="flex items-center gap-2 shrink-0">
          <NotificationBell />
          <ThemeToggle />
          <LangToggle />
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-muted-foreground hover:text-foreground"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}