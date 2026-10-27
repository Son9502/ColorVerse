# DEVLOG — ColorVerse

A running log of development sessions, organized by milestone.
Each entry is tagged with how it was produced:

- `[manual]` — written/designed entirely by the developer
- `[ai-assisted]` — drafted or significantly shaped with AI (Claude, Copilot, etc.)
- `[collab]` — pair-programmed or collaboratively built with another person

---

## Milestone 7 — v1 Bug Fixes & UI Polish `[ai-assisted]`
**2026-10-26 → 2026-10-27**

Finished the v1 must-fix bugs and reworked the color selection UI based on hands-on testing. Layout and interaction choices (stacked details card, two-step Enter, double-click swatches, CSS-first color dedupe) were directed by the developer; implementation `[ai-assisted]`.

**Fixed**
- `MainBase.js`, `3d-mode.js`: listeners registered with an `AbortController` signal and removed on `dispose()`; the render loop is cancelled, so switching cube ↔ sphere no longer stacks listeners or leaves the old scene drawing
- `dimension.js`: no longer disposes the shared WebGL renderer on switch
- `dropdown.js`: PageDown referenced an undefined `items` variable; a stale keyboard highlight could index past a shorter result list
- `3d-mode.js`: picking on the canvas now closes the autocomplete list instead of leaving an empty box
- `named_colors.csv`: 343 names had multiple hexes (e.g. 8 for "red", the first being `#8B0000`); now one hex per name, 4,012 → 3,217 rows

**Added**
- `help.js` + `?` button (top-left of canvas): popover listing 3-D controls and panel tools; closes on Esc / outside click; events don't fall through to the canvas
- `harmony.js`: `selectBaseColor()` shared by search and swatches; double-click a harmony swatch to make it the base color
- `resources/dedupeColors.py`: one hex per name — CSS named color first, else the source hex closest to the linear-RGB average; called by `colorTable.py` before saving

**Modified**
- Color details card: always visible under Color Search (greyed out until a pick), stacked vertically (circle → hex → name → RGB → HSL), text sized with `min(vw, vh)` and `em` so it scales with window width and height; the name line collapses when a color has no name
- `toggle.js`: active color space (RGB/HSL) is bold and listed first in the details card; toggle state applied on load
- Color Search: stays visible after a pick; selection clears the input and closes the list; Enter is two-step (1st completes to the best match, 2nd selects); ties in ranking go to the shorter name so "r" completes to "red"
- Harmony swatches: pointer cursor + enlarge on hover once a base color is selected

---

## Milestone 6 — v1 Scope, Docs & Deployment `[ai-assisted]`
**2026-10-17 → 2026-10-26**

Scoped v1 to the 3-D mode, documented the project, and got the production build deploying to GitHub Pages.

**Added**
- `MVP.md`: v1 = 3-D mode; 1-D/2-D, shared cross-dimension state, and export moved to future updates
- `ARCHITECTURE.md`: module map, texture pipeline, rendering, design decisions, known issues
- `vite.config.js`: `/ColorVerse/` base path for production builds
- `.github/workflows/deploy.yml`: builds and deploys to https://son9502.github.io/ColorVerse/ on every push to `main`
- `feature/1d-2d` branch: holds the 1-D/2-D work until after v1

**Modified**
- `README.md`: reframed as a multi-dimensional color space visualizer; corrected the layer model (nested shells, not slices), controls, status, and run instructions
- `dimension.js`: removed 1-D/2-D imports and routing; 1-D/2-D dropdown options disabled as "Coming soon"
- `main.html` → `index.html`: Vite's default entry, so the root URL loads the app
- `WorkerCache.js`: worker path is now a string literal so Vite bundles the worker
- `layerMaterial.js`: shaders imported with `?raw` instead of fetched at runtime (also fixes the `layerfade`/`layerFade` case mismatch)
- `dropdown.js`: CSV fetched from `import.meta.env.BASE_URL`
- Layer input ID `3dtext` → `layer-input`: an ID starting with a digit is an invalid CSS selector and was dropping the whole shared input style rule

**Removed**
- `src/1d-mode.js`, `src/2d-mode.js` stubs (preserved on `feature/1d-2d`)

---

## Milestone 5 — Caching & Rendering Refactor `[ai-assisted]`
**2026-01-02 → present**

**Housekeeping — 2026-02-24**
- Added `archive/` folder at project root for reference code that has been superseded but is still useful during active refactoring
- Moved `src/smart-3d/smartCube.js` → `archive/smartCube.js`: the original monolithic cube implementation (pre-refactor), containing the inline `miniAxisRenderer` class, original layer control, and color picking logic; kept as reference while Milestone 5 is in progress
- All other files in `src/` are live and reachable from `main.js`


Major architectural refactor of the texture pipeline. The goal is to decouple texture generation from the main thread and from individual 3D objects, making the system more robust as new shapes and modes are added.

