import Phaser from 'phaser';
import { ONEWAY, ParsedRoom, SOLID, tileAt } from '../../logic/roomParser';
import { TILE, TUNING } from '../../shared/tuning';

export interface EnemyHost {
  room: ParsedRoom;
  /** Extra solid obstacles (doors, resin, cracked walls) as tile keys "tx,ty". */
  isBlockedTile(tx: number, ty: number): boolean;
  spawnArrow(x: number, y: number, vx: number, vy: number): void;
  playerPos(): { x: number; y: number };
}

/** Line of sight across the tile grid (sampled every 8px). */
export function hasLineOfSight(host: EnemyHost, x0: number, y0: number, x1: number, y1: number): boolean {
  const dist = Phaser.Math.Distance.Between(x0, y0, x1, y1);
  const steps = Math.ceil(dist / 8);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const tx = Math.floor((x0 + (x1 - x0) * t) / TILE);
    const ty = Math.floor((y0 + (y1 - y0) * t) / TILE);
    if (tileAt(host.room, tx, ty) === SOLID || host.isBlockedTile(tx, ty)) return false;
  }
  return true;
}

export abstract class Enemy extends Phaser.Physics.Arcade.Sprite {
  hp: number;
  dead = false;
  dir: 1 | -1 = -1;
  protected stateMs = 0;
  protected flashMs = 0;
  alert: Phaser.GameObjects.Image;

  constructor(scene: Phaser.Scene, x: number, y: number, key: string, hp: number, protected host: EnemyHost) {
    super(scene, x, y, key, 0);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.hp = hp;
    this.setDepth(18);
    this.alert = scene.add.image(x, y - 40, 'alert').setDepth(30).setVisible(false);
  }

  get arcade() {
    return this.body as Phaser.Physics.Arcade.Body;
  }

  /** Is there ground ahead and no wall? Used to keep patrols on their platform. */
  protected canWalk(dir: number): boolean {
    const b = this.arcade;
    const footY = b.bottom + 4;
    const aheadX = dir > 0 ? b.right + 4 : b.left - 4;
    const tx = Math.floor(aheadX / TILE);
    const tyFoot = Math.floor(footY / TILE);
    const below = tileAt(this.host.room, tx, tyFoot);
    const groundAhead = below === SOLID || below === ONEWAY || this.host.isBlockedTile(tx, tyFoot);
    const tyBody = Math.floor((b.bottom - 8) / TILE);
    const wall = tileAt(this.host.room, tx, tyBody) === SOLID || this.host.isBlockedTile(tx, tyBody);
    return groundAhead && !wall && aheadX > 0 && aheadX < this.host.room.width * TILE;
  }

  protected sees(rangeX: number, rangeY: number): boolean {
    const p = this.host.playerPos();
    const dx = p.x - this.x;
    if (Math.abs(dx) > rangeX || Math.abs(p.y - this.y) > rangeY) return false;
    return hasLineOfSight(this.host, this.x, this.y - 10, p.x, p.y - 6);
  }

  protected tickFlash(dt: number) {
    if (this.flashMs > 0) {
      this.flashMs -= dt;
      this.setTintFill(0xffffff);
      if (this.flashMs <= 0) this.clearTint();
    }
  }

  abstract think(dt: number): void;

  /** Returns true if the hit killed it. */
  damage(amount: number, fromX: number): boolean {
    if (this.dead) return false;
    this.hp -= amount;
    this.flashMs = 90;
    const dir = this.x < fromX ? -1 : 1;
    this.arcade.setVelocity(dir * 160, -160);
    if (this.hp <= 0) {
      this.dead = true;
      this.alert.setVisible(false);
      return true;
    }
    this.onHurt(fromX);
    return false;
  }

  protected onHurt(_fromX: number) {}

  /** Contact with this enemy hurts the player. */
  get harmful(): boolean {
    return !this.dead;
  }

  preUpdate(t: number, dt: number) {
    super.preUpdate(t, dt);
    this.alert.setPosition(this.x, this.y - this.height / 2 - 14);
  }

  destroy(fromScene?: boolean) {
    this.alert?.destroy();
    super.destroy(fromScene);
  }
}

const A = TUNING.archer;

export class Archer extends Enemy {
  private aiState: 'patrol' | 'windup' | 'cooldown' | 'hurt' = 'patrol';
  private homeX: number;

  constructor(scene: Phaser.Scene, x: number, y: number, host: EnemyHost) {
    super(scene, x, y, 'archer', A.hp, host);
    this.arcade.setSize(20, 40).setOffset(6, 8);
    this.homeX = x;
    this.play('archer-walk');
  }

