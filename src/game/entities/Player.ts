import Phaser from 'phaser';
import { TUNING } from '../../shared/tuning';
import type { InputFrame } from '../systems/InputManager';

const P = TUNING.player;
const G = TUNING.gravity;

/** Verlet rope used for the hero's scarf: secondary motion that makes movement read as natural. */
class Scarf {
  private pts: { x: number; y: number; px: number; py: number }[] = [];
  private gfx: Phaser.GameObjects.Graphics;
  private readonly seg = 3.6;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < 8; i++) this.pts.push({ x: x - i * this.seg, y, px: x - i * this.seg, py: y });
    this.gfx = scene.add.graphics().setDepth(19);
  }

  update(ax: number, ay: number, facing: number, vx: number, time: number, dt: number) {
    const k = Math.min(dt, 33) / 16.67;
    const p0 = this.pts[0];
    p0.x = p0.px = ax;
    p0.y = p0.py = ay;
    const wind = Math.sin(time * 0.004) * 0.12 - facing * 0.08;
    for (let i = 1; i < this.pts.length; i++) {
      const p = this.pts[i];
      const nx = p.x + (p.x - p.px) * 0.86 + (wind - vx * 0.0009) * k;
      const ny = p.y + (p.y - p.py) * 0.86 + 0.32 * k + Math.sin(time * 0.012 + i) * 0.05;
      p.px = p.x;
      p.py = p.y;
      p.x = nx;
      p.y = ny;
    }
    // Follow-the-leader pass: the rope never stretches beyond its length (a soft constraint
    // let it streak out into a stiff line at low frame rates). Feeding part of the correction
    // back into the previous position removes the energy the correction would otherwise add.
    for (let i = 1; i < this.pts.length; i++) {
      const a = this.pts[i - 1];
      const b = this.pts[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 1;
      if (d <= this.seg) continue;
      const nx = a.x + (dx / d) * this.seg;
      const ny = a.y + (dy / d) * this.seg;
      b.px += (nx - b.x) * 0.85;
      b.py += (ny - b.y) * 0.85;
      b.x = nx;
      b.y = ny;
    }
    this.draw();
  }

  private draw() {
    const g = this.gfx;
    g.clear();
    const n = this.pts.length;
    const top: Phaser.Math.Vector2[] = [];
    const bot: Phaser.Math.Vector2[] = [];
    for (let i = 0; i < n; i++) {
      const p = this.pts[i];
      const q = this.pts[Math.min(n - 1, i + 1)];
      const r = this.pts[Math.max(0, i - 1)];
      let dx = q.x - r.x;
      let dy = q.y - r.y;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d;
      dy /= d;
      const w = 2.6 * (1 - i / n) + 0.8;
      top.push(new Phaser.Math.Vector2(p.x - dy * w, p.y + dx * w));
      bot.push(new Phaser.Math.Vector2(p.x + dy * w, p.y - dx * w));
    }
    g.fillStyle(0xe8562a, 1);
    g.fillPoints([...top, ...bot.reverse()], true);
    g.lineStyle(1, 0xa8341a, 0.8);
    g.strokePoints(top, false);
  }

  setVisible(v: boolean) {
    this.gfx.setVisible(v);
  }

  setAlpha(a: number) {
    this.gfx.setAlpha(a);
  }

  destroy() {
    this.gfx.destroy();
  }
}

/**
 * Physics body (invisible) and visual sprite are separate, so squash/stretch, lean and animation
 * never change the collision box.
 */
