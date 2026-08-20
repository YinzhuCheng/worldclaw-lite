import * as THREE from 'three';
import { PLAYER_EYE_HEIGHT, clamp } from './config.js';

const FORWARD = new THREE.Vector3();
const RIGHT = new THREE.Vector3();
const WISH = new THREE.Vector3();
const DESIRED = new THREE.Vector3();
const PREVIOUS = new THREE.Vector3();

function makeViewModel() {
  const group = new THREE.Group();
  group.name = 'SignalCasterViewModel';
  group.position.set(0.48, -0.48, -0.86);
  group.rotation.set(-0.04, -0.12, -0.05);

  const dark = new THREE.MeshStandardMaterial({ color: '#182321', roughness: 0.5, metalness: 0.62 });
  const metal = new THREE.MeshStandardMaterial({ color: '#72827e', roughness: 0.35, metalness: 0.78 });
  const glow = new THREE.MeshStandardMaterial({
    color: '#d7ffff',
    roughness: 0.16,
    metalness: 0.14,
    emissive: '#48cce8',
    emissiveIntensity: 3.2,
  });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.94), dark);
  body.position.z = -0.08;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.075, 0.82, 10), metal);
  rail.rotation.x = Math.PI / 2;
  rail.position.set(0, 0.08, -0.48);
  const emitter = new THREE.Mesh(new THREE.IcosahedronGeometry(0.115, 1), glow);
  emitter.position.set(0, 0.08, -0.91);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 7, 24), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, 0.08, -0.82);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.48, 0.22), dark);
  grip.position.set(0, -0.28, 0.12);
  grip.rotation.x = -0.22;
  group.add(body, rail, emitter, ring, grip);
  group.userData = { emitter, ring, basePosition: group.position.clone(), baseRotation: group.rotation.clone() };
  group.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    child.renderOrder = 20;
    child.material.depthTest = true;
  });
  return group;
}

export class PlayerController {
  constructor(camera, canvas, world, audio, callbacks = {}) {
    this.camera = camera;
    this.canvas = canvas;
    this.world = world;
    this.audio = audio;
    this.callbacks = callbacks;

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = -0.08;
    this.health = 100;
    this.stamina = 100;
    this.grounded = false;
    this.inWater = false;
    this.enabled = false;
    this.locked = false;
    this.lanternOn = true;
    this.walkPhase = 0;
    this.recoil = 0;
    this.damageFlash = 0;
    this.keys = new Set();
    this.eyeHeight = PLAYER_EYE_HEIGHT;

    this.camera.rotation.order = 'YXZ';
    this.viewModel = makeViewModel();
    this.camera.add(this.viewModel);

    this.lantern = new THREE.SpotLight('#bfeeff', 4.4, 58, Math.PI / 7.5, 0.56, 1.7);
    this.lantern.position.set(0.22, -0.18, -0.2);
    this.lanternTarget = new THREE.Object3D();
    this.lanternTarget.position.set(0, -0.06, -12);
    this.camera.add(this.lantern, this.lanternTarget);
    this.lantern.target = this.lanternTarget;

    this.#bindEvents();
  }

