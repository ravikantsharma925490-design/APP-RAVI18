import React, { useState, useEffect } from 'react';
import {
  User,
  LogOut,
  Edit3,
  Moon,
  Sun,
  Shield,
  Bell,
  ChevronRight,
  HelpCircle,
  Users,
  UserCheck,
  UserX,
  Globe,
} from 'lucide-react';
import { Profile } from '@/src/types';
import { cn, getAvatarColor, getInitials, formatJoinedYear } from '@/src/lib/utils';
import { UserAvatar } from '../ui/UserAvatar';
import { useLanguage } from '@/src/lib/LanguageContext';
import { HelpCenter } from '../profile/HelpCenter';
import { COUNTRIES, GENDER_OPTIONS } from '../profile/ProfileModal';
import { NotificationsModal } from '../settings/NotificationsModal';
import { BlockedUsersModal } from '../settings/BlockedUsersModal';
import { FollowsListModal } from '../profile/FollowsListModal';
import { FollowStatus } from '../profile/FollowButton';

interface ProfileTabProps {
  currentUser: Profile | null;
  blockedUserIds?: Set<string> | string[];
  onUnblockUser?: (userId: string) => Promise<boolean | void>;
  onEditProfile: () => void;
  onOpenSettingsModal: () => void;
  onOpenConfigModal: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onSignOut: () => void;
  followersCount?: number;
  followingCount?: number;
  fetchFollowers?: (userId: string) => Promise<Profile[]>;
  fetchFollowing?: (userId: string) => Promise<Profile[]>;
  getFollowStatus?: (userId: string) => FollowStatus;
  onFollow?: (target: Profile | string) => Promise<boolean | void>;
  onUnfollow?: (target: Profile | string) => Promise<boolean | void>;
  onSelectUser?: (user: Profile) => void;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  currentUser,
  blockedUserIds = new Set(),
  onUnblockUser,
  onEditProfile,
  onOpenSettingsModal,
  onOpenConfigModal,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onSignOut,
  followersCount = 0,
  followingCount = 0,
  fetchFollowers,
  fetchFollowing,
  getFollowStatus,
  onFollow,
  onUnfollow,
  onSelectUser,
}) => {
  const { currentLanguage, openLanguageModal, t } = useLanguage();
  // Theme state
  const [isDarkMode, setIsDarkMode] = useState<boolean>(true);

  // Modal open states
  const [isNotifModalOpen, setIsNotifModalOpen] = useState(false);
  const [isBlockedModalOpen, setIsBlockedModalOpen] = useState(false);
  const [showFollowsModal, setShowFollowsModal] = useState(false);
  const [followsListInitialTab, setFollowsListInitialTab] = useState<'followers' | 'following'>('followers');

  const [showSignOutConfirm, setShowSignOutConfirm] = useState<boolean>(false);
  const [showHelpCenter, setShowHelpCenter] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname.startsWith('/app/help');
    }
    return false;
  });
  const [initialShowPrivacy, setInitialShowPrivacy] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/app/help/privacy';
    }
    return false;
  });
  const [initialShowTerms, setInitialShowTerms] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname === '/app/help/terms';
    }
    return false;
  });

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
  }, []);

  const handleOpenHelpCenter = (view: 'default' | 'privacy' | 'terms' = 'default') => {
    setInitialShowPrivacy(view === 'privacy');
    setInitialShowTerms(view === 'terms');
    setShowHelpCenter(true);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      let route = '/app/help';
      if (view === 'privacy') route = '/app/help/privacy';
      else if (view === 'terms') route = '/app/help/terms';
      window.history.pushState({}, '', route);
    }
  };

  const handleBackFromHelpCenter = () => {
    setShowHelpCenter(false);
    setInitialShowPrivacy(false);
    setInitialShowTerms(false);
    if (typeof window !== 'undefined' && window.history?.pushState) {
      window.history.pushState({}, '', '/app/profile');
    }
  };

  // Theme Toggle
  const toggleTheme = () => {
    const root = document.documentElement;
    if (root.classList.contains('dark')) {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  if (!currentUser) return null;

  if (showHelpCenter) {
    return (
      <HelpCenter
        currentUser={currentUser}
        initialShowPrivacy={initialShowPrivacy}
        initialShowTerms={initialShowTerms}
        onBack={handleBackFromHelpCenter}
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden">
      {/* Header */}
      <header className="p-4 md:p-6 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2.5">
            <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>{t('title.myProfile', 'My Profile')}</span>
          </h2>
          <p className="text-xs text-neutral-500 font-medium mt-0.5">
            {t('desc.profileSubtitle', 'Manage your profile, notifications, and device permissions')}
          </p>
        </div>

        <button
          onClick={onEditProfile}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
        >
          <Edit3 className="w-4 h-4" />
          <span>{t('action.editProfile', 'Edit Profile')}</span>
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-2xl mx-auto space-y-5">
          {/* User Card */}
          <div className="p-6 md:p-8 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 relative z-10 text-center sm:text-left">
              {/* Profile Avatar */}
              <UserAvatar
                src={currentUser.avatar_url}
                name={currentUser.display_name}
                id={currentUser.id}
                className="w-24 h-24 rounded-3xl border-2 border-white dark:border-neutral-800 shadow-md"
                showStatus
                isOnline={true}
              />

              {/* User Bio Details */}
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                  <h3 className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 truncate">
                    {currentUser.display_name}
                  </h3>
                  <span className="text-xs font-mono font-medium text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2.5 py-0.5 rounded-full self-center sm:self-auto">
                    @{currentUser.username}
                  </span>
                </div>

                <p className="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed pt-1">
                  {currentUser.bio || 'Hey there! I am using LiveConnect for real-time messaging and HD calls.'}
                </p>

                {/* Followers & Following Counters */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFollowsListInitialTab('followers');
                      setShowFollowsModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer group"
                  >
                    <Users className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {followersCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Followers
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setFollowsListInitialTab('following');
                      setShowFollowsModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-950/40 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-800 transition-all cursor-pointer group"
                  >
                    <UserCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100">
                      {followingCount}
                    </span>
                    <span className="text-[11px] text-neutral-500 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Following
                    </span>
                  </button>
                </div>

                {/* Gender & Country Badges */}
                {(currentUser.gender || currentUser.country) && (
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-2">
                    {currentUser.gender && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                        <span>{GENDER_OPTIONS.find((g) => g.id === currentUser.gender)?.emoji || '👤'}</span>
                        <span>{currentUser.gender}</span>
                      </span>
                    )}
                    {currentUser.country && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700">
                        <span>{COUNTRIES.find((c) => c.name === currentUser.country)?.flag || '🌍'}</span>
                        <span>{currentUser.country}</span>
                      </span>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-3 text-xs text-neutral-400 font-medium">
                  <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    Online
                  </span>
                  <span>•</span>
                  <span>Active Now</span>
                  {currentUser.created_at && (
                    <>
                      <span>•</span>
                      <span>{t('status.joined', 'Joined')} {formatJoinedYear(currentUser.created_at)}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Settings Section */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs overflow-hidden divide-y divide-neutral-100 dark:divide-neutral-800">
            <div className="px-6 py-4 bg-neutral-50/50 dark:bg-neutral-800/30 flex items-center justify-between">
              <h4 className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                Settings & Preferences
              </h4>
            </div>

            {/* 1. App Language Selector */}
            <button
              onClick={openLanguageModal}
              className="w-full p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 transition-colors">
                      {t('title.appLanguage', 'App Language')}
                    </h5>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      {currentLanguage.flag} {currentLanguage.nativeName}
                    </span>
                  </div>
                  <p className="text-xs text-neutral-500">
                    {currentLanguage.name} ({currentLanguage.country}) • 100+ World Languages available
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 2. Dark Mode Theme */}
            <div className="p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500 dark:bg-blue-500/10 dark:text-blue-400">
                  {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </div>
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    {t('title.darkMode', 'Dark Mode Theme')}
                  </h5>
                  <p className="text-xs text-neutral-500">
                    {isDarkMode ? t('desc.darkModeOn', 'Dark theme enabled') : t('desc.darkModeOff', 'Light theme enabled')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isDarkMode}
                onClick={toggleTheme}
                className={cn(
                  'relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out',
                  isDarkMode ? 'bg-blue-600' : 'bg-neutral-300 dark:bg-neutral-700'
                )}
              >
                <span
                  className={cn(
                    'pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out',
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  )}
                />
              </button>
            </div>

            {/* 3. Notifications Modal */}
            <button
              onClick={() => setIsNotifModalOpen(true)}
              className="w-full p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <Bell className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-purple-600 transition-colors">
                    {t('title.notifications', 'Notifications')}
                  </h5>
                  <p className="text-xs text-neutral-500">
                    {t('desc.notificationsSub', 'Call ringtones, message alert sounds, and push alerts')}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 4. App Permissions Modal */}
            <button
              onClick={onOpenSettingsModal}
              className="w-full p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-emerald-600 transition-colors">
                    {t('title.permissions', 'Permissions')}
                  </h5>
                  <p className="text-xs text-neutral-500">
                    {t('desc.permissionsSub', 'Microphone & Camera switches and hardware test')}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 5. Blocked Accounts / Users */}
            <button
              onClick={() => setIsBlockedModalOpen(true)}
              className="w-full p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
                  <UserX className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-red-600 transition-colors">
                      {t('title.blockedUsers', 'Blocked Accounts')}
                    </h5>
                    {Array.from(blockedUserIds || []).length > 0 && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                        {Array.from(blockedUserIds || []).length}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-500">
                    {Array.from(blockedUserIds || []).length > 0
                      ? `${Array.from(blockedUserIds || []).length} blocked user${Array.from(blockedUserIds || []).length === 1 ? '' : 's'} • View & unblock`
                      : t('desc.blockedUsersSub', 'Manage and unblock restricted users')}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

            {/* 6. Help Center & Privacy */}
            <button
              onClick={() => handleOpenHelpCenter('default')}
              className="w-full p-4 md:px-6 flex items-center justify-between hover:bg-neutral-50/50 dark:hover:bg-neutral-800/40 transition-colors text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-500">
                  <HelpCircle className="w-5 h-5" />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 group-hover:text-blue-600 transition-colors">
                    {t('title.helpCenter', 'Help Center & Privacy')}
                  </h5>
                  <p className="text-xs text-neutral-500">
                    {t('desc.helpCenterSub', 'FAQ, guides, call assistance & contact support')}
                  </p>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-neutral-400 group-hover:translate-x-0.5 transition-transform" />
            </button>

          </div>

          {/* Sign Out Card */}
          <div className="rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 shadow-xs p-5 space-y-3">
            {!showSignOutConfirm ? (
              <button
                onClick={() => setShowSignOutConfirm(true)}
                className="w-full py-3 rounded-2xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 border border-red-200/80 dark:border-red-900/50 font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-98 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
            ) : (
              <div className="space-y-3 p-2 animate-in fade-in">
                <div className="text-center">
                  <h5 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
                    Are you sure you want to sign out?
                  </h5>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    You can log back in anytime with your email and password.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={() => setShowSignOutConfirm(false)}
                    className="py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onSignOut}
                    className="py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-semibold text-xs transition-colors shadow-xs cursor-pointer"
                  >
                    Confirm Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Notifications Modal */}
      <NotificationsModal
        isOpen={isNotifModalOpen}
        onClose={() => setIsNotifModalOpen(false)}
      />

      {/* Blocked Accounts Management Modal */}
      <BlockedUsersModal
        isOpen={isBlockedModalOpen}
        onClose={() => setIsBlockedModalOpen(false)}
        blockedUserIds={blockedUserIds}
        onUnblock={async (userId) => {
          if (onUnblockUser) {
            await onUnblockUser(userId);
          }
        }}
        currentUserId={currentUser.id}
      />

      {/* Follows List Modal */}
      {fetchFollowers && fetchFollowing && (
        <FollowsListModal
          isOpen={showFollowsModal}
          onClose={() => setShowFollowsModal(false)}
          userId={currentUser.id}
          userDisplayName={currentUser.display_name}
          initialTab={followsListInitialTab}
          currentUserId={currentUser.id}
          onSelectUser={(u) => {
            setShowFollowsModal(false);
            if (onSelectUser) {
              onSelectUser(u);
            }
          }}
          getFollowStatus={getFollowStatus}
          onFollow={onFollow}
          onUnfollow={onUnfollow}
          fetchFollowers={fetchFollowers}
          fetchFollowing={fetchFollowing}
          followersCount={followersCount}
          followingCount={followingCount}
        />
      )}
    </div>
  );
};
