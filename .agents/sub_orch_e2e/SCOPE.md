# Scope: E2E Testing Track — Corgi Endless Runner

## Objectives
Design and construct an automated, requirement-driven, opaque-box E2E test suite for the Corgi Endless Runner HTML5 Canvas game.

## Requirements
- Derive test cases directly from `ORIGINAL_REQUEST.md`.
- Implement test harness (e.g. Node.js with Playwright/Puppeteer/jsdom or automated HTML/Canvas runner scripts) to execute tests.
- Cover 4 Tiers of tests:
  - Tier 1: Feature Coverage (>=5 per feature: Canvas rendering, Jump control, Duck control, Treat collection, Speed increase)
  - Tier 2: Boundary & Corner Cases (>=5 per feature: Canvas resize, rapid keypresses, simultaneous inputs, high score LocalStorage limits, collision boundary edges)
  - Tier 3: Cross-Feature Combinations (Pairwise feature tests: jump while speed scaling, duck during treat spawn, pause during game over, etc.)
  - Tier 4: Real-World Application Scenarios (Full gameplay run: start -> run & dodge 5 obstacles -> collect 3 treats -> pause/resume -> collision crash -> game over screen -> restart -> verify score persisted)
- Generate `TEST_INFRA.md` and `TEST_READY.md` at project root (`c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner`).

## Deliverables
1. Automated test suite in `tests/e2e/`
2. Command/script to run all tests
3. `TEST_INFRA.md` describing test architecture and tier breakdown
4. `TEST_READY.md` containing test readiness checklist and execution instructions
