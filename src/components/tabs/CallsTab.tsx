import React, { useState, useEffect } from 'react';
import {
  Phone,
  Video,
  Search,
  RefreshCw,
  UserPlus,
  MessageSquare,
  Trash2,
  X,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
} from 'lucide-react';
import { Profile, CallType, Conversation } from '@/src/types';
import { CallHistoryItem } from '@/src/hooks/useCallHistory';
import { cn, formatTimestamp, getAvatarColor, getInitials } from '@/src/lib/utils';
import { useLanguage } from '@/src/lib/LanguageContext';

export interface CallsTabProps {
  currentUser: Profile | null;
  conversations?: Conversation[];
  onStartCall: (peer: Profile, type: CallType) => void;
  onOpenProfileView: (profile: Profile) => void;
  isUserOnline: (profile?: Profile | null) => boolean;
  onOpenSearchModal: () => void;
  onStartChat?: (userId: string, profile?: Profile) => void;
  isBlocked?: (targetUserId: string) => boolean;
  history?: CallHistoryItem[];
  historyLoading?: boolean;
  onRefreshHistory?: () => void;
  onDeleteCall?: (callId: string) => void;
  onClearAllHistory?: () => void;
  onMarkHistoryAsViewed?: () => void;
  missedCallsCount?: number;
}

