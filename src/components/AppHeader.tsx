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
    { label: 'GEO Audit', path: '/geo-audit' },
    { label: 'Ссылочный аудит', path: '/link-audit' },
    { label: tr.nav.history, path: '/history' },
    { label: tr.nav.account, path: '/account' },
    { label: tr.nav.pdfEditor, path: '/pdf-editor' },
    ...(isAdmin ? [{ label: '⚙ Админ', path: '/admin' }] : []),
  ];

  return (
    <header className="border-b border-border/80 bg-card sticky top-0 z-50">
      <div className="container flex items-center h-12">
        {/* Left: Logo */}
        <div className="flex items-center gap-2 shrink-0 mr-6">
          <div className="flex items-center gap-2 cursor-pointer shrink-0" onClick={() => navigate('/dashboard')}>
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <Zap className="w-3 h-3 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm text-foreground whitespace-nowrap">{tr.appName}</span>
          </div>
        </div>

        {/* Center: Navigation */}
        <nav className="hidden md:flex items-center justify-center gap-1 flex-1">
          {navItems.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`px-3 py-1.5 text-[13px] rounded-md whitespace-nowrap transition-colors ${
                location.pathname === item.path
                  ? 'font-medium text-foreground bg-secondary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
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
