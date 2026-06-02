import { useLocation, Link } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { Button } from '@/components/ui/button';
import { Construction, ArrowLeft } from 'lucide-react';
import { SEO_LABELS } from '@/lib/seoNav';

export default function SeoPlaceholderPage() {
  const { pathname } = useLocation();
  const title = SEO_LABELS[pathname] ?? 'SEO';

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
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
            <Link to="/seo">
              <ArrowLeft className="w-4 h-4 mr-2" />
              К SEO Dashboard
            </Link>
          </Button>
        </div>
      </main>
    </div>
  );
}