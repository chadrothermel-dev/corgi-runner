# E2E Test Case Specifications: Tier 1 & Tier 2
**Project**: Corgi Endless Runner (HTML5 Canvas 2D Game)  
**Agent**: Explorer 1 (`teamwork_preview_explorer_e2e_1`)  
**Track**: E2E Testing Track  
**Target Output**: `analysis.md`  

---

## 1. Executive Summary & Requirements Enumeration

This document contains the requirements analysis, feature enumeration, and detailed test case specifications for **Tier 1 (Feature Coverage)** and **Tier 2 (Boundary & Corner Cases)** for the *Corgi Endless Runner* game.

The specifications are derived directly from `ORIGINAL_REQUEST.md` and `SCOPE.md` to ensure full coverage of game mechanics, controls, scoring, visual/audio effects, UI state transitions, and edge cases.

### Requirements Breakdown

| Req ID | Category | Feature Summary | Key Verification Parameters |
|---|---|---|---|
| **R1.1** | Core Mechanics | 2D HTML5 Canvas endless runner with side-scrolling background | Canvas element rendering, 2D context initialization, 60 FPS animation loop |
| **R1.2** | Core Controls | Player controls Corgi with Jump (`Space` / `Up Arrow` / Touch) and Duck (`Down Arrow` / Touch) | Velocity manipulation (`vy`), state machine (`RUNNING`, `JUMPING`, `DUCKING`), height adjustment |
| **R1.3** | Core Entities | Obstacles (fire hydrants, hurdles) and collectibles (bone treats) | Entity spawner, movement leftwards, bounding box alignment |
| **R1.4** | Core Physics | Gravity, jump arc, landing detection, speed scaling | Parabolic jump arc, frame-rate independent physics (`dt`), progressive speed acceleration |
| **R1.5** | Collision Engine | Precise bounding box (AABB) / hitbox collision detection | Overlap detection between player AABB and entity AABBs |
| **R2.1** | Scoring | Real-time score display based on distance traveled & treat pickups | Continuous score accumulation, treat bonus (+50 pts) |
| **R2.2** | High Score Persistence | High score tracking via `window.localStorage` across sessions | Storing score on Game Over, retrieving score on load, non-overwrite of lower scores |
| **R2.3** | Visual Effects | Particle burst effect when bone treat is collected | Particle emission pool, coordinates matching treat, fade decay |
| **R2.4** | Audio System | Web Audio API sound effects for Jump, Treat Pickup, and Game Over | Triggering sound events (`'jump'`, `'collect'`, `'gameover'`) on key events |
| **R3.1** | UI State Machine | Game state flow: `START` -> `PLAYING` <-> `PAUSED` -> `GAMEOVER` -> `PLAYING` | DOM overlays (`#startScreen`, `#pauseOverlay`, `#gameOverScreen`), state flags |
| **R3.2** | User Interface | Responsive overlays with controls instructions, pause menu, and restart button | Immediate restart capability, score display, high score badge |

---

## 2. Feature Area Mapping

To achieve complete coverage, Tier 1 and Tier 2 test specifications are divided into 5 Major Feature Areas each:

### Tier 1 Feature Areas (Feature Coverage)
- **Feature Area F1**: HTML5 Canvas Rendering, Main Game Loop & UI State Machine (`START`, `PLAYING`, `PAUSED`, `GAMEOVER`)
- **Feature Area F2**: Player Jump Controls, Physics & Air Mechanics (`Space`, `ArrowUp`, Touch Jump, Gravity)
- **Feature Area F3**: Player Duck/Slide Controls & Hitbox Height Adjustments (`ArrowDown`, Touch Duck, Low Overhead Clearance)
- **Feature Area F4**: Collectible Bone Treats, Particle Effects & Web Audio SFX
- **Feature Area F5**: Progressive Speed Scaling, Distance Scoring & LocalStorage High Score Persistence

### Tier 2 Feature Areas (Boundary & Corner Cases)
- **Boundary Area B1**: Canvas Resize, Responsive Viewport & High-DPI (Retina) Scaling Boundaries
- **Boundary Area B2**: Rapid Keypresses, Input Flooding & Auto-Repeat Key Stress
- **Boundary Area B3**: Simultaneous / Conflicting Inputs & Window Focus / Blur State Handling
- **Boundary Area B4**: LocalStorage Edge Cases (Corrupted Data, Disabled Storage, Integer Overflow)
- **Boundary Area B5**: Edge-Case Collisions, Hitbox Grazing & High-Speed Tunneling Prevention

---

## 3. Tier 1 Test Case Specifications (Feature Coverage - 25 Tests)

