import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui/card';
import { Activity, Bell, CalendarClock, Sparkles } from 'lucide-react';

export default function SeoMonitoringPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container max-w-[1200px] py-8 space-y-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Activity className="w-5 h-5" /></div>
          <div>
            <h1 className="text-2xl font-semibold">SEO Мониторинг</h1>
            <p className="text-sm text-muted-foreground max-w-2xl">Ежедневный контроль изменений трафика и позиций. Раздел в разработке.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { icon: CalendarClock, title: 'Ежедневные снимки', desc: 'Автоматический сбор метрик из Метрики и GSC раз в сутки.' },
            { icon: Bell, title: 'Алерты по аномалиям', desc: 'Уведомления при падении/росте трафика выше порога.' },
            { icon: Sparkles, title: 'AI-объяснение изменений', desc: 'Каждое утро — короткий разбор: что изменилось и почему.' },
          ].map((f) => (
            <Card key={f.title} className="p-5 space-y-2">
              <div className="w-9 h-9 rounded-md bg-primary/10 text-primary flex items-center justify-center"><f.icon className="w-4 h-4" /></div>
              <div className="font-medium">{f.title}</div>
              <div className="text-sm text-muted-foreground">{f.desc}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6 text-sm text-muted-foreground border-dashed">
          Свяжитесь с командой — расскажем, когда модуль будет доступен. А пока используйте <span className="text-foreground font-medium">SEO Recovery AI</span> для ручного анализа.
        </Card>
      </main>
    </div>
  );
}