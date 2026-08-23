# Technical Analysis & Architectural Specification: `js/collision.js`

## Executive Summary
This document provides the complete architecture, mathematical specification, edge case analysis, and proposed implementation for `js/collision.js` for Milestone M2 (Bounding Box & Player Hitbox Collision System).

## 1. Codebase Audit & Architectural Context
- **Existing Files Analyzed**:
  - `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\sub_orch_m2\SCOPE.md`
  - `js/engine.js`, `js/main.js`
  - `src/collision.js` (legacy prototype), `src/player.js`, `src/entities.js`, `src/game.js`
  - `tests/unit/engine.test.js`, `tests/e2e/tier1_feature_coverage.test.js`, `tests/e2e/harness/gameHarness.js`
- **Audit Findings**:
  1. Prototype `src/collision.js` uses an object literal `export const Collision = { check(a, b), checkSweptAABB(aPrev, aCurr, b) }`.
  2. M2 Requirements (`SCOPE.md`) mandate an ES Class `Collision` located at `js/collision.js` featuring static methods:
     - `Collision.checkBoundingBox(rectA, rectB)`
     - `Collision.checkPlayerEntity(player, entity)`
     - `Collision.check(player, entity)` (alias)
     - `Collision.checkSweptAABB(prevRect, currRect, obstacle)`
  3. `src/collision.js` can re-export `Collision` from `../js/collision.js` (`export { Collision } from '../js/collision.js';`) to ensure 100% backward compatibility with all E2E test files (`tests/e2e/*.test.js`) and existing `src/game.js`.

## 2. Mathematical Specification & Algorithm Design

### 2.1 Axis-Aligned Bounding Box (AABB) Overlap Logic
For two 2D rectangles $A$ and $B$:
- Position: $(x_A, y_A)$ and $(x_B, y_B)$
- Dimensions: $(w_A, h_A)$ and $(w_B, h_B)$

The overlap condition is defined as:
$$\text{Overlap}(A, B) \iff (x_A < x_B + w_B) \land (x_A + w_A > x_B) \land (y_A < y_B + h_B) \land (y_A + h_A > y_B)$$

### 2.2 Boundary Conditions & Tangency Rules
- **0.0px Tangent Edge (Non-Collision)**:
  - If $x_A + w_A = x_B$, there is $0.0\text{px}$ intersection. The inequality $x_A + w_A > x_B$ evaluates to `false`. Returns `false`.
- **0.1px Grazing Overlap (Collision)**:
  - If $x_A + w_A = x_B + 0.1$, the inequality $x_A + w_A > x_B$ evaluates to `true`. Returns `true`.

### 2.3 Safe Rectangle Normalization (`_normalizeRect`)
Objects passed into collision methods may be null, undefined, non-objects, primitive types, missing coordinates, or contain `NaN` or invalid dimensions. Additionally, objects may expose a `.getHitbox()` method or use alternative dimension names (`width`/`w`, `height`/`h`).

Normalization helper logic:
1. Return `null` if object is `null`, `undefined`, or `typeof !== 'object'`.
2. If object has a `getHitbox` method (`typeof obj.getHitbox === 'function'`), invoke `obj.getHitbox()`.
3. Extract `x`, `y`, `width` (`width ?? w`), `height` (`height ?? h`).
4. Cast to Numbers (`Number(val)`).
5. If `NaN`, return `null`.
6. If `width <= 0` or `height <= 0`, return `null`.
7. Return clean rectangle `{ x, y, width, height }`.

### 2.4 Ducking Player Hitbox Mathematics
- Ground Level $Y_{\text{ground}} = 350$.
- **Standing Corgi Player**:
  - `normalHeight = 50`, `width = 60`.
  - Top-left position: $X = 80$, $Y = Y_{\text{ground}} - 50 = 300$.
  - Bounds: $X \in [80, 140]$, $Y \in [300, 350]$.
- **Ducking Corgi Player**:
  - `duckHeight = 25`, `width = 60`.
  - Top-left position: $X = 80$, $Y = Y_{\text{ground}} - 25 = 325$.
  - Bounds: $X \in [80, 140]$, $Y \in [325, 350]$.
- **Obstacle Alignments**:
  - **Low Hurdle**: $X = 100$, $Y = Y_{\text{ground}} - 40 = 310$, $W = 30, H = 40$. Bounds $Y \in [310, 350]$.
    - Standing Player ($Y \in [300, 350]$): $300 < 350 \land 350 > 310 \implies$ **Hit!**
    - Ducking Player ($Y \in [325, 350]$): $325 < 350 \land 350 > 310 \implies$ **Hit!**
  - **High Hurdle**: $X = 100$, $Y = Y_{\text{ground}} - 75 = 275$, $W = 40, H = 35$. Bounds $Y \in [275, 310]$.
    - Standing Player ($Y \in [300, 350]$): $300 < 310 \land 350 > 275 \implies$ **Hit!**
    - Ducking Player ($Y \in [325, 350]$): $325 < 310$ is **`false`** $\implies$ **Clear! (Passed Overhead)**

### 2.5 Swept AABB Continuous Collision Detection (CCD)
When world speed accelerates to $v = 800\text{px/s}$, delta time $dt = 0.1\text{s}$ results in frame displacement $\Delta x = 80\text{px}$. An obstacle of width $30\text{px}$ could be skipped over entirely between frame $k-1$ and frame $k$ (tunneling).

