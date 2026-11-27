# MeteorMagic: Design and Code Review

Source: the Gemini planning conversation (Hebrew) that defined the concept, the roadmap and a first set of code fragments (`Player.ts`, `GreyboxScene.ts`, `BanditScout.ts`, `LightingManager.ts`, `LevelLoader.ts`, `GameHUD.tsx`, `App.tsx`, `eventBus.ts`, `types.ts`).

This document has three parts: what is strong and should be kept, design improvements, and concrete code issues to fix before the code becomes the foundation of the game.

---

## 1. What is strong (keep it)

- **One verb drives everything.** "Absorb and release" (ספיגה ושחרור) serves combat, puzzles and traversal at once. That is the best decision in the whole thread: every new power extends a mechanic the player already knows instead of adding a new button.
- **Four tiered powers instead of dozens.** Ember Siphon (ספיגת רשף) → Kinetic Surge (הדף קינטי) → Astral Forge (גיבוש קריסטל) → Overcharge (תהודה). Right size for a solo developer.
- **Visual contrast as storytelling.** Colourful fantasy in free areas, dark and atmospheric in bandit-held areas, with the meteor glow as the main light source. It ties art direction to narrative and gives dynamic lighting a gameplay reason to exist.
- **Compact world.** Five connected biomes for 3 to 5 hours of play is realistic and dense.
- **Greybox first.** "Don't move to phase 2 until running, jumping and absorbing fire in an empty room is fun" is exactly the right gate.
- **Game-feel details are specified up front.** Coyote time, jump buffering, variable jump height, acceleration and drag, hit-stop, screen shake, telegraphed enemy attacks, i-frames.
- **Sensible tooling.** Phaser (Arcade physics, tilemaps, particles, lights), React only for UI, LDtk in GridVania mode, Howler for crossfading music.

---

## 2. Design improvements

### 2.1 Absorbing needs a cost or a skill window
In the current design (and code) the player can hold `E` permanently. That makes the hero immune to fire arrows and lets them refill the 10-second charge forever by standing next to a fire. Pick one or more:
- **Timing window (parry-style):** absorption is active for ~250 ms after pressing, followed by a short cooldown. Absorbing an arrow becomes a skill moment, which also foreshadows Kinetic Surge (absorbing a hit).
- **Siphoning roots or slows the player** while held.
- **Sources deplete:** a torch goes out for a few seconds after being drained. The thread already suggests this as a puzzle tool ("extinguishing a torch can lower a gate"). Make it the default rule.

