import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutGrid, Search, Sparkles, Link2, Users, BarChart3, Target,
  Code2, History as HistoryIcon, Zap, Smartphone, Network, FileText,
  PenSquare, User, Settings, Bot, ShieldAlert, Gauge, LifeBuoy, Radar, Mic, FolderKanban,
  ChevronDown, BarChart2,
  Megaphone, LayoutDashboard, Briefcase, Rocket, MessageSquare, FileBarChart, Wand2, ShieldCheck,
  UserCircle2, UsersRound, CreditCard, LogOut, ChevronsUpDown,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useStaffRole } from '@/hooks/useStaffRole';

type Item = { label: string; path: string; icon: any };
type Group = { label: string; items: Item[] };

// Префетч чанков: при наведении на пункт меню начинаем грузить код страницы,
// чтобы при клике переход был мгновенным.
const PREFETCH: Record<string, () => Promise<unknown>> = {
  '/tools': () => import('@/pages/ToolsHubPage'),
  '/dashboard': () => import('@/pages/DashboardPage'),
  '/geo-audit': () => import('@/pages/GeoAuditPage'),
  '/eeat-audit': () => import('@/pages/EeatAuditPage'),
  '/schema-audit': () => import('@/pages/SchemaAuditPage'),
  '/link-audit': () => import('@/pages/LinkAuditPage'),
  '/link-profile': () => import('@/pages/LinkProfilePage'),
  '/pagespeed': () => import('@/pages/PageSpeedPage'),
  '/responsive': () => import('@/pages/ResponsivePage'),
  '/technical-audit': () => import('@/pages/TechnicalAuditPage'),
  '/yandex-webmaster': () => import('@/pages/YandexWebmasterPage'),
  '/serp-history': () => import('@/pages/SerpHistoryPage'),
  '/competitors': () => import('@/pages/CompetitorsPage'),
  '/top-analysis': () => import('@/pages/TopAnalysisPage'),
  '/semantic-core': () => import('@/pages/SemanticCorePage'),
  '/blog-topics': () => import('@/pages/BlogTopicsPage'),
  '/intent': () => import('@/pages/IntentPage'),
  '/history': () => import('@/pages/HistoryPage'),
  '/account': () => import('@/pages/AccountPage'),
  '/admin': () => import('@/pages/AdminPage'),
  '/staff-hub': () => import('@/pages/StaffHubPage'),
  '/ai-visibility': () => import('@/pages/AiVisibilityPage'),
  '/alice-visibility': () => import('@/pages/AliceVisibilityPage'),
  '/projects': () => import('@/pages/ProjectsPage'),
  '/seo': () => import('@/pages/SeoDashboardPage'),
};
const prefetched = new Set<string>();
function prefetch(path: string) {
  if (prefetched.has(path)) return;
  const fn = PREFETCH[path];
  if (!fn) return;
  prefetched.add(path);
  fn().catch(() => prefetched.delete(path));
}

const MAIN_ITEMS: Item[] = [
  { label: 'Все инструменты', path: '/tools', icon: LayoutGrid },
  { label: 'Проекты', path: '/projects', icon: FolderKanban },
];

const SEO_ITEMS: Item[] = [
  { label: 'SEO Audit', path: '/dashboard', icon: Search },
  { label: 'GEO Audit', path: '/geo-audit', icon: Sparkles },
  { label: 'Видимость в ИИ ответах', path: '/ai-visibility', icon: Radar },
  { label: 'Видимость в ответах Алисы', path: '/alice-visibility', icon: Mic },
  { label: 'Коммерческие факторы', path: '/eeat-audit', icon: Target },
  { label: 'Микроразметка', path: '/schema-audit', icon: Code2 },
  { label: 'Ссылочный аудит', path: '/link-audit', icon: Link2 },
  { label: 'Ссылочный профиль', path: '/link-profile', icon: Link2 },
  { label: 'Технический аудит', path: '/technical-audit', icon: ShieldAlert },
  { label: 'Яндекс Вебмастер', path: '/yandex-webmaster', icon: Gauge },
  { label: 'PageSpeed', path: '/pagespeed', icon: Zap },
  { label: 'Адаптивность', path: '/responsive', icon: Smartphone },
  { label: 'История SERP', path: '/serp-history', icon: HistoryIcon },
  { label: 'Конкуренты', path: '/competitors', icon: Users },
  { label: 'Анализ топа', path: '/top-analysis', icon: BarChart3 },
  { label: 'Семантика', path: '/semantic-core', icon: Network },
  { label: 'Темы для блога', path: '/blog-topics', icon: PenSquare },
  { label: 'Интент запросов', path: '/intent', icon: FileText },
];