---

### Feature Area F1: HTML5 Canvas Rendering, Main Game Loop & UI State Machine

#### T1-F1-01: Canvas Element Initialization & Start Screen Render
- **Objective**: Verify canvas element renders with correct context and Start Screen overlay on initial page load.
- **Pre-conditions**: Fresh browser load of `index.html`.
- **Inputs**: Page load.
- **Expected Behavior**: Canvas is present in DOM; 2D context is acquired; Start Screen overlay (`#startScreen`) is displayed showing title and control instructions.
- **Assertions**:
  - `document.querySelector('canvas#gameCanvas') !== null`
  - `game.state === 'START'`
  - `#startScreen` element is visible (`display !== 'none'`).

#### T1-F1-02: State Transition from Start to Playing
- **Objective**: Verify game state transitions from `START` to `PLAYING` when user provides start input.
- **Pre-conditions**: Game in `START` state.
- **Inputs**: Dispatch `keydown` event with `code: 'Space'` or click `#startBtn`.
- **Expected Behavior**: Start overlay hides; main loop starts updating entities; player Corgi enters `RUNNING` state.
- **Assertions**:
  - `game.state === 'PLAYING'`
  - `#startScreen` has `display: none`
  - `player.state === 'RUNNING'`.

#### T1-F1-03: Game Pause and Resume Toggle
- **Objective**: Verify pressing Pause key toggles state between `PLAYING` and `PAUSED` and freezes/resumes physics.
- **Pre-conditions**: Game state is `PLAYING`.
- **Inputs**: Dispatch `keydown` `code: 'KeyP'` (Pause), wait 500ms, dispatch `keydown` `code: 'KeyP'` (Resume).
- **Expected Behavior**: First press displays `#pauseOverlay` and halts entity movement. Second press hides overlay and resumes movement.
- **Assertions**:
  - State transitions: `PLAYING` -> `PAUSED` -> `PLAYING`.
  - While `PAUSED`, `player.x` and `player.y` remain constant across animation frames.

#### T1-F1-04: Game Over Transition on Obstacle Collision
- **Objective**: Verify obstacle collision transitions game to `GAMEOVER` state and displays Game Over screen.
- **Pre-conditions**: Game in `PLAYING` state with approaching fire hydrant obstacle.
- **Inputs**: Allow Corgi to collide with obstacle without jumping.
- **Expected Behavior**: Crash sound plays; player movement stops; `#gameOverScreen` appears displaying final score and high score.
- **Assertions**:
  - `game.state === 'GAMEOVER'`
  - `#gameOverScreen` visible (`display !== 'none'`)
  - `#finalScore` matches current accumulated game score.

#### T1-F1-05: Instant Restart from Game Over State
- **Objective**: Verify pressing Space or clicking Restart button on Game Over screen resets score, entities, and returns to `PLAYING`.
- **Pre-conditions**: Game state is `GAMEOVER`.
- **Inputs**: Dispatch `keydown` `code: 'Space'` or click `#restartBtn`.
- **Expected Behavior**: Game Over overlay hides; score resets to 0; obstacles/treats clear; player resets to ground position; game state becomes `PLAYING`.
- **Assertions**:
  - `game.state === 'PLAYING'`
  - `game.score === 0`
  - `entities.length === 0` (or re-initialized)
  - `player.y === groundY`.

---

### Feature Area F2: Player Jump Controls, Physics & Air Mechanics

#### T1-F2-01: Jump Activation via Spacebar Key
- **Objective**: Verify pressing `Space` while grounded launches Corgi into air with jump velocity.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded (`player.isGrounded === true`).
- **Inputs**: Dispatch `keydown` `code: 'Space'`.
- **Expected Behavior**: Corgi sets vertical velocity `vy = jumpImpulse` (negative value); `isGrounded` becomes `false`; jump sound triggers.
- **Assertions**:
  - `player.vy < 0`
  - `player.isGrounded === false`
  - `player.state === 'JUMPING'`
  - Jump SFX invoked.

#### T1-F2-02: Jump Activation via Up Arrow Key
- **Objective**: Verify pressing `ArrowUp` produces identical jump mechanics to `Space`.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch `keydown` `code: 'ArrowUp'`.
- **Expected Behavior**: Corgi launches upward with exact same jump velocity and trajectory.
- **Assertions**:
  - `player.vy === initialJumpImpulse`
  - `player.isGrounded === false`.

