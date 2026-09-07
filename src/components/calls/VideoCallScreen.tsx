import React, { useState } from 'react';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  SwitchCamera,
  ShieldCheck,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { ActiveCallState, ConnectionState } from '@/src/types';
import { cn, formatDuration, getAvatarColor, getInitials } from '@/src/lib/utils';

interface VideoCallScreenProps {
  activeCallState?: ActiveCallState;
  callState?: ActiveCallState;
  connectionState: ConnectionState;
  localVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteVideoRef: React.RefObject<HTMLVideoElement | null>;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleMicrophone?: () => void;
  onToggleMic?: () => void;
  onToggleCamera: () => void;
  onSwitchCamera: () => void;
  onEndCall: () => void;
}

export const VideoCallScreen: React.FC<VideoCallScreenProps> = ({
  activeCallState,
  callState,
  connectionState,
  localVideoRef,
  remoteVideoRef,
  remoteAudioRef,
  onToggleMicrophone,
  onToggleMic,
  onToggleCamera,
  onSwitchCamera,
  onEndCall,
}) => {
  const currentCallState = activeCallState || callState;
  const toggleMic = onToggleMicrophone || onToggleMic || (() => {});

  if (!currentCallState) return null;

  const {
    peer,
    status,
    localAudioEnabled,
    localVideoEnabled,
    durationSeconds,
    isCaller,
  } = currentCallState;

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  // Ensure video and audio elements start playing as soon as streams are ready
  React.useEffect(() => {
    if (localVideoRef?.current && localVideoRef.current.srcObject) {
      localVideoRef.current.play().catch(() => {});
    }
    if (remoteVideoRef?.current && remoteVideoRef.current.srcObject) {
      remoteVideoRef.current.play().catch(() => {});
    }
    const audioEl = remoteAudioRef?.current;
    if (audioEl) {
      if (!audioEl.srcObject && (window as any).__liveconnect_active_remote_stream) {
        audioEl.srcObject = (window as any).__liveconnect_active_remote_stream;
      }
      if (audioEl.srcObject) {
        audioEl.volume = 1.0;
        audioEl.play().catch(() => {});
      }
    }
  }, [localVideoRef, remoteVideoRef, remoteAudioRef, localVideoEnabled, status]);

  const handleContainerClick = () => {
    const audioEl = remoteAudioRef?.current;
    if (audioEl && audioEl.paused && audioEl.srcObject) {
      audioEl.play().catch(() => {});
    }
  };

  const showFeedback = (text: string) => {
    setActionFeedback(text);
    setTimeout(() => {
      setActionFeedback((curr) => (curr === text ? null : curr));
    }, 1800);
  };

  const isConnected = status === 'connected' || connectionState === ConnectionState.Connected;
  const displayName = peer?.display_name || peer?.username || 'User';
  const avatarUrl = peer?.avatar_url;

  return (
    <div
      onClick={handleContainerClick}
      className="fixed inset-0 z-50 bg-black flex flex-col justify-between text-white overflow-hidden select-none animate-in fade-in"
    >
      {/* Dedicated clean audio element to playback peer audio without distortion or echo */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Main Remote Video Viewport */}
      <div className="relative flex-1 w-full h-full bg-neutral-950 flex items-center justify-center overflow-hidden">
        {/* Remote Video Element (muted so remote audio is not played twice) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Fallback avatar overlay when remote video is not yet attached or during ringing */}
        {!isConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900/90 backdrop-blur-md z-10">
            <div className="relative mb-6">
              <div className="absolute -inset-4 rounded-full bg-blue-500/20 animate-ping" />
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-28 h-28 rounded-full object-cover border-4 border-neutral-800 shadow-2xl relative z-10"
                />
              ) : (
                <div
                  className={cn(
                    'w-28 h-28 rounded-full flex items-center justify-center font-bold text-3xl shadow-2xl border-4 border-neutral-800 relative z-10',
                    getAvatarColor(peer.id)
                  )}
                >
                  {getInitials(displayName)}
                </div>
              )}
            </div>

            <h3 className="text-2xl font-bold mb-1">{displayName}</h3>
            <p className="text-sm text-neutral-400 font-mono">
              {isCaller ? 'Calling...' : 'Connecting HD Video Call...'}
            </p>
          </div>
        )}

        {/* Floating Local Picture-in-Picture Video */}
        <div className="absolute top-4 right-4 z-20 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl bg-neutral-900 group">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={cn(
              'w-full h-full object-cover -scale-x-100',
              !localVideoEnabled && 'hidden'
            )}
          />

          {!localVideoEnabled && (
            <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-800 text-neutral-400 p-2 text-center">
              <VideoOff className="w-6 h-6 mb-1 opacity-50 text-red-400" />
              <span className="text-[10px] font-semibold text-neutral-300">Camera Off</span>
            </div>
          )}

          <div className="absolute bottom-1.5 left-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[10px] font-medium text-white flex items-center gap-1">
            <span>You</span>
            {!localAudioEnabled && <MicOff className="w-2.5 h-2.5 text-red-400" />}
          </div>
        </div>

        {/* Floating Feedback Toast */}
        {actionFeedback && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full bg-black/70 backdrop-blur-md border border-white/20 text-xs font-semibold text-white shadow-xl animate-in fade-in slide-in-from-top-2 duration-150">
            {actionFeedback}
          </div>
        )}

        {/* Top Info Bar */}
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-xs font-semibold">
              <span
                className={cn(
                  'w-2 h-2 rounded-full',
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
                )}
              />
              <span>{displayName}</span>
              <span className="text-neutral-400">•</span>
              <span className="font-mono">{formatDuration(durationSeconds)}</span>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full bg-blue-600/30 border border-blue-500/30 backdrop-blur-md text-blue-200 font-semibold shadow-sm">
              <Sparkles className="w-3 h-3 text-blue-300" />
              <span>Full HD 1080p</span>
            </div>

            <div className="hidden sm:flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-neutral-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Encrypted</span>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Bottom Control Bar */}
      <div className="p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-center justify-center gap-4 z-30">
        {/* Toggle Microphone */}
        <button
          onClick={() => {
            toggleMic();
            showFeedback(localAudioEnabled ? 'Microphone Muted' : 'Microphone Unmuted');
          }}
          title={localAudioEnabled ? 'Mute Mic' : 'Unmute Mic'}
          className={cn(
            'w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg',
            localAudioEnabled
              ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/10'
              : 'bg-red-600 text-white shadow-red-600/30'
          )}
        >
          {localAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
        </button>

        {/* Toggle Camera */}
        <button
          onClick={() => {
            onToggleCamera();
            showFeedback(localVideoEnabled ? 'Camera Off' : 'Camera On');
          }}
          title={localVideoEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          className={cn(
            'w-13 h-13 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg',
            localVideoEnabled
              ? 'bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/10'
              : 'bg-red-600 text-white shadow-red-600/30'
          )}
        >
          {localVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
        </button>

        {/* Switch Camera */}
        <button
          onClick={() => {
            onSwitchCamera();
            showFeedback('Camera Flipped');
          }}
          title="Switch Camera"
          className="w-13 h-13 rounded-full bg-white/20 hover:bg-white/30 text-white backdrop-blur-md border border-white/10 flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg"
        >
          <SwitchCamera className="w-5 h-5" />
        </button>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          title="End Call"
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/40 transition-all hover:scale-110 active:scale-95 ml-2"
        >
          <PhoneOff className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
};

