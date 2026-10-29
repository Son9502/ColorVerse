// ----------------------------------
// Color Golf daily hole generator
// ----------------------------------
// Builds one hole per date into src/golf/daily.json, following the weekly rotation in
// src/golf/daily.js. Each day is seeded by its date, so days already in the file are kept and
// only new ones are built: run it again with a later --until to extend the list. After a rotation
// change, --weekdays rebuilds those days in place (0 = Sunday … 6 = Saturday).
// Run: npm run daily [-- --until 2028-12-31] [--weekdays 5,6]
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

    const weekdaysArg = process.argv.indexOf("--weekdays");
    const rebuild = new Set(weekdaysArg > 0 ? process.argv[weekdaysArg + 1].split(",").map(Number) : []);
    const total = daysBetween(START, until) + 1;
    const holes = Array.from({ length: total }, (_, i) => (rebuild.has(weekday(addDays(START, i))) ? undefined : existing.holes[i]));
    const todo = holes.flatMap((hole, i) => (hole ? [] : [addDays(START, i)]));

    // One hole per line, so additions read clearly in a diff. Only the days built so far, in order
    // (a rebuilt day keeps its old hole until its new one is ready).
    const save = () => {
        const ready = holes.map((hole, i) => hole ?? existing.holes[i]);
        const end = ready.findIndex(hole => !hole);
        const list = end < 0 ? ready : ready.slice(0, end);
        writeFileSync(out, `{"start":"${START}","holes":[\n${list.map(h => `  ${JSON.stringify(h)}`).join(",\n")}\n]}\n`);
    };

    console.log(`${total - todo.length} days kept; building ${todo.length}`);
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
            holes[daysBetween(START, key)] = hole;
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
