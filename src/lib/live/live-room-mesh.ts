/**
 * Live Room WebRTC Real Voice Audio Mesh
 * Establishes real-time multi-peer audio connections between seated speakers
 * and audience listeners. Uses Google Anycast STUN servers, BroadcastChannel
 * for instant 0ms cross-tab audio, and HTTP server signaling for cross-device audio.
 */

let ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
    // ExpressTurn Premium Static Server
    {
      urls: 'turn:free.expressturn.com:3478',
      username: '000000002104365271',
      credential: 'Jm1+P1ebN0sYSg6A3DHDSfciAys=',
    },
    // Static fallback TURN servers
    {
      urls: 'turn:openrelay.metered.ca:80',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
    {
      urls: 'turn:openrelay.metered.ca:443?transport=tcp',
      username: 'openrelayproject',
      credential: 'openrelayproject',
    },
  ],
  iceCandidatePoolSize: 6,
};

export interface RemoteSpeakerAudio {
  userId: string;
  stream: MediaStream;
  isSpeaking: boolean;
  volume: number;
}

function enhanceOpusSDP(rawSdp: string): string {
  const match = rawSdp.match(/a=rtpmap:(\d+)\s+opus\/48000/i);
  if (!match) return rawSdp;
  const pt = match[1];
  const hdParams = 'minptime=10;ptime=20;useinbandfec=1;maxaveragebitrate=96000;stereo=0;sprop-stereo=0;cbr=0;maxplaybackrate=48000;sprop-maxcapturerate=48000;usedtx=0';
  if (rawSdp.includes(`a=fmtp:${pt}`)) {
    return rawSdp.replace(new RegExp(`a=fmtp:${pt}\\s+.*`), `a=fmtp:${pt} ${hdParams}`);
  } else {
    return rawSdp.replace(
      new RegExp(`(a=rtpmap:${pt}\\s+opus\\/48000\\/2\r?\n)`, 'i'),
      `$1a=fmtp:${pt} ${hdParams}\r\n`
    );
  }
}

export class LiveRoomAudioMesh {
  private roomId: string;
  private currentUserId: string;
  private localStream: MediaStream | null = null;
  private peerConnections: Map<string, RTCPeerConnection> = new Map();
  private remoteAudioElements: Map<string, HTMLAudioElement> = new Map();
  private remoteStreams: Map<string, MediaStream> = new Map();
  private isSeated: boolean = false;
  private broadcastChannel: BroadcastChannel | null = null;
  private pollInterval: any = null;
  private onRemoteStreamsChanged?: (speakers: Map<string, MediaStream>) => void;
  private isDestroyed: boolean = false;

  constructor(
    roomId: string,
    currentUserId: string,
    onRemoteStreamsChanged?: (speakers: Map<string, MediaStream>) => void
  ) {
    this.roomId = roomId;
    this.currentUserId = currentUserId;
    this.onRemoteStreamsChanged = onRemoteStreamsChanged;

    this.initSignaling();
  }

