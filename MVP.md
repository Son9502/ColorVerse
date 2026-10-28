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
| **v1.1** | Color Golf: clubs, putter, par, 18-hole courses, map view, yards ✅ (v1.1.0) | Builds only on v1 (3-D view, harmonies, the par search); no new renderer |
| **v1.1.1** | Hole lengths follow par; per-course difficulty (birdie line) ✅ | Golf realism plus a measured difficulty curve |
| **v1.1.2** | Perfect route solved in a Web Worker and replayed on the map ✅ | Finishes the v1.1 spec |
| **v1.1.3** | Thicker map paths ✅ | Readability |
| **v1.2** | Color Golf hazards (sand, water), wind, Cobalt Bay and Royal Indigo ✅ (v1.2.0) | Adds route choice once the core game is solid |
| **v1.3** | Daily hole + practice by difficulty | Reuses the generator and par solver |
| **v2.0** | 1-D and 2-D modes + shared color across dimensions | Delivers the "multi-dimensional" promise; new renderers and shared state |
| **v2.x / v3** | More shapes and color spaces | v2.x if they reuse the 3-D pipeline; v3 if they need a new color model throughout |

### v1.1: Color Golf (minigame)
Get from a start color (the **tee**) to a target color (the **hole**) in as few harmony moves (**strokes**) as possible. Developed on the `feature/color-golf` branch.

**Clubs (the harmony rows)**

| Club | Rows | Shot |
|---|---|---|
| Driver | Complementary, Triadic, Tetradic | Big fixed hue jumps |
| Irons | Split-Complementary, Analogous | Medium hue moves |
| Wedges | Tints, Shades, Tones, Saturate | Lightness/saturation moves in 5 strengths (20–100%); over- and undershooting is part of the skill |
| Putter (game mode only) | New row | Small nudges of hue, saturation or lightness (±3–5%), so a near miss can be finished |

**Rules**
- A stroke is a double-click on a harmony swatch. Clicking the 3-D shape, the sliders and search are all disabled in game mode.
- **In the hole:** OKLab distance to the target < 0.02 (looks the same side by side).
- **On the green:** 2 putts or fewer will hole it (checked exactly after each stroke). A plain distance cutoff (< 0.05) left 18% of "green" spots needing 3+ putts, so the green is defined by putts, as in golf. The meter's bar follows distance; its label reads Rough → Fairway → Close → On the green → In the hole.
- **Perfect and par:** *perfect* is the fewest strokes possible (including putts), found by a breadth-first search over the clubs. *Par* sits above it, so beating par is possible:

  | Hole | Perfect | Par | Best possible |
  |---|---|---|---|
  | Par 3 | 2 | 3 | Birdie |
  | Par 4 | 3 | 4 | Birdie |
  | Par 5 | 3 or 4 | 5 | Eagle or birdie |
  | Ace hole (one per course) | 1 | 3 | Hole in one |

  The end-of-hole card shows "Perfect: N" next to the score.
- **Pick up at double par:** a hole ends at double par and that score is recorded.
- **Lip-outs:** every par 3 has a tee swatch that looks almost like the target but misses the hole (OKLab 0.02–0.05), so a close match is never a sure ace. The ace hole has both an ace swatch and a lip-out.
- **No checking before you swing:** swatches show their color, but the closeness meter only updates after a stroke.
- **Undo:** 1 per 9 holes, and it doesn't count as a stroke.
- **Score:** strokes relative to par (birdie, par, bogey…); total time breaks ties.
- **Exact state:** track HSL exactly instead of re-deriving it from rounded RGB each stroke, so rounding drift near black/white can't create shortcuts that par doesn't know about.

**Courses**
- An 18-hole round = front 9 + back 9, with a fixed, seeded set of holes per course so every player gets the same course.
- Holes are generated ahead of time by `npm run courses` (seeded) into `src/golf/courses.json`.
- **Length follows par** (v1.1.1): par 3 under 250 yds, par 4 250–400, par 5 over 350.
- **Difficulty** (v1.1.1) is the *birdie line*: how many of the 41 first shots keep the perfect score reachable. Each course accepts holes only in its range: Beginner 6+, Standard 3–6, Expert 1–3 (ace holes excepted). Measured averages: Prism Point (Beginner) 9.7, Ember Dunes 3.9, Verdant Pines 4.4. Making par stays comfortable on all (26–33 of 41 first shots keep par).
- Each course keeps its tees and targets in one part of the color wheel, so its name says how it plays (routes can still pass through other hues):

  | Course | Hues | Par | Release |
  |---|---|---|---|
  | Prism Point | Full spectrum | 72 | v1.1 |
  | Ember Dunes | Reds, oranges, yellows (345°–60°) | 72 | v1.1 |
  | Verdant Pines | Greens (75°–165°) | 72 | v1.1 |
  | Cobalt Bay | Blues and teals (180°–250°) | 71 | v1.2 |
  | Royal Indigo | Purples (250°–320°) | 70 | v1.2 |
- Par 71/70 courses swap par 5s for par 3s (layouts in `generateCourses.mjs`).
- Score card per hole and per 9; best round saved in the browser.

