// Web Audio API Ringtone & Audio Tone Synthesizer
// Provides realistic calling feedback without external media dependencies

class AudioToneService {
  private ctx: AudioContext | null = null;
  private currentInterval: any = null;
  private activeOscillators: OscillatorNode[] = [];

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play outgoing ringback tone (standard 440Hz + 480Hz dual tone cadence)
  startRingbackTone() {
    this.stop();
    try {
      const ctx = this.getContext();
      
      const playBurst = () => {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const now = ctx.currentTime;
        
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gainNode = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(480, now);

        gainNode.gain.setValueAtTime(0.001, now);
        gainNode.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
        gainNode.gain.setValueAtTime(0.12, now + 1.8);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 2.0);

        osc1.connect(gainNode);
        osc2.connect(gainNode);
        gainNode.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 2.0);
        osc2.stop(now + 2.0);

        this.activeOscillators.push(osc1, osc2);
      };

      playBurst();
      this.currentInterval = setInterval(playBurst, 4000);
    } catch (e) {
      console.warn('Unable to play ringback tone:', e);
    }
  }

  // Play incoming ringtone (pleasant ascending melodic chime sequence)
  startIncomingRingtone() {
    this.stop();
    try {
      const ctx = this.getContext();

      const playMelody = () => {
        if (!this.ctx || this.ctx.state === 'closed') return;
        const notes = [
          { f: 523.25, d: 0.18 }, // C5
          { f: 659.25, d: 0.18 }, // E5
          { f: 783.99, d: 0.18 }, // G5
          { f: 1046.50, d: 0.35 }, // C6
          { f: 783.99, d: 0.18 }, // G5
          { f: 1046.50, d: 0.45 }, // C6
        ];

        let timeOffset = ctx.currentTime;

        notes.forEach((note) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(note.f, timeOffset);

          gain.gain.setValueAtTime(0.001, timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.2, timeOffset + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, timeOffset + note.d);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(timeOffset);
          osc.stop(timeOffset + note.d);
          this.activeOscillators.push(osc);

          timeOffset += note.d + 0.05;
        });
      };

      playMelody();
      this.currentInterval = setInterval(playMelody, 2800);
    } catch (e) {
      console.warn('Unable to play incoming ringtone:', e);
    }
  }

  // Call connected affirmative sound
  playConnectedSound() {
    this.stop();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [
        { f: 587.33, t: 0 },    // D5
        { f: 880.00, t: 0.12 },  // A5
      ].forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.15, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.2);
      });
    } catch (e) {
      // ignore
    }
  }

  // Play gentle message notification chime
  playMessageNotificationSound() {
    try {
      const isEnabled = localStorage.getItem('liveconnect_perm_msg_sound') !== 'false';
      if (!isEnabled) return;

      const ctx = this.getContext();
      const now = ctx.currentTime;

      [
        { f: 880.00, t: 0 },    // A5
        { f: 1174.66, t: 0.08 }, // D6
      ].forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.08, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.22);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.22);
      });
    } catch (e) {
      // ignore
    }
  }

  // Call ended / rejected sound
  playCallEndedSound() {
    this.stop();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      [
        { f: 440, t: 0 },
        { f: 330, t: 0.15 },
        { f: 220, t: 0.3 },
      ].forEach((n) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);
        gain.gain.setValueAtTime(0.12, now + n.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.t + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.t);
        osc.stop(now + n.t + 0.15);
      });
    } catch (e) {
      // ignore
    }
  }

  stop() {
    if (this.currentInterval) {
      clearInterval(this.currentInterval);
      this.currentInterval = null;
    }
    this.activeOscillators.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // ignore
      }
    });
    this.activeOscillators = [];
  }
}

export const audioTones = new AudioToneService();
