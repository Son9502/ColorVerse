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
import { searchFrom, parFor, pathTo } from "../src/golf/solver.js";
import { allStrikes, roundHSL, encode } from "../src/golf/clubs.js";
import { hazardMap, isWedge } from "../src/golf/hazards.js";
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
// `hazards(i, par, perfect)` says what hole i gets: { water, greenside, route } counts (or null for none).
// `layup` is a par 5 / perfect 3 hole whose birdie lines are all covered by water (perfect becomes 4).
const COURSES = [
    {
        id: "prism", name: "Prism Point", seed: 1, hues: [0, 360], difficulty: "Beginner", // full spectrum
        hazards: (i, par) => (i >= 9 && par >= 4 && i % 2 === 0 ? { greenside: 1 } : null), // a few bunkers on the back 9
        wind: null, // calm
    },
    {
        id: "ember", name: "Ember Dunes", seed: 2, hues: [345, 60], difficulty: "Standard", // reds, oranges, yellows
        hazards: (i, par, perfect) => (perfect === 1 ? null : { greenside: par === 5 ? 2 : 1, route: i % 3 === 0 ? 1 : 0 }), // the sand course
        wind: { hue: [4, 8], light: [2, 4] }, // steady breezes
    },
    {
        id: "verdant", name: "Verdant Pines", seed: 3, hues: [75, 165], difficulty: "Standard", // greens
        hazards: (i, par, perfect) => (perfect > 1 && i % 3 === 1 ? { greenside: 1 } : null), // light sand
        wind: { hue: [2, 4] }, // light
    },
    {
        id: "cobalt", name: "Cobalt Bay", seed: 4, hues: [180, 250], difficulty: "Expert", layout: [FRONT, BACK_35], layup: 8, // par 71, blues
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band" }), // lakes until only 1–3 birdie lines remain
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
    {
        id: "indigo", name: "Royal Indigo", seed: 5, hues: [250, 320], difficulty: "Expert", layout: [FRONT_35, BACK_35], layup: 10, // par 70, purples
        hazards: (i, par, perfect) => (perfect === 1 ? null : { water: "band", greenside: 1, route: i % 2 }),
        wind: { hue: [8, 12], light: [4, 6] }, // strong
    },
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

// Birdie line range (first shots, out of 41, that keep the perfect score reachable) per difficulty,
// measured after hazards. Expert holes are chosen with more lines (`select`) so hazards can remove some.
const BIRDIE_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [1, 3] };
const SELECT_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [3, 8] };
const LAYUP_LINE = [2, 5]; // few enough birdie lines to cover every one with a lake

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

const yardsBetween = (a, b) => hslDistance(a, b) * 1000;

// First shots from the tee that keep `perfect` reachable (with hazards, if given)
function birdieLines(hole, perfect, map = null) {
    const seen = new Set();
    return allStrikes(hole.tee).filter(shot => {
        const code = encode(shot);
        if (seen.has(code)) return false; // several clubs can land on the same color
        seen.add(code);
        if (map?.at(shot) === "water") return false;
        return (parFor(searchFrom(shot, perfect - 1, map), hole.target)?.par ?? Infinity) <= perfect - 1;
    });
}
const birdieLineCount = (hole, perfect, map, wind = null) => {
    let count = 0;
    for (const shot of allStrikes(hole.tee, wind)) { // counts clubs, like the selection check
        if (map.at(shot) === "water") continue;
        if ((parFor(searchFrom(shot, perfect - 1, map, { wind }), hole.target)?.par ?? Infinity) <= perfect - 1) count++;
    }
    return count;
};

// A wind for the hole from the course's plan ({ hue: [min, max], light: [min, max] } in degrees /
// percentage points, either sign), or null if none passes the checks
function addWind(rand, hole, plan, band, checkBand) {
    const kinds = Object.keys(plan);
    const map = hazardMap(hole.hazards ?? []);
    for (let attempt = 0; attempt < 20; attempt++) {
        const kind = kinds[Math.floor(rand() * kinds.length)];
        const [min, max] = plan[kind];
        const strength = (min + Math.floor(rand() * (max - min + 1))) * (rand() < 0.5 ? -1 : 1);
        const wind = { [kind]: strength };

        if (parFor(searchFrom(hole.tee, hole.perfect, map, { wind }), hole.target)?.par !== hole.perfect) continue;
        if ((parFor(searchFrom(hole.tee, hole.par, map, { avoidHazards: true, wind }), hole.target)?.par ?? Infinity) > hole.par) continue;
        if (checkBand) {
            const line = birdieLineCount(hole, hole.perfect, map, wind);
            if (line < band[0] || line > band[1]) continue;
        }
        return wind;
    }
    return null;
}

// A color 40–90 yds from the target, for a bunker guarding the hole
function besideHole(rand, target) {
    for (let tries = 0; tries < 200; tries++) {
        const spot = roundHSL({
            h: target.h + Math.round((rand() - 0.5) * 50),
            s: target.s + Math.round((rand() - 0.5) * 50),
            l: target.l + Math.round((rand() - 0.5) * 50),
        });
        const yds = yardsBetween(spot, target);
        if (yds >= 40 && yds <= 90) return spot;
    }
    return null;
}

