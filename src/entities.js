import { buildSprite, drawSprite, buildGlow, buildShadow, rrect, circle, ellipse, TAU } from './art.js';

const HURDLE_VARIANTS = ['fence', 'cone', 'crate'];

export class EntityManager {
  constructor(canvasWidth = 800, groundY = 350) {
    this.canvasWidth = canvasWidth;
    this.groundY = groundY;
    this.entities = [];
    this.spawnTimer = 0;
    this.spawnInterval = 2.0; // seconds
    this.time = 0;
    this.scale = 1;
    this.sprites = null;
  }

  reset() {
    this.entities = [];
    this.spawnTimer = 0;
  }

  setScale(s) {
    const next = Math.max(1, Math.min(3, s));
    if (next !== this.scale) {
      this.scale = next;
      this.sprites = null;
    }
  }

  spawnHurdle(x = this.canvasWidth) {
    const obstacle = {
      type: 'obstacle',
      subType: 'hurdle',
      variant: HURDLE_VARIANTS[Math.floor(Math.random() * HURDLE_VARIANTS.length)],
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
      phase: Math.random() * TAU,
      x,
      y: this.groundY - 75,
      width: 40,
      height: 35 // bottom edge is groundY - 40. Ducked Corgi top edge is groundY - 25.
    };
    this.entities.push(obstacle);
    return obstacle;
  }

  spawnTreat(x = this.canvasWidth, altitude = 'ground', golden = false) {
    let y = this.groundY - 30;
    if (altitude === 'air') {
      y = this.groundY - 100; // reachable during jump arc
    } else if (altitude === 'low') {
      y = this.groundY - 25;
    }

    const treat = {
      type: 'treat',
      subType: 'treat',
      golden,
      phase: Math.random() * TAU,
      x,
      y,
      width: 25,
      height: 20,
      points: golden ? 150 : 50
    };
    this.entities.push(treat);
    return treat;
  }

  /** Cosmetic clock for flapping/bobbing; keeps running on the game-over screen. */
  animate(dt) {
    this.time += dt;
  }

