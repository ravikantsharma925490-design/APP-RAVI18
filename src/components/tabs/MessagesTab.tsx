import React, { useState } from 'react';
import { Search, MessageSquarePlus, Radio, Trash2 } from 'lucide-react';
import { Conversation, Profile, CallType, UserRelationStatus } from '@/src/types';
import { ConversationItem } from '../chat/ConversationItem';
import { ChatWindow } from '../chat/ChatWindow';
import { ConversationSkeleton } from '../ui/LoadingSkeleton';
import { EmptyState } from '../ui/EmptyState';

interface MessagesTabProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  currentUser: Profile | null;
  onSelectConversation: (id: string | null) => void;
  onOpenSearch: () => void;
  onStartCall: (peer: Profile, type: CallType) => void;
  onOpenProfileView: (profile: Profile) => void;
  onDeleteConversation?: (conversationId: string) => void;
  isUserOnline: (profile?: Profile | null) => boolean;
  getUserLastSeen: (profile?: Profile | null) => string;
  getRelationStatus?: (userId: string) => UserRelationStatus;
  onFollow?: (peer: Profile) => Promise<boolean>;
  onUnblock?: (peerId: string) => Promise<boolean>;
}

export const MessagesTab: React.FC<MessagesTabProps> = ({
  conversations,
  activeConversationId,
  loading,
  currentUser,
  onSelectConversation,
  onOpenSearch,
  onStartCall,
  onOpenProfileView,
  onDeleteConversation,
  isUserOnline,
  getUserLastSeen,
  getRelationStatus,
  onFollow,
  onUnblock,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [convToDelete, setConvToDelete] = useState<Conversation | null>(null);

  const activeConversation = conversations.find(
    (c) =>
      c.id === activeConversationId ||
      (c as any).original_id === activeConversationId ||
      c.other_member?.id === activeConversationId
  ) || null;
  const activePeerId = activeConversation?.other_member?.id;
  const activeRelationStatus = activePeerId && getRelationStatus ? getRelationStatus(activePeerId) : undefined;

  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const name = c.other_member?.display_name || '';
    const uname = c.other_member?.username || '';
    const lastContent = c.last_message?.content || '';
    const q = searchQuery.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      uname.toLowerCase().includes(q) ||
      lastContent.toLowerCase().includes(q)
    );
  });

  const confirmDelete = () => {
    if (convToDelete && onDeleteConversation) {
      onDeleteConversation(convToDelete.id);
      setConvToDelete(null);
    }
  };

  return (
    <div className="flex-1 flex h-full overflow-hidden relative">
      {/* Delete Conversation Confirmation Modal */}
      {convToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                Delete Conversation?
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Are you sure you want to delete this chat with{' '}
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {convToDelete.other_member?.display_name || convToDelete.other_member?.username || 'User'}
                </span>
                ? All messages in this conversation will be permanently removed.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setConvToDelete(null)}
                className="py-2.5 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 font-semibold text-xs text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 transition-all active:scale-95"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Conversation List Column */}
      <div
        className={`${
          activeConversationId ? 'hidden md:flex' : 'flex'
        } flex-col w-full md:w-80 lg:w-96 h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shrink-0`}
      >
        {/* Messages Header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-neutral-900 dark:text-neutral-100 tracking-tight">
              Messages
            </h2>
            <p className="text-xs text-neutral-500 font-medium">
              {conversations.length} conversation{conversations.length === 1 ? '' : 's'}
            </p>
          </div>

          <button
            onClick={onOpenSearch}
            title="Start new chat"
            className="p-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5 text-xs font-semibold"
          >
            <MessageSquarePlus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
        </div>

        {/* Search Filter Input */}
        <div className="px-4 py-2.5">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 transition-all"
            />
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 pb-24 md:pb-4 space-y-1">
          {loading && conversations.length === 0 ? (
            <ConversationSkeleton />
          ) : filteredConversations.length > 0 ? (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.id}
                conversation={conv}
                isSelected={conv.id === activeConversationId}
                isOnline={isUserOnline(conv.other_member)}
                currentUserId={currentUser?.id}
                onSelect={() => onSelectConversation(conv.id)}
                onDelete={() => setConvToDelete(conv)}
              />
            ))
          ) : conversations.length === 0 ? (
            <EmptyState
              type="no-conversations"
              onAction={onOpenSearch}
              actionLabel="Find People to Chat"
            />
          ) : (
            <div className="p-8 text-center text-xs text-neutral-400">
              No conversations found matching &quot;{searchQuery}&quot;
            </div>
          )}
        </div>
      </div>

      {/* Active Conversation Chat Window */}
      <div
        className={`${
          !activeConversationId ? 'hidden md:flex' : 'flex'
        } flex-1 h-full overflow-hidden`}
      >
        <ChatWindow
          key={activeConversationId || 'no-active-chat'}
          conversation={activeConversation}
          currentUser={currentUser}
          isOnline={isUserOnline(activeConversation?.other_member)}
          lastSeenString={getUserLastSeen(activeConversation?.other_member)}
          onBack={() => onSelectConversation(null)}
          onStartCall={onStartCall}
          onOpenProfileView={onOpenProfileView}
          onDeleteConversation={onDeleteConversation}
          relationStatus={activeRelationStatus}
          onFollow={onFollow}
          onUnblock={onUnblock}
        />
      </div>
    </div>
  );
};
