export class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  emit(x, y, count = 10) {
    const colors = ['#FFD700', '#FFA500', '#FF6347', '#FFE4B5', '#FFDAB9', '#FF69B4'];
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 150 + 60;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 40,
        life: 1.0,
        decay: Math.random() * 1.2 + 0.8,
        color: colors[Math.floor(Math.random() * colors.length)],
        radius: Math.random() * 4 + 1.5,
        rotation: Math.random() * Math.PI * 2,
        shape: Math.random() > 0.5 ? 'star' : 'circle'
      });
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    ctx.save();
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      if (p.shape === 'star') {
        this.drawStar(ctx, p.x, p.y, p.radius);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawStar(ctx, x, y, r) {
    const spikes = 4;
    const outerR = r;
    const innerR = r * 0.4;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const radius = i % 2 === 0 ? outerR : innerR;
      const angle = (i * Math.PI) / spikes - Math.PI / 2;
      if (i === 0) ctx.moveTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
      else ctx.lineTo(x + radius * Math.cos(angle), y + radius * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  }

  clear() {
    this.particles = [];
  }

  get activeCount() {
    return this.particles.length;
  }
}
