import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../js/engine.js';
import { MockCanvas, triggerNextAnimationFrame } from '../mocks/canvas.mock.js';

// ==========================================
// 1. RAPID STATE TRANSITIONS STRESS TESTS
// ==========================================

test('Engine Stress - Rapid 1000 cycle state transition sequence', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let transitionCount = 0;
  const statesRecorded = [];

  engine.onStateChange((newState, oldState) => {
    transitionCount++;
    statesRecorded.push({ newState, oldState });
  });

  const sequence = [
    Engine.STATES.PLAYING,
    Engine.STATES.PAUSED,
    Engine.STATES.PLAYING,
    Engine.STATES.GAMEOVER,
    Engine.STATES.START
  ];

  const CYCLES = 1000;
  for (let i = 0; i < CYCLES; i++) {
    for (const targetState of sequence) {
      engine.setState(targetState);
      assert.strictEqual(engine.getState(), targetState);
    }
  }

  assert.strictEqual(transitionCount, CYCLES * sequence.length);
  assert.strictEqual(engine.getState(), Engine.STATES.START);

  // Check sample transition params
  assert.strictEqual(statesRecorded[0].oldState, Engine.STATES.START);
  assert.strictEqual(statesRecorded[0].newState, Engine.STATES.PLAYING);
  assert.strictEqual(statesRecorded[1].oldState, Engine.STATES.PLAYING);
  assert.strictEqual(statesRecorded[1].newState, Engine.STATES.PAUSED);
});

test('Engine Stress - Re-entrant state transition inside stateChange listener', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const history = [];

  engine.onStateChange((newState, oldState) => {
    history.push({ level: 'listener', newState, oldState });
    // Auto-resume if PAUSED
    if (newState === Engine.STATES.PAUSED) {
      engine.setState(Engine.STATES.PLAYING);
    }
  });

  engine.setState(Engine.STATES.PAUSED);

  // Engine state after re-entrant transition must be PLAYING
  assert.strictEqual(engine.getState(), Engine.STATES.PLAYING);
  assert.strictEqual(history.length, 2);
  assert.strictEqual(history[0].newState, Engine.STATES.PAUSED);
  assert.strictEqual(history[1].newState, Engine.STATES.PLAYING);
  assert.strictEqual(history[1].oldState, Engine.STATES.PAUSED);
});

test('Engine Stress - Rapid sequence throwing invalid state does not corrupt engine state', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  engine.setState(Engine.STATES.PLAYING);

  for (let i = 0; i < 100; i++) {
    assert.throws(() => engine.setState('INVALID_STATE_' + i), /Invalid engine state/);
    assert.strictEqual(engine.getState(), Engine.STATES.PLAYING);
  }
});

// ==========================================
// 2. DELTA TIME CALCULATION EDGE CASES
// ==========================================

test('Engine Stress - Simulated 5000ms tab freeze and delta recovery', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  // Tick 1: Normal initial tick at t=1000ms
  triggerNextAnimationFrame(1000);

  // Tick 2: 5000ms tab freeze gap (t=6000ms)
  triggerNextAnimationFrame(6000);
  assert.strictEqual(deltas[1], 0.1, 'Tab freeze delta must be clamped to max 0.1s');

  // Tick 3: Normal frame tick after freeze (t=6016.6ms)
  triggerNextAnimationFrame(6016.6);
  assert.strictEqual(Math.round(deltas[2] * 10000) / 10000, 0.0166, 'Subsequent frame recovers to standard dt (~16.6ms)');

  engine.stop();
});

test('Engine Stress - Zero delta time tick handling', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  triggerNextAnimationFrame(1000);
  // Identical timestamp on consecutive tick
  triggerNextAnimationFrame(1000);

  assert.strictEqual(deltas[1], 0, 'Delta time for zero-diff frame must be 0');

  engine.stop();
});

test('Engine Stress - Negative delta time (clock skew / backwards jump)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  triggerNextAnimationFrame(1000);
  // Backwards jump in timestamp (t=500ms)
  triggerNextAnimationFrame(500);

  assert.strictEqual(deltas[1], 0, 'Negative delta time must be sanitized to 0');

  // Recovery tick after backward jump (t=516ms)
  triggerNextAnimationFrame(516);
  assert.strictEqual(Math.round(deltas[2] * 1000) / 1000, 0.016, 'Engine recovers after backward clock jump');

  engine.stop();
});

test('Engine Stress - Non-numeric / NaN timestamp fallback behavior in _loop', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  // Tick 1 with performance.now() based timestamp
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  triggerNextAnimationFrame(now);

  // Tick 2 with NaN timestamp: engine triggers fallback to performance.now() or 0
  triggerNextAnimationFrame(NaN);
  assert.strictEqual(typeof deltas[1], 'number', 'Delta time must always be a number');
  assert.strictEqual(isNaN(deltas[1]), false, 'Delta time must never be NaN');
  assert.strictEqual(deltas[1] >= 0, true, 'Delta time must never be negative');

  engine.stop();
});