#### T1-F2-03: Touch/Click Jump Activation
- **Objective**: Verify canvas touch or click interaction triggers jump impulse.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch `touchstart` event on canvas.
- **Expected Behavior**: Corgi initiates jump upward.
- **Assertions**:
  - `player.isGrounded === false`
  - `player.vy < 0`.

#### T1-F2-04: Parabolic Arc & Gravity Acceleration
- **Objective**: Verify Corgi follows physics gravity parabolic curve and lands safely back on ground.
- **Pre-conditions**: Corgi in `JUMPING` state.
- **Inputs**: Advance game loop frames over 600ms (36 frames at 60 FPS).
- **Expected Behavior**: `vy` increases by `gravity * dt` each frame; `y` reaches minimum (peak height); `vy` becomes positive (falling); `y` clamps to `groundY` when landing.
- **Assertions**:
  - Peak height `y_peak < groundY` reached.
  - On landing: `player.y === groundY`, `player.isGrounded === true`, `player.state === 'RUNNING'`.

#### T1-F2-05: Double Jump Prevention (Single Jump Only)
- **Objective**: Verify issuing a second jump input while in mid-air does NOT trigger a second jump impulse.
- **Pre-conditions**: Corgi in mid-air (`player.isGrounded === false`).
- **Inputs**: Dispatch `keydown` `code: 'Space'` while `player.y < groundY`.
- **Expected Behavior**: Keypress ignored; `vy` is not reset to initial jump impulse.
- **Assertions**:
  - `player.vy` continues standard gravity progression without sudden negative spike.
  - Peak jump height remains identical to single jump limit.

---

### Feature Area F3: Player Duck/Slide Controls & Hitbox Height Adjustments

#### T1-F3-01: Duck Activation via Down Arrow Key
- **Objective**: Verify holding `ArrowDown` while grounded changes state to `DUCKING` and lowers bounding box height.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch `keydown` `code: 'ArrowDown'`.
- **Expected Behavior**: Corgi enters `DUCKING` state; bounding box height decreases (e.g. from `60px` to `30px`); bottom of bounding box remains aligned to floor.
- **Assertions**:
  - `player.state === 'DUCKING'`
  - `player.height < normalHeight` (e.g., `player.height === normalHeight * 0.5`)
  - `player.y + player.height === groundY`.

#### T1-F3-02: Duck Release Restoration
- **Objective**: Verify releasing `ArrowDown` restores Corgi to full height and `RUNNING` state.
- **Pre-conditions**: Corgi in `DUCKING` state.
- **Inputs**: Dispatch `keyup` `code: 'ArrowDown'`.
- **Expected Behavior**: Corgi transitions back to `RUNNING` state and full height.
- **Assertions**:
  - `player.state === 'RUNNING'`
  - `player.height === normalHeight`.

#### T1-F3-03: Touch Duck Activation
- **Objective**: Verify touch swipe down or bottom screen tap activates ducking.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch `touchstart` on lower half of canvas.
- **Expected Behavior**: Corgi enters `DUCKING` state.
- **Assertions**:
  - `player.state === 'DUCKING'`
  - `player.height < normalHeight`.

#### T1-F3-04: High Hurdle Clearance while Ducking
- **Objective**: Verify ducking reduces Corgi height sufficiently to pass under high hurdle obstacles without collision.
- **Pre-conditions**: High hurdle spawned at elevation `y_hurdle` where `groundY - normalHeight < y_hurdle < groundY - duckHeight`.
- **Inputs**: Dispatch `keydown` `code: 'ArrowDown'` while passing under hurdle.
- **Expected Behavior**: Reduced hitbox height allows Corgi to pass beneath hurdle without collision.
- **Assertions**:
  - `Collision.check(player, hurdle) === false`
  - Game state remains `PLAYING`.

#### T1-F3-05: Mid-Air Fast Fall via Duck Keypress
- **Objective**: Verify pressing `ArrowDown` while in mid-air increases downward gravity for fast-falling.
- **Pre-conditions**: Corgi in `JUMPING` state.
- **Inputs**: Dispatch `keydown` `code: 'ArrowDown'` at jump apex.
- **Expected Behavior**: Downward velocity `vy` increases faster than normal gravity, causing Corgi to reach ground quicker.
- **Assertions**:
  - `vy_fastfall > vy_normal`
  - Total airborne time is shorter than standard jump duration.

---

### Feature Area F4: Collectible Bone Treats, Particle Effects & Web Audio SFX

