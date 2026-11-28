import type { Mood } from '../../logic/roomParser';

export interface MoodPalette {
  skyTop: string;
  skyBottom: string;
  horizonGlow: string;
  far: string;
  mid: string;
  near: string;
  rock: string;
  rockDark: string;
  rockLight: string;
  top: string;
  topLight: string;
  plank: string;
  /** Darkness overlay. alpha 0 = fully lit. */
  ambient: number;
  ambientAlpha: number;
  stars: boolean;
  celestial: 'moon' | 'sun' | 'none' | 'meteor';
  midKind: 'ruins' | 'trees' | 'mixed' | 'pillars' | 'tents';
  particles: 'embers' | 'fireflies' | 'dust' | 'ash';
  music: 'dark' | 'fantasy';
}

export const PALETTES: Record<Mood, MoodPalette> = {
  dark: {
    skyTop: '#05050c', skyBottom: '#2a1020', horizonGlow: '#ff5a1f',
    far: '#1b1424', mid: '#120d18', near: '#0a0710',
    rock: '#2b2431', rockDark: '#1a1520', rockLight: '#3c3242',
    top: '#4d3f47', topLight: '#6e5a5f', plank: '#4a3426',
    ambient: 0x05040c, ambientAlpha: 0.74, stars: true, celestial: 'meteor', midKind: 'ruins', particles: 'embers', music: 'dark',
  },
  dusk: {
    skyTop: '#1a1638', skyBottom: '#d8664a', horizonGlow: '#ffb36b',
    far: '#4a2f55', mid: '#2a1d36', near: '#170f20',
    rock: '#3b2d31', rockDark: '#251b21', rockLight: '#54404a',
    top: '#6d5a4c', topLight: '#9b8260', plank: '#5a3c28',
    ambient: 0x140a1c, ambientAlpha: 0.42, stars: true, celestial: 'sun', midKind: 'mixed', particles: 'ash', music: 'dark',
  },
  fantasy: {
    skyTop: '#3aa7dd', skyBottom: '#c8f1ff', horizonGlow: '#fff6c8',
    far: '#7cb9cf', mid: '#2f8a6a', near: '#1e5e4a',
    rock: '#5d4130', rockDark: '#3f2b20', rockLight: '#7b5a40',
    top: '#45b866', topLight: '#8be27e', plank: '#8a5a32',
    ambient: 0x0a1020, ambientAlpha: 0.0, stars: false, celestial: 'sun', midKind: 'trees', particles: 'fireflies', music: 'fantasy',
  },
  temple: {
    skyTop: '#22180f', skyBottom: '#4a3520', horizonGlow: '#e0a040',
    far: '#3a2a19', mid: '#2c1f12', near: '#1d140b',
    rock: '#7c6040', rockDark: '#57422b', rockLight: '#9c7c52',
    top: '#c9a35a', topLight: '#f0d18a', plank: '#9a7040',
    ambient: 0x120a04, ambientAlpha: 0.38, stars: false, celestial: 'none', midKind: 'pillars', particles: 'dust', music: 'fantasy',
  },
  night: {
    skyTop: '#03040d', skyBottom: '#241433', horizonGlow: '#ff6a2a',
    far: '#15132a', mid: '#0d0b19', near: '#07060f',
    rock: '#2a2620', rockDark: '#1a1813', rockLight: '#3b352c',
    top: '#4a4234', topLight: '#665a44', plank: '#4b3422',
    ambient: 0x02030c, ambientAlpha: 0.7, stars: true, celestial: 'moon', midKind: 'tents', particles: 'embers', music: 'dark',
  },
};

/** Small deterministic RNG so generated art is stable between runs. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}
