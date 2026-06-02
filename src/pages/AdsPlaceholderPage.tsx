import { useLocation, Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft } from 'lucide-react';

const ADS_LABELS: Record<string, string> = {
  '/ads/campaigns': 'Кампании',
  '/ads/queries': 'Поисковые запросы',
  '/ads/creatives': 'Объявления',
  '/ads/ai-recommendations': 'AI-рекомендации',
  '/ads/reports': 'Отчёты',
  '/ads/automation': 'Автоматизация',
  '/ads/audit': 'Аудит кабинета (AI)',
};

export default function AdsPlaceholderPage() {
  const { pathname } = useLocation();
  const title = ADS_LABELS[pathname] ?? 'Этот раздел';

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-200 flex flex-col">
      <AppHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Construction className="w-8 h-8 text-blue-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-white tracking-tight">
              Раздел «{title}» в разработке
            </h1>
            <p className="text-sm text-slate-400">
              Мы уже работаем над этим модулем. Скоро здесь появятся подробные данные,
              графики и инструменты управления.
            </p>
          </div>
          <Button asChild variant="outline" className="bg-[#111827] border-slate-800 text-slate-200 hover:bg-slate-800 hover:text-white">
            <Link to="/ads">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Вернуться к «Обзор рекламы»
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}