  private initSignaling() {
    // 1. Instant 0ms Cross-Tab Broadcast Channel
    if (typeof window !== 'undefined' && (window as any).BroadcastChannel) {
      try {
        this.broadcastChannel = new BroadcastChannel(`live_room_mesh_${this.roomId}`);
        this.broadcastChannel.onmessage = (event) => {
          if (this.isDestroyed || !event.data) return;
          this.handleIncomingSignal(event.data);
        };
      } catch (e) {
        // BroadcastChannel unavailable
      }
    }

    // 2. Server Signaling Polling for cross-device peers (1.5s interval)
    this.pollInterval = setInterval(async () => {
      if (this.isDestroyed) return;
      try {
        const res = await fetch('/api/live/rooms/signals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roomId: this.roomId,
            targetId: this.currentUserId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.signals) && data.signals.length > 0) {
            for (const sig of data.signals) {
              await this.handleIncomingSignal(sig);
            }
          }
        }
      } catch (e) {
        // transient network poll fail
      }
    }, 1500);
  }

  private async sendSignal(signal: {
    targetId: string;
    type: 'offer' | 'answer' | 'candidate';
    sdp?: RTCSessionDescriptionInit;
    candidate?: RTCIceCandidateInit;
  }) {
    const payload = {
      ...signal,
      roomId: this.roomId,
      senderId: this.currentUserId,
    };

    // 1. Cross-tab Broadcast
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(payload);
      } catch {}
    }

    // 2. Server Relay for cross-device
    try {
      await fetch('/api/live/rooms/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {}
  }

  /**
   * Set local microphone stream when user takes a seat
   */
  public async setLocalMicrophone(stream: MediaStream | null, isSeated: boolean) {
    this.localStream = stream;
    this.isSeated = isSeated;

    // If seated with mic, update all existing peer connections or renegotiate
    for (const [peerId, pc] of this.peerConnections.entries()) {
      const senders = pc.getSenders();
      const audioSender = senders.find((s) => s.track && s.track.kind === 'audio');

      if (stream && stream.getAudioTracks().length > 0) {
        const localTrack = stream.getAudioTracks()[0];
        if (audioSender) {
          audioSender.replaceTrack(localTrack).catch(() => {});
        } else {
          try {
            pc.addTrack(localTrack, stream);
          } catch {}
        }
      } else if (audioSender) {
        audioSender.replaceTrack(null).catch(() => {});
      }
    }
  }

  /**
   * Announce presence or initiate call with all other seated speakers in the room
   */
  public async connectToPeer(targetUserId: string) {
    if (targetUserId === this.currentUserId) return;
    if (this.peerConnections.has(targetUserId)) return;

    const pc = this.createPeerConnection(targetUserId);
    this.peerConnections.set(targetUserId, pc);

    // If we are seated and have local audio, add track before creating offer
    if (this.localStream && this.isSeated) {
      this.localStream.getAudioTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    try {
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
      });
      const enhancedSdp = enhanceOpusSDP(offer.sdp || '');
      const enhancedOffer = new RTCSessionDescription({
        type: offer.type,
        sdp: enhancedSdp,
      });
      await pc.setLocalDescription(enhancedOffer);
      await this.sendSignal({
        targetId: targetUserId,
        type: 'offer',
        sdp: pc.localDescription!,
      });
    } catch (e) {
      console.warn('Failed to initiate live audio offer:', e);
    }
  }

  private createPeerConnection(targetUserId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    // Send ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignal({
          targetId: targetUserId,
          type: 'candidate',
          candidate: event.candidate.toJSON(),
        });
      }
    };

    // Receive remote audio track
    pc.ontrack = (event) => {
      if (event.track.kind === 'audio') {
        const stream = event.streams[0] || new MediaStream([event.track]);
        this.remoteStreams.set(targetUserId, stream);

        // Attach to audio element for real audio output
        let audioEl = this.remoteAudioElements.get(targetUserId);
        if (!audioEl) {
          audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          document.body.appendChild(audioEl);
          this.remoteAudioElements.set(targetUserId, audioEl);
        }
        audioEl.srcObject = stream;
        audioEl.play().catch((err) => {
          console.warn('AutoPlay notice for remote live audio:', err);
        });

        this.onRemoteStreamsChanged?.(this.remoteStreams);
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.removePeer(targetUserId);
      }
    };

    return pc;
  }

  public async handleIncomingSignal(signal: any) {
    if (signal.roomId !== this.roomId || signal.senderId === this.currentUserId) return;
    if (signal.targetId && signal.targetId !== this.currentUserId) return;

    const senderId = signal.senderId;
    if (!senderId) return;

    try {
      if (signal.type === 'offer' && signal.sdp) {
        let pc = this.peerConnections.get(senderId);
        if (!pc) {
          pc = this.createPeerConnection(senderId);
          this.peerConnections.set(senderId, pc);
        }

        // Add our local track if seated
        if (this.localStream && this.isSeated) {
          const senders = pc.getSenders();
          if (!senders.some((s) => s.track && s.track.kind === 'audio')) {
            this.localStream.getAudioTracks().forEach((track) => {
              pc.addTrack(track, this.localStream!);
            });
          }
        }

        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        const enhancedSdp = enhanceOpusSDP(answer.sdp || '');
        const enhancedAnswer = new RTCSessionDescription({
          type: answer.type,
          sdp: enhancedSdp,
        });
        await pc.setLocalDescription(enhancedAnswer);

        await this.sendSignal({
          targetId: senderId,
          type: 'answer',
          sdp: pc.localDescription!,
        });
      } else if (signal.type === 'answer' && signal.sdp) {
        const pc = this.peerConnections.get(senderId);
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        }
      } else if (signal.type === 'candidate' && signal.candidate) {
        const pc = this.peerConnections.get(senderId);
        if (pc && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
          } catch {}
        }
      }
    } catch (err: any) {
      console.warn('Live room audio signaling notice:', err.message);
    }
  }

  public removePeer(userId: string) {
    const pc = this.peerConnections.get(userId);
    if (pc) {
      try {
        pc.close();
      } catch {}
      this.peerConnections.delete(userId);
    }

    const audioEl = this.remoteAudioElements.get(userId);
    if (audioEl) {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
      this.remoteAudioElements.delete(userId);
    }

    this.remoteStreams.delete(userId);
    this.onRemoteStreamsChanged?.(this.remoteStreams);
  }

  /**
   * Sync active speakers in the room
   */
  public syncSpeakers(speakerUserIds: string[]) {
    // Connect to any new seated speakers
    speakerUserIds.forEach((uid) => {
      if (uid !== this.currentUserId && !this.peerConnections.has(uid)) {
        this.connectToPeer(uid);
      }
    });

    // Disconnect peers who left their seats
    for (const peerId of this.peerConnections.keys()) {
      if (!speakerUserIds.includes(peerId) && !this.isSeated) {
        this.removePeer(peerId);
      }
    }
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {}
      this.broadcastChannel = null;
    }

    for (const [_, pc] of this.peerConnections.entries()) {
      try {
        pc.close();
      } catch {}
    }
    this.peerConnections.clear();

    for (const [_, audioEl] of this.remoteAudioElements.entries()) {
      try {
        audioEl.srcObject = null;
        audioEl.remove();
      } catch {}
    }
    this.remoteAudioElements.clear();
    this.remoteStreams.clear();
  }
}
