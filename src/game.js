import { CorgiPlayer } from './player.js';
import { EntityManager } from './entities.js';
import { Collision } from './collision.js';
import { ParticleSystem } from './particles.js';
import { AudioSystem } from './audio.js';
import { Storage } from './storage.js';
import { Background } from './background.js';
import { Effects } from './effects.js';

const MILESTONE_EVERY = 500;

export class CorgiRunnerGame {
  constructor(canvasElement) {
    this.canvas = canvasElement || (typeof document !== 'undefined' ? document.querySelector('canvas') : null);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    // Logical resolution: gameplay always runs in these units, whatever the
    // backing-store size of the canvas (see setRenderScale for HiDPI).
    this.viewW = this.canvas ? this.canvas.width : 800;
    this.viewH = this.canvas ? this.canvas.height : 450;
    this.renderScale = 1;

    this.groundY = 350;
    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'

    this.score = 0;
    this.highScore = Storage.getHighScore();

    this.baseSpeed = 300;
    this.currentSpeed = this.baseSpeed;
    this.maxSpeed = 800;
    this.speedScaleRate = 10;

    this.player = new CorgiPlayer(this.groundY);
    this.entityManager = new EntityManager(this.viewW, this.groundY);
    this.particles = new ParticleSystem();
    this.background = new Background(this.viewW, this.viewH, this.groundY);
    this.effects = new Effects(this.viewW, this.viewH);

    this.keysHeld = {};
    this.loopId = null;
    this.dustTimer = 0;
    this.nextMilestone = MILESTONE_EVERY;
    this.isNewBest = false;
    this.bestAtStart = this.highScore;
    this.passedBest = false;
    this.lastShownScore = -1;
    this.lastShownHigh = -1;

    this.initDOM();
    this.bindEvents();
    this.syncUI();
  }

  initDOM() {
    this.startScreen = document.querySelector('#startScreen') || document.querySelector('#start-screen');
    this.pauseOverlay = document.querySelector('#pauseOverlay') || document.querySelector('#pause-screen');
    this.gameOverScreen = document.querySelector('#gameOverScreen') || document.querySelector('#game-over-screen');

    this.scoreDisplay = document.querySelector('#scoreDisplay') || document.querySelector('#score-display');
    this.highScoreDisplay = document.querySelector('#highScoreDisplay') || document.querySelector('#high-score-display');
    this.finalScoreEl = document.querySelector('#finalScore') || document.querySelector('#final-score');
    this.gameOverHighScoreEl = document.querySelector('#gameOverHighScore') || document.querySelector('#game-over-high-score');

    this.startBtn = document.querySelector('#startBtn') || document.querySelector('#start-btn');
    this.resumeBtn = document.querySelector('#resumeBtn') || document.querySelector('#resume-btn');
    this.restartBtn = document.querySelector('#restartBtn') || document.querySelector('#restart-btn');

    // Optional enhanced-UI elements (absent in minimal markup)
    this.muteBtn = document.querySelector('#mute-btn');
    this.newBestEl = document.querySelector('#new-best');
    this.speedFill = document.querySelector('#speed-fill');
    this.syncMuteButton();
  }

  bindEvents() {
    if (typeof window === 'undefined') return;

    this.keydownBound = (e) => this.handleKeyDown(e);
    this.keyupBound = (e) => this.handleKeyUp(e);
    this.resizeBound = () => this.handleResize();
    this.blurBound = () => this.handleBlur();

    window.addEventListener('keydown', this.keydownBound);
    window.addEventListener('keyup', this.keyupBound);
    window.addEventListener('resize', this.resizeBound);
    window.addEventListener('blur', this.blurBound);

    if (this.canvas) {
      this.touchstartBound = (e) => this.handleTouchStart(e);
      this.touchendBound = (e) => this.handleTouchEnd(e);
      this.canvas.addEventListener('touchstart', this.touchstartBound);
      this.canvas.addEventListener('touchend', this.touchendBound);
    }

    const blurAfter = (fn) => (e) => {
      AudioSystem.unlock();
      fn();
      if (e && e.currentTarget && typeof e.currentTarget.blur === 'function') e.currentTarget.blur();
    };

    if (this.startBtn) {
      this.startBtnBound = blurAfter(() => this.startGame());
      this.startBtn.addEventListener('click', this.startBtnBound);
    }
    if (this.resumeBtn) {
      this.resumeBtnBound = blurAfter(() => this.togglePause());
      this.resumeBtn.addEventListener('click', this.resumeBtnBound);
    }
    if (this.restartBtn) {
      this.restartBtnBound = blurAfter(() => this.restartGame());
      this.restartBtn.addEventListener('click', this.restartBtnBound);
    }
    if (this.muteBtn) {
      this.muteBtnBound = blurAfter(() => this.toggleMute());
      this.muteBtn.addEventListener('click', this.muteBtnBound);
    }
  }

