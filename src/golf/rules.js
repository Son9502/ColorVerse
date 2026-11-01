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
// - Roulette (v1.8.4, Scarlet Roulette): { roulette: [shift, shift, shift, shift] } in degrees, the
//   hole's four roulette clubs (clubs.js). Without it, roulette clubs can't be played.

// Whether `club` can be played on a hole with these rules
export const ruleAllows = (rules, club) => (club.row === "roulette" ? !!rules?.roulette : !rules?.ban?.includes(club.row));

// The wind for the next stroke after `strokes` strokes: the cycle's, or the hole's fixed wind
export const windFor = (hole, strokes) => {
    const cycle = hole.rules?.windCycle;
    return cycle ? cycle[strokes % cycle.length] : hole.wind ?? null;
};

// The solver's options for a hole's wind (a fixed `wind` or a `cycle`) and its roulette
export const windOptions = (hole) => ({ wind: hole.wind ?? null, cycle: hole.rules?.windCycle ?? null, roulette: hole.rules?.roulette ?? null });

// Per club in CLUBS order: 1 if it can be played, for the solver's loops (null: every club; the
// roulette's only come up when the search is given the hole's shifts)
export function clubMask(rules) {
    if (!rules?.ban?.length) return null;
    return Uint8Array.from(CLUBS, club => (ruleAllows(rules, club) ? 1 : 0));
}
