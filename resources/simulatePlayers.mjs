// Simulated players: bots play the Color Golf courses many times to estimate how likely a real player is
// to pass each unlock score.
//
// A bot plans `depth` shots past the next one (search with a memoized `reach`), picks its club softly
// (`sloppiness`, in strokes: 0 always takes the best), and on Monochrome courses judges colors by how
// much of their hue it can make out (`colorSense`: 1 sees everything, 0 only lightness). With `remembers`,
// a shot that looked holed but wasn't is ruled out for the rest of that hole.
//
// Modes:
//   npm run simulate -- report   pass rates for every unlock (and the Gauntlet's clear rate) per REPORT_PROFILES player
//   npm run simulate -- fit      the CANDIDATES closest to your own scores: put them in MY_SCORES first
// RUNS sets how many rounds each player plays per course; depth 2 with noise takes a few minutes per player.

import { readFileSync } from "node:fs";
import { GolfRound } from "../src/golf/game.js";
import { allStrikes, CLUBS, encode } from "../src/golf/clubs.js";
import { windFor, ruleAllows } from "../src/golf/rules.js";
import { hslDistance, cupOf, hslToOklab } from "../src/golf/oklab.js";
import { unlockToPar, unlockedBy, FREE_COURSES } from "../src/golf/unlocks.js";
// ----- Settings ------------------------------------------
const COURSES = JSON.parse(readFileSync(new URL("../src/golf/courses.json", import.meta.url)));
const RUNS = 20;

// The players in the report, from weaker to stronger
const REPORT_PROFILES = [
    { name: "learning", depth: 1, sloppiness: 0.3, colorSense: 0.8, remembers: true },
    { name: "regular", depth: 1, sloppiness: 0.2, colorSense: 0.9, remembers: true },
    { name: "strong", depth: 2, sloppiness: 0.2, colorSense: 0.9, remembers: true },
];
// The fit tries every combination of these (18 players)
const DEPTHS = [1, 2];
const SLOPPINESS = [0.1, 0.2, 0.3];
const SENSES = [0.8, 0.9, 1];

const CANDIDATES = [];
for (const depth of DEPTHS) {
    for (const sloppiness of SLOPPINESS) {
        for (const sense of SENSES) {
            CANDIDATES.push({
                name: `d${depth} s${sloppiness} c${sense}`,
                depth,
                sloppiness,
                colorSense: sense,
                remembers: true,
            });
        }
    }
}
// Your own scores to par, by course id (null or left out: not played). Placeholders until you've played.
const MY_SCORES = { prism: -9, cobalt: 36, ash: -10 };
// ----- Playing -------------------------------------------
// Play the round's current hole to the end; return the strokes it took
function playHole(round, choose) {
    while (!round.holeDone) {
        const best = choose(round);
        if (!best) break; // no playable club
        round.play(best.club);
    }
    return round.strokes;
}

// Play a whole course; return the round's totals ({ strokes, par, toPar, … })
function playRound(course, choose) {
    const round = new GolfRound(course, () => 0, { undos: 0 });
    do {
        playHole(round, choose);
    } while (round.nextHole());
    return round.totals();
}
// ----- The bot -------------------------------------------
// What a shot really does, as in game.js: where the ball ends up and how many strokes it costs
function outcome(map, hole, from, landing) {
    const type = map.at(landing);
    switch (type) {
        case "water":
            return { at: from, cost: 2 };
        case "blackhole":
            return { at: hole.tee, cost: 2 };
        case "portal":
        case "mirror":
            return { at: map.land(landing), cost: 1 };
        default:
            return { at: landing, cost: 1 };
    }
}
// How far apart `a` and `b` look to a player who sees `colorSense` of the color (1 = all of it)
function seen(a, b, colorSense) {
    const [l1, a1, b1] = hslToOklab(a);
    const [l2, a2, b2] = hslToOklab(b);
    const dL = l1 - l2;
    const dA = (a1 - a2) * colorSense;
    const dB = (b1 - b2) * colorSense;
    return Math.hypot(dL, dA, dB);
}

const reachCache = new WeakMap(); // hole → Map of reach results
const memories = new WeakMap(); // round → { holeIndex, misses: the fake holes found on this hole }

// TODO (optional, decide after playing): neighborhood memory. Today a fake hole rules out only its exact
//   color, so the bot walks onto the fake next door. A person learns "the hue's off around there" instead:
//   - keep the fakes' colors too (not just encode(color)), so distances can be measured to them
//   - in reach: a color within cupOf(hole) of any miss (hslDistance) can't count as holed
//   - the key still uses the sorted encoded misses
//   - compare against "remember" and "real": it should land between them, closer to "real"

