# Adversarial Challenge Report — Milestone M1 (Engine Loop Lifecycle & Resilience)

**Author**: Challenger 2 (Empirical Challenger)  
**Date**: 2026-07-23  
**Target File**: `js/engine.js`  
**Test Suite**: `tests/unit/engine_loop.test.js`

---

## Challenge Summary

**Overall risk assessment**: **MEDIUM**

The `Engine` implementation in `js/engine.js` exhibits solid idempotency for `start()` and `stop()` lifecycle methods, as well as safe memory behavior when listeners unsubscribe during callback iteration (due to immutable filter array reassignments).

However, an empirical vulnerability was identified in **callback exception resilience**: when an update or render callback throws an uncaught exception during the `requestAnimationFrame` loop, `this.isRunning` remains `true` while loop rescheduling is bypassed. This leaves the engine in a **zombie state** where the loop is dead, but subsequent calls to `engine.start()` silently fail because `start()` checks `if (this.isRunning) return;`.

---

## Empirical Verification Results

| Scenario / Test Case | Description | Verification Method | Status | Finding |
|----------------------|-------------|---------------------|--------|---------|
| **Start Idempotency** | Calling `start()` twice when engine is already running | `Engine Loop - Idempotency of start() when already running` | **PASS** | `if (this.isRunning) return;` prevents duplicate animation frame callbacks from being scheduled. |
| **Stop Idempotency** | Calling `stop()` twice when engine is already stopped | `Engine Loop - Idempotency of stop() when already stopped` | **PASS** | `stop()` cleanly resets `isRunning = false` and clears `rafId` without throwing or causing null reference errors. |
| **Exception handling in `update`/`render`** | Callback throws uncaught exception during `_loop` tick | `Engine Loop - Callback throwing error during update dispatch` & `render dispatch` | **PASS (Test verifies bug)** | Exception halts frame tick and prevents next `requestAnimationFrame`. `isRunning` remains `true`. `start()` cannot restart loop without prior `stop()`. |
| **Self-Unsubscribe during Dispatch** | Listener unsubscribes itself inside callback | `Engine Loop - Self-unsubscribing a listener during update dispatch` | **PASS** | Array re-assignment via `filter` keeps `forEach` iteration on original snapshot safe; no skipped indices or errors. |
| **Peer Unsubscribe during Dispatch** | Listener A unsubscribes Listener B during dispatch | `Engine Loop - Unsubscribing target listener during dispatch (peer unsubscribe)` | **PASS** | Snapshot array executes Listener B on current tick; subsequent ticks exclude Listener B. Safe and predictable. |
| **Dynamic Listener Addition during Dispatch** | Listener A adds Listener C during dispatch | `Engine Loop - Registering new listener during update dispatch` | **PASS** | Listener C is pushed to new array but does not run on current tick snapshot; runs safely on subsequent ticks. |

---

## Detailed Findings & Challenges

### [Medium Risk] Challenge 1: Uncaught Exceptions in Callbacks Freeze Engine in Unrecoverable Zombie State

- **Assumption Challenged**: Game loop will remain operable or recoverable after runtime errors occur within component update/render hooks.
- **Attack Scenario**:
  1. An entity or component callback registered with `onUpdate` or `onRender` throws an unexpected error (e.g. accessing undefined sprite properties, array out of bounds, network/asset loading glitch).
  2. The exception interrupts `Engine._loop()`. Line 99 (`this.rafId = requestAnimationFrame(this._loop)`) is never reached.
  3. `this.isRunning` remains `true`.
  4. The game loop stops rendering and updating.
  5. If game UI or error handling logic tries to restart the engine by calling `engine.start()`, `start()` sees `this.isRunning === true` and immediately returns without queuing a new `requestAnimationFrame`.
- **Blast Radius**: Engine is locked in a dead state until `engine.stop()` is explicitly called before `engine.start()`.
- **Mitigation Recommendation**:
  Wrap the `update` and `render` dispatches inside `_loop()` with `try...catch` or `try...finally`:
  ```javascript
  _loop(timestamp) {
    if (!this.isRunning) return;

    try {
      // delta calculations...
      this.update(clampedDelta);
      this.render();
    } catch (err) {
      this.isRunning = false;
      this.rafId = null;
      console.error('Engine loop exception:', err);
      throw err;
    }

    if (this.isRunning) {
      this.rafId = requestAnimationFrame(this._loop);
    }
  }
  ```

---

## Stress Test Results

- **`node --test tests/unit/engine_loop.test.js`**: 7/7 tests passed.
- **`npm test`**: 14/14 tests passed (7 baseline + 7 adversarial engine loop tests).

---

## Unchallenged Areas

- **WebGL / 3D Canvas context**: Out of scope for M1 (M1 is 2D Canvas).
- **Multi-canvas rendering**: Current scope assumes a single main 2D canvas context.
