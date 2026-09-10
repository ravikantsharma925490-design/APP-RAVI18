import { useState, useEffect, useRef, useCallback } from 'react';
import { getSupabase } from '@/src/lib/supabase/client';
import { WebRTCP2PSession } from '@/src/lib/webrtc/p2p-session';
import { audioTones } from '@/src/lib/audio-tones';
import { notificationService } from '@/src/lib/notification-service';
import { Call, CallType, Profile, ActiveCallState, ConnectionState } from '@/src/types';
import { recordCallInHistory, updateCallInHistory } from './useCallHistory';
import { insertCallLogIntoChat, formatCallDurationText } from '@/src/lib/callChatLog';
import { admobService } from '@/src/lib/admob/admob-service';
import { getClientDeviceId } from '@/src/lib/utils';

function createFallbackProfile(id: string, name = 'Caller'): Profile {
  return {
    id,
    username: name.toLowerCase().replace(/\s+/g, '_'),
    display_name: name,
    avatar_url: null,
    bio: null,
    is_online: true,
    last_seen: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function generateCallUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Studio Voice Audio Constraints for Live Calls (Mobile-safe & desktop-optimized)
export const HD_CALL_AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true, // Enabled to remove background noise
  autoGainControl: true, // Enabled to automatically adjust microphone volume
  sampleRate: { ideal: 48000 },
  channelCount: { ideal: 1 },
};

// High Definition (1080p / 720p 30fps) Video Constraints (Mobile-safe ideal parameters)
export const HD_CALL_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  facingMode: 'user',
  width: { ideal: 1280 },
  height: { ideal: 720 },
};

