# Iteration 1 Review Feedback & Veto Rationale

## Summary of Gate Failure
Reviewers 1 and 2 issued VETO / REQUEST_CHANGES due to critical HTML integration disconnect, duplicate attributes, and minor game engine resilience bugs.

## Specific Findings to Fix

1. **`index.html` Integration & Fixes (CRITICAL)**:
   - Update `index.html` in project root to properly link `css/style.css` and load `js/main.js` via `<script type="module" src="js/main.js">`.
   - Update canvas container structure: `<div id="game-container"><canvas id="game-canvas" width="800" height="450"></canvas><div id="ui-overlay">...</div></div>`.
   - Remove legacy inline `<style>` and legacy imports (`./src/game.js`).
   - Fix all duplicate `id` attributes (e.g. replace `<div id="scoreDisplay" id="score-display">` with clean `id="score-display"` or consistent naming).

2. **Canvas Context & High-DPI (IMPORTANT)**:
   - Ensure canvas 2D context in `js/main.js` / `js/engine.js` sets `ctx.imageSmoothingEnabled = false` for pixelated rendering.
   - Handle canvas container layout cleanly matching 16:9 aspect ratio (`min(100vw, 177.78vh)`).

3. **Engine Frame 1 & Exception Handling (IMPORTANT)**:
   - In `js/engine.js`, fix frame 1 delta calculation. When `start()` is called, initialize `lastTime = null`. On the first `_loop(timestamp)` frame, set `lastTime = timestamp` and delta = 0 to prevent frame 1 timestamp jumps.
   - In `_loop(timestamp)`, wrap subscriber callbacks (`update` and `render`) in try-catch blocks or handle errors so an uncaught exception does not crash the loop silently while leaving `this.isRunning = true`.

4. **E2E / Test Suite Compatibility**:
   - Ensure `package.json` scripts (`"test"`, `"test:unit"`) run all test suites (`node --test tests/unit/**/*.test.js`) cleanly.