const ADS_ITEMS: Item[] = [
  { label: 'Обзор', path: '/ads', icon: LayoutDashboard },
  { label: 'Кабинеты', path: '/ads/accounts', icon: Briefcase },
  { label: 'Кампании', path: '/ads/campaigns', icon: Rocket },
  { label: 'Поисковые запросы', path: '/ads/queries', icon: Search },
  { label: 'Объявления', path: '/ads/creatives', icon: MessageSquare },
  { label: 'AI-рекомендации', path: '/ads/ai-recommendations', icon: Sparkles },
  { label: 'Отчёты', path: '/ads/reports', icon: FileBarChart },
  { label: 'Автоматизация', path: '/ads/automation', icon: Wand2 },
  { label: 'Аудит кабинета (AI)', path: '/ads/audit', icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();
  const { isStaff } = useStaffRole();

  const isActive = (path: string) => pathname === path;
  const seoPaths = SEO_ITEMS.map((i) => i.path).concat('/seo');
  const isSeoActive = seoPaths.includes(pathname);
  const [seoOpen, setSeoOpen] = useState(isSeoActive);
  const adsPaths = ADS_ITEMS.map((i) => i.path);
  const isAdsActive = adsPaths.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const [adsOpen, setAdsOpen] = useState(isAdsActive || pathname.startsWith('/ads'));

  const bottomItems: Item[] = [
    { label: 'История', path: '/history', icon: HistoryIcon },
    ...(isStaff
      ? [{ label: 'Help me', path: '/staff-hub', icon: LifeBuoy } as Item]
      : []),
    ...(isAdmin
      ? [{ label: 'Админ-панель', path: '/admin', icon: Settings } as Item]
      : []),
  ];

  const [user, setUser] = useState<{ name: string; email: string } | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!active || !data.user) return;
      const meta: any = data.user.user_metadata || {};
      const name =
        meta.full_name || meta.name ||
        (data.user.email ? data.user.email.split('@')[0] : 'Пользователь');
      setUser({ name, email: data.user.email ?? '' });
    });
    return () => { active = false; };
  }, []);
  const initials = (user?.name ?? 'U')
    .split(/\s+/).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('') || 'U';

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-border/60">
        <div
          className="flex items-center gap-2 px-2 py-1.5 cursor-pointer"
          onClick={() => navigate('/tools')}
        >
          <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-foreground">SEO-Аудит</span>
              <span className="text-[10px] text-muted-foreground">Workbench</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {MAIN_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                      <NavLink
                        to={item.path}
                        className="flex items-center gap-2"
                        onMouseEnter={() => prefetch(item.path)}
                        onFocus={() => prefetch(item.path)}
                        onTouchStart={() => prefetch(item.path)}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>SEO</SidebarGroupLabel>}
          <SidebarGroupContent>
            <Collapsible open={collapsed ? true : seoOpen} onOpenChange={setSeoOpen}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-center gap-1">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/seo')}
                      tooltip="SEO Dashboard"
                      className="flex-1"
                    >
                      <NavLink
                        to="/seo"
                        className="flex items-center gap-2"
                        onMouseEnter={() => prefetch('/seo')}
                        onFocus={() => prefetch('/seo')}
                      >
                        <BarChart2 className="h-4 w-4 shrink-0" />
                        <span>SEO</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {!collapsed && (
                      <CollapsibleTrigger
                        aria-label="Развернуть SEO"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${seoOpen ? 'rotate-180' : ''}`}
                        />
                      </CollapsibleTrigger>
                    )}
                  </div>
                </SidebarMenuItem>

                <CollapsibleContent>
                  <div className={collapsed ? '' : 'pl-3 mt-1 border-l border-border/40 ml-3'}>
                    {SEO_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                            <NavLink
                              to={item.path}
                              className="flex items-center gap-2"
                              onMouseEnter={() => prefetch(item.path)}
                              onFocus={() => prefetch(item.path)}
                              onTouchStart={() => prefetch(item.path)}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </SidebarMenu>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="flex items-center gap-2">
              <span>РЕКЛАМА</span>
              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 tracking-wide">
                Новое
              </span>
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <Collapsible open={collapsed ? true : adsOpen} onOpenChange={setAdsOpen}>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex items-center gap-1">
                    <SidebarMenuButton
                      asChild
                      isActive={isActive('/ads')}
                      tooltip="Реклама — Обзор"
                      className="flex-1"
                    >
                      <NavLink
                        to="/ads"
                        className="flex items-center gap-2"
                        onMouseEnter={() => prefetch('/ads')}
                        onFocus={() => prefetch('/ads')}
                      >
                        <Megaphone className="h-4 w-4 shrink-0" />
                        <span>Реклама</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {!collapsed && (
                      <CollapsibleTrigger
                        aria-label="Развернуть Реклама"
                        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${adsOpen ? 'rotate-180' : ''}`}
                        />
                      </CollapsibleTrigger>
                    )}
                  </div>
                </SidebarMenuItem>

                <CollapsibleContent>
                  <div className={collapsed ? '' : 'pl-3 mt-1 border-l border-border/40 ml-3'}>
                    {ADS_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <SidebarMenuItem key={item.path}>
                          <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                            <NavLink
                              to={item.path}
                              className="flex items-center gap-2"
                              onMouseEnter={() => prefetch(item.path)}
                              onFocus={() => prefetch(item.path)}
                              onTouchStart={() => prefetch(item.path)}
                            >
                              <Icon className="h-4 w-4 shrink-0" />
                              <span>{item.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </div>
                </CollapsibleContent>
              </SidebarMenu>
            </Collapsible>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60">
        <SidebarMenu>
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                  <NavLink
                    to={item.path}
                    className="flex items-center gap-2"
                    onMouseEnter={() => prefetch(item.path)}
                    onFocus={() => prefetch(item.path)}
                    onTouchStart={() => prefetch(item.path)}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}