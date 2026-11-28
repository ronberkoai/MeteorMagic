# Playtesting the test build

## What the build contains (about 10 to 15 minutes)

All text is shown in both Hebrew and English. A new game opens with a short scene (about 30 seconds) about the bandits and the meteor. Press **Skip**, Esc or Enter to skip it.

1. **The Burning Crater** (dark): movement tutorial.
2. **Village Entrance** (dark): Ember Siphon. Tap **E** near a torch, then **F** to burn resin barriers. There's a cracked wall secret here; come back with the dash.
3. **The Burned Bridge** (dusk): the first Archer. Siphon its fire arrows out of the air and send them back.
4. **Edge of the Glowing Forest** (fantasy): the colours come back. A cracked wall blocks the way, and steps lead down.
5. **Temple of Beacons**: light both beacons before the first one fades (14 s), with one fireball per charge. The reward is **Kinetic Surge** (Shift/K dash).
6. **Windswept Cliffs** (fantasy): dash over spike pits. The first Shield Brute, plus a hidden heart shard.
7. **Bandit Patrol Camp** (night): archers, a brute and an explosive barrel. Defeat them all to break the gate and reach the end screen.

## Controls

| Action | Keyboard | Gamepad |
|---|---|---|
| Move | A/D or ←/→ | Left stick / d-pad |
| Jump (hold for higher) | Space or Z | A |
| Drop through planks | S/↓ + Jump | Down + A |
| Siphon (tap) | E or J | X |
| Release fireball (aim with W/S/↑/↓) | F or L | Y or RB |
| Kinetic Surge dash | Shift or K | B or LB |
| Pause | Esc or P | Start |
| Mute | M | — |

## Playing on a phone

Open the same link on a phone and turn it sideways. On-screen controls appear automatically:

- **Left thumb**: touch anywhere on the left side and drag to move. Drag up or down to aim. Drag down and press Jump to drop through planks.
- **Right thumb**: **Jump**, **Siphon**, **Fire**, and **Dash** (it lights up once you find the Kinetic Surge).
- **❚❚** at the top pauses.

Add `?touch` to the link to force the touch controls on a laptop with a touchscreen.

## Questions for testers

- Where did you get stuck, and for how long? Did the signs explain enough?
- Did catching fire arrows feel fair? Was the siphon timing too strict or too loose?
- Was the temple puzzle clear? Was 14 s too short?
- Did you find both heart shards?
- Did the dark and colourful areas feel different? Did any area feel too dark to read?
- Did the opening scene explain why you are here? Was it too long?
- Did the jump and dash feel natural? Too floaty or too heavy?
- Was the Hebrew or English text ever cut off, cramped or hard to read?
- Any stutter or slowdown? Which browser and machine?

## Developer shortcuts

Open the browser console:

```js
// jump to any room: crater, village, bridge, forest, temple, cliffs, camp
__MM__.game.scene.getScene('Game').scene.restart({ room: 'temple', x: 300, y: 600, mode: 'start' })
__MM__.session.state.powers.dash = true   // takes effect on the next room load
```

To reset progress, start a **New game** from the title screen.
