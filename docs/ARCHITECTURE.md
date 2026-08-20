# Architecture

## Pipeline

```text
Prompt + seed + quality
          ↓
createWorldPlan()
          ↓
Serializable ScenePlan
          ↓
World.build()
  ├─ terrain mesh + vertex colors
  ├─ water and atmosphere shaders
  ├─ instanced CC0 vegetation and rocks
  ├─ core, relays, camp and ruins
  ├─ shards and wraith nests
  └─ collision and interaction indices
          ↓
PlayerController + mission state + HUD
```

## Modules

- `config.js` — renderer version, asset manifest, quality presets and palettes.
- `world-model.js` — deterministic prompt/seed-to-ScenePlan compiler.
- `assets.js` — commit-pinned glTF loading, material tuning, instancing and procedural fallbacks.
- `world.js` — scene construction, lighting, simulation, objectives, combat and effects.
- `player.js` — first-person controller, collision, stamina, health, weapon and lantern.
- `audio.js` — procedural Web Audio ambience and effects.
- `ui.js` — console, HUD, minimap, world map and modals.
- `main.js` — lifecycle, renderer lifecycle and application orchestration.

## Design constraints

- Static-host compatible; no backend is required.
- Deterministic worlds for the same prompt and seed.
- The generated plan remains serializable and downloadable.
- Remote assets are optional at runtime.
- Both cinematic and balanced quality presets are supported.
