import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameTestHarness } from './harness/gameHarness.js';

describe('Tier 3: Cross-Feature Combinations (7 Test Cases)', () => {
  let harness;

  beforeEach(async () => {
    harness = new GameTestHarness();
    await harness.setup();
  });

  afterEach(() => {
    harness.teardown();
  });

  it('T3.1: Jump Physics During Dynamic Speed Scaling', () => {
    harness.pressKey('Space'); // Start
    
    // Clear auto-spawned obstacles during speed ramp to keep player alive
    for (let i = 0; i < 5; i++) {
      harness.runForTime(1000);
      harness.game.entityManager.entities = [];
    }

    const highSpeed = harness.game.currentSpeed;
    expect(highSpeed).toBeGreaterThan(harness.game.baseSpeed);
    expect(harness.getGameState()).toBe('PLAYING');

    const startY = harness.game.player.y;
    harness.pressKey('Space'); // Jump
    expect(harness.game.player.vy).toBe(harness.game.player.jumpImpulse);

    harness.stepFrames(15);
    const peakY = harness.game.player.y;
    expect(peakY).toBeLessThan(startY);

    harness.runForTime(1000);
    expect(harness.game.player.isGrounded).toBe(true);
    expect(harness.game.player.y + harness.game.player.height).toBe(harness.game.player.groundY);
  });

  it('T3.2: Ducking / Sliding Under Obstacles Near Bone Treat Pickups', () => {
    harness.pressKey('Space'); // Start
    const initialScore = harness.game.score;

    harness.game.entityManager.spawnHighHurdle(harness.game.player.x + 10);
    harness.game.entityManager.spawnTreat(harness.game.player.x + 10, 'ground');

    harness.keyDown('ArrowDown'); // Duck
    harness.stepFrames(5);

    expect(harness.getGameState()).toBe('PLAYING');
    expect(harness.game.score).toBeGreaterThanOrEqual(initialScore + 50);
    expect(harness.getPlayedSounds().some(s => s.soundName === 'collect')).toBe(true);
  });

  it('T3.3: Game Loop Pause / Resume During Airborne Jump State', () => {
    harness.pressKey('Space'); // Start
    harness.pressKey('Space'); // Jump
    harness.stepFrames(10);

    const airborneY = harness.game.player.y;
    const airborneVy = harness.game.player.vy;

    harness.pressKey('KeyP'); // Pause
    expect(harness.getGameState()).toBe('PAUSED');

    harness.runForTime(5000); // 5 sec paused
    expect(harness.game.player.y).toBe(airborneY);
    expect(harness.game.player.vy).toBe(airborneVy);

    harness.pressKey('KeyP'); // Resume
    expect(harness.getGameState()).toBe('PLAYING');
    harness.runForTime(1000);
    expect(harness.game.player.isGrounded).toBe(true);
  });

  it('T3.4: Obstacle Collision Crash During High Score Record Run', () => {
    harness.setLocalStorageHighScore(100);
    harness.pressKey('Space'); // Start
    harness.game.score = 250;

    harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
    harness.stepFrames(5);

    expect(harness.getGameState()).toBe('GAMEOVER');
    expect(harness.getLocalStorageHighScore()).toBe(250);
    expect(harness.getGameOverHighScoreText()).toBe('250');
  });

  it('T3.5: Rapid Restart Input Trigger During Game Over Display', () => {
    harness.pressKey('Space'); // Start
    harness.game.entityManager.spawnHurdle(harness.game.player.x + 5);
    harness.stepFrames(5);
    expect(harness.getGameState()).toBe('GAMEOVER');

    // Instant restart within 50ms
    harness.pressKey('Space');
    expect(harness.getGameState()).toBe('PLAYING');
    expect(harness.game.score).toBe(0);
    expect(harness.game.player.isGrounded).toBe(true);
    expect(harness.game.entityManager.entities.length).toBe(0);
  });

  it('T3.6: Simultaneous Airborne Treat Pickup with Particle Burst & Audio Event', () => {
    harness.pressKey('Space'); // Start
    const initialScore = harness.game.score;
    
    // Position airborne treat so jumping Corgi intersects it perfectly
    harness.game.entityManager.spawnTreat(harness.game.player.x + 30, 'air');

    harness.pressKey('Space'); // Jump into airborne treat
    harness.stepFrames(6);

    expect(harness.game.score).toBeGreaterThanOrEqual(initialScore + 50);
    expect(harness.game.particles.activeCount).toBeGreaterThan(0);
    const sounds = harness.getPlayedSounds();
    expect(sounds.some(s => s.soundName === 'jump')).toBe(true);
    expect(sounds.some(s => s.soundName === 'collect')).toBe(true);
  });

  it('T3.7: Ducking Input Under High Hurdle While Ground Obstacle Approaching', () => {
    harness.pressKey('Space'); // Start

    // High hurdle followed by ground hydrant with clearance spacing
    const highHurdle = harness.game.entityManager.spawnHighHurdle(harness.game.player.x + 10);
    const hydrant = harness.game.entityManager.spawnHydrant(harness.game.player.x + 80);

    harness.keyDown('ArrowDown'); // Duck under high hurdle
    harness.stepFrames(3);

    // Clears high hurdle
    expect(harness.getGameState()).toBe('PLAYING');

    harness.stepFrames(10); // Collides with ground hydrant while ducked
    expect(harness.getGameState()).toBe('GAMEOVER');
  });
});
