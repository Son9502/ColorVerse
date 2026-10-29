# DEVLOG — ColorVerse

A running log of development sessions, organized by milestone.
Each entry is tagged with how it was produced:

- `[manual]` — written/designed entirely by the developer
- `[ai-assisted]` — drafted or significantly shaped with AI (Claude, Copilot, etc.)
- `[collab]` — pair-programmed or collaboratively built with another person

---

## Milestone 17 — Golf Map in HSL (v1.2.1) `[ai-assisted]`
**2026-10-28**

The golf map now always uses HSL, so every marker and hazard footprint can sit on its exact color. Decision by the developer (from the v1.2.0 measurements); implementation `[ai-assisted]`.

**Modified**
- `golf/golf-ui.js`: entering golf remembers the RGB/HSL toggle and switches to HSL (through the toggle itself, so the shape, mini object, sliders and details card all follow); leaving restores it
- `index.css`: the color-space toggle is hidden while `body.golf` is set

**Verified**
- Real built app (Chrome DevTools): RGB user → HSL in setup and play, toggle hidden, RGB restored on exit; HSL user stays HSL; ball and flag drawn on the HSL sphere; no console errors

---

## Milestone 16 — Hazards, Wind & Expert Courses (v1.2.0) `[ai-assisted]`
**2026-10-28**

Sand, water and wind for Color Golf, and the two Expert courses. Rules and presentation chosen by the developer (OKLab "looks-like" regions, wedges only in sand, water = +1 and back, no swatch warnings, some bunkers on the perfect route, the six map details, footprints always shown on the current layer); placement strategy and checks from measurements; implementation `[ai-assisted]`.

**Added**
- `golf/hazards.js`: a hazard is a center color + radius in yards; cached per-state lookup; wedge list
- Rules (`game.js`): water = +1 penalty and the ball returns to where it was hit from; sand = wedges only (no putter, never "on the green"); undo reverses a stroke and its penalty together
- Solver: water landings skipped (never worth 2 strokes for no progress), wedges only from sand, `avoidHazards` for the safety check, `wind` drift; still an exact search over the same ≈3.7M states
- Wind (`clubs.js`): a fixed hue (±°) or lightness (±%) drift per hole on every full shot, applied before the hazard check; putts unaffected; swatches show the calm landing
- Generator: hazards and wind placed from their own seeded sequences (v1.1 holes unchanged), water on birdie-line landing spots, bunkers guarding the hole and on the perfect route where the next shot is a wedge; every placement re-checked (perfect unchanged or +1 on a layup, finishable within par avoiding hazards, birdie line in range); if a placement fails, another hole is tried
- Courses: Cobalt Bay (Expert, par 71, 30 lakes, layup hole 9) and Royal Indigo (Expert, par 70, 24 bunkers + 34 lakes, layup hole 11); Ember Dunes 25 bunkers, Verdant Pines 6, Prism Point 4 (back 9); wind on 15 / 18 / 16 / 14 holes (Prism Point calm)
- Map: hazard footprints traced on the layer being viewed (`map.js` `footprintOnLayer`, one patch per cube face it reaches) with sand/water textures, edge rings, a halo for nearby layers, icons at hazard centers, and a flash on the hazard you land in; a faint outline when a hazard doesn't reach the layer
- Panel: hole summary ("2 bunkers, 1 lake"), wind line and map badge, yardage to each hazard, landing notes, non-wedge swatches greyed out in a bunker, hazard row on the score card
- `ARCHITECTURE.md`: Color Golf section and module map

**Fixed**
- The route replay worker ignored hazards and wind (could have replayed a route through a lake); it now gets both
- A projected hazard patch could cover a ball that wasn't in the hazard (different layers in the same direction); footprints are now traced on the current layer instead
- `BufferGeometry.applyQuaternion()` is r130+; replaced with `applyMatrix4` (the app uses r128)

**Measured**
- A single hazard almost never makes a hole longer for a perfect player (0 of 16 lakes, even at 80 yds); it removes good shots (birdie line −20%), which drove the "aim at birdie lines" placement
- Wedges in sand: each of the four is the only best recovery on some bunkers (all four 2.31 strokes to the hole; Tones alone 2.83, Saturate alone 3.47)
- Footprints vs rules on 3,403 landings: never drawn inside a hazard the ball isn't in; hazard landings drawn outside their patch: 2/43 (HSL sphere), 4/43 (RGB cube), 2/43 (HSL cube), 21/43 on the RGB sphere (the sphere doesn't contain those vivid colors)

