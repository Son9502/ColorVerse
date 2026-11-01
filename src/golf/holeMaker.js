import { searchFrom, parFor, pathTo, reachesWithin } from "./solver.js";
import { CLUBS, STANDARD_CLUBS, allStrikes, strike, mirrorOf, roundHSL, encode, decode } from "./clubs.js";
import { hazardMap, isWedge, WEDGES } from "./hazards.js";
import { clubMask, ruleAllows, windFor, windOptions } from "./rules.js";
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
// Expansion courses (v1.8) sit between Standard and Expert; their gimmick decides which holes pass.
export const BIRDIE_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [1, 3], Expansion: [1, 4] };
export const SELECT_LINE = { Beginner: [6, 41], Standard: [3, 6], Expert: [3, 8], Expansion: [1, 41] };
export const LAYUP_LINE = [2, 5]; // few enough birdie lines to cover every one with a lake

// Expert par (v1.3): no spare stroke on par 3s and 4s (par = perfect), one on par 5s
export const expertPerfect = (par) => (par === 5 ? 4 : par);

// Hole length in yards by par
const LENGTH = { 3: [0, 250], 4: [250, 400], 5: [350, Infinity] };

export const hueSpan = ([from, to]) => ((to - from + 359) % 360) + 1;
export const inHues = (h, hues) => (h - hues[0] + 360) % 360 < hueSpan(hues);

