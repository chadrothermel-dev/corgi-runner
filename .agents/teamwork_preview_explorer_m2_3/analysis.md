# Analysis: Unit Test Specifications for Milestone M2 (`player.test.js` & `collision.test.js`)

## 1. Executive Summary

Milestone M2 focuses on Corgi player state transitions, physics/gravity, hitbox calculation, and collision detection math.
This analysis evaluates existing test infrastructure, inspects `src/player.js`, `src/collision.js`, `src/entities.js`, `TEST_INFRA.md`, `TEST_READY.md`, and `vitest.config.js`, and formulates unit test specifications for `tests/unit/player.test.js` and `tests/unit/collision.test.js`.

---

## 2. Infrastructure & Execution Environment Findings

1. **Dual Test Runner Setup**:
   - **Unit Tests**: Executed via Node.js native test runner (`npm run test:unit` -> `node --test tests/unit/**/*.test.js`). Native ES module import format using `import test from 'node:test';` and `import assert from 'node:assert/strict';`.
   - **E2E Tests**: Executed via Vitest (`npm test` / `npm run test:e2e` -> `vitest run`).
   - *Observation*: `vitest.config.js` currently specifies `include: ['tests/e2e/**/*.test.js']`. To allow `vitest` to run both unit and e2e tests, `include` should be expanded to `['tests/**/*.test.js']`.

2. **Canvas Context Mocking**:
   - Headless unit testing relies on `MockCanvas` in `tests/mocks/canvas.mock.js`.
   - `MockCanvas` tracks all context draw operations (`fillRect`, `save`, `restore`, `drawImage`) in `ctx.calls`, enabling inspection without browser DOM dependencies.

3. **Audio Decoupling**:
   - `AudioSystem` in `src/audio.js` safely guards window Audio creation with try/catch fallback, permitting clean execution in headless Node unit tests.

---

## 3. Unit Test Suite Specification: `tests/unit/player.test.js`

### A. State Transition Tests
- **Test 1.1: Default Initial State**
  - Verify player starts in `state === 'RUNNING'`, `isGrounded === true`, `isDucking === false`, `height === 50`, `y === 300` (groundY 350 - height 50).
- **Test 1.2: State Transition `RUNNING -> JUMPING`**
  - Action: Invoke `player.jump()`.
  - Expectations: Returns `true`, `state === 'JUMPING'`, `isGrounded === false`, initial vertical velocity `vy === -550`.
- **Test 1.3: Ignore Double Jump in Mid-Air**
  - Action: Invoke `player.jump()` while airborne (`isGrounded === false`).
  - Expectations: Returns `false`, `vy` remains unchanged.
- **Test 1.4: State Transition `RUNNING -> DUCKING`**
  - Action: Invoke `player.duck()`.
  - Expectations: `isDucking === true`, `state === 'DUCKING'`, `height === 25`, `y === 325` (groundY 350 - duckHeight 25).
- **Test 1.5: Prevention of Jump While Ducked**
  - Action: Invoke `player.duck()`, then invoke `player.jump()`.
  - Expectations: Jump is ignored (`returns false`), state remains `DUCKING`, player stays grounded. *(Note: Code gap identified below)*.
- **Test 1.6: Stop Ducking Resets State to `RUNNING`**
  - Action: Call `player.duck()`, then `player.stopDuck()`.
  - Expectations: `isDucking === false`, `state === 'RUNNING'`, `height === 50`, `y === 300`.
- **Test 1.7: Landing Resets State to `RUNNING`**
  - Action: Initiate `jump()`, step physics downward via `update(dt)` until `y + height >= groundY`.
  - Expectations: `isGrounded === true`, `vy === 0`, `state === 'RUNNING'`.
- **Test 1.8: Player Reset Method**
  - Action: Modify player state/position, then call `player.reset()`.
  - Expectations: State, position `(80, 300)`, velocity `0`, `isGrounded`, `isDucking` all reset to default initial values.

### B. Physics & Gravity Tests
- **Test 2.1: Jump Impulse Application**
  - Action: Call `jump()`.
  - Expectations: `vy === -550`, `isGrounded === false`.
- **Test 2.2: Gravity Downward Impulse Over Time**
  - Action: Call `jump()`, then call `update(0.1)`.
  - Expectations: Velocity increases downward by `gravity * dt` (`-550 + 1200 * 0.1 = -430`), `y` moves upward (`300 + (-550)*0.1 = 245`).
- **Test 2.3: Parabolic Arc Apex and Descent**
  - Action: Step physics forward over ~1.0s.
  - Expectations: `vy` transitions from negative (climbing) to 0 (apex) to positive (falling).
- **Test 2.4: Position Clamping at Ground Level**
  - Action: Step physics until player lands.
  - Expectations: `y` is clamped to `groundY - height` (300), `vy` resets to `0`, `isGrounded` becomes `true`.
- **Test 2.5: Mid-Air Duck Fast-Fall Physics**
  - Action: Call `jump()`, then call `duck()`, step `update(dt)`.
  - Expectations: Extra fast-fall downward acceleration is applied (`vy` increases faster than normal gravity).

### C. Hitbox & Dimension Tests
- **Test 3.1: Standing vs Ducking Height Change**
  - Expectations: Standing `height === 50`, Ducking `height === 25`. Height diff === 25px.
- **Test 3.2: Standing vs Ducking Y Position Shift**
  - Expectations: Ground level = 350. Standing `y = 300`, Ducking `y = 325`. Top edge lowers by 25px.
