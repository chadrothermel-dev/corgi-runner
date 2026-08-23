# E2E Test Suite Analysis & Specification Report (Tiers 3 & 4 + Doc Specifications)

**Author:** Explorer 3 (`teamwork_preview_explorer_e2e_3`)  
**Track:** E2E Testing Track — Corgi Endless Runner  
**Date:** 2026-07-23  

---

## 1. Executive Summary & Scope Overview

This report provides comprehensive architectural specifications for **Tier 3 (Cross-Feature Combinations)** and **Tier 4 (Real-World Application Scenarios)** automated end-to-end (E2E) tests for the **Corgi Endless Runner** HTML5 Canvas game. Additionally, it defines the structural blueprints for `TEST_INFRA.md` and `TEST_READY.md` to guide the implementation worker and verification agents.

### Scope Alignment
- **`ORIGINAL_REQUEST.md` Requirements Covered:**
  - R1: Core Game Mechanics (Run, Jump, Duck/Slide, Obstacles, Bone Treat Collection, Speed Scaling, Bounding Box Collisions)
  - R2: Scoring & Persistence (Real-Time Score, LocalStorage High Score, Particle Effects, Sound Effects)
  - R3: UI & Game States (Start Screen, Pause Overlay, Game Over Overlay, Replay/Restart)
- **`SCOPE.md` Deliverables Covered:**
  - Tier 3: Cross-Feature Combinations (Pairwise matrix: >= 5 tests)
  - Tier 4: Real-World Application Scenarios (Full gameplay cycles: >= 5 scenarios)
  - Architectural blueprints for `TEST_INFRA.md` and `TEST_READY.md`

---

## 2. Feature Interaction Analysis & Pairwise Matrix Methodology

To guarantee opaque-box test thoroughness without internal code dependence, features are categorized into five core subsystems:

| Subsystem ID | Subsystem Name | Key Variables / Triggers |
|--------------|----------------|--------------------------|
| **S1** | Physics & Controls | Running, Jumping (Space/Up), Ducking/Sliding (Down), Y-position, Vertical Velocity |
| **S2** | Terrain & Difficulty | Horizontal Scroll Speed, Speed Scaling Rate, Obstacle Spawning, Treat Spawning |
| **S3** | Collision & State Engine | Bounding Box Overlap (AABB), Game State Transitions (START, RUNNING, PAUSED, GAME_OVER) |
| **S4** | Scoring & Persistence | Current Score, High Score, LocalStorage Read/Write (`corgi_runner_highscore`) |
| **S5** | FX & UI Overlays | Particle Bursts, SFX Triggers, Canvas Overlays (Start, Pause, Game Over) |

---

## 3. Tier 3: Cross-Feature Combination Specifications (Pairwise Feature Matrix)

Tier 3 tests validate that independent features operate correctly when activated simultaneously or in rapid sequence.

### Specification T3.1: Jump Physics During Dynamic Speed Scaling
- **Feature Pair:** S1 (Jump Physics) x S2 (Speed Scaling)
- **Objective:** Verify that jump trajectory (airtime, peak height, gravity acceleration) remains stable and deterministic while horizontal ground speed continuously scales up.
- **Input Sequence:**
  1. Initialize game in `RUNNING` state at base speed $v_0 = 1.0x$.
  2. Advance virtual clock until speed multiplier scales to $v_1 = 2.5x$.
  3. Dispatch `KeyDown('Space')` to trigger jump.
- **Expected Results:**
  - Corgi vertical position $y(t)$ follows identical quadratic trajectory $y(t) = y_0 + v_y t - \frac{1}{2}g t^2$ regardless of speed multiplier $v$.
  - Bounding box dimensions remain constant $(W \times H)$ while terrain scroll rate matches scaled velocity $v_1$.
  - Landing occurs cleanly on ground plane $y = y_{\text{ground}}$ without clipping or sinking.

### Specification T3.2: Ducking / Sliding Under Obstacles Near Bone Treat Pickups
- **Feature Pair:** S1 (Duck Control) x S2/S3 (Treat Spawn & Collision Detection)
- **Objective:** Verify ducking action reduces Corgi height box correctly, enabling clearance under high obstacles while simultaneously capturing low-altitude bone treats.
- **Input Sequence:**
  1. Spawn a high obstacle (clearable only by ducking) and a low treat pickup at identical horizontal offset $x_{\text{spawn}}$.
  2. Dispatch `KeyDown('ArrowDown')` while approaching $x_{\text{spawn}}$.
  3. Advance frame loop through overlap zone.
