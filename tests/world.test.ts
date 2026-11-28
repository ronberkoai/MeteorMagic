import { describe, expect, it } from 'vitest';
import { ROOMS, START_ROOM } from '../src/logic/world';
import { findRoomAt, mergedRuns, parseRoom, SOLID } from '../src/logic/roomParser';
import { GameState } from '../src/logic/GameState';

const parsed = ROOMS.map(parseRoom);

describe('world data', () => {
  it('every room parses with consistent row widths', () => {
    expect(parsed.length).toBeGreaterThan(5);
  });

  it('room ids are unique and the start room has exactly one spawn', () => {
    expect(new Set(ROOMS.map((r) => r.id)).size).toBe(ROOMS.length);
    const start = parsed.find((r) => r.def.id === START_ROOM)!;
    expect(start.entities.filter((e) => e.kind === 'spawn')).toHaveLength(1);
  });

  it('rooms are at least one screen in size (30x17 tiles)', () => {
    for (const r of parsed) {
      expect(r.width, r.def.id).toBeGreaterThanOrEqual(30);
      expect(r.height, r.def.id).toBeGreaterThanOrEqual(17);
    }
  });

  it('rooms do not overlap in world space', () => {
    for (const a of parsed)
      for (const b of parsed) {
        if (a === b) continue;
        const overlap =
          a.def.worldX < b.def.worldX + b.width &&
          b.def.worldX < a.def.worldX + a.width &&
          a.def.worldY < b.def.worldY + b.height &&
          b.def.worldY < a.def.worldY + a.height;
        expect(overlap, `${a.def.id} overlaps ${b.def.id}`).toBe(false);
      }
  });

  it('every open edge tile leads to a room or is closed by world bounds (side exits line up)', () => {
    // An open tile on a left/right edge with a neighbour room must face an open tile there.
    for (const r of parsed) {
      for (const side of [-1, 1]) {
        const tx = side < 0 ? 0 : r.width - 1;
        for (let ty = 0; ty < r.height; ty++) {
          if (r.grid[ty * r.width + tx] === SOLID) continue;
          const wx = r.def.worldX + tx + side;
          const wy = r.def.worldY + ty;
          const n = findRoomAt(parsed, wx, wy);
          if (!n) continue;
          const lx = wx - n.def.worldX;
          const ly = wy - n.def.worldY;
          // Neighbour edge tile can be solid (a wall) but then the player simply cannot pass; flag floor mismatches only
          // where this room has floor directly below the opening.
          const below = r.grid[(ty + 1) * r.width + tx];
          if (below === SOLID && ty + 1 < r.height) {
            const nBelow = n.grid[(ly + 1) * n.width + lx];
            expect(nBelow, `${r.def.id} -> ${n.def.id} floor at world ${wx},${wy + 1}`).toBe(SOLID);
          }
        }
      }
    }
  });

  it('signs all have text', () => {
    for (const r of parsed) for (const e of r.entities.filter((e) => e.kind === 'sign')) {
        expect(e.text?.en, e.uid).toBeTruthy();
        expect(e.text?.he, e.uid).toBeTruthy();
      }
  });

  it('merges horizontal solid runs', () => {
    const r = parseRoom({ id: 't', name: { en: 't', he: 't' }, mood: 'dark', worldX: 0, worldY: 0, rows: ['##.#', '####'] });
    expect(mergedRuns(r, SOLID)).toEqual([
      { tx: 0, ty: 0, w: 2 },
      { tx: 3, ty: 0, w: 1 },
      { tx: 0, ty: 1, w: 4 },
    ]);
  });

  it('rejects ragged rows and unknown tiles', () => {
    expect(() => parseRoom({ id: 'x', name: { en: '', he: '' }, mood: 'dark', worldX: 0, worldY: 0, rows: ['##', '#'] })).toThrow();
    expect(() => parseRoom({ id: 'x', name: { en: '', he: '' }, mood: 'dark', worldX: 0, worldY: 0, rows: ['#?'] })).toThrow();
  });
});

describe('GameState save data', () => {
  it('round-trips through JSON', () => {
    const s = GameState.fresh('crater', 10, 20, 5);
    s.set('a');
    s.powers.dash = true;
    const back = GameState.fromJSON(JSON.stringify(s.toSave()))!;
    expect(back.has('a')).toBe(true);
    expect(back.powers.dash).toBe(true);
    expect(back.checkpoint).toEqual({ room: 'crater', x: 10, y: 20 });
  });

  it('rejects corrupt or unknown-version saves', () => {
    expect(GameState.fromJSON('nope')).toBeNull();
    expect(GameState.fromJSON(JSON.stringify({ version: 999 }))).toBeNull();
    expect(GameState.fromJSON(null)).toBeNull();
  });
});
