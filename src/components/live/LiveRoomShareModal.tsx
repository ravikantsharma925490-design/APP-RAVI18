import React, { useState } from 'react';
import { X, Copy, Check, Share2, MessageSquare, Sparkles } from 'lucide-react';
import { LiveRoom } from '@/src/types/live';

interface LiveRoomShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  room: LiveRoom;
}

export const LiveRoomShareModal: React.FC<LiveRoomShareModalProps> = ({ isOpen, onClose, room }) => {
  if (!isOpen) return null;

  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const roomLink = typeof window !== 'undefined'
    ? `${window.location.origin}/?room=${room.roomId}`
    : `https://socialapp.live/?room=${room.roomId}`;

  const shareText = `🔴 Join my Live Voice Room!\n"${room.name}" (Room ID: ${room.roomId})\n${roomLink}`;

  const handleCopyId = () => {
    navigator.clipboard.writeText(room.roomId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `🔴 Live Voice Room: ${room.name}`,
          text: `Join "${room.name}" with 8 voice seats!`,
          url: roomLink,
        });
      } catch (e) {}
    } else {
      handleCopyLink();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-sm bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-blue-500/15 text-blue-400">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share Live Room</h3>
              <p className="text-xs text-neutral-400">Invite friends to listen and speak</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Unique Room ID Box */}
          <div className="p-4 rounded-2xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-neutral-400 block">
                Unique Room ID
              </span>
              <span className="text-xl font-mono font-extrabold text-white tracking-widest mt-0.5 block">
                {room.roomId}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopyId}
              className="px-3.5 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-bold flex items-center space-x-1.5 transition-colors"
            >
              {copiedId ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              <span>{copiedId ? 'Copied!' : 'Copy ID'}</span>
            </button>
          </div>

          {/* Share Link Box */}
          <div>
            <label className="text-xs font-bold text-neutral-400 block mb-1.5">Direct Invite Link</label>
            <div className="p-2.5 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400 truncate max-w-[200px]">
                {roomLink}
              </span>
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-2.5 py-1 rounded-lg bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-bold flex items-center space-x-1"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedLink ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* System Share Button */}
          <button
            type="button"
            onClick={handleNativeShare}
            className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center space-x-2 shadow-lg transition-all cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Open System Share Sheet</span>
          </button>
        </div>
      </div>
    </div>
  );
};
