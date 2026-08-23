import fs from 'fs';

console.log('=== EMPIRICAL ANALYSIS OF CANVAS RESIZE, COORDINATE SCALING, & HIGH-DPI ===\n');

// 1. Codebase Search Analysis
const mainJsContent = fs.readFileSync('js/main.js', 'utf8');
const engineJsContent = fs.readFileSync('js/engine.js', 'utf8');
const gameJsContent = fs.readFileSync('src/game.js', 'utf8');
const indexHtmlContent = fs.readFileSync('index.html', 'utf8');
const cssContent = fs.readFileSync('css/style.css', 'utf8');

console.log('--- 1. Coordinate Transformation Math (clientX - rect.left) * (800 / rect.width) ---');
const coordMathRegex = /clientX\s*-\s*rect\.left/i;
const coordScaleRegex = /800\s*\/\s*rect\.width|width\s*\/\s*rect\.width/i;

const hasCoordMathInMain = coordMathRegex.test(mainJsContent) || coordScaleRegex.test(mainJsContent);
const hasCoordMathInEngine = coordMathRegex.test(engineJsContent) || coordScaleRegex.test(engineJsContent);
const hasCoordMathInGame = coordMathRegex.test(gameJsContent) || coordScaleRegex.test(gameJsContent);

console.log('Presence of (clientX - rect.left) * (800 / rect.width) or similar scaling formula:');
console.log('  - js/main.js:', hasCoordMathInMain ? 'PRESENT' : 'MISSING');
console.log('  - js/engine.js:', hasCoordMathInEngine ? 'PRESENT' : 'MISSING');
console.log('  - src/game.js:', hasCoordMathInGame ? 'PRESENT' : 'MISSING');

console.log('\n--- 2. High-DPI (devicePixelRatio) Handling ---');
const dpiRegex = /devicePixelRatio/i;

const hasDpiInHtml = dpiRegex.test(indexHtmlContent);
const hasDpiInMain = dpiRegex.test(mainJsContent);
const hasDpiInEngine = dpiRegex.test(engineJsContent);
const hasDpiInGame = dpiRegex.test(gameJsContent);
const hasDpiInCss = dpiRegex.test(cssContent);

console.log('Presence of window.devicePixelRatio handling:');
console.log('  - index.html:', hasDpiInHtml ? 'PRESENT' : 'MISSING');
console.log('  - js/main.js:', hasDpiInMain ? 'PRESENT' : 'MISSING');
console.log('  - js/engine.js:', hasDpiInEngine ? 'PRESENT' : 'MISSING');
console.log('  - src/game.js:', hasDpiInGame ? 'PRESENT' : 'MISSING');
console.log('  - css/style.css:', hasDpiInCss ? 'PRESENT' : 'MISSING');

console.log('\n--- 3. Responsive Window Resize Behavior ---');
console.log('CSS Container Scaling:');
console.log('  - #game-container styling in css/style.css:');
console.log('    width: 100vw; height: 56.25vw; max-width: 177.78vh; max-height: 100vh;');
console.log('  - #game-canvas styling in css/style.css:');
console.log('    width: 100%; height: 100%; image-rendering: pixelated;');
console.log('  - Canvas internal buffer dimensions in index.html:');
console.log('    <canvas id="game-canvas" width="800" height="450"></canvas>');
console.log('  - main.js handleResize behavior:');
console.log('    Only resets ctx.imageSmoothingEnabled = false on window resize event.');
console.log('    Does NOT scale backing store canvas.width/height or compute scaling factors.');

console.log('\n--- 4. Empirical Mathematical Simulation of Input Misalignment ---');
const mockRect = { left: 100, top: 50, width: 1200, height: 675 }; // Scaled up by 1.5x on a 1080p display
const eventClientX = 700; // User clicks at center of canvas on screen (100 + 1200/2 = 700)
const eventClientY = 387.5; // (50 + 675/2 = 387.5)

const correctCanvasX = (eventClientX - mockRect.left) * (800 / mockRect.width); // 400
const correctCanvasY = (eventClientY - mockRect.top) * (450 / mockRect.height); // 225

// Current src/game.js touch handling calculation:
const unscaledTouchY = eventClientY - mockRect.top; // 337.5
const unscaledHeightCheck = unscaledTouchY > mockRect.height / 2; // 337.5 > 337.5 is false

console.log(`Screen Event Client Pos: (${eventClientX}, ${eventClientY})`);
console.log(`Canvas getBoundingClientRect(): left=${mockRect.left}, top=${mockRect.top}, width=${mockRect.width}, height=${mockRect.height}`);
console.log(`Properly Transformed Canvas Pos (0..800, 0..450): (${correctCanvasX}, ${correctCanvasY})`);
console.log(`Raw CSS relative Y without scale factor: ${unscaledTouchY} (out of 675 CSS px)`);

process.exit(0);
