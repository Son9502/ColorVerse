# DEVLOG — ColorVerse

A running log of development sessions, organized by milestone.
Each entry is tagged with how it was produced:

- `[manual]` — written/designed entirely by the developer
- `[ai-assisted]` — drafted or significantly shaped with AI (Claude, Copilot, etc.)
- `[collab]` — pair-programmed or collaboratively built with another person

---

## Milestone 5 — Caching & Rendering Refactor `[ai-assisted]`
**2026-01-02 → present**

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
