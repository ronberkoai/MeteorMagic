/**
 * Pure energy model for "absorb and release" (ספיגה ושחרור). No Phaser imports, so it is unit-tested.
 *
 * Rules (see docs/DECISIONS.md):
 * - Siphoning is a short timing window opened by a tap, followed by a cooldown. Holding the key does nothing extra,
 *   so absorbing an arrow is a skill moment rather than a permanent shield.
 * - Absorbing only succeeds while the window is open. One absorbed charge = one release.
 * - A charge decays after `chargeMs`.
 * - The model already supports several slots so Overcharge (two energies) can be added later.
 */
export type EnergyType = 'FIRE' | 'KINETIC' | 'ASTRAL';

export interface EnergyConfig {
  chargeMs: number;
  siphonWindowMs: number;
  siphonCooldownMs: number;
  slots: number;
}

export interface EnergySlot {
  type: EnergyType;
  msLeft: number;
}

export class EnergySystem {
  private cfg: EnergyConfig;
  private windowMs = 0;
  private cooldownMs = 0;
  readonly slots: EnergySlot[] = [];

  constructor(cfg: EnergyConfig) {
    this.cfg = { ...cfg };
  }

  get isSiphoning(): boolean {
    return this.windowMs > 0;
  }

  get canSiphon(): boolean {
    return this.windowMs <= 0 && this.cooldownMs <= 0;
  }

  get charge(): EnergySlot | null {
    return this.slots[0] ?? null;
  }

  get maxSlots(): number {
    return this.cfg.slots;
  }

  setSlots(n: number) {
    this.cfg.slots = n;
    while (this.slots.length > n) this.slots.pop();
  }

  /** Opens the siphon window. Returns false while on cooldown or already open. */
  startSiphon(): boolean {
    if (!this.canSiphon) return false;
    this.windowMs = this.cfg.siphonWindowMs;
    return true;
  }

  /** Absorb one unit of energy. Only works while the window is open and a slot is free. Refreshes an equal charge. */
  absorb(type: EnergyType): boolean {
    if (!this.isSiphoning) return false;
    const same = this.slots.find((s) => s.type === type);
    if (this.slots.length >= this.cfg.slots) {
      if (!same) return false;
      same.msLeft = this.cfg.chargeMs;
      return true;
    }
    this.slots.push({ type, msLeft: this.cfg.chargeMs });
    return true;
  }

  /** Release the oldest charge. Returns its type, or null if empty. */
  release(): EnergyType | null {
    const slot = this.slots.shift();
    return slot ? slot.type : null;
  }

  clear() {
    this.slots.length = 0;
    this.windowMs = 0;
    this.cooldownMs = 0;
  }

  /** Advance timers. Returns the charges that fizzled out during this step. */
  update(dtMs: number): EnergyType[] {
    if (this.windowMs > 0) {
      this.windowMs -= dtMs;
      if (this.windowMs <= 0) {
        this.windowMs = 0;
        this.cooldownMs = this.cfg.siphonCooldownMs;
      }
    } else if (this.cooldownMs > 0) {
      this.cooldownMs = Math.max(0, this.cooldownMs - dtMs);
    }
    const expired: EnergyType[] = [];
    for (let i = this.slots.length - 1; i >= 0; i--) {
      this.slots[i].msLeft -= dtMs;
      if (this.slots[i].msLeft <= 0) {
        expired.push(this.slots[i].type);
        this.slots.splice(i, 1);
      }
    }
    return expired;
  }
}
