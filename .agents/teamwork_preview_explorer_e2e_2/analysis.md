# Test Runner Technology & Harness Infrastructure Analysis
**Project**: E2E Corgi Endless Runner (HTML5 Canvas 2D Game)  
**Track**: E2E Testing Track  
**Author**: Explorer 2 (`teamwork_preview_explorer_e2e_2`)  
**Date**: 2026-07-23  

---

## 1. Executive Summary

This report presents the technology selection, harness infrastructure design, and file layout for end-to-end (E2E) automated testing of the **Corgi Endless Runner** HTML5 Canvas 2D game in Node.js on Windows shell environments.

The game is a standard client-side HTML5 Canvas endless runner featuring keydown/touch controls, obstacle collision detection, bone treat collection, speed acceleration, sound effects, DOM overlay state transitions (Start, Playing, Pause, Game Over), and persistent high scores via `localStorage`.

To achieve deterministic, fast, opaque-box E2E testing without external browser binary installation overhead or GPU rendering dependencies, we recommend a **Vitest + JSDOM + Custom Canvas 2D Context Mock & Time-Stepping Harness** architecture.

---

## 2. Test Runner Technology Evaluation

We evaluated four candidate test runner technology stacks against five critical project criteria:
1. **Windows Shell & Node.js Native Compatibility**: Zero binary download failures, smooth execution in Windows PowerShell.
2. **Deterministic Game Loop Control**: Ability to mock `requestAnimationFrame` and `performance.now()` to advance game state by exact millisecond/frame counts without relying on real wall-clock sleep delays.
3. **Canvas 2D & DOM Interaction**: Full JSDOM support for inspecting DOM overlays (`#start-screen`, `#pause-screen`, `#game-over-screen`, `#score-display`, `#high-score-display`) and spying on Canvas 2D rendering operations.
4. **Mocking Capabilities**: Support for event dispatching (`KeyboardEvent`, `TouchEvent`), Audio API spying, and `localStorage` state persistence testing.
5. **Execution Speed & Developer Experience**: Instant startup, clean BDD test assertions (`describe`, `it`, `expect`), and standard npm runner integration.

### Evaluation Matrix

| Criterion | Vitest + JSDOM + Canvas Mock | Jest + JSDOM | Playwright / Puppeteer (Headless Browser) | Node Native Runner (`node:test`) |
| :--- | :--- | :--- | :--- | :--- |
| **Windows / Node Compatibility** | **Excellent** (Pure JS npm package) | **Good** (Pure JS npm package) | **Fair** (Requires heavy browser binaries & web server) | **Excellent** (Built-in Node) |
| **Deterministic Frame Stepping** | **Outstanding** (`vi.useFakeTimers()`, rAF mock) | **Good** (`jest.useFakeTimers()`) | **Poor** (Real-time browser loop, async IPC lag) | **Moderate** (Manual rAF override) |
| **DOM & Overlay Inspection** | **Full** (JSDOM environment) | **Full** (JSDOM environment) | **Full** (Browser DOM) | **Requires JSDOM wrapper** |
| **Canvas 2D Render Spying** | **Full** (Custom 2D Context Recorder) | **Full** (Requires `jest-canvas-mock`) | **Indirect** (Pixel comparison / screenshot only) | **Full** (Custom 2D Context Recorder) |
| **Audio / LocalStorage Mocking** | **Seamless** (Vitest spies + JSDOM storage) | **Seamless** (Jest spies + JSDOM storage) | **Complex** (Requires page routing / browser context mocks) | **Manual setup** |
| **Execution Speed** | **Fastest** (~50ms per test file) | **Fast** (~200ms per test file) | **Slow** (1-3s per spec file + server startup) | **Fast** (~50ms per test file) |
| **ESM Support** | **Native** | **Requires Babel/Transform config** | **Native** | **Native** |

### Recommendation: Vitest + JSDOM + Custom Canvas 2D Mock Harness
**Vitest** with `environment: 'jsdom'` is the optimal runner:
- Works natively with modern ES Modules without extra compilation boilerplate.
- Offers `vi.useFakeTimers()` for ultra-fast, frame-by-frame game simulation (e.g. running 1,000 frames in < 10ms).
- Does not require downloading Chromium binaries or running background HTTP servers on Windows.
- Standard BDD syntax (`describe`, `it`, `expect`, `beforeEach`, `afterEach`).

---