**Verified**
- All five courses: stored perfect matches the solver with hazards and wind; the game replays the solver's route and holes out in exactly perfect; finishable within par avoiding hazards; tee and hole outside every hazard; length follows par; lip-outs on every par 3
- Real built app (Chrome DevTools): bunker lockout and driver refusal, water +2 and undo, wind landing exactly 6° off the shown swatch, footprints and halos drawn, no console errors
- `package.json`: version 1.2.0

---

## Milestone 15 — Thicker Map Paths (v1.1.3) `[ai-assisted]`
**2026-10-28**

Requested by the developer after seeing the replay.

**Modified**
- `golf/mapView.js`: map paths (white trail and gold replay) drawn as thin tubes, since WebGL ignores line width and `THREE.Line` is always 1 px; stroke dots scale with them (`TRAIL_RADIUS`)
- `package.json`: version 1.1.3

---

## Milestone 14 — Perfect Route Replay (v1.1.2) `[ai-assisted]`
**2026-10-28**

Finished the two remaining v1.1 spec items, scheduled as v1.1.2 by the developer; implementation `[ai-assisted]`.

**Added**
- `golf/solver-worker.js`: the perfect route is solved in a Web Worker (created on first use; literal path so Vite bundles it). Verified the page stays responsive: a 50 ms timer ticked 23/24 times during the solve
- Map replay: "Show perfect route" plays a gold ghost ball along the route stroke by stroke (≈1.1 s per stroke), with a gold path beside the player's white one; the view peels and turns to follow it, the club list fills in step by step, and the gold path ends in the pin. Next hole, the score card or leaving the game stops a replay in progress
- `golf-ui.js` no longer imports the solver on the main thread

**Verified**
- Real built app driven through Chrome DevTools: picked-up hole → replay of Complementary +180° → Tones 20% → Saturate 40%, layers 70 → 31, no console errors
- `package.json`: version 1.1.2

---

## Milestone 13 — Course Lengths & Difficulty (v1.1.1) `[ai-assisted]`
**2026-10-28**

Regenerated the courses so hole length follows par and each course has a measured difficulty. The developer chose to enforce lengths and asked how that changes difficulty; the answer (separate length and difficulty dials) came from measuring the solver's options per hole; implementation `[ai-assisted]`.

**Modified**
- `generateCourses.mjs`: length rule (par 3 < 250 yds, par 4 250–400, par 5 > 350) and a per-course *birdie line* range (first shots out of 41 that keep the perfect score reachable): Beginner 6+, Standard 3–6, Expert 1–3; first-shot searches built once per tee to keep generation ≈20 s
- Courses regenerated: Prism Point (Beginner, 5,697 yds, birdie line avg 9.7), Ember Dunes (Standard, 5,620 yds, 3.9), Verdant Pines (Standard, 5,018 yds, 4.4); par 72 / perfect 51 each; fairway (first shots keeping par) 26–33 of 41
- Course picker shows difficulty and total yards; best scores start fresh (`colorverse.golf.best.v2`) since the holes changed
- `package.json`: version 1.1.1

**Verified**
- Round tests on all three courses: perfect play under par on every hole, lip-outs on every par 3, hole 16 the ace

---

## Milestone 12 — Color Golf: 3-D Map & Yards (v1.1.0) `[ai-assisted]`
**2026-10-28**

The 3-D shape becomes the course map. Requests from the developer's playtesting: white trail, ball disappearing when holed with the path running to the pin, yards per shot and per hole, wind (spec'd for v1.2), and hole lengths that follow par (measured, then scheduled for v1.1.1); implementation `[ai-assisted]`.

**Added**
- `golf/map.js` `locateColor()`: finds a color's layer and surface point by searching the same functions that draw the textures (coarse grid over all layers, then a local refine; 3–10 ms). Checked by raycasting real geometry and reading what the click-picker sees: within 4/255 on the cube and HSL sphere; the RGB sphere doesn't contain the most vivid colors, so those go to its closest color
- `golf/mapView.js`: ball (current color), flag (target), white trail along the surface with dots per stroke; holed → ball gone, path runs to the pin. Each stroke peels to the current color's layer and turns it toward the camera
- `golf/mapState.js`: shared game → 3-D view state, read on creation so a rebuilt or still-loading view catches up
- `MainBase.rotateToQuaternion()` (face snaps use it too and stop any leftover spin)
- Yards (OKLab distance × 1000): hole length under the title; last shot and yards to the pin after each stroke
- `color-utils.js` `CUBE_FACE_MAPS`: cube face layout shared by the texture worker and the map

