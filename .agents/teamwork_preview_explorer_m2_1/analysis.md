# Architectural Analysis & Technical Specification: `js/player.js` (Milestone M2)

## 1. Context & Objectives
Milestone M2 defines the core player physics, controls, state machine, and procedural animation for the **Corgi Endless Runner**. The player object manages vertical physics, user controls (keyboard & touch), state transitions (`RUNNING`, `JUMPING`, `DUCKING`), accurate bounding box calculations, and HTML5 2D canvas drawing of a cute animated Corgi.

This document presents the complete architectural specification for `js/player.js` based on investigation of `SCOPE.md`, `js/engine.js`, `index.html`, `package.json`, and all E2E & unit test suites in `tests/`.

---

## 2. Core Class & State Machine Architecture

### 2.1 Class Structure & ESM Export
- **File**: `js/player.js`
- **Export**: `export class Player`
- **State Enum**: `Player.STATES = Object.freeze({ RUNNING: 'RUNNING', JUMPING: 'JUMPING', DUCKING: 'DUCKING' })`

### 2.2 Constructor Options & Default Properties
The constructor accepts an `options` object with defensive defaults:

```javascript
constructor(options = {}) {
  this.x = options.x ?? 100;
  this.groundY = options.groundY ?? 400;
  this.width = options.width ?? 60;
  this.normalHeight = options.normalHeight ?? options.height ?? 50;
  this.duckHeight = options.duckHeight ?? 25;
  this.height = this.normalHeight;
  
  // Vertical position is computed so bottom edge aligns with ground level
  this.y = options.y ?? (this.groundY - this.height);
  
  // Physics parameters
  this.vy = options.vy ?? 0;
  this.gravity = options.gravity ?? options.g ?? 1500; // px/s²
  this.jumpImpulse = options.jumpImpulse ?? options.v_jump ?? -550; // px/s (upward)
  this.fastFallImpulse = options.fastFallImpulse ?? 800; // px/s (downward acceleration boost)

  // State Machine Flags
  this.state = Player.STATES.RUNNING;
  this.isGrounded = true;
  this.isDucking = false;
  
  // Animation timing
  this.animFrame = 0;

  // External audio system or jump hook callback
  this.audioSystem = options.audioSystem ?? null;
  this.onJump = options.onJump ?? null;

  // Internal input state buffer
  this.inputState = {
    jump: false,
    duck: false,
    jumpPressed: false
  };
}
```

---

## 3. Detailed Physics & State Machine Logic (`update`)

### 3.1 Function Signature
`Player.prototype.update(deltaTime, inputState = null)`

### 3.2 Internal Flow Diagram
1. **Delta Time Validation**: Clamp `deltaTime = Math.min(Math.max(deltaTime || 0, 0), 0.1)`.
2. **Input Processing**:
   - Merge passed `inputState` parameter into `this.inputState` if provided.
3. **Ground State Handling (`isGrounded === true`)**:
   - **Jump Request (`inputState.jump` or `inputState.jumpPressed`)**:
     - Set `this.vy = this.jumpImpulse` (-550).
     - Set `this.isGrounded = false`.
     - Set `this.state = Player.STATES.JUMPING`.
     - Trigger Jump Audio (`audioSystem.playSound('jump')` or `onJump()`).
     - Consume `inputState.jumpPressed = false`.
   - **Duck Request (`inputState.duck === true`)**:
     - Set `this.state = Player.STATES.DUCKING`.
     - Set `this.isDucking = true`.
     - Set `this.height = this.duckHeight` (25).
     - Update `this.y = this.groundY - this.duckHeight`.
   - **Standing / Running Request (No jump & no duck)**:
     - Set `this.state = Player.STATES.RUNNING`.
     - Set `this.isDucking = false`.
     - Set `this.height = this.normalHeight` (50).
     - Update `this.y = this.groundY - this.normalHeight`.
4. **Airborne Physics Handling (`isGrounded === false`)**:
   - Set `this.state = Player.STATES.JUMPING`.
   - **Fast Fall Check**: If `inputState.duck === true`, apply fast fall acceleration:
     - `this.vy += (this.gravity + this.fastFallImpulse) * deltaTime`.
   - Else (standard gravity):
     - `this.vy += this.gravity * deltaTime`.
   - **Position Update**: `this.y += this.vy * deltaTime`.
   - **Double Jump Guard**: Subsequent jump keypresses while `!isGrounded` are ignored.
   - **Ground Boundary Clamping**:
     - If `this.y + this.height >= this.groundY`:
       - Clamp `this.y = this.groundY - this.height`.
       - Reset `this.vy = 0`.
       - Set `this.isGrounded = true`.
       - If `inputState.duck === true`:
         - Set `this.state = Player.STATES.DUCKING`, `this.isDucking = true`, `this.height = this.duckHeight`, `this.y = this.groundY - this.duckHeight`.
       - Else:
         - Set `this.state = Player.STATES.RUNNING`, `this.isDucking = false`, `this.height = this.normalHeight`, `this.y = this.groundY - this.normalHeight`.
