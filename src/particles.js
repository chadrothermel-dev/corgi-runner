/**
 * Lightweight particle + floating-text system.
 * Kinds: 'spark' (4-point star), 'circle', 'dust' (expanding puff),
 * 'confetti' (spinning rectangle). Dust is drawn behind the player via
 * drawBack(); everything else in front via drawFront().
 */
const SPARK_COLORS = ['#FFD54A', '#FFB020', '#FF8A3D', '#FFF3B0', '#FFE082', '#FF6FA8'];
const CONFETTI_COLORS = ['#FF5E7E', '#FFB020', '#4ADE80', '#38BDF8', '#A78BFA', '#FDE047'];

export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.texts = [];
    this.maxParticles = 400;
  }

  push(p) {
    if (this.particles.length >= this.maxParticles) this.particles.shift();
    this.particles.push(p);
  }

  /** Sparkle burst (treat pickup). */
  emit(x, y, count = 10, colors = SPARK_COLORS) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 170 + 70;
      this.push({
        kind: Math.random() > 0.4 ? 'spark' : 'circle',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 60,
        gravity: 260,
        drag: 2.2,
        life: 1.0,
        decay: Math.random() * 1.2 + 1.1,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: Math.random() * 3.5 + 2,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8
      });
    }
  }

  /** Soft dust puffs kicked up by paws / landings. */
  dust(x, y, count = 4, spread = 1) {
    for (let i = 0; i < count; i++) {
      this.push({
        kind: 'dust',
        x: x + (Math.random() - 0.5) * 10 * spread,
        y: y - Math.random() * 4,
        vx: -60 - Math.random() * 90 * spread,
        vy: -Math.random() * 40 * spread,
        gravity: 30,
        drag: 3,
        life: 1.0,
        decay: 1.6 + Math.random() * 0.8,
        color: '#E9D3AE',
        radius: 3 + Math.random() * 3 * spread,
        grow: 10 + Math.random() * 8
      });
    }
  }

  confetti(x, y, count = 40) {
    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const speed = 220 + Math.random() * 260;
      this.push({
        kind: 'confetti',
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        gravity: 520,
        drag: 1.4,
        life: 1.0,
        decay: 0.45 + Math.random() * 0.3,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
        radius: 3 + Math.random() * 3,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 16
      });
    }
  }

  /** Floating score / label text that drifts upward and fades. */
  text(x, y, str, color = '#FFFFFF', size = 18) {
    this.texts.push({ x, y, str, color, size, life: 1.0, vy: -70 });
    if (this.texts.length > 24) this.texts.shift();
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const drag = Math.max(0, 1 - (p.drag || 0) * dt);
      p.vx *= drag;
      p.vy = p.vy * drag + (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.spin) p.rotation += p.spin * dt;
      if (p.grow) p.radius += p.grow * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.y += t.vy * dt;
      t.vy *= Math.max(0, 1 - 2.5 * dt);
      t.life -= dt * 1.1;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
  }

  draw(ctx) {
    this.drawBack(ctx);
    this.drawFront(ctx);
  }

  drawBack(ctx) {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind !== 'dust') continue;
      ctx.globalAlpha = Math.max(0, p.life) * 0.55;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawFront(ctx) {
    ctx.save();
    for (const p of this.particles) {
      if (p.kind === 'dust') continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 1.5));
      ctx.fillStyle = p.color;
      if (p.kind === 'spark') {
        this.drawStar(ctx, p.x, p.y, p.radius * 1.6, p.rotation);
      } else if (p.kind === 'confetti') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillRect(-p.radius, -p.radius * 0.5, p.radius * 2, p.radius * Math.abs(Math.cos(p.rotation * 1.7)) + 1);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (const t of this.texts) {
      const a = Math.max(0, Math.min(1, t.life * 2));
      const pop = 1 + Math.max(0, t.life - 0.85) * 2.5;
      ctx.globalAlpha = a;
      ctx.font = `${Math.round(t.size * pop)}px 'Lilita One', 'Fredoka', sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(40, 20, 10, 0.85)';
      ctx.strokeText(t.str, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.restore();
  }

  drawStar(ctx, x, y, r, rot = 0) {
    const spikes = 4;
    const innerR = r * 0.38;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? r : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2 + rot;
      const px = x + radius * Math.cos(angle);
      const py = y + radius * Math.sin(angle);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  clear() {
    this.particles = [];
    this.texts = [];
  }

  get activeCount() {
    return this.particles.length;
  }
}
