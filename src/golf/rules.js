import { CLUBS } from "./clubs.js";

// ----------------------------------
// Hole rules (v1.8.2)
// ----------------------------------
// Gimmicks that aren't regions of color space live in `hole.rules`, read here by the round, the
// solver, the hole builder and the score server's replay alike.
// - Club bans (Caddie Strike): { ban: [row, …], name: "No Driver or Woods" }. Banned rows can't be
//   played (greyed out, as in a bunker).
// - Turning wind (v1.8.3, Saffron Whirlwind): { windCycle: [wind | null, …] } (2–3 winds, as in
//   clubs.js; null is calm). Stroke n, counting from the tee and penalties included, has the wind
//   windCycle[n % length], so it's known before you tee off. Replaces the hole's fixed `wind`.

// Whether `club` can be played on a hole with these rules
export const ruleAllows = (rules, club) => !rules?.ban?.includes(club.row);

// The wind for the next stroke after `strokes` strokes: the cycle's, or the hole's fixed wind
export const windFor = (hole, strokes) => {
    const cycle = hole.rules?.windCycle;
    return cycle ? cycle[strokes % cycle.length] : hole.wind ?? null;
};

// The solver's wind options for a hole: a fixed `wind` or a `cycle`
export const windOptions = (hole) => ({ wind: hole.wind ?? null, cycle: hole.rules?.windCycle ?? null });

// Per club in CLUBS order: 1 if it can be played, for the solver's loops (null: every club)
export function clubMask(rules) {
    if (!rules?.ban?.length) return null;
    return Uint8Array.from(CLUBS, club => (ruleAllows(rules, club) ? 1 : 0));
}