- **Test 3.3: Hitbox Accessor (`getHitbox()`)**
  - Action: Call `player.getHitbox()` in standing vs ducking states.
  - Expectations: Returns `{ x: 80, y: 300, width: 60, height: 50 }` standing, `{ x: 80, y: 325, width: 60, height: 25 }` ducked.

### D. Canvas Rendering Tests
- **Test 4.1: Canvas `draw()` Invocation Without Errors**
  - Action: Instantiate `MockCanvas`, pass `mockCanvas.getContext('2d')` to `player.draw(ctx)`.
  - Expectations: Runs cleanly without throwing. `ctx.calls` contains `save`, `fillRect`, `restore`.

---

## 4. Unit Test Suite Specification: `tests/unit/collision.test.js`

### A. Core AABB Overlap Mathematics
- **Test 1.1: Completely Separated Non-Overlapping Rectangles**
  - Scenario: Rect A at `(0, 0, 50, 50)`, Rect B at `(100, 100, 50, 50)`.
  - Expectation: `Collision.check(rectA, rectB) === false`.
- **Test 1.2: Overlapping Rectangles**
  - Scenario: Rect A at `(10, 10, 50, 50)`, Rect B at `(30, 30, 50, 50)`.
  - Expectation: `Collision.check(rectA, rectB) === true`.
- **Test 1.3: Partial Horizontal/Vertical Overlap**
  - Scenario: X ranges overlap, Y ranges separate; and vice versa.
  - Expectation: `Collision.check()` returns `false` if either dimension does not overlap.
- **Test 1.4: Null / Undefined Parameter Safety**
  - Expectation: `Collision.check(null, rectB)` and `Collision.check(rectA, undefined)` return `false` without throwing.
- **Test 1.5: Property Field Flexibility (`width/height` vs `w/h`)**
  - Expectation: Correctly reads `{ x, y, w, h }` or `{ x, y, width, height }`.

### B. Edge Contact & Grazing Boundary Tests
- **Test 2.1: Tangent Edge Contact (0.0px Overlap)**
  - Scenario: Rect A `x: 0, width: 50` (right edge 50), Rect B `x: 50, width: 50` (left edge 50).
  - Expectation: `Collision.check()` returns `false` (touching edges do not count as collision).
- **Test 2.2: Grazing Boundary Contact (0.1px Overlap)**
  - Scenario: Rect A `x: 0, width: 50.1`, Rect B `x: 50, width: 50`.
  - Expectation: `Collision.check()` returns `true`.

### C. Player Standing vs Ducking vs High Obstacle
- **Test 3.1: Standing Player Hits High Obstacle**
  - Setup: High obstacle `y = 275`, `height = 35` (occupies Y 275 to 310). Standing player `y = 300`, `height = 50` (occupies Y 300 to 350).
  - Expectation: `Collision.check(player, highObstacle) === true`.
- **Test 3.2: Ducking Player Clears High Obstacle**
  - Setup: High obstacle `y = 275`, `height = 35` (occupies Y 275 to 310). Ducked player `y = 325`, `height = 25` (occupies Y 325 to 350).
  - Expectation: `Collision.check(player, highObstacle) === false` (ducking successfully avoids high obstacle).

### D. Player Standing vs Jumping vs Low Obstacle
- **Test 4.1: Standing Grounded Player Hits Low Obstacle**
  - Setup: Hurdle obstacle `y = 310`, `height = 40` (occupies Y 310 to 350). Standing player `y = 300`, `height = 50`.
  - Expectation: `Collision.check(player, hurdle) === true`.
- **Test 4.2: Ducking Grounded Player Hits Low Obstacle**
  - Setup: Hurdle obstacle `y = 310`, `height = 40`. Ducked player `y = 325`, `height = 25` (occupies Y 325 to 350).
  - Expectation: `Collision.check(player, hurdle) === true` (ducking on ground does not avoid low obstacle).
- **Test 4.3: Jumping Player Clears Low Obstacle**
  - Setup: Hurdle obstacle `y = 310`, `height = 40`. Airborne player near jump apex `y = 220`, `height = 50` (occupies Y 220 to 270).
  - Expectation: `Collision.check(player, hurdle) === false` (jump clears low obstacle).

### E. Swept AABB Tunneling Prevention Tests
- **Test 5.1: Fast-Moving Frame Step Detection**
  - Scenario: Player moves from `prevX = 50` to `currX = 150` in one frame. Obstacle is positioned at `x = 90, width = 20`. Discrete check at `currX` is false (`150 > 110`).
  - Expectation: `Collision.checkSweptAABB(prevPlayer, currPlayer, obstacle) === true` (swept AABB detects tunneling collision).
- **Test 5.2: Swept AABB Clears Distance Separation**
  - Scenario: Swept path `x = 50..100`, obstacle at `x = 200..220`.
  - Expectation: `Collision.checkSweptAABB()` returns `false`.

---

## 5. Implementation Gaps & Recommendations

1. **`CorgiPlayer.jump()` Duck Prevention Gap**:
   - In `src/player.js`, line 33 currently reads `if (this.isGrounded)`. It does not check `!this.isDucking`.
   - *Recommendation*: Update `src/player.js` to `if (this.isGrounded && !this.isDucking)`.

2. **Explicit `getHitbox()` Method**:
   - `SCOPE.md` specifies `Player.getHitbox(): Returns { x, y, width, height }`.
   - *Recommendation*: Add `getHitbox()` method to `CorgiPlayer` class in `src/player.js`.

3. **`vitest.config.js` Target Inclusion**:
   - Update `vitest.config.js` `include` option from `['tests/e2e/**/*.test.js']` to `['tests/**/*.test.js']` so `npm test` runs both unit and E2E test suites under Vitest.