test('Engine Stress - High frequency 240 FPS ticks (4.16ms per frame)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  let time = 1000;
  for (let i = 0; i <= 240; i++) {
    triggerNextAnimationFrame(time);
    time += 4.166666666666667; // ~240 Hz
  }

  // Check non-initial frame deltas
  for (let i = 1; i < deltas.length; i++) {
    assert.strictEqual(Math.abs(deltas[i] - 0.004166666666666667) < 0.0001, true, `Frame ${i} delta should be ~0.004167s`);
  }

  engine.stop();
});

test('Engine Stress - Extreme tab freeze (60 seconds gap)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  const deltas = [];
  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();

  triggerNextAnimationFrame(1000);
  // 60 second gap
  triggerNextAnimationFrame(61000);

  assert.strictEqual(deltas[1], 0.1, 'Extreme tab freeze delta must be clamped to 0.1s max');

  engine.stop();
});

// ==========================================
// 3. LISTENER MANAGEMENT AND MEMORY LEAKS
// ==========================================

test('Engine Stress - Mass listener registration (10,000 listeners)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let executedCount = 0;
  const unsubscribers = [];

  const MASS_COUNT = 10000;
  for (let i = 0; i < MASS_COUNT; i++) {
    const unsub = engine.onUpdate(() => {
      executedCount++;
    });
    unsubscribers.push(unsub);
  }

  assert.strictEqual(engine.listeners.update.length, MASS_COUNT, 'Should hold 10,000 update listeners');

  engine.start();
  triggerNextAnimationFrame(1000);

  assert.strictEqual(executedCount, MASS_COUNT, 'All 10,000 listeners must execute on frame update');

  engine.stop();
});

test('Engine Stress - Partial mass unsubscription (5,000 of 10,000 unsubscribed)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let executedCount = 0;
  const unsubscribers = [];

  const MASS_COUNT = 10000;
  for (let i = 0; i < MASS_COUNT; i++) {
    const unsub = engine.onUpdate(() => {
      executedCount++;
    });
    unsubscribers.push(unsub);
  }

  // Unsubscribe half (5,000)
  for (let i = 0; i < MASS_COUNT / 2; i++) {
    unsubscribers[i]();
  }

  assert.strictEqual(engine.listeners.update.length, 5000, 'Listener array length should decrease to 5,000');

  executedCount = 0;
  engine.start();
  triggerNextAnimationFrame(1000);

  assert.strictEqual(executedCount, 5000, 'Only remaining 5,000 listeners should execute');

  engine.stop();
});

test('Engine Stress - Full mass unsubscription (all 10,000 unsubscribed)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let executedCount = 0;
  const unsubscribers = [];

  const MASS_COUNT = 10000;
  for (let i = 0; i < MASS_COUNT; i++) {
    const unsub = engine.onUpdate(() => {
      executedCount++;
    });
    unsubscribers.push(unsub);
  }

  // Unsubscribe all 10,000
  for (let i = 0; i < MASS_COUNT; i++) {
    unsubscribers[i]();
  }

  assert.strictEqual(engine.listeners.update.length, 0, 'Listener array length must be 0 after full unsubscription');

  executedCount = 0;
  engine.start();
  triggerNextAnimationFrame(1000);

  assert.strictEqual(executedCount, 0, 'Zero callbacks execute after full unsubscription');

  engine.stop();
});

test('Engine Stress - Duplicate listener registration and complete unsubscribe cleanup', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let callCount = 0;
  const sharedCallback = () => { callCount++; };

  // Register identical callback 10 times
  let lastUnsub;
  for (let i = 0; i < 10; i++) {
    lastUnsub = engine.onUpdate(sharedCallback);
  }

  assert.strictEqual(engine.listeners.update.length, 10);

  // Calling unsubscribe removes all references matching the callback
  lastUnsub();

  assert.strictEqual(engine.listeners.update.length, 0, 'Unsubscribing shared callback clears all duplicate instances');

  engine.start();
  triggerNextAnimationFrame(1000);
  assert.strictEqual(callCount, 0);

  engine.stop();
});

test('Engine Stress - High churn: rapid subscribe/unsubscribe cycles during loop execution', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let persistentCount = 0;
  engine.onUpdate(() => {
    persistentCount++;
  });

  engine.start();

  const CHURN_CYCLES = 1000;
  for (let i = 0; i < CHURN_CYCLES; i++) {
    let ephemeralRan = false;
    const unsub = engine.onUpdate(() => {
      ephemeralRan = true;
    });

    // Tick frame
    triggerNextAnimationFrame(1000 + i * 16.6);

    assert.strictEqual(ephemeralRan, true, `Ephemeral listener should run on tick ${i}`);

    // Immediately unsub
    unsub();
  }

  // Ensure listener array size did not blow up and returned to just 1 persistent listener
  assert.strictEqual(engine.listeners.update.length, 1, 'Listener array must return to 1 after churn');
  assert.strictEqual(persistentCount, CHURN_CYCLES);

  engine.stop();
});
