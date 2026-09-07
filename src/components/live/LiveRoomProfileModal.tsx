import React, { useState } from 'react';
import {
  X,
  Crown,
  Shield,
  Gift,
  Coins,
  Award,
  Mic,
  MicOff,
  UserX,
  UserMinus,
  Check,
  UserPlus,
  Sparkles,
  Radio,
} from 'lucide-react';
import { Profile } from '@/src/types';
import { LiveRoom } from '@/src/types/live';
import { LiveStorageService, generateLiveSpecialId } from '@/src/lib/live/live-storage';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface LiveRoomProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: Profile | null;
  currentUser: Profile;
  room: LiveRoom;
  onOpenGiftForUser: (user: Profile) => void;
  onModerationAction: (action: string, targetUserId: string, seatIdx?: number, payload?: any) => Promise<any>;
}

export const LiveRoomProfileModal: React.FC<LiveRoomProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  currentUser,
  room,
  onOpenGiftForUser,
  onModerationAction,
}) => {
  if (!isOpen || !user) return null;

  const [isActing, setIsActing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const stats = LiveStorageService.getStats(user.id);
  const specialId = stats.specialId || generateLiveSpecialId(user.id);

  const isSelf = user.id === currentUser.id;
  const isRoomOwner = user.id === room.ownerId;
  const isRoomAdmin = user.id === room.adminId;
  const isSeated = room.seats.some((s) => s.user?.id === user.id);
  const seatedIndex = room.seats.findIndex((s) => s.user?.id === user.id);
  const isMuted = room.mutedUserIds.includes(user.id);
  const isBanned = room.bannedUserIds.includes(user.id);

  const iAmOwner = currentUser.id === room.ownerId;
  const iAmAdmin = currentUser.id === room.adminId;
  const canModerate = (iAmOwner || iAmAdmin) && !isSelf;

  const handleAction = async (action: string, payload?: any) => {
    setIsActing(true);
    setActionNotice(null);
    try {
      await onModerationAction(action, user.id, seatedIndex >= 0 ? seatedIndex : undefined, payload);
      setActionNotice(`Action performed: ${action.replace('_', ' ')}`);
      setTimeout(() => setActionNotice(null), 3000);
    } catch (e: any) {
      setActionNotice(e.message || 'Action failed');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Cover / Header banner */}
        <div className="h-24 bg-gradient-to-r from-blue-900/60 via-purple-900/60 to-amber-900/60 relative p-4 flex items-start justify-between">
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-neutral-200 text-[10px] font-bold">
            <Radio className="w-3 h-3 text-red-400 animate-pulse" />
            <span>Live Room Profile</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/40 text-neutral-400 hover:text-white hover:bg-black/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Avatar & Info */}
        <div className="px-5 pb-5 -mt-10 relative">
          <div className="flex justify-between items-end">
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-neutral-900 overflow-hidden shadow-xl">
                {user.avatar_url ? (
                  <img src={user.avatar_url} alt={user.display_name} className="w-full h-full object-cover" />
                ) : (
                  <div
                    className={cn(
                      'w-full h-full flex items-center justify-center font-bold text-xl text-white',
                      getAvatarColor(user.id)
                    )}
                  >
                    {getInitials(user.display_name)}
                  </div>
                )}
              </div>

              {isRoomOwner && (
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-amber-500 text-neutral-950 border-2 border-neutral-900">
                  <Crown className="w-3.5 h-3.5 fill-current" />
                </div>
              )}
              {!isRoomOwner && isRoomAdmin && (
                <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-blue-500 text-white border-2 border-neutral-900">
                  <Shield className="w-3.5 h-3.5 fill-current" />
                </div>
              )}
            </div>

            {/* Level Badge */}
            <div className="flex flex-col items-end">
              <div className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40 text-amber-300 text-xs font-black flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Lv. {stats.level}</span>
              </div>
              <span className="text-[10px] text-neutral-400 mt-1">
                {stats.xp} / {stats.nextLevelXp} XP
              </span>
            </div>
          </div>

          {/* Names and Special ID */}
          <div className="mt-3">
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-bold text-white truncate">{user.display_name}</h3>
              {isRoomOwner && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-400 text-[10px] font-extrabold uppercase">
                  Owner
                </span>
              )}
              {isRoomAdmin && (
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/40 text-blue-400 text-[10px] font-extrabold uppercase">
                  Admin
                </span>
              )}
              {isSeated && !isRoomOwner && !isRoomAdmin && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-[10px] font-extrabold uppercase">
                  Seat {seatedIndex + 1}
                </span>
              )}
            </div>

            <p className="text-xs text-neutral-400">@{user.username}</p>

            {/* CRITICAL: Live Room Special ID Label (ONLY in Live Rooms) */}
            <div className="mt-2.5 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="text-sm">🏷️</span>
                <div>
                  <p className="text-[10px] uppercase tracking-wider font-extrabold text-amber-400">
                    Live Room Special ID
                  </p>
                  <p className="text-xs font-mono font-bold text-white">{specialId}</p>
                </div>
              </div>
              <span className="text-[9px] font-semibold text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded-md">
                Live Only
              </span>
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <p className="text-xs text-neutral-300 mt-2.5 line-clamp-2 italic">
              "{user.bio}"
            </p>
          )}

          {/* Live Stats Row */}
          <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-neutral-800 text-center">
            <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Gifts Sent</span>
              <span className="text-xs font-bold text-neutral-200 mt-0.5 block">
                {stats.giftsSentCount}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Gifts Recv</span>
              <span className="text-xs font-bold text-amber-400 mt-0.5 block">
                {stats.giftsReceivedCount}
              </span>
            </div>
            <div className="p-2 rounded-xl bg-neutral-950/60 border border-neutral-800/80">
              <span className="text-[10px] text-neutral-400 block">Coins Recv</span>
              <span className="text-xs font-bold text-amber-300 mt-0.5 block">
                {stats.coinsReceivedTotal.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Badges */}
          <div className="mt-3">
            <span className="text-[10px] font-bold text-neutral-400 block mb-1.5">Earned Badges:</span>
            <div className="flex flex-wrap gap-1.5">
              {stats.badges.map((b, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-300 text-[10px] font-medium border border-neutral-700"
                >
                  🏅 {b}
                </span>
              ))}
            </div>
          </div>

          {/* Action Notice */}
          {actionNotice && (
            <div className="mt-2.5 p-2 rounded-xl bg-blue-500/10 border border-blue-500/30 text-[11px] text-blue-300 text-center font-semibold">
              {actionNotice}
            </div>
          )}

          {/* Action Buttons */}
          <div className="mt-4 flex flex-col space-y-2">
            {!isSelf && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGiftForUser(user);
                }}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-neutral-950 font-bold text-xs flex items-center justify-center space-x-1.5 shadow-md hover:brightness-110 transition-all cursor-pointer"
              >
                <Gift className="w-4 h-4" />
                <span>Send Virtual Gift</span>
              </button>
            )}

            {/* Moderation Controls (Owner & Admin) */}
            {canModerate && (
              <div className="pt-2 border-t border-neutral-800/80 space-y-1.5">
                <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block">
                  Moderator Actions
                </span>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Mute / Unmute */}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => handleAction(isMuted ? 'unmute_seat' : 'mute_seat')}
                    className="p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold flex items-center justify-center space-x-1 border border-neutral-700 cursor-pointer"
                  >
                    {isMuted ? <Mic className="w-3.5 h-3.5 text-emerald-400" /> : <MicOff className="w-3.5 h-3.5 text-red-400" />}
                    <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
                  </button>

                  {/* Kick from room */}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => handleAction('kick_user')}
                    className="p-2 rounded-xl bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-xs font-semibold flex items-center justify-center space-x-1 border border-neutral-700 cursor-pointer"
                  >
                    <UserMinus className="w-3.5 h-3.5 text-orange-400" />
                    <span>Kick User</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {/* Ban User */}
                  <button
                    type="button"
                    disabled={isActing}
                    onClick={() => handleAction('ban_user')}
                    className="p-2 rounded-xl bg-red-950/40 text-red-300 hover:bg-red-900/50 text-xs font-semibold flex items-center justify-center space-x-1 border border-red-800/50 cursor-pointer"
                  >
                    <UserX className="w-3.5 h-3.5 text-red-400" />
                    <span>Ban from Room</span>
                  </button>

                  {/* Appoint / Remove Admin (Owner only, strictly exactly 1 Admin) */}
                  {iAmOwner && !isRoomOwner && (
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() =>
                        handleAction(isRoomAdmin ? 'remove_admin' : 'appoint_admin', {
                          targetUser: user,
                          permissions: {
                            canMute: true,
                            canKick: true,
                            canBan: false,
                            canLockSeats: true,
                            canPlayMusic: true,
                            canManageGames: true,
                          },
                        })
                      }
                      className="p-2 rounded-xl bg-blue-950/40 text-blue-300 hover:bg-blue-900/50 text-xs font-semibold flex items-center justify-center space-x-1 border border-blue-800/50 cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isRoomAdmin ? 'Remove Admin' : 'Appoint Admin'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
