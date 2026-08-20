import * as THREE from 'three';
import {
  WORLD_HALF,
  WORLD_SIZE,
  clamp,
  lerp,
  mulberry32,
  smoothstep,
} from './config.js';

export const UP = new THREE.Vector3(0, 1, 0);

export const TEMP_VECTOR = new THREE.Vector3();

export const TEMP_VECTOR_2 = new THREE.Vector3();

export const TEMP_MATRIX = new THREE.Matrix4();

export const TEMP_QUATERNION = new THREE.Quaternion();

export const TEMP_SCALE = new THREE.Vector3();

export function color(hex) {
  return new THREE.Color(hex);
}

export function material(hex, options = {}) {
  return new THREE.MeshStandardMaterial({
    color: hex,
    roughness: options.roughness ?? 0.9,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
    flatShading: options.flatShading ?? false,
    side: options.side ?? THREE.FrontSide,
  });
}

export function mesh(geometry, meshMaterial, castShadow = true, receiveShadow = true) {
  const object = new THREE.Mesh(geometry, meshMaterial);
  object.castShadow = castShadow;
  object.receiveShadow = receiveShadow;
  return object;
}

export function setTransform(object, x, y, z, sx = 1, sy = sx, sz = sx, rotationY = 0) {
  object.position.set(x, y, z);
  object.scale.set(sx, sy, sz);
  object.rotation.y = rotationY;
  return object;
}

export function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.18, 'rgba(255,255,255,.88)');
  gradient.addColorStop(0.45, 'rgba(255,255,255,.28)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeNoiseTexture(seed) {
  const rng = mulberry32(seed);
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  for (let index = 0; index < size * size; index += 1) {
    const value = Math.floor(rng() * 255);
    data[index * 4] = value;
    data[index * 4 + 1] = value;
    data[index * 4 + 2] = value;
    data[index * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.needsUpdate = true;
  return texture;
}

export function createSkyDome(plan) {
  const uniforms = {
    topColor: { value: color(plan.palette.skyTop) },
    horizonColor: { value: color(plan.palette.skyHorizon) },
    nightColor: { value: new THREE.Color('#070c18') },
    sunColor: { value: color(plan.palette.sun) },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    dayFactor: { value: 1 },
  };
  const skyMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 horizonColor;
      uniform vec3 nightColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      uniform float dayFactor;
      varying vec3 vWorldPosition;
      void main() {
        vec3 direction = normalize(vWorldPosition);
        float height = smoothstep(-0.12, 0.78, direction.y);
        vec3 daySky = mix(horizonColor, topColor, pow(height, 0.72));
        float sunAmount = pow(max(dot(direction, normalize(sunDirection)), 0.0), 760.0);
        float sunGlow = pow(max(dot(direction, normalize(sunDirection)), 0.0), 18.0);
        daySky += sunColor * (sunAmount * 2.8 + sunGlow * 0.17);
        vec3 finalColor = mix(nightColor, daySky, dayFactor);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(680, 32, 18), skyMaterial);
  sky.frustumCulled = false;
  return { sky, uniforms };
}

export function createWater(plan, noiseTexture) {
  const uniforms = {
    time: { value: 0 },
    deepColor: { value: color(plan.palette.waterDeep) },
    shallowColor: { value: color(plan.palette.waterShallow) },
    sunColor: { value: color(plan.palette.sun) },
    sunDirection: { value: new THREE.Vector3(0, 1, 0) },
    noiseMap: { value: noiseTexture },
    fogColor: { value: color(plan.palette.fog) },
    fogDensity: { value: plan.fogDensity },
  };
  const waterMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms,
    vertexShader: `
      uniform float time;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vUv = uv;
        vec3 displaced = position;
        float wave = sin((position.x + time * 4.0) * 0.09) * 0.12;
        wave += cos((position.z - time * 3.2) * 0.11) * 0.09;
        displaced.y += wave;
        vWave = wave;
        vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      uniform float time;
      uniform vec3 deepColor;
      uniform vec3 shallowColor;
      uniform vec3 sunColor;
      uniform vec3 sunDirection;
      uniform sampler2D noiseMap;
      uniform vec3 fogColor;
      uniform float fogDensity;
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      varying float vWave;
      void main() {
        vec2 uv1 = vUv * 5.0 + vec2(time * 0.018, time * -0.012);
        vec2 uv2 = vUv * 8.0 + vec2(time * -0.011, time * 0.017);
        float noiseA = texture2D(noiseMap, uv1).r;
        float noiseB = texture2D(noiseMap, uv2).r;
        float ripples = (noiseA + noiseB) * 0.5;
        vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
        float fresnel = pow(1.0 - max(viewDirection.y, 0.0), 2.2);
        vec3 base = mix(shallowColor, deepColor, clamp(fresnel + ripples * 0.16, 0.0, 1.0));
        float sparkle = pow(max(dot(normalize(vec3(noiseA - .5, .7, noiseB - .5)), normalize(sunDirection)), 0.0), 42.0);
        base += sunColor * sparkle * 0.75;
        float distanceToCamera = length(cameraPosition - vWorldPosition);
        float fogFactor = 1.0 - exp(-fogDensity * fogDensity * distanceToCamera * distanceToCamera);
        vec3 finalColor = mix(base, fogColor, clamp(fogFactor, 0.0, 0.88));
        gl_FragColor = vec4(finalColor, 0.82 + fresnel * 0.12);
      }
    `,
  });
  const geometry = new THREE.CircleGeometry(1, 128);
  geometry.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(geometry, waterMaterial);
  water.position.set(plan.lake.x, plan.lake.level, plan.lake.z);
  water.scale.set(plan.lake.rx, 1, plan.lake.rz);
  water.renderOrder = 2;
  return { water, uniforms };
}

