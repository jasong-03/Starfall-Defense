/**
 * MusicEngine - Procedural chiptune music for Starfall Defense
 * Pure Web Audio API — no audio files needed.
 *
 * Tracks:
 *   title    — atmospheric synthwave pad (mysterious, space)
 *   gameplay — fast-paced chiptune action loop
 *   gameover — somber descending melody
 */
class MusicEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.volume = 0.35;
    this.playing = false;
    this.currentTrack = null;
    this._nodes = [];       // active oscillators/gains for cleanup
    this._timers = [];      // scheduled intervals
    this._stepIndex = 0;
  }

  init(audioCtx) {
    this.ctx = audioCtx;
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.volume;
    this.masterGain.connect(this.ctx.destination);
  }

  setVolume(v) {
    this.volume = v;
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  stop() {
    this._timers.forEach(function(t) { clearInterval(t); });
    this._timers = [];
    this._nodes.forEach(function(n) {
      try { n.stop(); } catch(e) {}
      try { n.disconnect(); } catch(e) {}
    });
    this._nodes = [];
    this.playing = false;
    this.currentTrack = null;
    this._stepIndex = 0;
  }

  play(track) {
    if (this.currentTrack === track && this.playing) return;
    this.stop();
    this.currentTrack = track;
    this.playing = true;

    switch (track) {
      case 'title':    this._playTitle(); break;
      case 'gameplay': this._playGameplay(); break;
      case 'gameover': this._playGameover(); break;
    }
  }

  // --- HELPER: create oscillator routed through master ---

  _osc(type, freq) {
    var osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    this._nodes.push(osc);
    return osc;
  }

  _gain(vol) {
    var g = this.ctx.createGain();
    g.gain.value = vol;
    g.connect(this.masterGain);
    return g;
  }

  _filter(type, freq) {
    var f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = 2;
    return f;
  }

  // ==========================================================
  //  TITLE SCREEN — dreamy synthwave pad + slow arpeggio
  // ==========================================================

  _playTitle() {
    var self = this;
    var ctx = this.ctx;

    // Pad chord: Am (A2, C3, E3) with slow filter sweep
    var padFreqs = [110, 130.81, 164.81];
    var padGain = this._gain(0);
    var padFilter = this._filter('lowpass', 300);
    padFilter.connect(padGain);

    // Fade in pad
    padGain.gain.setValueAtTime(0, ctx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 2);

    padFreqs.forEach(function(f) {
      var o1 = self._osc('sawtooth', f);
      var o2 = self._osc('sawtooth', f * 1.003); // slight detune for width
      o1.connect(padFilter);
      o2.connect(padFilter);
      o1.start();
      o2.start();
    });

    // Slow filter sweep
    var sweepUp = true;
    var filterTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var target = sweepUp ? 800 : 250;
      padFilter.frequency.linearRampToValueAtTime(target, now + 4);
      sweepUp = !sweepUp;
    }, 4000);
    this._timers.push(filterTimer);

    // Slow arpeggio melody (triangle wave)
    // A minor pentatonic ascending
    var arpNotes = [220, 261.63, 329.63, 392, 440, 523.25, 440, 392, 329.63, 261.63];
    var arpIndex = 0;
    var arpGain = this._gain(0.08);
    var arpFilter2 = this._filter('lowpass', 1200);
    arpFilter2.connect(arpGain);

    var arpTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var freq = arpNotes[arpIndex % arpNotes.length];
      arpIndex++;

      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
      o.connect(g);
      g.connect(arpFilter2);
      o.start(now);
      o.stop(now + 0.55);
    }, 600);
    this._timers.push(arpTimer);

    // Sub bass pulse
    var bassGain = this._gain(0.1);
    var bassNotes = [55, 55, 65.41, 55]; // A1, A1, C2, A1
    var bassIndex = 0;

    var bassTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var freq = bassNotes[bassIndex % bassNotes.length];
      bassIndex++;

      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.15, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      o.connect(g);
      g.connect(bassGain);
      o.start(now);
      o.stop(now + 2);
    }, 2400);
    this._timers.push(bassTimer);
  }

  // ==========================================================
  //  GAMEPLAY — fast chiptune action loop
  // ==========================================================

  _playGameplay() {
    var self = this;
    var ctx = this.ctx;
    var bpm = 150;
    var step = 60 / bpm / 4;  // 16th note duration
    this._stepIndex = 0;

    // --- Bass line (square wave) ---
    // Pattern: E2-E2-G2-A2 | E2-E2-B2-A2 (each note = 2 steps)
    var bassPattern = [
      82.41, 82.41, 82.41, 82.41, 98, 98, 110, 110,
      82.41, 82.41, 82.41, 82.41, 123.47, 123.47, 110, 110,
    ];

    var bassGain = this._gain(0.12);
    var bassFilter = this._filter('lowpass', 600);
    bassFilter.connect(bassGain);

    // --- Melody (square wave, main riff) ---
    // Notes in E minor pentatonic
    var melodyPattern = [
      659, 0, 784, 0, 659, 0, 587, 0, 523, 0, 587, 659, 0, 0, 523, 0,
      659, 0, 784, 0, 880, 0, 784, 0, 659, 0, 523, 587, 0, 0, 659, 0,
    ];

    var melGain = this._gain(0.07);
    var melFilter = this._filter('lowpass', 2000);
    melFilter.connect(melGain);

    // --- Hi-hat (noise burst) ---
    var hatPattern = [
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1,
      1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0,
    ];

    var hatGain = this._gain(0.04);

    // --- Kick (sine burst) ---
    var kickPattern = [
      1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0,
      1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0,
    ];

    var kickGain = this._gain(0.15);

    // --- Arpeggio layer (triangle, adds texture) ---
    var arpChords = [
      [329.63, 392, 493.88],  // Em
      [261.63, 329.63, 392],  // C
      [293.66, 349.23, 440],  // Dm
      [329.63, 392, 493.88],  // Em
    ];
    var arpGain = this._gain(0.04);

    // Sequencer
    var patLen = 32;

    var seqTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var i = self._stepIndex % patLen;
      self._stepIndex++;

      // Bass
      var bassFreq = bassPattern[i % bassPattern.length];
      if (bassFreq > 0) {
        var bo = ctx.createOscillator();
        var bg = ctx.createGain();
        bo.type = 'square';
        bo.frequency.value = bassFreq;
        bg.gain.setValueAtTime(0.18, now);
        bg.gain.exponentialRampToValueAtTime(0.001, now + step * 1.8);
        bo.connect(bg);
        bg.connect(bassFilter);
        bo.start(now);
        bo.stop(now + step * 2);
      }

      // Melody
      var melFreq = melodyPattern[i % melodyPattern.length];
      if (melFreq > 0) {
        var mo = ctx.createOscillator();
        var mg = ctx.createGain();
        mo.type = 'square';
        mo.frequency.value = melFreq;
        // Pulse width modulation emulation via two detuned squares
        var mo2 = ctx.createOscillator();
        mo2.type = 'square';
        mo2.frequency.value = melFreq * 1.005;
        mg.gain.setValueAtTime(0.1, now);
        mg.gain.exponentialRampToValueAtTime(0.001, now + step * 1.5);
        mo.connect(mg);
        mo2.connect(mg);
        mg.connect(melFilter);
        mo.start(now);
        mo2.start(now);
        mo.stop(now + step * 1.6);
        mo2.stop(now + step * 1.6);
      }

      // Hi-hat (filtered noise via high-freq oscillator)
      if (hatPattern[i % hatPattern.length]) {
        var ho = ctx.createOscillator();
        var hg = ctx.createGain();
        ho.type = 'square';
        ho.frequency.value = 8000 + Math.random() * 4000;
        hg.gain.setValueAtTime(0.06, now);
        hg.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
        ho.connect(hg);
        hg.connect(hatGain);
        ho.start(now);
        ho.stop(now + 0.04);
      }

      // Kick
      if (kickPattern[i % kickPattern.length]) {
        var ko = ctx.createOscillator();
        var kg = ctx.createGain();
        ko.type = 'sine';
        ko.frequency.setValueAtTime(160, now);
        ko.frequency.exponentialRampToValueAtTime(40, now + 0.12);
        kg.gain.setValueAtTime(0.25, now);
        kg.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
        ko.connect(kg);
        kg.connect(kickGain);
        ko.start(now);
        ko.stop(now + 0.16);
      }

      // Arpeggio (every 8 steps = half bar)
      if (i % 4 === 0) {
        var chordIdx = Math.floor(i / 8) % arpChords.length;
        var chord = arpChords[chordIdx];
        var noteIdx = Math.floor(i / 4) % 3;
        var ao = ctx.createOscillator();
        var ag = ctx.createGain();
        ao.type = 'triangle';
        ao.frequency.value = chord[noteIdx];
        ag.gain.setValueAtTime(0.06, now);
        ag.gain.exponentialRampToValueAtTime(0.001, now + step * 3);
        ao.connect(ag);
        ag.connect(arpGain);
        ao.start(now);
        ao.stop(now + step * 3.5);
      }

    }, step * 1000);
    this._timers.push(seqTimer);
  }

  // ==========================================================
  //  GAME OVER — somber descending melody + pad
  // ==========================================================

  _playGameover() {
    var self = this;
    var ctx = this.ctx;

    // Dark pad: D minor (D2, F2, A2)
    var padGain = this._gain(0);
    var padFilter = this._filter('lowpass', 400);
    padFilter.connect(padGain);

    padGain.gain.setValueAtTime(0, ctx.currentTime);
    padGain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 1.5);

    var padFreqs = [73.42, 87.31, 110];
    padFreqs.forEach(function(f) {
      var o1 = self._osc('sawtooth', f);
      var o2 = self._osc('sawtooth', f * 0.998);
      o1.connect(padFilter);
      o2.connect(padFilter);
      o1.start();
      o2.start();
    });

    // Slow descending melody
    var melNotes = [440, 392, 349.23, 329.63, 293.66, 261.63, 220, 0, 0, 0];
    var melIndex = 0;
    var melGain = this._gain(0.06);

    var melTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var freq = melNotes[melIndex % melNotes.length];
      melIndex++;

      if (freq > 0) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.1, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        o.connect(g);
        g.connect(melGain);
        o.start(now);
        o.stop(now + 1.3);
      }
    }, 1400);
    this._timers.push(melTimer);

    // Slow heartbeat bass
    var bassGain = this._gain(0.12);
    var beatTimer = setInterval(function() {
      if (!self.playing) return;
      var now = ctx.currentTime;
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(55, now);
      o.frequency.exponentialRampToValueAtTime(36.71, now + 0.8);
      g.gain.setValueAtTime(0.2, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
      o.connect(g);
      g.connect(bassGain);
      o.start(now);
      o.stop(now + 1);
    }, 2000);
    this._timers.push(beatTimer);
  }
}

window.MusicEngine = MusicEngine;
