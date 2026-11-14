import { GolfRound } from "./game.js";
import { clubById } from "./clubs.js";

// ----------------------------------
// Resuming a round (v1.8.7)
// ----------------------------------
// A round in progress is saved as the clubs played (not its state): restoring plays them again on a
// fresh GolfRound, so a reload can't undo a shot, and the round comes back exactly as it was.

// A round → a small record to keep in the browser
export function snapshot(round, { mode, now = Date.now() } = {}) {
    const courseId = round.course.id;
    const rev = round.course.rev ?? 1;
    const holes = round.card.map(({ clubs, time }) => ({ clubs, time }));
    const current = !round.holeDone ? {clubs: [...round.clubs],elapsed: round.now() - round.holeStart} : {clubs: [], elapsed: 0};
    const undosLeft = round.undosLeft;
    const toPar = round.totals().toPar;

    return {
        courseId,
        rev,
        mode,
        holes,
        current,
        undosLeft,
        toPar,
        savedAt: now
    };
}

// A record → a GolfRound in the same place, or null if it doesn't replay (e.g. the course changed)
export function restore(course, saved, { undos, now } = {}) {
    try {
        if ((course.rev ?? 1) !== saved.rev) return null;
        if (saved.courseId !== course.id) return null;
        const round = new GolfRound(course, now, { undos });
        for (const { clubs, time } of saved.holes) {
            for (const clubId of clubs) {
                if (!round.play(clubById(clubId))) throw new Error("Failed to play club");
            }
            if (!round.holeDone) throw new Error(`Hole ${round.holeIndex + 1} not done`);
            round.card.at(-1).time = time;
            if (!round.nextHole()) throw new Error("Failed to go to next hole");
        }

        for (const clubId of saved.current.clubs) {
            if (!round.play(clubById(clubId))) throw new Error("Failed to play club");
        }

        round.undosLeft = saved.undosLeft;
        round.holeStart = round.now() - saved.current.elapsed;

        return round;
    } catch {
        return null;
    }
}
