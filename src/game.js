import { CorgiPlayer } from './player.js';
import { EntityManager } from './entities.js';
import { Collision } from './collision.js';
import { ParticleSystem } from './particles.js';
import { AudioSystem } from './audio.js';
import { Storage } from './storage.js';
import { World } from './world.js';

const VIEW_W = 800;
const VIEW_H = 450;
const COMBO_WINDOW = 1.6; // seconds between bones to keep a combo alive
const ZOOMIES_TIME = 7; // golden-bone power-up duration
const MAGNET_RADIUS = 200;
const MILESTONE_STEP = 500;
const DAY_LENGTH = 34000; // px travelled per full day/night cycle

export class CorgiRunnerGame {
  constructor(canvasElement) {
    this.canvas = canvasElement || (typeof document !== 'undefined' ? document.querySelector('canvas') : null);
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;

    this.viewW = VIEW_W;
    this.viewH = VIEW_H;
    this.pixelScale = 1;

    this.groundY = 350;
    this.state = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'

    this.score = 0;
    this.highScore = Storage.getHighScore();

    this.baseSpeed = 300;
    this.currentSpeed = this.baseSpeed;
    this.maxSpeed = 800;
    this.speedScaleRate = 10;

    this.player = new CorgiPlayer(this.groundY);
    this.entityManager = new EntityManager(VIEW_W, this.groundY);
    this.particles = new ParticleSystem();
    this.world = new World(VIEW_W, VIEW_H, this.groundY);

    this.keysHeld = {};
    this.loopId = null;

    this.time = 0;
    this.resetRunStats();

    // Effects
    this.shake = 0;
    this.flash = 0;
    this.deathT = 0;
    this.dustTimer = 0;
    this.trail = [];
    this.trailTimer = 0;
    this.hudCache = {};

    AudioSystem.loadPrefs();

    this.initDOM();
    this.bindEvents();
    this.syncUI();
  }

  resetRunStats() {
    this.distance = 0;
    this.bones = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.bestCombo = 0;
    this.zoomies = 0;
    this.nextMilestone = MILESTONE_STEP;
    this.prevHigh = 0;
    this.isNewBest = false;
    this.bestAnnounced = false;
    this.confettiPending = false;
  }

  get difficulty() {
    return Math.max(0, Math.min(1, (this.currentSpeed - this.baseSpeed) / (this.maxSpeed - this.baseSpeed)));
  }

  get comboMultiplier() {
    return Math.min(5, 1 + Math.floor(Math.max(0, this.combo - 1) / 3));
  }

  // ---------------------------------------------------------------------
  // DOM + input
  // ---------------------------------------------------------------------

  initDOM() {
    if (typeof document === 'undefined') return;
    const $ = (a, b) => document.querySelector(a) || (b ? document.querySelector(b) : null);

    this.startScreen = $('#startScreen', '#start-screen');
    this.pauseOverlay = $('#pauseOverlay', '#pause-screen');
    this.gameOverScreen = $('#gameOverScreen', '#game-over-screen');

    this.scoreDisplay = $('#scoreDisplay', '#score-display');
    this.highScoreDisplay = $('#highScoreDisplay', '#high-score-display');
    this.finalScoreEl = $('#finalScore', '#final-score');
    this.gameOverHighScoreEl = $('#gameOverHighScore', '#game-over-high-score');

    this.startBtn = $('#startBtn', '#start-btn');
    this.resumeBtn = $('#resumeBtn', '#resume-btn');
    this.restartBtn = $('#restartBtn', '#restart-btn');

    // Optional presentation elements (present in index.html, absent in tests)
    this.hudEl = $('#hud');
    this.bonesEl = $('#bones-display');
    this.comboEl = $('#combo-display');
    this.powerEl = $('#power-display');
    this.powerBar = $('#power-bar');
    this.toastEl = $('#toast');
    this.newBestEl = $('#new-best');
    this.goBonesEl = $('#go-bones');
    this.goDistanceEl = $('#go-distance');
    this.goComboEl = $('#go-combo');
    this.startBestEl = $('#start-best');
    this.pauseBtn = $('#pause-btn');
    this.pauseRestartBtn = $('#pause-restart-btn');
    this.muteBtns = Array.from(document.querySelectorAll('[data-action="mute"]'));
  }

