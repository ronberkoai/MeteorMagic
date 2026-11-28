/** On-screen touch controls write here; InputManager ORs it with keyboard and gamepad. */
export type TouchAction = 'left' | 'right' | 'up' | 'down' | 'jump' | 'siphon' | 'release' | 'dash' | 'pause';

export const touch: Record<TouchAction, boolean> = {
  left: false, right: false, up: false, down: false,
  jump: false, siphon: false, release: false, dash: false, pause: false,
};

export function clearTouch() {
  (Object.keys(touch) as TouchAction[]).forEach((k) => (touch[k] = false));
}

/** True on phones and tablets (coarse pointer, or touch without a fine pointer). */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const fine = window.matchMedia?.('(any-pointer: fine)').matches ?? false;
  const forced = new URLSearchParams(window.location.search).has('touch');
  return forced || coarse || ('ontouchstart' in window && !fine);
}

/** Presses shorter than a frame still count: a press stays latched until the input system reads it. */
export const latch = new Set<TouchAction>();