#### T1-F4-01: Bone Treat Spawning & Leftward Scrolling
- **Objective**: Verify bone treat entities spawn in the entity array and scroll leftward at current game speed.
- **Pre-conditions**: Game in `PLAYING` state.
- **Inputs**: Advance game loop by 2 seconds.
- **Expected Behavior**: Spawner creates treat entity (`type === 'treat'`) at right canvas edge (`x = canvas.width`); treat `x` coordinate decreases over time.
- **Assertions**:
  - `entities.some(e => e.type === 'treat') === true`
  - `treat.x` decreases each frame by `speed * dt`.

#### T1-F4-02: Precise Collision & Treat Pickup Collection
- **Objective**: Verify Corgi collecting a treat triggers pickup event, increments score, and removes treat.
- **Pre-conditions**: Treat entity at position overlapping Corgi bounding box.
- **Inputs**: Advance 1 frame tick to cause bounding box overlap.
- **Expected Behavior**: Collision detected; score increases by treat value (+50); treat entity removed from active list.
- **Assertions**:
  - `game.score` increases by treat point value.
  - Treat entity removed from `entities` array.

#### T1-F4-03: Treat Pickup Particle Burst Effect
- **Objective**: Verify collecting a bone treat spawns a particle burst effect at treat coordinates.
- **Pre-conditions**: Treat collection event triggered at `(treat.x, treat.y)`.
- **Inputs**: Trigger treat pickup.
- **Expected Behavior**: Particle system emits multiple particles centered at `(treat.x, treat.y)` that expand outward and fade.
- **Assertions**:
  - `particles.length > 0` (or `particlePool.activeCount > 0`)
  - Initial particle origin matches treat center point.

#### T1-F4-04: Treat Pickup Audio Sound Effect
- **Objective**: Verify Web Audio synthesizer plays pickup sound effect on treat collection.
- **Pre-conditions**: Audio system initialized, treat collected.
- **Inputs**: Trigger treat pickup.
- **Expected Behavior**: `Audio.play('collect')` is called.
- **Assertions**:
  - Web Audio oscillator/sound player invoked with `'collect'` sound type.

#### T1-F4-05: Uncollected Treat Off-Screen Cleanup
- **Objective**: Verify treats that scroll past player without being collected are cleaned up when off-screen.
- **Pre-conditions**: Treat spawned at `x = canvas.width`, Corgi does not touch treat.
- **Inputs**: Advance game loop until treat `x + width < 0`.
- **Expected Behavior**: Treat entity removed from entities array; score unchanged.
- **Assertions**:
  - Treat entity removed from `entities` array when `x < -width`.
  - `game.score` does not increment.

---

### Feature Area F5: Progressive Speed Scaling, Distance Scoring & LocalStorage High Score

#### T1-F5-01: Continuous Real-Time Score Accumulation
- **Objective**: Verify score continuously accumulates over time while game state is `PLAYING`.
- **Pre-conditions**: Game state is `PLAYING`, score = 0 at `t = 0`.
- **Inputs**: Run game loop for 3 seconds (180 frames).
- **Expected Behavior**: Score increases proportionally to distance traveled / time elapsed.
- **Assertions**:
  - `game.score > 0`
  - Score value increases monotonically.

#### T1-F5-02: Progressive World Speed Acceleration
- **Objective**: Verify scroll speed gradually increases over time to scale difficulty.
- **Pre-conditions**: Game in `PLAYING` state with initial speed `baseSpeed`.
- **Inputs**: Run game loop for 20 seconds.
- **Expected Behavior**: `game.currentSpeed` increases according to speed scaling formula.
- **Assertions**:
  - `game.currentSpeed > baseSpeed`
  - Speed caps at defined `maxSpeed`.

#### T1-F5-03: High Score Saved to LocalStorage on Game Over
- **Objective**: Verify when current score exceeds saved high score, LocalStorage `corgi_runner_highscore` is updated on Game Over.
- **Pre-conditions**: `localStorage.getItem('corgi_runner_highscore')` is `100`.
- **Inputs**: Play game, reach score of 350, collide with obstacle to trigger Game Over.
- **Expected Behavior**: Game Over screen shows new high score; LocalStorage is updated to `350`.
- **Assertions**:
  - `localStorage.getItem('corgi_runner_highscore') === '350'`
  - `#gameOverHighScore` text displays `350`.

#### T1-F5-04: High Score Retained Across Browser Reloads
- **Objective**: Verify stored high score is loaded from LocalStorage during initial game setup.
- **Pre-conditions**: Set `localStorage.setItem('corgi_runner_highscore', '750')` prior to initialization.
- **Inputs**: Load game page.
- **Expected Behavior**: High score 750 is displayed on HUD and Start Screen overlay.
- **Assertions**:
  - `game.highScore === 750`
  - HUD high score element contains `"750"`.

