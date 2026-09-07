import React, { useState, useEffect } from 'react';
import { Loader2, Phone, PhoneOff, Video } from 'lucide-react';
import { Call } from '@/src/types';
import { cn, getAvatarColor, getInitials } from '@/src/lib/utils';

interface IncomingCallModalProps {
  incomingCall: Call | null;
  onAccept: () => void;
  onReject: () => void;
  onOpenProfile?: (profile: any) => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  incomingCall,
  onAccept,
  onReject,
}) => {
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    setIsAccepting(false);
  }, [incomingCall?.id]);

  if (!incomingCall) return null;

  const caller = incomingCall.caller;
  const displayName = caller?.display_name || caller?.username || 'Unknown Caller';
  const username = caller?.username || '';
  const avatarUrl = caller?.avatar_url;
  const isVideo = incomingCall.call_type === 'video';

  const handleAccept = () => {
    if (isAccepting) return;
    setIsAccepting(true);
    onAccept();
  };

  return (
    <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-lg animate-in fade-in duration-200">
      <div className="bg-neutral-900 border border-neutral-700/80 text-white w-full max-w-sm rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center relative overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Glowing backdrop rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none animate-pulse" />

        {/* Call Type Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neutral-800/90 border border-neutral-700 text-xs font-semibold text-neutral-200 mb-6 shadow-md">
          {isVideo ? (
            <Video className="w-4 h-4 text-blue-400 animate-pulse" />
          ) : (
            <Phone className="w-4 h-4 text-emerald-400 animate-pulse" />
          )}
          <span>Incoming {isVideo ? 'Video' : 'Audio'} Call</span>
        </div>

        {/* Pulsing Avatar */}
        <div className="relative mb-6">
          <div className="absolute -inset-2 rounded-full bg-emerald-500/30 animate-ping" />
          <div className="absolute -inset-4 rounded-full bg-emerald-500/10 animate-pulse" />
          <div className="relative z-10">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-28 h-28 rounded-full object-cover border-4 border-neutral-800 shadow-2xl"
              />
            ) : (
              <div
                className={cn(
                  'w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl shadow-2xl border-4 border-neutral-800',
                  getAvatarColor(incomingCall.caller_id)
                )}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>
        </div>

        {/* Caller Info */}
        <h3 className="text-2xl font-bold text-white mb-1 tracking-tight">{displayName}</h3>
        {username && <p className="text-xs text-neutral-400 font-mono mb-8">@{username}</p>}

        {/* Accept / Decline Action Buttons */}
        <div className="flex items-center justify-center gap-8 w-full pt-2">
          {/* Decline Button */}
          <button
            onClick={onReject}
            type="button"
            disabled={isAccepting}
            className={cn(
              "flex flex-col items-center gap-2 group cursor-pointer focus:outline-none transition-opacity",
              isAccepting && "opacity-40 cursor-not-allowed pointer-events-none"
            )}
          >
            <div className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:bg-red-800 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all group-hover:scale-110 active:scale-95">
              <PhoneOff className="w-7 h-7" />
            </div>
            <span className="text-xs font-semibold text-neutral-400 group-hover:text-red-400 transition-colors">
              Decline
            </span>
          </button>

          {/* Accept Button */}
          <button
            onClick={handleAccept}
            type="button"
            disabled={isAccepting}
            className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
          >
            <div className={cn(
              "w-16 h-16 rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition-all group-hover:scale-110 active:scale-95",
              !isAccepting && "animate-bounce"
            )}>
              {isAccepting ? (
                <Loader2 className="w-7 h-7 animate-spin" />
              ) : isVideo ? (
                <Video className="w-7 h-7" />
              ) : (
                <Phone className="w-7 h-7" />
              )}
            </div>
            <span className="text-xs font-semibold text-neutral-400 group-hover:text-emerald-400 transition-colors">
              {isAccepting ? 'Connecting...' : 'Accept'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
