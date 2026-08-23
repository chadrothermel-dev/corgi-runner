/**
 * Core Engine class for Corgi Endless Runner.
 * Manages 60 FPS requestAnimationFrame loop, state machine, delta timing, and event hooks.
 */
export class Engine {
  static STATES = Object.freeze({
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  });

  constructor(canvas = null, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas && typeof canvas.getContext === 'function' ? canvas.getContext('2d') : null;
    this.state = Engine.STATES.START;
    this.isRunning = false;
    this.lastTime = null;
    this.rafId = null;

    this.listeners = {
      stateChange: [],
      update: [],
      render: []
    };

    this._loop = this._loop.bind(this);
  }

  /**
   * Starts the game loop.
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = null;
    this.rafId = requestAnimationFrame(this._loop);
  }

  /**
   * Stops the game loop.
   */
  stop() {
    this.isRunning = false;
    if (this.rafId !== null) {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(this.rafId);
      }
      this.rafId = null;
    }
  }

  /**
   * Returns the current game state string.
   */
  getState() {
    return this.state;
  }

  /**
   * Transitions engine state to a new valid state.
   * @param {string} newState 
   */
  setState(newState) {
    const validStates = Object.values(Engine.STATES);
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid engine state: ${newState}. Must be one of: ${validStates.join(', ')}`);
    }

    if (this.state !== newState) {
      const oldState = this.state;
      this.state = newState;
      this.listeners.stateChange.forEach((cb) => cb(newState, oldState));
    }
  }

  /**
   * Internal requestAnimationFrame tick handler.
   * @param {number} timestamp 
   */
  _loop(timestamp) {
    if (!this.isRunning) return;

    const currentTime = (typeof timestamp === 'number' && !isNaN(timestamp))
      ? timestamp
      : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

    let clampedDelta = 0;
    if (this.lastTime === null) {
      this.lastTime = currentTime;
      clampedDelta = 0;
    } else {
      let deltaTime = (currentTime - this.lastTime) / 1000;
      if (isNaN(deltaTime) || deltaTime < 0) {
        deltaTime = 0;
      }
      clampedDelta = Math.min(deltaTime, 0.1);
      this.lastTime = currentTime;
    }

    try {
      this.update(clampedDelta);
      this.render();
    } catch (error) {
      this.stop();
      throw error;
    }

    if (this.isRunning) {
      this.rafId = requestAnimationFrame(this._loop);
    }
  }

  /**
   * Dispatches update tick to registered update hooks.
   * @param {number} deltaTime 
   */
  update(deltaTime) {
    this.listeners.update.forEach((cb) => cb(deltaTime, this.state));
  }

  /**
   * Clears canvas and dispatches render tick to registered render hooks.
   */
  render() {
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.listeners.render.forEach((cb) => cb(this.ctx, this.state));
  }

  /**
   * Subscribes a callback to state changes.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onStateChange(callback) {
    if (typeof callback === 'function') {
      this.listeners.stateChange.push(callback);
    }
    return () => {
      this.listeners.stateChange = this.listeners.stateChange.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribes a callback to frame updates.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onUpdate(callback) {
    if (typeof callback === 'function') {
      this.listeners.update.push(callback);
    }
    return () => {
      this.listeners.update = this.listeners.update.filter((cb) => cb !== callback);
    };
  }

  /**
   * Subscribes a callback to frame renders.
   * @param {Function} callback 
   * @returns {Function} Unsubscribe function
   */
  onRender(callback) {
    if (typeof callback === 'function') {
      this.listeners.render.push(callback);
    }
    return () => {
      this.listeners.render = this.listeners.render.filter((cb) => cb !== callback);
    };
  }
}

