# MeteorMagic: Implementation Plan

This plan builds on the roadmap from the original planning thread (greybox → vertical slice → production → polish) and folds in the fixes from [REVIEW.md](REVIEW.md). Durations assume one developer working part-time with AI assistance; treat them as estimates to be re-measured at each gate.

## Guiding rules

1. **Playable at every milestone.** Every merge to `main` deploys a build that can be opened from a link.
2. **Logic in plain TypeScript, presentation in Phaser, UI in React.** Game rules (energy, puzzles, save data, progression) have no Phaser imports and have unit tests.
3. **Data-driven content.** Rooms, entities, puzzle wiring and tuning values come from LDtk and config files, not code.
4. **Gates, not dates.** Don't start the next phase until the current definition of done is met.

## Target architecture

```
src/
├── main.tsx / App.tsx           React shell, mounts the game once
├── game/
│   ├── createGame.ts            Phaser config (WEBGL, Arcade, Scale.FIT, 640x360 internal)
│   ├── scenes/
│   │   ├── BootScene.ts         Load assets and LDtk project
│   │   ├── WorldScene.ts        Rooms, camera, entities, room activation
│   │   └── GreyboxScene.ts      Phase 1 sandbox (kept as a test room)
│   ├── entities/                Player, BanditScout, Brazier, ResinBarrier, Door, ...
│   ├── systems/
│   │   ├── LevelLoader.ts       LDtk → rooms, colliders, entity spawns
│   │   ├── RoomManager.ts       Active room, camera transitions, activate/deactivate
│   │   ├── LightingManager.ts   Ambient by mood, per-room lights, player light
│   │   └── AudioManager.ts      Howler, music crossfade by mood
│   └── input/InputManager.ts    Actions: move, jump, absorb, release, aim; keyboard + gamepad
├── logic/                       Pure TS, unit tested
│   ├── energy/EnergySystem.ts   Slots, types, decay, absorb/release rules
│   ├── puzzles/TriggerGraph.ts  Triggers → targets (all/any, timing windows)
│   ├── progression.ts           Unlocked powers, collected shards
│   └── save/SaveData.ts         Versioned save schema + migrations
├── ui/                          GameHUD, DialogueBox, PauseMenu, MapScreen, DebugPanel
├── shared/
│   ├── eventBus.ts              Typed events
│   ├── types.ts
│   ├── tuning.ts                All gameplay numbers
│   └── i18n/                    he.json, en.json
└── tests/
```

---

## Phase 0: Foundations (about 1 week)

**Goal:** an empty but professional project that builds, tests and deploys.

- [ ] Scaffold Vite + React + TypeScript (strict), pin the Phaser version (decide Phaser 3.x vs 4; this plan assumes the Phaser 3 API used in the original fragments).
- [ ] ESLint + Prettier; Vitest for unit tests.
- [ ] GitHub Actions: typecheck, lint, test on every PR; deploy `main` to GitHub Pages.
- [ ] `tuning.ts`, typed `eventBus.ts`, `i18n` stub (decide Hebrew, English or both; RTL support in UI if Hebrew).
- [ ] Debug overlay toggle (FPS, physics debug).
- [ ] Decide internal resolution and tile size (recommended 640×360 with 32×32 tiles).

**Done when:** a PR runs CI green, and merging it publishes a page with a blank Phaser canvas and a React HUD stub.

## Phase 1: Greybox prototype "החדר האפור" (about 3 to 4 weeks)

**Goal:** coloured rectangles only, and it already feels good to move, absorb and release.

Week 1: movement and input
- [ ] `InputManager` with keyboard and gamepad bindings.
- [ ] Player: acceleration/drag, coyote time (100 ms), jump buffer (120 ms), variable jump height, wall-slide/wall-jump (optional but recommended).
- [ ] Death and respawn at checkpoint; room reset.

Week 2: Ember Siphon on a real `EnergySystem`
- [ ] Pure `EnergySystem` with tests: one slot, `FIRE` type, 10 s decay, absorb rules (timing window or depletion, see REVIEW 2.1), release.
- [ ] Absorb zone in front of the player; torches/fires deplete temporarily after being drained.
- [ ] 8-direction aimed release; fireball projectile pool.
- [ ] Puzzle objects: Brazier, ResinBarrier, Door, wired through `TriggerGraph` (door needs 2 braziers).

Week 3: first bandit and HUD
- [ ] `BanditScout`: PATROL → ALERT/WINDUP (telegraph) → ATTACK → COOLDOWN, STAGGERED; line of sight and ledge check; contact damage.
- [ ] Fire arrows that can be absorbed in flight (within the absorb rules).
- [ ] Player health, i-frames, knockback.
- [ ] HUD via discrete events (health, energy slot with expiry); no per-frame React renders.

Week 4: lighting test and tuning pass
- [ ] `LightingManager` (dark/fantasy ambient, player light that grows and flickers when charged, fire lights), with the init-order fix.
- [ ] Debug panel for live tuning of movement and energy numbers.
- [ ] Informal playtest with 2 or 3 people.

**Done when (from the original plan, extended):** 2 or 3 connected grey rooms where the player jumps smoothly, absorbs fire from a campfire and from a bandit arrow, melts a barrier, lights 2 braziers that open a door, sees the energy drain on the HUD, can die and respawn; tests pass in CI.

## Phase 2: World pipeline (about 2 weeks)

**Goal:** rooms come from LDtk; the game can grow without code changes.

