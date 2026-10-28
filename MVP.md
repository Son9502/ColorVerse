# MVP — ColorVerse

## Goal (v1)

Someone can open ColorVerse, explore RGB and HSL as an interactive **3-D** color solid, pick any color, and get its values and harmonies.

---

## In Scope (v1)

### 1. 3-D Mode ✅ (done)
- Cube and sphere, in both RGB and HSL
- 128 nested layers with smooth cross-fade
- Animated RGB ↔ HSL switching
- Color picking, harmony panel, named-color search

### 2. v1 Polish
- [x] Mark the 1-D and 2-D options in the dimension selector as "Coming soon" (or hide them) so they don't open blank views.
- 1-D/2-D development happens on the `feature/1d-2d` branch.

### 3. Color Navigation (any color reachable from any other)
- [x] **Saturate harmony row:** the mirror of Tones; pulls saturation toward 100% in five steps (`s + (100 − s) × 20…100%`). This is the one direction the harmonies were missing; without it, a muted color can't reach a vivid one.
- [x] **HSL / RGB sliders** in the color details card for precise adjustment (sliders follow the HSL toggle). Hidden in the future minigame.

### 4. First Impressions
- [x] **Welcome + tour:** first-visit welcome modal, then an optional 7-step spotlight tour of the real controls (canvas, layers, color space, shape, picking/search, harmonies, ? button). Shown once per browser; replayable from the ? panel.
- [x] **Controls layout:** ordered Dimension → Shape → Color space → Layer; consistent padding and field labels; "RGB ◯ HSL" toggle; layer input hint; search hint under Color Search.
- [x] **Search touches:** clicking the empty box lists the last 10 searches; the autocomplete hint keeps the letters' case as typed; result rows laid out as swatch + name with hex/RGB underneath.

### 5. Must-Fix Bugs
- [x] Shader file name case: shaders are now bundled with `?raw` imports using the correct `layerFade.*` names.
- [x] Listener cleanup: `dispose()` should remove the window and container listeners added by `3d-mode.js` and `MainBase`.
- [x] Shared renderer: `dimension.js` shouldn't dispose the shared WebGL renderer when switching views.
- [x] Entry point: `main.html` renamed to `index.html`.
- [x] Mini object no longer turns black after the RGB ↔ HSL toggle.
- [x] Sphere textures right side up (lightness and G point up, matching the cube and mini object).
- [x] HSL cube faces meet seamlessly on every layer (top/bottom aligned with the sides; sides no longer narrow inward).

### 6. Deployment
- [x] Production build fixed (worker, shaders, CSV path) and GitHub Actions workflow added.
- [x] Pages enabled and live at https://son9502.github.io/ColorVerse/ (linked from the README).

---

## Roadmap (Post-v1)

| Version | Scope | Why here |
|---|---|---|
| **v1.1** | Color Golf | Builds only on v1 (3-D view, harmonies, the par search); no new renderer |
| **v2.0** | 1-D and 2-D modes + shared color across dimensions | Delivers the "multi-dimensional" promise; new renderers and shared state |
| **v2.x / v3** | More shapes and color spaces | v2.x if they reuse the 3-D pipeline; v3 if they need a new color model throughout |

### v1.1: Color Golf (minigame)
- Reach a target color from a start color in the fewest harmony clicks and/or least time.
- **Win condition:** within a tolerance (OKLab distance, shown as a match %), not an exact hex.
- **Par:** shortest click path computed by breadth-first search over harmony moves; only solvable puzzles are offered.
- **Modes:** clicks vs par, time trial, daily seeded puzzle.
- **Exact state:** track HSL as exact values instead of re-deriving from rounded RGB each click, so rounding drift near black/white can't create shortcuts that par doesn't account for.
- **Game mode only:** sliders and search are hidden while a game is in progress (a slider move would solve any puzzle in one step). Both stay in normal exploring.

### v2.0: 1-D and 2-D Modes
Developed on the `feature/1d-2d` branch.
- **1-D, Line:** a gradient bar for the selected channel, with sliders to hold the other two channels.
- **2-D, Square:** plot the selected X-axis channel against the Y-axis channel, with a slider to hold the third channel.
- **2-D, Circle:** hue wheel (angle = hue, radius = saturation), with a slider to hold lightness.
- Both work in RGB and HSL, and clicking picks a color.
- **Shared state across dimensions:** a color picked in one dimension stays highlighted when you switch to another.

### v2.x / v3: More Shapes and Color Spaces
- **v2.x (reuse the 3-D pipeline):** HSL cylinder, HSV cone / bicone.
- **v3 (new color model):** perceptual spaces such as OKLCH and LAB.

### Unscheduled
- Export of the selected color and its harmonies
- Mobile / touch input
- `ShaderCache` integration
- Moving Three.js from the CDN global to the npm package

---

## Definition of Done (v1)

- [x] Cube and sphere render correctly in both RGB and HSL
- [x] Color picking works on both shapes and updates the harmony panel
- [x] 1-D/2-D options are marked as coming soon or hidden
- [x] A muted color (e.g. #9C869A) can reach vivid red in a few harmony clicks (Saturate row)
- [ ] No console errors after 10 consecutive cube ↔ sphere switches
- [ ] The deployed URL loads to an interactive state in under 3 s
