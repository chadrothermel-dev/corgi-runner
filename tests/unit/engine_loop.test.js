import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../js/engine.js';
import { MockCanvas, triggerNextAnimationFrame, getQueuedAnimationFrameCount } from '../mocks/canvas.mock.js';

test('Engine Loop - Idempotency of start() when already running', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let updateCount = 0;
  engine.onUpdate(() => {
    updateCount++;
  });

  engine.start();
  assert.strictEqual(engine.isRunning, true, 'Engine should be running after first start()');
  assert.strictEqual(getQueuedAnimationFrameCount(), 1, 'Should queue exactly 1 animation frame');

  // Call start() a second time while running
  engine.start();
  assert.strictEqual(engine.isRunning, true, 'Engine should still be running after second start()');
  assert.strictEqual(getQueuedAnimationFrameCount(), 1, 'Should NOT queue a duplicate animation frame');

  // Trigger one frame tick
  triggerNextAnimationFrame(1000);
  assert.strictEqual(updateCount, 1, 'Update callback should fire exactly once for frame');

  engine.stop();
  assert.strictEqual(engine.isRunning, false);
});

test('Engine Loop - Idempotency of stop() when already stopped', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  // Stop on non-started engine
  assert.doesNotThrow(() => {
    engine.stop();
  }, 'stop() on unstarted engine should not throw');
  assert.strictEqual(engine.isRunning, false);

  // Start then stop twice
  engine.start();
  assert.strictEqual(engine.isRunning, true);

  engine.stop();
  assert.strictEqual(engine.isRunning, false);

  assert.doesNotThrow(() => {
    engine.stop();
  }, 'Second stop() call should not throw');
  assert.strictEqual(engine.isRunning, false);
  assert.strictEqual(getQueuedAnimationFrameCount(), 0, 'No animation frames should be queued');

  let updateFired = false;
  engine.onUpdate(() => { updateFired = true; });

  triggerNextAnimationFrame(2000);
  assert.strictEqual(updateFired, false, 'No callbacks should fire after engine is stopped');
});

test('Engine Loop - Callback throwing error during update dispatch', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let cb1Fired = false;
  let cb2Fired = false;
  let renderFired = false;

  engine.onUpdate(() => {
    cb1Fired = true;
    throw new Error('Update Callback Error');
  });

  engine.onUpdate(() => {
    cb2Fired = true;
  });

  engine.onRender(() => {
    renderFired = true;
  });

  engine.start();

  // Trigger frame which executes _loop -> update -> cb1 (throws)
  assert.throws(() => {
    triggerNextAnimationFrame(1000);
  }, /Update Callback Error/);

  assert.strictEqual(cb1Fired, true, 'First callback executed');
  assert.strictEqual(cb2Fired, false, 'Second update callback skipped due to throw in first callback');
  assert.strictEqual(renderFired, false, 'Render callback skipped due to throw in update callback');

  // Check state of loop after uncaught exception in callback
  // Remediated check: isRunning is reset to false by try...catch block calling this.stop()
  assert.strictEqual(engine.isRunning, false, 'isRunning flag is reset to false on callback exception');
  assert.strictEqual(getQueuedAnimationFrameCount(), 0, 'Loop is stopped: no frame queued for next tick');

  // start() can now cleanly restart engine loop
  engine.start();
  assert.strictEqual(engine.isRunning, true, 'start() successfully restarts engine loop after exception recovery');
  assert.strictEqual(getQueuedAnimationFrameCount(), 1, 'Animation frame queued upon restart');

  engine.stop();
  assert.strictEqual(engine.isRunning, false);
});

test('Engine Loop - Callback throwing error during render dispatch', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let updateFired = false;
  let render1Fired = false;
  let render2Fired = false;

  engine.onRender(() => {
    render1Fired = true;
    throw new Error('Render Callback Error');
  });

  engine.onRender(() => {
    render2Fired = true;
  });

  engine.onUpdate(() => {
    updateFired = true;
  });

  engine.start();

  assert.throws(() => {
    triggerNextAnimationFrame(1000);
  }, /Render Callback Error/);

  assert.strictEqual(updateFired, true, 'Update ran before render error');
  assert.strictEqual(render1Fired, true, 'First render callback executed');
  assert.strictEqual(render2Fired, false, 'Second render callback skipped due to throw');

  // Check loop state
  assert.strictEqual(engine.isRunning, false, 'isRunning is reset to false on render exception');
  assert.strictEqual(getQueuedAnimationFrameCount(), 0, 'Loop cleaned up without leaving zombie running state');

  engine.stop();
});

test('Engine Loop - Self-unsubscribing a listener during update dispatch', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let countA = 0;
  let countB = 0;

  let unsubscribeA;
  unsubscribeA = engine.onUpdate(() => {
    countA++;
    unsubscribeA(); // Self-unsubscribe on 1st tick
  });

  engine.onUpdate(() => {
    countB++;
  });

  engine.start();

  // Tick 1
  triggerNextAnimationFrame(1000);
  assert.strictEqual(countA, 1, 'Listener A ran on tick 1');
  assert.strictEqual(countB, 1, 'Listener B ran on tick 1');

  // Tick 2
  triggerNextAnimationFrame(1067);
  assert.strictEqual(countA, 1, 'Listener A did not run on tick 2 after unsubscribing');
  assert.strictEqual(countB, 2, 'Listener B ran on tick 2');

  engine.stop();
});

test('Engine Loop - Unsubscribing target listener during dispatch (peer unsubscribe)', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let countA = 0;
  let countB = 0;

  let unsubscribeB;

  engine.onUpdate(() => {
    countA++;
    if (unsubscribeB) {
      unsubscribeB(); // Listener A unsubscribes Listener B during dispatch
    }
  });

  unsubscribeB = engine.onUpdate(() => {
    countB++;
  });

  engine.start();

  // Tick 1: Listener A runs and unsubscribes B.
  // Because listeners array was copied or re-assigned on unsubscribe (filter),
  // let's observe whether B runs on Tick 1 or is skipped.
  triggerNextAnimationFrame(1000);
  assert.strictEqual(countA, 1);
  assert.strictEqual(countB, 1, 'Listener B still ran on Tick 1 because iteration operated on original array reference');

  // Tick 2: Listener B should NOT run
  triggerNextAnimationFrame(1067);
  assert.strictEqual(countA, 2);
  assert.strictEqual(countB, 1, 'Listener B did not run on Tick 2');

  engine.stop();
});

test('Engine Loop - Registering new listener during update dispatch', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let countA = 0;
  let countB = 0;

  engine.onUpdate(() => {
    countA++;
    if (countA === 1) {
      engine.onUpdate(() => {
        countB++;
      });
    }
  });

  engine.start();

  // Tick 1
  triggerNextAnimationFrame(1000);
  assert.strictEqual(countA, 1);
  assert.strictEqual(countB, 0, 'Newly added listener does not execute in the middle of current tick');

  // Tick 2
  triggerNextAnimationFrame(1067);
  assert.strictEqual(countA, 2);
  assert.strictEqual(countB, 1, 'Newly added listener executes on subsequent tick');

  engine.stop();
});
