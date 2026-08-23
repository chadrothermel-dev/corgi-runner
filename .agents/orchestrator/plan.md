# Orchestration Plan — Corgi Endless Runner

## Architecture & Track Setup
1. **Parallel Track 1: E2E Testing Track**
   - Goal: Build opaque-box automated E2E test suite covering Tiers 1-4.
   - Outputs: Test infrastructure, test cases, and `TEST_READY.md`.

2. **Parallel Track 2: Implementation Milestones**
   - **M1**: Core Engine, Main Loop (60 FPS requestAnimationFrame), Canvas setup, State Machine.
   - **M2**: Corgi Player (run, jump, duck states/animation), Keyboard & Touch Controls, Collision Detection Engine.
   - **M3**: Entity Spawner, Obstacles (fire hydrants, hurdles), Bone Treats, Progressive Speed Scaling.
   - **M4**: Real-time Score, LocalStorage Persistence, Web Audio SFX (jump, collect, crash), Particle Burst Effects, UI Overlays (Start, Pause, GameOver).
   - **M5**: Final E2E Integration (Phase 1: pass 100% E2E tests, Phase 2: Tier 5 Adversarial Coverage Hardening).

## Dispatch Strategy
- Spawn Sub-Orchestrator for E2E Testing Track (`.agents/sub_orch_e2e`).
- Spawn Sub-Orchestrator for Milestone M1 (`.agents/sub_orch_m1`).
- Monitor progress via heartbeat cron and `progress.md`.
- Successively spawn sub-orchestrators for M2, M3, M4 as dependencies complete.
