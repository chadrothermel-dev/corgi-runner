import { AudioSystem } from './audio.js';
import { TAU, rrect, ellipse, circle, clamp } from './art.js';

// Pembroke palette
const FUR = '#E8892E';
const FUR_L = '#F6AE5A';
const FUR_D = '#C2651B';
const FUR_FAR = '#B9601C';
const WHITE = '#FFF9F0';
const CREAM = '#EADBC4';
const PINK = '#F493A6';
const PINK_D = '#D9667C';
const DARK = '#2B1A12';
const COLLAR = '#2F7DE1';

export class CorgiPlayer {
  constructor(groundY = 350) {
    this.groundY = groundY;
    this.normalHeight = 50;
    this.duckHeight = 25;
    this.width = 60;
    this.height = this.normalHeight;

    this.x = 80;
    this.y = this.groundY - this.height;

    this.vy = 0;
    this.gravity = 1200;
    this.jumpImpulse = -550;

    this.state = 'RUNNING';
    this.isGrounded = true;
    this.isDucking = false;
    this.animTime = 0;

    this._resetVisuals();
  }

  // Visual-only state (never affects physics or collision).
  _resetVisuals() {
    this.runPhase = 0;
    this.runRate = 16;
    this.stretch = 0;
    this.squash = 0;
    this.blinkTimer = 2.5;
    this.blinkLeft = 0;
    this.earSwing = 0;
    this.earVel = 0;
    this.dead = false;
    this.deadTime = 0;
    this.justLanded = false;
    this.justJumped = false;
  }

  reset() {
    this.height = this.normalHeight;
    this.y = this.groundY - this.height;
    this.vy = 0;
    this.state = 'RUNNING';
    this.isGrounded = true;
    this.isDucking = false;
    this.animTime = 0;
    this._resetVisuals();
  }

  jump() {
    if (this.isGrounded) {
      this.vy = this.jumpImpulse;
      this.isGrounded = false;
      this.state = 'JUMPING';
      this.stretch = 1;
      this.justJumped = true;
      AudioSystem.play('jump');
      return true;
    }
    return false; // Ignored double-jump
  }

  duck() {
    this.isDucking = true;
    this.height = this.duckHeight;

    if (this.isGrounded) {
      this.y = this.groundY - this.duckHeight;
      this.state = 'DUCKING';
    } else {
      // Mid-air fast fall
      this.vy += 800 * 0.016; // increase downward velocity
    }
  }

  stopDuck() {
    this.isDucking = false;
    this.height = this.normalHeight;

    if (this.isGrounded) {
      this.y = this.groundY - this.normalHeight;
      this.state = 'RUNNING';
    }
  }

  update(dt) {
    this.animTime += dt;

    // Apply gravity if airborne
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
      if (this.isDucking) {
        this.vy += 1200 * dt; // Extra fast fall weight
      }
      this.y += this.vy * dt;

      // Check ground collision
      if (this.y + this.height >= this.groundY) {
        this.y = this.groundY - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
        this.squash = 1;
        this.justLanded = true;
      }
    } else {
      // Grounded state alignment
      this.y = this.groundY - this.height;
      this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
    }

