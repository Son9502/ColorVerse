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
| **v1.2.1** | Golf map uses HSL during a game ✅ | The RGB sphere doesn't contain the most vivid colors, so markers and hazard footprints can't match there |
| **v1.3** | Daily hole, practice, Pro, Expert you can feel ✅ (v1.3.0) | Reuses the generator and par solver |
| **v1.4** | Golf variety: peeling, named-wedge bunkers on Expert, themed par layouts ✅ (v1.4.0) | Makes courses and layer changes feel distinct |
| **v1.5** | Engine cleanup: Three.js r128 → npm package; delete ShaderCache ✅ (v1.5.0) | Ends the r128 API gaps before v2.0's new renderers |
| **v1.6** | Accounts + score database, daily leaderboard, account-only courses 4–5 ✅ (v1.6.0–v1.6.2; Firebase project `colorverse-9efa3`) | Gives the daily hole real stakes; the only backend work, best done before the codebase grows |
| **v1.7** | Mobile and accessibility ✅ (v1.7.0) | Golf needs double-clicks, drags and color vision today; fix that before adding more views |
| **v1.8** | Expansion pack: 7 account-only courses (portals, mirror greens, club bans, turning wind, roulette, flip, survival) | Reuses accounts, unlocks and the generator; new rules stay solver-exact |
| **v2.0** | 1-D and 2-D modes + shared color across dimensions | Delivers the "multi-dimensional" promise; new renderers and shared state |
| **v2.1** | Golf in 2-D | A flat map shows a whole hole at once (no far side of a sphere) |
| **v2.2** | More 3-D shapes: HSL cylinder, HSV cone / bicone | Reuses the 3-D pipeline |
| **v3.0** | Perceptual color spaces: OKLab / OKLCH, CIELAB / LCh, gamut views | A new color model throughout; golf already scores in OKLab |
| **v4.0** | Palette studio | Turns harmonies into something designers keep and export |
| **v5.0** | Image colors | Brings your own colors into the space |
| **v6.0** | Social golf | Builds on v1.6 accounts |
| **v7.0** | Learn and explore | Everything above, taught and opened up (offline, WebXR) |

### v1.1: Color Golf (minigame)
Get from a start color (the **tee**) to a target color (the **hole**) in as few harmony moves (**strokes**) as possible. Developed on the `feature/color-golf` branch.

**Clubs (the harmony rows)**

| Club | Rows | Shot |
|---|---|---|
| Driver | Complementary | The longest hue jump (average 319 yds) |
| Wood | Split-Complementary | Long hue jumps (305 yds) |
| Hybrids | Triadic, Tetradic, Double-Complementary | Big hue jumps (253–270 yds) |
| Iron | Analogous | Short hue moves (92 yds) |
| Wedges | Tints, Shades, Tones, Saturate | Lightness/saturation moves in 5 strengths (20–100%); over- and undershooting is part of the skill |
| Putter (game mode only) | New row | Small nudges of hue, saturation or lightness (±3–5%), so a near miss can be finished |

Club types (v1.3) are ranked by average shot length over tee-like colors, and shown as a small label above each row's harmony name in a game (DRIVER / Complementary); the harmony names stay, since they're what the game teaches and what Pro's "+120°" labels refer to.

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
  | Ember Dunes | Reds, oranges, yellows (345°–60°) | 73 (v1.4) | v1.1 |
  | Verdant Pines | Greens (75°–165°) | 70 (v1.4) | v1.1 |
  | Cobalt Bay | Blues and teals (180°–250°) | 71 | v1.2 |
  | Royal Indigo | Purples (250°–320°) | 70 | v1.2 |
- Par 71/70 courses swap par 5s for par 3s (layouts in `generateCourses.mjs`).
- Score card per hole and per 9; best round saved in the browser.

