import React from 'react';
import { Crown, Shield, MicOff, Lock, Plus, Volume2 } from 'lucide-react';
import { LiveVoiceSeat } from '@/src/types/live';
import { Profile } from '@/src/types';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface LiveVoiceSeatCardProps {
  seat: LiveVoiceSeat;
  seatNumber: number; // 1 to 8
  isOwner: boolean;
  isAdmin: boolean;
  isCurrentUser: boolean;
  isHighlighted?: boolean;
  onSelectUser: (user: Profile) => void;
  onTakeSeat: (seatIndex: number) => void;
}

export const LiveVoiceSeatCard: React.FC<LiveVoiceSeatCardProps> = ({
  seat,
  seatNumber,
  isOwner,
  isAdmin,
  isCurrentUser,
  isHighlighted = false,
  onSelectUser,
  onTakeSeat,
}) => {
  const user = seat.user;

  // Empty Seat
  if (!user) {
    if (seat.isLocked) {
      return (
        <div className="flex flex-col items-center justify-center p-1 select-none">
          <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-neutral-800/80 border border-neutral-700/60 flex items-center justify-center text-neutral-500 shadow-inner">
            <Lock className="w-5 h-5 text-neutral-400" />
            <span className="absolute -bottom-1 px-1.5 py-0.5 rounded-full bg-neutral-800 text-[10px] font-bold text-neutral-400 border border-neutral-700">
              {seatNumber}
            </span>
          </div>
          <span className="text-[11px] font-medium text-neutral-400 mt-1.5">Locked</span>
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onTakeSeat(seat.seatIndex)}
        className="flex flex-col items-center justify-center p-1 group cursor-pointer select-none transition-transform active:scale-95"
        title={`Take Seat ${seatNumber}`}
      >
        <div className="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-white/5 dark:bg-white/5 border-2 border-dashed border-neutral-400/40 dark:border-neutral-600/50 group-hover:border-blue-500 group-hover:bg-blue-500/10 transition-all flex items-center justify-center text-neutral-400 group-hover:text-blue-500">
          <Plus className="w-6 h-6 transition-transform group-hover:scale-110" />
          <span className="absolute -bottom-1 px-1.5 py-0.5 rounded-full bg-neutral-900 text-[10px] font-bold text-neutral-400 border border-neutral-700 group-hover:text-blue-400 group-hover:border-blue-500/50">
            {seatNumber}
          </span>
        </div>
        <span className="text-[11px] font-medium text-neutral-400 group-hover:text-blue-400 mt-1.5">
          Seat {seatNumber}
        </span>
      </button>
    );
  }

  // Occupied Seat
  return (
    <div
      onClick={() => onSelectUser(user)}
      className="flex flex-col items-center justify-center p-1 relative cursor-pointer select-none group transition-transform active:scale-95"
      title={`${user.display_name} (Seat ${seatNumber})`}
    >
      <div className="relative">
        {/* Speaking ripple ring animation */}
        {seat.isSpeaking && !seat.isMuted && (
          <>
            <span className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-ping opacity-75" />
            <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 animate-pulse" />
          </>
        )}

        {/* Gift temporary golden halo highlight */}
        {isHighlighted && (
          <span className="absolute -inset-2.5 rounded-full bg-amber-400/50 animate-ping opacity-90 border-2 border-amber-300" />
        )}

        {/* Avatar circle */}
        <div
          className={cn(
            'relative w-16 h-16 sm:w-18 sm:h-18 rounded-full overflow-hidden border-2 transition-all shadow-md',
            isHighlighted
              ? 'border-amber-400 shadow-amber-500/50 ring-4 ring-amber-400/40'
              : seat.isSpeaking && !seat.isMuted
              ? 'border-emerald-400 shadow-emerald-500/40'
              : isCurrentUser
              ? 'border-blue-500'
              : isOwner
              ? 'border-amber-400/80'
              : isAdmin
              ? 'border-blue-400/80'
              : 'border-neutral-700'
          )}
        >
          {user.avatar_url ? (
            <img
              src={user.avatar_url}
              alt={user.display_name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className={cn(
                'w-full h-full flex items-center justify-center font-bold text-base text-white',
                getAvatarColor(user.id)
              )}
            >
              {getInitials(user.display_name)}
            </div>
          )}
        </div>

        {/* Role Badge: Owner (Crown) or Admin (Shield) */}
        {isOwner && (
          <div
            className="absolute -top-1.5 -right-1 p-1 rounded-full bg-amber-500 text-neutral-950 shadow-md border-2 border-neutral-900"
            title="Room Owner / Honor"
          >
            <Crown className="w-3.5 h-3.5 fill-current" />
          </div>
        )}
        {!isOwner && isAdmin && (
          <div
            className="absolute -top-1.5 -right-1 p-1 rounded-full bg-blue-500 text-white shadow-md border-2 border-neutral-900"
            title="Room Admin"
          >
            <Shield className="w-3.5 h-3.5 fill-current" />
          </div>
        )}

        {/* Mic status indicator */}
        <div
          className={cn(
            'absolute -bottom-1 -right-1 p-1 rounded-full shadow-md border border-neutral-900 text-white',
            seat.isMuted ? 'bg-red-500' : seat.isSpeaking ? 'bg-emerald-500' : 'bg-neutral-800'
          )}
        >
          {seat.isMuted ? (
            <MicOff className="w-3 h-3" />
          ) : seat.isSpeaking ? (
            <Volume2 className="w-3 h-3 animate-pulse" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 block" />
          )}
        </div>

        {/* Seat Number Tag */}
        <span className="absolute -bottom-1 -left-1 px-1.5 py-0.5 rounded-full bg-neutral-900/90 text-[9px] font-bold text-neutral-300 border border-neutral-700">
          {seatNumber}
        </span>
      </div>

      {/* User Name */}
      <span className="text-[11px] font-semibold text-neutral-200 mt-1.5 truncate max-w-[76px] text-center">
        {user.display_name}
      </span>
    </div>
  );
};
