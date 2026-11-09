import {
  TAU, makeCanvas, buildSprite, buildGlow, seededRandom, periodicWave,
  mixColor, rgba, clamp, wrapDraw, circle, ellipse, rrect
} from './art.js';

// Sky palette keyframes across one full day cycle (phase 0..1).
const SKY_KEYS = [
  { t: 0.00, top: '#3a8ee6', mid: '#7cc0f2', bot: '#d4eefa', night: 0.00, warm: 0.0 },
  { t: 0.38, top: '#3a8ee6', mid: '#7cc0f2', bot: '#d4eefa', night: 0.00, warm: 0.0 },
  { t: 0.47, top: '#4a5fa8', mid: '#e98a72', bot: '#ffd08a', night: 0.10, warm: 1.0 },
  { t: 0.55, top: '#1a2050', mid: '#4a3a78', bot: '#c0677a', night: 0.60, warm: 0.5 },
  { t: 0.62, top: '#060a1e', mid: '#0f1a3e', bot: '#22305e', night: 1.00, warm: 0.0 },
  { t: 0.86, top: '#060a1e', mid: '#0f1a3e', bot: '#22305e', night: 1.00, warm: 0.0 },
  { t: 0.93, top: '#4b5ca8', mid: '#f0a48c', bot: '#ffe2a6', night: 0.25, warm: 0.7 },
  { t: 1.00, top: '#3a8ee6', mid: '#7cc0f2', bot: '#d4eefa', night: 0.00, warm: 0.0 }
];

const smooth = (t) => t * t * (3 - 2 * t);

export function sampleSky(phase) {
  const p = ((phase % 1) + 1) % 1;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && p > SKY_KEYS[i + 1].t) i++;
  const a = SKY_KEYS[i];
  const b = SKY_KEYS[i + 1];
  const t = smooth(clamp((p - a.t) / (b.t - a.t || 1), 0, 1));
  return {
    top: mixColor(a.top, b.top, t),
    mid: mixColor(a.mid, b.mid, t),
    bot: mixColor(a.bot, b.bot, t),
    botHex: t < 0.5 ? a.bot : b.bot,
    night: a.night + (b.night - a.night) * t,
    warm: a.warm + (b.warm - a.warm) * t
  };
}

/** Make day / sunset / night variants of a transparent sprite via source-atop tinting. */
function tintVariants(sprite, nightColor = '#0b1640', nightAlpha = 0.62, warmColor = '#ff8a4a', warmAlpha = 0.28) {
  if (!sprite) return null;
  const make = (color, alpha) => {
    const c = makeCanvas(sprite.img.width, sprite.img.height);
    if (!c) return sprite;
    c.ctx.drawImage(sprite.img, 0, 0);
    c.ctx.globalCompositeOperation = 'source-atop';
    c.ctx.fillStyle = rgba(color, alpha);
    c.ctx.fillRect(0, 0, sprite.img.width, sprite.img.height);
    c.ctx.globalCompositeOperation = 'source-over';
    return { ...sprite, img: c.canvas };
  };
  return { day: sprite, night: make(nightColor, nightAlpha), warm: make(warmColor, warmAlpha) };
}

export class Background {
  constructor(viewW = 800, viewH = 450, groundY = 350) {
    this.viewW = viewW;
    this.viewH = viewH;
    this.groundY = groundY;
    this.scale = 1;
    this.dist = 0;
    this.time = 0;
    this.phase = 0.05;
    this.cycleSeconds = 150; // one full day/night loop of play time
    this.cache = null;
    this.sky = sampleSky(this.phase);

    const rand = seededRandom(4242);
    this.clouds = [];
    for (let i = 0; i < 7; i++) {
      this.clouds.push(this._newCloud(rand, rand() * (viewW + 250) - 120));
    }
    this.cloudRand = rand;

    this.fireflies = [];
    for (let i = 0; i < 16; i++) {
      this.fireflies.push({
        x: rand() * viewW,
        y: groundY - 10 - rand() * 120,
        ph: rand() * TAU,
        sp: 0.6 + rand() * 1.2,
        r: 10 + rand() * 8
      });
    }
    this.shooting = null;
  }

