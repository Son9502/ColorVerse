# DEVLOG — ColorVerse

A running log of development sessions, organized by milestone.
Each entry is tagged with how it was produced:

- `[manual]` — written/designed entirely by the developer
- `[ai-assisted]` — drafted or significantly shaped with AI (Claude, Copilot, etc.)
- `[collab]` — pair-programmed or collaboratively built with another person

---

## Milestone 31 — Survival: The Obsidian Gauntlet (v1.8.6) `[ai-assisted]`
**2026-11-01**

The last expansion course, from the agreed v1.8 spec; implementation `[ai-assisted]`.

**Added**
- `lights` (`holeMaker.js`): a lightness range beside `sats`, default 22–78% (the old fixed range), so every other course regenerates byte for byte (checked on seven covering every hole maker)
- The Obsidian Gauntlet (`generateCourses.mjs`, seed 12, full spectrum, lightness 15–50%, `EAGLE_LAYOUT`, par 72, perfect 49): portal, mirror, ban, turning wind, roulette and flip holes in turn, three each, built with their own courses' makers (`GAUNTLET_HOLES`, `mix`); `survival: true` on the course
- Survival (`game.js`): `GolfRound` ends at the first hole finished over par or picked up (`over`; `finished`; `nextHole` refuses), and its totals carry `survived`. `compareRounds` ranks holes survived first. `replayRound(holes, played, { survival })` returns `over` and refuses holes after the failure
- Score server: a survival round may stop at the hole that ended it (any other short round is still refused); bests carry `survived`; a public board per course version, `survival/{course}-r{rev}/scores/{uid}` (`survivalBoard`), keeps each player's best, Pro or not, and follows nickname changes. Firestore rules let anyone read it; a composite index (survived desc, strokes, time) serves the top 10
- Panel: no undos on the Gauntlet (the button hides); "Survival" in the hole info and as a term; "Round over: …" at the failing hole; the result says holes survived; the course card shows the survival best and an "All-time top 10"
- Score card: more than three of one hazard on a hole shows one dot and the count (a portal maze has twelve), so the column stays narrow (Violet Vortex too)
- Unlock: the Gauntlet needs −4 or better on Hexflip Hollow (provisional)