**Screen**
- Two large swatches across the top: *You* | *Target*, plus strokes, par, timer, undo left and the closeness meter.
- **? (How to play):** goal, the four club types, what the meter means, par vs perfect, undo and pick-up.
- **Card:** live score card (front 9 / back 9, "Thru N: ±X"), with the hole in progress highlighted; a hole's perfect score stays hidden until it's played.
- The 3-D shape becomes a **map**: a ball for the current color, a flag at the target's spot, and a trail along the surface linking each stroke. The view peels to the current color's layer and turns that spot toward the camera after every stroke. Clicking it does nothing. Spots are found by searching the same functions that draw the textures (`golf/map.js`), so markers always match what's drawn; During a game the map is always the HSL version of the shape (v1.2.1).
- End-of-hole card with score and "Show perfect route": the solver (in a Web Worker) finds the route, then a gold ghost ball replays it on the map stroke by stroke while the list of clubs fills in; end-of-round score card.
- **Yards:** OKLab distance × 1000. Hole length under the title; after each stroke, the last shot's length and the yards left to the pin.
- Leaving game mode restores the normal app (sliders, search, canvas picking).

### v1.2: Hazards
- **Shape:** a hazard is a "looks-like" region: a center color and a radius in yards (OKLab distance × 1000, 30–60 yds). A color is inside if its distance to the center is under the radius, measured the same way as yards and the hole.
- **Water:** landing in it costs +1 penalty stroke and the ball returns to where it was hit from (stroke and distance).
- **Sand:** landing in it is allowed; the next shot must be a wedge (Tints, Shades, Tones, Saturate). No drivers, irons or putter until the ball is out, as in golf. Measured over all 59 bunkers: any one wedge can escape, but each of the four is the only best recovery on some bunkers (all four: 2.31 strokes to the hole on average; Tones alone 2.83, Saturate alone 3.47). Expert bunkers (v1.4) each name a single wedge.
- The tee and the hole are never inside a hazard. Undo works as usual (1 per 9).
- **Solver stays exact:** both rules depend only on the current color, so the search is unchanged in size. Water landings are skipped (always 2 wasted strokes); from sand only the wedges are tried. Perfect is the true minimum with hazards, so a route through a bunker can be the best one.
- **Placement (generator):** water goes on a landing spot of the hole's hazard-free perfect route, forcing a layup or dogleg; bunkers guard the hole (centers 40–90 yds from the target, often beside the lip-out). Some holes deliberately keep a bunker on the new perfect route as a risk/reward line. Every hole is re-checked: perfect still under par, finishable within par with all hazards treated as blocked, and inside the course's difficulty range.
- **Map:** each hazard's footprint is traced on the layer being viewed: the layer's colors inside the hazard, as a sand or water patch (with drifting ripples). Since the ball is always on that layer, it's inside a patch exactly when it's in the hazard (checked on 3,403 landings: never drawn inside a hazard it isn't in). If a hazard doesn't reach the layer, a faint outline and its icon show where it is.
- **No swatch warnings:** swatches don't flag hazard landings; the map shows the hazards, the same way a golfer can see a lake but has to judge the shot. The game panel reports what happened: "In the bunker: wedges only" (other rows grey out) or "Water! +1 stroke, playing again from your last spot".
- **Map details** (all in v1.2):
  - **Edge rings:** a crisp outline around each hazard's footprint on the current layer.
  - **Icons:** a small wave or sand icon on each hazard's footprint (v1.3; it was at the hazard's own spot, which could sit beside the footprint), or at its spot when the hazard doesn't reach the layer shown.
  - **Tee marker** (v1.3): a "T" where the player's path and the perfect route both start.
  - **Yardage to hazards** in the game panel: "Water: 120 yds to carry", "Bunker: 40 yds short of the pin".
  - **Hole summary:** "2 bunkers, 1 lake" under the hole title and on the score card.
  - **Faint footprints on nearby layers:** ~~a faint halo around each footprint~~ removed in v1.3: its traced outline came out spiky and read as a smear. A hazard that doesn't reach the layer shown keeps its faint outline.
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

