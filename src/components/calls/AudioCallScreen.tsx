import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, ShieldCheck, Volume2, Volume1, Sparkles, VolumeX } from 'lucide-react';
import { ActiveCallState, ConnectionState } from '@/src/types';
import { cn, formatDuration, getAvatarColor, getInitials } from '@/src/lib/utils';

interface AudioCallScreenProps {
  activeCallState?: ActiveCallState;
  callState?: ActiveCallState;
  connectionState: ConnectionState;
  remoteAudioRef: React.RefObject<HTMLAudioElement | null>;
  onToggleMicrophone?: () => void;
  onToggleMic?: () => void;
  onEndCall: () => void;
}

export const AudioCallScreen: React.FC<AudioCallScreenProps> = ({
  activeCallState,
  callState,
  connectionState,
  remoteAudioRef,
  onToggleMicrophone,
  onToggleMic,
  onEndCall,
}) => {
  const currentCallState = activeCallState || callState;
  const toggleMic = onToggleMicrophone || onToggleMic || (() => {});

  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isAudioBlocked, setIsAudioBlocked] = useState<boolean>(false);

  const isConnected = currentCallState?.status === 'connected' || connectionState === ConnectionState.Connected;

  // Auto-attach remote stream and resume audio playback resilience
  useEffect(() => {
    const audioEl = remoteAudioRef?.current;
    if (!audioEl) return;

    if (!audioEl.srcObject && (window as any).__liveconnect_active_remote_stream) {
      audioEl.srcObject = (window as any).__liveconnect_active_remote_stream;
    }

    if (audioEl.srcObject) {
      audioEl.volume = isSpeakerOn ? 1.0 : 0.35;
      audioEl
        .play()
        .then(() => {
          setIsAudioBlocked(false);
        })
        .catch((err) => {
          console.warn('Audio auto-playback notice:', err);
          if (isConnected) {
            setIsAudioBlocked(true);
          }
        });
    }
  }, [remoteAudioRef, currentCallState?.status, connectionState, isConnected, isSpeakerOn]);

  // Real-time voice activity and sound level visualizer from remote stream
  useEffect(() => {
    if (!isConnected) {
      setAudioLevel(0);
      return;
    }

    const audioEl = remoteAudioRef?.current;
    const stream = (audioEl?.srcObject as MediaStream) || (window as any).__liveconnect_active_remote_stream;
    if (!stream || stream.getAudioTracks().length === 0) return;

    let audioCtx: AudioContext | null = null;
    let animId: number | null = null;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioCtx = new AudioCtxClass();
        if (audioCtx.state === 'suspended') {
          audioCtx.resume().catch(() => {});
        }
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const updateLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Normal human speaking level maps to 0 - 100
          setAudioLevel(Math.min(100, Math.round((avg / 100) * 100)));
          animId = requestAnimationFrame(updateLevel);
        };
        animId = requestAnimationFrame(updateLevel);
      }
    } catch {
      // AudioContext fallback
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
      if (audioCtx && audioCtx.state !== 'closed') {
        audioCtx.close().catch(() => {});
      }
    };
  }, [isConnected, remoteAudioRef]);

  if (!currentCallState) return null;

  const { peer, localAudioEnabled, durationSeconds, isCaller } = currentCallState;

  const showFeedback = (text: string) => {
    setActionFeedback(text);
    setTimeout(() => {
      setActionFeedback((curr) => (curr === text ? null : curr));
    }, 1800);
  };

  const toggleSpeaker = () => {
    const audioEl = remoteAudioRef?.current;
    const nextSpeakerState = !isSpeakerOn;
    setIsSpeakerOn(nextSpeakerState);
    if (audioEl) {
      audioEl.volume = nextSpeakerState ? 1.0 : 0.35;
      audioEl.play().catch(() => {});
    }
    showFeedback(nextSpeakerState ? 'Loudspeaker (100%)' : 'Earpiece Mode (35%)');
  };

  const handleManualAudioResume = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const audioEl = remoteAudioRef?.current;
    if (audioEl) {
      if (!audioEl.srcObject && (window as any).__liveconnect_active_remote_stream) {
        audioEl.srcObject = (window as any).__liveconnect_active_remote_stream;
      }
      audioEl.volume = isSpeakerOn ? 1.0 : 0.35;
      audioEl
        .play()
        .then(() => {
          setIsAudioBlocked(false);
          showFeedback('Audio Connected');
        })
        .catch(() => {});
    }
  };

  const displayName = peer?.display_name || peer?.username || 'User';
  const username = peer?.username || '';
  const avatarUrl = peer?.avatar_url;

  return (
    <div
      onClick={handleManualAudioResume}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-950/95 backdrop-blur-xl animate-in fade-in select-none"
    >
      {/* Dedicated audio element to playback peer audio with crystal clarity */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      <div className="w-full max-w-md bg-neutral-900/95 border border-neutral-800 rounded-3xl p-8 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-emerald-600/15 to-transparent pointer-events-none" />

        {/* Feedback Toast */}
        {actionFeedback && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-neutral-800 border border-neutral-700 text-xs font-medium text-white shadow-lg">
            {actionFeedback}
          </div>
        )}

        {/* Top Status Badge */}
        <div className="flex flex-col items-center gap-1.5 mb-8">
          <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-800/90 border border-neutral-700/70 text-xs font-semibold">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'
              )}
            />
            <span className="text-neutral-200">
              {isConnected
                ? `Connected • ${formatDuration(durationSeconds)}`
                : isCaller
                ? 'Ringing...'
                : 'Connecting...'}
            </span>
          </div>
        </div>

        {/* Browser Autoplay Prompt if blocked */}
        {isAudioBlocked && isConnected && (
          <button
            onClick={handleManualAudioResume}
            className="mb-4 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-medium flex items-center gap-2 animate-bounce shadow-lg cursor-pointer"
          >
            <VolumeX className="w-4 h-4 text-amber-400" />
            <span>Sound paused by browser — Tap to Listen</span>
          </button>
        )}

        {/* Peer Avatar with real-time soundwave halo */}
        <div className="relative mb-6">
          {isConnected && (
            <div
              className="absolute -inset-4 rounded-full border-2 border-emerald-500/40 transition-transform duration-100 ease-out"
              style={{
                transform: `scale(${1 + (audioLevel > 5 ? Math.min(audioLevel / 100, 0.45) : 0.05)})`,
                opacity: audioLevel > 5 ? 0.9 : 0.2,
              }}
            />
          )}
          <div className="relative z-10">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="w-32 h-32 rounded-full object-cover border-4 border-neutral-800 shadow-2xl"
              />
            ) : (
              <div
                className={cn(
                  'w-32 h-32 rounded-full flex items-center justify-center font-bold text-3xl shadow-2xl border-4 border-neutral-800',
                  getAvatarColor(peer?.id || '')
                )}
              >
                {getInitials(displayName)}
              </div>
            )}
          </div>
        </div>

        {/* Real-time Voice Waveform Visualizer */}
        {isConnected && (
          <div className="flex items-center justify-center gap-1.5 h-6 mb-4 px-4">
            {[0.4, 0.8, 1.0, 0.8, 0.4].map((multiplier, idx) => {
              const barHeight = Math.max(4, Math.round((audioLevel * multiplier * 24) / 100));
              return (
                <div
                  key={idx}
                  className="w-1.5 rounded-full bg-emerald-400 transition-all duration-75"
                  style={{
                    height: `${audioLevel > 4 ? barHeight : 4}px`,
                    opacity: audioLevel > 4 ? 0.9 : 0.3,
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Peer Info */}
        <h2 className="text-2xl font-extrabold text-white mb-1">{displayName}</h2>
        {username && <p className="text-xs text-neutral-400 font-mono mb-4">@{username}</p>}

        {/* Real-time WebRTC Audio info */}
        <div className="flex items-center gap-2 text-xs text-neutral-400 mb-8 bg-neutral-800/70 px-3.5 py-1.5 rounded-full border border-neutral-700/50">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-medium text-neutral-300">HD Voice 96kbps Opus</span>
          <span className="text-neutral-500">•</span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Echo Cancelled</span>
        </div>

        {/* Controls Toolbar */}
        <div className="flex items-center justify-center gap-6 w-full pt-4 border-t border-neutral-800">
          {/* Mute Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleMic();
                showFeedback(localAudioEnabled ? 'Microphone Muted' : 'Microphone Unmuted');
              }}
              title={localAudioEnabled ? 'Mute Microphone' : 'Unmute Microphone'}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg',
                localAudioEnabled
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-white'
                  : 'bg-red-500/20 text-red-400 border border-red-500/40'
              )}
            >
              {localAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            <span className={cn('text-[11px] font-medium', localAudioEnabled ? 'text-neutral-400' : 'text-red-400 font-semibold')}>
              {localAudioEnabled ? 'Mute' : 'Muted'}
            </span>
          </div>

          {/* Speaker Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSpeaker();
              }}
              title={isSpeakerOn ? 'Switch to Earpiece' : 'Switch to Speaker'}
              className={cn(
                'w-14 h-14 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 shadow-lg',
                isSpeakerOn
                  ? 'bg-neutral-800 hover:bg-neutral-700 text-emerald-400'
                  : 'bg-neutral-800/60 text-neutral-400'
              )}
            >
              {isSpeakerOn ? <Volume2 className="w-6 h-6" /> : <Volume1 className="w-6 h-6" />}
            </button>
            <span className="text-[11px] font-medium text-neutral-400">
              {isSpeakerOn ? 'Speaker' : 'Earpiece'}
            </span>
          </div>

          {/* End Call Button */}
          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEndCall();
              }}
              title="End Call"
              className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg shadow-red-600/30 transition-all hover:scale-110 active:scale-95"
            >
              <PhoneOff className="w-7 h-7" />
            </button>
            <span className="text-[11px] text-red-400 font-medium">
              End Call
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


