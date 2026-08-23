export class VirtualClock {
  constructor() {
    this.currentTime = 0; // ms
    this.rafCallbacks = new Map();
    this.nextRafId = 1;
    this.installed = false;
    this.baseTime = 0;
  }

  install() {
    if (typeof window === 'undefined') return;

    this._origRaf = window.requestAnimationFrame;
    this._origCaf = window.cancelAnimationFrame;
    this._origPerfNow = window.performance.now;
    this._origDateNow = Date.now;

    const self = this;
    this.baseTime = Date.now();

    window.requestAnimationFrame = function (cb) {
      const id = self.nextRafId++;
      self.rafCallbacks.set(id, cb);
      return id;
    };

    window.cancelAnimationFrame = function (id) {
      self.rafCallbacks.delete(id);
    };

    window.performance.now = function () {
      return self.currentTime;
    };

    Date.now = function () {
      return self.baseTime + self.currentTime;
    };

    this.installed = true;
  }

  uninstall() {
    if (typeof window === 'undefined' || !this.installed) return;
    window.requestAnimationFrame = this._origRaf;
    window.cancelAnimationFrame = this._origCaf;
    window.performance.now = this._origPerfNow;
    Date.now = this._origDateNow;
    this.installed = false;
  }

  step(deltaMs = 16.667) {
    this.currentTime += deltaMs;
    const idsToRun = Array.from(this.rafCallbacks.keys());

    for (const id of idsToRun) {
      if (this.rafCallbacks.has(id)) {
        const cb = this.rafCallbacks.get(id);
        this.rafCallbacks.delete(id);
        try {
          cb(this.currentTime);
        } catch (e) {
          console.error('Error in rAF callback:', e);
        }
      }
    }
  }

  stepFrames(count, deltaMs = 16.667) {
    for (let i = 0; i < count; i++) {
      this.step(deltaMs);
    }
  }
}
