import React, { useRef } from 'react';
import {
  X,
  Music,
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  FolderOpen,
  Radio,
  Lock,
} from 'lucide-react';
import { LiveRoom } from '@/src/types/live';
import { Profile } from '@/src/types';

interface LiveLocalMusicPlayerProps {
  isOpen: boolean;
  onClose: () => void;
  room: LiveRoom;
  currentUser: Profile;
  canPlayMusic: boolean;
  localMusicPlaylist: File[];
  currentTrackIndex: number;
  musicVolume: number;
  onSelectFiles: (files: FileList | null) => void;
  onTogglePlayPause: () => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onVolumeChange: (volume: number) => void;
}

export const LiveLocalMusicPlayer: React.FC<LiveLocalMusicPlayerProps> = ({
  isOpen,
  onClose,
  room,
  currentUser,
  canPlayMusic,
  localMusicPlaylist,
  currentTrackIndex,
  musicVolume,
  onSelectFiles,
  onTogglePlayPause,
  onNextTrack,
  onPrevTrack,
  onVolumeChange,
}) => {
  if (!isOpen) return null;

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const currentFile = localMusicPlaylist[currentTrackIndex];
  const isPlaying = room.currentMusic?.isPlaying ?? false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
              <Music className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Local Device Music</h3>
              <p className="text-xs text-neutral-400">Stream audio files directly from your device</p>
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

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Permission Check */}
          {!canPlayMusic ? (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start space-x-3">
              <Lock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-300">Host / Admin Only</p>
                <p className="text-xs text-neutral-300 mt-0.5">
                  Only the Room Owner or an Admin with "Play Music" permissions can select and broadcast
                  audio to this room.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* File selection trigger */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                multiple
                className="hidden"
                onChange={(e) => onSelectFiles(e.target.files)}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-3 px-4 rounded-2xl border-2 border-dashed border-neutral-700 hover:border-purple-500 bg-neutral-950/60 hover:bg-purple-500/10 text-neutral-300 hover:text-purple-300 font-bold text-xs flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <FolderOpen className="w-4 h-4 text-purple-400" />
                <span>Select Audio File(s) from Local Device</span>
              </button>
            </>
          )}

          {/* Currently playing track card */}
          <div className="p-4 rounded-2xl bg-neutral-950/80 border border-neutral-800 flex flex-col items-center text-center">
            <div className="relative mb-2">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-2xl shadow-lg">
                🎵
              </div>
              {isPlaying && (
                <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 rounded-full bg-emerald-500 text-[9px] font-bold text-white flex items-center space-x-0.5 shadow">
                  <Radio className="w-2.5 h-2.5 animate-pulse" />
                  <span>SYNC</span>
                </div>
              )}
            </div>

            <p className="text-sm font-bold text-white truncate max-w-full">
              {currentFile ? currentFile.name : room.currentMusic?.songTitle || 'No audio file loaded'}
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              {room.currentMusic?.playedBy
                ? `Broadcast by ${room.currentMusic.playedBy.name}`
                : 'Choose a file to start sharing'}
            </p>

            {/* Controls */}
            {canPlayMusic && (
              <div className="flex items-center space-x-4 mt-4">
                <button
                  type="button"
                  onClick={onPrevTrack}
                  disabled={localMusicPlaylist.length <= 1}
                  className="p-2 rounded-full bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={onTogglePlayPause}
                  disabled={!currentFile && !room.currentMusic}
                  className="p-3.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg hover:brightness-110 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={onNextTrack}
                  disabled={localMusicPlaylist.length <= 1}
                  className="p-2 rounded-full bg-neutral-800 text-neutral-300 hover:text-white disabled:opacity-40 transition-colors"
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Volume slider */}
            <div className="w-full flex items-center space-x-2 mt-4 px-4">
              <Volume2 className="w-4 h-4 text-neutral-400" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={musicVolume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                className="w-full accent-purple-500 h-1.5 bg-neutral-800 rounded-lg cursor-pointer"
              />
              <span className="text-[10px] text-neutral-400 w-7 text-right">
                {Math.round(musicVolume * 100)}%
              </span>
            </div>
          </div>

          {/* Local Playlist list if files selected */}
          {localMusicPlaylist.length > 1 && (
            <div>
              <span className="text-xs font-bold text-neutral-400 block mb-2">
                Selected Tracks ({localMusicPlaylist.length}):
              </span>
              <div className="max-h-36 overflow-y-auto space-y-1.5">
                {localMusicPlaylist.map((f, i) => (
                  <div
                    key={i}
                    className={`p-2 rounded-xl text-xs flex items-center justify-between border ${
                      i === currentTrackIndex
                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 font-bold'
                        : 'bg-neutral-950/40 border-neutral-800 text-neutral-300'
                    }`}
                  >
                    <span className="truncate max-w-[80%]">{f.name}</span>
                    <span className="text-[10px] text-neutral-500">
                      {(f.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
