/** Simple audio manager for game sound effects */

type SoundName = 'roundStart' | 'elimination' | 'gameEnd';

class AudioManager {
  private muted = true; // Default muted
  private ctx: AudioContext | null = null;

  constructor() {
    // Respect user preference
    const saved = localStorage.getItem('svs_audio_muted');
    this.muted = saved !== 'false'; // Default muted unless explicitly unmuted
  }

  private getContext(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    return this.ctx;
  }

  /** Play a short synthesized beep/tone */
  play(sound: SoundName): void {
    if (this.muted) return;
    try {
      const ctx = this.getContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      switch (sound) {
        case 'roundStart':
          osc.frequency.value = 440;
          gain.gain.value = 0.1;
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
          break;
        case 'elimination':
          osc.frequency.value = 220;
          osc.type = 'sawtooth';
          gain.gain.value = 0.08;
          osc.start();
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.3);
          break;
        case 'gameEnd':
          osc.frequency.value = 523;
          gain.gain.value = 0.1;
          osc.start();
          osc.frequency.setValueAtTime(659, ctx.currentTime + 0.15);
          osc.frequency.setValueAtTime(784, ctx.currentTime + 0.3);
          osc.stop(ctx.currentTime + 0.5);
          break;
      }
    } catch {
      // Audio not available
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  toggle(): boolean {
    this.muted = !this.muted;
    localStorage.setItem('svs_audio_muted', String(this.muted));
    return this.muted;
  }
}

export const audio = new AudioManager();
