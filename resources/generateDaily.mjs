// ----------------------------------
// Color Golf daily hole generator
// ----------------------------------
// Builds one hole per date into src/golf/daily.json, following the weekly rotation in
// src/golf/daily.js. Each day is seeded by its date, so days already in the file are kept and
// only new ones are built: run it again with a later --until to extend the list.
// Run: npm run daily [-- --until 2028-12-31]
//
// Days are independent, so they're built in parallel (one worker thread per spare CPU core).

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { rng, buildHole } from "../src/golf/holeMaker.js";
import { WEEK, DAILY_HUES, addDays, daysBetween, weekday, daySeed } from "../src/golf/daily.js";

const START = "2026-10-28"; // the first daily hole (v1.3)

// The day's hole, from its date alone
function dailyHole(key) {
    const seed = daySeed(key);
    const { par, perfect, difficulty, plan = null, windPlan = null } = WEEK[weekday(key)];
    return buildHole(
        { rand: rng(seed), hazardRand: rng(seed * 7919), windRand: rng(seed * 104729) },
        { par, perfect, hues: DAILY_HUES, difficulty, plan, windPlan },
    );
}

if (!isMainThread) {
    parentPort.on("message", (key) => parentPort.postMessage({ key, hole: dailyHole(key) }));
} else {
    const untilArg = process.argv.indexOf("--until");
    const until = untilArg > 0 ? process.argv[untilArg + 1] : "2028-12-31";
    const out = new URL("../src/golf/daily.json", import.meta.url);
    const existing = existsSync(out) ? JSON.parse(readFileSync(out)) : { start: START, holes: [] };
    if (existing.start !== START) throw new Error(`daily.json starts ${existing.start}, expected ${START}`);

    const total = daysBetween(START, until) + 1;
    const holes = existing.holes.slice(0, total);
    const todo = Array.from({ length: total - holes.length }, (_, i) => addDays(START, holes.length + i));

    // One hole per line, so additions read clearly in a diff
    const save = () => writeFileSync(out, `{"start":"${START}","holes":[\n${holes.map(h => `  ${JSON.stringify(h)}`).join(",\n")}\n]}\n`);

    console.log(`${holes.length} days kept; building ${todo.length} (${todo[0] ?? "–"} to ${until})`);
    const built = new Map();
    let next = 0;
    let done = 0;
    const threads = Math.max(1, Math.min(availableParallelism() - 1, todo.length));
    await Promise.all(Array.from({ length: threads }, () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url));
        const feed = () => {
            if (next < todo.length) worker.postMessage(todo[next++]);
            else worker.terminate().then(resolve);
        };
        worker.on("message", ({ key, hole }) => {
            built.set(key, hole);
            // Keep the file's days contiguous: append every finished day that's next in line
            while (built.has(addDays(START, holes.length))) {
                const day = addDays(START, holes.length);
                holes.push(built.get(day));
                built.delete(day);
            }
            if (++done % 25 === 0 || done === todo.length) {
                save();
                console.log(`  ${done}/${todo.length} built`);
            }
            feed();
        });
        worker.on("error", reject);
        feed();
    })));
    save();
    console.log(`Wrote ${holes.length} daily holes (${START} to ${addDays(START, holes.length - 1)}) to src/golf/daily.json`);
}
