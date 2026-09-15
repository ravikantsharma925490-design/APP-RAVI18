import React from 'react';
import { MessageSquare, Search, Phone, User, Radio, LogOut, Bell, Globe } from 'lucide-react';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';
import { Profile } from '@/src/types';
import { UserAvatar } from '../ui/UserAvatar';
import { useLanguage } from '@/src/lib/LanguageContext';
import { TabType } from './BottomNav';

interface SidebarNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  currentUser: Profile | null;
  unreadCount?: number;
  missedCallsCount?: number;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onSignOut: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  activeTab,
  onChangeTab,
  currentUser,
  unreadCount = 0,
  missedCallsCount = 0,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  onSignOut,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();

  // Unified Tabs: 1. Messages, 2. Search ID, 3. Live Voice, 4. Calls, 5. Profile
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
    <aside className="hidden md:flex flex-col w-64 lg:w-72 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
              LiveConnect
            </h1>
            <p className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {t('status.connected', 'Connected & Live')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Language Selector Button */}
          <button
            type="button"
            onClick={openLanguageModal}
            title={`${currentLanguage.nativeName} (${currentLanguage.name}) - Change Language`}
            className="p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span className="text-sm">{currentLanguage.flag}</span>
          </button>

          {/* Notifications Bell */}
          {onOpenNotifications && (
            <button
              type="button"
              onClick={onOpenNotifications}
              title="Notifications"
              className="relative p-2 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105 active:scale-95 cursor-pointer"
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

      {/* Navigation Menu */}
      <div className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        <div className="px-3 pb-2 flex items-center justify-between text-[11px] font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          <span>{t('nav.menu', 'Menu')}</span>
          <button
            onClick={openLanguageModal}
            className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Globe className="w-3 h-3" />
            <span>{currentLanguage.code.toUpperCase()}</span>
          </button>
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id || (item.id === 'calls' && (activeTab as any) === 'call-history');

          return (
            <button
              key={item.id}
              onClick={() => onChangeTab(item.id)}
              className={cn(
                'w-full flex items-center justify-between px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all duration-150 group cursor-pointer',
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800/80 hover:text-neutral-900 dark:hover:text-neutral-100'
              )}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={cn(
                    'p-1.5 rounded-xl transition-colors',
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover:text-neutral-900 dark:group-hover:text-neutral-100'
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <span className="truncate">{item.label}</span>
              </div>

              {Boolean(item.badge && item.badge > 0) && (
                <span
                  className={cn(
                    'px-2 py-0.5 text-xs font-bold rounded-full',
                    isActive
                      ? 'bg-white text-blue-600'
                      : 'bg-red-500 text-white'
                  )}
                >
                  {item.badge! > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* User Footer */}
      {currentUser && (
        <div className="p-3.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 flex items-center justify-between">
          <button
            onClick={() => onChangeTab('profile')}
            className="flex items-center gap-2.5 min-w-0 p-1.5 rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors text-left flex-1 group cursor-pointer"
          >
            <UserAvatar
              src={currentUser.avatar_url}
              name={currentUser.display_name}
              id={currentUser.id}
              className="w-9 h-9 border border-neutral-300 dark:border-neutral-700"
              showStatus
              isOnline={true}
            />

            <div className="min-w-0 flex-1">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 transition-colors">
                {currentUser.display_name}
              </h4>
              <p className="text-[11px] text-neutral-500 font-mono truncate">
                @{currentUser.username}
              </p>
            </div>
          </button>

          <button
            onClick={onSignOut}
            title="Sign Out"
            className="p-2 rounded-xl text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors ml-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      )}
    </aside>
  );
};
