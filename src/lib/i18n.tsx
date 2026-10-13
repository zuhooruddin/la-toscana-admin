'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { LANG_COOKIE, type Lang } from './i18n-config';

export type { Lang };

let current: Lang = 'es';
/** Idempotent: keeps non-React helpers (formatters, label maps) in step with the provider's language. */
const setCurrent = (l: Lang) => {
  current = l;
};
/** Language for code that runs outside React components (formatters, label maps). */
export const getLang = (): Lang => current;

/** Pick the string for the active language. Outside components, prefer this over hooks. */
export const tr = (es: string, en: string) => (current === 'en' ? en : es);

/** A `Record<string,string>` whose values follow the active language. */
export function labels(table: Record<Lang, Record<string, string>>): Record<string, string> {
  return new Proxy(table.es, {
    get: (_t, key) => (typeof key === 'string' ? (table[current][key] ?? table.es[key]) : undefined),
    has: (t, key) => key in t,
  });
}

interface Ctx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const LangContext = createContext<Ctx>({ lang: 'es', setLang: () => {} });

export function I18nProvider({ initial, children }: { initial: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);
  setCurrent(lang); // during render so descendants read the right value on first paint
  const setLang = useCallback((l: Lang) => {
    setCurrent(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = l;
    setLangState(l);
  }, []);
  const value = useMemo(() => ({ lang, setLang }), [lang, setLang]);
  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);

/** `const t = useT(); t('Entrar', 'Sign in')` */
export function useT() {
  const { lang } = useLang();
  return useCallback((es: string, en: string) => (lang === 'en' ? en : es), [lang]);
}

/** BCP-47 locale for Intl formatters. */
export const intlLocale = () => (current === 'en' ? 'en-GB' : 'es-ES');

export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      type="button"
      className={className ?? 'icon-btn'}
      style={{ fontWeight: 700, fontSize: 12, minWidth: 44 }}
      onClick={() => setLang(lang === 'es' ? 'en' : 'es')}
      aria-label={lang === 'es' ? 'Switch to English' : 'Cambiar a español'}
      title={lang === 'es' ? 'Switch to English' : 'Cambiar a español'}
    >
      {lang === 'es' ? 'EN' : 'ES'}
    </button>
  );
}
