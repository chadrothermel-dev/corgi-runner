/**
 * Synthesized audio for Corgi Runner (Web Audio API — no asset files).
 * Every call to play() is logged so tests can assert on sound events even
 * in environments without an AudioContext.
 */
const MUTE_KEY = 'corgi_runner_muted';

// MIDI note -> frequency
const hz = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Cheerful I–vi–IV–V loop, one entry per eighth note (0 = rest)
const LEAD = [
  72, 0, 76, 79, 0, 76, 72, 74,
  76, 0, 72, 69, 0, 72, 76, 0,
  77, 0, 76, 72, 0, 69, 72, 0,
  74, 0, 71, 67, 74, 0, 79, 0,
  72, 0, 76, 79, 84, 79, 76, 79,
  81, 0, 79, 76, 0, 72, 76, 0,
  77, 81, 79, 77, 76, 0, 72, 0,
  74, 76, 77, 79, 0, 0, 0, 0
];
const BASS_ROOTS = [36, 33, 41, 43, 36, 33, 41, 43];

export const AudioSystem = {
  playedSounds: [],
  ctx: null,
  master: null,
  sfxBus: null,
  musicBus: null,
  noiseBuffer: null,
  muted: false,
  musicTimer: null,
  musicStep: 0,
  nextNoteTime: 0,
  prefsLoaded: false,

  loadPrefs() {
    if (this.prefsLoaded) return;
    this.prefsLoaded = true;
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch (e) {
      this.muted = false;
    }
  },

  /** Create / resume the AudioContext. Must be called from a user gesture. */
  unlock() {
    this.loadPrefs();
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
      if (!this.ctx) {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.8;
        this.master.connect(this.ctx.destination);

        const comp = this.ctx.createDynamicsCompressor();
        comp.connect(this.master);

        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = 0.9;
        this.sfxBus.connect(comp);

        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = 0;
        this.musicBus.connect(comp);

        const len = this.ctx.sampleRate;
        this.noiseBuffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {
      this.ctx = null;
    }
  },

  setMuted(muted) {
    this.muted = !!muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch (e) {
      // ignore
    }
    if (this.ctx && this.master) {
      this.master.gain.setTargetAtTime(this.muted ? 0 : 0.8, this.ctx.currentTime, 0.02);
    }
    return this.muted;
  },

  toggleMute() {
    this.loadPrefs();
    return this.setMuted(!this.muted);
  },

  play(soundName, opts = {}) {
    this.playedSounds.push({
      soundName,
      timestamp: Date.now()
    });

    if (!this.ctx || this.muted) return;
    try {
      const fx = SFX[soundName];
      if (fx) fx(this, opts);
    } catch (e) {
      // Never let audio break the game loop
    }
  },

  // --- Synth primitives -------------------------------------------------

  tone({ type = 'square', freq = 440, endFreq = null, dur = 0.1, vol = 0.2, delay = 0, attack = 0.005, bus = null }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(bus || this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },

  noise({ dur = 0.1, vol = 0.2, delay = 0, filter = 'lowpass', freq = 1000, endFreq = null, q = 1, bus = null }) {
    const ctx = this.ctx;
    const t0 = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t0);
    if (endFreq) f.frequency.exponentialRampToValueAtTime(endFreq, t0 + dur);
    f.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(gain);
    gain.connect(bus || this.sfxBus);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  },

  // --- Music ------------------------------------------------------------

  startMusic() {
    if (!this.ctx) return;
    this.musicBus.gain.setTargetAtTime(0.55, this.ctx.currentTime, 0.3);
    if (this.musicTimer) return;
    this.musicStep = 0;
    this.nextNoteTime = this.ctx.currentTime + 0.08;
    this.musicTimer = setInterval(() => this.scheduleMusic(), 25);
  },

  stopMusic(fade = 0.15) {
    if (this.ctx && this.musicBus) {
      this.musicBus.gain.setTargetAtTime(0, this.ctx.currentTime, fade);
    }
    if (this.musicTimer) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  },

  scheduleMusic() {
    if (!this.ctx) return;
    const eighth = 60 / 140 / 2;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      const step = this.musicStep % LEAD.length;
      const t = this.nextNoteTime - this.ctx.currentTime;
      const bar = Math.floor(step / 8);
      const beat = step % 8;

      const lead = LEAD[step];
      if (lead) {
        this.tone({ type: 'square', freq: hz(lead), dur: eighth * 0.9, vol: 0.045, delay: t, bus: this.musicBus });
        this.tone({ type: 'triangle', freq: hz(lead + 12), dur: eighth * 0.6, vol: 0.02, delay: t, bus: this.musicBus });
      }

      const root = BASS_ROOTS[bar % BASS_ROOTS.length];
      const bassNote = beat % 2 === 0 ? root : root + 12;
      this.tone({ type: 'triangle', freq: hz(bassNote), dur: eighth * 0.85, vol: 0.12, delay: t, bus: this.musicBus });

      if (beat === 0 || beat === 4) {
        this.tone({ type: 'sine', freq: 150, endFreq: 45, dur: 0.16, vol: 0.32, delay: t, bus: this.musicBus });
      }
      if (beat === 2 || beat === 6) {
        this.noise({ dur: 0.12, vol: 0.09, delay: t, filter: 'bandpass', freq: 1800, q: 0.8, bus: this.musicBus });
      }
      if (beat % 2 === 1) {
        this.noise({ dur: 0.035, vol: 0.05, delay: t, filter: 'highpass', freq: 7000, bus: this.musicBus });
      }

      this.nextNoteTime += eighth;
      this.musicStep++;
    }
  },

  getAudioLog() {
    return [...this.playedSounds];
  },

  clearAudioLog() {
    this.playedSounds = [];
  }
};

