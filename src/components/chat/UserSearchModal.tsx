import React, { useState, useEffect } from 'react';
import { Search, X, MessageSquare, AtSign, User, Phone, Video } from 'lucide-react';
import { Profile } from '@/src/types';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSearch: (query: string) => Promise<Profile[]>;
  onSelectUser: (userId: string, profile?: Profile) => void;
  onStartCall?: (peer: Profile, callType: 'audio' | 'video') => void;
  isUserOnline: (profile?: Profile | null) => boolean;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen,
  onClose,
  onSearch,
  onSelectUser,
  onStartCall,
  isUserOnline,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectingUserId, setSelectingUserId] = useState<string | null>(null);

  const onSearchRef = React.useRef(onSearch);
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setHasSearched(false);
      setSelectingUserId(null);
      return;
    }
  }, [isOpen]);

  const executeSearch = async (searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const users = await onSearchRef.current(trimmed);
      setResults(users || []);
      setHasSearched(true);
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      executeSearch(trimmed);
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = async (user: Profile) => {
    setSelectingUserId(user.id);
    try {
      await onSelectUser(user.id, user);
    } finally {
      setSelectingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Search header */}
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              autoFocus
              placeholder="Search by username or name..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  executeSearch(query);
                }
              }}
              className="w-full pl-10 pr-10 py-2.5 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white placeholder-neutral-400 text-base focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            />
            {loading && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-2xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Results List */}
        <div className="p-3 overflow-y-auto flex-1 min-h-[260px] space-y-1.5">
          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-12 text-sm text-neutral-400 gap-2">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Searching users...
            </div>
          )}

          {results.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-3 py-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                Matching Users ({results.length})
              </p>
              {results.map((u) => {
                const online = isUserOnline(u);
                const isSelected = selectingUserId === u.id;

                return (
                  <div
                    key={u.id}
                    onClick={() => handleSelect(u)}
                    className="p-3 rounded-2xl flex items-center justify-between hover:bg-blue-50/80 dark:hover:bg-blue-950/40 bg-neutral-50/50 dark:bg-neutral-800/30 border border-neutral-200/60 dark:border-neutral-800 cursor-pointer transition-all active:scale-[0.99] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {u.avatar_url ? (
                          <img
                            src={u.avatar_url}
                            alt={u.display_name}
                            className="w-11 h-11 rounded-2xl object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                        ) : (
                          <div
                            className={cn(
                              'w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-xs',
                              getAvatarColor(u.id)
                            )}
                          >
                            {getInitials(u.display_name)}
                          </div>
                        )}
                        <span
                          className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white dark:border-neutral-900',
                            online ? 'bg-emerald-500' : 'bg-neutral-400'
                          )}
                        />
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-sm text-neutral-900 dark:text-neutral-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {u.display_name}
                        </h4>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-mono truncate">
                          @{u.username}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onStartCall && (
                        <>
                          <button
                            type="button"
                            title="Voice Call"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCall(u, 'audio');
                            }}
                            className="p-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-600 dark:text-emerald-400 transition-colors cursor-pointer"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Video Call"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStartCall(u, 'video');
                            }}
                            className="p-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-600 dark:text-purple-400 transition-colors cursor-pointer"
                          >
                            <Video className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        disabled={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelect(u);
                        }}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                      >
                        {isSelected ? (
                          <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                        ) : (
                          <MessageSquare className="w-3.5 h-3.5" />
                        )}
                        <span>{isSelected ? 'Opening...' : 'Chat'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
              <AtSign className="w-8 h-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">No users found</p>
              <p className="text-xs text-neutral-500 mt-0.5">Try searching another username or name</p>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="flex flex-col items-center justify-center py-12 text-center text-neutral-400">
              <Search className="w-8 h-8 opacity-40 mb-2" />
              <p className="text-sm font-medium">Type a name or username</p>
              <p className="text-xs text-neutral-500 mt-0.5">Instant search across all registered users</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
