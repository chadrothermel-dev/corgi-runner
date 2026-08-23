# Challenge Report — E2E Test Harness Stress-Testing

**Agent**: Challenger 2 (`teamwork_preview_challenger_e2e_2`)  
**Track**: E2E Testing Track  
**Project**: E2E Corgi Endless Runner  
**Target Files**:
- `tests/e2e/harness/gameHarness.js`
- `tests/e2e/harness/canvasMock.js`
- `tests/e2e/harness/audioMock.js`
- `tests/e2e/harness/timeMock.js`

---

## Challenge Summary

**Overall risk assessment**: **HIGH**

Empirical stress testing of the E2E test harness components revealed **8 concrete failure modes/flaws** across virtual clock frame stepping, audio event timestamping, canvas context mocking, input event dispatching, and LocalStorage test isolation. 

While virtual clock stepping performance (**50,000 frames in 20.3ms**) and DOM inspection speed (**10,000 query batches in < 1ms**) are excellent, key determinism and state isolation defects pose risks of flakiness and inaccurate assertions.

---

## Challenges & Failure Modes Found

### 1. [HIGH] In-Flight rAF Cancellation Bug in VirtualClock (`timeMock.js`)

- **Assumption challenged**: Cancelling a pending `requestAnimationFrame` callback during frame execution (via `cancelAnimationFrame`) prevents that callback from executing in the current frame.
- **Attack scenario**: Callback A (executed first in a frame) calls `cancelAnimationFrame(idB)` for Callback B (scheduled in the same frame).
- **Blast radius**: `VirtualClock.step()` snapshots callbacks into `Array.from(this.rafCallbacks.entries())` before entering the loop. `cancelAnimationFrame(idB)` removes `idB` from `this.rafCallbacks` Map, but does NOT remove `[idB, cbB]` from the snapshotted array. Callback B STILL executes despite having been cancelled, mutating state unexpectedly.
- **Empirical Proof (`EMP-CLK-01`)**:
  ```js
  const id1 = window.requestAnimationFrame(() => { window.cancelAnimationFrame(id2); });
  const id2 = window.requestAnimationFrame(() => { cb2Executed = true; });
  clock.step(16.667);
  // Result: cb2Executed was TRUE (Expected FALSE).
  ```
- **Mitigation**: Update `VirtualClock.step()` to check `if (this.rafCallbacks.has(id))` before invoking `cb(this.currentTime)`.

---

### 2. [HIGH] Non-Deterministic Wall-Clock Timestamps in Audio Logs (`audioMock.js` & `src/audio.js`)

- **Assumption challenged**: Audio event log timestamps synchronize with virtual clock time during frame-stepping.
- **Attack scenario**: A test steps 6,000 frames (100 virtual seconds) between two audio triggers (`jump` at 0s, `collect` at 100s).
- **Blast radius**: `AudioSystem.play()` and `audioMock.js` record timestamps using real wall-clock `Date.now()` rather than virtual clock time (`performance.now()`). When stepping 100 virtual seconds in 35ms of wall-clock execution time, the logged audio timestamp delta is **35ms** (not 100,000ms), breaking test determinism across different machine CPUs and runner speeds.
- **Empirical Proof (`EMP-CLK-02`)**:
  ```js
  AudioSystem.play('jump');
  harness.stepFrames(6000, 16.667); // 100,000ms virtual time
  AudioSystem.play('collect');
  // Result: timestamp delta was 35ms (Expected >= 99,000ms).
  ```
- **Mitigation**: Replace `Date.now()` with `window.performance.now()` in `AudioSystem.play()` and `audioMock.js`.

---

### 3. [HIGH] Memory Leak via Unbounded `drawCalls` Array Growth in `canvasMock.js`

- **Assumption challenged**: Running multi-thousand frame simulation loops or endurance test suites maintains stable memory usage.
- **Attack scenario**: Stepping 5,000+ frames during long game simulations.
- **Blast radius**: `CanvasMock2D` appends draw call descriptors to `this.drawCalls` without per-frame clearing or upper-bound caps. Stepping 5,000 frames accumulated **70,000 objects** in `drawCalls`. Long test runs will experience significant memory growth and degraded test runner performance.
- **Empirical Proof (`EMP-CAN-01`)**:
  ```js
  harness.stepFrames(5000);
  // Result: harness.getRenderedDrawCalls().length reached 70,000 objects.
  ```
