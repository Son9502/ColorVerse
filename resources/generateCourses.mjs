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

import { writeFileSync } from "node:fs";
import { searchFrom, parFor } from "../src/golf/solver.js";
import { allStrikes, roundHSL } from "../src/golf/clubs.js";
import { hslDistance, IN_THE_HOLE, ON_THE_GREEN } from "../src/golf/oklab.js";

// [par, perfect] per hole. Par 3s and 4s are birdie-able; par 5s mix birdie and eagle chances.
// One ace (perfect 1) per course, on the back nine's second par 3.
const FRONT = [[4, 3], [4, 3], [3, 2], [5, 4], [4, 3], [4, 3], [3, 2], [4, 3], [5, 3]]; // 36
const BACK = [[4, 3], [5, 3], [3, 2], [4, 3], [4, 3], [5, 4], [3, 1], [4, 3], [4, 3]]; // 36
// Shorter layouts for later courses: fewer par 5s, more par 3s
const BACK_35 = [[4, 3], [5, 3], [3, 2], [4, 3], [4, 3], [3, 2], [3, 1], [4, 3], [5, 4]]; // 35 → par 71 with FRONT
const FRONT_35 = [[4, 3], [3, 2], [4, 3], [5, 4], [4, 3], [3, 2], [4, 3], [4, 3], [4, 3]]; // 35 → par 70 with BACK_35

// Each course keeps its tees and targets inside a hue range [from, to) in degrees (wrapping past 360),
// so the name says how it plays. Routes may still pass through other hues.
const COURSES = [
    { id: "prism", name: "Prism Point", seed: 1, hues: [0, 360], difficulty: "Beginner" }, // full spectrum
    { id: "ember", name: "Ember Dunes", seed: 2, hues: [345, 60], difficulty: "Standard" }, // reds, oranges, yellows
    { id: "verdant", name: "Verdant Pines", seed: 3, hues: [75, 165], difficulty: "Standard" }, // greens
    // v1.2 (with hazards):
    // { id: "cobalt", name: "Cobalt Bay", seed: 4, hues: [180, 250], difficulty: "Expert", layout: [FRONT, BACK_35] }, // par 71
    // { id: "indigo", name: "Royal Indigo", seed: 5, hues: [250, 320], difficulty: "Expert", layout: [FRONT_35, BACK_35] }, // par 70
];

// Small seeded PRNG (mulberry32)
function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Birdie line range (first shots, out of 41, that keep the perfect score reachable) per difficulty
const BIRDIE_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [1, 3] };

// Hole length in yards by par
const LENGTH = { 3: [0, 250], 4: [250, 400], 5: [350, Infinity] };

const hueSpan = ([from, to]) => ((to - from + 359) % 360) + 1;
const inHues = (h, hues) => (h - hues[0] + 360) % 360 < hueSpan(hues);

// Tees and targets stay clearly colored (no near-grays, near-blacks or near-whites) and in the course's hues
const inRange = ({ h, s, l }, hues) => inHues(h, hues) && s >= 30 && s <= 95 && l >= 22 && l <= 78;
const randomColor = (rand, hues) => ({
    h: (hues[0] + Math.floor(rand() * hueSpan(hues))) % 360,
    s: 30 + Math.floor(rand() * 66),
    l: 22 + Math.floor(rand() * 57),
});

// A color a few steps from `hsl`, at an OKLab distance in [min, max)
function nudge(rand, hsl, min, max) {
    for (let tries = 0; tries < 50; tries++) {
        const near = roundHSL({
            h: hsl.h + Math.round((rand() - 0.5) * 16),
            s: hsl.s + Math.round((rand() - 0.5) * 16),
            l: hsl.l + Math.round((rand() - 0.5) * 16),
        });
        const d = hslDistance(hsl, near);
        if (d >= min && d < max) return near;
    }
    return null;
}

// Swatches from the tee that look almost like the target but miss the hole
const lipOuts = (tee, target) => allStrikes(tee).filter(hsl => {
    const d = hslDistance(hsl, target);
    return d >= IN_THE_HOLE && d < ON_THE_GREEN;
}).length;

// Candidate target for a hole. Par 3s are built next to a tee swatch so there's a lip-out
// (and, on the ace hole, a swatch inside the hole); longer holes use any color.
function candidateTarget(rand, tee, par, perfect, hues) {
    if (par !== 3) return randomColor(rand, hues);
    const swatches = allStrikes(tee);
    const base = swatches[Math.floor(rand() * swatches.length)];
    return perfect === 1
        ? nudge(rand, base, 0, IN_THE_HOLE * 0.75) // ace swatch lands in the hole
        : nudge(rand, base, IN_THE_HOLE, ON_THE_GREEN); // that swatch lips out
}

function makeHole(rand, par, perfect, hues, birdieLine) {
    for (;;) {
        const tee = randomColor(rand, hues);
        const search = searchFrom(tee, perfect);
        let firstShots = null; // searches from each first shot, built once per tee when needed
        for (let tries = 0; tries < 300; tries++) {
            const target = candidateTarget(rand, tee, par, perfect, hues);
            if (!target || !inRange(target, hues)) continue;
            if (hslDistance(tee, target) < ON_THE_GREEN * 2) continue; // tee can't start on the green
            const yards = hslDistance(tee, target) * 1000;
            if (yards < LENGTH[par][0] || yards > LENGTH[par][1]) continue;
            if (par === 3 && lipOuts(tee, target) === 0) continue; // a close match is never a sure ace
            if (parFor(search, target)?.par !== perfect) continue;
            if (perfect === 1) return { tee, target, par, perfect }; // the ace hole: one swatch, no band

            firstShots ??= allStrikes(tee).map(shot => searchFrom(shot, perfect - 1));
            const line = firstShots.filter(next => (parFor(next, target)?.par ?? Infinity) <= perfect - 1).length;
            if (line >= birdieLine[0] && line <= birdieLine[1]) return { tee, target, par, perfect };
        }
    }
}

const courses = COURSES.map(({ id, name, seed, hues, difficulty, layout = [FRONT, BACK] }) => {
    const rand = rng(seed);
    const holes = layout.flat().map(([par, perfect], i) => {
        const hole = makeHole(rand, par, perfect, hues, BIRDIE_LINE[difficulty]);
        console.log(`${name} hole ${i + 1}: par ${par}, perfect ${perfect}, ${Math.round(hslDistance(hole.tee, hole.target) * 1000)} yds`);
        return hole;
    });
    return { id, name, hues, difficulty, holes };
});

const out = new URL("../src/golf/courses.json", import.meta.url);
// One hole per line, so course changes read clearly in a diff
const json = courses.map(({ holes, ...course }) =>
    `  ${JSON.stringify(course).slice(0, -1)},"holes":[\n${holes.map(h => `    ${JSON.stringify(h)}`).join(",\n")}\n  ]}`);
writeFileSync(out, `[\n${json.join(",\n")}\n]\n`);
console.log(`Wrote ${courses.length} course(s) to src/golf/courses.json`);