Swept AABB algorithm:
1. Normalize `prevRect`, `currRect`, and `obstacle`. If any is invalid, return `false`.
2. Check direct overlap at `currRect` against `obstacle`. If true, return `true`.
3. Check direct overlap at `prevRect` against `obstacle`. If true, return `true`.
4. Calculate bounding box enclosing movement path:
   $$X_{\text{min}} = \min(X_{\text{prev}}, X_{\text{curr}}), \quad X_{\text{max}} = \max(X_{\text{prev}} + W_{\text{prev}}, X_{\text{curr}} + W_{\text{curr}})$$
   $$Y_{\text{min}} = \min(Y_{\text{prev}}, Y_{\text{curr}}), \quad Y_{\text{max}} = \max(Y_{\text{prev}} + H_{\text{prev}}, Y_{\text{curr}} + H_{\text{curr}})$$
   $$\text{SweptBox} = \{ x: X_{\text{min}}, y: Y_{\text{min}}, \text{width}: X_{\text{max}} - X_{\text{min}}, \text{height}: Y_{\text{max}} - Y_{\text{min}} \}$$
5. Perform standard AABB collision test between $\text{SweptBox}$ and `obstacle`.

## 3. Class Code Specification & Proposed Implementation

```javascript
/**
 * Class Collision
 * Collision detection engine for Corgi Endless Runner.
 * Provides static AABB bounding box checks, player vs entity hitbox handling,
 * ducking state resolution, and swept AABB tunneling prevention.
 */
export class Collision {
  /**
   * Normalizes an object or entity into a valid { x, y, width, height } bounding box.
   * Resolves getHitbox() method if present, supports w/h property aliases,
   * and validates numeric values.
   * @param {Object} obj 
   * @returns {Object|null} Bounding box object or null if invalid
   * @private
   */
  static _normalizeRect(obj) {
    if (!obj || typeof obj !== 'object') {
      return null;
    }

    const rect = (typeof obj.getHitbox === 'function') ? obj.getHitbox() : obj;
    if (!rect || typeof rect !== 'object') {
      return null;
    }

    const x = Number(rect.x);
    const y = Number(rect.y);
    const width = Number(rect.width ?? rect.w);
    const height = Number(rect.height ?? rect.h);

    if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(width) || Number.isNaN(height)) {
      return null;
    }

    if (width <= 0 || height <= 0) {
      return null;
    }

    return { x, y, width, height };
  }

  /**
   * Performs Axis-Aligned Bounding Box (AABB) collision check between two rectangles.
   * @param {Object} rectA 
   * @param {Object} rectB 
   * @returns {boolean} True if overlap > 0px; false otherwise.
   */
  static checkBoundingBox(rectA, rectB) {
    const a = Collision._normalizeRect(rectA);
    const b = Collision._normalizeRect(rectB);

    if (!a || !b) {
      return false;
    }

    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  /**
   * Checks collision between Player and Entity, resolving player ducking hitbox.
   * @param {Object} player 
   * @param {Object} entity 
   * @returns {boolean}
   */
  static checkPlayerEntity(player, entity) {
    return Collision.checkBoundingBox(player, entity);
  }

  /**
   * Primary collision detection method (alias for checkBoundingBox / checkPlayerEntity).
   * @param {Object} a 
   * @param {Object} b 
   * @returns {boolean}
   */
  static check(a, b) {
    return Collision.checkBoundingBox(a, b);
  }

  /**
   * Swept AABB collision check to prevent high-speed frame tunneling.
   * @param {Object} prevRect 
   * @param {Object} currRect 
   * @param {Object} obstacle 
   * @returns {boolean}
   */
  static checkSweptAABB(prevRect, currRect, obstacle) {
    const aPrev = Collision._normalizeRect(prevRect);
    const aCurr = Collision._normalizeRect(currRect);
    const b = Collision._normalizeRect(obstacle);

    if (!aPrev || !aCurr || !b) {
      return false;
    }

    if (Collision.checkBoundingBox(aCurr, b)) return true;
    if (Collision.checkBoundingBox(aPrev, b)) return true;

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

    return Collision.checkBoundingBox(sweptBox, b);
  }
}
```

## 4. Re-Export & Backwards Compatibility Strategy
To ensure all existing unit tests, E2E tests, and harness code remain operational:
1. Write the new implementation in `js/collision.js`.
2. Modify `src/collision.js` to re-export `Collision`:
   ```javascript
   export { Collision } from '../js/collision.js';
   ```
This eliminates code duplication while keeping legacy import paths fully functional.

## 5. Proposed Unit Test Matrix (`tests/unit/collision.test.js`)
The implementer should create `tests/unit/collision.test.js` covering:
1. `checkBoundingBox` - overlapping boxes (returns `true`).
2. `checkBoundingBox` - disjoint boxes (returns `false`).
3. `checkBoundingBox` - 0.0px tangent edge touching (returns `false`).
4. `checkBoundingBox` - 0.1px grazing overlap (returns `true`).
5. `checkBoundingBox` - null / undefined / empty object inputs (returns `false`).
6. `checkBoundingBox` - NaN / non-numeric / string / negative dimension inputs (returns `false`).
7. `checkBoundingBox` - `w`/`h` key aliases.
8. `checkPlayerEntity` - standing player vs low hurdle (returns `true`).
9. `checkPlayerEntity` - standing player vs high hurdle (returns `true`).
10. `checkPlayerEntity` - ducking player vs high hurdle (returns `false` - duck clearance).
11. `checkPlayerEntity` - ducking player vs low hurdle (returns `true`).
12. `checkPlayerEntity` - objects exposing `getHitbox()` method.
13. `checkSweptAABB` - high-speed tunneling jump across obstacle (returns `true`).
14. `checkSweptAABB` - trajectory clear of obstacle (returns `false`).
15. `check` method alias behavior identical to `checkBoundingBox`.