// How good things look from `color` with up to `depth` more shots: −1 if it's holed (as far as the player
// can tell), else the closest it can get, plus a penalty per stroke. `strokes` is the count so far (for a
// turning wind); `view` is what the player perceives ({ sense, realHoles, misses }).
function reach(color, hole, strokes, depth, map, view) {
    let cache = reachCache.get(hole); // this hole's own Map
    if (!cache) {
        cache = new Map();
        reachCache.set(hole, cache); // key: the hole object itself
    }
    const cycle = hole.rules?.windCycle;
    const turn = cycle ? strokes % cycle.length : 0;
    const key = `${encode(color)}|${turn}:${depth}|${view.sense}|${view.realHoles}|${[...view.misses].sort().join(",")}`;
    if (cache.has(key)) return cache.get(key);
    const here = seen(color, hole.target, view.sense);
    const holed = !view.misses.has(encode(color)) && (view.realHoles ? hslDistance(color, hole.target) < cupOf(hole) : here < cupOf(hole));
    if (holed) return -1;

    if (depth === 0) return here;
    let best = here; // stopping here is allowed too: the ball may already be close
    const landings = allStrikes(color, windFor(hole, strokes), hole.rules?.roulette, !!hole.rules?.flip);
    for (let i = 0; i < landings.length; i++) {
        const landing = landings[i];
        if (!landing || !ruleAllows(hole.rules, CLUBS[i]) || !map.allows(color, CLUBS[i])) continue;
        const { at, cost } = outcome(map, hole, color, landing);
        best = Math.min(best, cost * cupOf(hole) * 2 + reach(at, hole, strokes + cost, depth - 1, map, view));
    }
    cache.set(key, best);
    return best;
}
// Pick one of `options` ({ club, score }), lower scores much more likely (a softmax).
// `temperature` is in score units; 0 always takes the best.
function pickSoftly(options, temperature, random = Math.random) {
    if (temperature === 0 || options.length <= 1) {
        return options.reduce((best, option) => (best === null || option.score < best.score ? option : best), null);
    }
    const bestScore = Math.min(...options.map(o => o.score));
    const weights = options.map(o => Math.exp((bestScore - o.score) / temperature));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let r = random() * totalWeight;
    for (let i = 0; i < options.length; i++) {
        r -= weights[i];
        if (r <= 0) return options[i];
    }
    return options[options.length - 1]; // fallback in case of rounding errors
}
// Choose the next club: score each playable one by where it really ends up plus its best reach `depth`
// shots further on, then pick softly. `perception` holds colorSense, realHoles and remembers (a profile works).
function chooseLookahead(round, depth, sloppiness = 0, perception = {}) {
    const { hole, current, strokes } = round;
    const wind = windFor(hole, strokes);
    const stroke = cupOf(hole) * 2;
    const clubs = [];
    const { colorSense = 1, realHoles = false, remembers = false } = perception;
    const sense = round.course.mono ? colorSense : 1;
    const landings = allStrikes(current, wind, hole.rules?.roulette, !!hole.rules?.flip);
    let memory = memories.get(round);
    if (remembers) {
        if (!memory || memory.holeIndex !== round.holeIndex) {
            memory = { holeIndex: round.holeIndex, misses: new Set() };
            memories.set(round, memory);
        }
        if (seen(current, hole.target, sense) < cupOf(hole)) {
            memory.misses.add(encode(current));
        }
    }
    const view = { sense, realHoles, misses: memory?.misses ?? new Set() };
    for (let i = 0; i < landings.length; i++) {
        const landing = landings[i];
        const club = CLUBS[i];
        if (!landing || !round.canPlay(club)) continue;
        const { at, cost } = outcome(round.hazards, hole, current, landing);
        const score = cost * stroke + reach(at, hole, strokes + cost, depth, round.hazards, view);
        clubs.push({ club, score });
    }
    return pickSoftly(clubs, sloppiness * stroke);
}

