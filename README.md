# ColorVerse

> A multi-dimensional color space visualizer — explore the color wheel as a 1-D line, a 2-D plane, or a 3-D solid you can rotate and peel apart layer by layer.

---

## What Is This?

Most color tools flatten color into a 2D wheel or a picker. But color is inherently **multi-dimensional**: RGB has three independent channels, and HSL has hue, saturation, and lightness. ColorVerse lets you view the same color space at different dimensionalities and see how they relate:

| Dimension | Shapes | What you see |
|-----------|--------|--------------|
| **1-D** | Line | A single channel (R, G, B or H, S, L) swept from min to max |
| **2-D** | Square, Circle | Two channels plotted against each other on selectable X/Y axes |
| **3-D** | Cube, Sphere | The full color space as a solid object you can rotate, zoom, and step through |

Each view can be rendered in either **RGB** or **HSL**, toggled from the UI.

> **Status:** **v1 is the 3-D mode**, which is fully functional. 1-D and 2-D are planned as future updates; their UI controls and routing are in place but their renderers are not yet implemented. See [Roadmap](#current-status--roadmap) and [MVP.md](MVP.md).

---

## Core Concept (3-D Mode)

The 3-D color solid is built from **128 nested layers** (shells), like the rings of an onion:

- **Layer 0** is the outer surface, covering the full channel range (0–255).
- Each layer inward trims one step off both ends of the range: layer *N* covers values *N* … *255 − N*, at a texture resolution of *(256 − 2N)* px.
- **Layer 127** is the core, a near-neutral gray.

Stepping through layers peels the solid inward or outward. Transitions between layers are smoothly cross-faded on the GPU.

**Two color spaces × two shapes:**

| Shape | RGB | HSL |
|-------|-----|-----|
| Cube | Each face plots two channels with the third fixed at that layer's min or max (e.g. front = R×G at B=min) | 4 side faces each span 90° of hue × lightness; top/bottom are polar discs (hue = angle, saturation = radius) |
| Sphere | Surface direction (x, y, z) maps directly to (R, G, B) | Azimuth → hue, horizontal radius → saturation, height → lightness |

In HSL, saturation also decreases toward the core, so inner layers converge on gray.

---

## Features

- **Dimension selector**: switch between dimensional views (3-D in v1; 1-D/2-D planned)
- **RGB ↔ HSL toggle**: animated cross-fade between color spaces on the 3-D object
- **3-D Cube & Sphere**: both shapes support RGB and HSL
- **128 nested layers**: navigate with `[` / `]` or type a layer number
- **Layer preview**: typing a layer number shows a translucent, enlarged preview of that layer before you commit with `Enter`
- **Face snapping**: press `1`–`6` to snap to a face/axis with eased quaternion rotation
- **Physics-based rotation**: mouse drag and arrow keys with velocity and friction
- **Color picking**: click any point on the object to read its color via raycasting
- **Color harmonies**: complementary, split-complementary, triadic, tetradic, double-complementary, analogous, tints, shades, and tones
- **Color search**: fuzzy autocomplete (Levenshtein distance) over ~4,000 named colors
- **Mini orientation viewport**: a small axis-gizmo object (bottom-right) that mirrors rotation, highlights the picked color's direction, and fades out when idle
- **Progressive loading**: textures generate in a Web Worker with a progress bar and ETA

---

## Tech Stack

- **JavaScript (ES modules)**: no framework
- **[Three.js](https://threejs.org/)**: 3D rendering (currently loaded as a global from CDN r128 in `index.html`)
- **WebGL / GLSL**: custom shaders for layer cross-fading, Blinn-Phong lighting, and pick highlights
- **Web Workers**: off-main-thread pixel generation, with a main-thread fallback
- **Vite**: dev server and build tool
- **Python** (`resources/colorTable.py`): one-off scraper used to build `public/named_colors.csv`

---

## Architecture Overview

```
main.js
  └─ dimension.js  ──► 1d-mode.js (stub) / 2d-mode.js (stub) / 3d-mode.js
                                                        │
                       ┌────────────────────────────────┼─────────────────────┐
                       ▼                                ▼                     ▼
                MainCube / MainSphere          PreviewCube / Sphere     MiniCube / Sphere
                       │                                │
                       └──────────► TextureCache (THREE.DataTexture, LRU)
                                         │
                                    WorkerCache (pixel buffers, LRU)
                                         │
                                    worker-texture.js ──► color-utils.js
                                         │
                       layerFade shader (mix texA/texB by mixFactor) ──► shared WebGLRenderer
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full breakdown.

---

## Running Locally

```bash
npm install
npm run dev
```

Then open **`http://localhost:5173`**.

## Deployment

The site deploys to GitHub Pages at **https://son9502.github.io/ColorVerse/** via [.github/workflows/deploy.yml](.github/workflows/deploy.yml) on every push to `main`. To test the production build locally:

```bash
npm run build
npm run preview   # serves dist/ at http://localhost:4173/ColorVerse/
```

---

## Current Status & Roadmap

### Done
- [x] RGB and HSL texture generation for cube and sphere
- [x] 128-layer navigation with keyboard and text input
- [x] GPU cross-fade between adjacent layers (`layerFade` shader)
- [x] Animated RGB ↔ HSL switching
- [x] Web Worker texture pipeline with extremes-first preloading and neighbor prefetch
- [x] Two-tier LRU caching (WorkerCache → TextureCache) via per-shape `TextureRegistry`
- [x] Shared WebGL renderer/camera singleton
- [x] Base class hierarchy for Main / Mini / Preview objects
- [x] Color picking via raycasting
- [x] Color harmony panel (all harmony types)
- [x] Fuzzy color search over named-colors CSV
- [x] Mini orientation viewport
- [x] Layer preview
- [x] 1-D/2-D options marked "Coming soon" (development moved to the `feature/1d-2d` branch)

### In Progress (v1)
- [ ] Event-listener cleanup when switching visualizations
- [ ] Public deployment (build + workflow ready; enable Pages and merge to `main`)

### Future Updates
- [ ] 1-D mode: render a single-channel gradient line for the selected axis
- [ ] 2-D mode: render square/circle planes for the selected X/Y axes
- [ ] Shared picked color across dimensions
- [ ] `ShaderCache`: currently instantiated but unused; materials are created directly by Main objects
- [ ] Export selected color + harmonies
- [ ] Mobile / touch input support
- [ ] Move Three.js from CDN global to the npm `three` package

---

## Controls (3-D Mode)

| Input | Action |
|-------|--------|
| Mouse drag | Rotate object |
| Arrow keys | Rotate object |
| Scroll wheel | Zoom |
| `[` / `]` | Previous / next layer |
| Type a number in **Layer** + `Enter` | Preview, then jump to that layer (`Esc` cancels) |
| `1`–`6` | Snap to face / axis |
| Click | Pick color |
| Double-click | Reset rotation and zoom |

---

*See [DEVLOG.md](DEVLOG.md) for a full change history.*