**Added after playtesting on a phone**
- The Gauntlet plays easiest first: holes sorted by how many tee shots still leave par reachable (`parLine`, `holeMaker.js`), then by the perfect line (`easiestFirst`, `resources/gimmicks.mjs`). The holes are the same; the old hole 2 (par reachable from 7 tee shots) is now 16
- Weekly Gauntlet: nine survival holes a week, the same for everyone, new each Monday by the player's local date (`WEEKLY_START`, `weekOf`, `daily.js`). `resources/generateWeekly.mjs` (`npm run weekly`) builds each week from its date into `weekly.json` (62 weeks, to 27 Dec 2027): every gimmick once plus three more at random, normal colors, easiest first. A card on the golf screen (best run this week, days until new holes, this week's top 10); no undos; opens with The Obsidian Gauntlet. Server: `kind: "weekly"` (only the week that's on now), each player's best on `survival/weekly-<Monday>-r1/scores/{uid}`
- The gimmick plans (`BANS`, `WHIRL`, `skipFor`, `gimmickHole`) moved to `resources/gimmicks.mjs`, shared by both generators (Caddie Strike and Saffron Whirlwind regenerate byte for byte)
- Survival's end message says what happened: "Over par on hole N, so the run ends here. Holes survived: …" (or "Picked up")
- Layers on touch screens: a − / slider / + row under the layer box steps and drags through the layers live (the `[` `]` keys' job), and leaving the box (Done on a phone's number pad, which has no Enter) jumps to a typed layer
- A layer typed but not jumped to no longer leaves its preview over the golf map: opening Color Golf clears the box
- Survival's end message is just where it ended: "Picked up on hole 4 (survived 3 holes)" (or "Over par …")
- Phones sideways (`@media (min-width: 761px) and (max-height: 520px)`): the page no longer scrolls (the 3-D view stays put; the left column scrolls by itself), a smaller title, 36 px swatches, and during a hole the left side splits into the hole and the swatches, each scrolling, beside the map. The hole puts the colors, meter, strokes and Next hole first; notes and lessons follow. Before, the hole filled all 390 px and the swatches got a 20 px strip
- Leaderboards (daily, survival courses, weekly Gauntlet) are tables: rank, player with a Pro tag, then score or holes / strokes, and time, your row in bold (`showBoard`). Their toggles are outlined pills with an arrow

**Verified**
- Every hole: perfect matches the solver with its gimmick; the round plays the perfect route to the perfect score; think and golf-like checks pass; tees and pins all at lightness 15–50%; courses 1–11 unchanged byte for byte
- `replayRound` (survival): a pick-up on hole 2 ends the round with 1 survived; a hole after it is refused; a perfect round is 18 survived, 49 strokes
- Emulators: locked until the chain is unlocked; a round out on hole 3 saved (2 survived); a hole after the failure, and a round stopped without failing, refused; a worse round isn't a best; a second player's 6 survived ranks below 18; the board takes a new nickname
- Headless Chrome: the card, "Survival" in the hole info, no undo, a pick-up ends the round ("0 of 18 holes survived"), the best on the card; no console errors
- Weekly: all 62 weeks have every gimmick, no hole without its gimmick, easiest first, and a perfect round that replays (9 survived, perfect 25 in week 1). Emulators: locked until the Gauntlet is; a run out on hole 4 saved (3 survived); a worse run isn't a best; a past week refused. Phone-width Chrome: the card, a run, the result
- Layers: slider, − / + and Done keep the canvas label and slider in step; a typed preview is gone once golf opens

---

## Milestone 30 — Flip: Hexflip Hollow (v1.8.5) `[ai-assisted]`
**2026-11-01**

The sixth expansion course, from the agreed v1.8 spec; implementation `[ai-assisted]`.

**Added**
- Flip clubs (`clubs.js`): five clubs (ids 45–49, after the roulette) that move the hex digits left by 1–5 places (`flipOf`; `mirrorOf` shares its hex-to-HSL step); full shots (wind blows them). On holes with `hole.rules.flip`; `ruleAllows` refuses them elsewhere, so the server's replay does too. `allStrikes(hsl, wind, roulette, flip)` keeps index = club id, with null in the roulette's places on a flip hole without one
- Solver: `searchFrom` / `reachesWithin` take `flip`; the worker passes it from the hole's rules
- `makeFlipHole` (`holeMaker.js`), sharing `makeExtraClubHole` with `makeRouletteHole`: pin first reached in exactly the perfect score with the flips, and without them the hole is two strokes longer; think and golf-like checks; birdie line out of 46
- Hexflip Hollow (`generateCourses.mjs`, seed 11, full spectrum, `EAGLE_LAYOUT`, par 72, perfect 49): par needs a flip on every par 3 and 4 (the ace included), and under par needs one on the par 5s
- Panel: a Flip row (on flip holes) of five swatches labeled ← 1 … ← 5, teal tutorial box, "flip" term, "perfect line … of 46"
- Unlock: Hexflip Hollow needs −4 or better on Scarlet Roulette (provisional)

**Fixed**
- v1.8.4: the panel worked out every club's landing, the roulette keys included, so on any hole without a roulette `strike` threw and the hole never finished drawing (every course but Scarlet Roulette). Rows a hole doesn't have are now skipped
- v1.8.4: a click on the roulette wheel focused it and opened the four keys, so a mouse could pick any shift without timing it; the keys now open only for keyboard focus. A strip beside the wheel lists the four shifts in order with the one showing highlighted (not clickable)

**Changed (after a club audit)**
- An audit of every hole (solver, one club taken away at a time) found three clubs that always land where another does: Tetradic +180° and Double-comp. +180° (Complementary) and Double-comp. +240° (Triadic −120°). `COPIES` (`clubs.js`) lists them; they stay in `CLUBS` so recorded rounds replay
- Golf shows a Long shots row (Driver · Woods · Hybrids) instead of the five long harmony rows: their eight distinct clubs by hue shift, +60° to +270°, each captioned with its shift (the swatch elements move there on entering golf and back on leaving, so exploring is unchanged). Caddie Strike's bans grey out swatches in it; its texts and the "ban" term say which shifts are the Driver, Woods and Hybrids
- The perfect line counts distinct clubs: "of 38" (42 with a roulette, 43 with flips). `perfectLine` sets `hole.lines`; the stored counts in `courses.json`, `daily.json` and `practice.json` were rewritten in place (13, 133 and 33 holes changed). The generator's birdie-line bands still count every club, so the holes don't change (Prism Point and Hexflip Hollow regenerate byte for byte)
- Audit results, for later trimming: reaching the perfect score on every course needs 36 of the 38 distinct clubs (Putter Sat − and Sat + are never needed); par needs 29. Cobalt Bay and Royal Indigo (Expert par) leave the least slack

**Notes**
- Flips 2 and 4 turn the channels round (about ±120° of hue, like Triadic); 1, 3 and 5 are the wild jumps, and every perfect route uses one of them

**Verified**
- Every hole: perfect matches the solver with the flips; the round plays the perfect route to the perfect score; without flips each hole takes two more strokes (the ace three); think and golf-like checks pass; courses 1–10 unchanged byte for byte
- `replayRound`: a perfect round is 49; a flip club on a hole without flips, and a roulette club on a flip hole, are refused

---

## Milestone 29 — Roulette: Scarlet Roulette (v1.8.4) `[ai-assisted]`
**2026-10-31**

The fifth expansion course, from the agreed v1.8 spec; implementation `[ai-assisted]`.

**Added**
- Roulette clubs (`clubs.js`): four hue shifts per hole (`hole.rules.roulette`), clubs 41–44 after the putter so recorded rounds keep their ids; full shots (wind blows them). `allStrikes` and `strike` take the hole's shifts; `STANDARD_CLUBS` are every hole's 41. `ruleAllows` refuses a roulette club on a hole without one, so the server's replay does too
- Solver: `searchFrom` / `reachesWithin` take `roulette` (45 shots from each state)
- `makeRouletteHole` (`holeMaker.js`): four shifts 10–170° either way, none within 4° of a harmony shift and 15° apart; pin first reached in exactly the perfect score with them; without the roulette the hole is a stroke longer; think and golf-like checks; birdie line counted out of 45
- Scarlet Roulette (`generateCourses.mjs`, seed 10, 330°–20°, par 72, perfect 49, par 5s eagle holes as on Saffron Whirlwind, `EAGLE_LAYOUT`)
- Panel: a Roulette row (on roulette holes) whose wheel spins through the four shifts, one a second, showing each one's calm landing and shift; a click or tap plays whichever is showing (Expert: tap to aim, tap again). Four keys, the same shifts as separate swatches, open while one has keyboard focus, for keyboard and screen-reader players. Red tutorial box, "roulette" term, "perfect line … of 45"
- Unlock: Scarlet Roulette needs −4 or better on Saffron Whirlwind (provisional)

**Tried and dropped**
- Needing the roulette for par (two strokes saved, as on Violet Vortex): 0 holes in 300 tries; the harmony clubs reach any hue within a few strokes, so a hue shift saves one stroke at most. The roulette is the way to the perfect score instead
- Par 5s with a perfect score of 4 (as with Saffron Whirlwind: four extra shifts make nearly every color reachable in three)

**Verified**
- Every hole: perfect matches the solver with its roulette; the round plays the perfect route to the perfect score; every perfect route uses the roulette once and without it each hole takes one more stroke; think and golf-like checks pass; courses 1–9 unchanged byte for byte
- `replayRound`: a perfect round is 49; a roulette club on a hole without one is refused
- Headless Chrome: the wheel turns each second and a click plays the shift showing (You becomes the wheel's color); the keys open on focus; hole 1 played to a birdie; no console errors

---

## Milestone 28 — Turning wind: Saffron Whirlwind (v1.8.3) `[ai-assisted]`
**2026-10-31**

The fourth expansion course, from the agreed v1.8 spec; implementation `[ai-assisted]`.

**Added**
- Turning wind (`rules.js`: `windCycle`, `windFor`, `windOptions`): a cycle of 2–3 winds (at most one calm), one per stroke counting from the tee, penalties included; putts stay sheltered. The round plays each stroke in `windFor(hole, strokes)`, so the server's replay does too
- Solver: a search state is a color and the wind's place in the cycle ("node" = code × turns + phase), so it stays exact; the tables grow by the cycle's length. `dist` and `reached` stay per color, so `parFor` is unchanged; `pathTo` follows nodes. `reachesWithin` takes `played` (strokes before the start). With no cycle every course solves exactly as before
- `makeWindHole` (`holeMaker.js`): random cycle (hue 6–12°, light 3–6%, either way), pin first reached in exactly the perfect score in that wind, and the wind must matter (a tee swatch that keeps the perfect score in calm air doesn't in this wind); birdie line 1–4, think and golf-like checks. Birdie lines and the think check use the first stroke's wind, then the cycle
- Saffron Whirlwind (`generateCourses.mjs`, seed 9, 30°–65°, par 72, perfect 49): every hole turning, the tutorial's a two-wind cycle. Par 5s are perfect 3 (eagle chances): three strokes of turning wind reach nearly every color, so a pin that truly needs four was too rare (one par 5 took 2 minutes and 2,977 tries without one). No water or black holes, since their penalty strokes would turn the wind and the solver skips them
- Panel: "Turning wind, one per stroke: … → …, then again (putts aren't affected). This stroke: …"; the map badge shows "now … · next …" and updates every stroke; portal and mirror outlines and the perfect-route replay use each stroke's wind; yellow tutorial box; How to play
- Unlock: Saffron Whirlwind needs −6 or better on Caddie Strike (provisional)

**After review** (the developer: windier, the wind line as "Wind (per stroke)" / "This stroke", more undos, and a shorter How to play with gimmick words that explain themselves)
- Stronger turning wind: hue 12–24° (was 6–12°), light 6–10% (was 3–6%); the tutorial's two winds are never calm. Regenerated: in this wind the calm perfect route misses on all 18 holes; greedy play +43. "Putts aren't affected" moved to the course card and tutorial
- Wind line: "Wind (per stroke): … → …" then "This stroke: …"; a fixed wind reads "Wind: … on every full shot"
- Undos: 5 for a whole round (was 1 per nine), 1 on the daily hole, unlimited in practice and test rounds (`UNDOS_PER_ROUND`, `UNDOS_DAILY` in `game.js`). The server replays only the strokes kept, so it doesn't count them; 5 rather than 10 for that reason
- Terms (`terms.js`): gimmick and difficulty words in the hole info, the rule and wind lines, the course cards and the daily card are buttons with a dotted underline; hover or focus shows a short explanation, a click or tap pins it with an example (Esc, a click elsewhere or a scroll closes). Bunker, lake, portal, black hole, mirror, Caddie strike / bans, wind, turning wind, perfect line, Pro, Beginner, Standard, Expert, Expansion
- How to play keeps the clubs, the meter, par and undos; the gimmick, daily, practice and difficulty paragraphs are gone (terms and the cards say it now). The daily card says what the daily hole is, the practice card that you choose the difficulty
- Fixed: course Play buttons stopped working once their cards held term buttons (`renderCourses` took the card's first button)

**Verified**
- Every hole: perfect matches the solver in its wind cycle, the round plays the perfect route to the perfect score, and `replayRound` of a perfect round is 49; think (3) and golf-like checks pass; courses 1–8 unchanged byte for byte
- In this wind the calm perfect route misses on 15 of 18 holes; a greedy closest-swatch player is +31
- Headless Chrome: holes 1–3 played to birdies; the wind line and badge turn with each stroke; no console errors

---

## Milestone 27 — Club bans: Caddie Strike (v1.8.2) `[ai-assisted]`
**2026-10-31**

The third expansion course, from the agreed v1.8 spec; implementation `[ai-assisted]`.

**Added**
- Hole rules (`rules.js`): gimmicks that aren't regions live in `hole.rules`, read by one module the round, the solver, the hole builder and the server's replay share. First rule: club bans, `{ ban: [row, …], name }`. `ruleAllows` (the round's `canPlay`, so the replay refuses a banned club too), `clubMask` (the solver's loops: `searchFrom` / `reachesWithin` take `rules`). With the putter banned, "on the green" only counts a ball already in
- `makeBanHole` (`holeMaker.js`): the pin is a color the allowed clubs reach in exactly the perfect score while every club together reaches it in fewer, so each ban costs at least a stroke (two on hole 4); putts alone can't hole it; birdie line 1–4 counting allowed clubs
- Caddie Strike (`generateCourses.mjs`, seed 8, full spectrum, par 72, perfect 51, no hazards: a bunker would need wedges a hole might ban). Bans: No Driver or Woods (1, 7, 14), No putter (2, 10), No Hybrids (3, 12), No Wedges (4, 11, 16), No Driver, Woods or Iron (5, 13), No Tints or Shades (6, 15), No Woods or Wedges (8, 18), Hybrids, Iron and putter only (9, 17)
- Panel: "Caddie strike: … on this hole" under the hole info; banned rows grey out as in a bunker, and blocked swatches are `aria-disabled`; orange tutorial box on hole 1; How to play
- Unlock: Caddie Strike needs −4 or better on Silverglass Greens

**Tried and dropped**
- "Wedges and putter only": wedge moves go in any order, so 11–16 first shots keep the perfect score, far over the 1–4 band. "No Iron": one short row rarely costs a stroke. "No putter" and "No Wedges" on par 3s: the putter never saves a stroke on a par 3, and a no-wedge par 3 only cost one when putts alone could hole it

**After review** (the developer: a tester account; holes that make you think instead of rewarding the closest swatch; putts only near the green and no driver into the hole; difficulty and gimmicks should mean something)
- Tester accounts: `tester: true` on `users/{uid}` (set in the Firebase console; players can't write their record) opens every course on the live site, as `npm run dev:unlocked` does locally. Either way a "Test a hole" card plays any course from any hole (unlimited undo, nothing sent, no confirm on quit), and dailies aren't scored
- "Make you think" (`thinks`, `holeMaker.js`): on every hole but the ace, none of the closest tee shots to the pin (after portals and mirrors, allowed clubs only) keeps the perfect score: 2 on Standard courses, 3 on Expert and expansion courses, none on Prism Point. Measured first: the closest swatch led the perfect route on up to 9 of 18 holes (Caddie Strike), and at least one of the closest 3 kept the perfect score on 7–16 holes per course
- Golf-like routes (`searchFrom`'s `golf`, `playsLikeGolf`): a perfect route must exist with the putter only near the pin (within 80 yds, about two putts) and no Driver or Woods into the hole; "Show perfect route" shows that one
- `buildHole` rebuilds a hole (up to 80 tries) until it passes, when the course asks (`THINK` in `generateCourses.mjs`); the daily holes and practice don't, so they build exactly as before
- Regenerated: Ember Dunes and Verdant Pines (rev 3), Cobalt Bay (rev 3), Royal Indigo (rev 4), Violet Vortex (rev 4), Silverglass Greens, Caddie Strike. Prism Point unchanged. A player who always takes the swatch closest to the pin now makes perfect only on the aces (before: 2–8 holes per course) and plays Verdant Pines at +35 (before +5), Royal Indigo at +50 (before +33)
- Unlock scores reset for the harder courses (`unlocks.js`), from a simulated player who plans one shot ahead: Cobalt Bay −4 on Verdant Pines (was −6), Royal Indigo +2 on Cobalt Bay (was −3), Violet Vortex +4 on Royal Indigo (was −2), Silverglass Greens −3 on Violet Vortex (was −4), Caddie Strike −2 on Silverglass Greens (was −4)
- Caddie Strike's bans moved to fit: "No Wedges" only on the ace, "No putter" once, par 5s "No Tints or Shades" or "Hybrids, Iron and putter only"

**Verified**
- Every hole: perfect matches the solver under its ban; without the ban the perfect score is lower; no perfect route uses a banned club
- After the regeneration: every course's stored perfect matches the solver and its perfect round replays exactly through `replayRound`; every hole passes its course's think check and has a golf-like perfect route; portals and mirrors are still needed (par 3s and 4s over par without them, the ace aside), and every ban still costs a stroke
- `replayRound`: a perfect round is 51; a banned club is refused
- Headless Chrome: holes 1–4 played to birdies; a double-click on a banned swatch plays nothing; no console errors

---

## Milestone 26 — Mirrors: Silverglass Greens (v1.8.1) `[ai-assisted]`
**2026-10-31**

The second expansion course. The mirror went through three designs with the developer; the last is the developer's: land on a mirror and your color's hex flips. Implementation `[ai-assisted]`.

**Added**
- Mirrors (`hazards.js`): a region type that works like a portal, but the ball comes out at its own color with the hex reversed (#234243 → #342432, `mirrorOf` in `clubs.js`, back to whole-number HSL), once, for no extra stroke. `land` covers portals and mirrors, so the round, the solver, the birdie-line count and the server's replay all follow it. Every other region wins over a mirror. Water and black holes are judged where a ball lands, not where a warp puts it, in the round and the solver alike
- `makeMirrorHole` (`holeMaker.js`): the hole is built round its mirrors, as Violet Vortex's are round their portals. A mirror sits where a tee shot lands; the pin is the rest of the perfect score from the reflection; without mirrors par 3s and 4s take two more strokes (par needs a mirror) and par 5s one more. `chain`: a shot from the reflection lands on a second mirror, and neither alone makes the perfect score. `decoy`: a mirror on another tee shot reflecting 200+ yds from the pin. `tutorial`: a bigger mirror that 3+ tee shots land on. Each flip on the route lands at most 75% of the hole's length from the pin, so its label reads as progress. `makeHole` / `buildHole` take a saturation range (`sats`)
- Silverglass Greens (`generateCourses.mjs`, seed 7, any hue, saturation 12–45% for tees and pins, par 72, perfect 51): tutorial 1; chains 5, 11, 14; decoys 3, 6, 8, 10, 13, 17; the ace (16) flips into the hole
- Panel: swatches that land on a mirror get a dotted silver outline and a "⇄ N yds" label (where the flip leaves you, with a chip of that color; "Mirror" on Expert), also in the tooltip and aria-label; "Mirror! Your color's hex flipped: #… → #…"; list, summary, score-card dots, How to play. Map: solid silver footprint with a dark rim and a ⇄ icon; the trail jumps at a flip
- Tutorial boxes take the course's or the hazard's color (Violet Vortex purple, Silverglass silver), and the first hole of a round with a bunker, water or a black hole gets its own box explaining it (Expert bunkers: only the named wedge)
- "Last shot" after a portal, black hole or mirror measures the shot, not the jump
- Unlock: Silverglass Greens needs −4 or better on Violet Vortex

**Tried and dropped**
- The spec's mirror: hit from inside one and every hue move flips (swatches unflipped, ⇄ marks on the ones that change). It only reshuffles which swatch goes where, so it can't shorten or block a route: 0 of 36 muted holes could make one unavoidable
- A Mirror club playable only on a mirror (+1 stroke to reverse the hex). It worked (chains included) but the developer preferred the flip happening on landing, like a portal

**Verified**
- Every hole: stored perfect matches the solver and the game; every perfect route flips (chains twice); without mirrors each par 3 and 4 is over par; courses 1–6 unchanged byte for byte
- `replayRound`: a perfect round is 51 strokes; Violet Vortex, Royal Indigo and Ember Dunes still replay to their perfect scores
- Headless Chrome: hole 1 (3 outlined swatches, tutorial, flip note), holes 1–2 played to birdies, no console errors

---

## Milestone 25 — Portals: Violet Vortex (v1.8.0) `[ai-assisted]`
**2026-10-30**

The first expansion course. Spec agreed with the developer (7 gimmick courses, names with colors, unlock chain from Royal Indigo, one course per release); implementation `[ai-assisted]`.

**Added**
- Portals (`hazards.js`): a hazard type whose landing warps the ball to its `exit`; `portalAt` and `land` used by the round, the solver (`searchFrom`, `reachesWithin`), the birdie-line count and the map
- `placePortals` (`holeMaker.js`): the hole is built one stroke longer, then a shortcut portal on a tee shot exits two strokes along its best route, so the perfect score needs the portal; with `trap`, a second portal on the obvious line exits 250+ yds from the hole. Re-checked: perfect, finishable within par, birdie line 1–4 (new `Expansion` difficulty)
- Violet Vortex (`generateCourses.mjs`, seed 6, 250°–300°, par 72): 17 portal holes, 5 with traps, plus the ace; `gimmick` line on its course card
- Map: violet swirl footprint and icon (turning), exit ring, and the trail breaks at a portal (the ball jumps); the perfect-route replay jumps too
- Panel: "Portal! The ball warped to its exit.", "Portal: N yds from you", portal dots on the score card, "2 portals" in the hole summary; How to play section on expansion courses
- Unlock: Violet Vortex needs −2 or better on Royal Indigo

**Verified**
- Every hole: stored perfect matches the solver; without portals each portal hole needs one more stroke; every perfect route warps; tee, pin and exits outside every portal; courses 1–5 unchanged byte for byte
- `replayRound` of a perfect Violet Vortex round: 51 strokes (−21), so the score server accepts it
- Headless Chrome: hole 1 played on its perfect route (warp note, jump on the map, birdie); no console errors

**After the first play-test** (the developer: portals felt like a lucky guess; outline the swatches that reach one, add black holes that make portals necessary, and make hole 1 a tutorial)
- Swatches whose landing is in a portal get a dashed violet outline and a "→ N yds" label (where the ball comes out, from the pin; just "Portal" on Expert), also read out in the swatch's aria-label
- Black holes (`hazards.js`): +1 stroke and back to the tee; the solver skips them like water; drawn as a dark swirl with an orange rim; note, list, summary and score-card dots
- `placePortals` takes `skip` (how many strokes the shortcut saves) and `tutorial` (bigger portal, no trap); `placeBlackHoles` puts 1–2 on the portal-free route; `searchFrom` gains `avoidPortals`
- Violet Vortex regenerated (rev 2): par 3s and 4s are built two strokes long, so par needs the portal; traps on 4, 7, 10, 13; black holes on 3, 6, 9, 12, 15, 18. Blocking every portal-free route with black holes instead was tried and dropped: 8 black holes still left a way round
- Course `tutorial` text, shown on hole 1 of a course round with a Got it button
- Swatch rows line up by their tops (a label makes one swatch taller)
- Verified: perfect matches the solver on every hole; without portals each par 3 and 4 takes par + 1 or more; perfect replay 51 strokes, 17 warps; a black-hole landing costs 2 and returns to the tee, and undo restores it; headless Chrome: tutorial and outlines on hole 1, black hole on hole 3, no console errors

**Second play-test** (the developer: shorter tutorial, a dotted outline that doesn't cover the yardage, more menacing black holes, holes with several portals in a row or mostly portals; asked how exits are chosen and about showing the exit's hex)
- Outline: 2 px dotted purple with room below it; the label gets a chip of the exit color (not in Pro); hex in the tooltip and aria-label (`hslToHex` in `oklab.js`). A full hex beside the yardage doesn't fit under a 40–60 px swatch
- `placeChain`: `wanted` − 1 portals in a row, the last exiting one stroke from the pin; `placeMaze`: a shortcut plus decoys until half the 35 full shots go into a portal (the 6 putts and other short shots are too near the tee for a portal; 55% of all 41 couldn't be covered with 12 portals); decoy exits 40–160 yds from the pin that can't make the perfect score
- `placeBlackHoles`: 35–55 yds, alternately on a tee shot and on the portal-free route
- Violet Vortex rev 3 (hole plan `VORTEX_HOLES` in `generateCourses.mjs`); more than 3 portals list as one line ("13 portals: nearest 24 yds from you")
- Portal and black-hole footprints are plain fills (no turning spiral or swirl), so a maze hole stays calm to look at
- Verified: perfect matches the solver on every hole; chain holes' perfect routes take every portal in the chain; mazes: 18–19 of 41 tee swatches into portals; black-hole holes: 2–7 tee swatches into black holes; perfect replay 51; courses 1–5 unchanged; headless Chrome at desktop and 390 px: labels clear of the outline, no overlap, no console errors

---

## Milestone 24 — Mobile & Accessibility (v1.7.0) `[ai-assisted]`
**2026-10-30**

ColorVerse and Color Golf work on phones, from the keyboard and without telling colors apart. Scope from the roadmap (touch, colour-blind mode, keyboard play), with Expert's tap-to-aim from the spec; implementation `[ai-assisted]`.

**Added**
- Phone layout (`index.css`, under 760 px): one column with the 3-D view sticky at the top; viewport meta tag; 40 px swatches
- `src/pointer.js`: the last pointer type, so a tap chooses or plays a swatch on touch screens while mice keep double-click
- Pinch to zoom (`3d-mode.js`); a drag that ends over the shape no longer picks a color
- Keyboard: swatches are focusable buttons; `swatchNeighbour` (harmony.js) moves with the arrow keys; Enter / Space chooses or plays
- `src/color-names.js`: `describeColor` (shade + tone + hue family, with brown / olive / teal for dark oranges, yellows and cyans) and the "Color names" switch (explore and golf setup); names under swatches, the selected color and You / Target
- Golf: tap to play, Expert tap to aim then tap again; swatch labels for screen readers (club, plus color name outside Pro)

**Modified**
- `MainBase.js`: pointer events instead of mouse events (one pointer drags; a second finger hands over to pinch); arrow keys ignored while a swatch has focus
- Help, golf "How to play" and the tour mention taps, pinch and the keyboard

**Verified**
- Headless Chrome at 390×844 with touch: layout; taps play strokes; Expert's first tap aims, a tap elsewhere moves the aim, a second tap plays; pinch zooms; → moves focus between swatches and Enter plays; a tap in explore mode selects the swatch; names under swatches and You / Target, labels for screen readers; desktop layout unchanged; no console errors

---

## Milestone 23 — Unique Nicknames, Change Password & Going Live (v1.6.2) `[ai-assisted]`
**2026-10-30**

The Firebase project (`colorverse-9efa3`) is set up and deployed, nicknames can't repeat, and email accounts can change their password. Requests by the developer (unique nicknames, red error messages, change password); implementation `[ai-assisted]`.

**Added**
- `src/cloud/config.js`: the project's web config; `.firebaserc` points the CLI at it
- `setNickname` Cloud Function: reserves the name in `nicknames/{id}` (id ignores case and extra spaces) in one transaction with releasing the old one; renames update the player's ranked leaderboard entries
- `src/cloud/nickname.js`: nickname rules shared by the screen and the server (2–20 letters, numbers, spaces, `_ - . '`; at least one letter or number)
- Change password for email accounts: re-checks the current password, then sets the new one (8+ characters, different); "Email me a reset link" for a forgotten one
- Red error messages under the nickname box (taken, already yours, length, characters, offline) and for sign-in and password problems; progress messages stay grey

**Modified**
- `firestore.rules`: the browser can no longer write anything (nicknames go through `setNickname`)

**Verified**
- Emulators: claim, re-save in other capitals, taken in other capitals, bad names, direct writes refused, renaming frees the old name; password change refused with a wrong current password, old password rejected and new one accepted after
- Real project: deploy, sign-in, nickname saving (checked by the developer)

---

## Milestone 22 — Email and Password Sign-in (v1.6.1) `[ai-assisted]`
**2026-10-29**

Email sign-in only sent links; most players expect a password. Decision by the developer; implementation `[ai-assisted]`. Browser only, no server change.

**Added**
- Sign-in panel: email and password with Sign in / Create account (8+ characters), Forgot password (Firebase sends the reset email; also how a Google or link account gets a password), and "Email me a sign-in link instead"
- `cloud.js`: `signInWithPassword`, `createAccount`, `sendPasswordReset`
- Firebase error codes in words (wrong password, email already has an account, weak password, bad address, too many tries, offline)

**Verified**
- Auth emulator: create, sign in, and each error code the messages map; Forgot password gives the same answer for unknown addresses, so it can't be used to look up accounts

---

## Milestone 21 — Accounts & Score Database (v1.6.0) `[ai-assisted]`
**2026-10-29**

Optional accounts with server-checked scores, a daily leaderboard and account-only courses, on Firebase. Decisions by the developer (Firebase; guest and account scores kept apart; one daily try per account, guest tries unranked; courses 4–5 unlocked by a good round on the course before; round messages and the picked-up mark); implementation `[ai-assisted]`. Built and tested on the emulators; not deployed yet (no Firebase project).

**Added**
- `src/cloud/cloud.js` / `config.js`: Firebase Auth (Google or an emailed link; the first sign-in creates the account), Firestore reads, and a queue of finished rounds tagged with who played them (guest or uid), sent on sign-in or when back online. The SDK loads only when Color Golf opens or the browser was signed in before; with no config the game is offline-only, as before
- `functions/src/index.js`: `startDaily` (a signed-in daily's first stroke is put on record) and `submitRound` (replays the clubs played, then saves bests, rounds, daily results and the leaderboard)
- `src/golf/replay.js`: replays a recorded round with `GolfRound`; `GolfRound` records each stroke's club (`clubId` / `clubById` in `clubs.js`)
- `src/golf/unlocks.js`: courses 1–3 open to all; Cobalt Bay needs an account and −6 or better on Verdant Pines, Royal Indigo −3 or better on Cobalt Bay. Shared by the courses screen and the server, which refuses rounds on locked courses
- `firestore.rules` (the browser reads its own data and the leaderboard, writes only its nickname), `firestore.indexes.json`, `firebase.json` (emulators: Auth, Functions, Firestore)
- Screen: account panel ("Sign in or create account", nickname, privacy note), today's leaderboard, "saved to your account" note, lock lines on courses 4–5, a message after each course round, picked-up holes shown grey with a ✕
- Scripts: `npm run emulators`, `npm run dev:cloud`, `npm run deploy:cloud`, `npm run firebase -- <command>` (Firebase CLI pinned to 13.35.1 through npx; newer versions' Firestore emulator needs Java 21)

**Modified**
- Golf bests and daily results are kept per owner: the guest's under the existing keys, a signed-in account's in its own copy, which signing out deletes
- Daily rule on the server: one try per account per day; only a try started signed in is ranked; a guest's try sent on sign-in counts as the day's try but never reaches the leaderboard

**Verified**
- Emulators, real rounds played by the solver: guest daily scored but unranked and off the leaderboard; a second try refused; a guest try can't replace one started signed in; a started try ranked and listed; a try whose start never arrived saved unranked; Cobalt Bay refused until Verdant Pines −6 (Prism Point doesn't count), Royal Indigo refused until Cobalt Bay −3, both accepted after
- Production build and functions bundle build; no new lint errors

---

## Milestone 20 — Engine Cleanup (v1.5.0) `[ai-assisted]`
**2026-10-29**

Three.js moves from the r128 CDN global to the npm package (r181), and the unused ShaderCache goes. Decision by the developer (roadmap v1.5; confirmed ShaderCache has no use); implementation `[ai-assisted]`.

**Added**
- `src/three-setup.js`: imports Three.js once, switches off automatic color management, and re-exports `THREE`; all 17 modules that use Three.js import it from here
- `src/3d/Mini/miniMaterials.js`: the mini objects' shader materials, moved out of `color-utils.js` so the texture worker (which imports `color-utils.js`) stays free of Three.js (worker still 3.4 kB)
- `vite.config.js`: Three.js in its own chunk (516 kB, 133 kB gzipped; app code 114 kB)

**Modified**
- Renderer writes pixels as-is (`outputColorSpace` linear) and layer textures are no longer flagged sRGB, matching r128's behavior (the shaders convert colors themselves)
- `mapView.js` / `MainBase.js`: `removeFromParent()` and `BufferGeometry.applyQuaternion()` replace the r128 workarounds
- `TextureRegistry.getTextureCache(type)` replaces `getCaches(type)`

**Removed**
- `ShaderCache.js` (never read) and the r128 `<script>` tag in `index.html`

**Verified**
- Pixel comparison of r128 vs r181 screenshots (sphere RGB / HSL, cube, golf map on the cube): every pixel within 1/255, apart from a mid-fade frame of the mini sphere
- Hex labels now round like CSS (#808080 for 50% gray; r128 truncated to #7F7F7F)
- Real built app: peel on sphere and cube, Expert practice with a named-wedge bunker, daily hole with replay; no console errors

---

## Milestone 19 — Golf Variety (v1.4.0) `[ai-assisted]`
**2026-10-29**

Peeling, named-wedge bunkers on Expert and themed course layouts. Choices by the developer (peel on jumps only, one wedge per bunker, themed par 73 / par 70 layouts); implementation `[ai-assisted]`.

**Added**
- Peel: `MainBase.peelTo(layer)`: going deeper, a see-through copy of the old shell lifts off (grows 22% and fades over 0.65 s) over the new layer; coming out, the new layer settles onto the shape. Shell parts come from `MainSphere` / `MainCube` `_shellParts` (shared geometry, own materials). Used by golf strokes and typed layer numbers; a new jump ends the one in progress; scroll and `]` / `[` keep the cross-fade
- Named-wedge bunkers: Expert bunkers carry `wedge` (picked by the generator, re-checked); `hazardMap.allows` / `wedgeAt` are the one rule for the round (`GolfRound.canPlay`, `sandWedge`), the solver and the generator; panel note "In the bunker: Shades only", "Bunker (Shades only)" in the list, letters on the map icon
- Themed layouts: Ember Dunes par 73 (5 par 5s), Verdant Pines par 70 (5 par 3s)
- `generateDaily.mjs --weekdays`: rebuild given weekdays in place after a rotation change

**Regenerated**
- Ember Dunes and Verdant Pines (rev 2, new layouts), Royal Indigo (rev 3: 23 bunkers, each naming a wedge: 10 Tones, 5 Tints, 5 Saturate, 3 Shades); Prism Point and Cobalt Bay unchanged
- The 114 Championship Saturday dailies (228 named bunkers); the other 682 days unchanged
- The 18 Expert-with-hazards practice starter holes; the other 90 unchanged

**Verified**
- All courses, daily holes and pool holes: stored perfect matches the solver under the wedge rule, finishable within par avoiding hazards, lengths follow par
- Rule check: a "Tones only" bunker allows 5 swatches (any-wedge bunker: 20); driver and putter refused; outside sand everything plays
- Real built app (Chrome DevTools): typed-layer peel deeper and back out on the sphere, peel on the cube, Expert practice with "Bunker (Tints only)" and a "Ti" icon on the map; no console errors

---

## Milestone 18 — Daily Hole, Practice & Pro (v1.3.0) `[ai-assisted]`
**2026-10-28**

Three new ways to play Color Golf, and an Expert difficulty you can feel. Choices by the developer (pre-built daily list, one scored try, weekly rotation, separate Pro bests, all four Expert levers, the Colors / Clubs toggle, woods and hybrids); implementation `[ai-assisted]`.

**Added**
- `golf/holeMaker.js`: hole building moved out of the course generator (unchanged: regenerated `courses.json` is byte-identical), so the course generator, the daily generator and the practice worker share it
- Daily hole: `golf/daily.js` (weekly rotation from Ace Sunday to Championship Saturday, dates, streaks) and `resources/generateDaily.mjs` (`npm run daily`; one seed per date, built in parallel, extendable with `--until`) → `daily.json`, 796 days to 2028-12-31, loaded only when Color Golf opens (19 kB gzipped)
- One scored try per day: the first stroke saves a pick-up that finishing replaces; replays aren't scored; streak of consecutive days
- Practice: `golf/practice-worker.js` builds random holes by difficulty, par and hazards on/off; the next hole is built during play; changing settings restarts the worker instead of queueing; unlimited undo
- Pro: blank swatches labeled with the club (`data-club`, `body.golf-pro`); Pro bests stored under `<course>:pro`; a Colors ◯ Clubs toggle styled like the RGB ◯ HSL switch
- Expert (courses, Friday/Saturday dailies, practice): always Pro; no yardage, meter or hazard distances until the ball is on the green; Expert par (`holeMaker.js` `expertPerfect`: par = perfect on par 3s and 4s, perfect 4 on par 5s; ace and layup holes keep theirs)
- Perfect line: every hole stores `lines` (first shots of 41 that keep perfect reachable), shown in the hole info, so difficulty is visible
- Club types: each row heading shows its club in a game (DRIVER Complementary, WOOD Split-Comp., HYBRID Triadic / Tetradic / Double-Comp., IRON Analogous, WEDGE Tints / Shades / Tones / Saturate), ranked by measured average shot length
- Practice starter pool: `golf/practice.js` (one practice hole from a seed and settings, shared by the worker and the generator) and `resources/generatePractice.mjs` (`npm run practice`) → `practice.json`, 6 holes per setting (108), so a session starts instantly; later holes are built during play
- Course revisions: regenerated courses carry `rev`, and bests saved against an older revision aren't shown
- Setup screen: swatch toggle, daily card (today's hole, result, streak), practice card, then the courses; help text for all three and for difficulty

**Modified**
- `game.js`: `GolfRound` takes `{ undos }` (practice passes Infinity)
- Map (developer's playtest): the hazard halo is gone (its traced outline was spiky and looked like a smear around bunkers); hazard icons sit on the footprint drawn for the current layer instead of at the hazard's own spot beside it; a "T" marker shows the tee, where the player's path and the perfect route both start (hidden when it's on the far side)
- Expert holes built without hazards are chosen on the final birdie line (1–3) instead of the wider pre-hazard one (no effect on existing courses or the daily list)
- Cobalt Bay and Royal Indigo regenerated with Expert par (rev 2; perfect 65 on par 71 / 70); Prism Point, Ember Dunes and Verdant Pines unchanged apart from `lines`
- Solver: `parFor` keeps each search's OKLab colors (the generators ask the same search about hundreds of targets), and the new `reachesWithin` answers the birdie-line checks with an early exit and a reused scratch table; same answers, Expert clear holes about 6× faster

**Fixed**
- The setup screen's Pro label had the class `golf-pro`, the same class set on `<body>` in a Pro round, so the whole page took the label's small grey text during Pro play

**Verified**
- All 796 daily holes: stored perfect matches the solver with hazards and wind, finishable within par avoiding hazards, length follows par, rotation matches the weekday; rebuilding sample days from their date gives identical holes
- All 5 courses, 796 daily holes and 108 pool holes: stored perfect matches the solver, finishable within par avoiding hazards, Expert par where it applies, perfect line in the difficulty's range (pool); the 568 non-Expert daily days are unchanged apart from `lines`
- Practice build times (Node, after the solver changes): Beginner 0.4–1.7 s, Standard 0.7–6.7 s, Expert clear 1–5 s, Expert with lakes 4–28 s (hence the starter pool)
- Real built app (Chrome DevTools): today's daily hole played along the solver's route (birdie, streak 1, saved; pick-up saved after the first stroke; card shows "Replay" afterwards); practice at each difficulty with hazards on and off, next hole ready in 0.5 s; Pro swatches blank with "+120°" / "60%" / "Hue −", Pro shown in the hole info; Expert practice from the pool in 0.4–0.7 s with yardage hidden ("Off the green") and Pro forced; club types shown only in a game; no console errors

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
