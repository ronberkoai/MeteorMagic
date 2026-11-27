import Phaser from 'phaser';
import { ONEWAY, ParsedRoom, SOLID, SPIKES, tileAt } from '../../logic/roomParser';
import { TILE } from '../../shared/tuning';
import { PALETTES, hashString, rng, shade } from './palette';

/** Renders all static tiles of a room into one canvas texture (one draw call, rich detail). */
export function buildTerrainTexture(scene: Phaser.Scene, room: ParsedRoom): string {
  const key = `terrain_${room.def.id}`;
  if (scene.textures.exists(key)) return key;
  const p = PALETTES[room.def.mood];
  const W = room.width * TILE;
  const H = room.height * TILE;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d')!;
  const r = rng(hashString(room.def.id));
  const solid = (x: number, y: number) => tileAt(room, x, y) === SOLID || (y >= room.height && tileAt(room, x, room.height - 1) === SOLID);
  const fantasy = room.def.mood === 'fantasy';
  const temple = room.def.mood === 'temple';

  for (let ty = 0; ty < room.height; ty++) {
    for (let tx = 0; tx < room.width; tx++) {
      const t = tileAt(room, tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      if (t === SOLID) {
        // depth: darker the deeper below the surface
        let depth = 0;
        while (depth < 4 && solid(tx, ty - depth - 1)) depth++;
        ctx.fillStyle = shade(p.rock, -depth * 7);
        ctx.fillRect(x, y, TILE, TILE);
        // stone/brick texture
        if (temple) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          const off = ty % 2 ? 16 : 0;
          ctx.fillRect(x, y + 15, TILE, 2);
          ctx.fillRect(x + ((off + 0) % 32), y, 2, 15);
          ctx.fillRect(x + ((off + 16) % 32), y + 17, 2, 15);
        } else {
          for (let i = 0; i < 5; i++) {
            ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.05)';
            const s = 3 + Math.floor(r() * 6);
            ctx.fillRect(x + Math.floor(r() * (TILE - s)), y + Math.floor(r() * (TILE - s)), s, s);
          }
        }
        const top = !solid(tx, ty - 1) && ty > 0;
        const left = tx > 0 && !solid(tx - 1, ty);
        const right = tx < room.width - 1 && !solid(tx + 1, ty);
        const bottom = ty < room.height - 1 && !solid(tx, ty + 1);
        if (left) {
          ctx.fillStyle = p.rockLight;
          ctx.fillRect(x, y, 3, TILE);
        }
        if (right) {
          ctx.fillStyle = p.rockDark;
          ctx.fillRect(x + TILE - 3, y, 3, TILE);
        }
        if (bottom) {
          ctx.fillStyle = p.rockDark;
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
        }
        if (top) {
          ctx.fillStyle = p.top;
          ctx.fillRect(x, y, TILE, 8);
          ctx.fillStyle = p.topLight;
          ctx.fillRect(x, y, TILE, 3);
          if (fantasy) {
            // grass blades hanging over the edge and growing up
            ctx.fillStyle = p.top;
            for (let i = 0; i < 6; i++) {
              const gx = x + r() * TILE;
              ctx.fillRect(gx, y + 7, 2, 3 + r() * 4);
              ctx.fillStyle = p.topLight;
              ctx.fillRect(x + r() * TILE, y - 3 - r() * 3, 2, 4 + r() * 3);
              ctx.fillStyle = p.top;
            }
          } else if (!temple) {
            // ash with ember specks
            for (let i = 0; i < 3; i++) {
              ctx.fillStyle = r() < 0.4 ? 'rgba(255,120,40,0.8)' : 'rgba(0,0,0,0.25)';
              ctx.fillRect(x + r() * TILE, y + 2 + r() * 5, 2, 2);
            }
          } else {
            ctx.fillStyle = 'rgba(255,240,180,0.35)';
            ctx.fillRect(x, y + 8, TILE, 1);
          }
        }
      } else if (t === ONEWAY) {
        // plank / stone slab
        ctx.fillStyle = temple ? p.rockLight : p.plank;
        ctx.fillRect(x, y, TILE, 9);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(x, y, TILE, 2);
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y + 8, TILE, 2);
        if (!temple) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.fillRect(x + TILE - 2, y, 2, 9);
          ctx.fillStyle = '#9a9aa5';
          ctx.fillRect(x + 4, y + 3, 2, 2);
          ctx.fillRect(x + TILE - 8, y + 3, 2, 2);
          // support rope / post for bridge-like planks
          if (tileAt(room, tx - 1, ty) !== ONEWAY) {
            ctx.fillStyle = p.plank;
            ctx.fillRect(x + 2, y + 9, 3, 10);
          }
          if (tileAt(room, tx + 1, ty) !== ONEWAY) {
            ctx.fillStyle = p.plank;
            ctx.fillRect(x + TILE - 5, y + 9, 3, 10);
          }
        }
      } else if (t === SPIKES) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x, y + TILE - 6, TILE, 6);
        for (let i = 0; i < 4; i++) {
          const sx = x + i * 8;
          ctx.fillStyle = '#7b7f8c';
          ctx.beginPath();
          ctx.moveTo(sx, y + TILE);
          ctx.lineTo(sx + 4, y + 12);
          ctx.lineTo(sx + 8, y + TILE);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#c4c8d4';
          ctx.fillRect(sx + 3, y + 13, 1.5, 8);
        }
      }
    }
  }

  // Surface decorations on empty tiles above solid ground
  for (let ty = 1; ty < room.height; ty++) {
    for (let tx = 0; tx < room.width; tx++) {
      if (tileAt(room, tx, ty) !== SOLID || tileAt(room, tx, ty - 1) !== 0) continue;
      if (room.entities.some((e) => e.tx === tx && e.ty === ty - 1)) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const roll = r();
      if (fantasy) {
        if (roll < 0.18) {
          // flower
          ctx.fillStyle = '#2f8a4a';
          ctx.fillRect(x + 14, y - 10, 2, 10);
          ctx.fillStyle = ['#ffd84a', '#ff7aa8', '#9fd8ff', '#ffffff'][Math.floor(r() * 4)];
          ctx.beginPath();
          ctx.arc(x + 15, y - 11, 3, 0, Math.PI * 2);
          ctx.fill();
        } else if (roll < 0.3) {
          ctx.fillStyle = '#3aa15a';
          ctx.beginPath();
          ctx.ellipse(x + 16, y - 3, 10, 5, 0, Math.PI, 0);
          ctx.fill();
        }
      } else if (temple) {
        if (roll < 0.08) {
          ctx.fillStyle = 'rgba(255,220,150,0.25)';
          ctx.fillRect(x + 6, y - 14, 4, 14);
        }
      } else if (roll < 0.16) {
        // rubble
        ctx.fillStyle = p.rockLight;
        ctx.fillRect(x + 6, y - 4, 7, 4);
        ctx.fillRect(x + 15, y - 3, 5, 3);
      } else if (roll < 0.22) {
        // charred stump
        ctx.fillStyle = '#1e1716';
        ctx.fillRect(x + 12, y - 12, 7, 12);
        ctx.fillStyle = 'rgba(255,100,30,0.7)';
        ctx.fillRect(x + 14, y - 12, 2, 2);
      }
    }
  }
  scene.textures.addCanvas(key, c);
  return key;
}