// Hazards for a chosen hole, or null if no placement passes the checks
function placeHazards(rand, hole, plan, band, layup) {
    const { tee, target, par, perfect } = hole;
    const base = searchFrom(tee, perfect);
    const route = pathTo(base, parFor(base, target).end);
    const lines = birdieLines(hole, perfect);
    const wedgeSpots = route.slice(0, -1).filter((_, k) => isWedge(route[k + 1].club)).map(stroke => stroke.hsl);
    if (layup && lines.length > 6) return null; // too many lines to cover with lakes

    for (let attempt = 0; attempt < 40; attempt++) {
        const hazards = [];
        const pick = (list) => list[Math.floor(rand() * list.length)];
        const radius = (min, max) => Math.round(min + rand() * (max - min));

        if (layup) {
            lines.forEach(spot => hazards.push({ type: "water", center: spot, radius: 30 }));
        } else {
            if (plan.water === "band") {
                // Expert: lakes on birdie-line landing spots, one at a time, until the line is in range
                const spots = [...lines].sort(() => rand() - 0.5);
                while (spots.length && hazards.length < 5) {
                    hazards.push({ type: "water", center: spots.pop(), radius: radius(30, 45) });
                    if (birdieLineCount(hole, perfect, hazardMap(hazards)) <= band[1]) break;
                }
            } else {
                for (let n = 0; n < (plan.water ?? 0) && lines.length; n++) hazards.push({ type: "water", center: pick(lines), radius: radius(30, 50) });
            }
            for (let n = 0; n < (plan.greenside ?? 0); n++) {
                const spot = besideHole(rand, target);
                if (spot) hazards.push({ type: "sand", center: spot, radius: radius(20, 35) });
            }
            for (let n = 0; n < (plan.route ?? 0) && wedgeSpots.length; n++) hazards.push({ type: "sand", center: pick(wedgeSpots), radius: radius(20, 30) });
        }
        if (!hazards.length) return null;

        // The tee and the hole are never inside (or right at the edge of) a hazard
        if (hazards.some(h => yardsBetween(tee, h.center) < h.radius + 10 || yardsBetween(target, h.center) < h.radius + 10)) continue;

        const map = hazardMap(hazards);
        const wanted = layup ? perfect + 1 : perfect;
        if (parFor(searchFrom(tee, wanted, map), target)?.par !== wanted) continue;
        // Finishable within par without touching any hazard
        if ((parFor(searchFrom(tee, par, map, { avoidHazards: true }), target)?.par ?? Infinity) > par) continue;
        if (!layup) {
            const line = birdieLineCount(hole, perfect, map);
            if (line < band[0] || line > band[1]) continue;
        }
        return { hazards, perfect: wanted };
    }
    return null;
}

const only = process.argv.slice(2); // optional: course ids to generate (others are kept from the current file)
const existing = only.length ? JSON.parse(readFileSync(new URL("../src/golf/courses.json", import.meta.url))) : [];

const courses = COURSES.map(({ id, name, seed, hues, difficulty, layout = [FRONT, BACK], hazards: planFor, layup, wind: windPlan }) => {
    if (only.length && !only.includes(id)) return existing.find(course => course.id === id);
    const rand = rng(seed);
    const hazardRand = rng(seed * 7919); // separate sequence: hazards don't change which holes are chosen
    const windRand = rng(seed * 104729); // and a third for wind
    const holes = layout.flat().map(([par, perfect], i) => {
        const plan = planFor?.(i, par, perfect);
        // If no hazard placement passes the checks, pick another hole (up to 10 tries) before leaving it clear
        let hole;
        for (let attempt = 0; attempt < 10; attempt++) {
            hole = makeHole(rand, par, perfect, hues, layup === i ? LAYUP_LINE : SELECT_LINE[difficulty]);
            if (!plan && layup !== i) break;
            const placed = placeHazards(hazardRand, hole, plan ?? {}, BIRDIE_LINE[difficulty], layup === i);
            if (placed) {
                Object.assign(hole, placed);
                break;
            }
            if (attempt === 9) console.log(`  (hole ${i + 1}: no hazard placement passed the checks; left clear)`);
        }
        if (windPlan) {
            // No band check on the ace (perfect 1) or the layup, as with hazards
            const wind = addWind(windRand, hole, windPlan, BIRDIE_LINE[difficulty], hole.perfect > 1 && layup !== i);
            if (wind) hole.wind = wind;
        }
        const summary = [(hole.hazards ?? []).map(h => h.type).join(", ") || "clear", hole.wind ? `wind ${JSON.stringify(hole.wind)}` : "calm"].join("; ");
        console.log(`${name} hole ${i + 1}: par ${par}, perfect ${hole.perfect}, ${Math.round(yardsBetween(hole.tee, hole.target))} yds, ${summary}`);
        return hole;
    });
    return { id, name, hues, difficulty, holes };
}).filter(Boolean);

const out = new URL("../src/golf/courses.json", import.meta.url);
// One hole per line, so course changes read clearly in a diff
const json = courses.map(({ holes, ...course }) =>
    `  ${JSON.stringify(course).slice(0, -1)},"holes":[\n${holes.map(h => `    ${JSON.stringify(h)}`).join(",\n")}\n  ]}`);
writeFileSync(out, `[\n${json.join(",\n")}\n]\n`);
console.log(`Wrote ${courses.length} course(s) to src/golf/courses.json`);
