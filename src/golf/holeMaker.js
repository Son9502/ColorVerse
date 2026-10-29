import { searchFrom, parFor, pathTo, reachesWithin } from "./solver.js";
import { allStrikes, roundHSL, encode } from "./clubs.js";
import { hazardMap, isWedge } from "./hazards.js";
import { hslDistance, IN_THE_HOLE, ON_THE_GREEN } from "./oklab.js";

// ----------------------------------
// Color Golf hole builder
// ----------------------------------
// Picks a tee and target the par solver agrees with, then hazards and wind, each re-checked.
// Shared by the course and daily generators (Node, resources/) and the practice worker (browser).
// Every choice comes from the seeded `rand` functions passed in, so a seed always gives the same hole.

// Small seeded PRNG (mulberry32)
export function rng(seed) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Birdie line range (first shots, out of 41, that keep the perfect score reachable) per difficulty,
// measured after hazards. Expert holes are chosen with more lines (`select`) so hazards can remove some.
export const BIRDIE_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [1, 3] };
export const SELECT_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [3, 8] };
export const LAYUP_LINE = [2, 5]; // few enough birdie lines to cover every one with a lake

// Expert par (v1.3): no spare stroke on par 3s and 4s (par = perfect), one on par 5s
export const expertPerfect = (par) => (par === 5 ? 4 : par);

// Hole length in yards by par
const LENGTH = { 3: [0, 250], 4: [250, 400], 5: [350, Infinity] };

export const hueSpan = ([from, to]) => ((to - from + 359) % 360) + 1;
export const inHues = (h, hues) => (h - hues[0] + 360) % 360 < hueSpan(hues);

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

export function makeHole(rand, par, perfect, hues, birdieLine) {
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

// First shots from the tee that keep `perfect` reachable (with hazards, if given)
function birdieLines(hole, perfect, map = null) {
    const seen = new Set();
    return allStrikes(hole.tee).filter(shot => {
        const code = encode(shot);
        if (seen.has(code)) return false; // several clubs can land on the same color
        seen.add(code);
        if (map?.at(shot) === "water") return false;
        return reachesWithin(shot, hole.target, perfect - 1, map);
    });
}
const birdieLineCount = (hole, perfect, map, wind = null) => {
    let count = 0;
    for (const shot of allStrikes(hole.tee, wind)) { // counts clubs, like the selection check
        if (map.at(shot) === "water") continue;
        if (reachesWithin(shot, hole.target, perfect - 1, map, { wind })) count++;
    }
    return count;
};

// A wind for the hole from the course's plan ({ hue: [min, max], light: [min, max] } in degrees /
// percentage points, either sign), or null if none passes the checks
export function addWind(rand, hole, plan, band, checkBand) {
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
export function placeHazards(rand, hole, plan, band, layup) {
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

// One hole: { tee, target, par, perfect, hazards?, wind? }. `rands` are { rand, hazardRand, windRand }
// (separate sequences, so adding hazards or wind never changes which tee and target are chosen).
// `plan` is { water, greenside, route } counts or null; `windPlan` is { hue: [min, max], light: [min, max] }
// or null. `layup` makes a par 5 whose birdie lines are all under water. `log` reports a hole left clear.
export function buildHole({ rand, hazardRand, windRand }, { par, perfect, hues, difficulty, plan = null, windPlan = null, layup = false, log = () => {} }) {
    // If no hazard placement passes the checks, pick another hole (up to 10 tries) before leaving it clear
    let hole;
    for (let attempt = 0; attempt < 10; attempt++) {
        // With hazards coming, pick holes with extra birdie lines for them to take away
        const line = layup ? LAYUP_LINE : plan ? SELECT_LINE[difficulty] : BIRDIE_LINE[difficulty];
        hole = makeHole(rand, par, perfect, hues, line);
        if (!plan && !layup) break;
        const placed = placeHazards(hazardRand, hole, plan ?? {}, BIRDIE_LINE[difficulty], layup);
        if (placed) {
            Object.assign(hole, placed);
            break;
        }
        if (attempt === 9) log("no hazard placement passed the checks; left clear");
    }
    if (windPlan) {
        // No band check on the ace (perfect 1) or the layup, as with hazards
        const wind = addWind(windRand, hole, windPlan, BIRDIE_LINE[difficulty], hole.perfect > 1 && !layup);
        if (wind) hole.wind = wind;
    }
    // The perfect line, shown in the game: first shots (of 41) that keep the perfect score reachable
    hole.lines = birdieLineCount(hole, hole.perfect, hazardMap(hole.hazards ?? []), hole.wind ?? null);
    return hole;
}

export const yardsBetween = (a, b) => hslDistance(a, b) * 1000;
