export const WORLD_SIZE = 920;
export const WORLD_HALF = WORLD_SIZE / 2;
export const PLAYER_EYE_HEIGHT = 2.15;
export const THREE_VERSION = '0.184.0';

const MIRROR_COMMIT = '8792fe1404eabd93ff12dd0726460da5db648b02';
const MIRROR_ROOT = `https://cdn.jsdelivr.net/gh/rajsinghtech/spurfire@${MIRROR_COMMIT}/game/assets/kenney`;

export const ASSET_URLS = Object.freeze({
  treeDefault: `${MIRROR_ROOT}/nature-kit/tree_default.glb`,
  treeOak: `${MIRROR_ROOT}/nature-kit/tree_oak.glb`,
  rockLarge: `${MIRROR_ROOT}/nature-kit/rock_largeA.glb`,
  rockSmall: `${MIRROR_ROOT}/nature-kit/rock_smallA.glb`,
  sign: `${MIRROR_ROOT}/nature-kit/sign.glb`,
  fence: `${MIRROR_ROOT}/nature-kit/fence_simple.glb`,
  fenceGate: `${MIRROR_ROOT}/nature-kit/fence_gate.glb`,
  barrel: `${MIRROR_ROOT}/survival-kit/barrel.glb`,
  barrelOpen: `${MIRROR_ROOT}/survival-kit/barrel-open.glb`,
  signpost: `${MIRROR_ROOT}/survival-kit/signpost.glb`,
});

export const QUALITY_PRESETS = Object.freeze({
  low: {
    label: 'Balanced',
    terrainSegments: 92,
    trees: 220,
    rocks: 120,
    grass: 1000,
    flowers: 180,
    cloudCount: 10,
    shadowMapSize: 1024,
    maxPixelRatio: 1.25,
  },
  high: {
    label: 'Cinematic',
    terrainSegments: 152,
    trees: 390,
    rocks: 210,
    grass: 2600,
    flowers: 360,
    cloudCount: 18,
    shadowMapSize: 2048,
    maxPixelRatio: 1.7,
  },
});

export const PALETTES = Object.freeze({
  verdant: {
    key: 'verdant',
    label: 'Verdant Hollow',
    skyTop: '#4677a0',
    skyHorizon: '#b9d2c2',
    fog: '#9eb8a5',
    sun: '#ffe2a6',
    grassLow: '#294f35',
    grassHigh: '#6f8747',
    soil: '#695d48',
    stone: '#7c8279',
    stoneDark: '#4a514b',
    waterDeep: '#1d5262',
    waterShallow: '#4b93a0',
    accent: '#aef378',
    accent2: '#62dff2',
    enemy: '#ff6489',
  },
  amber: {
    key: 'amber',
    label: 'Amber Highlands',
    skyTop: '#3f6489',
    skyHorizon: '#d8b893',
    fog: '#b99f83',
    sun: '#ffd08a',
    grassLow: '#4b4d2a',
    grassHigh: '#a28b43',
    soil: '#7b5841',
    stone: '#8b7765',
    stoneDark: '#4f463f',
    waterDeep: '#244d59',
    waterShallow: '#5c8f92',
    accent: '#ffd165',
    accent2: '#77e8df',
    enemy: '#ef648c',
  },
  mist: {
    key: 'mist',
    label: 'Moonmist Basin',
    skyTop: '#31445f',
    skyHorizon: '#9aa9ae',
    fog: '#8f9ea2',
    sun: '#dfe8ff',
    grassLow: '#253d3e',
    grassHigh: '#66817a',
    soil: '#575959',
    stone: '#7e8789',
    stoneDark: '#454f52',
    waterDeep: '#263e5a',
    waterShallow: '#5f7f9c',
    accent: '#a6f4d4',
    accent2: '#9db8ff',
    enemy: '#ff739d',
  },
});

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, value) => clamp((value - a) / (b - a), 0, 1);
export const smoothstep = (edge0, edge1, value) => {
  const t = inverseLerp(edge0, edge1, value);
  return t * t * (3 - 2 * t);
};

export function hashString(text) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function formatClock(hours) {
  const wrapped = ((hours % 24) + 24) % 24;
  const h = Math.floor(wrapped);
  const m = Math.floor((wrapped - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function formatDistance(distance) {
  if (!Number.isFinite(distance)) return '—';
  if (distance >= 1000) return `${(distance / 1000).toFixed(1)} km`;
  return `${Math.round(distance)} m`;
}

export function chooseWeighted(rng, entries) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = rng() * total;
  for (const entry of entries) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry.value;
  }
  return entries.at(-1).value;
}
