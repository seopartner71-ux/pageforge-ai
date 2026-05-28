# План порта «Видимость в ИИ ответах»

Полный порт фичи GEO Radar из проекта SERPblueprint (`bbbb80ab-81d3-4691-9752-0fba6c202665`) в этот проект. Из-за объёма (1615 строк UI + 3 связанные страницы + 6 таблиц БД + edge-функция через 7 моделей + PDF + realtime-прогресс) работа разбита на фазы — каждая фаза самостоятельна и проверяема.

## Что портируем (итог)

- **Меню:** новый пункт «Видимость в ИИ ответах» в боковой панели, иконка `Radar` (lucide).
- **Страница:** `/ai-visibility` (рут), внутри 4 вкладки как на скриншоте: **Дашборд / Позиции / Промпты / Источники**.
- **Подфункционал:** проекты бренда → ключи/промпты → прогон через 7 ИИ-моделей → результаты (упоминания/тональность/конкуренты/источники) → радар-чарт + метрики + рекомендации.
- **AI-провайдер:** OpenRouter (секрет `OPENROUTER_API_KEY` уже есть в проекте).
- **PDF-отчёт:** «Скачать PDF» по проекту.

## Архитектура БД (6 новых таблиц)

```
radar_projects        — проекты (бренд, домен, язык, "nuggets")
radar_keywords        — отслеживаемые ключевые запросы
radar_prompt_groups   — группы промптов (Direct/Comparison/...)
radar_prompts         — кастомные промпты внутри групп
radar_analysis_runs   — прогоны (для realtime-прогресса)
radar_results         — результат проверки 1 keyword/prompt × 1 модель
```

Все таблицы — auth-only (`auth.uid() = user_id`) + admin-доступ через `has_role(...,'admin')`. GRANT-ы: `authenticated` + `service_role` (без `anon`). Realtime включается для `radar_analysis_runs`.

## Edge-функции (2 шт.)

1. **`radar-check`** — принимает `{project_id, keyword_id?|prompt_id?, models[]}`. Гоняет промпт через выбранные модели OpenRouter (Gemini / GPT-4o / Perplexity-sonar / Claude / DeepSeek / Mistral / Llama), детектит упоминания бренда/домена, тональность, конкурентов, источники. Пишет по строке в `radar_results` на каждую модель. Обновляет `radar_analysis_runs` для прогресса.
2. **`generate-geo-plan`** — стрим действий-плана по результатам прогона через OpenRouter (SSE).

Оба используют `OPENROUTER_API_KEY` напрямую (как в существующем `seo-analyze`), не Lovable AI Gateway — пользователь явно выбрал OpenRouter.

## Фронтенд

- **`src/pages/AiVisibilityPage.tsx`** — основной контейнер (порт `RadarPage.tsx`), адаптация:
  - Удаляем `useI18n` / `usePlanLimits` / `PlanGate` (не сущ. в этом проекте) — RU-only текст, кредиты через существующий `useAdminRole` для bypass, ваш `1 URL = 1 credit` принцип учтём отдельной строкой "1 прогон = N кредитов".
  - Стэппер 5 шагов, тулбар моделей, радар-чарт, SOM-метрики, таблицы — 1:1 копия.
- **Подкомпоненты:** `MentionsTab`, `PromptsTab`, `SourcesTab` (порты `MentionsPage`/`PromptsPage`/`SourcesPage` как табы внутри страницы, а не отдельные роуты).
- **PDF-отчёт:** порт `radarPdfReport.ts` через `jspdf` (уже в проекте).
- **Realtime-прогресс:** через `supabase.channel` на `radar_analysis_runs`.
- **Описание страницы:** `PageDescription` (как на остальных страницах, шаблон уже используется в `GeoAuditPage`).

## Фазы поставки

### Фаза 1 — БД + меню (этот ход)
1. Миграция: 6 таблиц + RLS + GRANT + realtime.
2. Пункт меню «Видимость в ИИ ответах» в `AppSidebar.tsx`.
3. Роут `/ai-visibility` в `App.tsx` с заглушкой страницы (header + PageDescription + "Скоро…").

### Фаза 2 — Edge-функции + базовый UI
1. `radar-check` (через OpenRouter).
2. Минимальный UI: создание проекта, добавление ключей, кнопка «Сканировать», таблица результатов.

### Фаза 3 — Полный дашборд
1. Радар-чарт, SOM, метрики моделей, тональность & SOV, источники.
2. Realtime-прогресс прогона.
3. Стэппер 5 шагов как на скриншоте.

### Фаза 4 — Промпт-группы + источники + PDF
1. Вкладки «Промпты» и «Источники» полностью.
2. `generate-geo-plan` SSE-стрим.
3. PDF-экспорт.

## Технические детали

- Адаптация под проект: использовать существующие `AppHeader`, `PageDescription`, semantic tokens из `index.css`, паттерн страниц как в `GeoAuditPage.tsx`.
- Никаких изменений `src/integrations/supabase/client.ts` и `types.ts` (генерится автоматически после миграции).
- В `pages/AdminPage.tsx` ничего не трогаем — пункт меню доступен всем `is_approved` пользователям (как и остальные модули).
- Все 7 моделей — реальные через OpenRouter; модель IDs: `google/gemini-flash-1.5`, `openai/gpt-4o-mini`, `perplexity/sonar`, `anthropic/claude-3-haiku`, `deepseek/deepseek-chat`, `mistralai/mistral-7b-instruct`, `meta-llama/llama-3.1-8b-instruct`. Это даст реальные данные при разумной стоимости.

## Что в этой фазе НЕ делаем

- Не делаем дубликат `MentionsPage`/`PromptsPage`/`SourcesPage` как отдельные роуты — только табы внутри `/ai-visibility`.
- Не портируем `usePlanLimits` / тарифы (в этом проекте плановая система другая — кредиты).
- Не трогаем существующий `GeoAuditPage` — это другая фича (41-чекпойнт audit).

После одобрения плана — начну Фазу 1 (миграция БД + меню + роут).