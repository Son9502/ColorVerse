// ----------------------------------
// Course locks (v1.6)
// ----------------------------------
// The first courses are open to everyone. Each one after them needs an account and a round at its
// unlock score or better on the course just before it (Pro or not, any revision of it, so a
// regenerated course doesn't take an unlock away). Used by the courses screen and by the score
// server, which refuses rounds on a course the account hasn't unlocked.

export const FREE_COURSES = 3;

// Score against par needed on the previous course, by the course it unlocks; to tune once the
// courses have been played by hand. Cobalt Bay's perfect round is −6, so Royal Indigo asks less.
const UNLOCK_TO_PAR = { cobalt: -6, indigo: -3 };
const DEFAULT_TO_PAR = -6;
export const unlockToPar = (course) => UNLOCK_TO_PAR[course.id] ?? DEFAULT_TO_PAR;

// What course `index` still needs: null (open), "account" or "score".
// bests: { "<course id>" | "<course id>:pro": { toPar, … } }
export function courseLock(courses, index, { signedIn, bests = {} }) {
    if (index < FREE_COURSES) return null;
    if (!signedIn) return "account";
    const previous = courses[index - 1].id;
    const need = unlockToPar(courses[index]);
    const unlocked = [previous, `${previous}:pro`].some(key => bests[key] && bests[key].toPar <= need);
    return unlocked ? null : "score";
}
