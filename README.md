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

- **Welcome + guided tour**: first-visit welcome and a spotlight tour of the controls, replayable from the `?` panel; on touch screens the tour and help describe taps and pinches instead of keys
- **Dimension selector**: switch between dimensional views (3-D in v1; 1-D/2-D planned)
- **RGB ↔ HSL toggle**: animated cross-fade between color spaces on the 3-D object
- **3-D Cube & Sphere**: both shapes support RGB and HSL
- **128 nested layers**: navigate with `[` / `]`, the layer slider and its − / + buttons, or type a layer number
- **Layer preview**: typing a layer number shows a translucent, enlarged preview of that layer before you commit with `Enter` (or Done on a phone)
- **Face snapping**: press `1`–`6` to snap to a face/axis with eased quaternion rotation
- **Physics-based rotation**: mouse drag and arrow keys with velocity and friction
- **Color picking**: click any point on the object to read its color via raycasting
- **Color harmonies**: complementary, split-complementary, triadic, tetradic, double-complementary, analogous, tints, shades, tones, and saturate. Double-click any swatch to make it the selected color
- **Search / details panel**: shows Color Search until a color is picked, then the color details card; `← Search`, `Esc`, or clicking empty canvas goes back
- **Color search**: fuzzy autocomplete (Levenshtein distance) over ~3,200 named colors; clicking the empty box shows your last 10 searches
- **Mini orientation viewport**: a small axis-gizmo object (bottom-right) that mirrors rotation, highlights the picked color's direction, and fades out when idle
- **Progressive loading**: textures generate in a Web Worker with a progress bar and ETA
- **Phones and accessibility** (v1.7): a one-column phone layout, a landscape layout with the hole, swatches and map side by side, touch play (tap, drag, pinch), keyboard play (Tab, arrows, Enter) and color names for every swatch
- **Color Golf** (v1.1+): get from a tee color to a target color in as few strokes as possible. Harmony rows are clubs (the Driver, Woods and Hybrids share one Long shots row in golf), a putter row nudges, and par comes from a solver that knows the best route. Sand, water and black-hole hazards, wind, yardage (OKLab distance × 1000), a live score card, a Monochrome switch (gray swatches, You and Target in color), and the 3-D shape as a map with a ball, flag, trail and hazard footprints
  - **17 courses**: five themed courses from Beginner to Expert (Prism Point, Ember Dunes, Verdant Pines, Cobalt Bay, Royal Indigo), then a v1.8 expansion pack of seven, each built around one gimmick: portals (Violet Vortex), mirrors (Silverglass Greens), club bans (Caddie Strike), turning wind (Saffron Whirlwind), a spinning roulette swatch (Scarlet Roulette), hex-digit flips (Hexflip Hollow) and survival (The Obsidian Gauntlet: go over par and the run ends), plus five **Monochrome** courses behind the Monochrome switch: the first five's holes with the swatches and map in gray, so each shot is judged by its lightness (Ash Point, Cinder Dunes, Slate Pines, Graphite Bay, Royal Onyx)
  - **Daily hole** with streaks and a leaderboard, a **weekly Gauntlet** (nine survival holes, new each Monday, with its own board) and endless **practice**; with the Monochrome switch on, the daily hole and the Gauntlet are their own (different holes, streaks and boards)
  - **Accounts** (v1.6, Firebase): scores saved across devices, courses unlocked in a chain by scoring well, server-checked rounds (the server replays every stroke), nicknames and top-10 leaderboards
  - A first-time walk-through of the golf screen and the first hole, and highlighted words that explain each gimmick

---

## Tech Stack

