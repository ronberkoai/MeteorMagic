/** Narrow, typed bridge between Phaser (game) and React (UI). Only discrete events cross it. */
export interface HudState {
  health: number;
  maxHealth: number;
  dash: boolean;
}

export interface ChargeState {
  type: 'FIRE' | null;
  /** performance.now() timestamp when the charge fizzles. */
  endsAt: number;
  totalMs: number;
}

export interface EndStats {
  timeMs: number;
  deaths: number;
  shards: number;
  totalShards: number;
}

export interface Events {
  'hud:update': HudState;
  'hud:charge': ChargeState;
  'hud:siphon': { cooldownMs: number };
  'ui:toast': { title: string; body: string };
  'ui:sign': { text: string | null };
  'ui:room': { name: string };
  'ui:paused': { paused: boolean };
  'game:end': EndStats;
  'game:ready': Record<string, never>;
  'cmd:start': { continueSave: boolean };
  'cmd:resume': Record<string, never>;
  'cmd:quitToTitle': Record<string, never>;
}

type Handler<T> = (payload: T) => void;

class TypedBus {
  private handlers = new Map<keyof Events, Set<Handler<never>>>();

  on<K extends keyof Events>(event: K, fn: Handler<Events[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) this.handlers.set(event, (set = new Set()));
    set.add(fn as Handler<never>);
    return () => set!.delete(fn as Handler<never>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]) {
    this.handlers.get(event)?.forEach((fn) => (fn as Handler<Events[K]>)(payload));
  }

  clear() {
    this.handlers.clear();
  }
}

export const bus = new TypedBus();