export function createStars(plan, count = 780) {
  const rng = mulberry32(plan.seed + 991);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(lerp(-0.04, 1, rng()));
    const radius = 620;
    positions[index * 3] = Math.sin(phi) * Math.cos(theta) * radius;
    positions[index * 3 + 1] = Math.cos(phi) * radius;
    positions[index * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMaterial = new THREE.PointsMaterial({
    color: '#dbe8ff',
    size: 1.35,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, starMaterial);
  stars.frustumCulled = false;
  return stars;
}

export function createCloud(rng) {
  const group = new THREE.Group();
  const cloudMaterial = new THREE.MeshStandardMaterial({
    color: '#f0f3ed',
    transparent: true,
    opacity: 0.25,
    roughness: 1,
    depthWrite: false,
  });
  const count = 3 + Math.floor(rng() * 4);
  for (let index = 0; index < count; index += 1) {
    const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 1), cloudMaterial);
    puff.scale.set(lerp(10, 18, rng()), lerp(3.5, 7, rng()), lerp(5, 10, rng()));
    puff.position.set((index - count / 2) * lerp(8, 13, rng()), rng() * 2.6, (rng() - 0.5) * 8);
    group.add(puff);
  }
  group.userData.speed = lerp(1.2, 2.5, rng());
  group.userData.wrap = WORLD_HALF + 120;
  return group;
}

export function createTent(palette) {
  const group = new THREE.Group();
  const canvasMaterial = material(palette === 'amber' ? '#a45f3c' : '#476e5c', { roughness: 1, side: THREE.DoubleSide });
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -2.4, 0, -1.8, 2.4, 0, -1.8, 0, 2.45, -1.8,
    -2.4, 0, 1.8, 0, 2.45, 1.8, 2.4, 0, 1.8,
    -2.4, 0, -1.8, 0, 2.45, -1.8, 0, 2.45, 1.8,
    -2.4, 0, -1.8, 0, 2.45, 1.8, -2.4, 0, 1.8,
    2.4, 0, -1.8, 2.4, 0, 1.8, 0, 2.45, 1.8,
    2.4, 0, -1.8, 0, 2.45, 1.8, 0, 2.45, -1.8,
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  group.add(mesh(geometry, canvasMaterial));
  const pole = mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 6), material('#6e4c36'));
  pole.position.y = 1.45;
  group.add(pole);
  return group;
}
