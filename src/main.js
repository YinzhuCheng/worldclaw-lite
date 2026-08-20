import * as THREE from 'three';
import { AssetLibrary } from './assets.js';
import { AudioSystem } from './audio.js';
import { QUALITY_PRESETS, clamp } from './config.js';
import { PlayerController } from './player.js';
import { GameUI } from './ui.js';
import { createWorldPlan, serializePlan } from './world-model.js';
import { World } from './world.js';

window.__WORLDCLAW_BOOTED__ = true;
if (window.__WORLDCLAW_BOOT_TIMER__) window.clearTimeout(window.__WORLDCLAW_BOOT_TIMER__);

const ui = new GameUI();
const audio = new AudioSystem();
const assets = new AssetLibrary();

const PROMPT_PRESETS = [
  'A misty green valley with an ancient lake, ruined signal towers and a glowing forest at dusk',
  'An amber highland basin with wind-carved ruins, pine groves and a cold blue reservoir at sunset',
  'A moonlit silver forest wrapped around a forgotten observatory, flooded roads and luminous crystals',
  'A wild emerald frontier with steep ridges, an old expedition camp and signal relays hidden in fog',
  'A quiet autumn valley with golden grass, broken stone arches and a deep lake beneath a pale sky',
];

let renderer;
let scene;
let camera;
let world = null;
let player = null;
let plan = null;
let previewPlan = null;
let assetPromise = null;
let assetsReady = false;
let gameRunning = false;
let completionOpen = false;
let infoResumeRequested = false;
let interaction = null;
let interactionProgress = 0;
let lastFrame = performance.now();
let frameErrorShown = false;

const shotOrigin = new THREE.Vector3();
const shotDirection = new THREE.Vector3();

function applyPlanTheme(nextPlan) {
  document.documentElement.style.setProperty('--accent', nextPlan.palette.accent);
  document.documentElement.style.setProperty('--accent-2', nextPlan.palette.accent2);
  document.documentElement.style.setProperty('--danger', nextPlan.palette.enemy);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextPlan.palette.grassLow);
}

function createRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: ui.elements.game,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.04;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor('#08130f');
  } catch (error) {
    console.error('[renderer] WebGL initialization failed:', error);
    ui.showUnsupported();
    return false;
  }
  return true;
}

function createScene() {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(63, window.innerWidth / Math.max(1, window.innerHeight), 0.08, 1250);
  camera.rotation.order = 'YXZ';
  scene.add(camera);
}

