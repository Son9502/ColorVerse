import { searchFrom, parFor, pathTo } from "./solver.js";
import { hazardMap } from "./hazards.js";
import { IN_THE_HOLE, usingCup } from "./oklab.js";

// ----------------------------------
// Par solver worker: the perfect route for a hole, off the main thread
// ----------------------------------
// Receives { id, tee, target, perfect, hazards, wind, rules, cup (the hole's size, v1.8.6) }; replies { id, route } where route is
// [{ club, hsl }, ...] (one entry per stroke), or { id, error }.

self.addEventListener("message", ({ data: { id, tee, target, perfect, hazards = [], wind = null, rules = null, cup = IN_THE_HOLE } }) => {
    usingCup(cup, () => solve({ id, tee, target, perfect, hazards, wind, rules }));
});

function solve({ id, tee, target, perfect, hazards, wind, rules }) {
    try {
        // A route that plays like golf if there is one (v1.8.2), or any perfect route
        const cycle = rules?.windCycle ?? null; // turning wind (v1.8.3)
        const roulette = rules?.roulette ?? null; // roulette clubs (v1.8.4)
        const flip = !!rules?.flip; // flip clubs (v1.8.5)
        let search = searchFrom(tee, perfect, hazardMap(hazards), { wind, cycle, roulette, flip, rules, golf: target });
        let best = parFor(search, target);
        if (best?.par !== perfect) {
            search = searchFrom(tee, perfect, hazardMap(hazards), { wind, cycle, roulette, flip, rules });
            best = parFor(search, target);
        }
        self.postMessage({ id, route: best ? pathTo(search, best.end) : [] });
    } catch (error) {
        self.postMessage({ id, error: String(error) });
    }
}
