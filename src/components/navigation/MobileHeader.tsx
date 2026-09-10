import React from 'react';
import { Radio, Bell } from 'lucide-react';
import { useLanguage } from '@/src/lib/LanguageContext';

interface MobileHeaderProps {
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  hide?: boolean;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  unreadNotificationsCount = 0,
  onOpenNotifications,
  hide = false,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();

  if (hide) return null;

  return (
    <div className="md:hidden p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
          <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
        <div>
          <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
            LiveConnect
          </h1>
          <p className="text-[10px] sm:text-[11px] font-semibold text-emerald-500 flex items-center gap-1 sm:gap-1.5 leading-tight mt-0.5">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-500 animate-pulse" />
            {t('status.connected', 'Connected & Live')}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={openLanguageModal}
          title={`${currentLanguage.nativeName} (${currentLanguage.name}) - Change Language`}
          className="p-1.5 sm:p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
        >
          <span className="text-sm">{currentLanguage.flag}</span>
        </button>

        {onOpenNotifications && (
          <button
            type="button"
            onClick={onOpenNotifications}
            title="Notifications"
            className="relative p-1.5 sm:p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-900 animate-pulse">
                {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
