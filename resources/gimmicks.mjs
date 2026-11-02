// ----------------------------------
// Gimmick plans shared by the course and weekly-Gauntlet generators
// ----------------------------------
// What each expansion gimmick asks of holeMaker.js's buildHole, so generateCourses.mjs (the
// expansion courses and The Obsidian Gauntlet) and generateWeekly.mjs (the weekly Gauntlet) build
// them the same way.

import { parLine } from "../src/golf/holeMaker.js";

// Portals and mirrors (v1.8, v1.8.1): built this many strokes longer, the gimmick being the way back
// (2 where it fits in 5 strokes, so par 3s and 4s need it for par)
export const skipFor = (perfect) => Math.min(2, 5 - perfect);

// Caddie Strike (v1.8.2): each hole bans some clubs (hole.rules, rules.js), and is built so the ban
// costs at least a stroke. Club types: Driver = Complementary, Wood = Split-comp., Hybrids = Triadic,
// Tetradic, Double-comp., Iron = Analogous, Wedges = Tints, Shades, Tones, Saturate.
export const BANS = {
    noLong: { name: "No Driver or Woods", ban: ["complementary", "split-complementary"] },
    noHybrids: { name: "No Hybrids", ban: ["triadic", "tetradic", "double-complementary"] },
    noWedges: { name: "No Wedges", ban: ["tints", "shades", "tones", "saturate"] },
    noTintsShades: { name: "No Tints or Shades", ban: ["tints", "shades"] },
    noPutter: { name: "No putter", ban: ["putter"] },
    noLongIron: { name: "No Driver, Woods or Iron", ban: ["complementary", "split-complementary", "analogous"] },
    noWoodsWedges: { name: "No Woods or Wedges", ban: ["split-complementary", "tints", "shades", "tones", "saturate"] },
    hybridsIrons: { name: "Hybrids, Iron and putter only", ban: ["complementary", "split-complementary", "tints", "shades", "tones", "saturate"] },
};

// Saffron Whirlwind (v1.8.3): turning-wind strengths, much stronger than Ember Dunes' breezes
export const WHIRL = { hue: [12, 24], light: [6, 10] };

// One Gauntlet hole's buildHole options from a plan entry: { portals: { trap | chain | maze } },
// { mirrors: { chain | decoy } }, { rules: <a BANS entry> }, { turning: {} }, { roulette: {} } or { flip: {} }
export function gimmickHole(entry, perfect) {
    const [kind, plan] = Object.entries(entry)[0];
    if (kind === "portals" || kind === "mirrors") return { [kind]: { ...plan, skip: skipFor(perfect) } };
    if (kind === "turning") return { turning: { strengths: WHIRL } };
    if (kind === "roulette") return { roulette: { skip: 1 } };
    if (kind === "flip") return { flip: { skip: 2 } };
    return { rules: plan };
}

// Easiest first (v1.8.6), for a survival round: the more tee shots that still leave par reachable
// (holeMaker.js: parLine), the easier; then the more that keep the perfect score
export function easiestFirst(holes) {
    const keyed = holes.map(hole => ({ hole, par: parLine(hole), perfect: hole.lines ?? 0 }));
    return keyed.sort((a, b) => b.par - a.par || b.perfect - a.perfect).map(({ hole }) => hole);
}
