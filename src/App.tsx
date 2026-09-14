import React, { useState, useMemo, useEffect, useCallback } from 'react';
import logoImage from './assets/logo.png';
import { useAuth } from '@/src/hooks/useAuth';
import { usePresence } from '@/src/hooks/usePresence';
import { useConversations } from '@/src/hooks/useConversations';
import { useCall } from '@/src/hooks/useCall';
import { useCallHistory } from '@/src/hooks/useCallHistory';
import { useSocialRelations } from '@/src/hooks/useSocialRelations';
import { useNotifications } from '@/src/hooks/useNotifications';
import { AuthPage } from '@/src/components/auth/AuthPage';
import { BottomNav, TabType } from '@/src/components/navigation/BottomNav';
import { SidebarNav } from '@/src/components/navigation/SidebarNav';
import { MobileHeader } from '@/src/components/navigation/MobileHeader';
import { MessagesTab } from '@/src/components/tabs/MessagesTab';
import { SearchTab } from '@/src/components/tabs/SearchTab';
import { CallsTab } from '@/src/components/tabs/CallsTab';
import { ProfileTab } from '@/src/components/tabs/ProfileTab';
import { UserSearchModal } from '@/src/components/chat/UserSearchModal';
import { IncomingCallModal } from '@/src/components/calls/IncomingCallModal';
import { AudioCallScreen } from '@/src/components/calls/AudioCallScreen';
import { VideoCallScreen } from '@/src/components/calls/VideoCallScreen';
import { ProfileModal } from '@/src/components/profile/ProfileModal';
import { SettingsModal } from '@/src/components/settings/SettingsModal';
import { ConfigModal } from '@/src/components/setup/ConfigModal';
import { NotificationModal } from '@/src/components/notifications/NotificationModal';
import { LanguageSelectorModal } from '@/src/components/language/LanguageSelectorModal';
import { Toast } from '@/src/components/ui/Toast';
import { PushBanner } from '@/src/components/ui/PushBanner';
import { TermsConditions } from '@/src/components/legal/TermsConditions';
import { PrivacyPolicy } from '@/src/components/legal/PrivacyPolicy';
import { DeleteAccountPage } from '@/src/components/legal/DeleteAccountPage';
import { OnboardingScreen } from '@/src/components/auth/OnboardingScreen';
import { BannedScreen } from '@/src/components/auth/BannedScreen';
import { Profile } from '@/src/types';

