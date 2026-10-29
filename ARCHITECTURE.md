# Architecture — ColorVerse

This document describes how ColorVerse is structured, how data flows from user input to pixels on screen, and where the known rough edges are. For setup and features, see [README.md](README.md). For change history, see [DEVLOG.md](DEVLOG.md).

---

## 1. High-Level Layout

```
index.html           UI shell: controls (left), color info + harmonies, canvas (right)
main.js              Bootstrap: wires toggle, dimension selector, search, harmony rows
│
├── src/                      ── App / UI layer ──
│   ├── dimension.js          Dimension + shape selector; owns the active visualization
│   ├── 3d-mode.js            3-D environment: scene, input, picking, render loop
│   ├── toggle.js             RGB/HSL toggle (shows/hides axis options)
│   ├── dropdown.js           Named-color search (fuzzy autocomplete)
│   ├── harmony.js            Swatch rendering, base-color selection, basecolorchange events
│   ├── harmonyMath.js        Harmony formulas (no DOM, so the golf solver can use them)
│   ├── categories.js         Collapsible harmony rows
│   ├── help.js               ? button popover listing controls and tools
│   ├── sliders.js            HSL/RGB sliders in the details card; follow the toggle
│   ├── welcome.js            First-visit welcome modal + spotlight tour (localStorage flag)
│   ├── LoaderManager.js      Loading overlay, progress bar, ETA
│   ├── three-setup.js        Three.js (npm, r181) configured once; every module imports THREE from here
│   ├── color-utils.js        Color math: HSL→RGB, gamma, cube/sphere color mapping (no Three.js: the texture worker imports it)
│   └── utils.js              clamp, lerp
│
├── src/golf/                 ── Color Golf (v1.1+) ──
│   ├── clubs.js              Every move a stroke can make (harmony rows + putter), wind drift, HSL packing
│   ├── oklab.js              OKLab distance; in the hole / lip-out thresholds
│   ├── hazards.js            Sand and water regions, cached "which hazard is this color in"
│   ├── solver.js             Breadth-first par solver over ≈3.7M whole-number HSL states
│   ├── solver-worker.js      Perfect route for the end-of-hole replay, off the main thread
│   ├── holeMaker.js          Builds one hole (tee, target, hazards, wind) from seeded random sequences
│   ├── practice.js           One practice hole from a seed + settings (worker and pool generator)
│   ├── practice-worker.js    Random practice holes, built off the main thread
│   ├── daily.js              Daily hole rotation by weekday, dates, streaks
│   ├── game.js               A round: strokes, penalties, undo, pick-up, score card
│   ├── golf-ui.js            Game screen: daily / practice / course picker, Pro, panel, cards, replay
│   ├── map.js                Where a color sits on the shape; hazard footprints per layer
│   ├── mapView.js            Ball, flag, trails, hazard patches and icons on the 3-D shape
│   ├── mapState.js           Shared game → 3-D view state
│   ├── courses.json          Generated courses (npm run courses)
│   ├── daily.json            Generated daily holes to 2028-12-31 (npm run daily); loaded on first use
│   └── practice.json         Practice starter pool, 6 holes per setting (npm run practice)
│
└── src/3d/                   ── 3-D engine ──
    ├── sharedRenderer.js     Singleton WebGLRenderer + PerspectiveCamera
    ├── TextureRegistry.js    Per-shape cache factory: getTextureCache(type)
    ├── Caches/
    │   ├── LRUCache.js       Base LRU (Map insertion order) with dispose-on-evict
    │   ├── WorkerCache.js    Raw pixel buffers; drives the Web Worker
    │   ├── TextureCache.js   THREE.DataTexture per (layer, colorSpace, face)
    ├── Textures/
    │   ├── worker-texture.js Web Worker entry: generates pixel buffers
    │   └── thread-texture.js Main-thread fallback generator
    ├── FaderTextures/
    │   ├── layerMaterial.js  Builds the layer-fade ShaderMaterial
    │   └── shaders/          layerFade.vert / layerFade.frag
    ├── Main/                 The large interactive object
    ├── Preview/              Translucent "what layer N looks like" object
    └── Mini/                 Bottom-right orientation gizmo

public/named_colors.csv       ~3,200 named colors (name, hex, r, g, b)
resources/colorTable.py       Scraper that produced the CSV (offline tool)
resources/generateCourses.mjs Color Golf course generator (seeded; npm run courses)
resources/generateDaily.mjs   Daily hole generator (one seed per date, parallel; npm run daily [-- --until YYYY-MM-DD])
resources/generatePractice.mjs Practice starter pool generator (parallel; npm run practice)
archive/smartCube.js          Pre-refactor monolithic cube (reference only, not imported)
```

