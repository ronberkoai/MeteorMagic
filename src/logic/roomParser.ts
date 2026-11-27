/**
 * Rooms are authored as ASCII grids (see src/logic/world.ts and docs/DECISIONS.md).
 * The format maps 1:1 to LDtk concepts (IntGrid collisions + entity layer + level fields + world position),
 * so a LDtk importer can replace it later without touching game code.
 */
export type Mood = 'dark' | 'dusk' | 'fantasy' | 'temple' | 'night';

export const SOLID = 1;
export const ONEWAY = 2;
export const SPIKES = 3;

export type EntityKind =
  | 'spawn'
  | 'campfire'
  | 'torch'
  | 'resin'
  | 'brazier'
  | 'door'
  | 'cracked'
  | 'archer'
  | 'brute'
  | 'barrel'
  | 'kineticShard'
  | 'healthShard'
  | 'sign'
  | 'gate';

export interface RoomDef {
  id: string;
  name: string;
  mood: Mood;
  /** World position in tiles (like LDtk GridVania worldX / worldY). */
  worldX: number;
  worldY: number;
  rows: string[];
  signs?: string[];
  /** Burn time for this room's brazier puzzle; omitted = default. */
  brazierBurnMs?: number;
}

export interface RoomEntity {
  kind: EntityKind;
  tx: number;
  ty: number;
  /** Stable id within the world, used for persistent flags. */
  uid: string;
  /** Index among entities of the same kind in this room (row-major order). */
  index: number;
  text?: string;
}

export interface ParsedRoom {
  def: RoomDef;
  width: number;
  height: number;
  /** Row-major tile grid: 0 empty, SOLID, ONEWAY, SPIKES. */
  grid: number[];
  entities: RoomEntity[];
}

const LEGEND: Record<string, EntityKind | 'solid' | 'oneway' | 'spikes' | 'empty'> = {
  '.': 'empty',
  ' ': 'empty',
  '#': 'solid',
  '-': 'oneway',
  '^': 'spikes',
  P: 'spawn',
  C: 'campfire',
  t: 'torch',
  R: 'resin',
  B: 'brazier',
  D: 'door',
  X: 'cracked',
  A: 'archer',
  U: 'brute',
  O: 'barrel',
  K: 'kineticShard',
  H: 'healthShard',
  S: 'sign',
  E: 'gate',
};

export function parseRoom(def: RoomDef): ParsedRoom {
  const height = def.rows.length;
  if (height === 0) throw new Error(`Room ${def.id} has no rows`);
  const width = def.rows[0].length;
  const grid: number[] = new Array(width * height).fill(0);
  const entities: RoomEntity[] = [];
  const counters: Partial<Record<EntityKind, number>> = {};
  let signIndex = 0;

  def.rows.forEach((row, ty) => {
    if (row.length !== width) {
      throw new Error(`Room ${def.id}: row ${ty} has length ${row.length}, expected ${width}`);
    }
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      const kind = LEGEND[ch];
      if (!kind) throw new Error(`Room ${def.id}: unknown tile '${ch}' at ${tx},${ty}`);
      if (kind === 'empty') continue;
      if (kind === 'solid') grid[ty * width + tx] = SOLID;
      else if (kind === 'oneway') grid[ty * width + tx] = ONEWAY;
      else if (kind === 'spikes') grid[ty * width + tx] = SPIKES;
      else {
        const index = counters[kind] ?? 0;
        counters[kind] = index + 1;
        const ent: RoomEntity = { kind, tx, ty, index, uid: `${def.id}:${kind}:${tx},${ty}` };
        if (kind === 'sign') {
          ent.text = def.signs?.[signIndex] ?? '';
          signIndex++;
        }
        entities.push(ent);
      }
    }
  });
  return { def, width, height, grid, entities };
}

export function tileAt(room: ParsedRoom, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= room.width || ty >= room.height) return 0;
  return room.grid[ty * room.width + tx];
}

export function isSolidAt(room: ParsedRoom, tx: number, ty: number): boolean {
  return tileAt(room, tx, ty) === SOLID;
}

/** Horizontal runs of SOLID tiles merged into rectangles (in tiles) to keep the body count low. */
export function mergedRuns(room: ParsedRoom, value: number): { tx: number; ty: number; w: number }[] {
  const out: { tx: number; ty: number; w: number }[] = [];
  for (let ty = 0; ty < room.height; ty++) {
    let start = -1;
    for (let tx = 0; tx <= room.width; tx++) {
      const hit = tx < room.width && room.grid[ty * room.width + tx] === value;
      if (hit && start < 0) start = tx;
      else if (!hit && start >= 0) {
        out.push({ tx: start, ty, w: tx - start });
        start = -1;
      }
    }
  }
  return out;
}

/** Find the room containing a world tile position. */
export function findRoomAt(rooms: ParsedRoom[], wx: number, wy: number): ParsedRoom | undefined {
  return rooms.find(
    (r) => wx >= r.def.worldX && wx < r.def.worldX + r.width && wy >= r.def.worldY && wy < r.def.worldY + r.height,
  );
}
