// ----------------------------------
// Color Golf course generator
// ----------------------------------
// Builds fixed 18-hole courses with the par solver and writes src/golf/courses.json.
// Seeded, so re-running produces the same courses. Run: npm run courses
//
// Each hole has a `perfect` score (the solver's fewest strokes) and a `par` above it,
// so birdies, eagles and the occasional hole in one are possible.
//
// Two separate dials:
// - Length follows par (yards = OKLab distance × 1000): short par 3s, long par 5s.
// - Difficulty is the "birdie line": how many of the 41 first shots from the tee still leave the
//   perfect score reachable. Each course accepts holes only inside its range (ace holes excepted).
//
// Hazards (v1.2) are placed after a hole is chosen, from their own seeded sequence, so adding them
// doesn't change which holes a course has. They rarely make a hole longer for a perfect player;
// they take away good shots: water sits on landing spots of first shots that keep a birdie
// reachable, bunkers guard the hole or sit on the best route where the next shot is a wedge anyway.
// Each placement is re-checked: perfect unchanged (or +1 on a deliberate layup hole), the hole is
// still finishable within par with every hazard avoided, and the birdie line is in range.
//
// Wind (v1.2) comes last, from a third seeded sequence: a fixed hue or lightness drift per hole,
// kept only if the hole passes the same checks with it (perfect unchanged, finishable within par
// avoiding hazards, birdie line in range). Otherwise the hole is calm.

import { readFileSync, writeFileSync } from "node:fs";
import { rng, buildHole, yardsBetween, expertPerfect } from "../src/golf/holeMaker.js";
import { skipFor, BANS, WHIRL, gimmickHole, easiestFirst } from "./gimmicks.mjs";

// [par, perfect] per hole. Par 3s and 4s are birdie-able; par 5s mix birdie and eagle chances.
// One ace (perfect 1) per course, on the back nine's second par 3.
const FRONT = [[4, 3], [4, 3], [3, 2], [5, 4], [4, 3], [4, 3], [3, 2], [4, 3], [5, 3]]; // 36
const BACK = [[4, 3], [5, 3], [3, 2], [4, 3], [4, 3], [5, 4], [3, 1], [4, 3], [4, 3]]; // 36
// Shorter layouts for later courses: fewer par 5s, more par 3s
const BACK_35 = [[4, 3], [5, 3], [3, 2], [4, 3], [4, 3], [3, 2], [3, 1], [4, 3], [5, 4]]; // 35 → par 71 with FRONT
const FRONT_35 = [[4, 3], [3, 2], [4, 3], [5, 4], [4, 3], [3, 2], [4, 3], [4, 3], [4, 3]]; // 35 → par 70 with BACK_35
// Themed layouts (v1.4): Ember Dunes is long (5 par 5s, par 73), Verdant Pines is tight (5 par 3s, par 70)
const EMBER_FRONT = [[4, 3], [5, 4], [3, 2], [4, 3], [5, 3], [4, 3], [3, 2], [4, 3], [5, 4]]; // 37
const VERDANT_BACK = [[4, 3], [3, 2], [4, 3], [4, 3], [3, 1], [4, 3], [5, 3], [3, 2], [5, 4]]; // 35 → par 70 with FRONT_35

// Violet Vortex (v1.8): what each hole is. Every hole is built `skip` strokes longer than its
// perfect score (2 where it fits in 5 strokes, so par 3s and 4s need a portal for par) and a
// portal is the way back: a shortcut (`trap`: plus a portal on the obvious line exiting far
// away), a `chain` of portals from the tee to beside the pin, or a `maze` where most tee swatches
// are portals and only one exit leads on. `blackHoles`: that many, on tee shots and the long way round.
const VORTEX_HOLES = [
    "tutorial", "trap", "blackHoles", "chain", "maze", "blackHoles", "trap", "maze", "blackHoles",
    "trap", "chain", "blackHoles", "maze", "chain", "blackHoles", "ace", "trap", "blackHoles",
];
const VORTEX_PLAN = {
    tutorial: (perfect) => ({ skip: skipFor(perfect), tutorial: true }),
    trap: (perfect) => ({ skip: skipFor(perfect), trap: true }),
    chain: (perfect) => ({ skip: skipFor(perfect), chain: true }),
    maze: (perfect) => ({ skip: skipFor(perfect), maze: true }),
    blackHoles: (perfect) => ({ skip: skipFor(perfect), blackHoles: 3 }),
    ace: () => null,
};

