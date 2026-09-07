import React, { useState, useMemo } from 'react';
import { X, Search, Globe, Check, Sparkles, Languages } from 'lucide-react';
import { useLanguage } from '@/src/lib/LanguageContext';
import { WorldLanguage } from '@/src/lib/worldData';
import { cn } from '@/src/lib/utils';

export const LanguageSelectorModal: React.FC = () => {
  const {
    currentLanguage,
    setLanguage,
    isLanguageModalOpen,
    closeLanguageModal,
    allLanguages,
    t,
  } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<string>('All');

  const regions = ['All', 'Asia & Pacific', 'Europe', 'Americas', 'Middle East', 'Africa'];

  const filteredLanguages = useMemo(() => {
    return allLanguages.filter((lang) => {
      // Region filter
      if (selectedRegion !== 'All' && lang.region !== selectedRegion) {
        return false;
      }

      // Search query filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        lang.name.toLowerCase().includes(q) ||
        lang.nativeName.toLowerCase().includes(q) ||
        lang.country.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
      );
    });
  }, [allLanguages, selectedRegion, searchQuery]);

  if (!isLanguageModalOpen) return null;

  const handleSelectLanguage = (lang: WorldLanguage) => {
    setLanguage(lang.code);
    closeLanguageModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="language-modal-title"
        className="w-full max-w-2xl bg-white dark:bg-neutral-900 rounded-3xl shadow-2xl border border-neutral-200 dark:border-neutral-800 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="p-5 md:p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/50 dark:bg-neutral-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 flex items-center justify-center">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <h3 id="language-modal-title" className="text-lg font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span>{t('action.selectLanguage', 'Select App Language')}</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                  {allLanguages.length}+ Languages
                </span>
              </h3>
              <p className="text-xs text-neutral-500 mt-0.5">
                {t('desc.languageSubtitle', 'Choose your preferred language for the whole app')}
              </p>
            </div>
          </div>

          <button
            onClick={closeLanguageModal}
            className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Region Filter */}
        <div className="p-4 md:px-6 border-b border-neutral-200 dark:border-neutral-800 space-y-3 bg-white dark:bg-neutral-900">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by language, country, or native script (e.g. Hindi, हिन्दी, Español, العربية)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm placeholder-neutral-400 outline-none focus:ring-2 focus:ring-blue-500 border border-transparent dark:border-neutral-700 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 px-1.5 py-0.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700"
              >
                Clear
              </button>
            )}
          </div>

          {/* Region Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            {regions.map((reg) => (
              <button
                key={reg}
                onClick={() => setSelectedRegion(reg)}
                className={cn(
                  'px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer',
                  selectedRegion === reg
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                )}
              >
                {reg}
              </button>
            ))}
          </div>
        </div>

        {/* Language Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 divide-y divide-neutral-100 dark:divide-neutral-800/60 max-h-[480px]">
          {filteredLanguages.length === 0 ? (
            <div className="py-12 text-center text-neutral-400">
              <Languages className="w-10 h-10 mx-auto mb-2 opacity-40 animate-pulse" />
              <p className="text-sm font-semibold">No language found for &quot;{searchQuery}&quot;</p>
              <p className="text-xs text-neutral-500 mt-1">Try searching with a different country or English name</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredLanguages.map((lang) => {
                const isSelected = currentLanguage.code === lang.code;

                return (
                  <button
                    key={lang.code}
                    onClick={() => handleSelectLanguage(lang)}
                    className={cn(
                      'p-3.5 rounded-2xl flex items-center justify-between text-left transition-all border group cursor-pointer',
                      isSelected
                        ? 'bg-blue-50/80 dark:bg-blue-950/50 border-blue-500 dark:border-blue-500/80 shadow-xs'
                        : 'bg-neutral-50/60 dark:bg-neutral-800/40 border-neutral-200/80 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700'
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-2xl shrink-0 drop-shadow-xs" role="img" aria-label={lang.country}>
                        {lang.flag}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4
                            className={cn(
                              'text-sm font-bold truncate',
                              isSelected
                                ? 'text-blue-600 dark:text-blue-400'
                                : 'text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            )}
                          >
                            {lang.nativeName}
                          </h4>
                          {lang.dir === 'rtl' && (
                            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                              RTL
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                          {lang.name} • {lang.country}
                        </p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 flex items-center justify-between text-xs text-neutral-500">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Currently: <strong className="text-neutral-900 dark:text-neutral-100">{currentLanguage.flag} {currentLanguage.nativeName} ({currentLanguage.name})</strong></span>
          </div>

          <button
            onClick={closeLanguageModal}
            className="px-4 py-1.5 rounded-xl bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 font-semibold cursor-pointer"
          >
            {t('action.cancel', 'Close')}
          </button>
        </div>
      </div>
    </div>
  );
};
