import * as THREE from 'three';
import { makeGlowTexture, makeNoiseTexture } from './world-helpers.js';
import { worldMethods1 } from './world-methods-1.js';
import { worldMethods2 } from './world-methods-2.js';
import { worldMethods3 } from './world-methods-3.js';
import { worldMethods4 } from './world-methods-4.js';
import { worldMethods5 } from './world-methods-5.js';

export class World {
  constructor(scene, plan, assets, quality, audio) {
      this.scene = scene;
      this.plan = plan;
      this.assets = assets;
      this.quality = quality;
      this.audio = audio;
      this.root = new THREE.Group();
      this.root.name = 'GeneratedWorld';
      this.scene.add(this.root);
  
      this.colliders = [];
      this.interactables = [];
      this.shards = [];
      this.enemies = [];
      this.enemyHitMeshes = [];
      this.effects = [];
      this.animated = [];
      this.clouds = [];
      this.relaysActivated = 0;
      this.shardsCollected = 0;
      this.enemiesDefeated = 0;
      this.completed = false;
      this.scanActive = 0;
      this.scanCooldown = 0;
      this.worldTime = plan.startTime;
      this.elapsed = 0;
      this.glowTexture = makeGlowTexture();
      this.noiseTexture = makeNoiseTexture(plan.seed);
  
      this.raycaster = new THREE.Raycaster();
      this.raycaster.far = 100;
    }
}

for (const methods of [worldMethods1, worldMethods2, worldMethods3, worldMethods4, worldMethods5]) {
  const descriptors = Object.getOwnPropertyDescriptors(methods);
  delete descriptors.__proto__;
  Object.defineProperties(World.prototype, descriptors);
}