    this.animate(dt);
  }

  /** Advance purely cosmetic animation (also used on the title screen). */
  animate(dt) {
    if (this.dead) {
      this.deadTime += dt;
    } else {
      this.runPhase += dt * this.runRate * (this.isDucking ? 0.8 : 1);
    }
    this.stretch = Math.max(0, this.stretch - dt * 5);
    this.squash = Math.max(0, this.squash - dt * 6);

    this.blinkTimer -= dt;
    if (this.blinkTimer <= 0) {
      this.blinkLeft = 0.12;
      this.blinkTimer = 2 + Math.random() * 3.5;
    }
    this.blinkLeft = Math.max(0, this.blinkLeft - dt);

    // Springy ears: target depends on vertical motion
    let target = 0;
    if (this.isDucking) target = -1.15;
    else if (!this.isGrounded) target = this.vy < 0 ? -0.55 : 0.18;
    else target = Math.sin(this.runPhase * 2) * 0.08;
    this.earVel += (target - this.earSwing) * 160 * dt;
    this.earVel *= Math.exp(-12 * dt);
    this.earSwing += this.earVel * dt;
  }

  draw(ctx) {
    const cx = this.x + this.width / 2;
    const footY = this.y + this.height;
    const alt = Math.max(0, this.groundY - footY);

    // Contact shadow shrinks as the corgi rises
    const k = clamp(1 - alt / 170, 0.3, 1);
    ctx.save();
    ctx.globalAlpha = 0.3 * k;
    ctx.fillStyle = '#1a1020';
    ellipse(ctx, cx + 2, this.groundY + 1.5, 31 * k, 5 * k);
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, footY);
    const sx = 1 + 0.14 * this.squash - 0.08 * this.stretch;
    const sy = 1 - 0.17 * this.squash + 0.12 * this.stretch;
    ctx.scale(sx, sy);

    if (this.dead) {
      ctx.rotate(-0.06 + Math.sin(this.deadTime * 3) * 0.02);
    } else if (!this.isGrounded) {
      ctx.rotate(clamp(this.vy / 2600, -0.2, 0.22));
    }

    if (this.isDucking && !this.dead) this._drawDuck(ctx);
    else this._drawStand(ctx);
    ctx.restore();

    if (this.dead) this._drawDizzy(ctx, cx + 24, this.y - 6);
  }

  // ------------------------------------------------------------ body parts
  _leg(ctx, hx, hy, ang, len, far) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(ang);
    ctx.fillStyle = far ? FUR_FAR : FUR;
    rrect(ctx, -3.8, -3, 7.6, len + 3, 3.6);
    ctx.fill();
    ctx.fillStyle = far ? CREAM : WHITE;
    rrect(ctx, -3.8, len - 6, 7.6, 6, 3);
    ctx.fill();
    ellipse(ctx, 1.2, len - 0.8, 4.6, 2.6);
    ctx.fill();
    if (!far) {
      ctx.strokeStyle = 'rgba(120,90,70,0.35)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(2.2, len - 2.5);
      ctx.lineTo(2.2, len + 1);
      ctx.stroke();
    }
    ctx.restore();
  }

  _legAngles() {
    const p = this.runPhase;
    if (this.dead) return { bf: 0.5, bn: 0.3, ff: -0.4, fn: -0.2 };
    if (!this.isGrounded) {
      return this.vy < 0
        ? { bf: 1.0, bn: 0.85, ff: -1.05, fn: -0.9 }
        : { bf: 0.45, bn: 0.3, ff: -0.55, fn: -0.35 };
    }
    // Rotary gallop: near/far legs offset in phase
    return {
      bn: Math.sin(p) * 0.7,
      bf: Math.sin(p + 0.6) * 0.7,
      fn: Math.sin(p + Math.PI) * 0.75,
      ff: Math.sin(p + Math.PI + 0.6) * 0.75
    };
  }

  _drawStand(ctx) {
    const running = this.isGrounded && !this.dead;
    const bob = running ? -Math.abs(Math.sin(this.runPhase)) * 2.4 : 0;
    const L = this._legAngles();
    const legLen = 13;

    // Far legs
    this._leg(ctx, -14, -16 + bob, L.bf, legLen, true);
    this._leg(ctx, 16, -16 + bob, L.ff, legLen, true);

    ctx.save();
    ctx.translate(0, bob);

    // Fluffy rear + tiny tail tuft
    const wag = Math.sin(this.animTime * 18) * 1.5;
    ctx.fillStyle = FUR_L;
    circle(ctx, -30, -32 + wag * 0.4, 5);
    ctx.fill();
    ctx.fillStyle = FUR;
    circle(ctx, -24, -26, 10.5);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ellipse(ctx, -26, -19, 6.5, 7, 0.3);
    ctx.fill();

    // Body
    const bg = ctx.createLinearGradient(0, -38, 0, -11);
    bg.addColorStop(0, FUR_L);
    bg.addColorStop(0.55, FUR);
    bg.addColorStop(1, FUR_D);
    ctx.fillStyle = bg;
    ellipse(ctx, -2, -24, 25, 12.5);
    ctx.fill();

    // Saddle shading along the back
    ctx.fillStyle = 'rgba(160, 80, 20, 0.28)';
    ellipse(ctx, -6, -33, 16, 4.5);
    ctx.fill();

    // White belly
    ctx.fillStyle = WHITE;
    ellipse(ctx, 3, -16.5, 18, 6);
    ctx.fill();

    // Chest ruff with scalloped fluff
    ctx.fillStyle = WHITE;
    ellipse(ctx, 17, -23, 9, 11.5, -0.25);
    ctx.fill();
    for (let i = 0; i < 3; i++) {
      circle(ctx, 23 - i * 1.2, -27 + i * 5.5, 3.6);
      ctx.fill();
    }

    // Collar and tag
    ctx.save();
    ctx.translate(16, -31);
    ctx.rotate(-0.55);
    ctx.fillStyle = COLLAR;
    rrect(ctx, -2.6, -7, 5.2, 14, 2.4);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#FFD34E';
    circle(ctx, 21.5, -22.5, 2.8);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    circle(ctx, 20.7, -23.4, 0.9);
    ctx.fill();

    ctx.restore();

    // Near legs (on top of body)
    this._leg(ctx, -12, -15 + bob, L.bn, legLen, false);
    this._leg(ctx, 18, -15 + bob, L.fn, legLen, false);

    // Head
    let tilt = 0;
    if (this.dead) tilt = 0.12;
    else if (!this.isGrounded) tilt = this.vy < 0 ? -0.14 : 0.08;
    else tilt = Math.sin(this.runPhase * 2) * 0.04;
    this._drawHead(ctx, 25, -38 + bob * 1.2, tilt, this.earSwing);
  }

  _drawDuck(ctx) {
    const p = this.runPhase;
    const wig = Math.sin(p * 1.3) * 0.25;

    // Far legs splayed
    this._leg(ctx, -16, -7, 1.35 + wig, 9, true);
    this._leg(ctx, 18, -7, -1.4 - wig, 9, true);

    ctx.fillStyle = FUR;
    circle(ctx, -26, -11, 8);
    ctx.fill();
    ctx.fillStyle = CREAM;
    ellipse(ctx, -28, -7, 5, 4.5);
    ctx.fill();

    const bg = ctx.createLinearGradient(0, -21, 0, -3);
    bg.addColorStop(0, FUR_L);
    bg.addColorStop(1, FUR_D);
    ctx.fillStyle = bg;
    ellipse(ctx, -1, -11, 28, 9);
    ctx.fill();
    ctx.fillStyle = WHITE;
    ellipse(ctx, 4, -5, 20, 4);
    ctx.fill();
    ellipse(ctx, 19, -9, 8, 6.5);
    ctx.fill();

    ctx.fillStyle = COLLAR;
    rrect(ctx, 19, -17, 4.5, 11, 2);
    ctx.fill();

    this._leg(ctx, -12, -6, 1.3 - wig, 9, false);
    this._leg(ctx, 20, -6, -1.35 + wig, 9, false);

    this._drawHead(ctx, 30, -12, 0.08, this.earSwing, 0.9);
  }

  _drawHead(ctx, hx, hy, tilt, earAng, s = 1) {
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(tilt);
    ctx.scale(s, s);

    // Far ear
    this._ear(ctx, -6, -6, earAng - 0.12, true);

    // Skull
    const hg = ctx.createRadialGradient(-3, -5, 2, 0, 0, 14);
    hg.addColorStop(0, FUR_L);
    hg.addColorStop(1, FUR);
    ctx.fillStyle = hg;
    ellipse(ctx, 0, 0, 12.5, 11);
    ctx.fill();

    // Cheeks, muzzle and blaze
    ctx.fillStyle = WHITE;
    ellipse(ctx, 5, 4.5, 9, 6.2);
    ctx.fill();
    ellipse(ctx, 12.5, 3, 8.5, 5.4);
    ctx.fill();
    ellipse(ctx, 3, -5, 2.6, 7, 0.45);
    ctx.fill();

    // Near ear
    this._ear(ctx, 1, -8, earAng, false);

    // Eye
    if (this.dead) {
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(3.5, -5.5);
      ctx.lineTo(8, -1);
      ctx.moveTo(8, -5.5);
      ctx.lineTo(3.5, -1);
      ctx.stroke();
    } else if (this.blinkLeft > 0) {
      ctx.strokeStyle = DARK;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(3.5, -3);
      ctx.quadraticCurveTo(5.8, -1.6, 8, -3);
      ctx.stroke();
    } else {
      ctx.fillStyle = DARK;
      ellipse(ctx, 5.8, -3.4, 2.7, 3.3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      circle(ctx, 6.7, -4.6, 1.1);
      ctx.fill();
      circle(ctx, 5, -2.2, 0.45);
      ctx.fill();
    }
    // Eyebrow tuft
    ctx.fillStyle = FUR_D;
    ellipse(ctx, 5, -8.2, 2.4, 1, -0.2);
    ctx.fill();

    // Nose
    ctx.fillStyle = DARK;
    ellipse(ctx, 20.5, 1, 3.1, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    circle(ctx, 19.6, 0.1, 0.9);
    ctx.fill();

    // Mouth and tongue
    const panting = (this.isGrounded || this.dead) && !this.isDucking;
    ctx.strokeStyle = DARK;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(20, 3.4);
    ctx.quadraticCurveTo(17, 7.4, 12.5, 6);
    ctx.stroke();
    if (panting) {
      const flap = this.dead ? 3 : Math.sin(this.runPhase * 2) * 1.6;
      const tl = (this.dead ? 8 : 5.5) + flap;
      ctx.fillStyle = PINK;
      rrect(ctx, 13.5, 5.5, 4.6, tl, 2.3);
      ctx.fill();
      ctx.strokeStyle = PINK_D;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(15.8, 6.5);
      ctx.lineTo(15.8, 5.5 + tl - 1.5);
      ctx.stroke();
    }

    // Blush
    ctx.fillStyle = 'rgba(255, 120, 140, 0.25)';
    ellipse(ctx, 8, 4, 2.6, 1.6);
    ctx.fill();

    ctx.restore();
  }

  _ear(ctx, bx, by, ang, far) {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(ang);
    ctx.fillStyle = far ? FUR_D : FUR;
    ctx.beginPath();
    ctx.moveTo(-6, 1);
    ctx.quadraticCurveTo(-6.5, -10, -2.5, -17.5);
    ctx.quadraticCurveTo(-1.2, -19.2, 0, -17.6);
    ctx.quadraticCurveTo(5.5, -10, 6.5, 0);
    ctx.closePath();
    ctx.fill();
    if (!far) {
      ctx.fillStyle = PINK;
      ctx.beginPath();
      ctx.moveTo(-3.4, -0.5);
      ctx.quadraticCurveTo(-3.5, -9, -1.4, -14);
      ctx.quadraticCurveTo(3.2, -8, 3.6, -0.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ellipse(ctx, 0.4, -3.5, 2, 4.5);
      ctx.fill();
    }
    ctx.restore();
  }

  _drawDizzy(ctx, x, y) {
    const t = this.deadTime * 4;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * TAU) / 3;
      const px = x + Math.cos(a) * 16;
      const py = y + Math.sin(a) * 5;
      ctx.fillStyle = i === 1 ? '#ffffff' : '#FFD84A';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 5 : 2.2;
        const aa = (k * Math.PI) / 5 - Math.PI / 2;
        if (k === 0) ctx.moveTo(px + Math.cos(aa) * r, py + Math.sin(aa) * r);
        else ctx.lineTo(px + Math.cos(aa) * r, py + Math.sin(aa) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}
