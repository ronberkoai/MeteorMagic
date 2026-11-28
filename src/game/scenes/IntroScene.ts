import Phaser from 'phaser';
import { Parallax } from '../gfx/backgrounds';
import { bus } from '../../shared/eventBus';
import { T } from '../../shared/i18n';
import { VIEW_H, VIEW_W } from '../../shared/tuning';
import { audio } from '../systems/Audio';
import type { GameSceneData } from './GameScene';

/**
 * Opening cutscene: a quiet village, the bandits burn it, a meteor falls, the hero rises.
 * Captions are shown bilingually by the React overlay. Skippable at any time.
 */
export class IntroScene extends Phaser.Scene {
  private next!: GameSceneData;
  private done = false;
  private dusk!: Parallax;
  private night!: Parallax;
  private houses: Phaser.GameObjects.Image[] = [];
  private nightLayer: Phaser.GameObjects.GameObject[] = [];
  private offSkip?: () => void;

  constructor() {
    super('Intro');
  }

  init(data: GameSceneData) {
    this.next = data;
    this.done = false;
    this.houses = [];
    this.nightLayer = [];
  }

  create() {
    bus.emit('ui:intro', { active: true });
    this.offSkip = bus.on('cmd:skipIntro', () => this.finish(true));
    this.events.once('shutdown', () => this.offSkip?.());
    const cam = this.cameras.main;
    cam.fadeIn(1200);
    audio.setMusic('fantasy');

    const groundY = VIEW_H - 70;
    this.dusk = new Parallax(this, 'dusk');
    this.night = new Parallax(this, 'night');
    this.night.setVisible(false);

    const ground = this.add.graphics().setDepth(5);
    ground.fillStyle(0x2a2a1c, 1).fillRect(0, groundY, VIEW_W, 80);
    ground.fillStyle(0x3d6b3a, 1).fillRect(0, groundY, VIEW_W, 6);

    [140, 330, 560, 790].forEach((x, i) => {
      const h = this.add.image(x, groundY + 2, 'house').setOrigin(0.5, 1).setDepth(4).setScale(i % 2 ? 0.9 : 1);
      this.houses.push(h);
      // warm window glow
      const g = this.add.image(x, groundY - 30, 'glow').setBlendMode('ADD').setTint(0xffb050).setAlpha(0.35).setScale(1.2).setDepth(6);
      h.setData('glow', g);
    });
    const fireflies = this.add.particles(0, 0, 'dot', {
      x: { min: 0, max: VIEW_W }, y: { min: 250, max: groundY },
      lifespan: 4000, speedX: { min: -10, max: 10 }, speedY: { min: -10, max: 10 },
      scale: { start: 0.25, end: 0.05 }, alpha: { start: 0, end: 1 }, tint: [0xe8ff8a, 0xffffaa], blendMode: 'ADD', frequency: 180,
    }).setDepth(7);

    const dim = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0x0a0818, 0).setOrigin(0).setDepth(20);
    const red = this.add.rectangle(0, 0, VIEW_W, VIEW_H, 0xff4a10, 0).setOrigin(0).setDepth(21).setBlendMode('ADD');

    const at = (ms: number, fn: () => void) => this.time.delayedCall(ms, () => !this.done && fn());
    const caption = (i: number) => bus.emit('ui:caption', { text: T.intro[i] });

    at(700, () => caption(0));

    // the bandits arrive
    at(5200, () => {
      caption(1);
      audio.setMusic('dark');
      this.tweens.add({ targets: dim, fillAlpha: 0.45, duration: 3000 });
      fireflies.stop();
      ['archer', 'brute', 'archer', 'archer'].forEach((kind, i) => {
        const y = groundY + 2;
        const s = this.add.sprite(VIEW_W + 60 + i * 70, y, kind).setOrigin(0.5, 1).setFlipX(true).setDepth(8).setTint(0x9a7a7a);
        s.play(`${kind}-walk`);
        const torch = this.add.particles(0, 0, 'dot', {
          follow: s, followOffset: { x: -12, y: -52 }, lifespan: 400, speedY: { min: -60, max: -20 },
          scale: { start: 0.5, end: 0 }, tint: [0xfff1a8, 0xff8a3a, 0xff4a10], blendMode: 'ADD', frequency: 30,
        }).setDepth(9);
        this.tweens.add({
          targets: s, x: -120 - (3 - i) * 70, duration: 9000, delay: i * 250,
          onComplete: () => { torch.destroy(); s.destroy(); },
        });
      });
    });

    // everything burns
    at(9000, () => {
      caption(2);
      this.tweens.add({ targets: red, fillAlpha: 0.12, duration: 2500 });
      this.houses.forEach((h, i) => {
        this.time.delayedCall(i * 450, () => {
          if (this.done) return;
          audio.sfx('burn');
          (h.getData('glow') as Phaser.GameObjects.Image).setAlpha(0.7).setScale(3);
          h.setTint(0x6a3a2a);
          this.add.particles(h.x, h.y - 70, 'dot', {
            x: { min: -40, max: 40 }, lifespan: { min: 500, max: 1100 }, speedY: { min: -140, max: -50 }, speedX: { min: -20, max: 20 },
            scale: { start: 1.3, end: 0 }, tint: [0xfff1a8, 0xffb347, 0xff5a1f, 0xff2a0a], blendMode: 'ADD', frequency: 14,
          }).setDepth(10);
          this.add.particles(h.x, h.y - 110, 'smoke', {
            x: { min: -30, max: 30 }, lifespan: 3000, speedY: { min: -60, max: -25 }, speedX: { min: 5, max: 25 },
            scale: { start: 1, end: 3 }, alpha: { start: 0.35, end: 0 }, tint: 0x222222, frequency: 120,
          }).setDepth(11);
          this.cameras.main.shake(200, 0.003);
        });
      });
    });