// ----- Simulation ----------------------------------------
// Play every profile on every course `runs` times: { [profile name]: { [course id]: [score, …] } }.
// A score is strokes to par, or holes survived on a survival course.
function simulate(profiles, courseList, runs = RUNS) {
    const results = {};
    for (const profile of profiles) {
        console.time(profile.name);
        results[profile.name] = {};
        const choose = r => chooseLookahead(r, profile.depth, profile.sloppiness, profile);
        for (const course of courseList) {
            const courseRuns = [];
            for (let i = 0; i < runs; i++) {
                const totals = playRound(course, choose);
                courseRuns.push(course.survival ? totals.survived : totals.toPar);
            }
            results[profile.name][course.id] = courseRuns;
        }
        console.timeEnd(profile.name);
    }
    return results;
}
// One course's runs → { median, best, worst } (best and worst are just the lowest and highest)
function summary(list) {
    list = [...list].sort((a, b) => a - b);
    const mid = Math.floor(list.length / 2);
    const median = list.length % 2 === 0 ? (list[mid - 1] + list[mid]) / 2 : list[mid];
    const best = list[0];
    const worst = list[list.length - 1];
    return { median, best, worst };
}
// One profile's runs → its median on each course: { [course id]: median }
function mediansOf(runsByCourse) {
    const medians = {};
    for (const courseId in runsByCourse) {
        medians[courseId] = summary(runsByCourse[courseId]).median;
    }
    return medians;
}
// ----- Fit -----------------------------------------------
// How far a profile's medians are from your scores: the sum of squared differences (lower is closer).
// Courses you haven't played are skipped; one you have that the profile didn't play counts as Infinity.
function misfit(medians, mine) {
    let sum = 0;
    for (const id in mine) {
        if (mine[id] == null) continue; // you haven't played it
        if (medians[id] == null) return Infinity; // you have, but this profile didn't: it can't be judged
        sum += (medians[id] - mine[id]) ** 2;
    }
    return sum;
}


// ----- Report --------------------------------------------
// Every unlock in the game: { from: course, to: course, needed: score on `from` }
function allUnlocks() {
    const unlocks = [];
    for (let i = FREE_COURSES; i < COURSES.length; i++) {
        const from = unlockedBy(COURSES, i);
        if (!from) continue;
        unlocks.push({ from, to: COURSES[i], needed: unlockToPar(COURSES[i]) });
    }
    return unlocks;
}
// Share of runs at or under `needed` (0–1)
function passRate(runs, needed) {
    let count = 0;
    for (const run of runs) {
        if (run <= needed) count++;
    }
    const rate = count / runs.length;
    return rate;
}

// Survival: share of runs that survived every hole (0–1)
function clearRate(runs, course) {
    let count = 0;
    for (const run of runs) {
        if (run === course.holes.length) count++;
    }
    const rate = count / runs.length;
    return rate;
}

// Play `profiles` on every course and print a table: each unlock's pass rate, then each survival course's
// clear rate, one column per profile
function report(profiles, runsPerCourse) {
    const runs = simulate(profiles, COURSES, runsPerCourse);
    const rows = [];
    const percent = rate => Math.round(100 * rate) + "%";
    for (const unlock of allUnlocks()) {
        const row = { unlock: `${unlock.from.id} → ${unlock.to.id} (${unlock.needed > 0 ? "+" : ""}${unlock.needed})` };
        for (const profile of profiles) {
            const runsForCourse = runs[profile.name][unlock.from.id];
            const rate = passRate(runsForCourse, unlock.needed);
            row[profile.name] = percent(rate);
        }
        rows.push(row);
    }
    for (const course of COURSES.filter(c => c.survival)) {
        const row = { unlock: `${course.id}: cleared` };
        for (const profile of profiles) {
            const runsForCourse = runs[profile.name][course.id];
            const rate = clearRate(runsForCourse, course);
            row[profile.name] = percent(rate);
        }
        rows.push(row);
    }
    console.table(rows);
}
// ----- Main ----------------------------------------------
const MODE = process.argv[2] ?? "report";
switch (MODE) {
    case "report":
        report(REPORT_PROFILES, RUNS);
        break;
    case "fit": {
        const MY_COURSES = COURSES.filter(course => MY_SCORES[course.id] != null);

        const runs = simulate(CANDIDATES, MY_COURSES, RUNS);
        const ranked = [];

        for (const candidate of CANDIDATES) {
            const medians = mediansOf(runs[candidate.name]);
            const fit = misfit(medians, MY_SCORES);
            ranked.push({ candidate: candidate.name, misfit: fit, medians: medians });
        }
        ranked.sort((a, b) => a.misfit - b.misfit);
        const TOP_N = 3;
        console.log(`Top ${TOP_N} candidates:`);
        for (const entry of ranked.slice(0, TOP_N)) {
            console.log(
                `${entry.candidate}: misfit=${entry.misfit} (≈ ${Math.sqrt(entry.misfit / Object.keys(MY_SCORES).length).toFixed(1)} strokes per course)`,
            );
            for (const courseId in entry.medians) {
                console.log(`  ${courseId} ${entry.medians[courseId]} (mine: ${MY_SCORES[courseId]})`);
            }
        }
        break;
    }
    default:
        console.error(`Usage: npm run simulate -- [report|fit]`);
        process.exitCode = 1;
        break;
}