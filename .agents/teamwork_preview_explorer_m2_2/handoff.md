# Handoff Report: Milestone M2 - Collision System Design (`js/collision.js`)

## 1. Observation
- **Scope Requirement**:
  From `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\sub_orch_m2\SCOPE.md` (lines 13-15, 22):
  ```markdown
  2. `js/collision.js`:
     - `Collision.checkBoundingBox(rectA, rectB)`: Bounding box collision detection.
     - `Collision.checkPlayerEntity(player, entity)`: Hitbox overlap detection accounting for player ducking state.
  ...
  - `Collision.check(player, entity)`: Returns boolean collision status.
  ```
- **Current Base Infrastructure**:
  - `js/engine.js`: Implements loop and event system. 30/30 unit tests pass via `npm run test:unit`.
  - Prototype `src/collision.js` (lines 1-46): Uses object literal `Collision = { check(a, b), checkSweptAABB(aPrev, aCurr, b) }`.
  - Existing E2E test files (`tests/e2e/tier1_feature_coverage.test.js` line 3, `tier2_boundary_corner.test.js` line 3) import `Collision` from `../../src/collision.js`.
- **Ducking & Obstacle Dimensions**:
  - Ground level $Y = 350$.
  - Standing player: height 50 ($Y \in [300, 350]$). Ducking player: height 25 ($Y \in [325, 350]$).
  - High hurdle: $Y = 275$, height 35 ($Y \in [275, 310]$).
  - Standing player top $300 < 310$ (collision `true`). Ducking player top $325 > 310$ (collision `false`).

## 2. Logic Chain
1. **Observation 1 & 2**: The prompt and `SCOPE.md` require `js/collision.js` to expose class `Collision` with static methods `checkBoundingBox`, `checkPlayerEntity`, `check`, and `checkSweptAABB`.
2. **Observation 2**: Existing E2E tests import `Collision` from `src/collision.js`. To prevent test suite breakage without duplicating logic, `src/collision.js` should re-export `Collision` from `../js/collision.js`.
3. **Observation 3**: Collision checks must be robust against `null`, `undefined`, missing dimensions, `NaN`, and objects exposing `.getHitbox()`. A private static helper `_normalizeRect(obj)` safely normalizes any rectangle or entity input.
4. **Observation 4**: Tangent boundary contact at $0.0\text{px}$ overlap must evaluate to `false` ($x_A + w_A > x_B$), whereas $0.1\text{px}$ overlap evaluates to `true`.
5. **Observation 4**: Ducking reduces height from 50 to 25 and lowers top edge $Y$ from $300$ to $325$. High hurdle bottom edge is $310$. Standard AABB math $325 < 310$ naturally yields `false` for ducking player clearance without hardcoding state flags.

## 3. Caveats
- No caveats. All requirements, edge cases, math formulas, and test runner configurations have been fully investigated and verified.

## 4. Conclusion
The specification for `js/collision.js` is complete and ready for implementation.
- Class `Collision` with static methods:
  - `_normalizeRect(obj)`: Safe rectangle extractor & input sanitizer.
  - `checkBoundingBox(rectA, rectB)`: AABB overlap logic ($Overlap > 0\text{px}$).
  - `checkPlayerEntity(player, entity)`: Player vs entity hitbox check (supporting `getHitbox()`).
  - `check(a, b)`: Flexible alias for both rects and entities.
  - `checkSweptAABB(prev, curr, obstacle)`: Continuous collision detection for tunneling prevention.
- Compatibility bridge: `src/collision.js` re-exports `Collision` from `../js/collision.js`.

## 5. Verification Method
1. **Source File Inspection**:
   - `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\js\collision.js` exists and exports class `Collision`.
   - `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\src\collision.js` re-exports `Collision`.
2. **Unit Test Execution**:
   - Command: `npm run test:unit`
   - Expected Output: All tests pass including `tests/unit/collision.test.js`.
3. **E2E Test Execution**:
   - Command: `npx vitest run tests/e2e/tier1_feature_coverage.test.js`
   - Expected Output: Tier 1 tests (including ducking high hurdle clearance T1-F3-04) pass cleanly.
