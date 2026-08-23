import test from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../../js/engine.js';
import { MockCanvas, triggerNextAnimationFrame } from '../mocks/canvas.mock.js';

test('Engine - Initial state should be START and not running', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);
  assert.strictEqual(engine.getState(), Engine.STATES.START);
  assert.strictEqual(engine.isRunning, false);
});

test('Engine - Valid state transitions', () => {
  const engine = new Engine(new MockCanvas());
  
  engine.setState(Engine.STATES.PLAYING);
  assert.strictEqual(engine.getState(), 'PLAYING');

  engine.setState(Engine.STATES.PAUSED);
  assert.strictEqual(engine.getState(), 'PAUSED');

  engine.setState(Engine.STATES.GAMEOVER);
  assert.strictEqual(engine.getState(), 'GAMEOVER');

  engine.setState(Engine.STATES.START);
  assert.strictEqual(engine.getState(), 'START');
});

test('Engine - Invalid state throws error', () => {
  const engine = new Engine(new MockCanvas());
  
  assert.throws(
    () => engine.setState('UNKNOWN_STATE'),
    { message: /Invalid engine state: UNKNOWN_STATE/ }
  );

  assert.throws(
    () => engine.setState(12345),
    { message: /Invalid engine state: 12345/ }
  );
});

test('Engine - Start and stop loop state', () => {
  const engine = new Engine(new MockCanvas());
  
  engine.start();
  assert.strictEqual(engine.isRunning, true);

  engine.stop();
  assert.strictEqual(engine.isRunning, false);
});

test('Engine - Event subscriptions fire correctly', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  let stateChangeCalled = false;
  let receivedNewState = null;
  let receivedOldState = null;

  const unsubscribeState = engine.onStateChange((newState, oldState) => {
    stateChangeCalled = true;
    receivedNewState = newState;
    receivedOldState = oldState;
  });

  engine.setState(Engine.STATES.PLAYING);
  assert.strictEqual(stateChangeCalled, true);
  assert.strictEqual(receivedNewState, 'PLAYING');
  assert.strictEqual(receivedOldState, 'START');

  // Test unsubscribe
  stateChangeCalled = false;
  unsubscribeState();
  engine.setState(Engine.STATES.PAUSED);
  assert.strictEqual(stateChangeCalled, false);

  // Test update and render listeners
  let updateFired = false;
  let updateDelta = null;
  let renderFired = false;
  let renderCtx = null;

  engine.onUpdate((dt) => {
    updateFired = true;
    updateDelta = dt;
  });

  engine.onRender((ctx) => {
    renderFired = true;
    renderCtx = ctx;
  });

  engine.start();
  triggerNextAnimationFrame(1000);

  assert.strictEqual(updateFired, true);
  assert.notStrictEqual(updateDelta, null);
  assert.strictEqual(renderFired, true);
  assert.strictEqual(renderCtx, canvas.getContext('2d'));

  engine.stop();
});

test('Engine - Delta time clamping at max 0.1s', () => {
  const engine = new Engine(new MockCanvas());
  let lastDelta = null;

  engine.onUpdate((dt) => {
    lastDelta = dt;
  });

  engine.start();
  // Frame 1 at t=1000ms
  triggerNextAnimationFrame(1000);

  // Frame 2 at t=6000ms (5 second gap)
  triggerNextAnimationFrame(6000);

  assert.strictEqual(lastDelta, 0.1);

  engine.stop();
});

test('Engine - Render clears canvas context', () => {
  const canvas = new MockCanvas();
  const engine = new Engine(canvas);

  engine.render();

  const ctxCalls = canvas.getContext('2d').calls;
  const clearRectCall = ctxCalls.find((call) => call.method === 'clearRect');
  assert.notStrictEqual(clearRectCall, undefined);
  assert.deepStrictEqual(clearRectCall.args, [0, 0, 800, 450]);
});

test('Engine - Frame 1 delta initialization resets to 0 to prevent timestamp jumps', () => {
  const engine = new Engine(new MockCanvas());
  const deltas = [];

  engine.onUpdate((dt) => {
    deltas.push(dt);
  });

  engine.start();
  // Frame 1 with high timestamp (e.g. 50000ms)
  triggerNextAnimationFrame(50000);
  assert.strictEqual(deltas[0], 0, 'Frame 1 delta time must be 0 regardless of initial RAF timestamp');

  // Frame 2 tick after 16.6ms
  triggerNextAnimationFrame(50016.667);
  assert.strictEqual(Math.round(deltas[1] * 1000) / 1000, 0.017, 'Frame 2 delta calculates normal elapsed time');

  engine.stop();
});

test('Engine - Exception recovery on subscriber error resets isRunning to false and allows restart', () => {
  const engine = new Engine(new MockCanvas());
  let healthyRan = false;

  const unsubFailing = engine.onUpdate(() => {
    throw new Error('Subscriber Failure');
  });

  engine.start();
  assert.strictEqual(engine.isRunning, true);

  assert.throws(() => {
    triggerNextAnimationFrame(1000);
  }, /Subscriber Failure/);

  assert.strictEqual(engine.isRunning, false, 'Engine isRunning must be false after subscriber exception');

  // Cleanup failing subscriber and restart engine
  unsubFailing();
  engine.onUpdate(() => {
    healthyRan = true;
  });

  engine.start();
  assert.strictEqual(engine.isRunning, true, 'Engine starts cleanly after exception cleanup');

  triggerNextAnimationFrame(1016);
  assert.strictEqual(healthyRan, true, 'Healthy subscriber executes on restarted engine');

  engine.stop();
});

