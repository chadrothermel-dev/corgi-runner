# Analysis Report: M1 Test Infrastructure & Unit Testing Setup

## Executive Summary
This report presents the investigation findings and architecture design for the unit testing runner, DOM/Canvas API mocking, and test suite specification for Milestone M1 (Core Engine & Canvas Rendering) of the Corgi Endless Runner project.

Key Recommendations:
1. **Test Runner**: Utilize Node.js native test runner (`node --test`) paired with `node:assert`. This requires **zero external npm dependencies**, making it lightweight, fast (<15ms execution time), and ideal for network-isolated (CODE_ONLY) environments.
2. **Module System**: Configure `package.json` with `"type": "module"` to natively support ES Modules (`import`/`export`) across both browser and Node.js without bundlers or transpilers.
3. **Headless DOM/Canvas Mocking**: Provide a dedicated mock helper (`tests/mocks/canvas.mock.js`) that injects mock `document`, `window`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, and deterministic `requestAnimationFrame`/`cancelAnimationFrame` implementations into `globalThis`.
4. **Unit Test Specification**: Structure `tests/unit/engine.test.js` into 5 primary test suites covering Engine initialization, state transitions (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`), loop start/stop lifecycle, high-precision delta time calculation and clamping, and high-DPI canvas resizing.

---

## 1. Node Environment Analysis & Test Runner Selection

### Environment Findings
- **Node.js Version**: `v23.10.0`
- **NPM Version**: `11.6.3`
- **Built-in Capabilities**:
  - `performance.now()` is natively available in global scope.
  - `node:test` module provides `test()`, `describe()`, `it()`, `beforeEach()`, `afterEach()`, `mock`.
  - `node:assert` provides `strictEqual`, `deepStrictEqual`, `throws`, `ok`, `rejects`.
  - `requestAnimationFrame`, `window`, and `document` are `undefined` in default Node.js runtime.

### Test Runner Evaluation

| Test Runner | Pros | Cons | Verdict |
|---|---|---|---|
| **Node Native (`node --test`)** | Built into Node 23; 0 npm packages needed; fast startup (~10ms); native ES module support | Minimal UI reporting (TAP/spec format) | **SELECTED (Optimal)** |
| **Jest / Vitest** | Rich snapshot/mocking tools | Requires npm install (network access required); slower cold start | Rejected (Excessive dependencies) |
| **Custom JS Runner** | Fully customizable | Wheel reinvention; maintenance overhead | Rejected (Node native runner handles this) |

### `package.json` Recommendation

```json
{
  "name": "corgi-endless-runner",
  "version": "1.0.0",
  "description": "2D Endless Runner featuring a Corgi built with HTML5 Canvas",
  "type": "module",
  "main": "js/main.js",
  "scripts": {
    "test": "node --test tests/unit/*.test.js",
    "test:watch": "node --test --watch tests/unit/*.test.js"
  },
  "keywords": ["game", "canvas", "endless-runner", "html5"],
  "author": "",
  "license": "MIT"
}
```

---

## 2. Headless DOM & Canvas API Mocking Architecture

Because the HTML5 Engine relies on `document.getElementById`, `HTMLCanvasElement`, `CanvasRenderingContext2D`, and `requestAnimationFrame`, unit tests running in Node.js must mock these browser APIs before instantiating or executing `Engine`.

### Proposed Mock Helper (`tests/mocks/canvas.mock.js`)

```javascript
/**
 * Mock DOM and HTML5 Canvas API environment for headless Node.js testing.
 */

class MockCanvasContext2D {
  constructor() {
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.font = '10px sans-serif';
    this.textAlign = 'start';
    this.textBaseline = 'alphabetical';
    this.imageSmoothingEnabled = true;
    this.calls = [];
  }

  _record(name, args) {
    this.calls.push({ method: name, args: Array.from(args) });
  }

  clearRect(x, y, w, h) { this._record('clearRect', arguments); }
  fillRect(x, y, w, h) { this._record('fillRect', arguments); }
  strokeRect(x, y, w, h) { this._record('strokeRect', arguments); }
  beginPath() { this._record('beginPath', arguments); }
  closePath() { this._record('closePath', arguments); }
  moveTo(x, y) { this._record('moveTo', arguments); }
  lineTo(x, y) { this._record('lineTo', arguments); }
  arc(x, y, r, sa, ea) { this._record('arc', arguments); }
  fill() { this._record('fill', arguments); }
  stroke() { this._record('stroke', arguments); }
  drawImage() { this._record('drawImage', arguments); }
  save() { this._record('save', arguments); }
  restore() { this._record('restore', arguments); }
  scale(sx, sy) { this._record('scale', arguments); }
  translate(tx, ty) { this._record('translate', arguments); }
  rotate(angle) { this._record('rotate', arguments); }
  setTransform() { this._record('setTransform', arguments); }
  fillText(text, x, y) { this._record('fillText', arguments); }
  measureText(text) { return { width: text.length * 6 }; }
}

class MockCanvasElement {
  constructor(width = 800, height = 450) {
    this.width = width;
    this.height = height;
    this.style = { width: `${width}px`, height: `${height}px`, display: '' };
    this.context2D = new MockCanvasContext2D();
    this.eventListeners = {};
  }

  getContext(type) {
    if (type === '2d') return this.context2D;
    return null;
  }

  getBoundingClientRect() {
    return {
      left: 0,
      top: 0,
      width: this.width,
      height: this.height,
      right: this.width,
      bottom: this.height
    };
  }

  addEventListener(type, listener) {
    if (!this.eventListeners[type]) this.eventListeners[type] = [];
    this.eventListeners[type].push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.eventListeners[type]) return;
    this.eventListeners[type] = this.eventListeners[type].filter(l => l !== listener);
  }
}