// Silverglass Greens (v1.8.1): each hole is built round its mirrors (see makeMirrorHole), where tee
// shots land; a ball that lands on one comes out with its hex reversed. Without them the hole is
// `skip` strokes longer, like Violet Vortex's portals. `decoy` adds a mirror whose reflection leads
// nowhere; a `chain` needs two mirrors with a shot between them. The ace flips into the hole.
const MIRROR_HOLES = [
    "tutorial", "mirror", "decoy", "mirror", "chain", "decoy", "mirror", "decoy", "mirror",
    "decoy", "chain", "mirror", "decoy", "chain", "mirror", "ace", "decoy", "mirror",
];
const MIRROR_PLAN = {
    tutorial: { tutorial: true },
    mirror: {},
    decoy: { decoy: true },
    chain: { chain: true },
    ace: {},
};

// Caddie Strike (v1.8.2): each hole's ban, from BANS (gimmicks.mjs), built so it costs at least a stroke.
// "No putter" is only on par 4s and 5s: on a par 3 the putter never saves a stroke. A wedges-only ban
// was dropped (wedge moves go in any order, so it leaves far too many perfect lines), and so was
// "No Iron" (one short row rarely costs a stroke). With the think check (v1.8.2), "No Wedges" works
// only on the ace and "No putter" only once (without them the obvious swatches keep winning), and par
// 5s only take "No Tints or Shades" or "Hybrids, Iron and putter only".
const CADDIE_HOLES = [
    "noLong", "noPutter", "noHybrids", "hybridsIrons", "noLongIron", "noTintsShades", "noLong", "noWoodsWedges", "hybridsIrons",
    "noLongIron", "noTintsShades", "noHybrids", "noLongIron", "noLong", "noTintsShades", "noWedges", "hybridsIrons", "noWoodsWedges",
];

// Saffron Whirlwind (v1.8.3): every hole's wind turns each stroke in a cycle of 2–3 (holeMaker.js:
// makeWindHole), much stronger than Ember Dunes' breezes; the tutorial's is two winds, neither calm. No water or black
// holes: their penalty strokes would turn the wind too, which the solver doesn't follow. Strengths: WHIRL (gimmicks.mjs).
// Par 5s all perfect 3 (eagle holes), for Saffron Whirlwind and Scarlet Roulette: three strokes of
// turning wind, or with four extra hue shifts, reach nearly every color, so a pin that truly needs
// four is too rare to find
const EAGLE_LAYOUT = [FRONT, BACK].map(nine => nine.map(([par, perfect]) => [par, par === 5 ? 3 : perfect]));

// Scarlet Roulette (v1.8.4): every hole has a roulette row of four hue shifts, built so the perfect
// score needs it (holeMaker.js: makeRouletteHole). Needing it for par too (two strokes saved) turned
// out to be out of reach: the harmony clubs get to any hue within a few strokes anyway.

// Hexflip Hollow (v1.8.5): every hole has the flip row (five clubs that move the hex digits left by
// 1–5), built so that without it the hole is two strokes longer (holeMaker.js: makeFlipHole): par
// needs a flip on the par 3s and 4s, and going under par needs one on the par 5s. Flips are wild
// enough that two strokes is within reach, unlike the roulette's hue shifts.

