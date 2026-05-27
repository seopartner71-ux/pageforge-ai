# План: перенос «Технический аудит»

Переносим функционал из проекта Analytics Start как отдельную страницу `/technical-audit` (новый пункт меню), с подключением внешнего краулер-воркера.

## 1. База данных (новая миграция)

Создаём независимые от чужой схемы (`team_members`, `is_project_member`) таблицы, привязанные к `auth.uid()`:

- `crawl_jobs` — задания краулера (id, user_id, domain, status, progress, started_at, finished_at, error_message, options jsonb)
- `crawl_pages` — найденные страницы (job_id, url, status_code, depth, title, description, h1, canonical, is_indexed, load_time_ms, word_count)
- `crawl_issues` — найденные проблемы (job_id, page_url, type, code, severity, message, details jsonb)
- `crawl_stats` — сводная статистика (job_id, total_pages, total_issues, critical_count, warning_count, info_count, avg_load_time_ms, score)
- `audit_checks` + `audit_url_errors` — пользовательский чек-лист (упрощённый: без `team_members`/`assigned_to`)
- RPC `claim_next_crawl_job()` — атомарно берёт следующий `pending` для воркера
- GRANT + RLS: владелец видит/правит свои; admin видит всё; service_role полный доступ

## 2. Edge-функции

- `crawler-callback` — публичная, защищена `CRAWLER_SECRET` (header `x-crawler-secret`). Actions: `claim_job`, `update_job`, `add_pages`, `add_issues`, `save_stats`.
- `start-audit` — стартует job (создаёт `crawl_jobs` со status=`pending`, домен из формы)
- `stop-audit` — помечает job отменённым
- `audit-insights` — AI-вердикт через Lovable AI Gateway (`google/gemini-2.5-flash`)
- `download-audit-pdf` — PDF из последнего завершённого аудита (опционально, можно вторым этапом)

## 3. Frontend

- Новая страница `src/pages/TechnicalAuditPage.tsx` — обёртка над переносимой логикой, в едином стиле приложения (как PageSpeedPage). Ввод домена в шапке, кнопки «Запустить аудит» / «Остановить».
- Компонент `src/components/audit/TechnicalAuditView.tsx` — основное тело (адаптация `TechnicalAuditTab.tsx` ~1460 строк): секции `SECTIONS`, описания `CHECK_INFO`, раскрываемые блоки, индикатор прогресса, скачивание PDF/HTML.
- `src/components/audit/CrawlerStatusIndicator.tsx` — индикатор «онлайн/оффлайн» с проверкой `crawler-health`.
- `src/components/audit/AuditInsightsBlock.tsx` — блок AI-выводов.
- Удаляем зависимости от `useSourceTasks`, `CreateTaskFromSourceButton`, `team_members`, `integrations`, `project_messages`, `site_health` — они не нужны для standalone-режима.
- Маршрут в `src/App.tsx`, пункт меню «Технический аудит» (иконка `ClipboardCheck`) в `AppSidebar.tsx`.

## 4. Внешний краулер

Без работающего воркера фича не работает. Краулер — Node/Python-сервис (вне Lovable), который:

1. Раз в N секунд POST на `https://<project>.functions.supabase.co/crawler-callback` с `action:"claim_job"` и `x-crawler-secret`.
2. Получив `job`, ходит по сайту (sitemap.xml, fetch HTML, парсит), отправляет страницы и issues батчами через `add_pages`/`add_issues`.
3. По завершении `save_stats` + `update_job` с `status:"completed"`.

Действия:
- Через `add_secret` запрошу у вас новый секрет `CRAWLER_SECRET` (любая случайная строка — её же надо вписать в воркер).
- Сразу после переноса дам готовую инструкцию + Callback URL + минимальный Node.js-скрипт воркера, который можно развернуть на любом VPS / Render / Railway.

## 5. Что делаем сейчас (порядок)

1. Миграция БД (таблицы + RPC + RLS + GRANT).
2. 4 edge-функции (`crawler-callback`, `start-audit`, `stop-audit`, `audit-insights`).
3. Запрос секрета `CRAWLER_SECRET`.
4. Frontend (страница, компоненты, роут, меню).
5. PDF (`download-audit-pdf`) — отдельной итерацией после того как убедимся, что краулер пишет данные.
6. Инструкция по запуску воркера + готовый код.

## Технические детали

- AI: используем существующий `OPENROUTER_API_KEY` либо `LOVABLE_API_KEY` (Lovable AI Gateway) — без новых ключей.
- Все таблицы — отдельный namespace `crawl_*`, не конфликтуют с существующими (`analyses`, `link_audits`, `schema_audits`).
- `projects` не требуется: аудит привязан к `user_id` напрямую, домен передаётся в job.
- i18n: добавляем секцию `technicalAudit` в `src/i18n.ts` (RU/EN).
- Дизайн строго через семантические токены (`bg-background`, `text-foreground`, `border-border`), без хардкода цветов.
