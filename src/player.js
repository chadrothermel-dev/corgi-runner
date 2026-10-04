import { AudioSystem } from './audio.js';

const PAL = {
  outline: '#4A2410',
  fur: '#EF9B45',
  furFar: '#C9752E',
  furDark: '#C46A24',
  white: '#FFF8EC',
  whiteShade: '#EADBC6',
  earInner: '#F7B4A4',
  nose: '#2A1A12',
  tongue: '#FF7A93',
  tongueDark: '#E0566F',
  bandana: '#2F7DF6',
  bandanaDark: '#1E5BC0'
};

const LEG = 15;
const JUMP_BUFFER_TIME = 0.12;

/** Rounded-rect sub-path (no beginPath), portable across browsers. */
function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
}

function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
}

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

    // Feel + presentation state (never affects collision geometry)
    this.jumpBuffer = 0;
    this.justLanded = false;
    this.landingSpeed = 0;
    this.squash = 0;
    this.earLag = 0;
    this.runSpeed = 1;
  }

  reset() {
    this.height = this.normalHeight;
    this.y = this.groundY - this.height;
    this.vy = 0;
    this.state = 'RUNNING';
    this.isGrounded = true;
    this.isDucking = false;
    this.animTime = 0;
    this.jumpBuffer = 0;
    this.justLanded = false;
    this.squash = 0;
    this.earLag = 0;
  }

  jump() {
    if (this.isGrounded) {
      this.vy = this.jumpImpulse;
      this.isGrounded = false;
      this.state = 'JUMPING';
      this.jumpBuffer = 0;
      this.squash = -1;
      AudioSystem.play('jump');
      return true;
    }
    // Remember the press briefly so a slightly-early tap still jumps on landing
    this.jumpBuffer = JUMP_BUFFER_TIME;
    return false;
  }

  duck() {
    const wasDucking = this.isDucking;
    this.isDucking = true;
    this.height = this.duckHeight;

    if (this.isGrounded) {
      this.y = this.groundY - this.duckHeight;
      this.state = 'DUCKING';
      if (!wasDucking) AudioSystem.play('duck');
    } else {
      // Mid-air fast fall
      this.vy += 800 * 0.016;
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
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.squash += (0 - this.squash) * Math.min(1, dt * 9);

    // Apply gravity if airborne
    if (!this.isGrounded) {
      this.vy += this.gravity * dt;
      if (this.isDucking) {
        this.vy += 1200 * dt; // Extra fast fall weight
      }
      this.y += this.vy * dt;

      // Check ground collision
      if (this.y + this.height >= this.groundY) {
        this.landingSpeed = this.vy;
        this.y = this.groundY - this.height;
        this.vy = 0;
        this.isGrounded = true;
        this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
        this.justLanded = true;
        this.squash = Math.min(1, 0.35 + this.landingSpeed / 1100);

        if (this.jumpBuffer > 0 && !this.isDucking) {
          this.jump();
        }
      }
    } else {
      // Grounded state alignment
      this.y = this.groundY - this.height;
      this.state = this.isDucking ? 'DUCKING' : 'RUNNING';
    }

    const earTarget = this.isGrounded ? 0 : Math.max(-0.5, Math.min(0.5, this.vy * 0.0009));
    this.earLag += (earTarget - this.earLag) * Math.min(1, dt * 10);
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} opts { dead, rotation, offsetY, glow, ghostColor, time }
   */
  draw(ctx, opts = {}) {
    const dead = !!opts.dead;
    const ducking = this.isDucking && !dead;
    const airborne = !this.isGrounded && !dead;
    const t = this.animTime;
    const phase = t * 15 * this.runSpeed;
    const running = !airborne && !dead;

    const cx = this.x + this.width / 2 - 3;
    const by = this.y + this.height + (opts.offsetY || 0);

    ctx.save();
    ctx.translate(cx, by);

    if (opts.rotation) {
      ctx.translate(0, -20);
      ctx.rotate(opts.rotation);
      ctx.translate(0, 20);
    } else if (airborne) {
      const tilt = Math.max(-0.22, Math.min(0.28, this.vy / 2200));
      ctx.translate(0, -20);
      ctx.rotate(tilt);
      ctx.translate(0, 20);
    }

    const sq = dead ? 0 : this.squash;
    ctx.scale(1 + 0.16 * sq, 1 - 0.16 * sq);

    if (opts.glow > 0) this.drawAura(ctx, opts.glow, ducking, opts.time || t);

    const pose = this.computePose({ ducking, airborne, running, dead, phase, t });

    if (opts.ghostColor) {
      this.drawShapes(ctx, pose, 1, opts.ghostColor);
    } else {
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 3.6;
      ctx.strokeStyle = PAL.outline;
      this.drawShapes(ctx, pose, 0);
      this.drawShapes(ctx, pose, 1);
      this.drawDetails(ctx, pose, { dead, running, ducking, t });
    }

    ctx.restore();
  }

  drawAura(ctx, glow, ducking, time) {
    const pulse = 0.75 + Math.sin(time * 10) * 0.25;
    const cy = ducking ? -12 : -28;
    const g = ctx.createRadialGradient(4, cy, 4, 4, cy, 52);
    g.addColorStop(0, `rgba(255, 220, 90, ${0.55 * glow * pulse})`);
    g.addColorStop(1, 'rgba(255, 200, 60, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(4, cy, 52, 0, Math.PI * 2);
    ctx.fill();
  }

  computePose({ ducking, airborne, running, dead, phase, t }) {
    const bob = running && !ducking ? -Math.abs(Math.sin(phase)) * 2.2 : 0;
    const swing = 0.8;

    if (ducking) {
      const slide = Math.sin(t * 30) * 0.06;
      return {
        bob: 0,
        body: [-2, -11, 28, 9.5],
        butt: [-23, -12, 9],
        chest: [17, -12, 9.5],
        tail: [-31, -16, Math.sin(t * 20) * 0.3],
        head: [27, -17, 10.5],
        earRot: -1.05,
        legs: {
          backFar: [-19, -6, 1.42 + slide],
          frontFar: [15, -6, -1.38 - slide],
          backNear: [-16, -5, 1.5 - slide],
          frontNear: [18, -5, -1.48 + slide]
        }
      };
    }

    let legs;
    if (dead) {
      legs = {
        backFar: [-17, -17, 0.5],
        frontFar: [13, -17, -0.5],
        backNear: [-15, -17, 0.35],
        frontNear: [15, -17, -0.35]
      };
    } else if (airborne) {
      const k = Math.max(-1, Math.min(1, this.vy / 550));
      legs = {
        backFar: [-17, -17, 0.75 + k * 0.25],
        frontFar: [13, -17, -0.85 - k * 0.2],
        backNear: [-15, -17, 0.95 + k * 0.25],
        frontNear: [15, -17, -1.0 - k * 0.2]
      };
    } else {
      legs = {
        backFar: [-17, -17 + bob, Math.sin(phase + 0.6) * swing],
        frontFar: [13, -17 + bob, Math.sin(phase + Math.PI + 0.6) * swing],
        backNear: [-15, -17 + bob, Math.sin(phase) * swing],
        frontNear: [15, -17 + bob, Math.sin(phase + Math.PI) * swing]
      };
    }

    return {
      bob,
      body: [-3, -26 + bob, 25, 12],
      butt: [-23, -27 + bob, 10.5],
      chest: [15, -27 + bob, 11],
      tail: [-30, -34 + bob, Math.sin(t * 18) * (dead ? 0 : 0.4)],
      head: [25, -41 + bob + (running ? Math.sin(phase * 2) * 0.6 : 0), 11.5],
      earRot: (dead ? -0.5 : 0) - this.earLag * 1.4 + (running ? Math.sin(phase * 2 + 1) * 0.06 : 0),
      legs
    };
  }

  /** mode 0 = outline stroke pass, mode 1 = fill pass */
  drawShapes(ctx, P, mode, override = null) {
    const paint = (color) => {
      if (mode === 0) ctx.stroke();
      else {
        ctx.fillStyle = override || color;
        ctx.fill();
      }
    };

    const leg = ([hx, hy, ang], color) => {
      ctx.save();
      ctx.translate(hx, hy);
      ctx.rotate(ang);
      ctx.beginPath();
      rr(ctx, -3.6, -4, 7.2, LEG + 4, 3.6);
      paint(color);
      if (mode === 1 && !override) {
        ctx.fillStyle = PAL.white;
        ctx.beginPath();
        rr(ctx, -3.6, LEG - 5, 7.2, 5, 2.6);
        ctx.fill();
      }
      ctx.restore();
    };

    // Far legs
    leg(P.legs.backFar, PAL.furFar);
    leg(P.legs.frontFar, PAL.furFar);

    // Tail
    const [tx, ty, tw] = P.tail;
    ctx.beginPath();
    ellipse(ctx, tx, ty, 7.5, 5, -0.6 + tw);
    paint(PAL.fur);

    // Body mass
    ctx.beginPath();
    ellipse(ctx, P.body[0], P.body[1], P.body[2], P.body[3]);
    paint(PAL.fur);
    ctx.beginPath();
    ctx.arc(P.butt[0], P.butt[1], P.butt[2], 0, Math.PI * 2);
    paint(PAL.fur);
    ctx.beginPath();
    ctx.arc(P.chest[0], P.chest[1], P.chest[2], 0, Math.PI * 2);
    paint(PAL.fur);

    // Near legs
    leg(P.legs.backNear, PAL.fur);
    leg(P.legs.frontNear, PAL.fur);

    // Head + snout + ears
    const [hx, hy, hr] = P.head;
    this.ear(ctx, hx, hy, P.earRot, -1, paint, PAL.furDark);
    ctx.beginPath();
    ctx.arc(hx, hy, hr, 0, Math.PI * 2);
    paint(PAL.fur);
    ctx.beginPath();
    ellipse(ctx, hx + 10, hy + 4, 9, 6.2, 0.08);
    paint(PAL.fur);
    this.ear(ctx, hx, hy, P.earRot, 1, paint, PAL.fur);
  }

  ear(ctx, hx, hy, rot, which, paint, color) {
    // which: -1 = back ear, 1 = front ear
    const bx1 = which < 0 ? hx - 9 : hx - 2;
    const bx2 = which < 0 ? hx - 2 : hx + 6;
    const by1 = which < 0 ? hy - 5 : hy - 9;
    const by2 = which < 0 ? hy - 9 : hy - 6;
    const tipX = which < 0 ? hx - 10 : hx + 3;
    const tipY = which < 0 ? hy - 21 : hy - 24;
    const px = (bx1 + bx2) / 2;
    const py = (by1 + by2) / 2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot * (which < 0 ? 1.1 : 1));
    ctx.translate(-px, -py);
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.quadraticCurveTo(tipX - 4, (by1 + tipY) / 2, tipX, tipY);
    ctx.quadraticCurveTo(bx2 + 2, (by2 + tipY) / 2, bx2, by2);
    ctx.closePath();
    paint(color);
    ctx.restore();
  }

  drawDetails(ctx, P, { dead, running, ducking, t }) {
    const [hx, hy] = P.head;

    // Back highlight + saddle shading
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = PAL.furDark;
    ctx.beginPath();
    ellipse(ctx, P.body[0] - 3, P.body[1] - P.body[3] * 0.55, P.body[2] * 0.6, P.body[3] * 0.35);
    ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#FFE3B8';
    ctx.beginPath();
    ellipse(ctx, P.body[0] + 2, P.body[1] - P.body[3] * 0.75, P.body[2] * 0.5, P.body[3] * 0.15);
    ctx.fill();
    ctx.restore();

    // White belly + chest
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ellipse(ctx, P.body[0] + 1, P.body[1] + P.body[3] * 0.72, P.body[2] * 0.65, P.body[3] * 0.3);
    ctx.fill();
    ctx.beginPath();
    ellipse(ctx, P.chest[0] + 2, P.chest[1] + 2, P.chest[2] * 0.72, P.chest[2] * 0.85);
    ctx.fill();
    ctx.fillStyle = PAL.whiteShade;
    ctx.beginPath();
    ellipse(ctx, P.chest[0] + 3, P.chest[1] + P.chest[2] * 0.6, P.chest[2] * 0.5, P.chest[2] * 0.22);
    ctx.fill();

    // Tail tip
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ellipse(ctx, P.tail[0] - 3, P.tail[1] - 1.5, 3.5, 2.6, -0.6 + P.tail[2]);
    ctx.fill();

    // Inner ears
    this.innerEar(ctx, hx, hy, P.earRot);

    // Muzzle + blaze
    ctx.fillStyle = PAL.white;
    ctx.beginPath();
    ellipse(ctx, hx + 11, hy + 6, 8, 4.6, 0.1);
    ctx.fill();
    ctx.beginPath();
    ellipse(ctx, hx + 5, hy - 6, 2.2, 5.2, 0.35);
    ctx.fill();

    // Cheek blush
    ctx.fillStyle = 'rgba(255, 120, 120, 0.35)';
    ctx.beginPath();
    ellipse(ctx, hx + 3, hy + 4, 3.2, 2);
    ctx.fill();

    // Bandana
    if (!ducking) {
      ctx.beginPath();
      ctx.moveTo(hx - 10, hy + 8);
      ctx.quadraticCurveTo(hx - 2, hy + 12, hx + 5, hy + 10);
      ctx.lineTo(hx - 3, hy + 20);
      ctx.closePath();
      ctx.fillStyle = PAL.bandana;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(hx - 4, hy + 12, 1.1, 0, Math.PI * 2);
      ctx.arc(hx - 1, hy + 15, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tongue (flaps while running)
    if (running && !ducking) {
      const flap = Math.sin(t * 30) * 1.2;
      ctx.fillStyle = PAL.tongue;
      ctx.beginPath();
      ellipse(ctx, hx + 13, hy + 11 + flap * 0.5, 2.6, 4 + flap * 0.4, 0.2);
      ctx.fill();
      ctx.strokeStyle = PAL.tongueDark;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hx + 13, hy + 9);
      ctx.lineTo(hx + 13.4, hy + 13 + flap * 0.5);
      ctx.stroke();
    }

    // Mouth line
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(hx + 18, hy + 6);
    ctx.quadraticCurveTo(hx + 14, hy + 9.5, hx + 10, hy + 7.5);
    ctx.stroke();

    // Nose
    ctx.fillStyle = PAL.nose;
    ctx.beginPath();
    ellipse(ctx, hx + 18.6, hy + 2, 3.1, 2.5);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(hx + 18, hy + 1.1, 0.9, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    const ex = hx + 4.5;
    const ey = hy - 2;
    if (dead) {
      ctx.strokeStyle = PAL.nose;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, ey - 2.5);
      ctx.lineTo(ex + 2.5, ey + 2.5);
      ctx.moveTo(ex + 2.5, ey - 2.5);
      ctx.lineTo(ex - 2.5, ey + 2.5);
      ctx.stroke();
    } else {
      const blink = (t % 3.2) < 0.12;
      ctx.fillStyle = PAL.nose;
      ctx.beginPath();
      ellipse(ctx, ex, ey, 2.7, blink ? 0.6 : 3.1);
      ctx.fill();
      if (!blink) {
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(ex + 0.9, ey - 1.2, 1.05, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  innerEar(ctx, hx, hy, rot) {
    const bx1 = hx - 0.5;
    const bx2 = hx + 4.5;
    const by1 = hy - 9;
    const by2 = hy - 7;
    const tipX = hx + 2.6;
    const tipY = hy - 20;
    const px = hx + 2;
    const py = hy - 7.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rot);
    ctx.translate(-px, -py);
    ctx.fillStyle = PAL.earInner;
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.quadraticCurveTo(tipX - 2.5, (by1 + tipY) / 2, tipX, tipY);
    ctx.quadraticCurveTo(bx2 + 1, (by2 + tipY) / 2, bx2, by2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
