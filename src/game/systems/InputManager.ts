import Phaser from 'phaser';

/** Action-based input: keyboard (two layouts) + standard gamepad. Edge detection is computed once per frame. */
export interface InputFrame {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
  jumpReleased: boolean;
  siphonPressed: boolean;
  releasePressed: boolean;
  dashPressed: boolean;
  pausePressed: boolean;
}

type Action = 'left' | 'right' | 'up' | 'down' | 'jump' | 'siphon' | 'release' | 'dash' | 'pause';

const KEYS: Record<Action, string[]> = {
  left: ['A', 'LEFT'],
  right: ['D', 'RIGHT'],
  up: ['W', 'UP'],
  down: ['S', 'DOWN'],
  jump: ['SPACE', 'Z'],
  siphon: ['E', 'J'],
  release: ['F', 'L'],
  dash: ['SHIFT', 'K'],
  pause: ['ESC', 'P'],
};

// Standard gamepad mapping
const PAD: Partial<Record<Action, number[]>> = {
  jump: [0],
  siphon: [2],
  release: [3, 5],
  dash: [1, 4, 7],
  pause: [9],
  left: [14],
  right: [15],
  up: [12],
  down: [13],
};

export class InputManager {
  private keys: Record<Action, Phaser.Input.Keyboard.Key[]>;
  private prev: Record<Action, boolean> = {} as Record<Action, boolean>;
  frame: InputFrame = {
    left: false, right: false, up: false, down: false,
    jumpHeld: false, jumpPressed: false, jumpReleased: false,
    siphonPressed: false, releasePressed: false, dashPressed: false, pausePressed: false,
  };

  constructor(private scene: Phaser.Scene) {
    const kb = scene.input.keyboard!;
    this.keys = {} as Record<Action, Phaser.Input.Keyboard.Key[]>;
    (Object.keys(KEYS) as Action[]).forEach((a) => {
      this.keys[a] = KEYS[a].map((k) => kb.addKey(k, true, false));
      this.prev[a] = false;
    });
  }

  private held(a: Action): boolean {
    if (this.keys[a].some((k) => k.isDown)) return true;
    const pad = this.scene.input.gamepad?.pad1;
    if (!pad) return false;
    if (PAD[a]?.some((i) => pad.buttons[i]?.pressed)) return true;
    const ax = pad.axes[0]?.getValue() ?? 0;
    const ay = pad.axes[1]?.getValue() ?? 0;
    if (a === 'left') return ax < -0.4;
    if (a === 'right') return ax > 0.4;
    if (a === 'up') return ay < -0.5;
    if (a === 'down') return ay > 0.5;
    return false;
  }

  update(): InputFrame {
    const now: Record<Action, boolean> = {} as Record<Action, boolean>;
    (Object.keys(KEYS) as Action[]).forEach((a) => (now[a] = this.held(a)));
    const pressed = (a: Action) => now[a] && !this.prev[a];
    this.frame = {
      left: now.left,
      right: now.right,
      up: now.up,
      down: now.down,
      jumpHeld: now.jump,
      jumpPressed: pressed('jump'),
      jumpReleased: !now.jump && this.prev.jump,
      siphonPressed: pressed('siphon'),
      releasePressed: pressed('release'),
      dashPressed: pressed('dash'),
      pausePressed: pressed('pause'),
    };
    this.prev = now;
    return this.frame;
  }

  /** Forget held state (after unpausing) so a held key does not retrigger. */
  reset() {
    (Object.keys(KEYS) as Action[]).forEach((a) => (this.prev[a] = true));
  }
}
