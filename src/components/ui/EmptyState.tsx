import React from 'react';
import { MessageSquare, Users, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  type: 'no-conversation-selected' | 'no-messages' | 'no-conversations' | 'no-users-found';
  onAction?: () => void;
  actionLabel?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ type, onAction, actionLabel }) => {
  if (type === 'no-conversation-selected') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-neutral-50 dark:bg-neutral-900/50">
        <div className="w-20 h-20 rounded-3xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-5 shadow-inner">
          <MessageSquare className="w-10 h-10" />
        </div>
        <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
          Select a Conversation
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mb-6 leading-relaxed">
          Choose a conversation from the sidebar or start a new real-time chat, audio call, or video call.
        </p>
        {onAction && (
          <button
            onClick={onAction}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:scale-105 active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            {actionLabel || 'New Chat'}
          </button>
        )}
      </div>
    );
  }

  if (type === 'no-messages') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 opacity-60" />
        </div>
        <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
          No messages yet
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-xs">
          Send a message or start an audio/video call to begin the conversation.
        </p>
      </div>
    );
  }

  if (type === 'no-conversations') {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-400 flex items-center justify-center mb-3">
          <Users className="w-6 h-6 opacity-60" />
        </div>
        <h4 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
          No conversations yet
        </h4>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-[200px] mb-4">
          Find users by username to start chatting or calling.
        </p>
        {onAction && (
          <button
            onClick={onAction}
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            {actionLabel || 'Search Users'}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-6 text-center text-xs text-neutral-500">
      No results found.
    </div>
  );
};
