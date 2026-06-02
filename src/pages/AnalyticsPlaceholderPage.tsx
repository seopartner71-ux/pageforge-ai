import { useLocation, Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft } from 'lucide-react';
import { ANALYTICS_SECTIONS, ANALYTICS_LABELS } from '@/lib/analyticsNav';

export default function AnalyticsPlaceholderPage() {
  const { pathname } = useLocation();
  const title = ANALYTICS_LABELS[pathname] ?? 'Аналитика';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 flex flex-col">
      <AppHeader />
      <main className="flex-1 px-6 py-10 max-w-6xl w-full mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            {title}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Раздел в разработке — здесь появятся данные, графики и инсайты.
          </p>
        </div>

        {pathname === '/analytics' ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {ANALYTICS_SECTIONS.map((section) => (
              <div
                key={section.label}
                className="rounded-xl border border-slate-800 bg-[#111827] p-5"
              >
                <div className="text-xs uppercase tracking-wide text-blue-400 font-semibold mb-3">
                  {section.label}
                </div>
                <ul className="space-y-1.5">
                  {section.items.map((it) => (
                    <li key={it.path}>
                      <Link
                        to={it.path}
                        className="text-sm text-slate-300 hover:text-white transition-colors"
                      >
                        {it.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-slate-800 bg-[#111827] p-10 flex flex-col items-center text-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Construction className="w-7 h-7 text-blue-400" />
            </div>
            <p className="text-sm text-slate-400 max-w-md">
              Модуль «{title}» скоро будет доступен. Мы работаем над сбором данных
              и интерфейсом отчёта.
            </p>
            <Button
              asChild
              variant="outline"
              className="bg-[#0B0F19] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <Link to="/analytics">
                <ArrowLeft className="w-4 h-4 mr-2" />
                К обзору аналитики
              </Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}