    // night falls over the ruins
    at(13600, () => {
      cam.fadeOut(900, 0, 0, 0);
      cam.once('camerafadeoutcomplete', () => {
        if (this.done) return;
        bus.emit('ui:caption', { text: null });
        this.children.list
          .filter((o) => o instanceof Phaser.GameObjects.Particles.ParticleEmitter)
          .forEach((o) => (o as Phaser.GameObjects.Particles.ParticleEmitter).stop());
        this.dusk.setVisible(false);
        this.night.setVisible(true);
        red.setFillStyle(0xff4a10, 0.04);
        dim.setFillStyle(0x0a0818, 0.25);
        this.houses.forEach((h) => {
          h.setTint(0x1a1414);
          (h.getData('glow') as Phaser.GameObjects.Image).setTint(0xff5a1f).setAlpha(0.18).setScale(1.4);
          this.nightLayer.push(
            this.add.particles(h.x, h.y - 50, 'dot', {
              x: { min: -40, max: 40 }, lifespan: 2500, speedY: { min: -40, max: -10 }, scale: { start: 0.3, end: 0 },
              tint: [0xff7a2a, 0xffb347], blendMode: 'ADD', frequency: 260,
            }).setDepth(10),
          );
        });
        cam.fadeIn(900);
        this.time.delayedCall(900, () => !this.done && caption(3));
      });
    });

    // the meteor falls
    at(17200, () => this.meteorStrike(VIEW_W / 2 + 20, groundY));

    at(20200, () => caption(4));
    at(24600, () => caption(5));
    at(29500, () => this.finish(false));
  }

  private meteorStrike(x: number, groundY: number) {
    const head = this.add.image(VIEW_W + 80, -60, 'fireball').setTint(0xc8bcff).setBlendMode('ADD').setScale(2.4).setDepth(30);
    const trail = this.add.particles(0, 0, 'dot', {
      follow: head, lifespan: 900, scale: { start: 1.6, end: 0 }, alpha: { start: 0.9, end: 0 },
      tint: [0x9b8cff, 0xffffff, 0xff9a3c], blendMode: 'ADD', frequency: 8,
    }).setDepth(29);
    audio.sfx('siphon');
    this.tweens.add({
      targets: head, x, y: groundY - 10, duration: 1700, ease: 'Quad.in',
      onComplete: () => {
        trail.stop();
        head.destroy();
        audio.sfx('explode');
        const cam = this.cameras.main;
        cam.flash(600, 230, 220, 255);
        cam.shake(700, 0.018);
        const ring = this.add.image(x, groundY - 10, 'ring').setTint(0xc8bcff).setBlendMode('ADD').setDepth(31).setScale(0.2);
        this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 1100, ease: 'Quad.out', onComplete: () => ring.destroy() });
        const burst = this.add.particles(x, groundY - 10, 'dot', {
          lifespan: { min: 500, max: 1400 }, speed: { min: 120, max: 520 }, angle: { min: 190, max: 350 }, gravityY: 500,
          scale: { start: 1.2, end: 0 }, tint: [0xffffff, 0xc8bcff, 0x9b8cff, 0xff9a3c], blendMode: 'ADD', emitting: false,
        }).setDepth(30);
        burst.explode(120);
        // the crater keeps glowing
        const glow = this.add.image(x, groundY - 6, 'glow').setTint(0x9b8cff).setBlendMode('ADD').setDepth(12).setScale(3).setAlpha(0.8);
        this.tweens.add({ targets: glow, scale: 3.6, alpha: 0.55, yoyo: true, repeat: -1, duration: 1200, ease: 'Sine.inOut' });
        this.time.delayedCall(1600, () => !this.done && this.heroRises(x, groundY));
      },
    });
  }

  private heroRises(x: number, groundY: number) {
    const hero = this.add.sprite(x, groundY + 30, 'hero', 0).setOrigin(0.5, 1).setDepth(14).setAlpha(0).setScale(1.6);
    hero.play('hero-siphon');
    audio.sfx('absorb');
    this.tweens.add({ targets: hero, y: groundY + 2, alpha: 1, duration: 1800, ease: 'Sine.out' });
    const swirl = this.add.particles(0, 0, 'dot', {
      x: { min: x - 300, max: x + 300 }, y: { min: groundY - 260, max: groundY },
      lifespan: 900, moveToX: x, moveToY: groundY - 38, scale: { start: 0.6, end: 0.1 },
      tint: [0xc8bcff, 0xffd27a], blendMode: 'ADD', frequency: 25,
    }).setDepth(15);
    const aura = this.add.image(x, groundY - 38, 'glow').setTint(0xb8a8ff).setBlendMode('ADD').setDepth(13).setScale(1.5).setAlpha(0);
    this.tweens.add({ targets: aura, alpha: 0.9, scale: 2.2, duration: 1800 });
    this.time.delayedCall(3200, () => {
      if (this.done) return;
      swirl.stop();
      hero.play('hero-idle');
      this.cameras.main.zoomTo(1.25, 4000, 'Sine.easeInOut');
      this.cameras.main.pan(x, groundY - 120, 4000, 'Sine.easeInOut');
    });
  }

  private finish(skipped: boolean) {
    if (this.done) return;
    this.done = true;
    bus.emit('ui:caption', { text: null });
    const go = () => {
      bus.emit('ui:intro', { active: false });
      this.scene.start('Game', this.next);
    };
    if (skipped) go();
    else {
      this.cameras.main.fadeOut(1200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', go);
    }
  }

  update(_t: number, dt: number) {
    const v = this.dusk.isVisible() ? this.dusk : this.night;
    v.drift(dt * 0.6);
  }
}
