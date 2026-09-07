import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WORLD_LANGUAGES, WORLD_COUNTRIES, WorldLanguage, WorldCountry } from './worldData';
import { TRANSLATIONS, TranslationKeys } from './translations';

interface LanguageContextType {
  currentLanguage: WorldLanguage;
  setLanguage: (langCode: string) => void;
  t: (key: keyof TranslationKeys | string, fallback?: string) => string;
  isRTL: boolean;
  dir: 'ltr' | 'rtl';
  allLanguages: WorldLanguage[];
  allCountries: WorldCountry[];
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState<WorldLanguage>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('liveconnect_language');
      if (saved) {
        const found = WORLD_LANGUAGES.find((l) => l.code === saved || l.code.startsWith(saved));
        if (found) return found;
      }
      // Auto detect browser language if available
      try {
        const browserLang = navigator.language;
        if (browserLang) {
          const matched = WORLD_LANGUAGES.find(
            (l) => l.code === browserLang || l.code === browserLang.split('-')[0]
          );
          if (matched) return matched;
        }
      } catch (e) {
        // Safe fallback
      }
    }
    return WORLD_LANGUAGES[0]; // English default
  });

  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  const openLanguageModal = useCallback(() => setIsLanguageModalOpen(true), []);
  const closeLanguageModal = useCallback(() => setIsLanguageModalOpen(false), []);

  const setLanguage = useCallback((langCode: string) => {
    const found = WORLD_LANGUAGES.find(
      (l) => l.code.toLowerCase() === langCode.toLowerCase() || l.code.split('-')[0].toLowerCase() === langCode.toLowerCase()
    );
    if (found) {
      setCurrentLanguage(found);
      if (typeof window !== 'undefined') {
        localStorage.setItem('liveconnect_language', found.code);
        document.documentElement.lang = found.code;
        document.documentElement.dir = found.dir;
      }
    }
  }, []);

  // Update HTML tag dir and lang on mount/change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.lang = currentLanguage.code;
      document.documentElement.dir = currentLanguage.dir;
    }
  }, [currentLanguage]);

  // Translate helper
  const t = useCallback(
    (key: keyof TranslationKeys | string, fallback?: string): string => {
      const code = currentLanguage.code.split('-')[0];
      const langDict = TRANSLATIONS[currentLanguage.code] || TRANSLATIONS[code];

      if (langDict && (langDict as any)[key]) {
        return (langDict as any)[key];
      }

      // English fallback
      const enDict = TRANSLATIONS['en'];
      if (enDict && (enDict as any)[key]) {
        return (enDict as any)[key];
      }

      return fallback || key;
    },
    [currentLanguage]
  );

  const value: LanguageContextType = {
    currentLanguage,
    setLanguage,
    t,
    isRTL: currentLanguage.dir === 'rtl',
    dir: currentLanguage.dir,
    allLanguages: WORLD_LANGUAGES,
    allCountries: WORLD_COUNTRIES,
    isLanguageModalOpen,
    openLanguageModal,
    closeLanguageModal,
  };

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
