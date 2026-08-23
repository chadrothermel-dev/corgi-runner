import { Engine } from './engine.js';
import { CorgiRunnerGame } from '../src/game.js';

function init() {
  const canvas = document.getElementById('game-canvas');
  if (!canvas) {
    console.error('Canvas element #game-canvas not found.');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
  }

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

  function handleResize() {
    const container = document.getElementById('game-container');
    if (container && canvas) {
      // Maintaining pixel scaling and image smoothing setting upon resize
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
      }
    }
  }

  window.addEventListener('resize', handleResize);
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
