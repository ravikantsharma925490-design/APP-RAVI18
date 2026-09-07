import React from 'react';
import { Maximize2, X, Mic, MicOff, Radio, Volume2 } from 'lucide-react';
import { LiveRoom } from '@/src/types/live';
import { cn } from '@/src/lib/utils';

interface LiveMiniRoomProps {
  room: LiveRoom;
  isSeated: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  onMaximize: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
}

export const LiveMiniRoom: React.FC<LiveMiniRoomProps> = ({
  room,
  isSeated,
  isMuted,
  isSpeaking,
  onMaximize,
  onLeave,
  onToggleMic,
}) => {
  return (
    <div className="fixed bottom-20 right-4 z-40 sm:bottom-6 sm:right-6 animate-slide-up select-none">
      <div className="flex items-center space-x-3 p-2.5 pr-3 rounded-2xl bg-neutral-900/95 border border-neutral-700/80 shadow-2xl backdrop-blur-xl text-white max-w-sm ring-1 ring-white/10">
        {/* Pulsing Avatar / Thumbnail */}
        <button
          type="button"
          onClick={onMaximize}
          className="relative w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 border border-neutral-700 group cursor-pointer"
        >
          {room.photoUrl ? (
            <img src={room.photoUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
          ) : (
            <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm">
              🎙️
            </div>
          )}

          {/* Equalizer animation */}
          <div className="absolute inset-0 bg-black/40 flex items-end justify-center pb-1 space-x-0.5">
            <span className="w-1 h-3 bg-emerald-400 rounded-full animate-pulse" />
            <span className="w-1 h-4 bg-emerald-400 rounded-full animate-bounce" />
            <span className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" />
          </div>
        </button>

        {/* Room Info */}
        <div
          onClick={onMaximize}
          className="flex flex-col cursor-pointer min-w-0 flex-1 pr-1"
        >
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-extrabold text-white truncate max-w-[130px]">
              {room.name}
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] text-neutral-400 mt-0.5">
            <span>ID: {room.roomId}</span>
            <span>·</span>
            <span>👥 {room.onlineCount} online</span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1">
          {/* Seated Mic control */}
          {isSeated && (
            <button
              type="button"
              onClick={onToggleMic}
              className={cn(
                'p-2 rounded-xl transition-colors',
                isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-neutral-800 text-emerald-400 hover:bg-neutral-700'
              )}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Maximize */}
          <button
            type="button"
            onClick={onMaximize}
            className="p-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors cursor-pointer"
            title="Return to Full Room"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Leave */}
          <button
            type="button"
            onClick={onLeave}
            className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-800/40 transition-colors cursor-pointer"
            title="Leave Room"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
