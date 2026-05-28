import { AppHeader } from '@/components/AppHeader';
import { PageDescription } from '@/components/PageDescription';
import { Radar } from 'lucide-react';
import { Card } from '@/components/ui/card';

export default function AiVisibilityPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="container py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Radar className="w-6 h-6 text-primary" />
            Видимость в ИИ ответах
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Мониторинг присутствия вашего бренда в ответах ChatGPT, Gemini, Perplexity, Claude и других ИИ-моделей.
          </p>
        </div>

        <PageDescription
          items={[
            { label: 'Что это', text: 'GEO Radar - мониторинг, как ваш бренд представлен в ответах генеративных ИИ: ChatGPT, Perplexity, Claude, Gemini, DeepSeek, Mistral, Llama. Видите, кто доминирует в нише, какие конкуренты упоминаются и какие источники цитируют ИИ.' },
            { label: 'Как работает', text: 'Создаёте проект (бренд + домен), добавляете ключевые запросы или промпт-группы, запускаете прогон. Система задаёт ваши вопросы 7 моделям параллельно, парсит ответы, детектит упоминания бренда/домена, тональность, конкурентов и источники.' },
            { label: 'Что получаете', text: 'Радар-чарт видимости по моделям, метрику Share of Model (SOM), список конкурентов, тональность & Share of Voice, топ цитируемых источников и AI-сгенерированный план улучшения GEO-видимости.' },
            { label: 'Кредиты', text: 'Один прогон = 1 запрос × N моделей. Каждая модель тратит 1 кредит. Прогресс отображается в реальном времени.' },
          ]}
        />

        <Card className="p-12 text-center space-y-3">
          <Radar className="w-12 h-12 text-primary/40 mx-auto" />
          <h2 className="text-lg font-semibold">Модуль в разработке</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            База данных подготовлена. В ближайших обновлениях добавим: создание проектов, прогон через 7 ИИ-моделей через OpenRouter, радар-чарт видимости, тональность & SOV, план GEO-улучшений и PDF-отчёт.
          </p>
        </Card>
      </main>
    </div>
  );
}