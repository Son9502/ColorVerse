// ----------------------------------
// Color Golf practice starter pool generator
// ----------------------------------
// Builds a few holes for every practice setting (difficulty × par × hazards on/off) into
// src/golf/practice.json, so a practice session starts instantly; later holes are built live by
// practice-worker.js while you play. Seeded, so re-running produces the same pool.
// Run: npm run practice
//
// Holes are independent, so they're built in parallel (one worker thread per spare CPU core).

import { writeFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { Worker, isMainThread, parentPort } from "node:worker_threads";
import { practiceHole, poolKey, DIFFICULTIES, PARS } from "../src/golf/practice.js";

const PER_SETTING = 6;

if (!isMainThread) {
    parentPort.on("message", ({ key, seed, settings }) => parentPort.postMessage({ key, seed, hole: practiceHole(seed, settings) }));
} else {
    const jobs = DIFFICULTIES.flatMap((difficulty, d) => PARS.flatMap(par => [true, false].flatMap(hazards =>
        Array.from({ length: PER_SETTING }, (_, i) => ({
            key: poolKey(difficulty, par, hazards),
            seed: 900000 + d * 10000 + par * 1000 + (hazards ? 500 : 0) + i,
            settings: { difficulty, par, hazards },
        })))));

    console.log(`Building ${jobs.length} practice holes`);
    const built = new Map(); // seed → hole
    let next = 0;
    const threads = Math.max(1, Math.min(availableParallelism() - 1, jobs.length));
    await Promise.all(Array.from({ length: threads }, () => new Promise((resolve, reject) => {
        const worker = new Worker(new URL(import.meta.url));
        const feed = () => {
            if (next < jobs.length) worker.postMessage(jobs[next++]);
            else worker.terminate().then(resolve);
        };
        worker.on("message", ({ seed, hole }) => {
            built.set(seed, hole);
            if (built.size % 18 === 0) console.log(`  ${built.size}/${jobs.length} built`);
            feed();
        });
        worker.on("error", reject);
        feed();
    })));

    // { "Expert|4|hazards": [hole, ...], ... }, one hole per line, in job order
    const pool = {};
    for (const job of jobs) (pool[job.key] ??= []).push(built.get(job.seed));
    const out = new URL("../src/golf/practice.json", import.meta.url);
    writeFileSync(out, `{\n${Object.entries(pool).map(([key, holes]) =>
        `  "${key}":[\n${holes.map(h => `    ${JSON.stringify(h)}`).join(",\n")}\n  ]`).join(",\n")}\n}\n`);
    console.log(`Wrote ${jobs.length} practice holes to src/golf/practice.json`);
}
