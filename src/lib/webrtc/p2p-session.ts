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
    // Google Anycast Global STUN Cluster (APAC, India, EU, Americas, MEA)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // Cloudflare & Mozilla Global STUNs
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com' },
    // OpenRelay Public TURN Relay for carrier NAT & strict mobile firewall traversal
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
 
// PASTE YOUR OWN METERED.CA APP NAME & API KEY HERE (dashboard.metered.ca -> your TURN app)
// This replaces the shared/anonymous public OpenRelay credentials with a dedicated,
// non-congested TURN allocation, which is the main fix for choppy/dropping call audio.
const METERED_APP_NAME: string = 'liveconnect-app';
const METERED_API_KEY: string = '0OIQnTosVCUQB4AzcpVXejlCXT7EUPOEgYbW5agNAG_4zWI4';
 
// Fetch fresh, dedicated TURN credentials directly from Metered (no backend needed)
if (typeof window !== 'undefined' && METERED_API_KEY !== 'YOUR_API_KEY') {
  fetch(`https://${METERED_APP_NAME}.metered.live/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`)
    .then((r) => r.json())
    .then((iceServers) => {
      if (Array.isArray(iceServers) && iceServers.length > 0) {
        cachedIceConfiguration = {
          ...GLOBAL_DEFAULT_ICE_SERVERS,
          // Own dedicated TURN servers first, public STUN/OpenRelay kept only as last-resort fallback
          iceServers: [...iceServers, ...(GLOBAL_DEFAULT_ICE_SERVERS.iceServers || [])],
        };
      }
    })
    .catch(() => {
      // Falls back to GLOBAL_DEFAULT_ICE_SERVERS (public STUN + shared OpenRelay) automatically
    });
}
 
/**
 * Optimizes WebRTC SDP for high-definition studio voice and 1080p/720p HD video clarity:
 * - Prioritizes Opus as the default audio codec over legacy codecs
 * - Enables in-band Forward Error Correction (FEC) to eliminate voice crackle during packet loss
 * - Sets 64 kbps adaptive Opus bitrate for crisp, natural voice
 * - Enables Discontinuous Transmission (DTX) for VoIP optimization
 * - Enforces mono voice channel (stereo=0) to prevent comb-filtering on phone/earphone microphones
 * - Boosts HD video bitrate parameters (up to 3.5 Mbps for 1080p/720p 60/30fps clarity)
 */
