import { CorgiPlayer } from './player.js';
import { EntityManager } from './entities.js';
import { Collision } from './collision.js';
import { ParticleSystem } from './particles.js';
import { AudioSystem } from './audio.js';
import { Storage } from './storage.js';

export class CorgiRunnerGame {
  constructor(canvasElement) {
    this.canvas = canvasElement || (typeof document !== 'undefined' ? document.querySelector('canvas') : null);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.groundY = 350;
    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
    
    this.score = 0;
    this.highScore = Storage.getHighScore();

    this.baseSpeed = 300;
    this.currentSpeed = this.baseSpeed;
    this.maxSpeed = 800;
    this.speedScaleRate = 10;

    this.player = new CorgiPlayer(this.groundY);
    this.entityManager = new EntityManager(this.canvas ? this.canvas.width : 800, this.groundY);
    this.particles = new ParticleSystem();

    this.keysHeld = {};
    this.loopId = null;

    // Parallax background state
    this.bgScroll = 0;
    this.cloudScroll = 0;
    this.hillScroll = 0;
    this.mountainScroll = 0;
    this.groundScroll = 0;

    // Generate static cloud positions
    this.clouds = [];
    for (let i = 0; i < 6; i++) {
      this.clouds.push({
        x: Math.random() * 900,
        y: 30 + Math.random() * 100,
        w: 60 + Math.random() * 80,
        h: 20 + Math.random() * 20,
        speed: 0.1 + Math.random() * 0.15
      });
    }

    // Generate mountain peaks
    this.mountains = [];
    for (let i = 0; i < 5; i++) {
      this.mountains.push({
        x: i * 200 + Math.random() * 40,
        peakH: 60 + Math.random() * 50,
        w: 140 + Math.random() * 80
      });
    }

    // Generate hill shapes
    this.hills = [];
    for (let i = 0; i < 7; i++) {
      this.hills.push({
        x: i * 150 + Math.random() * 30,
        r: 40 + Math.random() * 30,
      });
    }

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

    if (this.startBtn) {
      this.startBtnBound = () => this.startGame();
      this.startBtn.addEventListener('click', this.startBtnBound);
    }
    if (this.resumeBtn) {
      this.resumeBtnBound = () => this.togglePause();
      this.resumeBtn.addEventListener('click', this.resumeBtnBound);
    }
    if (this.restartBtn) {
      this.restartBtnBound = () => this.restartGame();
      this.restartBtn.addEventListener('click', this.restartBtnBound);
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
  }

  handleKeyDown(e) {
    const code = e.code || e.key;
    this.keysHeld[code] = true;

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
      this.syncUI();
    }
  }

