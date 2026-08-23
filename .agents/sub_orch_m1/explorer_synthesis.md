# Explorer Findings Synthesis — Milestone M1

## 1. Engine Architecture & State Machine (Explorer 1)
- `js/engine.js` exports `Engine` class.
- States: `Engine.STATES = { START: 'START', PLAYING: 'PLAYING', PAUSED: 'PAUSED', GAMEOVER: 'GAMEOVER' }`.
- Main Loop: `requestAnimationFrame` loop targeting 60 FPS. Delta time computed in seconds using `performance.now()`. Clamped to max delta `0.1`s.
- Public API:
  - `constructor(canvas, options)`
  - `start()`
  - `stop()`
  - `setState(newState)`
  - `getState()`
  - `update(deltaTime)`
  - `render()`
  - `onStateChange(callback)`
  - `onUpdate(callback)`
  - `onRender(callback)`

## 2. DOM & Canvas Setup (Explorer 2)
- `index.html`: Logical canvas 800x450 inside `#game-container`, UI overlay layer `#ui-overlay`, links `css/style.css` and imports `js/main.js`.
- `css/style.css`: Dark retro theme, Flexbox centered `#game-container`, responsive aspect ratio matching 16:9 (`min(100vw, 177.78vh)`), pixelated rendering `image-rendering: pixelated; crisp-edges`.
- `js/main.js`: `DOMContentLoaded` bootstrap, Canvas 2D context acquisition (`imageSmoothingEnabled = false`), `Engine` instantiation, `window.addEventListener('resize')` maintaining responsive scale.

## 3. Testing Setup & Unit Tests (Explorer 3)
- `package.json`: `"scripts": { "test": "node --test tests/unit/*.test.js" }`.
- `tests/mocks/canvas.mock.js`: Headless DOM/Canvas mock for Node environment.
- `tests/unit/engine.test.js`: Unit tests using `node:test` and `node:assert` testing:
  - Default initial state is `START`.
  - Valid state transitions (`START` -> `PLAYING` -> `PAUSED` -> `GAMEOVER` -> `START`).
  - Invalid state string throws Error.
  - Game loop start and stop methods work without errors.
  - Delta time clamping at max 0.1s.
  - Subscription callbacks (`onStateChange`, `onUpdate`, `onRender`) fire correctly.
