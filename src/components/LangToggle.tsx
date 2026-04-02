import { useLang } from '@/contexts/LangContext';

export function LangToggle() {
  const { lang, setLang } = useLang();
  return (
    <div className="flex items-center gap-1 rounded-lg bg-secondary p-1">
      <button
        onClick={() => setLang('ru')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
          lang === 'ru' ? 'btn-gradient' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        RU
      </button>
      <button
        onClick={() => setLang('en')}
        className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
          lang === 'en' ? 'btn-gradient' : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        EN
      </button>
    </div>
  );
}
