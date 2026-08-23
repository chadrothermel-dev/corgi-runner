# Handoff Report: Milestone M2 Unit Test Suite Specifications

**Agent ID**: `teamwork_preview_explorer_m2_3`  
**Role**: Teamwork Explorer (Read-Only Investigation & Test Architecture Design)  
**Working Directory**: `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_3`  

---

## 1. Observation

1. **Test Infrastructure & Config Files**:
   - `vitest.config.js` (lines 1-11): Sets `environment: 'jsdom'` and `include: ['tests/e2e/**/*.test.js']`.
   - `package.json` (lines 6-14): Defines `"test": "vitest run"` and `"test:unit": "node --test tests/unit/**/*.test.js"`.
   - `TEST_INFRA.md` & `TEST_READY.md`: Documents E2E virtual clock stepping (`timeMock.js`), canvas mock recording (`canvasMock.js`), and score/audio audit conventions.
   - `tests/unit/engine.test.js`: Uses Node's built-in test runner (`import test from 'node:test';`, `import assert from 'node:assert/strict';`) and `MockCanvas` from `tests/mocks/canvas.mock.js`.

2. **Existing Implementation Code**:
   - `src/player.js` (lines 3-102):
     - `constructor`: `groundY = 350`, `normalHeight = 50`, `duckHeight = 25`, `width = 60`, `height = 50`, `x = 80`, `y = 300`, `vy = 0`, `gravity = 1200`, `jumpImpulse = -550`, `state = 'RUNNING'`, `isGrounded = true`, `isDucking = false`.
     - `jump()` (lines 32-41): Checks `if (this.isGrounded)`. Note: does not check `!this.isDucking`.
     - `duck()` (lines 43-55): Sets `isDucking = true`, `height = 25`, `y = 325`, `state = 'DUCKING'`.
     - `stopDuck()` (lines 57-65): Sets `isDucking = false`, `height = 50`, `y = 300`, `state = 'RUNNING'`.
     - `update(dt)` (lines 67-88): Gravity calculation, airborne fast-fall acceleration, and ground clamping at `y + height >= groundY`.
     - `draw(ctx)` (lines 90-101): Draws rectangle corgi body and eyes on canvas context.
   - `src/collision.js` (lines 1-46):
     - `Collision.check(a, b)`: AABB overlap check using strict `<` and `>`. Supports `width`/`height` or `w`/`h`.
     - `Collision.checkSweptAABB(aPrev, aCurr, b)`: Computes bounding min/max box across movement vector to prevent high-speed tunneling.
   - `src/entities.js` (lines 15-73):
     - `spawnHurdle()`: `y = 310, height = 40` (low ground obstacle).
     - `spawnHighHurdle()`: `y = 275, height = 35` (high obstacle clearing Y 310 to 350).

3. **Execution Verification**:
   - Command `npm run test:unit` executed successfully, passing 30 engine unit tests in 1.94s.

---

## 2. Logic Chain

1. **Test Suite Organization**:
   - Unit tests run under `node --test` via `npm run test:unit`. Following the pattern in `engine.test.js`, new unit test files (`tests/unit/player.test.js` and `tests/unit/collision.test.js`) should import `node:test`, `node:assert/strict`, `MockCanvas` from `../mocks/canvas.mock.js`, and the target classes (`CorgiPlayer` from `../../src/player.js`, `Collision` from `../../src/collision.js`).

2. **`player.test.js` Test Scope Logic**:
   - **State Transitions**: Test initial state (`RUNNING`, grounded), jump transition (`RUNNING -> JUMPING`), duck transition (`RUNNING -> DUCKING`), jump suppression while ducked, landing state restoration, and reset function.
   - **Physics & Gravity**: Test jump impulse (`vy = -550`), gravity acceleration over delta time, apex transition, position clamping at `y = 300`, and airborne fast-fall acceleration.
   - **Hitbox Dynamics**: Test standing height (50) vs ducking height (25), Y position shift (300 -> 325), and `getHitbox()` output.
   - **Canvas Rendering**: Test `player.draw(ctx)` with `MockCanvas` context to guarantee no runtime exceptions and verify drawing calls (`fillRect`, `save`, `restore`).

3. **`collision.test.js` Test Scope Logic**:
   - **AABB Math**: Separated rects return `false`, overlapping rects return `true`, null safety, property key flexibility (`w/h` vs `width/height`).
   - **Edge Contacts**: 0.0px tangent contact returns `false` (due to strict `<` / `>`), while 0.1px grazing contact returns `true`.
   - **High Obstacle Evasion**: High hurdle (`y=275..310`) collides with standing Corgi (`y=300..350`, overlap 300..310) but is avoided by ducking Corgi (`y=325..350`).
   - **Low Obstacle Evasion**: Ground hurdle (`y=310..350`) collides with standing or ducking grounded Corgi, but is avoided by airborne jumping Corgi (`y=220..270`).
   - **Swept AABB**: Swept box across `prev` and `curr` detects obstacles passed between frames.

---

## 3. Caveats

- **Read-Only Scope**: This agent's role is strictly exploratory and analytical. Implementation of tests in `tests/unit/player.test.js` and `tests/unit/collision.test.js` will be handled by the implementer agent.
- **Code Gaps Identified**:
  1. `CorgiPlayer.jump()` in `src/player.js:33` needs `if (this.isGrounded && !this.isDucking)` to prevent jumping while ducked as specified in M2 requirements.
  2. `CorgiPlayer` requires `getHitbox()` method implementation for clean API alignment.
- **Test Runner Config**: `vitest.config.js` currently targets `tests/e2e/**/*.test.js`. If Vitest is expected to execute unit tests during `npm test`, its `include` pattern should be updated.

---

## 4. Conclusion

The specifications for `tests/unit/player.test.js` (13 test cases) and `tests/unit/collision.test.js` (11 test cases) are complete, evidence-backed, and ready for implementation. Full test case breakdowns, expected values, and code gap findings are documented in `analysis.md`.

---

## 5. Verification Method

To verify the test suite specifications once implemented:

1. **Run Unit Tests via Node Test Runner**:
   ```bash
   npm run test:unit
   ```
   *Expected result*: All unit tests in `tests/unit/engine.test.js`, `tests/unit/player.test.js`, and `tests/unit/collision.test.js` pass cleanly.

2. **Run E2E Test Suite via Vitest**:
   ```bash
   npm test
   ```
   *Expected result*: All 63 E2E test cases pass cleanly.

3. **Files to Inspect**:
   - `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_3\analysis.md`
   - `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_3\handoff.md`

