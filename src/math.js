export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inverseLerp = (a, b, value) => clamp((value - a) / (b - a), 0, 1);
export const smoothstep = (a, b, value) => {
  const t = inverseLerp(a, b, value);
  return t * t * (3 - 2 * t);
};
export const smootherstep = (a, b, value) => {
  const t = inverseLerp(a, b, value);
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export const remap = (value, inMin, inMax, outMin, outMax) =>
  lerp(outMin, outMax, inverseLerp(inMin, inMax, value));
export const distance2D = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

export function hashString(text) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2D(x, y, seed) {
  let hash = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 69069);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967295;
}

export class Noise2D {
  constructor(seed) {
    this.seed = seed | 0;
  }

  value(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const tx = x - x0;
    const ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const a = hash2D(x0, y0, this.seed) * 2 - 1;
    const b = hash2D(x0 + 1, y0, this.seed) * 2 - 1;
    const c = hash2D(x0, y0 + 1, this.seed) * 2 - 1;
    const d = hash2D(x0 + 1, y0 + 1, this.seed) * 2 - 1;
    return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
  }

  fbm(x, y, octaves = 5, lacunarity = 2, gain = 0.5) {
    let amplitude = 0.5;
    let frequency = 1;
    let sum = 0;
    let normalization = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      sum += this.value(x * frequency, y * frequency) * amplitude;
      normalization += amplitude;
      amplitude *= gain;
      frequency *= lacunarity;
    }
    return sum / normalization;
  }

  ridge(x, y, octaves = 4) {
    let amplitude = 0.55;
    let frequency = 1;
    let sum = 0;
    let normalization = 0;
    for (let octave = 0; octave < octaves; octave += 1) {
      const sample = 1 - Math.abs(this.value(x * frequency, y * frequency));
      sum += sample * sample * amplitude;
      normalization += amplitude;
      amplitude *= 0.5;
      frequency *= 2.08;
    }
    return sum / normalization;
  }
}

export function seededChoice(random, values) {
  return values[Math.floor(random() * values.length) % values.length];
}

export function angleDelta(from, to) {
  let delta = (to - from + Math.PI) % (Math.PI * 2) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}
