import {
  WORLD_HALF,
  WORLD_SIZE,
  PALETTES,
  clamp,
  hashString,
  lerp,
  mulberry32,
  smoothstep,
} from './config.js';

const ADJECTIVES = ['Silent', 'Verdant', 'Hollow', 'Ancient', 'Whispering', 'Luminous', 'Forgotten', 'Emerald'];
const NOUNS = ['Reach', 'Basin', 'Vale', 'March', 'Sanctum', 'Wilds', 'Expanse', 'Hollow'];

function hash2(x, z, seed) {
  let value = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ (seed >>> 0);
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / 4294967295;
}

function valueNoise(x, z, seed) {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = x - x0;
  const tz = z - z0;
  const sx = tx * tx * (3 - 2 * tx);
  const sz = tz * tz * (3 - 2 * tz);
  const a = hash2(x0, z0, seed);
  const b = hash2(x0 + 1, z0, seed);
  const c = hash2(x0, z0 + 1, seed);
  const d = hash2(x0 + 1, z0 + 1, seed);
  return lerp(lerp(a, b, sx), lerp(c, d, sx), sz) * 2 - 1;
}

function fbm(x, z, seed, octaves = 5) {
  let value = 0;
  let amplitude = 0.5;
  let frequency = 1;
  let norm = 0;
  for (let octave = 0; octave < octaves; octave += 1) {
    value += valueNoise(x * frequency, z * frequency, seed + octave * 1013) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2.02;
  }
  return value / norm;
}

function ridged(x, z, seed) {
  return 1 - Math.abs(fbm(x, z, seed, 4));
}

function keywordPalette(prompt, seed) {
  const text = prompt.toLowerCase();
  if (/(mist|fog|moon|rain|silver|blue|幽|雾|月|雨)/.test(text)) return PALETTES.mist;
  if (/(amber|sunset|desert|autumn|gold|orange|黄昏|秋|金|荒)/.test(text)) return PALETTES.amber;
  const keys = ['verdant', 'amber', 'mist'];
  return PALETTES[keys[seed % keys.length]];
}

function makePoint(rng, radiusMin, radiusMax, angleOffset = 0) {
  const angle = angleOffset + rng() * Math.PI * 2;
  const radius = lerp(radiusMin, radiusMax, Math.sqrt(rng()));
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}

function createRawHeight(seed, roughness, lake) {
  return (x, z) => {
    const broad = fbm(x * 0.0036, z * 0.0036, seed + 17, 5) * (18 + roughness * 9);
    const detail = fbm(x * 0.0105, z * 0.0105, seed + 311, 4) * (5.5 + roughness * 4);
    const ridge = Math.pow(ridged(x * 0.0022, z * 0.0022, seed + 733), 2.8) * (12 + roughness * 10);
    const edge = Math.pow(clamp(Math.hypot(x, z) / WORLD_HALF, 0, 1), 3.2) * 34;
    let height = broad + detail + ridge + edge - 10;

    const dx = (x - lake.x) / lake.rx;
    const dz = (z - lake.z) / lake.rz;
    const lakeDistance = Math.hypot(dx, dz);
    const depression = 1 - smoothstep(0.68, 1.2, lakeDistance);
    height = lerp(height, lake.level - 6.2, depression);
    return height;
  };
}

