import { Engine } from './engine.js';
import { CorgiRunnerGame } from '../src/game.js';

const LOGICAL_W = 800;
const LOGICAL_H = 450;
const MAX_SCALE = 2.5;

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element #game-canvas not found.');
    return;
  }

  canvas.width = LOGICAL_W;
  canvas.height = LOGICAL_H;

  const game = new CorgiRunnerGame(canvas);
  const engine = new Engine(canvas);

  engine.onUpdate((dt) => {
    game.update(dt);
    if (engine.state !== game.state) {
      engine.setState(game.state);
    }
  });

  engine.onRender(() => {
    game.render();
  });

  // Render at the display's real pixel density so the art stays crisp.
  let resizeTimer = null;
  function handleResize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(1, Math.min(MAX_SCALE, ((rect.width || LOGICAL_W) * dpr) / LOGICAL_W));
    const w = Math.round(LOGICAL_W * scale);
    const h = Math.round(LOGICAL_H * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
    }
    game.setRenderScale(scale);
  }

  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(handleResize, 120);
  });
  handleResize();

  // Attach instances to window for debugging or external reference
  window.gameEngine = engine;
  window.game = game;

  // Launch engine loop
  engine.start();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
