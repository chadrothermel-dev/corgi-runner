export const Collision = {
  check(a, b) {
    if (!a || !b) return false;
    const aX = a.x;
    const aY = a.y;
    const aW = a.width || a.w || 0;
    const aH = a.height || a.h || 0;

    const bX = b.x;
    const bY = b.y;
    const bW = b.width || b.w || 0;
    const bH = b.height || b.h || 0;

    return (
      aX < bX + bW &&
      aX + aW > bX &&
      aY < bY + bH &&
      aY + aH > bY
    );
  },

  checkSweptAABB(aPrev, aCurr, b) {
    if (!aPrev || !aCurr || !b) return false;
    
    // Direct check at current position
    if (this.check(aCurr, b)) return true;
    
    // Direct check at previous position
    if (this.check(aPrev, b)) return true;

    // Swept bounding box bounding min/max
    const minX = Math.min(aPrev.x, aCurr.x);
    const maxX = Math.max(aPrev.x + aPrev.width, aCurr.x + aCurr.width);
    const minY = Math.min(aPrev.y, aCurr.y);
    const maxY = Math.max(aPrev.y + aPrev.height, aCurr.y + aCurr.height);

    const sweptBox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };

    return this.check(sweptBox, b);
  }
};