// Tees and targets stay clearly colored (no near-grays, near-blacks or near-whites) and in the course's hues.
// `sats` narrows saturation for a course (Silverglass Greens, v1.8.1: muted colors).
const SATS = [30, 95];
const inRange = ({ h, s, l }, hues, sats = SATS) => inHues(h, hues) && s >= sats[0] && s <= sats[1] && l >= 22 && l <= 78;
const randomColor = (rand, hues, sats = SATS) => ({
    h: (hues[0] + Math.floor(rand() * hueSpan(hues))) % 360,
    s: sats[0] + Math.floor(rand() * (sats[1] - sats[0] + 1)),
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
function candidateTarget(rand, tee, par, perfect, hues, sats) {
    if (par !== 3) return randomColor(rand, hues, sats);
    const swatches = allStrikes(tee);
    const base = swatches[Math.floor(rand() * swatches.length)];
    return perfect === 1
        ? nudge(rand, base, 0, IN_THE_HOLE * 0.75) // ace swatch lands in the hole
        : nudge(rand, base, IN_THE_HOLE, ON_THE_GREEN); // that swatch lips out
}

// `think` (v1.8.2): see thinks(); checked here before hazards as a quick filter, and again on the finished hole
export function makeHole(rand, par, perfect, hues, birdieLine, sats = SATS, think = 0) {
    for (;;) {
        const tee = randomColor(rand, hues, sats);
        const search = searchFrom(tee, perfect);
        let firstShots = null; // searches from each first shot, built once per tee when needed
        for (let tries = 0; tries < 300; tries++) {
            const target = candidateTarget(rand, tee, par, perfect, hues, sats);
            if (!target || !inRange(target, hues, sats)) continue;
            if (hslDistance(tee, target) < ON_THE_GREEN * 2) continue; // tee can't start on the green
            const yards = hslDistance(tee, target) * 1000;
            if (yards < LENGTH[par][0] || yards > LENGTH[par][1]) continue;
            if (par === 3 && lipOuts(tee, target) === 0) continue; // a close match is never a sure ace
            if (parFor(search, target)?.par !== perfect) continue;
            if (perfect === 1) return { tee, target, par, perfect }; // the ace hole: one swatch, no band

            firstShots ??= allStrikes(tee).map(shot => searchFrom(shot, perfect - 1));
            const line = firstShots.filter(next => (parFor(next, target)?.par ?? Infinity) <= perfect - 1).length;
            if (line < birdieLine[0] || line > birdieLine[1]) continue;
            if (think && !thinks({ tee, target, perfect }, think)) continue;
            return { tee, target, par, perfect };
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
// (only clubs the hole's rules allow, v1.8.2; with a turning wind, v1.8.3, the first stroke's wind,
// then the cycle from stroke 2; with a roulette, v1.8.4, its four shots too, and with flips, v1.8.5, their five)
const birdieLineCount = (hole, perfect, map, wind = null) => {
    const rules = hole.rules ?? null;
    const allowed = clubMask(rules);
    const cycle = rules?.windCycle ?? null;
    const roulette = rules?.roulette ?? null;
    const flip = !!rules?.flip;
    let count = 0;
    allStrikes(hole.tee, cycle ? cycle[0] : wind, roulette, flip).forEach((landing, i) => { // counts clubs, like the selection check
        if (!landing || (allowed && !allowed[i])) return;
        const shot = map.land(landing); // through a portal (v1.8) or a mirror (v1.8.1)
        if (map.at(landing) === "water") return;
        if (reachesWithin(shot, hole.target, perfect - 1, map, { wind, cycle, played: 1, roulette, flip, rules })) count++;
    });
    return count;
};

// "Make you think" (v1.8.2): none of the `count` tee shots that end up closest to the pin (after any
// portal or mirror, counting only clubs the hole allows) keeps the perfect score, so the obvious
// swatch is never the answer and the perfect route goes another way first. Not on the ace.
export function thinks(hole, count) {
    if (hole.perfect <= 1) return true;
    const map = hazardMap(hole.hazards ?? []);
    const options = { ...windOptions(hole), played: 1, rules: hole.rules ?? null };
    const seen = new Set();
    const closest = allStrikes(hole.tee, windFor(hole, 0), options.roulette, options.flip)
        .filter((landing, i) => landing && ruleAllows(options.rules, CLUBS[i]) && map.at(landing) !== "water")
        .map(landing => map.land(landing))
        .filter(end => !seen.has(encode(end)) && seen.add(encode(end)))
        .sort((a, b) => hslDistance(a, hole.target) - hslDistance(b, hole.target))
        .slice(0, count);
    return !closest.some(end => reachesWithin(end, hole.target, hole.perfect - 1, map, options));
}

// Whether a perfect route plays like golf (v1.8.2): the putter only near the pin, no Driver or Woods
// into the hole (solver.js: `golf`)
export function playsLikeGolf(hole) {
    const options = { ...windOptions(hole), rules: hole.rules ?? null, golf: hole.target };
    return parFor(searchFrom(hole.tee, hole.perfect, hazardMap(hole.hazards ?? []), options), hole.target)?.par === hole.perfect;
}

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
            // Expert bunkers (v1.4) name the one wedge that can be played out of them
            const sand = (center, r) => ({ type: "sand", center, radius: r, ...(plan.wedgeOnly && { wedge: pick(WEDGES) }) });
            for (let n = 0; n < (plan.greenside ?? 0); n++) {
                const spot = besideHole(rand, target);
                if (spot) hazards.push(sand(spot, radius(20, 35)));
            }
            for (let n = 0; n < (plan.route ?? 0) && wedgeSpots.length; n++) hazards.push(sand(pick(wedgeSpots), radius(20, 30)));
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

// Portals (v1.8) for a hole built `skip` strokes longer than wanted (its perfect is `wanted` + `skip`):
// a shortcut portal on one of the tee's landing spots exits `skip` strokes along the hole's best
// route, so taking it is what makes `wanted` possible. With `skip` 2 on a par 3 or 4, par itself
// needs the portal. With `trap`, a second portal on the obvious line (a first shot that still
// finishes in the hole's own length) throws the ball far from the hole instead, so the natural
// route is the risky one. A `tutorial` portal (the course's first hole) is bigger, so more swatches
// lead into it, and never has a trap.
// Returns { hazards, perfect: wanted }, or null if no placement passes the checks.
export function placePortals(rand, hole, wanted, band, { trap = false, skip = 1, tutorial = false } = {}) {
    const { tee, target, par } = hole;
    const base = searchFrom(tee, hole.perfect);
    const route = pathTo(base, parFor(base, target).end);
    const shots = allStrikes(tee);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const radius = () => Math.round(tutorial ? 36 + rand() * 6 : 20 + rand() * 12);
    const clear = (spot, portals) => portals.every(p => yardsBetween(spot, p.center) >= p.radius + 10);

    for (let attempt = 0; attempt < 40; attempt++) {
        const shortcut = { type: "portal", center: pick(shots), radius: radius(), exit: route[skip].hsl };
        const portals = [shortcut];
        if (trap && !tutorial) {
            const map = hazardMap(portals);
            const lines = shots.filter(shot => shot !== shortcut.center && clear(shot, portals)
                && reachesWithin(map.land(shot), target, hole.perfect - 1, map));
            // The trap's exit: any clear color at least 250 yds from the hole
            let far = null;
            for (let tries = 0; tries < 30 && !far; tries++) {
                const spot = randomColor(rand, [0, 360]);
                if (yardsBetween(spot, target) >= 250) far = spot;
            }
            if (lines.length && far) portals.push({ type: "portal", center: pick(lines), radius: radius(), exit: far });
        }
        // The tee, the hole and every exit stay outside (and clear of the edge of) every portal
        if (![tee, target, ...portals.map(p => p.exit)].every(spot => clear(spot, portals))) continue;

        const map = hazardMap(portals);
        if (parFor(searchFrom(tee, wanted, map), target)?.par !== wanted) continue;
        if ((parFor(searchFrom(tee, par, map), target)?.par ?? Infinity) > par) continue;
        const line = birdieLineCount(hole, wanted, map);
        if (line < band[0] || line > band[1]) continue;
        return { hazards: portals, perfect: wanted };
    }
    return null;
}

// A seeded color anywhere on the wheel whose distance from `spot` (yds) is in [min, max), or null
function colorAround(rand, spot, min, max = Infinity) {
    for (let tries = 0; tries < 60; tries++) {
        const color = randomColor(rand, [0, 360]);
        const yds = yardsBetween(color, spot);
        if (yds >= min && yds < max) return color;
    }
    return null;
}

// Whether a new region (center, radius) stays clear of `regions` and of the `spots` (tee, pin, exits)
const roomFor = (center, radius, regions, spots) =>
    regions.every(r => yardsBetween(center, r.center) >= r.radius + radius + 5)
    && spots.every(spot => yardsBetween(center, spot) >= radius + 10);

// Black holes (v1.8) for a portal hole: `count` of them, big (35–55 yds), each either on a tee
// shot (one that doesn't go into a portal) or on a landing of the best portal-free route (`length`
// strokes long), alternating, so they're both easy to hit and in the way of the long way round.
// The portal route is re-checked: perfect unchanged, par reachable, the birdie line in range.
// Returns the black holes, or null if no placement passes the checks.
export function placeBlackHoles(rand, hole, band, count, length) {
    const { tee, target, par, hazards: portals } = hole;
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const fixed = [tee, target, ...portals.map(p => p.exit)];
    const portalMap = hazardMap(portals);
    const teeShots = allStrikes(tee).filter(shot => !portalMap.portalAt(shot));

    for (let attempt = 0; attempt < 20; attempt++) {
        const blackHoles = [];
        for (let n = 0; n < count; n++) {
            const radius = Math.round(35 + rand() * 20);
            let spots = teeShots;
            if (n % 2 === 1) {
                const search = searchFrom(tee, length, hazardMap([...portals, ...blackHoles]), { avoidPortals: true });
                const end = parFor(search, target)?.end;
                spots = end === undefined ? [] : pathTo(search, end).slice(0, -1).map(stroke => stroke.hsl);
            }
            spots = spots.filter(spot => roomFor(spot, radius, [...portals, ...blackHoles], fixed));
            if (spots.length) blackHoles.push({ type: "blackhole", center: pick(spots), radius });
        }
        if (!blackHoles.length) continue;

        const map = hazardMap([...portals, ...blackHoles]);
        if (parFor(searchFrom(tee, hole.perfect, map), target)?.par !== hole.perfect) continue;
        if ((parFor(searchFrom(tee, par, map), target)?.par ?? Infinity) > par) continue;
        const line = birdieLineCount(hole, hole.perfect, map);
        if (line < band[0] || line > band[1]) continue;
        return blackHoles;
    }
    return null;
}

// A portal chain (v1.8): `wanted` − 1 portals in a row. One from the tee exits somewhere else on the
// wheel, where a swatch goes into the next, and so on; the last exits one stroke from the hole
// (on the hole's best route), so the chain then a finishing shot is the perfect score.
// Returns { hazards, perfect: wanted }, or null if no placement passes the checks.
export function placeChain(rand, hole, wanted, band) {
    const { tee, target, par } = hole;
    const base = searchFrom(tee, hole.perfect);
    const route = pathTo(base, parFor(base, target).end);
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const count = wanted - 1;

    for (let attempt = 0; attempt < 60; attempt++) {
        const portals = [];
        let from = tee;
        for (let n = 0; n < count; n++) {
            const exit = n === count - 1 ? route.at(-2).hsl : colorAround(rand, target, 150);
            const center = pick(allStrikes(from));
            const radius = Math.round(20 + rand() * 10);
            if (!exit || !roomFor(center, radius, portals, [tee, target, from])) break;
            portals.push({ type: "portal", center, radius, exit });
            from = exit;
        }
        if (portals.length < count) continue;
        if (!portals.every(p => roomFor(p.exit, 0, portals, []))) continue; // every exit clear of every portal

        const map = hazardMap(portals);
        if (parFor(searchFrom(tee, wanted, map), target)?.par !== wanted) continue;
        if ((parFor(searchFrom(tee, par, map), target)?.par ?? Infinity) > par) continue;
        const line = birdieLineCount(hole, wanted, map);
        if (line < band[0] || line > band[1]) continue;
        return { hazards: portals, perfect: wanted };
    }
    return null;
}

// A portal maze (v1.8): most of the tee's full shots (at least `share` of the 35 swatches that
// aren't putts; putts and other short shots stay too near the tee for a portal) go into a portal.
// One is the shortcut (it exits `skip` strokes along the hole's best route, like placePortals);
// the rest are decoys whose exits look close (40–160 yds from the pin) but can't make the perfect
// score, so the yardage alone doesn't give the answer.
// Returns { hazards, perfect: wanted }, or null if no placement passes the checks.
export function placeMaze(rand, hole, wanted, band, { skip = 1, share = 0.5 } = {}) {
    const { tee, target, par } = hole;
    const base = searchFrom(tee, hole.perfect);
    const route = pathTo(base, parFor(base, target).end);
    const shots = allStrikes(tee).filter((_, i) => CLUBS[i].row !== "putter");
    const radius = () => Math.round(25 + rand() * 13);

    for (let attempt = 0; attempt < 30; attempt++) {
        const order = [...shots].sort(() => rand() - 0.5);
        const portals = [{ type: "portal", center: order[0], radius: radius(), exit: route[skip].hsl }];
        const fixed = [tee, target, route[skip].hsl];
        const covered = () => { const map = hazardMap(portals); return shots.filter(shot => map.portalAt(shot)).length; };
        for (const spot of order.slice(1)) {
            if (portals.length >= 16 || covered() >= shots.length * share) break;
            const r = radius();
            if (!roomFor(spot, r, portals, fixed)) continue;
            let exit = null;
            for (let tries = 0; tries < 10 && !exit; tries++) {
                const color = colorAround(rand, target, 40, 160);
                if (color && !reachesWithin(color, target, wanted - 1, hazardMap(portals))) exit = color;
            }
            if (!exit) continue;
            portals.push({ type: "portal", center: spot, radius: r, exit });
            fixed.push(exit);
        }
        if (covered() < shots.length * share) continue;
        if (![tee, target, ...portals.map(p => p.exit)].every(spot => roomFor(spot, 0, portals, []))) continue;

        const map = hazardMap(portals);
        if (parFor(searchFrom(tee, wanted, map), target)?.par !== wanted) continue;
        if ((parFor(searchFrom(tee, par, map), target)?.par ?? Infinity) > par) continue;
        const line = birdieLineCount(hole, wanted, map);
        if (line < band[0] || line > band[1]) continue;
        return { hazards: portals, perfect: wanted };
    }
    return null;
}

// A mirror hole (v1.8.1), built round its mirrors the way portal holes are built round their portals.
// A mirror sits where one of the tee's full shots lands and flips the ball's hex there, for no extra
// stroke; the pin is the rest of the perfect score from that reflection. With `chain`, the reflection
// is one shot from a second mirror, and the pin is the rest from *its* reflection (neither mirror alone
// makes the perfect score). Without mirrors the hole is at least `skip` strokes longer, so they're the
// way to par. A `decoy` is one more mirror on another tee shot, reflecting 200+ yds from the pin and off
// the perfect score. A `tutorial` mirror is bigger, and 3+ tee shots land on it. Each flip that
// matters lands at most 75% of the hole's length from the pin, so the swatch's label reads as progress.
// Returns { tee, target, par, perfect, hazards }, or null if 400 tries find nothing.
export function makeMirrorHole(rand, { par, perfect, hues, sats, band, chain = false, decoy = false, tutorial = false, skip = 1 }) {
    const after = perfect - (chain ? 2 : 1); // strokes from the last reflection into the hole
    if (after < 0) return null;
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const radius = () => Math.round(tutorial ? 34 + rand() * 6 : 22 + rand() * 10);
    const fullShots = (from) => allStrikes(from).slice(0, 35); // a putt stays too near to need a mirror

    for (let tries = 0; tries < 400; tries++) {
        const tee = randomColor(rand, hues, sats);
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        // Mirror spots: a tee shot, then (chain) a shot from its reflection
        const spots = [pick(fullShots(tee))];
        if (chain) spots.push(pick(fullShots(mirrorOf(spots[0]))));
        const last = mirrorOf(spots.at(-1));

        // The pin: `after` strokes from the last reflection (on it, when that's 0)
        let pins;
        if (after === 0) {
            pins = [nudge(rand, last, 0, IN_THE_HOLE * 0.75)].filter(pin => pin && fits(pin));
        } else {
            const search = searchFrom(last, after);
            pins = search.reached.filter(code => search.dist[code] === after).map(decode).filter(fits);
        }
        const closer = (pin) => spots.every(spot => yardsBetween(mirrorOf(spot), pin) <= yardsBetween(tee, pin) * 0.75);
        pins = pins.filter(closer);
        if (!pins.length) continue;
        const target = pick(pins);

        // Mirrors clear of each other, the tee, the pin and the reflections (so a flip lands off them)
        const mirrors = [];
        const fixed = [tee, target, ...spots.map(mirrorOf)];
        for (const center of spots) {
            const r = radius();
            if (roomFor(center, r, mirrors, fixed)) mirrors.push({ type: "mirror", center, radius: r });
        }
        if (mirrors.length < spots.length) continue;
        if (tutorial && allStrikes(tee).filter(shot => hazardMap(mirrors).at(shot) === "mirror").length < 3) continue;
        if (decoy) {
            const options = fullShots(tee).filter(shot => roomFor(shot, 30, mirrors, fixed)
                && yardsBetween(mirrorOf(shot), target) >= 200 && !reachesWithin(mirrorOf(shot), target, perfect - 1));
            if (!options.length) continue;
            mirrors.push({ type: "mirror", center: pick(options), radius: radius() });
        }

        // Without mirrors: at least `skip` strokes longer. With them: exactly `perfect`, and a chain
        // needs both of its mirrors
        if (reachesWithin(tee, target, perfect + skip - 1)) continue;
        const reaches = (list) => parFor(searchFrom(tee, perfect, hazardMap(list)), target)?.par === perfect;
        if (!reaches(mirrors)) continue;
        if (chain && (reaches(mirrors.filter((_, i) => i !== 0)) || reaches(mirrors.filter((_, i) => i !== 1)))) continue;
        const hole = { tee, target, par, perfect, hazards: mirrors };
        const line = birdieLineCount(hole, perfect, hazardMap(mirrors));
        if (perfect > 1 && (line < band[0] || line > band[1])) continue;
        return hole;
    }
    return null;
}

// A club-ban hole (v1.8.2, Caddie Strike): `rules` bans some rows, and the pin is a color the allowed
// clubs reach in exactly `perfect` strokes but every club together reaches in fewer, so the ban
// always costs at least a stroke (not checked on the ace), and putts alone can't hole it (the tee
// isn't really on the green). Birdie line in `band`, counting allowed clubs.
// Returns { tee, target, par, perfect, rules }, or null if 300 tries find nothing.
const PUTTS_ONLY = { ban: [...new Set(CLUBS.map(club => club.row))].filter(row => row !== "putter") };

export function makeBanHole(rand, { par, perfect, hues, sats, band, rules, think = 0 }) {
    for (let tries = 0; tries < 300; tries++) {
        const tee = randomColor(rand, hues, sats);
        const search = searchFrom(tee, perfect, null, { rules });
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        // Colors first reached in exactly `perfect` strokes (the ace: a swatch, nudged inside the hole)
        let pins = search.reached.filter(code => search.dist[code] === perfect).map(decode);
        if (perfect === 1) pins = pins.map(pin => nudge(rand, pin, 0, IN_THE_HOLE * 0.75)).filter(Boolean);
        pins = pins.filter(fits);
        for (let n = 0; n < 12 && pins.length; n++) {
            const target = pins.splice(Math.floor(rand() * pins.length), 1)[0];
            if (parFor(search, target)?.par !== perfect) continue;
            if (perfect > 1 && !reachesWithin(tee, target, perfect - 1)) continue; // the ban costs a stroke
            if (reachesWithin(tee, target, perfect, null, { rules: PUTTS_ONLY })) continue;
            const hole = { tee, target, par, perfect, rules };
            if (perfect > 1) {
                const line = birdieLineCount(hole, perfect, hazardMap([]));
                if (line < band[0] || line > band[1]) continue;
            }
            if (think && !(thinks(hole, think) && playsLikeGolf(hole))) continue; // see buildHole
            return hole;
        }
    }
    return null;
}

// A turning-wind hole (v1.8.3, Saffron Whirlwind): a cycle of 2–3 winds (`length`, or either), one
// per stroke (rules.js: windCycle), from `{ hue: [min, max], light: [min, max] }` strengths either
// way, and at most one calm (none with `calm: false`). The pin is a color first reached in exactly `perfect` strokes in that
// wind, and the wind has to matter: some tee swatch that would keep the perfect score in calm air
// doesn't in this one. Birdie line in `band`; `think` as in buildHole.
// Returns { tee, target, par, perfect, rules }, or null if 300 tries find nothing.
export function makeWindHole(rand, { par, perfect, hues, sats, band, think = 0, strengths, length = null, calm = true }) {
    const between = ([min, max]) => (min + Math.floor(rand() * (max - min + 1))) * (rand() < 0.5 ? -1 : 1);
    const randomCycle = () => {
        const n = length ?? (rand() < 0.5 ? 2 : 3);
        const winds = [];
        for (let i = 0; i < n; i++) {
            const kind = !calm || winds.includes(null) ? (rand() < 0.5 ? "hue" : "light") : ["hue", "light", "calm"][Math.floor(rand() * 3)];
            winds.push(kind === "calm" ? null : { [kind]: between(strengths[kind]) });
        }
        return winds;
    };
    for (let tries = 0; tries < 300; tries++) {
        const cycle = randomCycle();
        if (cycle.every(wind => !wind)) continue;
        const rules = { windCycle: cycle };
        const tee = randomColor(rand, hues, sats);
        const search = searchFrom(tee, perfect, null, { cycle });
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        let pins = search.reached.filter(code => search.dist[code] === perfect).map(decode);
        if (perfect === 1) pins = pins.map(pin => nudge(rand, pin, 0, IN_THE_HOLE * 0.75)).filter(Boolean);
        pins = pins.filter(fits);
        for (let n = 0; n < 12 && pins.length; n++) {
            const target = pins.splice(Math.floor(rand() * pins.length), 1)[0];
            if (parFor(search, target)?.par !== perfect) continue;
            // The wind matters: a swatch that keeps the perfect score in calm air but not in this wind
            const misled = STANDARD_CLUBS.some(club => reachesWithin(strike(tee, club), target, perfect - 1)
                && !reachesWithin(strike(tee, club, cycle[0]), target, perfect - 1, null, { cycle, played: 1 }));
            if (!misled) continue;
            const hole = { tee, target, par, perfect, rules };
            if (perfect > 1) {
                const line = birdieLineCount(hole, perfect, hazardMap([]));
                if (line < band[0] || line > band[1]) continue;
            }
            if (think && !(thinks(hole, think) && playsLikeGolf(hole))) continue; // see buildHole
            return hole;
        }
    }
    return null;
}

// A roulette hole (v1.8.4, Scarlet Roulette): four hue shifts (rules.js: roulette) between 10° and 170°
// either way, none within 4° of a shift the harmony clubs already make, so each opens new moves. The
// pin is a color first reached in exactly `perfect` strokes with them, and without the roulette the
// hole is at least `skip` strokes longer. Two is out of reach: the harmony clubs already get to any
// hue within a few strokes, so a hue shift saves one stroke at most, and the roulette is the way to
// the perfect score rather than to par.
// Birdie line in `band` (out of 45 first shots); `think` as in buildHole.
// Returns { tee, target, par, perfect, rules }, or null if 300 tries find nothing.
const HARMONY_SHIFTS = [20, 40, 60, 90, 120, 150, 180, 210, 240, 270, 300, 320, 340];
export function makeRouletteHole(rand, options) {
    const fresh = (shift) => HARMONY_SHIFTS.every(h => Math.abs(((shift - h + 540) % 360) - 180) > 4);
    return makeExtraClubHole(rand, options, () => {
        const roulette = [];
        while (roulette.length < 4) {
            const shift = (10 + Math.floor(rand() * 161)) * (rand() < 0.5 ? -1 : 1);
            if (fresh(shift) && roulette.every(s => Math.abs(s - shift) > 15)) roulette.push(shift);
        }
        return { roulette };
    });
}

// A flip hole (v1.8.5, Hexflip Hollow): the five flip clubs (rules.js: flip), built like a roulette
// hole: the pin is first reached in exactly `perfect` strokes with them, and without them the hole is
// at least `skip` strokes longer. Flips 2 and 4 turn the channels round (about ±120°, like Triadic),
// so the ones that matter are the odd ones, the wild jumps. Birdie line out of 46 first shots.
export const makeFlipHole = (rand, options) => makeExtraClubHole(rand, options, () => ({ flip: true }));

// A hole built round clubs only it has (the roulette or the flips): `makeRules()` gives each try's rules
function makeExtraClubHole(rand, { par, perfect, hues, sats, band, think = 0, skip = 1 }, makeRules) {
    for (let tries = 0; tries < 300; tries++) {
        const rules = makeRules();
        const tee = randomColor(rand, hues, sats);
        const search = searchFrom(tee, perfect, null, { roulette: rules.roulette ?? null, flip: !!rules.flip });
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        let pins = search.reached.filter(code => search.dist[code] === perfect).map(decode);
        if (perfect === 1) pins = pins.map(pin => nudge(rand, pin, 0, IN_THE_HOLE * 0.75)).filter(Boolean);
        pins = pins.filter(fits);
        for (let n = 0; n < 12 && pins.length; n++) {
            const target = pins.splice(Math.floor(rand() * pins.length), 1)[0];
            if (parFor(search, target)?.par !== perfect) continue;
            if (reachesWithin(tee, target, perfect + skip - 1)) continue; // without the extra clubs: `skip` strokes longer
            const hole = { tee, target, par, perfect, rules };
            if (perfect > 1) {
                const line = birdieLineCount(hole, perfect, hazardMap([]));
                if (line < band[0] || line > band[1]) continue;
            }
            if (think && !(thinks(hole, think) && playsLikeGolf(hole))) continue; // see buildHole
            return hole;
        }
    }
    return null;
}

// One hole, rebuilt until it passes the course's `think` check (v1.8.2: see thinks(), and a perfect
// route that plays like golf); 0 skips it (Prism Point, the daily holes and practice). The other
// options are buildOnce's.
export function buildHole(rands, options) {
    const { think = 0, log = () => {} } = options;
    for (let attempt = 0; ; attempt++) {
        const hole = buildOnce(rands, options);
        if (!think || hole.perfect <= 1 || (thinks(hole, think) && playsLikeGolf(hole))) return hole;
        if (attempt === 79) {
            log(`no hole passed the think check in 80 tries; kept the last`);
            return hole;
        }
    }
}

// One hole: { tee, target, par, perfect, hazards?, wind? }. `rands` are { rand, hazardRand, windRand }
// (separate sequences, so adding hazards or wind never changes which tee and target are chosen).
// `plan` is { water, greenside, route } counts or null; `windPlan` is { hue: [min, max], light: [min, max] }
// or null. `layup` makes a par 5 whose birdie lines are all under water. `log` reports a hole left clear.
function buildOnce({ rand, hazardRand, windRand }, { par, perfect, hues, sats, difficulty, plan = null, windPlan = null, layup = false, portals = null, mirrors = null, rules = null, turning = null, roulette = null, flip = null, think = 0, log = () => {} }) {
    // Flip (v1.8.5): the hole is built round the five flip clubs
    for (let attempt = 0; flip && attempt < 8; attempt++) {
        const hole = makeFlipHole(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], think, ...flip });
        if (hole) {
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap([]));
            return hole;
        }
        if (attempt === 7) log("no flip hole passed the checks; built without one");
    }
    // Roulette (v1.8.4): the hole is built round its four shifts
    for (let attempt = 0; roulette && attempt < 8; attempt++) {
        const hole = makeRouletteHole(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], think, ...roulette });
        if (hole) {
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap([]));
            return hole;
        }
        if (attempt === 7) log("no roulette hole passed the checks; built without one");
    }
    // Turning wind (v1.8.3): the hole is built in its wind cycle
    for (let attempt = 0; turning && attempt < 8; attempt++) {
        const hole = makeWindHole(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], think, ...turning });
        if (hole) {
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap([]));
            return hole;
        }
        if (attempt === 7) log("no turning-wind hole passed the checks; built calm");
    }
    // Club bans (v1.8.2): the hole is built under its rules
    for (let attempt = 0; rules && attempt < 8; attempt++) {
        const hole = makeBanHole(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], rules, think });
        if (hole) {
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap([]));
            return hole;
        }
        if (attempt === 7) log(`no hole passed the checks with "${rules.name}"; built without a ban`);
    }
    // Mirrors (v1.8.1): the hole is built round its mirror
    for (let attempt = 0; mirrors && attempt < 8; attempt++) {
        const hole = makeMirrorHole(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], ...mirrors });
        if (hole) {
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap(hole.hazards));
            return hole;
        }
        if (attempt === 7) log("no mirror hole passed the checks; built without mirrors");
    }
    // Portals (v1.8): build the hole `skip` strokes longer, then the portal makes the perfect score
    // possible; `blackHoles` adds that many on the long way round
    let hole;
    for (let attempt = 0; portals && attempt < 10; attempt++) {
        const length = perfect + (portals.skip ?? 1);
        hole = makeHole(rand, par, length, hues, SELECT_LINE[difficulty]);
        const place = portals.chain ? placeChain : portals.maze ? placeMaze : placePortals;
        const placed = place(hazardRand, hole, perfect, BIRDIE_LINE[difficulty], portals);
        if (placed) Object.assign(hole, placed);
        const blackHoles = placed && portals.blackHoles ? placeBlackHoles(hazardRand, hole, BIRDIE_LINE[difficulty], portals.blackHoles, length) : [];
        if (placed && blackHoles) {
            hole.hazards.push(...blackHoles);
            hole.lines = birdieLineCount(hole, hole.perfect, hazardMap(hole.hazards));
            return hole;
        }
        if (attempt === 9) log("no portal placement passed the checks; built without portals");
    }
    // If no hazard placement passes the checks, pick another hole (up to 10 tries) before leaving it clear
    for (let attempt = 0; attempt < 10; attempt++) {
        // With hazards coming, pick holes with extra birdie lines for them to take away
        const line = layup ? LAYUP_LINE : plan ? SELECT_LINE[difficulty] : BIRDIE_LINE[difficulty];
        hole = makeHole(rand, par, perfect, hues, line, sats, think);
        if (!plan && !layup) break;
        const placed = placeHazards(hazardRand, hole, { ...plan, wedgeOnly: difficulty === "Expert" }, BIRDIE_LINE[difficulty], layup);
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
