/**
 * Bespoke luxury startup chime for OLauncher 4K.
 * Pure Web Audio API synthesis: zero disk I/O, zero network delay, zero CPU overhead.
 * Produces an ascending crystal glass D-major-9th harmonic arpeggio with celestial sparkle.
 */
export class AudioChime {
  /**
   * @param {{ enabled?: boolean }} [options]
   */
  constructor({ enabled = true } = {}) {
    this._enabled = enabled;
    this._ctx = null;
  }

  /**
   * Plays the bespoke ascending crystal startup chime.
   */
  play() {
    if (!this._enabled) return;

    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      if (!this._ctx || this._ctx.state === 'closed') {
        this._ctx = new AudioContextClass();
      }

      if (this._ctx.state === 'suspended') {
        this._ctx.resume().catch(() => {});
      }

      const ctx = this._ctx;
      const now = ctx.currentTime;

      // Master output bus with smooth exponential fade-out
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.0001, now);
      masterGain.gain.linearRampToValueAtTime(0.38, now + 0.04);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.8);
      masterGain.connect(ctx.destination);

      // 1. Warm cinematic foundation tone (D3 - 146.83 Hz)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(146.83, now);
      subGain.gain.setValueAtTime(0.0001, now);
      subGain.gain.linearRampToValueAtTime(0.32, now + 0.08);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.4);
      subOsc.connect(subGain);
      subGain.connect(masterGain);
      subOsc.start(now);
      subOsc.stop(now + 2.5);

      // 2. Ascending luxury crystal chime arpeggio:
      // D4 (0.00s) -> F#4 (0.10s) -> A4 (0.22s) -> E5 (0.35s) -> A5 (0.48s) + A6 (0.50s celestial sparkle)
      const notes = [
        { time: 0.00, freq: 293.66, type: 'sine', weight: 0.42, decay: 2.2 }, // D4
        { time: 0.10, freq: 369.99, type: 'sine', weight: 0.38, decay: 2.2 }, // F#4
        { time: 0.22, freq: 440.00, type: 'sine', weight: 0.34, decay: 2.3 }, // A4
        { time: 0.35, freq: 659.25, type: 'sine', weight: 0.30, decay: 2.4 }, // E5
        { time: 0.48, freq: 880.00, type: 'triangle', weight: 0.26, decay: 2.5 }, // A5
        { time: 0.50, freq: 1760.0, type: 'sine', weight: 0.10, decay: 1.8 }  // A6 sparkle
      ];

      notes.forEach((n, idx) => {
        const start = now + n.time;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, start);

        // Subtle harmonic detuning for acoustic warmth
        const detuneCents = (idx % 2 === 0 ? 1 : -1) * (2.0 + idx * 0.7);
        osc.detune.setValueAtTime(detuneCents, start);

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.linearRampToValueAtTime(n.weight, start + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + n.decay);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(start);
        osc.stop(start + n.decay + 0.1);
      });
    } catch (_) {}
  }

  /**
   * Releases Web Audio resources cleanly.
   */
  destroy() {
    if (this._ctx && typeof this._ctx.close === 'function') {
      try {
        this._ctx.close();
      } catch (_) {}
      this._ctx = null;
    }
  }
}
