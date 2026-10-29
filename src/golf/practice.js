import { rng, buildHole, expertPerfect } from "./holeMaker.js";

// ----------------------------------
// Practice holes: one random hole from a seed and the player's settings
// ----------------------------------
// Used by practice-worker.js (live, while you play) and resources/generatePractice.mjs (the starter
// pool in practice.json, so the first hole of a session needs no wait: Expert holes with lakes can
// take 20 s or more to build).

export const DIFFICULTIES = ["Beginner", "Standard", "Expert"];
export const PARS = [3, 4, 5];

// Hazards and wind per difficulty (as on the courses of that difficulty)
const PLANS = {
    Beginner: { plan: { greenside: 1 }, windPlan: null },
    Standard: { plan: { greenside: 1, route: 1 }, windPlan: { hue: [2, 6], light: [2, 4] } },
    Expert: { plan: { water: "band", greenside: 1 }, windPlan: { hue: [8, 12], light: [4, 6] } },
};

// settings: { difficulty, par (3 | 4 | 5 | "any"), hazards (bool) }
export function practiceHole(seed, { difficulty, par, hazards }) {
    const rand = rng(seed);
    const holePar = par === "any" ? PARS[Math.floor(rand() * 3)] : par;
    // Perfect sits one under par (par 5s: one or two under), as on the courses; Expert par is tighter
    const perfect = difficulty === "Expert" ? expertPerfect(holePar) : holePar === 5 && rand() < 0.5 ? 3 : holePar - 1;
    const { plan, windPlan } = hazards ? PLANS[difficulty] : { plan: null, windPlan: null };
    return buildHole(
        { rand, hazardRand: rng(seed * 7919), windRand: rng(seed * 104729) },
        { par: holePar, perfect, hues: [0, 360], difficulty, plan, windPlan },
    );
}

// Key for a settings combination in the starter pool: "Expert|4|hazards"
export const poolKey = (difficulty, par, hazards) => `${difficulty}|${par}|${hazards ? "hazards" : "clear"}`;
