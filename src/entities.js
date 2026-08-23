export class EntityManager {
  constructor(canvasWidth = 800, groundY = 350) {
    this.canvasWidth = canvasWidth;
    this.groundY = groundY;
    this.entities = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // seconds
  }

  reset() {
    this.entities = [];
    this.spawnTimer = 0;
  }

  spawnHurdle(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'hurdle',
      x,
      y: this.groundY - 40,
      width: 30,
      height: 40
    };
    this.entities.push(obstacle);
    return obstacle;
  }

  spawnHydrant(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'hydrant',
      x,
      y: this.groundY - 45,
      width: 35,
      height: 45
    };
    this.entities.push(obstacle);
    return obstacle;
  }

  spawnHighHurdle(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'high_hurdle',
      x,
      y: this.groundY - 75,
      width: 40,
      height: 35 // bottom edge is groundY - 40. Ducked Corgi top edge is groundY - 25.
    };
    this.entities.push(obstacle);
    return obstacle;
  }

  spawnTreat(x = this.canvasWidth, altitude = 'ground') {
    let y = this.groundY - 30;
    if (altitude === 'air') {
      y = this.groundY - 100; // reachable during jump arc
    } else if (altitude === 'low') {
      y = this.groundY - 25;
    }

    const treat = {
      type: 'treat',
      subType: 'treat',
      x,
      y,
      width: 25,
      height: 20,
      points: 50
    };
    this.entities.push(treat);
    return treat;
  }

  update(dt, currentSpeed) {
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // Auto-spawn random entity
      const r = Math.random();
      if (r < 0.4) {
        this.spawnHurdle();
      } else if (r < 0.7) {
        this.spawnTreat(this.canvasWidth, Math.random() > 0.5 ? 'air' : 'ground');
      } else {
        this.spawnHighHurdle();
      }
    }

    // Move entities and clean up off-screen
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.x -= currentSpeed * dt;
      if (e.x + e.width < 0) {
        this.entities.splice(i, 1);
      }
    }
  }

  draw(ctx) {
    for (const e of this.entities) {
      ctx.save();
      if (e.type === 'obstacle') {
        if (e.subType === 'hurdle') {
          this.drawHurdle(ctx, e);
        } else if (e.subType === 'hydrant') {
          this.drawHydrant(ctx, e);
        } else if (e.subType === 'high_hurdle') {
          this.drawHighHurdle(ctx, e);
        }
      } else if (e.type === 'treat') {
        this.drawBone(ctx, e);
      }
      ctx.restore();
    }
  }

  drawHurdle(ctx, e) {
    // Posts
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(e.x + 2, e.y, 5, e.height);
    ctx.fillRect(e.x + e.width - 7, e.y, 5, e.height);
    // Top bar
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(e.x, e.y, e.width, 8);
    // White stripe on bar
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(e.x, e.y + 3, e.width, 2);
    // Middle bar
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(e.x, e.y + e.height * 0.5, e.width, 5);
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(e.x, e.y + e.height * 0.5 + 2, e.width, 1);
  }

  drawHydrant(ctx, e) {
    const cx = e.x + e.width / 2;
    // Base
    ctx.fillStyle = '#922B21';
    ctx.fillRect(e.x + 4, e.y + e.height - 10, e.width - 8, 10);
    // Body
    ctx.fillStyle = '#E74C3C';
    ctx.fillRect(e.x + 6, e.y + 12, e.width - 12, e.height - 22);
    // Cap dome
    ctx.fillStyle = '#C0392B';
    ctx.beginPath();
    ctx.arc(cx, e.y + 14, (e.width - 12) / 2, Math.PI, 0);
    ctx.fill();
    ctx.fillRect(e.x + 6, e.y + 12, e.width - 12, 4);
    // Top knob
    ctx.fillStyle = '#922B21';
    ctx.fillRect(cx - 4, e.y, 8, 8);
    ctx.fillRect(cx - 6, e.y + 4, 12, 4);
    // Nozzles on sides
    ctx.fillStyle = '#C0392B';
    ctx.fillRect(e.x, e.y + 20, 8, 6);
    ctx.fillRect(e.x + e.width - 8, e.y + 20, 8, 6);
    // Highlight reflection
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(e.x + 10, e.y + 16, 3, e.height - 30);
  }

  drawHighHurdle(ctx, e) {
    // Floating bar with warning stripes
    // Posts (thin, extend below)
    ctx.fillStyle = '#7D3C98';
    ctx.fillRect(e.x + 3, e.y, 4, e.height + 40);
    ctx.fillRect(e.x + e.width - 7, e.y, 4, e.height + 40);
    // Main bar
    ctx.fillStyle = '#8E44AD';
    ctx.fillRect(e.x, e.y, e.width, e.height * 0.7);
    // Warning stripes
    const stripeW = 8;
    for (let sx = e.x; sx < e.x + e.width; sx += stripeW * 2) {
      ctx.fillStyle = '#F39C12';
      ctx.fillRect(sx, e.y, Math.min(stripeW, e.x + e.width - sx), e.height * 0.7);
    }
    // Bottom edge
    ctx.fillStyle = '#6C3483';
    ctx.fillRect(e.x, e.y + e.height * 0.7, e.width, 3);
  }

  drawBone(ctx, e) {
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2;
    const boneW = e.width * 0.7;
    const knobR = e.height * 0.25;
    // Bone shaft
    ctx.fillStyle = '#FFF8DC';
    ctx.fillRect(cx - boneW / 2, cy - 3, boneW, 6);
    // Left knobs
    ctx.beginPath();
    ctx.arc(cx - boneW / 2, cy - 3, knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx - boneW / 2, cy + 3, knobR, 0, Math.PI * 2);
    ctx.fill();
    // Right knobs
    ctx.beginPath();
    ctx.arc(cx + boneW / 2, cy - 3, knobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + boneW / 2, cy + 3, knobR, 0, Math.PI * 2);
    ctx.fill();
    // Subtle golden glow
    ctx.fillStyle = 'rgba(255, 215, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(cx, cy, e.width * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
}