  _newCloud(rand, x) {
    const far = rand() < 0.5;
    return {
      x,
      y: 30 + rand() * (far ? 90 : 120),
      shape: Math.floor(rand() * 6),
      size: far ? 0.5 + rand() * 0.25 : 0.7 + rand() * 0.35,
      par: far ? 0.03 : 0.08,
      drift: far ? 6 + rand() * 5 : 12 + rand() * 10,
      far
    };
  }

  setScale(s) {
    const next = clamp(s, 1, 2);
    if (next !== this.scale) {
      this.scale = next;
      this.cache = null;
    }
  }

  reset() {
    this.phase = 0.05;
    this.sky = sampleSky(this.phase);
  }

  update(dt, speed, advanceTime) {
    this.time += dt;
    this.dist += speed * dt;
    if (advanceTime) this.phase = (this.phase + dt / this.cycleSeconds) % 1;
    this.sky = sampleSky(this.phase);

    for (const c of this.clouds) {
      c.x -= (c.drift + speed * c.par) * dt;
      if (c.x < -260 * c.size) {
        Object.assign(c, this._newCloud(this.cloudRand, this.viewW + 20 + this.cloudRand() * 200));
      }
    }

    for (const f of this.fireflies) {
      f.ph += dt * f.sp;
      f.x += (Math.cos(f.ph * 0.7) * 14 - speed * 0.25) * dt;
      f.y += Math.sin(f.ph) * 10 * dt;
      if (f.x < -20) f.x += this.viewW + 40;
      if (f.x > this.viewW + 20) f.x -= this.viewW + 40;
    }

    if (this.shooting) {
      const s = this.shooting;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (s.life <= 0) this.shooting = null;
    } else if (this.sky.night > 0.8 && Math.random() < dt * 0.12) {
      this.shooting = {
        x: 200 + Math.random() * 500, y: 20 + Math.random() * 80,
        vx: -380 - Math.random() * 200, vy: 140 + Math.random() * 80, life: 0.9
      };
    }
  }

  // ---------------------------------------------------------------- caches
  _ensureCache() {
    if (this.cache) return this.cache;
    const s = this.scale;
    const gy = this.groundY;
    const cache = {};

    cache.far = this._tile(1600, 130, gy - 130 + 2, s, (ctx, P, y0) => this._paintFarMountains(ctx, P, y0));
    cache.mid = this._tile(1200, 185, gy - 185 + 2, s, (ctx, P, y0) => this._paintMidMountains(ctx, P, y0));
    cache.windows = [];
    cache.hills = this._tile(1000, 230, gy - 230 + 4, s, (ctx, P, y0) => this._paintHills(ctx, P, y0, cache.windows));
    cache.lamps = [];
    cache.bushes = this._tile(800, 262, gy - 262 + 4, s, (ctx, P, y0) => this._paintBushes(ctx, P, y0, cache.lamps));
    cache.ground = this._tile(512, gy - 14, this.viewH - gy + 14 + 60, s, (ctx, P, y0) => this._paintGround(ctx, P, y0));

    cache.clouds = [];
    for (let i = 0; i < 6; i++) cache.clouds.push(tintVariants(this._buildCloud(i, s), '#1b2448', 0.7, '#ff9070', 0.35));

    cache.starsA = this._buildStars(1, s);
    cache.starsB = this._buildStars(2, s);
    cache.sunGlow = buildGlow(260, s, '#fff2b0', 0.9);
    cache.moonGlow = buildGlow(200, s, '#b8c8ff', 0.55);
    cache.warmGlow = buildGlow(64, s, '#ffd36b', 1);
    cache.fly = buildGlow(24, s, '#d8ff6a', 1);
    cache.vignette = this._buildVignette(s);
    this.cache = cache;
    return cache;
  }

  _tile(period, y0, h, scale, paint) {
    const sprite = buildSprite(period, h, scale, (ctx) => paint(ctx, period, y0));
    const v = tintVariants(sprite);
    if (!v) return null;
    return { ...v, period, y0, h };
  }

  _silhouette(ctx, P, y0, fn, bottom) {
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    for (let x = 0; x <= P; x += 6) ctx.lineTo(x, fn(x) - y0);
    ctx.lineTo(P, bottom);
    ctx.closePath();
  }

