# Original User Request

## 2026-07-24T00:39:06Z

An interactive 2D HTML5 canvas endless runner game starring a cute Corgi dodging obstacles, collecting bone treats, and tracking high scores.

Working directory: c:\Users\chadr\OneDrive\Documents\Gemini_Projects\corgi_runner
Integrity mode: development

## Requirements

### R1. Core Game Mechanics & Controls
An endless side-scrolling 2D runner game built using HTML5 Canvas where the player controls a cute animated Corgi that can run, jump, and duck/slide to dodge obstacles (e.g., fire hydrants, hurdles) and collect bone treats.

### R2. Scoring, Audio & Visual Effects
Real-time score display and persistent high-score tracking (via LocalStorage), particle burst effects on treat collection, and sound effects for jumping, collecting treats, and game over.

### R3. User Interface & Game Loop State
Polished, responsive UI overlays including a Start Screen with controls instructions, a Pause overlay, and a Game Over screen with final score, high score indicator, and instant restart option.

## Acceptance Criteria

### Core Gameplay
- [ ] Smooth 60 FPS 2D canvas rendering with responsive keyboard (Space/Up Arrow to jump, Down Arrow to duck) and touch controls.
- [ ] Game speed gradually increases over time to scale difficulty smoothly.
- [ ] Pixel-accurate or precise bounding box collision detection for obstacles and treat pickups.

### Audio, UI & Persistence
- [ ] Interactive Start screen, Pause state, and Game Over screen with immediate replay option.
- [ ] Persistent high score stored across browser reloads using LocalStorage.
- [ ] Sound effects for jump, pickup, and crash sound events.
