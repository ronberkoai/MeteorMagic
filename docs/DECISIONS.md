# Decisions log

Ronadi gave Claude the authority to decide open design and technical questions so work could continue without waiting. Each decision below can be revisited; the reason is noted so it is easy to judge.

| # | Question | Decision | Why |
|---|---|---|---|
| 1 | UI language | **English** for the test build. All player-facing strings sit in a few places (`src/logic/world.ts` signs, `src/ui/Overlay.tsx`, toasts in `GameScene.ts`), ready to move into an i18n table with Hebrew (RTL) later. | Wider tester pool. Moving the strings later is cheap. |
| 2 | Engine | **Phaser 3.90** (pinned), Vite, React 18 and TypeScript strict. | Matches the code from the original thread. Phaser 4 changes the lighting API. |
| 3 | Absorb rule (2.1 in REVIEW) | **Tap to open a 320 ms siphon window, then a 380 ms cooldown.** Torches go out for 5 s after being drained. Campfires never go out. One charge = one fireball, and a charge decays after 10 s. | Holding the key is no longer a permanent shield. Catching an arrow is a skill moment, and torches become a light-and-dark puzzle tool. |
| 4 | Siphon shape | A **circle of 100 px** around the hero (not a cone in front). | It reads better with procedural art and keeps the timing window as the skill test. Revisit if playtests feel too easy. |
| 5 | Aiming | **8 directions**: hold up/down (and left/right) while releasing. | It's needed for the beacon puzzles. |
| 6 | Power order | **Ember Siphon, then Kinetic Surge (dash), then Astral Forge, then Overcharge.** The temple is the Kinetic Surge shrine, and the crystal mines (Astral Forge) come later. | The dash is the simplest traversal gate to teach second, and it lets the forest's cracked wall be the first backtracking moment. |
| 7 | Kinetic Surge scope | In this build it is a **dash** (ground and air, i-frames) that breaks cracked walls and stuns shielded bandits. "Absorbing impact" is deferred. | It gives the most traversal value for the least code. |
| 8 | Level format | **ASCII room grids** in `src/logic/world.ts` with world coordinates (GridVania style), instead of LDtk for now. | It needs no editor install and can be unit-tested (row widths, overlaps, aligned exits). The format maps one-to-one to LDtk concepts (IntGrid, entities, level fields, worldX/worldY), so an importer can replace it later. |
| 9 | Lighting | A **darkness overlay with light "holes"** (a RenderTexture plus erased light masks, with additive glow sprites) instead of Phaser's Light2D. | It has no 10-light limit, works under Canvas too, and gives soft, painterly light that suits the dark/fantasy contrast. |
| 10 | Art | **Procedurally generated** characters, tiles, parallax backgrounds and effects (`src/game/gfx/`). | It gives a coherent look with zero asset files. These are placeholders for the AI art pipeline in Phase 3 of the plan. |
| 11 | Audio | **Synthesized WebAudio**: SFX plus two ambient beds (dark and fantasy) that crossfade by room mood. | It needs no asset files. Swap in Howler and recorded audio later. |
| 12 | Resolution | **960×540** internal, **32 px** tiles, `Scale.FIT`. | The thread's tuning numbers were written for 960×540. (REVIEW suggested 640×360; this keeps the existing numbers instead.) |
| 13 | Enemies | **Archer** (fire arrows you can absorb) and **Shield Brute** (blocks fire from the front; dash or a hit from behind breaks through; stuns itself when it charges into a wall). | Two enemies that each teach one power. |
| 14 | Saves | `localStorage`, a versioned schema, saved at campfires and pickups. Enemies respawn when you re-enter a room; burned resin, broken walls, solved puzzles and pickups stay. | Standard Metroidvania expectations. |
| 15 | Hosting | Every push to `main` publishes `dist/` to the `gh-pages` branch. A single-file build (`npm run build:single`) is also shared as a claude.ai artifact. | Testers can play from a link. GitHub Pages needs a one-time switch in repository settings. |
