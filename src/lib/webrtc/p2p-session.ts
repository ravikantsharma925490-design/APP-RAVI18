import { getSupabase } from '@/src/lib/supabase/client';
 
export interface WebRTCSessionCallbacks {
  onConnected?: () => void;
  onDisconnected?: () => void;
  onRemoteTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onNetworkQualityChange?: (quality: 'excellent' | 'good' | 'poor', stats: { packetLoss: number; jitter: number; rtt: number }) => void;
}
 
export interface SignalingPayload {
  callId: string;
  senderId: string;
  targetId: string;
  senderDeviceId?: string;
  targetDeviceId?: string;
  type: 'offer' | 'answer' | 'candidate' | 'hangup' | 'ice-restart';
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}
 
const GLOBAL_DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    {
      urls: '',
      username: '',
      credential: '',
    },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp',
        'turns:openrelay.metered.ca:443?transport=tcp',
      ],
      username: 'openrelay',
      credential: 'openrelay',
    },
  ],
  iceCandidatePoolSize: 6,
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require',
};
 
let cachedIceConfiguration: RTCConfiguration = GLOBAL_DEFAULT_ICE_SERVERS;
 
function enhanceMediaSDP(sdpText?: string): string {
  if (!sdpText) return '';
  let sdp = sdpText;
 
  try {
    const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
    if (opusMatch) {
      const pt = opusMatch[1];
 
      sdp = sdp.replace(/m=audio\s+(\d+)\s+([A-Z/]+)\s+(.+)/i, (m, port, proto, pts) => {
        const ptList = pts.trim().split(/\s+/);
        const filtered = ptList.filter((p: string) => p !== pt);
        return `m=audio ${port} ${proto} ${pt} ${filtered.join(' ')}`;
      });
 
      const fmtpRegex = new RegExp(`a=fmtp:${pt}\\s+([^\r\n]+)`, 'i');
      if (fmtpRegex.test(sdp)) {
        sdp = sdp.replace(fmtpRegex, (_match, existing) => {
          const map = new Map<string, string>();
          existing.split(';').forEach((p: string) => {
            const trimmed = p.trim();
            if (!trimmed) return;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx !== -1) {
              map.set(trimmed.substring(0, eqIdx).trim(), trimmed.substring(eqIdx + 1).trim());
            } else {
              map.set(trimmed, '');
            }
          });
          map.set('minptime', '10');
          map.set('ptime', '20');
          map.set('useinbandfec', '1');
          map.set('maxaveragebitrate', '96000');
          map.set('stereo', '0');
          map.set('sprop-stereo', '0');
          map.set('cbr', '0');
          map.set('maxplaybackrate', '48000');
          map.set('sprop-maxcapturerate', '48000');
          map.set('usedtx', '0');
 
          const formatted = Array.from(map.entries())
            .map(([k, v]) => (v ? `${k}=${v}` : k))
            .join(';');
          return `a=fmtp:${pt} ${formatted}`;
        });
      } else {
        const hdParams = 'minptime=10;ptime=20;useinbandfec=1;maxaveragebitrate=96000;stereo=0;sprop-stereo=0;cbr=0;maxplaybackrate=48000;sprop-maxcapturerate=48000;usedtx=0';
        sdp = sdp.replace(
          new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000\\/2\r?\n)`, 'i'),
          `$1a=fmtp:${pt} ${hdParams}\r\n`
        );
      }
    }
 
    if (sdp.includes('m=video')) {
      if (!sdp.includes('b=AS:')) {
        sdp = sdp.replace(/(m=video[^\r\n]+(?:\r?\n[^\r\n]+)*?)(c=IN[^\r\n]+)/, '$1$2\r\nb=AS:3500\r\nb=TIAS:3500000');
      }
    }
  } catch (err) {
    console.warn('SDP enhancement notice:', err);
  }
 
  return sdp;
}
 
export class WebRTCP2PSession {
  public pc: RTCPeerConnection | null = null;
  public localStream: MediaStream | null = null;
  public remoteStream: MediaStream = new MediaStream();
  private callbacks: WebRTCSessionCallbacks;
  private callId: string;
  private currentUserId: string;
  private targetUserId: string;
  private isCaller: boolean;
  private isVideo: boolean = false;
  private pollInterval: any = null;
  private statsInterval: any = null;
  private offerRetryInterval: any = null;
  private offerRetryCount: number = 0;
  private isClosed: boolean = false;
  private isRestartingIce: boolean = false;
  private lastNetworkQuality: 'excellent' | 'good' | 'poor' = 'excellent';
  private processedSignalIds = new Set<string>();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private supabaseChannel: any = null;
  private supabaseChannelReady: boolean = false;
  private pendingOutgoingSignals: SignalingPayload[] = [];
  private currentDeviceId?: string;
  private targetDeviceId?: string;
 
  private prevPacketsLost: number = 0;
  private prevPacketsReceived: number = 0;
 
  constructor(
    callId: string,
    currentUserId: string,
    targetUserId: string,
    isCaller: boolean,
    callbacks: WebRTCSessionCallbacks = {},
    currentDeviceId?: string,
    targetDeviceId?: string
  ) {
    this.callId = callId;
    this.currentUserId = currentUserId;
    this.targetUserId = targetUserId;
    this.isCaller = isCaller;
    this.callbacks = callbacks;
    this.currentDeviceId = currentDeviceId;
    this.targetDeviceId = targetDeviceId;
 
    const supabase = getSupabase();
    this.supabaseChannel = supabase.channel(`call_signals_${callId}`);
 
    this.supabaseChannel.on('broadcast', { event: 'webrtc_signal' }, (payload: any) => {
      if (payload && payload.payload) {
        const sig = payload.payload as SignalingPayload;
        if (sig.callId !== this.callId) return;
        if (sig.senderDeviceId && this.currentDeviceId && sig.senderDeviceId === this.currentDeviceId) return;
        const sigKey = `sb_${sig.type}_${JSON.stringify(sig.sdp || sig.candidate || {})}`;
        if (!this.processedSignalIds.has(sigKey)) {
          this.processedSignalIds.add(sigKey);
          this.handleIncomingSignal(sig);
        }
      }
    });
 
    // IMPORTANT: Supabase realtime broadcast is fire-and-forget — a message sent
    // before the OTHER side's channel has finished subscribing is lost forever
    // (this was the root cause of "rings but never connects"). We track our own
    // ready state here, and separately retry the initial offer below so the call
    // still connects even if the peer subscribed a moment late.
    this.supabaseChannel.subscribe((status: string) => {
      if (status === 'SUBSCRIBED') {
        this.supabaseChannelReady = true;
        const queued = [...this.pendingOutgoingSignals];
        this.pendingOutgoingSignals = [];
        queued.forEach((sig) => this.dispatchSignal(sig));
      }
    });
  }
 
  public async start(localStream: MediaStream, isVideo: boolean): Promise<void> {
    this.localStream = localStream;
    this.isVideo = isVideo;
    this.isClosed = false;
 
    this.initPeerConnection();
    this.startSignalingPolling();
    this.setupNetworkListeners();
 
    if (this.isCaller) {
      await this.createAndSendOffer(false);
      this.startOfferRetry();
    }
  }
 
  private startOfferRetry() {
    if (this.offerRetryInterval) clearInterval(this.offerRetryInterval);
    this.offerRetryCount = 0;
    this.offerRetryInterval = setInterval(() => {
      if (this.isClosed || !this.pc) {
        clearInterval(this.offerRetryInterval);
        return;
      }
      if (this.pc.signalingState !== 'have-local-offer' || this.pc.connectionState === 'connected') {
        clearInterval(this.offerRetryInterval);
        return;
      }
      this.offerRetryCount++;
      if (this.offerRetryCount > 5) {
        clearInterval(this.offerRetryInterval);
        return;
      }
      if (this.pc.localDescription) {
        this.sendSignal({
          callId: this.callId,
          senderId: this.currentUserId,
          targetId: this.targetUserId,
          type: 'offer',
          sdp: this.pc.localDescription,
        });
      }
    }, 2000);
  }
 
  private initPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
    }
 
    this.pc = new RTCPeerConnection(cachedIceConfiguration);
 
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (this.pc && this.localStream) {
          const sender = this.pc.addTrack(track, this.localStream);
          if (track.kind === 'audio') {
            try {
              const params = sender.getParameters();
              if (params && params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 96000;
                params.encodings[0].priority = 'high';
                params.encodings[0].networkPriority = 'high';
                sender.setParameters(params).catch(() => {});
              }
            } catch {}
          } else if (track.kind === 'video') {
            try {
              const params = sender.getParameters();
              if (params && params.encodings && params.encodings.length > 0) {
                params.encodings[0].maxBitrate = 3500000;
                params.encodings[0].priority = 'medium';
                params.encodings[0].networkPriority = 'medium';
                params.encodings[0].scaleResolutionDownBy = 1;
                params.degradationPreference = 'balanced';
                sender.setParameters(params).catch(() => {});
              }
            } catch {}
          }
        }
      });
    }
 
    this.pc.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (!this.remoteStream.getTracks().some((existing) => existing.id === t.id)) {
            this.remoteStream.addTrack(t);
          }
        });
      }
      if (event.track) {
        if (!this.remoteStream.getTracks().some((existing) => existing.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        this.callbacks.onRemoteTrack?.(event.track, this.remoteStream);
      }
    };
 
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      if (state === 'connected') {
        if (this.offerRetryInterval) {
          clearInterval(this.offerRetryInterval);
          this.offerRetryInterval = null;
        }
        this.callbacks.onConnected?.();
      } else if (state === 'disconnected' || state === 'failed') {
        this.handleNetworkDisconnection();
      }
    };
 
    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const iceState = this.pc.iceConnectionState;
      if (iceState === 'connected' || iceState === 'completed') {
        this.callbacks.onConnected?.();
      } else if (iceState === 'disconnected' || iceState === 'failed') {
        this.handleNetworkDisconnection();
      }
    };
 
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          callId: this.callId,
          senderId: this.currentUserId,
          targetId: this.targetUserId,
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };
 
    this.startNetworkQualityMonitoring();
  }
 
  private async createAndSendOffer(isIceRestart: boolean = false) {
    if (!this.pc) return;
    try {
      const offer = await this.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: this.isVideo,
        iceRestart: isIceRestart,
      });
 
      const enhancedSdp = enhanceMediaSDP(offer.sdp);
      const enhancedOffer = new RTCSessionDescription({
        type: offer.type,
        sdp: enhancedSdp || offer.sdp,
      });
 
      await this.pc.setLocalDescription(enhancedOffer);
      await this.sendSignal({
        callId: this.callId,
        senderId: this.currentUserId,
        targetId: this.targetUserId,
        type: isIceRestart ? 'ice-restart' : 'offer',
        sdp: enhancedOffer,
      });
    } catch (err: any) {
      console.warn('Failed to create/send WebRTC offer:', err.message);
      this.callbacks.onError?.(err);
    }
  }
 
  private startNetworkQualityMonitoring() {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
 
    this.statsInterval = setInterval(async () => {
      if (!this.pc || this.isClosed || this.pc.connectionState !== 'connected') return;
 
      try {
        const stats = await this.pc.getStats();
        let currentPacketLossRate = 0;
        let currentJitter = 0;
        let currentRtt = 0;
 
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp' && report.kind === 'audio') {
            const packetsLost = report.packetsLost || 0;
            const packetsReceived = report.packetsReceived || 0;
 
            const deltaLost = Math.max(0, packetsLost - this.prevPacketsLost);
            const deltaReceived = Math.max(0, packetsReceived - this.prevPacketsReceived);
            const totalPackets = deltaLost + deltaReceived;
 
            if (totalPackets > 0) {
              currentPacketLossRate = (deltaLost / totalPackets) * 100;
            }
 
            this.prevPacketsLost = packetsLost;
            this.prevPacketsReceived = packetsReceived;
            currentJitter = (report.jitter || 0) * 1000;
          }
 
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              currentRtt = report.currentRoundTripTime * 1000;
            }
          }
        });
 
        let quality: 'excellent' | 'good' | 'poor' = 'excellent';
        if (currentPacketLossRate > 5 || currentRtt > 300 || currentJitter > 60) {
          quality = 'poor';
        } else if (currentPacketLossRate > 2 || currentRtt > 150 || currentJitter > 30) {
          quality = 'good';
        }
 
        if (quality !== this.lastNetworkQuality) {
          this.lastNetworkQuality = quality;
          this.adaptMediaToNetwork(quality);
          this.callbacks.onNetworkQualityChange?.(quality, {
            packetLoss: currentPacketLossRate,
            jitter: currentJitter,
            rtt: currentRtt,
          });
        }
      } catch {}
    }, 2000);
  }
 
  private adaptMediaToNetwork(quality: 'excellent' | 'good' | 'poor') {
    if (!this.pc) return;
 
    this.pc.getSenders().forEach((sender) => {
      if (!sender.track) return;
 
      try {
        const params = sender.getParameters();
        if (!params.encodings || params.encodings.length === 0) {
          params.encodings = [{}];
        }
 
        if (sender.track.kind === 'audio') {
          params.encodings[0].priority = 'high';
          params.encodings[0].networkPriority = 'high';
 
          if (quality === 'poor') {
            params.encodings[0].maxBitrate = 48000;
          } else {
            params.encodings[0].maxBitrate = 96000;
          }
          sender.setParameters(params).catch(() => {});
        } else if (sender.track.kind === 'video') {
          if (quality === 'poor') {
            params.encodings[0].maxBitrate = 400000;
            params.encodings[0].priority = 'low';
            params.encodings[0].networkPriority = 'low';
            params.encodings[0].scaleResolutionDownBy = 1.5;
          } else if (quality === 'good') {
            params.encodings[0].maxBitrate = 1500000;
            params.encodings[0].priority = 'medium';
            params.encodings[0].networkPriority = 'medium';
            params.encodings[0].scaleResolutionDownBy = 1;
          } else {
            params.encodings[0].maxBitrate = 3500000;
            params.encodings[0].priority = 'medium';
            params.encodings[0].networkPriority = 'medium';
            params.encodings[0].scaleResolutionDownBy = 1;
          }
          sender.setParameters(params).catch(() => {});
        }
      } catch {}
    });
  }
 
  private handleNetworkDisconnection() {
    if (this.isClosed || this.isRestartingIce) return;
 
    this.isRestartingIce = true;
    setTimeout(async () => {
      if (this.isClosed || !this.pc) {
        this.isRestartingIce = false;
        return;
      }
 
      const state = this.pc.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        try {
          if (this.isCaller) {
            await this.createAndSendOffer(true);
          }
        } catch (e) {
          console.warn('ICE restart trigger notice:', e);
        }
      }
      this.isRestartingIce = false;
    }, 1500);
  }
 
  private setupNetworkListeners() {
    if (typeof window !== 'undefined') {
      const handleOnline = () => {
        if (!this.isClosed && this.pc && this.pc.iceConnectionState !== 'connected') {
          this.handleNetworkDisconnection();
        }
      };
 
      window.addEventListener('online', handleOnline);
 
      if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack && audioTrack.readyState === 'ended') {
              navigator.mediaDevices
                .getUserMedia({ audio: true })
                .then((newStream) => {
                  const newTrack = newStream.getAudioTracks()[0];
                  if (newTrack && this.pc) {
                    const audioSender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'audio');
                    if (audioSender) {
                      audioSender.replaceTrack(newTrack).catch(() => {});
                    }
                  }
                })
                .catch(() => {});
            }
          }
        });
      }
    }
  }
 
  private dispatchSignal(payload: SignalingPayload) {
    if (this.supabaseChannel) {
      if ((this.supabaseChannel as any).state === 'joined') {
        this.supabaseChannel
          .send({
            type: 'broadcast',
            event: 'webrtc_signal',
            payload: payload,
          })
          .catch(() => {});
      } else if (typeof (this.supabaseChannel as any).httpSend === 'function') {
        (this.supabaseChannel as any)
          .httpSend('webrtc_signal', payload)
          .catch(() => {});
      }
    }
  }
 
  private async sendSignal(signal: SignalingPayload) {
    try {
      const payload: SignalingPayload = {
        ...signal,
        senderDeviceId: this.currentDeviceId,
        targetDeviceId: this.targetDeviceId,
      };
 
      if (typeof window !== 'undefined' && (window as any).BroadcastChannel) {
        try {
          const bc = new BroadcastChannel(`liveconnect_p2p_signals_${this.callId}`);
          bc.postMessage(payload);
          bc.close();
        } catch {}
      }
 
      fetch('/api/calls/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => {});
 
      if (this.supabaseChannelReady) {
        this.dispatchSignal(payload);
      } else {
        this.pendingOutgoingSignals.push(payload);
      }
    } catch {}
  }
 
  public async handleIncomingSignal(signal: SignalingPayload) {
    if (signal.callId !== this.callId) return;
 
    if (signal.senderDeviceId && this.currentDeviceId && signal.senderDeviceId === this.currentDeviceId) {
      return;
    }
    if (!signal.senderDeviceId && signal.senderId === this.currentUserId && !this.targetDeviceId) {
      return;
    }
 
    if (signal.type === 'hangup') {
      this.callbacks.onDisconnected?.();
      return;
    }
 
    if (!this.pc || this.isClosed) return;
 
    try {
      if ((signal.type === 'offer' || signal.type === 'ice-restart') && signal.sdp) {
        if (this.pc.signalingState !== 'stable') {
          await Promise.all([
            this.pc.setLocalDescription({ type: 'rollback' }),
          ]).catch(() => {});
        }
        await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await this.flushPendingCandidates();
        const answer = await this.pc.createAnswer();
        const enhancedSdp = enhanceMediaSDP(answer.sdp);
        const enhancedAnswer = new RTCSessionDescription({
          type: answer.type,
          sdp: enhancedSdp || answer.sdp,
        });
        await this.pc.setLocalDescription(enhancedAnswer);
        await this.sendSignal({
          callId: this.callId,
          senderId: this.currentUserId,
          targetId: this.targetUserId,
          type: 'answer',
          sdp: enhancedAnswer,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        if (this.pc.signalingState === 'have-local-offer') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
          await this.flushPendingCandidates();
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        if (!this.pc.remoteDescription || !this.pc.remoteDescription.type) {
          this.pendingCandidates.push(signal.candidate);
        } else {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {
          }
        }
      }
    } catch (err: any) {
      console.warn('WebRTC signal handling notice:', err.message);
    }
  }
 
  private async flushPendingCandidates() {
    if (!this.pc || !this.pc.remoteDescription) return;
    const candidates = [...this.pendingCandidates];
    this.pendingCandidates = [];
    for (const cand of candidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(cand));
      } catch (e) {
      }
    }
  }
 
  private startSignalingPolling() {
    if (typeof window !== 'undefined' && (window as any).BroadcastChannel) {
      try {
        if (!this.broadcastChannel) {
          this.broadcastChannel = new BroadcastChannel(`liveconnect_p2p_signals_${this.callId}`);
          this.broadcastChannel.onmessage = (event) => {
            if (event.data) {
              const sig = event.data;
              if (sig.senderDeviceId && this.currentDeviceId && sig.senderDeviceId === this.currentDeviceId) {
                return;
              }
              const sigKey = `bc_${sig.type}_${JSON.stringify(sig.sdp || sig.candidate || {})}`;
              if (!this.processedSignalIds.has(sigKey)) {
                this.processedSignalIds.add(sigKey);
                this.handleIncomingSignal(sig);
              }
            }
          };
        }
      } catch {}
    }
 
    this.pollInterval = setInterval(async () => {
      if (this.isClosed || !this.pc) return;
      try {
        const res = await fetch('/api/calls/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            callId: this.callId,
            targetId: this.currentUserId,
            deviceId: this.currentDeviceId,
          }),
        });
 
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signals)) {
            for (const sig of data.signals) {
              if (sig.senderDeviceId && this.currentDeviceId && sig.senderDeviceId === this.currentDeviceId) {
                continue;
              }
              const sigKey = `${sig.id || ''}_${sig.type}_${JSON.stringify(sig.sdp || sig.candidate || {})}`;
              if (!this.processedSignalIds.has(sigKey)) {
                this.processedSignalIds.add(sigKey);
                await this.handleIncomingSignal(sig);
              }
            }
          }
        }
      } catch {}
    }, 350);
  }
 
  public setAudioEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
    if (this.pc) {
      this.pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'audio') {
          sender.track.enabled = enabled;
        }
      });
    }
  }
 
  public setVideoEnabled(enabled: boolean) {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach((t) => {
        t.enabled = enabled;
      });
    }
    if (this.pc) {
      this.pc.getSenders().forEach((sender) => {
        if (sender.track && sender.track.kind === 'video') {
          sender.track.enabled = enabled;
        }
      });
    }
  }
 
  public async replaceVideoTrack(newTrack: MediaStreamTrack) {
    if (this.pc) {
      const sender = this.pc.getSenders().find((s) => s.track && s.track.kind === 'video');
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (e) {
          console.warn('Failed to replace video sender track:', e);
        }
      }
    }
  }
 
  public async sendHangup() {
    try {
      await this.sendSignal({
        callId: this.callId,
        senderId: this.currentUserId,
        targetId: this.targetUserId,
        type: 'hangup',
      });
    } catch {}
  }
 
  public close() {
    this.isClosed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
    if (this.offerRetryInterval) {
      clearInterval(this.offerRetryInterval);
      this.offerRetryInterval = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }
    if (this.supabaseChannel) {
      try {
        this.supabaseChannel.unsubscribe();
      } catch {}
      this.supabaseChannel = null;
    }
    if (this.pc) {
      this.pc.ontrack = null;
      this.pc.onicecandidate = null;
      this.pc.onconnectionstatechange = null;
      this.pc.oniceconnectionstatechange = null;
      this.pc.close();
      this.pc = null;
    }
    this.remoteStream.getTracks().forEach((t) => t.stop());
  }
}
 