**Screen**
- Two large swatches across the top: *You* | *Target*, plus strokes, par, timer, undo left and the closeness meter.
- **? (How to play):** goal, the four club types, what the meter means, par vs perfect, undo and pick-up.
- **Card:** live score card (front 9 / back 9, "Thru N: ±X"), with the hole in progress highlighted; a hole's perfect score stays hidden until it's played.
- The 3-D shape becomes a **map**: a ball for the current color, a flag at the target's spot, and a trail along the surface linking each stroke. The view peels to the current color's layer and turns that spot toward the camera after every stroke. Clicking it does nothing. Spots are found by searching the same functions that draw the textures (`golf/map.js`), so markers always match what's drawn; very vivid colors that the RGB sphere doesn't contain go to its closest color.
- End-of-hole card with score and "Show perfect route": the solver (in a Web Worker) finds the route, then a gold ghost ball replays it on the map stroke by stroke while the list of clubs fills in; end-of-round score card.
- **Yards:** OKLab distance × 1000. Hole length under the title; after each stroke, the last shot's length and the yards left to the pin.
- Leaving game mode restores the normal app (sliders, search, canvas picking).

### v1.2: Hazards
- **Shape:** a hazard is a "looks-like" region: a center color and a radius in yards (OKLab distance × 1000, 30–60 yds). A color is inside if its distance to the center is under the radius, measured the same way as yards and the hole.
- **Water:** landing in it costs +1 penalty stroke and the ball returns to where it was hit from (stroke and distance).
- **Sand:** landing in it is allowed; the next shot must be a wedge (Tints, Shades, Tones, Saturate). No drivers, irons or putter until the ball is out, as in golf. Measured over all 59 bunkers: any one wedge can escape, but each of the four is the only best recovery on some bunkers (all four: 2.31 strokes to the hole on average; Tones alone 2.83, Saturate alone 3.47). A "sand wedge only" rule is a possible Expert lever.
- The tee and the hole are never inside a hazard. Undo works as usual (1 per 9).
- **Solver stays exact:** both rules depend only on the current color, so the search is unchanged in size. Water landings are skipped (always 2 wasted strokes); from sand only the wedges are tried. Perfect is the true minimum with hazards, so a route through a bunker can be the best one.
- **Placement (generator):** water goes on a landing spot of the hole's hazard-free perfect route, forcing a layup or dogleg; bunkers guard the hole (centers 40–90 yds from the target, often beside the lip-out). Some holes deliberately keep a bunker on the new perfect route as a risk/reward line. Every hole is re-checked: perfect still under par, finishable within par with all hazards treated as blocked, and inside the course's difficulty range.
- **Map:** each hazard's footprint is traced on the layer being viewed: the layer's colors inside the hazard, as a sand or water patch (with drifting ripples). Since the ball is always on that layer, it's inside a patch exactly when it's in the hazard (checked on 3,403 landings: never drawn inside a hazard it isn't in). If a hazard doesn't reach the layer, a faint outline and its icon show where it is.
- **No swatch warnings:** swatches don't flag hazard landings; the map shows the hazards, the same way a golfer can see a lake but has to judge the shot. The game panel reports what happened: "In the bunker: wedges only" (other rows grey out) or "Water! +1 stroke, playing again from your last spot".
- **Map details** (all in v1.2):
  - **Edge rings:** a crisp outline around each hazard's footprint on the current layer.
  - **Icons:** a small wave or sand icon at each hazard's center, so hazards on other layers are still visible.
  - **Yardage to hazards** in the game panel: "Water: 120 yds to carry", "Bunker: 40 yds short of the pin".
  - **Hole summary:** "2 bunkers, 1 lake" under the hole title and on the score card.
  - **Faint footprints on nearby layers:** a faint halo traced around each footprint for colors up to 30 yds outside the hazard (they fall inside it a few layers in or out), so you see a hazard coming as you change layers.
  - **Landing highlight:** landing in a hazard flashes its outline, so it's clear which one caught you.
- **Wind:** each hole can have a fixed wind, e.g. "Wind 6° ↻" (hue drifts clockwise) or "Wind: brightening +3%". After every full shot, the landing color drifts by that much. Putts are unaffected (greens are sheltered). Shown in the game panel and as an arrow on the map. Players aim upwind: if the target is +40° of hue and the wind adds 6°, two Analogous +20° shots end at +52°.
  - Wind is fixed for the whole hole, so the par solver applies it to every full shot and par/perfect stay exact. No gusts that change shot to shot, since those would make true par impossible to compute.
  - Applies to every harmony club (wedges included); the drift happens before the hazard check, so wind can push a shot into water or out of a bunker. Swatches show the calm landing, so players aim off.
  - Generator: wind is chosen per hole from its own seeded sequence and kept only if the hole passes the same checks with it (perfect unchanged, finishable within par avoiding hazards, birdie line in range); otherwise the hole is calm (usually aces and layups).
  - By course: Prism Point calm; Verdant Pines light (±2–4° hue, 18 holes); Ember Dunes steady (±4–8° hue or ±2–4% lightness, 15 holes); Cobalt Bay (16 holes) and Royal Indigo (14 holes) strong (±8–12° hue or ±4–6% lightness).
  - Shown as a line under the hole info and a badge over the map ("🌬 −6° hue ↺").
- Hazards by course (the name says what to expect):

  | Course | Hazards |
  |---|---|
  | Prism Point | A few bunkers on the back 9 (beginner course) |
  | Ember Dunes | The sand course: bunkers on most holes, often guarding the hole |
  | Verdant Pines | Light sand: a "tree-lined" course with few hazards |
  | Cobalt Bay | Water: lakes in color space to route around |
  | Royal Indigo | Sand and water: the hardest course |

### v1.3: Daily Hole and Practice
- **Daily hole:** one seeded hole per day, the same for everyone; best score and streak saved in the browser.
- **Practice:** endless random holes filtered by difficulty (par range), with hazards on or off.
- **Pro setting:** swatches show only the club name (e.g. "Tints 60%"), not the color, so play is on color theory alone.

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
