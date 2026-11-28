import Phaser from 'phaser';

/**
 * All art is generated procedurally at boot (no external asset files yet).
 * Characters are drawn with simple shapes per animation frame onto a canvas spritesheet.
 */

type Ctx = CanvasRenderingContext2D;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function addSheet(scene: Phaser.Scene, key: string, canvas: HTMLCanvasElement, fw: number, fh: number) {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.addCanvas(key, canvas)!;
  const cols = Math.floor(canvas.width / fw);
  const rows = Math.floor(canvas.height / fh);
  let i = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) tex.add(i++, 0, x * fw, y * fh, fw, fh);
}

function addSingle(scene: Phaser.Scene, key: string, w: number, h: number, draw: (ctx: Ctx) => void) {
  const [c, ctx] = makeCanvas(w, h);
  draw(ctx);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, c);
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function radial(ctx: Ctx, cx: number, cy: number, r: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------- hero

interface HeroPose {
  legA: number; // forward leg offset (px)
  legB: number;
  bob: number;
  lean: number;
  arm: 'down' | 'forward' | 'up' | 'back';
  scarf: number; // scarf wave phase
  glow: number; // chest glow strength 0..1
  tuck?: boolean;
}

export const HERO_FRAMES = {
  idle: [0, 1, 2, 3],
  run: [4, 5, 6, 7, 8, 9],
  jump: [10],
  fall: [11],
  siphon: [12],
  release: [13],
  dash: [14],
  hurt: [15],
};

function drawHero(ctx: Ctx, ox: number, p: HeroPose) {
  const fx = ox + 16 + p.lean;
  const ground = 47;
  const hipY = ground - 13 + p.bob;
  // (the scarf is a separate physics rope, see Player.ts)
  // legs
  const leg = (dx: number, shade: string) => {
    ctx.fillStyle = shade;
    const lx = fx - 2 + dx;
    if (p.tuck) {
      ctx.fillRect(lx - 1, hipY, 5, 7);
      ctx.fillStyle = '#5a3a24';
      ctx.fillRect(lx - 1, hipY + 6, 6, 3);
      return;
    }
    ctx.fillRect(lx - 1, hipY, 5, 10);
    ctx.fillStyle = '#5a3a24';
    ctx.fillRect(lx - 1, hipY + 9, 6, 4);
  };
  leg(p.legB, '#151729');
  // body / cloak
  ctx.fillStyle = '#26345f';
  rr(ctx, fx - 8, hipY - 17, 15, 19, 4);
  ctx.fill();
  ctx.fillStyle = '#3d55a0';
  rr(ctx, fx - 6, hipY - 16, 11, 15, 3);
  ctx.fill();
  // belt
  ctx.fillStyle = '#6b4526';
  ctx.fillRect(fx - 7, hipY - 3, 14, 3);
  leg(p.legA, '#1d2038');
  // meteor mark on chest
  radial(ctx, fx + 1, hipY - 10, 5 + p.glow * 3, [
    [0, `rgba(230,220,255,${0.9})`],
    [0.4, `rgba(150,130,255,${0.6 + p.glow * 0.4})`],
    [1, 'rgba(120,90,255,0)'],
  ]);
  ctx.fillStyle = '#efeaff';
  ctx.fillRect(fx, hipY - 11, 2, 2);
  // arm
  ctx.fillStyle = '#2f4282';
  const shoulderX = fx + 1;
  const shoulderY = hipY - 14;
  ctx.save();
  ctx.translate(shoulderX, shoulderY);
  const ang = p.arm === 'down' ? 0.25 : p.arm === 'forward' ? -1.45 : p.arm === 'up' ? -2.6 : 0.9;
  ctx.rotate(ang);
  rr(ctx, -2, 0, 4.5, 11, 2);
  ctx.fill();
  ctx.fillStyle = '#f0c49a';
  ctx.fillRect(-2, 10, 4.5, 3);
  ctx.restore();
  // head + hood
  const hx = fx + 1;
  const hy = hipY - 23;
  ctx.fillStyle = '#26345f';
  ctx.beginPath();
  ctx.arc(hx - 1, hy, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f0c49a';
  ctx.beginPath();
  ctx.arc(hx + 2, hy + 1, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#26345f';
  ctx.fillRect(hx - 9, hy - 8, 9, 16);
  ctx.beginPath();
  ctx.moveTo(hx - 8, hy - 6);
  ctx.lineTo(hx + 7, hy - 7);
  ctx.lineTo(hx + 3, hy - 3);
  ctx.closePath();
  ctx.fill();
  // eye
  ctx.fillStyle = '#1a1a2a';
  ctx.fillRect(hx + 4, hy, 2, 2.5);
  // hair tuft
  ctx.fillStyle = '#3a2418';
  ctx.fillRect(hx + 1, hy - 4, 5, 2);
}

function heroSheet(scene: Phaser.Scene) {
  const poses: HeroPose[] = [];
  for (let i = 0; i < 4; i++)
    poses.push({ legA: 1, legB: -2, bob: i === 1 || i === 2 ? 1 : 0, lean: 0, arm: 'down', scarf: i * 1.5, glow: 0.3 + 0.1 * i });
  for (let i = 0; i < 6; i++) {
    const t = (i / 6) * Math.PI * 2;
    poses.push({ legA: Math.sin(t) * 5, legB: -Math.sin(t) * 5, bob: Math.abs(Math.cos(t)) * -1.5, lean: 1, arm: Math.sin(t) > 0 ? 'back' : 'down', scarf: i * 1.2, glow: 0.4 });
  }
  poses.push({ legA: 3, legB: -3, bob: -1, lean: 0, arm: 'up', scarf: 0.5, glow: 0.5, tuck: true }); // jump
  poses.push({ legA: 2, legB: -1, bob: 0, lean: 0, arm: 'back', scarf: 2, glow: 0.5 }); // fall
  poses.push({ legA: 3, legB: -3, bob: 0, lean: -1, arm: 'forward', scarf: 1, glow: 1 }); // siphon
  poses.push({ legA: 4, legB: -4, bob: 0, lean: 2, arm: 'forward', scarf: 3, glow: 0.8 }); // release
  poses.push({ legA: 5, legB: -6, bob: 1, lean: 4, arm: 'back', scarf: 4, glow: 1, tuck: true }); // dash
  poses.push({ legA: -2, legB: 2, bob: 0, lean: -3, arm: 'up', scarf: 5, glow: 0.2 }); // hurt
  const [c, ctx] = makeCanvas(32 * poses.length, 48);
  poses.forEach((p, i) => drawHero(ctx, i * 32, p));
  addSheet(scene, 'hero', c, 32, 48);
}

// ---------------------------------------------------------------- bandits

export const ARCHER_FRAMES = { walk: [0, 1, 2, 3], windup: [4], shoot: [5], hurt: [6] };
export const BRUTE_FRAMES = { walk: [0, 1, 2, 3], windup: [4], charge: [5], stunned: [6], hurt: [7] };

function drawArcher(ctx: Ctx, ox: number, legA: number, legB: number, bow: 'rest' | 'drawn' | 'loosed', hurt: boolean) {
  const fx = ox + 16;
  const hipY = 34;
  const leg = (dx: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(fx - 3 + dx, hipY, 5, 10);
    ctx.fillStyle = '#2a1b12';
    ctx.fillRect(fx - 3 + dx, hipY + 9, 6, 4);
  };
  leg(legB, '#2e231b');
  ctx.fillStyle = '#5e4129';
  rr(ctx, fx - 8, hipY - 17, 15, 19, 3);
  ctx.fill();
  ctx.fillStyle = '#7a5634';
  ctx.fillRect(fx - 6, hipY - 15, 10, 13);
  ctx.fillStyle = '#3d2a1a';
  ctx.fillRect(fx - 8, hipY - 3, 15, 3);
  // quiver on back
  ctx.fillStyle = '#4a2f1c';
  ctx.fillRect(fx - 10, hipY - 20, 4, 14);
  ctx.fillStyle = '#ff9a3c';
  ctx.fillRect(fx - 10, hipY - 23, 1.5, 3);
  ctx.fillRect(fx - 8, hipY - 22, 1.5, 3);
  leg(legA, '#3a2c22');
  // head
  ctx.fillStyle = '#c99b74';
  ctx.beginPath();
  ctx.arc(fx + 1, hipY - 23, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8322a'; // bandana
  ctx.fillRect(fx - 5, hipY - 29, 12, 4);
  ctx.beginPath();
  ctx.moveTo(fx - 5, hipY - 27);
  ctx.lineTo(fx - 11, hipY - 25);
  ctx.lineTo(fx - 9, hipY - 23);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b1c16'; // face mask
  ctx.fillRect(fx - 1, hipY - 21, 8, 4);
  ctx.fillStyle = hurt ? '#ffffff' : '#ffdd66';
  ctx.fillRect(fx + 3, hipY - 25, 2, 2);
  // bow
  ctx.strokeStyle = '#8b5a2b';
  ctx.lineWidth = 2.5;
  const bx = fx + (bow === 'rest' ? 6 : 9);
  const by = hipY - 13;
  ctx.beginPath();
  ctx.arc(bx - 4, by, 11, -1.1, 1.1);
  ctx.stroke();
  ctx.strokeStyle = '#e8dcc0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const pull = bow === 'drawn' ? -6 : 0;
  ctx.moveTo(bx + 1, by - 10);
  ctx.lineTo(bx - 3 + pull, by);
  ctx.lineTo(bx + 1, by + 10);
  ctx.stroke();
  if (bow === 'drawn') {
    ctx.fillStyle = '#d9c39a';
    ctx.fillRect(bx - 9, by - 0.5, 14, 1.5);
    radial(ctx, bx + 6, by, 5, [
      [0, 'rgba(255,240,180,1)'],
      [0.5, 'rgba(255,140,40,0.9)'],
      [1, 'rgba(255,80,0,0)'],
    ]);
  }
  // arm
  ctx.fillStyle = '#5e4129';
  ctx.fillRect(fx, by - 2, bow === 'rest' ? 6 : 9, 4);
}

function drawBrute(ctx: Ctx, ox: number, legA: number, legB: number, pose: 'walk' | 'windup' | 'charge' | 'stunned' | 'hurt') {
  const fx = ox + 24 + (pose === 'charge' ? 3 : 0);
  const hipY = 40;
  const leg = (dx: number, c: string) => {
    ctx.fillStyle = c;
    ctx.fillRect(fx - 5 + dx, hipY, 8, 12);
    ctx.fillStyle = '#1f1a16';
    ctx.fillRect(fx - 5 + dx, hipY + 11, 10, 5);
  };
  leg(legB, '#2f2a26');
  // body
  ctx.fillStyle = '#4b3627';
  rr(ctx, fx - 13, hipY - 24, 24, 27, 6);
  ctx.fill();
  ctx.fillStyle = '#606775';
  rr(ctx, fx - 11, hipY - 22, 20, 14, 4);
  ctx.fill();
  ctx.fillStyle = '#7d8492';
  ctx.fillRect(fx - 9, hipY - 20, 16, 3);
  leg(legA, '#3a332e');
  // head + helmet
  ctx.fillStyle = '#b98a66';
  ctx.beginPath();
  ctx.arc(fx + 1, hipY - 29, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b616e';
  ctx.beginPath();
  ctx.arc(fx + 1, hipY - 31, 8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(fx - 7, hipY - 32, 17, 3);
  ctx.fillStyle = '#c0392b';
  ctx.fillRect(fx - 1, hipY - 41, 3, 4);
  ctx.fillStyle = pose === 'stunned' ? '#9ad' : '#ffcc55';
  ctx.fillRect(fx + 4, hipY - 29, 3, 2);
  if (pose === 'stunned') {
    ctx.fillStyle = '#ffe680';
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(fx + 1 + Math.cos(a) * 10, hipY - 44 + Math.sin(a) * 3, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // shield
  const sx = pose === 'stunned' ? fx + 6 : fx + 10;
  const sy = pose === 'stunned' ? hipY - 6 : hipY - 26;
  ctx.save();
  ctx.translate(sx, sy);
  if (pose === 'stunned') ctx.rotate(0.9);
  ctx.fillStyle = '#3c4048';
  rr(ctx, -2, 0, 10, 30, 3);
  ctx.fill();
  ctx.fillStyle = pose === 'hurt' ? '#ffffff' : '#7a7f8a';
  rr(ctx, 0, 2, 6, 26, 2);
  ctx.fill();
  ctx.fillStyle = '#b8322a';
  ctx.fillRect(1, 12, 4, 6);
  ctx.restore();
}

function banditSheets(scene: Phaser.Scene) {
  {
    const frames = 7;
    const [c, ctx] = makeCanvas(32 * frames, 48);
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI * 2;
      drawArcher(ctx, i * 32, Math.sin(t) * 4, -Math.sin(t) * 4, 'rest', false);
    }
    drawArcher(ctx, 4 * 32, 2, -3, 'drawn', false);
    drawArcher(ctx, 5 * 32, 2, -3, 'loosed', false);
    drawArcher(ctx, 6 * 32, -2, 2, 'rest', true);
    addSheet(scene, 'archer', c, 32, 48);
  }
  {
    const frames = 8;
    const [c, ctx] = makeCanvas(48 * frames, 56);
    for (let i = 0; i < 4; i++) {
      const t = (i / 4) * Math.PI * 2;
      drawBrute(ctx, i * 48, Math.sin(t) * 4, -Math.sin(t) * 4, 'walk');
    }
    drawBrute(ctx, 4 * 48, 3, -3, 'windup');
    drawBrute(ctx, 5 * 48, 6, -6, 'charge');
    drawBrute(ctx, 6 * 48, 0, 0, 'stunned');
    drawBrute(ctx, 7 * 48, 0, 0, 'hurt');
    addSheet(scene, 'brute', c, 48, 56);
  }
}

// ---------------------------------------------------------------- objects & fx

function objects(scene: Phaser.Scene) {
  addSingle(scene, 'campfire', 44, 22, (ctx) => {
    ctx.fillStyle = '#4a4552';
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      ctx.ellipse(5 + i * 7, 18, 5, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5a3720';
    ctx.save();
    ctx.translate(22, 14);
    ctx.rotate(0.35);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.rotate(-0.7);
    ctx.fillRect(-14, -3, 28, 6);
    ctx.restore();
    radial(ctx, 22, 13, 9, [
      [0, 'rgba(255,230,150,1)'],
      [1, 'rgba(255,90,20,0)'],
    ]);
  });
  addSingle(scene, 'torch', 14, 30, (ctx) => {
    ctx.fillStyle = '#2d2d36';
    ctx.fillRect(1, 16, 12, 4);
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(5, 6, 4, 24);
    ctx.fillStyle = '#3a2a20';
    ctx.fillRect(3, 4, 8, 5);
  });
  addSingle(scene, 'torch_out', 14, 30, (ctx) => {
    ctx.fillStyle = '#2d2d36';
    ctx.fillRect(1, 16, 12, 4);
    ctx.fillStyle = '#4b3424';
    ctx.fillRect(5, 6, 4, 24);
    ctx.fillStyle = '#222';
    ctx.fillRect(3, 4, 8, 5);
  });
  const brazier = (lit: boolean) => (ctx: Ctx) => {
    ctx.fillStyle = '#5e5a66';
    ctx.fillRect(12, 18, 8, 12);
    ctx.fillStyle = '#4a4652';
    ctx.fillRect(8, 28, 16, 4);
    ctx.fillStyle = '#76717f';
    ctx.beginPath();
    ctx.moveTo(2, 10);
    ctx.lineTo(30, 10);
    ctx.lineTo(24, 20);
    ctx.lineTo(8, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#a49cb0';
    ctx.fillRect(2, 9, 28, 3);
    ctx.fillStyle = lit ? '#ffb347' : '#2a2730';
    ctx.fillRect(5, 7, 22, 3);
    // rune
    ctx.fillStyle = lit ? '#ffe9a8' : '#8f86a8';
    ctx.fillRect(15, 13, 2, 5);
    ctx.fillRect(13, 15, 6, 1.5);
  };
  addSingle(scene, 'brazier_off', 32, 32, brazier(false));
  addSingle(scene, 'brazier_on', 32, 32, brazier(true));
  addSingle(scene, 'resin', 32, 32, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 32, 32);
    g.addColorStop(0, '#f6b44a');
    g.addColorStop(0.5, '#c46a17');
    g.addColorStop(1, '#8a3f0e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(4, 0);
    ctx.lineTo(28, 0);
    ctx.lineTo(31, 16);
    ctx.lineTo(27, 32);
    ctx.lineTo(5, 32);
    ctx.lineTo(1, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,240,190,0.55)';
    ctx.fillRect(8, 3, 3, 12);
    ctx.fillRect(18, 18, 2, 9);
    ctx.fillStyle = 'rgba(90,30,5,0.5)';
    ctx.fillRect(13, 6, 2, 2);
    ctx.fillRect(22, 10, 2, 2);
    ctx.fillRect(9, 22, 2, 2);
  });
  const door = (active: boolean) => (ctx: Ctx) => {
    ctx.fillStyle = '#4b4658';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#5d5770';
    ctx.fillRect(2, 2, 28, 28);
    ctx.strokeStyle = active ? '#ffd27a' : '#2f2b3a';
    ctx.lineWidth = 2;
    ctx.strokeRect(6, 6, 20, 20);
    ctx.fillStyle = active ? '#ffe9b0' : '#8c82b0';
    ctx.beginPath();
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
  };
  addSingle(scene, 'door', 32, 32, door(false));
  addSingle(scene, 'door_on', 32, 32, door(true));
  addSingle(scene, 'cracked', 32, 32, (ctx) => {
    ctx.fillStyle = '#5a5262';
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = '#6c6476';
    ctx.fillRect(1, 1, 14, 9);
    ctx.fillRect(17, 1, 14, 9);
    ctx.fillRect(1, 12, 9, 8);
    ctx.fillRect(12, 12, 19, 8);
    ctx.fillRect(1, 22, 18, 9);
    ctx.fillRect(21, 22, 10, 9);
    ctx.strokeStyle = '#1e1a24';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(16, 0);
    ctx.lineTo(13, 9);
    ctx.lineTo(18, 15);
    ctx.lineTo(12, 23);
    ctx.lineTo(16, 32);
    ctx.moveTo(18, 15);
    ctx.lineTo(27, 18);
    ctx.stroke();
  });
  addSingle(scene, 'barrel', 28, 32, (ctx) => {
    ctx.fillStyle = '#8e2a1e';
    rr(ctx, 2, 1, 24, 31, 6);
    ctx.fill();
    ctx.fillStyle = '#b5402c';
    ctx.fillRect(6, 2, 6, 29);
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(2, 6, 24, 3);
    ctx.fillRect(2, 23, 24, 3);
    ctx.fillStyle = '#ffcc33';
    ctx.beginPath();
    ctx.moveTo(14, 11);
    ctx.lineTo(19, 20);
    ctx.lineTo(9, 20);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#8e2a1e';
    ctx.fillRect(13.2, 14, 1.6, 3);
  });
  addSingle(scene, 'gate', 32, 32, (ctx) => {
    ctx.fillStyle = '#4a3220';
    ctx.fillRect(0, 0, 32, 32);
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = i % 2 ? '#5e4129' : '#6b4b30';
      ctx.fillRect(i * 8 + 1, 0, 6, 32);
    }
    ctx.fillStyle = '#2b2b30';
    ctx.fillRect(0, 6, 32, 4);
    ctx.fillRect(0, 22, 32, 4);
    ctx.fillStyle = '#77777f';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(i * 8 + 3, 7, 2, 2);
      ctx.fillRect(i * 8 + 3, 23, 2, 2);
    }
  });
  addSingle(scene, 'sign', 32, 32, (ctx) => {
    ctx.fillStyle = '#5a3a22';
    ctx.fillRect(14, 14, 4, 18);
    ctx.fillStyle = '#8a5f38';
    rr(ctx, 3, 4, 26, 14, 2);
    ctx.fill();
    ctx.fillStyle = '#6b4526';
    ctx.fillRect(6, 8, 18, 2);
    ctx.fillRect(6, 12, 14, 2);
  });
  addSingle(scene, 'shard_kinetic', 24, 32, (ctx) => {
    radial(ctx, 12, 16, 12, [
      [0, 'rgba(200,190,255,0.9)'],
      [1, 'rgba(120,90,255,0)'],
    ]);
    ctx.fillStyle = '#8f7dff';
    ctx.beginPath();
    ctx.moveTo(12, 2);
    ctx.lineTo(20, 14);
    ctx.lineTo(12, 30);
    ctx.lineTo(4, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#d9d2ff';
    ctx.beginPath();
    ctx.moveTo(12, 4);
    ctx.lineTo(15, 14);
    ctx.lineTo(12, 22);
    ctx.closePath();
    ctx.fill();
  });
  addSingle(scene, 'shard_health', 24, 24, (ctx) => {
    radial(ctx, 12, 12, 12, [
      [0, 'rgba(255,190,190,0.9)'],
      [1, 'rgba(255,60,90,0)'],
    ]);
    ctx.fillStyle = '#ff4d6a';
    ctx.beginPath();
    ctx.moveTo(12, 20);
    ctx.bezierCurveTo(-1, 11, 5, 1, 12, 7);
    ctx.bezierCurveTo(19, 1, 25, 11, 12, 20);
    ctx.fill();
    ctx.fillStyle = '#ffd0d8';
    ctx.fillRect(7, 7, 3, 3);
  });
  addSingle(scene, 'fireball', 24, 24, (ctx) =>
    radial(ctx, 12, 12, 12, [
      [0, 'rgba(255,255,230,1)'],
      [0.35, 'rgba(255,200,80,1)'],
      [0.7, 'rgba(255,100,20,0.8)'],
      [1, 'rgba(255,60,0,0)'],
    ]),
  );
  addSingle(scene, 'arrow', 26, 6, (ctx) => {
    ctx.fillStyle = '#d9c39a';
    ctx.fillRect(2, 2, 18, 2);
    ctx.fillStyle = '#b8322a';
    ctx.fillRect(0, 1, 4, 4);
    radial(ctx, 22, 3, 4, [
      [0, 'rgba(255,250,200,1)'],
      [0.5, 'rgba(255,150,40,1)'],
      [1, 'rgba(255,80,0,0)'],
    ]);
  });
  addSingle(scene, 'alert', 10, 18, (ctx) => {
    ctx.fillStyle = '#ffd23f';
    ctx.fillRect(3, 0, 4, 11);
    ctx.fillRect(3, 13, 4, 4);
  });
  addSingle(scene, 'ring', 128, 128, (ctx) => {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(64, 64, 60, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.stroke();
  });
  // particles
  addSingle(scene, 'dot', 16, 16, (ctx) =>
    radial(ctx, 8, 8, 8, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.8)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  addSingle(scene, 'spark', 4, 4, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
  });
  addSingle(scene, 'smoke', 32, 32, (ctx) =>
    radial(ctx, 16, 16, 16, [
      [0, 'rgba(255,255,255,0.5)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  addSingle(scene, 'leaf', 6, 4, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(3, 2, 3, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
  });
  // lighting
  addSingle(scene, 'lightmask', 256, 256, (ctx) =>
    radial(ctx, 128, 128, 128, [
      [0, 'rgba(255,255,255,1)'],
      [0.35, 'rgba(255,255,255,0.85)'],
      [0.7, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  addSingle(scene, 'glow', 128, 128, (ctx) =>
    radial(ctx, 64, 64, 64, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.3, 'rgba(255,255,255,0.4)'],
      [1, 'rgba(255,255,255,0)'],
    ]),
  );
  addSingle(scene, 'pixel', 4, 4, (ctx) => {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
  });
}


function scenery(scene: Phaser.Scene) {
  // village cottage for the opening scene
  addSingle(scene, 'house', 120, 100, (ctx) => {
    ctx.fillStyle = '#6b4a32';
    ctx.fillRect(14, 44, 92, 56);
    ctx.fillStyle = '#7d5a3e';
    for (let y = 48; y < 100; y += 10) ctx.fillRect(14, y, 92, 2);
    ctx.fillStyle = '#4a2f22';
    ctx.beginPath();
    ctx.moveTo(4, 48);
    ctx.lineTo(60, 8);
    ctx.lineTo(116, 48);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#5e3b2a';
    for (let i = 0; i < 5; i++) ctx.fillRect(14 + i * 18, 30 - (i < 3 ? i * 6 : (4 - i) * 6), 2, 18);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(80, 14, 10, 22);
    ctx.fillStyle = '#ffcf7a';
    ctx.fillRect(28, 60, 16, 14);
    ctx.fillRect(76, 60, 16, 14);
    ctx.fillStyle = '#4a2f22';
    ctx.fillRect(35, 60, 2, 14);
    ctx.fillRect(28, 66, 16, 2);
    ctx.fillRect(83, 60, 2, 14);
    ctx.fillRect(76, 66, 16, 2);
    ctx.fillStyle = '#3a2418';
    ctx.fillRect(52, 70, 16, 30);
  });
  // grass tuft that sways
  addSingle(scene, 'tuft', 18, 16, (ctx) => {
    const blades = [[3, 10, -2], [6, 14, -1], [9, 16, 0], [12, 13, 1], [15, 9, 2]];
    for (const [x, h, lean] of blades) {
      ctx.strokeStyle = h > 12 ? '#6fd57a' : '#3fae5c';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x, 16);
      ctx.quadraticCurveTo(x, 16 - h * 0.6, x + lean * 2, 16 - h);
      ctx.stroke();
    }
  });
  // soft light ray for sunny rooms
  addSingle(scene, 'ray', 160, 512, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(255,250,220,0.55)');
    g.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(60, 0);
    ctx.lineTo(100, 0);
    ctx.lineTo(160, 512);
    ctx.lineTo(0, 512);
    ctx.closePath();
    ctx.fill();
  });
  // drifting fog band (tiles horizontally)
  addSingle(scene, 'fog', 512, 160, (ctx) => {
    for (let i = 0; i < 26; i++) {
      const x = (i * 97) % 512;
      const y = 60 + ((i * 53) % 70);
      const r = 40 + ((i * 31) % 50);
      for (const dx of [-512, 0, 512]) {
        radial(ctx, x + dx, y, r, [
          [0, 'rgba(255,255,255,0.18)'],
          [1, 'rgba(255,255,255,0)'],
        ]);
      }
    }
  });
}

export function generateTextures(scene: Phaser.Scene) {
  scenery(scene);
  heroSheet(scene);
  banditSheets(scene);
  objects(scene);
}

export function registerAnimations(scene: Phaser.Scene) {
  const make = (key: string, tex: string, frames: number[], frameRate: number, repeat = -1) => {
    if (scene.anims.exists(key)) return;
    scene.anims.create({ key, frames: frames.map((f) => ({ key: tex, frame: f })), frameRate, repeat });
  };
  make('hero-idle', 'hero', HERO_FRAMES.idle, 5);
  make('hero-run', 'hero', HERO_FRAMES.run, 13);
  make('hero-jump', 'hero', HERO_FRAMES.jump, 1);
  make('hero-fall', 'hero', HERO_FRAMES.fall, 1);
  make('hero-siphon', 'hero', HERO_FRAMES.siphon, 1);
  make('hero-release', 'hero', HERO_FRAMES.release, 1);
  make('hero-dash', 'hero', HERO_FRAMES.dash, 1);
  make('hero-hurt', 'hero', HERO_FRAMES.hurt, 1);
  make('archer-walk', 'archer', ARCHER_FRAMES.walk, 6);
  make('archer-windup', 'archer', ARCHER_FRAMES.windup, 1);
  make('archer-shoot', 'archer', ARCHER_FRAMES.shoot, 1);
  make('archer-hurt', 'archer', ARCHER_FRAMES.hurt, 1);
  make('brute-walk', 'brute', BRUTE_FRAMES.walk, 5);
  make('brute-windup', 'brute', BRUTE_FRAMES.windup, 1);
  make('brute-charge', 'brute', [5, 4], 10);
  make('brute-stunned', 'brute', BRUTE_FRAMES.stunned, 1);
  make('brute-hurt', 'brute', BRUTE_FRAMES.hurt, 1);
}
