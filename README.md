# MeteorMagic

A 2D side-scrolling Metroidvania for the browser. A young villager whose home was burned by bandits is fused with a fallen meteor. The meteor lets the hero **absorb** energy from the world (fire, impact, light) and **release** it, as a weapon against the bandits and as the key to puzzles and new paths.

Stack: Vite + React + TypeScript + Phaser 3.90. All art and audio are generated procedurally for now.

## Play

- **Test build:** <https://ronberkoai.github.io/MeteorMagic/> (published from `main` automatically once GitHub Pages is enabled for the `gh-pages` branch)
- **Shareable single-file build:** <https://claude.ai/artifact/Fu66JLrd4dDKxswdNBagJz> (private until shared from claude.ai)
- How to play, controls and what to report: [docs/PLAYTESTING.md](docs/PLAYTESTING.md)

## Develop

```bash
npm install
npm run dev          # local dev server
npm test             # unit tests (energy, puzzles, world data, saves)
npm run build        # production build -> dist/
npm run build:single # one self-contained HTML file -> dist-single/
```

Code map: `src/logic` (pure, tested game rules and room data), `src/game` (Phaser scenes, entities, systems, procedural graphics), `src/ui` (React HUD and menus), `src/shared` (event bus, tuning numbers).

## Docs

- [Design and code review](docs/REVIEW.md): what the original planning thread got right, and what to change.
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md): phased roadmap with milestones and definitions of done.
- [Decisions log](docs/DECISIONS.md): open questions and the defaults chosen.
- [Playtesting guide](docs/PLAYTESTING.md)