### v1.3: Daily Hole and Practice ✓
- **Daily hole:** one hole per day, the same for everyone, built ahead of time (`npm run daily`, to 2028-12-31) so every browser gets exactly the same hole. Weekly rotation: Ace Sunday (par 3, one swatch holes it), Easy Monday (par 3), Tuesday (par 4), Windy Wednesday (par 4, bunker, wind), Long Thursday (par 5, bunkers), Water Friday (Expert par 4, lakes, strong wind), Championship Saturday (Expert par 5, lakes and bunkers). One scored try: the first stroke starts it, and leaving counts as a pick-up; replays afterwards aren't scored. Result and streak saved in the browser.
- **Practice:** endless random holes by difficulty (Beginner / Standard / Expert) and par (any, 3, 4, 5), with hazards and wind on or off. Unlimited undo, nothing saved. The first hole comes from a pre-built starter pool (`npm run practice`, 6 per setting); the next one is built while you play.
- **Expert you can feel:** Expert (courses, the Friday/Saturday dailies, practice) always plays as Pro, hides the yardage, meter and hazard distances until you're on the green, and uses Expert par: par = perfect on par 3s and 4s, perfect 4 on par 5s, so birdies only come on par 5s. Cobalt Bay and Royal Indigo were regenerated for it (old bests on them no longer show).
- **Perfect line:** each hole shows how many of the 41 first shots keep the perfect score reachable (Beginner 6+, Standard 3–6, Expert 1–3), so difficulty is visible.
- **Pro setting:** a Colors ◯ Clubs toggle. With Clubs, swatches are blank and show only the club ("+120°", "60%", "Hue −"; the row name is above), so play is on color theory alone. Applies to courses, daily and practice; Pro bests are kept separately.

### v1.2.1: Golf Map in HSL ✓
- During a game, the map uses the HSL version of the current shape (the toggle is hidden in game mode). Leaving the game restores the user's choice.

### v1.4: Golf Variety ✓
- **Peeling that looks like peeling:** a jump to another layer (a Color Golf stroke, or typing a layer number) peels. Going deeper, a copy of the old shell lifts off (grows about 20% and fades over 0.65 s) over the new layer; coming back out, the new layer settles down onto the shape. One-step changes (scroll, `]` / `[`) keep the smooth cross-fade, which would look jittery if every step peeled.
- **"Sand wedge only" on Expert:** every Expert bunker names the one wedge that can be played out of it ("Shades only"), shown in the panel and as letters on its map icon (Ti / Sh / To / Sa). Each bunker gets its own wedge, so each is its own puzzle; the generator picks it and re-checks the hole, and the solver and the rules use the same check. Applies to Royal Indigo (23 bunkers), the Championship Saturday dailies and Expert practice (Cobalt Bay has no sand).
- **Per-course par layouts:** Ember Dunes is long (par 73, 5 par 5s) and Verdant Pines is tight (par 70, 5 par 3s). Prism Point (72) and Cobalt Bay (71) keep their holes and bests; Royal Indigo (70) keeps its layout but was regenerated for the wedge rule. Regenerated courses get a new `rev`, so their old bests no longer show.

### v1.5: Engine Cleanup ✓
- **Three.js:** the installed npm package (r181) replaces the r128 CDN global, imported through one setup module (`src/three-setup.js`). Colors render exactly as before: automatic color management is off and the renderer writes pixels as-is (checked pixel for pixel against r128 screenshots). Golf uses the modern helpers (`removeFromParent`, `applyQuaternion`). Vite puts Three.js in its own cached chunk.
- **ShaderCache:** deleted. It was meant to cache one blended material per (color space, layer pair, face), but nothing read it: the textures (`TextureCache`) are the expensive part, and Three.js already reuses each compiled shader.
- Hex labels now round (127.5 → 128) like CSS, instead of truncating as r128 did, so they match the swatch shown.

Version numbers: minor versions keep counting past 9 (v1.9, v1.10, …). v2.0 is kept for the 1-D and 2-D modes, not for whatever comes tenth.

