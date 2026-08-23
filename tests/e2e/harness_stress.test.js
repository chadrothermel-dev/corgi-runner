import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GameTestHarness } from './harness/gameHarness.js';
import { VirtualClock } from './harness/timeMock.js';
import { CanvasMock2D } from './harness/canvasMock.js';
import { installAudioMock, getAudioLog, clearAudioLog } from './harness/audioMock.js';
import { AudioSystem } from '../../src/audio.js';
import { Storage } from '../../src/storage.js';

describe('Empirical Stress Testing of E2E Test Harness', () => {
  let harness;

  beforeEach(async () => {
    harness = new GameTestHarness();
    await harness.setup();
  });

  afterEach(() => {
    if (harness) {
      harness.teardown();
    }
  });

  // --- Category 1: Virtual Clock & Determinism Stress ---
  describe('Category 1: Virtual Clock & Determinism', () => {
    it('EMP-CLK-01: In-Flight rAF Cancellation Flaw', () => {
      const clock = new VirtualClock();
      clock.install();

      let cb1Executed = false;
      let cb2Executed = false;

      const id1 = window.requestAnimationFrame(() => {
        cb1Executed = true;
        window.cancelAnimationFrame(id2);
      });

      const id2 = window.requestAnimationFrame(() => {
        cb2Executed = true;
      });

      clock.step(16.667);

      console.log(`[EMP-CLK-01] cb1Executed: ${cb1Executed}, cb2Executed: ${cb2Executed}`);
      clock.uninstall();

      // Flaw check: cb2 SHOULD NOT execute because it was cancelled during frame step by cb1.
      expect({ cb1Executed, cb2Executed }).toEqual({ cb1Executed: true, cb2Executed: false });
    });

    it('EMP-CLK-02: Non-Deterministic Wall-Clock Audio Timestamps vs Virtual Clock', () => {
      harness.pressKey('Space'); // Start game
      
      AudioSystem.play('jump');

      // Advance virtual clock by 100,000 ms (100 seconds / ~6000 frames)
      harness.stepFrames(6000, 16.667);

      AudioSystem.play('collect');

      const playedSounds = harness.getPlayedSounds();
      const jumpSound = playedSounds.find(s => s.soundName === 'jump');
      const collectSound = playedSounds.find(s => s.soundName === 'collect');

      const virtualTimeElapsed = harness.clock.currentTime; // ~100000ms
      const audioTimestampDelta = collectSound.timestamp - jumpSound.timestamp;

      console.log(`[EMP-CLK-02] Virtual Time Elapsed: ${virtualTimeElapsed}ms`);
      console.log(`[EMP-CLK-02] Logged Audio Timestamp Delta: ${audioTimestampDelta}ms`);

      // Flaw check: audio timestamp delta should equal virtual time elapsed (~100,000ms).
      // Since AudioSystem uses Date.now(), delta is ~0-50ms (real execution speed), breaking determinism!
      expect(audioTimestampDelta).toBeGreaterThanOrEqual(99000);
    });

    it('EMP-CLK-03: Virtual Clock Precision & Frame Stepping Scaling Benchmark', () => {
      const clock = new VirtualClock();
      clock.install();

      const numFrames = 50000;
      let frameCount = 0;

      window.requestAnimationFrame(function loop() {
        frameCount++;
        window.requestAnimationFrame(loop);
      });

      const t0 = performance.now();
      clock.stepFrames(numFrames, 16.667);
      const t1 = performance.now();

      console.log(`[EMP-CLK-03] Stepped ${numFrames} frames in ${(t1 - t0).toFixed(2)}ms real time.`);
      console.log(`[EMP-CLK-03] Clock time: ${clock.currentTime.toFixed(4)}ms, Executed frames: ${frameCount}`);

      clock.uninstall();

      expect(frameCount).toBe(numFrames);
      expect(clock.currentTime).toBeCloseTo(numFrames * 16.667, 1);
    });
  });

  // --- Category 2: Canvas Mock Capabilities & Memory Leak Stress ---
  describe('Category 2: Canvas Mock Capabilities & Memory Leak', () => {
    it('EMP-CAN-01: Memory Leak via Unbounded drawCalls Array Growth', () => {
      harness.pressKey('Space'); // Start game
      
      const initialCalls = harness.getRenderedDrawCalls().length;
      
      // Step 5,000 frames
      harness.stepFrames(5000);

      const totalCalls = harness.getRenderedDrawCalls().length;
      console.log(`[EMP-CAN-01] Draw calls accumulated after 5000 frames: ${totalCalls}`);

      // Highlighting flaw: totalCalls grows unbounded (tens of thousands of objects) unless manually cleared
      expect(totalCalls).toBeLessThan(1000); // Flaw demonstration (fails if unbounded)
    });

    it('EMP-CAN-02: Canvas State Stack (save/restore) Isolation Flaw', () => {
      const mockCanvas = document.createElement('canvas');
      const ctx = mockCanvas.getContext('2d');

      ctx.fillStyle = '#FF0000';
      ctx.save();
      ctx.fillStyle = '#00FF00';
      expect(ctx.fillStyle).toBe('#00FF00');

      ctx.restore();
      console.log(`[EMP-CAN-02] fillStyle after restore(): ${ctx.fillStyle}`);

      // Flaw check: Standard Canvas 2D restores state on restore(). CanvasMock2D does not.
      expect(ctx.fillStyle).toBe('#FF0000');
    });

    it('EMP-CAN-03: drawImage Parameter Signature Mismatch', () => {
      const mockCanvas = document.createElement('canvas');
      const ctx = mockCanvas.getContext('2d');
      ctx.clearLog();

      const fakeImg = {};
      // 9-argument drawImage (img, sx, sy, sw, sh, dx, dy, dw, dh)
      ctx.drawImage(fakeImg, 10, 20, 30, 40, 100, 200, 300, 400);

      const log = ctx.drawCalls[0];
      console.log(`[EMP-CAN-03] 9-arg drawImage logged output:`, log);

      // Expected destination coordinates: dx=100, dy=200
      // Actual in CanvasMock2D: dx=10, dy=20 (mistakenly assigns source sx, sy)
      expect(log.dx).toBe(100);
      expect(log.dy).toBe(200);
    });
  });

  // --- Category 3: Event Dispatching & Input Simulation Stress ---
  describe('Category 3: Event Dispatching & Input Simulation', () => {
    it('EMP-EVT-01: pressKey Synchronous Release Flaw for State-Based Keys (Duck)', () => {
      harness.pressKey('Space'); // Start game
      expect(harness.game.player.state).toBe('RUNNING');

      // Attempt ducking via pressKey('ArrowDown')
      harness.pressKey('ArrowDown');

      harness.stepFrame();

      const stateAfterStep = harness.game.player.state;
      const isDuckingAfterStep = harness.game.player.isDucking;

      console.log(`[EMP-EVT-01] Ducking after pressKey + stepFrame: ${isDuckingAfterStep}, state: ${stateAfterStep}`);

      // Flaw check: pressKey fires keyUp synchronously before stepFrame, cancelling ducking immediately.
      expect(isDuckingAfterStep).toBe(true);
    });

    it('EMP-EVT-02: Window Event Listener Accumulation across Harness Setup/Teardown', async () => {
      // Setup and teardown 5 game instances
      for (let i = 0; i < 5; i++) {
        const tempHarness = new GameTestHarness();
        await tempHarness.setup();
        tempHarness.teardown();
      }

      // Re-setup current harness
      let keydownCount = 0;
      const originalHandler = harness.game.handleKeyDown;
      harness.game.handleKeyDown = function(e) {
        keydownCount++;
        return originalHandler.call(this, e);
      };

      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: 'Space', bubbles: true }));

      console.log(`[EMP-EVT-02] Keydown handlers triggered for single keydown event: ${keydownCount}`);

      // Flaw check: if teardown() removed window event listeners, keydownCount should be exactly 1.
      expect(keydownCount).toBe(1);
    });

    it('EMP-EVT-03: Touch Event Interface Type Mismatch', () => {
      let dispatchedEvent = null;
      harness.canvas.addEventListener('touchstart', (e) => {
        dispatchedEvent = e;
      });

      harness.touchStart(harness.canvas, [{ clientX: 200, clientY: 150 }]);

      console.log(`[EMP-EVT-03] Event type: ${dispatchedEvent.type}, constructor: ${dispatchedEvent.constructor.name}`);

      // Flaw check: touchStart dispatches CustomEvent instead of TouchEvent
      expect(dispatchedEvent.constructor.name).toBe('TouchEvent');
    });
  });

  // --- Category 4: LocalStorage Isolation & DOM Inspection Performance ---
  describe('Category 4: LocalStorage Isolation & DOM Inspection Performance', () => {
    it('EMP-STO-01: LocalStorage Setup Pollution on Unclean Teardown', async () => {
      localStorage.setItem('corgi_runner_highscore', '9999');

      // Create a fresh harness instance
      const freshHarness = new GameTestHarness();
      await freshHarness.setup();

      console.log(`[EMP-STO-01] Fresh harness initial high score: ${freshHarness.game.highScore}`);
      
      // Flaw check: fresh setup() should isolate/clear localStorage
      expect(freshHarness.game.highScore).toBe(0);
      
      freshHarness.teardown();
    });

    it('EMP-DOM-01: DOM Inspection Query Overhead Benchmark', () => {
      harness.pressKey('Space'); // Start game

      const t0 = performance.now();
      const iterations = 10000;
      for (let i = 0; i < iterations; i++) {
        harness.getDisplayedScore();
        harness.getDisplayedHighScore();
        harness.isStartScreenVisible();
        harness.isPauseOverlayVisible();
        harness.isGameOverScreenVisible();
      }
      const t1 = performance.now();

      const timePerQueryBatch = (t1 - t0) / iterations;
      console.log(`[EMP-DOM-01] ${iterations} DOM inspection query batches completed in ${(t1 - t0).toFixed(2)}ms (${timePerQueryBatch.toFixed(4)}ms/batch)`);

      expect(t1 - t0).toBeLessThan(2000); // 10k queries under 2 seconds
    });
  });
});
