/**
 * AudioManager - Retro 8-bit sound effects for Tellor Defense
 * Uses Web Audio API oscillators only (no audio files required).
 */
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if it was suspended (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  /**
   * Short high-frequency blip for shooting.
   * 800Hz square wave, 0.05s, quick decay.
   */
  playShoot() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;

    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.05);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /**
   * Low rumble explosion sound.
   * 150Hz sawtooth with noise-like quality, 0.2s, rapid decay.
   */
  playExplosion() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;

    // Low rumble oscillator
    var osc1 = this.ctx.createOscillator();
    var gain1 = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(150, now);
    osc1.frequency.exponentialRampToValueAtTime(40, now + 0.2);

    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.2);

    // Add a second higher harmonic for crunch
    var osc2 = this.ctx.createOscillator();
    var gain2 = this.ctx.createGain();

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(300, now);
    osc2.frequency.exponentialRampToValueAtTime(60, now + 0.15);

    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.15);
  }

  /**
   * Quick high-pitched ping for hitting a valid target.
   * 1200Hz sine, 0.08s.
   */
  playHit() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;

    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.08);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  /**
   * Penalty/error buzzer for hitting wrong target.
   * 200Hz square wave, 0.15s, buzzy and unpleasant.
   */
  playBadHit() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;

    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(200, now);
    osc.frequency.setValueAtTime(180, now + 0.05);
    osc.frequency.setValueAtTime(200, now + 0.1);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);

    // Second detuned oscillator for dissonance
    var osc2 = this.ctx.createOscillator();
    var gain2 = this.ctx.createGain();

    osc2.type = 'sawtooth';
    osc2.frequency.setValueAtTime(210, now);

    gain2.gain.setValueAtTime(0.15, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.12);
  }

  /**
   * Wave start fanfare: ascending 3-tone arpeggio.
   * 400 -> 600 -> 800Hz, 0.1s each, sine wave.
   */
  playWaveStart() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;
    var tones = [400, 600, 800];

    for (var i = 0; i < tones.length; i++) {
      var startTime = now + i * 0.1;
      var osc = this.ctx.createOscillator();
      var gain = this.ctx.createGain();

      osc.type = 'square';
      osc.frequency.setValueAtTime(tones[i], startTime);

      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueAtTime(0.2, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.09);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.1);
    }
  }

  /**
   * Game over: descending frequency sweep with buzz.
   * 400 -> 100Hz sweep over 0.5s.
   */
  playGameOver() {
    if (this.muted || !this.ctx) return;
    var now = this.ctx.currentTime;

    // Main descending sweep
    var osc1 = this.ctx.createOscillator();
    var gain1 = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(400, now);
    osc1.frequency.exponentialRampToValueAtTime(100, now + 0.5);

    gain1.gain.setValueAtTime(0.25, now);
    gain1.gain.setValueAtTime(0.25, now + 0.3);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second voice for thickness
    var osc2 = this.ctx.createOscillator();
    var gain2 = this.ctx.createGain();

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(398, now);
    osc2.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    gain2.gain.setValueAtTime(0.12, now);
    gain2.gain.setValueAtTime(0.12, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.5);

    // Final low thud
    var osc3 = this.ctx.createOscillator();
    var gain3 = this.ctx.createGain();

    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(80, now + 0.45);
    osc3.frequency.exponentialRampToValueAtTime(40, now + 0.7);

    gain3.gain.setValueAtTime(0, now);
    gain3.gain.setValueAtTime(0.3, now + 0.45);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

    osc3.connect(gain3);
    gain3.connect(this.ctx.destination);
    osc3.start(now + 0.45);
    osc3.stop(now + 0.7);
  }

  /**
   * General-purpose tone helper for simple one-shot sounds.
   * @param {number} freq - Frequency in Hz
   * @param {string} type - Oscillator type: 'sine', 'square', 'sawtooth', 'triangle'
   * @param {number} duration - Duration in seconds
   * @param {number} volume - Starting volume (0-1), default 0.3
   */
  _playTone(freq, type, duration, volume) {
    if (this.muted || !this.ctx) return;
    if (volume === undefined) volume = 0.3;

    var now = this.ctx.currentTime;
    var osc = this.ctx.createOscillator();
    var gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + duration);
  }
}

window.AudioManager = AudioManager;
