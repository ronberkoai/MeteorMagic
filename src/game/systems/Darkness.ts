import Phaser from 'phaser';
import { VIEW_H, VIEW_W } from '../../shared/tuning';

/**
 * Darkness overlay with soft light "holes" (no light-count limit, works in WebGL and Canvas).
 * A screen-sized RenderTexture is filled with the ambient colour each frame, then light masks are erased from it.
 * Coloured additive glow sprites sit on top for warmth.
 */
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
  color: number;
  flicker: number;
  /** Optional object to follow. */
  follow?: { x: number; y: number; active?: boolean };
  offsetY?: number;
  glow?: Phaser.GameObjects.Image;
  glowAlpha: number;
  enabled: boolean;
  seed: number;
}

export class Darkness {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private lights: LightSource[] = [];
  private color = 0x000000;
  private alpha = 0;
  private targetAlpha = 0;

  constructor(private scene: Phaser.Scene, ambientColor: number, ambientAlpha: number) {
    this.rt = scene.add.renderTexture(0, 0, VIEW_W, VIEW_H).setOrigin(0, 0).setScrollFactor(0).setDepth(50);
    this.stamp = scene.make.image({ key: 'lightmask', add: false });
    this.color = ambientColor;
    this.alpha = this.targetAlpha = ambientAlpha;
  }

  setAmbient(color: number, alpha: number) {
    this.color = color;
    this.targetAlpha = alpha;
  }

  add(opts: Partial<LightSource> & { x: number; y: number; radius: number }): LightSource {
    const l: LightSource = {
      intensity: 1,
      color: 0xffffff,
      flicker: 0,
      glowAlpha: 0.35,
      enabled: true,
      seed: Math.random() * 1000,
      ...opts,
    };
    if (l.glowAlpha > 0) {
      l.glow = this.scene.add
        .image(l.x, l.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(l.color)
        .setDepth(51)
        .setAlpha(l.glowAlpha);
    }
    this.lights.push(l);
    return l;
  }

  remove(l: LightSource) {
    l.glow?.destroy();
    this.lights = this.lights.filter((x) => x !== l);
  }

  update(time: number, dt: number) {
    const cam = this.scene.cameras.main;
    this.alpha += (this.targetAlpha - this.alpha) * Math.min(1, dt / 400);
    for (let i = this.lights.length - 1; i >= 0; i--) {
      const l = this.lights[i];
      if (l.follow) {
        if (l.follow.active === false) {
          this.remove(l);
          continue;
        }
        l.x = l.follow.x;
        l.y = l.follow.y + (l.offsetY ?? 0);
      }
      const f = l.flicker ? 1 + Math.sin(time * 0.013 + l.seed) * l.flicker * 0.6 + Math.sin(time * 0.031 + l.seed * 2) * l.flicker * 0.4 : 1;
      if (l.glow) {
        l.glow.setPosition(l.x, l.y);
        l.glow.setVisible(l.enabled);
        l.glow.setScale((l.radius * 1.3 * f) / 64);
        l.glow.setTint(l.color);
        l.glow.setAlpha(l.glowAlpha * (this.alpha > 0.1 ? 1 : 0.45));
      }
    }
    this.rt.clear();
    if (this.alpha < 0.01) {
      this.rt.setVisible(false);
      return;
    }
    this.rt.setVisible(true);
    this.rt.fill(this.color, this.alpha);
    for (const l of this.lights) {
      if (!l.enabled) continue;
      const sx = l.x - cam.scrollX;
      const sy = l.y - cam.scrollY;
      const f = l.flicker ? 1 + Math.sin(time * 0.013 + l.seed) * l.flicker : 1;
      const r = l.radius * f;
      if (sx < -r || sy < -r || sx > VIEW_W + r || sy > VIEW_H + r) continue;
      this.stamp.setScale((r * 2) / 256);
      this.stamp.setAlpha(Math.min(1, l.intensity));
      this.rt.erase(this.stamp, sx, sy);
    }
  }
}
