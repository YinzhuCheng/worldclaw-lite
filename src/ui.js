import { WORLD_HALF, WORLD_SIZE, clamp, formatClock, formatDistance } from './config.js';
import { angleDelta } from './math.js';

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function directionLabel(degrees) {
  const labels = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return labels[Math.round(((degrees % 360) + 360) % 360 / 45) % 8];
}

function drawMarker(context, x, y, color, radius = 3, diamond = false) {
  context.fillStyle = color;
  context.beginPath();
  if (diamond) {
    context.moveTo(x, y - radius);
    context.lineTo(x + radius, y);
    context.lineTo(x, y + radius);
    context.lineTo(x - radius, y);
    context.closePath();
  } else {
    context.arc(x, y, radius, 0, Math.PI * 2);
  }
  context.fill();
}

export class GameUI {
  constructor() {
    this.elements = {
      game: $('#game'),
      shellHeader: $('#shell-header'),
      start: $('#start-screen'),
      worldForm: $('#world-form'),
      prompt: $('#prompt-input'),
      seed: $('#seed-input'),
      quality: $('#quality-select'),
      enter: $('#enter-button'),
      randomize: $('#randomize-button'),
      loadingLabel: $('#loading-label'),
      loadingPercent: $('#loading-percent'),
      loadingFill: $('#loading-fill'),
      assetStatus: $('#asset-status'),
      previewWorldName: $('#preview-world-name'),
      previewBiome: $('#preview-biome'),
      previewMission: $('#preview-mission'),
      previewModel: $('#preview-model'),
      hud: $('#hud'),
      objectiveTitle: $('#objective-title'),
      objectiveDetail: $('#objective-detail'),
      objectiveFill: $('#objective-fill'),
      objectiveDistance: $('#objective-distance'),
      objectiveBearing: $('#objective-bearing'),
      compassMarker: $('#compass-marker'),
      compassHeading: $('#compass-heading'),
      healthLabel: $('#health-label'),
      healthFill: $('#health-fill'),
      staminaLabel: $('#stamina-label'),
      staminaFill: $('#stamina-fill'),
      lanternStatus: $('#lantern-status'),
      scanStatus: $('#scan-status'),
      worldLabel: $('#world-label'),
      positionLabel: $('#position-label'),
      timeLabel: $('#time-label'),
      minimap: $('#minimap'),
      minimapScale: $('#minimap-scale'),
      interaction: $('#interaction'),
      interactionLabel: $('#interaction-label'),
      interactionFill: $('#interaction-fill'),
      crosshair: $('#crosshair'),
      toastStack: $('#toast-stack'),
      damage: $('#damage-flash'),
      pause: $('#pause-screen'),
      resume: $('#resume-button'),
      return: $('#return-button'),
      map: $('#map-screen'),
      mapCanvas: $('#world-map'),
      mapWorldName: $('#map-world-name'),
      closeMap: $('#close-map-button'),
      complete: $('#complete-screen'),
      completeWorldName: $('#complete-world-name'),
      completeRelays: $('#complete-relays'),
      completeShards: $('#complete-shards'),
      completeWraiths: $('#complete-wraiths'),
      continue: $('#continue-button'),
      newWorld: $('#new-world-button'),
      planButton: $('#plan-button'),
      creditsButton: $('#credits-button'),
      info: $('#info-modal'),
      infoKicker: $('#info-kicker'),
      infoTitle: $('#info-title'),
      infoContent: $('#info-content'),
      closeInfo: $('#close-info-button'),
      downloadPlan: $('#download-plan-button'),
      unsupported: $('#unsupported'),
    };
    this.plan = null;
    this.world = null;
    this.player = null;
    this.mapOpen = false;
    this.infoOpen = false;
    this.paused = false;
    this.lastHudDraw = 0;
    this.callbacks = {};
  }