  _paintFarMountains(ctx, P, y0) {
    const rand = seededRandom(11);
    const w1 = periodicWave(P, rand);
    const w2 = periodicWave(P, rand, [[3, 1], [5, 0.6], [7, 0.4], [11, 0.25], [17, 0.12], [29, 0.05]]);
    const w3 = periodicWave(P, rand, [[9, 1], [19, 0.5], [37, 0.3]]);
    const top = (x) => 232 - 52 * w1(x) - 34 * (1 - 2 * Math.abs(w2(x)));
    const bottom = this.groundY - y0 + 2;

    const g = ctx.createLinearGradient(0, 140 - y0, 0, bottom);
    g.addColorStop(0, '#93aed3');
    g.addColorStop(1, '#bfd0e6');
    ctx.fillStyle = g;
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.fill();

    // Snow caps, clipped to the mountain shape
    ctx.save();
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.clip();
    const sg = ctx.createLinearGradient(0, 140 - y0, 0, 215 - y0);
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(1, '#dce7f6');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= P; x += 6) ctx.lineTo(x, 200 + 9 * w3(x) - y0);
    ctx.lineTo(P, 0);
    ctx.closePath();
    ctx.fill();
    // Shadowed ridge faces for depth
    ctx.fillStyle = 'rgba(70, 92, 140, 0.22)';
    this._silhouette(ctx, P, y0, (x) => top(x + 14) + 16 + 8 * w3(x), bottom);
    ctx.fill();
    ctx.restore();
  }

  _paintMidMountains(ctx, P, y0) {
    const rand = seededRandom(23);
    const w1 = periodicWave(P, rand);
    const w2 = periodicWave(P, rand, [[4, 1], [7, 0.5], [12, 0.3], [21, 0.12]]);
    const top = (x) => 270 - 34 * w1(x) - 16 * (1 - 2 * Math.abs(w2(x)));
    const bottom = this.groundY - y0 + 2;
    const g = ctx.createLinearGradient(0, 210 - y0, 0, bottom);
    g.addColorStop(0, '#6f92b4');
    g.addColorStop(1, '#93b2c9');
    ctx.fillStyle = g;
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.fill();

    // Distant forest texture along the ridge
    ctx.save();
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.clip();
    ctx.fillStyle = 'rgba(52, 86, 110, 0.35)';
    this._silhouette(ctx, P, y0, (x) => top(x) + 12 + 5 * w2(x * 3), bottom);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = 'rgba(58, 92, 116, 0.55)';
    for (let x = 4; x < P; x += 7 + rand() * 6) {
      const ty = top(x) - y0;
      const h = 5 + rand() * 6;
      wrapDraw(x, 6, P, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx - 2.5, ty + 2);
        ctx.lineTo(xx, ty - h);
        ctx.lineTo(xx + 2.5, ty + 2);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  _paintHills(ctx, P, y0, windows) {
    const rand = seededRandom(37);
    const w1 = periodicWave(P, rand, [[2, 1], [3, 0.6], [5, 0.3], [9, 0.12]]);
    const top = (x) => 306 - 20 * w1(x);
    const bottom = this.groundY - y0 + 4;

    const g = ctx.createLinearGradient(0, 280 - y0, 0, bottom);
    g.addColorStop(0, '#86c45e');
    g.addColorStop(1, '#4c8a37');
    ctx.fillStyle = g;
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.fill();

    // Field rows
    ctx.save();
    this._silhouette(ctx, P, y0, top, bottom);
    ctx.clip();
    ctx.strokeStyle = 'rgba(40, 90, 30, 0.12)';
    ctx.lineWidth = 2;
    for (let r = 0; r < 6; r++) {
      ctx.beginPath();
      for (let x = 0; x <= P; x += 10) {
        const yy = top(x) - y0 + 8 + r * 8;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.restore();

    // Cottages
    const houses = [130, 470, 820];
    for (const hx of houses) {
      const by = top(hx) - y0 + 3;
      const roof = ['#c2543b', '#a8452f', '#3f6ea8'][houses.indexOf(hx)];
      ctx.fillStyle = '#efe0c4';
      ctx.fillRect(hx - 10, by - 13, 20, 13);
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(hx + 4, by - 13, 6, 13);
      ctx.fillStyle = '#7a5a43';
      ctx.fillRect(hx + 4, by - 23, 3, 8);
      ctx.fillStyle = roof;
      ctx.beginPath();
      ctx.moveTo(hx - 13, by - 12);
      ctx.lineTo(hx, by - 22);
      ctx.lineTo(hx + 13, by - 12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#5d6f86';
      ctx.fillRect(hx - 7, by - 9, 4, 4);
      ctx.fillRect(hx + 2, by - 9, 4, 4);
      ctx.fillStyle = '#6b4a35';
      ctx.fillRect(hx - 2, by - 6, 3, 6);
      windows.push({ x: hx - 7, y: by - 9 + y0, w: 4, h: 4 }, { x: hx + 2, y: by - 9 + y0, w: 4, h: 4 });
    }

    // Trees
    let x = 10;
    while (x < P) {
      const nearHouse = houses.some((hx) => Math.abs(hx - x) < 20);
      if (!nearHouse) {
        const by = top(x) - y0 + 3;
        const kind = rand();
        const sc = 0.7 + rand() * 0.6;
        wrapDraw(x, 20, P, (xx) => this._tree(ctx, xx, by, kind, sc));
      }
      x += 14 + rand() * 46;
    }
  }

  _tree(ctx, x, by, kind, sc) {
    if (kind < 0.45) {
      // Pine
      ctx.fillStyle = '#5b3f2c';
      ctx.fillRect(x - 1.2 * sc, by - 6 * sc, 2.4 * sc, 6 * sc);
      const tiers = [['#2f6b34', 0], ['#3a7d3c', 7], ['#4a9046', 13]];
      for (const [col, off] of tiers) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(x - (10 - off * 0.45) * sc, by - (5 + off) * sc);
        ctx.lineTo(x, by - (20 + off) * sc);
        ctx.lineTo(x + (10 - off * 0.45) * sc, by - (5 + off) * sc);
        ctx.closePath();
        ctx.fill();
      }
    } else if (kind < 0.85) {
      // Round deciduous
      ctx.fillStyle = '#6a4a33';
      ctx.fillRect(x - 1.5 * sc, by - 10 * sc, 3 * sc, 10 * sc);
      ctx.fillStyle = '#3b7f37';
      circle(ctx, x, by - 16 * sc, 9 * sc);
      ctx.fill();
      circle(ctx, x - 6 * sc, by - 12 * sc, 6 * sc);
      ctx.fill();
      circle(ctx, x + 6 * sc, by - 12 * sc, 6.5 * sc);
      ctx.fill();
      ctx.fillStyle = '#5aa84c';
      circle(ctx, x - 3 * sc, by - 19 * sc, 4.5 * sc);
      ctx.fill();
    } else {
      // Poplar
      ctx.fillStyle = '#6a4a33';
      ctx.fillRect(x - 1 * sc, by - 6 * sc, 2 * sc, 6 * sc);
      ctx.fillStyle = '#356f33';
      ellipse(ctx, x, by - 17 * sc, 4.5 * sc, 13 * sc);
      ctx.fill();
      ctx.fillStyle = '#4f9645';
      ellipse(ctx, x - 1.5 * sc, by - 20 * sc, 2 * sc, 8 * sc);
      ctx.fill();
    }
  }

  _paintBushes(ctx, P, y0, lamps) {
    const rand = seededRandom(71);
    const base = this.groundY - y0 + 2;

    // Lamp posts (behind bushes)
    for (const lx of [210, 610]) {
      ctx.fillStyle = '#353a46';
      ctx.fillRect(lx - 1.5, base - 62, 3, 62);
      ctx.fillRect(lx - 4, base - 4, 8, 4);
      ctx.fillRect(lx - 1, base - 64, 9, 2.5);
      ctx.fillStyle = '#2a2e38';
      rrect(ctx, lx + 3, base - 63, 8, 9, 2);
      ctx.fill();
      ctx.fillStyle = '#f4e3a2';
      ctx.fillRect(lx + 4.5, base - 59, 5, 4);
      lamps.push({ x: lx + 7, y: base - 57 + y0 });
    }

    let x = 0;
    while (x < P) {
      const n = 3 + Math.floor(rand() * 4);
      const cx = x;
      const blobs = [];
      for (let i = 0; i < n; i++) {
        blobs.push({ dx: (i - n / 2) * (7 + rand() * 4), r: 8 + rand() * 11 });
      }
      const flowers = rand() < 0.5;
      const fcol = ['#ff6b8a', '#ffd84a', '#ffffff', '#c58bff'][Math.floor(rand() * 4)];
      const fpts = [];
      for (let i = 0; i < 6; i++) fpts.push([rand() * 2 - 1, rand()]);
      wrapDraw(cx, 60, P, (xx) => {
        for (const b of blobs) {
          ctx.fillStyle = '#2c6b2f';
          circle(ctx, xx + b.dx, base - b.r * 0.55, b.r);
          ctx.fill();
        }
        for (const b of blobs) {
          ctx.fillStyle = '#3f8a3c';
          circle(ctx, xx + b.dx - b.r * 0.2, base - b.r * 0.75, b.r * 0.72);
          ctx.fill();
          ctx.fillStyle = '#5fae50';
          circle(ctx, xx + b.dx - b.r * 0.35, base - b.r * 1.0, b.r * 0.35);
          ctx.fill();
        }
        if (flowers) {
          ctx.fillStyle = fcol;
          for (const [fx, fy] of fpts) {
            circle(ctx, xx + fx * n * 7, base - 6 - fy * 16, 1.6);
            ctx.fill();
          }
        }
      });
      x += 40 + rand() * 70;
    }

    // Tall grass tufts
    for (let gx = 0; gx < P; gx += 9 + rand() * 14) {
      const h = 6 + rand() * 10;
      const lean = (rand() - 0.5) * 6;
      wrapDraw(gx, 8, P, (xx) => {
        ctx.fillStyle = '#3f7f34';
        ctx.beginPath();
        ctx.moveTo(xx - 2, base);
        ctx.quadraticCurveTo(xx + lean * 0.3, base - h * 0.6, xx + lean, base - h);
        ctx.quadraticCurveTo(xx + lean * 0.2, base - h * 0.5, xx + 2, base);
        ctx.closePath();
        ctx.fill();
      });
    }
  }

  _paintGround(ctx, P, y0) {
    const rand = seededRandom(97);
    const top = this.groundY - y0; // local y of the running surface
    const H = this.viewH - y0 + 60;
    const edge = periodicWave(P, rand, [[4, 1], [9, 0.5], [16, 0.25]]);

    // Dirt body
    const dg = ctx.createLinearGradient(0, top, 0, H);
    dg.addColorStop(0, '#a8774a');
    dg.addColorStop(0.45, '#8a5c37');
    dg.addColorStop(1, '#5a3a24');
    ctx.fillStyle = dg;
    ctx.fillRect(0, top + 6, P, H - top);

    // Strata bands
    for (let i = 0; i < 4; i++) {
      const w = periodicWave(P, rand, [[2, 1], [5, 0.4], [11, 0.2]]);
      ctx.fillStyle = i % 2 ? 'rgba(255, 230, 190, 0.07)' : 'rgba(60, 30, 10, 0.12)';
      ctx.beginPath();
      ctx.moveTo(0, top + 28 + i * 18 + w(0) * 4);
      for (let x = 0; x <= P; x += 8) ctx.lineTo(x, top + 28 + i * 18 + w(x) * 4);
      for (let x = P; x >= 0; x -= 8) ctx.lineTo(x, top + 34 + i * 18 + w(x) * 4);
      ctx.closePath();
      ctx.fill();
    }

    // Pebbles
    for (let i = 0; i < 46; i++) {
      const px = rand() * P;
      const py = top + 20 + rand() * (H - top - 30);
      const r = 1.2 + rand() * 3.2;
      const shade = ['#6e4a30', '#7d5a3e', '#9b8571', '#5e3f2a'][Math.floor(rand() * 4)];
      wrapDraw(px, 6, P, (xx) => {
        ctx.fillStyle = shade;
        ellipse(ctx, xx, py, r * 1.3, r);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ellipse(ctx, xx - r * 0.35, py - r * 0.35, r * 0.5, r * 0.35);
        ctx.fill();
      });
    }

    // A buried fossil bone, because corgis
    ctx.save();
    ctx.translate(330, top + 62);
    ctx.rotate(-0.25);
    ctx.fillStyle = 'rgba(240, 220, 190, 0.28)';
    rrect(ctx, -10, -2, 20, 4, 2);
    ctx.fill();
    for (const [bx, by] of [[-10, -2.5], [-10, 2.5], [10, -2.5], [10, 2.5]]) {
      circle(ctx, bx, by, 3);
      ctx.fill();
    }
    ctx.restore();

    // Roots dangling under the turf
    ctx.strokeStyle = 'rgba(70, 45, 25, 0.45)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 18; i++) {
      const rx = rand() * P;
      const len = 5 + rand() * 9;
      wrapDraw(rx, 8, P, (xx) => {
        ctx.beginPath();
        ctx.moveTo(xx, top + 9);
        ctx.quadraticCurveTo(xx + 3, top + 9 + len * 0.6, xx - 1, top + 9 + len);
        ctx.stroke();
      });
    }

    // Turf band with a wavy underside
    const tg = ctx.createLinearGradient(0, top - 2, 0, top + 14);
    tg.addColorStop(0, '#8fd45a');
    tg.addColorStop(0.5, '#62ad3a');
    tg.addColorStop(1, '#3f8a2a');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(0, top - 1);
    ctx.lineTo(P, top - 1);
    for (let x = P; x >= 0; x -= 8) ctx.lineTo(x, top + 10 + edge(x) * 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, top - 1, P, 1.5);

    // Grass blades
    for (let x = 0; x < P; x += 2.2) {
      const h = 3 + rand() * 8;
      const lean = (rand() - 0.5) * 4;
      const col = ['#5aa634', '#6dba42', '#4b962c', '#82cc52'][Math.floor(rand() * 4)];
      wrapDraw(x, 6, P, (xx) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(xx - 1.2, top + 1);
        ctx.lineTo(xx + lean, top - h);
        ctx.lineTo(xx + 1.2, top + 1);
        ctx.closePath();
        ctx.fill();
      });
    }

    // Little flowers in the turf
    for (let i = 0; i < 9; i++) {
      const fx = rand() * P;
      const col = ['#ffffff', '#ffd94a', '#ff7aa0', '#9fc4ff'][Math.floor(rand() * 4)];
      wrapDraw(fx, 6, P, (xx) => {
        ctx.strokeStyle = '#3f8a2a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(xx, top + 1);
        ctx.lineTo(xx, top - 7);
        ctx.stroke();
        ctx.fillStyle = col;
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * TAU;
          circle(ctx, xx + Math.cos(a) * 2, top - 8 + Math.sin(a) * 2, 1.5);
          ctx.fill();
        }
        ctx.fillStyle = '#ffb627';
        circle(ctx, xx, top - 8, 1.1);
        ctx.fill();
      });
    }
  }

  _buildCloud(shape, scale) {
    const rand = seededRandom(500 + shape * 17);
    const W = 210;
    const H = 90;
    const puffs = [];
    const n = 5 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      puffs.push({
        x: 30 + t * 150 + (rand() - 0.5) * 14,
        y: 58 - Math.sin(t * Math.PI) * (16 + rand() * 14),
        r: 16 + Math.sin(t * Math.PI) * 16 + rand() * 6
      });
    }
    // Small puffs along the underside so the base reads round, not flat
    const base = [];
    for (let x = 34; x <= 176; x += 18) base.push({ x: x + (rand() - 0.5) * 6, r: 9 + rand() * 5 });
    return buildSprite(W, H, scale, (ctx) => {
      ctx.fillStyle = '#d3deef';
      for (const p of puffs) {
        circle(ctx, p.x, p.y + 4, p.r);
        ctx.fill();
      }
      for (const b of base) {
        circle(ctx, b.x, 64, b.r);
        ctx.fill();
      }
      ctx.fillStyle = '#ffffff';
      for (const p of puffs) {
        circle(ctx, p.x, p.y, p.r);
        ctx.fill();
      }
      for (const b of base) {
        circle(ctx, b.x, 60, b.r * 0.9);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (const p of puffs) {
        circle(ctx, p.x - p.r * 0.25, p.y - p.r * 0.3, p.r * 0.5);
        ctx.fill();
      }
    });
  }

  _buildStars(seed, scale) {
    const rand = seededRandom(900 + seed);
    return buildSprite(this.viewW, this.groundY - 60, scale, (ctx, w, h) => {
      for (let i = 0; i < 90; i++) {
        const x = rand() * w;
        const y = rand() * h * (0.4 + 0.6 * rand());
        const r = 0.4 + rand() * 1.1;
        ctx.fillStyle = rand() < 0.2 ? '#ffe6b0' : rand() < 0.3 ? '#bcd0ff' : '#ffffff';
        circle(ctx, x, y, r);
        ctx.fill();
        if (r > 1.25) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.fillRect(x - r * 3, y - 0.3, r * 6, 0.6);
          ctx.fillRect(x - 0.3, y - r * 3, 0.6, r * 6);
        }
      }
    });
  }

  _buildVignette(scale) {
    return buildSprite(this.viewW, this.viewH, Math.min(scale, 1), (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.45, h * 0.35, w / 2, h * 0.45, w * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(10,5,25,0.38)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
  }

  // ---------------------------------------------------------------- drawing
  _drawTile(ctx, tile, parallax) {
    if (!tile) return;
    const P = tile.period;
    const off = ((this.dist * parallax) % P + P) % P;
    const sky = this.sky;
    for (let x = -off; x < this.viewW; x += P) {
      ctx.drawImage(tile.day.img, x, tile.y0, P + 1, tile.h);
      if (sky.warm > 0.01) {
        ctx.globalAlpha = sky.warm;
        ctx.drawImage(tile.warm.img, x, tile.y0, P + 1, tile.h);
      }
      if (sky.night > 0.01) {
        ctx.globalAlpha = sky.night;
        ctx.drawImage(tile.night.img, x, tile.y0, P + 1, tile.h);
      }
      ctx.globalAlpha = 1;
    }
  }

  _haze(ctx, fromY, alpha) {
    const g = ctx.createLinearGradient(0, fromY, 0, this.groundY);
    g.addColorStop(0, rgba(this.sky.botHex, 0));
    g.addColorStop(1, rgba(this.sky.botHex, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, fromY, this.viewW, this.groundY - fromY);
  }

  _drawClouds(ctx, far, cache) {
    const sky = this.sky;
    for (const c of this.clouds) {
      if (c.far !== far) continue;
      const v = cache.clouds[c.shape];
      if (!v) continue;
      const w = 210 * c.size;
      const h = 90 * c.size;
      ctx.globalAlpha = far ? 0.75 : 0.95;
      ctx.drawImage(v.day.img, c.x, c.y, w, h);
      if (sky.warm > 0.01) {
        ctx.globalAlpha = sky.warm * (far ? 0.75 : 0.95);
        ctx.drawImage(v.warm.img, c.x, c.y, w, h);
      }
      if (sky.night > 0.01) {
        ctx.globalAlpha = sky.night * (far ? 0.75 : 0.95);
        ctx.drawImage(v.night.img, c.x, c.y, w, h);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Sky, celestial bodies, clouds, parallax scenery and the ground. */
  draw(ctx) {
    const cache = this._ensureCache();
    const sky = this.sky;
    const W = this.viewW;
    const gy = this.groundY;

    const g = ctx.createLinearGradient(0, 0, 0, gy);
    g.addColorStop(0, sky.top);
    g.addColorStop(0.55, sky.mid);
    g.addColorStop(1, sky.bot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, gy + 2);

    // Stars
    if (sky.night > 0.02 && cache.starsA) {
      ctx.globalAlpha = sky.night * (0.75 + 0.25 * Math.sin(this.time * 1.7));
      ctx.drawImage(cache.starsA.img, 0, 0, W, gy - 60);
      ctx.globalAlpha = sky.night * (0.75 + 0.25 * Math.cos(this.time * 2.3));
      ctx.drawImage(cache.starsB.img, 0, 0, W, gy - 60);
      ctx.globalAlpha = 1;
    }
    if (this.shooting) {
      const s = this.shooting;
      const sg = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * 0.18, s.y - s.vy * 0.18);
      sg.addColorStop(0, `rgba(255,255,255,${clamp(s.life, 0, 1)})`);
      sg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.strokeStyle = sg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x - s.vx * 0.18, s.y - s.vy * 0.18);
      ctx.stroke();
    }

    // Sun travels across during the day half; moon during the night half.
    const p = this.phase;
    const sunT = ((p + 0.1) % 1) / 0.68;
    if (sunT >= 0 && sunT <= 1) {
      const sx = 60 + sunT * (W - 120);
      const sy = 250 - Math.sin(sunT * Math.PI) * 195;
      if (cache.sunGlow) ctx.drawImage(cache.sunGlow.img, sx - 130, sy - 130, 260, 260);
      const sg = ctx.createRadialGradient(sx - 6, sy - 6, 2, sx, sy, 26);
      sg.addColorStop(0, '#fffbe6');
      sg.addColorStop(0.6, sky.warm > 0.3 ? '#ffc070' : '#fff1a8');
      sg.addColorStop(1, sky.warm > 0.3 ? '#ff9a50' : '#ffd860');
      ctx.fillStyle = sg;
      circle(ctx, sx, sy, 26);
      ctx.fill();
    }
    const moonT = (p - 0.54) / 0.44;
    if (moonT >= 0 && moonT <= 1) {
      const mx = 60 + moonT * (W - 120);
      const my = 240 - Math.sin(moonT * Math.PI) * 180;
      if (cache.moonGlow) ctx.drawImage(cache.moonGlow.img, mx - 100, my - 100, 200, 200);
      ctx.fillStyle = '#f3f0dc';
      circle(ctx, mx, my, 20);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 160, 140, 0.35)';
      circle(ctx, mx - 6, my - 4, 5);
      ctx.fill();
      circle(ctx, mx + 7, my + 6, 3.5);
      ctx.fill();
      circle(ctx, mx + 3, my - 9, 2.5);
      ctx.fill();
    }

    this._drawClouds(ctx, true, cache);
    this._drawTile(ctx, cache.far, 0.05);
    this._haze(ctx, 190, 0.45);
    this._drawTile(ctx, cache.mid, 0.14);
    this._drawClouds(ctx, false, cache);
    this._haze(ctx, 240, 0.3);
    this._drawTile(ctx, cache.hills, 0.3);
    this._drawTile(ctx, cache.bushes, 0.6);

    // Lit windows and street lamps once it gets dark
    if (sky.night > 0.25) {
      const a = clamp((sky.night - 0.25) / 0.5, 0, 1);
      this._drawLights(ctx, cache, a);
    }

    this._drawTile(ctx, cache.ground, 1);
  }

  _drawLights(ctx, cache, a) {
    const hillP = cache.hills ? cache.hills.period : 1000;
    const hOff = ((this.dist * 0.3) % hillP + hillP) % hillP;
    for (let base = -hOff; base < this.viewW; base += hillP) {
      for (const win of cache.windows) {
        const x = base + win.x;
        if (x < -10 || x > this.viewW + 10) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#ffd877';
        ctx.fillRect(x, win.y, win.w, win.h);
        ctx.globalAlpha = a * 0.6;
        if (cache.warmGlow) ctx.drawImage(cache.warmGlow.img, x + win.w / 2 - 9, win.y + win.h / 2 - 9, 18, 18);
      }
    }
    const bushP = cache.bushes ? cache.bushes.period : 800;
    const bOff = ((this.dist * 0.6) % bushP + bushP) % bushP;
    for (let base = -bOff; base < this.viewW; base += bushP) {
      for (const lamp of cache.lamps) {
        const x = base + lamp.x;
        if (x < -60 || x > this.viewW + 60) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff4c2';
        ctx.fillRect(x - 2.5, lamp.y - 2, 5, 4);
        ctx.globalAlpha = a * 0.85;
        if (cache.warmGlow) ctx.drawImage(cache.warmGlow.img, x - 45, lamp.y - 40, 90, 90);
      }
    }
    ctx.globalAlpha = 1;
  }

  /** Night/sunset grade applied over gameplay sprites so they match the scene. */
  drawGrade(ctx) {
    const sky = this.sky;
    if (sky.night > 0.01) {
      ctx.fillStyle = rgba('#0a1238', sky.night * 0.3);
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
    if (sky.warm > 0.01) {
      ctx.fillStyle = rgba('#ff7a45', sky.warm * 0.08);
      ctx.fillRect(0, 0, this.viewW, this.viewH);
    }
  }

  drawFireflies(ctx) {
    const cache = this._ensureCache();
    const a = clamp((this.sky.night - 0.4) / 0.4, 0, 1);
    if (a <= 0 || !cache.fly) return;
    for (const f of this.fireflies) {
      ctx.globalAlpha = a * (0.45 + 0.55 * Math.max(0, Math.sin(f.ph * 2.2)));
      ctx.drawImage(cache.fly.img, f.x - f.r, f.y - f.r, f.r * 2, f.r * 2);
    }
    ctx.globalAlpha = 1;
  }

  drawVignette(ctx) {
    const cache = this._ensureCache();
    if (cache.vignette) ctx.drawImage(cache.vignette.img, 0, 0, this.viewW, this.viewH);
  }
}
