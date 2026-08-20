# Third-party assets and licenses

WorldClaw Lite contains original source code and loads selected third-party models at runtime. Third-party assets retain their own licenses.

## Kenney Nature Kit 2.1

**Creator/distributor:** Kenney  
**License:** Creative Commons Zero 1.0 Universal (CC0 1.0)  
**Official pack:** https://kenney.nl/assets/nature-kit  
**License deed:** https://creativecommons.org/publicdomain/zero/1.0/

Models used:

- `tree_default.glb`
- `tree_oak.glb`
- `rock_largeA.glb`
- `rock_smallA.glb`
- `sign.glb`
- `fence_simple.glb`
- `fence_gate.glb`

## Kenney Survival Kit 2.0

**Creator/distributor:** Kenney  
**License:** Creative Commons Zero 1.0 Universal (CC0 1.0)  
**Official pack:** https://kenney.nl/assets/survival-kit  
**License deed:** https://creativecommons.org/publicdomain/zero/1.0/

Models used:

- `barrel.glb`
- `barrel-open.glb`
- `signpost.glb`

## Runtime source and pinning

To keep the repository compact, the GLB files are fetched through jsDelivr from a public GitHub mirror at this immutable commit:

```text
repository: rajsinghtech/spurfire
commit:     8792fe1404eabd93ff12dd0726460da5db648b02
path:       game/assets/kenney/
```

The source repository includes the original Kenney license files beside each pack. Every remote model has an original procedural fallback implemented in `src/assets.js`; a failed remote request reduces visual detail but does not prevent play.

## Three.js

**Project:** Three.js  
**Runtime version:** 0.184.0  
**License:** MIT  
**Source:** https://github.com/mrdoob/three.js

Three.js is loaded as an ES module from a version-pinned jsDelivr URL.
