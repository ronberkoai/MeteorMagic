import { describe, expect, it } from 'vitest';
import { BrazierPuzzle } from '../src/logic/BrazierPuzzle';

describe('BrazierPuzzle', () => {
  it('solves when all braziers are lit', () => {
    const p = new BrazierPuzzle(2, null);
    expect(p.light(0, 0)).toBe(false);
    expect(p.light(1, 5000)).toBe(true);
    expect(p.solved).toBe(true);
  });

  it('extinguishes lit braziers after burnMs unless solved', () => {
    const p = new BrazierPuzzle(2, 1000);
    p.light(0, 0);
    expect(p.update(999)).toEqual([]);
    expect(p.update(1000)).toEqual([0]);
    expect(p.isLit(0)).toBe(false);
    expect(p.light(1, 1100)).toBe(false);
    expect(p.solved).toBe(false);
  });

  it('stays solved and stops timing out', () => {
    const p = new BrazierPuzzle(2, 1000);
    p.light(0, 0);
    p.light(1, 500);
    expect(p.update(5000)).toEqual([]);
    expect(p.msLeft(0, 5000)).toBe(Infinity);
  });

  it('ignores relighting and bad indices', () => {
    const p = new BrazierPuzzle(1, null);
    expect(p.light(3, 0)).toBe(false);
    expect(p.light(0, 0)).toBe(true);
    expect(p.light(0, 1)).toBe(false);
  });

  it('can start solved (from save data)', () => {
    expect(new BrazierPuzzle(2, 1000, true).solved).toBe(true);
  });
});