## 3. Test Harness Infrastructure & Opaque-Box Interface Design

### Opaque-Box Testing Principles
Opaque-box (black-box) E2E testing interacts with the game solely through user-visible or standard browser interface boundaries:
1. **Input Events**: Synthetic `KeyboardEvent` (`keydown`, `keyup`) on `window`/`document` and `TouchEvent` (`touchstart`, `touchend`) on the `<canvas>` element.
2. **DOM Overlays**: Reading text content, CSS visibility (`display`, `hidden`, `opacity`), and classes on `#start-screen`, `#pause-screen`, `#game-over-screen`, `#score-display`, and `#high-score-display`.
3. **Canvas 2D Rendering Spying**: Intercepting 2D Context drawing commands (`fillRect`, `drawImage`, `fillText`, `clearRect`, `beginPath`, `arc`) to verify player sprite rendering, obstacle positions, bone treat spawns, and particle bursts without accessing private JS variables.
4. **Audio API Spying**: Intercepting `HTMLAudioElement.prototype.play` / `AudioContext` to verify sound playback calls (jump, collect treat, game over sound).
5. **Storage Inspection**: Reading and writing `window.localStorage` to test high score initialization, updating, and persistence.

---

### Harness Architecture Specification

The test harness consists of 4 reusable modules located in `tests/e2e/harness/`:

```
tests/e2e/harness/
├── canvasMock.js    # Canvas 2D context recorder & drawing state spy
├── audioMock.js     # HTML5 Audio & Web Audio API spy/mock
├── timeMock.js      # Deterministic requestAnimationFrame & performance.now clock
└── gameHarness.js   # Unified Opaque-Box API facade for E2E tests
```

#### A. Canvas 2D Context Recorder (`canvasMock.js`)
Intercepts `HTMLCanvasElement.prototype.getContext('2d')` in JSDOM and provides a recorder object:
- Records drawing operations per frame: `fillRect(x, y, w, h)`, `drawImage(img, dx, dy, dw, dh)`, `fillText(text, x, y)`, `clearRect(x, y, w, h)`.
- Tracks canvas state reset and transform calls (`save()`, `restore()`, `translate()`, `rotate()`, `scale()`).
- Exposes query helper: `harness.getRenderedEntities()` to inspect drawn bounding boxes and labels during a frame.

#### B. Audio API Mock (`audioMock.js`)
Mocks `window.Audio` and `window.AudioContext` so media load errors are avoided in Node:
- Intercepts `new Audio(src)` and records `.play()`, `.pause()`, `.currentTime`.
- Provides `harness.getAudioLog()` returning an array of played audio events: `[{ src: 'jump.wav', timestamp: 120 }, { src: 'treat.mp3', timestamp: 450 }]`.

#### C. Deterministic Time Stepper (`timeMock.js`)
Controls `window.requestAnimationFrame`, `window.cancelAnimationFrame`, and `window.performance.now()`:
- Allows tests to execute frame steps explicitly via `harness.stepFrame(16.67)` or `harness.stepFrames(60)`.
- Eliminates non-deterministic race conditions and async timing flakiness.

#### D. Unified Game Test Harness (`gameHarness.js`)
Provides high-level opaque-box API methods used across all test tiers:

```javascript
export class GameTestHarness {
  async setup() {
    // 1. Reset JSDOM DOM structure with game index.html markup
    // 2. Install Canvas 2D Context Recorder
    // 3. Install Audio API Spy
    // 4. Install Time Stepper
    // 5. Initialize Game instance
  }

  // Input Dispatchers
  pressKey(code, key = code) { ... }
  keyDown(code, key = code) { ... }
  keyUp(code, key = code) { ... }
  touchStart(targetElement = this.canvas, touches = [{ clientX: 100, clientY: 100 }]) { ... }
  touchEnd(targetElement = this.canvas) { ... }

  // Game Loop Stepper
  stepFrame(deltaMs = 16.667) { ... }
  stepFrames(count, deltaMs = 16.667) { ... }
  runForTime(totalMs, frameDeltaMs = 16.667) { ... }

  // Opaque-Box DOM & State Queries
  getGameState() {
    // Returns 'START' | 'PLAYING' | 'PAUSED' | 'GAMEOVER' based on overlay visibility
  }
  getDisplayedScore() { ... }
  getDisplayedHighScore() { ... }
  
  // Storage & Audio Queries
  getLocalStorageHighScore() { ... }
  setLocalStorageHighScore(val) { ... }
  getPlayedSounds() { ... }

  // Canvas Drawing Queries
  getRenderedDrawCalls() { ... }
}
```