function resize() {
  if (!renderer || !camera) return;
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function disposeSceneGraph(root) {
  if (!root) return;
  root.traverse((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
    else object.material?.dispose?.();
  });
}

function disposeGame() {
  player?.dispose();
  player = null;
  world?.dispose();
  world = null;
  disposeSceneGraph(scene);
  renderer?.renderLists?.dispose?.();
  createScene();
  interaction = null;
  interactionProgress = 0;
  gameRunning = false;
  completionOpen = false;
}

function refreshPreview(settings = ui.getSettings()) {
  try {
    previewPlan = createWorldPlan(settings.prompt, settings.seed, settings.quality);
    applyPlanTheme(previewPlan);
    ui.updatePreview(previewPlan);
  } catch (error) {
    console.error('[planner] Unable to generate preview:', error);
  }
}

function randomSeed() {
  const buffer = new Uint32Array(2);
  crypto.getRandomValues(buffer);
  return `ECHO-${buffer[0].toString(36).slice(0, 5)}-${buffer[1].toString(36).slice(0, 5)}`.toUpperCase();
}

function randomizePlanner() {
  const preset = PROMPT_PRESETS[Math.floor(Math.random() * PROMPT_PRESETS.length)];
  ui.setSettings({ prompt: preset, seed: randomSeed() });
  refreshPreview();
}

async function preloadAssets() {
  if (assetPromise) return assetPromise;
  ui.setLoading(0.04, 'Contacting the CC0 model cache', false);
  assetPromise = assets.load((progress, name, remote) => {
    const source = remote ? 'CC0 model' : 'procedural fallback';
    ui.setLoading(0.06 + progress * 0.82, `${name} · ${source}`, false);
  }).then(() => {
    assetsReady = true;
    const diagnostics = assets.diagnostics();
    ui.setAssetStatus(diagnostics);
    ui.setLoading(1, diagnostics.fallback ? 'World system ready · resilient asset mode' : 'World system ready', true);
    return diagnostics;
  }).catch((error) => {
    console.error('[assets] Library initialization failed:', error);
    assetsReady = true;
    const diagnostics = assets.diagnostics();
    ui.setAssetStatus(diagnostics);
    ui.setLoading(1, 'World system ready · procedural asset mode', true);
    return diagnostics;
  });
  return assetPromise;
}

function makeSpawn(nextPlan) {
  const camp = nextPlan.camp;
  const radial = new THREE.Vector2(camp.x, camp.z);
  if (radial.lengthSq() < 0.1) radial.set(1, 0);
  radial.normalize();
  return {
    x: camp.x + radial.x * 11,
    z: camp.z + radial.y * 11,
  };
}

function suspendPlayerForOverlay() {
  if (!player || !gameRunning) return;
  infoResumeRequested = player.enabled;
  player.setEnabled(false);
}

function resumeFromOverlay() {
  if (!player || !gameRunning || completionOpen) return;
  if (infoResumeRequested) {
    player.setEnabled(true);
    void player.requestLock();
  }
  infoResumeRequested = false;
}

function openMap() {
  if (!gameRunning || !player || ui.infoOpen || completionOpen) return;
  ui.showMap(true);
  suspendPlayerForOverlay();
}

function closeMap() {
  ui.showMap(false);
  resumeFromOverlay();
}

function openPlan() {
  ui.openPlan(serializePlan(plan ?? previewPlan));
  if (gameRunning) suspendPlayerForOverlay();
}

function openCredits() {
  ui.openCredits(assets.diagnostics());
  if (gameRunning) suspendPlayerForOverlay();
}

function closeInfo() {
  ui.closeInfo();
  resumeFromOverlay();
}

function downloadPlan() {
  const activePlan = plan ?? previewPlan;
  if (!activePlan) return;
  const payload = JSON.stringify(serializePlan(activePlan), null, 2);
  const blob = new Blob([payload], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = `${activePlan.worldName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${activePlan.seedText.toLowerCase()}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(href);
}

function onPointerLockChange(locked) {
  if (!gameRunning || !player || completionOpen || ui.mapOpen || ui.infoOpen) return;
  if (!locked && player.enabled) {
    player.setEnabled(false);
    ui.showPause(true);
  }
}

function onScan() {
  if (!world || !player?.enabled) return;
  if (world.scan()) ui.toast('SCANNER PULSE · ECHO SIGNATURES REVEALED', 'accent', 1900);
  else ui.toast(`SCANNER RECHARGING · ${world.scanCooldown.toFixed(1)}s`, 'normal', 1200);
}

function onShoot() {
  if (!world || !player?.enabled || !player.locked) return;
  camera.getWorldPosition(shotOrigin);
  player.getForward(shotDirection);
  const result = world.shoot(shotOrigin, shotDirection);
  player.kickRecoil();
  ui.hitMarker(result.hit);
  if (result.defeated) ui.toast('ECHO WRAITH DISPERSED', 'danger', 1450);
}

function buildPlayer() {
  player = new PlayerController(camera, document.querySelector('#game'), world, audio, {
    onLockChange: onPointerLockChange,
    onShoot,
    onScan,
    onMap: openMap,
    onRespawn: () => {
      player.respawn();
      ui.toast('FIELD RIG REDEPLOYED AT WAYFARER CAMP', 'accent', 1800);
    },
    onDowned: () => ui.toast('SIGNAL COLLAPSE · AUTOMATIC REDEPLOY', 'danger', 2200),
    onLantern: (enabled) => ui.toast(enabled ? 'LANTERN ONLINE' : 'LANTERN OFFLINE', 'normal', 1000),
  });
  player.spawn(makeSpawn(plan), plan.core);
  player.setEnabled(true);
}

async function enterWorld(settings) {
  if (!renderer || !assetsReady) await preloadAssets();
  await audio.start();

  ui.setLoading(0.02, 'Compiling deterministic ScenePlan', false);
  plan = createWorldPlan(settings.prompt, settings.seed, settings.quality);
  previewPlan = plan;
  applyPlanTheme(plan);
  ui.updatePreview(plan);

  if (world || player) disposeGame();
  const quality = QUALITY_PRESETS[plan.quality] ?? QUALITY_PRESETS.high;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
  renderer.shadowMap.enabled = true;
  resize();

  try {
    world = new World(scene, plan, assets, quality, audio);
    await world.build((progress, label) => ui.setLoading(0.18 + progress * 0.78, label, false));
    buildPlayer();
    gameRunning = true;
    completionOpen = false;
    frameErrorShown = false;
    ui.setLoading(1, 'World synchronized', true);
    ui.showGame(plan, world, player.snapshot());
    ui.toast('WORLD GENERATED · CLICK THE WORLD TO CAPTURE MOUSE', 'accent', 3600);
  } catch (error) {
    console.error('[world] Generation failed:', error);
    ui.setLoading(1, `Generation failed · ${error.message}`, true);
    disposeGame();
    ui.showStart();
  }
}

function resumeGame() {
  if (!player || !gameRunning) return;
  ui.showPause(false);
  player.setEnabled(true);
  void player.requestLock();
}

function returnToConsole() {
  player?.releaseLock();
  disposeGame();
  ui.showStart();
  ui.setAssetStatus(assets.diagnostics());
  ui.setLoading(1, 'World system ready', true);
  refreshPreview();
}

function continueExploring() {
  completionOpen = false;
  ui.hideComplete();
  player?.setEnabled(true);
  void player?.requestLock();
  ui.toast('FREE EXPLORATION MODE', 'accent', 1500);
}

function showCompletion() {
  if (completionOpen || !world || !player) return;
  completionOpen = true;
  ui.showComplete(world);
  player.setEnabled(false);
}

function updateInteraction(dt) {
  if (!world || !player?.enabled) {
    interaction = null;
    interactionProgress = 0;
    ui.setInteraction('', 0);
    return;
  }

  const nearby = world.findInteraction(player.position);
  if (!nearby) {
    interaction = null;
    interactionProgress = Math.max(0, interactionProgress - dt * 4);
    ui.setInteraction('', 0);
    return;
  }

  if (interaction?.item.id !== nearby.item.id) {
    interaction = nearby;
    interactionProgress = 0;
  } else {
    interaction = nearby;
  }

  const item = interaction.item;
  const actionable = (item.type === 'relay' && !item.activated)
    || (item.type === 'core' && world.isMissionReady() && !world.completed);

  if (actionable && player.isDown('KeyE')) {
    const duration = item.type === 'core' ? 2.15 : 1.45;
    interactionProgress += dt / duration;
    if (interactionProgress >= 1) {
      const result = world.activate(item);
      interactionProgress = 0;
      if (result?.type === 'relay') ui.toast(`${item.name.toUpperCase()} · ONLINE`, 'accent', 2200);
      if (result?.type === 'complete') showCompletion();
    }
  } else {
    interactionProgress = Math.max(0, interactionProgress - dt * 2.8);
  }
}

function updateGame(dt, now) {
  if (!world || !player || !gameRunning) return;
  const simulationActive = player.enabled && !ui.paused && !ui.mapOpen && !ui.infoOpen && !completionOpen;
  const snapshot = player.update(simulationActive ? dt : 0);
  const events = world.update(simulationActive ? dt : 0, player);

  if (simulationActive) {
    if (events.damage > 0) player.damage(events.damage);
    const collected = world.collectNearby(player.position);
    collected.forEach(() => ui.toast(`ECHO SHARD RECOVERED · ${world.shardsCollected}/${plan.shards.length}`, 'accent', 1800));

    const campDistance = Math.hypot(player.position.x - plan.camp.x, player.position.z - plan.camp.z);
    if (campDistance < 12 && player.health < 100) player.health = clamp(player.health + dt * 5, 0, 100);
    updateInteraction(dt);
  } else {
    interactionProgress = Math.max(0, interactionProgress - dt * 3);
  }

  const nearestObjective = world.getNearestObjective(player.position);
  ui.update(snapshot, world, interaction, interactionProgress, nearestObjective, now);
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  try {
    updateGame(dt, now);
    if (renderer && scene && camera) renderer.render(scene, camera);
  } catch (error) {
    console.error('[frame] Runtime error:', error);
    if (!frameErrorShown) {
      frameErrorShown = true;
      ui.toast(`RENDER WARNING · ${error.message}`, 'danger', 6000);
    }
  }
  requestAnimationFrame(frame);
}

ui.bind({
  onEnter: (settings) => void enterWorld(settings),
  onRandomize: randomizePlanner,
  onResume: resumeGame,
  onReturn: returnToConsole,
  onMapClose: closeMap,
  onContinue: continueExploring,
  onNewWorld: returnToConsole,
  onPlan: openPlan,
  onCredits: openCredits,
  onInfoClose: closeInfo,
  onDownloadPlan: downloadPlan,
  onPreview: refreshPreview,
});

window.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => {
  if (document.hidden && gameRunning && player?.enabled) {
    player.setEnabled(false);
    ui.showPause(true);
  }
});

if (createRenderer()) {
  createScene();
  resize();
  refreshPreview();
  void preloadAssets();
  requestAnimationFrame(frame);
}
