import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { translate, translateText, type LanguagePreference, type Locale } from './translate';
import { site } from '../seo';

export const LANGUAGE_STORAGE_KEY = 'rave-trail-language';

export function isLanguagePreference(value: unknown): value is LanguagePreference {
  return value === 'auto' || value === 'en' || value === 'pt-BR';
}

export function detectLanguage(languages: readonly string[]): Locale {
  for (const language of languages) {
    const base = language.trim().toLowerCase().split(/[-_]/)[0];
    if (base === 'pt') return 'pt-BR';
    if (base === 'en') return 'en';
  }
  return 'en';
}

function browserLanguage(): Locale {
  return typeof navigator === 'undefined' ? 'pt-BR' : detectLanguage([...navigator.languages, navigator.language]);
}

function readPreference(): LanguagePreference {
  try {
    const saved = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguagePreference(saved) ? saved : 'auto';
  } catch { return 'auto'; }
}

export function createI18n(locale: Locale) {
  return {
    locale,
    t: (source: Parameters<typeof translate>[1], values?: Parameters<typeof translate>[2]) => translate(locale, source, values),
    text: (source: string | null | undefined) => translateText(locale, source),
    currency: (amount: number) => new Intl.NumberFormat(locale === 'en' ? 'en-US' : locale, { style: 'currency', currency: 'USD' }).format(amount),
  };
}

const LanguageContext = createContext({ ...createI18n('pt-BR'), preference: 'auto' as LanguagePreference,
  setPreference: (_preference: LanguagePreference) => {} });

export function LanguageProvider({ children, pageTitle = site.title, deferDetection = false }: {
  children: ReactNode; pageTitle?: string; deferDetection?: boolean;
}) {
  // Hydrated public pages first match their Portuguese build-time HTML.
  const [preference, updatePreference] = useState<LanguagePreference>(() => deferDetection ? 'auto' : readPreference());
  const [detected, setDetected] = useState<Locale>(() => deferDetection ? 'pt-BR' : browserLanguage());
  const locale = preference === 'auto' ? detected : preference;
  const value = useMemo(() => ({ ...createI18n(locale), preference,
    setPreference(next: LanguagePreference) {
      if (!isLanguagePreference(next)) return;
      updatePreference(next);
      try { window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next); }
      catch { /* The selection still works when browser storage is unavailable. */ }
    },
  }), [locale, preference]);

  useEffect(() => {
    if (deferDetection) {
      updatePreference(readPreference());
      setDetected(browserLanguage());
    }
  }, [deferDetection]);

  useEffect(() => {
    const languageChanged = () => setDetected(browserLanguage());
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_STORAGE_KEY && event.key !== null) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; }
      catch { return; }
      updatePreference(isLanguagePreference(event.newValue) ? event.newValue : 'auto');
    };
    window.addEventListener('languagechange', languageChanged);
    window.addEventListener('storage', storageChanged);
    return () => {
      window.removeEventListener('languagechange', languageChanged);
      window.removeEventListener('storage', storageChanged);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = translateText(locale, pageTitle);
  }, [locale, pageTitle]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);
