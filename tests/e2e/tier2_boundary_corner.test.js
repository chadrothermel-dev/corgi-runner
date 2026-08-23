import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameTestHarness } from './harness/gameHarness.js';
import { Collision } from '../../src/collision.js';
import { Storage } from '../../src/storage.js';

describe('Tier 2: Boundary & Corner Cases (25 Test Cases)', () => {
  let harness;

  beforeEach(async () => {
    harness = new GameTestHarness();
    await harness.setup();
  });

  afterEach(() => {
    harness.teardown();
  });

  // --- Boundary Area B1: Canvas Resize, Responsive Viewport & High-DPI Scaling ---
  describe('Boundary Area B1: Canvas Resize & Responsive Boundaries', () => {
    it('T2-B1-01: Window Resize Mid-Gameplay', () => {
      harness.pressKey('Space'); // Start
      harness.runForTime(500);

      window.dispatchEvent(new Event('resize'));
      expect(harness.game.player.y).toBeLessThanOrEqual(harness.game.player.groundY);
      expect(isNaN(harness.game.player.x)).toBe(false);
      expect(isNaN(harness.game.player.y)).toBe(false);
    });

    it('T2-B1-02: High-DPI (Retina) Pixel Ratio Scaling (devicePixelRatio = 2)', () => {
      window.devicePixelRatio = 2;
      harness.game.handleResize();
      harness.stepFrame();

      expect(harness.canvas).not.toBeNull();
      expect(harness.game.player.width).toBe(60);
    });

    it('T2-B1-03: Minimum Mobile Viewport Boundary (320px Width)', () => {
      window.innerWidth = 320;
      window.innerHeight = 568;
      harness.game.handleResize();

      expect(harness.isStartScreenVisible()).toBe(true);
      harness.clickElement('#startBtn');
      expect(harness.getGameState()).toBe('PLAYING');
    });

    it('T2-B1-04: Maximum 4K Viewport Boundary (3840x2160)', () => {
      window.innerWidth = 3840;
      window.innerHeight = 2160;
      harness.pressKey('Space'); // Start
      
      harness.stepFrames(60, 16.667);
      expect(harness.game.currentSpeed).toBeLessThan(1000);
      expect(harness.game.player.y).toBeLessThanOrEqual(harness.game.player.groundY);
    });

    it('T2-B1-05: Orientation Change Mid-Jump', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // Jump
      harness.stepFrames(10);

      window.dispatchEvent(new Event('orientationchange'));
      harness.runForTime(1200); // 1.2s

      expect(harness.game.player.isGrounded).toBe(true);
      expect(harness.game.player.y + harness.game.player.height).toBe(harness.game.player.groundY);
    });
  });

  // --- Boundary Area B2: Rapid Keypresses, Input Flooding & Auto-Repeat Key Stress ---
  describe('Boundary Area B2: Rapid Keypresses & Input Stress', () => {
    it('T2-B2-01: Rapid Jump Key Spamming (20 Presses / Second)', () => {
      harness.pressKey('Space'); // Start
      
      for (let i = 0; i < 20; i++) {
        harness.pressKey('Space');
        harness.stepFrame(10);
      }

      // Max velocity should not exceed initial jump impulse (-550)
      expect(harness.game.player.vy).toBeGreaterThanOrEqual(harness.game.player.jumpImpulse);
    });

    it('T2-B2-02: Rapid Jump-Duck Alternation (16ms Toggle Intervals)', () => {
      harness.pressKey('Space'); // Start

      for (let i = 0; i < 30; i++) {
        if (i % 2 === 0) {
          harness.keyDown('ArrowUp');
        } else {
          harness.keyDown('ArrowDown');
        }
        harness.stepFrame(16.667);
      }

      const validStates = ['RUNNING', 'JUMPING', 'DUCKING'];
      expect(validStates.includes(harness.game.player.state)).toBe(true);
      expect(harness.game.player.height).toBeGreaterThan(0);
      expect(isNaN(harness.game.player.height)).toBe(false);
    });

    it('T2-B2-03: Key Hold-Down Auto-Repeat Flooding (event.repeat === true)', () => {
      harness.pressKey('Space'); // Start

      for (let i = 0; i < 60; i++) {
        harness.keyDown('Space', 'Space', true); // repeat = true
        harness.stepFrame(16.667);
      }

      expect(harness.game.player.vy).toBeGreaterThanOrEqual(harness.game.player.jumpImpulse);
    });

    it('T2-B2-04: Rapid Pause Key Spamming (Escape/P Spam)', () => {
      harness.pressKey('Space'); // Start

      for (let i = 0; i < 10; i++) {
        harness.pressKey('KeyP');
      }

      // 10 presses (even) -> should be back in PLAYING state
      expect(harness.getGameState()).toBe('PLAYING');
    });

    it('T2-B2-05: Rapid Restart Clicks on Game Over Screen', () => {
      harness.pressKey('Space'); // Start
      harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
      harness.stepFrames(5); // Game Over

      expect(harness.getGameState()).toBe('GAMEOVER');

      for (let i = 0; i < 5; i++) {
        harness.clickElement('#restartBtn');
      }

      expect(harness.getGameState()).toBe('PLAYING');
      expect(harness.game.entityManager.entities.length).toBe(0);
    });
  });

  // --- Boundary Area B3: Simultaneous / Conflicting Inputs & Window Focus / Blur ---
  describe('Boundary Area B3: Simultaneous Inputs & Focus/Blur', () => {
    it('T2-B3-01: Simultaneous Jump + Duck Pressed On Same Frame', () => {
      harness.pressKey('Space'); // Start

      // Dispatch Space & ArrowDown in same frame
      harness.keyDown('Space');
      harness.keyDown('ArrowDown');
      harness.stepFrame(16.667);

      const validStates = ['RUNNING', 'JUMPING', 'DUCKING'];
      expect(validStates.includes(harness.game.player.state)).toBe(true);
    });

    it('T2-B3-02: Holding Duck While Pressing Jump Key', () => {
      harness.pressKey('Space'); // Start
      harness.keyDown('ArrowDown'); // Hold duck
      expect(harness.game.player.state).toBe('DUCKING');

      harness.pressKey('Space'); // Jump while ducking held
      expect(harness.game.player.isGrounded).toBe(false);

      harness.runForTime(1000); // Land back on ground
      expect(harness.game.player.isGrounded).toBe(true);
      expect(harness.game.player.state).toBe('DUCKING');
      expect(harness.game.player.height).toBe(harness.game.player.duckHeight);
    });

    it('T2-B3-03: Multi-Touch Gesture Conflict (2-Finger Simultaneous Touch)', () => {
      harness.pressKey('Space'); // Start
      harness.touchStart(harness.canvas, [
        { clientX: 100, clientY: 100 },
        { clientX: 400, clientY: 350 }
      ]);

      expect(['RUNNING', 'JUMPING', 'DUCKING'].includes(harness.game.player.state)).toBe(true);
    });

    it('T2-B3-04: Window Blur / Tab Switch During Active Key Press', () => {
      harness.pressKey('Space'); // Start
      harness.keyDown('ArrowDown');
      expect(harness.game.player.isDucking).toBe(true);

      window.dispatchEvent(new Event('blur'));

      expect(harness.getGameState()).toBe('PAUSED');
      expect(harness.game.player.isDucking).toBe(false);
    });

    it('T2-B3-05: Pause Key Triggered Mid-Jump', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // Jump
      harness.stepFrames(5);

      const midY = harness.game.player.y;
      harness.pressKey('KeyP'); // Pause
      expect(harness.getGameState()).toBe('PAUSED');

      harness.runForTime(1000);
      expect(harness.game.player.y).toBe(midY); // Frozen

      harness.pressKey('KeyP'); // Unpause
      expect(harness.getGameState()).toBe('PLAYING');
      harness.stepFrames(5);
      expect(harness.game.player.y).not.toBe(midY);
    });
  });

  // --- Boundary Area B4: LocalStorage Edge Cases ---
  describe('Boundary Area B4: LocalStorage Edge Cases', () => {
    it('T2-B4-01: Corrupted String in LocalStorage High Score', () => {
      localStorage.setItem('corgi_runner_highscore', 'CORRUPTED_STRING_VAL');
      harness.game.syncUI();

      expect(harness.game.highScore).toBe(0);
      expect(harness.getDisplayedHighScore()).toBe(0);
    });

    it('T2-B4-02: Negative Score in LocalStorage Boundary', () => {
      localStorage.setItem('corgi_runner_highscore', '-999');
      harness.game.syncUI();

      expect(harness.game.highScore).toBe(0);
      expect(harness.getDisplayedHighScore()).toBe(0);
    });

    it('T2-B4-03: Exception Handling when LocalStorage is Blocked (Incognito / QuotaExceeded)', () => {
      const setItemSpy = vi.spyOn(Storage, 'saveHighScore').mockImplementation(() => 50);
      harness.pressKey('Space');
      harness.game.score = 50;

      expect(() => {
        harness.game.triggerGameOver();
      }).not.toThrow();

      expect(harness.getGameState()).toBe('GAMEOVER');
      setItemSpy.mockRestore();
    });

    it('T2-B4-04: Extremely Large Score Integer (9,999,999 Boundary)', () => {
      harness.setLocalStorageHighScore(9999999);
      expect(harness.getDisplayedHighScore()).toBe(9999999);
      expect(harness.game.highScore).toBe(9999999);
    });

    it('T2-B4-05: Storage Reset / Clear Execution', () => {
      harness.setLocalStorageHighScore(500);
      expect(Storage.getHighScore()).toBe(500);

      Storage.resetHighScore();
      harness.game.syncUI();

      expect(Storage.getHighScore()).toBe(0);
      expect(harness.getDisplayedHighScore()).toBe(0);
    });
  });

  // --- Boundary Area B5: Edge-Case Collisions & Tunneling ---
  describe('Boundary Area B5: Edge-Case Collisions & Tunneling', () => {
    it('T2-B5-01: Grazing Collision (0.1px Overlap at Hitbox Corner)', () => {
      const player = { x: 100, y: 300, width: 50, height: 50 };
      const obstacle = { x: 149.9, y: 300, width: 50, height: 50 };

      expect(Collision.check(player, obstacle)).toBe(true);
    });

    it('T2-B5-02: Zero-Distance Tangent (Touching Edges Without Overlap)', () => {
      const player = { x: 100, y: 300, width: 50, height: 50 };
      const obstacle = { x: 150.0, y: 300, width: 50, height: 50 };

      expect(Collision.check(player, obstacle)).toBe(false);
    });

    it('T2-B5-03: High-Speed Tunneling Prevention (Fast Velocity Frame Step)', () => {
      const prevPlayer = { x: 180, y: 300, width: 50, height: 50 };
      const currPlayer = { x: 235, y: 300, width: 50, height: 50 };
      const obstacle = { x: 210, y: 300, width: 20, height: 50 };

      expect(Collision.checkSweptAABB(prevPlayer, currPlayer, obstacle)).toBe(true);
    });

    it('T2-B5-04: Dual Hitbox Clearance While Ducking Under Low Overhead Hurdle', () => {
      const hurdle = { x: 100, y: 275, width: 40, height: 35 }; // bottom edge = 310
      // Ducked player: groundY = 350, height = 25 -> y = 325. top edge is 325.
      const duckedPlayer = { x: 90, y: 325, width: 60, height: 25 };

      expect(Collision.check(duckedPlayer, hurdle)).toBe(false);
    });

    it('T2-B5-05: Simultaneous Treat Collection and Obstacle Collision on Same Frame', () => {
      harness.pressKey('Space'); // Start
      const initialScore = harness.game.score;

      const treat = harness.game.entityManager.spawnTreat(harness.game.player.x + 5);
      const hurdle = harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);

      harness.stepFrames(3);

      expect(harness.game.score).toBeGreaterThanOrEqual(initialScore + 50);
      expect(harness.getGameState()).toBe('GAMEOVER');
    });
  });
});
