# Technical Analysis: HTML5 Canvas DOM Structure, CSS Styling, Responsive Scaling & Entry Point

**Author**: Explorer 2 (Milestone M1)  
**Target Milestone**: M1 — Core Engine & Canvas Rendering  
**Scope**: Canvas DOM structure (`index.html`), Arcade CSS layout (`css/style.css`), Responsive aspect-ratio scaling, Entry Point setup (`js/main.js`).

---

## 1. Executive Summary

This report establishes the technical design and architectural specifications for the HTML5 Canvas DOM, CSS layout, responsive scaling, and bootstrap entry point (`js/main.js`) for the *Corgi Endless Runner* game.

Key Design Decisions:
1. **Logical Resolution**: Fixed **800x450** resolution (16:9 widescreen aspect ratio). All physics, positions, collisions, and drawing coordinates are calculated against this 800x450 logical space.
2. **Responsive CSS Scaling & Letterboxing**: Uses CSS flexbox centering and `aspect-ratio: 16 / 9` container bounds so the canvas scales dynamically to fit any window size while maintaining letterboxing (dark margins) without stretching or distortion.
3. **Crisp Pixel & Vector Rendering**: Applies CSS `image-rendering: pixelated; crisp-edges` and standard 2D canvas context properties (`imageSmoothingEnabled = false`) for crisp, retro visual aesthetics.
4. **Modular Architecture**: Utilizes standard ES Modules (`<script type="module" src="js/main.js">`) for clean separation of concerns and maintainability without polluting the global `window` object.
5. **Coordinate Normalization**: Provides input coordinate mapping functions to translate screen click/touch positions to logical canvas space (0..800, 0..450).

---

## 2. HTML5 Canvas DOM Structure (`index.html`)

### 2.1 Specification & Canvas Attributes
- The DOM structure must define a explicit internal canvas resolution using `width="800"` and `height="450"` attributes directly on the `<canvas>` HTML element.
- Do NOT use CSS to override canvas internal pixel resolution — CSS only controls display dimensions.
- Enclose the canvas inside a container wrapper `#game-container` that also hosts `#ui-overlay` for HUD, start screen, pause screen, and game-over modals.

### 2.2 Proposed DOM Markup (`index.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Corgi Endless Runner</title>
    <link rel="stylesheet" href="css/style.css">
    <!-- Optional: Google Retro Arcade Font -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap" rel="stylesheet">
</head>
<body>
    <div id="game-container" class="game-container">
        <!-- 800x450 logical resolution canvas -->
        <canvas id="game-canvas" width="800" height="450">
            Your browser does not support the HTML5 Canvas element. Please upgrade to a modern browser.
        </canvas>

        <!-- UI & HUD Overlay Container -->
        <div id="ui-overlay" class="ui-overlay">
            <!-- UI Overlays (Start, Pause, GameOver) rendered here or dynamically managed -->
        </div>
    </div>

    <!-- ES Module Entry Point -->
    <script type="module" src="js/main.js"></script>
</body>
</html>
```

---

## 3. CSS Styling & Layout (`css/style.css`)

### 3.1 Styling Goals
- **Full Viewport Centering**: Center `#game-container` both horizontally and vertically within the browser window using CSS Flexbox.
- **Aspect Ratio Lock**: Maintain 16:9 proportion using `aspect-ratio: 16 / 9` and responsive `max-width` / `max-height` constraints (`min(100vw, 177.78vh)`).
- **Retro Arcade Theme**: Dark ambient background (`#0f0f1a` / `#1a1a2e`), neon accent borders, retro box-shadows.
- **Pixel Crispness**: Enforce pixelated rendering rules across browser vendors to prevent bilinear blurring when scaled.

### 3.2 Proposed Stylesheet (`css/style.css`)

