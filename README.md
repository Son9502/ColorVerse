# ColorVerse

> An interactive 3D color space explorer — visualize RGB and HSL as navigable geometry, not just a flat wheel.

---

## What Is This?

Most color tools give you a 2D color wheel or a picker. ColorVerse gives you the full color space as a **3D object you can rotate, navigate, and explore**.

Colors aren't points on a circle — they're points in a 3-dimensional space. RGB maps to a cube (red/green/blue axes). HSL maps to a cylinder (hue/angle, saturation/radius, lightness/height). ColorVerse makes that spatial structure tangible and interactive.

---

## Core Concept

The color space is rendered as **128 navigable layers** — cross-sections through the 3D space. At any given layer, you're looking at a 2D slice of color, positioned in 3D. Step through layers with `[` and `]`, rotate the object with the mouse or keyboard, and click any pixel to get its hex value and see its color harmonies.

**Two color spaces, two shapes:**

| Shape | RGB | HSL |
|-------|-----|-----|
| Cube | Each face maps one channel pair (R×G, R×B, G×B, etc.) | 4 linear faces (hue × lightness) + 2 polar faces |
| Sphere | Latitude/longitude mapped to RGB channels | Latitude/longitude mapped to HSL cylindrical coords |

---

## Features

- **3D Cube & Sphere** — switch between shapes, both support RGB and HSL color spaces
- **128 Color Layers** — navigate with `[` / `]` or type a layer number directly
- **Face Rotation** — press `1`–`6` to snap the cube to each face; smooth quaternion interpolation
- **Color Picking** — click any pixel on the 3D object to select that color
- **Color Harmonies** — generates complementary, split-complementary, triadic, tetradic, analogous, tints, shades, and tones for any selected color
- **Color Search** — fuzzy autocomplete search over named CSS/web colors
- **Mini Viewport** — orientation reference (bottom-right) shows current rotation with labeled axes
- **Layer Preview** — animated preview of a target layer before committing to it

---

## Tech Stack

- [Three.js](https://threejs.org/) — 3D rendering
- Web Workers — async texture generation (offloaded from main thread)
- WebGL shaders — custom GLSL for layer blending, Blinn-Phong lighting, and highlight effects
- Vite — build tool and dev server

---

## Architecture Overview

```
User Input
    ↓
dimension.js / dropdown.js / 3d-mode.js
    ↓
MainCube / MainSphere
    ↓
TextureCache.getOrCreate(colorSpace, layer)
    ↓
WorkerCache → Web Worker: generatePixelLayer()
    ↓
Pixel buffer → THREE.DataTexture
    ↓
ShaderCache → blended GLSL material (mixFactor uniform)
    ↓
WebGLRenderer → canvas
```

Textures are generated lazily by a Web Worker and cached in a 3-tier LRU system:
1. **WorkerCache** — raw pixel buffers per (colorSpace, layer)
2. **TextureCache** — Three.js `DataTexture` objects, ready for GPU upload
3. **ShaderCache** — blended shader materials per layer-pair (used for smooth transitions)

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173` (or whatever port Vite assigns).

---

## Current Status & Roadmap

### Done
- [x] RGB and HSL texture generation for cube and sphere
- [x] 128-layer navigation with keyboard and input
- [x] Color picking via raycasting
- [x] Color harmony panel (all harmony types)
- [x] Fuzzy color search with named colors CSV
- [x] Mini orientation viewport
- [x] Layer preview animation
- [x] LRU caching base class
- [x] Base class hierarchy for Main / Mini / Preview objects
- [x] Shared renderer and camera singleton

### In Progress
- [ ] Worker-based texture pipeline (`WorkerCache.js`) — offloading pixel generation to avoid UI blocking
- [ ] `TextureRegistry.js` — unified cache registry per object type
- [ ] `sharedRenderer.js` — decoupling renderer lifecycle from individual objects
- [ ] `FaderTextures/layerMaterial.js` — shader-based layer blending with `mixFactor` uniform
- [ ] Smooth color space switching (RGB ↔ HSL animated transition)

### Planned
- [ ] 1D mode (linear slices along a single channel axis)
- [ ] 2D mode (flat square/circle map with selectable axes)
- [ ] Export selected color + harmonies
- [ ] Mobile / touch input support

---

## Controls

| Input | Action |
|-------|--------|
| Mouse drag | Rotate object |
| Scroll wheel | Zoom |
| `[` / `]` | Previous / next layer |
| `1`–`6` | Snap cube to face |
| Arrow keys | Increment layer |
| Click pixel | Select color |

---

*See [DEVLOG.md](DEVLOG.md) for a full change history.*