export class Player {
  readonly body: Phaser.Physics.Arcade.Image;
  readonly sprite: Phaser.GameObjects.Sprite;
  private scarf: Scarf;
  facing: 1 | -1 = 1;
  private coyote = 0;
  private buffer = 0;
  private wasGrounded = false;
  private invuln = 0;
  private dashMs = 0;
  private dashCooldown = 0;
  private airDashUsed = false;
  private poseMs = 0;
  private pose: 'siphon' | 'release' | 'hurt' | null = null;
  private jumping = false;
  private lean = 0;
  private runDustMs = 0;
  dropThroughUntil = 0;
  dashEnabled = false;
  frozen = false;
  onJump?: () => void;
  onLand?: (impact: number) => void;
  onDash?: () => void;
  onRunDust?: (x: number, y: number) => void;
  private fallSpeed = 0;
  /** Horizontal speed ceiling: raised by a dash, then eased back to maxSpeedX over time (frame-rate independent). */
  private speedCap: number = P.maxSpeedX;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.physics.add.image(x, y, 'pixel').setVisible(false);
    const b = this.arcade;
    b.setSize(P.bodyW, P.bodyH);
    b.setMaxVelocity(P.maxSpeedX, P.maxFall);
    this.sprite = scene.add.sprite(x, y, 'hero', 0).setDepth(20);
    this.sprite.play('hero-idle');
    this.scarf = new Scarf(scene, x, y - 8);
  }

  get arcade() {
    return this.body.body as Phaser.Physics.Arcade.Body;
  }
  get x() {
    return this.body.x;
  }
  get y() {
    return this.body.y;
  }
  get grounded() {
    return this.arcade.blocked.down || this.arcade.touching.down;
  }
  get isDashing() {
    return this.dashMs > 0;
  }
  get isInvulnerable() {
    return this.invuln > 0 || this.dashMs > 0;
  }

  setPose(p: 'siphon' | 'release' | 'hurt', ms: number) {
    this.pose = p;
    this.poseMs = ms;
  }

  update(input: InputFrame, dt: number, time: number) {
    const b = this.arcade;
    const grounded = this.grounded;
    if (this.invuln > 0) this.invuln -= dt;
    if (this.dashCooldown > 0) this.dashCooldown -= dt;
    if (this.poseMs > 0) {
      this.poseMs -= dt;
      if (this.poseMs <= 0) this.pose = null;
    }
    if (grounded) {
      this.airDashUsed = false;
      if (b.velocity.y >= 0) this.jumping = false;
    }

    if (this.frozen) {
      b.setAcceleration(0, 0);
      b.setGravityY(0);
      b.setVelocityX(b.velocity.x * 0.8);
    } else if (this.dashMs > 0) {
      this.dashMs -= dt;
      b.setAllowGravity(false);
      // ease out of the dash instead of stopping dead
      const t = 1 - Math.max(0, this.dashMs) / TUNING.dash.durationMs;
      this.speedCap = TUNING.dash.speed;
      b.maxVelocity.x = this.speedCap;
      b.setVelocity(this.facing * Phaser.Math.Linear(TUNING.dash.speed, P.maxSpeedX * 1.2, t * t), 0);
      if (this.dashMs <= 0) {
        b.setAllowGravity(true);
        this.speedCap = P.maxSpeedX * 1.15;
        b.maxVelocity.x = this.speedCap;
        b.setVelocityX(this.facing * this.speedCap);
      }
    } else {
      this.horizontal(input, grounded, dt);
      this.jump(input, grounded, time, dt);
      this.gravity(input, grounded);
      this.cornerCorrection();

      // dash (Kinetic Surge)
      if (input.dashPressed && this.dashEnabled && this.dashCooldown <= 0 && (grounded || !this.airDashUsed)) {
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        if (dir !== 0) this.facing = dir as 1 | -1;
        this.dashMs = TUNING.dash.durationMs;
        this.dashCooldown = TUNING.dash.durationMs + TUNING.dash.cooldownMs;
        if (!grounded) this.airDashUsed = true;
        this.jumping = false;
        this.onDash?.();
        this.squash(1.35, 0.7);
      }
    }

    // landing
    if (!grounded) this.fallSpeed = Math.max(this.fallSpeed, b.velocity.y);
    if (grounded && !this.wasGrounded) {
      this.onLand?.(this.fallSpeed);
      const k = Phaser.Math.Clamp(this.fallSpeed / 700, 0, 1);
      if (this.fallSpeed > 180) this.squash(1 + 0.3 * k, 1 - 0.28 * k);
      this.fallSpeed = 0;
    }
    this.wasGrounded = grounded;

    // run dust
    if (grounded && Math.abs(b.velocity.x) > P.maxSpeedX * 0.7) {
      this.runDustMs -= dt;
      if (this.runDustMs <= 0) {
        this.runDustMs = 140;
        this.onRunDust?.(this.x - this.facing * 6, b.bottom);
      }
    }

    this.updateVisual(grounded, time, dt);
  }

  private horizontal(input: InputFrame, grounded: boolean, dt: number) {
    const b = this.arcade;
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let accel = grounded ? P.groundAccel : P.airAccel;
    if (dir !== 0) {
      this.facing = dir as 1 | -1;
      // turning against current momentum uses stronger acceleration (snappy but not instant)
      if (Math.sign(b.velocity.x) === -dir) accel *= P.turnAccelMultiplier;
      b.setAccelerationX(dir * accel);
      b.setDragX(0);
    } else {
      b.setAccelerationX(0);
      b.setDragX(grounded ? P.groundDrag : P.airDrag);
    }
    // Speed ceiling: Arcade clamps to maxVelocity on every physics step, so the cap holds at any
    // frame rate. After a dash the ceiling eases back down, so extra speed bleeds off smoothly.
    this.speedCap = Math.max(P.maxSpeedX, this.speedCap - 900 * (dt / 1000));
    b.maxVelocity.x = this.speedCap;
  }

  private jump(input: InputFrame, grounded: boolean, time: number, dt: number) {
    const b = this.arcade;
    this.coyote = grounded ? P.coyoteMs : Math.max(0, this.coyote - dt);
    this.buffer = input.jumpPressed ? P.jumpBufferMs : Math.max(0, this.buffer - dt);
    if (input.jumpPressed && input.down && grounded) {
      this.dropThroughUntil = time + 220;
      this.buffer = 0;
    } else if (this.buffer > 0 && this.coyote > 0) {
      b.setVelocityY(P.jumpVelocity);
      this.coyote = 0;
      this.buffer = 0;
      this.jumping = true;
      this.onJump?.();
      this.squash(0.72, 1.28);
    }
    if (this.jumping && !input.jumpHeld && b.velocity.y < 0) this.jumping = false;
  }

  /** Jump arc shaping through extra per-body gravity. */
  private gravity(input: InputFrame, grounded: boolean) {
    const b = this.arcade;
    let extra = 0;
    let maxFall: number = P.maxFall;
    const vy = b.velocity.y;
    if (!grounded) {
      if (vy < 0 && !input.jumpHeld) extra = P.releaseGravity; // short hop: rise ends smoothly
      else if (Math.abs(vy) < P.apexThreshold && input.jumpHeld) extra = P.apexGravity; // brief hang at the top
      else if (vy > 0) extra = P.fallGravity; // fall faster than you rise
      if (vy > 0 && input.down) {
        extra = P.fastFallGravity;
        maxFall = P.maxFallFast;
      }
    }
    b.setGravityY(extra * G);
    b.setMaxVelocityY(maxFall);
  }

  /** Nudge around ceiling corners when the head only clips an edge (avoids frustrating bonks). */
  private cornerCorrection() {
    const b = this.arcade;
    if (b.velocity.y >= 0) return;
    const step = Math.max(4, -b.velocity.y / 60 + 2);
    const probe = (dx: number) =>
      (this.scene.physics.overlapRect(b.left + dx + 1, b.top - step, b.width - 2, step, false, true) as Phaser.Physics.Arcade.StaticBody[]).some(
        (bd) => bd.enable && (bd.gameObject as Phaser.GameObjects.GameObject | undefined)?.getData?.('solid') === true,
      );
    if (!probe(0)) return;
    const max = P.cornerCorrectPx;
    for (let d = 1; d <= max; d++) {
      if (!probe(d)) {
        this.body.x += d;
        b.x += d;
        return;
      }
      if (!probe(-d)) {
        this.body.x -= d;
        b.x -= d;
        return;
      }
    }
  }

  private squash(sx: number, sy: number) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(sx, sy);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 180, ease: 'Back.out' });
  }

  private updateVisual(grounded: boolean, time: number, dt: number) {
    const b = this.arcade;
    const footY = this.body.y + P.bodyH / 2 + 1;
    // origin at the feet so squash and lean pivot naturally
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setPosition(this.body.x, footY);
    this.sprite.setFlipX(this.facing < 0);
    // lean into motion
    const targetLean = this.dashMs > 0 ? this.facing * 0.18 : grounded ? (b.velocity.x / P.maxSpeedX) * 0.09 : (b.velocity.x / P.maxSpeedX) * 0.05 + Phaser.Math.Clamp(b.velocity.y / 2000, -0.06, 0.06) * this.facing;
    this.lean += (targetLean - this.lean) * Math.min(1, dt / 70);
    this.sprite.setRotation(this.lean);

    let anim: string;
    if (this.pose === 'hurt') anim = 'hero-hurt';
    else if (this.dashMs > 0) anim = 'hero-dash';
    else if (this.pose) anim = `hero-${this.pose}`;
    else if (!grounded) anim = b.velocity.y < -40 ? 'hero-jump' : 'hero-fall';
    else if (Math.abs(b.velocity.x) > 30) anim = 'hero-run';
    else anim = 'hero-idle';
    if (this.sprite.anims.currentAnim?.key !== anim) this.sprite.play(anim);
    if (anim === 'hero-run') this.sprite.anims.timeScale = Phaser.Math.Clamp(Math.abs(b.velocity.x) / P.maxSpeedX, 0.5, 1.2);
    else this.sprite.anims.timeScale = 1;

    const alpha = this.invuln > 0 && this.dashMs <= 0 ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1;
    this.sprite.setAlpha(alpha);
    // scarf anchored at the neck, behind the head
    const neckX = this.body.x - this.facing * 4 + Math.sin(this.lean) * 26;
    const neckY = footY - 33 * this.sprite.scaleY;
    this.scarf.update(neckX, neckY, this.facing, b.velocity.x, time, dt);
    this.scarf.setAlpha(alpha);
  }

  hurt(fromX: number) {
    this.invuln = P.invulnMs;
    this.dashMs = 0;
    const b = this.arcade;
    b.setAllowGravity(true);
    const dir = this.x < fromX ? -1 : 1;
    b.setVelocity(dir * P.knockbackX, P.knockbackY);
    this.setPose('hurt', 300);
  }

  grantInvuln(ms: number) {
    this.invuln = Math.max(this.invuln, ms);
  }

  cancelDash() {
    if (this.dashMs > 0) {
      this.dashMs = 0;
      this.arcade.setAllowGravity(true);
    }
  }

  teleport(x: number, y: number) {
    this.body.setPosition(x, y);
    this.arcade.reset(x, y);
    this.arcade.setVelocity(0, 0);
    this.cancelDash();
  }

  destroy() {
    this.body.destroy();
    this.sprite.destroy();
    this.scarf.destroy();
  }
}
