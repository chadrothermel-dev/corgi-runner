import { installCanvasMock } from './canvasMock.js';
import { installAudioMock, getAudioLog, clearAudioLog } from './audioMock.js';
import { VirtualClock } from './timeMock.js';
import { CorgiRunnerGame } from '../../../src/game.js';
import { Storage } from '../../../src/storage.js';
import { AudioSystem } from '../../../src/audio.js';

export class GameTestHarness {
  constructor() {
    this.clock = new VirtualClock();
    this.game = null;
    this.canvas = null;
    this.deferredKeyUps = [];
  }

  async setup() {
    // 1. Reset localStorage to isolate setup
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }

    // 2. Reset JSDOM DOM structure with game index.html markup
    document.body.innerHTML = `
      <div id="gameContainer">
        <canvas id="gameCanvas" width="800" height="400"></canvas>
        <div id="hud">
          <div id="scoreDisplay">Score: 0</div>
          <div id="highScoreDisplay">High Score: 0</div>
        </div>
        <div id="startScreen" class="overlay">
          <h1>Corgi Endless Runner</h1>
          <button id="startBtn">Start Game</button>
        </div>
        <div id="pauseOverlay" class="overlay hidden">
          <h2>Game Paused</h2>
          <button id="resumeBtn">Resume</button>
        </div>
        <div id="gameOverScreen" class="overlay hidden">
          <h2>Game Over</h2>
          <p>Score: <span id="finalScore">0</span></p>
          <p>High Score: <span id="gameOverHighScore">0</span></p>
          <button id="restartBtn">Play Again</button>
        </div>
      </div>
    `;

    // 3. Install Canvas 2D Context Mock & Audio Mock
    installCanvasMock();
    installAudioMock();
    AudioSystem.clearAudioLog();

    // 4. Install Virtual Clock
    this.clock.install();

    // 5. Initialize canvas & Game
    this.canvas = document.querySelector('#gameCanvas');
    this.game = new CorgiRunnerGame(this.canvas);
  }

  teardown() {
    if (this.game && typeof this.game.destroy === 'function') {
      this.game.destroy();
    }
    if (this.clock) {
      this.clock.uninstall();
    }
    document.body.innerHTML = '';
    localStorage.clear();
    clearAudioLog();
    AudioSystem.clearAudioLog();
    this.deferredKeyUps = [];
  }

  // --- Input Simulation Helpers ---
  keyDown(code, key = code, repeat = false) {
    const event = new KeyboardEvent('keydown', {
      code,
      key,
      bubbles: true,
      cancelable: true,
      repeat
    });
    window.dispatchEvent(event);
  }

  keyUp(code, key = code) {
    const event = new KeyboardEvent('keyup', {
      code,
      key,
      bubbles: true,
      cancelable: true
    });
    window.dispatchEvent(event);
  }

  pressKey(code, key = code) {
    this.keyDown(code, key);
    this.deferredKeyUps.push({ code, key, framesLeft: 2 });
  }

  touchStart(targetElement = this.canvas, touches = [{ clientX: 400, clientY: 100 }]) {
    const target = targetElement || this.canvas;
    
    if (typeof window !== 'undefined' && !window.TouchEvent) {
      window.TouchEvent = class TouchEvent extends window.UIEvent {
        constructor(type, eventInitDict = {}) {
          super(type, eventInitDict);
          this.touches = eventInitDict.touches || [];
          this.targetTouches = eventInitDict.targetTouches || [];
          this.changedTouches = eventInitDict.changedTouches || [];
        }
      };
    }

    const event = new window.TouchEvent('touchstart', {
      bubbles: true,
      cancelable: true,
      touches: touches,
      targetTouches: touches,
      changedTouches: touches
    });
    target.dispatchEvent(event);
  }

  touchEnd(targetElement = this.canvas) {
    const target = targetElement || this.canvas;
    
    if (typeof window !== 'undefined' && !window.TouchEvent) {
      window.TouchEvent = class TouchEvent extends window.UIEvent {
        constructor(type, eventInitDict = {}) {
          super(type, eventInitDict);
          this.touches = eventInitDict.touches || [];
          this.targetTouches = eventInitDict.targetTouches || [];
          this.changedTouches = eventInitDict.changedTouches || [];
        }
      };
    }

    const event = new window.TouchEvent('touchend', {
      bubbles: true,
      cancelable: true,
      touches: [],
      targetTouches: [],
      changedTouches: []
    });
    target.dispatchEvent(event);
  }

  clickElement(selector) {
    const el = document.querySelector(selector);
    if (el) {
      el.click();
    }
  }

  // --- Virtual Clock Stepping ---
  stepFrame(deltaMs = 16.667) {
    // Process deferred key releases before stepping the frame
    for (let i = this.deferredKeyUps.length - 1; i >= 0; i--) {
      const item = this.deferredKeyUps[i];
      item.framesLeft--;
      if (item.framesLeft <= 0) {
        this.keyUp(item.code, item.key);
        this.deferredKeyUps.splice(i, 1);
      }
    }

    this.clock.step(deltaMs);
    if (this.game) {
      this.game.stepFrame(deltaMs / 1000);
    }
  }

  stepFrames(count, deltaMs = 16.667) {
    for (let i = 0; i < count; i++) {
      this.stepFrame(deltaMs);
    }
  }

  runForTime(totalMs, deltaMs = 16.667) {
    const steps = Math.floor(totalMs / deltaMs);
    this.stepFrames(steps, deltaMs);
  }

  // --- Opaque-Box DOM & State Queries ---
  getGameState() {
    return this.game ? this.game.state : 'UNKNOWN';
  }

  getDisplayedScore() {
    const el = document.querySelector('#scoreDisplay');
    if (!el) return 0;
    const match = el.textContent.match(/Score:\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  getDisplayedHighScore() {
    const el = document.querySelector('#highScoreDisplay');
    if (!el) return 0;
    const match = el.textContent.match(/High Score:\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : 0;
  }

  getFinalScoreText() {
    const el = document.querySelector('#finalScore');
    return el ? el.textContent.trim() : '';
  }

  getGameOverHighScoreText() {
    const el = document.querySelector('#gameOverHighScore');
    return el ? el.textContent.trim() : '';
  }

  isStartScreenVisible() {
    const el = document.querySelector('#startScreen');
    if (!el) return false;
    return el.style.display !== 'none' && !el.classList.contains('hidden');
  }

  isPauseOverlayVisible() {
    const el = document.querySelector('#pauseOverlay');
    if (!el) return false;
    return el.style.display !== 'none' && !el.classList.contains('hidden');
  }

  isGameOverScreenVisible() {
    const el = document.querySelector('#gameOverScreen');
    if (!el) return false;
    return el.style.display !== 'none' && !el.classList.contains('hidden');
  }

  // --- Storage Queries ---
  getLocalStorageHighScore() {
    return Storage.getHighScore();
  }

  setLocalStorageHighScore(val) {
    localStorage.setItem('corgi_runner_highscore', String(val));
    if (this.game) {
      this.game.syncUI();
    }
  }

  // --- Audio & Render Logs ---
  getPlayedSounds() {
    return AudioSystem.getAudioLog();
  }

  getRenderedDrawCalls() {
    const ctx = this.canvas ? this.canvas.getContext('2d') : null;
    return ctx && ctx.drawCalls ? ctx.drawCalls : [];
  }
}
