# Execution Plan — Sub-Orchestrator E2E Testing Track

## Objective
Design and implement a complete, requirement-driven, opaque-box E2E test suite for the Corgi Endless Runner HTML5 Canvas game covering Tiers 1-4, test runner, `TEST_INFRA.md`, and `TEST_READY.md`.

## Iteration 1 Plan

### Phase 1: Exploration & Architecture (Explorers)
- Dispatch 3 `teamwork_preview_explorer` subagents to analyze `ORIGINAL_REQUEST.md` and standard web canvas/game testing methodologies.
- Produce detailed feature inventory, category-partitioning, boundary value definitions, pairwise matrix, and real-world scenario outlines.
- Propose test runner technology choice (e.g. Node.js + Vitest/Jest/Playwright/jsdom or custom Node canvas runner script) compatible with Windows shell and 60 FPS Canvas mock/DOM environment.

### Phase 2: Implementation (Worker)
- Dispatch `teamwork_preview_worker` to write:
  1. Test runner configuration & npm scripts / standalone test runner (`package.json`, test harness).
  2. `tests/e2e/tier1_feature_coverage.test.js` (>= 25 test cases covering Core Mechanics, Scoring, Audio, Visuals, UI state).
  3. `tests/e2e/tier2_boundary_corner.test.js` (>= 25 test cases covering boundary values, extreme canvas dimensions, rapid keypresses, simultaneous inputs, LocalStorage limits, collision box edges).
  4. `tests/e2e/tier3_cross_feature.test.js` (>= 5 test cases covering pairwise feature interactions).
  5. `tests/e2e/tier4_real_world.test.js` (>= 5 test cases covering full E2E application scenarios: start -> dodge obstacles -> collect treats -> pause/resume -> crash -> game over -> restart -> high score persistence).
  6. `TEST_INFRA.md` at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_INFRA.md`).
  7. `TEST_READY.md` at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner\TEST_READY.md`).

### Phase 3: Review & Verification (Reviewers, Challengers, Forensic Auditor)
- Dispatch 2 `teamwork_preview_reviewer` subagents for static analysis, coverage requirement validation, and code review.
- Dispatch 2 `teamwork_preview_challenger` subagents to execute the test suite, test failure conditions, verify test independence.
- Dispatch 1 `teamwork_preview_auditor` subagent for forensic integrity check (verify zero hardcoded pass flags, fake assertions, or dummy tests).

### Phase 4: Gate & Parent Notification
- Validate all 4 gate pass criteria.
- Update `TEST_READY.md` status.
- Send notification to Parent Orchestrator (`f04dfa2a-372f-497f-810c-1969f3195f85`).
