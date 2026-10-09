// Web Audio API Synthesizer for notifications and call ringtones

class SoundManager {
  private ctx: AudioContext | null = null;
  private ringInterval: NodeJS.Timeout | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play subtle Slack-like message chime
  playMessageSound() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // Note 1 (High chime)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12); // E6

      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2 (Harmonic decay)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1760, now + 0.05); // A6

      gain2.gain.setValueAtTime(0.08, now + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.05);
      osc2.stop(now + 0.3);
    } catch (err) {
      // Audio playback might be restricted before user gesture
    }
  }

  // Start continuous incoming call ring
  startCallRing() {
    this.stopCallRing();
    this.playCallPulse();
    this.ringInterval = setInterval(() => {
      this.playCallPulse();
    }, 2500);
  }

  // Stop incoming call ring
  stopCallRing() {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
  }

  private playCallPulse() {
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;

      // First beep
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now); // C5
      osc1.frequency.setValueAtTime(659.25, now + 0.15); // E5

      gain1.gain.setValueAtTime(0.2, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.4);

      // Second beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.45); // E5
      osc2.frequency.setValueAtTime(783.99, now + 0.6); // G5

      gain2.gain.setValueAtTime(0.2, now + 0.45);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.85);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.45);
      osc2.stop(now + 0.85);
    } catch (err) {}
  }
}

export const sounds = new SoundManager();