### v1.6: Accounts and Score Database
- **Backend:** Firebase (Auth, Firestore, Cloud Functions), since GitHub Pages is static. With no config in `src/cloud/config.js` the game runs offline-only, as before.
- **Sign-in or create account:** Google, email and password (v1.6.1: Create account, Forgot password, 8+ characters), or an emailed sign-in link with no password. The first sign-in asks for a nickname. A short privacy note; playing without an account still works.
- **Stored:** rounds, personal bests per course, daily-hole results and streaks, and a public daily leaderboard (top 10, nickname only).
- **Nicknames are unique** (v1.6.2), ignoring case and extra spaces: 2–20 letters, numbers, spaces and `_ - . '`. Only the `setNickname` function can set one, reserving it in `nicknames/` in the same transaction; renaming frees the old name and updates the player's leaderboard entries. Problems show in red under the box ("That nickname is taken.", "You already have this nickname.").
- **Change password** (v1.6.2) for email accounts: current password, then a new one (8+ characters, different); or a reset link by email.
- **Cheat-proof scores:** the browser submits the clubs played and the server replays them with the same code (`src/golf/replay.js`), so strokes, penalties and pick-ups can't be faked. Time and the Pro setting are still the browser's word.
- **Guest and account scores are kept apart:** signed out, the browser keeps the guest's bests and dailies; signed in, the screens show the account's (from the server, cached in the browser); signing out deletes the account's copy and brings back the guest's untouched.
- **Sync on sign-in:** rounds finished signed out wait in a queue and are sent on sign-in, where the server replays them (better course best wins). Only rounds finished after v1.6 can be sent; older local bests have no recorded clubs, so they stay in the browser. Queued rounds are tagged with who played them, so an account's offline rounds never go to another account.
- **Daily hole, one try per account per day:** a guest's try sent on sign-in counts as the day's try if the account has none, but never goes on the leaderboard; only a try whose first stroke reached the server while signed in is ranked. Replaying the daily signed out until it goes well and then signing in gains nothing. (Learning the hole in a private window first can't be prevented short of requiring an account for the daily.)
- **Account-only courses:** courses 1–3 are open to everyone; each later course needs an account and a good round on the course just before it (Pro or not): Cobalt Bay needs −6 or better on Verdant Pines (6 strokes above its perfect 50), Royal Indigo −3 or better on Cobalt Bay (whose perfect round is −6). The server refuses rounds on a course that isn't unlocked. The scores live in `UNLOCK_TO_PAR` in `src/golf/unlocks.js`, to tune after playtesting.
- **Score card:** a picked-up hole shows grey with a ✕ ("8✕"), so it doesn't rely on color alone; under-par holes stay red and bold.
- **End-of-round message** by score: perfect round, under par, level par, close to par (+1 to +6), or "Every round teaches the clubs".

### v1.8: Expansion Pack
Seven account-only courses after Royal Indigo, each built around one gimmick, the last a survival course. Harder and wackier than courses 1–5, but scored the same way: every hole still has an exact par and perfect, the solver can show the perfect route, and the score server replays rounds.

**The one rule for every gimmick:** what a stroke does may depend only on the color it's hit from, the hole and the stroke number on that hole, all known in advance. Then the solver (breadth-first search over whole-number HSL) stays exact and the server can replay a round from its clubs. Random bounces, gusts and moving pins are out.

**Courses** (each 18 holes; as with courses 1–5, a color in the name says where the course plays):

| # | Course | Colors | Gimmick | What it does |
|---|---|---|---|---|
| 6 | Violet Vortex | Violets and purples (250°–300°) | Portals | Landing inside a portal (a looks-like region, like a hazard) warps the ball to the portal's fixed exit color, which can be far outside the course's hues. Shortcuts across the wheel, and traps that send you backwards. |
| 7 | Silverglass Greens | Muted, grayish colors (saturation 10–45%), any hue | Mirrors | Land on a mirror region and the color's hex flips (#234243 → #342432), like a portal. (First specced as hue moves flipping inside a mirror; changed in v1.8.1, see Done.) |
| 8 | Caddie Strike | Full spectrum | Club bans | Each hole bans some clubs ("Irons only", "No Driver or Woods", "Wedges and putter only"); banned rows grey out, as in a bunker. |
| 9 | Saffron Whirlwind | Yellows and oranges (30°–65°) | Turning wind | The wind changes every shot in a short cycle known before you tee off ("+8° ↻, then −4% light, then calm, repeat"). Shown as the current and next wind. |
| 10 | Scarlet Roulette | Reds and pinks (330°–20°) | Roulette row | A new row whose one swatch cycles through 4 hue shifts, one per second (set per hole, e.g. +30°, +95°, −60°, +150°). The stroke plays whichever shift is showing when you tap; keyboard players get the 4 as separate swatches. |
| 11 | Hexflip Hollow | Full spectrum | Flip club | A new row of 5 swatches that move the color's hex digits left by 1–5 places (`A23432` → `23432A` → `3432A2` …). Wild jumps that are still predictable. |
| 12 | The Obsidian Gauntlet | Full spectrum, darker colors (lightness 15–50%) | Survival | Holes from all six gimmicks. Go over par on any hole and the round ends. Score: holes survived, then strokes, then time. Its own all-time top-10 leaderboard. |

**Unlocking:** a chain from Royal Indigo, as for courses 4–5: each course needs an account and a round at its unlock score or better on the course before it (Violet Vortex from Royal Indigo, Silverglass Greens from Violet Vortex, …; The Obsidian Gauntlet from Hexflip Hollow). Scores are set per course in `unlocks.js` once the courses are generated and measured (starting guesses: −2 on Royal Indigo, −4 on each expansion course).

**Difficulty:** Standard par rules (par above perfect), with the birdie line of Standard to Expert courses (1–4 of 41 first shots). No Expert hiding (yardage and the meter stay), since the gimmicks are the challenge.

**How it's built:**
- **Regions are hazards:** portals and black holes (v1.8.0) are hazard types (`hazards.js`: `portalAt`, `land`), so the round, the solver, the generator, the map and the server replay reuse the hazard code. Mirror greens will be one too.
- **Hole rules in one place:** gimmicks that aren't regions (bans, the wind cycle, roulette shifts) go in a `hole.rules` object read by one function the game, the solver, the generator and the server share, starting with v1.8.2.
- **New clubs at the end:** Roulette (4) and Flip (5) are appended to the club list after the putter, so recorded rounds from v1.6–v1.7 still replay. They appear only on holes that have them (like the putter row, which shows only in golf).
- **Solver:** Portals, mirrors, bans, roulette and flip depend only on the color, so the search is unchanged in kind. Turning wind adds "which shot in the cycle" to the state: memory × the cycle length (2–3), so the search stays exact.
- **Generator:** `generateCourses.mjs` gains a placement step per gimmick (portals on or across the hazard-free perfect route, mirror regions near the tee or the green, bans chosen so the perfect route must change, wind cycles and roulette sets kept only if the hole passes the usual checks). Every hole is re-checked: perfect under par, finishable within par, birdie line in range, and the gimmick must matter (the perfect route with it differs from the one without).
- **Map:** portals as a ring with a swirl icon and a dotted line to the exit; mirror regions as a silver patch with a ⇄ icon (the same footprint tracing as hazards); wind badge shows now → next.
- **Survival on the server:** a round may end early (the first hole over par); bests compare holes survived first. A `survival/{uid}` best per player feeds the top 10.
- **Help:** each course's card says its gimmick in a line, and "How to play" gains a section per gimmick.

**Done:** v1.8.0 Violet Vortex: 17 portal holes and the ace. Par 72, perfect 51; the perfect route always warps.
- After the first play-test (portals felt like a lucky guess): swatches that land in a portal have a dotted purple outline and a label (a chip of the exit color, then how far from the pin the ball comes out; the exit's hex in the tooltip); every par 3 and 4 is two strokes too long without its portal, so **par needs the portal** (par 5s: only the birdie does); **black holes** (a new hazard: +1 stroke and back to the tee).
- After the second: shorter tutorial; bigger black holes (35–55 yds, 3 per hole), some on tee shots (2–7 of the tee's swatches fall in); two new hole types: **chains** (holes 4, 11, 14: two or three portals in a row from the tee to beside the pin) and **mazes** (holes 5, 8, 13: about half the full shots go into one of 12–13 portals; one exit leads on, the decoys look closer but can't make the perfect score). Holes: tutorial 1; traps 2, 7, 10, 17; black holes 3, 6, 9, 12, 15, 18. A shortcut portal's exit is on the hole's best route; a trap's or decoy's is a seeded random color (250+ yds from the pin for a trap, 40–160 for a decoy).
- **Tutorial hole:** each gimmick course's hole 1 teaches its gimmick (the course's `tutorial` text, shown on hole 1, and a hole built so the gimmick is the way to par; Violet Vortex's has a bigger portal and no trap). Later expansion courses do the same.

**Done:** v1.8.1 Silverglass Greens: 18 mirror holes (saturation 12–45%, any hue), par 72, perfect 51.
- **Changed from the spec:** land on a mirror and your color's hex flips (#234243 → #342432), like a portal whose exit is your own color reversed. The hue-flip mirror only reshuffled the swatches, so it could never shorten or block a route; a Mirror club (+1 stroke) was built next and replaced by this.
- Holes are built round the mirrors, two strokes longer without them on par 3s and 4s, like Violet Vortex's portals. Chains (5, 11, 14) need two mirrors with a shot between; decoys reflect far from the pin; the ace flips into the hole.
- Swatches that land on a mirror are outlined (dotted silver) and labeled "⇄ N yds", where the flip leaves you.
- Tutorial boxes take the course's or the hazard's color, and bunkers, water and black holes get one on their first hole of a round.

**Done:** v1.8.2 Caddie Strike: 18 club-ban holes (full spectrum), par 72, perfect 51. `hole.rules` and `rules.js` now hold rules that aren't regions, shared by the round, solver, builder and server. Every ban costs at least a stroke; the line under the hole info names it and the banned rows grey out. No bunkers on this course (one could need a banned wedge).
- **Holes that make you think** (all courses but Prism Point, regenerated): the swatches that land closest to the pin never keep the perfect score (the closest 2 on Standard, 3 on Expert and expansion courses), and a perfect route plays like golf (putts only near the pin, no Driver or Woods into the hole). Greedy "closest swatch" play now makes perfect only on the aces.
- **Tester accounts:** `tester: true` on a user's Firestore record opens every course and a "Test a hole" card; nothing is sent.

**Done:** v1.8.3 Saffron Whirlwind: 18 turning-wind holes (30°–65°), par 72, perfect 49 (par 5s are eagle holes: three strokes of turning wind reach nearly every color). The cycle lives in `hole.rules.windCycle`; the solver tracks the wind's place in it, so it stays exact. The hole line shows the whole cycle, the map badge this stroke's wind and the next. No water or black holes on this course (penalty strokes turn the wind too).

**Done:** v1.8.4 Scarlet Roulette: 18 roulette holes (330°–20°), par 72, perfect 49. A Roulette row's wheel spins through four hue shifts set per hole, one a second, and a stroke plays the one showing; keyboard players get the four as separate swatches. Changed from the spec's intent: the roulette is the way to the perfect score, not to par (a hue shift can save one stroke at most).

**Done:** v1.8.5 Hexflip Hollow: 18 flip holes (full spectrum), par 72, perfect 49. A Flip row of five swatches moves the color's hex digits left by 1–5 places. Without the flips each hole is two strokes longer, so par needs one on the par 3s and 4s (the spec's "way to par", which the roulette couldn't reach).

**Order:** one course per release, each playable and committed before the next: v1.8.0 hole rules + Portals (Violet Vortex), v1.8.1 Mirror greens (Silverglass Greens), v1.8.2 Club bans (Caddie Strike), v1.8.3 Turning wind (Saffron Whirlwind), v1.8.4 Roulette (Scarlet Roulette), v1.8.5 Flip (Hexflip Hollow), v1.8.6 Survival (The Obsidian Gauntlet).

### v2.0: 1-D and 2-D Modes
Developed on the `feature/1d-2d` branch.
- **1-D, Line:** a gradient bar for the selected channel, with sliders to hold the other two channels.
- **2-D, Square:** plot the selected X-axis channel against the Y-axis channel, with a slider to hold the third channel.
- **2-D, Circle:** hue wheel (angle = hue, radius = saturation), with a slider to hold lightness.
- Both work in RGB and HSL, and clicking picks a color.
- **Shared state across dimensions:** a color picked in one dimension stays highlighted when you switch to another.

### Before v2.0: Housekeeping
- Run the remaining v1 live checks (first load under 3 s, 10 shape switches).
- Merge `main` into `feature/1d-2d`, which has drifted far behind.
- Playtest Expert by hand: its difficulty has only been measured by the solver.
- Playtest Verdant Pines and Cobalt Bay and tune `UNLOCK_TO_PAR` (v1.6) before the expansion pack builds on it.

### v1.7: Mobile and Accessibility ✓
- **Phone layout:** under 760 px wide the page is one column: title, then the 3-D view (42% of the screen, staying at the top while the rest scrolls), then the controls or golf panel, then the harmonies. Bigger swatches (40 px). The viewport meta tag is in place, so phones no longer show the desktop page shrunk.
- **Touch:** one finger drags to rotate, two fingers pinch to zoom (same limits as the wheel). A drag that ends over the shape no longer picks a color, on any device. Tap a swatch to choose it (explore) or play it (golf); on Expert the first tap aims (outlined, "Tap again") and a second tap on the same swatch plays, since its swatches are blank. Mice keep double-click; the double-click phones send after two taps is ignored.
- **Keyboard play:** every swatch is reachable with Tab; arrow keys move along a row and to the row above or below (collapsed rows skipped; the 3-D view ignores arrows while a swatch has focus); Enter or Space chooses or plays it.
- **Color names:** a "Color names" switch (explore controls and golf setup, one setting kept in the browser) describes colors in words ("dark muted teal", "pale blue") under every swatch, under the selected color, and under You / Target in golf. Pro and Expert still hide the swatches' names along with their colors. Distance as a number was already shown (yards to the pin; Expert keeps hiding it until the green, for everyone).
- **Screen readers:** swatches are buttons labeled with their hex and name; in golf, with the club ("Triadic +120°, vivid red"), or the club alone in Pro.

### v2.1: Golf in 2-D
- Play holes on the hue wheel (angle = hue, radius = saturation, a slider for lightness) or a square slice. The tee, the flag, both paths and the hazards are all visible at once, which fixes paths seeming to disconnect around the back of the sphere.
- The 3-D map stays available; the player picks the view.

### v2.2: More 3-D Shapes
- HSL cylinder and HSV cone / bicone, reusing the texture pipeline and the golf map search.

### v3.0: Perceptual Color Spaces
- OKLab / OKLCH and CIELAB / LCh as shapes. Color Golf already measures distance in OKLab, so this shows the space it scores in.
- **Gamut views:** where sRGB sits inside wider spaces such as Display P3.

### v4.0: Palette Studio
- Build palettes from harmonies and save them.
- Contrast checks (WCAG 2 and APCA) and colour-blindness simulation.
- Export as CSS variables, Tailwind config or JSON (replaces the old "export the selected color" idea).

### v5.0: Image Colors
- Drop in a photo and see its pixels as a point cloud inside the shape.
- Pull a palette out of the clusters.

### v6.0: Social Golf
- Course editor with share codes.
- Head-to-head races, weekly tournaments and friend leaderboards (needs v1.6).

### v7.0: Learn and Explore
- Guided color-theory lessons that use golf holes as exercises.
- Installable offline app (PWA).
- WebXR: walk around inside a color space.

---

## Definition of Done (v1)

- [x] Cube and sphere render correctly in both RGB and HSL
- [x] Color picking works on both shapes and updates the harmony panel
- [x] 1-D/2-D options are marked as coming soon or hidden
- [x] A muted color (e.g. #9C869A) can reach vivid red in a few harmony clicks (Saturate row)
- [ ] No console errors after 10 consecutive cube ↔ sphere switches
- [ ] The deployed URL loads to an interactive state in under 3 s
