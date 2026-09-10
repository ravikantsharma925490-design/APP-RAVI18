import React from 'react';
import { MessageSquare, Search, Phone, User, Radio } from 'lucide-react';
import { cn } from '@/src/lib/utils';
import { useLanguage } from '@/src/lib/LanguageContext';

export type TabType = 'messages' | 'search' | 'calls' | 'call-history' | 'profile';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  missedCallsCount?: number;
  hide?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  missedCallsCount = 0,
  hide = false,
}) => {
  const { t } = useLanguage();

  if (hide) return null;

  // Unified tabs: 1. Messages, 2. Search ID, 3. Live Voice Rooms, 4. Calls, 5. Profile
  const navItems: Array<{
    id: TabType;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    isLive?: boolean;
  }> = [
    {
      id: 'messages',
      label: t('nav.messages', 'Messages'),
      icon: MessageSquare,
      badge: unreadCount,
    },
    {
      id: 'search',
      label: t('nav.search', 'Search ID'),
      icon: Search,
    },
    {
      id: 'calls',
      label: t('nav.calls', 'Calls'),
      icon: Phone,
      badge: missedCallsCount,
    },
    {
      id: 'profile',
      label: t('nav.profile', 'Profile'),
      icon: User,
    },
  ];

  return (
    <nav
      aria-label="Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-lg border-t border-neutral-200 dark:border-neutral-800 shadow-lg px-1 pb-[env(safe-area-inset-bottom,8px)] pt-1"
    >
      <div className="grid grid-cols-5 items-center justify-between max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'calls' && (activeTab as any) === 'call-history');

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={cn(
                'flex flex-col items-center justify-center py-1.5 px-0.5 rounded-2xl transition-all duration-150 relative min-h-[56px] cursor-pointer',
                isActive
                  ? item.isLive
                    ? 'text-red-600 dark:text-red-400 font-bold'
                    : 'text-blue-600 dark:text-blue-400 font-bold'
                  : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 font-medium'
              )}
            >
              <div className="relative flex items-center justify-center">
                <div
                  className={cn(
                    'p-1.5 rounded-xl transition-all',
                    isActive
                      ? item.isLive
                        ? 'bg-red-50 dark:bg-red-950/70 text-red-600 dark:text-red-400 scale-105'
                        : 'bg-blue-50 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 scale-105'
                      : 'bg-transparent text-current'
                  )}
                >
                  <Icon className="w-5 h-5" />
                </div>

                {/* Badge Indicator */}
                {Boolean(item.badge && item.badge > 0) && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center border-2 border-white dark:border-neutral-900 shadow-xs animate-in zoom-in">
                    {item.badge! > 99 ? '99+' : item.badge}
                  </span>
                )}

                {/* Live pulsing dot */}
                {item.isLive && !isActive && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                )}
              </div>

              <span
                className={cn(
                  'text-[9px] sm:text-[10px] tracking-tight leading-tight mt-0.5 transition-colors text-center truncate max-w-[60px]',
                  isActive
                    ? item.isLive
                      ? 'text-red-600 dark:text-red-400 font-bold'
                      : 'text-blue-600 dark:text-blue-400 font-bold'
                    : 'text-neutral-500 dark:text-neutral-400'
                )}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
