# WorldClaw Lite — Echo Frontier

A polished, browser-playable low-poly open-world game generated from a deterministic **ScenePlan**.

WorldClaw Lite is inspired by the world-planning direction described by WorldClaw, but it is an independent implementation. A prompt and seed are compiled into a serializable world model that controls terrain, palette, lake shape, landmarks, objectives, enemies, and ambience.

## Game loop

1. Describe a world and choose a deterministic seed.
2. Explore a 920 × 920 metre procedural valley.
3. Activate three ancient signal relays.
4. Recover the scattered echo shards.
5. Defend yourself from signal wraiths.
6. Return to the World Core and synchronize the restored world signal.

## Features

- Prompt + seed → deterministic ScenePlan
- Procedural terrain with vertex-colour biomes and flattened landmark zones
- Dynamic sky, stars, clouds, fog, water shader, and day/night lighting
- CC0 Kenney trees, rocks, signs, fences, and camp props
- Procedural fallback models for every remote asset
- First-person movement, sprinting, jumping, slope handling, and water wading
- Signal Caster combat, enemy AI, health, and respawn
- Resonance scan, objective compass, minimap, and full world map
- Relays, shards, ruins, expedition camp, and final World Core objective
- Procedural Web Audio ambience and effects
- Cinematic and balanced quality presets
- Downloadable ScenePlan JSON
- Static hosting; no backend or API key required

## Controls

| Input | Action |
|---|---|
| `WASD` | Move |
| `Shift` | Sprint |
| `Space` | Jump |
| Mouse | Look |
| Left click | Fire Signal Caster |
| `Q` or right click | Resonance scan |
| Hold `E` | Activate relay / World Core |
| `F` | Toggle lantern |
| `M` | World map |
| `R` | Respawn at camp |
| `Esc` | Release pointer / pause |

## Run locally

The project has no install step:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

Run all repository checks:

```bash
npm run verify
```

## Architecture

```text
Prompt + seed + quality
          ↓
createWorldPlan()
          ↓
Serializable ScenePlan
          ↓
World.build()
  ├─ terrain, water, and atmosphere
  ├─ instanced vegetation and rocks
  ├─ core, relays, camp, and ruins
  ├─ shards and wraith nests
  └─ collision and interaction indices
          ↓
PlayerController + simulation + HUD
```

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for module-level detail.

## Source layout

```text
worldclaw-lite/
├── index.html
├── styles.css
├── src/
│   ├── config.js
│   ├── math.js
│   ├── assets.js
│   ├── audio.js
│   ├── world-model.js
│   ├── world.js
│   ├── player.js
│   ├── ui.js
│   └── main.js
├── tests/
├── scripts/qa.mjs
├── docs/ARCHITECTURE.md
├── ASSET_LICENSES.md
├── LICENSE
└── vercel.json
```

## Assets and licensing

Original game code is MIT licensed. The remotely loaded Kenney Nature Kit and Survival Kit models are CC0. Three.js is MIT licensed. Exact sources, pinned commits, and fallback behaviour are documented in [`ASSET_LICENSES.md`](ASSET_LICENSES.md).

## Scope

This is a lightweight world-model game, not a reproduction of Tencent Hunyuan's unreleased WorldClaw code or model weights. The current planner is deterministic and local; it can later be replaced by an LLM or external world-generation service without replacing the renderer and gameplay layer.
