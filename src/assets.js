import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ASSET_URLS } from './config.js';

const DEFAULT_TIMEOUT_MS = 6500;

function tuneMaterial(material) {
  const tuned = material.clone();
  if ('metalness' in tuned) tuned.metalness = Math.min(tuned.metalness ?? 0, 0.08);
  if ('roughness' in tuned) tuned.roughness = Math.max(tuned.roughness ?? 0.8, 0.72);
  tuned.side = THREE.FrontSide;
  return tuned;
}

function tuneScene(root) {
  root.updateMatrixWorld(true);
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.material = Array.isArray(child.material)
      ? child.material.map(tuneMaterial)
      : tuneMaterial(child.material);
  });
  return root;
}

function withTimeout(promise, timeoutMs, label) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
    }),
  ]);
}

function makeFallbackTree(oak = false) {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(oak ? 0.23 : 0.16, oak ? 0.32 : 0.22, oak ? 2.1 : 2.55, 7),
    new THREE.MeshStandardMaterial({ color: '#6b4934', roughness: 1 }),
  );
  trunk.position.y = oak ? 1.05 : 1.28;
  group.add(trunk);

  const leafMaterial = new THREE.MeshStandardMaterial({ color: oak ? '#3c7a48' : '#3d8253', roughness: 1, flatShading: true });
  if (oak) {
    const positions = [[0, 2.35, 0], [-0.52, 2.15, 0.14], [0.52, 2.2, -0.08], [0.05, 2.65, 0.24]];
    positions.forEach(([x, y, z], index) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(index === 0 ? 0.92 : 0.7, 1), leafMaterial);
      crown.position.set(x, y, z);
      crown.scale.y = 0.86;
      group.add(crown);
    });
  } else {
    for (let index = 0; index < 3; index += 1) {
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.86 - index * 0.12, 1.5, 8), leafMaterial);
      crown.position.y = 2.05 + index * 0.64;
      group.add(crown);
    }
  }
  return tuneScene(group);
}

function makeFallbackRock(large = false) {
  const mesh = new THREE.Mesh(
    new THREE.DodecahedronGeometry(large ? 0.95 : 0.48, 0),
    new THREE.MeshStandardMaterial({ color: '#727a73', roughness: 1, flatShading: true }),
  );
  mesh.scale.set(1.25, 0.78, 1);
  return tuneScene(mesh);
}

function makeFallbackFence(gate = false) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: '#735037', roughness: 1 });
  const postGeometry = new THREE.BoxGeometry(0.15, 1.25, 0.15);
  const railGeometry = new THREE.BoxGeometry(gate ? 1.25 : 2.1, 0.12, 0.12);
  const left = new THREE.Mesh(postGeometry, material);
  left.position.set(gate ? -0.78 : -1.05, 0.62, 0);
  const right = left.clone();
  right.position.x *= -1;
  group.add(left, right);
  for (const y of [0.42, 0.88]) {
    const rail = new THREE.Mesh(railGeometry, material);
    rail.position.y = y;
    group.add(rail);
  }
  return tuneScene(group);
}

function makeFallbackBarrel(open = false) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#795235', roughness: 0.95 });
  const metal = new THREE.MeshStandardMaterial({ color: '#424846', roughness: 0.68, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.45, 1.05, 12, 1, open), wood);
  body.position.y = 0.53;
  group.add(body);
  for (const y of [0.18, 0.52, 0.88]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.49, 0.045, 5, 16), metal);
    band.rotation.x = Math.PI / 2;
    band.position.y = y;
    group.add(band);
  }
  return tuneScene(group);
}

function makeFallbackSign(signpost = false) {
  const group = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#735038', roughness: 1 });
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, signpost ? 2 : 1.45, 0.14), wood);
  post.position.y = signpost ? 1 : 0.72;
  group.add(post);
  const board = new THREE.Mesh(new THREE.BoxGeometry(signpost ? 1.4 : 0.92, 0.34, 0.12), wood);
  board.position.set(signpost ? 0.38 : 0, signpost ? 1.55 : 1.2, 0);
  board.rotation.z = signpost ? -0.08 : 0;
  group.add(board);
  return tuneScene(group);
}

