/**
 * Headless Canvas 2D Context and DOM environment mock for Node test execution.
 */

export class MockCanvasRenderingContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.imageSmoothingEnabled = true;
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this.calls = [];
  }

  clearRect(x, y, w, h) {
    this.calls.push({ method: 'clearRect', args: [x, y, w, h] });
  }

  fillRect(x, y, w, h) {
    this.calls.push({ method: 'fillRect', args: [x, y, w, h] });
  }

  strokeRect(x, y, w, h) {
    this.calls.push({ method: 'strokeRect', args: [x, y, w, h] });
  }

  drawImage(...args) {
    this.calls.push({ method: 'drawImage', args });
  }

  beginPath() {
    this.calls.push({ method: 'beginPath', args: [] });
  }

  closePath() {
    this.calls.push({ method: 'closePath', args: [] });
  }

  fill() {
    this.calls.push({ method: 'fill', args: [] });
  }

  stroke() {
    this.calls.push({ method: 'stroke', args: [] });
  }

  clearCallHistory() {
    this.calls = [];
  }
}

export class MockCanvas {
  constructor(width = 800, height = 450) {
    this.width = width;
    this.height = height;
    this.context = new MockCanvasRenderingContext2D(this);
  }

  getContext(type) {
    if (type === '2d') {
      return this.context;
    }
    return null;
  }
}

const animationCallbacks = new Map();
let nextCallbackId = 1;

export function setupCanvasMock() {
  if (typeof globalThis.requestAnimationFrame === 'undefined') {
    globalThis.requestAnimationFrame = (callback) => {
      const id = nextCallbackId++;
      animationCallbacks.set(id, callback);
      return id;
    };
  }

  if (typeof globalThis.cancelAnimationFrame === 'undefined') {
    globalThis.cancelAnimationFrame = (id) => {
      animationCallbacks.delete(id);
    };
  }

  if (typeof globalThis.HTMLCanvasElement === 'undefined') {
    globalThis.HTMLCanvasElement = MockCanvas;
  }
}

/**
 * Manually advances one animation frame for controlled deterministic testing.
 * @param {number} timestamp 
 */
export function triggerNextAnimationFrame(timestamp = performance.now()) {
  const entries = Array.from(animationCallbacks.entries());
  animationCallbacks.clear();
  for (const [id, cb] of entries) {
    cb(timestamp);
  }
}

/**
 * Gets remaining queued animation frame count.
 */
export function getQueuedAnimationFrameCount() {
  return animationCallbacks.size;
}

// Auto-run setup upon import
setupCanvasMock();