#### T1-F5-05: Non-Overwrite of Higher Stored High Score
- **Objective**: Verify achieving a lower score than stored high score does NOT overwrite LocalStorage.
- **Pre-conditions**: `localStorage.setItem('corgi_runner_highscore', '1000')`.
- **Inputs**: Play game, reach score of 200, collide with obstacle to trigger Game Over.
- **Expected Behavior**: LocalStorage remains `1000`; Game Over displays high score 1000.
- **Assertions**:
  - `localStorage.getItem('corgi_runner_highscore') === '1000'`
  - `game.highScore === 1000`.

---

## 4. Tier 2 Test Case Specifications (Boundary & Corner Cases - 25 Tests)

---

### Boundary Area B1: Canvas Resize, Responsive Viewport & High-DPI Scaling Boundaries

#### T2-B1-01: Window Resize Mid-Gameplay
- **Objective**: Verify resizing browser window while game is active does not crash rendering loop or corrupt player ground alignment.
- **Pre-conditions**: Game in `PLAYING` state at 1024x768.
- **Inputs**: Dispatch `resize` event with window size 600x900.
- **Expected Behavior**: Canvas resizes or adjusts internal scaling ratio; ground level recalculates correctly; Corgi remains grounded at valid Y coordinate.
- **Assertions**:
  - `player.y <= groundY`
  - `canvas.width` and `canvas.height` match new viewport or scaled canvas dimensions.
  - No `NaN` values in `player.x`, `player.y`, or `groundY`.

#### T2-B1-02: High-DPI (Retina) Pixel Ratio Scaling (devicePixelRatio = 2)
- **Objective**: Verify devicePixelRatio scaling sets canvas buffer width/height correctly to prevent blurry graphics or bounding box offset.
- **Pre-conditions**: Set `window.devicePixelRatio = 2`.
- **Inputs**: Initialize canvas and render 1 frame.
- **Expected Behavior**: Canvas internal width = `CSS_width * 2`, height = `CSS_height * 2`; context scale set to `(2, 2)`.
- **Assertions**:
  - `canvas.width === canvas.clientWidth * 2`
  - Hitbox coordinates match visual sprite coordinates exactly.

#### T2-B1-03: Minimum Mobile Viewport Boundary (320px Width)
- **Objective**: Verify UI overlays and canvas controls remain functional on 320px screen width.
- **Pre-conditions**: Window size 320x568.
- **Inputs**: Load game and click `#startBtn`.
- **Expected Behavior**: Start overlay elements fit within screen boundaries without overlapping or overflow; start button is clickable.
- **Assertions**:
  - All UI elements inside visible viewport area.
  - Click event fires cleanly and transitions state to `PLAYING`.

#### T2-B1-04: Maximum 4K Viewport Boundary (3840x2160)
- **Objective**: Verify running on 4K resolution does not accelerate physics speed due to delta time calculation errors.
- **Pre-conditions**: Window size 3840x2160.
- **Inputs**: Advance game loop by 60 frames.
- **Expected Behavior**: Game speed remains identical to standard 1080p speed; frame delta `dt` capped at 0.033s.
- **Assertions**:
  - `dt <= 0.033`
  - Player horizontal scrolling speed matches standard velocity.

#### T2-B1-05: Orientation Change Mid-Jump
- **Objective**: Verify changing screen orientation mid-jump does not cause infinite height loop or physics crash.
- **Pre-conditions**: Corgi mid-jump at peak height `y_peak`.
- **Inputs**: Dispatch `orientationchange` event.
- **Expected Behavior**: Corgi ground coordinate updates; gravity continues pulling Corgi down to new ground level.
- **Assertions**:
  - `player.isGrounded === true` within 1.2s post-orientation change.
  - `player.y` clamped to updated `groundY`.

---

### Boundary Area B2: Rapid Keypresses, Input Flooding & Auto-Repeat Key Stress

#### T2-B2-01: Rapid Jump Key Spamming (20 Presses / Second)
- **Objective**: Verify rapidly spamming `Space` key does not stack jump velocity or bypass single-jump restriction.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch 20 `keydown` events for `Space` at 50ms intervals.
- **Expected Behavior**: Only first press while grounded initiates jump. Air keypresses ignored.
- **Assertions**:
  - Max jump height matches single jump peak `y_peak`.
  - Velocity `vy` never exceeds initial single jump impulse.