  bindEvents() {
    if (typeof window === 'undefined') return;
    this.bound = [];
    const on = (target, type, fn, opts) => {
      if (!target) return;
      target.addEventListener(type, fn, opts);
      this.bound.push([target, type, fn, opts]);
    };

    this.keydownBound = (e) => this.handleKeyDown(e);
    this.keyupBound = (e) => this.handleKeyUp(e);
    this.resizeBound = () => this.handleResize();
    this.blurBound = () => this.handleBlur();

    on(window, 'keydown', this.keydownBound);
    on(window, 'keyup', this.keyupBound);
    on(window, 'resize', this.resizeBound);
    on(window, 'blur', this.blurBound);
    if (typeof document !== 'undefined') {
      on(document, 'visibilitychange', () => {
        if (document.hidden) this.handleBlur();
      });
    }

    if (this.canvas) {
      this.touchstartBound = (e) => this.handleTouchStart(e);
      this.touchendBound = (e) => this.handleTouchEnd(e);
      on(this.canvas, 'touchstart', this.touchstartBound, { passive: false });
      on(this.canvas, 'touchend', this.touchendBound, { passive: false });
      on(this.canvas, 'touchcancel', this.touchendBound, { passive: false });
    }

    const click = (el, fn) => on(el, 'click', (e) => {
      if (e && e.currentTarget && e.currentTarget.blur) e.currentTarget.blur();
      AudioSystem.unlock();
      AudioSystem.play('click');
      fn();
    });
    click(this.startBtn, () => this.startGame());
    click(this.resumeBtn, () => this.togglePause());
    click(this.restartBtn, () => this.restartGame());
    click(this.pauseBtn, () => this.togglePause());
    click(this.pauseRestartBtn, () => this.restartGame());
    for (const b of this.muteBtns || []) click(b, () => this.toggleMute());
  }

  destroy() {
    if (typeof window === 'undefined') return;
    for (const [target, type, fn, opts] of this.bound || []) {
      target.removeEventListener(type, fn, opts);
    }
    this.bound = [];
    AudioSystem.stopMusic(0.05);
  }

