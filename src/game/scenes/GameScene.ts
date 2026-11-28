import Phaser from 'phaser';
import { BrazierPuzzle } from '../../logic/BrazierPuzzle';
import { findRoomAt, mergedRuns, ONEWAY, ParsedRoom, RoomEntity, SOLID, SPIKES, tileAt } from '../../logic/roomParser';
import { bus } from '../../shared/eventBus';
import { Bi, T } from '../../shared/i18n';
import { TILE, TUNING, VIEW_H, VIEW_W } from '../../shared/tuning';
import { Archer, Brute, Enemy, EnemyHost } from '../entities/Enemies';
import { Player } from '../entities/Player';
import { Parallax } from '../gfx/backgrounds';
import { PALETTES } from '../gfx/palette';
import { buildTerrainTexture } from '../gfx/terrain';
import { roomById, rooms, session, TOTAL_SHARDS } from '../session';
import { audio } from '../systems/Audio';
import { Darkness, LightSource } from '../systems/Darkness';
import { InputManager } from '../systems/InputManager';

export interface GameSceneData {
  room: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  facing?: 1 | -1;
  mode?: 'start' | 'enter' | 'respawn';
}

interface FireSource {
  kind: 'campfire' | 'torch';
  ent: RoomEntity;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Image;
  lit: boolean;
  relightAt: number;
  light: LightSource;
  flame: Phaser.GameObjects.Particles.ParticleEmitter;
}

interface Brazier {
  index: number;
  sprite: Phaser.GameObjects.Image;
  zone: Phaser.GameObjects.Zone;
  light: LightSource;
  flame: Phaser.GameObjects.Particles.ParticleEmitter;
}

type Tile = Phaser.Physics.Arcade.Image & { ent?: RoomEntity };

const E = TUNING.energy;

export class GameScene extends Phaser.Scene implements EnemyHost {
  room!: ParsedRoom;
  private data0!: GameSceneData;
  private player!: Player;
  private inputMgr!: InputManager;
  private darkness!: Darkness;
  private parallax!: Parallax;
  private playerLight!: LightSource;
  private chargeTrail!: Phaser.GameObjects.Particles.ParticleEmitter;

  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private oneways!: Phaser.Physics.Arcade.StaticGroup;
  private spikes!: Phaser.Physics.Arcade.StaticGroup;
  private cracked!: Phaser.Physics.Arcade.StaticGroup;
  private resins!: Phaser.Physics.Arcade.StaticGroup;
  private doors!: Phaser.Physics.Arcade.StaticGroup;
  private gates!: Phaser.Physics.Arcade.StaticGroup;
  private barrels!: Phaser.Physics.Arcade.StaticGroup;
  private pickups!: Phaser.Physics.Arcade.StaticGroup;
  private enemies!: Phaser.Physics.Arcade.Group;
  private fireballs!: Phaser.Physics.Arcade.Group;
  private arrows!: Phaser.Physics.Arcade.Group;
  private brazierZones!: Phaser.Physics.Arcade.StaticGroup;

  private blocked = new Set<string>();
  private fireSources: FireSource[] = [];
  private braziers: Brazier[] = [];
  private puzzle: BrazierPuzzle | null = null;
  private signs: { x: number; y: number; text: Bi }[] = [];
  private currentSign: Bi | null = null;
  private absorbedThisWindow = false;
  private lastSafe = { x: 0, y: 0 };
  private transitioning = false;
  private hitstopUntil = 0;
  private gateOpen = false;
  private ended = false;
  private lastGhost = 0;
  private hadEnemies = false;
  private tufts: { img: Phaser.GameObjects.Image; phase: number; angle: number }[] = [];
  private fog: Phaser.GameObjects.TileSprite | null = null;
  private rays: Phaser.GameObjects.Image[] = [];

  constructor() {
    super('Game');
  }

  init(data: GameSceneData) {
    this.data0 = data;
    this.room = roomById(data.room);
    this.blocked = new Set();
    this.fireSources = [];
    this.braziers = [];
    this.puzzle = null;
    this.signs = [];
    this.currentSign = null;
    this.transitioning = false;
    this.hitstopUntil = 0;
    this.gateOpen = false;
    this.ended = false;
    this.hadEnemies = false;
    this.tufts = [];
    this.fog = null;
    this.rays = [];
  }

  // ------------------------------------------------------------------ build

