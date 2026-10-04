/**
 * Obstacles, treats, spawn patterns and their artwork.
 *
 * Gap timing is expressed in seconds (spawnInterval * gapScale). Because the
 * jump arc also lasts a fixed time (~0.92s), a time-based gap stays fair at
 * every speed.
 */
const OUT = '#3A2216';
const JUMP_V = 550;
const GRAVITY = 1200;
const APEX_T = JUMP_V / GRAVITY;

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

function fillStroke(ctx, fill, lw = 2, stroke = OUT) {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = lw;
  ctx.strokeStyle = stroke;
  ctx.stroke();
}

export class EntityManager {
  constructor(canvasWidth = 800, groundY = 350) {
    this.canvasWidth = canvasWidth;
    this.groundY = groundY;
    this.entities = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // seconds (base gap between waves)
    this.gapScale = 1;
    this.time = 0;
    this.goldenEnabled = true;
  }

  reset() {
    this.entities = [];
    this.spawnTimer = 0;
    this.gapScale = 1;
  }

  // --- Spawners (public API, used by tests) -----------------------------

  spawnHurdle(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'hurdle',
      x,
      y: this.groundY - 40,
      width: 30,
      height: 40,
      phase: Math.random() * 10
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
      height: 45,
      phase: Math.random() * 10
    };
    this.entities.push(obstacle);
    return obstacle;
  }

  /** Duck-under obstacle, drawn as a low-flying seagull. */
  spawnHighHurdle(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'high_hurdle',
      x,
      y: this.groundY - 75,
      width: 40,
      height: 35, // bottom edge is groundY - 40. Ducked Corgi top edge is groundY - 25.
      phase: Math.random() * 10
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
    } else if (typeof altitude === 'number') {
      y = altitude;
    }

    const treat = {
      type: 'treat',
      subType: 'treat',
      x,
      y,
      width: 25,
      height: 20,
      points: 50,
      phase: Math.random() * Math.PI * 2
    };
    this.entities.push(treat);
    return treat;
  }

  spawnGoldenBone(x = this.canvasWidth, y = this.groundY - 115) {
    const treat = {
      type: 'treat',
      subType: 'golden',
      x,
      y,
      width: 28,
      height: 22,
      points: 250,
      phase: Math.random() * Math.PI * 2
    };
    this.entities.push(treat);
    return treat;
  }

  /** Five bones tracing the ideal jump arc over an obstacle centred at cx. */
  spawnBoneArc(cx, speed) {
    const offsets = [-0.26, -0.13, 0, 0.13, 0.26];
    for (const o of offsets) {
      const t = APEX_T + o;
      const h = JUMP_V * t - (GRAVITY / 2) * t * t;
      const centerY = this.groundY - h - 30;
      this.spawnTreat(cx + o * speed - 12.5, centerY - 10);
    }
  }

  spawnBoneRow(x, count, altitude = 'ground', spacing = 34) {
    for (let i = 0; i < count; i++) this.spawnTreat(x + i * spacing, altitude);
  }

  // --- Wave director ----------------------------------------------------

  rollGap(d) {
    const lo = 1.0 - 0.36 * d;
    const hi = 1.3 - 0.42 * d;
    return lo + Math.random() * (hi - lo);
  }

  spawnWave(speed, d) {
    const X = this.canvasWidth + 40;
    const options = [
      ['hurdle', 0.3],
      ['hydrant', 0.2],
      ['bird', 0.14 + 0.1 * d],
      ['double', d > 0.2 ? 0.16 * d : 0],
      ['bones', 0.22 - 0.06 * d]
    ];
    const total = options.reduce((s, o) => s + o[1], 0);
    let r = Math.random() * total;
    let pick = 'hurdle';
    for (const [name, w] of options) {
      r -= w;
      if (r <= 0) {
        pick = name;
        break;
      }
    }

    let nextGap = this.rollGap(d);

    switch (pick) {
      case 'hurdle': {
        const o = this.spawnHurdle(X);
        if (Math.random() < 0.4) this.spawnBoneArc(o.x + o.width / 2, speed);
        break;
      }
      case 'hydrant': {
        const o = this.spawnHydrant(X);
        if (Math.random() < 0.35) this.spawnBoneArc(o.x + o.width / 2, speed);
        break;
      }
      case 'bird': {
        const o = this.spawnHighHurdle(X);
        if (Math.random() < 0.45) this.spawnBoneRow(o.x - 24, 3, 'low', 32);
        break;
      }
      case 'double': {
        this.spawnHurdle(X);
        this.spawnHurdle(X + 62);
        nextGap += 0.15;
        break;
      }
      case 'bones':
      default: {
        if (Math.random() < 0.5) {
          this.spawnBoneRow(X, 3 + Math.floor(Math.random() * 3), 'ground');
        } else {
          this.spawnBoneRow(X, 3, 'air', 40);
        }
        nextGap *= 0.6;
        break;
      }
    }

    if (this.goldenEnabled && d > 0.06 && pick !== 'bird' && Math.random() < 0.06) {
      this.spawnGoldenBone(X + speed * 0.75);
    }

    this.gapScale = nextGap;
  }

  update(dt, currentSpeed, difficulty = 0) {
    this.time += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval * this.gapScale) {
      this.spawnTimer = 0;
      this.spawnWave(currentSpeed, Math.max(0, Math.min(1, difficulty)));
    }

    // Move entities and clean up off-screen
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      e.x -= currentSpeed * dt;
      if (e.phase !== undefined) e.phase += dt;
      if (e.x + e.width < -40) {
        this.entities.splice(i, 1);
      }
    }
  }

  // --- Rendering --------------------------------------------------------

  drawShadows(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(40, 25, 10, 0.22)';
    for (const e of this.entities) {
      if (e.type !== 'obstacle') continue;
      const cx = e.x + e.width / 2;
      const isBird = e.subType === 'high_hurdle';
      ctx.globalAlpha = isBird ? 0.5 : 1;
      ctx.beginPath();
      ctx.ellipse(cx, this.groundY + 3, isBird ? 14 : e.width * 0.62, isBird ? 2.5 : 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  draw(ctx, time = this.time) {
    for (const e of this.entities) {
      ctx.save();
      if (e.type === 'obstacle') {
        if (e.subType === 'hurdle') {
          this.drawHurdle(ctx, e);
        } else if (e.subType === 'hydrant') {
          this.drawHydrant(ctx, e);
        } else if (e.subType === 'high_hurdle') {
          this.drawBird(ctx, e, time);
        }
      } else if (e.type === 'treat') {
        this.drawBone(ctx, e, time);
      }
      ctx.restore();
    }
  }

  drawHurdle(ctx, e) {
    const { x, y, width: w, height: h } = e;
    ctx.lineJoin = 'round';

    // Feet
    ctx.beginPath();
    rr(ctx, x - 3, y + h - 4, 11, 5, 2);
    rr(ctx, x + w - 8, y + h - 4, 11, 5, 2);
    fillStroke(ctx, '#3E4C5E', 1.6);

    // Poles with blue bands
    for (const px of [x + 1, x + w - 6]) {
      ctx.beginPath();
      rr(ctx, px, y - 3, 5, h, 2);
      fillStroke(ctx, '#F6F8FB', 1.8);
      ctx.fillStyle = '#2F7DF6';
      for (let sy = y + 2; sy < y + h - 6; sy += 9) ctx.fillRect(px + 0.8, sy, 3.4, 4);
    }
    // Pole caps
    ctx.beginPath();
    ctx.arc(x + 3.5, y - 4, 3.3, 0, Math.PI * 2);
    ctx.moveTo(x + w - 0.2, y - 4);
    ctx.arc(x + w - 3.5, y - 4, 3.3, 0, Math.PI * 2);
    fillStroke(ctx, '#FFC531', 1.6);

    // Bars (red/white striped)
    const bar = (by, bh) => {
      ctx.save();
      ctx.beginPath();
      rr(ctx, x - 1, by, w + 2, bh, bh / 2);
      ctx.clip();
      ctx.fillStyle = '#FF4D5E';
      ctx.fillRect(x - 1, by, w + 2, bh);
      ctx.fillStyle = '#FFFFFF';
      for (let sx = x - 1; sx < x + w + 2; sx += 12) ctx.fillRect(sx + 6, by, 6, bh);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x - 1, by + 0.8, w + 2, bh * 0.3);
      ctx.restore();
      ctx.beginPath();
      rr(ctx, x - 1, by, w + 2, bh, bh / 2);
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = OUT;
      ctx.stroke();
    };
    bar(y + 2, 6);
    bar(y + 20, 4.5);
  }

  drawHydrant(ctx, e) {
    const { x, y } = e;
    ctx.lineJoin = 'round';
    const bodyGrad = ctx.createLinearGradient(x + 8, 0, x + 27, 0);
    bodyGrad.addColorStop(0, '#FF7B82');
    bodyGrad.addColorStop(0.45, '#E8414F');
    bodyGrad.addColorStop(1, '#A51F2D');

    // Side nozzles
    ctx.beginPath();
    rr(ctx, x + 1, y + 20, 9, 9, 2.5);
    rr(ctx, x + 25, y + 20, 9, 9, 2.5);
    fillStroke(ctx, '#C92D3B', 1.8);
    ctx.beginPath();
    rr(ctx, x - 1, y + 21.5, 3, 6, 1);
    rr(ctx, x + 33, y + 21.5, 3, 6, 1);
    fillStroke(ctx, '#9B1C28', 1.4);

    // Body
    ctx.beginPath();
    rr(ctx, x + 8, y + 13, 19, 27, 3);
    fillStroke(ctx, bodyGrad, 2);

    // Dome
    ctx.beginPath();
    ctx.arc(x + 17.5, y + 14, 10, Math.PI, 0);
    ctx.closePath();
    fillStroke(ctx, bodyGrad, 2);

    // Collar ring
    ctx.beginPath();
    rr(ctx, x + 5.5, y + 11.5, 24, 5, 2);
    fillStroke(ctx, '#C92D3B', 1.8);

    // Top nut
    ctx.beginPath();
    rr(ctx, x + 14, y + 0.5, 7, 5.5, 1.5);
    fillStroke(ctx, '#A51F2D', 1.6);

    // Front cap
    ctx.beginPath();
    ctx.arc(x + 17.5, y + 27, 4.6, 0, Math.PI * 2);
    fillStroke(ctx, '#C92D3B', 1.6);
    ctx.fillStyle = '#7E1520';
    ctx.beginPath();
    ctx.arc(x + 17.5, y + 27, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Base flange
    ctx.beginPath();
    rr(ctx, x + 3, y + 38, 29, 7, 2.5);
    fillStroke(ctx, '#B42A33', 2);
    ctx.fillStyle = '#FFD1D4';
    for (const bx of [x + 7, x + 17.5, x + 28]) {
      ctx.beginPath();
      ctx.arc(bx, y + 41.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    rr(ctx, x + 11, y + 15, 2.6, 20, 1.3);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + 13.5, y + 9.5, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBird(ctx, e, time) {
    const ph = e.phase || 0;
    const flap = Math.sin(ph * 13);
    const cx = e.x + 21;
    const cy = e.y + 19 + Math.sin(ph * 4) * 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // Far wing
    ctx.beginPath();
    ctx.moveTo(cx - 2, cy - 3);
    ctx.quadraticCurveTo(cx + 5, cy - 4 - 20 * flap, cx + 17, cy - 6 - 15 * flap);
    ctx.quadraticCurveTo(cx + 9, cy - 1, cx + 6, cy);
    ctx.closePath();
    fillStroke(ctx, '#AEB8C5', 1.8, '#2B3440');

    // Tail
    ctx.beginPath();
    ctx.moveTo(cx + 11, cy - 2);
    ctx.lineTo(cx + 22, cy - 5);
    ctx.lineTo(cx + 21, cy + 3);
    ctx.closePath();
    fillStroke(ctx, '#8E99A6', 1.8, '#2B3440');

    // Body
    ctx.beginPath();
    ctx.ellipse(cx + 2, cy, 13.5, 7.8, -0.05, 0, Math.PI * 2);
    fillStroke(ctx, '#FFFFFF', 2, '#2B3440');
    ctx.fillStyle = '#C9D2DC';
    ctx.beginPath();
    ctx.ellipse(cx + 5, cy - 3.5, 9, 3.4, -0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E6EBF0';
    ctx.beginPath();
    ctx.ellipse(cx + 1, cy + 4, 9, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 5, 6.3, 0, Math.PI * 2);
    fillStroke(ctx, '#FFFFFF', 2, '#2B3440');

    // Beak
    ctx.beginPath();
    ctx.moveTo(cx - 15, cy - 6.5);
    ctx.lineTo(cx - 23.5, cy - 3.5);
    ctx.lineTo(cx - 15, cy - 1.5);
    ctx.closePath();
    fillStroke(ctx, '#FFA51F', 1.6, '#2B3440');
    ctx.fillStyle = '#E8412F';
    ctx.beginPath();
    ctx.arc(cx - 19, cy - 3, 1, 0, Math.PI * 2);
    ctx.fill();

    // Eye (angry brow = obvious threat)
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(cx - 11.5, cy - 6, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 14.5, cy - 9.5);
    ctx.lineTo(cx - 9, cy - 8.2);
    ctx.stroke();

    // Near wing
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - 1);
    ctx.quadraticCurveTo(cx + 2, cy - 2 - 24 * flap, cx + 15, cy - 3 - 19 * flap);
    ctx.quadraticCurveTo(cx + 9, cy + 3, cx + 3, cy + 3);
    ctx.closePath();
    fillStroke(ctx, '#DCE3EA', 2, '#2B3440');
    ctx.fillStyle = '#3B4452';
    ctx.beginPath();
    ctx.arc(cx + 14, cy - 3 - 19 * flap, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBone(ctx, e, time) {
    const golden = e.subType === 'golden';
    const ph = e.phase || 0;
    const cx = e.x + e.width / 2;
    const cy = e.y + e.height / 2 + Math.sin(time * 4 + ph) * 3;
    const pulse = 0.8 + Math.sin(time * 6 + ph) * 0.2;

    // Glow
    const gr = golden ? 30 : 19;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, gr);
    glow.addColorStop(0, golden ? `rgba(255, 214, 70, ${0.75 * pulse})` : `rgba(255, 226, 140, ${0.42 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 200, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, gr, 0, Math.PI * 2);
    ctx.fill();

    if (golden) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(time * 1.5);
      ctx.fillStyle = 'rgba(255, 236, 150, 0.35)';
      for (let i = 0; i < 6; i++) {
        ctx.rotate(Math.PI / 3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-3.5, -34);
        ctx.lineTo(3.5, -34);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.sin(time * 3 + ph) * 0.18 - 0.12);
    const s = golden ? 1.15 : 1;
    ctx.scale(s, s);

    const bonePath = () => {
      ctx.beginPath();
      rr(ctx, -8.5, -3.2, 17, 6.4, 3);
      ctx.moveTo(-5, -3.8);
      ctx.arc(-9, -3.8, 4, 0, Math.PI * 2);
      ctx.moveTo(-5, 3.8);
      ctx.arc(-9, 3.8, 4, 0, Math.PI * 2);
      ctx.moveTo(13, -3.8);
      ctx.arc(9, -3.8, 4, 0, Math.PI * 2);
      ctx.moveTo(13, 3.8);
      ctx.arc(9, 3.8, 4, 0, Math.PI * 2);
    };

    ctx.lineJoin = 'round';
    bonePath();
    ctx.lineWidth = 3.6;
    ctx.strokeStyle = golden ? '#8A5600' : '#7A4A22';
    ctx.stroke();

    let fill = '#FFF3DA';
    if (golden) {
      const g = ctx.createLinearGradient(0, -8, 0, 8);
      g.addColorStop(0, '#FFF2A8');
      g.addColorStop(0.5, '#FFD23F');
      g.addColorStop(1, '#F0A300');
      fill = g;
    }
    bonePath();
    ctx.fillStyle = fill;
    ctx.fill();

    // Shade + shine
    ctx.fillStyle = golden ? 'rgba(200, 120, 0, 0.35)' : 'rgba(214, 170, 110, 0.55)';
    ctx.beginPath();
    rr(ctx, -8, 0.8, 16, 2.4, 1.2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    rr(ctx, -6, -2.4, 9, 1.6, 0.8);
    ctx.fill();
    ctx.restore();

    if (golden) {
      const tw = (Math.sin(time * 9 + ph) + 1) / 2;
      ctx.fillStyle = `rgba(255,255,255,${0.5 + tw * 0.5})`;
      this.sparkle(ctx, cx + 10, cy - 9, 3 + tw * 3);
    }
  }

  sparkle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.quadraticCurveTo(x, y, x, y + r);
    ctx.quadraticCurveTo(x, y, x - r, y);
    ctx.quadraticCurveTo(x, y, x, y - r);
    ctx.fill();
  }
}
