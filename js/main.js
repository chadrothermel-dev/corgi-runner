import { Engine } from './engine.js';
import { CorgiRunnerGame } from '../src/game.js';

const VIEW_W = 800;
const VIEW_H = 450;
const MAX_DPR = 2.5;

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element #game-canvas not found.');
    return;
  }
  const container = document.getElementById('game-container');

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

  // Render at the display's real pixel density for crisp vector art
  function fitCanvas() {
    const rect = (container || canvas).getBoundingClientRect();
    if (!rect.width) return;
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const scale = (rect.width * dpr) / VIEW_W;
    const w = Math.round(VIEW_W * scale);
    const h = Math.round(VIEW_H * scale);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    game.setViewport(scale);
  }

  if (typeof ResizeObserver !== 'undefined' && container) {
    new ResizeObserver(fitCanvas).observe(container);
  }
  window.addEventListener('resize', fitCanvas);
  fitCanvas();

  // Fullscreen toggle
  document.querySelectorAll('[data-action="fullscreen"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      btn.blur();
      const target = container || document.documentElement;
      if (document.fullscreenElement) {
        document.exitFullscreen?.();
      } else {
        target.requestFullscreen?.().catch(() => {});
      }
    });
  });

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