export function createWorldPlan(promptInput, seedInput, quality = 'high') {
  const prompt = (promptInput || 'A misty green valley with ancient signal towers').trim();
  const seedText = (seedInput || 'WORLDCLAW-2608').trim().toUpperCase();
  const seed = hashString(`${seedText}::${prompt}`);
  const rng = mulberry32(seed);
  const palette = keywordPalette(prompt, seed);
  const roughness = clamp(0.45 + rng() * 0.55 + (/mountain|cliff|峰|山/.test(prompt.toLowerCase()) ? 0.22 : 0), 0.35, 1.2);
  const fogDensity = clamp(0.0017 + rng() * 0.0012 + (/mist|fog|雾/.test(prompt.toLowerCase()) ? 0.0013 : 0), 0.0014, 0.0042);
  const treeDensity = clamp(0.72 + rng() * 0.42 + (/forest|jungle|woods|森林|丛林/.test(prompt.toLowerCase()) ? 0.24 : 0), 0.62, 1.35);

  const lakePoint = makePoint(rng, 125, 235);
  const lake = {
    x: lakePoint.x,
    z: lakePoint.z,
    rx: lerp(58, 92, rng()),
    rz: lerp(44, 76, rng()),
    level: lerp(-6.5, -2.5, rng()),
  };

  const relayAngles = [0.28, 2.28, 4.28].map((base) => base + (rng() - 0.5) * 0.46);
  const relays = relayAngles.map((angle, index) => {
    const radius = lerp(210, 320, rng());
    return {
      id: `relay-${index + 1}`,
      name: ['Northwind Relay', 'Sunken Relay', 'Elder Relay'][index],
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      activated: false,
      radius: 16,
    };
  });

  const campPoint = makePoint(rng, 105, 175, Math.PI * 0.7);
  const camp = { x: campPoint.x, z: campPoint.z, radius: 20, name: 'Wayfarer Camp' };
  const core = { x: 0, z: 0, radius: 24, name: 'World Core' };

  const shardCount = quality === 'low' ? 5 : 7;
  const shards = [];
  for (let index = 0; index < shardCount; index += 1) {
    let point;
    let attempts = 0;
    do {
      point = makePoint(rng, 95, WORLD_HALF - 74, index * 1.17);
      attempts += 1;
    } while (
      attempts < 30 &&
      (Math.hypot(point.x - lake.x, point.z - lake.z) < Math.max(lake.rx, lake.rz) + 18 ||
        relays.some((relay) => Math.hypot(point.x - relay.x, point.z - relay.z) < 28))
    );
    shards.push({ id: `shard-${index + 1}`, x: point.x, z: point.z, collected: false });
  }

  const nests = Array.from({ length: quality === 'low' ? 3 : 5 }, (_, index) => {
    const point = makePoint(rng, 165, WORLD_HALF - 90, index * 1.81 + 0.5);
    return { id: `nest-${index + 1}`, x: point.x, z: point.z, radius: 34 };
  });

  const rawHeight = createRawHeight(seed, roughness, lake);
  const flattenZones = [core, camp, ...relays].map((zone) => ({
    ...zone,
    y: rawHeight(zone.x, zone.z),
    feather: zone.radius + 18,
  }));

  const heightAt = (x, z) => {
    let height = rawHeight(x, z);
    for (const zone of flattenZones) {
      const distance = Math.hypot(x - zone.x, z - zone.z);
      const influence = 1 - smoothstep(zone.radius * 0.35, zone.feather, distance);
      height = lerp(height, zone.y, influence * 0.88);
    }
    return height;
  };

  for (const relay of relays) relay.y = heightAt(relay.x, relay.z);
  camp.y = heightAt(camp.x, camp.z);
  core.y = heightAt(core.x, core.z);
  for (const shard of shards) shard.y = heightAt(shard.x, shard.z);
  for (const nest of nests) nest.y = heightAt(nest.x, nest.z);

  const adjective = ADJECTIVES[Math.floor(rng() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(rng() * NOUNS.length)];
  const worldName = `${adjective} ${noun}`;

  const plan = {
    version: 2,
    prompt,
    seedText,
    seed,
    quality,
    worldName,
    biome: palette.label,
    palette,
    roughness,
    fogDensity,
    treeDensity,
    startTime: /night|moon|夜|月/.test(prompt.toLowerCase()) ? 21.2 : /sunset|dusk|黄昏/.test(prompt.toLowerCase()) ? 17.6 : lerp(7.2, 15.5, rng()),
    worldSize: WORLD_SIZE,
    core,
    camp,
    lake,
    relays,
    shards,
    nests,
    flattenZones,
    mission: {
      title: 'Restore the World Signal',
      summary: `Activate ${relays.length} relays, recover ${shards.length} echo shards, then return to the World Core.`,
    },
  };

  plan.heightAt = heightAt;
  plan.slopeAt = (x, z) => {
    const step = 1.8;
    const dx = heightAt(x + step, z) - heightAt(x - step, z);
    const dz = heightAt(x, z + step) - heightAt(x, z - step);
    return Math.hypot(dx, dz) / (step * 2);
  };
  plan.isLake = (x, z, padding = 0) => {
    const dx = (x - lake.x) / (lake.rx + padding);
    const dz = (z - lake.z) / (lake.rz + padding);
    return dx * dx + dz * dz < 1;
  };

  return plan;
}

export function serializePlan(plan) {
  const { heightAt, slopeAt, isLake, palette, ...serializable } = plan;
  return {
    ...serializable,
    palette: palette.key,
    relays: plan.relays.map(({ activated, ...relay }) => relay),
    shards: plan.shards.map(({ collected, ...shard }) => shard),
  };
}
