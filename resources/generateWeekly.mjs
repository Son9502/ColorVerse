// ----------------------------------
// Weekly Gauntlet generator (v1.8.6)
// ----------------------------------
// Builds nine survival holes per week into src/golf/weekly.json, one week from each Monday from
// WEEKLY_START (src/golf/daily.js). Every gimmick appears at least once, plus three more picked at
// random, each built as on its own course (gimmicks.mjs), then played easiest first. Each week is
// seeded by its date, so weeks already in the file are kept: run it again with a later --until to
// extend the list. Run: npm run weekly [-- --until 2027-12-31]
//
// Weeks are independent, so they're built in parallel (one worker thread per spare CPU core).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { rng, buildHole } from "../src/golf/holeMaker.js";
import { WEEKLY_START, addDays, daysBetween, daySeed } from "../src/golf/daily.js";
import { BANS, gimmickHole, easiestFirst } from "./gimmicks.mjs";

// [par, perfect] per hole (par 36): par 5s are eagle holes, as on the Gauntlet
const LAYOUT = [[4, 3], [4, 3], [3, 2], [5, 3], [4, 3], [4, 3], [3, 2], [4, 3], [5, 3]];
const GIMMICKS = ["portals", "mirrors", "rules", "turning", "roulette", "flip"];
// Variants per gimmick; par 5s take only the bans that work there (see generateCourses.mjs)
const VARIANTS = {
    portals: () => [{ trap: true }, { chain: true }, { maze: true }],
    mirrors: () => [{}, { chain: true }, { decoy: true }],
    rules: (par) => (par === 5 ? [BANS.noTintsShades, BANS.hybridsIrons] : [BANS.noLong, BANS.noHybrids, BANS.noLongIron, BANS.noWoodsWedges]),
    turning: () => [{}],
    roulette: () => [{}],
    flip: () => [{}],
};

// A week's nine holes, from its Monday's date alone
function weekHoles(key) {
    const seed = daySeed(key);
    const pick = rng(seed * 31); // which gimmick goes where: its own sequence
    const choose = (list) => list[Math.floor(pick() * list.length)];
    const kinds = [...GIMMICKS, choose(GIMMICKS), choose(GIMMICKS), choose(GIMMICKS)];
    for (let i = kinds.length - 1; i > 0; i--) { // shuffle onto the layout
        const j = Math.floor(pick() * (i + 1));
        [kinds[i], kinds[j]] = [kinds[j], kinds[i]];
    }
    const rands = { rand: rng(seed), hazardRand: rng(seed * 7919), windRand: rng(seed * 104729) };
    const holes = LAYOUT.map(([par, perfect], i) => buildHole(rands, {
        par, perfect, hues: [0, 360], difficulty: "Expansion", think: 3,
        ...gimmickHole({ [kinds[i]]: choose(VARIANTS[kinds[i]](par)) }, perfect),
    }));
    return easiestFirst(holes);
}

if (!isMainThread) {
    parentPort.on("message", (key) => parentPort.postMessage({ key, holes: weekHoles(key) }));
} else {
    const untilArg = process.argv.indexOf("--until");
    const until = untilArg > 0 ? process.argv[untilArg + 1] : "2027-12-31";
    const out = new URL("../src/golf/weekly.json", import.meta.url);
    const existing = existsSync(out) ? JSON.parse(readFileSync(out)) : { start: WEEKLY_START, weeks: [] };
    if (existing.start !== WEEKLY_START) throw new Error(`weekly.json starts ${existing.start}, expected ${WEEKLY_START}`);

    const total = Math.floor(daysBetween(WEEKLY_START, until) / 7) + 1;
    const weeks = Array.from({ length: total }, (_, i) => existing.weeks[i]);
    const todo = weeks.flatMap((week, i) => (week ? [] : [addDays(WEEKLY_START, i * 7)]));

    // One week per line, only the weeks built so far, in order
    const save = () => {
        const end = weeks.findIndex(week => !week);
        const list = end < 0 ? weeks : weeks.slice(0, end);
        writeFileSync(out, `{"start":"${WEEKLY_START}","weeks":[\n${list.map(w => `  ${JSON.stringify(w)}`).join(",\n")}\n]}\n`);
    };

    console.log(`${total - todo.length} weeks kept; building ${todo.length}`);
    let next = 0;
    let done = 0;
    const threads = Math.max(1, Math.min(availableParallelism() - 1, todo.length));
    await Promise.all(Array.from({ length: threads }, () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url));
        const feed = () => {
            if (next < todo.length) worker.postMessage(todo[next++]);
            else worker.terminate().then(resolve);
        };
        worker.on("message", ({ key, holes }) => {
            weeks[daysBetween(WEEKLY_START, key) / 7] = holes;
            save();
            console.log(`  ${++done}/${todo.length} built (week of ${key})`);
            feed();
        });
        worker.on("error", reject);
        feed();
    })));
    save();
    console.log(`Wrote ${weeks.length} weeks (${WEEKLY_START} to ${addDays(WEEKLY_START, (weeks.length - 1) * 7)}) to src/golf/weekly.json`);
}