#### T2-B2-02: Rapid Jump-Duck Alternation (16ms Toggle Intervals)
- **Objective**: Verify rapidly toggling `ArrowUp` and `ArrowDown` every frame does not leave state machine in corrupted or undefined state.
- **Pre-conditions**: Game in `PLAYING` state.
- **Inputs**: Alternate `keydown ArrowUp` and `keydown ArrowDown` every 16ms for 30 frames.
- **Expected Behavior**: Corgi cleanly transitions between valid states without throwing errors or setting invalid height values.
- **Assertions**:
  - `player.state` is always one of `['RUNNING', 'JUMPING', 'DUCKING']`.
  - Bounding box height `player.height > 0` and not `NaN`.

#### T2-B2-03: Key Hold-Down Auto-Repeat Flooding (event.repeat === true)
- **Objective**: Verify continuous auto-repeat keydown events from holding `Space` do not launch infinite jumps.
- **Pre-conditions**: Game in `PLAYING` state.
- **Inputs**: Dispatch continuous `keydown` `Space` with `event.repeat = true` over 2 seconds.
- **Expected Behavior**: Initial jump executes; Corgi lands; if auto-repeat jump is permitted on landing, it executes clean single jumps without velocity accumulation.
- **Assertions**:
  - Velocity `vy` does not accumulate or compound.

#### T2-B2-04: Rapid Pause Key Spamming (Escape/P Spam)
- **Objective**: Verify spamming Pause key 10 times in 100ms leaves state consistent and prevents delta time spike on unpause.
- **Pre-conditions**: Game in `PLAYING` state.
- **Inputs**: Dispatch 10 rapid `keydown` `KeyP` events.
- **Expected Behavior**: State toggles 10 times (even count -> `PLAYING`). Frame timer delta `dt` resets on unpause to prevent entity teleportation.
- **Assertions**:
  - `game.state === 'PLAYING'`
  - First frame `dt <= 0.05` after unpause.

#### T2-B2-05: Rapid Restart Clicks on Game Over Screen
- **Objective**: Verify rapidly clicking `#restartBtn` 5 times within 50ms does not spawn multiple concurrent game loops or spawner timers.
- **Pre-conditions**: Game state `GAMEOVER`.
- **Inputs**: Dispatch 5 click events on `#restartBtn` in 50ms.
- **Expected Behavior**: Exactly one active `requestAnimationFrame` loop runs; obstacle spawner runs at normal baseline frequency.
- **Assertions**:
  - Single game loop active (`loopId` is singular).
  - Obstacle spawn rate remains normal (1 obstacle per 1.5 - 3 seconds).

---

### Boundary Area B3: Simultaneous / Conflicting Inputs & Window Focus / Blur State Handling

#### T2-B3-01: Simultaneous Jump + Duck Pressed On Same Frame
- **Objective**: Verify sending `Space` and `ArrowDown` keydowns in the exact same frame tick evaluates deterministically without lockup.
- **Pre-conditions**: Game in `PLAYING` state, Corgi grounded.
- **Inputs**: Dispatch `Space` keydown and `ArrowDown` keydown in same frame cycle.
- **Expected Behavior**: Engine resolves priority cleanly (e.g. Jump takes precedence or Jump with duck height); no runtime exception occurs.
- **Assertions**:
  - `player.state` is a valid string.
  - No uncaught JS errors in console.

#### T2-B3-02: Holding Duck While Pressing Jump Key
- **Objective**: Verify holding `ArrowDown` while pressing `Space` initiates jump, and resumes ducking upon landing if `ArrowDown` is still held.
- **Pre-conditions**: Corgi in `DUCKING` state (`ArrowDown` held down).
- **Inputs**: Dispatch `keydown Space` while `ArrowDown` remains active.
- **Expected Behavior**: Corgi jumps into air; upon landing back on ground, Corgi immediately resumes `DUCKING` state.
- **Assertions**:
  - Mid-air: `player.isGrounded === false`.
  - On landing: `player.state === 'DUCKING'` and `player.height === duckHeight`.

#### T2-B3-03: Multi-Touch Gesture Conflict (2-Finger Simultaneous Touch)
- **Objective**: Verify simultaneous 2-finger touch inputs on upper and lower screen regions do not cause array out-of-bounds or touch tracking errors.
- **Pre-conditions**: Mobile touch mode active, `PLAYING` state.
- **Inputs**: Dispatch `touchstart` event with `touches.length = 2` (Finger 1 Y=100, Finger 2 Y=450).
- **Expected Behavior**: Touch handler processes primary finger or resolves gesture safely.
- **Assertions**:
  - Game continues running without throwing `TypeError: Cannot read properties of undefined`.

