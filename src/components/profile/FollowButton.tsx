import React, { useState } from 'react';
import { UserPlus, UserCheck, Users, Loader2 } from 'lucide-react';
import { Profile } from '@/src/types';
import { cn } from '@/src/lib/utils';

export type FollowStatus = 'not_following' | 'following' | 'followed_by' | 'mutual' | 'self';

interface FollowButtonProps {
  currentUserId?: string;
  targetUser: Profile | string;
  followStatus?: FollowStatus;
  onFollow: (target: Profile | string) => Promise<boolean | void>;
  onUnfollow: (target: Profile | string) => Promise<boolean | void>;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const FollowButton: React.FC<FollowButtonProps> = ({
  currentUserId,
  targetUser,
  followStatus = 'not_following',
  onFollow,
  onUnfollow,
  size = 'md',
  className,
}) => {
  const [loading, setLoading] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const targetId = typeof targetUser === 'string' ? targetUser : targetUser?.id;

  // Don't show button for self
  if (!targetId || (currentUserId && targetId === currentUserId) || followStatus === 'self') {
    return null;
  }

  const isFollowing = followStatus === 'following' || followStatus === 'mutual';
  const isFollowBack = followStatus === 'followed_by';

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      if (isFollowing) {
        // Unfollow
        await onUnfollow(targetUser);
      } else {
        // Follow or Follow Back
        await onFollow(targetUser);
      }
    } catch (err) {
      console.error('Follow action failed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Size styling
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs rounded-xl font-semibold gap-1.5',
    md: 'px-4 py-2 text-xs md:text-sm rounded-2xl font-bold gap-2',
    lg: 'px-5 py-2.5 text-sm md:text-base rounded-2xl font-bold gap-2.5',
  }[size];

  // Button text based on exact requirements:
  // not_following -> Follow
  // followed_by -> Follow Back
  // following / mutual -> Following (or Unfollow on hover)
  let buttonLabel = 'Follow';
  let buttonIcon = <UserPlus className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />;

  if (isFollowing) {
    if (isHovered) {
      buttonLabel = 'Unfollow';
    } else {
      buttonLabel = 'Following';
    }
    buttonIcon = followStatus === 'mutual' && !isHovered ? (
      <Users className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    ) : (
      <UserCheck className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />
    );
  } else if (isFollowBack) {
    buttonLabel = 'Follow Back';
    buttonIcon = <UserPlus className={size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4'} />;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      disabled={loading}
      className={cn(
        'inline-flex items-center justify-center transition-all shadow-xs select-none cursor-pointer',
        sizeClasses,
        loading && 'opacity-70 cursor-not-allowed',
        isFollowing
          ? isHovered
            ? 'bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/60'
            : 'bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 border border-neutral-300 dark:border-neutral-700'
          : isFollowBack
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md shadow-blue-500/25 active:scale-95'
          : 'bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 active:scale-95',
        className
      )}
    >
      {loading ? (
        <>
          <Loader2 className={cn('animate-spin', size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
          <span>{isFollowing ? 'Updating...' : 'Following...'}</span>
        </>
      ) : (
        <>
          {buttonIcon}
          <span>{buttonLabel}</span>
        </>
      )}
    </button>
  );
};
