import { Check, Loader2, CloudOff, Cloud } from 'lucide-react';

interface Props {
  state: 'idle' | 'saving' | 'saved' | 'error';
  hasProject: boolean;
}

export function SaveStatusBadge({ state, hasProject }: Props) {
  if (!hasProject) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground" title="Создайте проект, чтобы сохранять в историю">
        <CloudOff className="w-3 h-3" /> Не сохраняется
      </span>
    );
  }
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Loader2 className="w-3 h-3 animate-spin" /> Сохранение…
      </span>
    );
  }
  if (state === 'saved') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-500">
        <Check className="w-3 h-3" /> Сохранено в истории
      </span>
    );
  }
  if (state === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] text-destructive">
        <CloudOff className="w-3 h-3" /> Ошибка сохранения
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <Cloud className="w-3 h-3" /> Автосохранение
    </span>
  );
}