- **Mitigation**: Clear `drawCalls` at the beginning of each frame step or provide a fixed rolling window buffer option.

---

### 4. [MEDIUM] Canvas 2D State Stack (`save()` / `restore()`) Non-Conformity (`canvasMock.js`)

- **Assumption challenged**: Calling `ctx.restore()` reverts canvas context properties (`fillStyle`, `strokeStyle`, `font`, `globalAlpha`) to their pre-`save()` values.
- **Attack scenario**: Render code calls `ctx.fillStyle = '#FF0000'`, `ctx.save()`, sets `ctx.fillStyle = '#00FF00'`, and calls `ctx.restore()`.
- **Blast radius**: `CanvasMock2D` only pushes `{ type: 'save' }` and `{ type: 'restore' }` strings into `drawCalls`. It does NOT maintain a state stack. After `restore()`, `ctx.fillStyle` remains `#00FF00` instead of reverting to `#FF0000`, causing invalid color rendering state in tests inspecting context properties.
- **Empirical Proof (`EMP-CAN-02`)**:
  ```js
  ctx.fillStyle = '#FF0000';
  ctx.save();
  ctx.fillStyle = '#00FF00';
  ctx.restore();
  // Result: ctx.fillStyle was '#00FF00' (Expected '#FF0000').
  ```
- **Mitigation**: Implement a internal state stack array in `CanvasMock2D` that saves and pops style properties on `save()` and `restore()`.

---

### 5. [MEDIUM] `drawImage` Argument Overload Signature Mismatch (`canvasMock.js`)

- **Assumption challenged**: `CanvasMock2D.drawImage` correctly parses all W3C Canvas 2D `drawImage` overloads (3, 5, and 9 argument signatures).
- **Attack scenario**: Code calls 9-argument `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`.
- **Blast radius**: `CanvasMock2D.drawImage(img, dx, dy, dw, dh)` only accepts 5 parameters. When called with 9 arguments, source position parameters (`sx, sy`) are mapped to `dx, dy` in the log object, completely discarding actual destination coordinates `dx=100, dy=200`.
- **Empirical Proof (`EMP-CAN-03`)**:
  ```js
  ctx.drawImage(img, 10, 20, 30, 40, 100, 200, 300, 400);
  // Result: log.dx was 10, log.dy was 20 (Expected dx=100, dy=200).
  ```
- **Mitigation**: Overload `drawImage` in `CanvasMock2D` to check `arguments.length` and correctly populate destination `dx, dy, dw, dh` and source `sx, sy, sw, sh`.

---

### 6. [MEDIUM] `pressKey` Synchronous Release Flaw for Stateful Hold Keys (`gameHarness.js`)

- **Assumption challenged**: `harness.pressKey(code)` can be used to simulate hold-state inputs like ducking (`ArrowDown`).
- **Attack scenario**: Test calls `harness.pressKey('ArrowDown')` followed by `harness.stepFrame()`.
- **Blast radius**: `pressKey` executes `keyDown` then `keyUp` synchronously in the same microtask. `handleKeyUp` immediately sets `this.player.isDucking = false`. When `stepFrame()` runs physics, ducking is already `false`, making `pressKey('ArrowDown')` completely ineffective for testing ducking mechanics.
- **Empirical Proof (`EMP-EVT-01`)**:
  ```js
  harness.pressKey('ArrowDown');
  harness.stepFrame();
  // Result: player.isDucking was FALSE (Expected TRUE during ducking frame).
  ```
- **Mitigation**: Document that hold-state actions require `keyDown('ArrowDown')`, stepping frames, then `keyUp('ArrowDown')`.

---

### 7. [LOW] LocalStorage Setup Pollution on Unclean Teardown (`gameHarness.js`)

