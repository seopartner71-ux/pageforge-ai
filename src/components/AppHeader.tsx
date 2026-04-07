import { useLang } from '@/contexts/LangContext';
import { LangToggle } from '@/components/LangToggle';
import { Button } from '@/components/ui/button';
import { Zap, LogOut, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { NavLink } from '@/components/NavLink';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAdminRole } from '@/hooks/useAdminRole';
import { NotificationBell } from '@/components/NotificationBell';

export function AppHeader() {
  const { tr } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useAdminRole();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navItems = [
    { label: tr.nav.analysis, path: '/dashboard' },
    { label: tr.nav.history, path: '/history' },
    { label: tr.nav.account, path: '/account' },
    { label: tr.nav.pdfEditor, path: '/pdf-editor' },
    ...(isAdmin ? [{ label: '⚙ Админ', path: '/admin' }] : []),
  ];

  return (
    <header className="border-b border-border/50 bg-card/50 backdrop-blur-xl sticky top-0 z-50">
      <div className="container flex items-center h-14">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 shrink-0 mr-6">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/dashboard')}>
            <div className="w-7 h-7 rounded-lg btn-gradient flex items-center justify-center">
              <Zap className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold gradient-text whitespace-nowrap">{tr.appName}</span>
            <span className="text-xs text-muted-foreground hidden lg:inline whitespace-nowrap">{tr.subtitle}</span>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center justify-center gap-6 flex-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`text-sm whitespace-nowrap transition-colors ${
                location.pathname === item.path
                  ? 'font-medium text-foreground border-b-2 border-primary pb-0.5'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Right: Lang + Logout */}
        <div className="flex items-center justify-end gap-3 shrink-0 ml-6">
          <NotificationBell />
          <LangToggle />
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