// The Obsidian Gauntlet (v1.8.6): a survival course (finish a hole over par and the round ends) in
// dark colors (lightness 15–50%), three holes of each gimmick, every one built as on its own course,
// then played easiest first (gimmicks.mjs: easiestFirst). Bans suit the hole (par 5s only take two of
// them); the ace is a wind hole.
const GAUNTLET_HOLES = [
    { portals: { trap: true } }, { mirrors: {} }, { rules: BANS.noHybrids }, { turning: {} }, { roulette: {} }, { flip: {} },
    { portals: { chain: true } }, { mirrors: { chain: true } }, { rules: BANS.noTintsShades }, { turning: {} }, { roulette: {} }, { flip: {} },
    { portals: { maze: true } }, { mirrors: { decoy: true } }, { rules: BANS.hybridsIrons }, { turning: {} }, { roulette: {} }, { flip: {} },
];
const gauntletHole = (i, perfect) => gimmickHole(GAUNTLET_HOLES[i], perfect);

// "Make you think" (v1.8.2, holeMaker.js: thinks): on each hole but the ace, none of this many tee
// shots closest to the pin keeps the perfect score, and a perfect route plays like golf (putts only
// near the pin, no Driver or Woods into the hole). The beginner course is left as it is.
const THINK = { Beginner: 0, Standard: 2, Expert: 3, Expansion: 3 };

