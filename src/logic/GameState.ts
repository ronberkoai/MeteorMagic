/** Persistent progression for one playthrough. Pure data + helpers, serialisable to localStorage. */
export const SAVE_VERSION = 1;
export const SAVE_KEY = 'meteormagic.save';

export interface Checkpoint {
  room: string;
  x: number;
  y: number;
}

export interface SaveData {
  version: number;
  checkpoint: Checkpoint;
  maxHealth: number;
  powers: { siphon: boolean; dash: boolean };
  flags: string[];
  deaths: number;
  playMs: number;
  shards: number;
}

export class GameState {
  checkpoint: Checkpoint;
  maxHealth: number;
  health: number;
  powers: { siphon: boolean; dash: boolean };
  flags: Set<string>;
  deaths: number;
  playMs: number;
  shards: number;

  constructor(data: SaveData) {
    this.checkpoint = { ...data.checkpoint };
    this.maxHealth = data.maxHealth;
    this.health = data.maxHealth;
    this.powers = { ...data.powers };
    this.flags = new Set(data.flags);
    this.deaths = data.deaths;
    this.playMs = data.playMs;
    this.shards = data.shards;
  }

  static fresh(startRoom: string, x: number, y: number, maxHealth: number): GameState {
    return new GameState({
      version: SAVE_VERSION,
      checkpoint: { room: startRoom, x, y },
      maxHealth,
      powers: { siphon: true, dash: false },
      flags: [],
      deaths: 0,
      playMs: 0,
      shards: 0,
    });
  }

  has(flag: string) {
    return this.flags.has(flag);
  }

  set(flag: string) {
    this.flags.add(flag);
  }

  toSave(): SaveData {
    return {
      version: SAVE_VERSION,
      checkpoint: { ...this.checkpoint },
      maxHealth: this.maxHealth,
      powers: { ...this.powers },
      flags: [...this.flags],
      deaths: this.deaths,
      playMs: Math.round(this.playMs),
      shards: this.shards,
    };
  }

  /** Parse and migrate saved JSON. Returns null for missing, corrupt or unknown-version data. */
  static fromJSON(json: string | null): GameState | null {
    if (!json) return null;
    try {
      const raw = JSON.parse(json) as Partial<SaveData>;
      if (raw.version !== SAVE_VERSION) return null; // future: migrations go here
      if (!raw.checkpoint || typeof raw.checkpoint.room !== 'string') return null;
      return new GameState({
        version: SAVE_VERSION,
        checkpoint: raw.checkpoint,
        maxHealth: raw.maxHealth ?? 5,
        powers: { siphon: true, dash: !!raw.powers?.dash },
        flags: Array.isArray(raw.flags) ? raw.flags : [],
        deaths: raw.deaths ?? 0,
        playMs: raw.playMs ?? 0,
        shards: raw.shards ?? 0,
      });
    } catch {
      return null;
    }
  }
}

export function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
