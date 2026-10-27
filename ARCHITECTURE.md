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
│   ├── 1d-mode.js            1-D environment (stub)
│   ├── 2d-mode.js            2-D environment (stub)
│   ├── 3d-mode.js            3-D environment: scene, input, picking, render loop
│   ├── toggle.js             RGB/HSL toggle (shows/hides axis options)
│   ├── dropdown.js           Named-color search (fuzzy autocomplete)
│   ├── harmony.js            Harmony math + swatch rendering
│   ├── categories.js         Collapsible harmony rows
│   ├── help.js               ? button popover listing controls and tools
│   ├── LoaderManager.js      Loading overlay, progress bar, ETA
│   ├── color-utils.js        Color math: HSL→RGB, gamma, cube/sphere color mapping, mini shaders
│   └── utils.js              clamp, lerp
│
└── src/3d/                   ── 3-D engine ──
    ├── sharedRenderer.js     Singleton WebGLRenderer + PerspectiveCamera
    ├── TextureRegistry.js    Per-shape cache factory: getCaches(type) → [TextureCache, ShaderCache]
    ├── Caches/
    │   ├── LRUCache.js       Base LRU (Map insertion order) with dispose-on-evict
    │   ├── WorkerCache.js    Raw pixel buffers; drives the Web Worker
    │   ├── TextureCache.js   THREE.DataTexture per (layer, colorSpace, face)
    │   └── ShaderCache.js    Blended materials per layer pair (currently unused)
    ├── Textures/
    │   ├── worker-texture.js Web Worker entry: generates pixel buffers
    │   └── thread-texture.js Main-thread fallback generator
    ├── FaderTextures/
    │   ├── layerMaterial.js  Builds the layer-fade ShaderMaterial
    │   └── shaders/          layerFade.vert / layerFade.frag
    ├── Main/                 The large interactive object
    ├── Preview/              Translucent "what layer N looks like" object
    └── Mini/                 Bottom-right orientation gizmo

public/named_colors.csv       ~4,000 named colors (name, hex, r, g, b)
resources/colorTable.py       Scraper that produced the CSV (offline tool)
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

**Registry:** `TextureRegistry.getCaches(type)` memoizes one cache pair per shape, so switching cube → sphere → cube reuses the cube's warm cache.

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

- **`harmony.js`** converts the base color to HSL and generates harmonies by hue rotation (180°, ±150°, ±120°, 90° steps, ±20/40°). Tints, shades, and tones step lightness/saturation in 20% increments.
- **`dropdown.js`** loads the CSV and ranks matches with a tiered scoring function (exact → prefix → word-prefix → all tokens → substring → normalized Levenshtein < 0.4). It also shows ghost-text completion and supports keyboard navigation.
- **`toggle.js`** shows or hides the RGB vs HSL axis options in the 1-D/2-D selectors. `3d-mode.js` listens to the same checkbox to trigger the color-space cross-fade.

---

## 7. Design Decisions

| Decision | Why |
|----------|-----|
| CPU-generated textures instead of computing color in the fragment shader | Keeps the color math in one testable JS module, makes picking a simple array lookup, and lets the same buffers feed future 1-D/2-D views |
| Web Worker generation | Layer 0 on a cube is 6 × 256² ≈ 393k pixels. Generating that on the main thread caused visible jank |
| Two-tier cache (buffers vs GPU textures) | Buffers are cheap to keep around; GPU textures are more expensive. Separate LRU limits allow tuning each independently |
| Shared renderer/camera singleton | Avoids creating multiple WebGL contexts when switching shapes (browsers cap the number of contexts) |
| Base-class families (Main/Preview/Mini) | Adding a new shape means writing geometry plus a couple of hooks, not re-implementing input, physics, and animation |

---

## 8. Known Issues / Tech Debt

| Area | Issue |
|------|-------|
| Three.js version | `index.html` loads **r128** from CDN as a global, but the code uses `THREE.SRGBColorSpace` / `outputColorSpace`, which were added in r152. Those assignments are currently no-ops. The npm `three@0.181` dependency is installed but not imported |
| `ShaderCache` | Instantiated per shape but never read. Main objects build their materials directly |
| Stubs | `1d-mode.js` and `2d-mode.js` return empty environments |
