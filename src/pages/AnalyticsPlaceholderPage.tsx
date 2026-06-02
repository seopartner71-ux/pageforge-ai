import { useLocation, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Construction, ArrowLeft } from 'lucide-react';
import { ANALYTICS_SECTIONS, ANALYTICS_LABELS } from '@/lib/analyticsNav';

export default function AnalyticsPlaceholderPage() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title = ANALYTICS_LABELS[pathname] ?? 'Аналитика';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {pathname === '/analytics' ? (
        <main className="container max-w-[1400px] py-8 space-y-10">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Аналитика</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Анализ ниши, спроса, аудитории и конкурентов. Выберите модуль, чтобы перейти к данным.
            </p>
          </div>

          {ANALYTICS_SECTIONS.map((group) => (
            <section key={group.label} className="space-y-4">
              <div className="flex items-baseline justify-between gap-4 flex-wrap">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {group.items.map((tool) => {
                  const Icon = tool.icon;
                  return (
                    <Card
                      key={tool.path}
                      onClick={() => navigate(tool.path)}
                      className="p-4 cursor-pointer hover:border-primary/60 hover:bg-accent/40 transition-colors group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 min-w-0">
                          <div className="text-sm font-medium text-foreground truncate">{tool.label}</div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </main>
      ) : (
        <main className="container max-w-4xl py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Раздел в разработке — модуль скоро будет доступен.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Construction className="w-7 h-7 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground max-w-md">
              Мы работаем над сбором данных и интерфейсом для «{title}».
            </p>
            <Button asChild variant="outline">
              <Link to="/analytics">
                <ArrowLeft className="w-4 h-4 mr-2" />
                К обзору аналитики
              </Link>
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}