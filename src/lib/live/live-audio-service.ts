/**
 * Live Room Audio & Sound FX Synthesizer
 * Provides Web Audio API sound effects for gifts, seat events, games,
 * microphone capture with voice activity detection (VAD), and local music playback.
 */

class LiveAudioService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private vibrationEnabled: boolean = true;
  private localStream: MediaStream | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private vadInterval: any = null;
  private localMusicAudio: HTMLAudioElement | null = null;

  constructor() {
    // Load preferences from localStorage if available
    if (typeof window !== 'undefined') {
      try {
        const soundPref = localStorage.getItem('live_sound_enabled');
        if (soundPref !== null) this.soundEnabled = soundPref === 'true';
        const vibPref = localStorage.getItem('live_vibration_enabled');
        if (vibPref !== null) this.vibrationEnabled = vibPref === 'true';
      } catch (e) {
        // ignore
      }
    }
  }

  public getSoundEnabled(): boolean {
    return this.soundEnabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    try {
      localStorage.setItem('live_sound_enabled', String(enabled));
    } catch {}
  }

  public getVibrationEnabled(): boolean {
    return this.vibrationEnabled;
  }

  public setVibrationEnabled(enabled: boolean) {
    this.vibrationEnabled = enabled;
    try {
      localStorage.setItem('live_vibration_enabled', String(enabled));
    } catch {}
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  /**
   * Haptic vibration
   */
  public triggerHaptic(pattern: number[] = [15, 30, 15]) {
    if (!this.vibrationEnabled) return;
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {
        // ignore
      }
    }
  }

  /**
   * Synthesize gift sound effects dynamically
   */
  public playGiftSound(animationType: string) {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.2, now);
      masterGain.connect(ctx.destination);

      if (animationType === 'rocket') {
        // Rocket ascending whoosh + explosion chime
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(120, now);
        osc.frequency.exponentialRampToValueAtTime(1400, now + 0.7);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(now);
        osc.stop(now + 1.2);
      } else if (animationType === 'crown' || animationType === 'unicorn') {
        // Royal fanfare / magical arpeggio
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.51];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);
          gain.gain.setValueAtTime(0.2, now + idx * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.5);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 0.5);
        });
      } else if (animationType === 'rose' || animationType === 'heart' || animationType === 'butterfly') {
        // Romantic soft bell chord
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.05);
          gain.gain.setValueAtTime(0.18, now + idx * 0.05);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(now + idx * 0.05);
          osc.stop(now + 0.95);
        });
      } else if (animationType === 'party') {
        // Confetti party pop & bouncy chime
        const popOsc = ctx.createOscillator();
        const popGain = ctx.createGain();
        popOsc.type = 'sine';
        popOsc.frequency.setValueAtTime(280, now);
        popOsc.frequency.exponentialRampToValueAtTime(60, now + 0.15);
        popGain.gain.setValueAtTime(0.3, now);
        popGain.gain.linearRampToValueAtTime(0.01, now + 0.18);
        popOsc.connect(popGain);
        popGain.connect(masterGain);
        popOsc.start(now);
        popOsc.stop(now + 0.2);

        // celebratory triple chime
        [659.25, 880, 1174.66].forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.setValueAtTime(f, now + 0.15 + i * 0.09);
          g.gain.setValueAtTime(0.2, now + 0.15 + i * 0.09);
          g.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
          o.connect(g);
          g.connect(masterGain);
          o.start(now + 0.15 + i * 0.09);
          o.stop(now + 0.75);
        });
      } else {
        // Cute cheerful bounce (Teddy, Panda, Star, Cake, etc.)
        [587.33, 739.99, 880, 1108.73].forEach((f, i) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine';
          o.frequency.setValueAtTime(f, now + i * 0.07);
          g.gain.setValueAtTime(0.18, now + i * 0.07);
          g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.35);
          o.connect(g);
          g.connect(masterGain);
          o.start(now + i * 0.07);
          o.stop(now + i * 0.07 + 0.4);
        });
      }
    } catch (e) {
      console.warn('Audio synthesis error:', e);
    }
  }

  /**
   * Sound effect for seating, joining, game answers
   */
  public playUiTone(type: 'join' | 'leave' | 'correct' | 'wrong' | 'click') {
    if (!this.soundEnabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'join') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'leave') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.12);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.16);
      } else if (type === 'correct') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.36);
      } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.linearRampToValueAtTime(160, now + 0.2);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.linearRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.26);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0.001, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.06);
      }
    } catch {}
  }

  /**
   * Capture Voice Seat Microphone and detect speaking activity
   */
  public async startMicrophone(onSpeakingChanged?: (isSpeaking: boolean) => void): Promise<MediaStream | null> {
    if (this.localStream) return this.localStream;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      this.localStream = stream;

      const ctx = this.getAudioContext();
      if (ctx) {
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        this.micAnalyser = analyser;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let speakingCount = 0;
        let wasSpeaking = false;

        this.vadInterval = setInterval(() => {
          if (!this.micAnalyser) return;
          this.micAnalyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          // Threshold for human speech
          if (avg > 25) {
            speakingCount = Math.min(speakingCount + 1, 5);
          } else {
            speakingCount = Math.max(speakingCount - 1, 0);
          }
          const isSpeakingNow = speakingCount >= 2;
          if (isSpeakingNow !== wasSpeaking) {
            wasSpeaking = isSpeakingNow;
            onSpeakingChanged?.(isSpeakingNow);
          }
        }, 120);
      }

      return stream;
    } catch (err) {
      console.warn('Microphone access for voice seat could not be initialized:', err);
      return null;
    }
  }

  public setMicrophoneMuted(muted: boolean) {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public stopMicrophone() {
    if (this.vadInterval) {
      clearInterval(this.vadInterval);
      this.vadInterval = null;
    }
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    this.micAnalyser = null;
  }
}

export const liveAudioService = new LiveAudioService();
