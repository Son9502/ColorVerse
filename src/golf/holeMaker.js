import { searchFrom, parFor, pathTo, reachesWithin, landingsFrom } from "./solver.js";
import { CLUBS, allStrikes, mirrorOf, roundHSL, encode, decode } from "./clubs.js";
import { hazardMap, isWedge, WEDGES } from "./hazards.js";
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

export function makeHole(rand, par, perfect, hues, birdieLine, sats = SATS) {
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
    // counts clubs, like the selection check (the Mirror club too, from a tee on a mirror)
    for (const landing of landingsFrom(hole.tee, map.at(hole.tee), wind)) {
        const shot = map.land(landing); // through a portal (v1.8)
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

// A mirror hole (v1.8.1), built round its mirror the way portal holes are built round their portal:
// the mirror sits on the tee (`onTee`) or on one of the tee's full shots, the pin is the rest of the
// perfect score from the mirror's reflection (the Mirror club reverses the hex), and without the
// mirror the hole is at least `skip` strokes longer, so the mirror is the way to par. A `decoy` is a
// second mirror on another tee shot whose reflection lands far from the pin (200+ yds, and not on the
// perfect score). A `tutorial` mirror is bigger. Checked: perfect, the birdie line in `band`.
// Returns { tee, target, par, perfect, hazards }, or null if 400 tries find nothing.
export function makeMirrorHole(rand, { par, perfect, hues, sats, band, onTee = false, decoy = false, tutorial = false, skip = 1 }) {
    const after = perfect - (onTee ? 1 : 2); // strokes from the reflection into the hole
    if (after < 0) return null;
    const radius = () => Math.round(tutorial ? 36 + rand() * 6 : 22 + rand() * 10);
    for (let tries = 0; tries < 400; tries++) {
        const tee = randomColor(rand, hues, sats);
        const shots = allStrikes(tee).slice(0, 35); // full shots: a putt stays too near the tee
        const spot = onTee ? tee : shots[Math.floor(rand() * shots.length)];
        const reflected = mirrorOf(spot);

        // The pin: `after` strokes from the reflection (on it, for the ace), in the course's colors
        // and the par's length
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        let pins;
        if (after === 0) {
            pins = [nudge(rand, reflected, 0, IN_THE_HOLE * 0.75)].filter(pin => pin && fits(pin));
        } else {
            const search = searchFrom(reflected, after);
            pins = search.reached.filter(code => search.dist[code] === after).map(decode).filter(fits);
        }
        if (!pins.length) continue;
        const target = pins[Math.floor(rand() * pins.length)];

        const mirrors = [{ type: "mirror", center: spot, radius: radius() }];
        if (!roomFor(spot, mirrors[0].radius, [], onTee ? [target] : [tee, target])) continue;
        if (decoy) {
            const options = shots.filter(shot => roomFor(shot, 30, mirrors, [tee, target])
                && yardsBetween(mirrorOf(shot), target) >= 200 && !reachesWithin(mirrorOf(shot), target, perfect - 2));
            if (!options.length) continue;
            mirrors.push({ type: "mirror", center: options[Math.floor(rand() * options.length)], radius: radius() });
        }

        // Without the mirror: at least `skip` strokes longer. With it: exactly `perfect`.
        if (reachesWithin(tee, target, perfect + skip - 1)) continue;
        const map = hazardMap(mirrors);
        if (parFor(searchFrom(tee, perfect, map), target)?.par !== perfect) continue;
        const hole = { tee, target, par, perfect, hazards: mirrors };
        const line = birdieLineCount(hole, perfect, map);
        if (perfect > 1 && (line < band[0] || line > band[1])) continue;
        return hole;
    }
    return null;
}

// A mirror chain (v1.8.1): two mirrors with a shot between them (two presses in a row cancel out).
// Perfect 3: Mirror from a tee on a mirror, a shot onto the second mirror, Mirror into the hole.
// Perfect 4: a tee shot onto the first mirror first. Without mirrors the hole is at least `skip`
// strokes longer, and neither mirror alone makes the perfect score. Checked as makeMirrorHole.
// Returns { tee, target, par, perfect, hazards }, or null if 400 tries find nothing.
export function makeMirrorChain(rand, { par, perfect, hues, sats, band, skip = 1 }) {
    if (perfect !== 3 && perfect !== 4) return null;
    const pick = (list) => list[Math.floor(rand() * list.length)];
    const radius = () => Math.round(22 + rand() * 10);
    for (let tries = 0; tries < 400; tries++) {
        const tee = randomColor(rand, hues, sats);
        const first = perfect === 3 ? tee : pick(allStrikes(tee).slice(0, 35)); // full shots only
        const bounce = mirrorOf(first);
        // The second mirror: any full shot from the bounce whose reflection makes a pin in the
        // course's colors and the par's length
        const fits = (pin) => {
            const yards = yardsBetween(tee, pin);
            return inRange(pin, hues, sats) && yards >= LENGTH[par][0] && yards <= LENGTH[par][1] && hslDistance(tee, pin) >= ON_THE_GREEN * 2;
        };
        const options = allStrikes(bounce).slice(0, 35)
            .map(second => ({ second, target: nudge(rand, mirrorOf(second), 0, IN_THE_HOLE * 0.75) }))
            .filter(({ target }) => target && fits(target));
        if (!options.length) continue;
        const { second, target } = pick(options);

        const one = { type: "mirror", center: first, radius: radius() };
        const two = { type: "mirror", center: second, radius: radius() };
        // Apart from each other, the pin, the tee (unless it's on the first) and where the first sends you
        if (!roomFor(one.center, one.radius, [], perfect === 3 ? [target, bounce] : [tee, target, bounce])) continue;
        if (!roomFor(two.center, two.radius, [one], [tee, target, bounce])) continue;

        if (reachesWithin(tee, target, perfect + skip - 1)) continue;
        const reaches = (mirrors) => parFor(searchFrom(tee, perfect, hazardMap(mirrors)), target)?.par === perfect;
        if (!reaches([one, two]) || reaches([one]) || reaches([two])) continue;
        const hole = { tee, target, par, perfect, hazards: [one, two] };
        const line = birdieLineCount(hole, perfect, hazardMap(hole.hazards));
        if (line < band[0] || line > band[1]) continue;
        return hole;
    }
    return null;
}

// One hole: { tee, target, par, perfect, hazards?, wind? }. `rands` are { rand, hazardRand, windRand }
// (separate sequences, so adding hazards or wind never changes which tee and target are chosen).
// `plan` is { water, greenside, route } counts or null; `windPlan` is { hue: [min, max], light: [min, max] }
// or null. `layup` makes a par 5 whose birdie lines are all under water. `log` reports a hole left clear.
export function buildHole({ rand, hazardRand, windRand }, { par, perfect, hues, sats, difficulty, plan = null, windPlan = null, layup = false, portals = null, mirrors = null, log = () => {} }) {
    // Mirrors (v1.8.1): the hole is built round its mirror
    for (let attempt = 0; mirrors && attempt < 8; attempt++) {
        const make = mirrors.chain ? makeMirrorChain : makeMirrorHole;
        const hole = make(rand, { par, perfect, hues, sats, band: BIRDIE_LINE[difficulty], ...mirrors });
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
        hole = makeHole(rand, par, perfect, hues, line, sats);
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
