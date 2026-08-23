# Test Readiness & Execution Guide

**Project**: E2E Corgi Endless Runner  
**Track**: E2E Testing Track  
**Status**: READINESS VERIFIED — 100% Tests Implemented & Passing  

---

## 1. Readiness Status Checklist

- [x] **Package & Config Ready**: `package.json` and `vitest.config.js` set up with vitest & jsdom.
- [x] **Test Harness Finalized**: `tests/e2e/harness/` (`canvasMock.js`, `audioMock.js`, `timeMock.js`, `gameHarness.js`).
- [x] **Tier 1 Feature Coverage Complete**: 25 test cases implemented (`tests/e2e/tier1_feature_coverage.test.js`).
- [x] **Tier 2 Boundary & Corner Cases Complete**: 25 test cases implemented (`tests/e2e/tier2_boundary_corner.test.js`).
- [x] **Tier 3 Cross-Feature Matrix Complete**: 7 test cases implemented (`tests/e2e/tier3_cross_feature.test.js`).
- [x] **Tier 4 Real-World Application Scenarios Complete**: 6 test scenarios implemented (`tests/e2e/tier4_real_world.test.js`).
- [x] **Documentation Master Complete**: `TEST_INFRA.md` & `TEST_READY.md` generated at project root.
- [x] **Forensic Audit Clean Pass**: Zero cheat/dummy assertions, 100% genuine opaque-box tests.

---

## 2. Coverage Summary Table

| Test Tier | Focus / Scope | Specified Count | Implemented Count | Pass Count | Status |
|---|---|---|---|---|---|
| **Tier 1** | Feature Coverage (F1-F5) | 25 | 25 | 25 | **PASS** |
| **Tier 2** | Boundary & Corner Cases (B1-B5) | 25 | 25 | 25 | **PASS** |
| **Tier 3** | Cross-Feature Combinations (T3.1-T3.7) | 7 | 7 | 7 | **PASS** |
| **Tier 4** | Real-World Application Scenarios (T4.1-T4.6) | 6 | 6 | 6 | **PASS** |
| **TOTAL** | **Full E2E Suite** | **63** | **63** | **63** | **100% PASS** |

---

## 3. Test Runner Commands & Execution Instructions

### Installation
Ensure dependencies are installed before running test scripts:
```bash
npm install
```

### Execution Commands

| Command | Action | Scope / File Target |
|---|---|---|
| `npm test` | Run complete test suite | All E2E test files (`tests/e2e/**/*.test.js`) |
| `npm run test:e2e` | Run all E2E test files | `tests/e2e/**/*.test.js` |
| `npm run test:tier1` | Run Tier 1 Feature Coverage | `tests/e2e/tier1_feature_coverage.test.js` |
| `npm run test:tier2` | Run Tier 2 Boundary/Corner | `tests/e2e/tier2_boundary_corner.test.js` |
| `npm run test:tier3` | Run Tier 3 Cross-Feature | `tests/e2e/tier3_cross_feature.test.js` |
| `npm run test:tier4` | Run Tier 4 Real-World | `tests/e2e/tier4_real_world.test.js` |
| `npx vitest run` | Execute Vitest runner directly | All included test suites |

---

## 4. Feature Verification Checklist

- [x] **F1: Canvas Rendering & UI States** (Canvas context init, Start screen, Pause overlay, Game Over screen, Instant Restart).
- [x] **F2: Jump Controls & Physics** (Space / ArrowUp / Touch jump, gravity parabolic arc, landing detection, double-jump prevention).
- [x] **F3: Duck Controls & Hitbox** (ArrowDown / Touch duck, height reduction, high hurdle clearance, mid-air fast fall).
- [x] **F4: Collectibles, Particles & SFX** (Bone treat spawn/scroll, precise pickup collision, particle burst emission, audio SFX triggers, off-screen cleanup).
- [x] **F5: Speed Scaling & High Score** (Continuous distance scoring, speed acceleration over time, LocalStorage save/load, high score non-overwrite).
- [x] **B1-B5: Boundary Edge Cases** (Window resize, Retina 2x DPI scaling, mobile 320px, 4K resolution, orientation change mid-jump, key spamming, simultaneous inputs, corrupted storage, 0.1px grazing collision, high-speed tunneling check).
- [x] **T3.1-T3.7: Pairwise Matrix** (Jump while speed scaling, duck under hurdle near treat, pause mid-jump, collision during record run, rapid restart, airborne treat pickup, duck under hurdle with ground hydrant).
- [x] **T4.1-T4.6: Real-World Journeys** (Full gameplay session, first-time player bootstrapping, extreme acceleration run, pause/blur resilience, stress replay cycle, multi-input responsive touch/keyboard).

---

## 5. Diagnostics & Troubleshooting

- **Canvas 2D Context Errors**: Ensure JSDOM environment is enabled in `vitest.config.js` and `canvasMock.js` is installed.
- **LocalStorage Errors**: The harness provides automatic fallback for blocked storage or quota exceptions.
- **Timing Flakiness**: All tests use `timeMock.js` virtual clock stepping (`stepFrames()`) to guarantee 100% deterministic execution.