---

## 2. Dimension Routing

`dimension.js` is the top-level switch. It owns a single `currentVisual` and swaps it on change:

| Dimension | Shape value(s) | Factory |
|-----------|----------------|---------|
| 1-D | `line` | `create1DEnvironment()` |
| 2-D | `square`, `circle` | `create2DEnvironment(type)` |
| 3-D | `cube`, `sphere` | `create3DEnvironment(type)` |

Each factory returns an environment object (`{ renderer, scene, camera, dispose }` for 3-D). Before a switch, the previous environment's `dispose()` is called. `main.js` boots into `defaultVisualization("sphere")`.

This is what makes the project *multi-dimensional*: every dimension is a pluggable environment behind the same selector, and all of them share the RGB/HSL toggle, color picking → harmony panel, and search.

---

## 3. The Color Model

### 3.1 Layers as nested shells

The 3-D solid is split into 128 concentric shells. For layer `N`:

```
size = 256 − 2N              texture resolution (px per side)
min  = N / 255               lowest channel value on this shell
max  = (N + size − 1) / 255  highest channel value on this shell
t    = N / 127               normalized depth (0 = surface, 1 = core)
```

Layer 0 is the full gamut surface (256×256). Layer 127 is a 2×2 near-gray core. Smaller inner shells mean less work: deeper layers are cheaper to generate.

### 3.2 Mapping functions (`color-utils.js`)

**`computeCubeColor(x, y, layer, face, colorSpace, size)`**
- **RGB:** each face has an x-channel, a y-channel, and a fixed channel pinned to `min` or `max`. Six faces = the six faces of the RGB cube, inset to that shell.
- **HSL:** the four side faces each cover a 90° hue band (narrowing by up to 45° per side as `t → 1`) × lightness; saturation = `1 − t`. Top/bottom faces are polar: angle → hue, radius → saturation, lightness fixed at `max`/`min`.

**`computeSphereColor(x, y, layer, colorSpace, size)`**
- Equal-area lat/long unwrap: `(u, v) → (θ, φ) → unit vector (nx, ny, nz)`.
- **RGB:** `(nx, ny, nz)` remapped into `[min, max]` → `(r, g, b)`.
- **HSL:** `atan2(nz, nx)` → hue, `√(nx² + nz²) · (1 − t)` → saturation, `ny` → lightness.

---

## 4. Texture Pipeline

```
MainCube.updateLayer(layerFloat)
   │  z0 = floor(layerFloat), z1 = z0 + 1, t = fract
   ▼
TextureCache.getOrCreate(colorSpace, layer)          ← LRU, max 256 entries
   │  hit  → { layer, textures: { RGB: [...faces], HSL: [...faces] } }
   │  miss ↓  (de-duplicated via `pending` map)
   ▼
WorkerCache.getOrCreate(colorSpace, layer)           ← LRU, max 180 entries
   │  hit  → [{ data: ArrayBuffer, width, height }, ...per face]
   │  miss ↓  (de-duplicated via `inflight` map)
   ▼
Web Worker (worker-texture.js)                       ← or thread-texture.js fallback
   │  postMessage { id, colorSpace, layer, type }
   │  ← { id, type: "progress", loaded, total }       (throttled, ~every 1% / 1000 px)
   │  ← { id, type: "completed", buffers }
   ▼
TextureCache.makeTexture(buffer) → THREE.DataTexture (RGBA8, linear filtering)
```

**Loading strategy**

- **Preload on startup:** `TextureCache.preload()` → `WorkerCache.preload()` loads a fixed set of anchor layers (`0, 1, 2, 10, 32, 50, 64, 96, 100, 117, 125, 126, 127`) for both color spaces.
- **Extremes-first ordering:** layer 127 (the starting view) loads first, then the order alternates min/max inward so the user can see the full range early.
- **Batching:** layers load in batches of 3, scheduled with `requestIdleCallback` when it's available.
- **Neighbor prefetch:** after any generation, `±prefetchRange` (default 2) neighboring layers are queued.
- **Progress:** pixel-weighted progress flows up to `LoaderManager`, which renders a bar and ETA.

**Registry:** `TextureRegistry.getTextureCache(type)` memoizes one texture cache per shape, so switching cube → sphere → cube reuses the cube's warm cache.

---

## 5. Rendering

### 5.1 Object families

All three families use the template-method pattern: a base class with shared behavior and abstract hooks, plus a Cube and a Sphere subclass.

