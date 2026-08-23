## 2026-07-23T20:40:48Z

You are the Worker (teamwork_preview_worker) for the E2E Testing Track of E2E Corgi Endless Runner.
Your working directory is: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_worker_e2e

Project Root: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner
Scope File: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\sub_orch_e2e\SCOPE.md
Explorer 1 Analysis: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_e2e_1\analysis.md
Explorer 2 Analysis: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_e2e_2\analysis.md
Explorer 3 Analysis: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_explorer_e2e_3\analysis.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Tasks:
1. Create `package.json` at project root with vitest & jsdom dependencies, vitest config (`vitest.config.js`), and scripts (`npm test`, `npm run test:e2e`, `npm run test:tier1`, `npm run test:tier2`, `npm run test:tier3`, `npm run test:tier4`).
2. Create test harness in `tests/e2e/harness/`:
   - `canvasMock.js`: Canvas 2D context mock supporting fillRect, drawImage, fillText, beginPath, arc, etc.
   - `audioMock.js`: Audio API mock tracking play/pause sound calls.
   - `timeMock.js`: Deterministic virtual clock stepping requestAnimationFrame and performance.now.
   - `gameHarness.js`: Opaque-box game runner interface for starting game, dispatching keyboard/touch inputs, checking DOM overlays (#startScreen, #pauseOverlay, #gameOverScreen), checking score display, reading LocalStorage.
3. Author full E2E test suite in `tests/e2e/`:
   - `tier1_feature_coverage.test.js` (25 test cases covering F1-F5 per Explorer 1 analysis)
   - `tier2_boundary_corner.test.js` (25 test cases covering B1-B5 per Explorer 1 analysis)
   - `tier3_cross_feature.test.js` (7 test cases covering T3.1-T3.7 per Explorer 3 analysis)
   - `tier4_real_world.test.js` (6 test cases covering T4.1-T4.6 per Explorer 3 analysis)
4. Run the test suite via build/test commands (`npm test` / `npx vitest run`) and document commands & results in your handoff report.
5. Create `TEST_INFRA.md` at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_INFRA.md`) detailing test philosophy, feature inventory, test harness architecture, tier breakdown, and assertion rules per Explorer 3 design.
6. Create `TEST_READY.md` at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_READY.md`) detailing test runner command, coverage summary table (Tier 1: 25, Tier 2: 25, Tier 3: 7, Tier 4: 6, Total: 63), feature checklist, and execution instructions.
7. Write your completion handoff report to `c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\.agents\teamwork_preview_worker_e2e\handoff.md` including exact build/test run output.
8. Send a completion message to parent sub-orchestrator when finished.