  #bindEvents() {
    this.onMouseMove = (event) => {
      if (!this.enabled || !this.locked) return;
      const sensitivity = 0.00175;
      this.yaw -= event.movementX * sensitivity;
      this.pitch -= event.movementY * sensitivity;
      this.pitch = clamp(this.pitch, -Math.PI * 0.48, Math.PI * 0.48);
    };
    this.onPointerLockChange = () => {
      this.locked = document.pointerLockElement === this.canvas;
      this.callbacks.onLockChange?.(this.locked);
    };
    this.onKeyDown = (event) => {
      if (!this.enabled) return;
      this.keys.add(event.code);
      if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight'].includes(event.code)) event.preventDefault();
      if (event.repeat) return;
      if (event.code === 'KeyQ') this.callbacks.onScan?.();
      if (event.code === 'KeyF') this.toggleLantern();
      if (event.code === 'KeyM') this.callbacks.onMap?.();
      if (event.code === 'KeyR') this.callbacks.onRespawn?.();
    };
    this.onKeyUp = (event) => this.keys.delete(event.code);
    this.onMouseDown = (event) => {
      if (!this.enabled || !this.locked) return;
      if (event.button === 0) {
        event.preventDefault();
        this.callbacks.onShoot?.();
      }
      if (event.button === 2) {
        event.preventDefault();
        this.callbacks.onScan?.();
      }
    };
    this.onContextMenu = (event) => event.preventDefault();
    this.onCanvasClick = () => {
      if (this.enabled && !this.locked) this.lock();
    };

    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('keydown', this.onKeyDown, { passive: false });
    document.addEventListener('keyup', this.onKeyUp);
    this.canvas.addEventListener('mousedown', this.onMouseDown);
    this.canvas.addEventListener('contextmenu', this.onContextMenu);
    this.canvas.addEventListener('click', this.onCanvasClick);
  }

  setWorld(world) {
    this.world = world;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    this.viewModel.visible = enabled;
    this.lantern.visible = enabled;
    if (!enabled) {
      this.keys.clear();
      if (this.locked) document.exitPointerLock?.();
    }
  }

  requestLock() {
    return this.lock();
  }

  releaseLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }

  async lock() {
    if (!this.enabled || this.locked) return;
    try {
      await this.canvas.requestPointerLock({ unadjustedMovement: true });
    } catch {
      try {
        await this.canvas.requestPointerLock();
      } catch {
        // Pointer Lock can be denied by embedded previews. The UI remains usable.
      }
    }
  }

  spawn(spawn, lookAt = null) {
    const x = spawn.x;
    const z = spawn.z;
    const ground = this.#walkableHeight(x, z);
    this.position.set(x, ground + this.eyeHeight, z);
    this.velocity.set(0, 0, 0);
    this.health = 100;
    this.stamina = 100;
    this.grounded = true;
    this.damageFlash = 0;
    if (lookAt) {
      const dx = lookAt.x - x;
      const dz = lookAt.z - z;
      this.yaw = Math.atan2(-dx, -dz);
      this.pitch = -0.05;
    }
    this.#syncCamera(0, 0);
  }

  respawn() {
    const camp = this.world.plan.camp;
    const angle = Math.atan2(-camp.x, -camp.z);
    const spawn = {
      x: camp.x + Math.cos(angle + Math.PI / 2) * 8,
      z: camp.z + Math.sin(angle + Math.PI / 2) * 8,
    };
    this.spawn(spawn, this.world.plan.core);
    this.callbacks.onRespawned?.();
  }

  #walkableHeight(x, z) {
    const terrain = this.world.plan.heightAt(x, z);
    const water = this.world.waterHeightAt(x, z);
    if (Number.isFinite(water) && water > terrain + 0.4) return Math.max(terrain, water - 1.25);
    return terrain;
  }

  isDown(code) {
    return this.keys.has(code);
  }

  getForward(target = new THREE.Vector3()) {
    this.camera.getWorldDirection(target);
    return target.normalize();
  }

  toggleLantern(force = null) {
    this.lanternOn = force ?? !this.lanternOn;
    this.lantern.intensity = this.lanternOn ? 4.4 : 0;
    this.callbacks.onLantern?.(this.lanternOn);
  }

  kickRecoil() {
    this.recoil = Math.min(1, this.recoil + 0.72);
  }

  damage(amount) {
    if (!this.enabled || amount <= 0) return;
    this.health = clamp(this.health - amount, 0, 100);
    this.damageFlash = Math.min(1, this.damageFlash + amount / 24);
    this.audio?.damage();
    this.callbacks.onDamage?.(amount, this.health);
    if (this.health <= 0) {
      this.callbacks.onDowned?.();
      this.respawn();
    }
  }

  update(dt) {
    if (!this.enabled || !this.world) {
      this.#syncCamera(0, 0);
      return this.snapshot();
    }

    const moveX = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    const moveForward = (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0);
    const hasInput = moveX !== 0 || moveForward !== 0;
    const wantsSprint = hasInput && (this.isDown('ShiftLeft') || this.isDown('ShiftRight')) && this.stamina > 2;

    FORWARD.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    RIGHT.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    WISH.set(0, 0, 0).addScaledVector(FORWARD, moveForward).addScaledVector(RIGHT, moveX);
    if (WISH.lengthSq() > 1) WISH.normalize();

    this.inWater = this.world.surfaceAt(this.position.x, this.position.z) === 'water';
    const baseSpeed = wantsSprint ? 13.4 : 8.1;
    const targetSpeed = baseSpeed * (this.inWater ? 0.52 : 1);
    const targetX = WISH.x * targetSpeed;
    const targetZ = WISH.z * targetSpeed;
    const acceleration = this.grounded ? (hasInput ? 42 : 28) : 13;
    const blend = 1 - Math.exp(-acceleration * dt);
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;

    if (wantsSprint) this.stamina = clamp(this.stamina - dt * 19, 0, 100);
    else this.stamina = clamp(this.stamina + dt * (hasInput ? 8.5 : 15), 0, 100);

    if (this.isDown('Space') && this.grounded && !this.inWater) {
      this.velocity.y = 8.8;
      this.grounded = false;
    }
    this.velocity.y -= (this.inWater ? 8.5 : 25) * dt;

    PREVIOUS.copy(this.position);
    DESIRED.copy(this.position);
    DESIRED.x += this.velocity.x * dt;
    DESIRED.z += this.velocity.z * dt;

    const currentGround = this.#walkableHeight(this.position.x, this.position.z);
    const nextGround = this.#walkableHeight(DESIRED.x, DESIRED.z);
    const tooSteep = this.world.plan.slopeAt(DESIRED.x, DESIRED.z) > 1.3 && nextGround > currentGround + 0.35;
    if (tooSteep) {
      DESIRED.x = this.position.x;
      DESIRED.z = this.position.z;
      this.velocity.x *= 0.3;
      this.velocity.z *= 0.3;
    }

    this.world.resolvePosition(PREVIOUS, DESIRED, 0.58);
    this.position.x = DESIRED.x;
    this.position.z = DESIRED.z;
    this.position.y += this.velocity.y * dt;

    const groundEye = this.#walkableHeight(this.position.x, this.position.z) + this.eyeHeight;
    if (this.position.y <= groundEye) {
      this.position.y = groundEye;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.grounded && horizontalSpeed > 1.2 && hasInput) {
      this.walkPhase += dt * horizontalSpeed * (wantsSprint ? 1.22 : 1);
      this.audio?.step(this.world.surfaceAt(this.position.x, this.position.z), wantsSprint);
    }

    this.recoil = Math.max(0, this.recoil - dt * 5.8);
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    this.#syncCamera(horizontalSpeed, wantsSprint ? 1 : 0);
    return this.snapshot();
  }

  #syncCamera(horizontalSpeed, sprintFactor) {
    const moving = this.grounded && horizontalSpeed > 0.8;
    const bobAmount = moving ? Math.min(1, horizontalSpeed / 8) : 0;
    const bobY = Math.abs(Math.sin(this.walkPhase * 0.55)) * 0.055 * bobAmount;
    const bobX = Math.sin(this.walkPhase * 0.275) * 0.032 * bobAmount;
    this.camera.position.copy(this.position);
    this.camera.position.y += bobY;
    this.camera.position.x += Math.cos(this.yaw) * bobX;
    this.camera.position.z -= Math.sin(this.yaw) * bobX;
    this.camera.rotation.set(this.pitch - this.recoil * 0.014, this.yaw, 0);

    const { basePosition, baseRotation, emitter, ring } = this.viewModel.userData;
    this.viewModel.position.copy(basePosition);
    this.viewModel.position.x += Math.sin(this.walkPhase * 0.275) * 0.022 * bobAmount;
    this.viewModel.position.y += Math.abs(Math.sin(this.walkPhase * 0.55)) * -0.025 * bobAmount;
    this.viewModel.position.z += this.recoil * 0.12;
    this.viewModel.rotation.copy(baseRotation);
    this.viewModel.rotation.x += this.recoil * 0.12 + sprintFactor * 0.025;
    emitter.material.emissiveIntensity = 3 + this.recoil * 5;
    ring.rotation.z += 0.018;
  }

  snapshot() {
    return {
      position: this.position,
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      stamina: this.stamina,
      grounded: this.grounded,
      inWater: this.inWater,
      locked: this.locked,
      lanternOn: this.lanternOn,
      damageFlash: this.damageFlash,
      speed: Math.hypot(this.velocity.x, this.velocity.z),
    };
  }

  dispose() {
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.canvas.removeEventListener('mousedown', this.onMouseDown);
    this.canvas.removeEventListener('contextmenu', this.onContextMenu);
    this.canvas.removeEventListener('click', this.onCanvasClick);
    this.camera.remove(this.viewModel, this.lantern, this.lanternTarget);
  }
}