export default function App() {
  const {
    user,
    profile,
    loading: authLoading,
    authError,
    setAuthError,
    signUp,
    signIn,
    signInWithGoogle,
    sendLoginOtp,
    signOut,
    resetPassword,
    updatePassword,
    isPasswordRecovery,
    setIsPasswordRecovery,
    needsOnboarding,
    onboardingUser,
    profileCheckPending,
    bannedUntilDate,
    completeOnboarding,
    updateProfile,
    refreshProfile,
  } = useAuth();

  const { isUserOnline, getUserLastSeen } = usePresence(user?.id);

  const activeUserProfile = useMemo<Profile | null>(() => {
    if (profile) return profile;
    if (user) {
      const email = user.email || '';
      const baseName = email.split('@')[0] || 'user';
      return {
        id: user.id,
        username: user.user_metadata?.username || baseName.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase(),
        display_name: user.user_metadata?.display_name || user.user_metadata?.full_name || baseName,
        avatar_url: user.user_metadata?.avatar_url || null,
        bio: 'Hey there! I am using LiveConnect.',
        is_online: true,
        last_seen: new Date().toISOString(),
        created_at: user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }, [profile, user]);

  // Social Relations (Follow, Follow-Back, Mutual, Block/Unblock)
  const socialRelations = useSocialRelations(activeUserProfile || profile);

  // Real-time In-App Notifications
  const {
    notifications,
    unreadCount: unreadNotificationsCount,
    markAsRead: markNotificationAsRead,
    markAllAsRead: markAllNotificationsAsRead,
    deleteNotification,
  } = useNotifications(user?.id);

  const [isNotificationOpen, setIsNotificationOpen] = useState(false);

  // Active Tab: 1. Messages (Default landing), 2. Search ID, 3. Calls, 4. Call History, 5. Profile
  const [activeTab, setActiveTab] = useState<TabType>('messages');

  const {
    conversations,
    loading: convLoading,
    activeConversationId,
    setActiveConversationId,
    fetchConversations,
    searchUsers,
    startConversation,
    deleteConversation,
    markConversationAsRead,
  } = useConversations(user?.id, activeTab);

  const {
    incomingCall,
    activeCallState,
    connectionState,
    callError,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    switchCamera,
    clearCallError,
  } = useCall(activeUserProfile);

  const {
    history: callHistory,
    loading: historyLoading,
    missedCount: missedCallsCount,
    refetch: refetchCallHistory,
    deleteCall,
    clearAllHistory,
    markHistoryAsViewed,
  } = useCallHistory(user?.id);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null);

  // Password Recovery form state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordUpdateError, setPasswordUpdateError] = useState<string | null>(null);
  const [passwordUpdateSuccess, setPasswordUpdateSuccess] = useState(false);

  // Calculate total unread messages count (active open chat messages are only excluded if currently viewing messages tab)
  const totalUnreadCount = useMemo(() => {
    return conversations.reduce((acc, c) => {
      const isActivelyViewingThisChat =
        typeof document !== 'undefined' &&
        !document.hidden &&
        activeTab === 'messages' &&
        c.id === activeConversationId;

      if (isActivelyViewingThisChat) return acc;
      return acc + (c.unread_count || 0);
    }, 0);
  }, [conversations, activeConversationId, activeTab]);

  // Sync browser path simulation for routing consistency
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;

      if (path === '/app/messages' || path === '/app' || path === '/' || path === '') {
        setActiveTab('messages');
      } else if (path === '/app/search') {
        setActiveTab('search');
      } else if (path === '/app/calls' || path === '/app/call-history') {
        setActiveTab('calls');
        markHistoryAsViewed();
      } else if (path === '/app/profile' || path.startsWith('/app/help') || path === '/app/subscription') {
        setActiveTab('profile');
      }
    }
  }, [markHistoryAsViewed]);

  const handleTabChange = (tab: TabType) => {
    const nextTab = tab === 'call-history' ? 'calls' : tab;
    setActiveTab(nextTab);
    if (nextTab === 'calls') {
      markHistoryAsViewed();
    }
    if (typeof window !== 'undefined' && window.history?.pushState) {
      const targetRoute = nextTab === 'messages' ? '/app' : `/app/${nextTab}`;
      window.history.pushState({}, '', targetRoute);
    }
  };

  // Splash screen state: runs strictly for full 3.8 seconds on launch
  const [minSplashDone, setMinSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMinSplashDone(true);
    }, 3800);
    return () => clearTimeout(timer);
  }, []);

  // Loading initial auth or playing full splash screen
  if (!minSplashDone || authLoading || profileCheckPending) {
    return (
      <div 
        className="min-h-screen-safe w-full flex items-center justify-center bg-black relative overflow-hidden select-none"
      >
        <style>{`
          @keyframes splashGlow {
            0% { opacity: 0; transform: scale(0.6); filter: blur(20px); }
            50% { opacity: 0.9; filter: blur(10px); }
            100% { opacity: 0.6; transform: scale(1.4); filter: blur(30px); }
          }
          @keyframes splashLogoIn {
            0% { opacity: 0; transform: scale(0.6) translateY(10px); }
            60% { opacity: 1; transform: scale(1.1) translateY(0); }
            100% { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes splashPulse {
            0%, 100% { opacity: 0.5; }
            50% { opacity: 1; }
          }
          @keyframes splashRingPulse {
            0% { transform: scale(0.9); opacity: 0.7; }
            100% { transform: scale(1.6); opacity: 0; }
          }
          .splash-glow {
            animation: splashGlow 2.2s ease-out infinite alternate;
          }
          .splash-logo {
            animation: splashLogoIn 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          }
          .splash-ring {
            animation: splashRingPulse 1.8s ease-out infinite;
          }
          .splash-tagline {
            animation: splashPulse 1.6s ease-in-out infinite;
            animation-delay: 0.8s;
            opacity: 0;
            animation-fill-mode: forwards;
          }
        `}</style>

        <div
          className="splash-glow absolute w-80 h-80 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(79,70,229,0.55) 0%, rgba(124,58,237,0.4) 35%, rgba(251,113,133,0.25) 60%, transparent 75%)',
          }}
        />

        <div className="relative flex flex-col items-center">
          <div className="relative flex items-center justify-center">
            <div className="splash-ring absolute w-40 h-40 rounded-full border-2 border-purple-400/60" />
            <div className="splash-logo relative w-28 h-28 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-cyan-400 via-purple-500 to-pink-500 shadow-[0_0_40px_rgba(168,85,247,0.75)] flex items-center justify-center">
              <img
                src={logoImage}
                alt="LiveConnect"
                className="w-full h-full object-cover rounded-full scale-110"
              />
            </div>
          </div>
          <p className="splash-tagline text-xs font-semibold text-purple-300 tracking-[0.3em] uppercase mt-6">
            Connecting you now
          </p>
        </div>
      </div>
    );
  }

  if (bannedUntilDate && new Date(bannedUntilDate).getTime() > Date.now()) {
    return <BannedScreen bannedUntil={bannedUntilDate} />;
  }

  if (isPasswordRecovery) {
    const handleSetNewPassword = async (e: React.FormEvent) => {
      e.preventDefault();
      setPasswordUpdateError(null);
      if (newPassword.length < 6) {
        setPasswordUpdateError('Password must be at least 6 characters.');
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setPasswordUpdateError('Passwords do not match.');
        return;
      }
      try {
        await updatePassword(newPassword);
        setPasswordUpdateSuccess(true);
        setTimeout(() => {
          window.history.pushState({}, '', '/app');
          window.location.href = '/';
        }, 1500);
      } catch (err: any) {
        setPasswordUpdateError(err.message || 'Failed to update password.');
      }
    };

    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-950 text-white px-6">
        <div className="w-full max-w-sm">
          <h2 className="text-xl font-bold text-center mb-2">Set a new password</h2>
          <p className="text-sm text-neutral-400 text-center mb-6">
            Enter a new password for your account.
          </p>
          {passwordUpdateSuccess ? (
            <p className="text-sm text-green-400 text-center">
              Password updated! Redirecting you to the app...
            </p>
          ) : (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password"
                className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                className="w-full py-3 px-4 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {passwordUpdateError && (
                <p className="text-sm text-red-400 text-center">{passwordUpdateError}</p>
              )}
              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold cursor-pointer transition-colors"
              >
                Update Password
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Public standalone view of Terms, Privacy & Delete Account Policy
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    if (pathname === '/app/help/delete-account' || pathname === '/delete-account') {
      return (
        <div className="h-screen-safe w-screen bg-neutral-950 text-white overflow-hidden">
          <DeleteAccountPage
            onBack={() => {
              window.history.pushState({}, '', '/app');
              window.location.href = '/';
            }}
          />
        </div>
      );
    }
  }

  // Unauthenticated view (Support public standalone view of Terms & Privacy for App Store / Play Store Review)
  if (!user || (!profile && !needsOnboarding)) {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/app/help/terms' || pathname === '/terms') {
        return (
          <div className="h-screen-safe w-screen bg-neutral-950 text-white overflow-hidden">
            <TermsConditions
              onBack={() => {
                window.history.pushState({}, '', '/app');
                window.location.href = '/';
              }}
            />
          </div>
        );
      }
      if (pathname === '/app/help/privacy' || pathname === '/privacy') {
        return (
          <div className="h-screen-safe w-screen bg-neutral-950 text-white overflow-hidden">
            <PrivacyPolicy
              onBack={() => {
                window.history.pushState({}, '', '/app');
                window.location.href = '/';
              }}
            />
          </div>
        );
      }
    }

    return (
      <>
        <AuthPage
          onGoogleSignIn={signInWithGoogle}
          authError={authError}
          clearError={() => setAuthError(null)}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
        <LanguageSelectorModal />
        {callError && (
          <Toast
            title="Notice"
            message={callError}
            type="error"
            onClose={clearCallError}
          />
        )}
      </>
    );
  }

  // Onboarding view for brand-new users (Google OAuth / missing profile)
  if (needsOnboarding && (onboardingUser || user)) {
    const activeUser = onboardingUser || user;
    const prefillName =
      activeUser?.user_metadata?.full_name ||
      activeUser?.user_metadata?.name ||
      activeUser?.user_metadata?.display_name ||
      activeUser?.email?.split('@')[0] ||
      '';
    const prefillAvatar =
      activeUser?.user_metadata?.avatar_url ||
      activeUser?.user_metadata?.picture ||
      '';
    const prefillEmail = activeUser?.email || '';

    return (
      <OnboardingScreen
        prefillName={prefillName}
        prefillAvatar={prefillAvatar}
        prefillEmail={prefillEmail}
        onComplete={completeOnboarding}
      />
    );
  }

  const isCallActive = Boolean(activeCallState || incomingCall);

  return (
    <div className="h-screen-safe w-screen flex flex-col md:flex-row bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
      {/* 1. Desktop Left Navigation Rail (Shows exact 6 tabs in order) */}
      <SidebarNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        currentUser={profile}
        unreadCount={totalUnreadCount}
        missedCallsCount={missedCallsCount}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationOpen(true)}
        onSignOut={signOut}
      />

      {/* 2. Main Tab View Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <MobileHeader
          unreadNotificationsCount={unreadNotificationsCount}
          onOpenNotifications={() => setIsNotificationOpen(true)}
          hide={
            isCallActive ||
            (activeTab === 'messages' && Boolean(activeConversationId))
          }
        />

        {/* Tab 1: Messages (💬) */}
        {activeTab === 'messages' && (
          <MessagesTab
            conversations={conversations}
            activeConversationId={activeConversationId}
            loading={convLoading}
            currentUser={profile}
            onSelectConversation={(id) => setActiveConversationId(id)}
            onOpenSearch={() => setIsSearchOpen(true)}
            onStartCall={startCall}
            onOpenProfileView={(p) => {
              setViewingProfile(p);
              setIsProfileOpen(true);
            }}
            onDeleteConversation={deleteConversation}
            isUserOnline={isUserOnline}
            getUserLastSeen={getUserLastSeen}
            getRelationStatus={socialRelations.getRelationStatus}
            onFollow={socialRelations.followUser}
            onUnblock={socialRelations.unblockUser}
          />
        )}

        {/* Tab 2: Search ID / Find Users (🔎) */}
        {activeTab === 'search' && (
          <SearchTab
            currentUser={profile}
            onSearchUsers={searchUsers}
            onStartChat={async (targetId, targetProfile) => {
              setActiveTab('messages');
              const convId = await startConversation(targetId, targetProfile);
              if (convId) {
                setActiveConversationId(convId);
              }
            }}
            onStartCall={startCall}
            onViewProfile={(p) => {
              setViewingProfile(p);
              setIsProfileOpen(true);
            }}
            isUserOnline={isUserOnline}
            getRelationStatus={socialRelations.getRelationStatus}
            getFollowStatus={socialRelations.getFollowStatus}
            onFollow={socialRelations.followUser}
            onUnfollow={socialRelations.unfollowUser}
          />
        )}

        {/* Tab 3: Unified Calls & Call History (📞 / 🕘) */}
        {(activeTab === 'calls' || (activeTab as any) === 'call-history') && (
          <CallsTab
            currentUser={profile}
            conversations={conversations}
            onStartCall={startCall}
            onOpenProfileView={(p) => {
              setViewingProfile(p);
              setIsProfileOpen(true);
            }}
            isUserOnline={isUserOnline}
            onOpenSearchModal={() => setIsSearchOpen(true)}
            isBlocked={socialRelations.isBlocked}
            history={callHistory}
            historyLoading={historyLoading}
            onRefreshHistory={refetchCallHistory}
            onDeleteCall={deleteCall}
            onClearAllHistory={clearAllHistory}
            onMarkHistoryAsViewed={markHistoryAsViewed}
            missedCallsCount={missedCallsCount}
            onStartChat={async (targetId, targetProfile) => {
              setActiveTab('messages');
              const convId = await startConversation(targetId, targetProfile);
              if (convId) {
                setActiveConversationId(convId);
              }
            }}
          />
        )}

        {/* Tab 5: Profile (👤) */}
        {activeTab === 'profile' && (
          <ProfileTab
            currentUser={profile}
            blockedUserIds={socialRelations.blockedByMeSet}
            onUnblockUser={socialRelations.unblockUser}
            onEditProfile={() => {
              setViewingProfile(null);
              setIsProfileOpen(true);
            }}
            onOpenSettingsModal={() => setIsSettingsOpen(true)}
            onOpenConfigModal={() => setIsConfigOpen(true)}
            onOpenNotifications={() => setIsNotificationOpen(true)}
            unreadNotificationsCount={unreadNotificationsCount}
            onSignOut={signOut}
            followersCount={socialRelations.followersCount}
            followingCount={socialRelations.followingCount}
            fetchFollowers={socialRelations.fetchFollowersList}
            fetchFollowing={socialRelations.fetchFollowingList}
            getFollowStatus={socialRelations.getFollowStatus}
            onFollow={socialRelations.followUser}
            onUnfollow={socialRelations.unfollowUser}
            onSelectUser={(u) => {
              setViewingProfile(u);
              setIsProfileOpen(true);
            }}
          />
        )}
      </main>

      {/* 3. Mobile Bottom Navigation Bar (Tabs) */}
      <BottomNav
        activeTab={activeTab}
        onChangeTab={handleTabChange}
        unreadCount={totalUnreadCount}
        missedCallsCount={missedCallsCount}
        hide={
          isCallActive ||
          (activeTab === 'messages' && Boolean(activeConversationId))
        }
      />

      {/* 4. Realtime Incoming Call Modal */}
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={acceptCall}
        onReject={rejectCall}
        onOpenProfile={(p) => {
          setViewingProfile(p);
          setIsProfileOpen(true);
        }}
      />

      {/* 5. Active Call Screens */}
      {activeCallState && activeCallState.call.call_type === 'audio' && (
        <AudioCallScreen
          activeCallState={activeCallState}
          callState={activeCallState}
          connectionState={connectionState}
          remoteAudioRef={remoteAudioRef}
          onToggleMicrophone={toggleMicrophone}
          onToggleMic={toggleMicrophone}
          onEndCall={endCall}
        />
      )}

      {activeCallState && activeCallState.call.call_type === 'video' && (
        <VideoCallScreen
          activeCallState={activeCallState}
          callState={activeCallState}
          connectionState={connectionState}
          localVideoRef={localVideoRef}
          remoteVideoRef={remoteVideoRef}
          remoteAudioRef={remoteAudioRef}
          onToggleMicrophone={toggleMicrophone}
          onToggleMic={toggleMicrophone}
          onToggleCamera={toggleCamera}
          onSwitchCamera={switchCamera}
          onEndCall={endCall}
        />
      )}

      {/* 6. Modals */}
      <NotificationModal
        isOpen={isNotificationOpen}
        onClose={() => setIsNotificationOpen(false)}
        notifications={notifications}
        unreadCount={unreadNotificationsCount}
        onMarkAsRead={markNotificationAsRead}
        onMarkAllAsRead={markAllNotificationsAsRead}
        onDeleteNotification={deleteNotification}
        onSelectUser={(u) => {
          setIsNotificationOpen(false);
          setViewingProfile(u);
          setIsProfileOpen(true);
        }}
        onOpenChat={async (userId) => {
          setIsNotificationOpen(false);
          setActiveTab('messages');
          const convId = await startConversation(userId);
          if (convId) {
            setActiveConversationId(convId);
          }
        }}
      />

      <UserSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectUser={async (targetUser) => {
          setIsSearchOpen(false);
          setActiveTab('messages');
          const convId = await startConversation(targetUser.id, targetUser);
          if (convId) {
            setActiveConversationId(convId);
          }
        }}
        onStartCall={(targetUser, type) => {
          setIsSearchOpen(false);
          startCall(targetUser, type);
        }}
        onSearch={searchUsers}
        isUserOnline={isUserOnline}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        currentUser={profile}
        viewingProfile={viewingProfile}
        onClose={() => {
          setIsProfileOpen(false);
          setViewingProfile(null);
        }}
        onUpdateProfile={async (updates) => {
          const success = await updateProfile(updates);
          if (success) {
            refreshProfile();
          }
          return success;
        }}
        onStartChat={async (targetId) => {
          setIsProfileOpen(false);
          setViewingProfile(null);
          setActiveTab('messages');
          const convId = await startConversation(targetId);
          if (convId) {
            setActiveConversationId(convId);
          }
        }}
        onStartAudioCall={(peer) => {
          setIsProfileOpen(false);
          setViewingProfile(null);
          startCall(peer, 'audio');
        }}
        onStartVideoCall={(peer) => {
          setIsProfileOpen(false);
          setViewingProfile(null);
          startCall(peer, 'video');
        }}
        relationStatus={
          viewingProfile
            ? socialRelations.getRelationStatus(viewingProfile.id)
            : profile
            ? socialRelations.getRelationStatus(profile.id)
            : undefined
        }
        getFollowStatus={socialRelations.getFollowStatus}
        onFollow={socialRelations.followUser}
        onUnfollow={socialRelations.unfollowUser}
        fetchFollowers={socialRelations.fetchFollowersList}
        fetchFollowing={socialRelations.fetchFollowingList}
        followersCount={
          viewingProfile
            ? socialRelations.getFollowersCount(viewingProfile.id)
            : socialRelations.followersCount
        }
        followingCount={
          viewingProfile
            ? socialRelations.getFollowingCount(viewingProfile.id)
            : socialRelations.followingCount
        }
        onSelectUser={(u) => {
          setViewingProfile(u);
        }}
        isUserOnline={isUserOnline}
        onBlock={socialRelations.blockUser}
        onUnblock={socialRelations.unblockUser}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        currentUser={profile}
        onSignOut={signOut}
        onOpenConfig={() => {
          setIsSettingsOpen(false);
          setIsConfigOpen(true);
        }}
      />

      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
      />

      <LanguageSelectorModal />

      {/* Global Call Error Toast */}
      {callError && (
        <Toast
          title="Call Notice"
          message={callError}
          type="error"
          onClose={clearCallError}
        />
      )}

      {/* PWA / Notification Prompt */}
      <PushBanner />
    </div>
  );
}