  destroy() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('keydown', this.keydownBound);
    window.removeEventListener('keyup', this.keyupBound);
    window.removeEventListener('resize', this.resizeBound);
    window.removeEventListener('blur', this.blurBound);

    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.touchstartBound);
      this.canvas.removeEventListener('touchend', this.touchendBound);
    }

    if (this.startBtn && this.startBtnBound) {
      this.startBtn.removeEventListener('click', this.startBtnBound);
    }
    if (this.resumeBtn && this.resumeBtnBound) {
      this.resumeBtn.removeEventListener('click', this.resumeBtnBound);
    }
    if (this.restartBtn && this.restartBtnBound) {
      this.restartBtn.removeEventListener('click', this.restartBtnBound);
    }
    if (this.muteBtn && this.muteBtnBound) {
      this.muteBtn.removeEventListener('click', this.muteBtnBound);
    }
    AudioSystem.stopMusic();
  }

  handleKeyDown(e) {
    const code = e.code || e.key;
    this.keysHeld[code] = true;
    AudioSystem.unlock();

    // Stop the page from scrolling on game keys
    if ((code === 'Space' || code === 'ArrowUp' || code === 'ArrowDown') && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.state === 'START') {
      if (code === 'Space' || code === 'Enter' || code === 'ArrowUp') {
        this.startGame();
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      if (code === 'Space' || code === 'Enter') {
        this.restartGame();
      }
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      this.togglePause();
      return;
    }

    if (this.state === 'PLAYING') {
      if (code === 'Space' || code === 'ArrowUp') {
        this.player.jump();
      } else if (code === 'ArrowDown') {
        this.player.duck();
      }
    }
  }

  handleKeyUp(e) {
    const code = e.code || e.key;
    this.keysHeld[code] = false;

    if (code === 'ArrowDown' && this.state === 'PLAYING') {
      this.player.stopDuck();
    }
  }

  handleTouchStart(e) {
    AudioSystem.unlock();
    if (e && e.cancelable && typeof e.preventDefault === 'function') e.preventDefault();
    if (this.state === 'START') {
      this.startGame();
      return;
    }
    if (this.state === 'GAMEOVER') {
      this.restartGame();
      return;
    }
    if (this.state === 'PLAYING') {
      const touchY = e.touches && e.touches[0] ? e.touches[0].clientY : 0;
      const rect = this.canvas ? this.canvas.getBoundingClientRect() : { height: 400, top: 0 };
      const canvasHeight = rect.height || (this.canvas ? this.canvas.height : 400);
      const canvasTop = rect.top || 0;
      const relativeY = touchY - canvasTop;

      if (relativeY > canvasHeight / 2) {
        this.player.duck();
      } else {
        this.player.jump();
      }
    }
  }

  handleTouchEnd(e) {
    if (this.state === 'PLAYING' && this.player.isDucking) {
      this.player.stopDuck();
    }
  }

  handleResize() {
    if (this.canvas) {
      if (this.player.y > this.groundY - this.player.height) {
        this.player.y = this.groundY - this.player.height;
      }
    }
  }

  handleBlur() {
    this.keysHeld = {};
    if (this.player.isDucking) {
      this.player.stopDuck();
    }
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      AudioSystem.stopMusic();
      this.syncUI();
    }
  }

  /** Render the logical scene at `scale` device pixels per unit (HiDPI). */
  setRenderScale(scale) {
    this.renderScale = scale > 0 ? scale : 1;
    this.background.setScale(this.renderScale);
    this.entityManager.setScale(this.renderScale);
  }

  toggleMute() {
    AudioSystem.toggleMute();
    this.syncMuteButton();
  }

  syncMuteButton() {
    if (!this.muteBtn) return;
    const muted = AudioSystem.isMuted();
    this.muteBtn.textContent = muted ? '🔇' : '🔊';
    this.muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
    this.muteBtn.title = muted ? 'Sound off (M)' : 'Sound on (M)';
  }

  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.currentSpeed = this.baseSpeed;
    this.player.reset();
    this.entityManager.reset();
    this.particles.clear();
    this.effects.clear();
    this.background.reset();
    this.nextMilestone = MILESTONE_EVERY;
    this.isNewBest = false;
    this.bestAtStart = Storage.getHighScore();
    this.passedBest = false;
    AudioSystem.startMusic();
    this.syncUI();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      AudioSystem.stopMusic();
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      AudioSystem.startMusic();
    }
    this.syncUI();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    AudioSystem.stopMusic();
    AudioSystem.play('gameover');
    const prevHigh = Storage.getHighScore();
    const newHigh = Storage.saveHighScore(this.score);
    this.highScore = newHigh;
    this.isNewBest = Math.floor(this.score) > prevHigh && Math.floor(this.score) > 0;

    // Crash feedback (cosmetic only)
    this.player.dead = true;
    const p = this.player;
    this.effects.impact(p.x + p.width, p.y + p.height * 0.4);
    this.effects.shake(9, 0.45);
    this.effects.flash = 1;
    this.effects.puff(p.x + p.width * 0.5, this.groundY, 12, { spread: 2.5, up: 70, back: 20, size: 6 });

    this.syncUI();
  }

  /** Cosmetic animation that also runs outside of active play. */
  animateScene(dt) {
    if (this.state === 'PAUSED') return;
    const playing = this.state === 'PLAYING';
    const sceneSpeed = playing ? this.currentSpeed : this.state === 'START' ? 220 : 0;
    this.background.update(dt, sceneSpeed, playing || this.state === 'START');
    this.effects.update(dt, playing ? this.currentSpeed : 0);
    if (!playing) {
      this.player.runRate = 14;
      this.player.animate(dt);
      this.entityManager.animate(dt);
    }
  }

  update(dt) {
    this.animateScene(dt);
    if (this.state !== 'PLAYING') return;

    // Continuous score accumulation
    this.score += dt * 10;

    // Progressive speed scaling
    this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + dt * this.speedScaleRate);

    // Save previous player box for swept AABB check
    const prevPlayerBox = {
      x: this.player.x,
      y: this.player.y,
      width: this.player.width,
      height: this.player.height
    };

    // Update Player & Entities
    this.player.runRate = 12 + this.currentSpeed / 40;
    this.player.update(dt);
    this.entityManager.update(dt, this.currentSpeed);
    this.particles.update(dt);
    this.updateMotionEffects(dt);

    const currPlayerBox = {
      x: this.player.x,
      y: this.player.y,
      width: this.player.width,
      height: this.player.height
    };

    // Check Collisions
    const entities = this.entityManager.entities;
    let hitObstacle = false;

    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.type === 'treat') {
        if (Collision.check(currPlayerBox, e)) {
          this.score += e.points;
          const cx = e.x + e.width / 2;
          const cy = e.y + e.height / 2;
          this.particles.emit(cx, cy, e.golden ? 24 : 12);
          this.effects.text(cx, cy - 12, `+${e.points}`, e.golden ? '#ffd23f' : '#fff6c2', e.golden ? 24 : 18);
          AudioSystem.play('collect');
          if (e.golden) AudioSystem.play('golden');
          entities.splice(i, 1); // remove collected treat
        }
      } else if (e.type === 'obstacle') {
        if (Collision.check(currPlayerBox, e) || Collision.checkSweptAABB(prevPlayerBox, currPlayerBox, e)) {
          hitObstacle = true;
        }
      }
    }

    // Milestones and beating your best
    if (this.score >= this.nextMilestone) {
      this.effects.showBanner(`${this.nextMilestone}!`, 'Good pup!');
      AudioSystem.play('milestone');
      this.nextMilestone += MILESTONE_EVERY;
    }
    if (!this.passedBest && this.bestAtStart > 0 && this.score > this.bestAtStart) {
      this.passedBest = true;
      this.effects.showBanner('NEW BEST!', 'Keep going!');
      AudioSystem.play('bark');
    }

    if (hitObstacle) {
      this.triggerGameOver();
    }

    this.syncUI();
  }

  updateMotionEffects(dt) {
    const p = this.player;
    const feetX = p.x + 14;
    if (p.justJumped) {
      p.justJumped = false;
      this.effects.puff(feetX + 10, this.groundY, 6, { up: 20, back: 40, size: 4 });
    }
    if (p.justLanded) {
      p.justLanded = false;
      this.effects.puff(feetX + 16, this.groundY, 9, { spread: 2, up: 35, back: 30, size: 5 });
      AudioSystem.play('land');
    }
    if (p.isGrounded) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = Math.max(0.035, 0.11 - this.currentSpeed / 9000);
        this.effects.puff(feetX, this.groundY, 1, { up: 18, back: this.currentSpeed * 0.25, size: 3 });
      }
    }
  }

  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const s = this.renderScale;

    if (typeof ctx.setTransform === 'function') ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (s !== 1 && typeof ctx.setTransform === 'function') ctx.setTransform(s, 0, 0, s, 0, 0);

    ctx.save();
    const shake = this.effects.shakeOffset;
    if (shake.x || shake.y) ctx.translate(shake.x, shake.y);

    // Scenery
    this.background.draw(ctx);

    // Gameplay layer
    this.entityManager.draw(ctx);
    this.effects.drawDust(ctx);
    this.player.draw(ctx);

    // Colour grade so sprites match the time of day
    this.background.drawGrade(ctx);

    // Glowing / UI-ish things stay bright
    this.background.drawFireflies(ctx);
    this.particles.draw(ctx);
    this.effects.drawSpeedLines(ctx);
    ctx.restore();

    this.background.drawVignette(ctx);
    this.effects.drawOverlay(ctx);
  }

  stepFrame(dt = 0.01667) {
    this.update(dt);
    this.render();
  }

  syncUI() {
    this.highScore = Storage.getHighScore();
    const displayScore = Math.floor(this.score);
    const displayHigh = Math.floor(this.highScore);

    if (displayScore !== this.lastShownScore || displayHigh !== this.lastShownHigh) {
      if (this.scoreDisplay) this.scoreDisplay.textContent = `Score: ${displayScore}`;
      if (this.highScoreDisplay) this.highScoreDisplay.textContent = `High Score: ${displayHigh}`;
      if (this.finalScoreEl) this.finalScoreEl.textContent = `${displayScore}`;
      if (this.gameOverHighScoreEl) this.gameOverHighScoreEl.textContent = `${displayHigh}`;
      this.lastShownScore = displayScore;
      this.lastShownHigh = displayHigh;
    }

    if (this.speedFill) {
      const pct = ((this.currentSpeed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed)) * 100;
      this.speedFill.style.width = `${Math.max(0, Math.min(100, pct)).toFixed(1)}%`;
    }
    if (this.newBestEl) {
      this.newBestEl.classList.toggle('hidden', !(this.state === 'GAMEOVER' && this.isNewBest));
    }

    // Manage Overlays
    if (this.startScreen) {
      this.startScreen.style.display = this.state === 'START' ? 'flex' : 'none';
      if (this.state === 'START') this.startScreen.classList.remove('hidden');
      else this.startScreen.classList.add('hidden');
    }

    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = this.state === 'PAUSED' ? 'flex' : 'none';
      if (this.state === 'PAUSED') this.pauseOverlay.classList.remove('hidden');
      else this.pauseOverlay.classList.add('hidden');
    }

    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = this.state === 'GAMEOVER' ? 'flex' : 'none';
      if (this.state === 'GAMEOVER') this.gameOverScreen.classList.remove('hidden');
      else this.gameOverScreen.classList.add('hidden');
    }
  }
}