- **Expected Results:**
  - Ducking state reduces Corgi bounding height (e.g. from $H_{\text{normal}}$ to $H_{\text{ducked}}$).
  - No collision is registered with the high obstacle (clearance validated).
  - Treat collection collision box intersects reduced Corgi hitbox $\implies$ Treat pickup event fires.
  - Score increments by treat value, particle event is generated, and pickup sound triggers.

### Specification T3.3: Game Loop Pause / Resume During Airborne Jump State
- **Feature Pair:** S1 (Airborne Jump) x S3/S5 (Pause State & UI Overlay)
- **Objective:** Ensure pausing the game while mid-air halts position integration, physics vectors, and particle timers, and resuming restores exact pre-pause trajectory.
- **Input Sequence:**
  1. Trigger jump `KeyDown('Space')`.
  2. Advance simulation to peak jump altitude ($v_y = 0$).
  3. Trigger Pause (`KeyDown('KeyP')` or Pause UI Click).
  4. Advance virtual clock by 5 seconds (5000 ms).
  5. Trigger Resume (`KeyDown('KeyP')` or Resume UI Click).
  6. Advance simulation until landing.
- **Expected Results:**
  - During pause (steps 3-4), Corgi coordinates $(x, y)$ and velocity vector $(v_x, v_y)$ remain perfectly stationary.
  - Pause UI overlay is visible; game canvas animation loop is suspended.
  - Upon resume (step 5-6), Corgi resumes downward trajectory seamlessly without momentum loss, sudden teleportation, or double gravity application.

### Specification T3.4: Obstacle Collision Crash During High Score Record Run
- **Feature Pair:** S3 (Collision Detection & Game Over) x S4 (LocalStorage Persistence)
- **Objective:** Verify that colliding with an obstacle when the current score exceeds existing high score instantly updates LocalStorage and presents updated high score UI.
- **Input Sequence:**
  1. Pre-seed LocalStorage with `corgi_runner_highscore = 100`.
  2. Start game and collect treats / run until current score reaches `150`.
  3. Direct Corgi into obstacle collision box (no jump/duck avoidance).
- **Expected Results:**
  - Collision detector registers crash state.
  - Game transitions to `GAME_OVER` state immediately.
  - LocalStorage key `corgi_runner_highscore` is read, compared, and updated to `150`.
  - Game Over UI screen presents score `150` and displays "NEW HIGH SCORE!" badge.
  - Crash SFX and game over sound events fire.

### Specification T3.5: Rapid Restart Input Trigger During Game Over Display
- **Feature Pair:** S3 (Game Over State Transition) x S1/S4 (Entity & State Reset)
- **Objective:** Validate that triggering a restart immediately upon Game Over cleanly purges active entities, resets physics/speed, and restarts the run without memory leaks or duplicate game loops.
- **Input Sequence:**
  1. Trigger Game Over state via obstacle collision.
  2. Dispatch instant restart command (`KeyDown('Space')` or click Restart Button) within 50ms of Game Over transition.
  3. Monitor active entity arrays, score counters, and animation frame callbacks.
- **Expected Results:**
  - Game state transitions from `GAME_OVER` back to `RUNNING`.
  - Current score resets to `0`; speed multiplier resets to base $1.0x$.
  - Corgi position resets to starting ground coordinate.
  - Existing screen obstacles and treats are cleared; new spawn generator is reinitialized.
  - LocalStorage high score remains persisted from previous run (`150`).
  - Single active `requestAnimationFrame` or loop ticker runs (no stacked parallel game loops).

### Specification T3.6: Simultaneous Airborne Treat Pickup with Particle Burst & Audio Event
- **Feature Pair:** S1 (Airborne Jump) x S2/S4/S5 (Treat Pickup, Score, Particle FX, Audio)
- **Objective:** Verify multi-system synchronization when a treat is collected at maximum jump elevation.
- **Input Sequence:**
  1. Position bone treat at peak jump height $y_{\text{peak}}$.
  2. Execute jump `KeyDown('Space')`.
  3. Frame step to exact intersection point.
- **Expected Results:**
  - Treat item disappears from active render list.
  - Score increases by treat point value (e.g. +10 or +50).
  - Particle burst emitter spawns particle array at exact treat coordinates $(x_{\text{treat}}, y_{\text{treat}})$.
  - Sound effect subsystem triggers treat pickup audio without dropping airborne jump sound audio context.

