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

export const worldMethods3 = {
  _createCamp() {
      const { x, y, z } = this.plan.camp;
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.rotation.y = Math.atan2(-x, -z) - 0.35;
  
      const tent = createTent(this.plan.palette.key);
      tent.position.set(-2.8, 0.1, 0);
      group.add(tent);
      const tent2 = createTent(this.plan.palette.key);
      tent2.position.set(4.2, 0.05, 2.8);
      tent2.rotation.y = 2.4;
      tent2.scale.setScalar(0.76);
      group.add(tent2);
  
      const logMaterial = material('#6f4b32', { roughness: 1 });
      for (let index = 0; index < 4; index += 1) {
        const log = mesh(new THREE.CylinderGeometry(0.16, 0.18, 2.3, 7), logMaterial);
        log.position.set(0, 0.27, 3.4);
        log.rotation.set(Math.PI / 2, index * Math.PI / 2, 0);
        group.add(log);
      }
      const fire = mesh(new THREE.ConeGeometry(0.58, 1.65, 7), material('#ffbb5f', {
        emissive: '#ff6d2e',
        emissiveIntensity: 2.7,
        transparent: true,
        opacity: 0.88,
      }), false, false);
      fire.position.set(0, 0.95, 3.4);
      group.add(fire);
      const fireGlow = new THREE.PointLight('#ff9a54', 14, 32, 2);
      fireGlow.position.set(0, 2.2, 3.4);
      group.add(fireGlow);
      this.animated.push({ type: 'fire', object: { fire, light: fireGlow } });
  
      const barrel = this.assets.clone('barrel');
      barrel.position.set(5.6, 0, -1.5);
      barrel.rotation.y = 0.7;
      barrel.scale.setScalar(1.45);
      group.add(barrel);
      const openBarrel = this.assets.clone('barrelOpen');
      openBarrel.position.set(6.5, 0, 0.3);
      openBarrel.rotation.y = -0.4;
      openBarrel.scale.setScalar(1.35);
      group.add(openBarrel);
      const signpost = this.assets.clone('signpost');
      signpost.position.set(-6.8, 0, 3.2);
      signpost.rotation.y = 1.15;
      signpost.scale.setScalar(2.2);
      group.add(signpost);
  
      const fenceTransforms = [];
      for (let index = 0; index < 5; index += 1) {
        fenceTransforms.push({ x: x - 8 + index * 3.2, y, z: z - 7.5, scale: 1.7, ry: group.rotation.y });
      }
      this.root.add(this.assets.createInstanced('fence', fenceTransforms, { castShadow: true }));
      this.root.add(group);
    },

  _createLandmarks() {
      const rng = mulberry32(this.plan.seed + 1601);
      const stone = material(this.plan.palette.stone, { roughness: 0.97 });
      const dark = material(this.plan.palette.stoneDark, { roughness: 1 });
  
      // Broken arch near the lake.
      const angle = Math.atan2(this.plan.lake.z, this.plan.lake.x) + Math.PI * 0.42;
      const x = this.plan.lake.x + Math.cos(angle) * (this.plan.lake.rx + 26);
      const z = this.plan.lake.z + Math.sin(angle) * (this.plan.lake.rz + 22);
      const y = this.plan.heightAt(x, z);
      const arch = new THREE.Group();
      arch.position.set(x, y, z);
      arch.rotation.y = angle + Math.PI / 2;
      for (const side of [-1, 1]) {
        const pillar = mesh(new THREE.BoxGeometry(2.3, 8.5, 2.6), stone);
        pillar.position.set(side * 4.2, 4.1, 0);
        pillar.rotation.z = side * 0.035;
        arch.add(pillar);
      }
      const lintel = mesh(new THREE.BoxGeometry(11.4, 2.1, 2.7), dark);
      lintel.position.y = 8.3;
      lintel.rotation.z = 0.045;
      arch.add(lintel);
      this.root.add(arch);
      this.colliders.push({ x: x + Math.cos(angle) * 4.2, z: z + Math.sin(angle) * 4.2, radius: 1.8 });
      this.colliders.push({ x: x - Math.cos(angle) * 4.2, z: z - Math.sin(angle) * 4.2, radius: 1.8 });
  
      // Scattered monolith trail that subtly points toward the core.
      for (let index = 0; index < 18; index += 1) {
        const pointAngle = rng() * Math.PI * 2;
        const radius = lerp(80, WORLD_HALF - 80, rng());
        const px = Math.cos(pointAngle) * radius;
        const pz = Math.sin(pointAngle) * radius;
        if (this._isReserved(px, pz, 4)) continue;
        const py = this.plan.heightAt(px, pz);
        const monolith = mesh(new THREE.BoxGeometry(1.1, lerp(3.8, 8, rng()), 1.4), stone);
        monolith.position.set(px, py + monolith.geometry.parameters.height / 2, pz);
        monolith.rotation.set((rng() - 0.5) * 0.12, pointAngle + rng(), (rng() - 0.5) * 0.14);
        this.root.add(monolith);
      }
    },

  _createShards() {
      const shardMaterial = material('#dffeff', {
        roughness: 0.16,
        metalness: 0.08,
        emissive: this.plan.palette.accent2,
        emissiveIntensity: 2.6,
        transparent: true,
        opacity: 0.96,
      });
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: this.plan.palette.accent2,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
  
      this.plan.shards.forEach((shardPlan, index) => {
        const group = new THREE.Group();
        group.position.set(shardPlan.x, shardPlan.y + 2.5, shardPlan.z);
        const crystal = mesh(new THREE.OctahedronGeometry(0.95, 0), shardMaterial.clone(), true, false);
        crystal.scale.y = 1.65;
        group.add(crystal);
        const ring = mesh(new THREE.RingGeometry(1.7, 1.85, 40), ringMaterial.clone(), false, false);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = -1.65;
        group.add(ring);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: this.plan.palette.accent2,
          transparent: true,
          opacity: 0.72,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        glow.scale.set(5.6, 5.6, 1);
        group.add(glow);
        const shard = {
          id: shardPlan.id,
          index,
          position: new THREE.Vector3(shardPlan.x, shardPlan.y + 2.5, shardPlan.z),
          group,
          crystal,
          ring,
          glow,
          collected: false,
          phase: index * 1.7,
        };
        this.shards.push(shard);
        this.root.add(group);
      });
    },

  _createEnemies() {
      const rng = mulberry32(this.plan.seed + 1901);
      this.plan.nests.forEach((nest, nestIndex) => {
        const enemyCount = this.quality.shadowMapSize > 1024 ? 2 : 1;
        for (let index = 0; index < enemyCount; index += 1) {
          const angle = rng() * Math.PI * 2;
          const radius = lerp(6, 18, rng());
          const position = new THREE.Vector3(
            nest.x + Math.cos(angle) * radius,
            nest.y + lerp(4, 8, rng()),
            nest.z + Math.sin(angle) * radius,
          );
          const group = new THREE.Group();
          group.position.copy(position);
          const coreMaterial = material('#261a2d', {
            roughness: 0.28,
            metalness: 0.2,
            emissive: this.plan.palette.enemy,
            emissiveIntensity: 1.05,
          });
          const core = mesh(new THREE.IcosahedronGeometry(1.2, 1), coreMaterial, true, false);
          core.userData.enemyIndex = this.enemies.length;
          group.add(core);
          const ringMaterial = new THREE.MeshBasicMaterial({
            color: this.plan.palette.enemy,
            transparent: true,
            opacity: 0.58,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const ringA = mesh(new THREE.TorusGeometry(1.75, 0.08, 6, 30), ringMaterial, false, false);
          ringA.rotation.x = Math.PI / 2;
          const ringB = ringA.clone();
          ringB.rotation.y = Math.PI / 2;
          group.add(ringA, ringB);
          const glow = new THREE.Sprite(new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: this.plan.palette.enemy,
            transparent: true,
            opacity: 0.38,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }));
          glow.scale.set(6, 6, 1);
          group.add(glow);
          const enemy = {
            id: `wraith-${nestIndex}-${index}`,
            group,
            core,
            rings: [ringA, ringB],
            glow,
            home: new THREE.Vector3(nest.x, nest.y + 5, nest.z),
            phase: rng() * Math.PI * 2,
            hp: 3,
            alive: true,
            attackCooldown: 0,
            flash: 0,
          };
          this.enemies.push(enemy);
          this.enemyHitMeshes.push(core);
          this.root.add(group);
        }
      });
    },

  update(dt, player) {
      this.elapsed += dt;
      this.worldTime = (this.worldTime + dt * 0.055) % 24;
      this.scanActive = Math.max(0, this.scanActive - dt);
      this.scanCooldown = Math.max(0, this.scanCooldown - dt);
      this._updateLighting();
      this._updateAtmosphere(dt);
      this._updateAnimated(dt);
      const damage = this._updateEnemies(dt, player);
      this._updateEffects(dt);
      return { damage };
    },

  _updateLighting() {
      const angle = (this.worldTime / 24) * Math.PI * 2 - Math.PI / 2;
      const sunHeight = Math.sin(angle);
      const dayFactor = smoothstep(-0.18, 0.18, sunHeight);
      const sunDirection = new THREE.Vector3(Math.cos(angle) * 0.72, sunHeight, -0.52).normalize();
      this.sun.position.copy(sunDirection).multiplyScalar(330);
      this.sun.position.y = Math.max(-60, this.sun.position.y);
      this.sun.target.position.set(0, 0, 0);
      this.sun.intensity = lerp(0.05, 3.5, dayFactor);
      this.hemi.intensity = lerp(0.13, 1.35, dayFactor);
      this.skyUniforms.dayFactor.value = dayFactor;
      this.skyUniforms.sunDirection.value.copy(sunDirection);
      this.waterUniforms.sunDirection.value.copy(sunDirection);
      this.stars.material.opacity = smoothstep(0.18, -0.08, sunHeight) * 0.9;
      const fogColor = color('#17202a').lerp(color(this.plan.palette.fog), dayFactor);
      this.scene.fog.color.copy(fogColor);
      this.scene.background.copy(fogColor);
      this.waterUniforms.fogColor.value.copy(fogColor);
      this.audio?.setNightFactor(1 - dayFactor);
    },

  _updateAtmosphere(dt) {
      this.waterUniforms.time.value = this.elapsed;
      this.clouds.forEach((cloud) => {
        cloud.position.x += cloud.userData.speed * dt;
        if (cloud.position.x > cloud.userData.wrap) cloud.position.x = -cloud.userData.wrap;
      });
    }
};
