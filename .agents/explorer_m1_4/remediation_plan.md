# Remediation Plan — M1 Iteration 2 (Core Engine & Canvas Rendering)

**Target Agent**: Worker 2 (Implementer)  
**Author**: Explorer 4  
**Date**: 2026-07-23  

---

## 1. Overview & Objectives

During Iteration 1 review, Reviewers 1 and 2 issued VETO / REQUEST_CHANGES due to critical HTML integration issues in `index.html` (missing CSS link, inline legacy script, duplicate element IDs, wrong container structure), missing frame 1 timestamp handling in `js/engine.js`, and unhandled loop exceptions leaving the engine in a zombie `isRunning = true` state.

This remediation plan provides precise, step-by-step code replacement specifications for Worker 2 to fix all VETO items and achieve 100% compliance across `index.html`, `css/style.css`, `js/engine.js`, and `js/main.js`.

---

## 2. Itemized Remediation Instructions

### Item 1: `index.html` Refactoring & Integration

**Target File**: `index.html` (project root)  
**Issue**: 
- Missing `<link rel="stylesheet" href="css/style.css">`.
- Contains legacy inline `<style>` block (lines 7-65).
- Root container named `#gameContainer` instead of `#game-container`.
- Canvas named `#gameCanvas` (800x400) instead of `#game-canvas` (800x450 for 16:9 ratio).
- Missing `#ui-overlay` container wrapping HUD and screen overlays.
- Invalid HTML syntax with duplicate `id` attributes on single tags (e.g. `<div id="scoreDisplay" id="score-display">`).
- Legacy script module importing `./src/game.js` instead of loading `<script type="module" src="js/main.js">`.

**Action for Worker 2**: Replace `index.html` content completely with the following verified structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Corgi Endless Runner</title>
  <link rel="stylesheet" href="css/style.css">
</head>
<body>
  <div id="game-container">
    <canvas id="game-canvas" width="800" height="450"></canvas>
    
    <div id="ui-overlay">
      <div id="hud">
        <div id="score-display">Score: 0</div>
        <div id="high-score-display">High Score: 0</div>
      </div>

      <!-- Start Overlay -->
      <div id="start-screen" class="overlay">
        <h1>Corgi Endless Runner</h1>
        <p>Controls: [Space] / [Up Arrow] to Jump, [Down Arrow] to Duck, [P] to Pause</p>
        <button id="start-btn">Start Game</button>
      </div>

      <!-- Pause Overlay -->
      <div id="pause-screen" class="overlay hidden">
        <h2>Game Paused</h2>
        <button id="resume-btn">Resume Game</button>
      </div>

      <!-- Game Over Overlay -->
      <div id="game-over-screen" class="overlay hidden">
        <h2>Game Over</h2>
        <p>Score: <span id="final-score">0</span></p>
        <p>High Score: <span id="game-over-high-score">0</span></p>
        <button id="restart-btn">Play Again</button>
      </div>
    </div>
  </div>

  <script type="module" src="js/main.js"></script>
</body>
</html>
```

---

### Item 2: `css/style.css` Overlay Styling & Layout

**Target File**: `css/style.css`  
**Issue**: Needs overlay classes (`.overlay`, `.hidden`, `#hud`, `button`) moved from `index.html` inline styles into `css/style.css` so visual styling is preserved when inline styles are deleted.

**Action for Worker 2**: Replace `css/style.css` content with the complete stylesheet below:

```css
/* Reset & retro dark theme setup */
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  width: 100%;
  height: 100%;
  background-color: #0d0e15;
  color: #f0f0f0;
  font-family: 'Courier New', Courier, monospace;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Game Container - responsive 16:9 aspect ratio (800x450) */
#game-container {
  position: relative;
  width: 100vw;
  height: 56.25vw; /* 9 / 16 = 0.5625 */
  max-width: 177.78vh; /* 16 / 9 = 1.7778 */
  max-height: 100vh;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.8);
  background-color: #1a1a2e;
  overflow: hidden;
}

/* Canvas styling */
#game-canvas {
  width: 100%;
  height: 100%;
  display: block;
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  image-rendering: -moz-crisp-edges;
}

/* UI Overlay container for HUD, screens, and menus */
#ui-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

/* Interactive overlay children (buttons, menus) re-enable pointer events */
#ui-overlay > * {
  pointer-events: auto;
}

.overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  color: #ffffff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  box-sizing: border-box;
}

.hidden {
  display: none !important;
}

button {
  padding: 10px 20px;
  font-size: 18px;
  cursor: pointer;
  margin-top: 15px;
  background: #ff8c00;
  color: #ffffff;
  border: none;
  border-radius: 5px;
}

button:hover {
  background: #ffa500;
}

#hud {
  position: absolute;
  top: 10px;
  left: 10px;
  color: #ffffff;
  font-size: 18px;
  font-weight: bold;
  pointer-events: none;
}
```

---

### Item 3: `js/engine.js` Frame 1 Timestamp & Exception Handling

**Target File**: `js/engine.js`  
**Issues**:
1. `lastTime` was initialized to `0` in `constructor()` and `performance.now()` in `start()`. On the first tick of `_loop(timestamp)`, `timestamp` (RAF timestamp) vs `lastTime` could cause high delta spikes.
2. If an exception occurred during subscriber callback execution (`update` or `render`), execution halted before `requestAnimationFrame` was re-queued, but `this.isRunning` remained `true` (creating a dead zombie state that blocked `start()`).

**Action for Worker 2**: Update `js/engine.js`:
1. In `constructor()`: Set `this.lastTime = null;`.
2. In `start()`: Set `this.lastTime = null;`.
3. In `_loop(timestamp)`:
   - Handle frame 1 timestamp check: if `this.lastTime === null`, set `this.lastTime = currentTime` and `clampedDelta = 0`.
   - Wrap `this.update(clampedDelta)` and `this.render()` dispatch in `try { ... } catch (error) { this.stop(); throw error; }`.

**Replacement Code for `js/engine.js`**:

```javascript
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
```

---

### Item 4: `js/main.js` Canvas Context & Resize Listener Verification

**Target File**: `js/main.js`  
**Verification**: Verify that `js/main.js` looks up `#game-canvas` and `#game-container`, sets `ctx.imageSmoothingEnabled = false`, binds `window.addEventListener('resize', handleResize)`, and starts the engine.

`js/main.js` content is already structured correctly:
```javascript
import { Engine } from './engine.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element #game-canvas not found.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }

  const engine = new Engine(canvas);

  function handleResize() {
    const container = document.getElementById('game-container');
    if (container && canvas) {
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
    }
  }

  window.addEventListener('resize', handleResize);
  handleResize();

  window.gameEngine = engine;
  engine.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
```

---

## 3. Verification Protocol

After implementing the above changes, Worker 2 must execute:

1. **Unit Test Suite**:
   ```bash
   npm run test:unit
   ```
   *Expected Output*: 28 tests passing without errors.

2. **Vitest E2E Test Suite**:
   ```bash
   npx vitest run
   ```
   *Expected Output*: 4 test files, 63 tests passing.

3. **HTML / DOM Verification**:
   - Check `index.html` in browser or JSDOM parser to verify no duplicate IDs exist and CSS/JS files load correctly.