// Each course keeps its tees and targets inside a hue range [from, to) in degrees (wrapping past 360),
// and optionally a saturation range `sats` [min, max], so the name says how it plays. Routes may still pass through other hues.
// `hazards(i, par, perfect)` says what hole i gets: { water, greenside, route } counts (or null for none).
// `layup` is a par 5 / perfect 3 hole whose birdie lines are all covered by water (perfect becomes 4).
// Expert courses (v1.3) use Expert par: perfect = par on par 3s and 4s, 4 on par 5s (the ace and
// the layup keep their own), and their bunkers each name the one wedge allowed out of them (v1.4).
// `rev` counts regenerations, so bests from older holes aren't shown.
const COURSES = [
    {
        id: "prism", name: "Prism Point", seed: 1, rev: 2, hues: [0, 360], difficulty: "Beginner", // full spectrum
        hazards: (i, par) => (i >= 9 && par >= 4 && i % 2 === 0 ? { greenside: 1 } : null), // a few bunkers on the back 9
        wind: null, // calm
    },
    {
        id: "ember", name: "Ember Dunes", seed: 2, rev: 4, hues: [345, 60], difficulty: "Standard", layout: [EMBER_FRONT, BACK], // par 73, reds, oranges, yellows
        hazards: (i, par, perfect) => (perfect === 1 ? null : { greenside: par === 5 ? 2 : 1, route: i % 3 === 0 ? 1 : 0 }), // the sand course
        wind: { hue: [4, 8], light: [2, 4] }, // steady breezes
    },
    {
        id: "verdant", name: "Verdant Pines", seed: 3, rev: 4, hues: [75, 165], difficulty: "Standard", layout: [FRONT_35, VERDANT_BACK], // par 70, greens
        hazards: (i, par, perfect) => (perfect > 1 && i % 3 === 1 ? { greenside: 1 } : null), // light sand
        wind: { hue: [2, 4] }, // light
    },
    {
        id: "cobalt", name: "Cobalt Bay", seed: 4, rev: 3, hues: [180, 250], difficulty: "Expert", layout: [FRONT, BACK_35], layup: 8, // par 71, blues
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band" }), // lakes until only 1–3 birdie lines remain
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
    {
        id: "indigo", name: "Royal Indigo", seed: 5, rev: 4, hues: [250, 320], difficulty: "Expert", layout: [FRONT_35, BACK_35], layup: 10, // par 70, purples
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band", greenside: 1, route: i % 2 }),
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
    // Expansion pack (v1.8): account-only courses, each built around one gimmick (`gimmick` is the
    // line shown on its card). Hole 1 teaches it: `tutorial` is shown there, and the hole is built
    // so the gimmick is the way to par.
    {
        id: "vortex", name: "Violet Vortex", seed: 6, rev: 4, hues: [250, 300], difficulty: "Expansion",
        gimmick: "Portals warp the ball to their exit color; black holes send it back to the tee.",
        tutorial: "A swatch with a dotted outline lands in a portal; its label shows where the ball comes out (yds from the pin). You need one to make par here.",
        portals: (i, par, perfect) => VORTEX_PLAN[VORTEX_HOLES[i]]?.(perfect) ?? null,
    },
    {
        id: "silverglass", name: "Silverglass Greens", seed: 7, hues: [0, 360], sats: [12, 45], difficulty: "Expansion", // muted colors
        gimmick: "Land on a mirror and your color's hex flips: #234243 comes out as #342432.",
        tutorial: "A swatch with a dotted silver outline lands on a mirror, which flips your color's hex (#234243 → #342432); its label shows how far from the pin that leaves you. You need one to make par here.",
        mirrors: (i, perfect) => ({ ...MIRROR_PLAN[MIRROR_HOLES[i]], skip: skipFor(perfect) }),
    },
    {
        id: "caddie", name: "Caddie Strike", seed: 8, hues: [0, 360], difficulty: "Expansion", // full spectrum
        gimmick: "Each hole bans some clubs; banned swatches are greyed out.",
        tutorial: "Your caddie won't carry every club: each hole bans some (shown under the hole info), and their swatches are greyed out. Here it's the Driver and Woods (+150° to +210° in Long shots).",
        rules: (i) => BANS[CADDIE_HOLES[i]],
    },
    {
        id: "saffron", name: "Saffron Whirlwind", seed: 9, hues: [30, 65], difficulty: "Expansion", layout: EAGLE_LAYOUT, // yellows and oranges
        gimmick: "The wind turns every stroke, in a cycle you know before you tee off; putts aren't affected.",
        tutorial: "The wind turns every stroke here, in the cycle shown under the hole info; putts aren't affected. Swatches show where a calm shot lands, so aim off for this stroke's wind.",
        turning: (i) => ({ strengths: WHIRL, ...(i === 0 && { length: 2, calm: false }) }),
    },
    {
        id: "scarlet", name: "Scarlet Roulette", seed: 10, hues: [330, 20], difficulty: "Expansion", layout: EAGLE_LAYOUT, // reds and pinks
        gimmick: "A roulette swatch spins through four hue shifts, one a second: a stroke plays whichever is showing.",
        tutorial: "The Roulette row's swatch spins through this hole's four hue shifts, one a second, and a stroke plays whichever is showing (with the keyboard, Tab to the row for all four). The perfect score here needs it.",
        roulette: () => ({ skip: 1 }),
    },
    {
        id: "hexflip", name: "Hexflip Hollow", seed: 11, hues: [0, 360], difficulty: "Expansion", layout: EAGLE_LAYOUT, // full spectrum
        gimmick: "Flip clubs move your color's hex digits left: #A23432 flips to #23432A, #3432A2, …",
        tutorial: "The Flip row moves your color's hex digits left by 1 to 5 places (#A23432 → #23432A by 1). Flips 2 and 4 just turn the hue about 120°; 1, 3 and 5 jump somewhere new. You need one to make par here.",
        flip: () => ({ skip: 2 }),
    },
    {
        id: "gauntlet", name: "The Obsidian Gauntlet", seed: 12, hues: [0, 360], lights: [15, 50], difficulty: "Expansion", layout: EAGLE_LAYOUT, survival: true, // dark, full spectrum
        gimmick: "Survival: finish a hole over par and the round ends. Every gimmick, in the dark; no undos.",
        mix: gauntletHole,
    },
];

// Monochrome (v1.8.6): gray copies of courses 1–5, the same holes played with every color in grayscale
// (swatches, You and Target, the map), so lightness is the only clue. Copied from their color twins on
// every run (same rev, so regenerating a twin regenerates its copy); their own unlock chain (`after`).
const MONO = [
    { id: "ash", name: "Ash Point", from: "prism", after: "prism" },
    { id: "cinder", name: "Cinder Dunes", from: "ember", after: "ash" },
    { id: "slate", name: "Slate Pines", from: "verdant", after: "cinder" },
    { id: "graphite", name: "Graphite Bay", from: "cobalt", after: "slate" },
    { id: "onyx", name: "Royal Onyx", from: "indigo", after: "graphite" },
];

const only = process.argv.slice(2); // optional: course ids to generate (others are kept from the current file)
const existing = only.length ? JSON.parse(readFileSync(new URL("../src/golf/courses.json", import.meta.url))) : [];

const courses = COURSES.map(({ id, name, seed, rev, hues, sats, lights, survival, mix, difficulty, gimmick, tutorial, layout = [FRONT, BACK], hazards: planFor, layup, wind: windPlan, portals: portalsFor, mirrors: mirrorsFor, rules: rulesFor, turning: turningFor, roulette: rouletteFor, flip: flipFor }) => {
    if (only.length && !only.includes(id)) return existing.find(course => course.id === id);
    const rand = rng(seed);
    const hazardRand = rng(seed * 7919); // separate sequence: hazards don't change which holes are chosen
    const windRand = rng(seed * 104729); // and a third for wind
    const holes = layout.flat().map(([par, layoutPerfect], i) => {
        const perfect = difficulty === "Expert" && layoutPerfect > 1 && layup !== i ? expertPerfect(par) : layoutPerfect;
        const hole = buildHole({ rand, hazardRand, windRand }, {
            par, perfect, hues, sats, lights, difficulty, think: THINK[difficulty], plan: planFor?.(i, par, perfect), windPlan, layup: layup === i, portals: portalsFor?.(i, par, perfect), mirrors: mirrorsFor?.(i, perfect), rules: rulesFor?.(i), turning: turningFor?.(i), roulette: rouletteFor?.(i, par, perfect), flip: flipFor?.(i, par, perfect), ...mix?.(i, perfect),
            log: (message) => console.log(`  (hole ${i + 1}: ${message})`),
        });
        const summary = [(hole.hazards ?? []).map(h => h.type).join(", ") || "clear", hole.wind ? `wind ${JSON.stringify(hole.wind)}` : "calm", hole.rules?.name, hole.rules?.windCycle && `turning ${JSON.stringify(hole.rules.windCycle)}`, hole.rules?.roulette && `roulette ${hole.rules.roulette.join(" ")}`, hole.rules?.flip && "flip"].filter(Boolean).join("; ");
        console.log(`${name} hole ${i + 1}: par ${par}, perfect ${hole.perfect}, ${Math.round(yardsBetween(hole.tee, hole.target))} yds, ${summary}`);
        return hole;
    });
    if (survival) holes.splice(0, holes.length, ...easiestFirst(holes)); // a survival round gets harder as it goes
    return { id, name, ...(rev && { rev }), hues, difficulty, ...(survival && { survival }), ...(gimmick && { gimmick }), ...(tutorial && { tutorial }), holes };
}).filter(Boolean);
for (const { id, name, from, after } of MONO) {
    const twin = courses.find(course => course.id === from);
    courses.push({
        id, name, ...(twin.rev && { rev: twin.rev }), hues: twin.hues, difficulty: twin.difficulty, mono: true, after,
        gimmick: `Monochrome: ${twin.name}'s holes with the swatches in gray. Judge each shot by its lightness.`,
        holes: twin.holes,
    });
}

const out = new URL("../src/golf/courses.json", import.meta.url);
// One hole per line, so course changes read clearly in a diff
const json = courses.map(({ holes, ...course }) =>
    `  ${JSON.stringify(course).slice(0, -1)},"holes":[\n${holes.map(h => `    ${JSON.stringify(h)}`).join(",\n")}\n  ]}`);
writeFileSync(out, `[\n${json.join(",\n")}\n]\n`);
console.log(`Wrote ${courses.length} course(s) to src/golf/courses.json`);
