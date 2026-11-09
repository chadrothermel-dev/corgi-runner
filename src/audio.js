// Synthesized sound effects and a light background loop via the Web Audio API.
// No audio files needed. Every call is logged to playedSounds (the tests read it).

const MUTE_KEY = 'corgi_runner_muted';

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 32-step melody (eighth notes) over C - G - Am - F, plus bass roots per bar.
const MELODY = [
  72, null, 76, 79, 77, 76, 74, null, 71, 74, 79, 74, 71, null, 67, null,
  69, null, 72, 76, 74, 72, 69, null, 72, 71, 69, 65, 69, null, 72, null
];
const BASS = [48, 43, 45, 41];

export const AudioSystem = {
  playedSounds: [],
  muted: false,
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  musicTimer: null,
  musicStep: 0,
  nextNoteTime: 0,
  musicWanted: false,
  _noise: null,
  _loadedPref: false,

  play(soundName) {
    this.playedSounds.push({
      soundName,
      timestamp: Date.now()
    });
    this._loadPref();
    if (this.muted) return;
    try {
      this._synth(soundName);
    } catch (e) {
      // Ignore audio environment restrictions
    }
  },

  getAudioLog() {
    return [...this.playedSounds];
  },

  clearAudioLog() {
    this.playedSounds = [];
  },

  /** Call from a user gesture: browsers only allow audio after one. */
  unlock() {
    try {
      if (typeof window === 'undefined') return;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ctx = new AC();
        // Skip stubbed contexts that lack a real clock (e.g. test mocks)
        if (!ctx || typeof ctx.currentTime !== 'number' || typeof ctx.createGain !== 'function') return;
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(ctx.destination);
        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(this.master);
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = 0.22;
        this.musicBus.connect(this.master);
        this._applyMute();
      }
      if (this.ctx.state === 'suspended' && this.ctx.resume) this.ctx.resume();
      if (this.musicWanted) this._startScheduler();
    } catch (e) {
      this.ctx = null;
    }
  },

  _loadPref() {
    if (this._loadedPref) return;
    this._loadedPref = true;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) {
      this.muted = false;
    }
  },

  isMuted() {
    this._loadPref();
    return this.muted;
  },

  setMuted(m) {
    this._loadPref();
    this.muted = !!m;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch (e) {
      // ignore
    }
    this._applyMute();
    return this.muted;
  },

  toggleMute() {
    return this.setMuted(!this.isMuted());
  },

  _applyMute() {
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.7, this.ctx.currentTime, 0.03);
    }
  },

  // ------------------------------------------------------------ primitives
  _tone({ type = 'sine', f0, f1 = f0, dur = 0.15, vol = 0.3, delay = 0, attack = 0.005, bus }) {
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(bus || this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  },

  _noiseBurst({ dur = 0.1, vol = 0.2, freq = 1200, q = 0.8, delay = 0, type = 'bandpass', bus }) {
    const ctx = this.ctx;
    if (!this._noise) {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this._noise = buf;
    }
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this._noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(bus || this.sfxBus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  },

  _synth(name) {
    if (!this.ctx) return;
    switch (name) {
      case 'jump':
        this._tone({ type: 'square', f0: 260, f1: 620, dur: 0.16, vol: 0.09 });
        this._tone({ type: 'sine', f0: 520, f1: 1240, dur: 0.12, vol: 0.06 });
        break;
      case 'land':
        this._tone({ type: 'sine', f0: 140, f1: 60, dur: 0.09, vol: 0.18 });
        this._noiseBurst({ dur: 0.07, vol: 0.06, freq: 500 });
        break;
      case 'collect':
        this._tone({ type: 'triangle', f0: 988, dur: 0.09, vol: 0.16 });
        this._tone({ type: 'triangle', f0: 1319, dur: 0.16, vol: 0.16, delay: 0.07 });
        this._tone({ type: 'sine', f0: 2637, dur: 0.12, vol: 0.04, delay: 0.07 });
        break;
      case 'golden':
        [1047, 1319, 1568, 2093].forEach((f, i) => {
          this._tone({ type: 'triangle', f0: f, dur: 0.16, vol: 0.14, delay: i * 0.06 });
        });
        this._noiseBurst({ dur: 0.35, vol: 0.05, freq: 7000, q: 0.5, type: 'highpass', delay: 0.05 });
        break;
      case 'milestone':
        [784, 988, 1175, 1568].forEach((f, i) => {
          this._tone({ type: 'square', f0: f, dur: 0.14, vol: 0.06, delay: i * 0.08 });
        });
        break;
      case 'gameover':
        this._noiseBurst({ dur: 0.25, vol: 0.35, freq: 300, q: 0.6, type: 'lowpass' });
        this._tone({ type: 'sine', f0: 180, f1: 50, dur: 0.3, vol: 0.35 });
        [523, 466, 392, 311].forEach((f, i) => {
          this._tone({ type: 'triangle', f0: f, f1: f * 0.97, dur: 0.22, vol: 0.13, delay: 0.18 + i * 0.16 });
        });
        break;
      case 'bark':
        this._tone({ type: 'sawtooth', f0: 520, f1: 300, dur: 0.09, vol: 0.12 });
        this._noiseBurst({ dur: 0.08, vol: 0.12, freq: 900, q: 1.5 });
        break;
      default:
        break;
    }
  },

  // ------------------------------------------------------------ music
  startMusic() {
    this.musicWanted = true;
    if (this.ctx) this._startScheduler();
  },

  stopMusic() {
    this.musicWanted = false;
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },

  _startScheduler() {
    if (this.musicTimer || !this.ctx) return;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = setInterval(() => this._scheduleMusic(), 50);
  },

  _scheduleMusic() {
    if (!this.ctx) return;
    const stepDur = 0.19;
    try {
      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        const step = this.musicStep % MELODY.length;
        const delay = Math.max(0, this.nextNoteTime - this.ctx.currentTime);
        const note = MELODY[step];
        if (note) {
          this._tone({ type: 'triangle', f0: midi(note), dur: stepDur * 0.9, vol: 0.22, delay, bus: this.musicBus });
          this._tone({ type: 'square', f0: midi(note + 12), dur: stepDur * 0.4, vol: 0.025, delay, bus: this.musicBus });
        }
        const bar = Math.floor(step / 8) % BASS.length;
        if (step % 4 === 0) {
          const root = BASS[bar] + (step % 8 === 4 ? 12 : 0);
          this._tone({ type: 'triangle', f0: midi(root), dur: stepDur * 1.8, vol: 0.3, delay, bus: this.musicBus });
        }
        if (step % 2 === 1) {
          this._noiseBurst({ dur: 0.04, vol: 0.05, freq: 8000, q: 0.7, type: 'highpass', delay, bus: this.musicBus });
        }
        if (step % 8 === 0 || step % 8 === 5) {
          this._tone({ type: 'sine', f0: 110, f1: 45, dur: 0.12, vol: 0.32, delay, bus: this.musicBus });
        }
        this.nextNoteTime += stepDur;
        this.musicStep++;
      }
    } catch (e) {
      this.stopMusic();
    }
  }
};
