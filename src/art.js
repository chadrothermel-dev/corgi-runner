// Shared drawing helpers: offscreen sprite caching, seeded randomness,
// seamless (periodic) terrain waves, and color math.

export const TAU = Math.PI * 2;

/** Create an offscreen canvas; returns null when no DOM/canvas is available. */
export function makeCanvas(w, h) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(w));
  canvas.height = Math.max(1, Math.ceil(h));
  const ctx = canvas.getContext ? canvas.getContext('2d') : null;
  if (!ctx) return null;
  return { canvas, ctx };
}

/**
 * Render a sprite once at the given pixel scale. drawFn works in logical units.
 * `pad` adds room around the logical box for outlines that overhang it.
 */
export function buildSprite(w, h, scale, drawFn, pad = 0) {
  const s = makeCanvas((w + pad * 2) * scale, (h + pad * 2) * scale);
  if (!s) return null;
  s.ctx.scale(scale, scale);
  s.ctx.translate(pad, pad);
  drawFn(s.ctx, w, h);
  return { img: s.canvas, w, h, pad };
}

/** Draw a sprite so that its logical box (excluding pad) lands at x,y. */
export function drawSprite(ctx, sprite, x, y, w = sprite.w, h = sprite.h) {
  if (!sprite) return;
  const kx = w / sprite.w;
  const ky = h / sprite.h;
  ctx.drawImage(
    sprite.img,
    x - sprite.pad * kx,
    y - sprite.pad * ky,
    (sprite.w + sprite.pad * 2) * kx,
    (sprite.h + sprite.pad * 2) * ky
  );
}

/** Rounded-rectangle path (uses quadratic curves for broad canvas support). */
export function rrect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

export function ellipse(ctx, x, y, rx, ry, rot = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU);
}

export function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.01, r), 0, TAU);
}

/** Deterministic PRNG (mulberry32) so procedural scenery is stable. */
export function seededRandom(seed) {
  let s = seed >>> 0;
  return function rand() {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sum of sines with integer frequencies over `period`, so f(x) === f(x + period).
 * That makes scrolling terrain tiles loop with no visible seam. Output ~[-1, 1].
 */
export function periodicWave(period, rand, harmonics = [[1, 1], [2, 0.55], [3, 0.35], [5, 0.18], [8, 0.1], [13, 0.05]]) {
  const comps = harmonics.map(([k, a]) => ({ k, a, p: rand() * TAU }));
  const norm = comps.reduce((sum, c) => sum + c.a, 0);
  return (x) => {
    let v = 0;
    for (const c of comps) v += c.a * Math.sin((TAU * c.k * x) / period + c.p);
    return v / norm;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mixColor(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `rgb(${r},${g},${bl})`;
}

export function rgba(hex, a) {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Draw fn at x, plus wrapped copies when it would cross a tile edge. */
export function wrapDraw(x, reach, period, fn) {
  fn(x);
  if (x < reach) fn(x + period);
  if (x > period - reach) fn(x - period);
}

/** Soft radial glow sprite (used for lamps, fireflies, sun and treats). */
export function buildGlow(size, scale, color, strength = 1) {
  return buildSprite(size, size, scale, (ctx) => {
    const r = size / 2;
    const g = ctx.createRadialGradient(r, r, 0, r, r, r);
    g.addColorStop(0, rgba(color, 0.9 * strength));
    g.addColorStop(0.35, rgba(color, 0.35 * strength));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  });
}

/** Soft elliptical contact shadow. */
export function buildShadow(scale) {
  return buildSprite(64, 16, scale, (ctx) => {
    ctx.save();
    ctx.scale(1, 0.25);
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(20,12,30,0.55)');
    g.addColorStop(0.6, 'rgba(20,12,30,0.25)');
    g.addColorStop(1, 'rgba(20,12,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    ctx.restore();
  });
}