#### T2-B3-04: Window Blur / Tab Switch During Active Key Press
- **Objective**: Verify switching browser tabs while holding Duck or Jump key clears key state buffer or auto-pauses game.
- **Pre-conditions**: Corgi in `DUCKING` state with `ArrowDown` held.
- **Inputs**: Dispatch `window.blur` event, followed by `window.focus`.
- **Expected Behavior**: Game auto-pauses or resets held key flags so Corgi is not stuck ducking infinitely after refocus.
- **Assertions**:
  - Upon focus: `game.state === 'PAUSED'` OR `player.isDucking === false`.

#### T2-B3-05: Pause Key Triggered Mid-Jump
- **Objective**: Verify pausing game mid-jump freezes jump trajectory accurately and resumes from exact height/velocity when unpaused.
- **Pre-conditions**: Corgi mid-jump at `y_mid` with vertical velocity `vy_mid`.
- **Inputs**: Dispatch `keydown KeyP`, wait 1000ms, dispatch `keydown KeyP`.
- **Expected Behavior**: During pause, `y` remains frozen at `y_mid`. On unpause, jump continues trajectory smoothly with `vy_mid`.
- **Assertions**:
  - While paused: `y` unchanged across frames.
  - On unpause: `y` continues downward/upward arc without teleporting to ground.

---

### Boundary Area B4: LocalStorage Edge Cases (Corrupted Data, Disabled Storage, Integer Overflow)

#### T2-B4-01: Corrupted String in LocalStorage High Score
- **Objective**: Verify invalid/corrupted string in `corgi_runner_highscore` (e.g. `"CORRUPTED_DATA"`, `"NaN"`) does not crash engine or produce `NaN` score displays.
- **Pre-conditions**: `localStorage.setItem('corgi_runner_highscore', 'INVALID_STR')`.
- **Inputs**: Load game page.
- **Expected Behavior**: Storage module detects non-numeric value, defaults high score to 0, and safely overwrites corrupted storage.
- **Assertions**:
  - `game.highScore === 0`
  - HUD shows High Score: 0 without throwing error.

#### T2-B4-02: Negative Score in LocalStorage Boundary
- **Objective**: Verify negative high score stored in LocalStorage is normalized to 0.
- **Pre-conditions**: `localStorage.setItem('corgi_runner_highscore', '-999')`.
- **Inputs**: Load game page.
- **Expected Behavior**: High score parses safely and defaults to 0.
- **Assertions**:
  - `game.highScore === 0`.

#### T2-B4-03: Exception Handling when LocalStorage is Blocked (Incognito / QuotaExceeded)
- **Objective**: Verify game runs without breaking when `localStorage.setItem` throws `DOMException` or `QuotaExceededError`.
- **Pre-conditions**: Mock `localStorage.setItem` to throw `DOMException: Access denied`.
- **Inputs**: Play game to Game Over with new high score.
- **Expected Behavior**: Storage error is caught gracefully in try/catch block; in-memory score tracking continues; game does not crash.
- **Assertions**:
  - Game Over UI renders final score cleanly.
  - No uncaught exception in console log.

#### T2-B4-04: Extremely Large Score Integer (9,999,999 Boundary)
- **Objective**: Verify extremely large high score value does not break UI overlay text layout or canvas rendering.
- **Pre-conditions**: `localStorage.setItem('corgi_runner_highscore', '9999999')`.
- **Inputs**: Load game and inspect Start screen and HUD.
- **Expected Behavior**: High score displays cleanly without text wrapping off-screen or clipping canvas borders.
- **Assertions**:
  - Element width fits within UI container.
  - Score formatted cleanly.

#### T2-B4-05: Storage Reset / Clear Execution
- **Objective**: Verify clearing `localStorage` resets high score back to 0 immediately in current session.
- **Pre-conditions**: `localStorage.setItem('corgi_runner_highscore', '500')`.
- **Inputs**: Call `Storage.resetHighScore()` or clear storage and trigger update.
- **Expected Behavior**: High score resets to 0 across HUD and internal state.
- **Assertions**:
  - `game.highScore === 0`
  - `localStorage.getItem('corgi_runner_highscore') === '0'` (or `null`).

---

### Boundary Area B5: Edge-Case Collisions, Hitbox Grazing & High-Speed Tunneling Prevention

#### T2-B5-01: Grazing Collision (0.1px Overlap at Hitbox Corner)
- **Objective**: Verify even a sub-pixel overlap (0.1px) between Corgi AABB and obstacle AABB triggers collision.
- **Pre-conditions**: Corgi AABB `[x1=100, y1=300, w1=50, h1=50]` (right edge = 150). Obstacle AABB at `x2=149.9` (overlap = 0.1px).
- **Inputs**: Execute collision check `Collision.check(player, obstacle)`.
- **Expected Behavior**: Collision evaluator returns `true`.
- **Assertions**:
  - `Collision.check(player, obstacle) === true`
  - Game transitions to `GAMEOVER`.

