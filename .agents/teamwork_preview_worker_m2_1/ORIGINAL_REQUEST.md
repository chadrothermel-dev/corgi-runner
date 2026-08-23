## 2026-07-23T20:54:14Z
<USER_REQUEST>
Objective: Implement `js/player.js`, `js/collision.js`, `src/player.js`, `src/collision.js`, `tests/unit/player.test.js`, `tests/unit/collision.test.js` for Milestone M2.
Working Directory: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_worker_m2_1
Project Root: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner

Explorer Analysis Files:
- Explorer 1 (Player Architecture): c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_1\analysis.md and handoff.md
- Explorer 2 (Collision System): c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_2\analysis.md and handoff.md
- Explorer 3 (Test Suite): c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_m2_3\analysis.md and handoff.md

Requirements:
1. Implement `js/player.js` & `src/player.js`:
   - Class `CorgiPlayer` / `Player` with constructor(groundY = 350).
   - Position x=80, y=groundY - height, vy=0, gravity=1200, jumpImpulse=-550.
   - States: RUNNING, JUMPING, DUCKING.
   - Methods: reset(), jump(), duck(), stopDuck(), update(dt, inputState), draw(ctx), getHitbox(), attachInputListeners().
   - Prevent jump while ducked (`if (this.isGrounded && !this.isDucking)`).
   - Ducking reduces height to 25 and shifts y to groundY - 25.
   - Mid-air ducking accelerates downward velocity (fast fall).
   - Window blur resets ducking and keyboard states.
   - Cute procedural Corgi canvas drawing (body #D2691E, belly, ears, eyes, tail wagging, leg animation).
   - `getHitbox()` returns `{ x, y, width, height }`.

2. Implement `js/collision.js` & `src/collision.js`:
   - Class `Collision` with static methods:
     - `_normalizeRect(obj)`: safe normalization for objects, null handling, and `.getHitbox()` extraction.
     - `checkBoundingBox(rectA, rectB)`: AABB overlap check using strict `<` and `>`.
     - `checkPlayerEntity(player, entity)`: Player vs entity hitbox check.
     - `check(a, b)`: flexible alias for both rects and entities.
     - `checkSweptAABB(aPrev, aCurr, b)`: continuous collision check across frame movement.
   - `src/collision.js` re-exports `Collision` from `../js/collision.js` (or vice versa) for backward compatibility with existing tests.

3. Implement `tests/unit/player.test.js`:
   - State transition tests (RUNNING, JUMPING, DUCKING, ducking prevents jump, landing resets state).
   - Physics & gravity tests (velocity, delta time, ground clamping).
   - Hitbox tests (standing height 50 vs ducking height 25, y position shift, getHitbox()).
   - Canvas draw() call with MockCanvas context.

4. Implement `tests/unit/collision.test.js`:
   - AABB non-overlap and overlap.
   - 0.0px tangent contact returns false, 0.1px overlap returns true.
   - Standing vs ducking player against high obstacle (`y=275..310`): standing returns true, ducking returns false.
   - Jumping player vs low ground obstacle (`y=310..350`): jumping returns false, standing returns true.
   - Swept AABB tunneling detection.

5. Update `vitest.config.js` if needed so `vitest run` includes unit test paths.

6. Build and Test Verification:
   - Run `npm run test:unit` and `npm test` / `npx vitest run`.
   - Document commands executed and full output in `handoff.md` and `changes.md` in your working directory `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_worker_m2_1`.

MANDATORY INTEGRITY WARNING:
> DO NOT CHEAT. All implementations must be genuine. DO NOT
> hardcode test results, create dummy/facade implementations, or
> circumvent the intended task. A Forensic Auditor will independently
> verify your work. Integrity violations WILL be detected and your
> work WILL be rejected.
</USER_REQUEST>