```css
/* Universal Reset */
*, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
    user-select: none; /* Prevent text selection during gameplay */
    -webkit-user-select: none;
}

/* Page Body Setup */
html, body {
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #0d0e15;
    font-family: 'Press Start 2P', monospace, sans-serif;
    color: #ffffff;
    display: flex;
    justify-content: center;
    align-items: center;
}

/* Game Container Wrapper */
.game-container {
    position: relative;
    width: 100%;
    max-width: 100vw;
    max-height: 100vh;
    aspect-ratio: 16 / 9;
    display: flex;
    justify-content: center;
    align-items: center;
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 107, 107, 0.2);
    border: 3px solid #2a2a40;
    border-radius: 6px;
    overflow: hidden;
    background-color: #000000;
}

/* HTML5 Canvas Rendering */
#game-canvas {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: contain;

    /* Prevent bilinear blurring for retro crisp pixels */
    image-rendering: pixelated;
    image-rendering: crisp-edges;
    image-rendering: -moz-crisp-edges;
    image-rendering: -webkit-optimize-contrast;
}

/* UI Overlay Wrapper */
.ui-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none; /* Allow mouse events to pass through to canvas unless over interactive UI */
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}

/* Allow interactive buttons inside overlay to capture pointer events */
.ui-overlay button, 
.ui-overlay .interactive {
    pointer-events: auto;
}
```

---

## 4. Responsive Canvas Scaling & Input Coordinate Mapping

### 4.1 Scaling Concept
The game canvas internally operates on a fixed coordinate system:
- $X \in [0, 800]$
- $Y \in [0, 450]$

When the window resizes, the CSS container scales the visual element (`canvas.clientWidth`, `canvas.clientHeight`).

### 4.2 Screen-to-Logical Coordinate Conversion Formula
When handling clicks or touch events on the canvas, raw event coordinates (`event.clientX`, `event.clientY`) must be mapped back to logical canvas coordinates ($X_{logical}, Y_{logical}$):

$$X_{logical} = (event.clientX - rect.left) \times \left(\frac{800}{rect.width}\right)$$
$$Y_{logical} = (event.clientY - rect.top) \times \left(\frac{450}{rect.height}\right)$$

where `rect = canvas.getBoundingClientRect()`.

```javascript
/**
 * Maps screen pointer coordinates to canvas 800x450 logical space.
 * @param {HTMLCanvasElement} canvas 
 * @param {MouseEvent|TouchEvent} event 
 * @returns {{x: number, y: number}} Logical coordinates
 */
export function getLogicalCoordinates(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}
```

---

## 5. Entry Point Setup (`js/main.js`)

### 5.1 Responsibilities of `main.js`
1. Attach to `window.addEventListener('DOMContentLoaded', ...)` or run immediately upon ES module loading.
2. Retrieve the `#game-canvas` element.
3. Validate context availability (`canvas.getContext('2d')`).
4. Instantiate the `Engine` class passing the canvas element or context.
5. Bind window resize listeners to re-calculate viewport bounding client rects.
6. Invoke `engine.start()`.

### 5.2 Proposed Implementation (`js/main.js`)

```javascript
import { Engine } from './engine.js';

window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('game-canvas');
    if (!canvas) {
        console.error('Fatal Error: Canvas element #game-canvas not found in DOM.');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.error('Fatal Error: 2D rendering context not supported by this browser.');
        return;
    }

    // Set pixel crisp rendering on 2d context
    ctx.imageSmoothingEnabled = false;

    // Instantiate game engine
    const engine = new Engine(canvas);
    
    // Store global reference for debug / testing access if window exists
    if (typeof window !== 'undefined') {
        window.__GAME_ENGINE__ = engine;
    }

    // Start engine loop
    engine.start();

    console.log('Corgi Endless Runner initialized successfully.');
});
```

---

## 6. Verification & Testing Recommendations

1. **DOM Structure Verification**:
   - Check `#game-canvas` exists and has `width="800"` and `height="450"`.
   - Verify script tag uses `type="module"`.

2. **CSS Layout Verification**:
   - Verify aspect ratio container maintains 16:9 ratio across different window dimensions (e.g. 1920x1080, 1366x768, 375x667).
   - Ensure horizontal/vertical centering and letterboxing with no scrollbars (`overflow: hidden`).

3. **JS Entry Point & Unit Testing**:
   - In JSDOM test runner (Vitest/Jest), mock HTMLCanvasElement and `getContext('2d')`.
   - Verify `main.js` safely handles missing canvas gracefully without uncaught exceptions.