  update(dt, currentSpeed) {
    this.time += dt;
    this.spawnTimer += dt;
    if (this.spawnTimer >= this.spawnInterval) {
      this.spawnTimer = 0;
      // Auto-spawn random entity
      const r = Math.random();
      if (r < 0.28) {
        this.spawnHurdle();
      } else if (r < 0.4) {
        this.spawnHydrant();
      } else if (r < 0.7) {
        this.spawnTreat(this.canvasWidth, Math.random() > 0.5 ? 'air' : 'ground', Math.random() < 0.12);
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

  // ------------------------------------------------------------ rendering
  _ensureSprites() {
    if (this.sprites) return this.sprites;
    const s = this.scale;
    const P = 8;
    this.sprites = {
      fence: buildSprite(30, 40, s, drawFence, P),
      cone: buildSprite(30, 40, s, drawCone, P),
      crate: buildSprite(30, 40, s, drawCrate, P),
      hydrant: buildSprite(35, 45, s, drawHydrant, P),
      bird: [0, 1, 2, 3].map((f) => buildSprite(40, 35, s, (ctx) => drawBird(ctx, f), 14)),
      bone: buildSprite(25, 20, s, (ctx) => drawBone(ctx, false), 4),
      goldBone: buildSprite(25, 20, s, (ctx) => drawBone(ctx, true), 4),
      glow: buildGlow(60, s, '#ffe58a', 0.8),
      goldGlow: buildGlow(70, s, '#ffc93a', 1),
      shadow: buildShadow(s)
    };
    return this.sprites;
  }

  _shadow(ctx, sp, cx, w, alpha = 1) {
    if (!sp.shadow) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sp.shadow.img, cx - w / 2, this.groundY - 4, w, 9);
    ctx.globalAlpha = 1;
  }

  draw(ctx) {
    const sp = this._ensureSprites();
    const t = this.time;
    for (const e of this.entities) {
      if (e.type === 'obstacle') {
        if (e.subType === 'high_hurdle') {
          const frame = Math.floor((t * 12 + (e.phase || 0) * 2) % 4);
          const bob = Math.sin(t * 6 + (e.phase || 0)) * 3;
          this._shadow(ctx, sp, e.x + e.width / 2, 34, 0.45);
          drawSprite(ctx, sp.bird[frame], e.x, e.y + bob, e.width, e.height);
        } else {
          const sprite = e.subType === 'hydrant' ? sp.hydrant : sp[e.variant] || sp.fence;
          this._shadow(ctx, sp, e.x + e.width / 2, e.width + 16, 0.9);
          drawSprite(ctx, sprite, e.x, e.y, e.width, e.height);
        }
      } else if (e.type === 'treat') {
        const ph = e.phase || 0;
        const bob = Math.sin(t * 4 + ph) * 3;
        const pulse = 0.75 + 0.25 * Math.sin(t * 6 + ph);
        const cx = e.x + e.width / 2;
        const cy = e.y + e.height / 2 + bob;
        const glow = e.golden ? sp.goldGlow : sp.glow;
        const gs = (e.golden ? 70 : 54) * pulse;
        if (glow) {
          ctx.globalAlpha = e.golden ? 0.95 : 0.7;
          ctx.drawImage(glow.img, cx - gs / 2, cy - gs / 2, gs, gs);
          ctx.globalAlpha = 1;
        }
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.sin(t * 3 + ph) * 0.18);
        drawSprite(ctx, e.golden ? sp.goldBone : sp.bone, -e.width / 2, -e.height / 2, e.width, e.height);
        ctx.restore();
        if (e.golden) {
          // Orbiting sparkle
          const a = t * 5 + ph;
          drawTwinkle(ctx, cx + Math.cos(a) * 16, cy + Math.sin(a) * 10, 3 + Math.sin(t * 12) * 1.2);
        }
      }
    }
  }
}

function drawTwinkle(ctx, x, y, r) {
  ctx.fillStyle = '#fffbe0';
  ctx.beginPath();
  ctx.moveTo(x, y - r * 2);
  ctx.lineTo(x + r * 0.45, y - r * 0.45);
  ctx.lineTo(x + r * 2, y);
  ctx.lineTo(x + r * 0.45, y + r * 0.45);
  ctx.lineTo(x, y + r * 2);
  ctx.lineTo(x - r * 0.45, y + r * 0.45);
  ctx.lineTo(x - r * 2, y);
  ctx.lineTo(x - r * 0.45, y - r * 0.45);
  ctx.closePath();
  ctx.fill();
}

// ------------------------------------------------------------ sprite art
function drawFence(ctx) {
  const outline = '#6f6658';
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = outline;
  // Rails behind pickets
  for (const ry of [11, 27]) {
    ctx.fillStyle = '#e7e0d1';
    rrect(ctx, -2, ry, 34, 5, 1.5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-1, ry + 3.5, 32, 1.5);
  }
  for (const px of [1, 11.5, 22]) {
    const g = ctx.createLinearGradient(px, 0, px + 7, 0);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(1, '#d8d0c0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(px, 40);
    ctx.lineTo(px, 5);
    ctx.lineTo(px + 3.5, 0);
    ctx.lineTo(px + 7, 5);
    ctx.lineTo(px + 7, 40);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Nail heads
    ctx.fillStyle = '#8d8475';
    circle(ctx, px + 3.5, 13.5, 0.8);
    ctx.fill();
    circle(ctx, px + 3.5, 29.5, 0.8);
    ctx.fill();
  }
  // Grass tufts at the base
  ctx.fillStyle = '#5aa634';
  for (const gx of [-2, 6, 15, 24, 31]) {
    ctx.beginPath();
    ctx.moveTo(gx - 2, 41);
    ctx.lineTo(gx, 34 + (gx % 3));
    ctx.lineTo(gx + 2, 41);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCone(ctx) {
  // Base plate
  ctx.fillStyle = '#2d2f36';
  rrect(ctx, -1, 35, 32, 6, 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(0, 35.5, 30, 1.2);
  // Body
  const g = ctx.createLinearGradient(4, 0, 26, 0);
  g.addColorStop(0, '#ffa04a');
  g.addColorStop(0.45, '#ff7a1a');
  g.addColorStop(1, '#d24e08');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(4, 35.5);
  ctx.lineTo(12, 2);
  ctx.quadraticCurveTo(15, 0, 18, 2);
  ctx.lineTo(26, 35.5);
  ctx.closePath();
  ctx.fill();
  // Reflective bands
  const band = (y0, y1) => {
    const xl = (y) => 12 - ((y - 2) / 33.5) * 8;
    const xr = (y) => 18 + ((y - 2) / 33.5) * 8;
    ctx.beginPath();
    ctx.moveTo(xl(y0), y0);
    ctx.lineTo(xr(y0), y0);
    ctx.lineTo(xr(y1), y1);
    ctx.lineTo(xl(y1), y1);
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = '#f4f6fa';
  band(11, 16);
  band(23, 28.5);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.moveTo(9, 33);
  ctx.lineTo(13.5, 4);
  ctx.lineTo(15, 4);
  ctx.lineTo(11.5, 33);
  ctx.closePath();
  ctx.fill();
}

function drawCrate(ctx) {
  const wood = '#c48a4c';
  const dark = '#7e5129';
  ctx.fillStyle = wood;
  rrect(ctx, 0, 2, 30, 38, 2);
  ctx.fill();
  // Planks
  ctx.strokeStyle = 'rgba(90, 55, 25, 0.5)';
  ctx.lineWidth = 1;
  for (let y = 9; y < 38; y += 7.5) {
    ctx.beginPath();
    ctx.moveTo(3, y);
    ctx.lineTo(27, y);
    ctx.stroke();
  }
  // Frame
  ctx.fillStyle = dark;
  ctx.fillRect(0, 2, 30, 4);
  ctx.fillRect(0, 36, 30, 4);
  ctx.fillRect(0, 2, 4, 38);
  ctx.fillRect(26, 2, 4, 38);
  // Diagonal brace
  ctx.save();
  ctx.beginPath();
  ctx.rect(4, 6, 22, 30);
  ctx.clip();
  ctx.strokeStyle = dark;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(4, 36);
  ctx.lineTo(26, 6);
  ctx.stroke();
  ctx.restore();
  // Highlights and nails
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(0, 2, 30, 1.2);
  ctx.fillStyle = '#d9c6a0';
  for (const [nx, ny] of [[2, 4], [28, 4], [2, 38], [28, 38]]) {
    circle(ctx, nx, ny, 0.9);
    ctx.fill();
  }
  // Paw stencil
  ctx.fillStyle = 'rgba(80, 45, 20, 0.35)';
  circle(ctx, 15, 25, 3);
  ctx.fill();
  for (const [tx, ty] of [[11.5, 20.5], [14, 19], [16.5, 19], [19, 20.5]]) {
    circle(ctx, tx, ty, 1.2);
    ctx.fill();
  }
}

function drawHydrant(ctx) {
  const red = (x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#9e1a1a');
    g.addColorStop(0.35, '#f0463c');
    g.addColorStop(0.6, '#d9302a');
    g.addColorStop(1, '#8a1414');
    return g;
  };
  const steel = (x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#8a939e');
    g.addColorStop(0.4, '#eef2f6');
    g.addColorStop(1, '#6d7680');
    return g;
  };
  // Base flange
  ctx.fillStyle = red(2, 33);
  rrect(ctx, 2, 39, 31, 6, 1.5);
  ctx.fill();
  ctx.fillStyle = '#5e0f0f';
  for (const bx of [5, 12, 23, 30]) {
    circle(ctx, bx, 42, 1);
    ctx.fill();
  }
  // Barrel
  ctx.fillStyle = red(7, 28);
  rrect(ctx, 7, 14, 21, 26, 3);
  ctx.fill();
  // Side outlets
  for (const sx of [0.5, 27.5]) {
    ctx.fillStyle = steel(sx, sx + 7);
    rrect(ctx, sx, 20, 7, 8, 2);
    ctx.fill();
    ctx.fillStyle = '#5a636c';
    ctx.fillRect(sx + (sx < 10 ? 0 : 5.5), 21.5, 1.5, 5);
  }
  // Front pumper outlet
  ctx.fillStyle = steel(12, 23);
  circle(ctx, 17.5, 27, 5.2);
  ctx.fill();
  ctx.fillStyle = '#58616a';
  ctx.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU - Math.PI / 2;
    const px = 17.5 + Math.cos(a) * 2.4;
    const py = 27 + Math.sin(a) * 2.4;
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  // Chain
  ctx.strokeStyle = '#9aa3ad';
  ctx.lineWidth = 0.9;
  ctx.setLineDash([1.2, 1]);
  ctx.beginPath();
  ctx.moveTo(4, 27);
  ctx.quadraticCurveTo(9, 35, 13, 30);
  ctx.stroke();
  ctx.setLineDash([]);
  // Collar ring
  ctx.fillStyle = '#7d1515';
  rrect(ctx, 5, 12.5, 25, 4, 1.5);
  ctx.fill();
  // Bonnet dome
  ctx.fillStyle = red(7, 28);
  ctx.beginPath();
  ctx.arc(17.5, 13, 10.5, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  // Operating nut
  ctx.fillStyle = steel(13.5, 21.5);
  rrect(ctx, 14, 0.5, 7, 4.5, 1);
  ctx.fill();
  ctx.fillStyle = '#7d1515';
  ctx.fillRect(12.5, 4, 10, 2);
  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  rrect(ctx, 10.5, 16, 2.4, 20, 1.2);
  ctx.fill();
  ellipse(ctx, 13.5, 7.5, 3, 1.6, -0.5);
  ctx.fill();
}

function drawBird(ctx, frame) {
  // A plump pigeon flying left (toward the corgi). Wing angle varies per frame.
  const wingTip = [[22, -10], [30, 4], [26, 30], [30, 4]][frame];
  // Far wing
  ctx.fillStyle = '#7e8a99';
  ctx.beginPath();
  ctx.moveTo(16, 15);
  ctx.quadraticCurveTo(wingTip[0] - 4, wingTip[1] + 4, wingTip[0] - 6, wingTip[1] + 2);
  ctx.quadraticCurveTo(wingTip[0] + 2, (wingTip[1] + 18) / 2, 26, 17);
  ctx.closePath();
  ctx.fill();
  // Tail
  ctx.fillStyle = '#5d6877';
  ctx.beginPath();
  ctx.moveTo(30, 17);
  ctx.lineTo(42, 13);
  ctx.lineTo(43, 21);
  ctx.lineTo(30, 22);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2f3540';
  ctx.fillRect(39.5, 13.5, 3, 7.5);
  // Body
  const g = ctx.createLinearGradient(0, 8, 0, 28);
  g.addColorStop(0, '#b9c3cf');
  g.addColorStop(1, '#8592a3');
  ctx.fillStyle = g;
  ellipse(ctx, 21, 19, 13.5, 8.5);
  ctx.fill();
  // Iridescent neck
  ctx.fillStyle = '#5fa58f';
  ellipse(ctx, 11, 17, 5.5, 5.5);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 90, 200, 0.55)';
  ellipse(ctx, 12, 20, 4, 3);
  ctx.fill();
  // Head
  ctx.fillStyle = '#7d8999';
  circle(ctx, 7.5, 12, 6.2);
  ctx.fill();
  // Beak
  ctx.fillStyle = '#f2a33a';
  ctx.beginPath();
  ctx.moveTo(1.8, 11);
  ctx.lineTo(-4, 13.2);
  ctx.lineTo(2, 14.6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#f4efe6';
  ellipse(ctx, 2.5, 11.2, 1.4, 1);
  ctx.fill();
  // Eye with an annoyed brow
  ctx.fillStyle = '#ff9d2e';
  circle(ctx, 6, 10.8, 2.2);
  ctx.fill();
  ctx.fillStyle = '#1b1b1f';
  circle(ctx, 5.6, 10.9, 1.2);
  ctx.fill();
  ctx.strokeStyle = '#3a404b';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(3, 7.6);
  ctx.lineTo(8.5, 8.6);
  ctx.stroke();
  // Wing bars
  ctx.fillStyle = 'rgba(40,45,55,0.5)';
  ctx.fillRect(20, 20, 7, 1.5);
  ctx.fillRect(22, 23, 6, 1.5);
  // Near wing
  const ng = ctx.createLinearGradient(16, wingTip[1], 30, 20);
  ng.addColorStop(0, '#5f6b7b');
  ng.addColorStop(1, '#a9b4c2');
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.moveTo(15, 16);
  ctx.quadraticCurveTo(wingTip[0] - 2, wingTip[1] + 2, wingTip[0], wingTip[1]);
  ctx.quadraticCurveTo(wingTip[0] + 4, (wingTip[1] + 18) / 2 + 2, 28, 18);
  ctx.closePath();
  ctx.fill();
  // Tucked feet
  ctx.fillStyle = '#e46a6a';
  ctx.fillRect(21, 26.5, 4, 2);
  ctx.fillRect(25, 26, 3, 2);
}

function drawBone(ctx, golden) {
  const fill = ctx.createLinearGradient(0, 2, 0, 18);
  if (golden) {
    fill.addColorStop(0, '#fff3a6');
    fill.addColorStop(0.5, '#ffd23f');
    fill.addColorStop(1, '#d99a12');
  } else {
    fill.addColorStop(0, '#fffaf0');
    fill.addColorStop(0.6, '#f3e3c3');
    fill.addColorStop(1, '#dcc49a');
  }
  const outline = golden ? '#9c6200' : '#a0845c';
  const knobs = [[5, 6.5], [5, 13.5], [20, 6.5], [20, 13.5]];
  const shape = (grow) => {
    rrect(ctx, 5 - grow, 7.2 - grow, 15 + grow * 2, 5.6 + grow * 2, 2.8 + grow);
    ctx.fill();
    for (const [kx, ky] of knobs) {
      circle(ctx, kx, ky, 4.3 + grow);
      ctx.fill();
    }
  };
  ctx.fillStyle = outline;
  shape(1.3);
  ctx.fillStyle = fill;
  shape(0);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  rrect(ctx, 7, 8, 11, 1.6, 0.8);
  ctx.fill();
  circle(ctx, 3.8, 5.2, 1.4);
  ctx.fill();
  circle(ctx, 18.8, 5.2, 1.4);
  ctx.fill();
}