### 2.2 Design the energy model for all four powers now
Overcharge combines *two* absorbed energies, so the energy system must eventually hold more than one charge. Decide now:
- **Energy types:** `FIRE` (torches, arrows), `KINETIC` (parried hits, fall momentum), `ASTRAL` (meteor energy, the hero's own reserve that fuels Astral Forge). Avoid adding more element types (ice, water) unless a biome truly needs them.
- **Slots:** one slot until Overcharge is unlocked, then two. Overcharge fires when both slots are full.
- **What the timer means:** a 10-second decay per slot, shown on the player's light and HUD.

Build `EnergySystem` around this model from day one (see 3.1), even if only `FIRE` is implemented in the prototype.

### 2.3 Release needs aiming
Release only fires horizontally in the code, yet the planned puzzles put braziers on different heights and use crystals as relays. Support at least 8-direction aiming (keyboard: direction keys while releasing; gamepad: left stick). Without it the "temple of beacons" puzzle cannot be built.

### 2.4 Make sure every power gates traversal (gate matrix)
A Metroidvania lives on "I saw that place earlier and now I can get there". Build a simple table early and keep it updated:

| Power | Combat use | Gate it opens | Example obstacle |
|---|---|---|---|
| Ember Siphon | Fireball, return arrows | Burnable resin walls, unlit braziers | Resin barrier in the village entrance |
| Kinetic Surge | Knock enemies into pits, break shields | Cracked walls, long gaps (dash), heavy blocks | Gap on the windswept plateau |
| Astral Forge | Temporary cover, pin an enemy | Climbing platforms, laser blockers, energy relay | Shaft in the crystal mines |
| Overcharge | Armour-breaking area pulse | Dual-timing ancient mechanisms, pitch-dark rooms | Fortress core |

Plan at least 2 or 3 backtracking secrets per power in earlier biomes.

### 2.5 Give movement its own progression
Only Kinetic Surge currently adds movement. Consider wall-jump as a base move from the start (it keeps vertical rooms interesting), and treat dash and double jump as the Kinetic Surge upgrades.

### 2.6 Story and characters
- Name the hero and the bandit leader early; it helps the art prompts and the writing.
- The hook is good: the bandits burned the village while hunting meteor shards ("אבני אפר") for war machines. Show it through environment and short lines from survivors in the hub, not long dialogue.
- Consider a personal stake beyond revenge (a missing family member held in the fortress) to motivate the final act.

### 2.7 Language and localisation
The creator writes in Hebrew. Decide whether the game ships in Hebrew, English or both. If both, put all strings in a small i18n table from the first HUD text and make the React UI handle RTL (`dir="rtl"`). Retrofitting this later is painful.

### 2.8 Input and accessibility
Browser players use keyboards *and* gamepads. Add an input abstraction (actions like `jump`, `absorb`, `release`, `aim`) with keyboard and Gamepad API bindings, rebindable keys, and options for screen shake intensity and hold-vs-toggle absorb.

### 2.9 Scope and schedule
"Six months for 3 to 5 hours, 5 biomes, 4 powers, 3 bosses and 4 to 5 enemy types" is optimistic for one person even with AI tools. Treat the 10-minute vertical slice as a **go/no-go gate**: measure how long it actually took and re-plan production from that number. A realistic range is 9 to 12 months part-time. Cutting a biome is a valid outcome.

### 2.10 AI-generated assets
- Run a short **art spike** before the vertical slice: one tileset, one parallax set and the hero's idle/run, to prove the AI pipeline gives consistent results. If it does not, switch to a simpler style (or commissioned/purchased packs) early.
- Lock a style guide: tile size (pick **32×32** with internal resolution **640×360**, which scales to 1080p cleanly; or 48×48 at 960×540; not a mix), two fixed palettes, outline rules, light direction.
- Check the licence terms of the AI tools you use, and the distribution platform rules (for example, Steam requires disclosing AI-generated content).

---

## 3. Code review

The fragments are a solid starting point and mostly idiomatic Phaser 3. The issues below are ordered by importance.

### 3.1 Architecture drift: energy logic lives inside the scene
The plan describes `systems/EnergySystem.ts` as a state machine, but the code puts all energy state (`energy`, `energyTimer`, absorb loop, release) inside `GreyboxScene`. Every new scene would have to copy it.
**Fix:** a pure TypeScript `EnergySystem` class with no Phaser dependency (`tryAbsorb(source)`, `release(direction)`, `update(delta)`, `slots`, events). Pure logic is unit-testable with Vitest, and it is the part with the most rules.

### 3.2 Infinite charge while holding absorb
`handleEnergy` resets `energyTimer` to 10 s on every frame `E` is held near a fire source. Combined with in-air arrow absorption at 78 px, holding `E` is a permanent shield and a permanent charge. See 2.1 for design options; in code, only absorb on a state transition, and apply cooldown or depletion.

### 3.3 Absorb area is a circle around the player, not "in front"
The text says a hitbox *in front of* the player; the code uses a 75 px distance check from the player centre in all directions. Decide which you want (in front is more readable and skilful) and use an overlap zone attached to the player.

### 3.4 Puzzle logic is hard-wired
Lighting the brazier calls `openDoor()` directly, and there is a single `this.door` field. The phase-1 definition of done needs *two* braziers to open a door, and the LDtk loader overwrites `this.door` if a level has more than one.
**Fix:** a small puzzle/trigger system. Each trigger (brazier, pressure plate, receiver) has an id; each target (door, gate, bridge) lists the trigger ids it needs (`all` / `any`, optional timing window). Define these as LDtk entity reference fields. Emit the planned `PUZZLE_TRIGGER` event instead of calling methods directly.

### 3.5 Initialisation order bug when LevelLoader is connected
In the LevelLoader integration, `LightingManager` must exist before `loadWorld()` (the spawn callbacks call `addFireLight`/`applyLighting`), but its constructor takes `this.player.x/y`, and the player is only created after `loadWorld()`. As written this throws.
**Fix:** construct `LightingManager` without the player position (attach the player light later via `attachPlayer(player)`), or collect spawns first and instantiate entities afterwards.

### 3.6 Only one bandit is updated
After moving to LDtk, bandits go into `this.bandits` (a group), but `update()` still calls `this.bandit.updateAI(...)` and the projectile overlap still targets `this.bandit`. Iterate the group and register overlaps against the group.

### 3.7 Light count and scope
Phaser 3's Light2D pipeline has a maximum number of lights (default 10, configurable via `maxLights`). The loader creates a light for every fire source in the **whole world** at load time, and lit braziers add more. With several rooms this silently exceeds the limit.
**Fix:** activate lights (and enemies, and particle emitters) per room; disable them when the player leaves. Also force `type: Phaser.WEBGL`: with `Phaser.AUTO` a canvas fallback disables lighting completely.

### 3.8 Enemies see and shoot through walls; no ledge check
`BanditScout` detects the player by distance only (320 px horizontally, 90 px vertically), so it fires through walls. The planned ledge detection is missing, so it can walk off platforms. Add a line-of-sight check against the collision grid and a ledge probe ahead of its feet. Also add contact damage, and use `disableBody(true, true)` (or a pool) rather than `destroy()` inside physics callbacks.

### 3.9 HUD updates every frame
While charged, `emitHud()` runs every frame, so React re-renders 60 times a second. Emit discrete events (`energy:changed` with the expiry timestamp, `player:healthChanged`) and let the HUD animate the bar itself with CSS or `requestAnimationFrame`. This is also what the plan originally described.

### 3.10 No death, respawn or reset
`Player.takeDamage` clamps health at 0 and nothing happens. Add death → respawn at the last checkpoint (campfire/crystal) early, because puzzle rooms also need a "reset room" path when the player gets stuck.

### 3.11 LevelLoader robustness
- `layerInstances` can be `null` when LDtk's "save levels in separate files" option is on; handle it or document that the option must stay off.
- Entity position assumes a top-left pivot. Either set all entity pivots to (0,0) in LDtk or use `__pivot` in the calculation.
- Merged colliders are sprites using the visible `tex_ground` texture. Once real tiles are rendered, colliders should be invisible bodies (zones/rectangles) and the visuals should come from LDtk's tile/auto layers.
- Merging only horizontal runs is fine; a greedy rectangle merge cuts body count further if needed.
- Camera `setBounds` snaps instantly when entering a room, and rooms smaller than the viewport will show outside space. Add a short pan/fade transition and make the minimum room size equal to the viewport.
- Use the player's feet (or require a margin) for room detection to avoid flicker at room seams.

### 3.12 Smaller things
- The first `Player` sketch used `cursors.up` for jumping; the later one uses `Space`. Settle on the input abstraction (2.8).
- Static bodies don't follow tweens: the door slides visually while its body stays put until `disableBody`. Fine for greybox; for production, move the body with `refreshBody()` or use a kinematic body.
- Under React StrictMode in development, `useEffect` runs twice, creating and destroying the game; the module-level `eventBus` keeps listeners across hot reloads. Guard against double creation and clear listeners on destroy.
- Magic numbers (speeds, timers, radii) should live in one `tuning.ts` so they can be adjusted live (a debug panel is cheap with React).
- Pin the Phaser version. The fragments use the Phaser 3 API (`setPipeline('Light2D')`). Phaser 4 changes how lighting is enabled on objects, so choose one at project start and don't mix examples from both.

---

## 4. Missing pieces the plan does not cover

- **Automated tests** for pure logic (energy, puzzles, save data), plus CI on every PR.
- **Continuous deployment** of a playable build (GitHub Pages or itch.io via butler) so every milestone can be playtested from a link.
- **Save data versioning** (a `version` field and migrations) before the first external playtest.
- **Debug tools:** physics debug toggle, room teleport, give-power cheats, FPS counter.
- **Performance budget:** 60 FPS on a mid-range laptop and a Chromebook-class device; measure lights, particles and body count per room.
- **Analytics for playtests:** where players die and where they get stuck (even a simple local log they can export).