  create() {
    const st = session.state;
    const room = this.room;
    const W = room.width * TILE;
    const H = room.height * TILE;
    const pal = PALETTES[room.def.mood];
    this.physics.world.setBounds(0, 0, W, H);
    this.physics.world.setBoundsCollision(false, false, false, false);

    this.parallax = new Parallax(this, room.def.mood);
    this.add.image(0, 0, buildTerrainTexture(this, room)).setOrigin(0, 0).setDepth(0);
    this.darkness = new Darkness(this, pal.ambient, pal.ambientAlpha);

    this.solids = this.physics.add.staticGroup();
    this.oneways = this.physics.add.staticGroup();
    this.spikes = this.physics.add.staticGroup();
    this.cracked = this.physics.add.staticGroup();
    this.resins = this.physics.add.staticGroup();
    this.doors = this.physics.add.staticGroup();
    this.gates = this.physics.add.staticGroup();
    this.barrels = this.physics.add.staticGroup();
    this.pickups = this.physics.add.staticGroup();
    this.brazierZones = this.physics.add.staticGroup();
    this.enemies = this.physics.add.group({ runChildUpdate: false });
    this.fireballs = this.physics.add.group({ allowGravity: false });
    this.arrows = this.physics.add.group({ allowGravity: false });

    for (const run of mergedRuns(room, SOLID)) this.addZone(this.solids, run.tx, run.ty, run.w, 1).setData('solid', true);
    for (const run of mergedRuns(room, ONEWAY)) {
      const z = this.addZone(this.oneways, run.tx, run.ty, run.w, 0.3, 0);
      const b = z.body as Phaser.Physics.Arcade.StaticBody;
      b.checkCollision.down = false;
      b.checkCollision.left = false;
      b.checkCollision.right = false;
    }
    for (const run of mergedRuns(room, SPIKES)) this.addZone(this.spikes, run.tx, run.ty, run.w, 0.5, 0.5);

    // entities
    for (const ent of room.entities) this.spawnEntity(ent);
    const brazierCount = this.braziers.length;
    if (brazierCount > 0) {
      const solved = st.has(`${room.def.id}:solved`);
      this.puzzle = new BrazierPuzzle(brazierCount, room.def.brazierBurnMs ?? TUNING.brazierBurnMs, solved);
      if (solved) this.braziers.forEach((b) => this.setBrazierLit(b, true, true));
    }
    this.hadEnemies = this.enemies.getLength() > 0;

    // player
    const d = this.data0;
    this.player = new Player(this, d.x, d.y);
    this.player.facing = d.facing ?? 1;
    this.player.dashEnabled = st.powers.dash;
    this.player.arcade.setVelocity(d.vx ?? 0, d.vy ?? 0);
    if (d.mode === 'enter' && (d.vy ?? 0) < 0) this.player.arcade.setVelocityY(Math.min(d.vy ?? 0, -420));
    this.lastSafe = { x: d.x, y: d.y };
    this.player.onJump = () => audio.sfx('jump');
    this.player.onLand = (impact) => {
      if (impact > 320) {
        audio.sfx('land');
        this.dust(this.player.x, this.player.arcade.bottom, 8);
      }
    };
    this.player.onRunDust = (x, y) => this.dust(x, y, 2, room.def.mood === 'fantasy' ? 0xc8d8a8 : 0xa89888);
    this.player.onDash = () => {
      audio.sfx('dash');
      this.dust(this.player.x, this.player.y, 10, 0x9b8cff);
    };

    this.playerLight = this.darkness.add({ x: d.x, y: d.y, radius: 175, color: 0x8f7dff, follow: this.player.body, offsetY: -6, glowAlpha: 0.22 });
    this.chargeTrail = this.add.particles(0, 0, 'dot', {
      follow: this.player.body,
      lifespan: 500,
      speedY: { min: -50, max: -10 },
      speedX: { min: -20, max: 20 },
      scale: { start: 0.45, end: 0 },
      tint: [0xffd27a, 0xff8a3a, 0xff5a1f],
      blendMode: 'ADD',
      frequency: 40,
      emitting: false,
    }).setDepth(52);

    this.inputMgr = new InputManager(this);
    this.setupColliders();
    this.setupAmbient();
    this.setupAtmosphere();

    const cam = this.cameras.main;
    cam.setBounds(0, 0, W, H);
    cam.startFollow(this.player.body, true, 0.1, 0.09, -(d.facing ?? 1) * 60, 30);
    cam.setRoundPixels(true);
    cam.fadeIn(d.mode === 'enter' ? 160 : 500);

    audio.setMusic(pal.music);
    if (!st.has(`visited:${room.def.id}`)) {
      st.set(`visited:${room.def.id}`);
      bus.emit('ui:room', { name: room.def.name });
    }
    this.emitHud();
    this.emitCharge();
    bus.emit('ui:sign', { text: null });

    this.events.on('resume', () => this.inputMgr.reset());
  }

  private addZone(group: Phaser.Physics.Arcade.StaticGroup, tx: number, ty: number, w: number, hTiles: number, yOff = 0) {
    const z = this.add.zone(tx * TILE + (w * TILE) / 2, ty * TILE + yOff * TILE + (hTiles * TILE) / 2, w * TILE, hTiles * TILE);
    this.physics.add.existing(z, true);
    group.add(z);
    return z;
  }

  private tileImage(group: Phaser.Physics.Arcade.StaticGroup, ent: RoomEntity, key: string): Tile {
    const img = group.create(ent.tx * TILE + TILE / 2, ent.ty * TILE + TILE / 2, key) as Tile;
    img.ent = ent;
    img.setData('solid', true);
    img.setDepth(4);
    img.refreshBody();
    this.blocked.add(`${ent.tx},${ent.ty}`);
    return img;
  }

  private spawnEntity(ent: RoomEntity) {
    const st = session.state;
    const cx = ent.tx * TILE + TILE / 2;
    const by = ent.ty * TILE + TILE; // bottom of the tile
    switch (ent.kind) {
      case 'spawn':
        break;
      case 'campfire':
      case 'torch': {
        const isCamp = ent.kind === 'campfire';
        const sprite = isCamp ? this.add.image(cx, by - 11, 'campfire').setDepth(5) : this.add.image(cx, by - 18, 'torch').setDepth(5);
        const fx = cx;
        const fy = isCamp ? by - 16 : by - 34;
        const flame = this.add.particles(fx, fy, 'dot', {
          lifespan: { min: 350, max: 700 },
          speedY: { min: isCamp ? -90 : -60, max: -30 },
          speedX: { min: -12, max: 12 },
          scale: { start: isCamp ? 0.9 : 0.55, end: 0 },
          alpha: { start: 1, end: 0 },
          tint: [0xfff1a8, 0xffb347, 0xff6a1f, 0xff3a10],
          blendMode: 'ADD',
          frequency: isCamp ? 22 : 40,
          x: { min: isCamp ? -9 : -3, max: isCamp ? 9 : 3 },
        }).setDepth(52);
        const light = this.darkness.add({ x: fx, y: fy, radius: isCamp ? 230 : 165, color: 0xff8a3a, flicker: 0.07, glowAlpha: 0.4 });
        this.fireSources.push({ kind: ent.kind, ent, x: fx, y: fy, sprite, lit: true, relightAt: 0, light, flame });
        break;
      }
      case 'resin':
        if (!st.has(ent.uid)) this.tileImage(this.resins, ent, 'resin');
        break;
      case 'door':
        if (!st.has(`${this.room.def.id}:solved`)) this.tileImage(this.doors, ent, 'door');
        break;
      case 'cracked':
        if (!st.has(ent.uid)) this.tileImage(this.cracked, ent, 'cracked');
        break;
      case 'gate':
        this.tileImage(this.gates, ent, 'gate');
        break;
      case 'brazier': {
        const sprite = this.add.image(cx, by - 16, 'brazier_off').setDepth(5);
        const zone = this.add.zone(cx, by - 20, TILE + 8, TILE + 16);
        this.physics.add.existing(zone, true);
        this.brazierZones.add(zone);
        zone.setData('index', this.braziers.length);
        const flame = this.add.particles(cx, by - 26, 'dot', {
          lifespan: { min: 350, max: 650 },
          speedY: { min: -80, max: -30 },
          speedX: { min: -10, max: 10 },
          x: { min: -9, max: 9 },
          scale: { start: 0.8, end: 0 },
          tint: [0xfff1a8, 0xffb347, 0xff6a1f],
          blendMode: 'ADD',
          frequency: 26,
          emitting: false,
        }).setDepth(52);
        const light = this.darkness.add({ x: cx, y: by - 26, radius: 210, color: 0xffa040, flicker: 0.06, glowAlpha: 0.4 });
        light.enabled = false;
        light.glow?.setVisible(false);
        // rune glow while dormant
        this.darkness.add({ x: cx, y: by - 14, radius: 50, color: 0x8f86ff, glowAlpha: 0.2 });
        this.braziers.push({ index: this.braziers.length, sprite, zone, light, flame });
        break;
      }
      case 'archer':
      case 'brute': {
        const e = ent.kind === 'archer' ? new Archer(this, cx, by - 24, this) : new Brute(this, cx, by - 28, this);
        this.enemies.add(e);
        e.arcade.setMaxVelocityY(TUNING.player.maxFall);
        if (e instanceof Brute) e.onWallSlam = () => this.cameras.main.shake(140, 0.006);
        break;
      }
      case 'barrel': {
        const b = this.barrels.create(cx, by - 16, 'barrel') as Tile;
        b.setDepth(6);
        b.refreshBody();
        b.setData('fuse', false);
        break;
      }
      case 'kineticShard':
      case 'healthShard': {
        if (st.has(ent.uid)) break;
        const key = ent.kind === 'kineticShard' ? 'shard_kinetic' : 'shard_health';
        const p = this.pickups.create(cx, by - 20, key) as Tile;
        p.ent = ent;
        p.setDepth(52);
        p.refreshBody();
        this.tweens.add({ targets: p, y: p.y - 6, yoyo: true, repeat: -1, duration: 900, ease: 'Sine.inOut' });
        const light = this.darkness.add({ x: cx, y: by - 20, radius: 110, color: ent.kind === 'kineticShard' ? 0x9b8cff : 0xff5a7a, glowAlpha: 0.45, flicker: 0.04 });
        p.setData('light', light);
        break;
      }
      case 'sign':
        this.add.image(cx, by - 16, 'sign').setDepth(3);
        this.signs.push({ x: cx, y: by - 16, text: ent.text ?? { en: '', he: '' } });
        break;
    }
  }

