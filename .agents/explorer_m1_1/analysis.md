# Architectural Analysis & Specification: `Engine` Class (`js/engine.js`)

## 1. Executive Summary & Scope

The `Engine` class serves as the central game loop orchestrator and core state machine for the Corgi Endless Runner game. It is responsible for timing control via high-precision `requestAnimationFrame`, game state management, dispatching `update` and `render` ticks, and broadcasting state transition events.

This document outlines the complete architectural design, method contracts, timing calculations, state machine transitions, edge-case mitigation strategies, and unit testing strategies for `Engine`.

---

## 2. Game State Machine Specification

### 2.1 State Definitions
The engine maintains a single active state string from the following defined enum set:
- **`START`**: Initial title/splash screen state. Gameplay logic is frozen. The runner is stationary or performing ambient idle animation on the title screen.
- **`PLAYING`**: Active gameplay loop. Player inputs control the corgi (jump/duck), obstacles scroll, score increments, collision detection is active.
- **`PAUSED`**: Gameplay logic is frozen (`update` skipped or zeroed). Canvas shows frozen frame with pause overlay. Keyboard shortcut (e.g. Esc/P) can unpause back to `PLAYING`.
- **`GAMEOVER`**: Player hit an obstacle. Updates frozen, final score displayed, restart prompt active. Transition to `PLAYING` or `START` resets game session.

```
       ┌───────────┐
       │   START   │
       └─────┬─────┘
             │ start() / setState('PLAYING')
             ▼
       ┌───────────┐  toggle pause   ┌───────────┐
       │  PLAYING  │ ──────────────► │  PAUSED   │
       └─────┬─────┘ ◄────────────── └───────────┘
             │ collision detected
             ▼
       ┌───────────┐
       │ GAMEOVER  │ ────► restart: setState('START') or setState('PLAYING')
       └───────────┘
```

### 2.2 Transition Rules & State Callbacks
- State transition is executed exclusively via `setState(newState)`.
- If `newState` is identical to current state, `setState` short-circuits to avoid redundant event triggers.
- If `newState` is invalid (not in valid states list), `setState` throws or logs an error.
- Subscribers registered via `onStateChange(callback)` receive `(newState, oldState)`.

---

## 3. Main Loop & Timing Architecture

### 3.1 `requestAnimationFrame` & Delta Time Calculation
To achieve smooth, frame-rate independent gameplay across monitors (60Hz, 120Hz, 144Hz, 240Hz), delta time is calculated in seconds:

$$\Delta t = \frac{t_{\text{current}} - t_{\text{last}}}{1000}$$

Where $t$ is high-resolution time from `performance.now()` or `requestAnimationFrame(timestamp)`.

### 3.2 Max Delta Time Cap ("Spiral of Death" Protection)
When the browser tab loses focus, `requestAnimationFrame` is suspended by the browser. Upon tab reactivation, $t_{\text{current}} - t_{\text{last}}$ can be several seconds or minutes. Without capping, physics updates multiplying by huge $\Delta t$ will cause massive teleportation, missed collision checks, or continuous physics sub-stepping loops.

- **`MAX_DELTA = 0.1` seconds (100 ms)**.
- If calculated $\Delta t > 0.1$, it is clamped: `deltaTime = Math.min(deltaTime, MAX_DELTA)`.

### 3.3 Target 60 FPS & Frame Delta Normalization
- standard frame interval target at 60 FPS is $\approx 0.01667$ seconds ($16.67$ ms).
- Components in update loops can receive `deltaTime` (in seconds) or a normalized scale factor $f = \text{deltaTime} \times 60$.

---

## 4. Class API & Method Specifications

```javascript
class Engine {
  constructor(canvas, options = {})
  start()
  stop()
  setState(newState)
  getState()
  update(deltaTime)
  render(ctx)
  onStateChange(callback)
  onUpdate(callback)
  onRender(callback)
}
```

### Method Contracts
1. **`constructor(canvas, options = {})`**:
   - Accepts HTMLCanvasElement or canvas selector string.
   - Obtains 2D rendering context `canvas.getContext('2d')`.
   - Initializes `state = 'START'`, `isRunning = false`, `lastTime = 0`, listener lists.

2. **`start()`**:
   - Sets `isRunning = true`.
   - Resets `lastTime = 0` (or `performance.now()`).
   - Invokes `requestAnimationFrame(this.loop.bind(this))`.

3. **`stop()`**:
   - Sets `isRunning = false`.
   - Cancels pending rAF frame via `cancelAnimationFrame(this.animFrameId)`.

4. **`setState(newState)`**:
   - Validates `newState`.
   - Updates `this.state`.
   - Notifies all state change callbacks with `(newState, oldState)`.

5. **`getState()`**:
   - Returns string of current state (`'START'`, `'PLAYING'`, `'PAUSED'`, `'GAMEOVER'`).

6. **`update(deltaTime)`**:
   - Called every frame when engine is running.
   - If `state === 'PLAYING'`, dispatches `deltaTime` to registered update callbacks (e.g. game entities, scrolling background, score manager).
   - If `state !== 'PLAYING'`, update callbacks for gameplay are skipped.