export function setupTestEnvironment() {
  const mockCanvas = new MockCanvasElement();

  let rafIdCounter = 0;
  const pendingCallbacks = new Map();

  globalThis.window = globalThis.window || {
    devicePixelRatio: 1,
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  globalThis.document = globalThis.document || {
    createElement: (tagName) => {
      if (tagName.toLowerCase() === 'canvas') return new MockCanvasElement();
      return { style: {} };
    },
    getElementById: (id) => mockCanvas,
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  globalThis.requestAnimationFrame = (callback) => {
    const id = ++rafIdCounter;
    pendingCallbacks.set(id, callback);
    return id;
  };

  globalThis.cancelAnimationFrame = (id) => {
    pendingCallbacks.delete(id);
  };

  /**
   * Helper function to step a single RAF frame deterministically
   * @param {number} timestamp - Mock high-resolution timestamp (ms)
   */
  const stepFrame = (timestamp = performance.now()) => {
    const callbacks = Array.from(pendingCallbacks.entries());
    pendingCallbacks.clear();
    for (const [id, cb] of callbacks) {
      cb(timestamp);
    }
  };

  return {
    mockCanvas,
    pendingCallbacks,
    stepFrame
  };
}
```

---

## 3. Detailed Specification for `tests/unit/engine.test.js`

The unit test file should be organized into five `describe` suites:

### Suite 1: Engine Initialization
- **Test 1.1**: Verify `Engine` sets initial state to `'START'`.
- **Test 1.2**: Verify `Engine` acquires target canvas via canvas ID string or existing canvas instance.
- **Test 1.3**: Verify `Engine` retrieves 2D rendering context (`ctx`).
- **Test 1.4**: Verify `Engine` sets up correct default width/height and pixel ratio scaling (`scale(dpr, dpr)`).

### Suite 2: State Machine & State Transitions
- **Test 2.1**: Test transition from `START -> PLAYING` when calling `engine.start()` or `engine.setState('PLAYING')`.
- **Test 2.2**: Test transition from `PLAYING -> PAUSED` and `PAUSED -> PLAYING`.
- **Test 2.3**: Test transition from `PLAYING -> GAMEOVER` and `GAMEOVER -> START`.
- **Test 2.4**: Verify invalid state inputs (e.g. `'UNKNOWN'`, `null`, `123`) throw an `Error` or return `false` without corrupting state.
- **Test 2.5**: Verify state change callbacks are properly triggered when `setState()` is invoked.

### Suite 3: Game Loop Start & Stop Lifecycle
- **Test 3.1**: Verify `engine.start()` sets `engine.isRunning` to `true` and schedules a frame callback.
- **Test 3.2**: Verify `engine.stop()` sets `engine.isRunning` to `false` and cancels pending animation frames.
- **Test 3.3**: Verify calling `start()` multiple times while already running does not spawn duplicate animation loops.

### Suite 4: High-Precision Delta Time & Frame Dispatch
- **Test 4.1**: Verify delta time is calculated correctly in seconds/milliseconds between consecutive frames.
- **Test 4.2**: Verify delta time capping (e.g., max 0.1s / 100ms) when a large frame gap occurs (tab freeze protection).
- **Test 4.3**: Verify `update(dt)` and `render()` are called appropriately per state (e.g. `update` disabled in `PAUSED`, `render` active).

### Suite 5: Canvas Resizing & Responsive Layout
- **Test 5.1**: Verify `engine.resize(w, h)` updates canvas internal dimensions and recalculates High-DPI context scaling.

---

## 4. Proposed `tests/unit/engine.test.js` Code Structure

```javascript
import test, { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { setupTestEnvironment } from '../mocks/canvas.mock.js';
import { Engine } from '../../js/engine.js';

describe('Engine Unit Tests', () => {
  let env;

  beforeEach(() => {
    env = setupTestEnvironment();
  });

  describe('1. Engine Initialization', () => {
    it('should initialize with default state START', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      assert.strictEqual(engine.getState(), 'START');
      assert.strictEqual(engine.isRunning, false);
    });

    it('should attach canvas element and 2D rendering context', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      assert.ok(engine.canvas);
      assert.ok(engine.ctx);
    });
  });

  describe('2. State Machine Transitions', () => {
    it('should handle valid state transitions: START -> PLAYING -> PAUSED -> GAMEOVER -> START', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      
      engine.setState('PLAYING');
      assert.strictEqual(engine.getState(), 'PLAYING');

      engine.setState('PAUSED');
      assert.strictEqual(engine.getState(), 'PAUSED');

      engine.setState('PLAYING');
      assert.strictEqual(engine.getState(), 'PLAYING');

      engine.setState('GAMEOVER');
      assert.strictEqual(engine.getState(), 'GAMEOVER');

      engine.setState('START');
      assert.strictEqual(engine.getState(), 'START');
    });

    it('should throw an error on invalid state assignment', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      assert.throws(() => {
        engine.setState('INVALID_STATE');
      }, /Invalid state/i);
    });
  });

  describe('3. Game Loop Lifecycle', () => {
    it('should start loop on start() and stop on stop() without throwing', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      engine.start();
      assert.strictEqual(engine.isRunning, true);

      engine.stop();
      assert.strictEqual(engine.isRunning, false);
    });

    it('should be idempotent when calling start() multiple times', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      engine.start();
      const initialRafCount = env.pendingCallbacks.size;
      
      engine.start(); // Second call
      assert.strictEqual(env.pendingCallbacks.size, initialRafCount);
      engine.stop();
    });
  });

  describe('4. Delta Timing & Frame Updates', () => {
    it('should pass delta time to update loop', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      let lastDt = 0;
      engine.update = (dt) => { lastDt = dt; };
      
      engine.start();
      env.stepFrame(1000);
      env.stepFrame(1016.67); // ~16.67ms frame
      
      assert.ok(lastDt > 0);
      assert.ok(lastDt <= 0.05); // expect ~0.0167s
      engine.stop();
    });

    it('should cap excessive delta time on large time gaps', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      let lastDt = 0;
      engine.update = (dt) => { lastDt = dt; };
      
      engine.start();
      env.stepFrame(1000);
      env.stepFrame(5000); // 4000ms delay (tab backgrounded)
      
      assert.ok(lastDt <= 0.1, `Delta time ${lastDt} exceeded cap of 0.1s`);
      engine.stop();
    });
  });

  describe('5. High-DPI & Canvas Resizing', () => {
    it('should resize canvas dimensions cleanly', () => {
      const engine = new Engine({ canvasId: 'gameCanvas' });
      engine.resize(1280, 720);
      assert.strictEqual(engine.width, 1280);
      assert.strictEqual(engine.height, 720);
    });
  });
});
```

---

## 5. Verification Protocol for Worker Implementation
When the Worker implements `package.json`, `tests/mocks/canvas.mock.js`, `js/engine.js`, and `tests/unit/engine.test.js`:
1. Execute `npm test` in `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner`.
2. Confirm output reports all test suites passing with 0 errors.
3. Confirm test suite runtime is under 100ms.