  private setupColliders() {
    const pb = this.player.body;
    this.physics.add.collider(pb, this.solids);
    this.physics.add.collider(pb, this.oneways, undefined, () => this.time.now >= this.player.dropThroughUntil && this.player.arcade.velocity.y >= 0, this);
    this.physics.add.collider(pb, this.resins);
    this.physics.add.collider(pb, this.doors);
    this.physics.add.collider(pb, this.gates);
    this.physics.add.collider(pb, this.barrels);
    this.physics.add.collider(pb, this.cracked, (_p, c) => {
      if (this.player.isDashing) this.breakCracked(c as Tile);
    });
    this.physics.add.overlap(pb, this.spikes, () => this.hazard());
    this.physics.add.overlap(pb, this.pickups, (_p, item) => this.collect(item as Tile));
    this.physics.add.overlap(pb, this.enemies, (_p, e) => this.touchEnemy(e as Enemy));
    this.physics.add.overlap(pb, this.arrows, (_p, a) => {
      const arrow = a as Phaser.Physics.Arcade.Image;
      if (this.player.isInvulnerable) return;
      this.hurtPlayer(1, arrow.x);
      this.destroyProjectile(arrow);
    });

    for (const g of [this.solids, this.resins, this.doors, this.gates, this.cracked, this.barrels]) {
      this.physics.add.collider(this.enemies, g);
    }
    this.physics.add.collider(this.enemies, this.oneways, undefined, (e) => (e as Enemy).arcade.velocity.y >= 0);

    for (const g of [this.solids, this.doors, this.gates, this.cracked]) {
      this.physics.add.collider(this.fireballs, g, (f) => this.burst(f as Phaser.Physics.Arcade.Image));
      this.physics.add.collider(this.arrows, g, (a) => this.destroyProjectile(a as Phaser.Physics.Arcade.Image, true));
    }
    this.physics.add.collider(this.arrows, this.resins, (a) => this.destroyProjectile(a as Phaser.Physics.Arcade.Image, true));
    this.physics.add.overlap(this.fireballs, this.resins, (f, r) => {
      this.burnResin(r as Tile);
      this.burst(f as Phaser.Physics.Arcade.Image);
    });
    this.physics.add.overlap(this.fireballs, this.brazierZones, (f, z) => {
      const idx = (z as Phaser.GameObjects.Zone).getData('index') as number;
      if (this.puzzle && !this.puzzle.isLit(idx)) {
        this.lightBrazier(idx);
        this.burst(f as Phaser.Physics.Arcade.Image);
      }
    });
    this.physics.add.overlap(this.fireballs, this.enemies, (f, e) => this.fireballHitsEnemy(f as Phaser.Physics.Arcade.Image, e as Enemy));
    this.physics.add.overlap(this.fireballs, this.barrels, (f, b) => {
      this.igniteBarrel(b as Tile);
      this.burst(f as Phaser.Physics.Arcade.Image);
    });
    this.physics.add.overlap(this.arrows, this.barrels, (a, b) => {
      this.igniteBarrel(b as Tile);
      this.destroyProjectile(a as Phaser.Physics.Arcade.Image);
    });
  }

  private setupAmbient() {
    const kind = PALETTES[this.room.def.mood].particles;
    const base = { blendMode: 'ADD' as const };
    let cfg: Phaser.Types.GameObjects.Particles.ParticleEmitterConfig;
    if (kind === 'embers')
      cfg = { ...base, x: { min: 0, max: VIEW_W }, y: VIEW_H + 10, lifespan: 7000, speedY: { min: -55, max: -18 }, speedX: { min: -15, max: 25 }, scale: { start: 0.3, end: 0 }, tint: [0xff7a2a, 0xffb347, 0xff4d1f], frequency: 110 };
    else if (kind === 'ash')
      cfg = { x: { min: 0, max: VIEW_W }, y: -10, lifespan: 9000, speedY: { min: 15, max: 40 }, speedX: { min: -20, max: 10 }, scale: { start: 0.25, end: 0.1 }, alpha: { start: 0.6, end: 0 }, tint: 0xb0a8b8, frequency: 140 };
    else if (kind === 'fireflies')
      cfg = { ...base, x: { min: 0, max: VIEW_W }, y: { min: 120, max: VIEW_H }, lifespan: 5000, speedY: { min: -12, max: 12 }, speedX: { min: -12, max: 12 }, scale: { start: 0.25, end: 0.05 }, alpha: { start: 0, end: 1, ease: 'Sine.inOut' }, tint: [0xe8ff8a, 0xffffaa, 0xb6ff9a], frequency: 220 };
    else cfg = { ...base, x: { min: 0, max: VIEW_W }, y: { min: 0, max: VIEW_H }, lifespan: 6000, speedY: { min: 4, max: 14 }, speedX: { min: -8, max: 8 }, scale: { start: 0.18, end: 0.05 }, alpha: { start: 0.7, end: 0 }, tint: 0xffd59a, frequency: 160 };
    this.add.particles(0, 0, kind === 'ash' ? 'dot' : 'dot', cfg).setScrollFactor(0).setDepth(kind === 'fireflies' ? 21 : 53);
    if (kind === 'fireflies') {
      this.add.particles(0, 0, 'leaf', {
        x: { min: 0, max: VIEW_W + 200 }, y: -10, lifespan: 9000, speedY: { min: 20, max: 45 }, speedX: { min: -50, max: -15 }, rotate: { min: 0, max: 360 }, scale: { min: 0.8, max: 1.4 }, tint: [0x7fd36a, 0xc8e86a, 0x5fbf6a], frequency: 600,
      }).setScrollFactor(0).setDepth(21);
    }
  }

