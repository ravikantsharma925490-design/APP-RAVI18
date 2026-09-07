import React, { useState, useEffect } from 'react';
import {
  Search,
  Copy,
  Check,
  MessageSquare,
  Phone,
  Video,
  User,
  ShieldAlert,
} from 'lucide-react';
import { Profile, CallType, UserRelationStatus } from '@/src/types';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';
import { COUNTRIES, GENDER_OPTIONS } from '../profile/ProfileModal';
import { FollowButton, FollowStatus } from '../profile/FollowButton';

interface SearchTabProps {
  currentUser: Profile | null;
  onSearchUsers: (query: string) => Promise<Profile[]>;
  onStartChat: (userId: string, profile?: Profile) => void;
  onStartCall: (peer: Profile, type: CallType) => void;
  onViewProfile: (profile: Profile) => void;
  isUserOnline: (profile?: Profile | null) => boolean;
  getRelationStatus?: (userId: string) => UserRelationStatus;
  getFollowStatus?: (userId: string) => FollowStatus;
  onFollow?: (target: Profile | string) => Promise<boolean | void>;
  onUnfollow?: (target: Profile | string) => Promise<boolean | void>;
}

export const SearchTab: React.FC<SearchTabProps> = ({
  currentUser,
  onSearchUsers,
  onStartChat,
  onStartCall,
  onViewProfile,
  isUserOnline,
  getRelationStatus,
  getFollowStatus,
  onFollow,
  onUnfollow,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const onSearchRef = React.useRef(onSearchUsers);
  useEffect(() => {
    onSearchRef.current = onSearchUsers;
  }, [onSearchUsers]);

  const executeSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    setLoading(true);
    setHasSearched(true);
    try {
      const users = await onSearchRef.current(trimmed);
      const uniqueUsers = Array.from(
        new Map((users || []).filter((u) => u && u.id).map((u) => [u.id, u])).values()
      );
      setResults(uniqueUsers);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  // Debounced real-database search
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setLoading(false);
      setHasSearched(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(trimmed);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/50 dark:bg-neutral-950 overflow-y-auto pb-24 md:pb-8">
      {/* Container */}
      <div className="p-4 md:p-6 max-w-4xl w-full mx-auto space-y-4">
        {/* Title */}
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Search className="w-5 h-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100">
              Search Users
            </h2>
          </div>
          <p className="text-xs md:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Search real registered users by exact User ID, username, or display name.
          </p>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch(query);
              }
            }}
            placeholder="Type User ID or @username..."
            className="w-full pl-12 pr-16 py-3.5 rounded-2xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white placeholder-neutral-400 text-sm md:text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
          />
          <div className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {query && (
              <button
                onClick={() => setQuery('')}
                className="px-2 py-1 text-xs font-bold text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Search Results / States */}
        <div className="pt-2">
          {loading && results.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-neutral-400 gap-3">
              <div className="w-7 h-7 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs font-semibold">Searching database...</p>
            </div>
          ) : !hasSearched ? (
            <div className="py-16 px-4 text-center rounded-3xl border border-dashed border-neutral-200 dark:border-neutral-800 max-w-md mx-auto">
              <div className="w-12 h-12 rounded-2xl bg-neutral-100 dark:bg-neutral-800/80 flex items-center justify-center mx-auto mb-3 text-neutral-400">
                <Search className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                Search Real Users
              </h3>
              <p className="text-xs text-neutral-400 mt-1 max-w-xs mx-auto">
                Enter a user's ID or username in the search box to find and connect with them.
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="py-16 px-4 text-center rounded-3xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 max-w-md mx-auto">
              <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-200">
                No user found
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                No registered user matches "{query}". Please check the ID or username.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {results.map((user) => {
                const online = isUserOnline(user);
                const isSelf = user.id === currentUser?.id;
                const rel = getRelationStatus ? getRelationStatus(user.id) : undefined;
                const countryObj = COUNTRIES.find((c) => c.name.toLowerCase() === user.country?.toLowerCase());
                const genderObj = GENDER_OPTIONS.find((g) => g.id.toLowerCase() === user.gender?.toLowerCase());

                return (
                  <div
                    key={user.id}
                    className="p-4 rounded-2xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:border-blue-400 dark:hover:border-blue-700 transition-all flex flex-col justify-between space-y-3 shadow-xs"
                  >
                    {/* User Info */}
                    <div className="flex items-start gap-3">
                      <div className="relative shrink-0 cursor-pointer" onClick={() => onViewProfile(user)}>
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            className="w-12 h-12 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                        ) : (
                          <div
                            className={cn(
                              'w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs text-white',
                              getAvatarColor(user.id)
                            )}
                          >
                            {getInitials(user.display_name)}
                          </div>
                        )}
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900',
                            online ? 'bg-emerald-500' : 'bg-neutral-400'
                          )}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4
                                onClick={() => onViewProfile(user)}
                                className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
                              >
                                {user.display_name}
                              </h4>
                              {/* Blocked Badge */}
                              {!isSelf && rel?.isBlocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                  <ShieldAlert className="w-3 h-3" /> Blocked
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
                              @{user.username}
                            </p>
                          </div>

                          {/* Follow / Follow Back / Following Button in Search Card */}
                          {!isSelf && getFollowStatus && onFollow && onUnfollow && (
                            <div className="shrink-0">
                              <FollowButton
                                currentUserId={currentUser?.id}
                                targetUser={user}
                                followStatus={getFollowStatus(user.id)}
                                onFollow={onFollow}
                                onUnfollow={onUnfollow}
                                size="sm"
                              />
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-mono text-neutral-400 truncate max-w-[130px] sm:max-w-[170px]">
                            ID: {user.id}
                          </span>
                          <button
                            onClick={() => handleCopy(user.id)}
                            title="Copy ID"
                            className="text-neutral-400 hover:text-blue-500 p-0.5 rounded cursor-pointer"
                          >
                            {copiedId === user.id ? (
                              <Check className="w-3 h-3 text-emerald-500" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Gender & Country if set */}
                    {(user.gender || user.country) && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {user.gender && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            <span>{genderObj?.emoji || '👤'}</span>
                            <span>{user.gender}</span>
                          </span>
                        )}
                        {user.country && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                            <span>{countryObj?.flag || '🌍'}</span>
                            <span>{user.country}</span>
                          </span>
                        )}
                      </div>
                    )}

                  {(() => {
                    const isMutual = isSelf || (Boolean(rel?.isFollowing) && Boolean(rel?.isFollowedBy)) || Boolean(rel?.isMutual);
                    const canCommunicate = isSelf || !rel?.isBlocked;

                    return (
                      <div className="space-y-2">
                        {/* Notice if not mutual */}
                        {!isSelf && !rel?.isBlocked && !isMutual && (
                          <div className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-[11px] text-emerald-700 dark:text-emerald-300 font-medium flex items-center justify-between">
                            <span>Ready to connect &bull; 1-click call & chat active</span>
                          </div>
                        )}

                        {/* Communication Actions */}
                        <div className="pt-1.5 border-t border-neutral-100 dark:border-neutral-800">
                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              onClick={() => {
                                if (canCommunicate) onStartChat(user.id, user);
                              }}
                              disabled={!canCommunicate}
                              className={cn(
                                'flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition-colors',
                                canCommunicate
                                  ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 cursor-pointer'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400 dark:text-neutral-600 cursor-not-allowed opacity-50'
                              )}
                              title={
                                rel?.isBlocked
                                  ? 'User is blocked'
                                  : 'Chat'
                              }
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Chat</span>
                            </button>

                            <button
                              onClick={() => {
                                if (canCommunicate) {
                                  onStartCall(user, 'audio');
                                }
                              }}
                              disabled={!canCommunicate}
                              className={cn(
                                'flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition-colors',
                                canCommunicate
                                  ? 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 cursor-pointer'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-50'
                              )}
                              title={
                                rel?.isBlocked
                                  ? 'User is blocked'
                                  : 'Voice Call'
                              }
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Call</span>
                            </button>

                            <button
                              onClick={() => {
                                if (canCommunicate) {
                                  onStartCall(user, 'video');
                                }
                              }}
                              disabled={!canCommunicate}
                              className={cn(
                                'flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold transition-colors',
                                canCommunicate
                                  ? 'bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 cursor-pointer'
                                  : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-300 dark:text-neutral-600 cursor-not-allowed opacity-50'
                              )}
                              title={
                                rel?.isBlocked
                                  ? 'User is blocked'
                                  : 'Video Call'
                              }
                            >
                              <Video className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Video</span>
                            </button>

                            <button
                              onClick={() => onViewProfile(user)}
                              className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl text-xs font-bold bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors cursor-pointer"
                              title="Profile"
                            >
                              <User className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Info</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