  startGame() {
    this.state = 'PLAYING';
    this.score = 0;
    this.currentSpeed = this.baseSpeed;
    this.player.reset();
    this.entityManager.reset();
    this.particles.clear();
    this.syncUI();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
    }
    this.syncUI();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    AudioSystem.play('gameover');
    const newHigh = Storage.saveHighScore(this.score);
    this.highScore = newHigh;
    this.syncUI();
  }

  update(dt) {
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
    this.player.update(dt);
    this.entityManager.update(dt, this.currentSpeed);
    this.particles.update(dt);

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
          this.particles.emit(e.x + e.width / 2, e.y + e.height / 2, 12);
          AudioSystem.play('collect');
          entities.splice(i, 1); // remove collected treat
        }
      } else if (e.type === 'obstacle') {
        if (Collision.check(currPlayerBox, e) || Collision.checkSweptAABB(prevPlayerBox, currPlayerBox, e)) {
          hitObstacle = true;
        }
      }
    }

    if (hitObstacle) {
      this.triggerGameOver();
    }

    this.syncUI();
  }

  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    // --- 1. SKY GRADIENT ---
    ctx.fillStyle = '#4A90D9';
    ctx.fillRect(0, 0, w, this.groundY);
    // Lighter near horizon
    ctx.fillStyle = '#87CEEB';
    ctx.fillRect(0, this.groundY * 0.5, w, this.groundY * 0.3);
    ctx.fillStyle = '#B0E0F0';
    ctx.fillRect(0, this.groundY * 0.8, w, this.groundY * 0.2);

    // --- 2. MOUNTAINS (far layer) ---
    if (this.state === 'PLAYING') {
      this.mountainScroll += this.currentSpeed * 0.02 / 60;
    }
    ctx.save();
    ctx.fillStyle = '#5B7B99';
    for (const m of this.mountains) {
      const mx = ((m.x - this.mountainScroll) % (w + 200)) - 100;
      const adjustedX = mx < -200 ? mx + w + 200 : mx;
      ctx.beginPath();
      ctx.moveTo(adjustedX, this.groundY);
      ctx.lineTo(adjustedX + m.w / 2, this.groundY - m.peakH);
      ctx.lineTo(adjustedX + m.w, this.groundY);
      ctx.closePath();
      ctx.fill();
    }
    // Snow caps
    ctx.fillStyle = '#D6E8F0';
    for (const m of this.mountains) {
      const mx = ((m.x - this.mountainScroll) % (w + 200)) - 100;
      const adjustedX = mx < -200 ? mx + w + 200 : mx;
      if (m.peakH > 80) {
        ctx.beginPath();
        ctx.moveTo(adjustedX + m.w / 2 - 12, this.groundY - m.peakH + 15);
        ctx.lineTo(adjustedX + m.w / 2, this.groundY - m.peakH);
        ctx.lineTo(adjustedX + m.w / 2 + 12, this.groundY - m.peakH + 15);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();

    // --- 3. HILLS (mid layer) ---
    if (this.state === 'PLAYING') {
      this.hillScroll += this.currentSpeed * 0.08 / 60;
    }
    ctx.save();
    ctx.fillStyle = '#5A8F3F';
    for (const hill of this.hills) {
      const hx = ((hill.x - this.hillScroll) % (w + 150)) - 75;
      const adjustedHx = hx < -150 ? hx + w + 150 : hx;
      ctx.beginPath();
      ctx.arc(adjustedHx, this.groundY, hill.r, Math.PI, 0);
      ctx.fill();
    }
    // Trees on hills
    ctx.fillStyle = '#2E7D32';
    for (let i = 0; i < this.hills.length; i++) {
      if (i % 2 === 0) {
        const hill = this.hills[i];
        const hx = ((hill.x - this.hillScroll) % (w + 150)) - 75;
        const adjustedHx = hx < -150 ? hx + w + 150 : hx;
        // Tree trunk
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(adjustedHx - 2, this.groundY - hill.r - 10, 4, 12);
        // Tree canopy
        ctx.fillStyle = '#2E7D32';
        ctx.beginPath();
        ctx.arc(adjustedHx, this.groundY - hill.r - 16, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();

    // --- 4. CLOUDS ---
    if (this.state === 'PLAYING') {
      this.cloudScroll += this.currentSpeed * 0.03 / 60;
    }
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    for (const c of this.clouds) {
      const cx = ((c.x - this.cloudScroll * c.speed * 10) % (w + 200)) - 100;
      const adjustedCx = cx < -200 ? cx + w + 200 : cx;
      // Multi-circle cloud
      ctx.beginPath();
      ctx.arc(adjustedCx, c.y, c.h * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(adjustedCx + c.w * 0.25, c.y - c.h * 0.2, c.h * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(adjustedCx + c.w * 0.55, c.y, c.h * 0.65, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(adjustedCx - c.w * 0.15, c.y + c.h * 0.1, c.h * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // --- 5. GROUND ---
    if (this.state === 'PLAYING') {
      this.groundScroll += this.currentSpeed / 60;
    }
    const groundH = h - this.groundY;
    // Grass top
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, this.groundY, w, 6);
    // Main dirt
    ctx.fillStyle = '#8D6E53';
    ctx.fillRect(0, this.groundY + 6, w, groundH - 6);
    // Lighter dirt stripe
    ctx.fillStyle = '#A1887F';
    ctx.fillRect(0, this.groundY + 14, w, 4);
    // Dark bottom
    ctx.fillStyle = '#5D4037';
    ctx.fillRect(0, h - 8, w, 8);

    // Scrolling pebbles / dirt details
    ctx.fillStyle = '#795548';
    const pebbleSpacing = 60;
    for (let px = -(this.groundScroll % pebbleSpacing); px < w; px += pebbleSpacing) {
      ctx.beginPath();
      ctx.arc(px + 10, this.groundY + 24, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(px + 35, this.groundY + 30, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass blades on surface
    ctx.fillStyle = '#388E3C';
    const grassSpacing = 18;
    for (let gx = -(this.groundScroll % grassSpacing); gx < w; gx += grassSpacing) {
      ctx.beginPath();
      ctx.moveTo(gx, this.groundY);
      ctx.lineTo(gx + 2, this.groundY - 5);
      ctx.lineTo(gx + 4, this.groundY);
      ctx.closePath();
      ctx.fill();
    }

    // --- 6. RENDER GAME OBJECTS ---
    this.entityManager.draw(ctx);
    this.particles.draw(ctx);
    this.player.draw(ctx);
  }

  stepFrame(dt = 0.01667) {
    this.update(dt);
    this.render();
  }

  syncUI() {
    this.highScore = Storage.getHighScore();
    const displayScore = Math.floor(this.score);
    const displayHigh = Math.floor(this.highScore);

    if (this.scoreDisplay) this.scoreDisplay.textContent = `Score: ${displayScore}`;
    if (this.highScoreDisplay) this.highScoreDisplay.textContent = `High Score: ${displayHigh}`;
    if (this.finalScoreEl) this.finalScoreEl.textContent = `${displayScore}`;
    if (this.gameOverHighScoreEl) this.gameOverHighScoreEl.textContent = `${displayHigh}`;

    // Manage Overlays
    if (this.startScreen) {
      this.startScreen.style.display = this.state === 'START' ? 'block' : 'none';
      if (this.state === 'START') this.startScreen.classList.remove('hidden');
      else this.startScreen.classList.add('hidden');
    }

    if (this.pauseOverlay) {
      this.pauseOverlay.style.display = this.state === 'PAUSED' ? 'block' : 'none';
      if (this.state === 'PAUSED') this.pauseOverlay.classList.remove('hidden');
      else this.pauseOverlay.classList.add('hidden');
    }

    if (this.gameOverScreen) {
      this.gameOverScreen.style.display = this.state === 'GAMEOVER' ? 'block' : 'none';
      if (this.state === 'GAMEOVER') this.gameOverScreen.classList.remove('hidden');
      else this.gameOverScreen.classList.add('hidden');
    }
  }
}
