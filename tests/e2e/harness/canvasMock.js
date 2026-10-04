export class CanvasMock2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.drawCalls = [];
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.font = '10px sans-serif';
    this.globalAlpha = 1.0;
    this.stateStack = [];
  }

  save() {
    this.drawCalls.push({ type: 'save' });
    this.stateStack.push({
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      font: this.font,
      globalAlpha: this.globalAlpha
    });
  }

  restore() {
    this.drawCalls.push({ type: 'restore' });
    if (this.stateStack.length > 0) {
      const state = this.stateStack.pop();
      this.fillStyle = state.fillStyle;
      this.strokeStyle = state.strokeStyle;
      this.font = state.font;
      this.globalAlpha = state.globalAlpha;
    }
  }

  translate(x, y) {
    this.drawCalls.push({ type: 'translate', x, y });
  }

  scale(x, y) {
    this.drawCalls.push({ type: 'scale', x, y });
  }

  rotate(angle) {
    this.drawCalls.push({ type: 'rotate', angle });
  }

  clearRect(x, y, w, h) {
    if (x === 0 && y === 0 && w === this.canvas.width && h === this.canvas.height) {
      this.drawCalls = [];
    }
    this.drawCalls.push({ type: 'clearRect', x, y, w, h });
  }

  fillRect(x, y, w, h) {
    this.drawCalls.push({ type: 'fillRect', x, y, w, h, fillStyle: this.fillStyle });
  }

  strokeRect(x, y, w, h) {
    this.drawCalls.push({ type: 'strokeRect', x, y, w, h, strokeStyle: this.strokeStyle });
  }

  beginPath() {
    this.drawCalls.push({ type: 'beginPath' });
  }

  moveTo(x, y) {
    this.drawCalls.push({ type: 'moveTo', x, y });
  }

  lineTo(x, y) {
    this.drawCalls.push({ type: 'lineTo', x, y });
  }

  closePath() {
    this.drawCalls.push({ type: 'closePath' });
  }

  arc(x, y, radius, startAngle, endAngle) {
    this.drawCalls.push({ type: 'arc', x, y, radius, startAngle, endAngle });
  }

  fill() {
    this.drawCalls.push({ type: 'fill', fillStyle: this.fillStyle });
  }

  stroke() {
    this.drawCalls.push({ type: 'stroke', strokeStyle: this.strokeStyle });
  }

  fillText(text, x, y) {
    this.drawCalls.push({ type: 'fillText', text, x, y, fillStyle: this.fillStyle, font: this.font });
  }

  drawImage(img, ...args) {
    let sx, sy, sw, sh, dx, dy, dw, dh;
    if (args.length === 2) {
      [dx, dy] = args;
    } else if (args.length === 4) {
      [dx, dy, dw, dh] = args;
    } else if (args.length === 8) {
      [sx, sy, sw, sh, dx, dy, dw, dh] = args;
    }
    this.drawCalls.push({ type: 'drawImage', sx, sy, sw, sh, dx, dy, dw, dh });
  }

  measureText(text) {
    return { width: (text || '').length * 10 };
  }

  // --- Additional standard Canvas 2D API surface used by the renderer ---

  setTransform(a, b, c, d, e, f) {
    this.drawCalls.push({ type: 'setTransform', args: [a, b, c, d, e, f] });
  }

  resetTransform() {
    this.drawCalls.push({ type: 'resetTransform' });
  }

  ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle) {
    this.drawCalls.push({ type: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle });
  }

  quadraticCurveTo(cpx, cpy, x, y) {
    this.drawCalls.push({ type: 'quadraticCurveTo', cpx, cpy, x, y });
  }

  bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x, y) {
    this.drawCalls.push({ type: 'bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y });
  }

  rect(x, y, w, h) {
    this.drawCalls.push({ type: 'rect', x, y, w, h });
  }

  clip() {
    this.drawCalls.push({ type: 'clip' });
  }

  strokeText(text, x, y) {
    this.drawCalls.push({ type: 'strokeText', text, x, y, strokeStyle: this.strokeStyle, font: this.font });
  }

  createLinearGradient() {
    return { addColorStop() {} };
  }

  createRadialGradient() {
    return { addColorStop() {} };
  }

  clearLog() {
    this.drawCalls = [];
  }
}

export function installCanvasMock() {
  if (typeof window !== 'undefined' && HTMLCanvasElement) {
    HTMLCanvasElement.prototype.getContext = function (type) {
      if (type === '2d') {
        if (!this._mockCtx) {
          this._mockCtx = new CanvasMock2D(this);
        }
        return this._mockCtx;
      }
      return null;
    };
  }
}
