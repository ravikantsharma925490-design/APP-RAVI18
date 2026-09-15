import React from 'react';
import { Conversation } from '@/src/types';
import { cn, formatDate, getAvatarColor, getInitials } from '@/src/lib/utils';
import { Check, CheckCheck, Trash2, Phone, Video, PhoneMissed, PhoneOutgoing, PhoneIncoming } from 'lucide-react';
import { UserAvatar } from '@/src/components/ui/UserAvatar';

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  isOnline: boolean;
  currentUserId?: string;
  onSelect: () => void;
  onDelete?: (e: React.MouseEvent) => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = ({
  conversation,
  isSelected,
  isOnline,
  currentUserId,
  onSelect,
  onDelete,
}) => {
  const otherUser = conversation.other_member;
  const lastMsg = conversation.last_message;
  const isLastMsgFromMe = lastMsg?.sender_id === currentUserId;

  const isSelf = otherUser?.id === currentUserId;
  const rawDisplayName = otherUser?.display_name || otherUser?.username || 'Unknown User';
  const displayName = isSelf ? `${rawDisplayName} (You)` : rawDisplayName;
  const avatarUrl = otherUser?.avatar_url;

  // Render call log label if last message is a call log
  const renderMessagePreview = () => {
    if (!lastMsg?.content) return 'No messages yet';

    if (lastMsg.content.startsWith('[CALL_LOG:') && lastMsg.content.endsWith(']')) {
      const tokens = lastMsg.content.slice(10, -1).split(':');
      const isVideo = tokens[0] === 'video';
      const rawStatus = tokens[1] || 'ended';
      const rawMissedFlag = tokens[2];
      const details = tokens.slice(3).join(':');

      const hasConnectedDuration = Boolean(
        details &&
        details !== 'No answer' &&
        details !== 'Declined' &&
        details !== 'Cancelled' &&
        details !== 'Missed' &&
        details !== 'Ended' &&
        details !== 'Call ended' &&
        /\d/.test(details)
      );

      const isMissed = !hasConnectedDuration || rawMissedFlag === 'missed' || rawStatus === 'missed' || rawStatus === 'rejected' || rawStatus === 'cancelled';

      if (isLastMsgFromMe) {
        return (
          <span className={cn('inline-flex items-center gap-1', isSelected ? 'text-blue-100' : 'text-neutral-500 dark:text-neutral-400')}>
            {isVideo ? (
              <Video className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <PhoneOutgoing className="w-3.5 h-3.5 shrink-0" />
            )}
            <span className="truncate">
              {isVideo ? 'Video call' : 'Voice call'}
              {isMissed ? ' • No answer' : (hasConnectedDuration ? ` • ${details}` : '')}
            </span>
          </span>
        );
      }

      if (isMissed) {
        return (
          <span className={cn('inline-flex items-center gap-1 font-medium', isSelected ? 'text-red-200' : 'text-[#ea4335] dark:text-[#ef4444]')}>
            <PhoneMissed className={cn('w-3.5 h-3.5 shrink-0', isSelected ? 'text-red-200' : 'text-[#ea4335] dark:text-[#ef4444]')} />
            <span className="truncate">{isVideo ? 'Missed video call' : 'Missed voice call'}</span>
          </span>
        );
      }

      return (
        <span className={cn('inline-flex items-center gap-1', isSelected ? 'text-blue-100' : 'text-neutral-500 dark:text-neutral-400')}>
          {isVideo ? (
            <Video className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <PhoneIncoming className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">
            {isVideo ? 'Video call' : 'Voice call'}
            {hasConnectedDuration ? ` • ${details}` : ''}
          </span>
        </span>
      );
    }

    if (lastMsg.content.startsWith('[IMAGE:') && lastMsg.content.endsWith(']')) {
      const inside = lastMsg.content.slice(7, -1);
      const colonIdx = inside.lastIndexOf(':');
      let caption = '';
      if (colonIdx !== -1 && !inside.startsWith('data:image')) {
        caption = inside.slice(colonIdx + 1);
      }
      return caption ? `📷 Photo: ${caption}` : '📷 Photo';
    }

    if (lastMsg.content.startsWith('[VIDEO:') && lastMsg.content.endsWith(']')) {
      const inside = lastMsg.content.slice(7, -1);
      const colonIdx = inside.lastIndexOf(':');
      let caption = '';
      if (colonIdx !== -1 && !inside.startsWith('data:video')) {
        caption = inside.slice(colonIdx + 1);
      }
      return caption ? `🎥 Video: ${caption}` : '🎥 Video';
    }

    if (lastMsg.content.startsWith('[VOICE:') && lastMsg.content.endsWith(']')) {
      return '🎙️ Voice note';
    }

    if (lastMsg.content.startsWith('[STICKER:') && lastMsg.content.endsWith(']')) {
      const parts = lastMsg.content.slice(9, -1).split(':');
      const icon = parts[0] || '✨';
      const label = parts[1] || 'Sticker';
      return `${icon} ${label}`;
    }

    return lastMsg.content;
  };

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      className={cn(
        'w-full text-left p-3 rounded-2xl flex items-center gap-3 transition-all relative group cursor-pointer select-none',
        isSelected
          ? 'bg-blue-600 text-white shadow-md shadow-blue-500/10'
          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200'
      )}
    >
      {/* Avatar with presence dot */}
      <UserAvatar
        src={avatarUrl}
        name={displayName}
        id={otherUser?.id || conversation.id}
        className="w-12 h-12 border border-black/10 dark:border-white/10"
        showStatus
        isOnline={isOnline}
      />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
            <h4
              className={cn(
                'font-semibold text-sm truncate',
                isSelected ? 'text-white' : 'text-neutral-900 dark:text-neutral-100'
              )}
            >
              {displayName}
            </h4>
            {otherUser?.username && (
              <span
                className={cn(
                  'text-[11px] font-normal truncate shrink-0 max-w-[120px]',
                  isSelected ? 'text-blue-200' : 'text-neutral-400 dark:text-neutral-500'
                )}
                title={`@${otherUser.username}`}
              >
                @{otherUser.username}
              </span>
            )}
          </div>
          {lastMsg?.created_at && (
            <span
              className={cn(
                'text-[11px] shrink-0 font-medium',
                isSelected ? 'text-blue-100' : 'text-neutral-400'
              )}
            >
              {formatDate(lastMsg.created_at)}
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-2">
          <p
            className={cn(
              'text-xs truncate flex items-center gap-1 flex-1 min-w-0',
              isSelected ? 'text-blue-100' : 'text-neutral-500 dark:text-neutral-400'
            )}
          >
            {isLastMsgFromMe && !lastMsg?.content?.startsWith('[CALL_LOG:') && (
              <span className="shrink-0 inline-flex items-center">
                {lastMsg?.is_read ? (
                  <CheckCheck className="w-3.5 h-3.5 text-blue-300" />
                ) : (
                  <Check className="w-3.5 h-3.5 opacity-70" />
                )}
              </span>
            )}
            <span className="truncate">{renderMessagePreview()}</span>
          </p>

          {/* Delete Quick Action on hover / right side */}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(e);
              }}
              title="Delete conversation"
              className={cn(
                'opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all',
                isSelected
                  ? 'hover:bg-blue-700 text-white'
                  : 'hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50 dark:hover:text-red-400 text-neutral-400'
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Unread badge */}
          {!isSelected && Boolean(conversation.unread_count && conversation.unread_count > 0) && (
            <span
              className="shrink-0 px-2 py-0.5 text-[11px] font-bold rounded-full min-w-[20px] text-center shadow-sm animate-in zoom-in bg-blue-600 text-white"
            >
              {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