  handleKeyDown(e) {
    const code = e.code || e.key;
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(code) && e.cancelable && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    this.keysHeld[code] = true;

    if (code === 'KeyM') {
      this.toggleMute();
      return;
    }

    if (this.state === 'START') {
      if (code === 'Space' || code === 'Enter' || code === 'ArrowUp' || code === 'KeyW') {
        this.startGame();
      }
      return;
    }

    if (this.state === 'GAMEOVER') {
      // Ignore auto-repeat from a key held through the crash
      if (e.repeat) return;
      if (code === 'Space' || code === 'Enter' || code === 'KeyR') {
        this.restartGame();
      }
      return;
    }

    if (code === 'KeyP' || code === 'Escape') {
      this.togglePause();
      return;
    }

    if (this.state === 'PLAYING') {
      if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
        this.player.jump();
      } else if (code === 'ArrowDown' || code === 'KeyS') {
        this.player.duck();
      }
    }
  }

  handleKeyUp(e) {
    const code = e.code || e.key;
    this.keysHeld[code] = false;

    if ((code === 'ArrowDown' || code === 'KeyS') && this.state === 'PLAYING') {
      if (!this.keysHeld.ArrowDown && !this.keysHeld.KeyS) this.player.stopDuck();
    }
  }

  handleTouchStart(e) {
    if (e && e.cancelable && typeof e.preventDefault === 'function') e.preventDefault();
    if (this.state === 'START') {
      this.startGame();
      return;
    }
    if (this.state === 'GAMEOVER') {
      if (this.deathT < 0.45) return; // avoid accidental instant restart
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
    if (e && e.cancelable && typeof e.preventDefault === 'function') e.preventDefault();
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
      AudioSystem.stopMusic(0.05);
      this.syncUI();
    }
  }

  setViewport(scale) {
    this.pixelScale = scale > 0 ? scale : 1;
  }

  toggleMute() {
    const muted = AudioSystem.toggleMute();
    for (const b of this.muteBtns || []) {
      b.classList.toggle('is-muted', muted);
      b.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    return muted;
  }

  // ---------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------

  startGame() {
    AudioSystem.unlock();
    this.state = 'PLAYING';
    this.score = 0;
    this.currentSpeed = this.baseSpeed;
    this.player.reset();
    this.entityManager.reset();
    this.particles.clear();
    this.resetRunStats();
    this.prevHigh = Storage.getHighScore();
    this.shake = 0;
    this.flash = 0;
    this.deathT = 0;
    this.trail = [];
    this.hudCache = {};
    if (this.toastEl) this.toastEl.classList.remove('show');
    AudioSystem.play('bark');
    AudioSystem.startMusic();
    this.syncUI();
  }

  restartGame() {
    this.startGame();
  }

  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      AudioSystem.stopMusic(0.05);
    } else if (this.state === 'PAUSED') {
      this.state = 'PLAYING';
      AudioSystem.startMusic();
    }
    this.syncUI();
  }

  triggerGameOver() {
    this.state = 'GAMEOVER';
    AudioSystem.stopMusic(0.04);
    AudioSystem.play('gameover');
    const prev = Storage.getHighScore();
    const newHigh = Storage.saveHighScore(this.score);
    this.highScore = newHigh;
    this.isNewBest = Math.floor(this.score) > prev && Math.floor(this.score) > 0;
    this.confettiPending = this.isNewBest;

    this.shake = 14;
    this.flash = 0.75;
    this.deathT = 0;
    const p = this.player;
    this.particles.emit(p.x + p.width * 0.8, p.y + p.height * 0.3, 16, ['#FFFFFF', '#FFE082', '#FFB020', '#FF8A3D']);
    this.syncUI();
  }

  // ---------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------

  hitbox(p) {
    // Slightly forgiving collision box (ears/tail/paw tips don't count)
    return { x: p.x + 7, y: p.y + 6, width: p.width - 14, height: p.height - 8 };
  }

  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (this.state === 'PAUSED') return;

    this.time += dt;
    this.updateEffects(dt);

    if (this.state !== 'PLAYING') return;

    const d = this.difficulty;

    // Progressive speed scaling (eases off as it approaches max)
    const rate = this.speedScaleRate * (1 - 0.5 * d);
    this.currentSpeed = Math.min(this.maxSpeed, this.currentSpeed + dt * rate);
    this.distance += this.currentSpeed * dt;

    // Continuous score accumulation
    const powerMult = this.zoomies > 0 ? 2 : 1;
    this.score += dt * 10 * (this.currentSpeed / this.baseSpeed) * powerMult;

    // Timers
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboTimer = 0;
        this.combo = 0;
      }
    }
    if (this.zoomies > 0) this.zoomies = Math.max(0, this.zoomies - dt);

    // Save previous player box for swept AABB check
    const prevPlayerBox = this.hitbox(this.player);

    // Update Player & Entities
    this.player.runSpeed = Math.sqrt(this.currentSpeed / this.baseSpeed);
    this.player.update(dt);
    if (this.player.justLanded) {
      this.player.justLanded = false;
      this.particles.dust(this.player.x + 30, this.groundY, 7, 1.3);
      AudioSystem.play('land');
    }

    this.entityManager.goldenEnabled = this.zoomies <= 0;
    this.entityManager.update(dt, this.currentSpeed, d);

    const currPlayerBox = this.hitbox(this.player);
    const pickupBox = {
      x: this.player.x,
      y: this.player.y,
      width: this.player.width,
      height: this.player.height
    };

    if (this.zoomies > 0) this.applyMagnet(dt);

    // Check Collisions
    const entities = this.entityManager.entities;
    let hitObstacle = false;

    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.type === 'treat') {
        if (Collision.check(pickupBox, e)) {
          this.collectTreat(e);
          entities.splice(i, 1); // remove collected treat
        }
      } else if (e.type === 'obstacle') {
        if (Collision.check(currPlayerBox, e) || Collision.checkSweptAABB(prevPlayerBox, currPlayerBox, e)) {
          hitObstacle = true;
        }
      }
    }

    // Milestones + live best-score callout
    if (this.score >= this.nextMilestone) {
      this.toast(`${this.nextMilestone.toLocaleString()}!`);
      AudioSystem.play('milestone');
      this.nextMilestone += MILESTONE_STEP;
    }
    if (!this.bestAnnounced && this.prevHigh > 0 && this.score > this.prevHigh) {
      this.bestAnnounced = true;
      this.toast('NEW BEST!', 'gold');
      this.particles.confetti(this.player.x + 40, this.player.y, 30);
    }

    if (hitObstacle) {
      this.triggerGameOver();
      return;
    }

    this.updateHUD();
  }

  applyMagnet(dt) {
    const pcx = this.player.x + this.player.width / 2;
    const pcy = this.player.y + this.player.height / 2;
    for (const e of this.entityManager.entities) {
      if (e.type !== 'treat') continue;
      const ex = e.x + e.width / 2;
      const ey = e.y + e.height / 2;
      const dx = pcx - ex;
      const dy = pcy - ey;
      const dist = Math.hypot(dx, dy);
      if (dist < MAGNET_RADIUS && dist > 1) {
        const pull = (1 - dist / MAGNET_RADIUS) * 900 + 250;
        e.x += (dx / dist) * pull * dt;
        e.y += (dy / dist) * pull * dt;
      }
    }
  }

  collectTreat(e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;

    if (e.subType === 'golden') {
      this.zoomies = ZOOMIES_TIME;
      this.score += e.points;
      this.bones += 1;
      this.particles.emit(cx, cy, 28);
      this.particles.text(cx, cy - 14, 'ZOOMIES!', '#FFD23F', 26);
      this.toast('ZOOMIES! ×2', 'gold');
      AudioSystem.play('powerup');
      return;
    }

    this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
    this.comboTimer = COMBO_WINDOW;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    const mult = this.comboMultiplier * (this.zoomies > 0 ? 2 : 1);
    const pts = e.points * mult;

    this.score += pts;
    this.bones += 1;
    this.particles.emit(cx, cy, 12);
    this.particles.text(cx, cy - 8, `+${pts}`, mult > 1 ? '#FFD23F' : '#FFFFFF', 16 + Math.min(mult, 6) * 2);
    AudioSystem.play('collect', { combo: this.combo - 1 });
  }

  updateEffects(dt) {
    this.shake = Math.max(0, this.shake - dt * 45);
    this.flash = Math.max(0, this.flash - dt * 2.8);
    this.particles.update(dt);

    let worldSpeed = 0;
    if (this.state === 'PLAYING') worldSpeed = this.currentSpeed;
    else if (this.state === 'START') worldSpeed = 150;
    this.world.update(dt, worldSpeed, 0.12 + this.distance / DAY_LENGTH);

    if (this.state === 'START') {
      // Attract mode: corgi trots in place while the park scrolls
      this.player.animTime += dt;
      this.player.runSpeed = 0.75;
    }

    if (this.state === 'PLAYING') {
      this.dustTimer -= dt;
      if (this.player.isGrounded && this.dustTimer <= 0) {
        const sliding = this.player.isDucking;
        this.particles.dust(this.player.x + (sliding ? 40 : 14), this.groundY, sliding ? 2 : 1, sliding ? 1 : 0.6);
        this.dustTimer = sliding ? 0.05 : 0.11;
      }

      this.trailTimer -= dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.035;
        this.trail.unshift(this.player.y);
        if (this.trail.length > 4) this.trail.length = 4;
      }
    }

    if (this.state === 'GAMEOVER') {
      this.deathT += dt;
      if (this.confettiPending && this.deathT > 0.45) {
        this.confettiPending = false;
        this.particles.confetti(this.viewW / 2, this.viewH * 0.55, 70);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  render() {
    if (!this.ctx) return;

    const ctx = this.ctx;
    const s = this.pixelScale;
    const canSetTransform = typeof ctx.setTransform === 'function';

    if (canSetTransform) ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (canSetTransform) ctx.setTransform(s, 0, 0, s, 0, 0);

    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.world.draw(ctx);

    // Gameplay layer
    this.entityManager.drawShadows(ctx);
    this.drawPlayerShadow(ctx);
    this.entityManager.draw(ctx, this.time);
    this.particles.drawBack(ctx);
    this.drawPlayer(ctx);
    this.particles.drawFront(ctx);

    // A touch of the time-of-day tint over the action so it sits in the scene
    const P = this.world.palette();
    if (P.tintA > 0.01) {
      ctx.fillStyle = `rgba(${P.tint[0]},${P.tint[1]},${P.tint[2]},${P.tintA * 0.28})`;
      ctx.fillRect(-20, -20, this.viewW + 40, this.viewH + 40);
    }

    if (this.state === 'PLAYING' && (this.zoomies > 0 || this.difficulty > 0.55)) {
      this.drawSpeedLines(ctx, this.zoomies > 0 ? 1 : (this.difficulty - 0.55) * 1.6);
    }
    ctx.restore();

    this.world.drawVignette(ctx);

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  drawPlayerShadow(ctx) {
    const p = this.player;
    const height = Math.max(0, this.groundY - (p.y + p.height));
    const k = 1 - Math.min(1, height / 170) * 0.6;
    ctx.save();
    ctx.fillStyle = `rgba(40, 25, 10, ${0.28 * k})`;
    ctx.beginPath();
    ctx.ellipse(p.x + p.width / 2 + 2, this.groundY + 3, 30 * k, 5 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx) {
    const p = this.player;
    const dead = this.state === 'GAMEOVER';

    if (dead) {
      const t = this.deathT;
      const hop = t < 0.6 ? Math.max(0, 260 * t - 430 * t * t) : 0;
      const rot = -Math.min(1, t / 0.3) * 0.42;
      p.draw(ctx, { dead: true, offsetY: -hop, rotation: rot });
      this.drawDizzyStars(ctx, p, hop);
      return;
    }

    const glow = this.zoomies > 0 ? Math.min(1, this.zoomies / 0.6) : 0;
    if (glow > 0 && this.state === 'PLAYING') {
      for (let i = this.trail.length - 1; i >= 1; i--) {
        ctx.save();
        ctx.globalAlpha = 0.22 - i * 0.04;
        ctx.translate(-i * 13, 0);
        p.draw(ctx, { offsetY: this.trail[i] - p.y, ghostColor: '#FFC531' });
        ctx.restore();
      }
    }
    p.draw(ctx, { glow, time: this.time });
  }

  drawDizzyStars(ctx, p, hop) {
    const hx = p.x + p.width / 2 + 18;
    const hy = p.y + p.height - 62 - hop;
    ctx.save();
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#7A4A00';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a = this.deathT * 5 + (i * Math.PI * 2) / 3;
      const x = hx + Math.cos(a) * 16;
      const y = hy + Math.sin(a) * 5;
      this.particles.drawStar(ctx, x, y, 5, a);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSpeedLines(ctx, strength) {
    ctx.save();
    ctx.strokeStyle = this.zoomies > 0 ? 'rgba(255, 230, 140, 0.55)' : 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.globalAlpha = Math.max(0, Math.min(1, strength));
    for (let i = 0; i < 9; i++) {
      const y = 40 + ((i * 97) % 280);
      const len = 50 + ((i * 53) % 70);
      const x = this.viewW - (((this.time * (900 + i * 70)) + i * 211) % (this.viewW + len * 2));
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + len, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  stepFrame(dt = 0.01667) {
    this.update(dt);
    this.render();
  }

  // ---------------------------------------------------------------------
  // UI sync
  // ---------------------------------------------------------------------

  setStat(el, label, value) {
    if (!el) return;
    const v = el.querySelector ? el.querySelector('.value') : null;
    if (v) v.textContent = Number(value).toLocaleString();
    else el.textContent = `${label}: ${value}`;
  }

  setOverlay(el, visible) {
    if (!el) return;
    el.style.display = visible ? '' : 'none';
    if (visible) el.classList.remove('hidden');
    else el.classList.add('hidden');
    if (!visible && typeof document !== 'undefined' && el.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }

  toast(text, variant = '') {
    const el = this.toastEl;
    if (!el) return;
    el.textContent = text;
    el.className = variant ? `toast ${variant}` : 'toast';
    void el.offsetWidth; // restart CSS animation
    el.classList.add('show');
  }

  /** Cheap per-frame HUD refresh: only touches the DOM when values change. */
  updateHUD() {
    const c = this.hudCache;
    const s = Math.floor(this.score);
    if (c.score !== s) {
      c.score = s;
      this.setStat(this.scoreDisplay, 'Score', s);
    }
    if (this.bonesEl && c.bones !== this.bones) {
      c.bones = this.bones;
      this.bonesEl.textContent = String(this.bones);
    }
    const mult = this.comboMultiplier;
    if (this.comboEl && c.mult !== mult) {
      c.mult = mult;
      this.comboEl.textContent = `×${mult}`;
      this.comboEl.classList.toggle('active', mult > 1);
      if (mult > 1) {
        this.comboEl.classList.remove('bump');
        void this.comboEl.offsetWidth;
        this.comboEl.classList.add('bump');
      }
    }
    if (this.powerEl) {
      const active = this.zoomies > 0;
      if (c.power !== active) {
        c.power = active;
        this.powerEl.classList.toggle('active', active);
      }
      if (active && this.powerBar) {
        const pct = Math.round((this.zoomies / ZOOMIES_TIME) * 100);
        if (c.powerPct !== pct) {
          c.powerPct = pct;
          this.powerBar.style.width = `${pct}%`;
        }
      }
    }
    if (this.hudEl) {
      const beating = this.bestAnnounced;
      if (c.beating !== beating) {
        c.beating = beating;
        this.hudEl.classList.toggle('beating-best', beating);
      }
    }
  }

  syncUI() {
    this.highScore = Storage.getHighScore();
    const displayScore = Math.floor(this.score);
    const displayHigh = Math.floor(this.highScore);

    this.setStat(this.scoreDisplay, 'Score', displayScore);
    this.setStat(this.highScoreDisplay, 'High Score', displayHigh);
    if (this.finalScoreEl) this.finalScoreEl.textContent = `${displayScore}`;
    if (this.gameOverHighScoreEl) this.gameOverHighScoreEl.textContent = `${displayHigh}`;
    if (this.startBestEl) this.startBestEl.textContent = displayHigh.toLocaleString();
    if (this.goBonesEl) this.goBonesEl.textContent = String(this.bones);
    if (this.goDistanceEl) this.goDistanceEl.textContent = `${Math.floor(this.distance / 40).toLocaleString()} m`;
    if (this.goComboEl) this.goComboEl.textContent = `${this.bestCombo}`;
    if (this.newBestEl) this.newBestEl.classList.toggle('hidden', !(this.state === 'GAMEOVER' && this.isNewBest));

    // Manage Overlays
    this.setOverlay(this.startScreen, this.state === 'START');
    this.setOverlay(this.pauseOverlay, this.state === 'PAUSED');
    this.setOverlay(this.gameOverScreen, this.state === 'GAMEOVER');

    if (this.hudEl) {
      this.hudEl.classList.toggle('hud-hidden', this.state === 'START');
    }
    if (this.pauseBtn) {
      this.pauseBtn.classList.toggle('hidden', this.state !== 'PLAYING');
    }
    for (const b of this.muteBtns || []) {
      b.classList.toggle('is-muted', AudioSystem.muted);
      b.setAttribute('aria-pressed', AudioSystem.muted ? 'true' : 'false');
    }

    this.hudCache = {};
    this.updateHUD();
  }
}
