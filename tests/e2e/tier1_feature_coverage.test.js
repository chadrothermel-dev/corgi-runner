import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameTestHarness } from './harness/gameHarness.js';
import { Collision } from '../../src/collision.js';

describe('Tier 1: Feature Coverage (25 Test Cases)', () => {
  let harness;

  beforeEach(async () => {
    harness = new GameTestHarness();
    await harness.setup();
  });

  afterEach(() => {
    harness.teardown();
  });

  // --- Feature Area F1: Canvas Rendering, Main Loop & UI State Machine ---
  describe('Feature Area F1: Canvas Rendering & State Machine', () => {
    it('T1-F1-01: Canvas Element Initialization & Start Screen Render', () => {
      expect(harness.canvas).not.toBeNull();
      expect(harness.getGameState()).toBe('START');
      expect(harness.isStartScreenVisible()).toBe(true);
    });

    it('T1-F1-02: State Transition from Start to Playing', () => {
      harness.pressKey('Space');
      expect(harness.getGameState()).toBe('PLAYING');
      expect(harness.isStartScreenVisible()).toBe(false);
      expect(harness.game.player.state).toBe('RUNNING');
    });

    it('T1-F1-03: Game Pause and Resume Toggle', () => {
      harness.pressKey('Space'); // Start
      expect(harness.getGameState()).toBe('PLAYING');

      harness.pressKey('KeyP'); // Pause
      expect(harness.getGameState()).toBe('PAUSED');
      expect(harness.isPauseOverlayVisible()).toBe(true);

      const y1 = harness.game.player.y;
      harness.runForTime(500); // Physics frozen
      const y2 = harness.game.player.y;
      expect(y2).toBe(y1);

      harness.pressKey('KeyP'); // Resume
      expect(harness.getGameState()).toBe('PLAYING');
      expect(harness.isPauseOverlayVisible()).toBe(false);
    });

    it('T1-F1-04: Game Over Transition on Obstacle Collision', () => {
      harness.pressKey('Space'); // Start
      harness.game.entityManager.spawnHurdle(harness.game.player.x + 10);
      
      harness.stepFrames(5);
      expect(harness.getGameState()).toBe('GAMEOVER');
      expect(harness.isGameOverScreenVisible()).toBe(true);
      expect(harness.getFinalScoreText()).toBe(String(Math.floor(harness.game.score)));
    });

    it('T1-F1-05: Instant Restart from Game Over State', () => {
      harness.pressKey('Space'); // Start
      harness.game.entityManager.spawnHurdle(harness.game.player.x + 10);
      harness.stepFrames(5);
      expect(harness.getGameState()).toBe('GAMEOVER');

      harness.pressKey('Space'); // Restart
      expect(harness.getGameState()).toBe('PLAYING');
      expect(Math.floor(harness.game.score)).toBe(0);
      expect(harness.game.player.y).toBe(harness.game.player.groundY - harness.game.player.height);
      expect(harness.game.entityManager.entities.length).toBe(0);
    });
  });

  // --- Feature Area F2: Player Jump Controls, Physics & Air Mechanics ---
  describe('Feature Area F2: Player Jump Controls & Physics', () => {
    it('T1-F2-01: Jump Activation via Spacebar Key', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // Jump

      expect(harness.game.player.vy).toBeLessThan(0);
      expect(harness.game.player.isGrounded).toBe(false);
      expect(harness.game.player.state).toBe('JUMPING');
      
      const sounds = harness.getPlayedSounds();
      expect(sounds.some(s => s.soundName === 'jump')).toBe(true);
    });

    it('T1-F2-02: Jump Activation via Up Arrow Key', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('ArrowUp'); // Jump

      expect(harness.game.player.vy).toBe(harness.game.player.jumpImpulse);
      expect(harness.game.player.isGrounded).toBe(false);
    });

    it('T1-F2-03: Touch/Click Jump Activation', () => {
      harness.pressKey('Space'); // Start
      harness.touchStart(harness.canvas, [{ clientX: 400, clientY: 100 }]); // Tap top half

      expect(harness.game.player.isGrounded).toBe(false);
      expect(harness.game.player.vy).toBeLessThan(0);
    });

    it('T1-F2-04: Parabolic Arc & Gravity Acceleration', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // Jump

      const startY = harness.game.player.y;
      harness.stepFrames(15); // Rising
      const peakY = harness.game.player.y;
      expect(peakY).toBeLessThan(startY);

      harness.runForTime(1000); // Complete jump duration
      expect(harness.game.player.isGrounded).toBe(true);
      expect(harness.game.player.y).toBe(harness.game.player.groundY - harness.game.player.height);
      expect(harness.game.player.state).toBe('RUNNING');
    });

    it('T1-F2-05: Double Jump Prevention (Single Jump Only)', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // First Jump
      harness.stepFrames(5);

      const vyMidAir = harness.game.player.vy;
      harness.stepFrames(1);
      harness.pressKey('Space'); // Attempt Second Jump in mid-air
      
      // Velocity should NOT jump back down to initial jump impulse
      expect(harness.game.player.vy).not.toBe(harness.game.player.jumpImpulse);
      expect(harness.game.player.vy).toBeGreaterThan(vyMidAir);
    });
  });

  // --- Feature Area F3: Player Duck/Slide Controls & Hitbox Height Adjustments ---
  describe('Feature Area F3: Player Duck/Slide Controls & Hitbox', () => {
    it('T1-F3-01: Duck Activation via Down Arrow Key', () => {
      harness.pressKey('Space'); // Start
      harness.keyDown('ArrowDown');

      expect(harness.game.player.state).toBe('DUCKING');
      expect(harness.game.player.height).toBe(harness.game.player.duckHeight);
      expect(harness.game.player.y + harness.game.player.height).toBe(harness.game.player.groundY);
    });

    it('T1-F3-02: Duck Release Restoration', () => {
      harness.pressKey('Space'); // Start
      harness.keyDown('ArrowDown');
      expect(harness.game.player.state).toBe('DUCKING');

      harness.keyUp('ArrowDown');
      expect(harness.game.player.state).toBe('RUNNING');
      expect(harness.game.player.height).toBe(harness.game.player.normalHeight);
    });

    it('T1-F3-03: Touch Duck Activation', () => {
      harness.pressKey('Space'); // Start
      harness.touchStart(harness.canvas, [{ clientX: 400, clientY: 350 }]); // Touch lower half

      expect(harness.game.player.state).toBe('DUCKING');
      expect(harness.game.player.height).toBe(harness.game.player.duckHeight);
    });

    it('T1-F3-04: High Hurdle Clearance while Ducking', () => {
      harness.pressKey('Space'); // Start
      const hurdle = harness.game.entityManager.spawnHighHurdle(harness.game.player.x + 5);

      harness.keyDown('ArrowDown'); // Duck!
      const playerBox = {
        x: harness.game.player.x,
        y: harness.game.player.y,
        width: harness.game.player.width,
        height: harness.game.player.height
      };

      expect(Collision.check(playerBox, hurdle)).toBe(false);
      harness.stepFrames(10);
      expect(harness.getGameState()).toBe('PLAYING');
    });

    it('T1-F3-05: Mid-Air Fast Fall via Duck Keypress', () => {
      harness.pressKey('Space'); // Start
      harness.pressKey('Space'); // Jump
      harness.stepFrames(10); // Rising

      const normalVy = harness.game.player.vy;
      harness.keyDown('ArrowDown'); // Fast fall
      harness.stepFrames(2);

      expect(harness.game.player.vy).toBeGreaterThan(normalVy);
    });
  });

  // --- Feature Area F4: Collectible Bone Treats, Particle Effects & Web Audio SFX ---
  describe('Feature Area F4: Collectibles, Particles & SFX', () => {
    it('T1-F4-01: Bone Treat Spawning & Leftward Scrolling', () => {
      harness.pressKey('Space'); // Start
      const treat = harness.game.entityManager.spawnTreat(400);
      const initialX = treat.x;

      harness.stepFrames(10);
      expect(treat.x).toBeLessThan(initialX);
      expect(harness.game.entityManager.entities.some(e => e.type === 'treat')).toBe(true);
    });

    it('T1-F4-02: Precise Collision & Treat Pickup Collection', () => {
      harness.pressKey('Space'); // Start
      const initialScore = harness.game.score;
      harness.game.entityManager.spawnTreat(harness.game.player.x + 5);

      harness.stepFrames(3); // Pick up treat
      expect(harness.game.score).toBeGreaterThanOrEqual(initialScore + 50);
      expect(harness.game.entityManager.entities.some(e => e.type === 'treat')).toBe(false);
    });

    it('T1-F4-03: Treat Pickup Particle Burst Effect', () => {
      harness.pressKey('Space'); // Start
      harness.game.entityManager.spawnTreat(harness.game.player.x + 5);

      harness.stepFrames(3);
      expect(harness.game.particles.activeCount).toBeGreaterThan(0);
    });

    it('T1-F4-04: Treat Pickup Audio Sound Effect', () => {
      harness.pressKey('Space'); // Start
      harness.game.entityManager.spawnTreat(harness.game.player.x + 5);

      harness.stepFrames(3);
      const sounds = harness.getPlayedSounds();
      expect(sounds.some(s => s.soundName === 'collect')).toBe(true);
    });

    it('T1-F4-05: Uncollected Treat Off-Screen Cleanup', () => {
      harness.pressKey('Space'); // Start
      const treat = harness.game.entityManager.spawnTreat(100);
      treat.x = -60; // moves off screen

      harness.stepFrames(2);
      expect(harness.game.entityManager.entities.includes(treat)).toBe(false);
    });
  });

  // --- Feature Area F5: Progressive Speed Scaling, Distance Scoring & LocalStorage High Score ---
  describe('Feature Area F5: Speed Scaling, Scoring & High Score Persistence', () => {
    it('T1-F5-01: Continuous Real-Time Score Accumulation', () => {
      harness.pressKey('Space'); // Start
      expect(harness.game.score).toBe(0);

      harness.runForTime(1000); // 1 sec
      expect(harness.game.score).toBeGreaterThan(0);
    });

    it('T1-F5-02: Progressive World Speed Acceleration', () => {
      harness.pressKey('Space'); // Start
      const baseSpeed = harness.game.currentSpeed;

      harness.runForTime(5000); // 5 sec
      expect(harness.game.currentSpeed).toBeGreaterThan(baseSpeed);
    });

    it('T1-F5-03: High Score Saved to LocalStorage on Game Over', () => {
      harness.setLocalStorageHighScore(100);
      harness.pressKey('Space'); // Start
      harness.game.score = 350;

      harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
      harness.stepFrames(5); // Game Over

      expect(harness.getGameState()).toBe('GAMEOVER');
      expect(harness.getLocalStorageHighScore()).toBe(350);
      expect(harness.getGameOverHighScoreText()).toBe('350');
    });

    it('T1-F5-04: High Score Retained Across Browser Reloads', () => {
      harness.setLocalStorageHighScore(750);
      harness.game.syncUI();

      expect(harness.getDisplayedHighScore()).toBe(750);
      expect(harness.game.highScore).toBe(750);
    });

    it('T1-F5-05: Non-Overwrite of Higher Stored High Score', () => {
      harness.setLocalStorageHighScore(1000);
      harness.pressKey('Space'); // Start
      harness.game.score = 200;

      harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
      harness.stepFrames(5); // Game Over

      expect(harness.getLocalStorageHighScore()).toBe(1000);
      expect(harness.getGameOverHighScoreText()).toBe('1000');
    });
  });
});
