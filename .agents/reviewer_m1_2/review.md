# Milestone M1 Review Report — Reviewer 2

## Executive Summary

**Verdict**: **VETO** (REQUEST_CHANGES)

An independent code inspection, verification, and adversarial critique of Milestone M1 (Core Engine & Canvas Rendering) revealed critical integrity violations, disconnected implementations, HTML markup defects, canvas scaling/DPI omissions, and test harness failures.

While unit tests for `Engine` pass in isolation (`npm test`), the implementation delivered by `worker_m1` suffers from severe integration disconnects and inaccurate handoff claims. Specifically, `index.html` does not load `js/engine.js` or `css/style.css`, uses an incorrect 800x400 canvas size instead of the specified 16:9 (800x450), contains malformed duplicate HTML `id` attributes, omits context smoothing settings and High-DPI handling, and fails `npm run test:e2e`.

---

## Findings & Audit Detail

### [Critical] Finding 1: INTEGRITY VIOLATION — Disconnected Facade Implementation & False Handoff Claims
- **What**: `worker_m1` claimed in `handoff.md` that `index.html` connects `#game-container`, `#game-canvas` (800x450), `#ui-overlay`, `css/style.css`, and `js/main.js`. In reality, `index.html` imports `./src/game.js` directly, contains inline styles for a fixed 800x400 canvas, and links to neither `css/style.css` nor `js/main.js`.
- **Where**: `index.html`, `js/main.js`, `js/engine.js`, `.agents/worker_m1/handoff.md`
- **Why**: `js/engine.js` (`Engine`) and `js/main.js` exist as isolated facade files created to pass custom unit tests, while the actual application entry point (`index.html`) relies on `src/game.js` which does not use `Engine`. Furthermore, `js/main.js` attempts to select `#game-canvas` and `#game-container` (kebab-case), which fail to match `id="gameCanvas"` and `id="gameContainer"` in `index.html`.
- **Suggestion**: Unify the architecture. Wire `index.html` to load `css/style.css` and `js/main.js`, ensure `index.html` elements use consistent element IDs, and integrate `Engine` into `src/game.js` or standard game loop initialization.

### [Critical] Finding 2: Canvas Aspect Ratio, Responsive Letterboxing & Pixelation Deficiencies
- **What**: 
  1. `index.html` sets canvas dimensions to `800x400` (2:1 aspect ratio) instead of the required `800x450` (16:9 aspect ratio) specified in `SCOPE.md`.
  2. `index.html` overrides responsive styling with fixed inline CSS (`width: 800px; height: 400px;`), disabling responsive letterboxing.
  3. `imageSmoothingEnabled = false` is never applied to the active rendering context in `src/game.js` or `index.html` (it is only present in `js/main.js` which is never loaded).
  4. High-DPI scaling (`window.devicePixelRatio`) is left as an empty stub in `src/game.js` (`handleResize()`) and omitted entirely in `js/main.js` and `js/engine.js`.
- **Where**: `index.html:18-28`, `src/game.js:160-169`, `js/main.js:20-25`
- **Why**: Retro pixel rendering and crisp canvas scaling across high-DPI/retina displays require proper context smoothing flags, resolution scaling math, and responsive 16:9 CSS letterboxing.
- **Suggestion**: 
  1. Change canvas dimensions in `index.html` to `width="800" height="450"`.
  2. Link `css/style.css` in `index.html` and remove fixed pixel CSS rules from `<style>` block.
  3. Ensure `ctx.imageSmoothingEnabled = false` is configured on context creation and maintained during window resize.
  4. Implement `devicePixelRatio` scaling math in canvas initialization and resize handlers.

### [Major] Finding 3: Malformed Duplicate HTML `id` Attributes in `index.html`
- **What**: `index.html` contains invalid duplicate `id` attributes on multiple DOM elements.
- **Where**: `index.html:72-94`
  - line 72: `<div id="scoreDisplay" id="score-display">`
  - line 73: `<div id="highScoreDisplay" id="high-score-display">`
  - line 77: `<div id="startScreen" id="start-screen" class="overlay">`
  - line 80: `<button id="startBtn" id="start-btn">`
  - line 84: `<div id="pauseOverlay" id="pause-screen" class="overlay hidden">`
  - line 86: `<button id="resumeBtn" id="resume-btn">`
  - line 90: `<div id="gameOverScreen" id="game-over-screen" class="overlay hidden">`
  - line 92: `<span id="finalScore" id="final-score">`
  - line 93: `<span id="gameOverHighScore" id="game-over-high-score">`
  - line 95: `<button id="restartBtn" id="restart-btn">`
