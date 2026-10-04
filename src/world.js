/**
 * Background world: sky, sun/moon/stars, parallax layers and ground.
 * Static layers are pre-rendered once into seamless offscreen tiles, so each
 * frame is just a handful of drawImage calls.
 */
const TW = 1200; // tile width (must exceed the 800px view)
const RES = 2; // tile render scale for crisp hi-dpi output

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeLayer(w, h) {
  if (typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(w * RES);
    canvas.height = Math.ceil(h * RES);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(RES, RES);
    return { canvas, ctx, w, h };
  } catch (e) {
    return null;
  }
}

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

// Time-of-day keyframes: t in [0,1)
const SKY = [
  { t: 0.0, top: '#3F95E6', mid: '#86C8F2', bot: '#D9F1FB', tint: '#000000', tintA: 0, stars: 0 },
  { t: 0.36, top: '#3F95E6', mid: '#86C8F2', bot: '#D9F1FB', tint: '#000000', tintA: 0, stars: 0 },
  { t: 0.46, top: '#39488F', mid: '#E2786B', bot: '#FFC27A', tint: '#FF7A3C', tintA: 0.14, stars: 0.15 },
  { t: 0.56, top: '#0A0F2E', mid: '#1A2557', bot: '#33467A', tint: '#0D1446', tintA: 0.5, stars: 1 },
  { t: 0.86, top: '#0A0F2E', mid: '#1A2557', bot: '#33467A', tint: '#0D1446', tintA: 0.5, stars: 1 },
  { t: 0.95, top: '#5469B4', mid: '#F0A29C', bot: '#FFE1B3', tint: '#FF9F80', tintA: 0.12, stars: 0.1 },
  { t: 1.0, top: '#3F95E6', mid: '#86C8F2', bot: '#D9F1FB', tint: '#000000', tintA: 0, stars: 0 }
];

export class World {
  constructor(width = 800, height = 450, groundY = 350) {
    this.w = width;
    this.h = height;
    this.groundY = groundY;
    this.scroll = 0;
    this.time = 0;
    this.dayT = 0.12;

    const rand = mulberry32(1337);
    this.stars = Array.from({ length: 90 }, () => ({
      x: rand() * width,
      y: rand() * (groundY - 110),
      r: rand() * 1.3 + 0.4,
      tw: rand() * Math.PI * 2
    }));
    this.clouds = Array.from({ length: 7 }, (_, i) => ({
      x: rand() * TW,
      y: 30 + rand() * 120,
      s: 0.55 + rand() * 0.7,
      sprite: i % 4
    }));
    this.fireflies = Array.from({ length: 16 }, () => ({
      x: rand() * width,
      y: groundY - 20 - rand() * 120,
      ph: rand() * Math.PI * 2,
      sp: 0.5 + rand()
    }));

    this.lamps = [];
    this.layers = null;
    this.build(rand);
  }

  // ------------------------------------------------------------------
  // Pre-rendering
  // ------------------------------------------------------------------

  build(rand) {
    const far = this.buildMountains(rand, {
      top: 120, color: '#A9BFDC', haze: '#D3E1F0', base: 175, amp: 105, snow: true, seed: 1
    });
    const mid = this.buildMountains(rand, {
      top: 180, color: '#7FA6B8', haze: '#B8D2DA', base: 110, amp: 75, snow: false, seed: 2, trees: '#6A93A6'
    });
    const hills = this.buildHills(rand);
    const park = this.buildPark(rand);
    const ground = this.buildGround(rand);
    const clouds = [0, 1, 2, 3].map((i) => this.buildCloud(mulberry32(90 + i)));
    const vignette = this.buildVignette();

    this.layers = { far, mid, hills, park, ground, clouds, vignette };
  }

