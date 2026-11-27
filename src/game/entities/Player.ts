import Phaser from 'phaser';
import { TUNING } from '../../shared/tuning';
import type { InputFrame } from '../systems/InputManager';

const P = TUNING.player;

/**
 * Physics body (invisible) and visual sprite are separate, so squash/stretch and animation
 * never change the collision box.
 */
export class Player {
  readonly body: Phaser.Physics.Arcade.Image;
  readonly sprite: Phaser.GameObjects.Sprite;
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
  dropThroughUntil = 0;
  dashEnabled = false;
  frozen = false;
  onJump?: () => void;
  onLand?: (impact: number) => void;
  onDash?: () => void;
  private fallSpeed = 0;

  constructor(private scene: Phaser.Scene, x: number, y: number) {
    this.body = scene.physics.add.image(x, y, 'pixel').setVisible(false);
    const b = this.arcade;
    b.setSize(P.bodyW, P.bodyH);
    b.setMaxVelocity(P.maxSpeedX * 3, P.maxFall);
    this.sprite = scene.add.sprite(x, y, 'hero', 0).setDepth(20);
    this.sprite.play('hero-idle');
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
    if (grounded) this.airDashUsed = false;

    if (this.frozen) {
      b.setAcceleration(0, 0);
      b.setVelocityX(b.velocity.x * 0.8);
    } else if (this.dashMs > 0) {
      this.dashMs -= dt;
      b.setAllowGravity(false);
      b.setVelocity(this.facing * TUNING.dash.speed, 0);
      if (this.dashMs <= 0) {
        b.setAllowGravity(true);
        b.setVelocityX(this.facing * P.maxSpeedX);
      }
    } else {
      // horizontal movement with acceleration and drag
      const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const accel = grounded ? P.groundAccel : P.airAccel;
      if (dir !== 0) {
        this.facing = dir as 1 | -1;
        // turn around quickly
        if (Math.sign(b.velocity.x) === -dir) b.setVelocityX(b.velocity.x * 0.6);
        b.setAccelerationX(dir * accel);
        b.setDragX(0);
      } else {
        b.setAccelerationX(0);
        b.setDragX(grounded ? P.groundDrag : P.airDrag);
      }
      if (Math.abs(b.velocity.x) > P.maxSpeedX) b.setVelocityX(Math.sign(b.velocity.x) * P.maxSpeedX);

      // coyote time + jump buffer
      this.coyote = grounded ? P.coyoteMs : Math.max(0, this.coyote - dt);
      this.buffer = input.jumpPressed ? P.jumpBufferMs : Math.max(0, this.buffer - dt);
      if (input.jumpPressed && input.down && grounded) {
        // drop through one-way platforms
        this.dropThroughUntil = time + 220;
        this.buffer = 0;
      } else if (this.buffer > 0 && this.coyote > 0) {
        b.setVelocityY(P.jumpVelocity);
        this.coyote = 0;
        this.buffer = 0;
        this.onJump?.();
        this.squash(0.75, 1.25);
      }
      // variable jump height
      if (input.jumpReleased && b.velocity.y < -120) b.setVelocityY(b.velocity.y * P.jumpCutMultiplier);

      // dash (Kinetic Surge)
      if (input.dashPressed && this.dashEnabled && this.dashCooldown <= 0 && (grounded || !this.airDashUsed)) {
        if (dir !== 0) this.facing = dir as 1 | -1;
        this.dashMs = TUNING.dash.durationMs;
        this.dashCooldown = TUNING.dash.durationMs + TUNING.dash.cooldownMs;
        if (!grounded) this.airDashUsed = true;
        this.onDash?.();
        this.squash(1.35, 0.7);
      }
    }

    // landing
    if (!grounded) this.fallSpeed = Math.max(this.fallSpeed, b.velocity.y);
    if (grounded && !this.wasGrounded) {
      this.onLand?.(this.fallSpeed);
      if (this.fallSpeed > 250) this.squash(1.25, 0.8);
      this.fallSpeed = 0;
    }
    this.wasGrounded = grounded;

    this.updateVisual(grounded, time);
  }

  private squash(sx: number, sy: number) {
    this.scene.tweens.killTweensOf(this.sprite);
    this.sprite.setScale(sx, sy);
    this.scene.tweens.add({ targets: this.sprite, scaleX: 1, scaleY: 1, duration: 160, ease: 'Quad.out' });
  }

  private updateVisual(grounded: boolean, time: number) {
    const b = this.arcade;
    this.sprite.setPosition(this.body.x, this.body.y + P.bodyH / 2 - 24 + 1);
    this.sprite.setFlipX(this.facing < 0);
    let anim: string;
    if (this.pose === 'hurt') anim = 'hero-hurt';
    else if (this.dashMs > 0) anim = 'hero-dash';
    else if (this.pose) anim = `hero-${this.pose}`;
    else if (!grounded) anim = b.velocity.y < 0 ? 'hero-jump' : 'hero-fall';
    else if (Math.abs(b.velocity.x) > 30) anim = 'hero-run';
    else anim = 'hero-idle';
    if (this.sprite.anims.currentAnim?.key !== anim) this.sprite.play(anim);
    // blink while invulnerable after being hit
    this.sprite.setAlpha(this.invuln > 0 && this.dashMs <= 0 ? (Math.floor(time / 70) % 2 ? 0.35 : 1) : 1);
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
  }
}