export const CallsTab: React.FC<CallsTabProps> = ({
  currentUser: _currentUser,
  conversations: _conversations = [],
  onStartCall,
  onOpenProfileView,
  isUserOnline,
  onOpenSearchModal,
  onStartChat,
  isBlocked,
  history = [],
  historyLoading = false,
  onRefreshHistory,
  onDeleteCall,
  onClearAllHistory,
  onMarkHistoryAsViewed,
}) => {
  const { t } = useLanguage();

  const [searchQuery, setSearchQuery] = useState('');
  const [showClearHistoryConfirm, setShowClearHistoryConfirm] = useState(false);
  const [callToDelete, setCallToDelete] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mark calls as viewed on mount
  useEffect(() => {
    if (onMarkHistoryAsViewed) {
      onMarkHistoryAsViewed();
    }
  }, [onMarkHistoryAsViewed]);

  // Filter call logs by search and blocked users
  const filteredHistory = history.filter((item) => {
    if (isBlocked && item.peer?.id && isBlocked(item.peer.id)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const name = item.peer?.display_name || '';
      const uname = item.peer?.username || '';
      return name.toLowerCase().includes(q) || uname.toLowerCase().includes(q);
    }
    return true;
  });

  const getStatusIcon = (item: CallHistoryItem) => {
    if (item.isMissed) {
      return <PhoneMissed className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    }
    if (item.direction === 'incoming') {
      return <PhoneIncoming className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    }
    return <PhoneOutgoing className="w-3.5 h-3.5 text-blue-500 shrink-0" />;
  };

  const getStatusText = (item: CallHistoryItem) => {
    if (item.isMissed) {
      return item.call_type === 'video' ? 'Missed Video Call' : 'Missed Audio Call';
    }
    if (item.direction === 'incoming') {
      return item.call_type === 'video' ? 'Incoming Video Call' : 'Incoming Audio Call';
    }
    return item.call_type === 'video' ? 'Outgoing Video Call' : 'Outgoing Audio Call';
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50 dark:bg-neutral-950 overflow-hidden relative">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-neutral-900/95 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold shadow-xl border border-neutral-800 dark:border-neutral-200 animate-in fade-in slide-in-from-top-2 duration-150 flex items-center gap-2">
          <span>{toastMessage}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-full hover:bg-white/10 dark:hover:bg-black/10 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Clear All Call History Modal */}
      {showClearHistoryConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Clear All Calls?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                This will permanently delete your call records.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowClearHistoryConfirm(false)}
                className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onClearAllHistory?.();
                  setShowClearHistoryConfirm(false);
                  setToastMessage('Call list cleared.');
                  setTimeout(() => setToastMessage(null), 3000);
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all active:scale-95 cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Single Call Log Record Modal */}
      {callToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Delete Call Record?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Are you sure you want to remove this record?
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCallToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (callToDelete && onDeleteCall) {
                    onDeleteCall(callToDelete);
                  }
                  setCallToDelete(null);
                }}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all active:scale-95 cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Header */}
      <header className="p-4 md:p-6 pb-4 bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800 flex flex-col gap-3.5 shadow-xs">
        <div className="flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight flex items-center gap-2.5">
            <Phone className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>{t('nav.calls', 'Calls')}</span>
          </h2>

          <div className="flex items-center gap-2">
            {history.length > 0 && onClearAllHistory && (
              <button
                onClick={() => setShowClearHistoryConfirm(true)}
                title="Clear all calls"
                className="p-2.5 px-3 rounded-2xl bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-900/60 text-red-600 dark:text-red-400 border border-red-200/60 dark:border-red-800/60 transition-all active:scale-95 flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <button
              onClick={() => onRefreshHistory?.()}
              title="Refresh"
              disabled={historyLoading}
              className="p-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className={cn('w-4 h-4', historyLoading && 'animate-spin')} />
            </button>

            <button
              onClick={onOpenSearchModal}
              title="New Call / Search ID"
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>New Call</span>
            </button>
          </div>
        </div>

        {/* Search Filter */}
        {history.length > 0 && (
          <div className="relative w-full">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search calls..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-base sm:text-base rounded-2xl bg-neutral-100 dark:bg-neutral-800/90 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-xs"
            />
          </div>
        )}
      </header>

      {/* Main Call List */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-24 md:pb-6">
        <div className="max-w-4xl mx-auto space-y-2.5">
          {historyLoading && history.length === 0 ? (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="p-4 rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 animate-pulse flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                    <div className="space-y-2">
                      <div className="w-32 h-3 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                      <div className="w-20 h-2 bg-neutral-200 dark:bg-neutral-800 rounded-md" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
                    <div className="w-10 h-10 bg-neutral-200 dark:bg-neutral-800 rounded-2xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredHistory.length > 0 ? (
            <div className="space-y-2.5">
              {filteredHistory.map((call) => {
                const peer = call.peer;
                const isVideo = call.call_type === 'video';
                const peerName = peer?.display_name || peer?.username || 'User';
                const online = isUserOnline(peer);

                return (
                  <div
                    key={call.id}
                    className={cn(
                      'p-3.5 sm:p-4 rounded-3xl bg-white dark:bg-neutral-900 border transition-all shadow-xs hover:shadow-md flex items-center justify-between gap-3 group',
                      call.isMissed
                        ? 'border-red-200/70 dark:border-red-950/60 bg-red-50/10 dark:bg-red-950/10'
                        : 'border-neutral-200/80 dark:border-neutral-800/80 hover:border-blue-500/40'
                    )}
                  >
                    {/* Left: Avatar & Info */}
                    <div className="flex items-center gap-3.5 min-w-0 flex-1">
                      <button
                        onClick={() => onOpenProfileView(peer)}
                        className="relative shrink-0 text-left cursor-pointer"
                      >
                        {peer?.avatar_url ? (
                          <img
                            src={peer.avatar_url}
                            alt={peerName}
                            className="w-12 h-12 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                        ) : (
                          <div
                            className={cn(
                              'w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm shadow-xs text-white',
                              getAvatarColor(peer?.id || call.id)
                            )}
                          >
                            {getInitials(peerName)}
                          </div>
                        )}

                        <span
                          className={cn(
                            'absolute -bottom-1 -right-1 p-1 rounded-full border-2 border-white dark:border-neutral-900 shadow-xs',
                            isVideo ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                          )}
                        >
                          {isVideo ? (
                            <Video className="w-2.5 h-2.5" />
                          ) : (
                            <Phone className="w-2.5 h-2.5" />
                          )}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4
                            className={cn(
                              'text-sm font-bold truncate',
                              call.isMissed
                                ? 'text-red-600 dark:text-red-400'
                                : 'text-neutral-900 dark:text-neutral-100'
                            )}
                          >
                            {peerName}
                          </h4>
                          {peer?.username && (
                            <span className="text-xs text-neutral-400 font-mono truncate hidden sm:inline">
                              @{peer.username}
                            </span>
                          )}
                          {online && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block shrink-0 animate-pulse" />
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                          {getStatusIcon(call)}
                          <span className="truncate">{getStatusText(call)}</span>
                          <span>•</span>
                          <span className="font-medium text-neutral-600 dark:text-neutral-300 shrink-0">
                            {formatTimestamp(call.created_at)}
                          </span>
                          {call.durationFormatted && (
                            <>
                              <span>•</span>
                              <span className="text-[11px] font-mono text-neutral-400">
                                {call.durationFormatted}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Right: Direct 1-Click Action Buttons */}
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {onStartChat && (
                        <button
                          onClick={() => onStartChat(peer.id, peer)}
                          title={`Chat with ${peerName}`}
                          className="p-2.5 sm:p-3 rounded-2xl bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => onStartCall(peer, 'audio')}
                        title={`Audio call ${peerName}`}
                        className="p-2.5 sm:p-3 rounded-2xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/80 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Phone className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => onStartCall(peer, 'video')}
                        title={`Video call ${peerName}`}
                        className="p-2.5 sm:p-3 rounded-2xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/80 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-800/60 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                      >
                        <Video className="w-4 h-4" />
                      </button>

                      {onDeleteCall && (
                        <button
                          onClick={() => setCallToDelete(call.id)}
                          title="Delete call log"
                          className="p-2.5 sm:p-3 rounded-2xl opacity-0 group-hover:opacity-100 bg-neutral-100 hover:bg-red-50 dark:bg-neutral-800 dark:hover:bg-red-950/50 text-neutral-400 hover:text-red-500 transition-all hover:scale-105 active:scale-95 shadow-xs cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 space-y-4 max-w-md mx-auto my-8">
              <div className="w-14 h-14 rounded-3xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto shadow-xs">
                <PhoneOff className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  {searchQuery ? 'No matching calls' : 'No calls yet'}
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  {searchQuery
                    ? `No call matched "${searchQuery}".`
                    : 'Whenever you make or receive audio or video calls, they will appear right here.'}
                </p>
              </div>
              <button
                onClick={onOpenSearchModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Start a Call</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
