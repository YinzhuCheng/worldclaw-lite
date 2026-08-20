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

export const worldMethods5 = {
  _beam(start, end, beamColor) {
      const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: beamColor,
        transparent: true,
        opacity: 0.88,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const line = new THREE.Line(geometry, lineMaterial);
      this.scene.add(line);
      this.effects.push({ type: 'line', object: line, life: 0.11, maxLife: 0.11 });
    },

  _burst(position, burstColor, count = 18, speed = 3) {
      const rng = mulberry32((this.plan.seed + Math.floor(this.elapsed * 1000) + count) >>> 0);
      const positions = new Float32Array(count * 3);
      const velocities = [];
      for (let index = 0; index < count; index += 1) {
        positions[index * 3] = position.x;
        positions[index * 3 + 1] = position.y;
        positions[index * 3 + 2] = position.z;
        const velocity = new THREE.Vector3(rng() - 0.5, rng() * 0.9 + 0.1, rng() - 0.5).normalize().multiplyScalar(lerp(speed * 0.45, speed, rng()));
        velocities.push(velocity);
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const points = new THREE.Points(geometry, new THREE.PointsMaterial({
        color: burstColor,
        size: 0.65,
        map: this.glowTexture,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }));
      this.scene.add(points);
      this.effects.push({ type: 'burst', object: points, velocities, life: 1, maxLife: 1 });
    },

  _updateEffects(dt) {
      for (let index = this.effects.length - 1; index >= 0; index -= 1) {
        const effect = this.effects[index];
        effect.life -= dt;
        if (effect.type === 'line') {
          effect.object.material.opacity = clamp(effect.life / effect.maxLife, 0, 1) * 0.88;
        } else if (effect.type === 'burst') {
          const positions = effect.object.geometry.attributes.position;
          for (let particleIndex = 0; particleIndex < positions.count; particleIndex += 1) {
            const velocity = effect.velocities[particleIndex];
            velocity.y -= 4.2 * dt;
            positions.setXYZ(
              particleIndex,
              positions.getX(particleIndex) + velocity.x * dt,
              positions.getY(particleIndex) + velocity.y * dt,
              positions.getZ(particleIndex) + velocity.z * dt,
            );
          }
          positions.needsUpdate = true;
          effect.object.material.opacity = clamp(effect.life / effect.maxLife, 0, 1) * 0.9;
        }
        if (effect.life <= 0) {
          this.scene.remove(effect.object);
          effect.object.geometry?.dispose();
          effect.object.material?.dispose();
          this.effects.splice(index, 1);
        }
      }
    },

  dispose() {
      this.scene.remove(this.root, this.sky, this.stars, this.hemi, this.sun, this.sun.target);
      this.clouds.forEach((cloud) => {
        this.scene.remove(cloud);
        cloud.traverse((child) => {
          child.geometry?.dispose?.();
          if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose?.());
          else child.material?.dispose?.();
        });
      });
      this.effects.forEach((effect) => {
        this.scene.remove(effect.object);
        effect.object.geometry?.dispose?.();
        effect.object.material?.dispose?.();
      });
      this.root.traverse((child) => {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) child.material.forEach((entry) => entry.dispose?.());
        else child.material?.dispose?.();
      });
      this.glowTexture.dispose();
      this.noiseTexture.dispose();
    }
};