### Specification T3.7: Ducking Input Under High Hurdle While Ground Obstacle Approaching
- **Feature Pair:** S1 (Duck Control) x S3 (Multi-Obstacle Layered Collision)
- **Objective:** Verify collision accuracy when ducking under an overhead hurdle while a low ground obstacle (fire hydrant) is positioned in close sequence.
- **Input Sequence:**
  1. Spawn high overhead obstacle at $x_1$, followed immediately by ground hydrant at $x_2 = x_1 + \delta$.
  2. Dispatch duck command `KeyDown('ArrowDown')` under $x_1$.
  3. Remain ducked while moving across $x_2$.
- **Expected Results:**
  - Corgi safely passes under high obstacle $x_1$ due to reduced ducked height.
  - Ducked Corgi collides with ground hydrant $x_2$ because ground collision box extends upwards into ducked body bounds.
  - Game correctly registers collision at $x_2$, proving hitbox calculation handles lower boundary overlap accurately.

---

## 4. Tier 4: Real-World Application Scenario Specifications (Full E2E Gameplay Workflows)

Tier 4 tests validate end-to-end user journeys from application launch through full gameplay cycles, UI interactions, collisions, restarts, and persistence.

### Scenario T4.1: Complete End-to-End Successful Gameplay Session & High Score Breakout
- **User Story:** As a player, I start a new game, dodge multiple obstacles, collect treats to boost my score, pause and resume, eventually crash into an obstacle, see my high score recorded on the Game Over screen, and restart instantly.
- **Step-by-Step Scenario Execution Plan:**
  1. **Launch App:** Load `index.html` in browser canvas runner.
  2. **Verify Start Overlay:** Start Screen visible, controls instructions displayed (Space/Up to jump, Down to duck), initial high score displayed from storage (or 0).
  3. **Start Game:** Press `Space` key. State transitions `START` $\to$ `RUNNING`.
  4. **Gameplay Dodge 1-3:** 
     - Jump over low hurdle #1 (`Space`).
     - Duck under flying obstacle #2 (`ArrowDown`).
     - Jump over fire hydrant #3 (`ArrowUp`).
  5. **Treat Collection 1-3:** 
     - Intercept bone treat #1 on ground level $\to$ +Score + Particles + SFX.
     - Intercept airborne bone treat #2 via jump $\to$ +Score + Particles + SFX.
     - Intercept bone treat #3 via duck $\to$ +Score + Particles + SFX.
  6. **Speed Scaling Check:** Verify game speed multiplier $> 1.2x$ after 15 seconds of play.
  7. **Pause / Resume Cycle:** Press `KeyP`. Verify pause overlay displayed, score frozen. Press `KeyP`. Verify game resumes without position jump.
  8. **Obstacle Crash:** Allow Corgi to collide with obstacle #4.
  9. **Game Over Screen:** Verify transition `RUNNING` $\to$ `GAME_OVER`. Verify final score displays accurately, "New High Score!" indicator is shown.
  10. **LocalStorage Audit:** Read `window.localStorage.getItem('corgi_runner_highscore')`, assert equals final score.
  11. **Instant Restart:** Press `Space` on Game Over screen. Verify game restarts in `RUNNING` state with score 0 and persistent high score shown on HUD.

### Scenario T4.2: First-Time Player Experience & Initial LocalStorage Bootstrapping
- **User Story:** As a first-time player with no prior saved data, I launch the game, view instructions, complete a brief run, die, and see my score saved as the initial high score.
- **Step-by-Step Scenario Execution Plan:**
  1. Clear browser `localStorage` completely.
  2. Load application URL.
  3. Assert Start Screen overlay is active. Assert High Score label reads `0` or `N/A`.
  4. Click "Start Game" UI button.
  5. Run Corgi for 5 seconds (collecting 0 treats, distance score = 45).
  6. Collide with first fire hydrant.
  7. Verify Game Over screen displays `Score: 45`, `High Score: 45`.
  8. Assert `localStorage.getItem('corgi_runner_highscore') === '45'`.
  9. Reload page (`window.location.reload()`).
  10. Assert Start Screen now displays `High Score: 45`.

### Scenario T4.3: High-Speed Long Duration Run & Extreme Acceleration Challenge
- **User Story:** As an experienced player, I maintain a long survival streak where the game speed scales up to maximum difficulty, testing frame rate and collision accuracy under fast movement.
- **Step-by-Step Scenario Execution Plan:**
  1. Launch and start game.
  2. Fast-forward / simulate continuous run across 3 speed tiers:
     - Tier A: $0\text{s} - 20\text{s}$ (Base speed $1.0x$)
     - Tier B: $20\text{s} - 45\text{s}$ (Medium speed $1.8x$)
     - Tier C: $> 60\text{s}$ (High speed $\ge 2.5x$)
  3. Execute automated precise jump over obstacle at $2.5x$ speed.
  4. Verify collision boundary precision at high speed (no phase-through bugs).
  5. Collect bone treat at $2.5x$ speed.
  6. Intentionally trigger collision $\to$ verify Game Over state transition cleanly executes even under max speed tick rates.

