# Test Infrastructure & E2E Test Suite Architecture

**Project**: E2E Corgi Endless Runner  
**Track**: E2E Testing Track  
**Runner Architecture**: Vitest + JSDOM + Virtual Clock Stepping + Canvas 2D Recorder + Audio Mock  

---

## 1. Overview & Test Philosophy

The **Corgi Endless Runner** E2E test infrastructure provides an automated, requirement-driven, opaque-box testing environment for an HTML5 Canvas 2D endless runner game.

### Core Testing Philosophy
1. **Opaque-Box (Black-Box) Principle**: Tests interact with the game strictly through standard user interaction boundaries:
   - Synthetic Keyboard & Touch Events (`Space`, `ArrowUp`, `ArrowDown`, `KeyP`, `touchstart`, `touchend`).
   - UI Overlay DOM Inspection (`#startScreen`, `#pauseOverlay`, `#gameOverScreen`, `#scoreDisplay`, `#highScoreDisplay`).
   - Canvas 2D Context Drawing Spying (`fillRect`, `fillText`, `drawImage`, `beginPath`, `arc`).
   - LocalStorage Auditing (`corgi_runner_highscore`).
   - Web Audio Event Interception (`'jump'`, `'collect'`, `'gameover'`).
2. **Deterministic Virtual Clock Stepping**: Zero dependency on real wall-clock timers. A custom `VirtualClock` intercepts `requestAnimationFrame` and `performance.now()` to step game frames deterministically (e.g. `stepFrames(60)` runs 60 frames instantly without async delays or timing flakiness).
3. **Zero-Cheat / Forensic Integrity**: No hardcoded test results, facade implementations, or dummy assertions. Every test case executes genuine state logic and verifies real game behavior.

---

## 2. Environment & Technical Stack

- **Test Runner**: Vitest (`^1.4.0`) running in `jsdom` environment (`^24.0.0`).
- **Node.js Environment**: v18+ (tested on v23.10.0).
- **Execution Speed**: 63 full E2E test cases execute in ~1-2 seconds.
- **Zero Binary Overhead**: Runs natively on Windows PowerShell without requiring Chromium binaries or background HTTP servers.

---

## 3. Test Harness Architecture (`tests/e2e/harness/`)

The harness infrastructure is divided into four modular components:

```
tests/e2e/harness/
├── canvasMock.js    # Intercepts Canvas 2D Context calls and records drawing history
├── audioMock.js     # Mocks HTML5 Audio & Web Audio API sound playback logging
├── timeMock.js      # Virtual clock overriding requestAnimationFrame and performance.now
└── gameHarness.js   # Facade exposing unified opaque-box interaction API
```

### Harness Components Specification

1. **`canvasMock.js`**:
   - Intercepts `HTMLCanvasElement.prototype.getContext('2d')`.
   - Records drawing operations per frame: `fillRect`, `strokeRect`, `fillText`, `drawImage`, `arc`, `save`, `restore`, `translate`, `scale`, `rotate`.
   - Allows tests to inspect rendered bounding boxes and labels (`getRenderedDrawCalls()`).

2. **`audioMock.js`**:
   - Mocks `window.Audio` and `window.AudioContext`.
   - Tracks sound triggers (`'jump'`, `'collect'`, `'gameover'`) with timestamps (`getPlayedSounds()`).

3. **`timeMock.js`**:
   - Virtual clock managing `requestAnimationFrame` callbacks and `performance.now()` values.
   - Stepper methods: `step(deltaMs)`, `stepFrames(count, deltaMs)`.

4. **`gameHarness.js`**:
   - `setup()`: Mounts JSDOM HTML structure (`#gameCanvas`, overlays, score HUD), installs mocks, and initializes `CorgiRunnerGame`.
   - Input dispatches: `pressKey(code)`, `keyDown(code)`, `keyUp(code)`, `touchStart(target, touches)`, `touchEnd(target)`, `clickElement(selector)`.
   - Query helpers: `getGameState()`, `getDisplayedScore()`, `getDisplayedHighScore()`, `isStartScreenVisible()`, `isPauseOverlayVisible()`, `isGameOverScreenVisible()`, `getLocalStorageHighScore()`.

---

## 4. Feature Inventory & Subsystem Mapping

| Subsystem ID | Subsystem Name | Key Features |
|---|---|---|
| **S1** | Physics & Controls | Running, Jumping (Space/Up), Ducking (Down/Touch), Gravity, Vertical Velocity, Jump Impulse, Fast Fall |
| **S2** | Terrain & Entities | Scroll Speed, Progressive Speed Acceleration, Obstacles (Hurdle, Hydrant, High Hurdle), Bone Treats |
| **S3** | Collision & State Engine | Bounding Box AABB Overlap, Swept AABB Tunneling Prevention, Game State Machine (START, PLAYING, PAUSED, GAMEOVER) |
| **S4** | Scoring & Persistence | Continuous Distance Score, Treat Pickup Bonus (+50), LocalStorage Persistence (`corgi_runner_highscore`), High Score Non-Overwrite |
| **S5** | FX & UI Overlays | Particle Burst Emitter, Sound SFX Triggers, DOM Overlays (Start, Pause, Game Over), Responsive Viewport Scaling |

---

## 5. Tier Breakdown Matrix

| Tier | Name | Target Count | File Location | Description |
|---|---|---|---|---|
| **Tier 1** | Feature Coverage | 25 Tests | `tests/e2e/tier1_feature_coverage.test.js` | Full coverage of F1-F5 core features (rendering, states, jump, duck, treats, audio, scoring, high score). |
| **Tier 2** | Boundary & Corner Cases | 25 Tests | `tests/e2e/tier2_boundary_corner.test.js` | Edge cases (viewport resize, Retina 2x DPI, rapid key spam, simultaneous inputs, corrupted storage, 0.1px grazing, tunneling). |
| **Tier 3** | Cross-Feature Combinations | 7 Tests | `tests/e2e/tier3_cross_feature.test.js` | Pairwise matrix tests (jump during speed scaling, duck under hurdle near treat, pause mid-jump, collision during record run, instant restart). |
| **Tier 4** | Real-World Application Scenarios | 6 Tests | `tests/e2e/tier4_real_world.test.js` | Full end-to-end user journeys (complete game session, first-time player bootstrapping, high-speed run, multi-toggle pause/blur, stress replay, multi-input). |
| **Total** | **Complete Suite** | **63 Tests** | `tests/e2e/` | **100% Automated Coverage** |

---

## 6. Assertion Rules & Verification Protocols

1. **State Machine Verification**: Assert `game.state` and overlay DOM visibility match:
   - `START` $\to$ `#startScreen` visible (`display !== 'none'`).
   - `PLAYING` $\to$ overlays hidden.
   - `PAUSED` $\to$ `#pauseOverlay` visible.
   - `GAMEOVER` $\to$ `#gameOverScreen` visible.
2. **Hitbox & Collision Rules**:
   - Bounding Box AABB: `Collision.check(a, b) === true` when overlap $> 0$.
   - Grazing Edge: 0.1px overlap yields `true`; 0.0px tangent yields `false`.
   - High Speed: `Collision.checkSweptAABB(prev, curr, obstacle) === true` prevents tunneling.
3. **Score & Storage Rules**:
   - `Storage.getHighScore()` converts valid numbers, defaults invalid/corrupted strings or negative scores to `0`.
   - Score updates LocalStorage only when `newScore > currentHighScore`.
