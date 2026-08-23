# Changes Log — Milestone M1 Iteration 2 Remediation

**Agent**: Worker 2 (Implementer / QA / Specialist)  
**Date**: 2026-07-24  
**Project**: Corgi Endless Runner  

---

## 1. Summary of Changes

All remediation items identified in `.agents/explorer_m1_4/remediation_plan.md` have been fully implemented and verified. 100% of unit test cases pass.

---

## 2. File-by-File Detailed Changes

### `index.html` (Project Root)
- **CSS Link**: Removed legacy inline `<style>` block (lines 7–65) and added `<link rel="stylesheet" href="css/style.css">`.
- **Canvas Aspect Ratio**: Changed `<canvas id="gameCanvas" width="800" height="400">` to `<canvas id="game-canvas" width="800" height="450">` for true 16:9 widescreen layout.
- **Container Structure**: Wrapped canvas and UI overlays inside `<div id="game-container">`.
- **UI Overlay Wrapper**: Added `<div id="ui-overlay">` wrapping HUD (`#hud`) and modal overlays (`#start-screen`, `#pause-screen`, `#game-over-screen`).
- **Duplicate ID Cleanup**: Fixed invalid HTML markup where elements had duplicate `id` attributes (e.g. `<div id="startScreen" id="start-screen">` changed to `<div id="start-screen">`).
- **Module Script Entry**: Replaced legacy inline script importing `./src/game.js` with `<script type="module" src="js/main.js"></script>`.

### `css/style.css`
- **Dark Aesthetic & Reset**: Configured base box-sizing reset, dark background (`#0d0e15`), retro monospace font (`'Courier New'`), and flex centering.
- **Responsive 16:9 Container**: Configured `#game-container` with aspect ratio rules (`width: 100vw; height: 56.25vw; max-width: 177.78vh; max-height: 100vh`) and dark viewport background (`#1a1a2e`).
- **Pixelated Canvas Rendering**: Added `image-rendering: pixelated; crisp-edges; -moz-crisp-edges;` to `#game-canvas`.
- **Overlay Layout & Pointer Events**: Added rules for `#ui-overlay` (`pointer-events: none`), `.overlay` (`background: rgba(0, 0, 0, 0.7)`), `.hidden` (`display: none !important`), `#hud`, and styled retro buttons with hover state (`#ff8c00` / `#ffa500`).

### `js/engine.js`
- **Frame 1 Timestamp Jump Prevention**:
  - Initialized `this.lastTime = null` in constructor and `start()`.
  - In `_loop(timestamp)`: Check `if (this.lastTime === null) { this.lastTime = currentTime; clampedDelta = 0; }` on frame 1 tick.
- **Subscriber Exception Safety & Error Recovery**:
  - Wrapped `this.update(clampedDelta)` and `this.render()` inside `try { ... } catch (error) { this.stop(); throw error; }`.
  - On subscriber exception, `this.stop()` is invoked, setting `this.isRunning = false` and canceling queued RAF callbacks, preventing dead zombie engine states and allowing subsequent `start()` calls to restart the engine cleanly.

### `js/main.js`
- Verified canvas element lookup (`#game-canvas`), 2D context retrieval with `imageSmoothingEnabled = false`, window resize event handler re-enforcing crisp pixel rendering, and engine loop launch (`engine.start()`).

### `tests/unit/engine.test.js` & `tests/unit/engine_loop.test.js`
- Added unit test in `engine.test.js` verifying frame 1 `deltaTime` is `0` when `lastTime` is `null`.
- Added unit test in `engine.test.js` verifying subscriber exception recovery (`this.isRunning` becomes `false`, RAF queue cleared, subsequent `engine.start()` restarts engine loop).
- Updated exception assertions in `engine_loop.test.js` to align with remediated error recovery.

---

## 3. Verification Results

- **Unit Tests**: `npm run test:unit` -> 30 passing tests (100% pass rate).
- **Vitest E2E Feature Tests**: Tier 1, Tier 2, Tier 3, and Tier 4 feature coverage tests passing.
