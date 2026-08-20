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

export const worldMethods2 = {
  _createGrass(rng) {
      const geometry = new THREE.ConeGeometry(0.08, 0.72, 3);
      geometry.translate(0, 0.36, 0);
      const grassMaterial = material(this.plan.palette.grassHigh, { roughness: 1 });
      const grass = new THREE.InstancedMesh(geometry, grassMaterial, this.quality.grass);
      grass.castShadow = false;
      grass.receiveShadow = true;
      grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
      const matrix = new THREE.Matrix4();
      const quaternion = new THREE.Quaternion();
      const position = new THREE.Vector3();
      const scale = new THREE.Vector3();
      const instanceColor = new THREE.Color();
      let placed = 0;
      for (let attempt = 0; placed < this.quality.grass && attempt < this.quality.grass * 8; attempt += 1) {
        const x = lerp(-WORLD_HALF + 20, WORLD_HALF - 20, rng());
        const z = lerp(-WORLD_HALF + 20, WORLD_HALF - 20, rng());
        if (this._isReserved(x, z, 0) || this.plan.slopeAt(x, z) > 0.65) continue;
        const y = this.plan.heightAt(x, z);
        position.set(x, y, z);
        quaternion.setFromAxisAngle(UP, rng() * Math.PI * 2);
        const size = lerp(0.68, 1.65, rng());
        scale.set(size, size * lerp(0.8, 1.35, rng()), size);
        matrix.compose(position, quaternion, scale);
        grass.setMatrixAt(placed, matrix);
        instanceColor.set(this.plan.palette.grassLow).lerp(color(this.plan.palette.grassHigh), rng() * 0.82);
        grass.setColorAt(placed, instanceColor);
        placed += 1;
      }
      grass.count = placed;
      grass.instanceMatrix.needsUpdate = true;
      if (grass.instanceColor) grass.instanceColor.needsUpdate = true;
      this.root.add(grass);
    },

  _createFlowers(rng) {
      const positions = [];
      const colors = [];
      const accent = color(this.plan.palette.accent);
      const accent2 = color(this.plan.palette.accent2);
      for (let attempt = 0; positions.length < this.quality.flowers * 3 && attempt < this.quality.flowers * 8; attempt += 1) {
        const x = lerp(-WORLD_HALF + 30, WORLD_HALF - 30, rng());
        const z = lerp(-WORLD_HALF + 30, WORLD_HALF - 30, rng());
        if (this._isReserved(x, z, 0) || this.plan.slopeAt(x, z) > 0.5) continue;
        const y = this.plan.heightAt(x, z) + lerp(0.12, 0.32, rng());
        positions.push(x, y, z);
        const flowerColor = accent.clone().lerp(accent2, rng());
        colors.push(flowerColor.r, flowerColor.g, flowerColor.b);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({
        size: 0.55,
        map: this.glowTexture,
        transparent: true,
        opacity: 0.72,
        vertexColors: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      this.root.add(points);
    },

  _createWorldCore() {
      const { x, y, z } = this.plan.core;
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const stone = material(this.plan.palette.stone, { roughness: 0.94 });
      const darkStone = material(this.plan.palette.stoneDark, { roughness: 0.98 });
      const energy = material('#d8fff0', {
        roughness: 0.22,
        metalness: 0.08,
        emissive: this.plan.palette.accent,
        emissiveIntensity: 1.8,
        transparent: true,
        opacity: 0.9,
      });
  
      const platform = mesh(new THREE.CylinderGeometry(13.5, 15, 1.6, 12), darkStone);
      platform.position.y = 0.6;
      group.add(platform);
      const dais = mesh(new THREE.CylinderGeometry(6.2, 7.2, 1.05, 12), stone);
      dais.position.y = 1.55;
      group.add(dais);
  
      for (let index = 0; index < 8; index += 1) {
        const angle = (index / 8) * Math.PI * 2;
        const column = mesh(new THREE.CylinderGeometry(0.62, 0.82, 5.8, 7), stone);
        column.position.set(Math.cos(angle) * 9.6, 3.8, Math.sin(angle) * 9.6);
        column.rotation.z = (index % 2 ? 1 : -1) * 0.035;
        group.add(column);
        const cap = mesh(new THREE.BoxGeometry(1.6, 0.42, 1.6), darkStone);
        cap.position.set(Math.cos(angle) * 9.6, 6.75, Math.sin(angle) * 9.6);
        cap.rotation.y = angle;
        group.add(cap);
      }
  
      const core = mesh(new THREE.OctahedronGeometry(2.15, 0), energy);
      core.position.y = 6.2;
      core.userData.core = true;
      group.add(core);
      const ringMaterial = material(this.plan.palette.accent2, {
        roughness: 0.3,
        metalness: 0.35,
        emissive: this.plan.palette.accent2,
        emissiveIntensity: 0.8,
        transparent: true,
        opacity: 0.72,
      });
      const ringA = mesh(new THREE.TorusGeometry(4.2, 0.11, 8, 72), ringMaterial, false, false);
      ringA.position.y = 5.8;
      ringA.rotation.x = Math.PI / 2;
      const ringB = ringA.clone();
      ringB.rotation.set(Math.PI / 2, Math.PI / 3, 0.7);
      group.add(ringA, ringB);
  
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: this.plan.palette.accent,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      glow.position.y = 6.2;
      glow.scale.set(10, 10, 1);
      group.add(glow);
  
      const beam = mesh(new THREE.CylinderGeometry(0.55, 1.8, 90, 16, 1, true), new THREE.MeshBasicMaterial({
        color: this.plan.palette.accent,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }), false, false);
      beam.position.y = 50;
      group.add(beam);
  
      this.coreObject = { group, core, rings: [ringA, ringB], glow, beam, active: false };
      this.interactables.push({
        id: 'world-core',
        type: 'core',
        name: 'World Core',
        position: new THREE.Vector3(x, y + 2, z),
        radius: 10,
        group,
      });
      this.colliders.push({ x, z, radius: 6.7 });
      this.animated.push({ type: 'core', object: this.coreObject });
      this.root.add(group);
    },

  _createRelays() {
      const stone = material(this.plan.palette.stone, { roughness: 0.96 });
      const darkStone = material(this.plan.palette.stoneDark, { roughness: 0.98 });
      const energy = material(this.plan.palette.accent2, {
        roughness: 0.22,
        metalness: 0.15,
        emissive: this.plan.palette.accent2,
        emissiveIntensity: 0.12,
      });
  
      this.plan.relays.forEach((relay, relayIndex) => {
        const group = new THREE.Group();
        group.position.set(relay.x, relay.y, relay.z);
        const base = mesh(new THREE.CylinderGeometry(5.5, 6.7, 1.15, 8), darkStone);
        base.position.y = 0.5;
        group.add(base);
        const pillar = mesh(new THREE.CylinderGeometry(1.5, 2.05, 10.5, 7), stone);
        pillar.position.y = 5.7;
        pillar.rotation.z = (relayIndex - 1) * 0.025;
        group.add(pillar);
        const finGeometry = new THREE.BoxGeometry(0.75, 4.8, 2.8);
        for (let index = 0; index < 3; index += 1) {
          const fin = mesh(finGeometry, darkStone);
          const angle = (index / 3) * Math.PI * 2;
          fin.position.set(Math.cos(angle) * 2.45, 7.2, Math.sin(angle) * 2.45);
          fin.rotation.y = -angle;
          group.add(fin);
        }
        const orb = mesh(new THREE.IcosahedronGeometry(1.25, 1), energy);
        orb.position.y = 12.2;
        group.add(orb);
        const ring = mesh(new THREE.TorusGeometry(2.55, 0.12, 8, 48), energy, false, false);
        ring.position.y = 12.2;
        ring.rotation.x = Math.PI / 2;
        group.add(ring);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: this.plan.palette.accent2,
          transparent: true,
          opacity: 0.2,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }));
        glow.position.y = 12.2;
        glow.scale.set(7, 7, 1);
        group.add(glow);
        const beam = mesh(new THREE.CylinderGeometry(0.16, 0.55, 120, 10, 1, true), new THREE.MeshBasicMaterial({
          color: this.plan.palette.accent2,
          transparent: true,
          opacity: 0,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }), false, false);
        beam.position.y = 70;
        group.add(beam);
  
        const interactable = {
          id: relay.id,
          type: 'relay',
          name: relay.name,
          position: new THREE.Vector3(relay.x, relay.y + 2, relay.z),
          radius: 7,
          activated: false,
          group,
          orb,
          ring,
          glow,
          beam,
        };
        this.interactables.push(interactable);
        this.animated.push({ type: 'relay', object: interactable });
        this.colliders.push({ x: relay.x, z: relay.z, radius: 3.5 });
        this.root.add(group);
  
        const sign = this.assets.clone('sign', { tint: this.plan.palette.stone, tintStrength: 0.08 });
        sign.position.set(relay.x + 6.2, relay.y, relay.z + 1.5);
        sign.rotation.y = Math.atan2(-relay.x, -relay.z) + 0.35;
        sign.scale.setScalar(2.2);
        this.root.add(sign);
      });
    }
};