  buildMountains(rand, { top, color, haze, base, amp, snow, seed, trees }) {
    const bottom = this.groundY + 4;
    const L = makeLayer(TW, bottom - top);
    if (!L) return null;
    const { ctx } = L;
    const r = mulberry32(seed * 101);
    const terms = [
      [2, 0.55, r() * 6], [3, 0.35, r() * 6], [5, 0.22, r() * 6], [9, 0.12, r() * 6], [17, 0.05, r() * 6]
    ];
    const heightAt = (x) => {
      let v = 0;
      for (const [k, a, p] of terms) v += a * Math.pow(1 - Math.abs(Math.sin((Math.PI * k * x) / TW + p)), 1.6);
      return v;
    };
    const yAt = (x) => this.groundY - top - (base * 0.35 + heightAt(x) * amp);

    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, L.h);
      for (let x = 0; x <= TW; x += 4) ctx.lineTo(x, yAt(x));
      ctx.lineTo(TW, L.h);
      ctx.closePath();
    };

    const g = ctx.createLinearGradient(0, 0, 0, L.h);
    g.addColorStop(0, color);
    g.addColorStop(1, haze);
    path();
    ctx.fillStyle = g;
    ctx.fill();

    // Light/shadow facets: darken where slope descends to the right
    ctx.save();
    path();
    ctx.clip();
    ctx.fillStyle = 'rgba(30, 50, 90, 0.12)';
    ctx.beginPath();
    for (let x = 0; x < TW; x += 4) {
      const slope = yAt(x + 4) - yAt(x);
      if (slope > 0.4) ctx.rect(x, yAt(x), 4.5, L.h);
    }
    ctx.fill();

    if (snow) {
      const snowLine = this.groundY - top - base * 0.35 - amp * 0.62;
      ctx.fillStyle = '#F4F8FF';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= TW; x += 10) {
        ctx.lineTo(x, snowLine + Math.sin(x * 0.21) * 5 + Math.sin(x * 0.057) * 6);
      }
      ctx.lineTo(TW, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    if (trees) {
      ctx.fillStyle = trees;
      for (let x = 0; x < TW; x += 7 + r() * 9) {
        const y = yAt(x);
        const th = 6 + r() * 7;
        ctx.beginPath();
        ctx.moveTo(x - th * 0.35, y + 3);
        ctx.lineTo(x, y - th);
        ctx.lineTo(x + th * 0.35, y + 3);
        ctx.closePath();
        ctx.fill();
      }
    }
    return { ...L, top };
  }

  buildHills(rand) {
    const top = 225;
    const bottom = this.groundY + 4;
    const L = makeLayer(TW, bottom - top);
    if (!L) return null;
    const { ctx } = L;
    const r = mulberry32(77);
    const p1 = r() * 6;
    const p2 = r() * 6;
    const p3 = r() * 6;
    const yAt = (x) =>
      this.groundY - top - 52 -
      Math.sin((2 * Math.PI * 2 * x) / TW + p1) * 16 -
      Math.sin((2 * Math.PI * 5 * x) / TW + p2) * 10 -
      Math.sin((2 * Math.PI * 11 * x) / TW + p3) * 4;

    const path = () => {
      ctx.beginPath();
      ctx.moveTo(0, L.h);
      for (let x = 0; x <= TW; x += 4) ctx.lineTo(x, yAt(x));
      ctx.lineTo(TW, L.h);
      ctx.closePath();
    };

    // Trees behind the ridge first
    const trees = [];
    for (let x = 0; x < TW; x += 22 + r() * 46) trees.push({ x, kind: r() < 0.55 ? 'pine' : 'round', s: 0.8 + r() * 0.6 });
    const drawTree = (t, dx) => {
      const x = t.x + dx;
      const y = yAt(((t.x % TW) + TW) % TW) + 6;
      const s = t.s;
      if (t.kind === 'pine') {
        ctx.fillStyle = '#2F6E47';
        for (let i = 0; i < 3; i++) {
          const ty = y - 10 * s - i * 9 * s;
          const tw = (13 - i * 3) * s;
          ctx.beginPath();
          ctx.moveTo(x - tw, ty + 8 * s);
          ctx.lineTo(x, ty - 8 * s);
          ctx.lineTo(x + tw, ty + 8 * s);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(160, 220, 140, 0.25)';
        ctx.beginPath();
        ctx.moveTo(x - 2, y - 36 * s);
        ctx.lineTo(x - 9 * s, y - 14 * s);
        ctx.lineTo(x - 2, y - 16 * s);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle = '#6B4A33';
        ctx.fillRect(x - 2 * s, y - 14 * s, 4 * s, 14 * s);
        ctx.fillStyle = '#3F8A4E';
        ctx.beginPath();
        ctx.arc(x, y - 22 * s, 11 * s, 0, Math.PI * 2);
        ctx.arc(x - 8 * s, y - 16 * s, 8 * s, 0, Math.PI * 2);
        ctx.arc(x + 8 * s, y - 16 * s, 8 * s, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(170, 230, 140, 0.35)';
        ctx.beginPath();
        ctx.arc(x - 4 * s, y - 26 * s, 5 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (const t of trees) for (const dx of [-TW, 0, TW]) drawTree(t, dx);

    const g = ctx.createLinearGradient(0, 0, 0, L.h);
    g.addColorStop(0, '#7CC163');
    g.addColorStop(1, '#4C9152');
    path();
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#A8DE7E';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x <= TW; x += 4) (x === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, x, yAt(x) + 1);
    ctx.stroke();

    // Meadow flowers
    for (let i = 0; i < 140; i++) {
      const x = r() * TW;
      const y = yAt(x) + 8 + r() * (L.h - yAt(x) - 12);
      ctx.fillStyle = ['#FFFFFF', '#FFE066', '#FF9FB2'][i % 3];
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.arc(x, y, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    return { ...L, top };
  }

  buildPark(rand) {
    const top = 248;
    const bottom = this.groundY + 4;
    const L = makeLayer(TW, bottom - top);
    if (!L) return null;
    const { ctx } = L;
    const r = mulberry32(4242);
    const gy = this.groundY - top; // ground line in layer coords

    // Lamp posts (behind fence)
    this.lamps = [];
    for (let x = 140; x < TW; x += 300) this.lamps.push(x);
    for (const lx of this.lamps) {
      ctx.fillStyle = '#2E3440';
      ctx.fillRect(lx - 2, gy - 72, 4, 72);
      ctx.fillRect(lx - 5, gy - 6, 10, 6);
      ctx.beginPath();
      rr(ctx, lx - 7, gy - 84, 14, 13, 3);
      ctx.fill();
      ctx.fillStyle = '#FFE7A3';
      ctx.fillRect(lx - 4.5, gy - 81, 9, 8);
      ctx.fillStyle = '#2E3440';
      ctx.beginPath();
      ctx.moveTo(lx - 9, gy - 84);
      ctx.lineTo(lx, gy - 92);
      ctx.lineTo(lx + 9, gy - 84);
      ctx.closePath();
      ctx.fill();
    }

    // Picket fence
    const railY1 = gy - 26;
    const railY2 = gy - 12;
    ctx.fillStyle = '#E3D9C9';
    ctx.fillRect(0, railY1, TW, 4);
    ctx.fillRect(0, railY2, TW, 4);
    for (let x = 0; x < TW; x += 20) {
      ctx.fillStyle = '#F7F1E6';
      ctx.beginPath();
      ctx.moveTo(x + 3, gy);
      ctx.lineTo(x + 3, gy - 32);
      ctx.lineTo(x + 8, gy - 38);
      ctx.lineTo(x + 13, gy - 32);
      ctx.lineTo(x + 13, gy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(150, 130, 110, 0.35)';
      ctx.fillRect(x + 10.5, gy - 32, 2.5, 32);
    }

    // Bushes in front of the fence
    const bushes = [];
    for (let x = 20; x < TW; x += 70 + r() * 140) bushes.push({ x, s: 0.7 + r() * 0.6 });
    const drawBush = (b, dx) => {
      const x = b.x + dx;
      const s = b.s;
      const blobs = [[-14, -9, 11], [0, -15, 14], [14, -9, 11], [-6, -5, 10], [8, -5, 10]];
      ctx.fillStyle = '#3B8044';
      ctx.beginPath();
      for (const [ox, oy, rad] of blobs) {
        ctx.moveTo(x + ox * s + rad * s, gy + oy * s);
        ctx.arc(x + ox * s, gy + oy * s, rad * s, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = '#5FAE52';
      ctx.beginPath();
      for (const [ox, oy, rad] of blobs) {
        ctx.moveTo(x + ox * s - 2 * s + rad * 0.7 * s, gy + oy * s - 3 * s);
        ctx.arc(x + ox * s - 2 * s, gy + oy * s - 3 * s, rad * 0.7 * s, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(x - 4 * s, gy - 22 * s, 4 * s, 0, Math.PI * 2);
      ctx.fill();
    };
    for (const b of bushes) for (const dx of [-TW, 0, TW]) drawBush(b, dx);
    return { ...L, top };
  }

  buildGround(rand) {
    const top = this.groundY - 8;
    const L = makeLayer(TW, this.h - top + 2);
    if (!L) return null;
    const { ctx } = L;
    const r = mulberry32(999);
    const gy = 8; // ground line in layer coords

    // Dirt path
    const dirt = ctx.createLinearGradient(0, gy, 0, L.h);
    dirt.addColorStop(0, '#D9AE73');
    dirt.addColorStop(1, '#A67543');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, gy + 10, TW, L.h);

    // Path texture stripes
    ctx.fillStyle = 'rgba(255, 240, 210, 0.22)';
    for (let x = 0; x < TW; x += 60) ctx.fillRect(x + r() * 20, gy + 34 + r() * 6, 24 + r() * 20, 2);
    ctx.fillStyle = 'rgba(120, 70, 30, 0.18)';
    for (let x = 0; x < TW; x += 45) ctx.fillRect(x + r() * 20, gy + 58 + r() * 20, 18 + r() * 24, 2);

    // Pebbles
    for (let i = 0; i < 70; i++) {
      const x = r() * TW;
      const y = gy + 22 + r() * (L.h - gy - 28);
      const s = 1.5 + r() * 3;
      ctx.fillStyle = '#9C6E40';
      ctx.beginPath();
      ctx.ellipse(x, y, s * 1.4, s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 235, 200, 0.5)';
      ctx.beginPath();
      ctx.ellipse(x - s * 0.3, y - s * 0.35, s * 0.6, s * 0.35, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Grass band
    const grass = ctx.createLinearGradient(0, gy - 4, 0, gy + 14);
    grass.addColorStop(0, '#8FD95F');
    grass.addColorStop(0.5, '#6CBF4A');
    grass.addColorStop(1, '#4E9A3A');
    ctx.fillStyle = grass;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    for (let x = 0; x <= TW; x += 10) ctx.lineTo(x, gy - 1.5 + Math.sin(x * 0.3) * 1.5);
    ctx.lineTo(TW, gy + 12);
    for (let x = TW; x >= 0; x -= 8) ctx.lineTo(x, gy + 12 + (Math.sin(x * 0.7) > 0 ? 3 : 0));
    ctx.closePath();
    ctx.fill();

    // Grass blades
    for (let x = 0; x < TW; x += 5) {
      const h = 3 + r() * 6;
      ctx.fillStyle = r() < 0.5 ? '#5DB043' : '#86D35A';
      ctx.beginPath();
      ctx.moveTo(x, gy + 2);
      ctx.lineTo(x + 1.5 + r() * 2, gy - h);
      ctx.lineTo(x + 3, gy + 2);
      ctx.closePath();
      ctx.fill();
    }
    return { ...L, top };
  }

  buildCloud(r) {
    const L = makeLayer(180, 80);
    if (!L) return null;
    const { ctx } = L;
    const blobs = [];
    const n = 5 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      blobs.push([25 + t * 130, 50 - Math.sin(t * Math.PI) * (14 + r() * 10), 16 + Math.sin(t * Math.PI) * 14 + r() * 6]);
    }
    const g = ctx.createLinearGradient(0, 15, 0, 72);
    g.addColorStop(0, '#FFFFFF');
    g.addColorStop(0.6, '#F4F8FD');
    g.addColorStop(1, '#D3DFEE');
    ctx.fillStyle = g;
    ctx.beginPath();
    for (const [x, y, rad] of blobs) {
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.rect(25, 50, 130, 18);
    ctx.fill();
    return L;
  }

  buildVignette() {
    const L = makeLayer(this.w, this.h);
    if (!L) return null;
    const { ctx } = L;
    const g = ctx.createRadialGradient(this.w / 2, this.h * 0.45, this.h * 0.35, this.w / 2, this.h * 0.45, this.w * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(10,5,30,0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    return L;
  }

  // ------------------------------------------------------------------
  // Simulation
  // ------------------------------------------------------------------

  update(dt, speed, dayT) {
    this.time += dt;
    this.scroll += speed * dt;
    if (typeof dayT === 'number') this.dayT = ((dayT % 1) + 1) % 1;
  }

  palette() {
    const t = this.dayT;
    let a = SKY[0];
    let b = SKY[SKY.length - 1];
    for (let i = 0; i < SKY.length - 1; i++) {
      if (t >= SKY[i].t && t <= SKY[i + 1].t) {
        a = SKY[i];
        b = SKY[i + 1];
        break;
      }
    }
    const k = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
    const s = k * k * (3 - 2 * k);
    return {
      top: mix(hex(a.top), hex(b.top), s),
      mid: mix(hex(a.mid), hex(b.mid), s),
      bot: mix(hex(a.bot), hex(b.bot), s),
      tint: mix(hex(a.tint), hex(b.tint), s),
      tintA: a.tintA + (b.tintA - a.tintA) * s,
      stars: a.stars + (b.stars - a.stars) * s
    };
  }

  /** Night factor 0..1 for gameplay overlays (lamps, fireflies). */
  get night() {
    return this.palette().stars;
  }

  // ------------------------------------------------------------------
  // Rendering
  // ------------------------------------------------------------------

  drawTile(ctx, layer, factor) {
    if (!layer) return;
    const off = (((this.scroll * factor) % TW) + TW) % TW;
    ctx.drawImage(layer.canvas, -off, layer.top, TW, layer.h);
    ctx.drawImage(layer.canvas, -off + TW, layer.top, TW, layer.h);
  }

  /**
   * Draws the full backdrop. Layers are drawn first, tinted for the time of
   * day with 'source-atop', then the sky is composited *behind* them so the
   * moon and stars stay bright at night.
   */
  draw(ctx) {
    const P = this.palette();
    const L = this.layers || {};

    // Clouds
    for (const c of this.clouds) {
      const sprite = L.clouds && L.clouds[c.sprite];
      if (!sprite) continue;
      const span = TW + 200;
      const x = ((((c.x - this.scroll * 0.04 * c.s - this.time * 6 * c.s) % span) + span) % span) - 200;
      ctx.drawImage(sprite.canvas, x, c.y, sprite.w * c.s, sprite.h * c.s);
    }

    this.drawTile(ctx, L.far, 0.05);
    this.drawTile(ctx, L.mid, 0.14);
    this.drawTile(ctx, L.hills, 0.3);
    this.drawTile(ctx, L.park, 0.6);
    this.drawTile(ctx, L.ground, 1.0);

    // Fallback ground if tiles unavailable
    if (!L.ground) {
      ctx.fillStyle = '#6CBF4A';
      ctx.fillRect(0, this.groundY, this.w, 12);
      ctx.fillStyle = '#C99A63';
      ctx.fillRect(0, this.groundY + 12, this.w, this.h - this.groundY);
    }

    // Time-of-day tint on everything drawn so far
    if (P.tintA > 0.001) {
      ctx.save();
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = rgb(P.tint, P.tintA);
      ctx.fillRect(-40, -40, this.w + 80, this.h + 80);
      ctx.restore();
    }

    // Sky behind
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    this.drawCelestial(ctx, P);
    const g = ctx.createLinearGradient(0, 0, 0, this.groundY);
    g.addColorStop(0, rgb(P.top));
    g.addColorStop(0.6, rgb(P.mid));
    g.addColorStop(1, rgb(P.bot));
    ctx.fillStyle = g;
    ctx.fillRect(-40, -40, this.w + 80, this.h + 80);
    ctx.restore();

    this.drawNightLights(ctx, P.stars);
  }

  drawCelestial(ctx, P) {
    const t = this.dayT;
    // Note: with destination-over, things drawn first end up on top.
    const sunP = (t + 0.08) / 0.56;
    if (sunP > 0 && sunP < 1) {
      const x = 90 + sunP * 640;
      const y = 300 - Math.sin(sunP * Math.PI) * 220;
      ctx.fillStyle = '#FFF6CF';
      ctx.beginPath();
      ctx.arc(x, y, 24, 0, Math.PI * 2);
      ctx.fill();
      const glow = ctx.createRadialGradient(x, y, 20, x, y, 110);
      glow.addColorStop(0, 'rgba(255, 236, 160, 0.75)');
      glow.addColorStop(1, 'rgba(255, 220, 140, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 110, 0, Math.PI * 2);
      ctx.fill();
    }

    const moonP = (t - 0.47) / 0.48;
    if (moonP > 0 && moonP < 1) {
      const x = 120 + moonP * 560;
      const y = 280 - Math.sin(moonP * Math.PI) * 200;
      ctx.fillStyle = 'rgba(205, 200, 180, 0.9)';
      for (const [ox, oy, cr] of [[-6, -5, 4], [7, 3, 5], [-2, 9, 2.5]]) {
        ctx.beginPath();
        ctx.arc(x + ox, y + oy, cr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#F5F1DE';
      ctx.beginPath();
      ctx.arc(x, y, 20, 0, Math.PI * 2);
      ctx.fill();
      const glow = ctx.createRadialGradient(x, y, 18, x, y, 80);
      glow.addColorStop(0, 'rgba(220, 230, 255, 0.35)');
      glow.addColorStop(1, 'rgba(200, 210, 255, 0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, Math.PI * 2);
      ctx.fill();
    }

    if (P.stars > 0.01) {
      ctx.fillStyle = '#FFFFFF';
      for (const s of this.stars) {
        const tw = 0.55 + Math.sin(this.time * 2.2 + s.tw) * 0.45;
        ctx.globalAlpha = P.stars * tw;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  drawNightLights(ctx, night) {
    if (night < 0.05) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Lamp glows (park layer parallax 0.6)
    const park = this.layers && this.layers.park;
    if (park) {
      const off = (((this.scroll * 0.6) % TW) + TW) % TW;
      for (const lx of this.lamps) {
        for (const dx of [0, TW]) {
          const x = lx - off + dx;
          if (x < -80 || x > this.w + 80) continue;
          const y = park.top + (this.groundY - park.top) - 77;
          const g = ctx.createRadialGradient(x, y, 2, x, y, 70);
          g.addColorStop(0, `rgba(255, 220, 140, ${0.55 * night})`);
          g.addColorStop(1, 'rgba(255, 200, 120, 0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(x, y, 70, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Fireflies
    for (const f of this.fireflies) {
      const x = (((f.x - this.scroll * 0.5 + Math.sin(this.time * f.sp + f.ph) * 20) % (this.w + 40)) + this.w + 40) % (this.w + 40) - 20;
      const y = f.y + Math.sin(this.time * f.sp * 1.3 + f.ph) * 10;
      const blink = Math.max(0, Math.sin(this.time * 2.5 * f.sp + f.ph));
      const a = night * blink;
      if (a < 0.02) continue;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 9);
      g.addColorStop(0, `rgba(220, 255, 140, ${a})`);
      g.addColorStop(1, 'rgba(200, 255, 120, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawVignette(ctx) {
    const v = this.layers && this.layers.vignette;
    if (v) ctx.drawImage(v.canvas, 0, 0, this.w, this.h);
  }
}

function rr(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}