| Family | Base responsibilities | Subclass responsibilities |
|--------|----------------------|---------------------------|
| **Main** (`MainBase`) | Mouse/keyboard input, velocity + friction rotation, eased quaternion face-snap, exponential layer smoothing (`layerFloat → layerTarget`), reset animation | `initObject`, `updateLayer`, `switchColorSpace`, face map/quaternions |
| **Preview** (`PreviewBase`) | Show/hide, rotation sync with Main, short blend on layer change | Geometry + per-layer material |
| **Mini** (`MiniBase`) | Separate scene drawn into a corner viewport, axis arrows, idle fade-in/out, picked-color highlight direction | Geometry (cube/sphere) |

The Mini object doesn't use the texture pipeline. Its colors are computed analytically in fragment shaders (`makeRGBMat` / `makeHSLMat` in `color-utils.js`).

### 5.2 Layer cross-fade shader

Every Main/Preview face uses one `ShaderMaterial` from `createLayerFadeMaterial(texA, texB, mixFactor, …)`:

- Samples `texA` and `texB`, converts both to linear, mixes them by `mixFactor`, then converts back to sRGB.
- Optional Blinn-Phong lighting (ambient 0.3 + diffuse + specular × `uShine`).
- Optional pick highlight around `uHighlightUV`.

The same material handles both kinds of transition by swapping uniforms (no material rebuilds):

- **Between layers:** `texA = layer z0`, `texB = layer z0+1`, `mixFactor = fract(layerFloat)`.
- **Between color spaces:** `texA = RGB`, `texB = HSL` (same layer), `mixFactor` animated 0 → 1 over 500 ms.

### 5.3 Frame loop (`3d-mode.js`)

```
requestAnimationFrame(update)
  mainObject.update()            physics, layer lerp, auto-rotation
  previewObject.syncRotation()
  renderer.render(scene, camera)
  miniObject.updateRotation() → tickFade() → renderMiniObject()   (scissored corner viewport)
```

### 5.4 Color picking

1. Click → NDC coordinates → `Raycaster` against the cube's planes or the sphere mesh.
2. The hit UV is used to index directly into `texB`'s `DataTexture.image.data`. No GPU readback is needed.
3. The resulting `THREE.Color` is passed to `harmony.setBaseColors()`, which updates the hex/RGB/HSL readout and all harmony swatches.
4. The color's direction (RGB vector or HSL cylindrical vector) is sent to the Mini object as a highlight.

---

## 6. UI Modules

- **`harmony.js`** converts the base color to HSL and generates harmonies by hue rotation (180°, ±150°, ±120°, 90° steps, ±20/40°). Tints, shades, tones, and saturate step lightness/saturation in 20% increments. Saturate is the only harmony that raises saturation, so without it a muted color can't reach a vivid one.
- **`dropdown.js`** loads the CSV and ranks matches with a tiered scoring function (exact → prefix → word-prefix → all tokens → substring → normalized Levenshtein < 0.4). It also shows ghost-text completion and supports keyboard navigation.
- **Search / details panel:** one at a time, driven by CSS: `#base-color.show` hides `#color-search` via `:has()`. `harmony.clearBaseColor()` is the single "go back" path used by the `← Search` button, `Esc`, and clicks on empty canvas. Esc has a priority order: the help panel (capture-phase listener) → the focused text box (stops propagation) → back to search.
- **`welcome.js`** shows the welcome once per browser (`localStorage` key `colorverse.welcomed`, wrapped in try/catch so blocked storage just means it shows again). The tour positions a spotlight box over each target's bounding rect (a huge `box-shadow` dims everything else) and places the card beside it. A capture-phase keydown listener keeps keys from reaching the 3-D shortcuts while the welcome or tour is open.
- **`sliders.js`** listens for the `basecolorchange` / `basecolorclear` events that `harmony.js` dispatches, so it stays in sync with canvas picks, search, and swatches without importing them. Updates it makes itself are tagged `source: "slider"` and don't overwrite its values, so hue doesn't snap to 0 when saturation hits 0.
- **`toggle.js`** shows or hides the RGB vs HSL axis options in the 1-D/2-D selectors. `3d-mode.js` listens to the same checkbox to trigger the color-space cross-fade.

---

## 7. Color Golf

Get from a tee color to a target color in as few strokes as possible; the harmony rows are clubs.

