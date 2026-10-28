import { searchFrom, parFor, pathTo } from "./solver.js";

// ----------------------------------
// Par solver worker: the perfect route for a hole, off the main thread
// ----------------------------------
// Receives { id, tee, target, perfect }; replies { id, route } where route is
// [{ club, hsl }, ...] (one entry per stroke), or { id, error }.

self.addEventListener("message", ({ data: { id, tee, target, perfect } }) => {
    try {
        const search = searchFrom(tee, perfect);
        const best = parFor(search, target);
        self.postMessage({ id, route: best ? pathTo(search, best.end) : [] });
    } catch (error) {
        self.postMessage({ id, error: String(error) });
    }
});
