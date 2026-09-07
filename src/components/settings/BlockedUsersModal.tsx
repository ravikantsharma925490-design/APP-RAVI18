import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  UserX,
  Search,
  ShieldAlert,
  ShieldCheck,
  RefreshCw,
  UserCheck,
  AlertTriangle,
} from 'lucide-react';
import { Profile } from '@/src/types';
import { getSupabase } from '@/src/lib/supabase/client';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface BlockedUsersModalProps {
  isOpen: boolean;
  onClose: () => void;
  blockedUserIds: Set<string> | string[];
  onUnblock: (userId: string) => Promise<boolean | void>;
  currentUserId?: string;
}

export const BlockedUsersModal: React.FC<BlockedUsersModalProps> = ({
  isOpen,
  onClose,
  blockedUserIds,
  onUnblock,
  currentUserId,
}) => {
  const [blockedUsers, setBlockedUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [userToUnblock, setUserToUnblock] = useState<Profile | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const blockedIdsArray = Array.from(blockedUserIds || []);

  const fetchBlockedProfiles = useCallback(async () => {
    if (!isOpen || blockedIdsArray.length === 0) {
      setBlockedUsers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = getSupabase();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('id', blockedIdsArray);

      if (error) {
        console.warn('Error loading blocked profiles:', error.message);
        setBlockedUsers([]);
      } else {
        setBlockedUsers((data as Profile[]) || []);
      }
    } catch (err) {
      console.warn('Failed to fetch blocked users:', err);
      setBlockedUsers([]);
    } finally {
      setLoading(false);
    }
  }, [isOpen, blockedIdsArray.join(',')]);

  useEffect(() => {
    if (isOpen) {
      fetchBlockedProfiles();
      setSearchQuery('');
      setUserToUnblock(null);
    }
  }, [isOpen, fetchBlockedProfiles]);

  const handleConfirmUnblock = async () => {
    if (!userToUnblock) return;
    const target = userToUnblock;
    setUnblockingId(target.id);
    setUserToUnblock(null);

    try {
      await onUnblock(target.id);
      // Remove from local blocked users state immediately
      setBlockedUsers((prev) => prev.filter((u) => u.id !== target.id));
      setToastMessage(`Unblocked ${target.display_name || `@${target.username}`}`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Failed to unblock user:', err);
    } finally {
      setUnblockingId(null);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = blockedUsers.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      (u.display_name && u.display_name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-150">
        
        {/* Top Notification Toast */}
        {toastMessage && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 text-xs font-semibold shadow-xl border border-neutral-700 animate-in fade-in slide-in-from-top-2 duration-150">
            {toastMessage}
          </div>
        )}

        {/* Unblock Confirmation Dialog Modal */}
        {userToUnblock && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-6 animate-in fade-in duration-150">
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>

              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
                  Unblock {userToUnblock.display_name || `@${userToUnblock.username}`}?
                </h4>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
                  They will be able to search for your profile, message you, and initiate calls again.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToUnblock(null)}
                  className="py-2.5 rounded-2xl bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmUnblock}
                  className="py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition-all active:scale-95 cursor-pointer"
                >
                  Unblock
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal Header */}
        <div className="p-4 md:p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-red-500/10 text-red-600 dark:text-red-400">
              <UserX className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base md:text-lg font-extrabold text-neutral-900 dark:text-neutral-100">
                  Blocked Accounts
                </h3>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                  {blockedUsers.length}
                </span>
              </div>
              <p className="text-xs text-neutral-500">
                Blocked users cannot message or call you
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={fetchBlockedProfiles}
              title="Refresh list"
              disabled={loading}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar (Only if there are blocked users) */}
        {blockedUsers.length > 0 && (
          <div className="p-3 md:px-5 border-b border-neutral-100 dark:border-neutral-800/60 bg-neutral-50/50 dark:bg-neutral-800/20">
            <div className="relative">
              <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search blocked accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 text-xs rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
        )}

        {/* Blocked Users List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-2.5">
          {loading ? (
            <div className="space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-800 animate-pulse flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
                    <div className="space-y-1.5">
                      <div className="w-24 h-3 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                      <div className="w-16 h-2 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                    </div>
                  </div>
                  <div className="w-20 h-8 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
                </div>
              ))}
            </div>
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-2">
              {filteredUsers.map((user) => {
                const isUnblocking = unblockingId === user.id;

                return (
                  <div
                    key={user.id}
                    className="p-3.5 rounded-2xl bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700 transition-all flex items-center justify-between gap-3 group"
                  >
                    {/* User Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="relative shrink-0">
                        {user.avatar_url ? (
                          <img
                            src={user.avatar_url}
                            alt={user.display_name}
                            className="w-10 h-10 rounded-full object-cover border border-neutral-200 dark:border-neutral-700"
                          />
                        ) : (
                          <div
                            className={cn(
                              'w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-xs',
                              getAvatarColor(user.id)
                            )}
                          >
                            {getInitials(user.display_name)}
                          </div>
                        )}
                        <span className="absolute -bottom-0.5 -right-0.5 p-0.5 bg-red-600 rounded-full text-white">
                          <UserX className="w-2.5 h-2.5" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
                            {user.display_name || user.username}
                          </h4>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50">
                            Blocked
                          </span>
                        </div>
                        <p className="text-xs text-neutral-500 font-mono truncate">
                          @{user.username}
                        </p>
                      </div>
                    </div>

                    {/* Unblock Action Button */}
                    <button
                      type="button"
                      disabled={isUnblocking}
                      onClick={() => setUserToUnblock(user)}
                      className="px-3.5 py-2 rounded-xl bg-white dark:bg-neutral-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-neutral-700 dark:text-neutral-300 hover:text-blue-600 dark:hover:text-blue-400 border border-neutral-200 dark:border-neutral-700 hover:border-blue-300 dark:hover:border-blue-800 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      {isUnblocking ? (
                        <div className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>Unblock</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-12 px-4 text-center space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-200 dark:border-emerald-900/50">
                <ShieldCheck className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <h4 className="text-base font-bold text-neutral-800 dark:text-neutral-200">
                  {searchQuery ? 'No matching blocked accounts' : 'No Blocked Accounts'}
                </h4>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  {searchQuery
                    ? `No blocked accounts matched "${searchQuery}".`
                    : 'You have not blocked any accounts. Blocked users will appear here and you can unblock them anytime.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer info banner */}
        <div className="p-3.5 px-5 bg-neutral-50 dark:bg-neutral-800/40 border-t border-neutral-200/80 dark:border-neutral-800 text-[11px] text-neutral-500 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-neutral-400 shrink-0" />
          <span>
            When you unblock a user, they will be able to see your profile and initiate chats or calls again.
          </span>
        </div>
      </div>
    </div>
  );
};
