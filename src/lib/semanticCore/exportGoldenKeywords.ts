import * as XLSX from 'xlsx';
import type { SemanticCorePayload, SemanticKeyword } from './types';

function isGolden(k: SemanticKeyword): boolean {
  if (k.intent !== 'info' && k.intent !== 'commercial') return false;
  if ((k.wsFrequency ?? 0) < 1000) return false;
  if (k.keywordDifficulty == null) {
    return (k.score ?? 0) > 70;
  }
  return k.keywordDifficulty <= 40;
}

const INTENT_RU: Record<string, string> = {
  info: 'Информационный',
  commercial: 'Коммерческий',
  nav: 'Навигационный',
  transac: 'Транзакционный',
};

function safeFile(s: string): string {
  return (s || 'project').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60);
}

function priorityLabel(score: number): string {
  if (score > 85) return 'Высокий';
  if (score > 70) return 'Средний';
  return 'Низкий';
}

export function exportGoldenKeywordsXlsx(payload: SemanticCorePayload): number {
  const golden = payload.keywords.filter(isGolden);
  if (!golden.length) return 0;

  const clusterMap = new Map(payload.clusters.map(c => [c.id, c.name]));
  const wb = XLSX.utils.book_new();

  const header = [
    'Запрос', 'Частота WS', 'Точная частота', 'KD (сложность)', 'Интент', 'Кластер', 'Score',
    'Потенциал трафика топ-1', 'Потенциал трафика топ-3', 'Потенциал трафика топ-10',
    'Приоритет', 'Статус', 'Исполнитель', 'Дата',
  ];
  const rows: any[][] = [header];

  // Сортируем по потенциалу топ-3 (DESC) — самые перспективные сверху
  const sorted = [...golden].sort((a, b) => (b.wsFrequency * 0.11) - (a.wsFrequency * 0.11));

  for (const k of sorted) {
    const f = k.wsFrequency || 0;
    rows.push([
      k.keyword,
      f,
      k.exactFrequency || 0,
      k.keywordDifficulty ?? '',
      INTENT_RU[k.intent] || k.intent,
      clusterMap.get(k.cluster) || k.cluster,
      k.score,
      Math.round(f * 0.28),
      Math.round(f * 0.11),
      Math.round(f * 0.03),
      priorityLabel(k.score),
      '', '', '',
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [
    { wch: 42 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 16 }, { wch: 26 }, { wch: 8 },
    { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 14 }, { wch: 16 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Золотые запросы');

  const date = new Date().toISOString().slice(0, 10);
  const filename = `Золотые_запросы_${safeFile(payload.topic)}_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
  return golden.length;
}

export function downloadGoldenJuniorBriefMd(payload: SemanticCorePayload): number {
  const count = payload.keywords.filter(isGolden).length;
  if (!count) return 0;

  const date = new Date().toISOString().slice(0, 10);
  const md = `# Задание: Работа с золотыми запросами

**Проект:** ${payload.topic}
**Дата:** ${date}
**Количество запросов:** ${count}

## Что такое золотые запросы?

Информационные запросы с высокой частотой и низкой конкурентностью — самые быстрые в продвижении.

## Твоя задача

### Шаг 1 — Проверка каждого запроса (30 мин)

Для каждого запроса из списка:

1. Введи запрос в Яндекс
2. Посмотри топ-10 — кто там?
   - Если Wikipedia, Дзен, небольшие блоги → ✅ запрос рабочий
   - Если крупные порталы, агрегаторы → ❌ пропусти
3. Отметь статус в таблице

### Шаг 2 — Приоритизация (15 мин)

Отсортируй рабочие запросы по колонке "Потенциал топ-3".
Топ-10 запросов → в работу в первую очередь.

### Шаг 3 — Создание контент-плана (45 мин)

Для каждого рабочего запроса заполни:

- Тип контента (статья / FAQ / лендинг)
- Примерный объём (слов)
- Дедлайн

## Список запросов

(приложен отдельным файлом Золотые_запросы_${date}.xlsx)

## Критерии хорошей статьи под информационный запрос

- Заголовок H1 содержит точный запрос
- Объём 1500-3000 слов
- Есть структура H2/H3
- Есть FAQ блок (5-7 вопросов)
- Есть внутренние ссылки на коммерческие страницы
- Мета-описание содержит запрос

## Проверка результата

Через 2-4 недели после публикации:

- Проверить позиции в Яндекс Вебмастер
- Цель: топ-20 за первый месяц
- Цель: топ-10 за 2-3 месяца
`;

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `Задание_SEO_джуну_${safeFile(payload.topic)}_${date}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
  return count;
}