#### T2-B5-02: Zero-Distance Tangent (Touching Edges Without Overlap)
- **Objective**: Verify touching edges (`player.x + player.w === obstacle.x`) with exactly 0.0px overlap does NOT trigger collision.
- **Pre-conditions**: Corgi right edge `x = 150.0`, obstacle left edge `x = 150.0`.
- **Inputs**: Execute collision check `Collision.check(player, obstacle)`.
- **Expected Behavior**: Collision evaluator returns `false`.
- **Assertions**:
  - `Collision.check(player, obstacle) === false`
  - Game state remains `PLAYING`.

#### T2-B5-03: High-Speed Tunneling Prevention (Fast Velocity Frame Step)
- **Objective**: Verify at high world speed (e.g. 1500px/s, movement step 45px per frame), player does not pass entirely through a narrow obstacle (width 20px) without detection.
- **Pre-conditions**: Obstacle width 20px at `x = 200`. Player right edge at `x = 180` before tick, moves to `x = 225` after tick (straddling obstacle).
- **Inputs**: Execute 1 frame movement tick at high speed.
- **Expected Behavior**: Continuous collision detection (CCD / swept AABB) detects intersection during frame interval.
- **Assertions**:
  - Collision detected (`true`).
  - Game transitions to `GAMEOVER`.

#### T2-B5-04: Dual Hitbox Clearance While Ducking Under Low Overhead Hurdle
- **Objective**: Verify ducking lowers top boundary of Corgi hitbox so top edge `y_top` clears obstacle bottom `y_bottom` by at least 1px.
- **Pre-conditions**: Overhead hurdle bottom edge `y_bottom = 320`. Corgi normal top edge `y = 300` (collides). Corgi ducked top edge `y = 330` (clears).
- **Inputs**: Set Corgi state to `DUCKING` as hurdle passes.
- **Expected Behavior**: Collision check evaluates to `false`.
- **Assertions**:
  - `Collision.check(duckedPlayer, hurdle) === false`.

#### T2-B5-05: Simultaneous Treat Collection and Obstacle Collision on Same Frame
- **Objective**: Verify if Corgi overlaps bone treat AND obstacle on the exact same frame tick, score increases from treat pickup before game transitions to `GAMEOVER`.
- **Pre-conditions**: Treat and fire hydrant spawned at overlapping coordinates.
- **Inputs**: Advance 1 frame tick where Corgi overlaps both entities.
- **Expected Behavior**: Treat point bonus is awarded to final score; crash SFX plays; game state changes to `GAMEOVER`.
- **Assertions**:
  - `game.score` includes treat bonus points (+50).
  - `game.state === 'GAMEOVER'`.

---

## 5. Verification & Test Suite Integration Strategy

### Execution Matrix
- **Tier 1 Tests**: Run via automated headless browser suite (Playwright / Puppeteer / jsdom HTML canvas runner) verifying core game loop, key controls, treat collection, physics arcs, UI screens, and score storage.
- **Tier 2 Tests**: Run via unit/integration harnesses injecting mock window resize events, rapid keypress event queues, corrupted LocalStorage states, and boundary geometry coordinates into `Collision.check()`, `Player.update()`, and `Storage` methods.

### Automated Test Assertions Reference

```javascript
// Test Helper Assertion Examples:
// Tier 1: Check Jump Impulse
assert.strictEqual(player.isGrounded, false, "Player should be airborne");
assert.lessThan(player.vy, 0, "Jump impulse must set negative vertical velocity");

// Tier 1: Check Treat Pickup Score
const initialScore = game.score;
Collision.checkAndResolve(player, treat);
assert.strictEqual(game.score, initialScore + 50, "Treat pickup must add 50 points");

// Tier 2: Check High-Speed Tunneling Prevention
const sweptCollision = Collision.checkSweptAABB(playerPrevBox, playerCurrBox, obstacleBox);
assert.strictEqual(sweptCollision, true, "Swept AABB must detect fast-moving collision");

// Tier 2: Check Corrupted Storage Handling
localStorage.setItem('corgi_runner_highscore', 'CORRUPTED');
const loadedHighScore = Storage.getHighScore();
assert.strictEqual(loadedHighScore, 0, "Corrupted high score must fall back to 0");
```

---
*End of Analysis & Test Case Specifications*
