import { useLang } from '@/contexts/LangContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const tabKeys = [
  'aiReport', 'priorities', 'structure', 'topicalGap', 'ngrams',
  'zipf', 'tfidf', 'images', 'anchors', 'pageSpeed', 'comparison',
] as const;

type TabKey = typeof tabKeys[number];

const tabLabels: Record<string, Record<TabKey, string>> = {
  ru: {
    aiReport: 'ИИ-отчёт',
    priorities: 'Приоритеты',
    structure: 'Структура страницы',
    topicalGap: 'Тематические пробелы',
    ngrams: 'N-граммы',
    zipf: 'Закон Ципфа',
    tfidf: 'TF*IDF',
    images: 'Изображения',
    anchors: 'Анкоры',
    pageSpeed: 'PageSpeed',
    comparison: 'Сравнение',
  },
  en: {
    aiReport: 'AI Report',
    priorities: 'Priorities',
    structure: 'Page Structure',
    topicalGap: 'Topical Gaps',
    ngrams: 'N-grams',
    zipf: "Zipf's Law",
    tfidf: 'TF*IDF',
    images: 'Images',
    anchors: 'Anchors',
    pageSpeed: 'PageSpeed',
    comparison: 'Comparison',
  },
};

// Mock AI report content
function AiReportContent({ lang }: { lang: string }) {
  if (lang === 'ru') {
    return (
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <h2 className="text-lg font-bold text-foreground">Сводный ИИ-отчёт</h2>
            <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/20 text-accent">ИИ-анализ</span>
          </div>
          <div className="border-l-2 border-border pl-4 mb-6">
            <p className="text-sm text-muted-foreground">Автоматический анализ контента, структуры и технической составляющей страницы.</p>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2">ПОЛНЫЙ SEO-ОТЧЕТ ПО СТРАНИЦЕ</h3>
          <p className="text-sm text-foreground mb-4"><strong>Общая оценка: 48/100</strong></p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Страница представляет собой каталог услуг с хорошим потенциалом, но текущая реализация имеет ряд критических проблем, мешающих эффективному ранжированию и конверсии. Основные точки роста лежат в области технической оптимизации, углубления контента и усиления сигналов доверия (E-E-A-T).
          </p>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground mb-4">1. ТЕХНИЧЕСКИЙ АНАЛИЗ (ON-PAGE)</h3>

          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">• Структура и семантика HTML:</h4>
              <div className="pl-4 space-y-2 text-sm">
                <p><strong className="text-foreground">Проблема:</strong> <span className="text-muted-foreground">Отсутствует тег</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;main&gt;</code><span className="text-muted-foreground">, который должен оборачивать основной контент. Заголовок</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;h1&gt;</code> <span className="text-muted-foreground">находится вне</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;main&gt;</code><span className="text-muted-foreground">.</span></p>
                <p><strong className="text-foreground">Влияние:</strong> <span className="text-muted-foreground">Затрудняет для поисковых систем понимание иерархии и важности контента.</span></p>
                <p><strong className="text-foreground">Рекомендация:</strong> <span className="text-muted-foreground">Внедрить семантическую вёрстку: обернуть основной контент в</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;main&gt;</code><span className="text-muted-foreground">, а каждый логический блок с</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;h2&gt;</code> <span className="text-muted-foreground">— в</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">&lt;section&gt;</code><span className="text-muted-foreground">.</span></p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">• Мета-теги и разметка:</h4>
              <div className="pl-4 space-y-2 text-sm">
                <p><strong className="text-foreground">Проблема:</strong> <span className="text-muted-foreground">Отсутствуют OpenGraph теги (</span><code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">og:title</code><span className="text-muted-foreground">,</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">og:description</code><span className="text-muted-foreground">,</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">og:image</code><span className="text-muted-foreground">).</span></p>
                <p><strong className="text-foreground">Рекомендация:</strong> <span className="text-muted-foreground">Внедрить полный набор OG-тегов.</span></p>
              </div>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-foreground mb-2">• Медиаконтент:</h4>
              <div className="pl-4 space-y-2 text-sm">
                <p><strong className="text-foreground">Проблема:</strong> <span className="text-muted-foreground">У 18 изображений не указаны</span> <code className="px-1.5 py-0.5 rounded bg-secondary text-accent text-xs">alt</code> <span className="text-muted-foreground">-атрибуты. Это проблема для доступности и упущенная возможность для SEO.</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-lg font-bold text-foreground">Summary AI Report</h2>
          <span className="px-2.5 py-0.5 rounded-md text-xs font-medium bg-accent/20 text-accent">AI Analysis</span>
        </div>
        <div className="border-l-2 border-border pl-4 mb-6">
          <p className="text-sm text-muted-foreground">Automated analysis of content, structure, and technical aspects of the page.</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-accent uppercase tracking-wider mb-2">FULL SEO REPORT</h3>
        <p className="text-sm text-foreground mb-4"><strong>Overall Score: 48/100</strong></p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          The page is a service catalog with good potential, but the current implementation has several critical issues preventing effective ranking and conversion. Key growth areas are in technical optimization, content depth, and E-E-A-T signals.
        </p>
      </div>
    </div>
  );
}

function PlaceholderTab({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center min-h-[300px]">
      <p className="text-muted-foreground text-sm">{title} — данные будут доступны после полного анализа</p>
    </div>
  );
}

export function ReportTabs() {
  const { lang } = useLang();
  const labels = tabLabels[lang] || tabLabels.en;

  return (
    <Tabs defaultValue="aiReport" className="w-full">
      <TabsList className="w-full h-auto flex flex-wrap gap-0.5 bg-secondary/50 p-1 rounded-xl">
        {tabKeys.map((key) => (
          <TabsTrigger
            key={key}
            value={key}
            className="px-3 py-2 rounded-lg data-[state=active]:bg-card data-[state=active]:text-foreground text-muted-foreground text-xs font-medium transition-all"
          >
            {key === 'aiReport' && <span className="w-1.5 h-1.5 rounded-full bg-accent mr-1.5 inline-block" />}
            {labels[key]}
            {key === 'tfidf' && <span className="ml-1 text-muted-foreground text-[10px]">282</span>}
            {key === 'images' && <span className="ml-1 text-muted-foreground text-[10px]">●</span>}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="aiReport" className="mt-6">
        <AiReportContent lang={lang} />
      </TabsContent>

      {tabKeys.filter(k => k !== 'aiReport').map((key) => (
        <TabsContent key={key} value={key} className="mt-6">
          <PlaceholderTab title={labels[key]} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