### Scenario T4.4: Pause, Multi-Toggle & Window Blur Resilience Workflow
- **User Story:** As a player, I pause the game multiple times and switch tabs/windows during play without breaking the game state or scoring system.
- **Step-by-Step Scenario Execution Plan:**
  1. Start game and achieve score $> 100$.
  2. Toggle Pause via `KeyP` $\to$ verify `PAUSED` state.
  3. Dispatch synthetic window `blur` event (simulating tab switch) $\to$ state remains `PAUSED`.
  4. Dispatch synthetic window `focus` event.
  5. Toggle Pause off via `KeyP` $\to$ verify `RUNNING` state, game physics resumes smoothly.
  6. Click Pause button on UI canvas overlay.
  7. Click Resume button on UI canvas overlay.
  8. Continue run to collision $\to$ Game Over. Verify score calculation unaffected by pause durations.

### Scenario T4.5: Multiple Consecutive Game Over & Instant Replay Stress Cycle
- **User Story:** As a player, I quickly play multiple rounds in succession (die $\to$ restart $\to$ die $\to$ restart) to test game stability and memory cleanliness.
- **Step-by-Step Scenario Execution Plan:**
  1. Loop $N = 5$ consecutive game runs:
     a. Start game.
     b. Run for $2$ seconds, collect $1$ treat.
     c. Force crash into obstacle.
     d. Assert `GAME_OVER` screen displayed.
     e. Press `Space` to restart immediately.
  2. Verify after iteration 5:
     - High score reflects maximum score across all 5 runs.
     - Memory footprint / active object counts do not grow exponentially.
     - Frame timing remains rock-solid at 60 FPS.
     - Keyboard listeners respond instantly without duplicated event triggers.

### Scenario T4.6: Responsive Canvas Resize & Multi-Input Control Workflow
- **User Story:** As a mobile or desktop player, I switch between touch controls and keyboard inputs while resizing the window, verifying UI adaptation and input compatibility.
- **Step-by-Step Scenario Execution Plan:**
  1. Start game using Keyboard (`Space` to start).
  2. Trigger touch start event (`touchstart` / Canvas tap) to execute jump.
  3. Dispatch touch swipe down event (`touchstart` $\to$ `touchmove` down) to execute duck.
  4. Trigger browser window resize event ($800 \times 600 \to 1280 \times 720$).
  5. Verify canvas rendering scales proportionally; Corgi ground plane adjusts to new canvas dimensions.
  6. Continue gameplay to treat collection and obstacle collision.
  7. Verify touch restart button on Game Over overlay correctly re-initializes game.

---

## 5. Architectural Blueprint for `TEST_INFRA.md`

`TEST_INFRA.md` will serve as the master technical specification for the test infrastructure created at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_INFRA.md`). Below is the draft structure:

```markdown
# Test Infrastructure & E2E Test Suite Architecture

## 1. Overview & Testing Strategy
- Opaque-box E2E testing architecture for HTML5 Canvas endless runner.
- Zero reliance on internal game private methods; tests interact purely via DOM events, keyboard/touch inputs, canvas render inspection, and LocalStorage auditing.

## 2. Environment & Test Harness Technology
- **Test Runner Engine:** Node.js with JSDOM / Canvas mock or Playwright browser context.
- **Canvas Mocking / Inspection Strategy:** 
  - Synthetic HTML5 Canvas Context 2D shim (`jest-canvas-mock` or JSDOM canvas extension).
  - Virtual clock driver (`requestAnimationFrame` ticker steering) enabling deterministic 60 FPS frame stepping.

## 3. Directory Layout & File Organization
corgi_runner/
├── tests/
│   └── e2e/
│       ├── harness/
│       │   ├── game_driver.js       # Game loop driver & input synthesizer
│       │   └── canvas_inspector.js  # Pixel/bounding box verification helpers
│       ├── tier1_feature_coverage.test.js # Feature coverage (R1, R2, R3)
│       ├── tier2_boundary_corner.test.js  # Boundary & edge cases
│       ├── tier3_cross_feature.test.js    # Pairwise feature matrix
│       └── tier4_real_world.test.js       # End-to-end gameplay scenarios
├── TEST_INFRA.md
└── TEST_READY.md

