import { EnergySystem } from '../logic/EnergySystem';
import { GameState, SAVE_KEY } from '../logic/GameState';
import { ParsedRoom, parseRoom } from '../logic/roomParser';
import { ROOMS, START_ROOM } from '../logic/world';
import { TILE, TUNING } from '../shared/tuning';

/** Runtime state shared across room (scene) restarts. */
export const rooms: ParsedRoom[] = ROOMS.map(parseRoom);
export const roomById = (id: string) => rooms.find((r) => r.def.id === id)!;

export const TOTAL_SHARDS = rooms.reduce((n, r) => n + r.entities.filter((e) => e.kind === 'healthShard').length, 0);

function startPos() {
  const r = roomById(START_ROOM);
  const s = r.entities.find((e) => e.kind === 'spawn')!;
  return { x: s.tx * TILE + TILE / 2, y: s.ty * TILE + TILE - 20 };
}

export const session = {
  state: GameState.fresh(START_ROOM, startPos().x, startPos().y, TUNING.player.maxHealth),
  energy: new EnergySystem({ ...TUNING.energy, slots: 1 }),

  newGame() {
    const p = startPos();
    this.state = GameState.fresh(START_ROOM, p.x, p.y, TUNING.player.maxHealth);
    this.energy.clear();
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch {
      /* storage unavailable */
    }
  },

  loadSave(): boolean {
    let json: string | null = null;
    try {
      json = localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
    const s = GameState.fromJSON(json);
    if (!s || !rooms.some((r) => r.def.id === s.checkpoint.room)) return false;
    this.state = s;
    this.energy.clear();
    return true;
  },

  hasSave(): boolean {
    try {
      return GameState.fromJSON(localStorage.getItem(SAVE_KEY)) !== null;
    } catch {
      return false;
    }
  },

  save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.state.toSave()));
    } catch {
      /* storage unavailable */
    }
  },
};