  think(dt: number) {
    if (this.dead) return;
    this.tickFlash(dt);
    this.stateMs -= dt;
    const b = this.arcade;
    const p = this.host.playerPos();
    switch (this.aiState) {
      case 'patrol': {
        if (!this.canWalk(this.dir) || Math.abs(this.x - this.homeX) > 110) {
          this.dir = (this.x > this.homeX ? -1 : 1) as 1 | -1;
          if (!this.canWalk(this.dir)) this.dir = (-this.dir) as 1 | -1;
        }
        b.setVelocityX(this.canWalk(this.dir) ? this.dir * A.patrolSpeed : 0);
        this.anims.play('archer-walk', true);
        if (this.sees(A.detectRangeX, A.detectRangeY)) {
          this.aiState = 'windup';
          this.stateMs = A.windupMs;
          this.dir = p.x > this.x ? 1 : -1;
          b.setVelocityX(0);
          this.alert.setVisible(true);
          this.anims.play('archer-windup');
        }
        break;
      }
      case 'windup':
        b.setVelocityX(0);
        this.dir = p.x > this.x ? 1 : -1;
        if (this.stateMs <= 0) {
          this.alert.setVisible(false);
          // aim at the player, clamped so arrows stay readable
          let ang = Math.atan2(p.y - 4 - (this.y - 12), p.x - this.x);
          const base = this.dir > 0 ? 0 : Math.PI;
          let rel = Phaser.Math.Angle.Wrap(ang - base);
          rel = Phaser.Math.Clamp(rel, -0.6, 0.6);
          ang = base + rel;
          this.host.spawnArrow(this.x + this.dir * 14, this.y - 12, Math.cos(ang) * A.arrowSpeed, Math.sin(ang) * A.arrowSpeed);
          this.anims.play('archer-shoot');
          this.aiState = 'cooldown';
          this.stateMs = A.cooldownMs;
        }
        break;
      case 'cooldown':
        b.setVelocityX(0);
        if (this.stateMs < A.cooldownMs - 250) this.anims.play('archer-walk', true);
        if (this.stateMs <= 0) this.aiState = 'patrol';
        break;
      case 'hurt':
        if (this.stateMs <= 0) this.aiState = 'cooldown';
        break;
    }
    this.setFlipX(this.dir < 0);
  }

  protected onHurt() {
    this.aiState = 'hurt';
    this.stateMs = 300;
    this.alert.setVisible(false);
    this.anims.play('archer-hurt');
  }
}

const BR = TUNING.brute;

export class Brute extends Enemy {
  aiState: 'patrol' | 'windup' | 'charge' | 'stunned' | 'hurt' = 'patrol';
  private homeX: number;
  onWallSlam?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, host: EnemyHost) {
    super(scene, x, y, 'brute', BR.hp, host);
    this.arcade.setSize(30, 48).setOffset(9, 8);
    this.homeX = x;
    this.play('brute-walk');
  }

  get stunned() {
    return this.aiState === 'stunned';
  }

  /** The shield faces where the brute walks. Hits from that side are blocked unless stunned. */
  shieldBlocks(fromX: number): boolean {
    if (this.stunned || this.dead) return false;
    return Math.sign(fromX - this.x) === this.dir;
  }

  stun() {
    this.aiState = 'stunned';
    this.stateMs = BR.stunMs;
    this.arcade.setVelocityX(0);
    this.alert.setVisible(false);
    this.anims.play('brute-stunned');
  }

  think(dt: number) {
    if (this.dead) return;
    this.tickFlash(dt);
    this.stateMs -= dt;
    const b = this.arcade;
    const p = this.host.playerPos();
    switch (this.aiState) {
      case 'patrol':
        if (!this.canWalk(this.dir) || Math.abs(this.x - this.homeX) > 140) {
          this.dir = (this.x > this.homeX ? -1 : 1) as 1 | -1;
          if (!this.canWalk(this.dir)) this.dir = (-this.dir) as 1 | -1;
        }
        b.setVelocityX(this.canWalk(this.dir) ? this.dir * BR.patrolSpeed : 0);
        this.anims.play('brute-walk', true);
        if (this.sees(BR.detectRangeX, 60)) {
          this.aiState = 'windup';
          this.stateMs = BR.windupMs;
          this.dir = p.x > this.x ? 1 : -1;
          b.setVelocityX(0);
          this.alert.setVisible(true);
          this.anims.play('brute-windup');
        }
        break;
      case 'windup':
        b.setVelocityX(0);
        this.x += Math.sin(this.stateMs * 0.2) * 0.6;
        if (this.stateMs <= 0) {
          this.alert.setVisible(false);
          this.aiState = 'charge';
          this.stateMs = BR.chargeMs;
          this.anims.play('brute-charge');
        }
        break;
      case 'charge':
        if (!this.canWalk(this.dir)) {
          // slams into a wall or stops at a ledge: stunned briefly (opening for the player)
          b.setVelocityX(0);
          this.onWallSlam?.();
          this.stun();
          this.stateMs = BR.stunMs * 0.7;
          break;
        }
        b.setVelocityX(this.dir * BR.chargeSpeed);
        if (this.stateMs <= 0) {
          this.aiState = 'patrol';
          this.homeX = this.x;
        }
        break;
      case 'stunned':
        if (this.stateMs <= 0) {
          this.aiState = 'patrol';
          this.homeX = this.x;
          this.dir = p.x > this.x ? 1 : -1;
        }
        break;
      case 'hurt':
        if (this.stateMs <= 0) this.aiState = 'patrol';
        break;
    }
    this.setFlipX(this.dir < 0);
  }

  protected onHurt() {
    if (this.aiState !== 'stunned') {
      this.aiState = 'hurt';
      this.stateMs = 250;
      this.anims.play('brute-hurt');
    }
  }
}