7. **`render(ctx)`**:
   - Clears canvas `ctx.clearRect(0, 0, width, height)`.
   - Dispatches `ctx` and current state to registered render callbacks (background, corgi, obstacles, UI overlays).

---

## 5. Proposed Code Implementation (`js/engine.js`)

Below is the complete proposed specification for `js/engine.js`:

```javascript
/**
 * Engine - Core Game Loop and State Machine
 */
export class Engine {
  static STATES = Object.freeze({
    START: 'START',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    GAMEOVER: 'GAMEOVER'
  });

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} options
   */
  constructor(canvas, options = {}) {
    this.canvas = typeof canvas === 'string' ? document.querySelector(canvas) : canvas;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    
    this.state = Engine.STATES.START;
    this.isRunning = false;
    this.lastTime = 0;
    this.animFrameId = null;
    this.maxDelta = options.maxDelta || 0.1; // 100ms cap

    this.stateChangeListeners = [];
    this.updateListeners = [];
    this.renderListeners = [];

    this._loop = this._loop.bind(this);
  }

  /**
   * Start game engine loop
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = 0;
    this.animFrameId = requestAnimationFrame(this._loop);
  }

  /**
   * Stop game engine loop
   */
  stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  /**
   * Set engine state
   * @param {string} newState 
   */
  setState(newState) {
    const validStates = Object.values(Engine.STATES);
    if (!validStates.includes(newState)) {
      throw new Error(`Invalid state: "${newState}". Valid states are: ${validStates.join(', ')}`);
    }

    if (this.state === newState) return;

    const oldState = this.state;
    this.state = newState;

    for (const callback of this.stateChangeListeners) {
      callback(newState, oldState);
    }
  }

  /**
   * Get current state
   * @returns {string}
   */
  getState() {
    return this.state;
  }

  /**
   * Main animation loop callback
   * @param {number} timestamp 
   */
  _loop(timestamp) {
    if (!this.isRunning) return;

    if (!this.lastTime) {
      this.lastTime = timestamp;
    }

    let deltaTime = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    // Cap max delta to prevent spiral of death
    if (deltaTime > this.maxDelta) {
      deltaTime = this.maxDelta;
    }

    this.update(deltaTime);
    if (this.ctx) {
      this.render(this.ctx);
    }

    this.animFrameId = requestAnimationFrame(this._loop);
  }

  /**
   * Update logic tick
   * @param {number} deltaTime 
   */
  update(deltaTime) {
    for (const callback of this.updateListeners) {
      callback(deltaTime, this.state);
    }
  }

  /**
   * Render tick
   * @param {CanvasRenderingContext2D} ctx 
   */
  render(ctx) {
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const callback of this.renderListeners) {
      callback(ctx, this.state);
    }
  }

  /**
   * Register state change callback
   * @param {Function} callback 
   */
  onStateChange(callback) {
    this.stateChangeListeners.push(callback);
    return () => {
      this.stateChangeListeners = this.stateChangeListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Register update callback
   * @param {Function} callback 
   */
  onUpdate(callback) {
    this.updateListeners.push(callback);
    return () => {
      this.updateListeners = this.updateListeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Register render callback
   * @param {Function} callback 
   */
  onRender(callback) {
    this.renderListeners.push(callback);
    return () => {
      this.renderListeners = this.renderListeners.filter(cb => cb !== callback);
    };
  }
}
```

---

## 6. Edge Cases & Resilience Strategy

| Edge Case | Potential Impact | Mitigation Strategy |
| --- | --- | --- |
| Tab Unfocus / Backgrounding | Large frame gap ($>1s$), physics breakdown | Delta time capped to `maxDelta = 0.1`s; optional auto-pause when `visibilitychange` fires. |
| High Refresh Rate Monitors (120Hz/144Hz) | Loop fires faster than 60 FPS | `deltaTime` scaling ensures movement per second remains identical regardless of FPS. |
| Canvas Context Missing (Headless Unit Tests) | Code throws null reference error | Null check on `this.ctx` before calling `render(this.ctx)` allows headless unit testing. |
| Double `start()` calls | Multiple overlapping rAF loops | `if (this.isRunning) return;` guard in `start()`. |
| Invalid State Transition | Silent bug or undefined behavior | Strict check in `setState(newState)` throwing descriptive error. |

---

## 7. Recommended Unit Testing Strategy

Unit tests should test `Engine` methods without requiring a browser window or full HTML5 canvas renderer.
Tests should verify:
1. **Initial State**: Engine starts in `'START'` state.
2. **State Transition**: `setState('PLAYING')` changes state and fires registered callbacks.
3. **State Validation**: `setState('INVALID')` throws an Error.
4. **Manual Update/Render Calls**: `update(0.016)` and `render(mockCtx)` correctly invoke registered update/render listeners with correct parameters.
5. **Start / Stop**: `start()` toggles `isRunning = true`, `stop()` toggles `isRunning = false` and cancels frame.
6. **Delta Time Capping**: Passing a simulated large timestamp gap clamps delta time to `0.1`.
