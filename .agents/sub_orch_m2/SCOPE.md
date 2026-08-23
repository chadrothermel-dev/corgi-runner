# Scope: Milestone M2 — Player Controls, Animation & Collision System

## Objectives
Implement the Corgi player class, rendering/animation state machine, keyboard & touch controls, physics (jump arc, gravity, ducking), and precise bounding box collision detection engine.

## Requirements
1. `js/player.js`:
   - Corgi Player state machine (`RUNNING`, `JUMPING`, `DUCKING`).
   - Animated rendering (canvas drawing of cute Corgi with running leg motion, tail wagging, jump pose, ducked low posture).
   - Physics: position `(x, y)`, velocity `vy`, gravity `g`, jump velocity `v_jump`, ground level `y_ground`.
   - Hitbox computation: standing vs ducking bounding box (ducking reduces height and lowers top edge).
   - Controls: Keydown/keyup listener for `Space`, `ArrowUp`, `ArrowDown`, plus Touch/Mouse tap to jump, swipe down/hold down to duck.
2. `js/collision.js`:
   - `Collision.checkBoundingBox(rectA, rectB)`: Bounding box collision detection.
   - `Collision.checkPlayerEntity(player, entity)`: Hitbox overlap detection accounting for player ducking state.
3. Unit tests in `tests/unit/player.test.js` and `tests/unit/collision.test.js` covering physics, controls, ducking height change, and collision detection math.

## Interface Specifications
- `Player.update(deltaTime, inputState)`: Updates position and animation state.
- `Player.draw(ctx)`: Renders Corgi on canvas.
- `Player.getHitbox()`: Returns `{ x, y, width, height }`.
- `Collision.check(player, entity)`: Returns boolean collision status.
