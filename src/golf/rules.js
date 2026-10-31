import { CLUBS } from "./clubs.js";

// ----------------------------------
// Hole rules (v1.8.2)
// ----------------------------------
// Gimmicks that aren't regions of color space live in `hole.rules`, read here by the round, the
// solver, the hole builder and the score server's replay alike.
// - Club bans (Caddie Strike): { ban: [row, …], name: "No Driver or Woods" }. Banned rows can't be
//   played (greyed out, as in a bunker).

// Whether `club` can be played on a hole with these rules
export const ruleAllows = (rules, club) => !rules?.ban?.includes(club.row);

// Per club in CLUBS order: 1 if it can be played, for the solver's loops (null: every club)
export function clubMask(rules) {
    if (!rules?.ban?.length) return null;
    return Uint8Array.from(CLUBS, club => (ruleAllows(rules, club) ? 1 : 0));
}