**Fixed**
- The map stopped updating after the tee: clearing markers called `Object3D.removeFromParent()`, which is r129+ (the app uses r128); now `parent.remove()`. Found by driving the real built app through Chrome DevTools

**Measured**
- Hole length vs par: currently uncorrelated (median par 3 256 yds, par 5 195). Enforcing lengths (par 3 < 250, par 4 250–400, par 5 > 350) on Prism Point kept "fairway" (first shots that keep par reachable) at ~30/41 and cut the "birdie line" from 6.2 to 4.9/41, mostly on short par 3s → scheduled for v1.1.1 with per-course difficulty bands

**Modified**
- `MVP.md`: wind added to v1.2 (fixed per hole, full shots only, solver-exact); v1.1.1 row; README feature list and roadmap
- `package.json`: version 1.1.0

---

## Milestone 11 — Color Golf: Game Screen `[ai-assisted]`
**2026-10-27 → 2026-10-28**

The playable game, minus the 3-D map. Additions requested by the developer after testing (how-to-play widget, live score card, "on the green" meaning 1–2 putts, par 70/71 courses); implementation `[ai-assisted]`.

**Added**
- `golf/golf-ui.js`: ⛳ Color Golf button → course picker (hue strip, par, best score) → game screen: *You* | *Target* swatches, closeness meter (updates only after a stroke), strokes, timer, Undo; end-of-hole card (score name, strokes · par · perfect · time, "Show perfect route" with swatches and club names); end-of-round score card with best rounds saved in the browser
- Putter row (game mode only), swatches previewing each nudge
- How-to-play (?) panel and a live score card (Card button): front/back 9, "Thru N", hole in progress highlighted, perfect scores hidden until a hole is played
- `game.js` `puttsToHole()`: "On the green" now means 2 putts or fewer will hole it (a 0.05 distance cutoff left 18% of green spots needing 3+ putts)
- `generateCourses.mjs`: per-course par layouts (par 71/70 by swapping par 5s for par 3s); Cobalt Bay (71) and Royal Indigo (70) defined for v1.2; course hues included in `courses.json`

**Modified**
- `harmony.js`: `selectBaseColor`/`setBaseColors` accept exact whole-number HSL, so game swatches match strokes exactly (explore mode unchanged)
- `3d-mode.js`, `dropdown.js`: canvas picking and Esc-to-clear are off during a game; search, sliders, layer controls and the ? help are hidden

**Verified**
- Bots double-clicking the solver's routes: hole 1 birdie with the route list; a full round scored 53 (−19) with a bogey recorded correctly; live card mid-round; a lip-out stroke landing "On the green"

---

## Milestone 10 — Color Golf: Core Logic `[ai-assisted]`
**2026-10-27**

The rules, par solver and courses for the v1.1 minigame, with no UI yet. Game design (golf framing, harmonies as clubs, OKLab "looks the same" win, strokes then time, 18-hole courses → daily → practice, 1 undo per 9, perfect vs par so birdies and aces exist, lip-outs to keep aces non-obvious, color-themed courses and hazards) directed by the developer; implementation `[ai-assisted]`.

**Added**
- `harmonyMath.js`: harmony formulas moved out of `harmony.js` (no DOM), so the solver can use them; `harmony.js` re-exports them
- `golf/clubs.js`: every move a stroke can make (10 harmony rows + a ±4 putter); state is whole-number HSL, the values the swatches show, so the game and solver always agree
- `golf/oklab.js`: OKLab distance; in the hole < 0.02, on the green < 0.05
- `golf/solver.js`: breadth-first search over ≈3.7M HSL states with typed-array tables; depth 7 in ≈1 s, par for a target in ≈10 ms, plus the best path for replays
- `golf/game.js`: a round — strokes, 1 undo per 9 (not a stroke), pick up at double par, score card with par and perfect, score names, strokes-then-time ranking
- `resources/generateCourses.mjs` (`npm run courses`): seeded course generator → `golf/courses.json`; each hole has a perfect score below par (par 3 → 2, par 4 → 3, par 5 → 3 or 4, one ace hole per course), every par 3 has a lip-out swatch, and tees/targets stay in the course's hues
- Courses: Prism Point (full spectrum), Ember Dunes (reds–yellows), Verdant Pines (greens); each par 72, perfect 51