**Added**
- `WorkerCache.js` — new cache layer that offloads pixel buffer generation to a Web Worker; implements "extremes-first" loading (layer 127 → min/max inward) and idle-time batching via `requestIdleCallback`
- `TextureRegistry.js` — factory that creates paired TextureCache + ShaderCache instances per object type, so each visualization gets its own isolated cache
- `sharedRenderer.js` — singleton WebGL renderer and camera, shared across visualizations rather than recreated per object

**Modified**
- `TextureCache.js` — now delegates pixel generation to WorkerCache instead of computing inline
- `MainBase.js`, `MiniBase.js`, `PreviewBase.js` — updated to work with registry-based caches
- `MainCube.js`, `MainSphere.js`, `MiniCube.js`, `MiniSphere.js`, `PreviewCube.js`, `PreviewSphere.js` — adapted for new cache access patterns
- `3d-mode.js` — updated scene setup to use shared renderer
- `main.js` — updated bootstrap sequence

**In progress**
- `FaderTextures/layerMaterial.js` — shader material for smooth layer blending using `mixFactor` uniform; supports Blinn-Phong lighting and snap-point highlights
- Color space switching animation (RGB ↔ HSL)

---

## Milestone 4 — Base Class Hierarchy `[manual]`
**2025-12-18 → 2025-12-24**

Refactored the three families of 3D objects (Main, Mini, Preview) into proper inheritance chains. Each family now has a shared base that handles common concerns (physics/rotation, opacity, animation loops), with shape-specific subclasses handling geometry and material details.

**Added**
- `MainBase.js` — physics-based rotation (velocity/acceleration/friction), keyboard/mouse input, layer animation, quaternion face-snap
- `MiniBase.js` — opacity fade in/out (idle timeout), axis helper arrows, rotation sync with main object
- `PreviewBase.js` — layer preview animation, rotation sync

**Modified**
- `MainCube.js`, `MainSphere.js` — now extend MainBase
- `MiniCube.js`, `MiniSphere.js` — now extend MiniBase
- `PreviewCube.js`, `PreviewSphere.js` — now extend PreviewBase
- Files reorganized into `src/3d/Main/`, `src/3d/Mini/`, `src/3d/Preview/` subdirectories
- `LRUCache.js` added as base cache class with generic eviction and disposal

---

## Milestone 3 — HSL Rework & Sphere Textures `[manual]`
**2025-12-14 → 2025-12-16**

The HSL color space mapping was inconsistent and visually wrong. Reworked HSL to use proper cylindrical coordinates (hue = angle, saturation = radius, lightness = layer depth). Also fixed the sphere to use the same coordinate-based system rather than a naive channel-to-channel mapping.

**Changes**
- `color-utils.js` — rewrote `computeCubeColor()` for HSL faces using cylindrical + pseudo-cylindrical coordinates; added `computeSphereColor()` with latitude/longitude mapping; added gamma correction
- `src/3d/Textures/thread-texture.js` — updated pixel generation to use new color-utils functions
- Mini objects retextured to match new color space conventions
- Removed toggle that was no longer needed after HSL unification
- Added `lerp()` to utils; replaced direct frame jumps with interpolated layer transitions
- `LoaderManager.js` — fixed ETA display (was showing 0s too frequently)

---

## Milestone 2 — Color UI & Harmonies `[manual]`
**2025-12-12 → 2025-12-14**

Built out the right-panel UI: color search with fuzzy matching, color harmony generation, and the collapsible harmony rows. Also set up the `color-utils.js` module and migrated shared conversion functions there.

**Added**
- `dropdown.js` — fuzzy autocomplete over named colors CSV (Levenshtein distance); keyboard navigation; triggers harmony update on selection
- `harmony.js` — harmony formulas (complementary, split-complementary, triadic, tetradic, double-complementary, analogous, tints/shades/tones)
- `categories.js` — smooth collapsible rows for harmony sections
- `color-utils.js` — central module for color space conversion functions (`hslToRgb`, shader generators for mini objects)
- `public/named_colors.csv` — named color database

---

## Milestone 1 — Initial Build `[manual]`
**2025-12-11**

Project scaffolded and core 3D visualization built from scratch. Established the basic rendering loop, texture pipeline, and UI layout.

**Established**
- Project structure with Vite + Three.js
- `main.html` — full UI layout (left controls, right color info, bottom harmonies, canvas)
- `3d-mode.js` — scene setup, camera, raycasting for color picking, all input handlers
- `thread-texture.js` — initial synchronous pixel generation for cube and sphere layers
- `ShaderCache.js` — initial blend material caching
- `dimension.js` — dimension/shape selector
- `toggle.js` — RGB/HSL toggle
- `utils.js` — `clamp()`, `lerp()`

---

## Log Format Reference

When adding new entries, use this structure:

```markdown
## Milestone N — Short Title `[manual | ai-assisted | collab]`
**YYYY-MM-DD → YYYY-MM-DD**

One or two sentences describing the goal of this milestone.

**Added / Modified / Removed / Fixed**
- file or feature — what changed and why
```

> **Note:** If a session mixes manual and AI-assisted work, use the tag that represents the majority, and note exceptions inline (e.g., "algorithm designed manually; implementation `[ai-assisted]`").
