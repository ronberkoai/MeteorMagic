import Phaser from 'phaser';
import { Parallax } from '../gfx/backgrounds';
import { VIEW_H, VIEW_W } from '../../shared/tuning';

/** Animated backdrop behind the React title menu: burning ruins and falling meteors. */
export class TitleScene extends Phaser.Scene {
  private parallax!: Parallax;

  constructor() {
    super('Title');
  }

  create() {
    this.cameras.main.fadeIn(600);
    this.parallax = new Parallax(this, 'dark');
    this.add
      .particles(0, 0, 'dot', {
        x: { min: 0, max: VIEW_W },
        y: VIEW_H + 10,
        lifespan: 6000,
        speedY: { min: -60, max: -20 },
        speedX: { min: -10, max: 20 },
        scale: { start: 0.35, end: 0 },
        tint: [0xff7a2a, 0xffb347, 0xff4d1f],
        blendMode: 'ADD',
        frequency: 70,
      })
      .setScrollFactor(0);
    this.time.addEvent({ delay: 2600, loop: true, callback: () => this.meteor() });
    this.meteor();
  }

  private meteor() {
    const x0 = Phaser.Math.Between(400, VIEW_W + 100);
    const head = this.add.image(x0, -30, 'fireball').setTint(0xb9a8ff).setBlendMode('ADD').setScale(1.3);
    const trail = this.add.particles(0, 0, 'dot', {
      follow: head,
      lifespan: 700,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: [0x9b8cff, 0xffffff, 0xff9a3c],
      blendMode: 'ADD',
      frequency: 12,
    });
    this.tweens.add({
      targets: head,
      x: x0 - Phaser.Math.Between(300, 500),
      y: VIEW_H * 0.75,
      duration: 1400,
      ease: 'Quad.in',
      onComplete: () => {
        trail.stop();
        head.destroy();
        this.time.delayedCall(800, () => trail.destroy());
        this.cameras.main.shake(120, 0.002);
      },
    });
  }

  update(_t: number, dt: number) {
    this.parallax.drift(dt);
  }
}
