import React, { useState } from 'react';
import {
  MessageSquarePlus,
  Settings,
  LogOut,
  Search,
  User as UserIcon,
  Video,
  Phone,
  Radio,
  SlidersHorizontal,
} from 'lucide-react';
import { Conversation, Profile } from '@/src/types';
import { ConversationItem } from './ConversationItem';
import { ConversationSkeleton } from '../ui/LoadingSkeleton';
import { EmptyState } from '../ui/EmptyState';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  loading: boolean;
  currentUser: Profile | null;
  onSelectConversation: (id: string) => void;
  onOpenSearch: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onSignOut: () => void;
  isUserOnline: (profile?: Profile | null) => boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  activeConversationId,
  loading,
  currentUser,
  onSelectConversation,
  onOpenSearch,
  onOpenProfile,
  onOpenSettings,
  onSignOut,
  isUserOnline,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  const filteredConversations = conversations.filter((c) => {
    if (!filterQuery.trim()) return true;
    const name = c.other_member?.display_name || '';
    const uname = c.other_member?.username || '';
    const lastContent = c.last_message?.content || '';
    const q = filterQuery.toLowerCase();
    return (
      name.toLowerCase().includes(q) ||
      uname.toLowerCase().includes(q) ||
      lastContent.toLowerCase().includes(q)
    );
  });

  return (
    <aside className="w-full md:w-80 lg:w-96 flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 shrink-0">
      {/* Top Header */}
      <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shadow-md shadow-blue-500/20">
            <Radio className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-neutral-900 dark:text-neutral-100">
              LiveConnect
            </h1>
            <p className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wider flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              Realtime Active
            </p>
          </div>
        </div>

        <button
          onClick={onOpenSearch}
          title="New conversation"
          className="p-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-blue-600 dark:text-blue-400 transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <MessageSquarePlus className="w-5 h-5" />
        </button>
      </div>

      {/* Search Conversations Input */}
      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search conversations..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-base rounded-xl bg-neutral-100 dark:bg-neutral-800/80 border border-transparent focus:border-neutral-300 dark:focus:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:bg-white dark:focus:bg-neutral-900 transition-all"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {loading ? (
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
            />
          ))
        ) : conversations.length === 0 ? (
          <EmptyState
            type="no-conversations"
            onAction={onOpenSearch}
            actionLabel="Start a Chat"
          />
        ) : (
          <div className="p-6 text-center text-xs text-neutral-400">
            No matching conversations found.
          </div>
        )}
      </div>

      {/* User Footer Bar */}
      {currentUser && (
        <div className="p-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 flex items-center justify-between">
          <button
            onClick={onOpenProfile}
            className="flex items-center gap-2.5 min-w-0 p-1.5 rounded-xl hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors text-left group"
          >
            <div className="relative shrink-0">
              {currentUser.avatar_url ? (
                <img
                  src={currentUser.avatar_url}
                  alt={currentUser.display_name}
                  className="w-9 h-9 rounded-full object-cover border border-neutral-300 dark:border-neutral-700"
                />
              ) : (
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shadow-sm',
                    getAvatarColor(currentUser.id)
                  )}
                >
                  {getInitials(currentUser.display_name)}
                </div>
              )}
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" />
            </div>

            <div className="min-w-0">
              <h4 className="text-xs font-bold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 transition-colors">
                {currentUser.display_name}
              </h4>
              <p className="text-[11px] text-neutral-500 font-mono truncate">
                @{currentUser.username}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={onOpenSettings}
              title="Settings & Credentials"
              className="p-2 rounded-lg text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              onClick={onSignOut}
              title="Sign Out"
              className="p-2 rounded-lg text-neutral-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
};
