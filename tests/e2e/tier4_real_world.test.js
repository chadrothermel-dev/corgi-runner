import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameTestHarness } from './harness/gameHarness.js';
import { Storage } from '../../src/storage.js';

describe('Tier 4: Real-World Application Scenarios (6 Test Scenarios)', () => {
  let harness;

  beforeEach(async () => {
    harness = new GameTestHarness();
    await harness.setup();
  });

  afterEach(() => {
    harness.teardown();
  });

  it('T4.1: Complete End-to-End Successful Gameplay Session & High Score Breakout', () => {
    // 1. Launch App & verify start screen
    expect(harness.isStartScreenVisible()).toBe(true);

    // 2. Start game
    harness.pressKey('Space');
    expect(harness.getGameState()).toBe('PLAYING');

    // 3. Dodge obstacle & collect treats
    harness.pressKey('Space'); // Jump over hurdle
    harness.runForTime(1000); // Complete jump & land safely

    const treat1 = harness.game.entityManager.spawnTreat(harness.game.player.x + 30, 'ground');
    harness.stepFrames(5);
    expect(harness.game.score).toBeGreaterThanOrEqual(50);

    // 4. Speed scaling check (disable auto-spawns during speed check)
    harness.game.entityManager.spawnInterval = 99999;
    harness.game.entityManager.entities = [];
    harness.runForTime(5000); // 5 sec run
    expect(harness.game.currentSpeed).toBeGreaterThan(harness.game.baseSpeed);

    // 5. Pause & Resume cycle
    harness.pressKey('KeyP');
    expect(harness.getGameState()).toBe('PAUSED');
    harness.pressKey('KeyP');
    expect(harness.getGameState()).toBe('PLAYING');

    // 6. Collision crash
    harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
    harness.stepFrames(5);
    expect(harness.getGameState()).toBe('GAMEOVER');

    // 7. High Score persistence check
    const finalScore = Math.floor(harness.game.score);
    expect(harness.getLocalStorageHighScore()).toBe(finalScore);
    expect(harness.getFinalScoreText()).toBe(String(finalScore));

    // 8. Instant restart
    harness.pressKey('Space');
    expect(harness.getGameState()).toBe('PLAYING');
    expect(harness.game.score).toBe(0);
    expect(harness.getDisplayedHighScore()).toBe(finalScore);
  });

  it('T4.2: First-Time Player Experience & Initial LocalStorage Bootstrapping', () => {
    localStorage.clear();
    harness.game.syncUI();

    expect(harness.getDisplayedHighScore()).toBe(0);
    expect(harness.isStartScreenVisible()).toBe(true);

    harness.clickElement('#startBtn');
    expect(harness.getGameState()).toBe('PLAYING');

    harness.runForTime(5000); // 5 sec run
    harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
    harness.stepFrames(5);

    expect(harness.getGameState()).toBe('GAMEOVER');
    const firstScore = Math.floor(harness.game.score);
    expect(firstScore).toBeGreaterThan(0);
    expect(Storage.getHighScore()).toBe(firstScore);
  });

  it('T4.3: High-Speed Long Duration Run & Extreme Acceleration Challenge', () => {
    harness.pressKey('Space'); // Start
    harness.game.entityManager.spawnInterval = 99999; // Prevent auto obstacles from interrupting run
    harness.game.entityManager.entities = [];

    // Tier A (0-10s)
    harness.runForTime(10000);
    const speedA = harness.game.currentSpeed;

    // Tier B (10-30s)
    harness.runForTime(20000);
    const speedB = harness.game.currentSpeed;
    expect(speedB).toBeGreaterThan(speedA);

    // Tier C (30-60s)
    harness.runForTime(30000);
    const speedC = harness.game.currentSpeed;
    expect(speedC).toBeGreaterThan(speedB);

    // Execute jump at high speed
    harness.pressKey('Space');
    expect(harness.game.player.vy).toBe(harness.game.player.jumpImpulse);
    harness.runForTime(1000);
    expect(harness.game.player.isGrounded).toBe(true);
  });

  it('T4.4: Pause, Multi-Toggle & Window Blur Resilience Workflow', () => {
    harness.pressKey('Space'); // Start
    harness.runForTime(2000);

    harness.pressKey('KeyP'); // Pause
    expect(harness.getGameState()).toBe('PAUSED');

    window.dispatchEvent(new Event('blur'));
    expect(harness.getGameState()).toBe('PAUSED');

    window.dispatchEvent(new Event('focus'));
    expect(harness.getGameState()).toBe('PAUSED');

    harness.pressKey('KeyP'); // Resume
    expect(harness.getGameState()).toBe('PLAYING');

    harness.pressKey('KeyP'); // Pause again
    expect(harness.getGameState()).toBe('PAUSED');

    harness.clickElement('#resumeBtn'); // Resume via UI button click
    expect(harness.getGameState()).toBe('PLAYING');
  });

  it('T4.5: Multiple Consecutive Game Over & Instant Replay Stress Cycle', () => {
    let highestScoreAcc = 0;

    for (let round = 1; round <= 5; round++) {
      harness.pressKey('Space'); // Start/Restart
      expect(harness.getGameState()).toBe('PLAYING');

      harness.runForTime(2000);
      harness.game.entityManager.spawnTreat(harness.game.player.x + 5);
      harness.stepFrames(5); // Collect treat

      harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
      harness.stepFrames(5); // Game Over

      expect(harness.getGameState()).toBe('GAMEOVER');
      const roundScore = Math.floor(harness.game.score);
      if (roundScore > highestScoreAcc) {
        highestScoreAcc = roundScore;
      }
      expect(harness.getLocalStorageHighScore()).toBe(highestScoreAcc);
    }

    expect(harness.getLocalStorageHighScore()).toBe(highestScoreAcc);
  });

  it('T4.6: Responsive Canvas Resize & Multi-Input Control Workflow', () => {
    harness.pressKey('Space'); // Keyboard Start
    expect(harness.getGameState()).toBe('PLAYING');

    harness.touchStart(harness.canvas, [{ clientX: 400, clientY: 100 }]); // Touch Jump
    expect(harness.game.player.isGrounded).toBe(false);

    harness.runForTime(1000);
    expect(harness.game.player.isGrounded).toBe(true);

    harness.touchStart(harness.canvas, [{ clientX: 400, clientY: 350 }]); // Touch Duck
    expect(harness.game.player.state).toBe('DUCKING');

    window.dispatchEvent(new Event('resize'));
    expect(harness.game.player.y + harness.game.player.height).toBe(harness.game.player.groundY);

    harness.touchEnd(harness.canvas);
    expect(harness.game.player.state).toBe('RUNNING');

    harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
    harness.stepFrames(5);
    expect(harness.getGameState()).toBe('GAMEOVER');

    harness.clickElement('#restartBtn');
    expect(harness.getGameState()).toBe('PLAYING');
  });
});