- **JavaScript (ES modules)**: no framework
- **[Three.js](https://threejs.org/)**: 3D rendering (npm package, r181, bundled by Vite into its own cached chunk)
- **WebGL / GLSL**: custom shaders for layer cross-fading, Blinn-Phong lighting, and pick highlights
- **Web Workers**: off-main-thread pixel generation, with a main-thread fallback
- **Vite**: dev server and build tool
- **Firebase** (v1.6): Auth (Google, email and password, email link), Firestore (bests, daily results, leaderboards) and Cloud Functions (the score server, which replays rounds with the game's own code)
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

Other scripts:

| Command | What it does |
|---------|--------------|
| `npm run dev:unlocked` | Every course open, nothing sent to an account (test mode) |
| `npm run dev -- --host` | Serve on your network too, to try the site on a phone (Google sign-in there needs the address in Firebase's authorized domains) |
| `npm run emulators` + `npm run dev:cloud` | Firebase emulators and a dev server that uses them (accounts and scores without the real project) |
| `npm run courses [-- <course ids>]` | Regenerate the Color Golf courses (all, or the ones named) into `src/golf/courses.json` |
| `npm run daily -- --until YYYY-MM-DD [--mono]` | Extend the daily holes (`daily.json`, or the Monochrome ones in `daily-mono.json`; currently to 2028) |
| `npm run weekly -- --until YYYY-MM-DD [--mono]` | Extend the weekly Gauntlet (`weekly.json`, or `weekly-mono.json`; currently to 27 Dec 2027) |
| `npm run practice` | Rebuild the practice starter pool |
| `npm run simulate -- [report\|fit]` | Simulated players: pass rates for every unlock by skill level (`report`), or the bot settings closest to your own scores (`fit`, from `MY_SCORES` in the script) |

## Deployment

The site deploys to GitHub Pages at **https://son9502.github.io/ColorVerse/** via [.github/workflows/deploy.yml](.github/workflows/deploy.yml) on every push to `main`. To test the production build locally:

```bash
npm run build
npm run preview   # serves dist/ at http://localhost:4173/ColorVerse/
```

The score server, Firestore rules and indexes deploy separately, after the site:

```bash
npm run deploy:cloud   # Firebase project colorverse-9efa3 (npm run firebase -- login first)
```

Deploy them whenever course holes change: the server refuses rounds whose course version differs from its own.

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
- [x] Public deployment on GitHub Pages
- [x] First-visit welcome + spotlight tour; tidied controls layout
- [x] HSL / RGB sliders in the color details card (follow the HSL toggle)
- [x] Saturate harmony row (raises saturation; makes any color reachable from any other)
- [x] Listener and render-loop cleanup when switching shapes
- [x] In-app help popover (`?` button) listing controls and tools
- [x] 1-D/2-D options marked "Coming soon" (development moved to the `feature/1d-2d` branch)

### In Progress (v1)

### Roadmap
See [MVP.md](MVP.md#roadmap-post-v1) for details.
- [x] **v1.1:** Color Golf minigame: reach a target color in the fewest strokes; courses, par solver, score card, 3-D map
- [x] **v1.1.1:** Course lengths that follow par (short par 3s, long par 5s) and per-course difficulty (Beginner / Standard)
- [x] **v1.1.2:** Perfect route solved in a Web Worker and replayed on the 3-D map by a gold ghost ball
- [x] **v1.1.3:** Thicker map paths
- [x] **v1.2:** Color Golf hazards (sand, water) and wind; Cobalt Bay (par 71) and Royal Indigo (par 70)
- [x] **v1.2.1:** Golf map uses HSL during a game
- [x] **v1.3:** Daily hole, practice by difficulty, Pro setting (no swatch previews)
- [x] **v1.4:** Golf variety: layer peeling animation, "sand wedge only" on Expert courses, per-course par layouts
- [x] **v1.5:** Engine cleanup: Three.js r128 → npm package; remove the unused `ShaderCache`
- [x] **v1.6:** Accounts + score database: cloud bests, daily streaks, leaderboards, server-checked scores
- [x] **v1.7:** Mobile and accessibility: phone layout, tap to play, keyboard play, color names
- [x] **v1.8:** Color Golf expansion pack: seven gimmick courses, survival, a weekly Gauntlet, landscape phones and a first-time walk-through
- [x] **v1.8.6:** Monochrome (was Pro): five gray courses, a Monochrome daily hole and weekly Gauntlet; a bigger hole on Beginner and Standard; 3 strokes of unlock grace
- [ ] **v2.0:** 1-D mode (single-channel gradient line) and 2-D mode (square/circle planes), with the picked color shared across dimensions
- [ ] **v2.1:** Color Golf on a 2-D map (hue wheel or square slice)
- [ ] **v2.2:** More 3-D shapes: HSL cylinder, HSV cone/bicone
- [ ] **v3.0:** Perceptual color spaces (OKLab/OKLCH, CIELAB/LCh) and gamut views

### Possible Future Updates
- Palette studio: build palettes from harmonies, contrast and colour-blindness checks, export (CSS, Tailwind, JSON)
- Image colors: a photo's pixels as a point cloud in the shape, with a palette pulled from it
- Social golf: course editor with share codes, head-to-head races, tournaments
- Learn and explore: color-theory lessons through golf holes, an offline app, WebXR

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
| `Esc` | Close the help panel → cancel the text box you're in → back to Color Search (first that applies) |
| `?` button (top-left of canvas) | Show all controls and tools |

On a touch screen:

| Gesture | Action |
|---------|--------|
| Drag (one finger) | Rotate object |
| Pinch | Zoom |
| Tap | Pick color (or play a swatch in Color Golf; a click does the same on a computer) |
| Layer slider, − / + | Step through the layers |
| Type a layer, then Done | Jump to that layer |

---

*See [DEVLOG.md](DEVLOG.md) for a full change history.*
