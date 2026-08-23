# Plan — Milestone M1: Core Engine & Canvas Rendering

## Objective
Implement core HTML5 Canvas engine, 60 FPS main game loop with high-precision delta timing, base rendering setup, game state machine (START, PLAYING, PAUSED, GAMEOVER), project static assets (`index.html`, `css/style.css`, `js/main.js`, `js/engine.js`), and unit tests for canvas & engine initialization.

## Step 1: Exploration
- Spawn 3 Explorers (`teamwork_preview_explorer`) to:
  1. Analyze scope, existing project layout, HTML5 Canvas best practices, high-DPI scaling, CSS layout.
  2. Propose precise architecture and API interfaces for `index.html`, `css/style.css`, `js/main.js`, `js/engine.js`, and test setup (e.g. Node-based test runner or HTML-based unit test suite).
  3. Formulate concrete implementation & testing plan for the Worker.

## Step 2: Implementation
- Spawn 1 Worker (`teamwork_preview_worker`) to:
  1. Create project files (`index.html`, `css/style.css`, `js/main.js`, `js/engine.js`).
  2. Implement `Engine` class with state machine, `requestAnimationFrame` loop, delta time calculation, resize handling.
  3. Create automated unit test suite (`tests/unit/engine.test.js` or standard runner) to test state transitions, engine lifecycle, canvas scaling.
  4. Run build and tests, documenting all commands and outcomes in handoff report.

## Step 3: Review & Adversarial Challenge
- Spawn 2 Reviewers (`teamwork_preview_reviewer`) independently to inspect code quality, architecture, state management, test coverage, and layout compliance.
- Spawn 2 Challengers (`teamwork_preview_challenger`) to stress-test timing logic, delta bounds, state edge cases, window resize behavior.

## Step 4: Forensic Audit
- Spawn 1 Forensic Auditor (`teamwork_preview_auditor`) to verify implementation authenticity and integrity (no hardcoded state, genuine loop and event handling).

## Step 5: Gate Evaluation & Parent Handoff
- Evaluate gate pass criteria:
  1. Build & tests pass.
  2. No Reviewer vetoes.
  3. Challenger verification passes.
  4. Forensic Auditor verdict is CLEAN.
- Update scope document and `progress.md`, report completion to Parent (`f04dfa2a-372f-497f-810c-1969f3195f85`).