## 4. Test Tier Breakdown Matrix
| Tier | Description | Target Count | File Location |
|------|-------------|--------------|---------------|
| Tier 1 | Core Feature Coverage | >= 25 tests | `tests/e2e/tier1_feature_coverage.test.js` |
| Tier 2 | Boundary & Corner Cases | >= 25 tests | `tests/e2e/tier2_boundary_corner.test.js` |
| Tier 3 | Cross-Feature Combinations | >= 5 tests | `tests/e2e/tier3_cross_feature.test.js` |
| Tier 4 | Real-World Application Scenarios | >= 5 scenarios | `tests/e2e/tier4_real_world.test.js` |

## 5. Deterministic Game Loop Stepping Architecture
- Description of `GameDriver.stepFrames(n)` utility to advance the canvas loop deterministically by $n$ frames at $16.67\text{ms}$ per frame.
- Description of event injection (`GameDriver.pressKey('Space')`, `GameDriver.setLocalStorage()`).

## 6. Assertion & Verification Methodology
- UI State Assertions: DOM element visibility (`#start-screen`, `#pause-overlay`, `#game-over`).
- Physics & Entity Assertions: Checking rendered bounding coordinates.
- Persistence Assertions: `localStorage.getItem('corgi_runner_highscore')`.
- Audio/FX Event Hooks: Auditing mock Audio object `play()` calls and particle array counts.
```

---

## 6. Architectural Blueprint for `TEST_READY.md`

`TEST_READY.md` will serve as the execution readiness document created at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_READY.md`). Below is the draft structure:

```markdown
# Test Readiness & Execution Guide

## 1. Readiness Status Checklist
- [x] Test Harness Architecture Finalized
- [x] Tier 1 Feature Coverage Specifications Ready
- [x] Tier 2 Boundary & Corner Case Specifications Ready
- [x] Tier 3 Cross-Feature Combination Specifications Ready
- [x] Tier 4 Real-World Gameplay Scenario Specifications Ready
- [ ] Test Suite Implementation (`tests/e2e/*.test.js`)
- [ ] Verification & Forensic Audit Clean Pass

## 2. Prerequisites & Installation
- **Node.js Environment:** v18.x or higher
- **Package Manager:** npm or uv/vitest/jest
- **Installation Commands:**
  ```bash
  npm install
  ```

## 3. Test Execution Commands
| Command | Description | Expected Output |
|---------|-------------|-----------------|
| `npm test` | Run complete E2E test suite (Tiers 1-4) | All test suites passing |
| `npm run test:tier1` | Run Tier 1 Feature Coverage tests | >= 25 passing tests |
| `npm run test:tier2` | Run Tier 2 Boundary/Corner tests | >= 25 passing tests |
| `npm run test:tier3` | Run Tier 3 Cross-Feature tests | >= 5 passing tests |
| `npm run test:tier4` | Run Tier 4 Real-World Scenario tests | >= 5 passing scenarios |

## 4. Test Suite Verification & Quality Rules
1. **Strict Opaque-Box Rule:** Tests must evaluate game state via canvas output, DOM overlays, and LocalStorage—never internal private variables.
2. **Anti-Flakiness Guarantee:** Virtual clock stepping prevents non-deterministic animation timing issues.
3. **Forensic Integrity:** Zero dummy assertions (`expect(true).toBe(true)`), zero hardcoded pass flags.

## 5. Troubleshooting & Diagnostics
- **Canvas context null error:** Ensure JSDOM canvas package or mock is loaded in test setup.
- **LocalStorage security error:** Verify JSDOM origin URL is set to `http://localhost`.
- **Keyboard listener timeout:** Ensure DOM keydown/keyup events bubble up to `window` object.
```

---

## 7. Synthesis & Handoff Summary

The specifications detailed above cover all mandatory requirements for Tier 3 and Tier 4 E2E testing for the E2E Corgi Endless Runner track:
- **Tier 3:** 7 complete pairwise feature combination specifications (exceeding requirement of $\ge 5$).
- **Tier 4:** 6 complete real-world gameplay scenario specifications (exceeding requirement of $\ge 5$).
- **Documentation Structures:** Complete architectural blueprints provided for both `TEST_INFRA.md` and `TEST_READY.md`.

This analysis is ready for consumption by implementation workers (`teamwork_preview_worker`) and parent sub-orchestration agents.