  /** Swaying grass, light rays and drifting fog: small things that make the world feel alive. */
  private setupAtmosphere() {
    const mood = this.room.def.mood;
    const room = this.room;
    if (mood === 'fantasy' || mood === 'dusk') {
      for (let ty = 1; ty < room.height; ty++)
        for (let tx = 0; tx < room.width; tx++) {
          if (tileAt(room, tx, ty) !== SOLID || tileAt(room, tx, ty - 1) !== 0) continue;
          if (room.entities.some((e) => e.tx === tx && e.ty === ty - 1)) continue;
          const n = mood === 'fantasy' ? 2 : 1;
          for (let k = 0; k < n; k++) {
            if (Math.random() > (mood === 'fantasy' ? 0.55 : 0.25)) continue;
            const img = this.add
              .image(tx * TILE + 6 + Math.random() * 20, ty * TILE + 2, 'tuft')
              .setOrigin(0.5, 1)
              .setDepth(21)
              .setScale(0.8 + Math.random() * 0.5)
              .setTint(mood === 'dusk' ? 0x9a8a5a : 0xffffff);
            this.tufts.push({ img, phase: Math.random() * Math.PI * 2, angle: 0 });
          }
        }
    }
    if (mood === 'fantasy') {
      for (let i = 0; i < 4; i++) {
        const ray = this.add
          .image(120 + i * 260 + Math.random() * 60, -20, 'ray')
          .setOrigin(0.5, 0)
          .setScrollFactor(0.25, 0)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(-10)
          .setAngle(-14)
          .setScale(1.4 + Math.random() * 0.6, 1.2)
          .setAlpha(0.18);
        this.tweens.add({ targets: ray, alpha: 0.06, duration: 3000 + i * 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        this.rays.push(ray);
      }
    } else {
      const tint = mood === 'temple' ? 0xd9b98a : mood === 'dusk' ? 0xb8a0b0 : 0x6a6a8a;
      this.fog = this.add.tileSprite(0, VIEW_H - 170, VIEW_W, 160, 'fog').setOrigin(0, 0).setScrollFactor(0).setDepth(22).setTint(tint).setAlpha(mood === 'temple' ? 0.35 : 0.5);
    }
  }

  private updateAtmosphere(time: number, dt: number) {
    const px = this.player.x;
    const py = this.player.arcade.bottom;
    const vx = this.player.arcade.velocity.x;
    for (const t of this.tufts) {
      const dx = t.img.x - px;
      let target = Math.sin(time * 0.0018 + t.phase + t.img.x * 0.01) * 6;
      if (Math.abs(dx) < 24 && Math.abs(t.img.y - py) < 20) target += Math.sign(dx || vx) * 30 * (1 - Math.abs(dx) / 24);
      t.angle += (target - t.angle) * Math.min(1, dt / 90);
      t.img.setAngle(t.angle);
    }
    if (this.fog) this.fog.tilePositionX = this.cameras.main.scrollX * 0.7 + time * 0.012;
    // camera look-ahead in the facing direction, and a peek downward during long falls
    const cam = this.cameras.main;
    const b = this.player.arcade;
    const tx = -this.player.facing * 70 * Phaser.Math.Clamp(Math.abs(b.velocity.x) / 120, 0.3, 1);
    const ty = b.velocity.y > 450 ? -70 : 30;
    cam.followOffset.x += (tx - cam.followOffset.x) * Math.min(1, dt / 600);
    cam.followOffset.y += (ty - cam.followOffset.y) * Math.min(1, dt / 400);
  }

  // ------------------------------------------------------------------ EnemyHost

  isBlockedTile(tx: number, ty: number) {
    return this.blocked.has(`${tx},${ty}`);
  }

  playerPos() {
    return { x: this.player.x, y: this.player.y };
  }

  spawnArrow(x: number, y: number, vx: number, vy: number) {
    const a = this.arrows.create(x, y, 'arrow') as Phaser.Physics.Arcade.Image;
    a.setDepth(52);
    a.setVelocity(vx, vy);
    a.setRotation(Math.atan2(vy, vx));
    (a.body as Phaser.Physics.Arcade.Body).setSize(14, 6);
    a.setData('born', this.time.now);
    const l = this.darkness.add({ x, y, radius: 60, color: 0xff8a3a, follow: a, glowAlpha: 0.3 });
    a.setData('light', l);
    audio.sfx('arrow');
  }

  // ------------------------------------------------------------------ update

  update(time: number, dt: number) {
    if (this.ended) return;
    const st = session.state;
    st.playMs += dt;
    const input = this.inputMgr.update();
    if (input.pausePressed && !this.transitioning) {
      bus.emit('ui:paused', { paused: true });
      this.scene.pause();
      return;
    }
    audio.tick();
    if (time < this.hitstopUntil) {
      this.darkness.update(time, dt);
      return;
    }
    if (this.physics.world.isPaused) this.physics.world.resume();

    if (!this.transitioning) {
      this.player.update(input, dt, time);
      this.handleEnergy(input, time, dt);
    }

    // enemies
    this.enemies.getChildren().forEach((c) => (c as Enemy).think(dt));
    this.cleanupProjectiles(time);
    this.updateFireSources(time);
    this.updatePuzzle(time);
    this.updateDashGhosts(time);
    this.checkProximity();
    this.checkGate();
    this.trackSafeSpot();
    this.checkBounds();

    const charged = session.energy.charge !== null;
    this.playerLight.color = charged ? 0xffa040 : 0x8f7dff;
    this.playerLight.radius = charged ? 260 : 175;
    this.playerLight.flicker = charged ? 0.06 : 0.02;
    this.playerLight.glowAlpha = charged ? 0.35 : 0.22;
    this.chargeTrail.emitting = charged;

    this.updateAtmosphere(time, dt);
    this.parallax.update(this.cameras.main);
    this.darkness.update(time, dt);
  }

  private hitstop(ms: number) {
    this.hitstopUntil = this.time.now + ms;
    this.physics.world.pause();
  }

  // ------------------------------------------------------------------ energy

  private handleEnergy(input: ReturnType<InputManager['update']>, time: number, dt: number) {
    const energy = session.energy;
    const expired = energy.update(dt);
    if (expired.length) {
      audio.sfx('fizzle');
      this.puff(this.player.x, this.player.y - 6, 0xffa040);
      this.emitCharge();
    }
    if (input.siphonPressed && energy.startSiphon()) {
      this.absorbedThisWindow = false;
      audio.sfx('siphon');
      this.player.setPose('siphon', E.siphonWindowMs);
      const ring = this.add.image(this.player.x, this.player.y, 'ring').setDepth(52).setTint(0xa898ff).setBlendMode('ADD').setScale(0.2).setAlpha(0.9);
      this.tweens.add({ targets: ring, scale: (E.siphonRadius * 2) / 120, alpha: 0, duration: E.siphonWindowMs, ease: 'Quad.out', onComplete: () => ring.destroy(), onUpdate: () => ring.setPosition(this.player.x, this.player.y) });
      bus.emit('hud:siphon', { cooldownMs: E.siphonWindowMs + E.siphonCooldownMs });
    }
    if (energy.isSiphoning) this.trySiphon(time);

    if (input.releasePressed) {
      const type = energy.release();
      if (type) {
        let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
        if (dx === 0 && dy === 0) dx = this.player.facing;
        const len = Math.hypot(dx, dy);
        this.spawnFireball(this.player.x + (dx / len) * 16, this.player.y - 6 + (dy / len) * 16, dx / len, dy / len);
        this.player.setPose('release', 200);
        this.emitCharge();
      } else {
        audio.sfx('fizzle');
        this.puff(this.player.x + this.player.facing * 14, this.player.y - 6, 0x8f7dff);
      }
    }
  }

  private trySiphon(time: number) {
    const px = this.player.x;
    const py = this.player.y - 6;
    const R = E.siphonRadius;
    // fire arrows in flight (always absorbable inside the window)
    for (const a of this.arrows.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (!a.active) continue;
      if (Phaser.Math.Distance.Between(px, py, a.x, a.y) <= R && session.energy.absorb('FIRE')) {
        this.stream(a.x, a.y);
        this.destroyProjectile(a);
        this.absorbed(true);
      }
    }
    if (this.absorbedThisWindow) return;
    for (const s of this.fireSources) {
      if (!s.lit) continue;
      if (Phaser.Math.Distance.Between(px, py, s.x, s.y) <= R + 10 && session.energy.absorb('FIRE')) {
        this.stream(s.x, s.y);
        if (s.kind === 'torch') {
          s.lit = false;
          s.relightAt = time + E.torchRelightMs;
          s.flame.emitting = false;
          s.light.enabled = false;
          s.sprite.setTexture('torch_out');
          this.puff(s.x, s.y, 0x777777);
        }
        this.absorbed(false);
        break;
      }
    }
  }

  private absorbed(fromArrow: boolean) {
    this.absorbedThisWindow = true;
    audio.sfx('absorb');
    this.cameras.main.shake(fromArrow ? 90 : 60, fromArrow ? 0.004 : 0.002);
    if (fromArrow) this.hitstop(55);
    this.player.sprite.setTintFill(0xffd27a);
    this.time.delayedCall(70, () => this.player.sprite.clearTint());
    this.emitCharge();
  }

  private stream(x: number, y: number) {
    const em = this.add.particles(x, y, 'dot', {
      lifespan: 260,
      speed: { min: 20, max: 80 },
      scale: { start: 0.6, end: 0.1 },
      tint: [0xffd27a, 0xff8a3a],
      blendMode: 'ADD',
      moveToX: this.player.x,
      moveToY: this.player.y - 6,
      emitting: false,
    }).setDepth(53);
    em.explode(16);
    this.time.delayedCall(400, () => em.destroy());
  }

  private spawnFireball(x: number, y: number, dx: number, dy: number) {
    const f = this.fireballs.create(x, y, 'fireball') as Phaser.Physics.Arcade.Image;
    f.setDepth(52).setBlendMode('ADD');
    (f.body as Phaser.Physics.Arcade.Body).setCircle(7, 5, 5);
    f.setVelocity(dx * TUNING.fireball.speed, dy * TUNING.fireball.speed);
    f.setData('born', this.time.now);
    const l = this.darkness.add({ x, y, radius: 130, color: 0xffa040, follow: f, glowAlpha: 0.45 });
    f.setData('light', l);
    const trail = this.add.particles(0, 0, 'dot', {
      follow: f,
      lifespan: 280,
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      tint: [0xfff1a8, 0xffb347, 0xff5a1f],
      blendMode: 'ADD',
      frequency: 14,
    }).setDepth(51);
    f.setData('trail', trail);
    audio.sfx('release');
    this.player.arcade.setVelocityX(this.player.arcade.velocity.x - dx * 40);
  }

  private destroyProjectile(p: Phaser.Physics.Arcade.Image, sparks = false) {
    if (!p.active) return;
    if (sparks) this.sparks(p.x, p.y, 0xffb347, 5);
    const trail = p.getData('trail') as Phaser.GameObjects.Particles.ParticleEmitter | undefined;
    if (trail) {
      trail.stop();
      this.time.delayedCall(400, () => trail.destroy());
    }
    p.destroy();
  }

  private burst(f: Phaser.Physics.Arcade.Image) {
    if (!f.active) return;
    this.sparks(f.x, f.y, 0xffb347, 12);
    const flash = this.darkness.add({ x: f.x, y: f.y, radius: 160, color: 0xffa040, glowAlpha: 0.5 });
    this.tweens.add({ targets: flash, radius: 10, glowAlpha: 0, duration: 300, onComplete: () => this.darkness.remove(flash) });
    this.destroyProjectile(f);
  }

  private cleanupProjectiles(time: number) {
    const W = this.room.width * TILE;
    const H = this.room.height * TILE;
    for (const f of this.fireballs.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (time - (f.getData('born') as number) > TUNING.fireball.lifeMs || f.x < -40 || f.x > W + 40 || f.y < -40 || f.y > H + 40) this.burst(f);
    }
    for (const a of this.arrows.getChildren() as Phaser.Physics.Arcade.Image[]) {
      if (time - (a.getData('born') as number) > 3500 || a.x < -40 || a.x > W + 40) this.destroyProjectile(a);
    }
  }

  // ------------------------------------------------------------------ world interactions

  private updateFireSources(time: number) {
    for (const s of this.fireSources) {
      if (!s.lit && s.kind === 'torch' && time >= s.relightAt) {
        s.lit = true;
        s.flame.emitting = true;
        s.light.enabled = true;
        s.sprite.setTexture('torch');
        this.sparks(s.x, s.y, 0xffb347, 6);
      }
    }
  }

  private lightBrazier(idx: number) {
    if (!this.puzzle) return;
    const solvedNow = this.puzzle.light(idx, this.time.now);
    this.setBrazierLit(this.braziers[idx], true);
    audio.sfx('light');
    if (solvedNow) {
      session.state.set(`${this.room.def.id}:solved`);
      this.time.delayedCall(450, () => this.openDoors());
    }
  }

  private setBrazierLit(b: Brazier, lit: boolean, silent = false) {
    b.sprite.setTexture(lit ? 'brazier_on' : 'brazier_off');
    b.flame.emitting = lit;
    b.light.enabled = lit;
    if (!silent && lit) this.sparks(b.sprite.x, b.sprite.y - 10, 0xffd27a, 14);
  }

  private updatePuzzle(time: number) {
    if (!this.puzzle) return;
    for (const idx of this.puzzle.update(time)) {
      this.setBrazierLit(this.braziers[idx], false);
      this.puff(this.braziers[idx].sprite.x, this.braziers[idx].sprite.y - 12, 0x888888);
      audio.sfx('fizzle');
    }
    // flame shrinks as the timer runs out
    this.braziers.forEach((b) => {
      if (!this.puzzle!.isLit(b.index)) return;
      const left = this.puzzle!.msLeft(b.index, time);
      const k = left === Infinity ? 1 : Math.max(0.35, left / (this.room.def.brazierBurnMs ?? TUNING.brazierBurnMs));
      b.light.radius = 90 + 130 * k;
      b.flame.setScale(k < 0.4 ? 0.7 : 1);
    });
  }

  private openDoors() {
    this.cameras.main.shake(500, 0.004);
    audio.sfx('door');
    bus.emit('ui:toast', { title: T.toast.beacons[0], body: T.toast.beacons[1] });
    (this.doors.getChildren() as Tile[]).forEach((d, i) => {
      d.setTexture('door_on');
      this.time.delayedCall(200 + i * 120, () => {
        this.blocked.delete(`${d.ent!.tx},${d.ent!.ty}`);
        this.dust(d.x, d.y, 6, 0xbbaa99);
        this.tweens.add({ targets: d, alpha: 0, y: d.y - 10, duration: 400, onComplete: () => d.destroy() });
        (d.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
    });
  }

  /** Flood-fill neighbouring tiles of the same group (resin columns, cracked walls). */
  private connected(group: Phaser.Physics.Arcade.StaticGroup, start: Tile): Tile[] {
    const all = group.getChildren() as Tile[];
    const out: Tile[] = [];
    const queue = [start];
    const seen = new Set<Tile>([start]);
    while (queue.length) {
      const t = queue.shift()!;
      out.push(t);
      for (const n of all) {
        if (seen.has(n) || !n.ent || !t.ent) continue;
        if (Math.abs(n.ent.tx - t.ent.tx) + Math.abs(n.ent.ty - t.ent.ty) === 1) {
          seen.add(n);
          queue.push(n);
        }
      }
    }
    return out;
  }

  private burnResin(r: Tile) {
    if (!r.active || r.getData('burning')) return;
    audio.sfx('burn');
    this.connected(this.resins, r).forEach((t, i) => {
      t.setData('burning', true);
      session.state.set(t.ent!.uid);
      this.time.delayedCall(i * 90, () => {
        this.sparks(t.x, t.y, 0xffa040, 10);
        this.puff(t.x, t.y, 0x553322);
        t.setTintFill(0xffc060);
        this.tweens.add({
          targets: t,
          alpha: 0,
          scaleY: 0.2,
          duration: 300,
          onComplete: () => {
            this.blocked.delete(`${t.ent!.tx},${t.ent!.ty}`);
            t.destroy();
          },
        });
        (t.body as Phaser.Physics.Arcade.StaticBody).enable = false;
      });
    });
  }

  private breakCracked(c: Tile) {
    if (!c.active || c.getData('breaking')) return;
    audio.sfx('break');
    this.cameras.main.shake(220, 0.007);
    this.hitstop(60);
    this.connected(this.cracked, c).forEach((t) => {
      t.setData('breaking', true);
      session.state.set(t.ent!.uid);
      this.blocked.delete(`${t.ent!.tx},${t.ent!.ty}`);
      this.debris(t.x, t.y);
      t.destroy();
    });
  }

  private igniteBarrel(b: Tile) {
    if (!b.active || b.getData('fuse')) return;
    b.setData('fuse', true);
    this.tweens.add({ targets: b, scale: 1.15, yoyo: true, repeat: 2, duration: TUNING.barrel.fuseMs / 6 });
    b.setTint(0xffaa66);
    this.time.delayedCall(TUNING.barrel.fuseMs, () => this.explode(b));
  }

  private explode(b: Tile) {
    if (!b.active) return;
    const { x, y } = b;
    b.destroy();
    const R = TUNING.barrel.radius;
    audio.sfx('explode');
    this.cameras.main.shake(380, 0.012);
    this.hitstop(70);
    const em = this.add.particles(x, y, 'dot', {
      lifespan: { min: 300, max: 800 },
      speed: { min: 80, max: 360 },
      scale: { start: 1.4, end: 0 },
      tint: [0xfff1a8, 0xffb347, 0xff5a1f, 0x883311],
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(53);
    em.explode(60);
    this.time.delayedCall(900, () => em.destroy());
    this.puff(x, y, 0x333333, 10);
    const flash = this.darkness.add({ x, y, radius: 340, color: 0xffa040, glowAlpha: 0.8 });
    this.tweens.add({ targets: flash, radius: 20, glowAlpha: 0, duration: 600, onComplete: () => this.darkness.remove(flash) });
    for (const e of [...this.enemies.getChildren()] as Enemy[]) {
      if (Phaser.Math.Distance.Between(x, y, e.x, e.y) < R + 20) {
        if (e instanceof Brute) e.stun();
        if (e.damage(TUNING.barrel.damage, x)) this.killEnemy(e);
      }
    }
    if (Phaser.Math.Distance.Between(x, y, this.player.x, this.player.y) < R && !this.player.isInvulnerable) this.hurtPlayer(1, x);
    for (const c of [...this.cracked.getChildren()] as Tile[]) if (Phaser.Math.Distance.Between(x, y, c.x, c.y) < R + 16) this.breakCracked(c);
    for (const r of [...this.resins.getChildren()] as Tile[]) if (Phaser.Math.Distance.Between(x, y, r.x, r.y) < R + 16) this.burnResin(r);
    for (const o of [...this.barrels.getChildren()] as Tile[]) if (Phaser.Math.Distance.Between(x, y, o.x, o.y) < R + 30) this.igniteBarrel(o);
  }

  // ------------------------------------------------------------------ combat

  private fireballHitsEnemy(f: Phaser.Physics.Arcade.Image, e: Enemy) {
    if (!f.active || e.dead) return;
    if (e instanceof Brute && e.shieldBlocks(f.x)) {
      audio.sfx('deflect');
      this.sparks(f.x, f.y, 0xddeeff, 10);
      this.destroyProjectile(f);
      return;
    }
    const dmg = e instanceof Brute && e.stunned ? 2 : TUNING.fireball.damage;
    this.burst(f);
    audio.sfx('hit');
    this.hitstop(45);
    this.cameras.main.shake(90, 0.004);
    if (e.damage(dmg, f.x)) this.killEnemy(e);
  }

  private touchEnemy(e: Enemy) {
    if (e.dead || this.transitioning) return;
    if (this.player.isDashing) {
      const dir = this.player.facing;
      this.player.cancelDash();
      this.player.arcade.setVelocity(-dir * 230, -260);
      this.player.grantInvuln(400);
      audio.sfx('hit');
      this.hitstop(70);
      this.cameras.main.shake(160, 0.007);
      this.sparks(e.x, e.y - 10, 0x9b8cff, 14);
      if (e instanceof Brute) e.stun();
      if (e.damage(1, this.player.x)) this.killEnemy(e);
      return;
    }
    if (e instanceof Brute && e.stunned) return;
    if (!this.player.isInvulnerable) this.hurtPlayer(1, e.x);
  }

  private killEnemy(e: Enemy) {
    audio.sfx('hit');
    this.puff(e.x, e.y, 0x222222, 10);
    this.sparks(e.x, e.y, 0xff8a3a, 16);
    this.enemies.remove(e);
    (e.body as Phaser.Physics.Arcade.Body).enable = false;
    e.alert.setVisible(false);
    e.setTintFill(0xffffff);
    this.tweens.add({ targets: e, alpha: 0, scaleY: 0.6, y: e.y + 10, duration: 350, onComplete: () => e.destroy() });
  }

  private hurtPlayer(amount: number, fromX: number) {
    if (this.transitioning) return;
    const st = session.state;
    st.health = Math.max(0, st.health - amount);
    audio.sfx('hurt');
    this.cameras.main.shake(180, 0.008);
    this.cameras.main.flash(120, 120, 20, 20, false);
    this.hitstop(80);
    this.player.hurt(fromX);
    this.emitHud();
    if (st.health <= 0) this.die();
  }

  private hazard() {
    if (this.transitioning) return;
    const st = session.state;
    if (!this.player.isInvulnerable || this.player.isDashing) {
      st.health = Math.max(0, st.health - 1);
      audio.sfx('hurt');
      this.emitHud();
      if (st.health <= 0) {
        this.die();
        return;
      }
    }
    this.cameras.main.flash(160, 40, 0, 0, false);
    this.cameras.main.shake(150, 0.006);
    this.player.teleport(this.lastSafe.x, this.lastSafe.y);
    this.player.grantInvuln(TUNING.player.invulnMs);
  }

  private die() {
    if (this.transitioning) return;
    this.transitioning = true;
    const st = session.state;
    st.deaths++;
    audio.sfx('death');
    this.player.frozen = true;
    this.player.sprite.setTintFill(0xffffff);
    this.sparks(this.player.x, this.player.y, 0x9b8cff, 30);
    session.energy.clear();
    this.emitCharge();
    this.time.delayedCall(450, () => {
      this.cameras.main.fadeOut(500, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        st.health = st.maxHealth;
        const cp = st.checkpoint;
        this.scene.restart({ room: cp.room, x: cp.x, y: cp.y, mode: 'respawn' } satisfies GameSceneData);
      });
    });
  }

  private collect(item: Tile) {
    if (!item.active || !item.ent) return;
    const st = session.state;
    st.set(item.ent.uid);
    const light = item.getData('light') as LightSource | undefined;
    if (light) this.darkness.remove(light);
    this.sparks(item.x, item.y, item.ent.kind === 'kineticShard' ? 0x9b8cff : 0xff5a7a, 24);
    audio.sfx('pickup');
    this.hitstop(120);
    this.cameras.main.flash(200, 180, 160, 255, false);
    if (item.ent.kind === 'kineticShard') {
      st.powers.dash = true;
      this.player.dashEnabled = true;
      bus.emit('ui:toast', { title: T.toast.kinetic[0], body: T.toast.kinetic[1] });
    } else {
      st.maxHealth += 1;
      st.health = st.maxHealth;
      st.shards += 1;
      bus.emit('ui:toast', { title: T.toast.heart[0], body: T.toast.heart[1] });
    }
    item.destroy();
    this.emitHud();
    session.save();
  }

  // ------------------------------------------------------------------ checks

  private checkProximity() {
    const st = session.state;
    const px = this.player.x;
    const py = this.player.y;
    // campfires = checkpoints
    for (const s of this.fireSources) {
      if (s.kind !== 'campfire') continue;
      if (Math.abs(px - s.x) < 34 && Math.abs(py - s.y) < 40) {
        const cp = st.checkpoint;
        const changed = cp.room !== this.room.def.id || Math.abs(cp.x - s.x) > 4;
        if (changed || st.health < st.maxHealth) {
          st.checkpoint = { room: this.room.def.id, x: s.x, y: s.y - 6 };
          const healed = st.health < st.maxHealth;
          st.health = st.maxHealth;
          this.emitHud();
          audio.sfx('checkpoint');
          this.sparks(s.x, s.y, 0xffd27a, 12);
          if (changed) bus.emit('ui:toast', { title: T.toast.campfire[0], body: T.toast.campfire[1] });
          else if (healed) this.sparks(px, py, 0xff5a7a, 8);
          session.save();
        }
      }
    }
    // signs
    let text: Bi | null = null;
    for (const s of this.signs) if (Math.abs(px - s.x) < 44 && Math.abs(py - s.y) < 48) text = s.text;
    if (text !== this.currentSign) {
      this.currentSign = text;
      bus.emit('ui:sign', { text });
    }
  }

  private checkGate() {
    if (this.gates.getLength() === 0 && !this.gateOpen) return;
    if (!this.gateOpen && this.hadEnemies && this.enemies.getLength() === 0) {
      this.gateOpen = true;
      this.cameras.main.shake(600, 0.006);
      audio.sfx('door');
      bus.emit('ui:toast', { title: T.toast.gate[0], body: T.toast.gate[1] });
      (this.gates.getChildren() as Tile[]).forEach((g, i) => {
        (g.body as Phaser.Physics.Arcade.StaticBody).enable = false;
        this.blocked.delete(`${g.ent!.tx},${g.ent!.ty}`);
        this.tweens.add({ targets: g, y: g.y - 140, alpha: 0.2, delay: i * 60, duration: 900, ease: 'Quad.in', onComplete: () => g.destroy() });
      });
    }
    if (this.gateOpen && this.player.x > this.room.width * TILE - 24) this.finish();
  }

  private finish() {
    if (this.ended) return;
    this.ended = true;
    const st = session.state;
    st.set('finished');
    session.save();
    this.player.frozen = true;
    this.cameras.main.fadeOut(1200, 255, 240, 220);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      bus.emit('game:end', { timeMs: st.playMs, deaths: st.deaths, shards: st.shards, totalShards: TOTAL_SHARDS });
    });
  }

  private trackSafeSpot() {
    if (!this.player.grounded || this.player.isInvulnerable) return;
    const b = this.player.arcade;
    const ty = Math.floor((b.bottom + 2) / TILE);
    const l = Math.floor(b.left / TILE);
    const r = Math.floor(b.right / TILE);
    const ok = (tx: number) => {
      const t = tileAt(this.room, tx, ty);
      return t === SOLID || t === ONEWAY;
    };
    const hazardNear = [l - 1, l, r, r + 1].some((tx) => tileAt(this.room, tx, ty) === SPIKES || tileAt(this.room, tx, ty - 1) === SPIKES);
    if (ok(l) && ok(r) && !hazardNear) this.lastSafe = { x: this.player.x, y: this.player.y - 2 };
  }

  private checkBounds() {
    if (this.transitioning) return;
    const W = this.room.width * TILE;
    const H = this.room.height * TILE;
    const px = this.player.x;
    const py = this.player.y;
    const b = this.player.arcade;
    const out = px < 0 || px > W || py > H || py < 0;
    if (!out) return;
    const wx = this.room.def.worldX * TILE + px;
    const wy = this.room.def.worldY * TILE + py;
    const next = findRoomAt(rooms, Math.floor(wx / TILE), Math.floor(wy / TILE));
    if (next && next !== this.room) {
      this.transitioning = true;
      const vx = b.velocity.x;
      const vy = b.velocity.y;
      this.cameras.main.fadeOut(110, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({
          room: next.def.id,
          x: wx - next.def.worldX * TILE,
          y: wy - next.def.worldY * TILE,
          vx,
          vy,
          facing: this.player.facing,
          mode: 'enter',
        } satisfies GameSceneData);
      });
      return;
    }
    if (py > H) {
      this.hazard();
      return;
    }
    // no neighbour: treat the edge as a wall / ceiling
    if (px < 0) {
      this.player.body.x = 0;
      b.setVelocityX(Math.max(0, b.velocity.x));
    } else if (px > W) {
      this.player.body.x = W;
      b.setVelocityX(Math.min(0, b.velocity.x));
    }
    if (py < 0) {
      this.player.body.y = 0;
      b.setVelocityY(Math.max(0, b.velocity.y));
    }
  }

  private updateDashGhosts(time: number) {
    if (!this.player.isDashing || time - this.lastGhost < 28) return;
    this.lastGhost = time;
    const s = this.player.sprite;
    const g = this.add.image(s.x, s.y, 'hero', s.frame.name).setOrigin(0.5, 1).setRotation(s.rotation).setFlipX(s.flipX).setTint(0x9b8cff).setAlpha(0.55).setDepth(19).setBlendMode('ADD');
    this.tweens.add({ targets: g, alpha: 0, duration: 220, onComplete: () => g.destroy() });
  }

  // ------------------------------------------------------------------ fx

  private sparks(x: number, y: number, tint: number, n: number) {
    const em = this.add.particles(x, y, 'spark', {
      lifespan: { min: 200, max: 500 },
      speed: { min: 60, max: 240 },
      scale: { start: 1, end: 0 },
      gravityY: 400,
      tint,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(53);
    em.explode(n);
    this.time.delayedCall(600, () => em.destroy());
  }

  private puff(x: number, y: number, tint: number, n = 6) {
    const em = this.add.particles(x, y, 'smoke', {
      lifespan: { min: 400, max: 800 },
      speed: { min: 10, max: 50 },
      scale: { start: 0.6, end: 1.4 },
      alpha: { start: 0.5, end: 0 },
      tint,
      emitting: false,
    }).setDepth(22);
    em.explode(n);
    this.time.delayedCall(900, () => em.destroy());
  }

  private dust(x: number, y: number, n: number, tint = 0xc8b8a8) {
    const em = this.add.particles(x, y, 'smoke', {
      lifespan: 400,
      speedX: { min: -90, max: 90 },
      speedY: { min: -40, max: -5 },
      scale: { start: 0.35, end: 0.8 },
      alpha: { start: 0.45, end: 0 },
      tint,
      emitting: false,
    }).setDepth(22);
    em.explode(n);
    this.time.delayedCall(500, () => em.destroy());
  }

  private debris(x: number, y: number) {
    const em = this.add.particles(x, y, 'spark', {
      lifespan: { min: 400, max: 900 },
      speed: { min: 80, max: 260 },
      scale: { min: 1.2, max: 2.4 },
      gravityY: 900,
      tint: [0x6c6476, 0x5a5262, 0x8a8094],
      emitting: false,
    }).setDepth(22);
    em.explode(14);
    this.puff(x, y, 0x8a8094, 4);
    this.time.delayedCall(1000, () => em.destroy());
  }

  // ------------------------------------------------------------------ HUD

  private emitHud() {
    const st = session.state;
    bus.emit('hud:update', { health: st.health, maxHealth: st.maxHealth, dash: st.powers.dash });
  }

  private emitCharge() {
    const c = session.energy.charge;
    bus.emit('hud:charge', { type: c ? 'FIRE' : null, endsAt: performance.now() + (c?.msLeft ?? 0), totalMs: E.chargeMs });
  }
}
