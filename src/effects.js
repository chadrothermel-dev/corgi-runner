import { TAU, circle, clamp } from './art.js';

/**
 * Cosmetic effects layer: dust, floating score text, impact stars, screen shake,
 * flash, speed lines and milestone banners. Nothing here affects gameplay.
 */
export class Effects {
  constructor(viewW = 800, viewH = 450) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.dust = [];
    this.texts = [];
    this.stars = [];
    this.lines = [];
    this.shakeTime = 0;
    this.shakeMag = 0;
    this.flash = 0;
    this.banner = null;
    this.maxDust = 70;
  }

  clear() {
    this.dust.length = 0;
    this.texts.length = 0;
    this.stars.length = 0;
    this.lines.length = 0;
    this.shakeTime = 0;
    this.flash = 0;
    this.banner = null;
  }

  puff(x, y, count, { spread = 1, up = 30, back = 60, size = 4, color = '#e6d3b3' } = {}) {
    for (let i = 0; i < count && this.dust.length < this.maxDust; i++) {
      this.dust.push({
        x: x + (Math.random() - 0.5) * 8 * spread,
        y: y - Math.random() * 3,
        vx: -back * (0.5 + Math.random()) + (Math.random() - 0.5) * 50 * spread,
        vy: -up * (0.3 + Math.random()),
        r: size * (0.6 + Math.random() * 0.8),
        life: 1,
        decay: 1.6 + Math.random() * 1.2,
        color
      });
    }
  }

  text(x, y, str, color = '#fff6c2', size = 18) {
    this.texts.push({ x, y, str, color, size, life: 1 });
  }

  impact(x, y) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + Math.random() * 0.3;
      const sp = 140 + Math.random() * 120;
      this.stars.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60, rot: Math.random() * TAU, life: 1 });
    }
  }

  shake(mag, time) {
    this.shakeMag = Math.max(this.shakeMag, mag);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  showBanner(str, sub = '') {
    this.banner = { str, sub, life: 1 };
  }

  update(dt, speed = 0) {
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vy += 40 * dt;
      d.r += 9 * dt;
      d.life -= d.decay * dt;
      if (d.life <= 0) this.dust.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y -= 46 * dt;
      t.life -= 1.1 * dt;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const s = this.stars[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += 500 * dt;
      s.rot += 8 * dt;
      s.life -= 1.4 * dt;
      if (s.life <= 0) this.stars.splice(i, 1);
    }

    // Speed lines once things get fast
    const intensity = clamp((speed - 430) / 330, 0, 1);
    if (intensity > 0 && Math.random() < intensity * 18 * dt && this.lines.length < 14) {
      this.lines.push({
        x: this.viewW + 20,
        y: 30 + Math.random() * 300,
        len: 60 + Math.random() * 120,
        v: speed * (1.6 + Math.random()),
        a: 0.15 + 0.25 * intensity
      });
    }
    for (let i = this.lines.length - 1; i >= 0; i--) {
      const l = this.lines[i];
      l.x -= l.v * dt;
      if (l.x + l.len < 0) this.lines.splice(i, 1);
    }

    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakeMag = 0;
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.banner) {
      this.banner.life -= dt * 0.6;
      if (this.banner.life <= 0) this.banner = null;
    }
  }

  get shakeOffset() {
    if (this.shakeTime <= 0) return { x: 0, y: 0 };
    const m = this.shakeMag * Math.min(1, this.shakeTime * 3);
    return { x: (Math.random() - 0.5) * 2 * m, y: (Math.random() - 0.5) * 2 * m };
  }

  drawDust(ctx) {
    for (const d of this.dust) {
      ctx.globalAlpha = Math.max(0, d.life) * 0.55;
      ctx.fillStyle = d.color;
      circle(ctx, d.x, d.y, d.r);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  drawSpeedLines(ctx) {
    if (!this.lines.length) return;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const l of this.lines) {
      ctx.strokeStyle = `rgba(255,255,255,${l.a})`;
      ctx.beginPath();
      ctx.moveTo(l.x, l.y);
      ctx.lineTo(l.x + l.len, l.y);
      ctx.stroke();
    }
  }

  drawOverlay(ctx) {
    // Impact stars
    for (const s of this.stars) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, s.life);
      ctx.translate(s.x, s.y);
      ctx.rotate(s.rot);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 === 0 ? 6 : 2.6;
        const a = (k * Math.PI) / 5;
        if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Floating score text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of this.texts) {
      const pop = t.life > 0.85 ? 1 + (t.life - 0.85) * 3 : 1;
      ctx.globalAlpha = clamp(t.life * 1.6, 0, 1);
      ctx.font = `800 ${Math.round(t.size * pop)}px Outfit, "Segoe UI", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.75)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;

    // Milestone banner
    if (this.banner) {
      const b = this.banner;
      const life = b.life;
      const intro = clamp((1 - life) * 6, 0, 1);
      const a = clamp(life * 3, 0, 1);
      const scale = 0.6 + 0.4 * (1 - Math.pow(1 - intro, 3));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(this.viewW / 2, 92);
      ctx.scale(scale, scale);
      ctx.font = '26px "Press Start 2P", monospace';
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(60, 20, 70, 0.8)';
      ctx.strokeText(b.str, 0, 0);
      const g = ctx.createLinearGradient(0, -16, 0, 16);
      g.addColorStop(0, '#fff3a0');
      g.addColorStop(1, '#ff9a2e');
      ctx.fillStyle = g;
      ctx.fillText(b.str, 0, 0);
      if (b.sub) {
        ctx.font = '700 15px Outfit, "Segoe UI", sans-serif';
        ctx.lineWidth = 4;
        ctx.strokeText(b.sub, 0, 30);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(b.sub, 0, 30);
      }
      ctx.restore();
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${this.flash * 0.6})`;
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }
}
