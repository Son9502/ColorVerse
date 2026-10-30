import { GolfRound } from "./game.js";
import { clubById } from "./clubs.js";

// ----------------------------------
// Replaying a recorded round with the game's own rules (v1.6)
// ----------------------------------
// The score server doesn't trust a submitted score: it takes the clubs played on each hole and
// plays them again with GolfRound, so the strokes, penalties, pick-ups and holes-in come from the
// same code the game runs. Anything that doesn't replay cleanly is rejected.

const MAX_HOLE_MS = 60 * 60 * 1000; // a time is the player's word; clamp it to something sane

// holes: the course's holes; played: one entry per hole, in order: { clubs: [club ids], time (ms) }.
// Returns the replayed card ({ par, perfect, strokes, time, pickedUp } per hole) and its totals,
// or throws an Error saying what didn't replay.
export function replayRound(holes, played) {
    if (!Array.isArray(played) || played.length === 0 || played.length > holes.length) {
        throw new Error("wrong number of holes");
    }
    const round = new GolfRound({ holes }, () => 0, { undos: 0 });
    played.forEach(({ clubs, time }, i) => {
        if (i > 0 && !round.nextHole()) throw new Error(`hole ${i + 1}: can't move on`);
        if (!Array.isArray(clubs) || clubs.length === 0 || clubs.length > round.maxStrokes) {
            throw new Error(`hole ${i + 1}: bad stroke list`);
        }
        clubs.forEach((id, k) => {
            const club = Number.isInteger(id) ? clubById(id) : null;
            if (!club) throw new Error(`hole ${i + 1}, stroke ${k + 1}: unknown club`);
            if (round.holeDone) throw new Error(`hole ${i + 1}: strokes after the hole was finished`);
            if (!round.play(club)) throw new Error(`hole ${i + 1}, stroke ${k + 1}: club can't be played from there`);
        });
        if (!round.holeDone) throw new Error(`hole ${i + 1}: not finished`);
        round.card[i].time = Math.min(MAX_HOLE_MS, Math.max(0, Math.round(Number(time) || 0)));
    });
    const card = round.card.map(({ clubs, ...hole }) => hole);
    return { card, totals: round.totals() };
}
