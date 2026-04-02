import React, { createContext, useContext, useState } from 'react';
import { Lang, t, Translations } from '@/lib/i18n';

interface LangContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  tr: Translations;
}

const LangContext = createContext<LangContextType | undefined>(undefined);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>('ru');
  const tr = t(lang);
  return (
    <LangContext.Provider value={{ lang, setLang, tr }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
