# Adversarial Challenge Report — Engine Core & State Machine (Milestone M1)

## Challenge Summary

**Overall risk assessment**: MEDIUM

Empirical verification and stress testing of `Engine` (`js/engine.js`) confirmed strong core state machine stability, reliable delta time clamping under tab freeze scenarios, and clean listener unsubscription memory management. However, adversarial analysis surfaced two key risks in timing fallback logic and exception safety in the main loop.

---

## Challenges

### [Medium Risk] Challenge 1: Falsy Timestamp & Fallback Inaccuracy in `_loop`

- **Assumption challenged**: Assumes `timestamp || fallback` correctly handles valid animation frame timestamps passed by `requestAnimationFrame`.
- **Attack scenario**: 
  1. In HTML5 browser environments, initial `requestAnimationFrame` callbacks at document origin can pass `timestamp = 0`.
  2. Because `0` is falsy in JavaScript, `const currentTime = timestamp || (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now())` evaluates to the right-hand operand (`performance.now()`), throwing away `0` and inserting wall-clock time (~seconds or minutes since page load).
  3. Mixing simulated timestamps or zero timestamps with `performance.now()` wall clock creates an artificial spike on frame 1 followed by negative delta time recovery on frame 2.
- **Blast radius**: Initial frame delta time spike or inconsistent frame delta calculation on page launch / mock environments.
- **Mitigation**: Replace `timestamp || fallback` with strict type and NaN check:
  ```js
  const currentTime = (typeof timestamp === 'number' && !isNaN(timestamp))
    ? timestamp 
    : (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  ```

---

### [Medium Risk] Challenge 2: Uncaught Exception in Listener Deadlocks Game Loop

- **Assumption challenged**: Assumes update and render listener callbacks will never throw unhandled exceptions during tick execution.
- **Attack scenario**: 
  1. A game component throws an uncaught Error during `this.update(dt)` or `this.render()`.
  2. Execution aborts before line 99 (`this.rafId = requestAnimationFrame(this._loop);`), so no further animation frames are scheduled.
  3. `this.isRunning` remains `true`.
  4. Subsequent user actions calling `engine.start()` exit immediately (`if (this.isRunning) return;`), leaving the engine permanently stalled until `engine.stop()` is manually invoked.
- **Blast radius**: Complete game loop freeze upon any runtime error in an update/render callback without auto-recovery or restart capability.
- **Mitigation**: Wrap update/render execution in `try ... finally` or clear `isRunning` on unhandled exception in `_loop`:
  ```js
  _loop(timestamp) {
    if (!this.isRunning) return;
    try {
      // time calculation & dispatch ...
      this.update(clampedDelta);
      this.render();
    } catch (err) {
      this.isRunning = false;
      throw err;
    }
    if (this.isRunning) {
      this.rafId = requestAnimationFrame(this._loop);
    }
  }
  ```

---

### [Low Risk] Challenge 3: O(N) Unsubscription Performance in High-Frequency Listener Churn

- **Assumption challenged**: Assumes listener lists are small enough that `Array.prototype.filter` on every unsubscribe call introduces negligible overhead.
- **Attack scenario**: 
  1. A component continuously subscribes and unsubscribes hundreds or thousands of temporary entity listeners per frame.
  2. Unsubscribing calls `this.listeners.update.filter(...)` which iterates over the entire array for each unsub call (O(N²)).
- **Blast radius**: Temporary frame rate drop during heavy particle or entity spawning/despawning if listeners are heavily churned.
- **Mitigation**: For current scope (M1 runner), listener count is small (<50), so impact is low. If entity counts grow large in future milestones, consider `Set` or index-based listener structures.

---

## Stress Test Results

| Test Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| Rapid State Transitions (1000 cycles) | State machine transitions cleanly through 5,000 state changes without corruption | 5,000 state transitions recorded cleanly in order | **PASS** |
| Re-entrant State Transition | Calling `setState(PLAYING)` inside `onStateChange(PAUSED)` updates state immediately | Final state is `PLAYING`, history contains both states | **PASS** |
| Invalid State Resilience | Throwing error on invalid state leaves engine state intact | Invalid state throws exception, current state preserved | **PASS** |
| 5000ms Tab Freeze | Delta time clamped to `0.1s` max, next frame recovers to ~16.6ms | Delta clamped to `0.1s`, subsequent frame recovered to `0.0166s` | **PASS** |
| 60s Extreme Tab Freeze | Delta time clamped to `0.1s` max | Delta clamped to `0.1s` | **PASS** |
| Zero Delta Time (0ms) | `dt === 0`, update listeners receive `0` | `dt === 0` passed to update listeners | **PASS** |
| Negative Delta Time (Clock Skew) | `dt === 0`, `lastTime` updated, no negative physics step | `dt === 0` executed, engine recovered on next tick | **PASS** |
| NaN Timestamp Fallback | Non-numeric timestamp produces non-negative, numeric delta | Fallback executed, numeric delta guaranteed | **PASS** |
| 240 FPS High Frequency Ticks | Ticks calculated accurately (~0.00416s per tick) | All deltas calculated within 0.0001s of target | **PASS** |
| Mass Listener Reg (10,000) | All 10,000 update listeners registered and executed | Array length 10,000, all 10,000 executed in 1 tick | **PASS** |
| Partial Unsubscription (5,000) | Listener list shrinks to 5,000, only active 5,000 execute | Array length 5,000, 5,000 executed | **PASS** |
| Full Unsubscription (10,000) | Listener list shrinks to 0, 0 callbacks execute | Array length 0, 0 callbacks executed | **PASS** |
| Duplicate Listener Cleanup | Unsubscribing shared callback clears all instances | Listener length reduced from 10 to 0 | **PASS** |
| Rapid Subscribe/Unsubscribe Churn | Listener list returns to baseline, no array bloat | baseline length 1 maintained after 1,000 churn cycles | **PASS** |

---

## Unchallenged Areas

- **Canvas 2D Rendering Performance under GPU Load**: Headless unit test environment does not simulate real browser GPU render pipelines, canvas context loss, or hardware acceleration bounds.