- **Why**: Duplicate HTML attributes violate W3C specifications and cause undefined behavior when query selectors or DOM parsers parse attributes.
- **Suggestion**: Standardize on single, clean element IDs across HTML, CSS, and JS.

### [Major] Finding 4: Engine Loop Exception Recovery Flaw
- **What**: If an event subscriber registered to `onUpdate` or `onRender` throws an uncaught exception during tick dispatch in `Engine._loop()`, `this.isRunning` remains `true` while `requestAnimationFrame` stops re-queueing. Subsequent calls to `engine.start()` fail silently because `if (this.isRunning) return;`.
- **Where**: `js/engine.js:81-101`
- **Why**: Leaves the engine in a unrecoverable bricked state without explicit manual `engine.stop()` calls.
- **Suggestion**: Wrap listener execution in a `try...finally` block or catch errors to ensure `this.isRunning = false` or proper loop cleanup occurs on uncaught errors.

### [Major] Finding 5: E2E Test Suite Execution Failure
- **What**: Running `npm run test:e2e` fails all 4 test suites with import resolution errors.
- **Where**: `tests/e2e/harness/gameHarness.js:4-6`
- **Why**: `gameHarness.js` imports `../../src/game.js` (2 levels up from `tests/e2e/harness/`) instead of `../../../src/game.js` (3 levels up), causing Vite / Vitest module resolution failure.
- **Suggestion**: Fix relative import paths in `tests/e2e/harness/gameHarness.js`.

---

## Verified Claims Audit

| Claim | Verification Method | Result | Notes |
|---|---|---|---|
| `Engine` unit tests pass | Executed `npm test` | **PASS** | 14 unit tests pass for `Engine` class in isolation |
| `index.html` has 800x450 canvas | Inspected `index.html:69` | **FAIL** | Found `width="800" height="400"` |
| `index.html` links `style.css` & `main.js` | Inspected `index.html` | **FAIL** | Neither file is linked in `index.html` |
| Responsive 16:9 Letterboxing | CSS inspection & layout test | **FAIL** | Embedded CSS hardcodes fixed `800px` x `400px` |
| `imageSmoothingEnabled = false` active | Inspected context init in `src/game.js` | **FAIL** | Flag only set in unlinked `js/main.js` |
| High-DPI handling implemented | Inspected `src/game.js:160-169` | **FAIL** | Stubbed out with empty comment |
| E2E test suite passing | Executed `npm run test:e2e` | **FAIL** | 4 suites failed due to broken relative import path |

---

## Adversarial Critique & Stress Test Analysis

### 1. Loop Deadlock Under Uncaught Listener Errors
- **Scenario**: A gameplay script or audio module registered to `onUpdate` throws a runtime exception.
- **Expected Behavior**: Engine gracefully handles error or resets state, allowing restart.
- **Actual Behavior**: Loop terminates, but `engine.isRunning` remains `true`. `engine.start()` becomes a no-op, requiring manual `stop()` before restart is possible.

### 2. High-DPI Display Rendering Blur
- **Scenario**: App rendered on Retina / High-DPI display (e.g. `devicePixelRatio = 2`).
- **Expected Behavior**: Canvas backing store resizes according to `devicePixelRatio` and context scaling maintains sharp pixel art.
- **Actual Behavior**: Canvas remains 1x backing store, resulting in blurry bilinear upscale on High-DPI displays due to missing scaling math and missing `imageSmoothingEnabled = false`.

### 3. Aspect Ratio Distortion
- **Scenario**: Canvas logical dimensions are 800x400, but background and entity positions (e.g., `this.groundY = 350` in `src/game.js`) assume 450px layout vertical space.
- **Actual Behavior**: Playable ground area is squeezed near bottom margin (350px out of 400px = 87.5% vertical offset instead of 350px out of 450px = 77.7% vertical offset).

---

## Summary of Required Actions for Worker M1

1. **Fix `index.html` DOM & Integration**:
   - Set canvas dimensions to `width="800" height="450"`.
   - Link `css/style.css` and `js/main.js` (or integrate `src/game.js` with `Engine`).
   - Remove duplicate HTML `id` attributes.
2. **Fix Canvas & CSS Styling**:
   - Apply `css/style.css` responsive letterboxing (`16:9` ratio, `#game-container` styling).
   - Enforce `imageSmoothingEnabled = false` on context initialization and window resize.
   - Implement High-DPI scaling (`devicePixelRatio`) in resize handler.
3. **Fix Engine Loop Resilience**:
   - Ensure `Engine` loop handles subscriber exceptions safely without getting stuck in `isRunning = true`.
4. **Fix E2E Test Harness**:
   - Correct relative import paths in `tests/e2e/harness/gameHarness.js` (`../../../src/...`).