**Verified**
- A bot playing each hole's perfect path scores under par on every hole of all three courses (15 birdies, 2 eagles, a hole in one); undo, pick-up and scoring rules tested

**Modified**
- `MVP.md`: full Color Golf spec — v1.1 core game, v1.2 hazards by course, v1.3 daily hole, practice and a Pro (no previews) setting

---

## Milestone 9 — First Impressions & Rendering Fixes `[ai-assisted]`
**2026-10-27**

Finished the v1 scope: a first-visit welcome and tour, a tidier controls panel, search conveniences, and fixes to how the shapes are colored. Feature choices (welcome then spotlight tour, control order, recent searches, keeping typed case) and the bug reports (mini object going dark, HSL top/bottom placement) came from the developer's testing; implementation `[ai-assisted]`.

**Added**
- `welcome.js`: first-visit welcome modal and a 7-step spotlight tour of the real controls (←/→, Esc, Skip); shown once per browser (`localStorage`), replayable from the ? panel; keys don't reach the 3-D view while it's open
- Recent searches: clicking the empty search box lists the last 10 picked colors (`localStorage`, newest first, deduped)

**Fixed**
- Mini object turned black after the RGB ↔ HSL toggle: the shader normalized a zero highlight vector (NaN), and a pick only set the highlight on the visible material; the shader now guards the zero case and both materials are updated
- Sphere textures were upside down (black/low-G pole on top, back face in front); the mapping is turned 180° about x so lightness and G point up, matching the cube
- HSL cube seams: top/bottom used a circular angle and radius that didn't line up with the sides (edges differed by up to 82/255); they now use a square mapping so each edge carries the same hue run and saturation as its side. The sides' per-layer hue narrowing was removed so adjacent sides meet on inner layers. All 12 edges now match within 1/255 on every layer checked
- Result rows in the autocomplete were unstyled (swatch, name, hex, rgb stacked); now swatch + name with hex/rgb underneath

**Modified**
- Controls ordered Dimension → Shape → Color space → Layer with field labels and even padding; "RGB ◯ HSL" toggle with the active side bold; hints under the layer box and Color Search; tab title "ColorVerse"
- Autocomplete hint and Enter/Tab completion keep the case the user typed ("C" → "Ceil")

---

## Milestone 8 — Color Navigation & Panel Flow `[ai-assisted]`
**2026-10-27**

Made any color reachable from any other through the UI, and reworked how Color Search and the details card share the panel. Design decisions (Saturate over a Mute row, slider behavior, one panel at a time, Esc priority, v1.1/v2/v3 roadmap) were directed by the developer after reachability simulations; implementation `[ai-assisted]`.

**Fixed**
- `3d-mode.js`: switching shapes now keeps the current layer and the toggle's color space (new Main/Mini/Preview objects were always RGB, so the HSL toggle drifted out of sync); zoom resets; the "Layer N" label is set on load
- `MainBase.js`: arrow keys no longer rotate the object while an input/select has focus
- Esc in the layer box no longer clears the selected color

**Added**
- Saturate harmony row: `s + (100 − s) × 20…100%`, the only harmony that raises saturation. Simulation: #9C869A → #FF0000 went from a 34-click rounding-drift path to 2 clicks; a matching Mute row saved 1 click across 13 test pairs, so it was left out
- `sliders.js`: H/S/L or R/G/B sliders (follow the HSL toggle) with live gradient tracks; synced via `basecolorchange` / `basecolorclear` events from `harmony.js`
- `harmony.clearBaseColor()` and a `← Search` button in the details card

**Modified**
- Search and details shown one at a time (CSS `:has()`); `← Search`, Esc, or clicking empty canvas goes back
- Esc priority: help panel → focused text box → back to search
- MVP/README roadmap: v1.1 Color Golf, v2.0 1-D/2-D, v2.x/v3 more shapes and color spaces

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
