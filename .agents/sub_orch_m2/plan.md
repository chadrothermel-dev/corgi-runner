# Plan: Milestone M2 — Player Controls, Animation & Collision System

## Objective
Implement `js/player.js` (Corgi player state machine, rendering, controls, physics, ducking hitbox) and `js/collision.js` (bounding box hitbox collision detection system), along with unit tests `tests/unit/player.test.js` and `tests/unit/collision.test.js`.

## Verification Criteria
1. `npm test` / `vitest run` and `npm run test:unit` pass 100% of unit tests and E2E tests without errors.
2. `js/player.js` conforms to the interface spec:
   - `Player.update(deltaTime, inputState)`
   - `Player.draw(ctx)`
   - `Player.getHitbox()`
3. `js/collision.js` conforms to the interface spec:
   - `Collision.checkBoundingBox(rectA, rectB)`
   - `Collision.checkPlayerEntity(player, entity)` / `Collision.check(player, entity)`
4. Full keyboard (Space, Up Arrow, Down Arrow) and touch/mouse (tap jump, swipe down/hold down duck) controls.
5. Physics implementation: gravity `g`, jump arc `v_jump`, ground level `y_ground`, state transition `RUNNING`, `JUMPING`, `DUCKING`.
6. Ducking reduces player hitbox height and lowers top edge.
7. Forensic integrity audit is CLEAN with zero violations.

## Step-by-Step Sub-orchestrator Plan
1. **Heartbeat**: Schedule 10-min heartbeat cron.
2. **Exploration Phase**: Spawn 3 Explorers (`teamwork_preview_explorer`) to analyze existing codebase (`js/engine.js`, `index.html`, test infrastructure), verify APIs, and produce complete design specs for `js/player.js`, `js/collision.js`, and test suites.
3. **Implementation Phase**: Spawn 1 Worker (`teamwork_preview_worker`) with Explorer recommendations to write `js/player.js`, `js/collision.js`, `tests/unit/player.test.js`, `tests/unit/collision.test.js`, and verify build/tests.
4. **Review Phase**: Spawn 2 Reviewers (`teamwork_preview_reviewer`) to independently review code quality, test coverage, edge cases, and layout compliance.
5. **Challenger Phase**: Spawn 2 Challengers (`teamwork_preview_challenger`) to stress test physics math, boundary conditions, touch input sequences, and collision math.
6. **Integrity Audit**: Spawn 1 Forensic Auditor (`teamwork_preview_auditor`) to verify zero cheating / genuine implementation.
7. **Gate & Synthesis**: Evaluate gate criteria. If clean and passing, update `progress.md` and report success to parent orchestrator.
