import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Users, UserCheck, Loader2 } from 'lucide-react';
import { Profile } from '@/src/types';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';
import { FollowButton, FollowStatus } from './FollowButton';
import {
  loadCachedFollowersList,
  loadCachedFollowingList,
  saveCachedFollowersList,
  saveCachedFollowingList,
} from '@/src/lib/social-cache';

interface FollowsListModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userDisplayName?: string;
  initialTab?: 'followers' | 'following';
  currentUserId?: string;
  onSelectUser?: (user: Profile) => void;
  getFollowStatus?: (userId: string) => FollowStatus;
  onFollow?: (target: Profile | string) => Promise<boolean | void>;
  onUnfollow?: (target: Profile | string) => Promise<boolean | void>;
  fetchFollowers: (userId: string) => Promise<Profile[]>;
  fetchFollowing: (userId: string) => Promise<Profile[]>;
  followersCount?: number;
  followingCount?: number;
}

export const FollowsListModal: React.FC<FollowsListModalProps> = ({
  isOpen,
  onClose,
  userId,
  userDisplayName = 'User',
  initialTab = 'followers',
  currentUserId,
  onSelectUser,
  getFollowStatus,
  onFollow,
  onUnfollow,
  fetchFollowers,
  fetchFollowing,
  followersCount = 0,
  followingCount = 0,
}) => {
  const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
  const [followersList, setFollowersList] = useState<Profile[]>(() => loadCachedFollowersList(userId));
  const [followingList, setFollowingList] = useState<Profile[]>(() => loadCachedFollowingList(userId));
  const [followersLoaded, setFollowersLoaded] = useState(() => loadCachedFollowersList(userId).length > 0);
  const [followingLoaded, setFollowingLoaded] = useState(() => loadCachedFollowingList(userId).length > 0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const isFetchingRef = useRef(false);

  const loadData = useCallback(async (isSilent = false) => {
    if (!isOpen || !userId || isFetchingRef.current) return;
    isFetchingRef.current = true;
    if (!isSilent) {
      setLoading(true);
    }
    try {
      const [fData, fgData] = await Promise.all([
        fetchFollowers(userId).catch(() => []),
        fetchFollowing(userId).catch(() => []),
      ]);

      if (Array.isArray(fData)) {
        setFollowersList(fData);
        setFollowersLoaded(true);
        saveCachedFollowersList(userId, fData);
      }
      if (Array.isArray(fgData)) {
        setFollowingList(fgData);
        setFollowingLoaded(true);
        saveCachedFollowingList(userId, fgData);
      }
    } catch (err) {
      console.error('Error fetching list:', err);
    } finally {
      isFetchingRef.current = false;
      if (!isSilent) {
        setLoading(false);
      }
    }
  }, [isOpen, userId, fetchFollowers, fetchFollowing]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      setSearchQuery('');
      // Hydrate from cache immediately for target userId
      const cachedFollowers = loadCachedFollowersList(userId);
      const cachedFollowing = loadCachedFollowingList(userId);
      if (cachedFollowers.length > 0) {
        setFollowersList(cachedFollowers);
        setFollowersLoaded(true);
      }
      if (cachedFollowing.length > 0) {
        setFollowingList(cachedFollowing);
        setFollowingLoaded(true);
      }

      const hasCached = cachedFollowers.length > 0 || cachedFollowing.length > 0;
      loadData(hasCached);

      const interval = setInterval(() => {
        loadData(true);
      }, 3500);
      return () => clearInterval(interval);
    }
  }, [isOpen, initialTab, userId, loadData]);

  if (!isOpen) return null;

  const currentList = activeTab === 'followers' ? followersList : followingList;
  const filteredList = currentList.filter((item) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      item.display_name?.toLowerCase().includes(q) ||
      item.username?.toLowerCase().includes(q) ||
      item.id?.toLowerCase().includes(q)
    );
  });

  const displayFollowersCount = followersLoaded
    ? followersList.length
    : (typeof followersCount === 'number' ? followersCount : 0);
  const displayFollowingCount = followingLoaded
    ? followingList.length
    : (typeof followingCount === 'number' ? followingCount : 0);

  const handleFollowItem = async (target: Profile | string) => {
    if (onFollow) {
      await onFollow(target);
      loadData(true);
    }
  };

  const handleUnfollowItem = async (target: Profile | string) => {
    if (onUnfollow) {
      await onUnfollow(target);
      loadData(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white dark:bg-neutral-900 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-base md:text-lg text-neutral-900 dark:text-neutral-100">
              {userDisplayName}
            </h3>
            <p className="text-xs text-neutral-500">
              {activeTab === 'followers' ? 'People who follow this user' : 'People this user follows'}
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-2xl bg-neutral-100 dark:bg-neutral-800 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 bg-neutral-100 dark:bg-neutral-800/60 m-4 rounded-2xl border border-neutral-200/60 dark:border-neutral-700/60">
          <button
            onClick={() => setActiveTab('followers')}
            className={cn(
              'py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeTab === 'followers'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Followers ({displayFollowersCount})</span>
          </button>

          <button
            onClick={() => setActiveTab('following')}
            className={cn(
              'py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer',
              activeTab === 'following'
                ? 'bg-white dark:bg-neutral-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
            )}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>Following ({displayFollowingCount})</span>
          </button>
        </div>

        {/* Search input in list */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name or @username..."
              className="w-full pl-9 pr-3.5 py-2 text-base rounded-xl bg-neutral-50 dark:bg-neutral-800/80 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2 divide-y divide-neutral-100 dark:divide-neutral-800/50">
          {loading && currentList.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-neutral-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-xs font-medium">Loading {activeTab}...</p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-12 text-center text-neutral-400 space-y-1.5">
              <p className="text-sm font-bold text-neutral-600 dark:text-neutral-300">
                {searchQuery
                  ? 'No matching users found'
                  : activeTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
              </p>
              <p className="text-xs text-neutral-400">
                {searchQuery
                  ? 'Try searching with another keyword'
                  : activeTab === 'followers'
                  ? 'When other users follow this profile, they will appear here.'
                  : 'Follow other users to see their updates.'}
              </p>
            </div>
          ) : (
            filteredList.map((user) => {
              const status = getFollowStatus ? getFollowStatus(user.id) : 'not_following';
              const isSelf = currentUserId === user.id;

              return (
                <div
                  key={user.id}
                  className="pt-2 flex items-center justify-between gap-3 group"
                >
                  <div
                    onClick={() => {
                      if (onSelectUser) {
                        onSelectUser(user);
                        onClose();
                      }
                    }}
                    className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                  >
                    {user.avatar_url ? (
                      <img
                        src={user.avatar_url}
                        alt={user.display_name}
                        className="w-10 h-10 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700 shrink-0"
                      />
                    ) : (
                      <div
                        className={cn(
                          'w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shadow-xs text-white shrink-0',
                          getAvatarColor(user.id)
                        )}
                      >
                        {getInitials(user.display_name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs md:text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {user.display_name}
                      </h4>
                      <p className="text-[11px] text-neutral-500 font-mono truncate">
                        @{user.username}
                      </p>
                    </div>
                  </div>

                  {/* Follow / Following / Follow Back Button */}
                  {!isSelf && onFollow && onUnfollow && (
                    <FollowButton
                      currentUserId={currentUserId}
                      targetUser={user}
                      followStatus={status}
                      onFollow={handleFollowItem}
                      onUnfollow={handleUnfollowItem}
                      size="sm"
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
