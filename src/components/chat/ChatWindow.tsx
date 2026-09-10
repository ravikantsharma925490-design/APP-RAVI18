import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  Phone,
  Video,
  Send,
  ArrowLeft,
  Smile,
  MoreVertical,
  AlertCircle,
  Sparkles,
  Trash2,
  Eraser,
  Lock,
  UserPlus,
  UserCheck,
  ShieldAlert,
  Heart,
  CheckCircle2,
  RefreshCw,
  Users,
} from 'lucide-react';
import { Conversation, Profile, CallType, UserRelationStatus } from '@/src/types';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { ImageViewerModal } from './ImageViewerModal';
import { ChatSkeleton } from '../ui/LoadingSkeleton';
import { EmptyState } from '../ui/EmptyState';
import { cn, formatLastSeen, getAvatarColor, getInitials } from '@/src/lib/utils';
import { useMessages } from '@/src/hooks/useMessages';

interface ChatWindowProps {
  conversation: Conversation | null;
  currentUser: Profile | null;
  isOnline: boolean;
  lastSeenString: string;
  onBack: () => void;
  onStartCall: (peer: Profile, type: CallType) => void;
  onOpenProfileView?: (profile: Profile) => void;
  onDeleteConversation?: (conversationId: string) => void;
  relationStatus?: UserRelationStatus;
  onFollow?: (peer: Profile) => Promise<boolean>;
  onUnblock?: (peerId: string) => Promise<boolean>;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  conversation,
  currentUser,
  isOnline,
  lastSeenString,
  onBack,
  onStartCall,
  onOpenProfileView,
  onDeleteConversation,
  relationStatus,
  onFollow,
  onUnblock,
}) => {
  const [showOptionsDropdown, setShowOptionsDropdown] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'delete' | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [localFollowed, setLocalFollowed] = useState(false);
  const [liveRelation, setLiveRelation] = useState<UserRelationStatus | null>(null);
  const [isRefreshingStatus, setIsRefreshingStatus] = useState(false);
  const [viewingImage, setViewingImage] = useState<{ url: string; caption?: string } | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);

  const isChatVisible = Boolean(conversation?.id) && (typeof document === 'undefined' || !document.hidden);

  const {
    messages,
    loading,
    sending,
    error,
    messagesEndRef,
    sendMessage,
    deleteMessage,
    clearAllMessages,
    fetchMessages,
    markMessagesAsRead,
  } = useMessages(conversation?.id || null, currentUser?.id, isChatVisible, conversation);

  // Scroll helpers
  const checkIsNearBottom = useCallback(() => {
    const el = chatContainerRef.current;
    if (!el) return true;
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    return distanceToBottom < 60;
  }, []);

  const handleContainerScroll = useCallback(() => {
    isNearBottomRef.current = checkIsNearBottom();
  }, [checkIsNearBottom]);

  const snapToBottom = useCallback(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, []);

  // Synchronous instant snap on mount & conversation change BEFORE browser paints
  useLayoutEffect(() => {
    snapToBottom();
  }, [conversation?.id, snapToBottom]);

  // Keep pinned to bottom when messages load or change (if user was already at bottom)
  useLayoutEffect(() => {
    if (isNearBottomRef.current && messages.length > 0) {
      snapToBottom();
    }
  }, [messages.length, snapToBottom]);

  // Prevent jumping when images load or content expands
  useLayoutEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;

    const innerContainer = el.firstElementChild;
    if (!innerContainer) return;

    const resizeObserver = new ResizeObserver(() => {
      if (isNearBottomRef.current) {
        // If we were at the bottom before the resize, stay at the bottom
        snapToBottom();
      }
    });

    resizeObserver.observe(innerContainer);

    const handleWindowResize = () => {
      if (isNearBottomRef.current) {
        snapToBottom();
      }
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [snapToBottom]);

  // Ensure unread messages are marked as read when ChatWindow is actively visible
  useEffect(() => {
    if (
      conversation?.id &&
      currentUser?.id &&
      (typeof document === 'undefined' || !document.hidden)
    ) {
      markMessagesAsRead();
    }
  }, [conversation?.id, currentUser?.id, messages.length, markMessagesAsRead]);

  const otherUser = conversation?.other_member;
  const isSelf = Boolean(currentUser && otherUser && otherUser.id === currentUser.id);
  const rawDisplayName = otherUser?.display_name || otherUser?.username || 'Chat';
  const displayName = isSelf ? `${rawDisplayName} (You)` : rawDisplayName;
  const username = otherUser?.username || '';
  const avatarUrl = otherUser?.avatar_url;

  const currentConvIdRef = useRef<string | null>(null);

  // Direct Live Relation Check from backend
  const checkLiveRelation = useCallback(async () => {
    if (!currentUser?.id || !otherUser?.id || isSelf) return;
    setIsRefreshingStatus(true);
    try {
      const res = await fetch('/api/relations/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          targetUserId: otherUser.id,
          userUsername: currentUser.username,
          targetUsername: otherUser.username,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLiveRelation(data);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsRefreshingStatus(false);
    }
  }, [currentUser?.id, currentUser?.username, otherUser?.id, otherUser?.username, isSelf]);

  useEffect(() => {
    const convId = conversation?.id || null;
    if (currentConvIdRef.current !== convId) {
      currentConvIdRef.current = convId;
      setLocalFollowed(false);
      setLiveRelation(null);
      setShowOptionsDropdown(false);
      setConfirmAction(null);
    }
    checkLiveRelation();
  }, [conversation?.id, checkLiveRelation]);

  // Polling check relation while chat window is open
  useEffect(() => {
    if (!otherUser?.id || isSelf) return;
    const interval = setInterval(() => {
      checkLiveRelation();
    }, 2000);
    return () => clearInterval(interval);
  }, [otherUser?.id, isSelf, checkLiveRelation]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col h-full bg-white dark:bg-neutral-900">
        {onBack && (
          <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 flex items-center gap-2 md:hidden">
            <button
              onClick={onBack}
              className="p-2 rounded-xl text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              title="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xs font-semibold text-neutral-600 dark:text-neutral-400">Back to messages</span>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <EmptyState type="no-conversation-selected" />
        </div>
      </div>
    );
  }

  const isBlocked = Boolean(liveRelation ? liveRelation.isBlocked : relationStatus?.isBlocked);
  const isFollowingUser = Boolean(
    localFollowed ||
    (liveRelation !== null ? liveRelation.isFollowing : relationStatus?.isFollowing)
  );
  const isFollowedByUser = Boolean(
    liveRelation !== null ? liveRelation.isFollowedBy : relationStatus?.isFollowedBy
  );
  const isMutual =
    isSelf ||
    Boolean(
      (liveRelation && (liveRelation.isMutual || (liveRelation.isFollowing && liveRelation.isFollowedBy))) ||
      (relationStatus && (relationStatus.isMutual || (relationStatus.isFollowing && relationStatus.isFollowedBy))) ||
      (isFollowingUser && isFollowedByUser)
    );

  // canChat & canCall: Can communicate ONLY when mutual follow (or isSelf) and not blocked
  const canChat = !isBlocked && (isSelf || isMutual);
  const canCall = !isBlocked && (isSelf || isMutual);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || sending) return;
    if (isBlocked || !canChat) return;

    isNearBottomRef.current = true;
    sendMessage(
      content,
      currentUser || undefined,
      otherUser?.id,
      otherUser || undefined
    );
    snapToBottom();
  };

  const handleClearMessages = async () => {
    await clearAllMessages();
    setConfirmAction(null);
    setShowOptionsDropdown(false);
  };

  const handleDeleteConversation = async () => {
    if (onDeleteConversation && conversation) {
      onDeleteConversation(conversation.id);
    }
    setConfirmAction(null);
    setShowOptionsDropdown(false);
  };

  const handleFollowAction = async () => {
    if (!otherUser || !currentUser || followLoading) return;
    setFollowLoading(true);
    try {
      setLocalFollowed(true);
      if (onFollow) {
        await onFollow(otherUser);
      }
      const res = await fetch('/api/relations/follow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          targetUserId: otherUser.id,
          userMeta: currentUser,
          targetMeta: otherUser,
        }),
      });
      if (res.ok) {
        const followData = await res.json();
        if (followData) {
          const wasFollowed = Boolean(
            followData.isFollowedBy ||
            relationStatus?.isFollowedBy ||
            liveRelation?.isFollowedBy
          );
          setLiveRelation((prev) => ({
            ...(prev || {}),
            isFollowing: true,
            isFollowedBy: wasFollowed,
            isMutual: Boolean(followData.isMutual || wasFollowed),
          }));
        }
      }

      await checkLiveRelation();
    } finally {
      setFollowLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden relative">
      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                {confirmAction === 'clear' ? 'Clear All Messages?' : 'Delete Conversation?'}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {confirmAction === 'clear'
                  ? 'All messages in this chat will be permanently deleted for you.'
                  : `Are you sure you want to delete the chat with ${displayName}? This cannot be undone.`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setConfirmAction(null)}
                className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAction === 'clear' ? handleClearMessages : handleDeleteConversation}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all active:scale-95"
              >
                {confirmAction === 'clear' ? 'Clear Messages' : 'Delete Chat'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Header */}
      <header className="px-4 py-3 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between shadow-xs z-10">
        <div className="flex items-center gap-3 min-w-0">
          {/* Mobile Back Button */}
          <button
            onClick={onBack}
            className="md:hidden p-2 rounded-xl text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {/* User Avatar */}
          <div
            onClick={() => otherUser && onOpenProfileView?.(otherUser)}
            className="relative cursor-pointer shrink-0"
          >
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
              />
            ) : (
              <div
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shadow-sm text-white',
                  getAvatarColor(otherUser?.id || conversation.id)
                )}
              >
                {getInitials(displayName)}
              </div>
            )}
            <span
              className={cn(
                'absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900',
                isOnline ? 'bg-emerald-500' : 'bg-neutral-400'
              )}
            />
          </div>

          {/* User Details & Relation Pill */}
          <div
            onClick={() => otherUser && onOpenProfileView?.(otherUser)}
            className="min-w-0 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate hover:text-blue-600 transition-colors">
                {displayName}
              </h3>
              {!isSelf && isMutual && !isBlocked && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <UserCheck className="w-3 h-3" /> Mutual Follow
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate flex items-center gap-1.5">
              {isSelf ? (
                <span className="text-blue-600 dark:text-blue-400 font-medium">Message yourself (Personal notes)</span>
              ) : isOnline ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Online</span>
              ) : (
                <span>{formatLastSeen(lastSeenString, isOnline)}</span>
              )}
              {username && !isSelf && username !== displayName && <span className="opacity-60 font-mono">@{username}</span>}
            </p>
          </div>
        </div>

        {/* Call Controls & Actions Dropdown */}
        <div className="flex items-center gap-1.5 shrink-0 relative">
          {isSelf ? (
            <button
              onClick={() => {
                if (!currentUser) return;
                onStartCall(currentUser, 'audio');
              }}
              title="Call your other device (e.g. Phone to PC)"
              className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>Call Other Device</span>
            </button>
          ) : (
            <>
              {/* Audio Call Button */}
              <button
                onClick={() => {
                  if (!otherUser || !canCall) return;
                  onStartCall(otherUser, 'audio');
                }}
                title={isBlocked ? 'User is blocked' : 'Start Audio Call'}
                disabled={!otherUser || !canCall}
                className={cn(
                  'p-2.5 rounded-xl transition-all shadow-xs',
                  canCall
                    ? 'bg-neutral-100 dark:bg-neutral-800 hover:bg-emerald-500 hover:text-white dark:hover:bg-emerald-600 text-neutral-700 dark:text-neutral-200 hover:scale-105 active:scale-95 cursor-pointer'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-60'
                )}
              >
                <Phone className="w-4 h-4" />
              </button>

              {/* Video Call Button */}
              <button
                onClick={() => {
                  if (!otherUser || !canCall) return;
                  onStartCall(otherUser, 'video');
                }}
                title={isBlocked ? 'User is blocked' : 'Start Video Call'}
                disabled={!otherUser || !canCall}
                className={cn(
                  'p-2.5 rounded-xl transition-all shadow-xs flex items-center gap-1.5 font-medium text-xs px-3',
                  canCall
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/20 hover:scale-105 active:scale-95 cursor-pointer'
                    : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-60'
                )}
              >
                <Video className="w-4 h-4" />
                <span className="hidden sm:inline">Call</span>
              </button>
            </>
          )}

          {/* More Options Dropdown Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowOptionsDropdown(!showOptionsDropdown)}
              title="Chat Options"
              className="p-2.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showOptionsDropdown && (
              <>
                <div
                  className="fixed inset-0 z-20"
                  onClick={() => setShowOptionsDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-xl py-1.5 z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <button
                    onClick={() => {
                      setShowOptionsDropdown(false);
                      setConfirmAction('clear');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 flex items-center gap-2 transition-colors"
                  >
                    <Eraser className="w-3.5 h-3.5 text-neutral-400" />
                    <span>Clear Messages</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowOptionsDropdown(false);
                      setConfirmAction('delete');
                    }}
                    className="w-full px-3.5 py-2 text-left text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 flex items-center gap-2 transition-colors border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Conversation</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Messages Feed */}
      <div
        ref={chatContainerRef}
        onScroll={handleContainerScroll}
        className="flex-1 overflow-y-auto p-4 [scrollbar-gutter:stable]"
      >
        <div className="flex flex-col min-h-full">
          {/* Spacer pushing short message lists to bottom naturally without flex margin bugs */}
          <div className="flex-1 min-h-0 shrink-0" />

          {messages.length > 0 ? (
            <div className="space-y-1">
              {messages.map((msg, idx) => {
                const isMine = msg.sender_id === currentUser?.id;
                const prevMsg = messages[idx - 1];
                const showAvatar = !isMine && (!prevMsg || prevMsg.sender_id !== msg.sender_id);

                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    isMine={isMine}
                    showAvatar={showAvatar}
                    onDeleteMessage={deleteMessage}
                    onStartCall={onStartCall}
                    onViewImage={(url, caption) => setViewingImage({ url, caption })}
                    otherUser={otherUser}
                  />
                );
              })}
            </div>
          ) : loading ? (
            <div className="flex flex-col justify-end">
              <ChatSkeleton />
            </div>
          ) : error ? (
            <div className="p-6 text-center text-sm text-red-500 flex flex-col items-center justify-center my-auto gap-2">
              <AlertCircle className="w-6 h-6" />
              <span>{error}</span>
              <button
                onClick={fetchMessages}
                className="text-xs text-blue-600 hover:underline mt-2 font-medium cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : (
            <div className="my-auto flex flex-col items-center justify-center">
              <EmptyState type="no-messages" />
            </div>
          )}
          <div ref={messagesEndRef} className="h-0" />
        </div>
      </div>

      {/* Footer Area */}
      <footer className="p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-white dark:bg-neutral-900 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
        {/* Case 1: Blocked */}
        {isBlocked ? (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 text-rose-500" />
              <span>Communication is blocked. You cannot send messages or make calls.</span>
            </div>
            {relationStatus?.isBlockedByMe && onUnblock && otherUser && (
              <button
                onClick={() => onUnblock(otherUser.id)}
                className="px-3 py-1 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
              >
                Unblock
              </button>
            )}
          </div>
        ) : !isSelf && !canChat ? (
          /* Case 2: Not Permitted to Chat (User has been unfollowed or not followed back) */
          <div className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-2.5 text-center sm:text-left">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-neutral-900 dark:text-neutral-100">
                  {isFollowingUser
                    ? `Waiting for @${otherUser?.username || 'user'} to follow back`
                    : `Follow @${otherUser?.username || 'user'} to connect`}
                </p>
                <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                  {isFollowingUser
                    ? `@${otherUser?.username || 'This user'} must follow you back before you can send messages or call.`
                    : 'Follow this user to start connecting.'}
                </p>
              </div>
            </div>

            {/* Interactive Action Button */}
            {!isFollowingUser ? (
              <button
                type="button"
                onClick={handleFollowAction}
                disabled={followLoading}
                className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {followLoading ? 'Processing...' : 'Follow'}
              </button>
            ) : (
              <span className="px-3 py-1.5 text-xs font-semibold rounded-xl bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 shrink-0">
                Waiting for Follow Back
              </span>
            )}
          </div>
        ) : (
          /* Active Messaging Form with Rich Inputs (Photos, Voice Notes, Stickers, Text) */
          <div className="space-y-2">
            {/* Optional gentle Follow Back banner if user is followed but hasn't followed back */}
            {!isSelf && isFollowedByUser && !isFollowingUser && (
              <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between text-xs">
                <span className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                  @{otherUser?.username || 'This user'} follows you.
                </span>
                <button
                  type="button"
                  onClick={handleFollowAction}
                  disabled={followLoading}
                  className="px-2.5 py-1 text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all cursor-pointer shrink-0"
                >
                  {followLoading ? '...' : 'Follow Back'}
                </button>
              </div>
            )}

            <ChatInput
              onSendMessage={handleSendMessage}
              displayName={displayName}
              disabled={!canChat || isBlocked}
              sending={sending}
            />
          </div>
        )}
      </footer>

      {/* Fullscreen Lightbox Image Viewer */}
      <ImageViewerModal
        imageUrl={viewingImage?.url || null}
        caption={viewingImage?.caption}
        onClose={() => setViewingImage(null)}
      />
    </div>
  );
};