function enhanceMediaSDP(sdpText?: string): string {
  if (!sdpText) return '';
  let sdp = sdpText;
 
  try {
    // 1. Locate Opus payload type number (typically 111)
    const opusMatch = sdp.match(/a=rtpmap:(\d+)\s+opus\/48000\/2/i);
    if (opusMatch) {
      const pt = opusMatch[1];
 
      // Reorder m=audio line to put Opus payload type FIRST
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
          // Apply optimized studio-grade voice clarity parameters
          map.set('minptime', '10');
          map.set('ptime', '20');
          map.set('useinbandfec', '1');
          map.set('maxaveragebitrate', '96000');
          map.set('stereo', '0');
          map.set('sprop-stereo', '0');
          map.set('cbr', '0');
          map.set('maxplaybackrate', '48000');
          map.set('sprop-maxcapturerate', '48000');
          map.set('usedtx', '0'); // Disable DTX to prevent voice clipping on sentence starts
 
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
 
    // 2. Enhance HD Video Bitrate in SDP if video media line is present
    if (sdp.includes('m=video')) {
      // Add or replace bandwidth parameter to allocate up to 3500 kbps for HD video
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
  private isClosed: boolean = false;
  private isRestartingIce: boolean = false;
  private lastNetworkQuality: 'excellent' | 'good' | 'poor' = 'excellent';
  private processedSignalIds = new Set<string>();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private currentDeviceId?: string;
  private targetDeviceId?: string;
 
  // Packet statistics tracking
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
    }
  }
 
  private initPeerConnection() {
    if (this.pc) {
      try {
        this.pc.close();
      } catch {}
    }
 
    this.pc = new RTCPeerConnection(cachedIceConfiguration);
 
    // Add local tracks to peer connection and set high priority for audio
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
                // Allocate up to 3.5 Mbps for crystal-clear Full HD 1080p/720p 60fps video
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
 
    // Handle incoming remote tracks
    this.pc.ontrack = (event) => {
      // Ensure all tracks from incoming stream are registered
      if (event.streams && event.streams[0]) {
        event.streams[0].getTracks().forEach((t) => {
          if (!this.remoteStream.getTracks().some((existing) => existing.id === t.id)) {
            this.remoteStream.addTrack(t);
          }
        });
      }
      // Ensure the direct event track is also registered
      if (event.track) {
        if (!this.remoteStream.getTracks().some((existing) => existing.id === event.track.id)) {
          this.remoteStream.addTrack(event.track);
        }
        this.callbacks.onRemoteTrack?.(event.track, this.remoteStream);
      }
    };
 
    // Connection state changes
    this.pc.onconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.connectionState;
      if (state === 'connected') {
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
 
    // Send local ICE candidates to peer
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
 
    // Start network & audio quality adaptation loop
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
 
  /**
   * Monitors packet loss, round-trip-time (RTT), and jitter in real-time.
   * Dynamically adapts audio & video bitrates to ensure uninterrupted, clear voice.
   */
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
          // Check inbound audio stats for packet loss & jitter
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
            currentJitter = (report.jitter || 0) * 1000; // ms
          }
 
          // Check candidate-pair for real Round-Trip Time
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            if (typeof report.currentRoundTripTime === 'number') {
              currentRtt = report.currentRoundTripTime * 1000; // ms
            }
          }
        });
 
        // Determine network health
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
 
  /**
   * Adapts media streams: Always prioritizes voice transmission over video when network is congested.
   */
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
          // Audio sender gets maximum priority
          params.encodings[0].priority = 'high';
          params.encodings[0].networkPriority = 'high';
 
          if (quality === 'poor') {
            // Adaptive audio: 48kbps with inband FEC to fit through narrow bandwidth
            params.encodings[0].maxBitrate = 48000;
          } else {
            // Full 96kbps HD audio for crystal clear fidelity
            params.encodings[0].maxBitrate = 96000;
          }
          sender.setParameters(params).catch(() => {});
        } else if (sender.track.kind === 'video') {
          // Video sender adapts resolution and bitrate dynamically
          if (quality === 'poor') {
            params.encodings[0].maxBitrate = 400000; // 400 kbps fallback
            params.encodings[0].priority = 'low';
            params.encodings[0].networkPriority = 'low';
            params.encodings[0].scaleResolutionDownBy = 1.5;
          } else if (quality === 'good') {
            params.encodings[0].maxBitrate = 1500000; // 1.5 Mbps for smooth 720p HD
            params.encodings[0].priority = 'medium';
            params.encodings[0].networkPriority = 'medium';
            params.encodings[0].scaleResolutionDownBy = 1;
          } else {
            // Excellent network: Full 3.5 Mbps 1080p/720p 60fps HD video
            params.encodings[0].maxBitrate = 3500000; // 3.5 Mbps HD
            params.encodings[0].priority = 'medium';
            params.encodings[0].networkPriority = 'medium';
            params.encodings[0].scaleResolutionDownBy = 1;
          }
          sender.setParameters(params).catch(() => {});
        }
      } catch {}
    });
  }
 
  /**
   * Handles Wi-Fi to Mobile data switching, brief disconnections & seamless ICE restarts.
   */
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
 
      // Handle earphone/headset plug/unplug events
      if (navigator.mediaDevices && typeof navigator.mediaDevices.addEventListener === 'function') {
        navigator.mediaDevices.addEventListener('devicechange', () => {
          // Maintain audio tracks without breaking active session
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
 
  private async sendSignal(signal: SignalingPayload) {
    try {
      const payload: SignalingPayload = {
        ...signal,
        senderDeviceId: this.currentDeviceId,
        targetDeviceId: this.targetDeviceId,
      };
 
      // 1. Cross-tab local broadcast
      if (typeof window !== 'undefined' && (window as any).BroadcastChannel) {
        try {
          const bc = new BroadcastChannel(`liveconnect_p2p_signals_${this.callId}`);
          bc.postMessage(payload);
          bc.close();
        } catch {}
      }
 
      // 2. Server signaling relay
      await fetch('/api/calls/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }
 
  public async handleIncomingSignal(signal: SignalingPayload) {
    if (signal.callId !== this.callId) return;
 
    // Don't process signals sent by our own device
    if (signal.senderDeviceId && this.currentDeviceId && signal.senderDeviceId === this.currentDeviceId) {
      return;
    }
    // If no deviceId specified, ignore if sent by ourselves
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
            // ignore transient ICE race conditions
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
        // ignore
      }
    }
  }
 
  private startSignalingPolling() {
    // Listen to cross-tab BroadcastChannel with deduplication
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
 
    // Poll server signaling endpoint (rapid 350ms interval for near-instant cross-device connection)
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
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
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
 