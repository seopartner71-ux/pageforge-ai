import { useState } from 'react';
import { useLang } from '@/contexts/LangContext';
import { Input } from '@/components/ui/input';
import { Rocket } from 'lucide-react';

interface CreateProjectProps {
  onCreated: (project: { name: string; domain: string }) => void;
}

export function CreateProjectDialog({ onCreated }: CreateProjectProps) {
  const { lang } = useLang();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');

  const isRu = lang === 'ru';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreated({ name: name.trim(), domain: domain.trim() });
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="glass-card p-10">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-foreground mb-3">
              {isRu ? 'Добро пожаловать!' : 'Welcome!'} <Rocket className="inline w-6 h-6 ml-1" />
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
              {isRu
                ? 'Для запуска анализа необходимо создать свой первый проект. В проектах будут удобно сгруппированы все ваши проверки и история.'
                : 'To start analysis, create your first project. Projects conveniently group all your checks and history.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                {isRu ? 'Название проекта *' : 'Project name *'}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isRu ? 'Например: Мой Блог' : 'e.g. My Blog'}
                className="h-11 bg-secondary border-border/50 focus:border-primary"
                required
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">
                {isRu ? 'Основной домен (опционально)' : 'Main domain (optional)'}
              </label>
              <Input
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="https://mysite.com"
                className="h-11 bg-secondary border-border/50 focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full h-12 rounded-xl btn-gradient text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRu ? 'Создать проект и начать' : 'Create project and start'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
