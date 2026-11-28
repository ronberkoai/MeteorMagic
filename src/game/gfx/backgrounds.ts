import Phaser from 'phaser';
import type { Mood } from '../../logic/roomParser';
import { PALETTES, rng } from './palette';
import { VIEW_H, VIEW_W } from '../../shared/tuning';

/** Seamless (horizontally tiling) parallax layers, generated per mood. */
const LW = 1024;
const LH = 600;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = LW;
  c.height = LH;
  return [c, c.getContext('2d')!];
}

/** Periodic ridge: sum of sines with integer frequencies => tiles seamlessly over LW. */
function ridge(seed: number, base: number, amp: number, freqs: number[]) {
  const r = rng(seed);
  const phases = freqs.map(() => r() * Math.PI * 2);
  const amps = freqs.map((_, i) => amp / (i + 1) ** 0.8);
  return (x: number) => base + freqs.reduce((s, f, i) => s + Math.sin((x / LW) * Math.PI * 2 * f + phases[i]) * amps[i], 0);
}

function drawWrapped(draw: (dx: number) => void) {
  draw(-LW);
  draw(0);
  draw(LW);
}

function sky(mood: Mood, ctx: CanvasRenderingContext2D) {
  const p = PALETTES[mood];
  const g = ctx.createLinearGradient(0, 0, 0, LH);
  g.addColorStop(0, p.skyTop);
  g.addColorStop(0.75, p.skyBottom);
  g.addColorStop(1, p.skyBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, LW, LH);
  const r = rng(mood.length * 999);
  if (p.stars) {
    for (let i = 0; i < 140; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + r() * 0.6})`;
      const s = r() < 0.1 ? 2 : 1;
      ctx.fillRect(r() * LW, r() * LH * 0.6, s, s);
    }
  }
  // horizon glow
  const hg = ctx.createRadialGradient(LW / 2, LH * 0.95, 10, LW / 2, LH * 0.95, LW * 0.6);
  hg.addColorStop(0, p.horizonGlow + 'aa');
  hg.addColorStop(1, p.horizonGlow + '00');
  ctx.fillStyle = hg;
  ctx.fillRect(0, 0, LW, LH);
  if (p.celestial === 'moon') {
    const mg = ctx.createRadialGradient(780, 110, 10, 780, 110, 90);
    mg.addColorStop(0, 'rgba(230,230,255,0.35)');
    mg.addColorStop(1, 'rgba(230,230,255,0)');
    ctx.fillStyle = mg;
    ctx.fillRect(600, 0, 400, 260);
    ctx.fillStyle = '#e8e6f5';
    ctx.beginPath();
    ctx.arc(780, 110, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.skyTop;
    ctx.beginPath();
    ctx.arc(792, 102, 23, 0, Math.PI * 2);
    ctx.fill();
  } else if (p.celestial === 'sun') {
    const sy = mood === 'dusk' ? 420 : 120;
    const sg = ctx.createRadialGradient(260, sy, 10, 260, sy, 160);
    sg.addColorStop(0, 'rgba(255,250,220,0.95)');
    sg.addColorStop(0.2, 'rgba(255,240,190,0.5)');
    sg.addColorStop(1, 'rgba(255,240,190,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, 600, LH);
  } else if (p.celestial === 'meteor') {
    // the meteor's smoke trail streaked across the sky
    ctx.strokeStyle = 'rgba(160,140,255,0.25)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(900, 30);
    ctx.quadraticCurveTo(650, 160, 420, 420);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(220,210,255,0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (mood === 'fantasy') {
    // soft clouds
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let i = 0; i < 9; i++) {
      const cx = r() * LW;
      const cy = 60 + r() * 160;
      drawWrapped((dx) => {
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.ellipse(cx + dx + k * 22 - 44, cy + Math.sin(k) * 6, 30, 14, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    }
  }
}

function far(mood: Mood, ctx: CanvasRenderingContext2D) {
  const p = PALETTES[mood];
  if (mood === 'temple') {
    // carved inner wall instead of distant mountains
    ctx.fillStyle = p.far;
    ctx.fillRect(0, 0, LW, LH);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < LH; y += 48) for (let x = -32; x < LW; x += 64) ctx.fillRect(x + ((y / 48) % 2) * 32, y, 60, 44);
    ctx.fillStyle = 'rgba(255,200,120,0.06)';
    for (let x = 64; x < LW; x += 256) ctx.fillRect(x, 0, 90, LH);
    return;
  }
  const f = ridge(mood.length * 31 + 7, LH * 0.62, 70, [2, 3, 5, 9, 15]);
  ctx.fillStyle = p.far;
  ctx.beginPath();
  ctx.moveTo(0, LH);
  for (let x = 0; x <= LW; x += 4) ctx.lineTo(x, f(x));
  ctx.lineTo(LW, LH);
  ctx.closePath();
  ctx.fill();
  if (mood === 'fantasy') {
    // snowy caps / haze
    const hz = ctx.createLinearGradient(0, LH * 0.4, 0, LH);
    hz.addColorStop(0, 'rgba(255,255,255,0)');
    hz.addColorStop(1, 'rgba(220,245,255,0.5)');
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, LW, LH);
  }
}

function mid(mood: Mood, ctx: CanvasRenderingContext2D) {
  const p = PALETTES[mood];
  const r = rng(mood.length * 77 + 3);
  const groundY = LH * 0.8;
  const g = ridge(mood.length * 13 + 1, groundY, 18, [3, 7, 11]);
  ctx.fillStyle = p.mid;
  ctx.beginPath();
  ctx.moveTo(0, LH);
  for (let x = 0; x <= LW; x += 4) ctx.lineTo(x, g(x));
  ctx.lineTo(LW, LH);
  ctx.closePath();
  ctx.fill();

  const kind = p.midKind;
  const count = kind === 'pillars' ? 8 : 14;
  for (let i = 0; i < count; i++) {
    const x = (i / count) * LW + r() * 40;
    const y = g(x) + 4;
    drawWrapped((dx) => {
      const X = x + dx;
      ctx.fillStyle = p.mid;
      if (kind === 'trees' || (kind === 'mixed' && i % 2 === 0)) {
        const h = 70 + r() * 90;
        ctx.fillRect(X - 3, y - h, 6, h);
        ctx.fillStyle = kind === 'trees' ? p.near : p.mid;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.arc(X + (k - 1.5) * 12, y - h + Math.sin(k * 2) * 8, 22 + k * 2, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (kind === 'ruins' || kind === 'mixed') {
        const w = 40 + r() * 50;
        const h = 30 + r() * 50;
        ctx.fillRect(X, y - h, w, h);
        ctx.beginPath();
        ctx.moveTo(X - 6, y - h);
        ctx.lineTo(X + w * 0.45, y - h - 26 - r() * 14);
        ctx.lineTo(X + w * 0.7, y - h - 10);
        ctx.lineTo(X + w * 0.75, y - h);
        ctx.closePath();
        ctx.fill();
        // window glow (fire inside ruins)
        if (kind === 'ruins' && r() < 0.6) {
          ctx.fillStyle = 'rgba(255,110,40,0.55)';
          ctx.fillRect(X + w * 0.3, y - h * 0.6, 7, 9);
        }
        // charred dead tree
        ctx.strokeStyle = p.mid;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(X + w + 14, y);
        ctx.lineTo(X + w + 16, y - 60);
        ctx.lineTo(X + w + 28, y - 80);
        ctx.moveTo(X + w + 16, y - 45);
        ctx.lineTo(X + w + 4, y - 62);
        ctx.stroke();
      } else if (kind === 'pillars') {
        ctx.fillStyle = p.mid;
        ctx.fillRect(X, 60, 34, LH);
        ctx.fillRect(X - 8, 60, 50, 16);
        ctx.fillStyle = 'rgba(255,200,120,0.08)';
        ctx.fillRect(X + 4, 76, 6, LH);
      } else if (kind === 'tents') {
        const w = 60 + r() * 40;
        const h = 40 + r() * 20;
        ctx.beginPath();
        ctx.moveTo(X, y);
        ctx.lineTo(X + w / 2, y - h);
        ctx.lineTo(X + w, y);
        ctx.closePath();
        ctx.fill();
        if (r() < 0.5) {
          ctx.fillStyle = 'rgba(255,120,40,0.4)';
          ctx.beginPath();
          ctx.moveTo(X + w / 2 - 6, y);
          ctx.lineTo(X + w / 2, y - 16);
          ctx.lineTo(X + w / 2 + 6, y);
          ctx.closePath();
          ctx.fill();
        }
        // palisade
        ctx.fillStyle = p.near;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(X + w + 10 + k * 9, y);
          ctx.lineTo(X + w + 10 + k * 9, y - 34);
          ctx.lineTo(X + w + 14 + k * 9, y - 42);
          ctx.lineTo(X + w + 18 + k * 9, y - 34);
          ctx.lineTo(X + w + 18 + k * 9, y);
          ctx.fill();
        }
      }
    });
  }
}

const FACTORS = [0, 0.12, 0.35];

export function ensureBackgrounds(scene: Phaser.Scene, mood: Mood) {
  const keys = [`bg_${mood}_0`, `bg_${mood}_1`, `bg_${mood}_2`];
  if (!scene.textures.exists(keys[0])) {
    const fns = [sky, far, mid];
    fns.forEach((fn, i) => {
      const [c, ctx] = canvas();
      fn(mood, ctx);
      scene.textures.addCanvas(keys[i], c);
    });
  }
  return keys;
}

export class Parallax {
  private layers: { ts: Phaser.GameObjects.TileSprite; f: number }[] = [];

  constructor(scene: Phaser.Scene, mood: Mood) {
    const keys = ensureBackgrounds(scene, mood);
    keys.forEach((k, i) => {
      const ts = scene.add.tileSprite(0, 0, VIEW_W, LH, k).setOrigin(0, 0).setScrollFactor(0).setDepth(-100 + i);
      this.layers.push({ ts, f: FACTORS[i] });
    });
  }

  update(cam: Phaser.Cameras.Scene2D.Camera) {
    for (const { ts, f } of this.layers) {
      ts.tilePositionX = cam.scrollX * f;
      ts.y = Phaser.Math.Clamp(-(LH - VIEW_H) * 0.5 - cam.scrollY * f * 0.25, -(LH - VIEW_H), 0);
    }
  }

  setVisible(v: boolean) {
    this.layers.forEach(({ ts }) => ts.setVisible(v));
  }

  isVisible() {
    return this.layers[0]?.ts.visible ?? false;
  }

  /** Scroll on its own (title screen). */
  drift(dt: number) {
    for (const { ts, f } of this.layers) {
      ts.tilePositionX += dt * 0.02 * (f + 0.05);
      ts.y = -(LH - VIEW_H) * 0.5;
    }
  }
}
