import { practiceHole } from "./practice.js";

// ----------------------------------
// Practice hole worker: endless random holes, built off the main thread
// ----------------------------------
// Receives { id, seed, difficulty, par (3 | 4 | 5 | "any"), hazards (bool) }; replies { id, hole }
// or { id, error }. Building takes from a fraction of a second to 20 s or more (Expert lakes),
// so the UI asks for the next hole while the current one is being played.

self.addEventListener("message", ({ data: { id, seed, ...settings } }) => {
    try {
        self.postMessage({ id, hole: practiceHole(seed, settings) });
    } catch (error) {
        self.postMessage({ id, error: String(error) });
    }
});