- **State is whole-number HSL** (h 0–359, s and l 0–100), the values the swatches show. Every stroke rounds, so the game and the solver can never disagree about where a stroke lands, and the whole state space (≈3.7M) fits in typed arrays.
- **Solver** (`solver.js`): breadth-first search from the tee over all 41 clubs (10 harmony rows + putter). Perfect = fewest strokes to land within OKLab 0.02 of the target. Hazards and wind keep it exact because they depend only on the current color: water landings are skipped (always 2 wasted strokes), sand allows wedges only, wind is a fixed drift per hole.
- **Courses** are generated offline (`resources/generateCourses.mjs`, seeded) into `courses.json`: hole length follows par (yards = OKLab distance × 1000), difficulty is the *birdie line* (first shots that keep perfect reachable), and hazards and wind are placed from separate seeded sequences and kept only if every check still passes (perfect unchanged or +1 on a layup hole, finishable within par avoiding hazards, birdie line in range).
- **Hole building** (`holeMaker.js`) is shared by both generators and the practice worker, so every hole, wherever it's made, passes the same checks.
- **Daily hole** (v1.3): built ahead of time into `daily.json`, one hole per date from its own seed (`daily.js` holds the weekly rotation), so it's identical in every browser and the list can be extended without changing past days. One scored try: the first stroke saves a pick-up that finishing replaces. Results and streaks are in `localStorage`.
- **Practice** (v1.3): the first hole comes from the pre-built pool in `practice.json`; later ones are built in `practice-worker.js` (0.5 s to ~30 s for Expert with lakes) while the current one is played. A newer request restarts the worker instead of queueing.
- **Pro** (v1.3): `body.golf-pro` blanks the swatches and shows each club's label (`data-club`); Pro bests are stored separately.
- **Expert** (v1.3): always Pro, yardage hidden until the green, Expert par (`expertPerfect`). Holes store their perfect line (`lines`). Regenerated courses carry `rev`; bests from an older revision are ignored.
- **Named-wedge bunkers** (v1.4): an Expert bunker carries `wedge`; `hazardMap.allows(hsl, club)` is the one rule the round, the solver and the generator all use.
- **Peel** (v1.4): `MainBase.peelTo(layer)` jumps straight to a layer and animates a see-through copy of the shell (built by each shape's `_shellParts`, sharing its geometry) lifting off or settling on. Golf strokes and typed layers use it; scroll and `]` / `[` keep setting `layerTarget` for the cross-fade.
- **Solver speed**: `parFor` caches each search's OKLab colors; `reachesWithin` answers yes/no reach checks with an early exit and one reused scratch table. Both give exactly the answers of a full search, so generated holes don't change.
- **Map** (`map.js`, `mapView.js`): markers are placed by searching the same functions that draw the textures, so they match what's drawn. Hazard footprints are traced on the layer being viewed (the layer's colors inside the hazard), so the ball is inside a patch exactly when it's in that hazard.
- **Game ↔ view**: the game screen never touches Three.js objects; it sets `mapState`, and `3d-mode.js` hands that to `GolfMapView`. A rebuilt or still-loading view reads the current state on creation.

---

## 8. Design Decisions

| Decision | Why |
|----------|-----|
| CPU-generated textures instead of computing color in the fragment shader | Keeps the color math in one testable JS module, makes picking a simple array lookup, and lets the same buffers feed future 1-D/2-D views |
| Web Worker generation | Layer 0 on a cube is 6 × 256² ≈ 393k pixels. Generating that on the main thread caused visible jank |
| Two-tier cache (buffers vs GPU textures) | Buffers are cheap to keep around; GPU textures are more expensive. Separate LRU limits allow tuning each independently |
| Shared renderer/camera singleton | Avoids creating multiple WebGL contexts when switching shapes (browsers cap the number of contexts) |
| Base-class families (Main/Preview/Mini) | Adding a new shape means writing geometry plus a couple of hooks, not re-implementing input, physics, and animation |
| Daily holes pre-built, not generated in the browser | Browsers may round `Math.cbrt`/`Math.pow` differently, which could change a borderline hole; a shipped list is identical everywhere, instant, and checkable by a future score server |
| Golf courses generated offline | Generation runs the solver thousands of times (minutes); shipping a seeded JSON makes courses instant and identical for everyone |
| Golf map markers found by search, not inverse formulas | One search over the texture functions works for every shape and color space, and can't drift from what's drawn |

---

## 9. Known Issues / Tech Debt

| Area | Issue |
|------|-------|
| Color management | Three.js's automatic sRGB ↔ linear conversion is switched off (`three-setup.js`) and the renderer writes pixels as-is, matching r128: the shaders convert colors themselves and sprites must show exact CSS colors. New built-in materials or textures follow the same rule (no `colorSpace` flags) |
| RGB sphere | It sits inside the RGB cube, so the most vivid colors aren't on any layer. Color Golf avoids it by switching the map to HSL during a game (v1.2.1) |