const SFX = {
  jump(a) {
    a.tone({ type: 'square', freq: 300, endFreq: 640, dur: 0.14, vol: 0.09 });
    a.tone({ type: 'triangle', freq: 600, endFreq: 1250, dur: 0.1, vol: 0.06 });
  },
  land(a) {
    a.noise({ dur: 0.07, vol: 0.12, filter: 'lowpass', freq: 500 });
  },
  duck(a) {
    a.noise({ dur: 0.12, vol: 0.06, filter: 'bandpass', freq: 2500, endFreq: 800, q: 1.2 });
  },
  collect(a, { combo = 0 } = {}) {
    const base = 1046 * Math.pow(2, Math.min(combo, 12) / 12);
    a.tone({ type: 'triangle', freq: base, dur: 0.08, vol: 0.14 });
    a.tone({ type: 'triangle', freq: base * 1.5, dur: 0.14, vol: 0.12, delay: 0.055 });
    a.tone({ type: 'sine', freq: base * 3, dur: 0.1, vol: 0.03, delay: 0.055 });
  },
  powerup(a) {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => {
      a.tone({ type: 'square', freq: hz(72 + n), dur: 0.09, vol: 0.06, delay: i * 0.045 });
      a.tone({ type: 'triangle', freq: hz(84 + n), dur: 0.09, vol: 0.05, delay: i * 0.045 });
    });
  },
  milestone(a) {
    [0, 4, 7, 12].forEach((n, i) => {
      a.tone({ type: 'triangle', freq: hz(79 + n), dur: 0.12, vol: 0.1, delay: i * 0.07 });
    });
  },
  bark(a) {
    const yip = (delay) => {
      a.tone({ type: 'sawtooth', freq: 760, endFreq: 380, dur: 0.09, vol: 0.08, delay });
      a.noise({ dur: 0.06, vol: 0.05, delay, filter: 'bandpass', freq: 1400, q: 3 });
    };
    yip(0);
    yip(0.13);
  },
  click(a) {
    a.tone({ type: 'sine', freq: 880, endFreq: 660, dur: 0.05, vol: 0.08 });
  },
  gameover(a) {
    a.noise({ dur: 0.3, vol: 0.35, filter: 'lowpass', freq: 900, endFreq: 120 });
    a.tone({ type: 'sawtooth', freq: 420, endFreq: 90, dur: 0.45, vol: 0.07 });
    [67, 64, 60, 55].forEach((n, i) => {
      a.tone({ type: 'triangle', freq: hz(n), dur: i === 3 ? 0.5 : 0.16, vol: 0.12, delay: 0.32 + i * 0.16 });
    });
  }
};