5. **Animation Time Increment**:
   - `this.animFrame += deltaTime * 10;`

---

## 4. Input Listener & Event Binding Specification

### 4.1 Supported Control Schemes
1. **Keyboard**:
   - `Space` / `ArrowUp` / `KeyW`: Jump initiation.
   - `ArrowDown` / `KeyS`: Duck hold (hold to stay ducked, release to stand).
2. **Touch Screen Controls**:
   - **Tap Top Half of Canvas (`clientY < height / 2`)**: Jump initiation.
   - **Tap Bottom Half / Hold Bottom Half (`clientY >= height / 2`)**: Duck initiation.
   - **Swipe Down Gesture**: Instant Duck activation.
3. **Window Focus Safety**:
   - `blur` event: Clears all active input states to prevent sticky keys when switching browser tabs.

### 4.2 Methods
- `setupInputListeners(targetWindow = window, canvasElement = null)`
- `cleanupInputListeners()`

---

## 5. Hitbox Calculation (`getHitbox`)

### 5.1 Function Signature & Return Value
`Player.prototype.getHitbox()`

Returns exact bounding box `{ x, y, width, height }`:

```javascript
getHitbox() {
  return {
    x: this.x,
    y: this.y,
    width: this.width,
    height: this.height
  };
}
```

### 5.2 Height Adjustments in Bounding Box
- **Standing / Running / Jumping**: `{ x: 100, y: groundY - 50, width: 60, height: 50 }`.
- **Ducking**: `{ x: 100, y: groundY - 25, width: 60, height: 25 }`.
- **Key Guarantee**: Top edge `y` lowers when ducking so overhead hurdles clear the Corgi, while bottom edge remains aligned at `groundY`.

---

## 6. Procedural Canvas 2D Corgi Drawing (`draw`)

### 6.1 Function Signature
`Player.prototype.draw(ctx)`

### 6.2 Visual Styling & Anatomy
- **Palette**:
  - Primary Fur: Golden Corgi Orange/Tan (`#E07A5F` / `#D4A373`)
  - Belly & Muzzle: Cream White (`#FFF8F0`)
  - Eyes, Nose, Paws: Charcoal (`#2B2D42`)
  - Inner Ear: Soft Pink (`#FFCAD4`)
  - Collar: Vibrant Red (`#E63946`)
- **Procedural Render Steps**:
  1. `ctx.save()`
  2. Translate to player origin `(this.x, this.y)`.
  3. Draw Tail: Fluffy tan nub at rear, animated with `Math.sin(this.animFrame * 1.5)` wag.
  4. Draw Body: Rounded rect / ellipse for main Corgi loaf torso.
     - In `DUCKING` state: body height squished to 25px, stretched horizontally.
  5. Draw White Chest Patch & Belly.
  6. Draw Head & Snout: Front-facing rightward head with black nose and eye shine dot.
  7. Draw Ears: Perky triangular ears. Folded back slightly during ducking and jumping.
  8. Draw Animated Legs (4 legs):
     - In `RUNNING`: Alternating stride using `Math.sin(this.animFrame * 12)` and `Math.cos(this.animFrame * 12)`.
     - In `JUMPING`: Legs tucked or extended in air.
     - In `DUCKING`: Legs flattened low to ground.
  9. `ctx.restore()`

---

## 7. Verification Method & Test Coverage Plan

### 7.1 Recommended Unit Tests (`tests/unit/player.test.js`)
1. **Default Initialization**: Verify initial position `(100, 350)` for `groundY = 400`, `normalHeight = 50`, `state = RUNNING`.
2. **Jump Physics**: Verify pressing jump sets `vy = -550`, `isGrounded = false`, `state = JUMPING`, and triggers audio.
3. **Parabolic Arc**: Verify player rises, reaches peak height, falls under gravity, and clamps to `groundY`.
4. **Single Jump Enforcement**: Verify mid-air jump keypresses do not reset `vy`.
5. **Ducking Hitbox & State**: Verify ducking reduces height to 25 and updates `y` to `groundY - 25`.
6. **Fast Fall**: Verify ducking mid-air accelerates downward velocity `vy`.
7. **Input Cleanup**: Verify window blur resets active key states.
