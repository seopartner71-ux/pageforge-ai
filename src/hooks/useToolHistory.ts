import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type ToolTable = 'link_audits' | 'competitor_analyses' | 'top_analyses';

interface SavePayload {
  table: ToolTable;
  /** Поля только для insert/update */
  data: Record<string, any>;
  /** Имя записи для удобства в истории */
  name?: string;
  /** Готов ли payload к сохранению */
  enabled: boolean;
}

/**
 * Универсальное автосохранение результатов работы инструмента
 * (Ссылочный аудит, Конкуренты, Анализ топа) в историю.
 *
 * Логика:
 * - При первом enabled=true делается insert, id запоминается.
 * - Дальнейшие изменения payload отправляются debounced update (~1.2s).
 * - Если у пользователя нет проектов — показывает 1 toast и не сохраняет.
 */
export function useToolHistory({ table, data, name, enabled }: SavePayload) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [savingState, setSavingState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const warnedNoProject = useRef(false);
  const debounce = useRef<number | null>(null);
  const inserting = useRef(false);

  // Один раз — узнаём userId + первый проект
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      const { data: projects } = await supabase
        .from('projects')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);
      if (projects && projects.length > 0) setProjectId(projects[0].id);
    })();
  }, []);

  // Автосохранение
  useEffect(() => {
    if (!enabled || !userId) return;
    if (!projectId) {
      if (!warnedNoProject.current) {
        warnedNoProject.current = true;
        toast.message('Создайте проект на странице «Анализ», чтобы сохранять результаты в историю.');
      }
      return;
    }

    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(async () => {
      try {
        if (!savedId && !inserting.current) {
          inserting.current = true;
          setSavingState('saving');
          const { data: row, error } = await supabase
            .from(table)
            .insert({
              user_id: userId,
              project_id: projectId,
              name: name || 'Без названия',
              ...data,
            } as any)
            .select('id')
            .single();
          inserting.current = false;
          if (error) throw error;
          if (row?.id) {
            setSavedId(row.id);
            setSavingState('saved');
          }
        } else if (savedId) {
          setSavingState('saving');
          const { error } = await supabase
            .from(table)
            .update({ name: name || 'Без названия', ...data } as any)
            .eq('id', savedId);
          if (error) throw error;
          setSavingState('saved');
        }
      } catch (e: any) {
        console.error('Tool autosave failed:', e);
        setSavingState('error');
      }
    }, 1200);

    return () => {
      if (debounce.current) window.clearTimeout(debounce.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, projectId, JSON.stringify(data), name, table]);

  /** Загрузить ранее сохранённую запись по id (для ?restore=) */
  const loadById = async (id: string) => {
    const { data: row, error } = await supabase
      .from(table)
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error || !row) return null;
    setSavedId(id);
    setProjectId((row as any).project_id);
    return row;
  };

  return { savedId, savingState, loadById, hasProject: !!projectId };
}
