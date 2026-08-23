# Project: Corgi Endless Runner

## Architecture
An interactive 2D HTML5 Canvas game structured into modular vanilla JavaScript modules (or standard ES modules with lightweight dev/test runner tooling):
- **Game Engine**: Main loop (requestAnimationFrame), state management (Start, Playing, Paused, GameOver), canvas rendering context management.
- **Player (Corgi)**: Animated Corgi sprite/vector renderer, state machine (running, jumping, ducking), physics/movement parameters.
- **Entities & Spawner**: Obstacles (fire hydrants, hurdles) and collectibles (bone treats), pool/spawner logic with progressive speed scaling.
- **Collision System**: Precise bounding-box/hitbox collision detection between player, obstacles, and treat pickups.
- **Score & Persistence**: Score tracker, multiplier/treat counter, high-score LocalStorage manager.
- **Audio System**: Web Audio API synthesizer/sound player for jump, collect treat, and crash sound effects.
- **UI & HUD Overlay**: Canvas HTML overlay elements for Start screen, Pause overlay, and Game Over screen with restart controls.

## Code Layout
```
corgi_runner/
├── index.html            # Main HTML page & canvas container
├── css/
│   └── style.css         # Styling for game canvas and UI overlays
├── js/
│   ├── main.js           # Entry point and initialization
   ├── engine.js         # Game loop & state manager
   ├── player.js         # Corgi player class & rendering logic
   ├── entities.js       # Obstacles & bone treats entities/spawner
   ├── collision.js      # Collision detection logic
   ├── audio.js          # Web Audio sound generator/player
   ├── storage.js        # LocalStorage high score manager
   └── ui.js             # UI Overlay manager
├── tests/                # Automated unit & E2E tests
│   ├── e2e/              # End-to-end test suite
│   └── unit/             # Unit tests for components
└── package.json          # Node scripts for tests & local runner if needed
```

## Interface Contracts
### Engine ↔ Player / Entities / UI
- `Engine.setState(newState)`: Switches game state (START, PLAYING, PAUSED, GAMEOVER).
- `Player.update(deltaTime, inputState)`: Updates position, animation state, and velocity.
- `Player.draw(ctx)`: Renders cute Corgi canvas drawing/sprites.
- `Entities.update(deltaTime, currentSpeed)`: Moves obstacles & treats leftwards; spawns new ones based on timer/distance.
- `Collision.check(player, entity)`: Returns boolean or collision detail.
- `Audio.play(soundName)`: Plays synthesized Web Audio sound ('jump', 'collect', 'gameover').
- `Storage.getHighScore()` / `Storage.saveHighScore(score)`: LocalStorage wrapper.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven test suite (Tiers 1-4) & TEST_READY.md | None | DONE |
| M1 | Core Engine & Rendering | HTML5 Canvas setup, main loop (60 FPS), base state machine | None | DONE |
| M2 | Player Controls & Collision | Corgi rendering, run/jump/duck controls (key/touch), collision engine | M1 | IN_PROGRESS |
| M3 | Obstacles, Treats & Difficulty | Spawner, fire hydrants/hurdles, bone treats, speed scaling | M2 | PLANNED |
| M4 | Score, Web Audio & UI | LocalStorage high score, particle burst, Web Audio SFX, Start/Pause/GameOver UI | M3 | PLANNED |
| M5 | Final E2E Test & Hardening | Pass 100% E2E test suite + Tier 5 Adversarial Coverage Hardening | E2E, M4 | PLANNED |
