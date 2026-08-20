# WorldClaw Lite

A tiny, zero-dependency browser prototype inspired by the **agentic world-planning** idea in WorldClaw.

This repository intentionally does **not** attempt to reproduce Tencent Hunyuan's unreleased implementation. Instead, it turns a compact deterministic "world plan" into a playable low-poly open world using only WebGL 2 and browser APIs.

## What is playable

- First-person mouse look with Pointer Lock
- WASD movement, sprinting, jumping
- ~760 × 760 unit procedural terrain
- Procedural low-poly forest, rocks, lake and ruins
- Deterministic world seed
- 8 collectible signal crystals distributed across the world
- Return-to-altar completion objective
- Day/night lighting and distance fog
- Live minimap, coordinates and mission HUD
- No external runtime dependencies

## Run locally

Any static web server works:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Deploy

The project is static and can be deployed directly to Vercel, GitHub Pages, Cloudflare Pages, Netlify, or any static host.

## Project structure

```text
worldclaw-lite/
├── index.html
├── styles.css
├── src/
│   ├── core.js
│   ├── graphics.js
│   ├── world.js
│   ├── game.js
│   └── render.js
├── package.json
├── vercel.json
└── README.md
```

## WorldClaw-style extension path

The current world is generated from a deterministic seed plus a hand-authored high-level plan:

```text
Prompt / Seed
    ↓
World Plan
    ↓
Terrain + Landmarks + Object Placement
    ↓
Playable World
```

A future version can replace the deterministic planner with an LLM that emits a `ScenePlan` JSON object while keeping the renderer/game loop unchanged.

## Controls

- **WASD** — move
- **Shift** — sprint
- **Space** — jump
- **Mouse** — look
- **Esc** — release mouse / pause

## Credits

The interaction model follows standard first-person WebGL/Pointer Lock conventions. All game code in this repository is original implementation for this prototype.
