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

export const worldMethods4 = {
  _updateAnimated() {
      for (const entry of this.animated) {
        if (entry.type === 'core') {
          const { core, rings, glow, active } = entry.object;
          core.rotation.y += 0.004;
          core.position.y = 6.2 + Math.sin(this.elapsed * 1.4) * 0.32;
          rings[0].rotation.z += 0.0024;
          rings[1].rotation.z -= 0.0018;
          glow.material.opacity = active ? 0.9 + Math.sin(this.elapsed * 2) * 0.08 : 0.45 + Math.sin(this.elapsed * 1.3) * 0.08;
        } else if (entry.type === 'relay') {
          const relay = entry.object;
          relay.orb.rotation.y += relay.activated ? 0.018 : 0.004;
          relay.ring.rotation.z += relay.activated ? 0.013 : 0.002;
          relay.orb.position.y = 12.2 + Math.sin(this.elapsed * 1.8 + relay.position.x) * 0.18;
        } else if (entry.type === 'fire') {
          const { fire, light } = entry.object;
          fire.scale.y = 0.84 + Math.sin(this.elapsed * 10.7) * 0.1 + Math.sin(this.elapsed * 17.2) * 0.05;
          fire.rotation.y += 0.035;
          light.intensity = 12 + Math.sin(this.elapsed * 13) * 2.5;
        }
      }
  
      this.shards.forEach((shard) => {
        if (shard.collected) return;
        shard.group.rotation.y += 0.011;
        shard.group.position.y = shard.position.y + Math.sin(this.elapsed * 1.8 + shard.phase) * 0.38;
        shard.crystal.rotation.x += 0.006;
        shard.glow.material.opacity = 0.58 + Math.sin(this.elapsed * 2.4 + shard.phase) * 0.15;
        shard.ring.material.opacity = this.scanActive > 0 ? 0.72 * Math.min(1, this.scanActive) : 0;
        const pulse = 1 + Math.sin(this.elapsed * 4 + shard.phase) * 0.14;
        shard.ring.scale.setScalar(this.scanActive > 0 ? pulse * 2.2 : 1);
      });
    },

  _updateEnemies(dt, player) {
      if (!player) return 0;
      let damage = 0;
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
        enemy.flash = Math.max(0, enemy.flash - dt);
        enemy.core.material.emissiveIntensity = enemy.flash > 0 ? 4.5 : 1.05;
        const distance = enemy.group.position.distanceTo(player.position);
        const target = TEMP_VECTOR;
        if (distance < 58) {
          target.copy(player.position);
          target.y += 0.2;
        } else {
          const orbit = this.elapsed * 0.28 + enemy.phase;
          target.set(
            enemy.home.x + Math.cos(orbit) * 15,
            enemy.home.y + Math.sin(orbit * 1.7) * 2,
            enemy.home.z + Math.sin(orbit) * 15,
          );
        }
        TEMP_VECTOR_2.copy(target).sub(enemy.group.position);
        const speed = distance < 58 ? 4.9 : 2.1;
        if (TEMP_VECTOR_2.lengthSq() > 0.01) enemy.group.position.addScaledVector(TEMP_VECTOR_2.normalize(), speed * dt);
        const ground = this.plan.heightAt(enemy.group.position.x, enemy.group.position.z) + 3.7;
        enemy.group.position.y = Math.max(ground, enemy.group.position.y + Math.sin(this.elapsed * 2.2 + enemy.phase) * dt * 0.45);
        enemy.group.rotation.y += dt * 0.65;
        enemy.rings[0].rotation.z += dt * 0.9;
        enemy.rings[1].rotation.x -= dt * 0.7;
        enemy.glow.material.opacity = 0.32 + Math.sin(this.elapsed * 3.1 + enemy.phase) * 0.09;
  
        if (distance < 2.7 && enemy.attackCooldown <= 0) {
          damage += 12;
          enemy.attackCooldown = 1.1;
          TEMP_VECTOR_2.copy(enemy.group.position).sub(player.position).setY(0).normalize();
          enemy.group.position.addScaledVector(TEMP_VECTOR_2, 2.5);
        }
      }
      return damage;
    },

  collectNearby(position) {
      const collected = [];
      for (const shard of this.shards) {
        if (shard.collected || shard.group.position.distanceTo(position) > 2.55) continue;
        shard.collected = true;
        shard.group.visible = false;
        this.shardsCollected += 1;
        this._burst(shard.position, this.plan.palette.accent2, 28, 4.2);
        this.audio?.collect();
        collected.push(shard);
      }
      return collected;
    },

  findInteraction(position) {
      let nearest = null;
      let nearestDistance = Infinity;
      for (const item of this.interactables) {
        const distance = item.position.distanceTo(position);
        if (distance <= item.radius && distance < nearestDistance) {
          nearest = item;
          nearestDistance = distance;
        }
      }
      return nearest ? { item: nearest, distance: nearestDistance } : null;
    },

  getInteractionText(item) {
      if (item.type === 'relay') {
        return item.activated ? `${item.name} · ONLINE` : `Hold E · Activate ${item.name}`;
      }
      if (item.type === 'core') {
        if (this.completed) return 'World Core · SIGNAL RESTORED';
        if (this.isMissionReady()) return 'Hold E · Synchronize World Core';
        return `World Core locked · ${this.relaysActivated}/${this.plan.relays.length} relays · ${this.shardsCollected}/${this.plan.shards.length} shards`;
      }
      return '';
    },

  activate(item) {
      if (item.type === 'relay' && !item.activated) {
        item.activated = true;
        this.relaysActivated += 1;
        item.orb.material.emissiveIntensity = 3.4;
        item.ring.material.emissiveIntensity = 2.1;
        item.glow.material.opacity = 0.86;
        item.beam.material.opacity = 0.24;
        this._burst(item.position.clone().add(new THREE.Vector3(0, 10, 0)), this.plan.palette.accent2, 42, 6);
        this.audio?.relay();
        return { type: 'relay', item };
      }
      if (item.type === 'core' && this.isMissionReady() && !this.completed) {
        this.completed = true;
        this.coreObject.active = true;
        this.coreObject.beam.material.opacity = 0.34;
        this.coreObject.core.material.emissiveIntensity = 4.2;
        this.coreObject.rings.forEach((ring) => { ring.material.emissiveIntensity = 2.8; });
        this._burst(item.position.clone().add(new THREE.Vector3(0, 5, 0)), this.plan.palette.accent, 90, 10);
        this.audio?.complete();
        return { type: 'complete', item };
      }
      return null;
    },

  isMissionReady() {
      return this.relaysActivated >= this.plan.relays.length && this.shardsCollected >= this.plan.shards.length;
    },

  getObjective() {
      if (this.completed) return { title: 'World signal restored', detail: 'The generated world is stable.', progress: 1 };
      if (this.relaysActivated < this.plan.relays.length) {
        return {
          title: 'Activate the ancient relays',
          detail: `${this.relaysActivated} / ${this.plan.relays.length} online`,
          progress: this.relaysActivated / this.plan.relays.length * 0.46,
        };
      }
      if (this.shardsCollected < this.plan.shards.length) {
        return {
          title: 'Recover the echo shards',
          detail: `${this.shardsCollected} / ${this.plan.shards.length} recovered`,
          progress: 0.46 + this.shardsCollected / this.plan.shards.length * 0.46,
        };
      }
      return { title: 'Return to the World Core', detail: 'Synchronize the restored signal', progress: 0.94 };
    },

  getNearestObjective(position) {
      const candidates = [];
      if (this.relaysActivated < this.plan.relays.length) {
        this.interactables.filter((item) => item.type === 'relay' && !item.activated).forEach((item) => candidates.push(item));
      } else if (this.shardsCollected < this.plan.shards.length) {
        this.shards.filter((shard) => !shard.collected).forEach((shard) => candidates.push({
          id: shard.id,
          type: 'shard',
          name: 'Echo Shard',
          position: shard.position,
        }));
      } else {
        candidates.push(this.interactables.find((item) => item.type === 'core'));
      }
      let nearest = null;
      let distance = Infinity;
      candidates.filter(Boolean).forEach((candidate) => {
        const nextDistance = candidate.position.distanceTo(position);
        if (nextDistance < distance) {
          nearest = candidate;
          distance = nextDistance;
        }
      });
      return nearest ? { ...nearest, distance } : null;
    },

  scan() {
      if (this.scanCooldown > 0) return false;
      this.scanActive = 4.2;
      this.scanCooldown = 12;
      this.audio?.scan();
      return true;
    },

  shoot(origin, direction) {
      this.audio?.shoot();
      this.raycaster.set(origin, direction);
      const intersections = this.raycaster.intersectObjects(this.enemyHitMeshes, false);
      const end = origin.clone().addScaledVector(direction, 85);
      let result = { hit: false, defeated: false };
      if (intersections.length) {
        const hit = intersections[0];
        const enemy = this.enemies[hit.object.userData.enemyIndex];
        if (enemy?.alive) {
          end.copy(hit.point);
          enemy.hp -= 1;
          enemy.flash = 0.12;
          this.audio?.hit();
          this._burst(hit.point, this.plan.palette.enemy, 12, 3.2);
          result = { hit: true, defeated: false, enemy };
          if (enemy.hp <= 0) {
            enemy.alive = false;
            enemy.group.visible = false;
            this.enemiesDefeated += 1;
            this.audio?.enemyDown();
            this._burst(enemy.group.position, this.plan.palette.enemy, 34, 6.5);
            result.defeated = true;
          }
        }
      }
      this._beam(origin, end, result.hit ? this.plan.palette.enemy : this.plan.palette.accent2);
      return result;
    },

  resolvePosition(previous, desired, radius = 0.55) {
      desired.x = clamp(desired.x, -WORLD_HALF + 8, WORLD_HALF - 8);
      desired.z = clamp(desired.z, -WORLD_HALF + 8, WORLD_HALF - 8);
      for (const collider of this.colliders) {
        const dx = desired.x - collider.x;
        const dz = desired.z - collider.z;
        const distance = Math.hypot(dx, dz);
        const minimum = collider.radius + radius;
        if (distance < minimum && distance > 0.0001) {
          desired.x = collider.x + (dx / distance) * minimum;
          desired.z = collider.z + (dz / distance) * minimum;
        } else if (distance <= 0.0001) {
          desired.copy(previous);
        }
      }
      return desired;
    },

  surfaceAt(x, z) {
      if (this.plan.isLake(x, z, 0) && this.plan.heightAt(x, z) < this.plan.lake.level - 0.3) return 'water';
      if (Math.hypot(x - this.plan.core.x, z - this.plan.core.z) < 18) return 'stone';
      if (this.plan.relays.some((relay) => Math.hypot(x - relay.x, z - relay.z) < 9)) return 'stone';
      return 'grass';
    },

  waterHeightAt(x, z) {
      return this.plan.isLake(x, z, -1) ? this.plan.lake.level : -Infinity;
    }
};
