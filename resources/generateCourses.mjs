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
const skipFor = (perfect) => Math.min(2, 5 - perfect);
const VORTEX_PLAN = {
    tutorial: (perfect) => ({ skip: skipFor(perfect), tutorial: true }),
    trap: (perfect) => ({ skip: skipFor(perfect), trap: true }),
    chain: (perfect) => ({ skip: skipFor(perfect), chain: true }),
    maze: (perfect) => ({ skip: skipFor(perfect), maze: true }),
    blackHoles: (perfect) => ({ skip: skipFor(perfect), blackHoles: 3 }),
    ace: () => null,
};

// Silverglass Greens (v1.8.1): each hole is built round a mirror (see makeMirrorHole), on the tee
// or on a tee shot's landing, and `skip` strokes longer without it, like Violet Vortex's portals;
// `decoy` adds a second mirror whose reflection leads nowhere. The ace is a mirror on the tee.
const MIRROR_HOLES = [
    "tutorial", "route", "tee", "decoy", "route", "teeDecoy", "tee", "decoy", "route",
    "teeDecoy", "route", "decoy", "tee", "route", "decoy", "ace", "teeDecoy", "route",
];
const MIRROR_PLAN = {
    tutorial: { onTee: true, tutorial: true },
    tee: { onTee: true },
    teeDecoy: { onTee: true, decoy: true },
    route: {},
    decoy: { decoy: true },
    ace: { onTee: true },
};

// Each course keeps its tees and targets inside a hue range [from, to) in degrees (wrapping past 360),
// and optionally a saturation range `sats` [min, max], so the name says how it plays. Routes may still pass through other hues.
// `hazards(i, par, perfect)` says what hole i gets: { water, greenside, route } counts (or null for none).
// `layup` is a par 5 / perfect 3 hole whose birdie lines are all covered by water (perfect becomes 4).
// Expert courses (v1.3) use Expert par: perfect = par on par 3s and 4s, 4 on par 5s (the ace and
// the layup keep their own), and their bunkers each name the one wedge allowed out of them (v1.4).
// `rev` counts regenerations, so bests from older holes aren't shown.
const COURSES = [
    {
        id: "prism", name: "Prism Point", seed: 1, hues: [0, 360], difficulty: "Beginner", // full spectrum
        hazards: (i, par) => (i >= 9 && par >= 4 && i % 2 === 0 ? { greenside: 1 } : null), // a few bunkers on the back 9
        wind: null, // calm
    },
    {
        id: "ember", name: "Ember Dunes", seed: 2, rev: 2, hues: [345, 60], difficulty: "Standard", layout: [EMBER_FRONT, BACK], // par 73, reds, oranges, yellows
        hazards: (i, par, perfect) => (perfect === 1 ? null : { greenside: par === 5 ? 2 : 1, route: i % 3 === 0 ? 1 : 0 }), // the sand course
        wind: { hue: [4, 8], light: [2, 4] }, // steady breezes
    },
    {
        id: "verdant", name: "Verdant Pines", seed: 3, rev: 2, hues: [75, 165], difficulty: "Standard", layout: [FRONT_35, VERDANT_BACK], // par 70, greens
        hazards: (i, par, perfect) => (perfect > 1 && i % 3 === 1 ? { greenside: 1 } : null), // light sand
        wind: { hue: [2, 4] }, // light
    },
    {
        id: "cobalt", name: "Cobalt Bay", seed: 4, rev: 2, hues: [180, 250], difficulty: "Expert", layout: [FRONT, BACK_35], layup: 8, // par 71, blues
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band" }), // lakes until only 1–3 birdie lines remain
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
    {
        id: "indigo", name: "Royal Indigo", seed: 5, rev: 3, hues: [250, 320], difficulty: "Expert", layout: [FRONT_35, BACK_35], layup: 10, // par 70, purples
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band", greenside: 1, route: i % 2 }),
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
    // Expansion pack (v1.8): account-only courses, each built around one gimmick (`gimmick` is the
    // line shown on its card). Hole 1 teaches it: `tutorial` is shown there, and the hole is built
    // so the gimmick is the way to par.
    {
        id: "vortex", name: "Violet Vortex", seed: 6, rev: 3, hues: [250, 300], difficulty: "Expansion",
        gimmick: "Portals warp the ball to their exit color; black holes send it back to the tee.",
        tutorial: "A swatch with a dotted outline lands in a portal; its label shows where the ball comes out (yds from the pin). You need one to make par here.",
        portals: (i, par, perfect) => VORTEX_PLAN[VORTEX_HOLES[i]]?.(perfect) ?? null,
    },
    {
        id: "silverglass", name: "Silverglass Greens", seed: 7, hues: [0, 360], sats: [12, 45], difficulty: "Expansion", // muted colors
        gimmick: "On a mirror, the Mirror club reverses your color's hex (#5A1A5B → #B5A1A5).",
        tutorial: "You're on a mirror (silver on the map). From one you can play the Mirror club: it reverses your color's hex, #5A1A5B → #B5A1A5. You need it to make par here.",
        mirrors: (i, perfect) => ({ ...MIRROR_PLAN[MIRROR_HOLES[i]], skip: skipFor(perfect) }),
    },
];

const only = process.argv.slice(2); // optional: course ids to generate (others are kept from the current file)
const existing = only.length ? JSON.parse(readFileSync(new URL("../src/golf/courses.json", import.meta.url))) : [];

const courses = COURSES.map(({ id, name, seed, rev, hues, sats, difficulty, gimmick, tutorial, layout = [FRONT, BACK], hazards: planFor, layup, wind: windPlan, portals: portalsFor, mirrors: mirrorsFor }) => {
    if (only.length && !only.includes(id)) return existing.find(course => course.id === id);
    const rand = rng(seed);
    const hazardRand = rng(seed * 7919); // separate sequence: hazards don't change which holes are chosen
    const windRand = rng(seed * 104729); // and a third for wind
    const holes = layout.flat().map(([par, layoutPerfect], i) => {
        const perfect = difficulty === "Expert" && layoutPerfect > 1 && layup !== i ? expertPerfect(par) : layoutPerfect;
        const hole = buildHole({ rand, hazardRand, windRand }, {
            par, perfect, hues, sats, difficulty, plan: planFor?.(i, par, perfect), windPlan, layup: layup === i, portals: portalsFor?.(i, par, perfect), mirrors: mirrorsFor?.(i, perfect),
            log: (message) => console.log(`  (hole ${i + 1}: ${message})`),
        });
        const summary = [(hole.hazards ?? []).map(h => h.type).join(", ") || "clear", hole.wind ? `wind ${JSON.stringify(hole.wind)}` : "calm"].join("; ");
        console.log(`${name} hole ${i + 1}: par ${par}, perfect ${hole.perfect}, ${Math.round(yardsBetween(hole.tee, hole.target))} yds, ${summary}`);
        return hole;
    });
    return { id, name, ...(rev && { rev }), hues, difficulty, ...(gimmick && { gimmick }), ...(tutorial && { tutorial }), holes };
}).filter(Boolean);

const out = new URL("../src/golf/courses.json", import.meta.url);
// One hole per line, so course changes read clearly in a diff
const json = courses.map(({ holes, ...course }) =>
    `  ${JSON.stringify(course).slice(0, -1)},"holes":[\n${holes.map(h => `    ${JSON.stringify(h)}`).join(",\n")}\n  ]}`);
writeFileSync(out, `[\n${json.join(",\n")}\n]\n`);
console.log(`Wrote ${courses.length} course(s) to src/golf/courses.json`);
