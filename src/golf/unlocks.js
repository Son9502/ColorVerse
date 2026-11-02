// ----------------------------------
// Course locks (v1.6)
// ----------------------------------
// The first courses are open to everyone. Each one after them needs an account and a round at its
// unlock score or better on the course before it: the one just before in the list, or the one its
// `after` names (the Monochrome courses, v1.8.6, have their own chain from Prism Point). Pro or not,
// any revision of it, so a regenerated course doesn't take an unlock away. Used by the courses screen
// and by the score server, which refuses rounds on a course the account hasn't unlocked.

export const FREE_COURSES = 3;

// Score against par needed on the previous course, by the course it unlocks. Set in v1.8.2 after the
// courses were regenerated to make you think: a bit better than a simulated player who plans one shot
// ahead scores (Verdant Pines −4, Cobalt Bay +17, Royal Indigo +23, Violet Vortex +2, Silverglass
// Greens +6), well short of perfect, with extra room on the Expert courses (played Pro, no yardage).
// Saffron Whirlwind (v1.8.3) asks −6 on Caddie Strike (planner −11). To tune once they've been played by hand.
// Cobalt Bay went from −4 to −8 in v1.8.6, when Verdant Pines got the bigger Standard hole (planner −4 → −9).
// Then every score got 3 strokes of grace (v1.8.6, after playtesting). The Monochrome chain (gray copies
// of courses 1–5) starts from Prism Point; harder to read, so a little gentler than its color twin.
const UNLOCK_TO_PAR = {
    cobalt: -5, indigo: 5, vortex: 7, silverglass: 0, caddie: 1, saffron: -3, scarlet: -1, hexflip: -1, gauntlet: -1,
    ash: -6, cinder: 0, slate: 0, graphite: 0, onyx: 8,
};
const DEFAULT_TO_PAR = -3;

// The course whose score unlocks course `index`
export const unlockedBy = (courses, index) => courses.find(c => c.id === courses[index].after) ?? courses[index - 1];
export const unlockToPar = (course) => UNLOCK_TO_PAR[course.id] ?? DEFAULT_TO_PAR;

// What course `index` still needs: null (open), "account" or "score".
// bests: { "<course id>" | "<course id>:pro": { toPar, … } }
export function courseLock(courses, index, { signedIn, bests = {} }) {
    if (index < FREE_COURSES) return null;
    if (!signedIn) return "account";
    const previous = unlockedBy(courses, index).id;
    const need = unlockToPar(courses[index]);
    const unlocked = [previous, `${previous}:pro`].some(key => bests[key] && bests[key].toPar <= need);
    return unlocked ? null : "score";
}