- [ ] LDtk project (GridVania): `Collisions` IntGrid, `Entities` layer, level field `mood`, entity reference fields for puzzle wiring, entity pivots at (0,0).
- [ ] `LevelLoader`: merged invisible colliders, entity spawns via a registry (not a fixed callback list), null-layer handling.
- [ ] `RoomManager`: room detection from the player's feet, camera bounds with a short pan/fade, minimum room size = viewport, activate/deactivate enemies, lights and emitters per room.
- [ ] Checkpoints (campfire/crystal) save position and progression to `localStorage` with a versioned schema.
- [ ] Debug: teleport to room, grant power.

**Done when:** the Phase 1 rooms are rebuilt in LDtk with no behaviour change, and a new room can be added by editing only the LDtk file.

## Phase 3: Vertical slice, a 10-minute demo (about 6 weeks)

**Goal:** prove the art direction and the dark ↔ fantasy contrast; get real player feedback.

- [ ] **Art spike first (week 1):** one tileset, one 3-layer parallax set (scroll 0.15 / 0.4 / 1.0), hero idle and run. Confirm the AI pipeline produces a consistent style; lock the style guide and the two palettes. Fall back to another style if it doesn't.
- [ ] Six rooms from the original plan: Burning Crater, Village Entrance, Burned Bridge (dark → colourful transition), Glowing Forest Edge, Temple of Beacons (core puzzle inside the 10 s timer), Bandit Patrol Camp (2 bandits + explosive barrel, locked gate ending).
- [ ] Hero animations: idle 4, run 6, jump/fall 2, absorb/release 3 frames. Bandit animations.
- [ ] Optional normal maps (e.g. Laigter) for dark-room depth.
- [ ] Audio: two music beds with a 1.5 s crossfade by room mood; core SFX.
- [ ] Juice: 40 ms hit-stop, gentle screen shake, charged spark trail, siphon particles arcing into the hero, landing dust.
- [ ] Title screen, pause menu, settings (volume, screen shake, rebinding, language).
- [ ] Playtest with 5+ people who haven't seen the game; watch silently; log deaths and stuck points.

**Done when:** a stranger finishes the 10-minute demo without being told what to do, and the build runs at 60 FPS on a mid-range laptop.

### Go / no-go gate
Compare actual time spent on phases 1 to 3 with these estimates, then re-plan Phase 4. Options: keep five biomes, cut to four, or reduce the boss count. Decide here whether the AI art pipeline is good enough for production.

## Phase 4: Production (about 5 to 7 months, re-planned at the gate)

Split into one milestone per biome. Each milestone ships a playable build.

| Milestone | Biome | New power | Content |
|---|---|---|---|
| 4.1 | Village Ruins & Crater (finalise from slice) | Ember Siphon | Tutorial polish |
| 4.2 | Mill Valley & Glowing Forest (hub) | — | Survivor NPCs, first patrol camps, map screen |
| 4.3 | Sunken Crystal Mines (dark) | Astral Forge | Light/shadow puzzles, Engineer bandit |
| 4.4 | Windswept Plateau & Wind Bridges | Kinetic Surge | Vertical platforming, Heavy Shield bandit, mid-boss (patrol commander) |
| 4.5 | Burning Bandit Fortress | Overcharge (2 slots) | All-power puzzles, multi-phase final boss with the meteor machine |

Note: the original thread lists Kinetic Surge as power 2 and Astral Forge as power 3 but places the crystal biome (3) before the plateau (4). Pick the order deliberately: either swap the biomes or swap the power order, so each biome teaches the power it is built around.

Cross-cutting work during Phase 4:
- [ ] Energy types `KINETIC` and `ASTRAL`; second slot and Overcharge combinations in `EnergySystem` (tests first).
- [ ] Enemy roster: Scout, Fire Archer, Heavy Shield, Machine Engineer (+ one flyer if needed).
- [ ] 3 boss fights with readable telegraphs and phase changes.
- [ ] Interactive map with discovered rooms and markers; backtracking secrets (2 or 3 per power); collectible meteor shards that upgrade health/energy.
- [ ] Gate matrix (REVIEW 2.4) kept up to date as the design source of truth.
- [ ] Short story beats in each biome; ending.

**Done when:** the game can be played start to finish in 3 to 5 hours, with no blocking bugs.

## Phase 5: Polish and launch (about 1 to 2 months)

- [ ] Full playtest rounds focused on puzzles (players understand without long text) and difficulty curve.
- [ ] Performance pass on low-end hardware; asset compression; loading screen.
- [ ] Accessibility: rebinding, hold/toggle absorb, reduced shake/flashes, subtitles.
- [ ] Localisation pass (Hebrew/English).
- [ ] Store pages and trailer; release on itch.io (and/or CrazyGames, own site); AI-content disclosure where required.
- [ ] Optional later: desktop build with Tauri or Electron.

---

## Suggested first issues (Phase 0 and 1)

1. Scaffold Vite + React + TS + Phaser with CI and GitHub Pages deploy.
2. `InputManager` with keyboard + gamepad actions.
3. Player movement with coyote time, jump buffer, variable jump, tuning file.
4. `EnergySystem` (pure TS) with unit tests.
5. Absorb zone + aimed release + projectile pool.
6. `TriggerGraph` + Brazier, ResinBarrier, Door.
7. `BanditScout` with LOS, ledge check, telegraph, absorbable arrows.
8. HUD on discrete events; death/respawn.
9. `LightingManager` with init-order fix and per-room lights.

## Open questions for the creator

- Hebrew, English or both at launch?
- Hero and bandit leader names, and any personal stake beyond revenge?
- Absorb rule: timing window, slowdown while siphoning, or depleting sources (or a mix)?
- Power order: Kinetic Surge before Astral Forge, or the other way round?
- Phaser 3 (matches the existing fragments) or Phaser 4?