- **Assumption challenged**: Calling `GameTestHarness.setup()` guarantees a clean, unpolluted LocalStorage state.
- **Attack scenario**: A preceding test throws an exception before reaching `teardown()`.
- **Blast radius**: `setup()` does not call `localStorage.clear()`; only `teardown()` does. The newly initialized test harness reads leftover high scores from previous crashed tests, leading to cascading test suite failures.
- **Empirical Proof (`EMP-STO-01`)**:
  ```js
  localStorage.setItem('corgi_runner_highscore', '9999');
  const freshHarness = new GameTestHarness();
  await freshHarness.setup();
  // Result: freshHarness.game.highScore was 9999 (Expected 0).
  ```
- **Mitigation**: Add `localStorage.clear()` inside `GameTestHarness.setup()` as well as `teardown()`.

---

### 8. [LOW] Touch Event Interface Type Mismatch (`gameHarness.js`)

- **Assumption challenged**: `harness.touchStart()` dispatches a standard `TouchEvent`.
- **Attack scenario**: Code or test checks `e instanceof TouchEvent`.
- **Blast radius**: `touchStart` instantiates `new CustomEvent('touchstart')` instead of `TouchEvent`. Strict type checks for `TouchEvent` fail.
- **Empirical Proof (`EMP-EVT-03`)**:
  ```js
  harness.touchStart(canvas, [{ clientX: 200, clientY: 150 }]);
  // Result: event constructor was 'CustomEvent' (Expected 'TouchEvent').
  ```
- **Mitigation**: Use `new TouchEvent('touchstart', ...)` when `window.TouchEvent` is defined in JSDOM.

---

## Stress Test Results Table

| ID | Test Scenario | Target Component | Expected Behavior | Empirical Result | Status |
|---|---|---|---|---|---|
| `EMP-CLK-01` | rAF cancellation during frame step | `timeMock.js` | Cancelled rAF callback should NOT fire | Callback FIRED (`cb2Executed: true`) | ❌ **FAIL (Bug Confirmed)** |
| `EMP-CLK-02` | Virtual clock vs audio timestamp delta | `audioMock.js` & `audio.js` | Timestamp delta matches virtual time (100s) | Delta was 35ms (wall-clock) | ❌ **FAIL (Bug Confirmed)** |
| `EMP-CLK-03` | Frame stepping performance scaling | `timeMock.js` | 50,000 frames stepped smoothly | 50,000 frames in 20.3ms (2.4M FPS) | ✅ **PASS** |
| `EMP-CAN-01` | Memory leak via `drawCalls` accumulation | `canvasMock.js` | Draw calls bounded / reset per frame | 70,000 objects accumulated in 5k frames | ❌ **FAIL (Bug Confirmed)** |
| `EMP-CAN-02` | Canvas state stack `save()` / `restore()` | `canvasMock.js` | Properties revert on `restore()` | Property retained modified value | ❌ **FAIL (Bug Confirmed)** |
| `EMP-CAN-03` | 9-argument `drawImage` overload | `canvasMock.js` | `dx, dy` map to destination (100, 200) | `dx, dy` mapped to source (10, 20) | ❌ **FAIL (Bug Confirmed)** |
| `EMP-EVT-01` | `pressKey('ArrowDown')` hold key state | `gameHarness.js` | Player stays ducked for step frame | Player ducking released before step | ❌ **FAIL (Bug Confirmed)** |
| `EMP-EVT-02` | Event listener accumulation cycle | `gameHarness.js` | 1 handler per event after setup/teardown | 1 handler per event | ✅ **PASS** |
| `EMP-EVT-03` | Touch event class interface | `gameHarness.js` | Event is `TouchEvent` | Event is `CustomEvent` | ❌ **FAIL (Bug Confirmed)** |
| `EMP-STO-01` | LocalStorage clean state on setup | `gameHarness.js` | Fresh setup has 0 high score | Fresh setup inherited 9999 | ❌ **FAIL (Bug Confirmed)** |
| `EMP-DOM-01` | DOM inspection query performance | `gameHarness.js` | 10,000 query batches under 2s | Completed in < 1ms | ✅ **PASS** |

---

## Unchallenged / Out of Scope Areas

- **WebGL / 3D Canvas Rendering**: Out of scope (game uses 2D Canvas context only).
- **Network / Remote Fetch Mocking**: Out of scope (game is fully local client-side offline HTML5 canvas game).
