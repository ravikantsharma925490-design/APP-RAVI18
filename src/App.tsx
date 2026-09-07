import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { LiveTab } from '@/src/components/live/LiveTab';
import { LiveRoomScreen } from '@/src/components/live/LiveRoomScreen';
import { LiveMiniRoom } from '@/src/components/live/LiveMiniRoom';
import { LiveRoom } from '@/src/types/live';
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
    signOut,
    resetPassword,
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

  // Live Voice Rooms State
  const [activeLiveRoom, setActiveLiveRoom] = useState<LiveRoom | null>(null);
  const [isLiveRoomMinimized, setIsLiveRoomMinimized] = useState(false);

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
      const urlParams = new URLSearchParams(window.location.search);
      const queryRoomId = urlParams.get('room');

      if (queryRoomId) {
        setActiveTab('live');
        // Fetch and auto-join room if roomId provided in URL
        fetch(`/api/live/rooms/detail?roomId=${queryRoomId}`)
          .then((res) => res.json())
          .then((data) => {
            if (data.room) {
              setActiveLiveRoom(data.room);
              setIsLiveRoomMinimized(false);
            }
          })
          .catch(() => {});
      } else if (path === '/app/messages' || path === '/app' || path === '/' || path === '') {
        setActiveTab('messages');
      } else if (path === '/app/search') {
        setActiveTab('search');
      } else if (path === '/app/live') {
        setActiveTab('live');
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

  // Loading initial auth
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-neutral-950 text-white">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-semibold text-neutral-400">Loading LiveConnect...</p>
      </div>
    );
  }

  // Unauthenticated view (Support public standalone view of Terms & Privacy for App Store / Play Store Review)
  if (!user) {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname === '/app/help/terms' || pathname === '/terms') {
        return (
          <div className="h-screen w-screen bg-neutral-950 text-white overflow-hidden">
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
          <div className="h-screen w-screen bg-neutral-950 text-white overflow-hidden">
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
          onSignIn={signIn}
          onSignUp={signUp}
          onResetPassword={resetPassword}
          authError={authError}
          clearError={() => setAuthError(null)}
          onOpenConfigModal={() => setIsConfigOpen(true)}
        />
        <ConfigModal isOpen={isConfigOpen} onClose={() => setIsConfigOpen(false)} />
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

  const isCallActive = Boolean(activeCallState || incomingCall);

  return (
    <div className="h-screen w-screen flex flex-col md:flex-row bg-neutral-100 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 overflow-hidden font-sans">
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

        {/* Tab 4: Live Voice Discovery (🎙️) */}
        {activeTab === 'live' && (
          <LiveTab
            currentUser={activeUserProfile || profile!}
            onJoinRoom={(room) => {
              setActiveLiveRoom(room);
              setIsLiveRoomMinimized(false);
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
          (activeTab === 'messages' && Boolean(activeConversationId)) ||
          (Boolean(activeLiveRoom) && !isLiveRoomMinimized)
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

      {/* 6. Live Voice Room Full-Screen & Minimized Container */}
      {activeLiveRoom && !isLiveRoomMinimized && (
        <LiveRoomScreen
          room={activeLiveRoom}
          currentUser={activeUserProfile || profile!}
          onMinimize={() => setIsLiveRoomMinimized(true)}
          onLeaveRoom={() => {
            setActiveLiveRoom(null);
            setIsLiveRoomMinimized(false);
          }}
        />
      )}

      {activeLiveRoom && isLiveRoomMinimized && (
        <LiveMiniRoom
          room={activeLiveRoom}
          isSeated={activeLiveRoom.seats.some((s) => s.user?.id === (activeUserProfile?.id || profile?.id))}
          isMuted={false}
          isSpeaking={false}
          onMaximize={() => setIsLiveRoomMinimized(false)}
          onLeave={() => {
            setActiveLiveRoom(null);
            setIsLiveRoomMinimized(false);
          }}
          onToggleMic={() => {}}
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

