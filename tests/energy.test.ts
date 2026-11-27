import { describe, expect, it } from 'vitest';
import { EnergySystem } from '../src/logic/EnergySystem';

const cfg = { chargeMs: 1000, siphonWindowMs: 300, siphonCooldownMs: 400, slots: 1 };

describe('EnergySystem', () => {
  it('absorbs only while the siphon window is open', () => {
    const e = new EnergySystem(cfg);
    expect(e.absorb('FIRE')).toBe(false);
    expect(e.startSiphon()).toBe(true);
    expect(e.absorb('FIRE')).toBe(true);
    expect(e.charge?.type).toBe('FIRE');
  });

  it('closes the window and enforces a cooldown (no permanent shield)', () => {
    const e = new EnergySystem(cfg);
    e.startSiphon();
    e.update(301);
    expect(e.isSiphoning).toBe(false);
    expect(e.startSiphon()).toBe(false);
    e.update(399);
    expect(e.startSiphon()).toBe(false);
    e.update(2);
    expect(e.startSiphon()).toBe(true);
  });

  it('cannot reopen the window while it is open', () => {
    const e = new EnergySystem(cfg);
    expect(e.startSiphon()).toBe(true);
    expect(e.startSiphon()).toBe(false);
  });

  it('releases one charge per absorb', () => {
    const e = new EnergySystem(cfg);
    e.startSiphon();
    e.absorb('FIRE');
    expect(e.release()).toBe('FIRE');
    expect(e.release()).toBeNull();
  });

  it('charges decay', () => {
    const e = new EnergySystem(cfg);
    e.startSiphon();
    e.absorb('FIRE');
    expect(e.update(999)).toEqual([]);
    expect(e.update(2)).toEqual(['FIRE']);
    expect(e.charge).toBeNull();
  });

  it('refreshes a same-type charge when slots are full and rejects other types', () => {
    const e = new EnergySystem(cfg);
    e.startSiphon();
    e.absorb('FIRE');
    e.update(200);
    expect(e.absorb('FIRE')).toBe(true);
    expect(e.charge?.msLeft).toBe(1000);
    expect(e.absorb('KINETIC')).toBe(false);
  });

  it('supports two slots for a future Overcharge', () => {
    const e = new EnergySystem({ ...cfg, slots: 2 });
    e.startSiphon();
    expect(e.absorb('FIRE')).toBe(true);
    expect(e.absorb('KINETIC')).toBe(true);
    expect(e.slots.map((s) => s.type)).toEqual(['FIRE', 'KINETIC']);
    expect(e.release()).toBe('FIRE');
  });
});