function fallbackFor(name) {
  switch (name) {
    case 'treeDefault': return makeFallbackTree(false);
    case 'treeOak': return makeFallbackTree(true);
    case 'rockLarge': return makeFallbackRock(true);
    case 'rockSmall': return makeFallbackRock(false);
    case 'fence': return makeFallbackFence(false);
    case 'fenceGate': return makeFallbackFence(true);
    case 'barrel': return makeFallbackBarrel(false);
    case 'barrelOpen': return makeFallbackBarrel(true);
    case 'signpost': return makeFallbackSign(true);
    case 'sign': return makeFallbackSign(false);
    default: return new THREE.Group();
  }
}

export class AssetLibrary {
  constructor() {
    this.loader = new GLTFLoader();
    this.assets = new Map();
    this.remoteLoaded = new Set();
  }

  async load(onProgress = () => {}) {
    const entries = Object.entries(ASSET_URLS);
    let completed = 0;
    await Promise.all(entries.map(async ([name, url]) => {
      try {
        const gltf = await withTimeout(
          this.loader.loadAsync(url),
          DEFAULT_TIMEOUT_MS,
          name,
        );
        this.assets.set(name, tuneScene(gltf.scene));
        this.remoteLoaded.add(name);
      } catch (error) {
        console.warn(`[assets] Using fallback for ${name}:`, error.message);
        this.assets.set(name, fallbackFor(name));
      } finally {
        completed += 1;
        onProgress(completed / entries.length, name, this.remoteLoaded.has(name));
      }
    }));
    return this;
  }

  hasRemote(name) {
    return this.remoteLoaded.has(name);
  }

  clone(name, { tint = null, tintStrength = 0, castShadow = true } = {}) {
    const source = this.assets.get(name) ?? fallbackFor(name);
    const clone = source.clone(true);
    clone.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry = child.geometry.clone();
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      if (tint) {
        const tintColor = new THREE.Color(tint);
        materials.forEach((material) => material.color?.lerp(tintColor, tintStrength));
      }
      child.castShadow = castShadow;
      child.receiveShadow = true;
    });
    return clone;
  }

  createInstanced(name, transforms, {
    tint = null,
    tintStrength = 0,
    castShadow = true,
    receiveShadow = true,
  } = {}) {
    const source = this.assets.get(name) ?? fallbackFor(name);
    source.updateMatrixWorld(true);
    const group = new THREE.Group();
    const worldMatrix = new THREE.Matrix4();
    const localMatrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    const euler = new THREE.Euler();

    source.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isSkinnedMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material.map((material) => tuneMaterial(material))
        : tuneMaterial(mesh.material);
      const materialList = Array.isArray(materials) ? materials : [materials];
      if (tint) {
        const tintColor = new THREE.Color(tint);
        materialList.forEach((material) => material.color?.lerp(tintColor, tintStrength));
      }
      const instanced = new THREE.InstancedMesh(mesh.geometry.clone(), materials, transforms.length);
      instanced.castShadow = castShadow;
      instanced.receiveShadow = receiveShadow;
      instanced.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      instanced.frustumCulled = true;

      transforms.forEach((transform, index) => {
        position.set(transform.x, transform.y, transform.z);
        euler.set(transform.rx ?? 0, transform.ry ?? 0, transform.rz ?? 0);
        quaternion.setFromEuler(euler);
        const uniformScale = typeof transform.scale === 'number' ? transform.scale : 1;
        const sourceScale = transform.scale && typeof transform.scale === 'object' ? transform.scale : null;
        scale.set(
          sourceScale?.x ?? uniformScale,
          sourceScale?.y ?? uniformScale,
          sourceScale?.z ?? uniformScale,
        );
        worldMatrix.compose(position, quaternion, scale);
        localMatrix.copy(worldMatrix).multiply(mesh.matrixWorld);
        instanced.setMatrixAt(index, localMatrix);
      });
      instanced.instanceMatrix.needsUpdate = true;
      group.add(instanced);
    });

    if (group.children.length === 0) {
      transforms.forEach((transform) => {
        const clone = this.clone(name, { tint, tintStrength, castShadow });
        clone.position.set(transform.x, transform.y, transform.z);
        clone.rotation.set(transform.rx ?? 0, transform.ry ?? 0, transform.rz ?? 0);
        const uniformScale = typeof transform.scale === 'number' ? transform.scale : 1;
        clone.scale.setScalar(uniformScale);
        group.add(clone);
      });
    }
    return group;
  }

  diagnostics() {
    return {
      total: Object.keys(ASSET_URLS).length,
      remote: this.remoteLoaded.size,
      fallback: Object.keys(ASSET_URLS).length - this.remoteLoaded.size,
      remoteNames: [...this.remoteLoaded].sort(),
    };
  }
}