  bind(callbacks) {
    this.callbacks = callbacks;
    this.elements.worldForm.addEventListener('submit', (event) => {
      event.preventDefault();
      callbacks.onEnter?.(this.getSettings());
    });
    this.elements.randomize.addEventListener('click', () => callbacks.onRandomize?.());
    this.elements.resume.addEventListener('click', () => callbacks.onResume?.());
    this.elements.return.addEventListener('click', () => callbacks.onReturn?.());
    this.elements.closeMap.addEventListener('click', () => callbacks.onMapClose?.());
    this.elements.continue.addEventListener('click', () => callbacks.onContinue?.());
    this.elements.newWorld.addEventListener('click', () => callbacks.onNewWorld?.());
    this.elements.planButton.addEventListener('click', () => callbacks.onPlan?.());
    this.elements.creditsButton.addEventListener('click', () => callbacks.onCredits?.());
    this.elements.closeInfo.addEventListener('click', () => callbacks.onInfoClose?.());
    this.elements.downloadPlan.addEventListener('click', () => callbacks.onDownloadPlan?.());

    let previewTimer;
    const preview = () => {
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => callbacks.onPreview?.(this.getSettings()), 160);
    };
    this.elements.prompt.addEventListener('input', preview);
    this.elements.seed.addEventListener('input', preview);
    this.elements.quality.addEventListener('change', preview);
  }

  getSettings() {
    return {
      prompt: this.elements.prompt.value.trim(),
      seed: this.elements.seed.value.trim(),
      quality: this.elements.quality.value,
    };
  }

  setSettings({ prompt, seed, quality }) {
    if (prompt != null) this.elements.prompt.value = prompt;
    if (seed != null) this.elements.seed.value = seed;
    if (quality != null) this.elements.quality.value = quality;
  }

  updatePreview(plan) {
    this.plan = plan;
    this.elements.previewWorldName.textContent = plan.worldName;
    this.elements.previewBiome.textContent = plan.biome;
    this.elements.previewMission.textContent = `${plan.relays.length} relays · ${plan.shards.length} shards`;
    this.elements.previewModel.textContent = `ScenePlan v${plan.version} · ${plan.quality}`;
  }

  setLoading(progress, label, ready = false) {
    const value = clamp(progress, 0, 1);
    this.elements.loadingFill.style.width = `${Math.round(value * 100)}%`;
    this.elements.loadingPercent.textContent = `${Math.round(value * 100)}%`;
    if (label) this.elements.loadingLabel.textContent = label;
    this.elements.enter.disabled = !ready;
  }

  setAssetStatus(diagnostics) {
    const remote = diagnostics?.remote ?? 0;
    const total = diagnostics?.total ?? 0;
    const fallback = Math.max(0, total - remote);
    this.elements.assetStatus.textContent = fallback
      ? `${remote}/${total} CC0 models · ${fallback} procedural fallback${fallback === 1 ? '' : 's'}`
      : `${remote}/${total} CC0 models synchronized`;
  }

  showUnsupported() {
    this.elements.unsupported.classList.remove('hidden');
  }

  showStart() {
    this.elements.start.classList.remove('hidden');
    this.elements.hud.classList.add('hidden');
    this.elements.pause.classList.add('hidden');
    this.elements.map.classList.add('hidden');
    this.elements.complete.classList.add('hidden');
    this.paused = false;
    this.mapOpen = false;
  }

  showGame(plan, world, player) {
    this.plan = plan;
    this.world = world;
    this.player = player;
    this.elements.start.classList.add('hidden');
    this.elements.hud.classList.remove('hidden');
    this.elements.pause.classList.add('hidden');
    this.elements.complete.classList.add('hidden');
    this.elements.worldLabel.textContent = plan.worldName.toUpperCase();
    this.elements.mapWorldName.textContent = plan.worldName;
    this.paused = false;
  }

  showPause(show = true) {
    this.paused = show;
    this.elements.pause.classList.toggle('hidden', !show);
  }

  showMap(show = true) {
    this.mapOpen = show;
    this.elements.map.classList.toggle('hidden', !show);
    if (show) this.drawWorldMap();
  }

  showComplete(world) {
    this.elements.completeWorldName.textContent = `${this.plan.worldName} is stable.`;
    this.elements.completeRelays.textContent = `${world.relaysActivated} / ${this.plan.relays.length}`;
    this.elements.completeShards.textContent = `${world.shardsCollected} / ${this.plan.shards.length}`;
    this.elements.completeWraiths.textContent = String(world.enemiesDefeated);
    this.elements.complete.classList.remove('hidden');
  }

  hideComplete() {
    this.elements.complete.classList.add('hidden');
  }

  openPlan(planJson) {
    this.infoOpen = true;
    this.elements.infoKicker.textContent = 'WORLD MODEL';
    this.elements.infoTitle.textContent = this.plan?.worldName ?? 'ScenePlan';
    this.elements.downloadPlan.classList.remove('hidden');
    const plan = this.plan;
    this.elements.infoContent.innerHTML = `
      <p>This world is generated from a deterministic <strong>ScenePlan</strong>. Terrain, lake placement, relay positions, shards, enemy nests, palette and ambience all derive from the prompt and seed.</p>
      <h3>Prompt</h3><p>${escapeHtml(plan?.prompt ?? '—')}</p>
      <h3>Generation summary</h3>
      <p><strong>${escapeHtml(plan?.biome ?? '—')}</strong> · seed <code>${escapeHtml(plan?.seedText ?? '—')}</code> · ${plan?.relays.length ?? 0} relays · ${plan?.shards.length ?? 0} shards · ${plan?.nests.length ?? 0} wraith nests.</p>
      <h3>ScenePlan JSON preview</h3>
      <pre>${escapeHtml(JSON.stringify(planJson, null, 2).slice(0, 5600))}</pre>`;
    this.elements.info.classList.remove('hidden');
  }

  openCredits(assetDiagnostics = {}) {
    this.infoOpen = true;
    this.elements.infoKicker.textContent = 'CREDITS & LICENSING';
    this.elements.infoTitle.textContent = 'Open assets, original game code';
    this.elements.downloadPlan.classList.add('hidden');
    this.elements.infoContent.innerHTML = `
      <p>The procedural world, shaders, interactions, combat loop, UI and audio synthesis are original code for WorldClaw Lite.</p>
      <h3>3D models</h3>
      <p>Nature Kit and Survival Kit models by <strong>Kenney</strong>, distributed under <strong>CC0 1.0</strong>. Models are loaded from a commit-pinned public GitHub mirror through jsDelivr. Loaded remotely: ${assetDiagnostics.remote ?? 0}/${assetDiagnostics.total ?? 0}.</p>
      <h3>Renderer</h3>
      <p>Three.js is used under the MIT license. Runtime imports are pinned to the project version declared in the source.</p>
      <h3>Resilience</h3>
      <p>Every remote model has a procedural geometry fallback. A failed asset request changes visual fidelity, not game availability.</p>`;
    this.elements.info.classList.remove('hidden');
  }

  closeInfo() {
    this.infoOpen = false;
    this.elements.info.classList.add('hidden');
  }

  toast(message, tone = 'normal', duration = 2600) {
    const element = document.createElement('div');
    element.className = `toast${tone === 'normal' ? '' : ` ${tone}`}`;
    element.textContent = message;
    this.elements.toastStack.appendChild(element);
    window.setTimeout(() => {
      element.style.opacity = '0';
      element.style.transform = 'translateY(-4px) scale(.98)';
      window.setTimeout(() => element.remove(), 220);
    }, duration);
  }

  hitMarker(hit = true) {
    this.elements.crosshair.classList.add('hit');
    if (!hit) this.elements.crosshair.style.opacity = '.58';
    window.setTimeout(() => {
      this.elements.crosshair.classList.remove('hit');
      this.elements.crosshair.style.opacity = '';
    }, 110);
  }

  setInteraction(text, holdProgress = 0) {
    const active = Boolean(text);
    this.elements.interaction.classList.toggle('hidden', !active);
    if (!active) return;
    this.elements.interactionLabel.textContent = text;
    this.elements.interactionFill.style.width = `${clamp(holdProgress, 0, 1) * 100}%`;
  }

  update(playerSnapshot, world, interaction, holdProgress, nearestObjective, timestamp = performance.now()) {
    if (!this.plan || !playerSnapshot || !world) return;
    this.player = playerSnapshot;
    this.world = world;
    const objective = world.getObjective();
    this.elements.objectiveTitle.textContent = objective.title;
    this.elements.objectiveDetail.textContent = objective.detail;
    this.elements.objectiveFill.style.width = `${clamp(objective.progress, 0, 1) * 100}%`;

    this.elements.healthLabel.textContent = String(Math.round(playerSnapshot.health));
    this.elements.healthFill.style.width = `${playerSnapshot.health}%`;
    this.elements.staminaLabel.textContent = String(Math.round(playerSnapshot.stamina));
    this.elements.staminaFill.style.width = `${playerSnapshot.stamina}%`;
    this.elements.lanternStatus.textContent = playerSnapshot.lanternOn ? 'LANTERN ON' : 'LANTERN OFF';
    this.elements.scanStatus.textContent = world.scanCooldown > 0 ? `SCAN ${world.scanCooldown.toFixed(1)}s` : 'SCAN READY';
    this.elements.positionLabel.textContent = `${Math.round(playerSnapshot.position.x)}, ${Math.round(playerSnapshot.position.z)}`;
    this.elements.timeLabel.textContent = formatClock(world.worldTime);
    this.elements.damage.style.opacity = String(playerSnapshot.damageFlash * 0.7);

    if (interaction) this.setInteraction(world.getInteractionText(interaction.item), holdProgress);
    else this.setInteraction('', 0);

    const headingDegrees = ((-playerSnapshot.yaw * 180 / Math.PI) % 360 + 360) % 360;
    this.elements.compassHeading.textContent = `${String(Math.round(headingDegrees)).padStart(3, '0')}° ${directionLabel(headingDegrees)}`;
    if (nearestObjective) {
      const dx = nearestObjective.position.x - playerSnapshot.position.x;
      const dz = nearestObjective.position.z - playerSnapshot.position.z;
      const targetYaw = Math.atan2(-dx, -dz);
      const delta = angleDelta(playerSnapshot.yaw, targetYaw);
      const markerPercent = clamp(50 - delta / Math.PI * 48, 3, 97);
      this.elements.compassMarker.style.left = `${markerPercent}%`;
      const targetDegrees = ((-targetYaw * 180 / Math.PI) % 360 + 360) % 360;
      this.elements.objectiveDistance.textContent = formatDistance(nearestObjective.distance);
      this.elements.objectiveBearing.textContent = `${directionLabel(targetDegrees)} ${Math.round(targetDegrees)}°`;
    } else {
      this.elements.objectiveDistance.textContent = '—';
      this.elements.objectiveBearing.textContent = 'SIGNAL STABLE';
      this.elements.compassMarker.style.left = '50%';
    }

    if (timestamp - this.lastHudDraw > 66) {
      this.drawMinimap(playerSnapshot, nearestObjective);
      if (this.mapOpen) this.drawWorldMap();
      this.lastHudDraw = timestamp;
    }
  }

  drawMinimap(player, nearestObjective = null) {
    const canvas = this.elements.minimap;
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const radius = width * 0.47;
    const range = 240;
    const scale = radius / range;
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width / 2, height / 2);
    context.beginPath();
    context.arc(0, 0, radius, 0, Math.PI * 2);
    context.clip();

    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(20,44,33,.93)');
    gradient.addColorStop(1, 'rgba(5,15,11,.96)');
    context.fillStyle = gradient;
    context.fillRect(-radius, -radius, radius * 2, radius * 2);

    context.strokeStyle = 'rgba(220,245,225,.065)';
    context.lineWidth = 1;
    for (const fraction of [0.33, 0.66, 1]) {
      context.beginPath();
      context.arc(0, 0, radius * fraction, 0, Math.PI * 2);
      context.stroke();
    }
    context.beginPath(); context.moveTo(-radius, 0); context.lineTo(radius, 0); context.stroke();
    context.beginPath(); context.moveTo(0, -radius); context.lineTo(0, radius); context.stroke();

    const point = (x, z) => ({ x: (x - player.position.x) * scale, y: (z - player.position.z) * scale });
    const lake = point(this.plan.lake.x, this.plan.lake.z);
    context.fillStyle = 'rgba(70,151,170,.32)';
    context.beginPath();
    context.ellipse(lake.x, lake.y, this.plan.lake.rx * scale, this.plan.lake.rz * scale, 0, 0, Math.PI * 2);
    context.fill();

    const visible = (p, padding = 8) => Math.hypot(p.x, p.y) < radius - padding;
    const core = point(this.plan.core.x, this.plan.core.z);
    if (visible(core)) drawMarker(context, core.x, core.y, '#b7f57d', 5, true);
    for (const relay of this.world.interactables.filter((item) => item.type === 'relay')) {
      const p = point(relay.position.x, relay.position.z);
      if (visible(p)) drawMarker(context, p.x, p.y, relay.activated ? '#70dfee' : '#596a62', 3.6, true);
    }
    for (const shard of this.world.shards) {
      if (shard.collected) continue;
      const p = point(shard.position.x, shard.position.z);
      if (visible(p)) drawMarker(context, p.x, p.y, '#e7ffff', 2.8);
    }
    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;
      const p = point(enemy.group.position.x, enemy.group.position.z);
      if (visible(p, 3)) drawMarker(context, p.x, p.y, '#ff6f91', 2.2);
    }
    if (nearestObjective) {
      const p = point(nearestObjective.position.x, nearestObjective.position.z);
      if (visible(p)) {
        context.strokeStyle = '#b7f57d';
        context.lineWidth = 1.2;
        context.beginPath();
        context.arc(p.x, p.y, 7, 0, Math.PI * 2);
        context.stroke();
      }
    }

    context.save();
    context.rotate(-player.yaw);
    context.fillStyle = '#fff';
    context.shadowColor = 'rgba(255,255,255,.7)';
    context.shadowBlur = 8;
    context.beginPath();
    context.moveTo(0, -8);
    context.lineTo(-5, 6);
    context.lineTo(0, 3.5);
    context.lineTo(5, 6);
    context.closePath();
    context.fill();
    context.restore();
    context.restore();
  }

  drawWorldMap() {
    if (!this.plan || !this.world || !this.player) return;
    const canvas = this.elements.mapCanvas;
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const padding = 42;
    const mapSize = Math.min(width - padding * 2, height - padding * 2);
    const scale = mapSize / WORLD_SIZE;
    const originX = width / 2;
    const originY = height / 2;
    const mapPoint = (x, z) => ({ x: originX + x * scale, y: originY + z * scale });

    const background = context.createLinearGradient(0, 0, width, height);
    background.addColorStop(0, '#0f2a20');
    background.addColorStop(1, '#07130f');
    context.fillStyle = background;
    context.fillRect(0, 0, width, height);

    context.save();
    context.beginPath();
    context.rect(originX - mapSize / 2, originY - mapSize / 2, mapSize, mapSize);
    context.clip();
    for (let y = -WORLD_HALF; y <= WORLD_HALF; y += 46) {
      for (let x = -WORLD_HALF; x <= WORLD_HALF; x += 46) {
        const elevation = this.plan.heightAt(x, y);
        const normalized = clamp((elevation + 25) / 100, 0, 1);
        context.fillStyle = `rgba(${Math.round(30 + normalized * 50)}, ${Math.round(69 + normalized * 52)}, ${Math.round(45 + normalized * 32)}, .34)`;
        const p = mapPoint(x, y);
        context.fillRect(p.x - 23 * scale, p.y - 23 * scale, 47 * scale, 47 * scale);
      }
    }

    const lake = mapPoint(this.plan.lake.x, this.plan.lake.z);
    context.fillStyle = 'rgba(54,139,163,.66)';
    context.beginPath();
    context.ellipse(lake.x, lake.y, this.plan.lake.rx * scale, this.plan.lake.rz * scale, 0, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(220,245,225,.08)';
    context.lineWidth = 1;
    for (let coordinate = -WORLD_HALF; coordinate <= WORLD_HALF; coordinate += 115) {
      const a = mapPoint(coordinate, -WORLD_HALF);
      const b = mapPoint(coordinate, WORLD_HALF);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      const c = mapPoint(-WORLD_HALF, coordinate);
      const d = mapPoint(WORLD_HALF, coordinate);
      context.beginPath(); context.moveTo(c.x, c.y); context.lineTo(d.x, d.y); context.stroke();
    }

    const core = mapPoint(this.plan.core.x, this.plan.core.z);
    drawMarker(context, core.x, core.y, '#b7f57d', 8, true);
    for (const relay of this.world.interactables.filter((item) => item.type === 'relay')) {
      const p = mapPoint(relay.position.x, relay.position.z);
      drawMarker(context, p.x, p.y, relay.activated ? '#70dfee' : '#61736a', 6, true);
    }
    for (const shard of this.world.shards) {
      if (shard.collected) continue;
      const p = mapPoint(shard.position.x, shard.position.z);
      drawMarker(context, p.x, p.y, '#e7ffff', 4);
    }
    for (const enemy of this.world.enemies) {
      if (!enemy.alive) continue;
      const p = mapPoint(enemy.group.position.x, enemy.group.position.z);
      drawMarker(context, p.x, p.y, '#ff6f91', 3.3);
    }
    const player = mapPoint(this.player.position.x, this.player.position.z);
    context.save();
    context.translate(player.x, player.y);
    context.rotate(-this.player.yaw);
    context.fillStyle = '#fff';
    context.beginPath(); context.moveTo(0, -10); context.lineTo(-6, 7); context.lineTo(0, 4); context.lineTo(6, 7); context.closePath(); context.fill();
    context.restore();
    context.restore();

    context.strokeStyle = 'rgba(225,248,232,.18)';
    context.lineWidth = 1;
    context.strokeRect(originX - mapSize / 2, originY - mapSize / 2, mapSize, mapSize);
  }
}
