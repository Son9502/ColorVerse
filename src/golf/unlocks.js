// ----------------------------------
// Course locks (v1.6)
// ----------------------------------
// The first courses are open to everyone. Each one after them needs an account and a round at its
// unlock score or better on the course just before it (Pro or not, any revision of it, so a
// regenerated course doesn't take an unlock away). Used by the courses screen and by the score
// server, which refuses rounds on a course the account hasn't unlocked.

export const FREE_COURSES = 3;

// Score against par needed on the previous course, by the course it unlocks. Set in v1.8.2 after the
// courses were regenerated to make you think: a bit better than a simulated player who plans one shot
// ahead scores (Verdant Pines −4, Cobalt Bay +17, Royal Indigo +23, Violet Vortex +2, Silverglass
// Greens +6), well short of perfect, with extra room on the Expert courses (played Pro, no yardage).
// Saffron Whirlwind (v1.8.3) asks −6 on Caddie Strike (planner −11). To tune once they've been played by hand.
const UNLOCK_TO_PAR = { cobalt: -4, indigo: 2, vortex: 4, silverglass: -3, caddie: -2, saffron: -6, scarlet: -4, hexflip: -4, gauntlet: -4 };
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