export function useCall(
  currentUser?: Profile | null
) {
  const [incomingCall, setIncomingCall] = useState<Call | null>(null);
  const [activeCallState, setActiveCallState] = useState<ActiveCallState | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [callError, setCallError] = useState<string | null>(null);

  // Keep references to prevent unstable function recreations
  const currentUserRef = useRef<Profile | null | undefined>(currentUser);
  currentUserRef.current = currentUser;

  const activeCallStateRef = useRef<ActiveCallState | null>(null);
  activeCallStateRef.current = activeCallState;

  const incomingCallRef = useRef<Call | null>(null);
  incomingCallRef.current = incomingCall;

  const incomingCallReceivedAtRef = useRef<number>(0);
  const isAnsweringRef = useRef<boolean>(false);
  const answeredCallIdsRef = useRef<Set<string>>(new Set<string>());
  const connectingCallIdRef = useRef<string | null>(null);

  const sessionRef = useRef<any>(null);
  const p2pSessionRef = useRef<WebRTCP2PSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<any>(null);
  const callTimeoutRef = useRef<any>(null);
  const callBusRef = useRef<BroadcastChannel | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  // Initialize AdMob on mount for Android Capacitor platform
  useEffect(() => {
    admobService.initialize().catch(() => {});
  }, []);

  // Clean up timers
  const clearCallTimers = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  // Stop all media tracks and teardown session
  const cleanupMediaSession = useCallback(async () => {
    clearCallTimers();
    audioTones.stop();
    isAnsweringRef.current = false;
    connectingCallIdRef.current = null;

    // Close WebRTC P2P session
    if (p2pSessionRef.current) {
      try {
        p2pSessionRef.current.close();
      } catch (e) {}
      p2pSessionRef.current = null;
    }

    // Stop local media stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          // ignore
        }
      });
      localStreamRef.current = null;
    }

    // Reset video refs
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = null;
    }
    if (typeof window !== 'undefined') {
      (window as any).__liveconnect_active_remote_stream = null;
    }
    remoteStreamRef.current = null;

    setConnectionState(ConnectionState.Disconnected);
  }, [clearCallTimers]);

  // Request local camera and microphone stream with studio HD voice processing and High-Definition video
  const acquireLocalMedia = async (isVideo: boolean) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
        let stream: MediaStream;
        try {
          // Priority 1: Full HD 1080p / 720p 60fps/30fps Video with studio audio
          stream = await navigator.mediaDevices.getUserMedia({
            audio: HD_CALL_AUDIO_CONSTRAINTS,
            video: isVideo ? HD_CALL_VIDEO_CONSTRAINTS : false,
          });
        } catch (mediaErr) {
          try {
            // Priority 2: 720p HD Video fallback with standard noise cancellation and echo cancellation
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
              video: isVideo ? { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } : false,
            });
          } catch {
            // Priority 3: Basic standard video fallback
            stream = await navigator.mediaDevices.getUserMedia({
              audio: true,
              video: isVideo,
            });
          }
        }

        if (!stream) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const dst = ctx.createMediaStreamDestination();
            osc.connect(dst);
            osc.start();
            stream = dst.stream;
          } catch {
            stream = new MediaStream();
          }
        }

        localStreamRef.current = stream;

        // Attach local preview to video element
        if (isVideo && localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.play().catch(() => {});
        }
        return stream;
      }
    } catch (err: any) {
      console.warn('Could not acquire local camera/mic stream:', err);
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setCallError('Microphone permission is required. Please allow microphone access in your browser to make or receive calls.');
      }
      // Fallback silent stream to prevent WebRTC handshake failure
      try {
        const stream = new MediaStream();
        localStreamRef.current = stream;
        return stream;
      } catch {}
    }
    return null;
  };

  // Connect to Direct WebRTC 1-to-1 P2P Media Session
  const connectToCallRoom = useCallback(
    async (call: Call, isVideo: boolean) => {
      try {
        const user = currentUserRef.current;
        if (!user) return;
        setCallError(null);

        // Ensure local media is initialized
        if (!localStreamRef.current) {
          await acquireLocalMedia(isVideo);
        }
        if (!localStreamRef.current) {
          localStreamRef.current = new MediaStream();
        }

        // Start call duration counter if not already running
        if (!durationIntervalRef.current) {
          const startTime = Date.now();
          durationIntervalRef.current = setInterval(() => {
            setActiveCallState((prev) => {
              if (!prev) return null;
              const newDuration = Math.floor((Date.now() - startTime) / 1000);

              return {
                ...prev,
                durationSeconds: newDuration,
              };
            });
          }, 1000);
        }

        // Establish Direct WebRTC P2P Call (1-to-1 HD encrypted audio/video)
        if (localStreamRef.current) {
          if (p2pSessionRef.current) {
            setConnectionState(ConnectionState.Connected);
            audioTones.playConnectedSound();
            return;
          }
          const peerId = call.caller_id === user.id ? call.callee_id : call.caller_id;
          const isCaller = call.caller_id === user.id;
          const targetDeviceId = isCaller ? call.calleeDeviceId : call.callerDeviceId;
          const currentDeviceId = getClientDeviceId();

          const p2p = new WebRTCP2PSession(
            call.id,
            user.id,
            peerId,
            isCaller,
            {
              onConnected: () => {
                setConnectionState(ConnectionState.Connected);
                audioTones.playConnectedSound();
              },
              onDisconnected: () => {
                setConnectionState(ConnectionState.Disconnected);
              },
              onRemoteTrack: (track, stream) => {
                remoteStreamRef.current = stream;
                if (typeof window !== 'undefined') {
                  (window as any).__liveconnect_active_remote_stream = stream;
                }
                if (track.kind === 'video' && remoteVideoRef.current) {
                  if (remoteVideoRef.current.srcObject !== stream) {
                    remoteVideoRef.current.srcObject = stream;
                  }
                  remoteVideoRef.current.play().catch(() => {});
                }
                if (track.kind === 'audio' && remoteAudioRef.current) {
                  if (remoteAudioRef.current.srcObject !== stream) {
                    remoteAudioRef.current.srcObject = stream;
                  }
                  remoteAudioRef.current.volume = 1.0;
                  remoteAudioRef.current.play().catch(() => {});
                }
              },
              onError: (err) => {
                console.warn('WebRTC P2P notice:', err.message);
              },
              onNetworkQualityChange: (quality) => {
                setActiveCallState((prev) => prev ? { ...prev, networkQuality: quality } : null);
              },
            },
            currentDeviceId,
            targetDeviceId
          );

          p2pSessionRef.current = p2p;
          await p2p.start(localStreamRef.current, isVideo);
          setConnectionState(ConnectionState.Connected);
          audioTones.playConnectedSound();
        }
      } catch (err: any) {
        console.error('Call connection setup error:', err);
        setCallError(err.message || 'Could not connect to call');
      }
    },
    [cleanupMediaSession]
  );

  // Subscribe to realtime calls, broadcast bus, & poll server signaling relay
  useEffect(() => {
    if (!currentUser?.id) return;

    // Handle cross-tab call signals (from BroadcastChannel or localStorage)
    const handleSignal = async (data: any) => {
      if (!data || !data.type) return;

      if (data.type === 'CALL_RINGING') {
        const incoming = data.call as Call;
        if (incoming && incoming.callee_id === currentUser.id && !activeCallStateRef.current) {
          const callerProfile = data.callerMeta || incoming.caller;
          const fullCall: Call = {
            ...incoming,
            caller: callerProfile,
          };
          incomingCallReceivedAtRef.current = Date.now();
          setIncomingCall(fullCall);

          // Record incoming call in call history
          const fallbackPeer = createFallbackProfile(incoming.caller_id, 'Caller');
          recordCallInHistory(currentUser.id, {
            ...fullCall,
            peer: callerProfile || fallbackPeer,
            direction: 'incoming',
            isMissed: false,
            durationFormatted: 'Ringing...',
          });

          const isCallSoundEnabled = localStorage.getItem('liveconnect_perm_call_sound') !== 'false';
          if (isCallSoundEnabled) {
            audioTones.startIncomingRingtone();
          }
        }
      } else if (data.type === 'CALL_ACCEPTED') {
        const currentActive = activeCallStateRef.current;
        if (currentActive && currentActive.call.id === data.callId) {
          audioTones.stop();
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }
          setActiveCallState((prev) => (prev ? { ...prev, status: 'connected' } : null));
          updateCallInHistory(currentUser.id, data.callId, {
            status: 'accepted',
            answered_at: new Date().toISOString(),
            durationFormatted: 'Connected',
          });
          if (currentActive.isCaller) {
            await connectToCallRoom(currentActive.call, currentActive.call.call_type === 'video');
          }
        }
      } else if (['CALL_REJECTED', 'CALL_CANCELLED', 'CALL_ENDED'].includes(data.type)) {
        if (incomingCallRef.current && incomingCallRef.current.id === data.callId) {
          audioTones.stop();
          setIncomingCall(null);
          updateCallInHistory(currentUser.id, data.callId, {
            status: data.type === 'CALL_REJECTED' ? 'rejected' : 'cancelled',
            ended_at: new Date().toISOString(),
            durationFormatted: data.type === 'CALL_REJECTED' ? 'Declined' : 'Cancelled',
          });
        }
        if (activeCallStateRef.current && activeCallStateRef.current.call.id === data.callId) {
          const wasConnected = activeCallStateRef.current.status === 'connected' || (activeCallStateRef.current.durationSeconds || 0) > 0;
          const callId = data.callId;
          audioTones.playCallEndedSound();
          const durationSecs = typeof data.duration === 'number' ? data.duration : (activeCallStateRef.current.durationSeconds || 0);
          const durationFormatted = formatCallDurationText(durationSecs);
          await cleanupMediaSession();
          setActiveCallState(null);
          updateCallInHistory(currentUser.id, data.callId, {
            status: 'ended',
            ended_at: new Date().toISOString(),
            durationFormatted: durationFormatted || 'Call ended',
          });

          // Trigger AdMob Interstitial Ad (Android only, completed calls only, at most once per call session)
          if (wasConnected) {
            admobService.showPostCallInterstitial(callId, true).catch(() => {});
          }
        }
      }
    };

    // 0a. Setup BroadcastChannel for 0ms cross-tab signaling in the same browser session
    if (typeof BroadcastChannel !== 'undefined') {
      const bus = new BroadcastChannel('liveconnect_calls_bus');
      callBusRef.current = bus;
      bus.onmessage = (event) => handleSignal(event.data);
    }

    // 0b. Storage event listener fallback for cross-tab sync
    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === 'liveconnect_cross_tab_call_signal' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          handleSignal(parsed);
        } catch {
          // ignore
        }
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageEvent);
    }

    const supabase = getSupabase();

    // 1. Supabase Realtime Channel
    const handleIncomingCallRealtime = async (newCall: Call) => {
      // Avoid ringing ourselves if cross-device self-call
      if (newCall.callerDeviceId && newCall.callerDeviceId === getClientDeviceId()) return;
      if (activeCallStateRef.current?.call.id === newCall.id) return;

      if (newCall.status === 'calling' || newCall.status === 'ringing') {
        // Fetch caller profile
        const { data: callerProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', newCall.caller_id)
          .single();

        const callWithCaller: Call = {
          ...newCall,
          caller: (callerProfile as Profile) || undefined,
        };

        incomingCallReceivedAtRef.current = Date.now();
        setIncomingCall(callWithCaller);

        // Record incoming call in call history
        const fallbackPeer = createFallbackProfile(newCall.caller_id, 'Caller');
        recordCallInHistory(currentUser.id, {
          ...callWithCaller,
          peer: (callerProfile as Profile) || fallbackPeer,
          direction: 'incoming',
          isMissed: false,
          durationFormatted: 'Ringing...',
        });

        // Play ringtone if user hasn't muted call ringtones
        const isCallSoundEnabled = localStorage.getItem('liveconnect_perm_call_sound') !== 'false';
        if (isCallSoundEnabled) {
          audioTones.startIncomingRingtone();
        }

        // Dispatch push notification
        const callerName = callerProfile?.display_name || 'Someone';
        notificationService.sendNotification({
          title: `Incoming ${newCall.call_type === 'video' ? 'Video' : 'Voice'} Call`,
          body: `${callerName} is calling you on LiveConnect...`,
          icon: callerProfile?.avatar_url || '/favicon.ico',
          tag: `call-${newCall.id}`,
        });

        // Update call status to ringing
        supabase
          .from('calls')
          .update({ status: 'ringing' })
          .eq('id', newCall.id)
          .then(() => {});

        fetch('/api/calls/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: newCall.id, action: 'ring', userId: currentUser.id }),
        }).catch(() => {});
      }
    };

    const handleCallActionRealtime = async (updatedCall: Partial<Call>) => {
      if (!updatedCall.id || !updatedCall.status) return;
      const currentIncoming = incomingCallRef.current;
      const currentActive = activeCallStateRef.current;

      // If incoming call was cancelled or missed
      if (currentIncoming && currentIncoming.id === updatedCall.id) {
        if (['cancelled', 'ended', 'missed', 'rejected'].includes(updatedCall.status)) {
          audioTones.stop();
          setIncomingCall(null);
          updateCallInHistory(currentUser.id, updatedCall.id, {
            status: updatedCall.status,
            ended_at: updatedCall.ended_at || new Date().toISOString(),
          });
        }
      }

      // If active call status changed
      if (currentActive && currentActive.call.id === updatedCall.id) {
        if (updatedCall.status === 'accepted' && currentActive.status !== 'connected') {
          audioTones.stop();
          // Clear auto-cancel timeout since call was accepted
          if (callTimeoutRef.current) {
            clearTimeout(callTimeoutRef.current);
            callTimeoutRef.current = null;
          }

          if (updatedCall.calleeDeviceId) {
            currentActive.call.calleeDeviceId = updatedCall.calleeDeviceId;
          }

          setActiveCallState((prev) => (prev ? { ...prev, status: 'connected' } : null));
          updateCallInHistory(currentUser.id, updatedCall.id, {
            status: 'accepted',
            answered_at: new Date().toISOString(),
            durationFormatted: 'Connected',
          });

          // Connect caller to room
          if (currentActive.isCaller) {
            await connectToCallRoom({ ...currentActive.call, ...updatedCall } as Call, currentActive.call.call_type === 'video');
          }
        } else if (['rejected', 'ended', 'cancelled', 'failed', 'missed'].includes(updatedCall.status)) {
          const wasConnected = currentActive.status === 'connected' || (currentActive.durationSeconds || 0) > 0;
          const callId = updatedCall.id;
          audioTones.playCallEndedSound();
          await cleanupMediaSession();
          setActiveCallState(null);
          updateCallInHistory(currentUser.id, updatedCall.id, {
            status: updatedCall.status,
            ended_at: updatedCall.ended_at || new Date().toISOString(),
          });

          // Trigger AdMob Interstitial Ad (Android only, completed calls only, at most once per call session)
          if (wasConnected && updatedCall.status === 'ended') {
            admobService.showPostCallInterstitial(callId, true).catch(() => {});
          }
        }
      }
    };

    const channel = supabase
      .channel(`calls_channel_${currentUser.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${currentUser.id}`,
        },
        async (payload) => {
          handleIncomingCallRealtime(payload.new as Call);
        }
      )
      .on(
        'broadcast',
        { event: 'incoming_call' },
        (payload) => {
          handleIncomingCallRealtime(payload.payload as Call);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
        },
        async (payload) => {
          handleCallActionRealtime(payload.new as Call);
        }
      )
      .on(
        'broadcast',
        { event: 'call_action' },
        (payload) => {
          const { callId, action, status, calleeDeviceId } = payload.payload;
          handleCallActionRealtime({
             id: callId,
             status,
             calleeDeviceId
          } as Partial<Call>);
        }
      )
      .subscribe();

    // 2. High-reliability Polling for incoming calls (every 300ms for instant cross-device notification)
    const incomingPollInterval = setInterval(async () => {
      if (activeCallStateRef.current) return; // already in active call
      try {
        let foundCall: Call | null = null;

        // Try server signaling relay first with device identification
        const res = await fetch('/api/calls/incoming', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            username: currentUser.username,
            deviceId: getClientDeviceId(),
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.calls) && data.calls.length > 0) {
            foundCall = data.calls[0] as Call;
          }
        }

        // Direct DB fallback query if not found yet
        if (!foundCall) {
          const seventyFiveSecsAgo = new Date(Date.now() - 75000).toISOString();
          const { data: dbCalls } = await supabase
            .from('calls')
            .select('*')
            .eq('callee_id', currentUser.id)
            .in('status', ['calling', 'ringing'])
            .gte('created_at', seventyFiveSecsAgo)
            .order('created_at', { ascending: false })
            .limit(1);

          if (Array.isArray(dbCalls) && dbCalls.length > 0) {
            const dbCall = dbCalls[0] as Call;
            const { data: callerP } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', dbCall.caller_id)
              .single();

            foundCall = {
              ...dbCall,
              caller: (callerP as Profile) || undefined,
            };
          }
        }

        if (foundCall) {
          // If already answering or already answered this call, skip
          if (answeredCallIdsRef.current.has(foundCall.id) || isAnsweringRef.current) return;
          const currentIncoming = incomingCallRef.current;
          if (!currentIncoming || currentIncoming.id !== foundCall.id) {
            incomingCallReceivedAtRef.current = Date.now();
            setIncomingCall(foundCall);

            // Record incoming call in call history
            const fallbackPeer = createFallbackProfile(foundCall.caller_id, 'Caller');
            recordCallInHistory(currentUser.id, {
              ...foundCall,
              peer: foundCall.caller || fallbackPeer,
              direction: 'incoming',
              isMissed: false,
              durationFormatted: 'Ringing...',
            });

            const isCallSoundEnabled = localStorage.getItem('liveconnect_perm_call_sound') !== 'false';
            if (isCallSoundEnabled) {
              audioTones.startIncomingRingtone();
            }

            fetch('/api/calls/action', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callId: foundCall.id, action: 'ring', userId: currentUser.id }),
            }).catch(() => {});
          }
        } else if (incomingCallRef.current) {
          // If ringing for more than 45s without answer, auto-dismiss and record as missed
          if (Date.now() - incomingCallReceivedAtRef.current > 45000) {
            const timedOutCallId = incomingCallRef.current.id;
            audioTones.stop();
            setIncomingCall(null);
            updateCallInHistory(currentUser.id, timedOutCallId, {
              status: 'missed',
              isMissed: true,
              ended_at: new Date().toISOString(),
              durationFormatted: 'Missed',
            });
            return;
          }

          // Check if existing incoming call was cancelled / ended by caller
          if (Date.now() - incomingCallReceivedAtRef.current > 3000) {
            const statusRes = await fetch('/api/calls/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ callId: incomingCallRef.current.id }),
            });
            if (statusRes.ok) {
              const statusData = await statusRes.json();
              if (
                statusData &&
                statusData.status &&
                ['cancelled', 'ended', 'rejected', 'missed'].includes(statusData.status)
              ) {
                audioTones.stop();
                setIncomingCall(null);
                updateCallInHistory(currentUser.id, incomingCallRef.current.id, {
                  status: statusData.status,
                  isMissed: statusData.status !== 'ended',
                  ended_at: new Date().toISOString(),
                  durationFormatted: statusData.status === 'rejected' ? 'Declined' : 'Missed',
                });
              }
            }
          }
        }
      } catch (e) {
        // network polling fallback
      }
    }, 600);

    return () => {
      clearInterval(incomingPollInterval);
      supabase.removeChannel(channel);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageEvent);
      }
      if (callBusRef.current) {
        callBusRef.current.close();
        callBusRef.current = null;
      }
    };
  }, [currentUser?.id, connectToCallRoom, cleanupMediaSession]);

  // Active call status monitor (monitors when caller/callee accepts, ends, rejects, or cancels)
  useEffect(() => {
    if (!activeCallState?.call?.id) return;

    const callId = activeCallState.call.id;
    const isCaller = activeCallState.isCaller;

    const statusInterval = setInterval(async () => {
      try {
        const res = await fetch('/api/calls/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId }),
        });
        if (res.ok) {
          const data = await res.json();
          const currentActive = activeCallStateRef.current;
          if (currentActive && currentActive.call.id === callId) {
            if (data.status === 'accepted' && currentActive.status !== 'connected') {
              audioTones.stop();
              if (callTimeoutRef.current) {
                clearTimeout(callTimeoutRef.current);
                callTimeoutRef.current = null;
              }
              if (data.call?.calleeDeviceId) {
                currentActive.call.calleeDeviceId = data.call.calleeDeviceId;
              }
              setActiveCallState((prev) => (prev ? { ...prev, status: 'connected' } : null));
              if (currentUser?.id) {
                updateCallInHistory(currentUser.id, callId, {
                  status: 'accepted',
                  answered_at: new Date().toISOString(),
                  durationFormatted: 'Connected',
                });
              }
              if (isCaller) {
                await connectToCallRoom(currentActive.call, currentActive.call.call_type === 'video');
              }
            } else if (data.exists && ['rejected', 'ended', 'cancelled', 'missed'].includes(data.status)) {
              const wasConnected = currentActive.status === 'connected' || (currentActive.durationSeconds || 0) > 0;
              audioTones.playCallEndedSound();
              cleanupMediaSession();
              setActiveCallState(null);
              if (currentUser?.id) {
                const isMissedStatus = data.status === 'rejected' || data.status === 'cancelled' || data.status === 'missed';
                const durationSecs = currentActive?.durationSeconds || 0;
                const durationFormatted = isMissedStatus
                  ? 'No answer'
                  : formatCallDurationText(durationSecs) || 'Call ended';

                updateCallInHistory(currentUser.id, callId, {
                  status: data.status,
                  isMissed: isMissedStatus,
                  ended_at: new Date().toISOString(),
                  durationFormatted,
                });

                if (currentActive?.peer) {
                  insertCallLogIntoChat({
                    callId,
                    caller: currentActive.isCaller ? currentUser : currentActive.peer,
                    callee: currentActive.isCaller ? currentActive.peer : currentUser,
                    callType: currentActive.call.call_type,
                    status: data.status,
                    isMissed: isMissedStatus,
                    durationFormatted,
                  }).catch(() => {});
                }

                // Trigger AdMob Interstitial Ad (Android only, completed calls only, at most once per call session)
                if (wasConnected && data.status === 'ended') {
                  admobService.showPostCallInterstitial(callId, true).catch(() => {});
                }
              }
            }
          }
        }
      } catch (e) {
        // ignore
      }
    }, 350);

    return () => {
      clearInterval(statusInterval);
    };
  }, [activeCallState?.call?.id, activeCallState?.isCaller, connectToCallRoom, cleanupMediaSession, currentUser?.id]);

  // Initiate an Outgoing Audio or Video Call
  const startCall = async (peer: Profile, callType: CallType) => {
    if (!currentUser?.id) return;
    setCallError(null);

    const calleeId = peer?.id || (peer as any)?.username;
    if (!calleeId) {
      setCallError('Could not find user to call.');
      return;
    }

    const peerProfile: Profile = {
      ...peer,
      id: calleeId,
      username: peer?.username || calleeId,
      display_name: peer?.display_name || peer?.username || 'User',
    };

    const supabase = getSupabase();
    const callId = generateCallUUID();
    const roomName = `room_${callId.replace(/-/g, '').substring(0, 16)}`;

    try {
      const newCall: Call = {
        id: callId,
        caller_id: currentUser.id,
        callee_id: calleeId,
        callerDeviceId: getClientDeviceId(),
        call_type: callType,
        status: 'calling',
        room_name: roomName,
        caller: currentUser,
        started_at: null,
        answered_at: null,
        ended_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // 1. Immediately open Call UI (0ms delay)
      setActiveCallState({
        call: newCall,
        peer: peerProfile,
        isCaller: true,
        status: 'calling',
        localAudioEnabled: true,
        localVideoEnabled: callType === 'video',
        isFrontCamera: true,
        durationSeconds: 0,
      });

      // 2. Play ringback tone immediately
      audioTones.startRingbackTone();

      // 3. Record in local call history immediately
      recordCallInHistory(currentUser.id, {
        ...newCall,
        peer: peerProfile,
        direction: 'outgoing',
        isMissed: false,
        durationFormatted: 'Calling...',
      });

      // 4. Broadcast on local bus & storage for instant multi-tab sync
      callBusRef.current?.postMessage({
        type: 'CALL_RINGING',
        call: newCall,
        callerMeta: currentUser,
      });

      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(
            'liveconnect_cross_tab_call_signal',
            JSON.stringify({
              type: 'CALL_RINGING',
              call: newCall,
              callerMeta: currentUser,
              _t: Date.now(),
            })
          );
        } catch {
          // ignore
        }
      }

      // 5. Create call record in Supabase & Server Relay in parallel
      Promise.resolve(
        supabase
          .from('calls')
          .insert({
            id: newCall.id,
            caller_id: currentUser.id,
            callee_id: peer.id,
            call_type: callType,
            status: 'calling',
            room_name: roomName,
          })
          .select()
      ).catch(() => {});

      fetch('/api/calls/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          call: newCall,
          callerMeta: currentUser,
        }),
      })
        .then(async (res) => {
          if (res.status === 403) {
            const errData = await res.json().catch(() => ({}));
            audioTones.stop();
            if (callTimeoutRef.current) {
              clearTimeout(callTimeoutRef.current);
            }
            cleanupMediaSession().catch(() => {});
            setActiveCallState(null);
            setCallError(errData.error || 'Follow each other to start calling.');
          }
        })
        .catch(() => {});

      supabase.from('call_participants').insert({
        call_id: newCall.id,
        user_id: currentUser.id,
      }).then(() => {});

      // 6. Acquire local media stream in parallel (does not block UI or signaling)
      acquireLocalMedia(callType === 'video').catch((e) => {
        console.warn('Camera/mic access in background notice:', e);
      });

      // Auto-cancel call if not answered within 45 seconds
      if (callTimeoutRef.current) {
        clearTimeout(callTimeoutRef.current);
      }
      callTimeoutRef.current = setTimeout(async () => {
        audioTones.playCallEndedSound();

        callBusRef.current?.postMessage({
          type: 'CALL_CANCELLED',
          callId: newCall.id,
        });

        fetch('/api/calls/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callId: newCall.id, action: 'cancel', userId: currentUser.id }),
        }).catch(() => {});

        updateCallInHistory(currentUser.id, newCall.id, {
          status: 'missed',
          isMissed: true,
          ended_at: new Date().toISOString(),
          durationFormatted: 'No answer',
        });

        insertCallLogIntoChat({
          callId: newCall.id,
          caller: currentUser,
          callee: peer,
          callType: newCall.call_type,
          status: 'missed',
          isMissed: true,
          durationFormatted: 'No answer',
        }).catch(() => {});

        await supabase
          .from('calls')
          .update({ status: 'missed', ended_at: new Date().toISOString() })
          .eq('id', newCall.id);
        await cleanupMediaSession();
        setActiveCallState(null);
      }, 45000);
    } catch (err: any) {
      console.error('Call initialization error:', err);
      audioTones.stop();
      setCallError(err.message || 'Could not start call');
      setActiveCallState(null);
    }
  };

  // Accept incoming call
  const acceptCall = async () => {
    if (!incomingCall || !currentUser?.id || isAnsweringRef.current) return;
    const callToAnswer = incomingCall;
    isAnsweringRef.current = true;
    answeredCallIdsRef.current.add(callToAnswer.id);

    // 1. Immediately dismiss incoming call modal and stop ringtones
    setIncomingCall(null);
    incomingCallRef.current = null;
    audioTones.stop();

    const peer = callToAnswer.caller || ({
      id: callToAnswer.caller_id,
      username: 'Caller',
      display_name: 'Caller',
      avatar_url: null,
      bio: null,
      is_online: true,
      last_seen: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as Profile);

    // 2. Immediately transition into active call screen (0ms delay)
    const initialActiveState: ActiveCallState = {
      call: callToAnswer,
      peer,
      isCaller: false,
      status: 'connected',
      localAudioEnabled: true,
      localVideoEnabled: callToAnswer.call_type === 'video',
      isFrontCamera: true,
      durationSeconds: 0,
    };
    setActiveCallState(initialActiveState);
    activeCallStateRef.current = initialActiveState;

    // 3. Immediately broadcast call acceptance to caller across tabs
    callBusRef.current?.postMessage({
      type: 'CALL_ACCEPTED',
      callId: callToAnswer.id,
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'liveconnect_cross_tab_call_signal',
          JSON.stringify({ type: 'CALL_ACCEPTED', callId: callToAnswer.id, _t: Date.now() })
        );
      } catch {}
    }

    updateCallInHistory(currentUser.id, callToAnswer.id, {
      status: 'accepted',
      answered_at: new Date().toISOString(),
      durationFormatted: 'Connected',
    });

    // 4. Notify backend & Supabase immediately in parallel
    const calleeDeviceId = getClientDeviceId();
    callToAnswer.calleeDeviceId = calleeDeviceId;

    fetch('/api/calls/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callId: callToAnswer.id,
        action: 'accept',
        userId: currentUser.id,
        calleeDeviceId,
      }),
    }).catch(() => {});

    const supabase = getSupabase();
    supabase
      .from('calls')
      .update({
        status: 'accepted',
        answered_at: new Date().toISOString(),
      })
      .eq('id', callToAnswer.id)
      .then(() => {});

    supabase.from('call_participants').insert({
      call_id: callToAnswer.id,
      user_id: currentUser.id,
    }).then(() => {});

    try {
      // 5. Acquire local media & connect callee to room
      await acquireLocalMedia(callToAnswer.call_type === 'video');
      await connectToCallRoom(callToAnswer, callToAnswer.call_type === 'video');
    } catch (err: any) {
      console.error('Failed to answer call:', err);
      setCallError(err.message || 'Error answering call');
      await cleanupMediaSession();
    } finally {
      isAnsweringRef.current = false;
    }
  };

  // Reject incoming call
  const rejectCall = async () => {
    if (!incomingCall) return;
    const callToReject = incomingCall;
    setIncomingCall(null);
    audioTones.stop();
    audioTones.playCallEndedSound();

    callBusRef.current?.postMessage({
      type: 'CALL_REJECTED',
      callId: callToReject.id,
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'liveconnect_cross_tab_call_signal',
          JSON.stringify({ type: 'CALL_REJECTED', callId: callToReject.id, _t: Date.now() })
        );
      } catch {}
    }

    if (currentUser?.id) {
      updateCallInHistory(currentUser.id, callToReject.id, {
        status: 'rejected',
        isMissed: true,
        ended_at: new Date().toISOString(),
        durationFormatted: 'No answer',
      });

      // Insert Call Log into Chat
      if (callToReject.caller) {
        insertCallLogIntoChat({
          callId: callToReject.id,
          caller: callToReject.caller,
          callee: currentUser,
          callType: callToReject.call_type,
          status: 'rejected',
          isMissed: true,
          durationFormatted: 'No answer',
        }).catch(() => {});
      }
    }

    fetch('/api/calls/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: callToReject.id, action: 'reject', userId: currentUser?.id }),
    }).catch(() => {});

    const supabase = getSupabase();
    await supabase
      .from('calls')
      .update({
        status: 'rejected',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callToReject.id);
  };

  // Cancel outgoing call before it is answered
  const cancelCall = async () => {
    const currentActive = activeCallStateRef.current || activeCallState;
    if (!currentActive) return;
    const callToCancel = currentActive.call;

    // Immediately teardown UI and sound
    setActiveCallState(null);
    audioTones.stop();
    audioTones.playCallEndedSound();

    if (p2pSessionRef.current) {
      p2pSessionRef.current.sendHangup().catch(() => {});
    }

    cleanupMediaSession();

    callBusRef.current?.postMessage({
      type: 'CALL_CANCELLED',
      callId: callToCancel.id,
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'liveconnect_cross_tab_call_signal',
          JSON.stringify({ type: 'CALL_CANCELLED', callId: callToCancel.id, _t: Date.now() })
        );
      } catch {}
    }

    if (currentUser?.id) {
      updateCallInHistory(currentUser.id, callToCancel.id, {
        status: 'cancelled',
        isMissed: true,
        ended_at: new Date().toISOString(),
        durationFormatted: 'No answer',
      });

      if (currentActive?.peer) {
        insertCallLogIntoChat({
          callId: callToCancel.id,
          caller: currentActive.isCaller ? currentUser : currentActive.peer,
          callee: currentActive.isCaller ? currentActive.peer : currentUser,
          callType: callToCancel.call_type,
          status: 'cancelled',
          isMissed: true,
          durationFormatted: 'No answer',
        }).catch(() => {});
      }
    }

    fetch('/api/calls/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: callToCancel.id, action: 'cancel', userId: currentUser?.id }),
    }).catch(() => {});

    const supabase = getSupabase();
    supabase
      .from('calls')
      .update({
        status: 'cancelled',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callToCancel.id)
      .then(() => {});
  };

  // End an active call
  const endCall = async () => {
    const currentActive = activeCallStateRef.current || activeCallState;
    if (!currentActive) return;
    const callToEnd = currentActive.call;
    const callDuration = currentActive.durationSeconds || 0;
    const isAnswered = callDuration > 0 || currentActive.status === 'connected' || connectionState === ConnectionState.Connected;
    const isMissed = !isAnswered;

    // Immediately teardown UI and sound
    setActiveCallState(null);
    audioTones.stop();
    audioTones.playCallEndedSound();

    if (p2pSessionRef.current) {
      p2pSessionRef.current.sendHangup().catch(() => {});
    }

    cleanupMediaSession();

    callBusRef.current?.postMessage({
      type: 'CALL_ENDED',
      callId: callToEnd.id,
      duration: callDuration,
    });
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'liveconnect_cross_tab_call_signal',
          JSON.stringify({ type: 'CALL_ENDED', callId: callToEnd.id, duration: callDuration, _t: Date.now() })
        );
      } catch {}
    }

    if (currentUser?.id) {
      const durationFormatted = isAnswered ? (formatCallDurationText(callDuration) || 'Ended') : 'No answer';

      updateCallInHistory(currentUser.id, callToEnd.id, {
        status: isMissed ? 'missed' : 'ended',
        isMissed,
        ended_at: new Date().toISOString(),
        durationFormatted,
      });

      if (currentActive?.peer) {
        insertCallLogIntoChat({
          callId: callToEnd.id,
          caller: currentActive.isCaller ? currentUser : currentActive.peer,
          callee: currentActive.isCaller ? currentActive.peer : currentUser,
          callType: callToEnd.call_type,
          status: isMissed ? 'missed' : 'ended',
          isMissed,
          durationFormatted,
        }).catch(() => {});
      }
    }

    fetch('/api/calls/action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callId: callToEnd.id, action: 'end', userId: currentUser?.id }),
    }).catch(() => {});

    const supabase = getSupabase();
    supabase
      .from('calls')
      .update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      })
      .eq('id', callToEnd.id)
      .then(() => {});

    // Update participant left_at
    if (currentUser?.id) {
      supabase
        .from('call_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('call_id', callToEnd.id)
        .eq('user_id', currentUser.id)
        .then(() => {});
    }

    // Trigger AdMob Interstitial Ad (Android only, completed calls only, at most once per call session)
    if (isAnswered) {
      admobService.showPostCallInterstitial(callToEnd.id, true).catch(() => {});
    }
  };

  // Toggle local audio / microphone (works in calling and connected state)
  const toggleMicrophone = async () => {
    const currentState = activeCallStateRef.current?.localAudioEnabled ?? activeCallState?.localAudioEnabled ?? true;
    const newState = !currentState;

    // Toggle all tracks in local stream
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = newState;
      });
    }

    // Toggle WebRTC P2P senders and stream
    if (p2pSessionRef.current) {
      p2pSessionRef.current.setAudioEnabled(newState);
    }

    setActiveCallState((prev) => (prev ? { ...prev, localAudioEnabled: newState } : null));
  };

  // Toggle local video / camera (works in calling and connected state)
  const toggleCamera = async () => {
    const currentState = activeCallStateRef.current?.localVideoEnabled ?? activeCallState?.localVideoEnabled ?? true;
    const newState = !currentState;

    // Toggle local video tracks
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = newState;
      });
    }

    if (p2pSessionRef.current) {
      p2pSessionRef.current.setVideoEnabled(newState);
    }

    setActiveCallState((prev) => (prev ? { ...prev, localVideoEnabled: newState } : null));
  };

  // Switch camera front/back
  const switchCamera = async () => {
    if (!activeCallState?.localVideoEnabled || !localStreamRef.current) return;

    try {
      const isFront = activeCallState.isFrontCamera ?? true;
      const newFacingMode = isFront ? 'environment' : 'user';

      // Stop previous video tracks
      localStreamRef.current.getVideoTracks().forEach((track) => track.stop());

      let newStream: MediaStream;
      try {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: newFacingMode,
            width: { ideal: 1920, min: 1280 },
            height: { ideal: 1080, min: 720 },
            frameRate: { ideal: 30, min: 24, max: 60 },
          },
        });
      } catch {
        newStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: newFacingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }

      const newVideoTrack = newStream.getVideoTracks()[0];
      if (newVideoTrack) {
        // Replace in local stream
        localStreamRef.current.removeTrack(localStreamRef.current.getVideoTracks()[0]);
        localStreamRef.current.addTrack(newVideoTrack);

        // Update local video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        // Update WebRTC peer track
        if (p2pSessionRef.current) {
          await p2pSessionRef.current.replaceVideoTrack(newVideoTrack);
        }

        setActiveCallState((prev) => (prev ? { ...prev, isFrontCamera: !isFront } : null));
      }
    } catch (err) {
      console.warn('Could not flip camera device:', err);
    }
  };

  // Ensure local video stream is attached to local video element once rendered
  useEffect(() => {
    if (
      activeCallState &&
      activeCallState.call.call_type === 'video' &&
      localStreamRef.current &&
      localVideoRef.current
    ) {
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(() => {});
      }
    }
  }, [activeCallState?.call.id, activeCallState?.call.call_type, activeCallState?.localVideoEnabled]);

  // Ensure remote audio and video streams are attached to elements as soon as they mount or connection changes
  useEffect(() => {
    if (!activeCallState) return;

    const stream = remoteStreamRef.current || p2pSessionRef.current?.remoteStream;
    if (!stream) return;

    // Attach remote audio element for crystal clear voice playback
    if (remoteAudioRef.current) {
      if (remoteAudioRef.current.srcObject !== stream) {
        remoteAudioRef.current.srcObject = stream;
      }
      remoteAudioRef.current.volume = 1.0;
      remoteAudioRef.current.play().catch(() => {});
    }

    // Attach remote video element
    if (
      activeCallState.call.call_type === 'video' &&
      remoteVideoRef.current &&
      remoteVideoRef.current.srcObject !== stream
    ) {
      remoteVideoRef.current.srcObject = stream;
      remoteVideoRef.current.play().catch(() => {});
    }
  }, [activeCallState?.call.id, activeCallState?.status, connectionState]);

  return {
    incomingCall,
    activeCallState,
    connectionState,
    callError,
    localVideoRef,
    remoteVideoRef,
    remoteAudioRef,
    startCall,
    acceptCall,
    rejectCall,
    cancelCall,
    endCall,
    toggleMicrophone,
    toggleCamera,
    switchCamera,
    clearCallError: () => setCallError(null),
  };
}