---

## 4. Concrete File Layout & `package.json` Configuration

### Project File Layout

```
corgi_runner/
├── index.html
├── src/
│   ├── index.js
│   ├── game.js
│   ├── canvas.js
│   ├── corgi.js
│   ├── obstacle.js
│   ├── treat.js
│   ├── audio.js
│   └── storage.js
├── tests/
│   └── e2e/
│       ├── harness/
│       │   ├── canvasMock.js
│       │   ├── audioMock.js
│       │   ├── timeMock.js
│       │   └── gameHarness.js
│       ├── tier1_feature_coverage.test.js
│       ├── tier2_boundary_corner.test.js
│       ├── tier3_cross_feature.test.js
│       └── tier4_real_world.test.js
├── vitest.config.js
├── package.json
├── TEST_INFRA.md
└── TEST_READY.md
```

### `package.json` Configuration

```json
{
  "name": "corgi-endless-runner",
  "version": "1.0.0",
  "description": "HTML5 Canvas 2D Corgi Endless Runner Game",
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:e2e": "vitest run tests/e2e",
    "test:tier1": "vitest run tests/e2e/tier1_feature_coverage.test.js",
    "test:tier2": "vitest run tests/e2e/tier2_boundary_corner.test.js",
    "test:tier3": "vitest run tests/e2e/tier3_cross_feature.test.js",
    "test:tier4": "vitest run tests/e2e/tier4_real_world.test.js",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "jsdom": "^24.0.0",
    "vitest": "^1.4.0"
  }
}
```

### `vitest.config.js` Configuration

```javascript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/e2e/**/*.test.js'],
    setupFiles: ['./tests/e2e/harness/gameHarness.js'],
    testTimeout: 10000,
  },
});
```

---

## 5. Tiered E2E Test Suite Strategy Alignment

The test harness directly supports the four testing tiers required by `SCOPE.md`:

1. **Tier 1: Feature Coverage (`tier1_feature_coverage.test.js`)**:
   - Canvas 2D initialization & 60 FPS rendering loop setup.
   - Jump control (`Space` / `ArrowUp` keydown triggers jump state & audio).
   - Duck/Slide control (`ArrowDown` keydown triggers crouching hit box).
   - Bone treat collection & score incrementing.
   - Speed acceleration over time.
   - Audio event triggering for jump, pickup, and crash.
   - Overlay state toggles (Start Screen -> Playing -> Pause Screen -> Game Over).

2. **Tier 2: Boundary & Corner Cases (`tier2_boundary_corner.test.js`)**:
   - Extreme/invalid Canvas resize dimensions (e.g. 0x0, 10000x10000).
   - Rapid keypress spamming (100 jump inputs in 10 frames).
   - Simultaneous conflicting inputs (`ArrowUp` + `ArrowDown` at same timestamp).
   - `localStorage` edge cases (corrupted high score string, max integer score, disabled localStorage).
   - Collision box pixel boundary precision (exact 1px overlap vs 1px gap).

3. **Tier 3: Cross-Feature Combinations (`tier3_cross_feature.test.js`)**:
   - Jump input while speed scaling is active.
   - Duck input during treat spawn at high speed.
   - Pause key (`KeyP`) during Game Over screen.
   - Treat pickup audio playing simultaneously with jump audio.
   - Window blur/focus event during active gameplay.

4. **Tier 4: Real-World Application Scenarios (`tier4_real_world.test.js`)**:
   - Full gameplay lifecycle: Start Screen -> Press Start -> Run & dodge 5 obstacles -> Collect 3 treats -> Press Pause -> Resume -> Collision crash -> Game Over overlay -> Click Instant Restart -> Verify score reset & high score persisted in LocalStorage.

---

## 6. Summary of Architectural Decisions

1. **Runner**: Vitest with JSDOM environment.
2. **Canvas Strategy**: Custom Canvas 2D Context Recorder injected into JSDOM `getContext('2d')`.
3. **Time Control**: Virtual clock overriding `requestAnimationFrame` and `performance.now()`.
4. **Input Simulation**: Native DOM `KeyboardEvent` and `TouchEvent` dispatching.
5. **Opaque Boundary**: Tests interact exclusively via `GameTestHarness` facade.
