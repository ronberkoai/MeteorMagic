/**
 * A group of braziers that solves when all are lit at the same time.
 * With `burnMs`, a lit brazier goes out again after that time unless the group is solved,
 * which turns "light both" into a timed route puzzle.
 */
export class BrazierPuzzle {
  private litAt: (number | null)[];
  private solvedFlag = false;

  constructor(
    readonly count: number,
    private readonly burnMs: number | null,
    alreadySolved = false,
  ) {
    this.litAt = new Array(count).fill(alreadySolved ? 0 : null);
    this.solvedFlag = alreadySolved && count > 0;
  }

  get solved() {
    return this.solvedFlag;
  }

  isLit(i: number) {
    return this.litAt[i] !== null;
  }

  /** Light brazier `i` at time `now`. Returns true if this lighting solved the puzzle. */
  light(i: number, now: number): boolean {
    if (this.solvedFlag || i < 0 || i >= this.count) return false;
    if (this.litAt[i] !== null) return false;
    this.litAt[i] = now;
    if (this.litAt.every((t) => t !== null)) {
      this.solvedFlag = true;
      return true;
    }
    return false;
  }

  /** Remaining burn time for a lit brazier (Infinity when solved or no timer). */
  msLeft(i: number, now: number): number {
    const t = this.litAt[i];
    if (t === null) return 0;
    if (this.solvedFlag || this.burnMs === null) return Infinity;
    return Math.max(0, this.burnMs - (now - t));
  }

  /** Extinguish expired braziers. Returns their indices. */
  update(now: number): number[] {
    if (this.solvedFlag || this.burnMs === null) return [];
    const out: number[] = [];
    this.litAt.forEach((t, i) => {
      if (t !== null && now - t >= this.burnMs!) {
        this.litAt[i] = null;
        out.push(i);
      }
    });
    return out;
  }
}
