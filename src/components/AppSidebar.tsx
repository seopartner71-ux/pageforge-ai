import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
import {
  LayoutGrid, Search, Sparkles, Link2, Users, BarChart3, Target,
  Code2, History as HistoryIcon, Zap, Smartphone, Network, FileText,
  PenSquare, User, Settings, Bot,
} from 'lucide-react';
import { useAdminRole } from '@/hooks/useAdminRole';

type Item = { label: string; path: string; icon: any };
type Group = { label: string; items: Item[] };

const GROUPS: Group[] = [
  {
    label: 'Главное',
    items: [
      { label: 'Все инструменты', path: '/tools', icon: LayoutGrid },
      { label: 'On-page страницы', path: '/dashboard', icon: Search },
    ],
  },
  {
    label: 'Аудиты',
    items: [
      { label: 'GEO Audit', path: '/geo-audit', icon: Sparkles },
      { label: 'Коммерческие факторы', path: '/eeat-audit', icon: Target },
      { label: 'Микроразметка', path: '/schema-audit', icon: Code2 },
      { label: 'Ссылочный аудит', path: '/link-audit', icon: Link2 },
      { label: 'Ссылочный профиль', path: '/link-profile', icon: Link2 },
    ],
  },
  {
    label: 'Технические проверки',
    items: [
      { label: 'PageSpeed', path: '/pagespeed', icon: Zap },
      { label: 'Адаптивность', path: '/responsive', icon: Smartphone },
      { label: 'История SERP', path: '/serp-history', icon: HistoryIcon },
    ],
  },
  {
    label: 'Конкуренты',
    items: [
      { label: 'Анализ конкурентов', path: '/competitors', icon: Users },
      { label: 'Анализ топа', path: '/top-analysis', icon: BarChart3 },
    ],
  },
  {
    label: 'Семантика и контент',
    items: [
      { label: 'Семантическое ядро', path: '/semantic-core', icon: Network },
      { label: 'Темы для блога', path: '/blog-topics', icon: PenSquare },
      { label: 'Интент', path: '/intent', icon: FileText },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAdminRole();

  const isActive = (path: string) => pathname === path;

  const bottomItems: Item[] = [
    { label: 'История', path: '/history', icon: HistoryIcon },
    ...(isAdmin
      ? [{ label: 'Админ-панель', path: '/admin', icon: Settings } as Item]
      : [{ label: 'Аккаунт', path: '/account', icon: User } as Item]),
  ];

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
        {GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            {!collapsed && <SidebarGroupLabel>{g.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                        <NavLink to={item.path} className="flex items-center gap-2">
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
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60">
        <SidebarMenu>
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild isActive={isActive(item.path)} tooltip={item.label}>
                  <NavLink to={item.path} className="flex items-center gap-2">
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