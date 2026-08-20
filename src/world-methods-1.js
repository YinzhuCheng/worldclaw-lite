import * as THREE from 'three';
import {
  WORLD_HALF,
  WORLD_SIZE,
  clamp,
  lerp,
  mulberry32,
  smoothstep,
} from './config.js';
import {
  UP,
  TEMP_VECTOR,
  TEMP_VECTOR_2,
  TEMP_MATRIX,
  TEMP_QUATERNION,
  TEMP_SCALE,
  color,
  material,
  mesh,
  setTransform,
  makeGlowTexture,
  makeNoiseTexture,
  createSkyDome,
  createWater,
  createStars,
  createCloud,
  createTent,
} from './world-helpers.js';

export const worldMethods1 = {
  async build(onProgress = () => {}) {
      onProgress(0.05, 'Sculpting terrain');
      this._createLights();
      this._createTerrain();
      onProgress(0.24, 'Filling the sky and lake');
      this._createAtmosphere();
      this._createWaterAndShore();
      onProgress(0.4, 'Growing the forest');
      this._createVegetation();
      onProgress(0.64, 'Placing ruins and camps');
      this._createWorldCore();
      this._createRelays();
      this._createCamp();
      this._createLandmarks();
      onProgress(0.8, 'Seeding echo shards');
      this._createShards();
      this._createEnemies();
      onProgress(1, 'World model synchronized');
      return this;
    },

  _createLights() {
      this.hemi = new THREE.HemisphereLight(this.plan.palette.skyHorizon, this.plan.palette.grassLow, 1.25);
      this.scene.add(this.hemi);
  
      this.sun = new THREE.DirectionalLight(this.plan.palette.sun, 3.2);
      this.sun.position.set(140, 260, -110);
      this.sun.castShadow = true;
      const mapSize = this.quality.shadowMapSize;
      this.sun.shadow.mapSize.set(mapSize, mapSize);
      this.sun.shadow.camera.near = 20;
      this.sun.shadow.camera.far = 620;
      this.sun.shadow.camera.left = -190;
      this.sun.shadow.camera.right = 190;
      this.sun.shadow.camera.top = 190;
      this.sun.shadow.camera.bottom = -190;
      this.sun.shadow.bias = -0.00012;
      this.sun.shadow.normalBias = 0.025;
      this.scene.add(this.sun, this.sun.target);
    },

  _createTerrain() {
      const segments = this.quality.terrainSegments;
      const geometry = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
      geometry.rotateX(-Math.PI / 2);
      const positions = geometry.attributes.position;
      const colors = new Float32Array(positions.count * 3);
      const low = color(this.plan.palette.grassLow);
      const high = color(this.plan.palette.grassHigh);
      const soil = color(this.plan.palette.soil);
      const stone = color(this.plan.palette.stone);
      const wet = color(this.plan.palette.waterShallow).multiplyScalar(0.55);
      const rng = mulberry32(this.plan.seed + 49);
  
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const z = positions.getZ(index);
        const height = this.plan.heightAt(x, z);
        positions.setY(index, height);
        const slope = this.plan.slopeAt(x, z);
        const elevation = smoothstep(-12, 38, height);
        const shore = this.plan.isLake(x, z, 10) && height < this.plan.lake.level + 1.8;
        const vertexColor = low.clone().lerp(high, elevation * 0.72 + rng() * 0.08);
        if (slope > 0.58) vertexColor.lerp(stone, smoothstep(0.58, 1.35, slope));
        if (height < -3 && !shore) vertexColor.lerp(soil, 0.35);
        if (shore) vertexColor.lerp(wet, 0.48);
        colors[index * 3] = vertexColor.r;
        colors[index * 3 + 1] = vertexColor.g;
        colors[index * 3 + 2] = vertexColor.b;
      }
      positions.needsUpdate = true;
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      geometry.computeBoundingSphere();
  
      const terrainMaterial = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.96,
        metalness: 0,
      });
      this.terrain = mesh(geometry, terrainMaterial, false, true);
      this.terrain.name = 'Terrain';
      this.root.add(this.terrain);
    },

  _createAtmosphere() {
      const { sky, uniforms } = createSkyDome(this.plan);
      this.sky = sky;
      this.skyUniforms = uniforms;
      this.scene.add(sky);
      this.stars = createStars(this.plan, this.quality.shadowMapSize > 1024 ? 820 : 520);
      this.scene.add(this.stars);
  
      this.scene.fog = new THREE.FogExp2(this.plan.palette.fog, this.plan.fogDensity);
      this.scene.background = color(this.plan.palette.skyTop);
  
      const rng = mulberry32(this.plan.seed + 331);
      for (let index = 0; index < this.quality.cloudCount; index += 1) {
        const cloud = createCloud(rng);
        cloud.position.set(lerp(-WORLD_HALF, WORLD_HALF, rng()), lerp(105, 175, rng()), lerp(-WORLD_HALF, WORLD_HALF, rng()));
        cloud.rotation.y = rng() * Math.PI * 2;
        this.clouds.push(cloud);
        this.scene.add(cloud);
      }
    },

  _createWaterAndShore() {
      const { water, uniforms } = createWater(this.plan, this.noiseTexture);
      this.water = water;
      this.waterUniforms = uniforms;
      this.root.add(water);
  
      const rng = mulberry32(this.plan.seed + 601);
      const shoreTransforms = [];
      for (let index = 0; index < 72; index += 1) {
        const angle = (index / 72) * Math.PI * 2 + (rng() - 0.5) * 0.08;
        const radius = lerp(0.96, 1.08, rng());
        const x = this.plan.lake.x + Math.cos(angle) * this.plan.lake.rx * radius;
        const z = this.plan.lake.z + Math.sin(angle) * this.plan.lake.rz * radius;
        shoreTransforms.push({
          x,
          y: this.plan.heightAt(x, z) + 0.12,
          z,
          scale: lerp(0.65, 1.65, rng()),
          ry: rng() * Math.PI * 2,
          rx: (rng() - 0.5) * 0.18,
          rz: (rng() - 0.5) * 0.18,
        });
      }
      this.root.add(this.assets.createInstanced('rockSmall', shoreTransforms, {
        tint: this.plan.palette.stone,
        tintStrength: 0.24,
        castShadow: false,
      }));
  
      const reedGeometry = new THREE.ConeGeometry(0.035, 1.3, 3);
      const reeds = new THREE.InstancedMesh(reedGeometry, material('#76915d', { roughness: 1 }), 440);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      let placed = 0;
      for (let attempt = 0; placed < 440 && attempt < 2400; attempt += 1) {
        const angle = rng() * Math.PI * 2;
        const radius = lerp(0.78, 1.02, Math.sqrt(rng()));
        const x = this.plan.lake.x + Math.cos(angle) * this.plan.lake.rx * radius;
        const z = this.plan.lake.z + Math.sin(angle) * this.plan.lake.rz * radius;
        const y = Math.max(this.plan.heightAt(x, z), this.plan.lake.level - 0.5);
        quaternion.setFromAxisAngle(UP, rng() * Math.PI * 2);
        const size = lerp(0.55, 1.2, rng());
        scale.set(size, size, size);
        matrix.compose(new THREE.Vector3(x, y + 0.64 * size, z), quaternion, scale);
        reeds.setMatrixAt(placed, matrix);
        placed += 1;
      }
      reeds.count = placed;
      reeds.instanceMatrix.needsUpdate = true;
      reeds.castShadow = false;
      reeds.receiveShadow = true;
      this.root.add(reeds);
    },

  _isReserved(x, z, radius = 0) {
      if (this.plan.isLake(x, z, radius + 8)) return true;
      const zones = [this.plan.core, this.plan.camp, ...this.plan.relays];
      return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius + radius + 8);
    },

  _sampleTransforms(count, options = {}) {
      const rng = options.rng ?? mulberry32(this.plan.seed + 1001);
      const transforms = [];
      const margin = options.margin ?? 28;
      for (let attempt = 0; transforms.length < count && attempt < count * 22; attempt += 1) {
        const x = lerp(-WORLD_HALF + margin, WORLD_HALF - margin, rng());
        const z = lerp(-WORLD_HALF + margin, WORLD_HALF - margin, rng());
        if (this._isReserved(x, z, options.clearance ?? 1.5)) continue;
        const slope = this.plan.slopeAt(x, z);
        if (slope > (options.maxSlope ?? 0.72)) continue;
        const y = this.plan.heightAt(x, z);
        if (y < this.plan.lake.level + (options.minWaterClearance ?? 1.4)) continue;
        const scale = lerp(options.scaleMin ?? 1, options.scaleMax ?? 1, rng());
        transforms.push({
          x,
          y: y + (options.yOffset ?? 0),
          z,
          scale,
          ry: rng() * Math.PI * 2,
          rx: options.tilt ? (rng() - 0.5) * options.tilt : 0,
          rz: options.tilt ? (rng() - 0.5) * options.tilt : 0,
        });
      }
      return transforms;
    },

  _createVegetation() {
      const rng = mulberry32(this.plan.seed + 1201);
      const treeCount = Math.round(this.quality.trees * this.plan.treeDensity);
      const oakCount = Math.floor(treeCount * 0.34);
      const defaultCount = treeCount - oakCount;
      const treeOptions = {
        rng,
        clearance: 2.8,
        maxSlope: 0.58,
        scaleMin: 4.2,
        scaleMax: 7.2,
        minWaterClearance: 1.8,
      };
      const defaultTrees = this._sampleTransforms(defaultCount, treeOptions);
      const oakTrees = this._sampleTransforms(oakCount, { ...treeOptions, scaleMin: 4.6, scaleMax: 7.8 });
      this.root.add(this.assets.createInstanced('treeDefault', defaultTrees, {
        tint: this.plan.palette.grassHigh,
        tintStrength: 0.08,
        castShadow: this.quality.shadowMapSize > 1024,
      }));
      this.root.add(this.assets.createInstanced('treeOak', oakTrees, {
        tint: this.plan.palette.grassHigh,
        tintStrength: 0.11,
        castShadow: this.quality.shadowMapSize > 1024,
      }));
  
      const largeRocks = this._sampleTransforms(Math.round(this.quality.rocks * 0.38), {
        rng,
        clearance: 1,
        maxSlope: 1.35,
        scaleMin: 1.45,
        scaleMax: 4.4,
        tilt: 0.3,
      });
      const smallRocks = this._sampleTransforms(Math.round(this.quality.rocks * 0.62), {
        rng,
        clearance: 0.5,
        maxSlope: 1.5,
        scaleMin: 1.1,
        scaleMax: 3.15,
        tilt: 0.4,
      });
      this.root.add(this.assets.createInstanced('rockLarge', largeRocks, {
        tint: this.plan.palette.stone,
        tintStrength: 0.22,
        castShadow: true,
      }));
      this.root.add(this.assets.createInstanced('rockSmall', smallRocks, {
        tint: this.plan.palette.stone,
        tintStrength: 0.2,
        castShadow: false,
      }));
  
      this._createGrass(rng);
      this._createFlowers(rng);
    }
};
